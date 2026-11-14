import { describe, expect, it } from "vitest";
import { JUNK, type Catch } from "../catches";
import {
  BITE_TIME,
  BOAT_SPEED,
  CAST_RANGE,
  FLY_TIME,
  REEL_TIME,
  WAIT_MAX,
  WAVE_LIFE,
  WAIT_MIN,
  HULL_CENTRE_Y,
  cast,
  castLanding,
  createGame,
  isActive,
  lurePosition,
  moveTo,
  pickHaul,
  rippleRadius,
  step,
  type GameEvent,
  type GameState,
} from "./game";
import { BOAT_RADIUS, FIRST_ISLAND, islandAt, islandsAround } from "./islands";
import { distance } from "./world";

const DT = 1 / 60;

/** Steps the game for a number of seconds and collects what happened. */
function run(state: GameState, seconds: number, options = {}): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(state, DT, options));
  return events;
}

describe("sailing", () => {
  it("is still until told to move", () => {
    const state = createGame();
    expect(isActive(state)).toBe(false);
    run(state, 1);
    expect(state.boat).toEqual({ x: 0, y: 0 });
    expect(state.ripples).toEqual([]);
  });

  it("reaches the spot, stops there, and never exceeds its top speed", () => {
    const state = createGame();
    moveTo(state, { x: 600, y: -300 });
    let fastest = 0;
    for (let t = 0; t < 6; t += DT) {
      const before = { ...state.boat };
      step(state, DT);
      fastest = Math.max(fastest, distance(before, state.boat) / DT);
    }
    expect(state.boat.x).toBeCloseTo(600);
    expect(state.boat.y).toBeCloseTo(-300);
    expect(state.dest).toBeNull();
    expect(fastest).toBeLessThanOrEqual(BOAT_SPEED + 1e-6);
    expect(fastest).toBeGreaterThan(BOAT_SPEED * 0.9);
  });

  it("faces the way it sails and keeps that heading on arrival", () => {
    const state = createGame();
    moveTo(state, { x: -400, y: 0 });
    run(state, 0.5);
    expect(state.heading).toBe(4);
    run(state, 5);
    expect(state.heading).toBe(4);
  });

  it("leaves a wake of waves behind it, and no rings", () => {
    const state = createGame();
    moveTo(state, { x: 500, y: 0 });
    run(state, 1);
    expect(state.waves.length).toBeGreaterThan(10);
    expect(state.waves.every((wave) => wave.x < state.boat.x)).toBe(true);
    expect(state.ripples).toEqual([]);
  });

  it("opens the wake into a V: older waves have drifted further from the path, to both sides", () => {
    const state = createGame();
    moveTo(state, { x: 2000, y: 0 });
    run(state, 2);
    const offsets = state.waves.map((wave) => wave.y);
    const centre = (Math.max(...offsets) + Math.min(...offsets)) / 2;
    const oldest = state.waves[0];
    const newest = state.waves.at(-1)!;
    expect(Math.abs(oldest.y - centre)).toBeGreaterThan(Math.abs(newest.y - centre) + 20);
    expect(state.waves.some((wave) => wave.y > centre + 20)).toBe(true);
    expect(state.waves.some((wave) => wave.y < centre - 20)).toBe(true);
  });

  it("spreads the wake sideways when sailing up or down the screen", () => {
    const state = createGame();
    moveTo(state, { x: 0, y: 2000 });
    run(state, 2);
    expect(state.waves.some((wave) => wave.x > 30)).toBe(true);
    expect(state.waves.some((wave) => wave.x < -30)).toBe(true);
    expect(state.waves.every((wave) => wave.y < state.boat.y)).toBe(true);
  });

  it("lets the wake fade slowly, and the water settles afterwards", () => {
    const state = createGame();
    moveTo(state, { x: 300, y: 0 });
    run(state, 3);
    expect(state.dest).toBeNull();
    expect(state.waves.length).toBeGreaterThan(0);
    run(state, WAVE_LIFE);
    expect(state.waves).toEqual([]);
    expect(isActive(state)).toBe(false);
  });

  it("makes no wake with reduced motion", () => {
    const state = createGame();
    moveTo(state, { x: 500, y: 0 });
    run(state, 1, { reducedMotion: true });
    expect(state.boat.x).toBeGreaterThan(100);
    expect(state.waves).toEqual([]);
    expect(state.ripples).toEqual([]);
  });
});

