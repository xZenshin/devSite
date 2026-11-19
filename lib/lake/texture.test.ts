import { describe, expect, it } from "vitest";
import { createLake, offShore, onJetty, shoreDistance, type Lake } from "./lake";
import { CAMP, CAMPFIRE, DOOR, HOUSE } from "./sprites";
import { ASH, BONE, DIM, glyphAt, pathCells, standing } from "./texture";
import { CELL_H, CELL_W, SEEDS } from "./test-utils";
import { cellCentre, hasDot, project } from "./world";


const cellOf = (p: { x: number; y: number }) => {
  const s = project(p);
  return { col: Math.floor(s.x / CELL_W), row: Math.floor(s.y / CELL_H) };
};
const at = (lake: Lake, p: { x: number; y: number }) => {
  const { col, row } = cellOf(p);
  return glyphAt(lake, col, row, CELL_W, CELL_H);
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

  it.each(SEEDS)("covers the land, so nothing of the water shows through it (seed %i)", (seed) => {
    const lake = createLake(seed);
    for (let angle = 0; angle < 6.2; angle += 0.4) {
      for (const glyph of around(lake, offShore(lake, angle, -300), 6, 3)) expect(glyph?.solid).toBe(true);
    }
  });

  it.each(SEEDS)("draws the water's edge thick, so the shore reads as a line, and the beach behind it sparse (seed %i)", (seed) => {
    const lake = createLake(seed);
    /** The share of land cells, just up the beach all round the lake, that hold a character. */
    const inked = (inland: number) => {
      let land = 0;
      let drawn = 0;
      for (let angle = 0; angle < 6.28; angle += 0.02) {
        const glyph = at(lake, offShore(lake, angle, -inland));
        if (!glyph?.solid || glyph.sway) continue;
        land++;
        if (glyph.char !== " ") drawn++;
      }
      return drawn / land;
    };
    expect(inked(4)).toBeGreaterThan(0.75);
    expect(inked(60)).toBeLessThan(0.55);
  });

  it.each(SEEDS)("draws the house up the beach, its windows lit (seed %i)", (seed) => {
    const lake = createLake(seed);
    const top = standing(HOUSE, lake.house, CELL_W, CELL_H);
    HOUSE.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === " ") continue;
        const glyph = glyphAt(lake, top.col + c, top.row + r, CELL_W, CELL_H);
        expect(glyph).toMatchObject({ char: line[c], solid: true });
        if (r > 0 && "[]".includes(line[c])) expect(glyph?.tone).toBe(BONE);
      }
    });
  });

  it.each(SEEDS)("draws the campsite on the land, the fire bright and its smoke dim, all of it clear of the water (seed %i)", (seed) => {
    const lake = createLake(seed);
    const top = standing(CAMP, lake.camp, CELL_W, CELL_H);
    CAMP.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        if (line[c] === " ") continue;
        expect(glyphAt(lake, top.col + c, top.row + r, CELL_W, CELL_H)).toMatchObject({ char: line[c], solid: true });
        // Even its top row is a few rows up the land.
        expect(shoreDistance(lake, cellCentre(top.col + c, top.row + r, CELL_W, CELL_H))).toBeLessThan(-60);
      }
    });
    const fire = glyphAt(lake, top.col + CAMPFIRE.col + 1, top.row + CAMPFIRE.row, CELL_W, CELL_H);
    expect(fire).toMatchObject({ char: ":", tone: BONE });
    // The smoke's `)` is right above the fire's `:`.
    const smoke = glyphAt(lake, top.col + CAMPFIRE.col + 1, top.row + CAMPFIRE.row - 1, CELL_W, CELL_H);
    expect(smoke).toMatchObject({ char: ")", tone: DIM });
  });

  it.each(SEEDS)("paves a path that climbs in steps from the end of the jetty to the house's door (seed %i)", (seed) => {
    const lake = createLake(seed);
    const cells = pathCells(lake, CELL_W, CELL_H);
    const charAt = (col: number, row: number) => cells.get(`${col},${row}`)?.char;
    const paving = [...cells].filter(([, glyph]) => "=#".includes(glyph.char)).map(([key]) => key.split(",").map(Number));
    const rows = [...new Set(paving.map(([, row]) => row))].sort((a, b) => b - a);
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // The lowest step is just above the end of the deck, and the highest just below the door.
    const lowest = Math.min(...paving.filter(([, row]) => row === rows[0]).map(([col]) => col));
    expect(onJetty(lake, cellCentre(lowest, rows[0] + 1, CELL_W, CELL_H))).toBe(true);
    expect(onJetty(lake, cellCentre(lowest, rows[0], CELL_W, CELL_H))).toBe(false);
    const top = standing(HOUSE, lake.house, CELL_W, CELL_H);
    const door = { col: top.col + DOOR.col, row: top.row + DOOR.row };
    // The door's threshold, and the frame either side of it, are in the house's front.
    expect(glyphAt(lake, door.col, door.row, CELL_W, CELL_H)?.char).toBe("_");
    expect(glyphAt(lake, door.col + 1, door.row, CELL_W, CELL_H)?.char).toBe("_");
    expect(glyphAt(lake, door.col - 1, door.row, CELL_W, CELL_H)?.char).toBe("I");
    expect(glyphAt(lake, door.col + 2, door.row, CELL_W, CELL_H)?.char).toBe("I");
    // The highest step is right under the door, across its frame.
    expect(rows.at(-1)).toBe(door.row + 1);
    const highest = paving.filter(([, row]) => row === door.row + 1).map(([col]) => col);
    expect(Math.min(...highest)).toBe(door.col - 1);
    expect(Math.max(...highest)).toBe(door.col + 2);
    // It climbs about as steeply as the drawing it is modelled on: some columns east for each row up.
    const lowFrom = Math.min(...paving.filter(([, row]) => row === rows[0]).map(([col]) => col));
    const across = (Math.min(...highest) - lowFrom) / (rows.length - 1);
    expect(across).toBeGreaterThan(3);
    expect(across).toBeLessThan(8);

    rows.forEach((row, k) => {
      const cols = paving.filter(([, r]) => r === row).map(([col]) => col);
      const [from, to] = [Math.min(...cols), Math.max(...cols)];
      // Each step is one unbroken run, further east than the one below, edged above and below.
      expect(cols).toHaveLength(to - from + 1);
      if (k > 0) expect(from).toBeGreaterThan(Math.min(...paving.filter(([, r]) => r === rows[k - 1]).map(([c]) => c)));
      // Ends: `|` at the two ends of the path, `/` where a step meets the next.
      expect(charAt(from - 1, row)).toBe(k === 0 ? "|" : "/");
      expect(charAt(to + 1, row)).toBe(k === rows.length - 1 ? "|" : "/");
    });

    // On land, it is drawn as it is laid out; the deck and the house are drawn over it.
    for (const [key, glyph] of cells) {
      const [col, row] = key.split(",").map(Number);
      const drawn = glyphAt(lake, col, row, CELL_W, CELL_H);
      if (drawn?.char !== glyph.char) expect(drawn?.char).toMatch(/[=o|XI_ ]/);
    }
  });

  it.each(SEEDS)("leaves open water open: specks only, which fish and ripples pass over (seed %i)", (seed) => {
    const lake = createLake(seed);
    // Out past the end of the jetty, where the boat starts: no rocks, reeds or lilies.
    for (const glyph of around(lake, { x: 0, y: 120 }, 14, 4)) {
      if (glyph) expect(glyph).toMatchObject({ solid: false, tone: DIM });
    }
  });

  it.each(SEEDS)("is thick with specks in the shallows and sparse out in the deep (seed %i)", (seed) => {
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

  it.each(SEEDS)("marks every fishing ground with a buoy and its flag (seed %i)", (seed) => {
    const lake = createLake(seed);
    for (const { home } of lake.grounds) {
      const { col, row } = cellOf(home);
      const float = [-1, 0, 1].map((c) => glyphAt(lake, col + c, row, CELL_W, CELL_H));
      expect(float.map((glyph) => glyph?.char).join("")).toBe("(_)");
      expect(float.every((glyph) => glyph?.solid)).toBe(true);
      expect(glyphAt(lake, col, row - 1, CELL_W, CELL_H)).toEqual({ char: "A", tone: ASH, solid: true });
    }
  });

  it.each(SEEDS)("fills in the rocks, and grows reeds and lilies where the lake has them (seed %i)", (seed) => {
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
  });
});
