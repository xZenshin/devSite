import {
  JETTY_HALF_WIDTH,
  depth,
  inLilies,
  inReeds,
  onJetty,
  rockAt,
  shoreDistance,
  type Lake,
} from "./lake";
import { WATER_DOT } from "./sprites";
import { cellCentre, hasDot, patchiness, project, scatter, type Vec } from "./world";

/**
 * What the lake looks like, one character cell at a time. Nothing here is a
 * drawing of a thing: land, shallows, reeds and rocks are all texture, denser
 * or sparser, brighter or dimmer, seen from above like the water itself. How
 * the water moves on top of this is in surface.ts.
 */

/** How bright a character is. */
export const DIM = 1;
export const ASH = 2;
export const BONE = 3;
export type Tone = typeof DIM | typeof ASH | typeof BONE;

export interface Glyph {
  char: string;
  tone: Tone;
  /**
   * Whether it stands on or above the water (land, jetty, rock, buoy, reeds,
   * lilies). Fish, wake and ripples pass beneath these and don't show through.
   */
  solid: boolean;
  /** A reed, which bends in the wind. */
  sway?: true;
}

/** Bare ground: nothing drawn, but nothing of the water shows there either. */
const SAND: Glyph = { char: " ", tone: DIM, solid: true };

/** Share of cells that hold a speck: in the shallows by the shore, and out in the deepest water. */
const SPECKS_SHALLOW = 0.09;
const SPECKS_DEEP = 0.006;
/** How far the dry sand reaches in from the water's edge. */
const BEACH = 72;
/** The size of the woods on the land. */
const WOOD_SIZE = 170;

const pick = (chars: string, roll: number) => chars[Math.min(chars.length - 1, Math.floor(roll * chars.length))];

/** The buoy that marks a fishing ground: a float with a flag on it, two cells high. */
function buoyAt(lake: Lake, col: number, row: number, cellW: number, cellH: number): string | null {
  for (const { home } of lake.grounds) {
    const at = project(home);
    const c = Math.floor(at.x / cellW) - col;
    const r = Math.floor(at.y / cellH) - row;
    if (r === 0 && Math.abs(c) <= 1) return "(_)"[1 - c];
    if (r === 1 && c === 0) return "P";
  }
  return null;
}

/**
 * The character in a cell of the picture, or null where the cell is empty
 * water. `col` and `row` count character cells of `cellW` by `cellH` pixels
 * from the lake's origin on the screen plane, so a cell always shows the same
 * thing however the camera moves.
 */
export function glyphAt(lake: Lake | null, col: number, row: number, cellW: number, cellH: number): Glyph | null {
  // Open water without end: nothing but specks.
  if (!lake) return hasDot(col, row) ? { char: WATER_DOT, tone: DIM, solid: false } : null;

  const p: Vec = cellCentre(col, row, cellW, cellH);
  // Three numbers of the cell's own, for whether, what and how bright.
  const whether = scatter(col, row, lake.seed);
  const what = scatter(col, row, lake.seed + 1);
  const bright = scatter(col, row, lake.seed + 2);

  if (onJetty(lake, p)) {
    // Planks between two rails, with a post every third row.
    const rail = Math.abs(p.x - lake.jetty.shore.x) > JETTY_HALF_WIDTH - cellW;
    return { char: rail ? (row % 3 === 0 ? "o" : "|") : "=", tone: ASH, solid: true };
  }

  const buoy = buoyAt(lake, col, row, cellW, cellH);
  if (buoy) return { char: buoy, tone: buoy === "P" ? BONE : ASH, solid: true };

  const rock = rockAt(lake, p);
  if (rock) {
    // Brighter on top, where it stands clear of the water.
    const top = Math.hypot(p.x - rock.x, p.y - rock.y) < rock.r * 0.6;
    return { char: pick(top ? "#%#&" : "%&:;", what), tone: top ? ASH : DIM, solid: true };
  }

  const out = shoreDistance(lake, p);
  if (out <= 0) {
    if (out > -BEACH) {
      return whether < 0.4 ? { char: pick(".:.:,", what), tone: bright < 0.1 ? ASH : DIM, solid: true } : SAND;
    }
    const wooded = patchiness(p.x / WOOD_SIZE, p.y / WOOD_SIZE, lake.seed + 3) > 0.56;
    if (wooded) return whether < 0.18 ? { char: pick("^^^A*", what), tone: bright < 0.12 ? ASH : DIM, solid: true } : SAND;
    return whether < 0.04 ? { char: pick("\"',`.", what), tone: DIM, solid: true } : SAND;
  }

  // The edge of a reed bed is ragged: fewer reeds towards its rim.
  if (inReeds(lake, p)) {
    const rim = Math.min(...lake.reeds.map((bed) => Math.hypot(p.x - bed.x, p.y - bed.y) / bed.r));
    if (whether < 0.45 * (1 - rim * rim * rim)) {
      return { char: pick("||!|'\"/\\", what), tone: bright < 0.15 ? ASH : DIM, solid: true, sway: true };
    }
  }
  if (inLilies(lake, p) && whether < 0.14) {
    return what < 0.08
      ? { char: "*", tone: ASH, solid: true }
      : { char: pick("@o@0", what), tone: DIM, solid: true };
  }

  const deep = depth(lake, p);
  const specks = SPECKS_SHALLOW + (SPECKS_DEEP - SPECKS_SHALLOW) * Math.sqrt(deep);
  if (whether >= specks) return null;
  // The shallows show their sandy bed; deep water only the odd glint.
  const shallow = deep < 0.22;
  return { char: shallow && what < 0.35 ? "." : WATER_DOT, tone: shallow && bright < 0.25 ? ASH : DIM, solid: false };
}

/** How far out on the water a cell is, measured from the shore; endless in open water without a lake. */
export function shoreOffsetAt(lake: Lake | null, col: number, row: number, cellW: number, cellH: number): number {
  return lake ? shoreDistance(lake, cellCentre(col, row, cellW, cellH)) : Infinity;
}
