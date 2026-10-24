// POST { repo: "owner/name" | url, mode: "report" | "blog" }
// Streams newline-delimited JSON: {type:"status"|"result"|"error", ...}
import { NextRequest, NextResponse } from "next/server";
import { parseRepo } from "../../../lib/github";
import { generate } from "../../../lib/agent";

// export const runtime = "nodejs";
export const maxDuration = 300;

function friendly(err: any): string {
  const status = err?.status;
  if (status === 404) return "Repository not found, or it is private. Only public repos work for now.";
  if (status === 403) return "GitHub rate limit or permission error. Check that GITHUB_TOKEN is set in .env.local.";
  if (status === 429) return "Gemini API quota or rate limit reached. Wait a minute and try again.";
  if (status === 400 && /model/i.test(err?.message ?? "")) {
    return "The Gemma model name was rejected. Set GEMMA_MODEL in .env.local to the exact ID shown in Google AI Studio.";
  }
  return err?.message ?? "Something went wrong.";
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const mode = body?.mode === "report" ? "report" : body?.mode === "blog" ? "blog" : null;
  if (!mode || typeof body?.repo !== "string") {
    return NextResponse.json({ error: "Send { repo, mode: 'report' | 'blog' }." }, { status: 400 });
  }

  let parsed: { owner: string; repo: string };
  try {
    parsed = parseRepo(body.repo);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const data = await generate({ ...parsed, mode }, (message) => send({ type: "status", message }));
        send({ type: "result", data });
      } catch (err: any) {
        send({ type: "error", message: friendly(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
