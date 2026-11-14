import { JUNK, type Catch, type Junk } from "../catches";
import { BOAT_RADIUS, ISLAND_MAX_RADIUS, islandsAround, type Island } from "./islands";
import { clampCast, distance, headingIndex, type Vec } from "./world";

/** World units (pixels) per second, and per second squared. */
export const BOAT_SPEED = 320;
export const BOAT_ACCEL = 620;
/** How far the lure can be thrown from the boat. */
export const CAST_RANGE = 420;
/** Distance sailed between two pairs of waves in the wake. */
const WAKE_SPACING = 22;
/** How long a wave of the wake takes to fade out, in seconds. */
export const WAVE_LIFE = 3.2;
/** How fast a new wave leaves the boat's path, and how quickly it slows (per second). */
const WAVE_SPEED = 80;
const WAVE_DRAG = 1.1;
/**
 * The middle of the hull, relative to the boat's position (the bottom of its
 * drawing). The wake starts behind it, and islands are kept BOAT_RADIUS away from it.
 */
export const HULL_CENTRE_Y = -34;
const STERN = { x: 60, y: 30 };

export const FLY_TIME = 0.55;
export const WAIT_MIN = 2;
export const WAIT_MAX = 3.5;
export const BITE_TIME = 0.7;
export const REEL_TIME = 0.9;
const JUNK_CHANCE = 0.2;

/** A ring spreading over the water. A negative age is a ring that hasn't started yet. */
export interface Ripple {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
}

/** One wave of the boat's wake: it drifts away from the boat's path, slowing, and fades. */
export interface Wave {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
}

export type LinePhase = "flying" | "waiting" | "bite" | "reeling";

/** The line while it is out: thrown, sitting still, bitten, then reeled back in. */
export interface Line {
  phase: LinePhase;
  target: Vec;
  /** Seconds spent in the current phase. */
  t: number;
  /** How long the lure sits before something bites. */
  wait: number;
}

export interface GameState {
  boat: Vec;
  /** 0 east, then clockwise in eighths; see headingIndex. */
  heading: number;
  dest: Vec | null;
  speed: number;
  /** Distance sailed since the last pair of waves. */
  wake: number;
  waves: Wave[];
  ripples: Ripple[];
  line: Line | null;
  /** Seed of the islands' layout; null for open water. */
  islandSeed: number | null;
  /** How long the boat has been unable to move, in seconds. */
  stuck: number;
}

export type GameEvent = "landed" | "bite" | "caught";

export interface StepOptions {
  /** No wake or ripples, and the throw and the reel-in take no time. */
  reducedMotion?: boolean;
}

/** A new game, the boat at the start. Without an island seed the lake is open water. */
export function createGame(options: { islandSeed?: number } = {}): GameState {
  return {
    boat: { x: 0, y: 0 },
    heading: 0,
    dest: null,
    speed: 0,
    wake: 0,
    waves: [],
    ripples: [],
    line: null,
    islandSeed: options.islandSeed ?? null,
    stuck: 0,
  };
}

/**
 * Sail to a point, or to the nearest shore when the point is on an island.
 * Any line that is out comes back empty.
 */
export function moveTo(state: GameState, target: Vec): void {
  if (state.line) {
    if (state.line.phase !== "flying") addRipple(state, state.line.target, 36, 0.7);
    state.line = null;
  }
  state.dest = keepOffIslands(state, target);
  state.stuck = 0;
}

/**
 * Where a lure thrown at `target` lands: there, or at full range in that
 * direction; and in the water beside an island rather than on it.
 */
export function castLanding(state: GameState, target: Vec): Vec {
  const landing = clampCast(state.boat, target, CAST_RANGE);
  for (const island of islandsNear(state, landing, 0)) {
    const ashore = pushOut(landing, island, island.r + 8);
    if (ashore) return ashore;
  }
  return landing;
}

/**
 * Throw the lure towards a point (see castLanding). The boat stops and turns
 * to face the throw. Does nothing while a line is already out.
 */
export function cast(state: GameState, target: Vec, rng: () => number): boolean {
  if (state.line) return false;
  const landing = castLanding(state, target);
  state.dest = null;
  state.speed = 0;
  if (distance(state.boat, landing) > 1) {
    state.heading = headingIndex(landing.x - state.boat.x, landing.y - state.boat.y);
  }
  state.line = { phase: "flying", target: landing, t: 0, wait: WAIT_MIN + rng() * (WAIT_MAX - WAIT_MIN) };
  return true;
}

