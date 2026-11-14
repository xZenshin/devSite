import { AskHero } from "@/components/chat/ask-hero";
import { LakeGame } from "@/components/lake/lake-game";
import { RevealLines } from "@/components/reveal-lines";
import { buildCatches } from "@/lib/catches";
import { getSite } from "@/lib/site";

export default async function Home() {
  const catches = buildCatches(await getSite());

  return (
    <LakeGame catches={catches}>
      <p className="fade-in font-mono text-[13px] text-ash" style={{ "--delay": "50ms" } as React.CSSProperties}>
        <span aria-hidden="true">~/</span>software developer, copenhagen
      </p>
      <RevealLines
        lines={["Alexander", "Skou-Larsen"]}
        className="mt-4 text-[clamp(2rem,3.6vw,3.25rem)] leading-[0.92] font-medium tracking-display"
      />
      <p
        className="fade-in mt-5 max-w-[36ch] leading-relaxed text-ash"
        style={{ "--delay": "450ms" } as React.CSSProperties}
      >
        MSc in Computer Science, building across software engineering, data and AI. Ask the assistant about my work,
        or fish for it.
      </p>
      {/* The overlay lets clicks through to the water; the ask box takes them back. */}
      <div className="fade-in pointer-events-auto mt-7 max-w-md" style={{ "--delay": "650ms" } as React.CSSProperties}>
        <AskHero />
      </div>
    </LakeGame>
  );
}
