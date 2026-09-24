import { Fragment, ReactNode } from "react";

// A deliberately small markdown renderer for Full Set original articles —
// not a general-purpose parser. Original articles are written by us (see
// CONTRIBUTING-news.md's original-article section), so the format is
// controlled: paragraphs, "## " section headings, and *italic*/**bold**
// inline emphasis. Pulling in react-markdown + remark/rehype for this
// narrow a need would be a lot of bundle weight for a handful of tags this
// app already writes small custom parsers for elsewhere (see
// lib/lateMailParser.ts, lib/teamListDiff.ts).

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // **bold** before *italic* so "**x**" doesn't get eaten by the single-* pass.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function renderArticleMarkdown(markdown: string): ReactNode {
  const blocks = markdown.trim().split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="font-display font-black text-xl sm:text-2xl text-white tracking-tight mt-8 mb-3 first:mt-0">
              {renderInline(trimmed.slice(3), `h-${i}`)}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight mt-8 mb-3 first:mt-0">
              {renderInline(trimmed.slice(2), `h-${i}`)}
            </h1>
          );
        }
        return (
          <p key={i} className="text-white/80 text-[15.5px] leading-[1.7] mt-4 first:mt-0 [text-wrap:pretty]">
            {renderInline(trimmed, `p-${i}`)}
          </p>
        );
      })}
    </>
  );
}
