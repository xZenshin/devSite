import { describe, expect, it } from "vitest";
import { smokeAt } from "./smoke";
import { windOf } from "./surface";

describe("smokeAt", () => {
  it("is the same at the same time, and a whole column of puffs from the first moment", () => {
    expect(smokeAt(7, 12.3)).toEqual(smokeAt(7, 12.3));
    const puffs = smokeAt(7, 0);
    expect(puffs.length).toBeGreaterThanOrEqual(7);
    // One puff to a row, all above the chimney.
    const rows = puffs.map((puff) => Math.round(puff.y));
    expect(new Set(rows).size).toBe(puffs.length);
    for (const puff of puffs) expect(puff.y).toBeLessThan(0);
  });

  it("rises: every puff is higher a moment later", () => {
    const now = smokeAt(7, 20);
    const soon = smokeAt(7, 20.3);
    // The newest puff first, so the same puff is at the same place in both, unless one has just been made.
    const shared = Math.min(now.length, soon.length) - 1;
    for (let i = 0; i < shared; i++) {
      const same = soon.find((puff) => Math.abs(puff.y - (now[i].y - 0.375)) < 0.01);
      expect(same).toBeDefined();
    }
  });

  it("starts as a small closed puff at the chimney and swells into a ring that comes apart at the top", () => {
    const puffs = smokeAt(7, 33.25);
    const lowest = puffs.reduce((a, b) => (a.y > b.y ? a : b));
    const highest = puffs.reduce((a, b) => (a.y < b.y ? a : b));
    expect(lowest.chars).toMatch(/^[()]_[()]$/);
    expect(highest.chars.length).toBeGreaterThan(lowest.chars.length);
    expect(highest.chars.trim().length).toBe(1);
  });

  it("leans with the wind, further the higher it rises", () => {
    for (const seed of [1, 7, 42, 99]) {
      const puffs = smokeAt(seed, 50);
      const highest = puffs.reduce((a, b) => (a.y < b.y ? a : b));
      expect(Math.sign(highest.x)).toBe(Math.sign(windOf(seed).x));
      expect(Math.abs(highest.x)).toBeGreaterThan(1.5);
    }
  });
});