describe("islands", () => {
  const SEED = 7;
  const first = islandAt(SEED, 0, 0)!;
  /** Where the boat must be for the middle of its hull to sit on `p`. */
  const boatFor = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - HULL_CENTRE_Y });

  /** How far the boat's hull is from running aground on the nearest island; negative when aground. */
  function clearance(state: GameState): number {
    const h = { x: state.boat.x, y: state.boat.y + HULL_CENTRE_Y };
    const near = islandsAround(SEED, h.x - 300, h.y - 300, h.x + 300, h.y + 300);
    return Math.min(...near.map((i) => Math.hypot(h.x - i.x, h.y - i.y) - i.r - BOAT_RADIUS));
  }

  /** Sails until the boat stops, checking every step that it stays in the water. */
  function sailChecked(state: GameState, seconds: number): number {
    let lowest = Infinity;
    for (let t = 0; t < seconds && state.dest; t += DT) {
      step(state, DT);
      lowest = Math.min(lowest, clearance(state));
    }
    return lowest;
  }

  it("sails round an island in its way and still arrives", () => {
    const state = createGame({ islandSeed: SEED });
    const target = { x: 600, y: 520 };
    moveTo(state, target);
    expect(sailChecked(state, 10)).toBeGreaterThan(-0.01);
    expect(state.dest).toBeNull();
    expect(distance(state.boat, target)).toBeLessThan(0.5);
  });

  it("gets round even when heading straight for the island's middle", () => {
    const state = createGame({ islandSeed: SEED });
    // The hull's path runs exactly through the island's centre.
    const start = { x: 0, y: HULL_CENTRE_Y };
    const target = boatFor({ x: 2 * FIRST_ISLAND.x - start.x, y: 2 * FIRST_ISLAND.y - start.y });
    moveTo(state, target);
    expect(sailChecked(state, 10)).toBeGreaterThan(-0.01);
    expect(distance(state.boat, target)).toBeLessThan(0.5);
  });

  it("turns the boat to follow the shore while it skirts the island", () => {
    const state = createGame({ islandSeed: SEED });
    moveTo(state, boatFor({ x: 2 * FIRST_ISLAND.x, y: 2 * FIRST_ISLAND.y - HULL_CENTRE_Y }));
    const headings = new Set<number>();
    for (let t = 0; t < 10 && state.dest; t += DT) {
      step(state, DT);
      headings.add(state.heading);
    }
    expect(headings.size).toBeGreaterThan(2);
  });

  it("sails to the shore when sent onto an island", () => {
    const state = createGame({ islandSeed: SEED });
    moveTo(state, boatFor({ x: first.x - 10, y: first.y + 5 }));
    const dest = state.dest!;
    const fromCentre = Math.hypot(dest.x - first.x, dest.y + HULL_CENTRE_Y - first.y);
    expect(fromCentre).toBeCloseTo(first.r + BOAT_RADIUS + 1, 5);
    expect(sailChecked(state, 10)).toBeGreaterThan(-0.01);
    expect(distance(state.boat, dest)).toBeLessThan(0.5);
  });

  it("lands a lure thrown onto an island in the water by its shore", () => {
    const state = createGame({ islandSeed: SEED });
    const landing = castLanding(state, { x: first.x + 10, y: first.y - 10 });
    expect(Math.hypot(landing.x - first.x, landing.y - first.y)).toBeCloseTo(first.r + 8, 5);
    cast(state, { x: first.x + 10, y: first.y - 10 }, () => 0);
    expect(state.line?.target).toEqual(landing);
  });

  it("has no islands without a seed", () => {
    const state = createGame();
    const target = boatFor(FIRST_ISLAND);
    moveTo(state, target);
    expect(state.dest).toEqual(target);
    run(state, 5);
    expect(state.boat).toEqual(target);
  });
});

