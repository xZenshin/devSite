import { shoreRadius, type Lake } from "./lake";
import { MOOSE, MOOSE_FEET, mooseFacingWest } from "./sprites";
import { distance, type Vec } from "./world";

/**
 * A moose on the land by the east shore. Left alone it stands, twitches now
 * and then (an ear, its tail) and every so often bows its head to graze. When
 * the boat comes close it looks up with a `[!]`, then runs off away from the
 * lake, stops, looks round, and walks back down towards the water to a new
 * spot along the shore, where it grazes again; so it can be startled again.
 * With reduced motion it does none of that: it shows the `[!]` while the boat
 * is near, and stays where it is.
 */

/** Where along the east shore the moose keeps to: within this angle either side of due east, seen from the lake's middle. */
const SHORE_SPREAD = 0.6;
/** How far up the land from the water it grazes. */
const NEAR_WATER = [75, 120] as const;
/** The boat this close startles it. */
export const ALERT_RADIUS = 500;
/** How long it stares at the boat, `[!]` over its head, before it runs. */
export const ALERT_TIME = 0.7;
/** How fast it runs off, and walks back, in pixels per second. */
export const RUN_SPEED = 220;
export const WALK_SPEED = 70;
/** How far it runs away from the lake, and along the shore away from the boat, when startled. */
const FLEE_INLAND = 260;
const FLEE_ALONG = 120;
/** How long it stops to look round before it walks back. */
const PAUSE = [1.4, 2.4] as const;
/** How far along the shore its new spot is from the old one, as an angle seen from the lake's middle. */
const NEW_SPOT = [0.08, 0.3] as const;
/** The distance covered with each stride: its legs change between the two drawings of a stride this often. */
const STRIDE = 22;
/** A twitch lasts this long, and comes this often. */
const TWITCH_TIME = 0.3;
const TWITCH_EVERY = [2, 5] as const;
/** How often it grazes, how long its head takes to go down (and up), and how long it stays down. */
const GRAZE_EVERY = [8, 15] as const;
const BOW_TIME = 0.25;
const GRAZE_TIME = [2, 4] as const;
/** While grazing, its snout goes up and down this often (seconds per change). */
const NIBBLE = 0.3;

/** What the moose is doing. */
export type MooseMode = "idle" | "alert" | "flee" | "pause" | "return";
/** Its pose while idle. */
export type IdlePose = "stand" | "ear" | "tail" | "bow" | "graze" | "rise";

export interface Moose {
  /** Where its feet are. */
  at: Vec;
  /** 1 facing east, -1 facing west. */
  facing: 1 | -1;
  mode: MooseMode;
  /** Seconds in the mode, and how long it lasts where that is set (a pause). */
  t: number;
  until: number;
  /** Where it is running or walking to. */
  target: Vec | null;
  /** Distance covered since setting off, for which drawing of a stride it is in. */
  stride: number;
  /** While idle: its pose, seconds in it, and how long it lasts. */
  pose: IdlePose;
  poseT: number;
  poseUntil: number;
  /** Seconds until it next twitches, and next grazes. */
  nextTwitch: number;
  nextGraze: number;
}

const between = (range: readonly [number, number], rng: () => number) => range[0] + rng() * (range[1] - range[0]);
const angleOf = (lake: Lake, p: Vec) => Math.atan2(p.y - lake.centre.y, p.x - lake.centre.x);

/** A spot on the land at `angle` from the lake's middle, `back` up from the water. */
function spot(lake: Lake, angle: number, back: number): Vec {
  const r = shoreRadius(lake, angle) + back;
  return { x: lake.centre.x + Math.cos(angle) * r, y: lake.centre.y + Math.sin(angle) * r };
}

/** Facing the lake: west, on the east shore. */
const towardsLake = (lake: Lake, at: Vec): 1 | -1 => (lake.centre.x >= at.x ? 1 : -1);

