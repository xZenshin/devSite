"use client";

import { useEffect, useRef } from "react";
import {
  HULL_CENTRE_Y,
  WAVE_LIFE,
  cast,
  castLanding,
  createGame,
  isActive,
  lurePosition,
  moveTo,
  rippleRadius,
  step,
  type GameState,
} from "@/lib/lake/game";
import { islandsAround } from "@/lib/lake/islands";
import {
  AIM,
  BITE_MARK,
  BOAT_SPRITES,
  BOBBER_BITE,
  HAUL,
  ISLAND_SPRITES,
  LURE,
  WATER_DOT,
  lineChar,
} from "@/lib/lake/sprites";
import { TILT, hasDot, project, traceRing, unproject, type Vec } from "@/lib/lake/world";
import { usePrefersReducedMotion } from "../use-media-query";

export type TouchMode = "move" | "cast";

interface LakeCanvasProps {
  /** The line came back with something on it. */
  onHaul: () => void;
  /** The visitor sailed, cast or clicked the water: whatever is showing can go away. */
  onAction: () => void;
  /** What a tap does on touch screens, which have no right-click or hover. */
  touchMode: TouchMode;
  /** Keys are ignored while something else (the chat) has the visitor's attention. */
  keysBlocked: boolean;
}

const FONT_PX = 14;
/** Brightness steps a character can have; the index is stored per cell. */
const TONES = ["--dim", "--ash", "--bone"] as const;
const DIM = 1;
const ASH = 2;
const BONE = 3;

/** Where the boat rests on screen, as a share of the viewport. The catch card's CSS matches this. */
function anchorFor(width: number, height: number): Vec {
  return width >= 1024 ? { x: width * 0.64, y: height * 0.56 } : { x: width * 0.5, y: height * 0.7 };
}

/**
 * The lake: an endless plane of still water drawn as monospace characters on a
 * canvas. Right-click sails the boat, Q throws the lure at the pointer. Nothing
 * is redrawn while nothing moves.
 */
