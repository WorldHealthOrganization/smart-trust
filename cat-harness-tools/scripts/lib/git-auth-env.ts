/**
 * The checkout's `http.*.extraheader` credentials, carried to a PRIVATE store
 * repository in the environment (`GIT_CONFIG_COUNT`), never in argv, without
 * ever sending a header twice.
 *
 * `branch-store.ts` and `qa-store.ts` both keep their objects in a bare
 * repository of their own, which does not see the checkout's LOCAL config, so
 * the credential `actions/checkout` leaves there must be carried across. But
 * `git config --get-regexp` from the checkout answers EVERY scope, and the
 * bare store already reads the GLOBAL and SYSTEM ones itself. A job that puts
 * its token in the global config (`folio-site-publish.yml`: "Identify the
 * publishing commit's author, and let it push") therefore had it sent twice,
 * and GitHub answers a doubled header with `400 Duplicate header:
 * "Authorization"` (aai-programme run 44484831872, `site:mount-board`). A job
 * that has it in both the local and the global config sent it twice even
 * before the copy.
 *
 * So the copy is a REPLACEMENT, not an addition: each key it carries is first
 * reset (an empty `http.extraheader` clears the list, git `http.c`), and the
 * env scope is read after every file scope, so what follows is the whole
 * list. A header is carried once, and of several `Authorization` headers only
 * the last — the highest-precedence scope's — survives, since GitHub refuses
 * any two whether or not they agree.
 *
 * @module cat-harness-tools/scripts/lib/git-auth-env
 */
import { spawnSync } from "node:child_process";

/** One `http.*.extraheader` entry, in git's precedence order (later wins). */
export interface ExtraHeader {
  key: string;
  value: string;
}

/** `git config --get-regexp` output → entries. A bare key (no value) reads as empty, which git treats as a reset. */
export function parseExtraHeaders(stdout: string): ExtraHeader[] {
  return stdout
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const sp = line.indexOf(" ");
      return sp < 0 ? { key: line, value: "" } : { key: line.slice(0, sp), value: line.slice(sp + 1) };
    });
}

const isAuthorization = (value: string) => /^\s*authorization\s*:/i.test(value);

/**
 * The headers git would send once the duplicates are gone: an empty value
 * clears everything before it (as in git), a repeated value is kept once, and
 * only the LAST `Authorization` header is kept.
 */
export function effectiveExtraHeaders(entries: readonly ExtraHeader[]): ExtraHeader[] {
  let kept: ExtraHeader[] = [];
  for (const e of entries) {
    if (e.value === "") {
      kept = [];
      continue;
    }
    if (isAuthorization(e.value)) kept = kept.filter((k) => !isAuthorization(k.value));
    else if (kept.some((k) => k.value === e.value)) continue;
    kept.push(e);
  }
  return kept;
}

/**
 * The `GIT_CONFIG_*` variables that make a git run see exactly
 * {@link effectiveExtraHeaders}: a reset of every key seen, then the headers.
 * Appended after `base` entries the caller's environment already holds.
 */
export function extraHeaderEnv(entries: readonly ExtraHeader[], base = 0): Record<string, string> {
  if (entries.length === 0) return {};
  const keys = [...new Set(entries.map((e) => e.key))];
  const out: ExtraHeader[] = [...keys.map((key) => ({ key, value: "" })), ...effectiveExtraHeaders(entries)];
  const env: Record<string, string> = {};
  out.forEach((e, i) => {
    env[`GIT_CONFIG_KEY_${base + i}`] = e.key;
    env[`GIT_CONFIG_VALUE_${base + i}`] = e.value;
  });
  env.GIT_CONFIG_COUNT = String(base + out.length);
  return env;
}

/**
 * The checkout's `http.*.extraheader` credentials as env for a git run in a
 * private store repository: every scope the checkout sees, reset and carried
 * once. `env` is the environment the checkout is read with (its `HOME` names
 * the global config) and the one whose `GIT_CONFIG_COUNT` this appends to.
 */
export function authEnvFrom(repoRoot: string, callerEnv?: NodeJS.ProcessEnv): Record<string, string> {
  // input-site: store #bba8e579 — configures a branch-store or qa-store read; the read itself goes through TreeStore.git(), which is traced
  const env = callerEnv ?? process.env;
  // input-site: store #b2896286 — configures a branch-store or qa-store read; the read itself goes through TreeStore.git(), which is traced
  const r = spawnSync("git", ["config", "--get-regexp", "^http\\..*extraheader$"], { cwd: repoRoot, encoding: "utf-8", env });
  if (r.status !== 0 || !r.stdout.trim()) return {};
  const base = Number(env.GIT_CONFIG_COUNT ?? 0) || 0;
  return extraHeaderEnv(parseExtraHeaders(r.stdout), base);
}
