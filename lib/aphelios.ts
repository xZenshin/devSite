/**
 * Aphelios, a League of Legends champion, carries five guns and holds two at
 * a time. When one runs out of ammo, the next gun in the queue takes its hand
 * and the empty one goes to the back of the queue.
 */

export type Gun = "calibrum" | "severum" | "gravitum" | "infernum" | "crescendum";

export interface GunInfo {
  name: string;
  colour: string;
  kind: string;
  /** Swatch colour on the page; decoration only, never for text. */
  hex: string;
}

export const GUNS: Record<Gun, GunInfo> = {
  calibrum: { name: "Calibrum", colour: "green", kind: "sniper rifle", hex: "#4ade80" },
  severum: { name: "Severum", colour: "red", kind: "scythe pistol", hex: "#f05454" },
  gravitum: { name: "Gravitum", colour: "purple", kind: "gravity cannon", hex: "#a78bfa" },
  infernum: { name: "Infernum", colour: "blue", kind: "flamethrower", hex: "#60a5fa" },
  crescendum: { name: "Crescendum", colour: "white", kind: "chakram", hex: "#f2f2f0" },
};

export const GUN_ORDER: readonly Gun[] = ["calibrum", "severum", "gravitum", "infernum", "crescendum"];

/** Main hand, off hand, then the queue, next gun first. */
export type Rotation = readonly [Gun, Gun, Gun, Gun, Gun];

/** 0 is the main hand, 1 the off hand. */
export type Hand = 0 | 1;

export type Pair = readonly [Gun, Gun];

/** The game starts with green and red in hand, then purple, blue and white. */
export const START: Rotation = ["calibrum", "severum", "gravitum", "infernum", "crescendum"];

/** All ten pairs, in gun order. */
export const PAIRS: readonly Pair[] = GUN_ORDER.flatMap((first, i) =>
  GUN_ORDER.slice(i + 1).map((second): Pair => [first, second]),
);

/** The rotation after the gun in `hand` runs out of ammo. */
export function empty(rotation: Rotation, hand: Hand): Rotation {
  const [main, off, next, ...rest] = rotation;
  return hand === 0 ? [next, off, ...rest, main] : [main, next, ...rest, off];
}

/** Whether both guns of the pair are in hand, in either hand. */
export function holds(rotation: Rotation, pair: Pair): boolean {
  return pair.every((gun) => gun === rotation[0] || gun === rotation[1]);
}

/**
 * The fewest guns to empty before holding the pair, by breadth-first search.
 * There are only 120 rotations, so searching them all is instant.
 */
export function fewestEmpties(rotation: Rotation, pair: Pair): number {
  const seen = new Set([rotation.join()]);
  let frontier = [rotation];
  for (let empties = 0; frontier.length > 0; empties++) {
    if (frontier.some((current) => holds(current, pair))) return empties;
    frontier = frontier.flatMap((current) =>
      ([0, 1] as const).map((hand) => empty(current, hand)).filter((next) => {
        const key = next.join();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    );
  }
  return Infinity;
}

/** The hands whose gun to empty next on a shortest route to the pair; none once it is held. */
export function nextHands(rotation: Rotation, pair: Pair): Hand[] {
  const distance = fewestEmpties(rotation, pair);
  if (distance === 0) return [];
  return ([0, 1] as const).filter((hand) => fewestEmpties(empty(rotation, hand), pair) === distance - 1);
}

/** A shuffled rotation and a goal pair at least two empties away, so there is a route to plan. */
export function randomDrill(random: () => number = Math.random): { rotation: Rotation; goal: Pair } {
  const guns = [...GUN_ORDER];
  for (let i = guns.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [guns[i], guns[j]] = [guns[j], guns[i]];
  }
  const rotation = guns as unknown as Rotation;
  const goals = PAIRS.filter((pair) => fewestEmpties(rotation, pair) >= 2);
  return { rotation, goal: goals[Math.floor(random() * goals.length)] };
}
