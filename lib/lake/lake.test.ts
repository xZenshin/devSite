import { describe, expect, it } from "vitest";
import {
  BOAT_RADIUS,
  JETTY_HALF_WIDTH,
  LAKE_RADIUS,
  GROUNDS,
  createLake,
  depth,
  inLilies,
  inReeds,
  intoWater,
  nearestObstruction,
  onJetty,
  rockAt,
  shoreDistance,
  shoreRadius,
} from "./lake";
import { distance } from "./world";

const SEEDS = [1, 7, 42, 123_456_789, 2 ** 31 - 1];
const START = { x: 0, y: 0 };

/** The point of the shore in a direction from the lake's middle, moved `out` towards the middle. */
function offShore(lake: ReturnType<typeof createLake>, angle: number, out: number) {
  const r = shoreRadius(lake, angle) - out;
  return { x: lake.centre.x + Math.cos(angle) * r, y: lake.centre.y + Math.sin(angle) * r };
}

describe("createLake", () => {
  it("makes the same lake from the same seed, and another from another", () => {
    for (const seed of SEEDS) expect(createLake(seed)).toEqual(createLake(seed));
    expect(createLake(1).wobble).not.toEqual(createLake(2).wobble);
    expect(createLake(1).rocks).not.toEqual(createLake(2).rocks);
  });

  it("has a shore all the way round, never far from its usual distance", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      for (let i = 0; i < 360; i++) {
        const r = shoreRadius(lake, (i / 360) * 2 * Math.PI);
        expect(r).toBeGreaterThan(LAKE_RADIUS * 0.7);
        expect(r).toBeLessThan(LAKE_RADIUS * 1.3);
      }
    }
  });

  it("runs the jetty from up the far beach out to just north of where the boat starts", () => {
    for (const seed of SEEDS) {
      const { jetty, ...lake } = createLake(seed);
      expect(jetty.shore.x).toBe(0);
      expect(jetty.end.x).toBe(0);
      expect(jetty.end.y).toBeLessThan(START.y);
      expect(jetty.shore.y).toBeLessThan(jetty.end.y - 300);
      expect(shoreDistance({ jetty, ...lake }, jetty.shore)).toBeLessThan(0);
      expect(shoreDistance({ jetty, ...lake }, jetty.end)).toBeGreaterThan(300);
    }
  });

  it("leaves the water by the jetty clear: no rocks, reeds or lilies where the boat starts", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      expect(nearestObstruction(lake, START).gap).toBeGreaterThan(BOAT_RADIUS);
      expect(lake.rocks.every((rock) => distance(rock, START) > 400)).toBe(true);
      expect(inReeds(lake, START)).toBe(false);
      expect(inLilies(lake, START)).toBe(false);
    }
  });

  it("stands a few rocks in the water, clear of the shore and far enough apart to pass between", () => {
    for (const seed of SEEDS) {
      const { rocks, ...lake } = createLake(seed);
      expect(rocks.length).toBeGreaterThanOrEqual(3);
      rocks.forEach((rock, i) => {
        expect(shoreDistance({ rocks, ...lake }, rock)).toBeGreaterThan(rock.r + 2 * BOAT_RADIUS - 60);
        for (const other of rocks.slice(i + 1)) {
          expect(distance(rock, other) - rock.r - other.r).toBeGreaterThan(2 * BOAT_RADIUS);
        }
      });
    }
  });

  it("grows reeds along the shore and lilies in the shallows, but not where the jetty leaves it", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      expect(lake.reeds.length).toBeGreaterThanOrEqual(6);
      expect(lake.lilies.length).toBeGreaterThanOrEqual(4);
      for (const bed of lake.reeds) {
        expect(Math.abs(shoreDistance(lake, bed))).toBeLessThan(bed.r);
        expect(distance(bed, lake.jetty.shore)).toBeGreaterThan(bed.r + 100);
      }
      for (const patch of lake.lilies) expect(shoreDistance(lake, patch)).toBeGreaterThan(0);
    }
  });

  it("stands the house east of the jetty and a little way from the water, and the lighthouse to the west", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      expect(lake.house.x).toBeGreaterThan(100);
      expect(lake.lighthouse.x).toBeLessThan(-600);
      // Both ends of the house's foot are a little way from the water, and well up the land from the jetty.
      for (const dx of [-145, 145]) {
        expect(shoreDistance(lake, { x: lake.house.x + dx, y: lake.house.y })).toBeLessThan(-109);
      }
      expect(lake.house.y).toBeLessThan(lake.jetty.shore.y - 150);
      expect(lake.house.x - 145).toBeGreaterThan(JETTY_HALF_WIDTH);
    }
  });

  it("has its fishing grounds out in the water and well apart, the first in sight of the jetty", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      expect(lake.grounds).toHaveLength(GROUNDS);
      const [first, ...others] = lake.grounds;
      expect(distance(first.home, START)).toBeLessThan(420);
      expect(first.home.y).toBeGreaterThan(100);
      expect(first.home.x).toBeGreaterThan(100);
      lake.grounds.forEach((grounds, i) => {
        expect(shoreDistance(lake, grounds.home)).toBeGreaterThan(250);
        expect(rockAt(lake, grounds.home)).toBeNull();
        for (const other of lake.grounds.slice(i + 1)) expect(distance(grounds.home, other.home)).toBeGreaterThan(500);
      });
      for (const far of others) expect(distance(far.home, START)).toBeGreaterThan(600);
    }
  });
});