/** Advances the lake by `dt` seconds and reports what happened on the line. */
export function step(state: GameState, dt: number, options: StepOptions = {}): GameEvent[] {
  const events: GameEvent[] = [];
  const still = options.reducedMotion === true;

  if (state.dest) sail(state, dt, still);

  const slow = Math.exp(-WAVE_DRAG * dt);
  for (const wave of state.waves) {
    wave.age += dt;
    wave.x += wave.vx * dt;
    wave.y += wave.vy * dt;
    wave.vx *= slow;
    wave.vy *= slow;
  }
  state.waves = state.waves.filter((wave) => wave.age < WAVE_LIFE);

  for (const ripple of state.ripples) ripple.age += dt;
  state.ripples = state.ripples.filter((ripple) => ripple.age < ripple.life);

  const line = state.line;
  if (line) {
    line.t += dt;
    if (line.phase === "flying" && (still || line.t >= FLY_TIME)) {
      line.phase = "waiting";
      line.t = 0;
      if (!still) for (const delay of [0, 0.5]) addRipple(state, line.target, 110, 1.9, delay);
      events.push("landed");
    } else if (line.phase === "waiting" && line.t >= line.wait) {
      line.phase = "bite";
      line.t = 0;
      if (!still) for (const delay of [0, 0.3]) addRipple(state, line.target, 52, 0.75, delay);
      events.push("bite");
    } else if (line.phase === "bite" && line.t >= BITE_TIME) {
      line.phase = "reeling";
      line.t = 0;
    }
    if (line.phase === "reeling" && (still || line.t >= REEL_TIME)) {
      state.line = null;
      if (!still) addRipple(state, state.boat, 60, 1);
      events.push("caught");
    }
  }
  return events;
}

/** Whether anything is still changing, so the picture needs redrawing. */
export function isActive(state: GameState): boolean {
  return state.dest !== null || state.line !== null || state.ripples.length > 0 || state.waves.length > 0;
}

/** A ripple's radius now; null before it starts. It spreads fast, then slows. */
export function rippleRadius(ripple: Ripple): number | null {
  if (ripple.age < 0) return null;
  const f = Math.min(1, ripple.age / ripple.life);
  return ripple.maxR * (1 - (1 - f) ** 2);
}

/**
 * Where the lure is, and how high above the water (in screen pixels) while it
 * is in the air.
 */
export function lurePosition(state: GameState): { at: Vec; lift: number } | null {
  const line = state.line;
  if (!line) return null;
  if (line.phase === "flying") {
    const f = Math.min(1, line.t / FLY_TIME);
    return { at: lerp(state.boat, line.target, f), lift: Math.sin(Math.PI * f) * 46 };
  }
  if (line.phase === "reeling") {
    const f = Math.min(1, line.t / REEL_TIME);
    return { at: lerp(line.target, state.boat, f * f * (3 - 2 * f)), lift: 0 };
  }
  return { at: line.target, lift: 0 };
}

export type Haul = { type: "catch"; item: Catch } | { type: "junk"; item: Junk; fishedOut: boolean };

/**
 * Decides what comes up. Something not caught yet, picked at random; now and
 * then junk instead, but never on the first cast and never twice running. Once
 * everything is caught, only junk is left.
 */
export function pickHaul(
  catches: readonly Catch[],
  caught: ReadonlySet<string>,
  history: { firstCast: boolean; lastWasJunk: boolean },
  rng: () => number,
): Haul {
  const remaining = catches.filter((item) => !caught.has(item.id));
  const junk = (): Junk => JUNK[Math.min(JUNK.length - 1, Math.floor(rng() * JUNK.length))];
  if (remaining.length === 0) return { type: "junk", item: junk(), fishedOut: true };
  if (!history.firstCast && !history.lastWasJunk && rng() < JUNK_CHANCE) {
    return { type: "junk", item: junk(), fishedOut: false };
  }
  return { type: "catch", item: remaining[Math.min(remaining.length - 1, Math.floor(rng() * remaining.length))] };
}

