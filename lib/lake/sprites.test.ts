import { describe, expect, it } from "vitest";
import { PADDLE_FRAMES } from "./game";
import { ANGLER_SPRITES, BIRD, BIRD_NORTH, BOAT_SPRITES, FISH_SHAPES, MOOSE, MOOSE_FEET, mooseFacingWest } from "./sprites";

describe("the bird's drawings", () => {
  it("keeps the body in the middle of every drawing, flying either way, so flapping doesn't make it jump", () => {
    for (const [drawings, body] of [
      [BIRD, "v"],
      [BIRD_NORTH, "^"],
    ] as const) {
      for (const drawing of drawings) {
        expect(drawing).toHaveLength(3);
        for (const row of drawing) expect(row).toHaveLength(5);
        expect(drawing[1][2]).toBe(body);
      }
    }
  });

  it("flies north upside down: wings raised going south are lowered going north", () => {
    expect(BIRD_NORTH[0]).toEqual(["     ", " /^\\ ", "/   \\"]);
    expect(BIRD_NORTH[2]).toEqual(["\\   /", " \\^/ ", "     "]);
  });
});

describe("the moose's drawings", () => {
  const all = [MOOSE.stand, MOOSE.ear, MOOSE.tail, MOOSE.bow, ...MOOSE.graze, MOOSE.alert, ...MOOSE.run, ...MOOSE.walk];

  it("draws every pose the same size, a row for the [!] on top, so nothing jumps", () => {
    for (const drawing of all) {
      expect(drawing).toHaveLength(5);
      for (const row of drawing) expect(row).toHaveLength(MOOSE.stand[0].length);
    }
    expect(MOOSE.alert[0].trim()).toBe("[!]");
    for (const drawing of all.filter((d) => d !== MOOSE.alert)) expect(drawing[0].trim()).toBe("");
  });

  it("keeps its legs either side of its feet in every pose", () => {
    for (const drawing of all) {
      const legs = drawing[4];
      expect(legs[MOOSE_FEET]).toBe(" ");
      expect(legs.slice(MOOSE_FEET - 2, MOOSE_FEET).trim()).toHaveLength(2);
      expect(legs.slice(MOOSE_FEET + 1, MOOSE_FEET + 3).trim()).toHaveLength(2);
    }
  });

  it("mirrors the [!] the right way round, facing west", () => {
    expect(mooseFacingWest(MOOSE.alert)[0].trim()).toBe("[!]");
  });
});

describe("the fish's drawings", () => {
  it("mirrors each fish's body, its middle row, for swimming the other way", () => {
    const flip: Record<string, string> = { "<": ">", ">": "<", "(": ")", ")": "(" };
    for (const { east, west } of FISH_SHAPES) {
      expect(west).toHaveLength(east.length);
      const body = (rows: readonly string[]) => rows[Math.floor((rows.length - 1) / 2)];
      expect([...body(east)].reverse().map((char) => flip[char] ?? char).join("")).toBe(body(west));
    }
  });
});

const WEST = 4;

describe("the kayak's drawings", () => {
  const all = [...BOAT_SPRITES.flat(), ...ANGLER_SPRITES];

  it("has a drawing of the paddler fishing for each heading, without the paddle", () => {
    expect(ANGLER_SPRITES).toHaveLength(8);
    const inked = (drawing: readonly string[]) => drawing.join("").replace(/ /g, "").length;
    ANGLER_SPRITES.forEach((angler, heading) => {
      // The same kayak and paddler as when paddling, less the paddle.
      for (const paddling of BOAT_SPRITES[heading]) expect(inked(angler)).toBeLessThan(inked(paddling));
    });
  });

  it("has every paddle position for each of the eight headings", () => {
    expect(BOAT_SPRITES).toHaveLength(8);
    for (const frames of BOAT_SPRITES) expect(frames).toHaveLength(PADDLE_FRAMES);
  });

  it("draws them all the same size, so turning and paddling don't make the kayak jump", () => {
    const [first] = all;
    expect(first.length).toBeGreaterThan(0);
    for (const sprite of all) {
      expect(sprite).toHaveLength(first.length);
      for (const row of sprite) expect(row).toHaveLength(first[0].length);
    }
  });

  it("keeps the paddler in the middle of the drawing whichever way he faces", () => {
    for (const sprite of all) {
      const heads = sprite.flatMap((row) => [...row].flatMap((char, c) => (char === "O" ? [c] : [])));
      expect(heads).toEqual([(sprite[0].length - 1) / 2]);
    }
  });

  it("moves the paddle between one position and the next", () => {
    for (const frames of BOAT_SPRITES) {
      for (let f = 0; f < PADDLE_FRAMES; f++) {
        expect(frames[f]).not.toEqual(frames[(f + 1) % PADDLE_FRAMES]);
      }
    }
  });

  it("mirrors the kayak for the opposite heading across the screen", () => {
    const flip: Record<string, string> = { "/": "\\", "\\": "/", "(": ")", ")": "(" };
    const mirrored = (rows: readonly string[]) =>
      rows.map((row) => [...row].reverse().map((char) => flip[char] ?? char).join(""));
    // East is west mirrored, north-east is north-west mirrored, and so on round the compass.
    for (let heading = 0; heading < 8; heading++) {
      const opposite = (WEST - heading + 8) % 8;
      for (let f = 0; f < PADDLE_FRAMES; f++) {
        expect(BOAT_SPRITES[opposite]).toContainEqual(mirrored(BOAT_SPRITES[heading][f]));
      }
    }
  });
});
