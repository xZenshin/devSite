import { describe, expect, it } from "vitest";
import { JUNK, type Catch } from "../catches";
import {
  BITE_TIME,
  BOAT_SPEED,
  CAST_RANGE,
  FISH_WAIT_MAX,
  FISH_WAIT_MIN,
  FLY_TIME,
  JUNK_WAIT_MAX,
  JUNK_WAIT_MIN,
  LURE_REACH,
  REED_DRAG,
  REEL_TIME,
  WAVE_LIFE,
  WIND_TIME,
  HULL_CENTRE_Y,
  PADDLE_FRAMES,
  PADDLE_STEP,
  cast,
  castLanding,
  createGame,
  fishAt,
  hasFish,
  isActive,
  lurePosition,
  moveTo,
  nearestFish,
  paddleFrame,
  pickHaul,
  rippleRadius,
  shareOut,
  snapshot,
  step,
  stockShoals,
  type GameEvent,
  type GameState,
} from "./game";
import { SHOAL_SPREAD } from "./fish";
import { BOAT_RADIUS, inReeds, intoWater, nearestObstruction, shoreDistance } from "./lake";
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

describe("paddling", () => {
  it("holds the paddle still until told to move", () => {
    const state = createGame();
    run(state, 1);
    expect(paddleFrame(state)).toBe(0);
  });

  it("takes the first stroke as soon as it sets off", () => {
    const state = createGame();
    moveTo(state, { x: 600, y: 0 });
    step(state, DT);
    expect(paddleFrame(state)).toBe(1);
  });

  it("turns the paddle one position at a time, always the same way round", () => {
    const state = createGame();
    moveTo(state, { x: 2000, y: 0 });
    const frames = [paddleFrame(state)];
    for (let t = 0; t < 3; t += DT) {
      step(state, DT);
      if (paddleFrame(state) !== frames.at(-1)) frames.push(paddleFrame(state));
    }
    expect(frames.length).toBeGreaterThan(2 * PADDLE_FRAMES);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBe((frames[i - 1] + 1) % PADDLE_FRAMES);
    }
  });

  it("paddles by distance: the same stretch of water takes the same number of strokes", () => {
    const state = createGame();
    moveTo(state, { x: 10 * PADDLE_STEP * PADDLE_FRAMES - PADDLE_STEP / 2, y: 0 });
    let changes = 0;
    let last = paddleFrame(state);
    while (state.dest) {
      step(state, DT);
      if (state.dest && paddleFrame(state) !== last) changes++;
      if (state.dest) last = paddleFrame(state);
    }
    expect(changes).toBe(10 * PADDLE_FRAMES);
  });

  it("rests the paddle on arrival, and when the line is thrown", () => {
    const state = createGame();
    moveTo(state, { x: 300, y: 0 });
    run(state, 5);
    expect(state.dest).toBeNull();
    expect(paddleFrame(state)).toBe(0);

    moveTo(state, { x: 900, y: 0 });
    run(state, 0.7);
    cast(state, { x: 900, y: 200 }, () => 0);
    expect(paddleFrame(state)).toBe(0);
  });

  it("keeps the paddle still with reduced motion", () => {
    const state = createGame();
    moveTo(state, { x: 500, y: 0 });
    for (let t = 0; t < 1; t += DT) {
      step(state, DT, { reducedMotion: true });
      expect(paddleFrame(state)).toBe(0);
    }
    expect(state.boat.x).toBeGreaterThan(100);
  });
});

