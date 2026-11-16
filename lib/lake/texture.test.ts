import { describe, expect, it } from "vitest";
import { createLake, shoreRadius, type Lake } from "./lake";
import { ASH, BONE, DIM, glyphAt } from "./texture";
import { hasDot, project } from "./world";

const CELL_W = 8.4;
const CELL_H = 18;
const SEEDS = [1, 7, 42];

const cellOf = (p: { x: number; y: number }) => {
  const s = project(p);
  return { col: Math.floor(s.x / CELL_W), row: Math.floor(s.y / CELL_H) };
};
const at = (lake: Lake, p: { x: number; y: number }) => {
  const { col, row } = cellOf(p);
  return glyphAt(lake, col, row, CELL_W, CELL_H);
};
/** The point of the shore in a direction from the lake's middle, moved `out` towards the middle. */
const offShore = (lake: Lake, angle: number, out: number) => {
  const r = shoreRadius(lake, angle) - out;
  return { x: lake.centre.x + Math.cos(angle) * r, y: lake.centre.y + Math.sin(angle) * r };
};

/** The glyphs of a block of cells around a point. */
function around(lake: Lake, p: { x: number; y: number }, halfCols: number, halfRows: number) {
  const { col, row } = cellOf(p);
  const glyphs = [];
  for (let r = row - halfRows; r <= row + halfRows; r++) {
    for (let c = col - halfCols; c <= col + halfCols; c++) glyphs.push(glyphAt(lake, c, r, CELL_W, CELL_H));
  }
  return glyphs;
}

describe("glyphAt", () => {
  it("is nothing but specks in open water without a lake", () => {
    for (let row = -20; row < 20; row++) {
      for (let col = -20; col < 20; col++) {
        const glyph = glyphAt(null, col, row, CELL_W, CELL_H);
        expect(glyph !== null).toBe(hasDot(col, row));
        if (glyph) expect(glyph).toEqual({ char: "·", tone: DIM, solid: false });
      }
    }
  });

  it("shows the same thing in the same cell every time", () => {
    const lake = createLake(7);
    for (let row = -40; row < 40; row += 3) {
      for (let col = -90; col < 90; col += 5) {
        expect(glyphAt(lake, col, row, CELL_W, CELL_H)).toEqual(glyphAt(lake, col, row, CELL_W, CELL_H));
      }
    }
  });

  it("only uses single characters in the three tones", () => {
    const lake = createLake(42);
    for (const glyph of around(lake, lake.jetty.shore, 120, 40)) {
      if (!glyph) continue;
      expect(glyph.char).toHaveLength(1);
      expect([DIM, ASH, BONE]).toContain(glyph.tone);
    }
  });

  it("covers the land, so nothing of the water shows through it", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      for (let angle = 0; angle < 6.2; angle += 0.4) {
        for (const glyph of around(lake, offShore(lake, angle, -300), 6, 3)) expect(glyph?.solid).toBe(true);
      }
    }
  });

  it("leaves open water open: specks only, which fish and ripples pass over", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      // Out past the end of the jetty, where the boat starts: no rocks, reeds or lilies.
      for (const glyph of around(lake, { x: 0, y: 120 }, 14, 4)) {
        if (glyph) expect(glyph).toMatchObject({ solid: false, tone: DIM });
      }
    }
  });

  it("is thick with specks in the shallows and sparse out in the deep", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      const specks = (out: number) => {
        let count = 0;
        for (let angle = 0; angle < 6.2; angle += 0.1) {
          count += around(lake, offShore(lake, angle, out), 4, 1).filter((glyph) => glyph && !glyph.solid).length;
        }
        return count;
      };
      expect(specks(60)).toBeGreaterThan(specks(700) * 1.4);
      expect(specks(700)).toBeGreaterThan(0);
    }
  });

  it("lays the jetty's deck in planks between two rails, from the beach to its end", () => {
    const lake = createLake(7);
    const { shore, end } = lake.jetty;
    for (let y = shore.y + 12; y < end.y - 12; y += 20) {
      const { col, row } = cellOf({ x: 0, y });
      const across = [-2, -1, 0, 1].map((c) => glyphAt(lake, col + c, row, CELL_W, CELL_H));
      expect(across.every((glyph) => glyph?.solid)).toBe(true);
      expect(across.map((glyph) => glyph?.char).join("")).toMatch(/^[|o]==[|o]$/);
    }
    expect(at(lake, { x: 0, y: end.y + 30 })?.solid ?? false).toBe(false);
  });

  it("marks every fishing ground with a buoy and its flag", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      for (const { home } of lake.grounds) {
        const { col, row } = cellOf(home);
        const float = [-1, 0, 1].map((c) => glyphAt(lake, col + c, row, CELL_W, CELL_H));
        expect(float.map((glyph) => glyph?.char).join("")).toBe("(_)");
        expect(float.every((glyph) => glyph?.solid)).toBe(true);
        expect(glyphAt(lake, col, row - 1, CELL_W, CELL_H)).toEqual({ char: "P", tone: BONE, solid: true });
      }
    }
  });

  it("fills in the rocks, and grows reeds and lilies where the lake has them", () => {
    for (const seed of SEEDS) {
      const lake = createLake(seed);
      for (const rock of lake.rocks) expect(at(lake, rock)).toMatchObject({ solid: true });

      const chars = (glyphs: ReturnType<typeof around>) => glyphs.map((glyph) => glyph?.char ?? "").join("");
      const reeds = lake.reeds.map((bed) => chars(around(lake, bed, 8, 2))).join("");
      // Reeds, and only reeds, bend in the wind.
      for (const bed of lake.reeds) {
        for (const glyph of around(lake, bed, 8, 2)) if (glyph?.sway) expect("||!|'\"/\\").toContain(glyph.char);
      }
      expect(lake.reeds.flatMap((bed) => around(lake, bed, 8, 2)).some((glyph) => glyph?.sway)).toBe(true);
      expect(around(lake, lake.jetty.shore, 20, 6).some((glyph) => glyph?.sway)).toBe(false);
      expect(reeds.match(/[|!]/g)?.length ?? 0).toBeGreaterThan(40);
      const lilies = lake.lilies.map((patch) => chars(around(lake, patch, 6, 2))).join("");
      expect(lilies.match(/[@o0*]/g)?.length ?? 0).toBeGreaterThan(20);
    }
  });
});
