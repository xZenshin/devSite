import { FLY_TIME, REEL_TIME, WIND_TIME, type GameState, type Line } from "./game";
import { clamp, lerp, smooth } from "./math";
import { lineChar } from "./sprites";
import { project, type Vec } from "./world";

/**
 * The cast as it looks: the rod in the paddler's hands, the lure, and the line
 * between them. The paddler swings the rod back over his shoulder, whips it
 * forward, and the lure flies off its tip in an arc, paying the line out
 * behind it. When the lure lands the slack line falls onto the water and
 * straightens. Positions are on the screen plane (as `project` gives them,
 * before the camera), in pixels.
 */

/** The rod's butt is in the paddler's hands, this far above the boat's position; the rod is this long. */
export const ROD_LIFT = 40;
export const ROD_LENGTH = 34;
/** How high the lure arcs above the straight way from the rod's tip to where it lands. */
export const ARC = 56;
/** How long the slack line takes to fall onto the water once the lure lands. */
export const SETTLE_TIME = 0.35;
/** How far below the rod's tip the lure hangs while the rod swings back. */
const DANGLE = 10;
/** How the rod is held, in degrees above level towards the throw. Past 90 it leans back over the shoulder. */
const ROD_RAISED = 70;
const ROD_BACK = 128;
const ROD_OUT = 38;
const ROD_DIPPED = 12;
/** The share of the lure's flight the rod takes to whip forward. */
const WHIP = 0.3;
/** How many straight pieces a curved line is drawn with. */
const PIECES = 16;
/** The bobber ducks under and comes back up this often while a fish bites, in seconds. */
const BOB_UNDER = 0.12;

const easeOut = (f: number) => 1 - (1 - clamp(f)) ** 3;

/** Whether the bobber is under the water just now, while a fish bites. The rod tip dips with it. */
export function bobberUnder(line: Line): boolean {
  return line.phase === "bite" && Math.floor(line.t / BOB_UNDER) % 2 === 1;
}

/** How far the rod leans, in degrees above level towards the throw. */
function rodLean(line: Line): number {
  switch (line.phase) {
    case "winding":
      return ROD_RAISED + (ROD_BACK - ROD_RAISED) * smooth(Math.min(1, line.t / WIND_TIME));
    case "flying":
      return ROD_BACK + (ROD_OUT - ROD_BACK) * easeOut(line.t / (FLY_TIME * WHIP));
    case "bite":
      return bobberUnder(line) ? ROD_DIPPED : ROD_OUT;
    default:
      return ROD_OUT;
  }
}

/** The rod while a line is out: its butt in the paddler's hands and its tip. Null with no line out. */
export function rod(state: GameState): { butt: Vec; tip: Vec } | null {
  const line = state.line;
  if (!line) return null;
  const boat = project(state.boat);
  const butt = { x: boat.x, y: boat.y - ROD_LIFT };
  // Thrown to the right or the left on screen; straight up or down the screen counts as right.
  const side = line.target.x >= state.boat.x ? 1 : -1;
  const lean = (rodLean(line) * Math.PI) / 180;
  return { butt, tip: { x: butt.x + Math.cos(lean) * side * ROD_LENGTH, y: butt.y - Math.sin(lean) * ROD_LENGTH } };
}

/** The point `f` of the way along an arc from `from` to `to`, rising `height` above the straight way at its middle. */
function arcPoint(from: Vec, to: Vec, f: number, height: number): Vec {
  const p = lerp(from, to, f);
  return { x: p.x, y: p.y - Math.sin(Math.PI * f) * height };
}

/**
 * Where the lure is on screen: hanging from the rod's tip, flying off it in an
 * arc, on the water, and on its way back up to the tip. Null with no line out.
 */
export function lureOnScreen(state: GameState): Vec | null {
  const line = state.line;
  const held = rod(state);
  if (!line || !held) return null;
  const target = project(line.target);
  switch (line.phase) {
    case "winding":
      return { x: held.tip.x, y: held.tip.y + DANGLE };
    case "flying":
      return arcPoint(held.tip, target, Math.min(1, line.t / FLY_TIME), ARC);
    case "reeling":
      return lerp(target, held.tip, smooth(Math.min(1, line.t / REEL_TIME)));
    default:
      return target;
  }
}

/**
 * The line from the rod's tip to the lure, as points to join with straight
 * pieces. While the lure flies the line lies along its arc behind it; once it
 * lands the arc sinks onto the water, and after that the line runs straight.
 * With reduced motion it is always straight.
 */
export function linePath(state: GameState, still = false): Vec[] {
  const line = state.line;
  const held = rod(state);
  const lure = lureOnScreen(state);
  if (!line || !held || !lure) return [];
  let slack = 0;
  let paidOut = 1;
  if (!still && line.phase === "flying") {
    slack = 1;
    paidOut = Math.min(1, line.t / FLY_TIME);
  } else if (!still && line.phase === "waiting") {
    slack = (1 - Math.min(1, line.t / SETTLE_TIME)) ** 2;
  }
  if (slack === 0 || paidOut === 0) return [held.tip, lure];
  const target = project(line.target);
  const pieces = Math.max(1, Math.ceil(paidOut * PIECES));
  return Array.from({ length: pieces + 1 }, (_, i) => arcPoint(held.tip, target, (i / pieces) * paidOut, ARC * slack));
}

/**
 * Draws a line through `points` as characters, calling `plot` for each cell it
 * passes through, but for the cells of its two ends (the rod's tip and the
 * lure, drawn on their own). Each character follows the slope of the line where
 * it is, and like a straight line it gets one per column where it runs flat and
 * one per row where it slants or drops, so it stays a single thin stroke.
 */
export function traceLine(
  points: readonly Vec[],
  cellW: number,
  cellH: number,
  plot: (col: number, row: number, char: string) => void,
): void {
  if (points.length < 2) return;
  const cellOf = (p: Vec) => ({ col: Math.floor(p.x / cellW), row: Math.floor(p.y / cellH) });
  const start = cellOf(points[0]);
  const end = cellOf(points[points.length - 1]);
  let last = start;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    const char = lineChar(b.x - a.x, b.y - a.y);
    // Small steps along the piece, so no cell is jumped over.
    const steps = Math.ceil(length / 2);
    for (let s = 1; s <= steps; s++) {
      const cell = cellOf(lerp(a, b, s / steps));
      const moved = char === "-" ? cell.col !== last.col : cell.row !== last.row;
      if (!moved) continue;
      last = cell;
      const atEnd = (cell.col === start.col && cell.row === start.row) || (cell.col === end.col && cell.row === end.row);
      if (!atEnd) plot(cell.col, cell.row, char);
    }
  }
}