describe("the lake", () => {
  const SEEDS = [1, 7, 42, 123_456_789];
  const hullOf = (state: GameState) => ({ x: state.boat.x, y: state.boat.y + HULL_CENTRE_Y });
  /** Where the boat must be for the middle of its hull to sit on `p`. */
  const boatFor = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - HULL_CENTRE_Y });
  /** How far the boat's hull is from running aground; negative when aground. */
  const clearance = (state: GameState) => nearestObstruction(state.lake!, hullOf(state)).gap - BOAT_RADIUS;

  /** Sails until the boat stops, checking every step that it stays afloat. */
  function sailChecked(state: GameState, seconds: number): number {
    let lowest = Infinity;
    for (let t = 0; t < seconds && state.dest; t += DT) {
      step(state, DT);
      lowest = Math.min(lowest, clearance(state));
    }
    return lowest;
  }

  it("starts with the boat afloat, moored off the end of the jetty", () => {
    for (const seed of SEEDS) {
      const state = createGame({ seed });
      expect(state.boat).toEqual({ x: 0, y: 0 });
      expect(clearance(state)).toBeGreaterThan(0);
      expect(distance(hullOf(state), state.lake!.jetty.end)).toBeLessThan(BOAT_RADIUS + 60);
    }
  });

  it("stops at the shore when it is sent ashore, whichever way", () => {
    for (const seed of SEEDS) {
      for (let i = 0; i < 12; i++) {
        const state = createGame({ seed });
        const angle = (i / 12) * 2 * Math.PI;
        moveTo(state, { x: Math.cos(angle) * 6000, y: Math.sin(angle) * 6000 });
        const destHull = { x: state.dest!.x, y: state.dest!.y + HULL_CENTRE_Y };
        expect(nearestObstruction(state.lake!, destHull).gap).toBeGreaterThan(BOAT_RADIUS);
        expect(sailChecked(state, 40)).toBeGreaterThan(-0.01);
        expect(state.dest).toBeNull();
        expect(shoreDistance(state.lake!, hullOf(state))).toBeGreaterThan(BOAT_RADIUS - 0.01);
      }
    }
  });

  it("paddles out round the end of the jetty to a spot on its other side", () => {
    for (const seed of SEEDS) {
      const state = createGame({ seed });
      const west = boatFor({ x: -160, y: -330 });
      moveTo(state, west);
      expect(sailChecked(state, 20)).toBeGreaterThan(-0.01);
      expect(distance(state.boat, west)).toBeLessThan(0.5);

      const east = boatFor({ x: 160, y: -330 });
      moveTo(state, east);
      expect(sailChecked(state, 20)).toBeGreaterThan(-0.01);
      expect(distance(state.boat, east)).toBeLessThan(0.5);
    }
  });

  it("goes round a rock in its way and still arrives", () => {
    for (const seed of SEEDS) {
      const state = createGame({ seed });
      const lake = state.lake!;
      for (const rock of lake.rocks) {
        // Across the rock, along the shore rather than towards it.
        const along = Math.atan2(rock.y - lake.centre.y, rock.x - lake.centre.x) + Math.PI / 2;
        const side = (sign: number) =>
          intoWater(
            lake,
            { x: rock.x + Math.cos(along) * 190 * sign, y: rock.y + Math.sin(along) * 190 * sign },
            BOAT_RADIUS + 1,
          );
        const target = boatFor(side(1));
        state.boat = boatFor(side(-1));
        moveTo(state, target);
        expect(sailChecked(state, 20)).toBeGreaterThan(-0.01);
        expect(distance(state.boat, target)).toBeLessThan(0.5);
      }
    }
  });

  it("is slowed by reeds, and picks up speed again beyond them", () => {
    for (const seed of SEEDS) {
      const state = createGame({ seed });
      const lake = state.lake!;
      state.boat = boatFor(intoWater(lake, lake.reeds[0], BOAT_RADIUS + 1));
      expect(inReeds(lake, hullOf(state))).toBe(true);
      moveTo(state, boatFor(lake.centre));
      let amongReeds = 0;
      let beyond = 0;
      for (let t = 0; t < 4; t += DT) {
        const among = inReeds(lake, hullOf(state));
        step(state, DT);
        if (among) amongReeds = Math.max(amongReeds, state.speed);
        else beyond = Math.max(beyond, state.speed);
      }
      expect(amongReeds).toBeGreaterThan(0);
      expect(amongReeds).toBeLessThanOrEqual(BOAT_SPEED * REED_DRAG + 1e-6);
      expect(beyond).toBeGreaterThan(BOAT_SPEED * 0.9);
    }
  });

  it("lands a lure thrown at the jetty or the shore in the water beside it", () => {
    for (const seed of SEEDS) {
      const state = createGame({ seed });
      const lake = state.lake!;
      const onDeck = { x: 0, y: -300 };
      expect(nearestObstruction(lake, onDeck).gap).toBeLessThan(0);
      const besideDeck = castLanding(state, onDeck);
      expect(nearestObstruction(lake, besideDeck).gap).toBeGreaterThan(7.99);
      expect(distance(besideDeck, onDeck)).toBeLessThan(40);

      state.boat = { x: 220, y: -300 };
      const ashore = { x: 220, y: -640 };
      expect(shoreDistance(lake, ashore)).toBeLessThan(0);
      const offShore = castLanding(state, ashore);
      expect(shoreDistance(lake, offShore)).toBeGreaterThan(7.99);
      cast(state, ashore, () => 0);
      expect(state.line?.target).toEqual(offShore);
    }
  });

  it("is open water without end when there is no seed", () => {
    const state = createGame();
    expect(state.lake).toBeNull();
    const target = { x: 9000, y: -9000 };
    moveTo(state, target);
    expect(state.dest).toEqual(target);
    run(state, 60);
    expect(state.boat).toEqual(target);
  });
});

