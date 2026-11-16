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
import { CHIMNEY, DOOR, HOUSE, LAMP, LIGHTHOUSE, WATER_DOT } from "./sprites";
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
/**
 * The share of land cells that hold a character: along the water's edge (the
 * cells next to the water, then the cells behind those), and on the rest of
 * the beach. The edge is dense, so the shore reads as a clear line.
 */
const EDGE_FIRST = 0.9;
const EDGE_SECOND = 0.6;
const SAND_SPECKS = 0.4;
/** The size of the woods on the land. */
const WOOD_SIZE = 170;
/** How many paving stones wide the path to the house is, at its highest step. */
const PATH_WIDTH = 4;

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
 * How many cells a land cell is from the water, counted straight across or up
 * and down the screen: 1 next to it, 2 one cell further, 0 further than that.
 * Counting cells rather than pixels keeps the edge as wide on screen wherever
 * the shore runs, along a row or down a column.
 */
function fromTheWater(lake: Lake, col: number, row: number, cellW: number, cellH: number): number {
  for (const d of [1, 2]) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (shoreDistance(lake, cellCentre(col + dc * d, row + dr * d, cellW, cellH)) > 0) return d;
    }
  }
  return 0;
}

/**
 * The cell of the top left corner of a drawing that stands up the screen from
 * `foot`, the middle of its bottom row.
 */
export function standing(drawing: readonly string[], foot: Vec, cellW: number, cellH: number): { col: number; row: number } {
  const at = project(foot);
  return {
    col: Math.floor(at.x / cellW) - Math.floor(drawing[0].length / 2),
    row: Math.floor(at.y / cellH) - (drawing.length - 1),
  };
}

/**
 * A standing drawing's part of a cell: its character, a space where the cell is
 * inside the drawing but blank, or null where the cell is clear of it. Each row
 * counts from one column before its first character to one after its last, so
 * the woods behind don't run into the outline.
 */
function partOf(
  drawing: readonly string[],
  foot: Vec,
  col: number,
  row: number,
  cellW: number,
  cellH: number,
): string | null {
  const top = standing(drawing, foot, cellW, cellH);
  const line = drawing[row - top.row];
  if (line === undefined) return null;
  const c = col - top.col;
  const first = line.search(/\S/);
  if (first < 0 || c < first - 1 || c > line.trimEnd().length) return null;
  return line[c] ?? " ";
}

/** The lighthouse's part of a cell. The dark bands are dim, the light ones ash, and the lamp bright. */
function lighthouseAt(lake: Lake, col: number, row: number, cellW: number, cellH: number): Glyph | null {
  const char = partOf(LIGHTHOUSE, lake.lighthouse, col, row, cellW, cellH);
  if (char === null) return null;
  if (char === " ") return SAND;
  return { char, tone: char === LAMP ? BONE : char === ":" || char === "." ? DIM : ASH, solid: true };
}

/** The house's part of a cell. The windows are lit; the tiles on the roof and along the foot of the wall are dim. */
function houseAt(lake: Lake, col: number, row: number, cellW: number, cellH: number): Glyph | null {
  const char = partOf(HOUSE, lake.house, col, row, cellW, cellH);
  if (char === null) return null;
  if (char === " ") return SAND;
  const window = (char === "[" || char === "]") && row !== standing(HOUSE, lake.house, cellW, cellH).row + CHIMNEY.row;
  return { char, tone: window ? BONE : char === "X" ? DIM : ASH, solid: true };
}

/** The path's cells, worked out once per lake and size of cell. */
const paths = new WeakMap<Lake, { cellW: number; cellH: number; cells: ReadonlyMap<string, Glyph> }>();

/**
 * The paved path from the jetty up to the house's door, by cell ("col,row").
 * It climbs in steps, a row at a time, each step a run of paving stones edged
 * with `-` above and below and `/` at either end, where it meets the steps
 * beside it:
 *
 *                     ----.
 *                ----/=#==|      the house's door is above this end
 *           ----/==#=/----'
 *      .----/=#==/----
 *      |=#==/----                the jetty's deck is below this end
 *      '----
 *
 * The lowest step starts on the end of the deck, and the highest, PATH_WIDTH
 * stones wide, is under the door and its frame. The outline is ash and the
 * paving dim.
 */
