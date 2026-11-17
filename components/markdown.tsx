import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders content Markdown; internal links use client-side navigation. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = "", children }) =>
            href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href}>{children}</a>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
