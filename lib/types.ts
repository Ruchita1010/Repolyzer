// lib/types.ts
export type Mode = "report" | "blog";

export type Stats = {
  total: number;
  first: string | null;
  last: string | null;
  weekly: { labels: string[]; values: number[] };
  authors: { labels: string[]; values: number[] };
};

export type DiffInfo = { file: string; patch: string; msg: string };

export type RepoInfo = {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  url: string;
  defaultBranch: string;
};

export type Result = {
  markdown: string;
  stats: Stats;
  diffs: Record<string, DiffInfo>;
  info: RepoInfo;
};
