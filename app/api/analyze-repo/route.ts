import { runTrial } from "@/lib/jury/orchestrator";
import type { AgentEvent } from "@/lib/jury/types";
import type { Domain } from "@/lib/openrouter";
import {
  FetcherError,
  fetchFileContent,
  fetchRepoSummary,
  fetchRepoTree,
  parseRepoUrl,
  type RepoFile,
  type RepoFileContent,
  type RepoSummary,
} from "@/lib/github/fetcher";

export const runtime = "nodejs";
export const maxDuration = 300;

type RepoRequest = {
  url?: string;
  branch?: string;
  domain?: Domain;
};

type RepoEvent =
  | { type: "repo:start"; summary: RepoSummary; files: RepoFile[] }
  | { type: "file:start"; index: number; total: number; file: RepoFile }
  | { type: "file:trial"; event: AgentEvent }
  | {
      type: "file:end";
      index: number;
      file: RepoFile;
      label?: "TRUSTED" | "REVISED" | "HALLUCINATION";
      score?: number;
      issueCount: { high: number; med: number; low: number };
      codeExecutorFailed: boolean;
      standardsFailed: boolean;
    }
  | { type: "repo:complete"; filesAnalyzed: number; cleanFiles: number; buggyFiles: number }
  | { type: "repo:error"; message: string };

function encode(event: RepoEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function buildReviewPrompt(file: RepoFileContent): string {
  const quoteInstruction = file.runnable
    ? `1. First, repeat the entire file verbatim inside a fenced \`\`\`${file.lang}\`\`\` block so the sandbox can re-execute it.
2. Then list every bug you find. For each: line number(s), severity (low/med/high), what's wrong, and why.
3. End with a one-line summary: clean, minor issues, or serious bugs.`
    : `1. List every bug you find. For each: line number(s), severity (low/med/high), what's wrong, and why.
2. End with a one-line summary: clean, minor issues, or serious bugs.`;

  return `You are reviewing the file \`${file.path}\` (${file.langName}) for bugs, errors, security issues, and obvious correctness problems.

${quoteInstruction}

Be precise — false positives waste reviewer time. If the file is fine, say so plainly.

File contents:

\`\`\`${file.lang}
${file.content}
\`\`\`
`;
}

export async function POST(req: Request) {
  let body: RepoRequest;
  try {
    body = (await req.json()) as RepoRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const url = (body.url ?? "").trim();
  if (!url) {
    return new Response(JSON.stringify({ error: "url is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const ALLOWED_DOMAINS: Domain[] = ["software", "engineering", "mixed", "finance"];
  const domain: Domain = ALLOWED_DOMAINS.includes(body.domain as Domain)
    ? (body.domain as Domain)
    : "software";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: RepoEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encode(event));
        } catch {
          closed = true;
        }
      };

      try {
        const id = parseRepoUrl(url);
        if (body.branch) id.ref = body.branch;
        const summary = await fetchRepoSummary(id);
        const files = await fetchRepoTree(summary);

        if (!files.length) {
          send({
            type: "repo:error",
            message: "no reviewable code files found in repo (after filters)",
          });
          send({ type: "repo:complete", filesAnalyzed: 0, cleanFiles: 0, buggyFiles: 0 });
          return;
        }

        send({ type: "repo:start", summary, files });

        let cleanCount = 0;
        let buggyCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          send({ type: "file:start", index: i, total: files.length, file });

          let content: RepoFileContent;
          try {
            content = await fetchFileContent(summary, file);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send({
              type: "file:trial",
              event: { type: "trial:error", message: `fetch failed: ${message}` },
            });
            send({
              type: "file:end",
              index: i,
              file,
              issueCount: { high: 0, med: 0, low: 0 },
              codeExecutorFailed: false,
              standardsFailed: false,
            });
            continue;
          }

          const issueCount = { high: 0, med: 0, low: 0 };
          let codeExecutorFailed = false;
          let standardsFailed = false;
          let label: "TRUSTED" | "REVISED" | "HALLUCINATION" | undefined;
          let score: number | undefined;

          const emit = (event: AgentEvent) => {
            try {
              if (event.type === "agent:verdict") {
                if (event.agent === "codeExecutor" && event.verdict.verdict === "fail") {
                  codeExecutorFailed = true;
                }
                if (event.agent === "standards" && event.verdict.verdict === "fail") {
                  standardsFailed = true;
                }
                for (const issue of event.verdict.issues) {
                  const sev = issue.severity;
                  if (sev === "high" || sev === "med" || sev === "low") issueCount[sev]++;
                }
              }
              if (event.type === "jury:final") {
                label = event.label;
                score = event.score;
              }
            } catch {
              /* never let tracking errors abort the trial */
            }
            send({ type: "file:trial", event });
          };

          try {
            await runTrial({
              prompt: buildReviewPrompt(content),
              domain,
              emit,
              fast: true,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            send({ type: "file:trial", event: { type: "trial:error", message } });
            send({ type: "file:trial", event: { type: "trial:end" } });
          }

          const hasBugs =
            codeExecutorFailed || standardsFailed || issueCount.high + issueCount.med + issueCount.low > 0;
          if (hasBugs) buggyCount++;
          else cleanCount++;

          send({
            type: "file:end",
            index: i,
            file,
            label,
            score,
            issueCount,
            codeExecutorFailed,
            standardsFailed,
          });
        }

        send({
          type: "repo:complete",
          filesAnalyzed: files.length,
          cleanFiles: cleanCount,
          buggyFiles: buggyCount,
        });
      } catch (err) {
        const message =
          err instanceof FetcherError
            ? err.message
            : err instanceof Error
            ? err.message
            : String(err);
        send({ type: "repo:error", message });
      } finally {
        closed = true;
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
