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

const MIRRORED: Record<string, string> = { "/": "\\", "\\": "/", "(": ")", ")": "(", "[": "]", "]": "[" };

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

/**
 * The house on the far shore, east of the jetty, seen from the side like the
 * lighthouse. Its foot is the middle of the bottom row. The front is the gable
 * end on the left, with the door in it (the gap between the `I`s, its threshold
 * the `__` on the bottom row), where the path from the jetty ends. Smoke rises
 * from the chimney (the `[_]`); see smoke.ts.
 * 
 * Taken from https://asciiart.website/artist.php?artist_id=128
 */
export const HOUSE: readonly string[] = [
  "       ________[_]________       ",
  "      /\\        ______    \\      ",
  "     //_\\       \\    /\\    \\     ",
  "    //___\\       \\__/  \\    \\    ",
  "   //_____\\       \\ |[]|     \\   ",
  "  //_______\\       \\|__|      \\  ",
  " /XXXXXXXXXX\\                  \\ ",
  "/_I_II  I__I_\\__________________\\",
  "  I_I|  I__I_____[]_|_[]_____I   ",
  "  I_II  I__I_____[]_|_[]_____I   ",
  "  I II__I  I     XXXXXXX     I   ",
];
/** Where the chimney's top is in the drawing of the house: column, and row. */
export const CHIMNEY = { col: HOUSE[0].indexOf("[_]") + 1, row: 0 };
/**
 * A campsite on the near (south) shore, well up the land: a tent, a pile of
 * logs, and a campfire ringed with stones, smoke curling up from it. Its foot
 * is the middle of the bottom row. It stands up the screen like everything
 * else, towards the lake, so it is placed with its top well clear of the water.
 *
 * "Camping" by Joan G. Stark (Spunk), https://www.asciiart.eu/art/a93d8e13010704e4
 */
export const CAMP: readonly string[] = [
  "      ______             ",
  "     /     /\\            ",
  "    /     /  \\           ",
  "   /_____/----\\_    (    ",
  "  \"     \"          ).    ",
  " _ ___          o (:') o ",
  "(@))_))        o ~/~~\\~ o",
  "                o  o  o  ",
];
/** The campfire's flames, `(:')`, in the drawing of the campsite: its first column, and its row. */
export const CAMPFIRE = { col: CAMP[5].indexOf("(:')"), row: 5 };

/** Where the door is: the first of the two columns of its opening, and the row of its threshold. */
export const DOOR = { col: HOUSE[HOUSE.length - 1].indexOf("__"), row: HOUSE.length - 1 };

/**
 * A bird, seen from above as it flies down the screen (south), once per
 * position of its wings: raised, level, lowered, level again, then round. Each
 * drawing is five characters wide and three rows high, with the body (the `v`)
 * in the middle of both, so flapping doesn't make it jump. See birds.ts.
 */
export const BIRD: readonly (readonly string[])[] = [
  ["\\   /", " \\v/ ", "     "],
  ["     ", "--v--", "     "],
  ["     ", " /v\\ ", "/   \\"],
  ["     ", "--v--", "     "],
];

const UPSIDE_DOWN: Record<string, string> = { "/": "\\", "\\": "/", v: "^", "^": "v" };

/** The same bird flying up the screen (north): each drawing upside down, so its body points the way it flies. */
export const BIRD_NORTH: readonly (readonly string[])[] = BIRD.map((drawing) =>
  [...drawing].reverse().map((row) => [...row].map((char) => UPSIDE_DOWN[char] ?? char).join("")),
);

/** How wide every drawing of the moose is, and the column its feet are in: the middle of its four legs. */
const MOOSE_WIDTH = 11;
export const MOOSE_FEET = 4;

/**
 * A drawing of the moose facing east, typed as it looks: a row of the `[!]` it
 * shows when startled (blank here), then four rows of moose. Rows are filled
 * out with spaces to its width, and blank rows at the top can be left out.
 */
function moose(...rows: string[]): readonly string[] {
  const padded = rows.map((row) => row.padEnd(MOOSE_WIDTH));
  while (padded.length < 5) padded.unshift(" ".repeat(MOOSE_WIDTH));
  return padded;
}

/**
 * The moose on the east shore, facing east, in each of its poses; see moose.ts.
 * Its legs keep to the same columns in every pose, so it doesn't slide about as
 * it twitches, grazes and runs. Facing west, it is drawn mirrored.
 *
 * The moose standing is from https://www.asciiart.eu/art/ebe843cdc14a402c (artist unknown).
 */
export const MOOSE = {
  stand: moose("   \\\\_//", '   __/".', "  /__ |", "  || ||"),
  /** One ear flicked back. */
  ear: moose("   \\\\_//", "   __/'.", "  /__ |", "  || ||"),
  /** A swish of the tail. */
  tail: moose("   \\\\_//", "  '__/\".", "  /__ |", "  || ||"),
  /** Bowing its head, on the way down to the grass and back up. */
  bow: moose("", "   __ \\\\_//", '  /__ \\ /".', "  || ||"),
  /** Head down at the grass, nibbling: the snout up, then down. */
  graze: [moose("", "   ___", "  /__ \\\\_//", '  || || /".'), moose("", "   ___", "  /__ \\\\_//", '  || || /",')],
  /** Startled: head up, and a `[!]` over its antlers. */
  alert: moose("    [!]", "   \\\\_//", '   __/".', "  /__ |", "  || ||"),
  /** Running: legs stretched out, kicking up dust behind, then gathered under it. */
  run: [moose("   \\\\_//", '   __/".', "  /__ |", " .// \\\\"), moose("   \\\\_//", '   __/".', "  /__ |", "  \\\\ //")],
  /** Walking: the same strides, without the dust. */
  walk: [moose("   \\\\_//", '   __/".', "  /__ |", "  // \\\\"), moose("   \\\\_//", '   __/".', "  /__ |", "  \\\\ //")],
} as const;

/** A drawing of the moose facing west: the drawing facing east, mirrored. Its feet are then in column MOOSE_WIDTH - 1 - MOOSE_FEET. */
export function mooseFacingWest(rows: readonly string[]): readonly string[] {
  return mirror([...rows]);
}

/** The lure in the air and on the water, and what the line pulls up. */
export const LURE = "o";
export const BOBBER_BITE = "O";
export const HAUL = "?";
export const BITE_MARK = "!";
export const AIM = "+";
export const WATER_DOT = "·";

/**
 * The fish under the surface, each drawn swimming east and swimming west: a
 * small one, and a bigger one. A drawing's middle row (its body) is on the
 * fish's row, its second column on the fish's column.
 */
export const FISH_SHAPES: readonly { east: readonly string[]; west: readonly string[] }[] = [
  { east: ["><>"], west: ["<><"] },
  { east: [" , ", ">()", " ' "], west: [" , ", "()<", " ` " ] },

  
];

/** The character for a stretch of fishing line running in direction (dx, dy) on screen. */
export function lineChar(dx: number, dy: number): string {
  const slope = Math.abs(dx) < 1e-6 ? Infinity : dy / dx;
  if (Math.abs(slope) < 0.35) return "-";
  if (Math.abs(slope) > 2.6) return "|";
  return slope > 0 ? "\\" : "/";
}
