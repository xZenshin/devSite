import { describe, expect, it } from "vitest";
import { WASH_REACH, WIND_SPEED, gustAt, surfaceAt, swayAt, washAt, windOf } from "./surface";
import { ASH, DIM } from "./texture";

const SEEDS = [1, 7, 42, 123_456_789];
const CELL_W = 8.4;
const CELL_H = 18;
/** Far enough out that the shore's wash never reaches. */
const OPEN = 1000;

/** The surface of a block of water cells, out in the open, at one moment. */
function block(seed: number, time: number, size = 60, out = OPEN) {
  const glyphs = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size * 2; col++) glyphs.push(surfaceAt(seed, col, row, CELL_W, CELL_H, out, time));
  }
  return glyphs;
}

describe("windOf", () => {
  it("blows across the screen, east or west, and differs from lake to lake", () => {
    const ways = new Set<boolean>();
    for (let seed = 0; seed < 40; seed++) {
      const w = windOf(seed);
      expect(Math.hypot(w.x, w.y)).toBeCloseTo(1);
      expect(Math.abs(w.x)).toBeGreaterThan(0.8);
      ways.add(w.x > 0);
    }
    expect(ways).toEqual(new Set([true, false]));
  });
});

describe("gustAt", () => {
  it("is between calm and full strength, and the same at the same place and time", () => {
    for (const seed of SEEDS) {
      for (let x = -2000; x < 2000; x += 137) {
        const g = gustAt(seed, { x, y: x * 0.7 }, 12.5);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(1);
        expect(gustAt(seed, { x, y: x * 0.7 }, 12.5)).toBe(g);
      }
    }
  });

  it("drifts with the wind: a gust is found downwind later on", () => {
    for (const seed of SEEDS) {
      const w = windOf(seed);
      for (let i = 0; i < 20; i++) {
        const p = { x: i * 173 - 1500, y: i * 91 - 800 };
        const later = { x: p.x + w.x * WIND_SPEED * 10, y: p.y + w.y * WIND_SPEED * 10 };
        expect(gustAt(seed, later, 30)).toBeCloseTo(gustAt(seed, p, 20), 6);
      }
    }
  });

  it("ruffles some of the lake at any moment, but leaves most of it calm", () => {
    for (const seed of SEEDS) {
      for (const time of [0, 40, 400]) {
        let gusty = 0;
        let points = 0;
        for (let x = -3000; x < 3000; x += 60) {
          for (let y = -3000; y < 3000; y += 60) {
            points++;
            if (gustAt(seed, { x, y }, time) > 0) gusty++;
          }
        }
        expect(gusty / points).toBeGreaterThan(0.03);
        expect(gusty / points).toBeLessThan(0.4);
      }
    }
  });
});

describe("washAt", () => {
  it("comes up the beach and goes back, never further than its reach and never less than half of it", () => {
    for (const seed of SEEDS) {
      const p = { x: 300, y: -500 };
      const reaches: number[] = [];
      const rising = new Set<boolean>();
      for (let time = 0; time < 10; time += 0.1) {
        const wash = washAt(seed, p, time);
        reaches.push(wash.reach);
        rising.add(wash.rising);
      }
      expect(Math.max(...reaches)).toBeLessThanOrEqual(WASH_REACH);
      expect(Math.max(...reaches)).toBeGreaterThan(WASH_REACH * 0.95);
      expect(Math.min(...reaches)).toBeGreaterThanOrEqual(WASH_REACH * 0.5);
      expect(Math.min(...reaches)).toBeLessThan(WASH_REACH * 0.55);
      expect(rising).toEqual(new Set([true, false]));
    }
  });

  it("is coming in at some places along the shore while it goes out at others", () => {
    for (const seed of SEEDS) {
      const rising = new Set<boolean>();
      for (let x = 0; x < 3000; x += 50) rising.add(washAt(seed, { x, y: 0 }, 5).rising);
      expect(rising).toEqual(new Set([true, false]));
    }
  });
});

describe("surfaceAt", () => {
  it("keeps the edge of the water wet, with foam or wash, whenever you look", () => {
    for (const seed of SEEDS) {
      for (let time = 0; time < 8; time += 0.7) {
        const wet = block(seed, time, 10, 2).filter((glyph) => glyph && "~-".includes(glyph.char)).length;
        expect(wet).toBeGreaterThan(15);
      }
    }
  });

  it("leaves the water past the wash's reach to its texture, apart from gusts and glints", () => {
    for (const seed of SEEDS) {
      const glyphs = block(seed, 3).filter((glyph) => glyph !== null);
      for (const glyph of glyphs) {
        expect("~-'.").toContain(glyph.char);
        expect([DIM, ASH]).toContain(glyph.tone);
        expect(glyph.solid).toBe(false);
      }
    }
  });

  it("changes as time goes by, a little at a time", () => {
    for (const seed of SEEDS) {
      const now = block(seed, 20).map((glyph) => glyph?.char ?? " ");
      const soon = block(seed, 20.1).map((glyph) => glyph?.char ?? " ");
      const later = block(seed, 60).map((glyph) => glyph?.char ?? " ");
      const differ = (a: string[], b: string[]) => a.filter((char, i) => char !== b[i]).length;
      expect(differ(now, soon)).toBeLessThan(now.length * 0.1);
      expect(differ(now, later)).toBeGreaterThan(differ(now, soon));
    }
  });

  it("glints here and there in calm water, briefly", () => {
    const seed = 7;
    // A cell that glints: it does so for a moment, then shows its texture for much longer.
    // Only about one cell in a hundred ever glints, so look along a wide stretch of water.
    let glinting = 0;
    let moments = 0;
    for (let time = 0; time < 60; time += 0.05) {
      for (let col = 0; col < 400; col++) {
        const p = { x: (col + 0.5) * CELL_W, y: 0 };
        if (gustAt(seed, p, time) > 0) continue;
        moments++;
        const glyph = surfaceAt(seed, col, 0, CELL_W, CELL_H, OPEN, time);
        if (glyph?.char === "'" || glyph?.char === ".") glinting++;
      }
    }
    expect(glinting).toBeGreaterThan(0);
    expect(glinting / moments).toBeLessThan(0.01);
  });
});

describe("swayAt", () => {
  it("bends reeds over with the wind while a gust passes, and leaves them standing in the calm", () => {
    for (const seed of SEEDS) {
      const downwind = windOf(seed).x > 0 ? "/" : "\\";
      const bends = new Set<string | null>();
      for (let time = 0; time < 600; time += 0.4) {
        for (let col = 0; col < 120; col += 4) {
          const bent = swayAt(seed, col, 3, CELL_W, CELL_H, time);
          const calm = gustAt(seed, { x: (col + 0.5) * CELL_W, y: (3.5 * CELL_H) / 0.5 }, time) < 0.3;
          if (calm) expect(bent).toBeNull();
          bends.add(bent);
        }
      }
      expect(bends).toEqual(new Set([null, downwind]));
    }
  });
});
