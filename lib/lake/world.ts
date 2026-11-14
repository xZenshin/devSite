/**
 * The lake's geometry. The world is a flat plane measured in pixels; the camera
 * looks down at a tilt, so the far-near axis (y) is drawn at half length and a
 * circle on the water reads as an ellipse on screen.
 */

export interface Vec {
  x: number;
  y: number;
}

/** How much of the world's y axis survives the tilt. */
export const TILT = 0.5;

/** Share of water cells that hold a speck, in percent. */
const DOT_DENSITY = 2.4;

/** World to screen plane (before the camera offset). */
export function project(p: Vec): Vec {
  return { x: p.x, y: p.y * TILT };
}

/** Screen plane back to the world. */
export function unproject(s: Vec): Vec {
  return { x: s.x, y: s.y / TILT };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Whether a character cell of the water holds a speck. A hash of the cell's
 * coordinates decides, so the lake is endless, needs no storage, and looks the
 * same every time the boat sails back.
 */
export function hasDot(col: number, row: number): boolean {
  let h = Math.imul(col, 374761393) ^ Math.imul(row, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h % 1000 < DOT_DENSITY * 10;
}

/** Where a cast aimed at `target` lands: there, or at full range in that direction. */
export function clampCast(from: Vec, target: Vec, range: number): Vec {
  const d = distance(from, target);
  if (d <= range) return { ...target };
  const k = range / d;
  return { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k };
}

/**
 * Which of eight headings a movement points along, as it looks on screen:
 * 0 is east, then clockwise (1 south-east, 2 south, … 7 north-east).
 */
export function headingIndex(dx: number, dy: number): number {
  const angle = Math.atan2(dy * TILT, dx);
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

/**
 * Draws a ring of radius `r` on the water as characters, calling `plot` for
 * each cell it passes through. `center` is on the screen plane. The ring is
 * followed column by column. Where it runs across the screen, each column gets
 * one character chosen by how high in its cell the ring sits; where it runs
 * down the screen, at the two ends, the column gets a bracket per row:
 *
 *       ..--''''--..
 *    .-'            '-.
 *   (                  )
 *    '-.            .-'
 *       ''--....--''
 */
export function traceRing(
  center: Vec,
  r: number,
  cellW: number,
  cellH: number,
  plot: (col: number, row: number, char: string) => void,
): void {
  if (r < cellW / 2) {
    plot(Math.floor(center.x / cellW), Math.floor(center.y / cellH), "o");
    return;
  }
  /** How far above and below the centre line the ring is, at `x` from the centre. */
  const halfHeight = (x: number) => TILT * Math.sqrt(Math.max(0, r * r - x * x));

  /** One column's stretch of the ring, between screen heights `top` and `bottom`. */
  const stroke = (col: number, top: number, bottom: number, bracket: string, isTip: boolean) => {
    if (bottom - top <= cellH * 0.8) {
      const middle = (top + bottom) / 2;
      const row = Math.floor(middle / cellH);
      const within = middle / cellH - row;
      plot(col, row, isTip ? bracket : within < 1 / 3 ? "'" : within < 2 / 3 ? "-" : ".");
      return;
    }
    const firstRow = Math.floor(top / cellH);
    const lastRow = Math.floor(bottom / cellH);
    for (let row = firstRow; row <= lastRow; row++) {
      const covered = (Math.min(bottom, (row + 1) * cellH) - Math.max(top, row * cellH)) / cellH;
      // A row the ring only clips gets a corner mark instead of a full-height bracket.
      if (covered > 0.6) plot(col, row, bracket);
      else if (covered > 0.15) plot(col, row, row === firstRow ? "." : "'");
    }
  };

  const lastCol = Math.floor((center.x + r) / cellW);
  for (let col = Math.floor((center.x - r) / cellW); col <= lastCol; col++) {
    const left = Math.max(col * cellW - center.x, -r);
    const right = Math.min((col + 1) * cellW - center.x, r);
    const isTip = left === -r || right === r;
    // A column the ring barely reaches into would only double the bracket beside it.
    if (isTip && right - left < cellW * 0.35) continue;
    const bracket = left + right < 0 ? "(" : ")";
    const high = left <= 0 && right >= 0 ? TILT * r : Math.max(halfHeight(left), halfHeight(right));
    const low = Math.min(halfHeight(left), halfHeight(right));
    if (isTip) {
      // The far and near edges meet here.
      stroke(col, center.y - high, center.y + high, bracket, true);
    } else {
      stroke(col, center.y - high, center.y - low, bracket, false);
      stroke(col, center.y + low, center.y + high, bracket, false);
    }
  }
}
