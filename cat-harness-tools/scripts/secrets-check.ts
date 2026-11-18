#!/usr/bin/env bun
/**
 * `secrets:check` — declared credential needs against what the workflows use
 * and what is present, by NAME ONLY.
 *
 * **It never reads a value.** Its inputs are workflow text (the
 * `${{ secrets.NAME }}` references), the `credentials/needs.json` and
 * `credentials/registry.json` declarations, and — when a token allows it —
 * the secret NAMES GitHub lists, which the API returns without values.
 *
 * Exit 0 clean, 1 findings, **2 could not determine, which outranks clean and
 * is never shown green**. With no `needs.json`, "declared needs" is reported
 * as could-not-determine (exit 2) rather than as an empty, passing set.
 *
 * Findings: used-not-declared, declared-not-used, declared-not-present,
 * present-not-declared (orphans, reported and NEVER deleted), naming-rule
 * advisories (a name says the capability, never `_TOKEN`/`_PAT`/`_KEY`/
 * `_APP`), and expiry from the registry at 30 / 7 / 0 days.
 *
 * Usage:
 *   bun run cat secrets:check [<repo dir> …] [--json]
 * With no directory: the index root and every layer under it that carries
 * `.github/workflows`.
 *
 * @module scripts/secrets-check
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { checkoutOwner, resolveLockJson } from "../schemas/kg/repo-owner.ts";

export type Severity = "critical" | "major" | "minor" | "advisory";

export interface SecretFinding {
  kind:
    | "used-not-declared"
    | "declared-not-used"
    | "declared-not-present"
    | "present-not-declared"
    | "naming-rule"
    | "expires-soon"
    | "expired";
  repo: string;
  secret: string;
  severity: Severity;
  detail: string;
}

/** A part of the evidence that could not be established — never folded into clean. */
export interface Undetermined {
  repo: string;
  part: "declared-needs" | "present-names" | "expiry";
  reason: string;
}

export interface RepoEvidence {
  /** Display name: `owner/repo` when known, else the directory name. */
  repo: string;
  /** Workflow file → the secret names it references inside `${{ }}`. */
  used: Map<string, Set<string>>;
  /** Declared need ids → the secret name each is supplied as, or `undefined` when no needs.json exists. */
  declared: Map<string, { secret: string; without?: string }> | undefined;
  /** Secret names present on GitHub, or the reason they could not be listed. */
  present: Set<string> | { reason: string };
  /** `registry.json` entries, or `undefined` when there is none. */
  registry: { secret: string; expiresOn?: string }[] | undefined;
}

export interface SecretsReport {
  repos: string[];
  usedCount: number;
  findings: SecretFinding[];
  undetermined: Undetermined[];
}

/** GitHub's own token, which needs no supply. */
const IMPLICIT = new Set(["GITHUB_TOKEN"]);
/** §4.1's identity exception: key material that IS an identity is named for it. */
const IDENTITY_KEYS = new Set(["HARNESS_BOT_PRIVATE_KEY"]);
const MECHANISM_SUFFIX = /_(TOKEN|PAT|KEY|APP)$/;

/** Expiry thresholds with their basis (§6.2), exported so `bun run health` states the same numbers. */
export const EXPIRY_WARN_DAYS = 30;
export const EXPIRY_URGENT_DAYS = 7;
export const EXPIRY_BASIS = {
  warn: "30 days gives the owner one ordinary monthly cycle to rotate (credentials proposal §6.2)",
  urgent: "7 days gives one working week (credentials proposal §6.2)",
};

/**
 * The secret names a workflow references in an EXPRESSION.
 *
 * Only inside `${{ … }}`: `secrets.token_hex` in a Python `run:` block is not
 * a secrets-context reference (§1.1 found exactly that), and must not be read
 * as one.
 */
