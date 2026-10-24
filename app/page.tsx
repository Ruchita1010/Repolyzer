"use client";
// app/page.tsx
import { useState } from "react";
import Post from "../components/Post";
import type { Mode, Result } from "../lib/types";

const EXAMPLES = ["expressjs/express", "tj/commander.js", "sindresorhus/got"];

export default function Home() {
  const [repo, setRepo] = useState("");
  const [loading, setLoading] = useState<Mode | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [mode, setMode] = useState<Mode>("blog");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(m: Mode) {
    setError("");
    setResult(null);
    setLog([]);
    setMode(m);
    setLoading(m);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, mode: m }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      if (!res.body) throw new Error("No response from the server.");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l);
          if (ev.type === "status") setLog((p) => [...p, ev.message]);
          else if (ev.type === "result") setResult(ev.data);
          else if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Request failed.");
    } finally {
      setLoading(null);
    }
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${result.info.name.replace("/", "-")}-${mode}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const busy = loading !== null;
  const canRun = repo.trim().length > 2 && !busy;

  return (
    <main className="min-h-screen bg-amber-100 px-4 py-12 text-stone-950">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-amber-950">Repolyzer</h1>
          <p className="mt-3 text-stone-800">
            Paste a public GitHub repo. Gemma reads the commits and writes a report or a blog post, with diagrams, charts and code cards.
          </p>
        </header>

        <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
          <label htmlFor="repo" className="mb-2 block text-sm font-medium text-stone-300">
            GitHub repository
          </label>
          <input
            id="repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canRun && run("blog")}
            placeholder="https://github.com/owner/name  or  owner/name"
            className="w-full rounded-lg border border-stone-700 bg-amber-100 px-4 py-3 text-stone-950 placeholder-stone-500 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-400">
            Try:
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setRepo(ex)}
                className="rounded-full border border-stone-700 px-3 py-1 hover:border-stone-500 hover:text-stone-200"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => run("report")}
              disabled={!canRun}
              className="flex-1 rounded-lg border bg-amber-600 px-5 py-3 font-semibold text-stone-100 hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading === "report" ? "Generating report…" : "Generate report"}
            </button>
            <button
              onClick={() => run("blog")}
              disabled={!canRun}
              className="flex-1 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-stone-100 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading === "blog" ? "Writing blog…" : "Generate blog"}
            </button>
          </div>
        </section>

        {(busy || log.length > 0) && (
          <ul className="mt-6 space-y-1.5 text-sm text-stone-700" aria-live="polite">
            {log.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={i === log.length - 1 && busy ? "text-orange-400" : "text-emerald-400"}>
                  {i === log.length - 1 && busy ? "●" : "✓"}
                </span>
                {l}
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {result && (
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-end gap-2 text-sm">
              <button onClick={copy} className="rounded-lg border border-stone-700 px-3 py-1.5 bg-amber-500 hover:bg-amber-600">
                {copied ? "Copied!" : "Copy Markdown"}
              </button>
              <button onClick={download} className="rounded-lg border border-stone-700 px-3 py-1.5 bg-amber-500 hover:bg-amber-600">
                Download .md
              </button>
            </div>
            <Post result={result} />
          </section>
        )}
      </div>
    </main>
  );
}
