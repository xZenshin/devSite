import { describe, expect, it } from "vitest";
import { TILT, clampCast, hasDot, headingIndex, project, traceRing, unproject } from "./world";

describe("project / unproject", () => {
  it("flattens the y axis and undoes it", () => {
    expect(project({ x: 40, y: 100 })).toEqual({ x: 40, y: 100 * TILT });
    expect(unproject(project({ x: -12.5, y: 77 }))).toEqual({ x: -12.5, y: 77 });
  });
});

describe("hasDot", () => {
  it("gives the same answer for the same cell every time", () => {
    for (const [col, row] of [
      [0, 0],
      [-4000, 123],
      [99999, -99999],
    ]) {
      expect(hasDot(col, row)).toBe(hasDot(col, row));
    }
  });

  it("leaves the water sparse but not empty, far from the origin too", () => {
    for (const origin of [0, -50_000, 1_000_000]) {
      let dots = 0;
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) if (hasDot(origin + col, origin + row)) dots++;
      }
      expect(dots).toBeGreaterThan(120);
      expect(dots).toBeLessThan(400);
    }
  });
});

describe("clampCast", () => {
  it("lands on the target when it is in range", () => {
    expect(clampCast({ x: 10, y: 10 }, { x: 40, y: 50 }, 100)).toEqual({ x: 40, y: 50 });
  });

  it("lands at full range in the same direction when the target is too far", () => {
    const landing = clampCast({ x: 10, y: 0 }, { x: 310, y: 400 }, 100);
    expect(landing.x).toBeCloseTo(70);
    expect(landing.y).toBeCloseTo(80);
  });
});

describe("headingIndex", () => {
  it("counts clockwise from east in eighths, as seen on screen", () => {
    expect(headingIndex(1, 0)).toBe(0);
    expect(headingIndex(1, 2)).toBe(1);
    expect(headingIndex(0, 1)).toBe(2);
    expect(headingIndex(-1, 2)).toBe(3);
    expect(headingIndex(-1, 0)).toBe(4);
    expect(headingIndex(-1, -2)).toBe(5);
    expect(headingIndex(0, -1)).toBe(6);
    expect(headingIndex(1, -2)).toBe(7);
  });
});

describe("traceRing", () => {
  const cellW = 8;
  const cellH = 16;

  /** The ring as a map from "col,row" to its character; by default centred on cell 0,0. */
  function trace(r: number, center = { x: 4, y: 8 }): Map<string, string> {
    const cells = new Map<string, string>();
    traceRing(center, r, cellW, cellH, (col, row, char) => cells.set(`${col},${row}`, char));
    return cells;
  }
  const coords = (cells: Map<string, string>) => [...cells.keys()].map((key) => key.split(",").map(Number));

  /** The ring as lines of text, for reading a failure. */
  function picture(cells: Map<string, string>): string {
    const all = coords(cells);
    const cols = all.map(([col]) => col);
    const rows = all.map(([, row]) => row);
    const lines: string[] = [];
    for (let row = Math.min(...rows); row <= Math.max(...rows); row++) {
      let line = "";
      for (let col = Math.min(...cols); col <= Math.max(...cols); col++) line += cells.get(`${col},${row}`) ?? " ";
      lines.push(line.trimEnd());
    }
    return lines.join("\n");
  }

  it("draws a small ring as a closed outline", () => {
    expect(picture(trace(40))).toBe([" .--'''--.", "(         )", " '--...--'"].join("\n"));
  });

  it("is an ellipse: as wide as the radius, half as tall", () => {
    const cells = coords(trace(120));
    const cols = cells.map(([col]) => col);
    const rows = cells.map(([, row]) => row);
    expect([Math.min(...cols), Math.max(...cols)]).toEqual([-15, 15]);
    expect([Math.min(...rows), Math.max(...rows)]).toEqual([-4, 4]);
  });

  it("mirrors left to right and top to bottom around a cell's centre", () => {
    const cells = trace(90);
    const acrossOf: Record<string, string> = { "(": ")", ")": "(" };
    const belowOf: Record<string, string> = { "'": ".", ".": "'" };
    for (const [key, char] of cells) {
      const [col, row] = key.split(",").map(Number);
      expect(cells.get(`${-col},${row}`)).toBe(acrossOf[char] ?? char);
      expect(cells.get(`${col},${-row}`)).toBe(belowOf[char] ?? char);
    }
  });

  it("is one unbroken outline: every cell touches another and no column is skipped", () => {
    for (const r of [24, 47, 64, 96, 110]) {
      const all = coords(trace(r, { x: 3, y: 5 }));
      for (const [col, row] of all) {
        const touching = all.filter(
          ([c, r2]) => (c !== col || r2 !== row) && Math.abs(c - col) <= 1 && Math.abs(r2 - row) <= 1,
        );
        expect(touching.length).toBeGreaterThanOrEqual(1);
      }
      const cols = all.map(([col]) => col);
      for (let col = Math.min(...cols); col <= Math.max(...cols); col++) expect(cols).toContain(col);
    }
  });

  it("uses brackets only at the two ends", () => {
    const cells = trace(120);
    for (const [key, char] of cells) {
      const col = Number(key.split(",")[0]);
      if (char === "(") expect(col).toBe(-15);
      if (char === ")") expect(col).toBe(15);
    }
    expect([...cells.values()]).toContain("(");
    expect([...cells.values()]).toContain(")");
  });

  it("is hollow, and a ring too small to draw is a single mark", () => {
    expect(trace(120).has("0,0")).toBe(false);
    expect([...trace(2).entries()]).toEqual([["0,0", "o"]]);
  });
});