export function secretRefs(workflowText: string): Set<string> {
  const out = new Set<string>();
  for (const expr of workflowText.matchAll(/\$\{\{([^}]*)\}\}/g)) {
    for (const m of expr[1]!.matchAll(/\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(m[1]!);
  }
  return out;
}

function daysUntil(now: Date, iso: string): number | undefined {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : Math.floor((t - now.getTime()) / 86_400_000);
}

/** The pure judgement: evidence in, findings and the undetermined parts out. */
export function judgeSecrets(evidence: readonly RepoEvidence[], now: Date): SecretsReport {
  const findings: SecretFinding[] = [];
  const undetermined: Undetermined[] = [];
  let usedCount = 0;
  for (const e of evidence) {
    const used = new Set<string>();
    for (const names of e.used.values()) for (const n of names) if (!IMPLICIT.has(n)) used.add(n);
    usedCount += used.size;

    // Declared needs.
    const declaredSecrets = new Map<string, string | undefined>();
    if (e.declared === undefined) {
      undetermined.push({
        repo: e.repo,
        part: "declared-needs",
        reason: "no credentials/needs.json declares this repository's needs (bean 9hxd), so used-vs-declared cannot be judged",
      });
    } else {
      for (const d of e.declared.values()) declaredSecrets.set(d.secret, d.without);
      for (const n of used) {
        if (!declaredSecrets.has(n)) findings.push({ kind: "used-not-declared", repo: e.repo, secret: n, severity: "major", detail: `${n} is read by a workflow but no need declares it` });
      }
      for (const n of declaredSecrets.keys()) {
        if (!used.has(n)) findings.push({ kind: "declared-not-used", repo: e.repo, secret: n, severity: "minor", detail: `${n} is declared but no workflow reads it` });
      }
    }

    // Presence.
    if (!(e.present instanceof Set)) {
      undetermined.push({ repo: e.repo, part: "present-names", reason: e.present.reason });
    } else {
      const expected = e.declared === undefined ? used : new Set(declaredSecrets.keys());
      for (const n of expected) {
        if (!e.present.has(n)) {
          const without = declaredSecrets.get(n);
          findings.push({
            kind: "declared-not-present",
            repo: e.repo,
            secret: n,
            severity: without === "degrade" || without === "skip" ? "minor" : "major",
            detail: `${n} is ${e.declared === undefined ? "used" : "declared"} but not present in the repository's secrets`,
          });
        }
      }
      for (const n of e.present) {
        if (!expected.has(n) && !IMPLICIT.has(n)) {
          findings.push({ kind: "present-not-declared", repo: e.repo, secret: n, severity: "minor", detail: `${n} is present but nothing ${e.declared === undefined ? "uses" : "declares"} it — reported, never deleted` });
        }
      }
    }

    // Naming rule (§4), advisory for existing names.
    for (const n of used) {
      if (MECHANISM_SUFFIX.test(n) && !IDENTITY_KEYS.has(n)) {
        findings.push({ kind: "naming-rule", repo: e.repo, secret: n, severity: "advisory", detail: `${n} names a mechanism; §4 names a secret for its capability (VERB_OBJECT[_TARGET])` });
      }
    }

    // Expiry.
    if (e.registry === undefined) {
      if (used.size > 0) undetermined.push({ repo: e.repo, part: "expiry", reason: "no credentials/registry.json records issue or expiry dates" });
    } else {
      for (const r of e.registry) {
        if (!r.expiresOn) continue;
        const d = daysUntil(now, r.expiresOn);
        if (d === undefined) {
          undetermined.push({ repo: e.repo, part: "expiry", reason: `${r.secret}: expiresOn "${r.expiresOn}" is not a date` });
        } else if (d < 0) {
          findings.push({ kind: "expired", repo: e.repo, secret: r.secret, severity: "critical", detail: `${r.secret} expired on ${r.expiresOn}` });
        } else if (d <= EXPIRY_URGENT_DAYS) {
          findings.push({ kind: "expires-soon", repo: e.repo, secret: r.secret, severity: "major", detail: `${r.secret} expires in ${d} day(s) (${r.expiresOn})` });
        } else if (d <= EXPIRY_WARN_DAYS) {
          findings.push({ kind: "expires-soon", repo: e.repo, secret: r.secret, severity: "minor", detail: `${r.secret} expires in ${d} day(s) (${r.expiresOn})` });
        }
      }
    }
  }
  return { repos: evidence.map((e) => e.repo), usedCount, findings, undetermined };
}

/** 2 when anything could not be determined (outranks clean), else 1 on a major/critical finding, else 0. */
export function exitCodeFor(r: SecretsReport): 0 | 1 | 2 {
  if (r.undetermined.length > 0) return 2;
  return r.findings.some((f) => f.severity === "major" || f.severity === "critical") ? 1 : 0;
}

// ── Evidence gathering (filesystem + optional names-only API) ─────────────

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}

