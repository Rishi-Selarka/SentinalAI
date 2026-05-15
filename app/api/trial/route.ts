import { runTrial } from "@/lib/jury/orchestrator";
import { makeEmitter } from "@/lib/jury/emit";
import type { TrialRequest } from "@/lib/jury/types";
import type { Domain } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 300; // generous; Vercel will cap to plan limits

const ALLOWED_DOMAINS: Domain[] = ["software", "engineering", "mixed", "finance"];

export async function POST(req: Request) {
  let body: TrialRequest;
  try {
    body = (await req.json()) as TrialRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const prompt = (body.prompt ?? "").trim();
  const domain: Domain = ALLOWED_DOMAINS.includes(body.domain) ? body.domain : "mixed";
  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = makeEmitter(controller);
      try {
        await runTrial({ prompt, domain, emit });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "trial:error", message });
        emit({ type: "trial:end" });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
