import type { IslandKind } from "./islands";

/**
 * The boat as outline drawings, one per heading (0 east, then clockwise in
 * eighths, as headingIndex returns them). Every sprite has the same number of
 * rows and is drawn centred on the boat, so turning doesn't make it jump.
 */
export const BOAT_SPRITES: readonly (readonly string[])[] = [
  // east
  [
    "        |\\       ",
    "        | \\      ",
    "        |__\\     ",
    " _______|________",
    " |  o   o   o   /",
    " |_____________/ ",
  ],
  // south-east
  [
    "        |\\       ",
    "        | \\      ",
    "        |__\\     ",
    "  ______|______  ",
    "  \\  o   o   o \\ ",
    "   \\____________\\",
  ],
  // south
  [
    "        |        ",
    "        |)       ",
    "        |_)      ",
    "    ____|____    ",
    "    \\ o   o /    ",
    "     \\__V__/     ",
  ],
  // south-west
  [
    "       /|        ",
    "      / |        ",
    "     /__|        ",
    "  ______|______  ",
    " / o   o   o  /  ",
    "/____________/   ",
  ],
  // west
  [
    "       /|        ",
    "      / |        ",
    "     /__|        ",
    "________|_______ ",
    "\\   o   o   o  | ",
    " \\_____________| ",
  ],
  // north-west
  [
    "       /|        ",
    "      / |        ",
    "     /__|        ",
    " _______|_____   ",
    " \\ o   o   o  \\  ",
    "  \\____________\\ ",
  ],
  // north
  [
    "        |        ",
    "       (|        ",
    "      (_|        ",
    "     ___|___     ",
    "    /  [_]  \\    ",
    "   /_________\\   ",
  ],
  // north-east
  [
    "        |\\       ",
    "        | \\      ",
    "        |__\\     ",
    "   _____|_______ ",
    "  /  o   o   o / ",
    " /____________/  ",
  ],
];


/** The lure in the air and on the water, and what the line pulls up. */
export const LURE = "o";
export const BOBBER_BITE = "O";
export const HAUL = "?";
export const BITE_MARK = "!";
export const AIM = "+";
export const WATER_DOT = "·";

export interface IslandSprite {
  rows: readonly string[];
  /** The cell [column, row] drawn on the island's centre: the middle of its shoreline. */
  anchor: readonly [number, number];
}

/**
 * One drawing per kind of island. The shoreline follows ISLAND_RADIUS in
 * islands.ts at the default 14px font, so the boat stops at the beach. Each
 * row is solid land from its first to its last character: water, wake and
 * ripples don't show through.
 */
export const ISLAND_SPRITES: Record<IslandKind, IslandSprite> = {
  palm: {
  rows: [
    "         __ _.--..--._ _",
    "     .-' _/   _/\\_   \\_'-.",
    "    |__ /   _/\\__/\\_   \\__|",
    "       |___/\\_\\__/  \\___|",
    "              \\__/",
    "              \\__/",
    "               \\__/",
    "                \\__/",
    "             ____\\__/___",
    "       . - '             ' -.",
    "      /                      \\",
    "~~~~~~~  ~~~~~ ~~~~~  ~~~ ~~~  ~~~~~",
  ],
  anchor: [17, 10],
  },
  rocks: {
    rows: [
      "      /\\      ",
      "   /\\/  \\     ",
      "  /  \\   \\/\\  ",
      " /____\\__/__\\ ",
    ],
    anchor: [7, 2],
  },
  ship: {
    rows: [
      "          /|\\",
      "       /__| )",
      "     /____| ))",
      "   /______| )))",
      " /________|  )))",
      "         _|____))",
      " \\======| o o /",
      "~~~~~~~~~~~~~~~~~"
    ],
    anchor: [8, 6],
  },
};

/** The character for a stretch of fishing line running in direction (dx, dy) on screen. */
export function lineChar(dx: number, dy: number): string {
  const slope = Math.abs(dx) < 1e-6 ? Infinity : dy / dx;
  if (Math.abs(slope) < 0.35) return "-";
  if (Math.abs(slope) > 2.6) return "|";
  return slope > 0 ? "\\" : "/";
}
