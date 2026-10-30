"use client";

import { useId, useState, type ReactNode } from "react";
import {
  GUNS,
  PAIRS,
  START,
  empty,
  fewestEmpties,
  holds,
  nextHands,
  randomDrill,
  type Gun,
  type Hand,
  type Pair,
  type Rotation,
} from "@/lib/aphelios";

const HANDS = ["main hand", "off hand"] as const;
const LOG_LENGTH = 6;

/** Red and blue, the pair the intro mentions. */
const DEFAULT_GOAL: Pair = ["severum", "infernum"];

const pairKey = (pair: Pair) => pair.join("+");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Practise Aphelios' gun rotation: empty either gun in hand and see what comes
 * next, or pick a goal pair and try to reach it in as few empties as possible.
 */
export function ApheliosRotation() {
  // Every rotation since the last reset, so moves can be undone and listed.
  const [rotations, setRotations] = useState<Rotation[]>([START]);
  const [goal, setGoal] = useState<Pair | null>(DEFAULT_GOAL);
  // Index in `rotations` where the goal was set; empties count from there.
  const [goalFrom, setGoalFrom] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const goalLabelId = useId();

  const rotation = rotations.at(-1)!;
  const queue = rotation.slice(2) as Gun[];
  const used = rotations.length - 1 - goalFrom;
  const fewest = goal ? fewestEmpties(rotations[goalFrom], goal) : 0;
  const remaining = goal ? fewestEmpties(rotation, goal) : 0;
  const hintHands = goal && showHint ? nextHands(rotation, goal) : [];

  const log = rotations.slice(1).map((after, i) => {
    const before = rotations[i];
    const hand: Hand = before[0] === after[0] ? 1 : 0;
    // Once a goal is set, an empty that doesn't bring it one closer is a detour.
    const detour =
      goal !== null &&
      i >= goalFrom &&
      !holds(before, goal) &&
      fewestEmpties(after, goal) !== fewestEmpties(before, goal) - 1;
    return { n: i + 1, emptied: before[hand], incoming: after[hand], hand, detour };
  });
  const lastMove = log.at(-1);

  function restart(next: Rotation, nextGoal: Pair | null) {
    setRotations([next]);
    setGoal(nextGoal);
    setGoalFrom(0);
    setShowHint(false);
  }

  function emptyHand(hand: Hand) {
    setRotations([...rotations, empty(rotation, hand)]);
    setShowHint(false);
  }

  function undo() {
    setRotations(rotations.slice(0, -1));
    setGoalFrom(Math.min(goalFrom, rotations.length - 2));
    setShowHint(false);
  }

  function chooseGoal(pair: Pair) {
    setGoal(goal && pairKey(goal) === pairKey(pair) ? null : pair);
    setGoalFrom(rotations.length - 1);
    setShowHint(false);
  }

  function newDrill() {
    const drill = randomDrill();
    restart(drill.rotation, drill.goal);
  }

  let status: string;
  if (!goal) {
    status = "No goal. Empty guns freely, or pick a pair to practise reaching it.";
  } else if (remaining > 0) {
    status = `Fewest empties from here: ${remaining}.`;
    if (hintHands.length > 0) {
      status += hintHands.length === 2 ? " Either gun works next." : ` Empty ${GUNS[rotation[hintHands[0]]].name} next.`;
    }
  } else if (used === 0) {
    status = "You're holding it now.";
  } else {
    status =
      used === fewest
        ? `Reached in ${used}, the fewest possible.`
        : `Reached in ${used}. The fewest possible was ${fewest}.`;
  }

  return (
    <div className="border border-line bg-panel">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5 font-mono text-[12px] text-ash">
        <span>
          <span aria-hidden="true">~/</span>aphelios
        </span>
        <div className="flex gap-4">
          <ToolbarButton onClick={undo} disabled={rotations.length === 1}>
            undo
          </ToolbarButton>
          <ToolbarButton onClick={() => restart(START, goal)}>reset</ToolbarButton>
          <ToolbarButton onClick={newDrill}>new drill</ToolbarButton>
        </div>
      </div>

      <div className="space-y-8 p-4 sm:p-6">
        <div>
          <Label>holding</Label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {([0, 1] as const).map((hand) => (
              <HeldGun
                key={hand}
                gun={rotation[hand]}
                hand={hand}
                hinted={hintHands.includes(hand)}
                onEmpty={() => emptyHand(hand)}
              />
            ))}
          </div>
        </div>

        <div>
          <Label>up next, in order</Label>
          <ol className="mt-3 grid gap-px border border-line bg-line sm:grid-cols-3">
            {queue.map((gun, i) => (
              // Keyed by gun, so only the one sent to the back fades in.
              <li
                key={gun}
                className="fade-in flex items-center gap-3 bg-panel px-4 py-3 sm:flex-col sm:items-start sm:gap-1.5 sm:py-4"
                style={{ "--delay": "0ms" } as React.CSSProperties}
              >
                <span className="w-6 font-mono text-[12px] text-ash">{pad(i + 1)}</span>
                <span className="flex items-center gap-2.5 font-medium">
                  <Swatch gun={gun} />
                  {GUNS[gun].name}
                </span>
                <span className="ml-auto font-mono text-[12px] text-ash sm:ml-0">{GUNS[gun].colour}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-line p-4 sm:p-6">
        <Label id={goalLabelId}>goal pair</Label>
        <ul aria-labelledby={goalLabelId} className="mt-3 flex flex-wrap gap-2">
          {PAIRS.map((pair) => {
            const selected = goal !== null && pairKey(goal) === pairKey(pair);
            return (
              <li key={pairKey(pair)}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseGoal(pair)}
                  title={`${GUNS[pair[0]].name} + ${GUNS[pair[1]].name}`}
                  className={`flex min-h-11 items-center gap-2.5 border px-3.5 py-2 text-sm transition-colors duration-200 hover:border-bone hover:bg-bone hover:text-black ${
                    selected ? "border-bone bg-bone text-black" : "border-line text-ash"
                  }`}
                >
                  <span className="flex gap-1">
                    <Swatch gun={pair[0]} />
                    <Swatch gun={pair[1]} />
                  </span>
                  {GUNS[pair[0]].colour} + {GUNS[pair[1]].colour}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5">
          <p className="font-mono text-[13px]">
            <span aria-hidden="true" className="text-ash">
              ›{" "}
            </span>
            {status}
          </p>
          {goal && remaining > 0 && (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              disabled={showHint}
              className="min-h-9 border border-line px-4 py-1.5 font-mono text-[13px] text-ash transition-colors hover:border-bone hover:text-bone disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ash"
            >
              hint
            </button>
          )}
          {goal && remaining === 0 && used > 0 && (
            <button
              type="button"
              onClick={newDrill}
              className="min-h-9 bg-bone px-4 py-1.5 font-mono text-[13px] text-black transition-opacity hover:opacity-80"
            >
              new drill →
            </button>
          )}
        </div>
        <p aria-live="polite" className="sr-only">
          {lastMove &&
            `${GUNS[lastMove.emptied].name} emptied. ${GUNS[lastMove.incoming].name} takes the ${HANDS[lastMove.hand]}. `}
          {status}
        </p>
      </div>

      <div className="border-t border-line p-4 sm:p-6">
        <div className="flex items-baseline justify-between">
          <Label>emptied</Label>
          <span aria-hidden="true" className="font-mono text-[12px] text-ash">
            {pad(log.length)}
          </span>
        </div>
        {log.length === 0 ? (
          <p className="mt-3 font-mono text-[12px] text-ash">Nothing yet. Click a gun in hand to empty it.</p>
        ) : (
          <ol className="mt-3 font-mono text-[12px]">
            {log
              .slice(-LOG_LENGTH)
              .reverse()
              .map((entry) => (
                <li
                  key={entry.n}
                  className="grid grid-cols-[2rem_1fr_auto] gap-x-4 border-b border-line py-2 last:border-0"
                >
                  <span className="text-ash">{pad(entry.n)}</span>
                  <span>
                    {GUNS[entry.emptied].name} <span className="text-ash">→</span> {GUNS[entry.incoming].name}
                    <span className="text-ash">, {HANDS[entry.hand]}</span>
                  </span>
                  <span>{entry.detour && "detour"}</span>
                </li>
              ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** One gun in hand, as a button that empties it. The new gun rises in when it changes. */
function HeldGun({ gun, hand, hinted, onEmpty }: { gun: Gun; hand: Hand; hinted: boolean; onEmpty: () => void }) {
  const info = GUNS[gun];
  return (
    <button
      type="button"
      onClick={onEmpty}
      aria-label={`Empty ${info.name}, ${HANDS[hand]}`}
      className={`group @container relative overflow-hidden border text-left transition-colors ${
        hinted ? "border-bone" : "border-line"
      }`}
    >
      {/* The white fill sweeps in on hover, as on the projects list; the text inverts above it. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left scale-x-0 bg-bone transition-transform duration-500 ease-in-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
      />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: info.hex }} />
      <span className="relative flex flex-col p-3 transition-colors duration-300 group-hover:text-black group-focus-visible:text-black sm:p-6">
        <span className="flex justify-between gap-2 font-mono text-[12px] text-ash transition-colors group-hover:text-black/60 group-focus-visible:text-black/60">
          {HANDS[hand]}
          {hinted && <span className="text-bone group-hover:text-black group-focus-visible:text-black">empty this</span>}
        </span>
        <span
          key={gun}
          className="reveal-line mt-6 text-[clamp(1.125rem,12cqw,2.75rem)] leading-none font-medium tracking-tight-2 sm:mt-10"
        >
          <span>{info.name}</span>
        </span>
        <span className="mt-3 font-mono text-[12px] text-ash transition-colors group-hover:text-black/60 group-focus-visible:text-black/60">
          {info.colour} · <span className="whitespace-nowrap">{info.kind}</span>
        </span>
        <span className="mt-6 flex items-center gap-2 font-mono text-[12px] sm:mt-8">
          empty
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </button>
  );
}

/** A square of the gun's colour. The faint inset ring keeps white visible on a white fill. */
function Swatch({ gun }: { gun: Gun }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 ring-1 ring-black/25 ring-inset"
      style={{ background: GUNS[gun].hex }}
    />
  );
}

function Label({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="font-mono text-[12px] text-ash">
      {children}
    </h3>
  );
}

function ToolbarButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="py-1 transition-colors hover:text-bone disabled:opacity-40 disabled:hover:text-ash"
    >
      {children}
    </button>
  );
}
