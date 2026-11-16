import { JUNK, type Catch, type CatchKind, type Junk } from "../catches";
import { stock, wander, type Shoal, type Swimmer } from "./fish";
import { BOAT_RADIUS, createLake, inReeds, intoWater, nearestObstruction, type Lake } from "./lake";
import { clampCast, distance, headingIndex, scatter, type Vec } from "./world";

/** World units (pixels) per second, and per second squared. */
export const BOAT_SPEED = 320;
export const BOAT_ACCEL = 620;
/** The share of its speed the boat keeps while it pushes through reeds. */
export const REED_DRAG = 0.4;
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
 * drawing). The wake starts behind it, and the shore, the jetty and rocks are
 * kept BOAT_RADIUS away from it.
 */
export const HULL_CENTRE_Y = -34;
const STERN = { x: 80, y: 30 };
/** The positions the paddle goes through in one full turn, and the distance paddled between two of them. */
export const PADDLE_FRAMES = 4;
export const PADDLE_STEP = 45;

export const FLY_TIME = 0.55;
/** How long the lure sits in open water before something bites. */
export const WAIT_MIN = 3;
export const WAIT_MAX = 5;
/** A fish within this distance of where the lure lands goes for it. */
export const LURE_REACH = 200;
/** How long that takes: the shortest wait is for a lure dropped on the fish's nose, the longest for one at full reach. */
export const FISH_WAIT_MIN = 0.7;
export const FISH_WAIT_MAX = 1.9;
export const BITE_TIME = 0.7;
export const REEL_TIME = 0.9;
const JUNK_CHANCE = 0.2;
/** Fish only rise where the boat is near enough to see it, every few seconds per shoal. */
const RISE_SIGHT = 1000;
const RISE_MIN = 2.5;
const RISE_MAX = 7;

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
  /** The fish that is going for the lure, if it landed near one. */
  fish: { shoal: number; id: number } | null;
}

export interface GameState {
  boat: Vec;
  /** 0 east, then clockwise in eighths; see headingIndex. */
  heading: number;
  dest: Vec | null;
  speed: number;
  /** Distance sailed since the last pair of waves. */
  wake: number;
  /** Distance paddled since setting off, within one full turn of the paddle; see paddleFrame. */
  stroke: number;
  waves: Wave[];
  ripples: Ripple[];
  line: Line | null;
  /** The lake's shore and everything in it; null for open water without end. */
  lake: Lake | null;
  /** The fish, one shoal per fishing ground of the lake. */
  shoals: Shoal[];
  /** Seconds the lake has been moving: the fish swim and the water stirs by this clock. */
  time: number;
  /** Which shoal the last thing reeled in came from; null if the lure was out in open water. */
  caughtFrom: CatchKind | null;
  /** How long the boat has been unable to move, in seconds. */
  stuck: number;
}

export type GameEvent = "landed" | "bite" | "caught";

export interface StepOptions {
  /** No wake or ripples, the fish and the water keep still, and the throw and the reel-in take no time. */
  reducedMotion?: boolean;
}

/** How many fish each shoal holds: what is left to catch of each kind. */
export type Stock = Partial<Record<CatchKind, number>>;

/**
 * A new game, the boat at the start. A seed gives the lake that follows from
 * it, with the boat moored at its jetty; without one there is only open water.
 */
export function createGame(options: { seed?: number; stock?: Stock } = {}): GameState {
  const lake = options.seed === undefined ? null : createLake(options.seed);
  const state: GameState = {
    boat: { x: 0, y: 0 },
    heading: 0,
    dest: null,
    speed: 0,
    wake: 0,
    stroke: 0,
    waves: [],
    ripples: [],
    line: null,
    lake,
    shoals: (lake?.grounds ?? []).map((grounds, i) => ({
      ...grounds,
      fish: [],
      rise: RISE_MIN + scatter(i, 0, lake!.seed) * (RISE_MAX - RISE_MIN),
    })),
    time: 0,
    caughtFrom: null,
    stuck: 0,
  };
  stockShoals(state, options.stock ?? {});
  return state;
}

/** Sets how many fish swim in each shoal: as many as there is left to catch of its kind. */
export function stockShoals(state: GameState, left: Stock): void {
  for (const shoal of state.shoals) stock(shoal, left[shoal.kind] ?? 0);
}

/**
 * Sail to a point, or to the nearest water the hull floats in when the point
 * is ashore, on the jetty or on a rock. Any line that is out comes back empty.
 */
export function moveTo(state: GameState, target: Vec): void {
  if (state.line) {
    if (state.line.phase !== "flying") addRipple(state, state.line.target, 36, 0.7);
    state.line = null;
  }
  // Setting off from rest starts a new stroke; being steered while under way doesn't break the rhythm.
  if (!state.dest) state.stroke = 0;
  state.dest = afloat(state, target);
  state.stuck = 0;
}

