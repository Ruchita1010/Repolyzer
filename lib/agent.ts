// lib/agent.ts
// Phase 1: Gemma researches the repo with tools (get_diff, read_file).
// Phase 2: Gemma writes the report/blog using those notes + code-computed stats.
import { GoogleGenAI, Type } from "@google/genai";
import { getRepoInfo, getCommits, getDiff, readFile, getTree, getReadme } from "./github";
import { computeStats } from "./stats";
import type { DiffInfo, Mode, Result } from "./types";

type Notify = (msg: string) => void;

const MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

const tools: any[] = [
  {
    functionDeclarations: [
      {
        name: "get_diff",
        description: "Get the changed files and patches of one commit. Use the 7-character sha from the commit list.",
        parameters: {
          type: Type.OBJECT,
          properties: { sha: { type: Type.STRING, description: "7-character commit sha" } },
          required: ["sha"],
        },
      },
      {
        name: "read_file",
        description: "Read a text file from the repository's default branch.",
        parameters: {
          type: Type.OBJECT,
          properties: { path: { type: Type.STRING, description: "File path, e.g. src/index.ts" } },
          required: ["path"],
        },
      },
    ],
  },
];

const RESEARCH_INSTRUCTIONS = `You are a senior engineer analysing a GitHub repository's recent history.
Your job in this step is RESEARCH ONLY.

1. Group the commits into 3-5 themes (e.g. "auth rewrite", "performance fixes").
2. Call the get_diff tool on the 3-5 most important commits to understand what really changed. Call read_file only if you truly need a file.
3. When finished, reply with ONLY a JSON object (no prose) shaped like:
{"themes":[{"title":"...","summary":"...","shas":["abc1234"]}],
 "highlights":[{"sha":"abc1234","why":"..."}],
 "architecture":"10-20 sentences on how the project is structured, based on the file tree and README"}
Only use shas that appear in the commit list. Do not invent facts.`;

async function research(
  ai: GoogleGenAI,
  context: string,
  owner: string,
  repo: string,
  msgBySha: Map<string, string>,
  diffs: Record<string, DiffInfo>,
  notify: Notify
): Promise<string> {
  const contents: any[] = [{ role: "user", parts: [{ text: `${RESEARCH_INSTRUCTIONS}\n\n${context}` }] }];

  for (let i = 0; i < 6; i++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: { tools, temperature: 0.3 },
    });
    const calls = res.functionCalls;
    if (!calls || !calls.length) return res.text ?? "";

    contents.push(res.candidates![0].content);
    const parts: any[] = [];
    for (const fc of calls.slice(0, 3)) {
      let output: any;
      try {
        if (fc.name === "get_diff") {
          const sha = String((fc.args as any)?.sha ?? "").slice(0, 7);
          notify(`Reading diff of commit ${sha}…`);
          const files = await getDiff(owner, repo, sha);
          const best = [...files].filter((f) => f.patch).sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))[0];
          if (best) diffs[sha] = { file: best.file, patch: best.patch, msg: msgBySha.get(sha) ?? "" };
          output = { files };
        } else if (fc.name === "read_file") {
          const path = String((fc.args as any)?.path ?? "");
          notify(`Reading ${path}…`);
          output = { content: await readFile(owner, repo, path) };
        } else {
          output = { error: `Unknown tool ${fc.name}` };
        }
      } catch (e: any) {
        output = { error: e?.message ?? "tool failed" };
      }
      parts.push({ functionResponse: { name: fc.name, response: { output } } });
    }
    contents.push({ role: "user", parts });
  }

  // Out of tool rounds: ask for the final notes without tools.
  contents.push({ role: "user", parts: [{ text: "Stop using tools. Output the final JSON notes now." }] });
  const final = await ai.models.generateContent({ model: MODEL, contents, config: { temperature: 0.3 } });
  return final.text ?? "";
}