export function pathCells(lake: Lake, cellW: number, cellH: number): ReadonlyMap<string, Glyph> {
  const kept = paths.get(lake);
  if (kept && kept.cellW === cellW && kept.cellH === cellH) return kept.cells;

  // The end of the deck: its top row, and its columns there.
  const deckRow = Math.ceil(project(lake.jetty.shore).y / cellH - 0.5);
  const deckCols: number[] = [];
  const deckCol = Math.floor(project(lake.jetty.shore).x / cellW);
  for (let c = deckCol - 6; c <= deckCol + 6; c++) {
    if (onJetty(lake, cellCentre(c, deckRow, cellW, cellH))) deckCols.push(c);
  }
  const top = standing(HOUSE, lake.house, cellW, cellH);

  // The steps, from the lowest (on the deck) to the highest (under the door): a row and a first column each.
  // The highest step is as wide as the door with its frame, one column either side of the opening.
  const lowRow = deckRow - 1;
  const highRow = top.row + DOOR.row + 1;
  const rises = Math.max(0, lowRow - highRow);
  const lowCol = deckCols[0] ?? deckCol;
  const highCol = top.col + DOOR.col - 1;
  const firstCol = (k: number) => Math.round(lowCol + ((highCol - lowCol) * k) / Math.max(1, rises));

  const cells = new Map<string, Glyph>();
  const set = (col: number, row: number, char: string, tone: Tone, over = true) => {
    const key = `${col},${row}`;
    if (over || !cells.has(key)) cells.set(key, { char, tone, solid: true });
  };
  const paving: [number, number][] = [];
  for (let k = 0; k <= rises; k++) {
    const row = lowRow - k;
    const from = firstCol(k);
    // Up to where the next step begins, leaving a column for the `/` between them; the highest is PATH_WIDTH wide.
    const to = k === rises ? from + PATH_WIDTH - 1 : Math.max(from + 1, firstCol(k + 1) - 2);
    for (let col = from; col <= to; col++) {
      set(col, row, scatter(col, row, lake.seed + 50) < 0.25 ? "#" : "=", DIM);
      paving.push([col, row]);
    }
    set(from - 1, row, k === 0 ? "|" : "/", ASH);
    set(to + 1, row, k === rises ? "|" : "/", ASH);
    // The two ends are rounded off, above and below.
    if (k === 0) {
      set(from - 1, row - 1, ".", ASH);
      set(from - 1, row + 1, "'", ASH);
    }
    if (k === rises) {
      set(to + 1, row - 1, ".", ASH);
      set(to + 1, row + 1, "'", ASH);
    }
  }
  // Edges above and below the paving, where nothing else of the path is.
  for (const [col, row] of paving) {
    set(col, row - 1, "-", ASH, false);
    set(col, row + 1, "-", ASH, false);
  }
  paths.set(lake, { cellW, cellH, cells });
  return cells;
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

  const tower = lighthouseAt(lake, col, row, cellW, cellH);
  if (tower) return tower;
  const house = houseAt(lake, col, row, cellW, cellH);
  if (house) return house;

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
    // The path up to the house.
    const path = pathCells(lake, cellW, cellH).get(`${col},${row}`);
    if (path) return path;
    if (out > -BEACH) {
      // Wet sand along the water's edge, thick and brighter; dry sand behind it, sparse.
      const edge = fromTheWater(lake, col, row, cellW, cellH);
      if (edge === 1) {
        return whether < EDGE_FIRST ? { char: pick(":::;.", what), tone: bright < 0.35 ? ASH : DIM, solid: true } : SAND;
      }
      if (edge === 2) {
        return whether < EDGE_SECOND ? { char: pick(".:.:,", what), tone: bright < 0.2 ? ASH : DIM, solid: true } : SAND;
      }
      return whether < SAND_SPECKS ? { char: pick(".:.:,", what), tone: bright < 0.1 ? ASH : DIM, solid: true } : SAND;
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