describe("fish", () => {
  const SEED = 7;
  const one = [1];

  it("has a shoal for each fishing ground, as many fish strong as there is left to catch there", () => {
    const state = createGame({ seed: SEED, stock: [3, 2, 1] });
    expect(state.shoals.map((shoal) => shoal.home)).toEqual(state.lake!.grounds.map((grounds) => grounds.home));
    expect(state.shoals.map((shoal) => shoal.fish.length)).toEqual([3, 2, 1]);
    expect(hasFish(state)).toBe(true);
  });

  it("thins and refills the shoals as what is left to catch changes", () => {
    const state = createGame({ seed: SEED, stock: [3] });
    stockShoals(state, [1, 0, 2]);
    expect(state.shoals.map((shoal) => shoal.fish.length)).toEqual([1, 0, 2]);
    stockShoals(state, []);
    expect(hasFish(state)).toBe(false);
  });

  it("has no fish in open water", () => {
    const state = createGame({ stock: [3] });
    expect(state.shoals).toEqual([]);
    expect(hasFish(state)).toBe(false);
    expect(nearestFish(state, { x: 0, y: 0 })).toBeNull();
  });

  it("bites sooner the nearer the lure lands to a fish, and leaves a lure out of its reach to junk", () => {
    const lineFor = (offset: number) => {
      const state = createGame({ seed: SEED, stock: one });
      const fish = fishAt(state, 0, 0);
      state.boat = { x: fish.x, y: fish.y + 150 };
      cast(state, { x: fish.x + offset, y: fish.y }, () => 0.5);
      return state.line!;
    };
    const onTheNose = lineFor(0);
    const near = lineFor(LURE_REACH * 0.8);
    const outOfReach = lineFor(LURE_REACH + 40);
    expect(onTheNose.fish).toEqual({ shoal: 0, id: 0 });
    expect(onTheNose.wait).toBeGreaterThanOrEqual(FISH_WAIT_MIN);
    expect(near.fish).toEqual({ shoal: 0, id: 0 });
    expect(near.wait).toBeGreaterThan(onTheNose.wait + 0.5);
    expect(near.wait).toBeLessThanOrEqual(FISH_WAIT_MAX);
    expect(outOfReach.fish).toBeNull();
    expect(outOfReach.wait).toBeGreaterThanOrEqual(JUNK_WAIT_MIN);
    expect(JUNK_WAIT_MIN).toBeGreaterThan(FISH_WAIT_MAX);
  });

  it("draws the fish to the lure, and takes it out of its shoal when it is reeled in", () => {
    const state = createGame({ seed: SEED, stock: one });
    const fish = fishAt(state, 0, 0);
    state.boat = { x: fish.x, y: fish.y + 150 };
    const target = { x: fish.x + 120, y: fish.y };
    cast(state, target, () => 0);
    const wait = state.line!.wait;

    run(state, WIND_TIME + FLY_TIME + 0.05);
    expect(state.line?.phase).toBe("waiting");
    expect(distance(fishAt(state, 0, 0), target)).toBeGreaterThan(80);
    expect(run(state, wait)).toEqual(["bite"]);
    expect(distance(fishAt(state, 0, 0), target)).toBeLessThan(1);

    expect(run(state, BITE_TIME + REEL_TIME + 0.1)).toEqual(["caught"]);
    expect(state.shoals[0].fish).toEqual([]);
    expect(state.caughtFrom).toBe(0);
  });

  it("snags junk on a lure that lands away from the fish, from no shoal, leaving the fish be", () => {
    const state = createGame({ seed: SEED, stock: one });
    const fish = fishAt(state, 0, 0);
    state.boat = { x: fish.x, y: fish.y + 150 };
    cast(state, fish, () => 0);
    run(state, 10);
    expect(state.caughtFrom).toBe(0);
    stockShoals(state, one);

    const now = fishAt(state, 0, 0);
    state.boat = { x: now.x, y: now.y + 150 };
    cast(state, { x: now.x + LURE_REACH + 120, y: now.y + 150 }, () => 0);
    expect(state.line?.fish).toBeNull();
    expect(run(state, WIND_TIME + FLY_TIME + 0.05)).toEqual(["landed"]);
    expect(run(state, JUNK_WAIT_MIN - 0.1)).toEqual([]);
    expect(run(state, 0.2)).toEqual(["bite"]);
    expect(run(state, BITE_TIME + REEL_TIME + 0.1)).toEqual(["caught"]);
    expect(state.shoals[0].fish).toEqual([0]);
    expect(state.caughtFrom).toBeNull();
  });

  it("rings the surface now and then where a fish rises", () => {
    const state = createGame({ seed: SEED, stock: [3, 2, 1] });
    const rings = new Set<string>();
    for (let t = 0; t < 30; t += DT) {
      step(state, DT);
      for (const ripple of state.ripples) rings.add(`${ripple.x},${ripple.y}`);
    }
    expect(rings.size).toBeGreaterThan(3);
    for (const ring of rings) {
      const [x, y] = ring.split(",").map(Number);
      const fromHome = Math.min(...state.shoals.map((shoal) => distance(shoal.home, { x, y })));
      expect(fromHome).toBeLessThanOrEqual(SHOAL_SPREAD);
    }
  });

  it("keeps the lake's clock running for the water even where there are no fish", () => {
    const state = createGame({ seed: SEED });
    run(state, 2);
    expect(state.time).toBeGreaterThan(1.9);
    const frozen = createGame({ seed: SEED });
    run(frozen, 2, { reducedMotion: true });
    expect(frozen.time).toBe(0);
  });

  it("keeps the fish and the surface still with reduced motion", () => {
    const state = createGame({ seed: SEED, stock: [3] });
    const before = fishAt(state, 0, 1);
    run(state, 20, { reducedMotion: true });
    expect(fishAt(state, 0, 1)).toEqual(before);
    expect(state.ripples).toEqual([]);
    expect(isActive(state)).toBe(false);
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

  /** A lake with one fish in it, and the boat a little way off the fish. */
  function besideAFish() {
    const state = createGame({ seed: 7, stock: [1] });
    const fish = fishAt(state, 0, 0);
    state.boat = { x: fish.x, y: fish.y + 150 };
    return { state, fish };
  }

  it("swings the rod back before the lure flies", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    expect(state.line?.phase).toBe("winding");
    expect(run(state, WIND_TIME - 0.05)).toEqual([]);
    expect(state.line?.phase).toBe("winding");
    run(state, 0.1);
    expect(state.line?.phase).toBe("flying");
  });

  it("goes through landing, a bite after the wait, and a catch, in that order", () => {
    const { state, fish } = besideAFish();
    expect(cast(state, fish, () => 0.5)).toBe(true);
    const wait = state.line!.wait;

    expect(run(state, WIND_TIME + FLY_TIME + 0.1)).toEqual(["landed"]);
    expect(state.line?.phase).toBe("waiting");
    expect(run(state, wait - 0.3)).toEqual([]);
    expect(run(state, 0.4)).toEqual(["bite"]);
    expect(run(state, BITE_TIME + REEL_TIME + 0.1)).toEqual(["caught"]);
    expect(state.line).toBeNull();
  });

  it("waits for junk between the shortest and the longest time, depending on the roll", () => {
    const quick = createGame();
    cast(quick, { x: 200, y: 0 }, () => 0);
    expect(quick.line?.wait).toBe(JUNK_WAIT_MIN);
    const slow = createGame();
    cast(slow, { x: 200, y: 0 }, () => 0.999);
    expect(slow.line?.wait).toBeGreaterThan(JUNK_WAIT_MAX - 0.01);
    expect(slow.line?.wait).toBeLessThan(JUNK_WAIT_MAX);
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
    const { state, fish } = besideAFish();
    cast(state, fish, () => 0);
    const events = run(state, FISH_WAIT_MAX + BITE_TIME + 0.2, { reducedMotion: true });
    expect(events).toEqual(["landed", "bite", "caught"]);
    expect(state.ripples).toEqual([]);

    const junk = createGame();
    cast(junk, { x: 200, y: 0 }, () => 0);
    expect(run(junk, JUNK_WAIT_MIN + BITE_TIME + 0.2, { reducedMotion: true })).toEqual(["landed", "bite", "caught"]);
  });
});

describe("lurePosition", () => {
  it("stays over the boat while the rod swings back, then flies out to the target", () => {
    const state = createGame();
    expect(lurePosition(state)).toBeNull();
    cast(state, { x: 200, y: 0 }, () => 0);
    run(state, WIND_TIME / 2);
    expect(lurePosition(state)).toEqual({ x: 0, y: 0 });

    run(state, WIND_TIME / 2 + FLY_TIME / 2);
    const flying = lurePosition(state)!;
    expect(flying.x).toBeGreaterThan(50);
    expect(flying.x).toBeLessThan(150);

    run(state, FLY_TIME);
    expect(lurePosition(state)).toEqual({ x: 200, y: 0 });
  });

  it("comes back to the boat while reeling", () => {
    const state = createGame();
    cast(state, { x: 200, y: 0 }, () => 0);
    run(state, WIND_TIME + FLY_TIME + JUNK_WAIT_MIN + BITE_TIME + REEL_TIME * 0.9);
    expect(state.line?.phase).toBe("reeling");
    expect(lurePosition(state)!.x).toBeLessThan(30);
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
  const mixed: Catch[] = [
    { id: "p1", kind: "project", title: "p1", href: "/p1" },
    { id: "p2", kind: "project", title: "p2", href: "/p2" },
    { id: "e1", kind: "education", title: "e1", href: "/e1" },
  ];
  const constant = (value: number) => () => value;

  it("brings up something shared out to the fish's grounds when it took the lure, and never junk", () => {
    for (const roll of [0, 0.1, 0.5, 0.999]) {
      expect(pickHaul(mixed, new Set(), [mixed[2]], constant(roll))).toEqual({ type: "catch", item: mixed[2] });
      const haul = pickHaul(mixed, new Set(["p1"]), [mixed[0], mixed[1]], constant(roll));
      expect(haul).toEqual({ type: "catch", item: mixed[1] });
    }
  });

  it("can reach everything at the grounds not caught yet, whatever its kind", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const haul = pickHaul(mixed, new Set(), [mixed[1], mixed[2]], constant(i / 30));
      if (haul.type === "catch") seen.add(haul.item.id);
    }
    expect(seen).toEqual(new Set(["p2", "e1"]));
  });

  it("brings up only junk away from the fish, which says the lake isn't fished out yet", () => {
    for (const roll of [0, 0.5, 0.999]) {
      const haul = pickHaul(mixed, new Set(), null, constant(roll));
      expect(haul).toMatchObject({ type: "junk", fishedOut: false });
    }
    expect(pickHaul(mixed, new Set(), null, constant(0))).toEqual({ type: "junk", item: JUNK[0], fishedOut: false });
  });

  it("can reach every piece of junk, but never the same one twice running", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const haul = pickHaul(mixed, new Set(), null, constant(i / 40), "can");
      if (haul.type === "junk") seen.add(haul.item.id);
    }
    expect(seen).toEqual(new Set(JUNK.filter((junk) => junk.id !== "can").map((junk) => junk.id)));
  });

  it("brings up junk from a shoal with nothing left in it", () => {
    const haul = pickHaul(mixed, new Set(["e1"]), [mixed[2]], constant(0));
    expect(haul).toMatchObject({ type: "junk", fishedOut: false });
  });

  it("says the lake is fished out once everything is caught", () => {
    const haul = pickHaul(mixed, new Set(["p1", "p2", "e1"]), null, constant(0.999));
    expect(haul).toEqual({ type: "junk", item: JUNK.at(-1), fishedOut: true });
  });
});

