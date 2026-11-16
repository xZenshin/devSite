import { describe, expect, it } from "vitest";
import { MAX_FISH, SHOAL_SPREAD, stock, wander, type Shoal } from "./fish";
import { distance } from "./world";

const HOME = { x: 400, y: -250 };

describe("wander", () => {
  it("puts a fish in the same place at the same time, every time", () => {
    expect(wander(7, 0, 2, HOME, 12.5)).toEqual(wander(7, 0, 2, HOME, 12.5));
  });

  it("keeps every fish within the shoal's spread of its home", () => {
    for (const seed of [1, 7, 42]) {
      for (let shoal = 0; shoal < 3; shoal++) {
        for (let id = 0; id < MAX_FISH; id++) {
          for (let time = 0; time < 300; time += 1.7) {
            expect(distance(wander(seed, shoal, id, HOME, time), HOME)).toBeLessThanOrEqual(SHOAL_SPREAD);
          }
        }
      }
    }
  });

  it("drifts slowly: a fish moves, but not far in a second", () => {
    for (let id = 0; id < MAX_FISH; id++) {
      let furthest = 0;
      for (let time = 0; time < 60; time += 1) {
        const moved = distance(wander(7, 0, id, HOME, time), wander(7, 0, id, HOME, time + 1));
        furthest = Math.max(furthest, moved);
        expect(moved).toBeLessThan(60);
      }
      expect(furthest).toBeGreaterThan(5);
    }
  });

  it("sends each fish on a course of its own", () => {
    const places = new Set<string>();
    for (let id = 0; id < MAX_FISH; id++) {
      const fish = wander(7, 1, id, HOME, 3);
      places.add(`${Math.round(fish.x)},${Math.round(fish.y)}`);
    }
    expect(places.size).toBe(MAX_FISH);
  });

  it("faces the fish the way it is swimming", () => {
    for (let id = 0; id < MAX_FISH; id++) {
      for (let time = 0; time < 100; time += 3.3) {
        const now = wander(7, 2, id, HOME, time);
        const soon = wander(7, 2, id, HOME, time + 0.01);
        if (Math.abs(soon.x - now.x) > 1e-4) expect(now.east).toBe(soon.x > now.x);
      }
    }
  });
});

describe("stock", () => {
  const shoal = (fish: number[]): Shoal => ({ kind: "project", home: HOME, fish, rise: 1 });

  it("fills a shoal with as many fish as there is left to catch, up to the most it shows", () => {
    const empty = shoal([]);
    stock(empty, 3);
    expect(empty.fish).toEqual([0, 1, 2]);
    stock(empty, 50);
    expect(empty.fish).toHaveLength(MAX_FISH);
    expect(new Set(empty.fish).size).toBe(MAX_FISH);
  });

  it("leaves the fish that are there alone, and gives a new one a number that is free", () => {
    const thinned = shoal([0, 2, 3]);
    stock(thinned, 3);
    expect(thinned.fish).toEqual([0, 2, 3]);
    stock(thinned, 4);
    expect(thinned.fish).toEqual([0, 2, 3, 1]);
  });

  it("takes fish away when less is left, down to none", () => {
    const full = shoal([0, 1, 2, 3]);
    stock(full, 2);
    expect(full.fish).toEqual([0, 1]);
    stock(full, 0);
    expect(full.fish).toEqual([]);
    stock(full, -3);
    expect(full.fish).toEqual([]);
  });
});
