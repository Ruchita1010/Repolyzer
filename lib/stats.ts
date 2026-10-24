// lib/stats.ts
// All numbers shown in charts are computed here, in code, never by the LLM.
import type { Stats } from "./types";

type C = { date: string | null; author: string };

function weekStart(d: Date): number {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x.getTime();
}

const WEEK = 7 * 24 * 3600 * 1000;

export function computeStats(commits: C[]): Stats {
  const dated = commits.filter((c) => c.date && !isNaN(Date.parse(c.date)));
  const times = dated.map((c) => Date.parse(c.date!));

  // weekly buckets (fill gaps, cap at the last 20 weeks)
  const buckets = new Map<number, number>();
  for (const t of times) {
    const k = weekStart(new Date(t));
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  let labels: string[] = [];
  let values: number[] = [];
  if (buckets.size) {
    const keys = [...buckets.keys()];
    const min = Math.min(...keys);
    const max = Math.max(...keys);
    for (let k = min; k <= max; k += WEEK) {
      labels.push(
        new Date(k).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      );
      values.push(buckets.get(k) ?? 0);
    }
    if (labels.length > 20) {
      labels = labels.slice(-20);
      values = values.slice(-20);
    }
  }

  // top authors
  const byAuthor = new Map<string, number>();
  for (const c of commits) byAuthor.set(c.author, (byAuthor.get(c.author) ?? 0) + 1);
  const top = [...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return {
    total: commits.length,
    first: times.length ? new Date(Math.min(...times)).toISOString() : null,
    last: times.length ? new Date(Math.max(...times)).toISOString() : null,
    weekly: { labels, values },
    authors: { labels: top.map((t) => t[0]), values: top.map((t) => t[1]) },
  };
}
