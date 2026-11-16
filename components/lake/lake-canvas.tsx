"use client";

import { useEffect, useRef } from "react";
import type { CatchKind } from "@/lib/catches";
import { bobberUnder, linePath, lureOnScreen, rod, traceLine } from "@/lib/lake/cast";
import {
  WAVE_LIFE,
  cast,
  castLanding,
  createGame,
  fishAt,
  isActive,
  moveTo,
  paddleFrame,
  rippleRadius,
  snapshot,
  step,
  stockShoals,
  type GameState,
  type Snapshot,
  type Stock,
} from "@/lib/lake/game";
import {
  AIM,
  ANGLER_SPRITES,
  BITE_MARK,
  BOAT_SPRITES,
  BOBBER_BITE,
  FISH_EAST,
  FISH_WEST,
  HAUL,
  LURE,
  WATER_DOT,
  lineChar,
} from "@/lib/lake/sprites";
import { surfaceAt, swayAt } from "@/lib/lake/surface";
import { ASH, BONE, DIM, glyphAt, shoreOffsetAt } from "@/lib/lake/texture";
import { project, traceRing, unproject, type Vec } from "@/lib/lake/world";
import { usePrefersReducedMotion } from "../use-media-query";

export type TouchMode = "move" | "cast";

interface LakeCanvasProps {
  /** The line came up with something on it: a fish from that shoal, or junk (null) from anywhere else. */
  onHaul: (shoal: CatchKind | null) => void;
  /** The visitor sailed, cast or clicked the water: whatever is showing can go away. */
  onAction: () => void;
  /** What a tap does on touch screens, which have no right-click or hover. */
  touchMode: TouchMode;
  /** Keys are ignored while something else (the chat) has the visitor's attention. */
  keysBlocked: boolean;
  /** How much of each kind is left to catch: that many fish swim in its shoal. */
  stock: Stock;
}

const FONT_PX = 14;
/** Brightness steps a character can have; the index is stored per cell. */
const TONES = ["--dim", "--ash", "--bone"] as const;
/** The lake's texture is worked out once per square of this many cells a side, then kept. */
const CHUNK = 32;
/** What a kept cell is, besides its tone (the lowest two bits): on or above the water, a reed, or water. */
const SOLID = 4;
const SWAY = 8;
const WATER = 16;
/** Milliseconds between pictures while only the water and the fish are moving. */
const DRIFT_MS = 100;
/** How far the kayak rises and falls on the water, in pixels, and how fast (radians per second). */
const BOB = 1;
const BOB_RATE = 1.4;
/** How many characters the rod is drawn with. */
const ROD_STROKES = 3;

/**
 * The lake and where the boat was, kept while the visitor reads the site's other
 * pages: coming back to the home page finds the same lake, the boat where it was
 * left. It lives as long as the page does, so a new visit (or a reload) is a new lake.
 */
let kept: Snapshot | null = null;

/** Where the boat rests on screen, as a share of the viewport. The catch card's CSS matches this. */
function anchorFor(width: number, height: number): Vec {
  return width >= 1024 ? { x: width * 0.64, y: height * 0.56 } : { x: width * 0.5, y: height * 0.7 };
}

/**
 * The lake: water, shore and fish drawn as monospace characters on a canvas.
 * Right-click sails the boat, Q throws the lure at the pointer. The picture is
 * redrawn every frame while the boat, the line or a ripple is moving; at rest,
 * while only the water stirs and the fish drift, ten times a second; and with
 * reduced motion not at all.
 */
