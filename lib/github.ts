// lib/github.ts
import { Octokit } from "@octokit/rest";

const gh = new Octokit({ auth: process.env.GITHUB_TOKEN });

const NOISE_MSG = /^(merge|bump|chore\(deps\)|update dependency)|dependabot|renovate/i;
const NOISE_FILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.|(^|\/)dist\/|(^|\/)node_modules\/|(^|\/)\.git\/)/;

export function parseRepo(input: string): { owner: string; repo: string } {
  // Accepts "owner/name" or "https://github.com/owner/name(.git)(/...)"
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repo. Use 'owner/name' or a full GitHub URL.");
  }
  return { owner, repo };
}

export async function getRepoInfo(owner: string, repo: string) {
  const { data } = await gh.repos.get({ owner, repo });
  return {
    name: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    defaultBranch: data.default_branch,
    url: data.html_url,
  };
}

export async function getCommits(owner: string, repo: string, n = 60) {
  const { data } = await gh.repos.listCommits({ owner, repo, per_page: Math.min(n, 100) });
  return data
    .filter((c) => !NOISE_MSG.test(c.commit.message))
    .map((c) => ({
      sha: c.sha.slice(0, 7),
      msg: c.commit.message.split("\n")[0],
      date: c.commit.author?.date ?? null,
      author: c.commit.author?.name ?? "unknown",
    }));
}

export async function getDiff(owner: string, repo: string, sha: string) {
  const { data } = await gh.repos.getCommit({ owner, repo, ref: sha });
  return (data.files ?? [])
    .filter((f) => !NOISE_FILE.test(f.filename))
    .slice(0, 8)
    .map((f) => ({
      file: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      patch: (f.patch ?? "").slice(0, 1500), // keep context small
    }));
}

export async function readFile(owner: string, repo: string, path: string) {
  const { data } = await gh.repos.getContent({ owner, repo, path });
  if (Array.isArray(data) || data.type !== "file") {
    return `"${path}" is not a file.`;
  }
  return Buffer.from(data.content, "base64").toString("utf8").slice(0, 6000);
}

export async function getReadme(owner: string, repo: string) {
  const { data } = await gh.repos.getReadme({ owner, repo });
  return Buffer.from(data.content, "base64").toString("utf8").slice(0, 3000);
}

// Top two levels of the file tree, used to draw architecture diagrams.
export async function getTree(owner: string, repo: string, branch: string) {
  const { data } = await gh.git.getTree({ owner, repo, tree_sha: branch, recursive: "true" });
  return data.tree
    .map((t) => t.path ?? "")
    .filter((p) => p && p.split("/").length <= 2 && !NOISE_FILE.test(p))
    .slice(0, 120);
}
