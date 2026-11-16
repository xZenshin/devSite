import { describe, expect, it } from "vitest";
import { PADDLE_FRAMES } from "./game";
import { ANGLER_SPRITES, BOAT_SPRITES } from "./sprites";

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