export function LakeCanvas(props: LakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const restock = useRef<(() => void) | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const stockKey = JSON.stringify(props.stock);

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // A lake of a new shape on every visit; the same one again on coming back from another page.
    const state: GameState = createGame({
      seed: Math.floor(Math.random() * 2 ** 31),
      stock: latest.current.stock,
      resume: kept ?? undefined,
    });
    const camera = { x: 0, y: 0, placed: false };
    const pointer = { x: 0, y: 0, known: false, overWater: false, mouse: false };
    let width = 0;
    let height = 0;
    let cellW = FONT_PX * 0.6;
    const cellH = Math.round(FONT_PX * 1.25);
    let font = `${FONT_PX}px monospace`;
    let colors: string[] = [];
    let frame = 0;
    let drift = 0;
    let lastTime = 0;
    let lastPointerType = "mouse";

    // The lake's texture, kept per square of cells: it never changes, so it is only worked out once.
    // With it, what each cell is and, for water, how far it is from the shore.
    const scenery = new Map<string, { chars: Uint16Array; flags: Uint8Array; out: Float32Array }>();
    // One character and one tone per visible cell, rebuilt every frame, and what the cell is.
    let chars = new Uint16Array(0);
    let tones = new Uint8Array(0);
    let flags = new Uint8Array(0);
    let outs = new Float32Array(0);
    let cols = 0;
    let rows = 0;
    let col0 = 0;
    let row0 = 0;

    /** Draws a character in a cell, over whatever is there. */
    const put = (col: number, row: number, char: string, tone: number) => {
      const c = col - col0;
      const r = row - row0;
      if (c < 0 || r < 0 || c >= cols || r >= rows) return;
      chars[r * cols + c] = char.charCodeAt(0);
      tones[r * cols + c] = tone;
    };
    /** Draws a character in or on the water: it doesn't show under land, the jetty, rocks, reeds or lilies. */
    const float = (col: number, row: number, char: string, tone: number) => {
      const c = col - col0;
      const r = row - row0;
      if (c < 0 || r < 0 || c >= cols || r >= rows || flags[r * cols + c] & SOLID) return;
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
      const measured = ctx!.measureText("M").width || FONT_PX * 0.6;
      // The texture is laid out in cells; cells of another width make another picture.
      if (measured !== cellW) scenery.clear();
      cellW = measured;
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

    /** The texture of one square of cells. */
    function sceneryAt(chunkCol: number, chunkRow: number) {
      const key = `${chunkCol},${chunkRow}`;
      let chunk = scenery.get(key);
      if (!chunk) {
        const size = CHUNK * CHUNK;
        chunk = { chars: new Uint16Array(size), flags: new Uint8Array(size), out: new Float32Array(size) };
        for (let r = 0; r < CHUNK; r++) {
          for (let c = 0; c < CHUNK; c++) {
            const col = chunkCol * CHUNK + c;
            const row = chunkRow * CHUNK + r;
            const glyph = glyphAt(state.lake, col, row, cellW, cellH);
            const i = r * CHUNK + c;
            if (glyph?.solid) {
              chunk.chars[i] = glyph.char.charCodeAt(0);
              chunk.flags[i] = glyph.tone | SOLID | (glyph.sway ? SWAY : 0);
              continue;
            }
            if (glyph) chunk.chars[i] = glyph.char.charCodeAt(0);
            chunk.flags[i] = (glyph?.tone ?? 0) | WATER;
            chunk.out[i] = shoreOffsetAt(state.lake, col, row, cellW, cellH);
          }
        }
        scenery.set(key, chunk);
      }
      return chunk;
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
        flags = new Uint8Array(cols * rows);
        outs = new Float32Array(cols * rows);
      }

      // The lake itself: water, shore, jetty, rocks, reeds and lilies, copied from what is kept.
      const lastCol = col0 + cols - 1;
      const lastRow = row0 + rows - 1;
      for (let chunkRow = Math.floor(row0 / CHUNK); chunkRow * CHUNK <= lastRow; chunkRow++) {
        for (let chunkCol = Math.floor(col0 / CHUNK); chunkCol * CHUNK <= lastCol; chunkCol++) {
          const chunk = sceneryAt(chunkCol, chunkRow);
          const fromRow = Math.max(row0, chunkRow * CHUNK);
          const toRow = Math.min(lastRow, chunkRow * CHUNK + CHUNK - 1);
          const fromCol = Math.max(col0, chunkCol * CHUNK);
          const toCol = Math.min(lastCol, chunkCol * CHUNK + CHUNK - 1);
          for (let row = fromRow; row <= toRow; row++) {
            for (let col = fromCol; col <= toCol; col++) {
              const kept = (row - chunkRow * CHUNK) * CHUNK + (col - chunkCol * CHUNK);
              const i = (row - row0) * cols + (col - col0);
              chars[i] = chunk.chars[kept];
              tones[i] = chunk.flags[kept] & 3;
              flags[i] = chunk.flags[kept];
              outs[i] = chunk.out[kept];
            }
          }
        }
      }

      // The water stirs on top of its texture: wash at the shore, gusts, glints, and reeds bending.
      const seed = state.lake?.seed ?? 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (flags[i] & WATER) {
            const glyph = surfaceAt(seed, col0 + c, row0 + r, cellW, cellH, outs[i], state.time);
            if (glyph) {
              chars[i] = glyph.char.charCodeAt(0);
              tones[i] = glyph.tone;
            }
          } else if (flags[i] & SWAY) {
            const bent = swayAt(seed, col0 + c, row0 + r, cellW, cellH, state.time);
            if (bent) chars[i] = bent.charCodeAt(0);
          }
        }
      }

      // Fish are dim shapes under the surface: everything else on the water is drawn over them.
      state.shoals.forEach((shoal, s) => {
        for (const id of shoal.fish) {
          const fish = fishAt(state, s, id);
          const cell = cellOf(project(fish));
          const shape = fish.east ? FISH_EAST : FISH_WEST;
          for (let i = 0; i < shape.length; i++) float(cell.col + i - 1, cell.row, shape[i], DIM);
        }
      });

      // The wake: each wave starts bright and wavy, then dims and flattens as it dies down.
      for (const wave of state.waves) {
        const fade = wave.age / WAVE_LIFE;
        const cell = cellOf(project(wave));
        float(cell.col, cell.row, fade < 0.75 ? "~" : "-", fade < 0.2 ? BONE : fade < 0.5 ? ASH : DIM);
      }

      for (const ripple of state.ripples) {
        const radius = rippleRadius(ripple);
        if (radius === null) continue;
        const center = project(ripple);
        const fade = ripple.age / ripple.life;
        const tone = fade < 0.3 ? BONE : fade < 0.65 ? ASH : DIM;
        traceRing(center, radius, cellW, cellH, (col, row, char) => float(col, row, char, tone));
      }

      const boat = project(state.boat);

      if (state.dest) {
        const mark = cellOf(project(state.dest));
        put(mark.col, mark.row, "x", ASH);
      }

      const line = state.line;
      const lure = lureOnScreen(state);
      if (line && lure) {
        traceLine(linePath(state, reducedMotion), cellW, cellH, (col, row, char) => put(col, row, char, ASH));
        const b = cellOf(lure);
        if (line.phase === "reeling") {
          put(b.col - 1, b.row, "[", BONE);
          put(b.col, b.row, HAUL, BONE);
          put(b.col + 1, b.row, "]", BONE);
        } else if (line.phase === "bite") {
          // The bobber ducks under and comes back up a few times.
          put(b.col, b.row, bobberUnder(line) ? WATER_DOT : BOBBER_BITE, BONE);
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
            // 32 is a space: bare ground, with nothing to draw.
            if (tones[i] !== tone || chars[i] === 32) continue;
            ctx!.fillText(
              String.fromCharCode(chars[i]),
              (col0 + c + 0.5) * cellW - camera.x,
              (row0 + r + 0.5) * cellH - camera.y,
            );
          }
        }
      }

      // The boat sits on top of the water at its exact position, not snapped to a cell. Each row is
      // solid from its first to its last character, so nothing shows through the hull.
      // While a line is out the paddle is stowed, so the rod stands clear of it.
      const sprite = state.line ? ANGLER_SPRITES[state.heading] : BOAT_SPRITES[state.heading][paddleFrame(state)];
      const bx = boat.x - camera.x;
      // The kayak rides the water, rising and falling a little.
      const by = boat.y - camera.y + Math.sin(state.time * BOB_RATE) * BOB;
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

      // The rod, while a line is out: drawn over the boat, which it moves with, in short strokes along its
      // length. Nothing is cleared beneath it, so swung back over the shoulder it passes the head without hiding it.
      const held = rod(state);
      if (held) {
        const char = lineChar(held.tip.x - held.butt.x, held.tip.y - held.butt.y);
        const dy = by - (boat.y - camera.y);
        for (let k = 1; k <= ROD_STROKES; k++) {
          const px = held.butt.x + ((held.tip.x - held.butt.x) * k) / ROD_STROKES - camera.x;
          const py = held.butt.y + ((held.tip.y - held.butt.y) * k) / ROD_STROKES - camera.y + dy;
          ctx!.fillText(char, px, py);
        }
      }
    }

    function tick(now: number) {
      frame = 0;
      const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
      lastTime = now;
      for (const event of step(state, dt, { reducedMotion })) {
        if (event === "caught") latest.current.onHaul(state.caughtFrom);
      }
      const cameraMoving = follow(dt);
      draw();
      if (isActive(state) || cameraMoving) requestFrame();
      // Only the water and the fish are moving: a few pictures a second are enough for that.
      else if (!reducedMotion) drift = window.setTimeout(requestFrame, DRIFT_MS);
      else lastTime = 0;
    }

    function requestFrame() {
      window.clearTimeout(drift);
      drift = 0;
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

    // The basket changed (a catch, or everything released): the shoals follow.
    restock.current = () => {
      stockShoals(state, latest.current.stock);
      requestFrame();
    };

    // A single ring around the boat on arrival, so the water reads as water.
    if (!reducedMotion) state.ripples.push({ ...state.boat, age: -0.6, life: 2.2, maxR: 110 });
    resize();
    // The web font decides the cell width; measure again once it has loaded.
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      measure();
      requestFrame();
    });

    return () => {
      kept = snapshot(state);
      cancelled = true;
      restock.current = null;
      cancelAnimationFrame(frame);
      window.clearTimeout(drift);
      observer.disconnect();
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [reducedMotion]);

  useEffect(() => {
    restock.current?.();
  }, [stockKey]);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-0 h-full w-full" />;
}
