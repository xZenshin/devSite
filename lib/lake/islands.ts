import type { Vec } from "./world";

/**
 * Small islands scattered over the endless lake. The lake is cut into square
 * regions, and a hash of the region and a seed decides whether it holds an
 * island, of which kind, and where. Nothing is stored, so sailing back finds
 * the same islands; a new seed (a new visit) scatters them differently.
 */

export type IslandKind = "palm" | "rocks" | "ship";
export const ISLAND_KINDS: readonly IslandKind[] = ["palm", "rocks", "ship"];

export interface Island {
  kind: IslandKind;
  /** Centre of the island's shoreline, in world units. */
  x: number;
  y: number;
  /** Radius of its shoreline. */
  r: number;
}

/** Shoreline radius per kind, matching its drawing in sprites.ts at the default 14px font. */
export const ISLAND_RADIUS: Record<IslandKind, number> = { palm: 54, rocks: 46, ship: 54 };
export const ISLAND_MAX_RADIUS = Math.max(...Object.values(ISLAND_RADIUS));

/** How far the boat's hull reaches from its middle, for running aground. */
export const BOAT_RADIUS = 60;

/** Side of a region; each holds at most one island. */
export const ISLAND_REGION = 820;
const ISLAND_CHANCE = 0.5;
/**
 * An island keeps this far from its region's edges, so two neighbours always
 * leave a channel the boat fits through and the boat touches one island at a time.
 */
const EDGE = ISLAND_MAX_RADIUS + BOAT_RADIUS + 24;
/** No island this close to where the boat starts, apart from the first one. */
const START_CLEAR = 360;
/** The first island: in sight of the boat when the page opens, on most screens. */
export const FIRST_ISLAND: Vec = { x: 300, y: 260 };

/** The island in region (rx, ry), if it has one. */
export function islandAt(seed: number, rx: number, ry: number): Island | null {
  const kind = ISLAND_KINDS[Math.floor(random(seed, rx, ry, 4) * ISLAND_KINDS.length)];
  if (rx === 0 && ry === 0) return { kind, ...FIRST_ISLAND, r: ISLAND_RADIUS[kind] };
  if (random(seed, rx, ry, 1) >= ISLAND_CHANCE) return null;
  const span = ISLAND_REGION - 2 * EDGE;
  const x = rx * ISLAND_REGION + EDGE + random(seed, rx, ry, 2) * span;
  const y = ry * ISLAND_REGION + EDGE + random(seed, rx, ry, 3) * span;
  if (Math.hypot(x, y) < START_CLEAR) return null;
  return { kind, x, y, r: ISLAND_RADIUS[kind] };
}

/**
 * The islands of every region that overlaps a rectangle of the world: all the
 * islands whose centre lies inside it, and possibly a few just outside.
 */
export function islandsAround(seed: number, minX: number, minY: number, maxX: number, maxY: number): Island[] {
  const islands: Island[] = [];
  for (let ry = Math.floor(minY / ISLAND_REGION); ry <= Math.floor(maxY / ISLAND_REGION); ry++) {
    for (let rx = Math.floor(minX / ISLAND_REGION); rx <= Math.floor(maxX / ISLAND_REGION); rx++) {
      const island = islandAt(seed, rx, ry);
      if (island) islands.push(island);
    }
  }
  return islands;
}

/** A number in [0, 1) that depends only on its arguments. */
function random(seed: number, rx: number, ry: number, salt: number): number {
  let h = Math.imul(rx, 374761393) ^ Math.imul(ry, 668265263) ^ Math.imul(seed | 0, 1274126177) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
