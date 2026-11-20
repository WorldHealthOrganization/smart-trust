/**
 * The release security gate: run every security check this repository
 * already has, as ONE named step a release process can call.
 *
 * It adds no check. The checks run in `code-quality-gates.yml`, but a merge,
 * publish or release step is covered only if the preceding CI run was the
 * right one; this makes them callable by name at the point of release, and
 * says which state each one is in.
 *
 * ## Three states, never two
 *
 * | state     | means                                     | blocks |
 * |-----------|-------------------------------------------|--------|
 * | `pass`    | the check ran and found nothing it fails on | no   |
 * | `fail`    | the check ran and refused                 | yes (blocking checks) |
 * | `unknown` | the check could not be run                | yes: could-not-check is never clean |
 *
 * Action SHA pinning BLOCKS for every workflow except a staging-only one that
 * holds no write token and has no `pull_request_target` trigger, which is
 * reported as advisory. `stagingExempt` in `pin-actions.ts` decides that from
 * what the workflow can do, never from its name. An `advisory` check
 * (dependency advisories, exempt staging pinning) is reported in the same
 * three states and never blocks.
 *
 * A check runs only when its manifest command equals the one pinned in
 * {@link PINNED_CHECK_COMMANDS}; a repointed check is `fail`, not run. A
 * pinned SHA must carry its `# <ref>` comment, and a bare one is
 * `unpinned-unlabelled` and blocks; `docker://` steps without an
 * `@sha256:` digest are advisory.
 *
 * Every subprocess is argv: the check names are constants and reach
 * `Bun.spawnSync` as an array, so no shell command is built from a value.
 *
 * Usage:
 *   bun run cat security:gate            # exit 1 on a blocking fail or unknown
 *   bun run cat security:gate --json     # machine-readable result on stdout
 *
 * @graphNode tool
 * @covers none — it re-runs other gates by name and reads .github/workflows/, which is not a declared graph typology; the kinds belong to the gates it calls
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { scriptTable, type ScriptEntry } from "../schemas/sdlc/script-table.ts";
import { ownsScript, writerCommand } from "./lib/script-command.ts";
import { parseDockerUses, parseUses, stagingExempt } from "./pin-actions.ts";
import { NOT_APPLICABLE_EXIT } from "./lib/not-applicable.ts";

const TOOLS_ROOT = resolve(import.meta.dir, "..");
const PARENT_ROOT = resolve(import.meta.dir, "..", "..");
const ROOT =
  existsSync(join(PARENT_ROOT, "index.config.json")) || existsSync(join(PARENT_ROOT, "package.json"))
    ? PARENT_ROOT
    : existsSync(join(TOOLS_ROOT, "package.json"))
      ? TOOLS_ROOT
      : PARENT_ROOT;

function defaultWorkflowRoot(): string {
  if (existsSync(join(ROOT, ".github", "workflows"))) return ROOT;
  if (existsSync(join(process.cwd(), ".github", "workflows"))) return process.cwd();
  if (existsSync(join(TOOLS_ROOT, ".github", "workflows"))) return TOOLS_ROOT;
  return ROOT;
}

export type GateState = "pass" | "fail" | "unknown";
export interface GateResult {
  check: string;
  blocking: boolean;
  state: GateState;
  detail: string;
}

/** Machine-readable output of `security:gate --json`, optionally referencing its `folio-run-context/v1` record (`C1 = (a)`). */
export interface SecurityGateReport {
  $schema: "folio-security-gate/v1";
  results: GateResult[];
  blocked: boolean;
  runContext?: { sha256: string };
}

/** The security checks, each a `package.json` script, in the order a reader meets them. */
export const SECURITY_CHECKS: ReadonlyArray<{ script: string; blocking: boolean; guards: string }> = [
  { script: "check:workflow-injection", blocking: true, guards: "`${{ }}` reaching a run:/script: block" },
  { script: "check:secret-leaks", blocking: true, guards: "secrets committed or echoed" },
  { script: "check:lockfile-pinning", blocking: true, guards: "an install that falls back from its pin" },
  { script: "check:bun-pin", blocking: true, guards: "the toolchain version" },
  { script: "check:qa-reviewer-permission", blocking: true, guards: "a QA verdict written by an actor not permitted to write it" },
  { script: "check:materialized-fixity", blocking: true, guards: "materialised remote assets against their recorded hashes" },
  { script: "check:dependency-advisories", blocking: false, guards: "known-vulnerable dependencies (warn-only by design)" },
];

/**
 * The command each gate check must run, pinned here (bean `1ygp` L4.5).
 *
 * The gate runs from the PR's own manifests, so a name lookup alone could be
 * emptied: repoint `check:secret-leaks` to `true` in a `package.json` and the
 * check "passes" without running. A manifest command that differs from its
 * pin is reported `fail`, and the check is not run. Changing a pin is a
 * reviewed edit to THIS file, which is where a reviewer looks for the gate.
 *
 * What the pin does not cover: the pinned script FILE is still the PR's own
 * copy, so a change to its body is visible only in the diff. Pinning the
 * command closes the one-line, easy-to-miss manifest edit; it is not a
 * signature over the check's code.
 */