export function LakeCanvas(props: LakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // A new scatter of islands on every visit.
    const state: GameState = createGame({ islandSeed: Math.floor(Math.random() * 2 ** 31) });
    const camera = { x: 0, y: 0, placed: false };
    const pointer = { x: 0, y: 0, known: false, overWater: false, mouse: false };
    let width = 0;
    let height = 0;
    let cellW = FONT_PX * 0.6;
    const cellH = Math.round(FONT_PX * 1.25);
    let font = `${FONT_PX}px monospace`;
    let colors: string[] = [];
    let frame = 0;
    let lastTime = 0;
    let lastPointerType = "mouse";

    // One character and one tone per visible cell, rebuilt every frame.
    let chars = new Uint16Array(0);
    let tones = new Uint8Array(0);
    let cols = 0;
    let rows = 0;
    let col0 = 0;
    let row0 = 0;

    const put = (col: number, row: number, char: string, tone: number) => {
      const c = col - col0;
      const r = row - row0;
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      chars[r * cols + c] = char.charCodeAt(0);
      tones[r * cols + c] = tone;
    };
    const cellOf = (p: Vec) => ({ col: Math.floor(p.x / cellW), row: Math.floor(p.y / cellH) });
    const toWorld = (clientX: number, clientY: number) => unproject({ x: clientX + camera.x, y: clientY + camera.y });

    function measure() {
      const styles = getComputedStyle(document.documentElement);
      const family = styles.getPropertyValue("--font-geist-mono").trim();
      font = `${FONT_PX}px ${family ? `${family}, ` : ""}ui-monospace, monospace`;
      ctx!.font = font;
      cellW = ctx!.measureText("M").width || FONT_PX * 0.6;
      colors = ["", ...TONES.map((name) => styles.getPropertyValue(name).trim() || "#888")];
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      camera.placed = false;
      requestFrame();
    }

    /** Eases the camera towards keeping the boat on its anchor. Returns whether it is still moving. */
    function follow(dt: number): boolean {
      const anchor = anchorFor(width, height);
      const boat = project(state.boat);
      const targetX = boat.x - anchor.x;
      const targetY = boat.y - anchor.y;
      if (!camera.placed || reducedMotion) {
        camera.x = targetX;
        camera.y = targetY;
        camera.placed = true;
        return false;
      }
      const k = 1 - Math.exp(-dt * 5);
      camera.x += (targetX - camera.x) * k;
      camera.y += (targetY - camera.y) * k;
      return Math.abs(targetX - camera.x) + Math.abs(targetY - camera.y) > 0.25;
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.font = font;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      col0 = Math.floor(camera.x / cellW) - 1;
      row0 = Math.floor(camera.y / cellH) - 1;
      cols = Math.ceil(width / cellW) + 3;
      rows = Math.ceil(height / cellH) + 3;
      if (chars.length < cols * rows) {
        chars = new Uint16Array(cols * rows);
        tones = new Uint8Array(cols * rows);
      } else {
        tones.fill(0);
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (hasDot(col0 + c, row0 + r)) put(col0 + c, row0 + r, WATER_DOT, DIM);
        }
      }

      // The wake: each wave starts bright and wavy, then dims and flattens as it dies down.
      for (const wave of state.waves) {
        const fade = wave.age / WAVE_LIFE;
        const cell = cellOf(project(wave));
        put(cell.col, cell.row, fade < 0.75 ? "~" : "-", fade < 0.2 ? BONE : fade < 0.5 ? ASH : DIM);
      }

      for (const ripple of state.ripples) {
        const radius = rippleRadius(ripple);
        if (radius === null) continue;
        const center = project(ripple);
        const fade = ripple.age / ripple.life;
        const tone = fade < 0.3 ? BONE : fade < 0.65 ? ASH : DIM;
        traceRing(center, radius, cellW, cellH, (col, row, char) => put(col, row, char, tone));
      }

      // Islands cover the water, wake and ripples beneath them. Those nearer the viewer than
      // the boat also hide it, so their cells are kept to paint again over it.
      const front: { col: number; row: number; char: string }[] = [];
      if (state.islandSeed !== null) {
        const margin = 400;
        const hullY = state.boat.y + HULL_CENTRE_Y;
        const visible = islandsAround(
          state.islandSeed,
          camera.x - margin,
          (camera.y - margin) / TILT,
          camera.x + width + margin,
          (camera.y + height + margin) / TILT,
        );
        for (const island of visible) {
          const sprite = ISLAND_SPRITES[island.kind];
          const at = cellOf(project(island));
          const left = at.col - sprite.anchor[0];
          const top = at.row - sprite.anchor[1];
          sprite.rows.forEach((line, r) => {
            const first = line.search(/\S/);
            if (first < 0) return;
            for (let c = first; c < line.trimEnd().length; c++) {
              put(left + c, top + r, line[c], line[c] === " " ? 0 : ASH);
              if (island.y > hullY) front.push({ col: left + c, row: top + r, char: line[c] });
            }
          });
        }
      }

      const boat = project(state.boat);

      if (state.dest) {
        const mark = cellOf(project(state.dest));
        put(mark.col, mark.row, "x", ASH);
      }

      const line = state.line;
      const lure = lurePosition(state);
      if (line && lure) {
        const tip = { x: boat.x, y: boat.y - cellH * 2 };
        const end = project(lure.at);
        end.y -= lure.lift;
        const a = cellOf(tip);
        const b = cellOf(end);
        const char = lineChar(end.x - tip.x, end.y - tip.y);
        // One character per row for a slanted line, per column for a flat one, so it
        // stays a single thin stroke whatever its angle.
        const steps = char === "-" ? Math.abs(b.col - a.col) : Math.abs(b.row - a.row);
        for (let i = 1; i < steps; i++) {
          const f = i / steps;
          put(Math.round(a.col + (b.col - a.col) * f), Math.round(a.row + (b.row - a.row) * f), char, ASH);
        }
        if (line.phase === "reeling") {
          put(b.col - 1, b.row, "[", BONE);
          put(b.col, b.row, HAUL, BONE);
          put(b.col + 1, b.row, "]", BONE);
        } else if (line.phase === "bite") {
          // The bobber ducks under and comes back up a few times.
          const under = Math.floor(line.t / 0.12) % 2 === 1;
          put(b.col, b.row, under ? WATER_DOT : BOBBER_BITE, BONE);
          put(b.col, b.row - 1, BITE_MARK, BONE);
        } else {
          put(b.col, b.row, LURE, BONE);
        }
      } else if (pointer.overWater && pointer.mouse) {
        const aim = cellOf(project(castLanding(state, toWorld(pointer.x, pointer.y))));
        put(aim.col, aim.row, AIM, ASH);
      }

      for (let tone = DIM; tone <= BONE; tone++) {
        ctx!.fillStyle = colors[tone];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (tones[i] !== tone) continue;
            ctx!.fillText(
              String.fromCharCode(chars[i]),
              (col0 + c + 0.5) * cellW - camera.x,
              (row0 + r + 0.5) * cellH - camera.y,
            );
          }
        }
      }

      // The boat sits on top of the water at its exact position, not snapped to a cell. Like an
      // island, each row is solid from its first to its last character, so nothing shows through the hull.
      const sprite = BOAT_SPRITES[state.heading];
      const bx = boat.x - camera.x;
      const by = boat.y - camera.y;
      ctx!.fillStyle = colors[BONE];
      for (let r = 0; r < sprite.length; r++) {
        const y = by + (r - (sprite.length - 1)) * cellH;
        const first = sprite[r].search(/\S/);
        if (first < 0) continue;
        const last = sprite[r].trimEnd().length - 1;
        const x = (c: number) => bx + (c - (sprite[r].length - 1) / 2) * cellW;
        ctx!.clearRect(x(first) - cellW / 2, y - cellH / 2, (last - first + 1) * cellW, cellH);
        for (let c = first; c <= last; c++) {
          if (sprite[r][c] !== " ") ctx!.fillText(sprite[r][c], x(c), y);
        }
      }

      // An island nearer the viewer hides the part of the boat behind it.
      if (front.length > 0) {
        const width = Math.max(...sprite.map((line) => line.length)) * cellW;
        const box = { left: bx - width / 2, right: bx + width / 2, top: by - (sprite.length - 0.5) * cellH, bottom: by + cellH / 2 };
        ctx!.fillStyle = colors[ASH];
        for (const cell of front) {
          const x = (cell.col + 0.5) * cellW - camera.x;
          const y = (cell.row + 0.5) * cellH - camera.y;
          if (x + cellW / 2 <= box.left || x - cellW / 2 >= box.right) continue;
          if (y + cellH / 2 <= box.top || y - cellH / 2 >= box.bottom) continue;
          ctx!.clearRect(x - cellW / 2, y - cellH / 2, cellW, cellH);
          if (cell.char !== " ") ctx!.fillText(cell.char, x, y);
        }
      }
    }

    function tick(now: number) {
      frame = 0;
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      for (const event of step(state, dt, { reducedMotion })) {
        if (event === "caught") latest.current.onHaul();
      }
      const cameraMoving = follow(dt);
      draw();
      if (isActive(state) || cameraMoving) requestFrame();
      else lastTime = 0;
    }

    function requestFrame() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function throwLure(clientX: number, clientY: number) {
      if (!cast(state, toWorld(clientX, clientY), Math.random)) return;
      latest.current.onAction();
      requestFrame();
    }

    function sailTo(clientX: number, clientY: number) {
      moveTo(state, toWorld(clientX, clientY));
      latest.current.onAction();
      requestFrame();
    }

    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onPointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if (event.pointerType === "mouse" && event.button === 2) {
        canvas.setPointerCapture(event.pointerId);
        sailTo(event.clientX, event.clientY);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      const wasOverWater = pointer.overWater;
      pointer.overWater = event.target === canvas;
      pointer.mouse = event.pointerType === "mouse";
      // Holding the right button down keeps steering, as in League.
      if (pointer.mouse && pointer.overWater && event.buttons & 2) sailTo(event.clientX, event.clientY);
      // Otherwise only the aim mark changes, and only over the water.
      else if (pointer.overWater || wasOverWater) requestFrame();
    };
    const onPointerLeave = () => {
      pointer.overWater = false;
      requestFrame();
    };
    const onClick = (event: MouseEvent) => {
      if (lastPointerType === "mouse") latest.current.onAction();
      else if (latest.current.touchMode === "cast") throwLure(event.clientX, event.clientY);
      else sailTo(event.clientX, event.clientY);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "q" || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]") || latest.current.keysBlocked) return;
      if (pointer.known) throwLure(pointer.x, pointer.y);
    };

    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // A single ring around the boat on arrival, so the water reads as water.
    if (!reducedMotion) state.ripples.push({ x: 0, y: 0, age: -0.6, life: 2.2, maxR: 110 });
    resize();
    // The web font decides the cell width; measure again once it has loaded.
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      measure();
      requestFrame();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-0 h-full w-full" />;
}