function writerPrompt(mode: Mode, shas: string[], statsFacts: string): string {
  const diffTokens = shas.length
    ? `{{diff:${shas[0]}}}${shas[1] ? ` and {{diff:${shas[1]}}}` : ""} (only these shas are valid: ${shas.join(", ")})`
    : "none available, do not use diff tokens";

  const common = `RULES
- Output Markdown only. No tables. Do not wrap the whole answer in a code fence.
- Be accurate: use only the commit list, notes and stats provided. Never invent features, numbers or quotes.
- Refer to specific commits with their 7-char sha in backticks, e.g. \`abc1234\`.
- Visuals are placeholders that the app renders. Put each one on its own line:
  {{chart:weekly}}   -> bar chart of commits per week
  {{chart:authors}}  -> bar chart of top contributors
  diff cards: ${diffTokens}
- Include exactly ONE Mermaid diagram in a \`\`\`mermaid fence. Use "flowchart TD", simple ids like A, B, C, and put every label in double quotes, e.g. A["API layer"] --> B["Database"]. Base it on the file tree and architecture notes. Max 8 nodes.
- Before each visual, write a sentence that introduces it.`;

  if (mode === "blog") {
    return `Write an engaging developer blog post about the recent development of this repository, for a technical audience.
Structure: a catchy "# Title", a short hook intro, 3-5 "##" sections that tell the story of what changed and why it matters (group by theme), one section on challenges or interesting decisions, and a short conclusion on what's next.
Tone: warm, clear, concrete; no hype or filler. Aim for 700-1000 words.
Use these visuals: the Mermaid diagram, 1-2 diff cards, and 1-2 charts.

${common}

${statsFacts}`;
  }
  return `Write a concise engineering REPORT on the recent development of this repository.
Use exactly these "##" sections after a "# Title" line:
## Overview (what the project is, 3-4 sentences, then the key numbers)
## Tech Stack
## Activity (line chart of weekly contributions, stars, forks, and list  high priority issues, recent changes)
## Architecture (include the Mermaid diagram, LLD and HLD)
## Bird's eye view of major components: services, modules, layers, and how they interconnect.
## Data Flow
## Major changes in the history like refactors, changing tech stack and it's effect on the overall codebase
## Potential bugs, risks (things that look unfinished or risky, only if the evidence supports it)
## Security Audit
## Suggested features, improvements, etc
Tone: neutral and scannable.

${common}

${statsFacts}`;
}

function clean(md: string, diffs: Record<string, DiffInfo>): string {
  let out = md.trim();
  const fenced = out.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fenced) out = fenced[1];
  return out
    .split("\n")
    .filter((line) => {
      const m = line.trim().match(/^\{\{(chart|diff):([\w-]+)\}\}$/);
      if (!m) return true;
      if (m[1] === "chart") return m[2] === "weekly" || m[2] === "authors";
      return !!diffs[m[2]];
    })
    .join("\n");
}

export async function generate(
  input: { owner: string; repo: string; mode: Mode },
  notify: Notify
): Promise<Result> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  const ai = new GoogleGenAI({ apiKey });
  const { owner, repo, mode } = input;

  notify("Fetching repository info…");
  const info = await getRepoInfo(owner, repo);

  notify("Fetching commits, file tree and README…");
  const [commits, tree, readme] = await Promise.all([
    getCommits(owner, repo, 80),
    getTree(owner, repo, info.defaultBranch).catch(() => [] as string[]),
    getReadme(owner, repo).catch(() => ""),
  ]);
  if (!commits.length) throw new Error("No usable commits found in this repository.");

  const stats = computeStats(commits);
  const msgBySha = new Map(commits.map((c) => [c.sha, c.msg]));

  const commitList = commits
    .slice(0, 60)
    .map((c) => `${c.sha} | ${c.date?.slice(0, 10) ?? "?"} | ${c.author} | ${c.msg}`)
    .join("\n");
  const context = `REPOSITORY: ${info.name}
DESCRIPTION: ${info.description ?? "n/a"}
LANGUAGE: ${info.language ?? "n/a"}

README (excerpt):
${readme || "n/a"}

FILE TREE (top levels):
${tree.join("\n") || "n/a"}

COMMITS (sha | date | author | message), newest first:
${commitList}`;

  notify(`Found ${commits.length} commits. Gemma is researching…`);
  const diffs: Record<string, DiffInfo> = {};
  let notes = "";
  try {
    notes = await research(ai, context, owner, repo, msgBySha, diffs, notify);
  } catch (e: any) {
    notify("Tool use failed, continuing with commit messages only.");
  }

  notify(mode === "blog" ? "Writing the blog post…" : "Writing the report…");
  const statsFacts = `FACTS COMPUTED BY CODE (trust these exactly):
- Commits analysed: ${stats.total}
- Date range: ${stats.first?.slice(0, 10) ?? "?"} to ${stats.last?.slice(0, 10) ?? "?"}
- Top contributors: ${stats.authors.labels.map((l, i) => `${l} (${stats.authors.values[i]})`).join(", ")}
- Stars: ${info.stars}, language: ${info.language ?? "n/a"}`;

  const prompt = `${writerPrompt(mode, Object.keys(diffs).slice(0, 2), statsFacts)}

${context}

RESEARCH NOTES (JSON, may be empty):
${notes || "none"}`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.7, maxOutputTokens: 6000 },
  });
  const markdown = clean(res.text ?? "", diffs);
  if (!markdown) throw new Error("The model returned an empty response. Try again.");

  notify("Done.");
  return { markdown, stats, diffs, info };
}
