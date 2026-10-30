import { describe, expect, it } from "vitest";
import { GUN_ORDER, PAIRS, START, empty, fewestEmpties, holds, nextHands, randomDrill, type Rotation } from "./aphelios";

/** Every order the five guns can be in. */
function allRotations(): Rotation[] {
  const permute = (guns: Rotation[number][]): Rotation[number][][] =>
    guns.length <= 1 ? [guns] : guns.flatMap((gun, i) => permute(guns.toSpliced(i, 1)).map((rest) => [gun, ...rest]));
  return permute([...GUN_ORDER]) as unknown as Rotation[];
}

describe("empty", () => {
  it("replaces the main hand with the next gun and sends the empty one to the back", () => {
    expect(empty(START, 0)).toEqual(["gravitum", "severum", "infernum", "crescendum", "calibrum"]);
  });

  it("replaces the off hand the same way", () => {
    expect(empty(START, 1)).toEqual(["calibrum", "gravitum", "infernum", "crescendum", "severum"]);
  });
});

describe("holds", () => {
  it("ignores which hand holds which gun", () => {
    expect(holds(START, ["severum", "calibrum"])).toBe(true);
    expect(holds(START, ["calibrum", "gravitum"])).toBe(false);
  });
});

describe("fewestEmpties", () => {
  it("is zero when the pair is already held", () => {
    expect(fewestEmpties(START, ["calibrum", "severum"])).toBe(0);
  });

  it("finds red and blue two empties from the start", () => {
    expect(fewestEmpties(START, ["severum", "infernum"])).toBe(2);
  });

  it("reaches every pair from every rotation", () => {
    for (const rotation of allRotations()) {
      for (const pair of PAIRS) expect(fewestEmpties(rotation, pair)).toBeLessThan(Infinity);
    }
  });
});

describe("nextHands", () => {
  it("names the hand to empty on a shortest route", () => {
    expect(nextHands(START, ["severum", "infernum"])).toEqual([0]);
  });

  it("is empty when the pair is already held", () => {
    expect(nextHands(START, ["calibrum", "severum"])).toEqual([]);
  });

  it("always brings the pair one empty closer", () => {
    for (const rotation of allRotations()) {
      for (const pair of PAIRS) {
        const distance = fewestEmpties(rotation, pair);
        for (const hand of nextHands(rotation, pair)) {
          expect(fewestEmpties(empty(rotation, hand), pair)).toBe(distance - 1);
        }
      }
    }
  });
});

describe("randomDrill", () => {
  it("starts from a full rotation, with a goal at least two empties away", () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      const { rotation, goal } = randomDrill(random);
      expect([...rotation].sort()).toEqual([...GUN_ORDER].sort());
      expect(fewestEmpties(rotation, goal)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("PAIRS", () => {
  it("lists each of the ten pairs once", () => {
    expect(new Set(PAIRS.map((pair) => [...pair].sort().join("+"))).size).toBe(10);
  });
});