/** The moose, at a spot by the east shore that follows from the lake's own numbers and `rng`. */
export function createMoose(lake: Lake, rng: () => number): Moose {
  const at = spot(lake, (rng() * 2 - 1) * SHORE_SPREAD, between(NEAR_WATER, rng));
  return {
    at,
    facing: towardsLake(lake, at),
    mode: "idle",
    t: 0,
    until: 0,
    target: null,
    stride: 0,
    pose: "stand",
    poseT: 0,
    poseUntil: 0,
    nextTwitch: between(TWITCH_EVERY, rng),
    nextGraze: between(GRAZE_EVERY, rng),
  };
}

/** Moves `at` towards `target` by up to `step`. Returns whether it got there. */
function walkTowards(moose: Moose, target: Vec, step: number): boolean {
  const d = distance(moose.at, target);
  if (d <= step) {
    moose.stride += d;
    moose.at = { ...target };
    return true;
  }
  moose.at = { x: moose.at.x + ((target.x - moose.at.x) / d) * step, y: moose.at.y + ((target.y - moose.at.y) / d) * step };
  moose.stride += step;
  return false;
}

function setMode(moose: Moose, mode: MooseMode, target: Vec | null = null): void {
  moose.mode = mode;
  moose.t = 0;
  moose.target = target;
  if (target && Math.abs(target.x - moose.at.x) > 1) moose.facing = target.x > moose.at.x ? 1 : -1;
  if (mode === "idle") {
    moose.pose = "stand";
    moose.poseT = 0;
  }
}

/** Where it runs when startled: away from the lake, and along the shore away from the boat. */
function refuge(lake: Lake, moose: Moose, boat: Vec): Vec {
  const out = angleOf(lake, moose.at);
  const outward = { x: Math.cos(out), y: Math.sin(out) };
  // Along the shore: a right angle round from outward, whichever way is further from the boat.
  const along = { x: -outward.y, y: outward.x };
  const side = (moose.at.x - boat.x) * along.x + (moose.at.y - boat.y) * along.y >= 0 ? 1 : -1;
  return {
    x: moose.at.x + outward.x * FLEE_INLAND + along.x * FLEE_ALONG * side,
    y: moose.at.y + outward.y * FLEE_INLAND + along.y * FLEE_ALONG * side,
  };
}

/** Its new spot by the water after a scare: a little way along the shore from where it is, and still on the east side. */
function newSpot(lake: Lake, moose: Moose, rng: () => number): Vec {
  const now = angleOf(lake, moose.at);
  const angle = now + (rng() < 0.5 ? -1 : 1) * between(NEW_SPOT, rng);
  return spot(lake, Math.max(-SHORE_SPREAD, Math.min(SHORE_SPREAD, angle)), between(NEAR_WATER, rng));
}

/** Its idle life: twitches now and then, and every so often a bow of the head to graze. */
function idle(moose: Moose, dt: number, rng: () => number): void {
  moose.poseT += dt;
  if (moose.pose === "stand") {
    moose.nextTwitch -= dt;
    moose.nextGraze -= dt;
    if (moose.nextGraze <= 0) {
      moose.pose = "bow";
      moose.poseT = 0;
      moose.poseUntil = BOW_TIME;
      moose.nextGraze = between(GRAZE_EVERY, rng);
    } else if (moose.nextTwitch <= 0) {
      moose.pose = rng() < 0.5 ? "ear" : "tail";
      moose.poseT = 0;
      moose.poseUntil = TWITCH_TIME;
      moose.nextTwitch = between(TWITCH_EVERY, rng);
    }
    return;
  }
  if (moose.poseT < moose.poseUntil) return;
  // The pose is over: on to the next one.
  const next: Partial<Record<IdlePose, IdlePose>> = { bow: "graze", graze: "rise" };
  moose.pose = next[moose.pose] ?? "stand";
  moose.poseT = 0;
  moose.poseUntil = moose.pose === "graze" ? between(GRAZE_TIME, rng) : moose.pose === "rise" ? BOW_TIME : 0;
}

