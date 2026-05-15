import OpenAI from "openai";

export type AgentId =
  | "generator"
  | "critic"
  | "factChecker"
  | "codeExecutor"
  | "math"
  | "standards"
  | "aggregator";

export type Domain = "software" | "engineering" | "mixed" | "finance";

export const MODELS = {
  generator: "anthropic/claude-sonnet-4.5",
  critic: "openai/gpt-4o",
  factChecker: "perplexity/sonar",
  codeExecutor: "deepseek/deepseek-chat",
  math: "deepseek/deepseek-chat",
  standards: "anthropic/claude-haiku-4.5",
  aggregator: "openai/gpt-4o-mini",
} as const satisfies Record<AgentId, string>;

// Low-latency model set used when `fast: true` is passed (the repo
// analyzer reviews many files sequentially, so speed matters more than
// the deepest possible reasoning). Web-search fact-checking is swapped
// for a quick reasoner since it adds little to per-file code review.
export const FAST_MODELS = {
  generator: "anthropic/claude-haiku-4.5",
  critic: "openai/gpt-4o-mini",
  factChecker: "openai/gpt-4o-mini",
  codeExecutor: "deepseek/deepseek-chat",
  math: "deepseek/deepseek-chat",
  standards: "anthropic/claude-haiku-4.5",
  aggregator: "openai/gpt-4o-mini",
} as const satisfies Record<AgentId, string>;

function resolveModel(agent: AgentId, explicit?: string, fast?: boolean): string {
  if (explicit) return explicit;
  return (fast ? FAST_MODELS : MODELS)[agent];
}

const baseURL = "https://openrouter.ai/api/v1";

function client() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-or-v1-...")) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured. Set it in .env.local."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      "HTTP-Referer":
        process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "SentinelAI",
    },
  });
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function* streamChat(opts: {
  agent: AgentId;
  messages: ChatMessage[];
  model?: string;
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string, void, unknown> {
  const model = resolveModel(opts.agent, opts.model, opts.fast);
  const stream = await client().chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 1500,
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function chat(opts: {
  agent: AgentId;
  messages: ChatMessage[];
  model?: string;
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const model = resolveModel(opts.agent, opts.model, opts.fast);
  const res = await client().chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1500,
    response_format: opts.responseFormat,
  });
  return res.choices[0]?.message?.content ?? "";
}

export function safeJson<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) return fallback;
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
