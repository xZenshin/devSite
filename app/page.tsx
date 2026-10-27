import Link from "next/link";
import { AskHero } from "@/components/chat/ask-hero";
import { getSite, projectPages } from "@/lib/site";

export default async function Home() {
  const projects = projectPages(await getSite());

  return (
    <div className="space-y-16">
      <section aria-labelledby="intro">
        <h1 id="intro" className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Alexander Skou-Larsen
        </h1>
        <p className="mt-5 max-w-2xl text-xl leading-relaxed text-ink-muted">
          Software developer in Copenhagen. MSc in Computer Science, with a background in software engineering and
          AI/ML.
        </p>
      </section>

      <AskHero />

      <section id="projects" aria-labelledby="projects-heading" className="scroll-mt-6">
        <h2 id="projects-heading" className="text-2xl font-semibold tracking-tight">
          Projects
        </h2>
        <ul className="mt-4 divide-y divide-mist border-y border-mist">
          {projects.map((project) => (
            <li key={project.url}>
              <Link href={project.url} className="group block py-5">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-lg font-semibold group-hover:text-spruce group-hover:underline group-hover:underline-offset-4">
                    {project.title}
                  </span>
                  {project.period && <span className="shrink-0 text-sm text-ink-muted">{project.period}</span>}
                </span>
                {project.summary && <span className="mt-1 block text-ink-muted">{project.summary}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-ink-muted">
          More in the{" "}
          <Link href="/cv" className="text-spruce underline underline-offset-2">
            CV
          </Link>{" "}
          and{" "}
          <Link href="/about" className="text-spruce underline underline-offset-2">
            quick facts
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
