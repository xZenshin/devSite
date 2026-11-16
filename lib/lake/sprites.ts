/** Every drawing of the kayak is this many characters wide; the paddler sits in the middle column. */
const KAYAK_WIDTH = 21;
/** A drawing has at least this many rows. It may have more: see standTogether. */
const KAYAK_ROWS = 5;

/**
 * A drawing typed as it looks. Rows are filled out with spaces to the kayak's
 * width. A blank row is an empty line, and blank rows at the bottom can be left out.
 */
function art(drawing: string): string[] {
  const rows = drawing.replace(/^\n|\n$/g, "").split("\n");
  while (rows.length < KAYAK_ROWS) rows.push("");
  return rows.map((row) => row.padEnd(KAYAK_WIDTH));
}

/**
 * Lays one drawing over another, `down` rows lower: every character but a
 * space covers what is beneath it. The drawings needn't be the same size.
 */
function stack(under: string[], over: string[], down = 0): string[] {
  let used = over.length;
  while (used > 0 && over[used - 1].trim() === "") used--;
  return Array.from({ length: Math.max(under.length, used + down) }, (_, r) => {
    const below = under[r] ?? "";
    const above = over[r - down] ?? "";
    return Array.from({ length: Math.max(below.length, above.length, KAYAK_WIDTH) }, (_, c) =>
      (above[c] ?? " ") === " " ? (below[c] ?? " ") : above[c],
    ).join("");
  });
}

/**
 * Puts blank rows on top of the shorter drawings, so that all of them have
 * the same number of rows and stand on the same bottom row.
 */
function standTogether(sets: string[][][]): string[][][] {
  const height = Math.max(...sets.flat().map((drawing) => drawing.length));
  const blank = " ".repeat(KAYAK_WIDTH);
  return sets.map((frames) =>
    frames.map((drawing) => [...Array<string>(height - drawing.length).fill(blank), ...drawing]),
  );
}

const MIRRORED: Record<string, string> = { "/": "\\", "\\": "/", "(": ")", ")": "(" };

/** A drawing as seen in a mirror: what faced west faces east. */
function mirror(rows: string[]): string[] {
  return rows.map((row) => [...row].reverse().map((char) => MIRRORED[char] ?? char).join(""));
}

/**
 * The paddler seen from the side, facing west, once per position of the
 * paddle: at rest, then on round as he paddles. A blade goes into the water
 * ahead of him and is pulled back past the hull, while the other swings over.
 * His seat is the middle of the drawing; the hull is drawn underneath.
 */
const PADDLER = [
  art(String.raw`
    \
      \   O,
        \/ )
          \
            \
`),
  art(String.raw`

  _ _ _ _ O, _ _ _
        _/ )
`),
  art(String.raw`
            /
          O,
        // )
      /
    /
`),
  art(String.raw`
        |
        | O,
        |/ )
        |
        |
`),
];

/** The paddler with the paddle stowed, fishing. The rod is drawn on its own; see cast.ts. */
const ANGLER = art(String.raw`

          O,
         / )
`);

/** The hull from the side, with a gap where the paddler sits: level, bow up, and bow down. */
const HULL_WEST = art(String.raw`


\_______    ________/
`);
const HULL_NORTH_WEST = art(String.raw`


'-._____    ______.-'
                  
`);
const HULL_SOUTH_WEST = art(String.raw`


'-._____    ______.-'
`);

/** The kayak from above, paddler and all: heading away from the viewer, and towards. */
const HULL_NORTH = art(String.raw`
          .
         / \
         | |
         | |
         (O)
         | |
         | |
         \_/
`);
const HULL_SOUTH = art(String.raw`
         / \
         | |
         | |
         (O)
         | |
         | |
         \ /
          V
`);

/**
 * The paddle held across the kayak: level, and with the left blade in the
 * water. Three rows: above the paddler, level with him, and below. The gap in
 * the middle is where he sits.
 */