describe("shareOut", () => {
  /** Things of the kinds spelled out, one letter each: p a project, e a job, d a degree. */
  const items = (kinds: string) => [...kinds].map((kind, i) => ({ id: `${kind}${i}`, kind }));
  const kindsOf = (grounds: { kind: string }[][]) => grounds.map((g) => g.map((item) => item.kind).join(""));

  it("shares everything out evenly, keeping kinds together where it can", () => {
    // Seven projects, two jobs and two degrees: two grounds of projects, and one of jobs and degrees.
    expect(kindsOf(shareOut(items("pppppppeedd"), 3))).toEqual(["ppp", "pppp", "eedd"]);
  });

  it("puts evenness first, even if a kind has to be split", () => {
    const grounds = shareOut(items("pppppppeeedd"), 3);
    expect(grounds.map((g) => g.length)).toEqual([4, 4, 4]);
  });

  it("keeps everything, in order, each thing once", () => {
    const all = items("ppppppeeeeedddd");
    expect(shareOut(all, 3).flat()).toEqual(all);
  });

  it("leaves grounds empty when there are fewer things than grounds", () => {
    expect(shareOut(items("p"), 3).map((g) => g.length).sort()).toEqual([0, 0, 1]);
    expect(shareOut([], 3)).toEqual([[], [], []]);
  });
});

describe("resuming", () => {
  it("comes back to the same lake, the boat lying where it was and facing the same way", () => {
    const state = createGame({ seed: 11, stock: [2] });
    moveTo(state, { x: 300, y: 120 });
    run(state, 0.6);
    cast(state, { x: 500, y: 200 }, () => 0);
    run(state, 0.3);
    const kept = snapshot(state)!;

    const again = createGame({ seed: 999, stock: [2], resume: kept });
    expect(again.lake).toEqual(state.lake);
    expect(again.boat).toEqual(state.boat);
    expect(again.heading).toBe(state.heading);
    expect(again.time).toBe(state.time);
    // The fish swim by the lake's clock, so they are where they were too.
    expect(fishAt(again, 0, 1)).toEqual(fishAt(state, 0, 1));
    // The boat lies still, its line in.
    expect(again.dest).toBeNull();
    expect(again.line).toBeNull();
  });

  it("keeps nothing of open water without a lake", () => {
    expect(snapshot(createGame())).toBeNull();
  });
});
