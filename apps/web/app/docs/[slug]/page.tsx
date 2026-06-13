import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, ArrowRight } from "lucide-react";
import { getDocArticle, getAllDocSlugs } from "@/lib/docs-content";
import React from "react";

const CATEGORY_HEADER: Record<string, string> = {
  Compliance: "bg-rose-400/20 text-rose-200",
  Developer: "bg-white/20 text-white/80",
};

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return { title: "Not Found" };
  return {
    title: `${article.title} | 24Therapy Docs`,
    description: `${article.category} — ${article.readTime} read`,
  };
}

function inlineRender(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns: Array<{ regex: RegExp; render: (m: RegExpMatchArray) => React.ReactNode }> = [
    {
      regex: /\*\*(.+?)\*\*/,
      render: (m) => (
        <strong key={key++} className="font-semibold text-slate-800">
          {m[1]}
        </strong>
      ),
    },
    {
      regex: /`([^`]+)`/,
      render: (m) => (
        <code key={key++} className="bg-slate-100 text-[#0A2342] px-1.5 py-0.5 rounded text-xs font-mono">
          {m[1]}
        </code>
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <Link key={key++} href={m[2]} className="text-[#2EC4B6] hover:underline">
          {m[1]}
        </Link>
      ),
    },
  ];

  while (remaining.length > 0) {
    let first: { index: number; match: RegExpMatchArray; render: (m: RegExpMatchArray) => React.ReactNode } | null = null;
    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && m.index !== undefined && (first === null || m.index < first.index)) {
        first = { index: m.index, match: m, render: p.render };
      }
    }
    if (!first) {
      parts.push(remaining);
      break;
    }
    if (first.index > 0) parts.push(remaining.slice(0, first.index));
    parts.push(first.render(first.match));
    remaining = remaining.slice(first.index + first.match[0].length);
  }

  return <>{parts}</>;
}

function renderBody(body: string): React.ReactNode {
  const lines = body.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push(
        <pre key={k++} className="bg-[#071A33] text-slate-200 rounded-xl p-5 overflow-x-auto text-xs leading-relaxed my-5 font-mono">
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={k++} className="text-xl font-bold text-[#0A2342] mt-10 mb-3 pb-2 border-b border-slate-100">
          {inlineRender(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      out.push(
        <h3 key={k++} className="text-base font-semibold text-[#0A2342] mt-6 mb-2">
          {inlineRender(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line === "---") {
      out.push(<hr key={k++} className="border-slate-200 my-8" />);
      i++;
      continue;
    }

    // Table (lines starting with |)
    if (line.startsWith("|")) {
      const tLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tLines.push(lines[i]);
        i++;
      }
      const dataRows = tLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()));
      if (dataRows.length > 0) {
        const headers = dataRows[0].split("|").filter(Boolean).map((c) => c.trim());
        out.push(
          <div key={k++} className="overflow-x-auto my-5 rounded-xl border border-slate-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {headers.map((cell, j) => (
                    <th key={j} className="px-4 py-3 text-left font-semibold text-[#0A2342] text-xs border-b border-slate-200">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(1).map((row, ri) => (
                  <tr key={ri} className="even:bg-slate-50/60">
                    {row.split("|").filter(Boolean).map((cell, j) => (
                      <td key={j} className="px-4 py-3 text-slate-600 text-xs">
                        {inlineRender(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Checkbox list: - [ ] or - [x]
    if (/^- \[[ x]\] /.test(line)) {
      const items: Array<{ checked: boolean; text: string }> = [];
      while (i < lines.length && /^- \[[ x]\] /.test(lines[i])) {
        items.push({ checked: lines[i].startsWith("- [x]"), text: lines[i].slice(6) });
        i++;
      }
      out.push(
        <ul key={k++} className="space-y-2.5 my-4">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
              <span
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] font-bold ${
                  item.checked ? "bg-[#2EC4B6] border-[#2EC4B6] text-white" : "border-slate-300 text-transparent"
                }`}
              >
                ✓
              </span>
              {inlineRender(item.text)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Bullet list
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <ul key={k++} className="space-y-2 my-4">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#2EC4B6] flex-shrink-0" />
              {inlineRender(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      out.push(
        <ol key={k++} className="space-y-2 my-4">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0A2342] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              {inlineRender(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    out.push(
      <p key={k++} className="text-slate-600 text-sm leading-relaxed my-3">
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return <>{out}</>;
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return notFound();

  const categoryBadge = CATEGORY_HEADER[article.category] ?? "bg-[#2EC4B6]/20 text-[#2EC4B6]";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] text-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Docs
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryBadge}`}>
              {article.category}
            </span>
            {article.status && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60 capitalize">
                {article.status}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
          <div className="flex items-center gap-1.5 text-white/50 text-sm">
            <Clock className="w-3.5 h-3.5" />
            <span>{article.readTime} read</span>
          </div>
        </div>
      </header>

      {/* Article body */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article>{renderBody(article.body)}</article>

        <div className="mt-14 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#0A2342] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All documentation
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-sm text-[#2EC4B6] hover:underline"
          >
            Need help? Contact support
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
