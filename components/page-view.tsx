import { Fragment, type ReactNode } from "react";
import type { SitePage } from "@/lib/site";
import { RevealLines } from "./reveal-lines";
import { Markdown } from "./markdown";
import { ProjectImages } from "./project-images";

/**
 * A content page: a large title from frontmatter, then one anchored section
 * per ## heading, numbered in page order. Project images follow the first
 * section (the Summary), so visitors read what the project is before seeing it.
 */
export function PageView({ page, label }: { page: SitePage; label: ReactNode }) {
  const images = page.images.length > 0 && <ProjectImages images={page.images} />;
  return (
    <article className="pt-32 sm:pt-40">
      <PageHeader
        label={label}
        title={page.title}
        summary={page.summary}
        period={[page.period, page.solo && "solo project"].filter(Boolean).join(" · ")}
      />
      {page.sections.length === 0 && images}

      <div>
        {page.sections.map((section, i) => (
          <Fragment key={section.id}>
            <section
              id={section.anchor}
              className="page-section scroll-reveal grid gap-x-8 gap-y-3 border-b border-line py-12 md:grid-cols-[10rem_1fr]"
            >
              <p aria-hidden="true" className="font-mono text-[13px] text-ash">
                {String(i + 1).padStart(2, "0")}
              </p>
              <div className="max-w-[68ch]">
                <h2 className="text-[clamp(1.6rem,3.2vw,2.5rem)] leading-tight font-medium tracking-tight-2">
                  {section.heading}
                </h2>
                <Markdown>{section.text}</Markdown>
              </div>
            </section>
            {i === 0 && images}
          </Fragment>
        ))}
      </div>
    </article>
  );
}

/** A page's label, large title and optional summary and period. */
export function PageHeader({
  label,
  title,
  summary,
  period,
}: {
  label: ReactNode;
  title: string;
  summary?: string;
  period?: string;
}) {
  return (
    <header className="border-b border-line pb-12">
      <p className="fade-in font-mono text-[13px] text-ash" style={{ "--delay": "50ms" } as React.CSSProperties}>
        <span aria-hidden="true">{"// "}</span>
        {label}
      </p>
      <RevealLines
        lines={[title]}
        className="mt-5 text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.9] font-medium tracking-display"
      />
      {summary && (
        <p
          className="fade-in mt-8 max-w-[52ch] text-lg leading-relaxed text-ash sm:text-xl"
          style={{ "--delay": "400ms" } as React.CSSProperties}
        >
          {summary}
        </p>
      )}
      {period && (
        <p className="fade-in mt-4 font-mono text-[13px] text-ash" style={{ "--delay": "500ms" } as React.CSSProperties}>
          {period}
        </p>
      )}
    </header>
  );
}
