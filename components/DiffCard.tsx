"use client";
// components/DiffCard.tsx
import { useRef } from "react";
import { exportPng } from "./exportPng";
import type { DiffInfo } from "../lib/types";

export default function DiffCard({ sha, diff }: { sha: string; diff: DiffInfo }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = diff.patch.split("\n").slice(0, 28);

  return (
    <figure className="my-6">
      <div ref={ref} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs">
          <span className="truncate font-mono font-semibold text-stone-700">{diff.file}</span>
          <span className="shrink-0 font-mono text-stone-500">{sha}</span>
        </div>
        <div className="overflow-x-auto py-2 font-mono text-xs leading-5">
          {lines.map((l, i) => {
            const cls = l.startsWith("+")
              ? "bg-green-50 text-green-800"
              : l.startsWith("-")
              ? "bg-red-50 text-red-800"
              : l.startsWith("@@")
              ? "text-stone-400"
              : "text-stone-600";
            return (
              <div key={i} className={`whitespace-pre px-4 ${cls}`}>
                {l || " "}
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-2 flex items-center justify-between text-xs text-stone-500">
        <span className="truncate">{diff.msg}</span>
        <button
          onClick={() => exportPng(ref.current, `diff-${sha}.png`)}
          className="ml-3 shrink-0 rounded px-2 py-1 text-orange-600 hover:bg-orange-50"
        >
          Save as image
        </button>
      </figcaption>
    </figure>
  );
}
