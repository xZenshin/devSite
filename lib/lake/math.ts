import type { Vec } from "./world";

/** `x` held within [low, high]; by default [0, 1]. */
export function clamp(x: number, low = 0, high = 1): number {
  return Math.min(high, Math.max(low, x));
}

/** The number a share `f` of the way from `a` to `b`. With a roll in [0, 1) for `f`, a number somewhere in between. */
export function mix(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** A number in a range, by a roll in [0, 1). */
export function between(range: readonly [number, number], roll: number): number {
  return mix(range[0], range[1], roll);
}

/** The point a share `f` of the way from `a` to `b`. */
export function lerp(a: Vec, b: Vec, f: number): Vec {
  return { x: mix(a.x, b.x, f), y: mix(a.y, b.y, f) };
}

/** Eases a share in [0, 1] from 0 to 1: slow at both ends. */
export function smooth(f: number): number {
  return f * f * (3 - 2 * f);
}

/** 0 up to `from`, 1 from `to` on, and easing smoothly in between. */
export function smoothstep(from: number, to: number, x: number): number {
  return smooth(clamp((x - from) / (to - from)));
}