function sail(state: GameState, dt: number, still: boolean): void {
  const dest = state.dest!;
  const dx = dest.x - state.boat.x;
  const dy = dest.y - state.boat.y;
  const remaining = Math.hypot(dx, dy);
  if (remaining < 0.5) {
    state.boat = dest;
    state.dest = null;
    state.speed = 0;
    return;
  }
  // Speed up, cruise, and ease off so the boat settles on the spot instead of stopping dead.
  state.speed = Math.min(BOAT_SPEED, state.speed + BOAT_ACCEL * dt, Math.sqrt(2 * BOAT_ACCEL * remaining) + 12);
  const intended = Math.min(remaining, state.speed * dt);
  const from = state.boat;
  const to = steer(state, from, { x: from.x + (dx / remaining) * intended, y: from.y + (dy / remaining) * intended }, {
    x: dx / remaining,
    y: dy / remaining,
  });
  const mx = to.x - from.x;
  const my = to.y - from.y;
  const moved = Math.hypot(mx, my);
  state.boat = to;

  // A safety net: something in the way the boat can't slide past. Give up rather than push forever.
  state.stuck = moved < intended * 0.05 ? state.stuck + dt : 0;
  if (state.stuck > 0.5 || distance(to, dest) < 0.5) {
    if (state.stuck <= 0.5) state.boat = dest;
    state.dest = null;
    state.speed = 0;
    state.stuck = 0;
  }
  if (moved < 1e-6) return;

  // The way the boat actually moved, which differs from the way to the spot while it skirts an island.
  const ux = mx / moved;
  const uy = my / moved;
  // Close to the spot the direction is noise; keep the heading the boat arrived with.
  if (remaining > 6) state.heading = headingIndex(mx, my);

  state.wake += moved;
  while (state.wake >= WAKE_SPACING) {
    state.wake -= WAKE_SPACING;
    if (still) continue;
    // A wave to each side of the stern, heading away from the path: together they open into a V.
    const stern = { x: state.boat.x - ux * STERN.x, y: state.boat.y + HULL_CENTRE_Y - uy * STERN.y };
    for (const side of [-1, 1]) {
      state.waves.push({ x: stern.x, y: stern.y, vx: -uy * side * WAVE_SPEED, vy: ux * side * WAVE_SPEED, age: 0 });
    }
  }
}

/** The middle of the hull of a boat at `p`. */
function hull(p: Vec): Vec {
  return { x: p.x, y: p.y + HULL_CENTRE_Y };
}

/** Islands that could be within `reach` of the shore around `p`. */
function islandsNear(state: GameState, p: Vec, reach: number): Island[] {
  if (state.islandSeed === null) return [];
  const r = reach + ISLAND_MAX_RADIUS;
  return islandsAround(state.islandSeed, p.x - r, p.y - r, p.x + r, p.y + r);
}

/** `p` moved straight out from the island's centre to `minD` away, or null if it is already that far. */
function pushOut(p: Vec, island: Island, minD: number): Vec | null {
  const dx = p.x - island.x;
  const dy = p.y - island.y;
  const d = Math.hypot(dx, dy);
  if (d >= minD) return null;
  // Dead centre: out the side facing the viewer.
  if (d < 1e-6) return { x: island.x, y: island.y + minD };
  return { x: island.x + (dx / d) * minD, y: island.y + (dy / d) * minD };
}

/** A boat position, moved to the nearest shore if the boat there would be aground. */
function keepOffIslands(state: GameState, p: Vec): Vec {
  for (const island of islandsNear(state, hull(p), BOAT_RADIUS)) {
    const out = pushOut(hull(p), island, island.r + BOAT_RADIUS + 1);
    if (out) return { x: out.x, y: out.y - HULL_CENTRE_Y };
  }
  return { ...p };
}

/**
 * Where the boat goes when it tries to move from `from` to `to`, heading `dir`:
 * there, or if that would run aground, along the shore instead. Islands are
 * round and never close together, so sliding along one always leads past it.
 */
function steer(state: GameState, from: Vec, to: Vec, dir: Vec): Vec {
  for (const island of islandsNear(state, hull(to), BOAT_RADIUS)) {
    const minD = island.r + BOAT_RADIUS;
    const h = hull(to);
    if (Math.hypot(h.x - island.x, h.y - island.y) >= minD) continue;

    const f = hull(from);
    const fd = Math.hypot(f.x - island.x, f.y - island.y) || 1;
    const nx = (f.x - island.x) / fd;
    const ny = (f.y - island.y) / fd;
    const sx = to.x - from.x;
    const sy = to.y - from.y;
    const length = Math.hypot(sx, sy);
    // The part of the move that runs along the shore rather than into it.
    const into = sx * nx + sy * ny;
    let tx = sx - into * nx;
    let ty = sy - into * ny;
    if (Math.hypot(tx, ty) < length * 0.25) {
      // Heading almost straight at it: go round the side the course leans towards.
      const side = nx * dir.y - ny * dir.x >= 0 ? 1 : -1;
      tx = -ny * side * length;
      ty = nx * side * length;
    }
    const px = f.x + tx - island.x;
    const py = f.y + ty - island.y;
    const k = minD / (Math.hypot(px, py) || 1);
    return { x: island.x + px * k, y: island.y + py * k - HULL_CENTRE_Y };
  }
  return to;
}

function addRipple(state: GameState, at: Vec, maxR: number, life: number, delay = 0): void {
  state.ripples.push({ x: at.x, y: at.y, age: -delay, life, maxR });
}

function lerp(a: Vec, b: Vec, f: number): Vec {
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
