import type { SitePage } from "@/lib/site";
import { Markdown } from "./markdown";

/** A content page: header from frontmatter, then one anchored section per ## heading. */
export function PageView({ page }: { page: SitePage }) {
  return (
    <article>
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{page.title}</h1>
        {page.summary && <p className="mt-4 text-xl leading-relaxed text-ink-muted">{page.summary}</p>}
        {page.period && <p className="mt-2 text-ink-muted">{page.period}</p>}
      </header>
      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.id} id={section.anchor} className="page-section">
            <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
            <Markdown>{section.text}</Markdown>
          </section>
        ))}
      </div>
    </article>
  );
}
