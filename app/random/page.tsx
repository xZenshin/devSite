import type { Metadata } from "next";
import { ApheliosRotation } from "@/components/aphelios-rotation";
import { PageHeader } from "@/components/page-view";

export const metadata: Metadata = {
  title: "Random stuff",
  description: "Small things Alexander built for fun, like an Aphelios gun rotation trainer.",
};

/**
 * Side projects that aren't portfolio content: built in code rather than
 * /content, so the assistant doesn't answer from them.
 */
export default function RandomPage() {
  return (
    <article className="pt-32 sm:pt-40">
      <PageHeader label="random" title="Random stuff" summary="Small things I've built for fun, away from work." />

      <section
        id="aphelios"
        aria-labelledby="aphelios-heading"
        className="page-section scroll-reveal grid gap-x-8 gap-y-3 border-b border-line py-12 md:grid-cols-[10rem_1fr]"
      >
        <p aria-hidden="true" className="font-mono text-[13px] text-ash">
          01
        </p>
        <div className="min-w-0">
          <div className="max-w-[68ch]">
            <h2
              id="aphelios-heading"
              className="text-[clamp(1.6rem,3.2vw,2.5rem)] leading-tight font-medium tracking-tight-2"
            >
              Aphelios gun rotation
            </h2>
            <div className="content">
              <p>
                Aphelios, a League of Legends champion, carries five guns but holds only two at a time. When one runs
                out of ammo, the next gun in the queue takes its hand and the empty one goes to the back. He starts
                with green and red in hand, then purple, blue and white.
              </p>
              <p>
                Which gun you empty decides which pairs you get, and some pairs work far better together than others,
                like red and blue. Empty guns to see what comes next, or pick a goal pair and practise reaching it in
                as few empties as possible.
              </p>
            </div>
          </div>
          <div className="mt-10">
            <ApheliosRotation />
          </div>
        </div>
      </section>
    </article>
  );
}
