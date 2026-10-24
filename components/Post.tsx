"use client";
// components/Post.tsx
import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import MermaidBlock from "./MermaidBlock";
import ChartBlock from "./ChartBlock";
import DiffCard from "./DiffCard";
import { exportPng } from "./exportPng";
import type { Result } from "../lib/types";

type Seg = { t: "md"; text: string } | { t: "chart" | "diff"; key: string };

// Split markdown into plain-markdown chunks and {{chart:x}} / {{diff:sha}} tokens.
function split(md: string): Seg[] {
  const out: Seg[] = [];
  let buf: string[] = [];
  let inFence = false;
  const flush = () => {
    if (buf.join("").trim()) out.push({ t: "md", text: buf.join("\n") });
    buf = [];
  };
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("```")) inFence = !inFence;
    const m = !inFence ? line.trim().match(/^\{\{(chart|diff):([\w-]+)\}\}$/) : null;
    if (m) {
      flush();
      out.push({ t: m[1] as "chart" | "diff", key: m[2] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "?";

function HeroCard({ result }: { result: Result }) {
  const ref = useRef<HTMLDivElement>(null);
  const { info, stats } = result;
  let h = 0;
  for (const ch of info.name) h = (h * 31 + ch.charCodeAt(0)) % 360;

  return (
    <div className="mb-8">
      <div
        ref={ref}
        className="rounded-2xl p-8 text-stone"

      >
        <p className="text-xs font-semibold uppercase tracking-widest text-stone/70">GitHub project</p>
        <h2 className="mt-2 break-words text-3xl font-bold sm:text-4xl">{info.name}</h2>
        {info.description && <p className="mt-3 max-w-xl text-stone/85">{info.description}</p>}
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
          {info.language && <span className="rounded-full bg-white/15 px-3 py-1">{info.language}</span>}
          <span className="rounded-full bg-white/15 px-3 py-1">★ {info.stars.toLocaleString()}</span>
          <span className="rounded-full bg-white/15 px-3 py-1">{stats.total} commits analysed</span>
          <span className="rounded-full bg-white/15 px-3 py-1">
            {fmt(stats.first)} – {fmt(stats.last)}
          </span>
        </div>
      </div>
      <button
        onClick={() => exportPng(ref.current, `${info.name.replace("/", "-")}-cover.png`)}
        className="mt-2 rounded px-2 py-1 text-xs text-orange-600 hover:bg-orange-50"
      >
        Save cover image
      </button>
    </div>
  );
}

const mdComponents: any = {
  h1: (p: any) => <h1 className="mb-4 mt-2 text-3xl font-bold leading-tight text-stone-900" {...p} />,
  h2: (p: any) => <h2 className="mb-3 mt-10 text-2xl font-semibold text-stone-900" {...p} />,
  h3: (p: any) => <h3 className="mb-2 mt-6 text-lg font-semibold text-stone-900" {...p} />,
  p: (p: any) => <p className="my-4 leading-7" {...p} />,
  ul: (p: any) => <ul className="my-4 list-disc space-y-1 pl-6 leading-7" {...p} />,
  ol: (p: any) => <ol className="my-4 list-decimal space-y-1 pl-6 leading-7" {...p} />,
  a: (p: any) => <a className="text-orange-600 underline" target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p: any) => <blockquote className="my-4 border-l-4 border-stone-300 pl-4 italic text-stone-600" {...p} />,
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children }: any) => {
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    const text = String(children).replace(/\n$/, "");
    if (lang === "mermaid") return <MermaidBlock code={text} />;
    if (lang || text.includes("\n")) {
      return (
        <pre className="my-4 overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs leading-5 text-stone-100">
          <code>{text}</code>
        </pre>
      );
    }
    return <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.85em] text-stone-800">{text}</code>;
  },
};

export default function Post({ result }: { result: Result }) {
  const segs = split(result.markdown);
  return (
    <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 text-stone-700 shadow-xl sm:p-10">
      <HeroCard result={result} />
      {segs.map((s, i) => {
        if (s.t === "md") return <ReactMarkdown key={i} components={mdComponents}>{s.text}</ReactMarkdown>;
        if (s.t === "chart" && (s.key === "weekly" || s.key === "authors"))
          return <ChartBlock key={i} kind={s.key} stats={result.stats} />;
        if (s.t === "diff" && result.diffs[s.key]) return <DiffCard key={i} sha={s.key} diff={result.diffs[s.key]} />;
        return null;
      })}
    </article>
  );
}
