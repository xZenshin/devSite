import { clamp, mix, smooth } from "./math";
import { distance, patchiness, type Vec } from "./world";

/**
 * The lake: a shore, a jetty, and what stands in the water. Everything follows
 * from a seed, so nothing is stored; a new seed (a new visit) gives a lake of a
 * different shape with its rocks, reeds, lilies and fish somewhere else. The
 * boat always starts at the origin, moored at the end of the jetty, which runs
 * out from the far (north) shore.
 */

/** How far the boat's hull reaches from its middle, for running aground. */
export const BOAT_RADIUS = 72;

/** The average distance from the lake's middle to its shore. */
export const LAKE_RADIUS = 1250;
/** The shore's bays and headlands: how many go round the lake, and how deep, as a share of the radius. */
const LOBES: readonly (readonly [number, number])[] = [
  [2, 0.1],
  [3, 0.07],
  [4, 0.05],
  [5, 0.035],
];

/** Half the width of the jetty's deck. */
export const JETTY_HALF_WIDTH = 13;
/** Where the jetty ends, straight north of the boat's start, and how far it runs from the shore. */
const JETTY_END_Y = -130;
const JETTY_LENGTH = 360;
/** How far the jetty carries on up the beach. */
const JETTY_ASHORE = 40;
const NORTH = -Math.PI / 2;

/**
 * How far west of the jetty the lighthouse stands. With the boat at its usual
 * place on a wide screen, that keeps it in sight as the visit starts.
 */
const LIGHTHOUSE_WEST = 640;
/** Half the width of the lighthouse's foot, a little over half its drawing at the usual font size. */
const LIGHTHOUSE_HALF_WIDTH = 60;
/** How far up the beach the whole of its foot stands. */
const LIGHTHOUSE_FOOTING = 16;
/**
 * Where the house stands: this far east of the jetty, and this far up the land
 * from where the jetty comes ashore, so the path from the jetty climbs to its
 * door (in the west end of the house, the front) over a few rows, about five
 * columns east for each row up. Half the width of its foot is a little over
 * half its drawing, and both ends of its foot are at least HOUSE_FOOTING from
 * the water, however the shore runs.
 */
const HOUSE_EAST = 280;
const HOUSE_INLAND = 200;
const HOUSE_HALF_WIDTH = 145;
const HOUSE_FOOTING = 110;
/**
 * Where the campsite stands, on the near (south) shore: this far east of the
 * jetty's line, and far enough from the water that the top of its drawing (it
 * stands up the screen, towards the lake) is at least CAMP_FOOTING up the land.
 * Half its width and its height are a little over those of its drawing at the
 * usual font size; the height is in world units, twice its height on screen.
 */
const CAMP_EAST = 300;
const CAMP_HALF_WIDTH = 115;
const CAMP_HEIGHT = 300;
const CAMP_FOOTING = 110;
const SOUTH = Math.PI / 2;

/** How far from the shore the water reaches its full depth. */
const DEEP_AT = 460;
/** The size of the shallow banks out in the lake. */
const BANK_SIZE = 360;

/** How much room the buoy that marks a fishing ground takes up. */
const BUOY_RADIUS = 10;

/** How many fishing grounds the lake has. The first is in sight of the jetty. */
export const GROUNDS = 3;

interface Disc extends Vec {
  r: number;
}

/** A stretch of water where a shoal of fish keeps to, marked by a buoy at its middle. */
interface Grounds {
  home: Vec;
}

export interface Lake {
  seed: number;
  /** The middle of the lake. The shore is measured from here. */
  centre: Vec;
  wobble: readonly { lobes: number; share: number; phase: number }[];
  /** The jetty's deck, from up on the beach to its end out in the water. */
  jetty: { shore: Vec; end: Vec };
  /** The foot of the lighthouse, on the beach of the far shore, west of the jetty. The tower rises from it. */
  lighthouse: Vec;
  /** The foot of the house, up the beach of the far shore, east of the jetty. A trail leads to it from the jetty. */
  house: Vec;
  /** The foot of the campsite, on the land beyond the near shore, a good way from the water. */
  camp: Vec;
  /** Rocks standing out of the water. The boat goes round them. */
  rocks: readonly Disc[];
  /** Reed beds along the shore. The boat pushes through them, slowly. */
  reeds: readonly Disc[];
  /** Patches of lily pads. */
  lilies: readonly Disc[];
  grounds: readonly Grounds[];
}