/**
 * Advances the moose by `dt` seconds, with the boat at `boat`. With `still`
 * (reduced motion) it neither moves nor twitches, but still looks up at the boat.
 */
export function stepMoose(moose: Moose, lake: Lake, boat: Vec, dt: number, rng: () => number, still = false): void {
  moose.t += dt;
  const near = distance(boat, moose.at) < ALERT_RADIUS;

  if (still) {
    if (near && moose.mode !== "alert") setMode(moose, "alert");
    else if (!near && moose.mode === "alert") setMode(moose, "idle");
    if (near) moose.facing = boat.x > moose.at.x ? 1 : -1;
    return;
  }

  switch (moose.mode) {
    case "idle":
    case "return":
      if (near) {
        setMode(moose, "alert");
        // It looks at the boat.
        moose.facing = boat.x > moose.at.x ? 1 : -1;
        return;
      }
      if (moose.mode === "idle") idle(moose, dt, rng);
      else if (walkTowards(moose, moose.target!, WALK_SPEED * dt)) {
        setMode(moose, "idle");
        moose.facing = towardsLake(lake, moose.at);
      }
      return;
    case "alert":
      if (moose.t >= ALERT_TIME) {
        moose.stride = 0;
        setMode(moose, "flee", refuge(lake, moose, boat));
      }
      return;
    case "flee":
      if (walkTowards(moose, moose.target!, RUN_SPEED * dt)) {
        setMode(moose, "pause");
        moose.until = between(PAUSE, rng);
        // It turns to look back the way it came, towards the lake.
        moose.facing = towardsLake(lake, moose.at);
      }
      return;
    case "pause":
      if (near) {
        setMode(moose, "alert");
        moose.facing = boat.x > moose.at.x ? 1 : -1;
      } else if (moose.t >= moose.until) {
        moose.stride = 0;
        setMode(moose, "return", newSpot(lake, moose, rng));
      }
      return;
  }
}

/** How long the `[!]` shakes when it appears, how far either side at first (in pixels), and how fast (shakes a second). */
const SHAKE_TIME = 0.45;
const SHAKE = 4.0;
const SHAKE_RATE = 14;

/**
 * How far the `[!]` is shaken sideways just now, in pixels: a quick little
 * shake as it appears, dying away; nothing after that, nor with `still`
 * (reduced motion).
 */
export function alertShake(moose: Moose, still = false): number {
  if (still || moose.mode !== "alert" || moose.t >= SHAKE_TIME) return 0;
  return Math.sin(moose.t * SHAKE_RATE * 2 * Math.PI) * SHAKE * (1 - moose.t / SHAKE_TIME);
}

/** Whether the moose is on the move, or its `[!]` shaking, so the picture needs redrawing every frame. */
export function mooseMoving(moose: Moose): boolean {
  return moose.mode === "flee" || moose.mode === "return" || (moose.mode === "alert" && moose.t < SHAKE_TIME);
}

/**
 * What the moose looks like now: the rows of its drawing (the top one the
 * `[!]`, blank unless it is startled), facing the way it faces, and the column
 * its feet are in.
 */
export function mooseDrawing(moose: Moose): { rows: readonly string[]; feet: number } {
  const stride = Math.floor(moose.stride / STRIDE) % 2;
  let rows: readonly string[];
  if (moose.mode === "alert") rows = MOOSE.alert;
  else if (moose.mode === "flee") rows = MOOSE.run[stride];
  else if (moose.mode === "return") rows = MOOSE.walk[stride];
  else if (moose.mode === "pause") rows = MOOSE.stand;
  else if (moose.pose === "bow" || moose.pose === "rise") rows = MOOSE.bow;
  else if (moose.pose === "graze") rows = MOOSE.graze[Math.floor(moose.poseT / NIBBLE) % 2];
  else rows = MOOSE[moose.pose];
  if (moose.facing === 1) return { rows, feet: MOOSE_FEET };
  return { rows: mooseFacingWest(rows), feet: rows[0].length - 1 - MOOSE_FEET };
}
