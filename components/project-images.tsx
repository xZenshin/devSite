"use client";

import Image from "next/image";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import type { SiteImage } from "@/lib/site";

/*
 * Layout of the stacked carousel, in fractions of the stage width. Every size
 * scales with that width, so it is all known before the page loads: no
 * measuring and no layout shift. Phones get a taller stage, with the arrows
 * below it instead of beside it.
 */
interface Layout {
  /** Tallest a front image may be. */
  maxHeight: number;
  /** Widest a front image may be, leaving room for the cards behind it. */
  maxWidth: number;
  /** How far a card behind sticks out past the edge of the front one. */
  peek: number;
}
const NARROW: Layout = { maxHeight: 1.05, maxWidth: 0.74, peek: 0.07 };
const WIDE: Layout = { maxHeight: 9 / 16, maxWidth: 0.62, peek: 0.08 };
const SIDE_SCALE = 0.8;
/** A card behind is never wider than this share of the front one, so it can't show on the far side. */
const SIDE_FIT = 0.85;

/**
 * Screenshots or diagrams under a project's header. Each frame takes the shape
 * of its image, so nothing is letterboxed or cropped. With several images, one
 * sits in front and its neighbours peek out behind it; the arrows, arrow keys
 * or a click on a card behind rotate them.
 */
export function ProjectImages({ images }: { images: SiteImage[] }) {
  if (images.length === 1) return <SingleImage image={images[0]} />;
  return <ImageCarousel images={images} />;
}

function SingleImage({ image }: { image: SiteImage }) {
  return (
    <figure className="scroll-reveal border-b border-line py-12">
      <div
        className="relative mx-auto max-w-4xl overflow-hidden border border-line"
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
      >
        <Image src={image.src} alt={image.alt} fill sizes="(min-width: 960px) 896px, 100vw" className="object-cover" />
      </div>
      {image.caption && (
        <figcaption className="mx-auto mt-4 max-w-4xl font-mono text-[13px] text-ash">{image.caption}</figcaption>
      )}
    </figure>
  );
}

function ImageCarousel({ images }: { images: SiteImage[] }) {
  const [active, setActive] = useState(0);
  const count = images.length;
  const go = (step: number) => setActive((current) => (current + step + count) % count);
  const front = images[active];

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "ArrowRight") go(1);
    else return;
    event.preventDefault();
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Project images"
      onKeyDown={handleKeyDown}
      className="scroll-reveal border-b border-line py-12"
    >
      <div className="relative aspect-(--stage) md:aspect-(--stage-md)" style={stageStyle(images)}>
        {images.map((image, i) => {
          const offset = slotOf(i, active, count);
          return (
            <div
              key={image.src}
              aria-hidden={offset !== 0}
              onClick={offset === 0 ? undefined : () => setActive(i)}
              className={`absolute top-1/2 left-(--x) w-(--w) -translate-1/2 scale-(--s) overflow-hidden border border-line bg-panel transition-[left,scale,opacity,filter] duration-700 ease-out-expo motion-reduce:transition-none md:left-(--x-md) md:w-(--w-md) md:scale-(--s-md) ${
                offset === 0 ? "" : "cursor-pointer"
              }`}
              style={cardStyle(image, front, offset)}
            >
              <Image
                src={image.src}
                alt={offset === 0 ? image.alt : ""}
                fill
                sizes="(min-width: 1152px) 680px, (min-width: 768px) 62vw, 74vw"
                priority={i === 0}
                className="object-cover"
              />
            </div>
          );
        })}

        <ArrowButton direction="previous" onClick={() => go(-1)} className="absolute top-1/2 left-0 -translate-y-1/2 max-md:hidden" />
        <ArrowButton direction="next" onClick={() => go(1)} className="absolute top-1/2 right-0 -translate-y-1/2 max-md:hidden" />
      </div>

      <div className="mt-6 flex items-center gap-4 font-mono text-[13px] text-ash">
        <ArrowButton direction="previous" onClick={() => go(-1)} className="shrink-0 md:hidden" />
        <p aria-live="polite" className="flex-1">
          {front.caption ?? front.alt}
        </p>
        <p aria-hidden="true" className="shrink-0 tabular-nums max-md:hidden">
          {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </p>
        <ArrowButton direction="next" onClick={() => go(1)} className="shrink-0 md:hidden" />
      </div>
    </section>
  );
}

/** -1 behind on the left, 0 in front, 1 behind on the right, null out of view. */
function slotOf(index: number, active: number, count: number): Slot {
  const distance = (index - active + count) % count;
  if (distance === 0) return 0;
  if (distance === 1) return 1;
  if (distance === count - 1) return -1;
  return null;
}

type Slot = -1 | 0 | 1 | null;

/** Width of an image in front, as a share of the stage width. */
function frontWidth(image: SiteImage, layout: Layout): number {
  return Math.min(layout.maxWidth, layout.maxHeight * (image.width / image.height));
}

/** The stage is as tall as the tallest image in front, so wide screenshots get no empty band. */
function stageStyle(images: SiteImage[]): CSSProperties {
  const ratio = (layout: Layout) =>
    `1 / ${Math.max(...images.map((image) => (frontWidth(image, layout) * image.height) / image.width))}`;
  return { "--stage": ratio(NARROW), "--stage-md": ratio(WIDE) } as CSSProperties;
}

/** Position, width and scale for both layouts, as CSS variables the classes pick from. */
function cardStyle(image: SiteImage, front: SiteImage, slot: Slot): CSSProperties {
  const place = (layout: Layout) => {
    const width = frontWidth(image, layout);
    const sideScale = Math.min(SIDE_SCALE, (SIDE_FIT * frontWidth(front, layout)) / width);
    // A card behind is centred so its outer edge lands `peek` past the front card's edge.
    const shift = slot ? frontWidth(front, layout) / 2 + layout.peek - (sideScale * width) / 2 : 0;
    return {
      width: `${width * 100}%`,
      left: `${(0.5 + (slot ?? 0) * shift) * 100}%`,
      scale: slot === 0 ? "1" : slot === null ? String(sideScale * 0.8) : String(sideScale),
    };
  };
  const narrow = place(NARROW);
  const wide = place(WIDE);
  return {
    aspectRatio: `${image.width} / ${image.height}`,
    zIndex: slot === 0 ? 3 : slot === null ? 1 : 2,
    opacity: slot === null ? 0 : 1,
    filter: slot === 0 ? undefined : "brightness(0.4) grayscale(0.4)",
    "--w": narrow.width,
    "--x": narrow.left,
    "--s": narrow.scale,
    "--w-md": wide.width,
    "--x-md": wide.left,
    "--s-md": wide.scale,
  } as CSSProperties;
}

function ArrowButton({
  direction,
  onClick,
  className,
}: {
  direction: "previous" | "next";
  onClick: () => void;
  className: string;
}) {
  const next = direction === "next";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={next ? "Next image" : "Previous image"}
      className={`z-10 flex size-11 items-center justify-center border border-line bg-black/80 text-ash transition-colors hover:border-ash hover:text-bone ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d={next ? "M2 8h12M9 3l5 5-5 5" : "M14 8H2M7 3 2 8l5 5"} />
      </svg>
    </button>
  );
}
