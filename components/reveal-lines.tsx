import type { ElementType } from "react";

/** Display text whose lines rise out of a mask one after another on page load. */
export function RevealLines({
  lines,
  as: Tag = "h1",
  className,
}: {
  lines: string[];
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="reveal-line">
          <span style={{ "--i": i } as React.CSSProperties}>
            {line}
            {/* Keeps a space between lines for screen readers. */}
            {i < lines.length - 1 && " "}
          </span>
        </span>
      ))}
    </Tag>
  );
}
