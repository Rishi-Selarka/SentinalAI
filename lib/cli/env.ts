import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function findProjectRoot(startUrl: string): string {
  let dir = dirname(fileURLToPath(startUrl));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function loadEnv(metaUrl: string): { loaded: string[]; root: string } {
  const root = findProjectRoot(metaUrl);
  const candidates = [".env.local", ".env"];
  const loaded: string[] = [];

  for (const name of candidates) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    loaded.push(name);
  }

  return { loaded, root };
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.startsWith("sk-or-v1-...") || value.startsWith("e2b_...")) {
    throw new Error(
      `${key} is not configured. Set it in .env.local at the project root.`
    );
  }
  return value;
}
