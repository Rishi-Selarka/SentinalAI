// Server-side GitHub repo fetcher. Uses unauthenticated REST API (rate-limited
// to 60 req/hr per IP). Public repos only.

const LANG_BY_EXT: Record<string, { lang: string; name: string; runnable?: boolean }> = {
  ".py": { lang: "python", name: "Python", runnable: true },
  ".js": { lang: "javascript", name: "JavaScript" },
  ".mjs": { lang: "javascript", name: "JavaScript" },
  ".cjs": { lang: "javascript", name: "JavaScript" },
  ".ts": { lang: "typescript", name: "TypeScript" },
  ".tsx": { lang: "tsx", name: "TypeScript JSX" },
  ".jsx": { lang: "jsx", name: "JavaScript JSX" },
  ".go": { lang: "go", name: "Go" },
  ".rs": { lang: "rust", name: "Rust" },
  ".java": { lang: "java", name: "Java" },
  ".rb": { lang: "ruby", name: "Ruby" },
  ".php": { lang: "php", name: "PHP" },
  ".c": { lang: "c", name: "C" },
  ".cpp": { lang: "cpp", name: "C++" },
  ".cs": { lang: "csharp", name: "C#" },
  ".swift": { lang: "swift", name: "Swift" },
  ".sh": { lang: "bash", name: "Shell" },
  ".sql": { lang: "sql", name: "SQL" },
};

const SKIP_DIR_PARTS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".venv", "venv",
  "__pycache__", ".pytest_cache", ".turbo", "coverage", ".cache",
  "vendor", "target", ".idea", ".vscode", "out",
]);

const SKIP_BASENAMES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  "poetry.lock", "Gemfile.lock", "uv.lock",
]);

export type RepoIdentifier = {
  owner: string;
  repo: string;
  ref?: string;
};

export type RepoFile = {
  path: string;
  size: number;
  lang: string;
  langName: string;
  runnable: boolean;
};

export type RepoFileContent = RepoFile & { content: string };

export type RepoSummary = {
  owner: string;
  repo: string;
  ref: string;
  defaultBranch: string;
  htmlUrl: string;
  description?: string;
};

const GITHUB_API = "https://api.github.com";
const MAX_FILE_BYTES = 50 * 1024;
// Analyze the whole repo. This is only a safety ceiling so a pathological
// monorepo can't spawn thousands of trials; files are interest-sorted so
// the most important ones are reviewed first if the time budget runs out.
const MAX_FILES = 300;

export class FetcherError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

export function parseRepoUrl(input: string): RepoIdentifier {
  const trimmed = input.trim();
  if (!trimmed) throw new FetcherError("empty repository URL");

  // Accept: owner/repo  |  github.com/owner/repo  |  https://github.com/owner/repo
  //         https://github.com/owner/repo.git  |  https://github.com/owner/repo/tree/<ref>
  let cleaned = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/^git@github\.com:/, "github.com/")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "");

  // Handle /tree/<ref>/...
  let ref: string | undefined;
  const treeIdx = cleaned.indexOf("/tree/");
  if (treeIdx !== -1) {
    const after = cleaned.slice(treeIdx + "/tree/".length);
    cleaned = cleaned.slice(0, treeIdx);
    ref = after.split("/")[0] || undefined;
  }

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new FetcherError(
      "expected owner/repo (e.g. 'pallets/flask' or a github.com URL)"
    );
  }
  return { owner: parts[0], repo: parts[1], ref };
}

async function githubJson<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "sentinelai-hackathon",
    },
  });
  if (res.status === 404) {
    throw new FetcherError("repository or path not found (public repos only)", 404);
  }
  if (res.status === 403) {
    const body = await res.text();
    throw new FetcherError(
      `github rate limit reached. ${body.includes("rate limit") ? "Wait an hour or set GITHUB_TOKEN." : ""}`,
      403
    );
  }
  if (!res.ok) {
    throw new FetcherError(`github API ${res.status}: ${await res.text()}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchRepoSummary(id: RepoIdentifier): Promise<RepoSummary> {
  type RepoMeta = {
    default_branch: string;
    html_url: string;
    description?: string | null;
  };
  const meta = await githubJson<RepoMeta>(`/repos/${id.owner}/${id.repo}`);
  return {
    owner: id.owner,
    repo: id.repo,
    ref: id.ref ?? meta.default_branch,
    defaultBranch: meta.default_branch,
    htmlUrl: meta.html_url,
    description: meta.description ?? undefined,
  };
}

function isSkipped(path: string): boolean {
  const parts = path.split("/");
  for (const part of parts) {
    if (SKIP_DIR_PARTS.has(part)) return true;
  }
  return SKIP_BASENAMES.has(parts[parts.length - 1]);
}

function detectLang(path: string): { lang: string; name: string; runnable: boolean } | null {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return null;
  const ext = path.slice(dot).toLowerCase();
  const hit = LANG_BY_EXT[ext];
  if (!hit) return null;
  return { lang: hit.lang, name: hit.name, runnable: !!hit.runnable };
}

// Heuristic interest score so we surface main/source files before tests/configs.
function interestScore(path: string): number {
  let score = 0;
  if (/\b(main|index|app|server|cli)\.[a-z]+$/i.test(path)) score += 30;
  if (/^src\//.test(path) || /^lib\//.test(path)) score += 10;
  if (/(^|\/)tests?\//i.test(path)) score -= 5;
  if (/\.test\./i.test(path)) score -= 5;
  if (/\.spec\./i.test(path)) score -= 5;
  if (/config|setup|tsconfig|webpack|babel/i.test(path)) score -= 8;
  return score;
}

export async function fetchRepoTree(summary: RepoSummary): Promise<RepoFile[]> {
  type TreeNode = { path: string; type: string; size?: number; sha: string };
  type TreeResp = { tree: TreeNode[]; truncated: boolean };
  const data = await githubJson<TreeResp>(
    `/repos/${summary.owner}/${summary.repo}/git/trees/${encodeURIComponent(summary.ref)}?recursive=1`
  );

  const all: (RepoFile & { score: number })[] = [];
  for (const node of data.tree) {
    if (node.type !== "blob") continue;
    if (isSkipped(node.path)) continue;
    const lang = detectLang(node.path);
    if (!lang) continue;
    const size = node.size ?? 0;
    if (size === 0 || size > MAX_FILE_BYTES) continue;
    all.push({
      path: node.path,
      size,
      lang: lang.lang,
      langName: lang.name,
      runnable: lang.runnable,
      score: interestScore(node.path) + Math.min(20, Math.log2(size + 1)),
    });
  }
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, MAX_FILES).map((f) => ({
    path: f.path,
    size: f.size,
    lang: f.lang,
    langName: f.langName,
    runnable: f.runnable,
  }));
}

export async function fetchFileContent(
  summary: RepoSummary,
  file: RepoFile
): Promise<RepoFileContent> {
  type ContentResp = { content: string; encoding: string; size: number };
  const data = await githubJson<ContentResp>(
    `/repos/${summary.owner}/${summary.repo}/contents/${file.path}?ref=${encodeURIComponent(summary.ref)}`
  );
  if (data.encoding !== "base64") {
    throw new FetcherError(`unsupported encoding ${data.encoding} for ${file.path}`, 500);
  }
  const buf = Buffer.from(data.content, "base64");
  if (buf.length > MAX_FILE_BYTES) {
    throw new FetcherError(`file too large after fetch: ${file.path}`, 413);
  }
  return { ...file, content: buf.toString("utf8") };
}
