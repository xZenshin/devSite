import { describe, expect, it } from "vitest";
import { createLake, shoreDistance, type Lake } from "./lake";
import {
  ALERT_RADIUS,
  ALERT_TIME,
  alertShake,
  createMoose,
  mooseDrawing,
  mooseMoving,
  stepMoose,
  type Moose,
} from "./moose";
import { MOOSE, MOOSE_FEET } from "./sprites";
import { distance, type Vec } from "./world";

const DT = 1 / 60;
const SEEDS = [1, 7, 42];

/** Numbers in [0, 1) that follow from a seed, one after another. */
function numbers(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

/** Steps the moose for a number of seconds with the boat where it is, and collects what it looked like. */
function run(moose: Moose, lake: Lake, boat: Vec, seconds: number, rng: () => number, still = false) {
  const seen: string[] = [];
  for (let t = 0; t < seconds; t += DT) {
    stepMoose(moose, lake, boat, DT, rng, still);
    seen.push(`${moose.mode}:${moose.mode === "idle" ? moose.pose : ""}`);
  }
  return seen;
}

/** Far out in the lake, nowhere near the moose. */
const FAR = { x: 0, y: 0 };

describe("the moose", () => {
  it("lives on the land by the east shore, a little way up from the water, facing the lake", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      const moose = createMoose(lake, numbers(seed));
      expect(moose.at.x).toBeGreaterThan(lake.centre.x + 800);
      const ashore = -shoreDistance(lake, moose.at);
      expect(ashore).toBeGreaterThan(70);
      expect(ashore).toBeLessThan(125);
      expect(moose.facing).toBe(-1);
    }
  });

  it("left alone, stays where it is, twitching now and then and bowing its head to graze", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    const at = { ...moose.at };
    const seen = new Set(run(moose, lake, FAR, 60, numbers(5)));
    expect(moose.at).toEqual(at);
    for (const pose of ["stand", "ear", "tail", "bow", "graze", "rise"]) expect(seen).toContain(`idle:${pose}`);
    expect([...seen].every((s) => s.startsWith("idle"))).toBe(true);
  });

  it("looks up with a [!] when the boat comes close, then runs off away from the lake", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      const moose = createMoose(lake, numbers(seed));
      const start = { ...moose.at };
      // The boat comes up the water just off the moose's spot.
      const boat = { x: start.x - ALERT_RADIUS + 60, y: start.y };
      run(moose, lake, boat, DT * 2, numbers(1));
      expect(moose.mode).toBe("alert");
      expect(mooseDrawing(moose).rows[0].trim()).toBe("[!]");
      // It stares for a moment, then runs.
      run(moose, lake, boat, ALERT_TIME, numbers(1));
      expect(moose.mode).toBe("flee");
      expect(mooseMoving(moose)).toBe(true);
      run(moose, lake, boat, 0.5, numbers(1));
      // Further up the land, and further from the boat.
      expect(shoreDistance(lake, moose.at)).toBeLessThan(shoreDistance(lake, start) - 60);
      expect(distance(moose.at, boat)).toBeGreaterThan(distance(start, boat));
    }
  });

  it("stops, then walks back down to a new spot by the water, and grazes there again", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      const moose = createMoose(lake, numbers(seed));
      const start = { ...moose.at };
      const boat = { x: start.x - 200, y: start.y };
      run(moose, lake, boat, ALERT_TIME + 0.1, numbers(2));
      // The boat sails off; the moose runs to its refuge, pauses, and walks back.
      const seen = run(moose, lake, FAR, 30, numbers(2));
      expect(seen).toContain("pause:");
      expect(seen).toContain("return:");
      expect(moose.mode).toBe("idle");
      const ashore = -shoreDistance(lake, moose.at);
      expect(ashore).toBeGreaterThan(70);
      expect(ashore).toBeLessThan(125);
      expect(moose.at).not.toEqual(start);
      // On the east side still, facing the lake.
      expect(moose.at.x).toBeGreaterThan(lake.centre.x + 800);
      expect(moose.facing).toBe(-1);
    }
  });

  it("is startled again if the boat comes close on its way back", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(9));
    run(moose, lake, { x: moose.at.x - 200, y: moose.at.y }, ALERT_TIME + 0.1, numbers(4));
    run(moose, lake, FAR, 4, numbers(4));
    expect(["pause", "return"]).toContain(moose.mode);
    run(moose, lake, { x: moose.at.x - 150, y: moose.at.y }, DT * 2, numbers(4));
    expect(moose.mode).toBe("alert");
  });

  it("with reduced motion, neither moves nor twitches, but looks up at the boat while it is near", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    const at = { ...moose.at };
    expect(new Set(run(moose, lake, FAR, 30, numbers(5), true))).toEqual(new Set(["idle:stand"]));
    run(moose, lake, { x: at.x - 150, y: at.y }, 5, numbers(5), true);
    expect(moose.mode).toBe("alert");
    expect(moose.at).toEqual(at);
    run(moose, lake, FAR, DT * 2, numbers(5), true);
    expect(moose.mode).toBe("idle");
  });
});

describe("alertShake", () => {
  it("shakes the [!] a little from side to side as it appears, then holds it still", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    expect(alertShake(moose)).toBe(0);
    run(moose, lake, { x: moose.at.x - 150, y: moose.at.y }, DT, numbers(1));
    expect(moose.mode).toBe("alert");

    const shakes: number[] = [];
    while (moose.mode === "alert" && moose.t < 0.5) {
      shakes.push(alertShake(moose));
      // Drawn every frame while it shakes, so the shake is smooth.
      expect(mooseMoving(moose)).toBe(moose.t < 0.35);
      stepMoose(moose, lake, { x: moose.at.x - 150, y: moose.at.y }, DT / 4, numbers(1));
    }
    // Both ways, never more than a pixel and a half, and still by the end.
    expect(Math.min(...shakes)).toBeLessThan(-0.3);
    expect(Math.max(...shakes)).toBeGreaterThan(0.3);
    for (const shake of shakes) expect(Math.abs(shake)).toBeLessThanOrEqual(1.5);
    expect(shakes.at(-1)).toBe(0);
    expect(mooseMoving(moose)).toBe(false);
  });

  it("doesn't shake with reduced motion", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    run(moose, lake, { x: moose.at.x - 150, y: moose.at.y }, 0.1, numbers(1), true);
    expect(moose.mode).toBe("alert");
    expect(alertShake(moose, true)).toBe(0);
  });
});

describe("mooseDrawing", () => {
  it("keeps its feet in the same column in every pose, and mirrors it facing west", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    moose.facing = 1;
    const east = mooseDrawing(moose);
    expect(east.feet).toBe(MOOSE_FEET);
    expect(east.rows).toEqual(MOOSE.stand);
    moose.facing = -1;
    const west = mooseDrawing(moose);
    expect(west.feet).toBe(MOOSE.stand[0].length - 1 - MOOSE_FEET);
    // Facing west, its snout is on the left of its head.
    expect(west.rows[2].trim()).toBe('."\\__');
  });

  it("strides as it runs, one drawing of its legs and then the other", () => {
    const lake = createLake(7);
    const moose = createMoose(lake, numbers(3));
    moose.mode = "flee";
    moose.facing = 1;
    const legs = new Set<string>();
    for (let stride = 0; stride < 100; stride += 5) {
      moose.stride = stride;
      legs.add(mooseDrawing(moose).rows[4]);
    }
    expect(legs).toEqual(new Set([MOOSE.run[0][4], MOOSE.run[1][4]]));
  });
});