describe("casting", () => {
  it("throws to the target in range and to full range beyond it", () => {
    const near = createGame();
    cast(near, { x: 100, y: 50 }, () => 0);
    expect(near.line?.target).toEqual({ x: 100, y: 50 });

    const far = createGame();
    cast(far, { x: 5000, y: 0 }, () => 0);
    expect(far.line?.target.x).toBeCloseTo(CAST_RANGE);
  });

  it("stops the boat and turns it towards the throw", () => {
    const state = createGame();
    moveTo(state, { x: 900, y: 0 });
    run(state, 0.5);
    cast(state, { x: state.boat.x, y: state.boat.y + 200 }, () => 0);
    const at = { ...state.boat };
    run(state, 1);
    expect(state.boat).toEqual(at);
    expect(state.heading).toBe(2);
  });

  it("goes through landing, a bite after the wait, and a catch, in that order", () => {
    const state = createGame();
    expect(cast(state, { x: 200, y: 0 }, () => 0.5)).toBe(true);
    const wait = (WAIT_MIN + WAIT_MAX) / 2;

    expect(run(state, FLY_TIME + 0.1)).toEqual(["landed"]);
    expect(state.line?.phase).toBe("waiting");
    expect(run(state, wait - 0.3)).toEqual([]);
    expect(run(state, 0.4)).toEqual(["bite"]);
    expect(run(state, BITE_TIME + REEL_TIME + 0.1)).toEqual(["caught"]);
    expect(state.line).toBeNull();
  });

  it("waits between the shortest and the longest time, depending on the roll", () => {
    const quick = createGame();
    cast(quick, { x: 200, y: 0 }, () => 0);
    expect(quick.line?.wait).toBe(WAIT_MIN);
    const slow = createGame();
    cast(slow, { x: 200, y: 0 }, () => 0.999);
    expect(slow.line?.wait).toBeGreaterThan(WAIT_MAX - 0.01);
    expect(slow.line?.wait).toBeLessThan(WAIT_MAX);
  });

  it("ignores a second cast while the line is out", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    expect(cast(state, { x: -200, y: 0 }, () => 0)).toBe(false);
    expect(state.line?.target).toEqual({ x: 200, y: 0 });
  });

  it("brings the line back empty when the boat is sent somewhere", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    run(state, FLY_TIME + 0.5);
    moveTo(state, { x: -300, y: 0 });
    expect(state.line).toBeNull();
    expect(run(state, 8)).toEqual([]);
  });

  it("still lands, bites and catches with reduced motion, without ripples", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    const events = run(state, WAIT_MIN + BITE_TIME + 0.2, { reducedMotion: true });
    expect(events).toEqual(["landed", "bite", "caught"]);
    expect(state.ripples).toEqual([]);
  });
});

describe("lurePosition", () => {
  it("flies from the boat to the target, off the water only while in the air", () => {
    const state = createGame();
    expect(lurePosition(state)).toBeNull();
    cast(state, { x: 200, y: 0 }, () => 0);
    run(state, FLY_TIME / 2);
    const flying = lurePosition(state)!;
    expect(flying.at.x).toBeGreaterThan(50);
    expect(flying.at.x).toBeLessThan(150);
    expect(flying.lift).toBeGreaterThan(30);

    run(state, FLY_TIME);
    expect(lurePosition(state)).toEqual({ at: { x: 200, y: 0 }, lift: 0 });
  });

  it("comes back to the boat while reeling", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    run(state, FLY_TIME + WAIT_MIN + BITE_TIME + REEL_TIME * 0.9);
    expect(state.line?.phase).toBe("reeling");
    expect(lurePosition(state)!.at.x).toBeLessThan(30);
  });
});

describe("rippleRadius", () => {
  it("is nothing before the ripple starts, then grows to its full size", () => {
    expect(rippleRadius({ x: 0, y: 0, age: -0.1, life: 1, maxR: 80 })).toBeNull();
    expect(rippleRadius({ x: 0, y: 0, age: 0, life: 1, maxR: 80 })).toBe(0);
    const half = rippleRadius({ x: 0, y: 0, age: 0.5, life: 1, maxR: 80 })!;
    expect(half).toBeGreaterThan(40);
    expect(half).toBeLessThan(80);
    expect(rippleRadius({ x: 0, y: 0, age: 1, life: 1, maxR: 80 })).toBe(80);
  });
});

describe("pickHaul", () => {
  const catches: Catch[] = ["a", "b", "c"].map((id) => ({ id, kind: "project", title: id, href: `/${id}` }));
  const fresh = { firstCast: true, lastWasJunk: false };
  const later = { firstCast: false, lastWasJunk: false };

  /** A generator that returns the given numbers in turn. */
  const rolls = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("only picks what hasn't been caught", () => {
    for (const roll of [0, 0.3, 0.6, 0.999]) {
      const haul = pickHaul(catches, new Set(["a", "c"]), later, rolls(0.9, roll));
      expect(haul).toEqual({ type: "catch", item: catches[1] });
    }
  });

  it("can reach every remaining catch", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const haul = pickHaul(catches, new Set(), fresh, rolls(i / 30));
      if (haul.type === "catch") seen.add(haul.item.id);
    }
    expect(seen).toEqual(new Set(["a", "b", "c"]));
  });

  it("sometimes brings up junk, which says the lake isn't empty yet", () => {
    const haul = pickHaul(catches, new Set(), later, rolls(0.1, 0));
    expect(haul).toEqual({ type: "junk", item: JUNK[0], fishedOut: false });
  });

  it("never brings up junk on the first cast or twice running", () => {
    expect(pickHaul(catches, new Set(), fresh, rolls(0)).type).toBe("catch");
    expect(pickHaul(catches, new Set(), { firstCast: false, lastWasJunk: true }, rolls(0)).type).toBe("catch");
  });

  it("gives only junk once everything is caught", () => {
    const haul = pickHaul(catches, new Set(["a", "b", "c"]), fresh, rolls(0.999));
    expect(haul).toEqual({ type: "junk", item: JUNK.at(-1), fishedOut: true });
  });
});
