import { scatter, type Vec } from "./world";

/**
 * The fish of one fishing ground: dim shapes under the surface that keep to
 * their grounds. There is one fish for everything shared out to those grounds
 * still to be caught, so a shoal thins out as the basket fills.
 */
export interface Shoal {
  home: Vec;
  /** The fish still swimming, by number. Each number always swims the same course. */
  fish: number[];
  /** Seconds until one of them next rises and rings the surface. */
  rise: number;
}

/** A fish, and whether it is swimming towards the east (the right of the screen). */
export interface Swimmer extends Vec {
  east: boolean;
}

/** A shoal never shows more fish than this, however much is left to catch. */
export const MAX_FISH = 8;
/** No fish strays further than this from the middle of its grounds. */
export const SHOAL_SPREAD = 170;

/**
 * Where fish number `id` of shoal number `shoal` is at `time`, left to itself:
 * on a slow, looping course about the shoal's home. Nothing is stored; the
 * course follows from the lake's seed.
 */
export function wander(seed: number, shoal: number, id: number, home: Vec, time: number): Swimmer {
  const roll = (n: number) => scatter(shoal * 64 + id, n, seed);
  const across = SHOAL_SPREAD * (0.27 + 0.53 * roll(1));
  const along = SHOAL_SPREAD * (0.2 + 0.4 * roll(2));
  const pace = (0.14 + 0.16 * roll(3)) * (roll(4) < 0.5 ? 1 : -1);
  const u = pace * time + roll(5) * 2 * Math.PI;
  const v = pace * 1.37 * time + roll(6) * 2 * Math.PI;
  return {
    x: home.x + across * Math.cos(u),
    y: home.y + along * Math.sin(v),
    east: -Math.sin(u) * pace > 0,
  };
}

/** The share of fish that are big ones, with a fin. */
const BIG_FISH = 0.35;

/**
 * Which drawing fish number `id` of shoal number `shoal` has: 0 a small fish,
 * 1 a big one with a fin (see FISH_SHAPES). It always has the same one.
 */
export function fishShape(seed: number, shoal: number, id: number): number {
  return scatter(shoal * 64 + id, 7, seed) < BIG_FISH ? 1 : 0;
}

/** Makes a shoal as many fish strong as there is left to catch (up to MAX_FISH). */
export function stock(shoal: Shoal, left: number): void {
  const want = Math.min(MAX_FISH, Math.max(0, Math.floor(left)));
  while (shoal.fish.length > want) shoal.fish.pop();
  for (let id = 0; shoal.fish.length < want; id++) {
    if (!shoal.fish.includes(id)) shoal.fish.push(id);
  }
}