const PADDLE_LEVEL = art(String.raw`

  _ _ _ _   _ _ _ _
`);
const PADDLE_LEFT = art(String.raw`
              _.-'
      _.-   -'
   .-'
`);
/** Seen from behind or in front the paddle dips to one side, then the other. */
const PADDLE_ACROSS = [PADDLE_LEVEL, PADDLE_LEFT, PADDLE_LEVEL, mirror(PADDLE_LEFT)];

/** Each set of drawings below: one per position of the paddle, then the paddler fishing. */
const fromTheSide = (hull: string[]) => [...PADDLER, ANGLER].map((paddler) => stack(hull, paddler));
const fromAbove = (hull: string[]) => {
  // The paddle goes on whichever row of the hull the paddler's head is drawn on.
  const seat = hull.findIndex((row) => row.includes("O"));
  return [...PADDLE_ACROSS.map((paddle) => stack(hull, paddle, seat - 1)), hull];
};

const WEST = fromTheSide(HULL_WEST);
const NORTH_WEST = fromTheSide(HULL_NORTH_WEST);
const SOUTH_WEST = fromTheSide(HULL_SOUTH_WEST);

const DRAWINGS = standTogether([
  WEST.map(mirror), // east
  SOUTH_WEST.map(mirror), // south-east
  fromAbove(HULL_SOUTH), // south
  SOUTH_WEST,
  WEST,
  NORTH_WEST,
  fromAbove(HULL_NORTH), // north
  NORTH_WEST.map(mirror), // north-east
]);

/**
 * The boat: a man in a kayak. One set of drawings per heading (0 east, then
 * clockwise in eighths, as headingIndex returns them), and in each set one
 * drawing per position of the paddle (as paddleFrame returns them; 0 is the
 * paddle at rest). They are all the same size and drawn centred on the boat,
 * so neither turning nor paddling makes it jump.
 */
export const BOAT_SPRITES: readonly (readonly (readonly string[])[])[] = DRAWINGS.map((set) =>
  set.slice(0, PADDLER.length),
);

/** The boat while a line is out, one drawing per heading: the paddle stowed, so the rod stands clear. */
export const ANGLER_SPRITES: readonly (readonly string[])[] = DRAWINGS.map((set) => set[PADDLER.length]);

/**
 * The lighthouse on the far shore, seen from the side like the kayak: a banded
 * tower with the lamp near the top. Its foot is the middle of the bottom row.
 *
 * The tower is cropped from the lighthouse piece at https://ascii.rest/lighthouse/
 * (https://github.com/bas3line/ascii, src/pieces/lighthouse.ts), without its sky,
 * sea, rocks or beam. Copyright (c) 2026 bas3line, MIT License.
 */
export const LIGHTHOUSE: readonly string[] = [
  "      +      ",
  "    ##*+-    ",
  "   ###*+=-   ",
  "   -:+*+:-   ",
  "   -:*o*:-   ",
  "   -:+*+:-   ",
  " :#:*:+:+:=: ",
  "--------::...",
  "  #%%##*+-:  ",
  "  #%%##*+-:  ",
  "  #%%##*+=:  ",
  "  ::::::...  ",
  "  ::::.:...  ",
  "  ::::::...  ",
  " ##%###*+=-: ",
  " #%%###*+=-: ",
  " #%%###*+=-: ",
  " :::::::.... ",
];
/** The lamp in the drawing of the lighthouse. */
export const LAMP = "o";

/** The lure in the air and on the water, and what the line pulls up. */
export const LURE = "o";
export const BOBBER_BITE = "O";
export const HAUL = "?";
export const BITE_MARK = "!";
export const AIM = "+";
export const WATER_DOT = "·";

/** A fish under the surface, swimming east and swimming west. */
export const FISH_EAST = "><>";
export const FISH_WEST = "<><";

/** The character for a stretch of fishing line running in direction (dx, dy) on screen. */
export function lineChar(dx: number, dy: number): string {
  const slope = Math.abs(dx) < 1e-6 ? Infinity : dy / dx;
  if (Math.abs(slope) < 0.35) return "-";
  if (Math.abs(slope) > 2.6) return "|";
  return slope > 0 ? "\\" : "/";
}
