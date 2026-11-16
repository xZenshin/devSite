import type { Vec } from "./world";

/**
 * Birds that now and then fly over the lake, up or down the screen: from the
 * far shore to the near one, or back. A bird flies alone, or two fly together,
 * the second a little behind and to one side. They fly over the lake, not with
 * the camera, so positions are on the screen plane (as `project` gives them,
 * before the camera), in pixels.
 */

/** How fast a bird flies, in pixels per second, and how far it drifts sideways meanwhile, as a share of that. */
export const BIRD_SPEED = 95;
const DRIFT = 0.12;
/** Seconds before the first flight once the lake is on screen, and between one flight and the next. */
export const FIRST_FLIGHT_MIN = 5;
export const FIRST_FLIGHT_MAX = 12;
export const FLIGHT_GAP_MIN = 22;
export const FLIGHT_GAP_MAX = 45;
/** The share of flights that are two birds. */
const PAIRS = 0.45;
/** How far beyond the top or bottom of the view a flight starts and ends. */
const MARGIN = 60;
/** Where the second bird of a pair flies: this far to one side of the first, and this far behind it. */
const MATE_SIDE = [28, 50] as const;
const MATE_BEHIND = [16, 32] as const;
/** How far the second bird's wingbeat lags the first's, in seconds, so they don't flap in step. */
const MATE_LAG = 0.2;
/** One position of the wings lasts this long; a few wingbeats, then a glide on level wings, and again. */
const WING_TIME = 0.11;
const BEATS = 3;
const GLIDE = 0.9;

/**
 * One flight across the view. It has no set length: the view moves with the
 * boat, so it lasts until its birds are out of the view as it is then (see
 * flightOver), not as it was when they set off.
 */
export interface Flight {
  /** Where the first bird sets off, and its velocity, in pixels per second. */
  from: Vec;
  velocity: Vec;
  /** When it set off, by the lake's clock. */
  start: number;
  /** Where the second bird flies, from the first; null for a bird alone. */
  mate: Vec | null;
}

/** A bird in the air: where it is, its wings (an index into the drawings of BIRD), and whether it flies north. */
export interface Bird extends Vec {
  wings: number;
  north: boolean;
}

/** The part of the screen plane in view, in pixels. */
export interface View {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * A new flight, setting off at `time` from just beyond the top or bottom of the
 * view, somewhere between its left and right, to cross it straight up or down.
 */
export function planFlight(view: View, time: number, rng: () => number): Flight {
  const north = rng() < 0.5;
  const x = view.left + (view.right - view.left) * (0.1 + 0.8 * rng());
  const drift = (rng() - 0.5) * 2 * DRIFT * BIRD_SPEED;
  const behind = north ? 1 : -1;
  const mate =
    rng() < PAIRS
      ? {
          x: (rng() < 0.5 ? -1 : 1) * (MATE_SIDE[0] + (MATE_SIDE[1] - MATE_SIDE[0]) * rng()),
          y: behind * (MATE_BEHIND[0] + (MATE_BEHIND[1] - MATE_BEHIND[0]) * rng()),
        }
      : null;
  return {
    from: { x, y: north ? view.bottom + MARGIN : view.top - MARGIN },
    velocity: { x: drift, y: north ? -BIRD_SPEED : BIRD_SPEED },
    start: time,
    mate,
  };
}

/** How long the birds of a flight take to come into a view that stays still, from beyond its edge. */
const ARRIVAL = (2 * MARGIN + MATE_BEHIND[1]) / BIRD_SPEED;

/**
 * Whether a flight is over at `time`, with `view` as it is now: none of its
 * birds is in it, or within MARGIN of it, and they have had time to arrive.
 * They may have flown out past the far edge, or out of a side or the near edge
 * as the view moved on with the boat; either way they are gone from sight.
 * While any bird is in view the flight goes on, however far it has flown.
 */
export function flightOver(flight: Flight, time: number, view: View): boolean {
  if (time - flight.start < ARRIVAL) return false;
  const birds = birdsAt(flight, time) ?? [];
  return birds.every(
    (bird) =>
      bird.x < view.left - MARGIN ||
      bird.x > view.right + MARGIN ||
      bird.y < view.top - MARGIN ||
      bird.y > view.bottom + MARGIN,
  );
}

/** The position of a bird's wings `t` seconds into its flight: a few wingbeats, then a glide on level wings. */
export function wingsAt(t: number): number {
  const cycle = BEATS * 4 * WING_TIME + GLIDE;
  const into = ((t % cycle) + cycle) % cycle;
  if (into >= BEATS * 4 * WING_TIME) return 1;
  return Math.floor(into / WING_TIME) % 4;
}

/** The birds of a flight at `time`, wherever they have flown; null before it sets off. */
export function birdsAt(flight: Flight, time: number): Bird[] | null {
  const t = time - flight.start;
  if (t < 0) return null;
  const north = flight.velocity.y < 0;
  const lead = { x: flight.from.x + flight.velocity.x * t, y: flight.from.y + flight.velocity.y * t };
  const birds: Bird[] = [{ ...lead, wings: wingsAt(t), north }];
  if (flight.mate) {
    birds.push({ x: lead.x + flight.mate.x, y: lead.y + flight.mate.y, wings: wingsAt(t - MATE_LAG), north });
  }
  return birds;
}