/** Something in the boat's way. */
interface Obstruction {
  what: "shore" | "jetty" | "rock" | "buoy";
  /** How much clear water lies before it; negative inside it. */
  gap: number;
  /** The way straight off it. */
  away: Vec;
}

/** Numbers in [0, 1) that follow from a seed, one after another. */
function sequence(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How far the shore is from the lake's middle, in the direction `angle`. */
export function shoreRadius(lake: Pick<Lake, "wobble">, angle: number): number {
  let share = 1;
  for (const lobe of lake.wobble) share += lobe.share * Math.sin(lobe.lobes * angle + lobe.phase);
  return LAKE_RADIUS * share;
}

/** The point `out` from the shore towards the lake's middle, in the direction `angle` from it; negative `out` is up the land. */
export function offShore(lake: Pick<Lake, "centre" | "wobble">, angle: number, out: number): Vec {
  const r = shoreRadius(lake, angle) - out;
  return { x: lake.centre.x + Math.cos(angle) * r, y: lake.centre.y + Math.sin(angle) * r };
}

/** How far out on the water a point is, measured from the shore; negative on land. */
export function shoreDistance(lake: Lake, p: Vec): number {
  const dx = p.x - lake.centre.x;
  const dy = p.y - lake.centre.y;
  return shoreRadius(lake, Math.atan2(dy, dx)) - Math.hypot(dx, dy);
}

/**
 * How deep the water is, from 0 at the shore to 1 at its deepest. It deepens
 * away from the shore, and shallow banks lie here and there out in the lake.
 */
export function depth(lake: Lake, p: Vec): number {
  const out = shoreDistance(lake, p);
  if (out <= 0) return 0;
  const bank = patchiness(p.x / BANK_SIZE, p.y / BANK_SIZE, lake.seed);
  return Math.min(1, out / DEEP_AT) * (0.35 + 0.65 * smooth(clamp((bank - 0.3) / 0.4)));
}

/** The point of the jetty's centre line nearest to `p`. */
function alongJetty(lake: Lake, p: Vec): Vec {
  const { shore, end } = lake.jetty;
  const dx = end.x - shore.x;
  const dy = end.y - shore.y;
  const f = clamp(((p.x - shore.x) * dx + (p.y - shore.y) * dy) / (dx * dx + dy * dy));
  return { x: shore.x + dx * f, y: shore.y + dy * f };
}

/** Whether a point is on the jetty's deck, which runs straight out from the far shore. */
export function onJetty(lake: Lake, p: Vec): boolean {
  const { shore, end } = lake.jetty;
  return Math.abs(p.x - shore.x) < JETTY_HALF_WIDTH && p.y >= shore.y && p.y <= end.y;
}

/** The rock a point is on, if any. */
export function rockAt(lake: Lake, p: Vec): Disc | null {
  return lake.rocks.find((rock) => distance(rock, p) < rock.r) ?? null;
}

/** Whether a point is among the reeds: in a reed bed, and in the water. */
export function inReeds(lake: Lake, p: Vec): boolean {
  return lake.reeds.some((bed) => distance(bed, p) < bed.r) && shoreDistance(lake, p) > 0;
}

/** Whether a point is among the lily pads. */
export function inLilies(lake: Lake, p: Vec): boolean {
  return lake.lilies.some((patch) => distance(patch, p) < patch.r) && shoreDistance(lake, p) > 0;
}

function unit(dx: number, dy: number): Vec {
  const d = Math.hypot(dx, dy);
  // Dead centre: off towards the viewer.
  return d < 1e-9 ? { x: 0, y: 1 } : { x: dx / d, y: dy / d };
}

/**
 * The nearest thing a boat can't pass: the shore, the jetty, a rock or a
 * buoy. Reeds and lilies aren't in the way.
 */
export function nearestObstruction(lake: Lake, p: Vec): Obstruction {
  let nearest: Obstruction = {
    what: "shore",
    gap: shoreDistance(lake, p),
    away: unit(lake.centre.x - p.x, lake.centre.y - p.y),
  };
  const deck = alongJetty(lake, p);
  const fromDeck = distance(deck, p) - JETTY_HALF_WIDTH;
  if (fromDeck < nearest.gap) {
    // From the middle of the deck the way off is over its side, not along it.
    const side = distance(deck, p) < 1e-9 ? { x: 1, y: 0 } : unit(p.x - deck.x, p.y - deck.y);
    nearest = { what: "jetty", gap: fromDeck, away: side };
  }
  for (const rock of lake.rocks) {
    const fromRock = distance(rock, p) - rock.r;
    if (fromRock < nearest.gap) nearest = { what: "rock", gap: fromRock, away: unit(p.x - rock.x, p.y - rock.y) };
  }
  for (const { home } of lake.grounds) {
    const fromBuoy = distance(home, p) - BUOY_RADIUS;
    if (fromBuoy < nearest.gap) nearest = { what: "buoy", gap: fromBuoy, away: unit(p.x - home.x, p.y - home.y) };
  }
  return nearest;
}

/**
 * A point moved to the nearest water that is at least `room` clear of the
 * shore, the jetty and every rock and buoy. A point that already is stays where it is.
 */
export function intoWater(lake: Lake, p: Vec, room: number): Vec {
  let at = { ...p };
  // Leaving one thing can run into the next (the shore beside the jetty); a few rounds settle it.
  for (let round = 0; round < 24; round++) {
    const { gap, away } = nearestObstruction(lake, at);
    if (gap >= room) break;
    const push = room - gap + 1e-6;
    at = { x: at.x + away.x * push, y: at.y + away.y * push };
  }
  return at;
}

/** The lake that follows from a seed. */
export function createLake(seed: number): Lake {
  const next = sequence(seed);
  const between = (low: number, high: number) => mix(low, high, next());

  const wobble = LOBES.map(([lobes, share]) => ({
    lobes,
    share: share * between(0.55, 1),
    phase: between(0, 2 * Math.PI),
  }));
  // The far shore is one jetty's length beyond the jetty's end, straight north of the start.
  const shoreY = JETTY_END_Y - JETTY_LENGTH;
  const centre = { x: 0, y: shoreY + shoreRadius({ wobble }, NORTH) };
  const lake: Lake = {
    seed,
    centre,
    wobble,
    jetty: { shore: { x: 0, y: shoreY - JETTY_ASHORE }, end: { x: 0, y: JETTY_END_Y } },
    lighthouse: { x: 0, y: 0 },
    house: { x: 0, y: 0 },
    camp: { x: 0, y: 0 },
    rocks: [],
    reeds: [],
    lilies: [],
    grounds: [],
  };
  const start: Vec = { x: 0, y: 0 };

  /** A point somewhere in the lake: a direction, and a share of the way from the middle to the shore. */
  const somewhere = (nearest: number, furthest: number): Vec => {
    const angle = between(0, 2 * Math.PI);
    const out = shoreRadius(lake, angle) * between(nearest, furthest);
    return { x: centre.x + Math.cos(angle) * out, y: centre.y + Math.sin(angle) * out };
  };
  /** The first of a number of tries that passes, or failing that the last one tried. */
  const pick = (attempt: () => Vec, passes: (p: Vec) => boolean): Vec => {
    let p = attempt();
    for (let tries = 1; tries < 400 && !passes(p); tries++) p = attempt();
    return p;
  };
  const apart = (p: Vec, others: readonly Vec[], room: number) => others.every((other) => distance(other, p) >= room);

  // Fishing grounds. The first lies below and to the right of the jetty, where a new visitor is looking.
  const grounds: Grounds[] = [];
  const bearing = between(0.35, 1.2);
  const reach = between(330, 400);
  grounds.push({ home: { x: Math.cos(bearing) * reach, y: Math.sin(bearing) * reach } });
  for (let i = 1; i < GROUNDS; i++) {
    const home = pick(
      () => somewhere(0.25, 0.72),
      (p) =>
        shoreDistance(lake, p) > 320 &&
        distance(p, start) > 700 &&
        apart(p, grounds.map((g) => g.home), 650),
    );
    grounds.push({ home });
  }
  const homes = grounds.map((g) => g.home);

  const rocks: Disc[] = [];
  for (let i = 0; i < 5; i++) {
    const at = pick(
      () => somewhere(0.2, 0.9),
      (p) =>
        // Far enough out that the boat fits between the rock and the shore.
        shoreDistance(lake, p) > 2 * BOAT_RADIUS + 80 &&
        distance(p, start) > 420 &&
        distance(p, alongJetty(lake, p)) > 260 &&
        apart(p, homes, 320) &&
        apart(p, rocks, 380),
    );
    rocks.push({ ...at, r: between(26, 40) });
  }

  // Reed beds, spread round the shore but for the stretch the jetty leaves from.
  const reeds: Disc[] = [];
  const beds = 9;
  for (let i = 0; i < beds; i++) {
    const angle = NORTH + ((i + 0.5 + between(-0.3, 0.3)) / beds) * 2 * Math.PI;
    if (Math.abs(Math.atan2(Math.sin(angle - NORTH), Math.cos(angle - NORTH))) < 0.3) continue;
    reeds.push({ ...offShore(lake, angle, between(10, 60)), r: between(80, 140) });
  }

  const lilies: Disc[] = [];
  for (let i = 0; i < 7; i++) {
    const at = pick(
      () => somewhere(0.6, 0.95),
      (p) => {
        const out = shoreDistance(lake, p);
        return out > 90 && out < 300 && distance(p, start) > 300 && apart(p, lilies, 260) && apart(p, rocks, 120);
      },
    );
    lilies.push({ ...at, r: between(60, 110) });
  }

  return {
    ...lake,
    // The lighthouse's foot: both sides of it clear of the water.
    lighthouse: placeOnShore(lake, {
      from: NORTH,
      x: -LIGHTHOUSE_WEST,
      edge: [-LIGHTHOUSE_HALF_WIDTH, LIGHTHOUSE_HALF_WIDTH].map((dx) => ({ x: dx, y: 0 })),
      footing: LIGHTHOUSE_FOOTING,
      inset: [LIGHTHOUSE_FOOTING, 400],
    }),
    house: upTheLand(lake, { x: HOUSE_EAST, y: lake.jetty.shore.y - HOUSE_INLAND }, HOUSE_HALF_WIDTH, HOUSE_FOOTING),
    // The camp stands up the screen, towards the lake, so its top edge comes nearest the water: both
    // corners, and the middle, in case the shore bulges between them.
    camp: placeOnShore(lake, {
      from: SOUTH,
      x: CAMP_EAST,
      edge: [-CAMP_HALF_WIDTH, 0, CAMP_HALF_WIDTH].map((dx) => ({ x: dx, y: -CAMP_HEIGHT })),
      footing: CAMP_FOOTING,
      inset: [0, 1000],
    }),
    grounds,
    rocks,
    reeds,
    lilies,
  };
}

/**
 * A foot moved north, away from the lake, until both its ends, `halfWidth`
 * either side of the middle, are at least `footing` from the water. A foot far
 * enough up the land already stays where it is.
 */
function upTheLand(lake: Lake, foot: Vec, halfWidth: number, footing: number): Vec {
  let y = foot.y;
  const clear = () => [-halfWidth, halfWidth].every((dx) => shoreDistance(lake, { x: foot.x + dx, y }) < -footing);
  for (let tries = 0; tries < 200 && !clear(); tries++) y -= 4;
  return { x: foot.x, y };
}

/**
 * Where something stands on the land round the shore: round from due north
 * (`from` NORTH) or due south (SOUTH), east for a positive `x` and west for a
 * negative one, until the shore is that far along. Then up the land, starting
 * `inset[0]` from the water and giving up at `inset[1]`, until every point of
 * its `edge` (offsets from its foot) is at least `footing` from the water,
 * however the shore runs there.
 */
function placeOnShore(
  lake: Lake,
  options: { from: number; x: number; edge: readonly Vec[]; footing: number; inset: readonly [number, number] },
): Vec {
  const { from, x, edge, footing, inset } = options;
  const way = Math.sign(x);
  // Eastward is clockwise from the north (angles grow towards the east), anticlockwise from the south.
  const turn = from === NORTH ? way * 0.01 : -way * 0.01;
  let angle = from;
  while (Math.abs(angle - from) < Math.PI / 2 && offShore(lake, angle, 0).x * way < Math.abs(x)) angle += turn;
  for (let up = inset[0]; ; up += 4) {
    const foot = offShore(lake, angle, -up);
    const clear = edge.every((d) => shoreDistance(lake, { x: foot.x + d.x, y: foot.y + d.y }) < -footing);
    if (up > inset[1] || clear) return foot;
  }
}
