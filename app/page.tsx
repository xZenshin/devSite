import Link from "next/link";
import { AskHero } from "@/components/chat/ask-hero";
import { RevealLines } from "@/components/reveal-lines";
import { getSite, projectPages } from "@/lib/site";

export default async function Home() {
  const projects = projectPages(await getSite());

  return (
    <>
      <section aria-labelledby="intro" className="flex min-h-[100svh] flex-col justify-center pt-28 pb-16">
        <p className="fade-in font-mono text-[13px] text-ash" style={{ "--delay": "50ms" } as React.CSSProperties}>
          <span aria-hidden="true">~/</span>software developer, copenhagen
        </p>
        <RevealLines
          lines={["Alexander", "Skou-Larsen"]}
          className="mt-6 text-[clamp(3.2rem,12vw,10.5rem)] leading-[0.88] font-medium tracking-display"
        />
        <p
          className="fade-in mt-8 max-w-[46ch] text-lg leading-relaxed text-ash sm:text-xl"
          style={{ "--delay": "450ms" } as React.CSSProperties}
        >
          MSc in Computer Science, building across software engineering, data and AI. Ask the assistant anything
          about my work; every answer links to its source.
        </p>
        <div className="fade-in mt-12" style={{ "--delay": "650ms" } as React.CSSProperties}>
          <AskHero />
        </div>
        <a
          href="#projects"
          className="fade-in mt-16 flex w-fit items-center gap-3 font-mono text-[12px] text-ash transition-colors hover:text-bone"
          style={{ "--delay": "900ms" } as React.CSSProperties}
        >
          <span className="relative block h-10 w-px overflow-hidden bg-line">
            <span className="scroll-line absolute inset-0 bg-bone" />
          </span>
          scroll
        </a>
      </section>

      <section id="projects" aria-labelledby="projects-heading" className="scroll-reveal scroll-mt-20 pt-16">
        <div className="flex items-baseline justify-between border-b border-line pb-4 font-mono text-[13px] text-ash">
          <h2 id="projects-heading">
            <span aria-hidden="true">{"// "}</span>projects
          </h2>
          <span aria-hidden="true">{String(projects.length).padStart(2, "0")}</span>
        </div>
        <ol>
          {projects.map((project, i) => (
            <li key={project.url} className="border-b border-line">
              <Link href={project.url} className="group relative block overflow-hidden">
                {/* The white fill sweeps in on hover; the text inverts above it. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-left scale-x-0 bg-bone transition-transform duration-500 ease-in-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
                />
                <span className="relative grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 px-1 py-7 transition-colors duration-300 group-hover:text-black group-focus-visible:text-black sm:grid-cols-[4rem_1fr_auto] sm:py-9">
                  <span className="font-mono text-[13px] text-ash transition-colors group-hover:text-black/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block text-[clamp(1.6rem,4.2vw,3.25rem)] leading-tight font-medium tracking-tight-2">
                      {project.title}
                    </span>
                    {project.summary && (
                      <span className="mt-2 block max-w-[60ch] text-ash transition-colors group-hover:text-black/70">
                        {project.summary}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4 font-mono text-[13px] text-ash transition-colors group-hover:text-black">
                    {project.period}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-5 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
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
        <p className="mt-10 font-mono text-[13px] text-ash">
          more in the{" "}
          <Link href="/cv" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
            cv
          </Link>{" "}
          and{" "}
          <Link href="/about" className="text-bone underline decoration-dim underline-offset-4 hover:decoration-bone">
            quick facts
          </Link>
        </p>
      </section>
    </>
  );
}
