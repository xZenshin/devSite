/** Shared by the lake's tests. */
import { cast, createGame, step, type GameEvent, type GameState, type StepOptions } from "./game";
import type { Vec } from "./world";

/** One frame at 60 fps, in seconds. */
export const DT = 1 / 60;

/** Lakes to check a rule on: a few ordinary seeds, a large one and the largest. */
export const SEEDS = [1, 7, 42, 123_456_789, 2 ** 31 - 1];

/** A character cell at the usual font size (14px Geist Mono), in pixels. */
export const CELL_W = 8.4;
export const CELL_H = 18;

/** Steps the game for a number of seconds, a frame at a time, and collects what happened. */
export function run(state: GameState, seconds: number, options: StepOptions = {}): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(state, DT, options));
  return events;
}

/** A game on open water with the lure just thrown at `target`; `roll` decides the wait. */
export function castAt(target: Vec, roll = 0): GameState {
  const state = createGame();
  cast(state, target, () => roll);
  return state;
}