/**
 * Where a lure thrown at `target` lands: there, or at full range in that
 * direction; and in the water just off the shore, the jetty or a rock rather
 * than on it.
 */
export function castLanding(state: GameState, target: Vec): Vec {
  const landing = clampCast(state.boat, target, CAST_RANGE);
  return state.lake ? intoWater(state.lake, landing, 8) : landing;
}

/**
 * Where a fish is now. A fish going for the lure leaves its course and swims
 * to it while the lure sits, then stays on the hook.
 */
export function fishAt(state: GameState, shoal: number, id: number): Swimmer {
  const free = wander(state.lake?.seed ?? 0, shoal, id, state.shoals[shoal].home, state.time);
  const line = state.line;
  if (!line?.fish || line.fish.shoal !== shoal || line.fish.id !== id || line.phase === "flying") return free;
  if (line.phase === "waiting") {
    const f = Math.min(1, line.t / line.wait);
    return { ...lerp(free, line.target, f * f * (3 - 2 * f)), east: line.target.x > free.x };
  }
  return { ...(lurePosition(state)?.at ?? line.target), east: state.boat.x > line.target.x };
}

/** The fish nearest to a point, and how far away it is; null in water without fish. */
export function nearestFish(state: GameState, p: Vec): { shoal: number; id: number; distance: number } | null {
  let nearest: { shoal: number; id: number; distance: number } | null = null;
  for (let s = 0; s < state.shoals.length; s++) {
    for (const id of state.shoals[s].fish) {
      const d = distance(fishAt(state, s, id), p);
      if (!nearest || d < nearest.distance) nearest = { shoal: s, id, distance: d };
    }
  }
  return nearest;
}

/**
 * Throw the lure towards a point (see castLanding). The boat stops and turns
 * to face the throw. A fish near where the lure lands goes for it, and the
 * nearer it is the sooner it bites; out in open water the wait is long. Does
 * nothing while a line is already out.
 */
export function cast(state: GameState, target: Vec, rng: () => number): boolean {
  if (state.line) return false;
  const landing = castLanding(state, target);
  state.dest = null;
  state.speed = 0;
  if (distance(state.boat, landing) > 1) {
    state.heading = headingIndex(landing.x - state.boat.x, landing.y - state.boat.y);
  }
  const near = nearestFish(state, landing);
  const roll = rng();
  if (near && near.distance <= LURE_REACH) {
    const wait = FISH_WAIT_MIN + (FISH_WAIT_MAX - FISH_WAIT_MIN) * (0.7 * (near.distance / LURE_REACH) + 0.3 * roll);
    state.line = { phase: "flying", target: landing, t: 0, wait, fish: { shoal: near.shoal, id: near.id } };
  } else {
    state.line = { phase: "flying", target: landing, t: 0, wait: WAIT_MIN + roll * (WAIT_MAX - WAIT_MIN), fish: null };
  }
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

  if (!still) {
    state.time += dt;
    swim(state, dt);
  }

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
      // The fish that took the lure leaves its shoal with it.
      const hooked = line.fish;
      const shoal = hooked ? state.shoals[hooked.shoal] : null;
      if (shoal && hooked) shoal.fish = shoal.fish.filter((id) => id !== hooked.id);
      state.caughtFrom = shoal?.kind ?? null;
      state.line = null;
      if (!still) addRipple(state, state.boat, 60, 1);
      events.push("caught");
    }
  }
  return events;
}

/** Whether the boat, the line or the surface is still changing, so the picture needs redrawing at once. */
export function isActive(state: GameState): boolean {
  return state.dest !== null || state.line !== null || state.ripples.length > 0 || state.waves.length > 0;
}

/** Whether there are fish about: they drift on even when nothing else moves. */
export function hasFish(state: GameState): boolean {
  return state.shoals.some((shoal) => shoal.fish.length > 0);
}

/**
 * Which position the paddle is in: 0 at rest, then one further round for every
 * PADDLE_STEP paddled. The first stroke starts the moment the boat moves.
 */
