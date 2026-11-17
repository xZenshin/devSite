import { smoothstep } from "./math";
import { ASH, DIM, type Glyph } from "./texture";
import { cellCentre, patchiness, scatter, type Vec } from "./world";

/**
 * The water as it moves: what a cell of the lake shows at a given moment, on
 * top of its texture. Gusts of wind ruffle the surface as they cross it and
 * bend the reeds, waves lap at the shore, and here and there the light glints.
 * Everything follows from the lake's seed and the time, so nothing is stored.
 */

/** How fast gusts travel with the wind, in world units (pixels) per second. */
export const WIND_SPEED = 46;
/** A gust's size along the wind and across it. */
const GUST_LENGTH = 420;
const GUST_WIDTH = 230;
/** Where gusts begin and are at full strength, on the scale of the noise they are drawn from. */
const GUST_FROM = 0.7;
const GUST_FULL = 0.85;
/** The share of the water a gust at full strength ruffles. */
const RUFFLE = 0.16;

/** How far from the shore the waves wash up at most, and how often they come in (radians per second). */
export const WASH_REACH = 44;
const LAP_RATE = 1.3;
/** The width of the line of foam at the front of a wave. */
const FOAM = 11;

/** The share of water cells that ever glint, and the share of its time a glint lasts. */
const GLINTERS = 0.01;
const GLINT = 0.025;

/** The way the wind blows over a lake: across the screen, east or west, give or take a third of a right angle. */
export function windOf(seed: number): Vec {
  const angle = (scatter(seed, 0, 77) - 0.5) * 1.2 + (scatter(seed, 1, 77) < 0.5 ? 0 : Math.PI);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * How hard the wind is blowing at a point, from 0 (calm) to 1: patches of
 * gusts, longer than they are wide, that drift across the lake with the wind.
 */
export function gustAt(seed: number, p: Vec, time: number): number {
  const w = windOf(seed);
  const along = p.x * w.x + p.y * w.y - WIND_SPEED * time;
  const across = p.y * w.x - p.x * w.y;
  return smoothstep(GUST_FROM, GUST_FULL, patchiness(along / GUST_LENGTH, across / GUST_WIDTH, seed + 11));
}

/**
 * How far up the beach the waves reach at a point of the shore, from half of
 * WASH_REACH to all of it, and whether the water is coming in or going out.
 * Waves come in at different moments along the shore.
 */
export function washAt(seed: number, p: Vec, time: number): { reach: number; rising: boolean } {
  const phase = time * LAP_RATE + patchiness(p.x / 240, p.y / 240, seed + 30) * 4 * Math.PI;
  return { reach: WASH_REACH * (0.75 + 0.25 * Math.sin(phase)), rising: Math.cos(phase) > 0 };
}

/**
 * What a cell of water shows at `time`, `out` from the shore: the wash, a
 * ruffle where a gust is passing, or a glint. Null where it shows its texture.
 */
export function surfaceAt(
  seed: number,
  col: number,
  row: number,
  cellW: number,
  cellH: number,
  out: number,
  time: number,
): Glyph | null {
  const p = cellCentre(col, row, cellW, cellH);
  const roll = scatter(col, row, seed + 20);

  if (out < WASH_REACH) {
    const { reach, rising } = washAt(seed, p, time);
    if (out < reach) {
      // A thin line of foam at the front of the wave, a little brighter here and there as it comes in;
      // behind it, the odd wet mark.
      if (reach - out < FOAM) {
        if (roll >= 0.5) return null;
        return { char: rising ? "~" : "-", tone: rising && roll < 0.12 ? ASH : DIM, solid: false };
      }
      return roll < 0.15 ? { char: "~", tone: DIM, solid: false } : null;
    }
  }

  const gust = gustAt(seed, p, time);
  if (gust > 0 && roll < gust * RUFFLE) {
    // The ruffle shimmers, slowly: each cell changes about once a second.
    const flicker = scatter(col, row, Math.floor(time * 1.2) + seed * 7);
    return { char: flicker < 0.65 ? "~" : "-", tone: DIM, solid: false };
  }

  if (gust < 0.15 && scatter(col, row, seed + 23) < GLINTERS) {
    const rate = 0.07 + 0.08 * scatter(col, row, seed + 22);
    const cycle = time * rate + scatter(col, row, seed + 21);
    const f = cycle - Math.floor(cycle);
    if (f < GLINT) return { char: f < GLINT / 2 ? "'" : ".", tone: ASH, solid: false };
  }
  return null;
}

/** How a reed bends at `time`: over with the wind while a gust passes, now and then; null while it stands. */
export function swayAt(seed: number, col: number, row: number, cellW: number, cellH: number, time: number): string | null {
  const gust = gustAt(seed, cellCentre(col, row, cellW, cellH), time);
  if (gust < 0.3) return null;
  if (scatter(col, row, Math.floor(time * 1.5) + seed * 13) > gust * 0.6) return null;
  return windOf(seed).x > 0 ? "/" : "\\";
}