function repoName(dir: string): string {
  try {
    const url = execFileSync("git", ["-C", dir, "remote", "get-url", "origin"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url);
    if (m) return m[1]!;
  } catch {
    /* a mount has no .git: fall through to the lock */
  }
  return basename(dir);
}

function lockRepositories(indexRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  const lock = resolveLockJson(readJson(join(indexRoot, "index.lock.json")), () => checkoutOwner(indexRoot)) as { instances?: { path?: string; repository?: string }[] } | undefined;
  for (const i of lock?.instances ?? []) if (i.path && i.repository) out.set(i.path, i.repository);
  return out;
}

async function presentNames(repo: string, token: string | undefined): Promise<Set<string> | { reason: string }> {
  if (!repo.includes("/")) return { reason: `no GitHub repository is known for ${repo}` };
  if (!token) return { reason: "no GH_TOKEN/GITHUB_TOKEN with secrets:read (need `list-secret-names`, §6.2) — names could not be listed" };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/secrets?per_page=100`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) return { reason: `listing secret names returned HTTP ${res.status}` };
    const body = (await res.json()) as { secrets?: { name: string }[] };
    return new Set((body.secrets ?? []).map((s) => s.name));
  } catch (e) {
    return { reason: `listing secret names failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Everything but presence, read from files only — offline, so `bun run health`
 * can use it without a token or the network.
 */
export function readRepoFiles(dir: string, repo: string): Omit<RepoEvidence, "present"> {
  const wf = join(dir, ".github", "workflows");
  const used = new Map<string, Set<string>>();
  if (existsSync(wf)) {
    for (const f of readdirSync(wf)) {
      if (!/\.ya?ml$/.test(f)) continue;
      used.set(f, secretRefs(readFileSync(join(wf, f), "utf-8")));
    }
  }
  const needs = readJson(join(dir, "credentials", "needs.json")) as { needs?: { id: string; without?: string }[] } | undefined;
  const profile = readJson(join(dir, "credentials", "profile.json")) as { supply?: Record<string, { secret?: string }> } | undefined;
  let declared: RepoEvidence["declared"];
  if (needs?.needs) {
    declared = new Map();
    for (const n of needs.needs) declared.set(n.id, { secret: profile?.supply?.[n.id]?.secret ?? n.id.toUpperCase().replace(/-/g, "_"), without: n.without });
  }
  const reg = readJson(join(dir, "credentials", "registry.json")) as { entries?: { secret: string; expiresOn?: string }[] } | undefined;
  return { repo, used, declared, registry: reg?.entries };
}

export async function gatherEvidence(dirs: readonly string[], repoFor: (dir: string) => string, token: string | undefined): Promise<RepoEvidence[]> {
  const out: RepoEvidence[] = [];
  for (const dir of dirs) {
    const files = readRepoFiles(dir, repoFor(dir));
    out.push({ ...files, present: await presentNames(files.repo, token) });
  }
  return out;
}

/** The index root and each layer under it that carries workflows. */
export function defaultDirs(indexRoot: string): string[] {
  const dirs = [indexRoot];
  for (const name of readdirSync(indexRoot)) {
    const d = join(indexRoot, name);
    if (name.startsWith(".") || name === "node_modules") continue;
    try {
      if (statSync(d).isDirectory() && existsSync(join(d, ".github", "workflows"))) dirs.push(d);
    } catch {
      /* unreadable entry: skipped, it carries no workflows we could read */
    }
  }
  return dirs;
}

/** The index this layer is mounted in. */
export const INDEX_ROOT = join(import.meta.dir, "..", "..");

export function repoResolver(indexRoot: string = INDEX_ROOT): (dir: string) => string {
  const lock = lockRepositories(indexRoot);
  return (d: string) => lock.get(basename(d)) ?? repoName(d);
}

export async function runSecretsCheck(dirs?: readonly string[], now = new Date()): Promise<SecretsReport> {
  const chosen = dirs && dirs.length > 0 ? dirs : defaultDirs(INDEX_ROOT);
  const repoFor = repoResolver();
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  return judgeSecrets(await gatherEvidence(chosen, repoFor, token), now);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const report = await runSecretsCheck(args.filter((a) => !a.startsWith("--")));
  const code = exitCodeFor(report);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ ...report, exit: code }, null, 2));
  } else {
    console.log(`secrets:check — ${report.repos.length} repo(s), ${report.usedCount} secret name(s) used by workflows (names only; no value is read)`);
    for (const u of report.undetermined) console.log(`  ? ${u.repo} · ${u.part}: could not determine — ${u.reason}`);
    for (const f of report.findings) console.log(`  ${f.severity === "advisory" ? "·" : "✗"} [${f.severity}] ${f.repo} · ${f.secret}: ${f.detail}`);
    console.log(code === 2 ? "UNKNOWN — could not determine; this is not a pass (exit 2)" : code === 1 ? "FINDINGS (exit 1)" : "clean (exit 0)");
  }
  process.exit(code);
}
