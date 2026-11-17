import { describe, expect, it } from "vitest";
import { ARC, ROD_LENGTH, ROD_LIFT, SETTLE_TIME, linePath, lureOnScreen, rod, traceLine } from "./cast";
import {
  BITE_TIME,
  FLY_TIME,
  JUNK_WAIT_MIN,
  REEL_TIME,
  WIND_TIME,
  cast,
  createGame,
} from "./game";
import { DT, castAt, run } from "./test-utils";
import { distance, project } from "./world";

/** A game with the lure thrown 300 to the right of the boat. */
const castRight = () => castAt({ x: 300, y: 0 });

describe("rod", () => {
  it("is only out while the line is", () => {
    const state = createGame();
    expect(rod(state)).toBeNull();
    cast(state, { x: 300, y: 0 }, () => 0);
    expect(rod(state)).not.toBeNull();
  });

  it("is held in the paddler's hands, and is always the same length", () => {
    const state = castRight();
    for (const seconds of [0.05, WIND_TIME, FLY_TIME / 2, FLY_TIME]) {
      run(state, seconds);
      const { butt, tip } = rod(state)!;
      expect(butt).toEqual({ x: 0, y: -ROD_LIFT });
      expect(distance(butt, tip)).toBeCloseTo(ROD_LENGTH);
    }
  });

  it("swings back over the shoulder, away from the throw, then whips forward towards it", () => {
    const state = castRight();
    run(state, WIND_TIME - DT);
    const back = rod(state)!;
    expect(back.tip.x).toBeLessThan(back.butt.x);
    expect(back.tip.y).toBeLessThan(back.butt.y);

    run(state, DT + FLY_TIME * 0.5);
    const forward = rod(state)!;
    expect(forward.tip.x).toBeGreaterThan(forward.butt.x + ROD_LENGTH * 0.6);
    expect(forward.tip.y).toBeLessThan(forward.butt.y);
  });

  it("points the other way for a throw to the left", () => {
    const state = castAt({ x: -300, y: 0 });
    run(state, WIND_TIME + FLY_TIME);
    const { butt, tip } = rod(state)!;
    expect(tip.x).toBeLessThan(butt.x);
  });
});

describe("lureOnScreen", () => {
  it("hangs from the rod, flies off its tip in an arc, and lands on the target", () => {
    const state = castRight();
    run(state, WIND_TIME / 2);
    const hanging = lureOnScreen(state)!;
    expect(hanging.y).toBeGreaterThan(rod(state)!.tip.y);
    expect(Math.abs(hanging.x - rod(state)!.tip.x)).toBeLessThan(1);

    run(state, WIND_TIME / 2 + FLY_TIME / 2);
    const midway = lureOnScreen(state)!;
    const straight = (rod(state)!.tip.y + project({ x: 300, y: 0 }).y) / 2;
    expect(midway.y).toBeLessThan(straight - ARC * 0.8);

    run(state, FLY_TIME);
    expect(lureOnScreen(state)).toEqual(project({ x: 300, y: 0 }));
  });

  it("is reeled back up to the rod's tip", () => {
    const state = castRight();
    run(state, WIND_TIME + FLY_TIME + JUNK_WAIT_MIN + BITE_TIME + REEL_TIME * 0.95);
    expect(state.line?.phase).toBe("reeling");
    expect(distance(lureOnScreen(state)!, rod(state)!.tip)).toBeLessThan(10);
  });
});

describe("linePath", () => {
  it("runs from the rod's tip to the lure", () => {
    const state = castRight();
    for (const seconds of [0.1, WIND_TIME, FLY_TIME / 2, FLY_TIME, 1]) {
      run(state, seconds);
      const path = linePath(state);
      expect(path[0]).toEqual(rod(state)!.tip);
      expect(distance(path.at(-1)!, lureOnScreen(state)!)).toBeLessThan(1e-6);
    }
  });

  it("follows the lure's arc while it flies, then sinks onto the water and runs straight", () => {
    const state = castRight();
    run(state, WIND_TIME + FLY_TIME * 0.8);
    const flying = linePath(state);
    expect(flying.length).toBeGreaterThan(3);
    // Every point of the arc is above the straight way from the first point to the last.
    const [first, last] = [flying[0], flying.at(-1)!];
    for (const p of flying.slice(1, -1)) {
      const f = (p.x - first.x) / (last.x - first.x);
      expect(p.y).toBeLessThan(first.y + (last.y - first.y) * f);
    }

    run(state, FLY_TIME * 0.2 + 0.05);
    expect(state.line?.phase).toBe("waiting");
    const sinking = linePath(state);
    expect(sinking.length).toBeGreaterThan(2);

    run(state, SETTLE_TIME);
    expect(linePath(state)).toHaveLength(2);
  });

  it("is always straight with reduced motion", () => {
    const state = castRight();
    run(state, 0.1, { reducedMotion: true });
    expect(linePath(state, true)).toHaveLength(2);
  });

  it("is nothing with no line out", () => {
    expect(linePath(createGame())).toEqual([]);
  });
});

describe("traceLine", () => {
  const W = 10;
  const H = 20;

  function trace(points: { x: number; y: number }[]) {
    const cells: [number, number, string][] = [];
    traceLine(points, W, H, (col, row, char) => cells.push([col, row, char]));
    return cells;
  }

  it("draws a flat line with one dash per column, leaving out both ends", () => {
    expect(trace([{ x: 5, y: 10 }, { x: 55, y: 10 }])).toEqual([1, 2, 3, 4].map((col) => [col, 0, "-"]));
  });

  it("draws a steep line with one character per row", () => {
    expect(trace([{ x: 5, y: 10 }, { x: 5, y: 110 }])).toEqual([1, 2, 3, 4].map((row) => [0, row, "|"]));
  });

  it("follows a bend: rising, then flat, then falling", () => {
    const chars = trace([
      { x: 5, y: 210 },
      { x: 65, y: 90 },
      { x: 145, y: 90 },
      { x: 205, y: 210 },
    ]).map(([, , char]) => char);
    expect(chars[0]).toBe("/");
    expect(chars).toContain("-");
    expect(chars.at(-1)).toBe("\\");
  });

  it("draws nothing for fewer than two points", () => {
    expect(trace([{ x: 5, y: 10 }])).toEqual([]);
  });
});