export function paddleFrame(state: GameState): number {
  if (!state.dest) return 0;
  return Math.ceil(state.stroke / PADDLE_STEP) % PADDLE_FRAMES;
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
 * Decides what comes up. A lure taken by a fish brings up something of that
 * shoal's kind. Out in open water it is anything not caught yet, picked at
 * random; now and then junk instead, but never on the first cast and never
 * twice running. Once everything is caught, only junk is left.
 */
export function pickHaul(
  catches: readonly Catch[],
  caught: ReadonlySet<string>,
  history: { firstCast: boolean; lastWasJunk: boolean },
  rng: () => number,
  shoal: CatchKind | null = null,
): Haul {
  const remaining = catches.filter((item) => !caught.has(item.id));
  const oneOf = <T>(items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  const ofKind = remaining.filter((item) => item.kind === shoal);
  if (ofKind.length > 0) return { type: "catch", item: oneOf(ofKind) };
  if (remaining.length === 0) return { type: "junk", item: oneOf(JUNK), fishedOut: true };
  if (!history.firstCast && !history.lastWasJunk && rng() < JUNK_CHANCE) {
    return { type: "junk", item: oneOf(JUNK), fishedOut: false };
  }
  return { type: "catch", item: oneOf(remaining) };
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
  // Reeds drag on the hull: the boat loses way quickly in them, without stopping dead.
  const top = state.lake && inReeds(state.lake, hull(state.boat)) ? BOAT_SPEED * REED_DRAG : BOAT_SPEED;
  // Speed up, cruise, and ease off so the boat settles on the spot instead of stopping dead.
  state.speed = Math.min(
    Math.max(top, state.speed - 3 * BOAT_ACCEL * dt),
    state.speed + BOAT_ACCEL * dt,
    Math.sqrt(2 * BOAT_ACCEL * remaining) + 12,
  );
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

  // The way the boat actually moved, which differs from the way to the spot while it skirts something.
  const ux = mx / moved;
  const uy = my / moved;
  // Close to the spot the direction is noise; keep the heading the boat arrived with.
  if (remaining > 6) state.heading = headingIndex(mx, my);

  if (!still) state.stroke = (state.stroke + moved) % (PADDLE_STEP * PADDLE_FRAMES);

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

/** The fish swim on, and now and then one near the boat rises and rings the surface. */
function swim(state: GameState, dt: number): void {
  if (state.shoals.length === 0) return;
  const seed = state.lake?.seed ?? 0;
  state.shoals.forEach((shoal, s) => {
    if (shoal.fish.length === 0 || distance(shoal.home, state.boat) > RISE_SIGHT) return;
    shoal.rise -= dt;
    if (shoal.rise > 0) return;
    const moment = Math.floor(state.time * 1000);
    const id = shoal.fish[Math.floor(scatter(moment, s, seed) * shoal.fish.length)];
    addRipple(state, fishAt(state, s, id), 28, 1.3);
    shoal.rise = RISE_MIN + scatter(moment, s + 64, seed) * (RISE_MAX - RISE_MIN);
  });
}

/** The middle of the hull of a boat at `p`. */
function hull(p: Vec): Vec {
  return { x: p.x, y: p.y + HULL_CENTRE_Y };
}

/** Where the boat is when the middle of its hull is at `h`. */
function boatAt(h: Vec): Vec {
  return { x: h.x, y: h.y - HULL_CENTRE_Y };
}

/** A boat position, moved to the nearest water the hull floats clear in if the boat there would be aground. */
function afloat(state: GameState, p: Vec): Vec {
  if (!state.lake) return { ...p };
  return boatAt(intoWater(state.lake, hull(p), BOAT_RADIUS + 1));
}

/**
 * Where the boat goes when it tries to move from `from` to `to`, on its way in
 * direction `dir`: there, or if that would run it aground, along whatever is
 * in the way instead.
 */
function steer(state: GameState, from: Vec, to: Vec, dir: Vec): Vec {
  const lake = state.lake;
  if (!lake) return to;
  const { what, gap, away } = nearestObstruction(lake, hull(to));
  if (gap >= BOAT_RADIUS) return to;

  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const length = Math.hypot(sx, sy);
  // The part of the move that runs along the obstruction rather than into it.
  const into = sx * away.x + sy * away.y;
  let tx = sx - into * away.x;
  let ty = sy - into * away.y;
  const { end } = lake.jetty;
  const over = state.dest ? Math.sign(state.dest.x - end.x) : 0;
  if (what === "jetty" && over * (from.x - end.x) < 0) {
    // The spot is on the other side of the jetty, and the only way there is out round its end:
    // along the deck away from the shore, then round the end towards the spot's side.
    tx = away.y * over * length;
    ty = -away.x * over * length;
  } else if (Math.hypot(tx, ty) < length * 0.25) {
    // Heading almost straight at it: go round the side the course leans towards.
    const side = away.x * dir.y - away.y * dir.x >= 0 ? 1 : -1;
    tx = -away.y * side * length;
    ty = away.x * side * length;
  }
  return boatAt(intoWater(lake, hull({ x: from.x + tx, y: from.y + ty }), BOAT_RADIUS));
}

function addRipple(state: GameState, at: Vec, maxR: number, life: number, delay = 0): void {
  state.ripples.push({ x: at.x, y: at.y, age: -delay, life, maxR });
}

function lerp(a: Vec, b: Vec, f: number): Vec {
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
