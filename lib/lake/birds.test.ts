import { describe, expect, it } from "vitest";
import { BIRD_SPEED, birdsAt, flightOver, planFlight, wingsAt, type Flight } from "./birds";

const VIEW = { left: 600, right: 1400, top: -300, bottom: 600 };

/** A generator that returns the given numbers in turn. */
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

/** Every position of a flight's first bird, a tenth of a second apart, from start to end, over a view that stays still. */
function track(flight: Flight) {
  const points = [];
  for (let t = flight.start; !flightOver(flight, t, VIEW); t += 0.1) points.push(birdsAt(flight, t)![0]);
  return points;
}

/** The view shifted down the screen by `dy` pixels: the boat sailed south (or north, for a negative `dy`). */
const moved = (dy: number) => ({ ...VIEW, top: VIEW.top + dy, bottom: VIEW.bottom + dy });

/** Whether any bird of a flight is in a view at `time`. */
const inView = (flight: Flight, time: number, view: typeof VIEW) =>
  birdsAt(flight, time)!.some((bird) => bird.y > view.top && bird.y < view.bottom && bird.x > view.left && bird.x < view.right);

describe("planFlight", () => {
  it("flies down the screen from above the view to below it, or up it from below to above", () => {
    for (const north of [0.9, 0.1]) {
      const flight = planFlight(VIEW, 10, rolls(north, 0.5, 0.5, 0.9));
      const path = track(flight);
      const [first, last] = [path[0], path.at(-1)!];
      if (north < 0.5) {
        expect(first.y).toBeGreaterThan(VIEW.bottom);
        expect(last.y).toBeLessThan(VIEW.top);
        expect(path.every((bird) => bird.north)).toBe(true);
      } else {
        expect(first.y).toBeLessThan(VIEW.top);
        expect(last.y).toBeGreaterThan(VIEW.bottom);
        expect(path.every((bird) => !bird.north)).toBe(true);
      }
    }
  });

  it("sets off somewhere across the view, and flies far more up or down than sideways", () => {
    for (const roll of [0, 0.3, 0.7, 0.999]) {
      const flight = planFlight(VIEW, 0, rolls(0.2, roll, roll, 0.9));
      expect(flight.from.x).toBeGreaterThanOrEqual(VIEW.left);
      expect(flight.from.x).toBeLessThanOrEqual(VIEW.right);
      expect(Math.abs(flight.velocity.y)).toBe(BIRD_SPEED);
      expect(Math.abs(flight.velocity.x)).toBeLessThan(BIRD_SPEED * 0.2);
    }
  });

  it("is sometimes a bird alone, sometimes two together, the second a little behind and to the side", () => {
    const alone = planFlight(VIEW, 0, rolls(0.2, 0.5, 0.5, 0.9));
    expect(birdsAt(alone, 1)).toHaveLength(1);

    // Flying north, so behind is further down the screen.
    const pair = planFlight(VIEW, 0, rolls(0.2, 0.5, 0.5, 0.1, 0.7, 0.5, 0.5));
    const [lead, mate] = birdsAt(pair, 1)!;
    expect(mate.y).toBeGreaterThan(lead.y);
    expect(mate.y - lead.y).toBeLessThan(40);
    expect(Math.abs(mate.x - lead.x)).toBeGreaterThan(20);
    expect(Math.abs(mate.x - lead.x)).toBeLessThan(60);
  });

  it("has no birds before it sets off", () => {
    const flight = planFlight(VIEW, 10, rolls(0.5));
    expect(birdsAt(flight, 9.9)).toBeNull();
    expect(birdsAt(flight, 10)).not.toBeNull();
  });
});

describe("flightOver", () => {
  const south = () => planFlight(VIEW, 0, rolls(0.9, 0.5, 0.5, 0.9));
  const height = VIEW.bottom - VIEW.top;

  it("isn't over while the birds are still on their way in from beyond the edge", () => {
    expect(flightOver(south(), 0, VIEW)).toBe(false);
    expect(flightOver(south(), 0.5, VIEW)).toBe(false);
  });

  it("is over once the birds are past the far edge of a view that stayed still", () => {
    const flight = south();
    const across = (height + 200) / BIRD_SPEED;
    expect(flightOver(flight, across * 0.5, VIEW)).toBe(false);
    expect(flightOver(flight, across, VIEW)).toBe(true);
  });

  it("goes on while the boat sails the same way as the birds, as long as they are in view", () => {
    // Going south, the view moves down after the birds; they stay in it for longer than a still view lets them.
    const flight = south();
    const stillEnds = (height + 200) / BIRD_SPEED;
    for (let t = 0; t < stillEnds * 1.6; t += 0.1) {
      const view = moved(Math.min(t, 6) * 80);
      if (inView(flight, t, view)) expect(flightOver(flight, t, view)).toBe(false);
    }
    expect(inView(flight, stillEnds, moved(6 * 80))).toBe(true);
    expect(flightOver(flight, stillEnds, moved(6 * 80))).toBe(false);
  });

  it("ends when the view moves on ahead of the birds and leaves them behind", () => {
    // The boat sails south fast: the birds fall behind, out of the top of the view, and are gone.
    const flight = south();
    expect(flightOver(flight, 4, moved(4 * 400))).toBe(true);
    // Sideways, too.
    expect(flightOver(flight, 4, { ...VIEW, left: VIEW.left + 3000, right: VIEW.right + 3000 })).toBe(true);
  });
});

describe("wingsAt", () => {
  it("beats the wings through every position, then glides on level wings", () => {
    const seen = new Set<number>();
    for (let t = 0; t < 1.3; t += 0.01) seen.add(wingsAt(t));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
    // Gliding, a little later.
    expect(wingsAt(1.5)).toBe(1);
    expect(wingsAt(2.0)).toBe(1);
  });
});
