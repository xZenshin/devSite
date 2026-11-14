import { describe, expect, it } from "vitest";
import {
  BOAT_RADIUS,
  FIRST_ISLAND,
  ISLAND_KINDS,
  ISLAND_REGION,
  islandAt,
  islandsAround,
  type Island,
} from "./islands";

const SEEDS = [1, 42, 123_456_789, 2 ** 31 - 1];

/** Every island within `size` regions of the start in each direction. */
function lake(seed: number, size = 10): Island[] {
  const edge = size * ISLAND_REGION - 1;
  return islandsAround(seed, -edge - 1, -edge - 1, edge, edge);
}

describe("islands", () => {
  it("puts the same islands in the same places for the same seed", () => {
    for (const seed of SEEDS) expect(lake(seed)).toEqual(lake(seed));
  });

  it("scatters them differently for a different seed", () => {
    const where = (seed: number) => lake(seed).map((island) => `${island.x},${island.y}`);
    expect(where(1)).not.toEqual(where(2));
  });

  it("always starts with the first island in sight, and no other close to the boat", () => {
    for (const seed of SEEDS) {
      const near = lake(seed, 2).filter((island) => Math.hypot(island.x, island.y) < 360);
      expect(near).toEqual([]);
      expect(islandAt(seed, 0, 0)).toMatchObject(FIRST_ISLAND);
    }
  });

  it("leaves a channel wider than the boat between any two islands", () => {
    for (const seed of SEEDS) {
      const islands = lake(seed);
      for (let i = 0; i < islands.length; i++) {
        for (let j = i + 1; j < islands.length; j++) {
          const [a, b] = [islands[i], islands[j]];
          const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
          expect(gap).toBeGreaterThan(2 * BOAT_RADIUS);
        }
      }
    }
  });

  it("puts an island in about half the regions, of all three kinds", () => {
    for (const seed of SEEDS) {
      const islands = lake(seed);
      // 20 × 20 regions, most of them holding a coin toss.
      expect(islands.length).toBeGreaterThan(150);
      expect(islands.length).toBeLessThan(250);
      for (const kind of ISLAND_KINDS) {
        expect(islands.filter((island) => island.kind === kind).length).toBeGreaterThan(30);
      }
    }
  });

  it("finds every island whose centre is inside the area asked about", () => {
    const all = lake(42);
    const [minX, minY, maxX, maxY] = [-1300, 450, 2100, 3900];
    const found = islandsAround(42, minX, minY, maxX, maxY);
    const inside = all.filter((i) => i.x >= minX && i.x <= maxX && i.y >= minY && i.y <= maxY);
    expect(inside.length).toBeGreaterThan(3);
    for (const island of inside) expect(found).toContainEqual(island);
  });
});
