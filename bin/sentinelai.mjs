#!/usr/bin/env node
// Launcher: pins tsx to the project's tsconfig so the `@/*` path alias
// resolves no matter which directory `sentinelai` is invoked from.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const entry = join(here, "sentinelai.ts");
const tsconfig = join(root, "tsconfig.json");

const res = spawnSync(
  "npx",
  ["--yes", "tsx", "--tsconfig", tsconfig, entry, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfig },
  }
);

process.exit(res.status ?? 1);