export const PINNED_CHECK_COMMANDS: Readonly<Record<string, string>> = {
  "check:workflow-injection": "bun run cat-harness-tools/scripts/check-workflow-injection.ts",
  "check:secret-leaks": "bun run cat-harness-tools/scripts/check-secret-leaks.ts",
  "check:lockfile-pinning": "bun run cat-harness-tools/scripts/check-lockfile-pinning.ts",
  "check:bun-pin": "bun run cat-harness-tools/scripts/check-bun-pin.ts",
  "check:qa-reviewer-permission": "bun run cat-harness-tools/scripts/check-qa-reviewer-permission.ts",
  "check:materialized-fixity": "bun run <layer>/scripts/check-materialized-fixity.ts",
  "check:dependency-advisories": "bun run cat-harness-tools/scripts/check-dependency-advisories.ts",
};

/**
 * Resolve the pinned command for `script`. A pin written with `<layer>` (such as
 * `check:materialized-fixity`, which lives in a content layer above this one)
 * resolves `<layer>` from whichever layer manifest declares the script, rather
 * than hard-coding an upper layer's path here (bean `cat-tools-q8gk`).
 */
export function pinnedCommandFor(
  script: string,
  entry?: ScriptEntry | string,
  pins: Readonly<Record<string, string>> = PINNED_CHECK_COMMANDS,
): string | undefined {
  const raw = Object.prototype.hasOwnProperty.call(pins, script) ? pins[script] : undefined;
  if (raw === undefined || !raw.includes("<layer>")) return raw;
  if (!entry) return raw.replace("<layer>/", "");
  if (typeof entry === "string") return raw.replace("<layer>", entry);
  const fromManifest = entry.manifest && entry.manifest !== "package.json" ? dirname(entry.manifest) : undefined;
  const fromCommand = /^bun run ([A-Za-z0-9._-]+)\//.exec(entry.command.trim())?.[1];
  const layer = fromManifest && fromManifest !== "." ? fromManifest : fromCommand;
  return layer ? raw.replace("<layer>", layer) : raw.replace("<layer>/", "");
}

/**
 * Run one package script by NAME, as argv, only when its manifest command is
 * the one {@link PINNED_CHECK_COMMANDS} pins. A name with no pin is refused
 * too: an unpinned check is one the gate cannot vouch for.
 */
export function runCheck(script: string, blocking: boolean, root = ROOT, pins: Readonly<Record<string, string>> = PINNED_CHECK_COMMANDS): GateResult {
  // Looked up across the root `scripts` AND every layer's `checkoutScripts`
  // (#2448). Reading the root manifest alone made every moved check
  // `unknown`, so the gate refused every run from c2df3a0 on.
  let entry: ScriptEntry | undefined;
  try {
    entry = scriptTable(root).get(script);
  } catch (e) {
    return { check: script, blocking, state: "unknown", detail: `the script table could not be read: ${String(e).split("\n")[0]}` };
  }
  if (!entry) {
    return { check: script, blocking, state: "unknown", detail: "no such script in any manifest: the check could not be run" };
  }
  const pinned = pinnedCommandFor(script, entry, pins);
  if (pinned === undefined) {
    return { check: script, blocking, state: "fail", detail: `no pinned command for ${script} in security-gate.ts PINNED_CHECK_COMMANDS: the gate cannot vouch for what it runs` };
  }
  if (entry.command.trim() !== pinned) {
    return {
      check: script,
      blocking,
      state: "fail",
      detail: `${entry.manifest} runs \`${entry.command.slice(0, 120)}\` but the gate pins \`${pinned}\`: not run. Change the pin in security-gate.ts if the move is intended`,
    };
  }
  // A root `scripts` entry runs directly; a `checkoutScripts` entry runs through `cat` or `run-script.ts`.
  const argv = entry.manifest === "package.json" && ownsScript(root, script) ? ["bun", "run", script] : writerCommand(root, script);
  const p = Bun.spawnSync(argv, { cwd: root, stdout: "pipe", stderr: "pipe" });
  // Bun echoes "$ bun run …" on stderr, so prefer the check's own last stdout line.
  const lastLine = (t: string) => t.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("$ ")).pop();
  const tail = (lastLine(p.stdout.toString()) ?? lastLine(p.stderr.toString()) ?? "").slice(0, 300);
  if (p.exitCode === 0) return { check: script, blocking, state: "pass", detail: tail };
  if (p.exitCode === null) return { check: script, blocking, state: "unknown", detail: "the check did not exit (signal)" };
  if (p.exitCode === 2) return { check: script, blocking, state: "unknown", detail: tail };
  // 78 is "not applicable in this root" (`lib/not-applicable.ts`): the check
  // did not judge anything here, so it did not refuse. It is not a pass
  // either: at release, could-not-check is never clean, so it reads as
  // `unknown` and still blocks, as the exit 2 it replaced did.
  if (p.exitCode === NOT_APPLICABLE_EXIT) return { check: script, blocking, state: "unknown", detail: `not applicable in this root — ${tail}` };
  return { check: script, blocking, state: "fail", detail: tail };
}

