import type { ReactNode } from "react";
import type { SitePage } from "@/lib/site";
import { RevealLines } from "./reveal-lines";
import { Markdown } from "./markdown";

/**
 * A content page: a large title from frontmatter, then one anchored section
 * per ## heading, numbered in page order.
 */
export function PageView({ page, label }: { page: SitePage; label: ReactNode }) {
  return (
    <article className="pt-32 sm:pt-40">
      <header className="border-b border-line pb-12">
        <p className="fade-in font-mono text-[13px] text-ash" style={{ "--delay": "50ms" } as React.CSSProperties}>
          <span aria-hidden="true">{"// "}</span>
          {label}
        </p>
        <RevealLines
          lines={[page.title]}
          className="mt-5 text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.9] font-medium tracking-display"
        />
        {page.summary && (
          <p
            className="fade-in mt-8 max-w-[52ch] text-lg leading-relaxed text-ash sm:text-xl"
            style={{ "--delay": "400ms" } as React.CSSProperties}
          >
            {page.summary}
          </p>
        )}
        {page.period && (
          <p className="fade-in mt-4 font-mono text-[13px] text-ash" style={{ "--delay": "500ms" } as React.CSSProperties}>
            {page.period}
          </p>
        )}
      </header>

      <div>
        {page.sections.map((section, i) => (
          <section
            key={section.id}
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
        ))}
      </div>
    </article>
  );
}
