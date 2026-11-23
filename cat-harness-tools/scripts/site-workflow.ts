#!/usr/bin/env bun
/**
 * Run THIS repository's own publish or staging path — the command behind the
 * `pages-publish` and `feature-staging` Tools.
 *
 * @module scripts/site-workflow
 * @covers none — a dispatcher to a repository's own publish path, not an audit
 *
 * The Tools name the script key (`bun run cat site:workflow publish|stage`),
 * and the repository says what runs, in its own `index.config.json`:
 *
 * 1. `site.agentRun: true` — the agent path, `stage-local.ts`. `publish`
 *    builds the main site (`--main`), `stage` a preview of the branch. The
 *    repository's workflows are dispatch-only documentation there, and are
 *    never dispatched (the `feature-staging` skill, "Agent-run repositories").
 * 2. `site.workflows.publish` / `site.workflows.stage` — a workflow file under
 *    `.github/workflows/`, dispatched with `gh workflow run` on the branch.
 * 3. Neither — refused, naming what to declare. No file name is guessed.
 *
 * `--check` resolves without running anything; `check:tools` asks the same
 * question of every role a repository declares.
 *
 * Any other `--name value` pair is a workflow input, passed as
 * `-f name=value` with `-` read as `_` (`--cleanup-slug x` is the
 * `cleanup_slug` input of `feature-staging.yml`). The agent path takes none
 * of them, and refuses them rather than dropping them.
 *
 * Usage:
 *   bun run cat site:workflow <publish|stage> [--repo .] [--branch B] [--check]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { readIndexConfig } from "../schemas/kg/index-config.js";

export const SITE_ROLES = ["publish", "stage"] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

const STAGE_LOCAL = resolve(import.meta.dir, "stage-local.ts");

export type SiteRoute =
  | { kind: "agent-run"; argv: string[] }
  | { kind: "workflow"; file: string }
  | { kind: "missing"; file: string; why: string }
  | { kind: "undeclared"; why: string };

/** What runs `role` for the repository at `repo`, read from its own `index.config.json`. */
export function siteRoute(repo: string, role: SiteRole, branch?: string): SiteRoute {
  const r = readIndexConfig(resolve(repo));
  if (r.state === "absent") return { kind: "undeclared", why: `${r.file} does not exist` };
  if (r.state === "unreadable") return { kind: "undeclared", why: `${r.file} is ${r.why}` };
  const site = r.config.site;
  if (site?.agentRun === true) {
    const argv = ["bun", "run", STAGE_LOCAL, "--repo", repo];
    if (role === "publish") argv.push("--main");
    else if (branch) argv.push("--branch", branch);
    return { kind: "agent-run", argv };
  }
  const file = site?.workflows?.[role];
  if (file === undefined) {
    return { kind: "undeclared", why: `${r.file} declares neither site.agentRun nor site.workflows.${role}` };
  }
  const path = join(repo, ".github", "workflows", file);
  return existsSync(path) ? { kind: "workflow", file } : { kind: "missing", file, why: `site.workflows.${role} names ${file}, and there is no ${path}` };
}

/** `--name value` pairs other than the script's own, as workflow inputs (`name` with `-` as `_`). */
export function workflowInputs(args: readonly string[]): Record<string, string> {
  const own = new Set(["--repo", "--branch"]);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--check") continue;
    if (own.has(a)) {
      i++;
      continue;
    }
    if (a.startsWith("--") && i + 1 < args.length) {
      out[a.slice(2).replace(/-/g, "_")] = args[++i]!;
    }
  }
  return out;
}

/** Every role a repository DECLARES whose workflow file is missing. Undeclared roles are not findings. */
export function missingSiteWorkflows(repo: string): string[] {
  return SITE_ROLES.flatMap((role) => {
    const r = siteRoute(repo, role);
    return r.kind === "missing" ? [r.why] : [];
  });
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const role = process.argv[2] as SiteRole;
  if (!SITE_ROLES.includes(role)) {
    console.error(`usage: bun run cat site:workflow <${SITE_ROLES.join("|")}> [--repo .] [--branch B] [--check]`);
    process.exit(2);
  }
  const repo = arg("--repo") ?? ".";
  const branch = arg("--branch");
  const route = siteRoute(repo, role, branch);
  if (route.kind === "undeclared" || route.kind === "missing") {
    console.error(`✗ site:workflow ${role}: ${route.why}`);
    process.exit(1);
  }
  const inputs = workflowInputs(process.argv.slice(3));
  if (route.kind === "agent-run" && Object.keys(inputs).length > 0) {
    console.error(`✗ site:workflow ${role}: this repository is agent-run, and stage-local takes no ${Object.keys(inputs).join(", ")}`);
    process.exit(1);
  }
  const argv =
    route.kind === "agent-run"
      ? route.argv
      : ["gh", "workflow", "run", route.file, ...(branch ? ["--ref", branch] : []), ...Object.entries(inputs).flatMap(([k, v]) => ["-f", `${k}=${v}`])];
  console.log(`site:workflow ${role}: ${argv.join(" ")}`);
  if (process.argv.includes("--check")) process.exit(0);
  const run = spawnSync(argv[0]!, argv.slice(1), { stdio: "inherit", cwd: repo });
  process.exit(run.status ?? 1);
}