/**
 * Third-party `uses:` lines not pinned to a full commit SHA, split by
 * {@link stagingExempt}: every workflow must pin unless it is a staging-only
 * workflow with no write token and no `pull_request_target` trigger. Local
 * (`./`) and `docker://` references are not third-party actions, and this
 * repository's own reusable workflows are first-party. Parsing and the
 * exemption come from `pin-actions.ts`, so the tool that pins and the gate
 * that checks cannot disagree about a line.
 */
export function unpinnedActions(
  root = defaultWorkflowRoot(),
): { total: number; unpinned: string[]; stagingUnpinned: string[]; dockerUndigested: string[] } | undefined {
  const dir = join(root, ".github", "workflows");
  if (!existsSync(dir)) return undefined;
  const unpinned: string[] = [];
  const stagingUnpinned: string[] = [];
  const dockerUndigested: string[] = [];
  let total = 0;
  for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const text = readFileSync(join(dir, f), "utf-8");
    const exempt = stagingExempt(f, text);
    text.split("\n").forEach((line, i) => {
      const d = parseDockerUses(line);
      if (d) {
        if (!d.digest) dockerUndigested.push(`${f}:${i + 1} docker://${d.image}`);
        return;
      }
      const u = parseUses(line);
      if (!u || u.firstParty) return;
      total++;
      if (u.pinned) return;
      // A SHA with no `# <ref>` says which: the fix is a label, not a resolve.
      const why = u.status === "unpinned-unlabelled" ? " (unpinned-unlabelled: no # <ref>)" : "";
      (exempt ? stagingUnpinned : unpinned).push(`${f}:${i + 1} ${u.action}@${u.ref}${why}`);
    });
  }
  return { total, unpinned, stagingUnpinned, dockerUndigested };
}

/** Blocking for published workflows; staging-only workflows are reported, never blocking. */
export function actionPinning(root = defaultWorkflowRoot()): GateResult[] {
  const r = unpinnedActions(root);
  if (r === undefined) return [{ check: "action-sha-pinning", blocking: true, state: "unknown", detail: "no .github/workflows directory" }];
  const published: GateResult =
    r.unpinned.length === 0
      ? { check: "action-sha-pinning", blocking: true, state: "pass", detail: `every third-party uses: outside exempt staging workflows (no write token, no pull_request_target) is SHA-pinned (${r.total} in all)` }
      : { check: "action-sha-pinning", blocking: true, state: "fail", detail: `${r.unpinned.length} unpinned outside exempt staging workflows — run \`bun run cat actions:pin\`: ${r.unpinned.slice(0, 3).join("; ")}` };
  const staging: GateResult = {
    check: "action-sha-pinning (exempt staging)",
    blocking: false,
    state: r.stagingUnpinned.length === 0 ? "pass" : "fail",
    detail: r.stagingUnpinned.length === 0 ? "exempt staging workflows are pinned too, or there are none" : `${r.stagingUnpinned.length} unpinned in exempt staging workflows (no write token), allowed by the owner's ruling`,
  };
  // Advisory: none exist here (measured 2026-10-07), and a digest is not the
  // mechanical rewrite `actions:pin` performs for an action's tag.
  const docker: GateResult = {
    check: "docker-image-digest-pinning",
    blocking: false,
    state: r.dockerUndigested.length === 0 ? "pass" : "fail",
    detail:
      r.dockerUndigested.length === 0
        ? "every docker:// step carries an @sha256: digest, or there are none"
        : `${r.dockerUndigested.length} docker:// step(s) by tag, not @sha256: digest: ${r.dockerUndigested.slice(0, 3).join("; ")}`,
  };
  return [published, staging, docker];
}

export function securityGate(root?: string): GateResult[] {
  const r = root ?? ROOT;
  const wfRoot = root ?? defaultWorkflowRoot();
  return [...SECURITY_CHECKS.map((c) => runCheck(c.script, c.blocking, r)), ...actionPinning(wfRoot)];
}

/** A release proceeds only when no BLOCKING check failed or could not be run. */
export function blocks(results: GateResult[]): GateResult[] {
  return results.filter((r) => r.blocking && r.state !== "pass");
}

if (import.meta.main) {
  const results = securityGate();
  const stop = blocks(results);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ $schema: "folio-security-gate/v1", results, blocked: stop.length > 0 }, null, 2));
  } else {
    for (const r of results) {
      const mark = r.state === "pass" ? "✓" : r.state === "fail" ? "✗" : "?";
      console.log(`${mark} ${r.check}${r.blocking ? "" : " (advisory)"} — ${r.state}${r.detail ? `: ${r.detail}` : ""}`);
    }
    console.log(
      stop.length === 0
        ? "\nsecurity:gate: no blocking finding. Advisory findings above are reported, not cleared."
        : `\nsecurity:gate: REFUSED — ${stop.length} blocking check(s) failed or could not be run.`,
    );
  }
  process.exit(stop.length === 0 ? 0 : 1);
}
