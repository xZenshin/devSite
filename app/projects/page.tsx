import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-view";
import { buildCatches, type Catch } from "@/lib/catches";
import { getSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "Projects and experience",
  description: "Alexander Skou-Larsen's projects, jobs and education in one list.",
};

/** Everything the lake on the home page holds, as a plain list: the way past the fishing. */
export default async function ProjectsPage() {
  const catches = buildCatches(await getSite());
  const groups: { id: string; label: string; items: Catch[] }[] = [
    { id: "projects", label: "projects", items: catches.filter((c) => c.kind === "project") },
    { id: "experience", label: "experience", items: catches.filter((c) => c.kind === "experience") },
    { id: "education", label: "education", items: catches.filter((c) => c.kind === "education") },
  ].filter((group) => group.items.length > 0);

  return (
    <article className="pt-32 sm:pt-40">
      <PageHeader
        label="projects"
        title="Work"
        summary="Projects, jobs and education. The same things you can catch in the lake, without the fishing."
      />

      {groups.map((group) => (
        <section
          key={group.id}
          id={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="scroll-reveal scroll-mt-20 pt-16"
        >
          <div className="flex items-baseline justify-between border-b border-line pb-4 font-mono text-[13px] text-ash">
            <h2 id={`${group.id}-heading`}>
              <span aria-hidden="true">{"// "}</span>
              {group.label}
            </h2>
            <span aria-hidden="true">{String(group.items.length).padStart(2, "0")}</span>
          </div>
          <ol>
            {group.items.map((item, i) => (
              <li key={item.id} className="border-b border-line">
                <Link href={item.href} className="group relative block overflow-hidden">
                  {/* The white fill sweeps in on hover; the text inverts above it. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 origin-left scale-x-0 bg-bone transition-transform duration-500 ease-in-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  />
                  <span className="relative grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 px-1 py-7 transition-colors duration-300 group-hover:text-black group-focus-visible:text-black sm:grid-cols-[4rem_1fr_auto] sm:py-9">
                    <span className="font-mono text-[13px] text-ash transition-colors group-hover:text-black/60 group-focus-visible:text-black/60">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block text-[clamp(1.6rem,4.2vw,3.25rem)] leading-tight font-medium tracking-tight-2">
                        {item.title}
                      </span>
                      {item.org && (
                        <span className="mt-1 block font-mono text-[13px] text-ash transition-colors group-hover:text-black/70 group-focus-visible:text-black/70">
                          {item.org}
                        </span>
                      )}
                      {item.summary && (
                        <span className="mt-2 block max-w-[60ch] text-ash transition-colors group-hover:text-black/70 group-focus-visible:text-black/70">
                          {item.summary}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-4 font-mono text-[13px] text-ash transition-colors group-hover:text-black group-focus-visible:text-black">
                      {item.period}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="size-5 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="mt-10 font-mono text-[13px] text-ash">
        more in the{" "}
        <Link href="/cv" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
          cv
        </Link>{" "}
        and{" "}
        <Link href="/about" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
          quick facts
        </Link>
        , or{" "}
        <Link href="/" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
          go fishing
        </Link>
      </p>
    </article>
  );
}
