import { windOf } from "./surface";
import { ASH, DIM, type Tone } from "./texture";
import { scatter } from "./world";

/**
 * Smoke from the house's chimney: puffs that leave it one after another, rise,
 * swell, lean with the wind and come apart as they go. Everything follows from
 * the lake's seed and the time, so nothing is stored; and with the lake's clock
 * stopped (reduced motion) the smoke stands still. It has always been rising,
 * so there is a whole column of it from the first moment.
 */

/** A puff leaves the chimney this often, in seconds, and rises a row in the same time. */
const PUFF_EVERY = 0.8;
/** How long a puff lasts, in seconds: it is gone by the time it is this many rows up, over seven. */
const PUFF_LIFE = 6;
/** How far the wind has blown a puff across by the time it is gone, in columns, and how far it wavers either side. */
const LEAN = 4;
const WAVER = 0.7;
/** How fast a puff wavers and swirls, in radians per second. */
const SWIRL = 1.8;

/** One puff of smoke. */
interface Puff {
  /** Where its middle is, in cells from the top of the chimney: columns to the right, rows down (so negative, above). */
  x: number;
  y: number;
  /** What it looks like, its middle at `x`, such as `(  )`. Spaces show what is behind. */
  chars: string;
  tone: Tone;
}

/** The puffs of smoke above the chimney at `time`, the newest first. */
export function smokeAt(seed: number, time: number): Puff[] {
  const wind = windOf(seed).x;
  const puffs: Puff[] = [];
  const newest = Math.floor(time / PUFF_EVERY);
  for (let n = newest; n > newest - Math.ceil(PUFF_LIFE / PUFF_EVERY); n--) {
    const age = time - n * PUFF_EVERY;
    if (age < 0 || age >= PUFF_LIFE) continue;
    const f = age / PUFF_LIFE;
    const phase = scatter(n, 0, seed + 40) * 2 * Math.PI;
    // It leans further downwind the higher it gets, and wavers more.
    const x = wind * LEAN * f ** 1.4 + Math.sin(age * SWIRL + phase) * WAVER * f;
    const y = -(0.6 + age / PUFF_EVERY);
    // Fresh from the chimney a small, closed puff; then a ring that swells as it rises.
    const body = f < 0.1 ? "_" : " ".repeat(2 + Math.round(2 * f));
    // Swirling, both sides curl the same way now and then.
    const swirl = Math.cos(age * SWIRL + phase);
    let left = swirl > 0.6 ? ")" : "(";
    let right = swirl < -0.6 ? "(" : ")";
    // Near the top it comes apart: one side of the ring is gone.
    if (f > 0.8) {
      if (n % 2 === 0) left = " ";
      else right = " ";
    }
    puffs.push({ x, y, chars: left + body + right, tone: f < 0.4 ? ASH : DIM });
  }
  return puffs;
}