describe("shoreDistance and depth", () => {
  it("is positive on the water, negative on land, and nothing at the shore", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      expect(shoreDistance(lake, lake.centre)).toBeGreaterThan(LAKE_RADIUS * 0.7);
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * 2 * Math.PI;
        expect(shoreDistance(lake, offShore(lake, angle, 0))).toBeCloseTo(0, 6);
        expect(shoreDistance(lake, offShore(lake, angle, 50))).toBeCloseTo(50, 6);
        expect(shoreDistance(lake, offShore(lake, angle, -80))).toBeCloseTo(-80, 6);
      }
    }
  });

  it("is shallow at the shore and deeper further out, never beyond its range", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      let atShore = 0;
      let farOut = 0;
      for (let i = 0; i < 90; i++) {
        const angle = (i / 90) * 2 * Math.PI;
        expect(depth(lake, offShore(lake, angle, -20))).toBe(0);
        for (const out of [10, 200, 600]) {
          const d = depth(lake, offShore(lake, angle, out));
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(1);
        }
        atShore += depth(lake, offShore(lake, angle, 10));
        farOut += depth(lake, offShore(lake, angle, 600));
      }
      expect(atShore / 90).toBeLessThan(0.05);
      expect(farOut / 90).toBeGreaterThan(0.45);
    }
  });
});

describe("what stands in the water", () => {
  it("knows the jetty's deck from the water beside it", () => {
    const lake = createLake(7);
    const { shore, end } = lake.jetty;
    const half = { x: 0, y: (shore.y + end.y) / 2 };
    expect(onJetty(lake, half)).toBe(true);
    expect(onJetty(lake, { x: JETTY_HALF_WIDTH - 1, y: half.y })).toBe(true);
    expect(onJetty(lake, { x: JETTY_HALF_WIDTH + 1, y: half.y })).toBe(false);
    expect(onJetty(lake, { x: 0, y: end.y + 1 })).toBe(false);
  });

  it("measures the clear water to the nearest of the shore, the jetty and the rocks", () => {
    const lake = createLake(7);
    const rock = lake.rocks[0];
    const byRock = nearestObstruction(lake, { x: rock.x + rock.r + 30, y: rock.y });
    expect(byRock.what).toBe("rock");
    expect(byRock.gap).toBeCloseTo(30);
    expect(byRock.away.x).toBeCloseTo(1);

    const byDeck = nearestObstruction(lake, { x: -(JETTY_HALF_WIDTH + 20), y: lake.jetty.end.y - 100 });
    expect(byDeck.what).toBe("jetty");
    expect(byDeck.gap).toBeCloseTo(20);
    expect(byDeck.away).toEqual({ x: -1, y: 0 });

    const byShore = nearestObstruction(lake, offShore(lake, 1, 25));
    expect(byShore.what).toBe("shore");
    expect(byShore.gap).toBeCloseTo(25);
    expect(nearestObstruction(lake, rock).gap).toBeLessThan(0);
  });

  it("moves a point on land, on the jetty or on a rock to the nearest clear water, and leaves others alone", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      const stuck = [
        ...lake.rocks,
        { x: 0, y: lake.jetty.end.y - 150 },
        { x: 4, y: lake.jetty.shore.y + 10 },
        ...[0, 1, 2, 3, 4, 5].map((angle) => offShore(lake, angle, -300)),
        ...[0, 1, 2, 3, 4, 5].map((angle) => offShore(lake, angle, 5)),
      ];
      for (const p of stuck) {
        const clear = intoWater(lake, p, BOAT_RADIUS);
        expect(nearestObstruction(lake, clear).gap).toBeGreaterThanOrEqual(BOAT_RADIUS);
      }
      expect(intoWater(lake, START, BOAT_RADIUS)).toEqual(START);
    }
  });
});
