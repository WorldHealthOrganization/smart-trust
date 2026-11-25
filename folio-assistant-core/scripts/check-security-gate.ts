#!/usr/bin/env bun
/**
 * Run the security gate over this repository's own workflows and root
 * (bean `folio-core-0dy3`).
 *
 * The shared gate scripts in `@litlfred/cat-harness-tools` default to the
 * composed root (`resolve(import.meta.dir, "..", "..")`) and read a baseline
 * and workflow list owned by that layout. When run from a standalone layer
 * checkout, each check needs the target root passed explicitly so:
 *   - workflow expression injection is checked against the target's own
 *     `.github/workflows/` and optional baseline rather than another repo's;
 *   - secret-leak scanning walks the target's roots without requiring an
 *     unmounted sibling repo;
 *   - lockfile pinning, Bun toolchain pinning, and action SHA pinning (including
 *     reusable workflows and actions from `litlfred/cat-harness-tools`) are
 *     verified on the target's own `.github/workflows/`;
 *   - every check reports `pass`, `fail`, or `unknown` (never collapsing
 *     could-not-check into `pass`).
 *
 * @module folio-assistant-core/scripts/check-security-gate
 * @covers none — this gate inspects `.github/workflows/`, `bun.lock`, and calls `check-materialized-fixity` (which carries its own `@covers`)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { readPinFile } from "@litlfred/cat-harness-tools/scripts/check-bun-pin.js";
import {
  countPinned as countLockfilePinned,
  scanWorkflows as scanLockfilePinning,
} from "@litlfred/cat-harness-tools/scripts/check-lockfile-pinning.js";
import { scanTree as scanSecretLeaks } from "@litlfred/cat-harness-tools/scripts/check-secret-leaks.js";
import {
  baselineKey as injectionBaselineKey,
  scanWorkflows as scanWorkflowInjection,
} from "@litlfred/cat-harness-tools/scripts/check-workflow-injection.js";
import {
  parseDockerUses,
  parseUses,
  stagingExempt,
} from "@litlfred/cat-harness-tools/scripts/pin-actions.js";
import {
  blocks,
  type GateResult,
  type SecurityGateReport,
} from "@litlfred/cat-harness-tools/scripts/security-gate.js";
import { run as runMaterializedFixity } from "./check-materialized-fixity.js";

export const CORE_ROOT = resolve(import.meta.dir, "..");

const CORE_SCAN_ROOTS: readonly string[] = [
  ".github",
  "beans",
  "package.json",
  "skills",
  "glossary",
  "adapters",
  "scripts",
  "schemas",
  "src",
  "tools",
  "typologies",
  "validators",
];

function workflowFiles(workflowsDir: string): string[] {
  return readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();
}

export function checkWorkflowInjectionForRoot(root = CORE_ROOT): GateResult {
  const workflowsDir = join(root, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    return {
      check: "check:workflow-injection",
      blocking: true,
      state: "unknown",
      detail: "no .github/workflows directory",
    };
  }
  const files = workflowFiles(workflowsDir);
  if (files.length === 0) {
    return {
      check: "check:workflow-injection",
      blocking: true,
      state: "unknown",
      detail: "no workflow YAML files in .github/workflows",
    };
  }
  const baselinePath = join(root, "scripts", "workflow-injection-baseline.json");
  let baselineKeys = new Set<string>();
  if (existsSync(baselinePath)) {
    try {
      const parsed = JSON.parse(readFileSync(baselinePath, "utf-8")) as {
        constrained?: Array<{ key: string }>;
      };
      baselineKeys = new Set((parsed.constrained ?? []).map((e) => e.key));
    } catch (e) {
      return {
        check: "check:workflow-injection",
        blocking: true,
        state: "unknown",
        detail: `unreadable workflow-injection baseline: ${String(e)}`,
      };
    }
  }
  const found = scanWorkflowInjection(workflowsDir);
  const free = found.filter((i) => i.severity === "free-text");
  const unbaselined = found.filter(
    (i) => i.severity === "constrained" && !baselineKeys.has(injectionBaselineKey(i)),
  );
  if (free.length > 0 || unbaselined.length > 0) {
    const sample = [...free, ...unbaselined]
      .slice(0, 3)
      .map((i) => `${i.workflow}:${i.line} (${i.expression})`)
      .join("; ");
    return {
      check: "check:workflow-injection",
      blocking: true,
      state: "fail",
      detail: `${free.length} free-text, ${unbaselined.length} unbaselined constrained injection(s): ${sample}`,
    };
  }
  return {
    check: "check:workflow-injection",
    blocking: true,
    state: "pass",
    detail: `0 free-text, ${found.length} baselined constrained across ${files.length} workflow(s)`,
  };
}

export function checkSecretLeaksForRoot(root = CORE_ROOT): GateResult {
  if (!existsSync(join(root, ".github")) || !existsSync(join(root, "package.json"))) {
    return {
      check: "check:secret-leaks",
      blocking: true,
      state: "unknown",
      detail: "missing .github or package.json in target root",
    };
  }
  const presentRoots = CORE_SCAN_ROOTS.filter((r) => existsSync(join(root, r)));
  const { leaks, unreadable } = scanSecretLeaks(root, presentRoots);
  if (unreadable.length > 0) {
    return {
      check: "check:secret-leaks",
      blocking: true,
      state: "unknown",
      detail: `${unreadable.length} unreadable path(s): ${unreadable.slice(0, 3).join(", ")}`,
    };
  }
  if (leaks.length > 0) {
    const sample = leaks
      .slice(0, 3)
      .map((l) => `${l.file}:${l.line} (${l.pattern})`)
      .join("; ");
    return {
      check: "check:secret-leaks",
      blocking: true,
      state: "fail",
      detail: `${leaks.length} secret leak(s): ${sample}`,
    };
  }
  return {
    check: "check:secret-leaks",
    blocking: true,
    state: "pass",
    detail: `0 secret leaks across ${presentRoots.length} root(s)`,
  };
}

export function checkLockfilePinningForRoot(root = CORE_ROOT): GateResult {
  const workflowsDir = join(root, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    return {
      check: "check:lockfile-pinning",
      blocking: true,
      state: "unknown",
      detail: "no .github/workflows directory",
    };
  }
  const files = workflowFiles(workflowsDir);
  if (files.length === 0) {
    return {
      check: "check:lockfile-pinning",
      blocking: true,
      state: "unknown",
      detail: "no workflow YAML files in .github/workflows",
    };
  }
  const findings = scanLockfilePinning(workflowsDir);
  const { pinned, guarded } = countLockfilePinned(workflowsDir);
  if (findings.length > 0) {
    const sample = findings
      .slice(0, 3)
      .map((f) => `${f.workflow}:${f.line} (${f.kind})`)
      .join("; ");
    return {
      check: "check:lockfile-pinning",
      blocking: true,
      state: "fail",
      detail: `${findings.length} unpinned install(s): ${sample}`,
    };
  }
  return {
    check: "check:lockfile-pinning",
    blocking: true,
    state: "pass",
    detail: `0 unpinned installs (${pinned} --frozen-lockfile, ${guarded} fallback-guarded across ${files.length} workflow(s))`,
  };
}

function resolveExpectedBunPin(root: string): string | undefined {
  const candidates = [
    join(root, ".bun-version"),
    join(root, "cat-harness", ".bun-version"),
    resolve(root, "..", "cat-harness", ".bun-version"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const pin = readPinFile(readFileSync(candidate, "utf-8"));
      if (pin !== undefined) return pin;
    }
  }
  return undefined;
}

export function checkBunPinForRoot(root = CORE_ROOT): GateResult {
  const workflowsDir = join(root, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    return {
      check: "check:bun-pin",
      blocking: true,
      state: "unknown",
      detail: "no .github/workflows directory",
    };
  }
  const files = workflowFiles(workflowsDir);
  if (files.length === 0) {
    return {
      check: "check:bun-pin",
      blocking: true,
      state: "unknown",
      detail: "no workflow YAML files in .github/workflows",
    };
  }
  const expected = resolveExpectedBunPin(root);
  let sites = 0;
  const findings: string[] = [];
  for (const f of files) {
    const lines = readFileSync(join(workflowsDir, f), "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const u = parseUses(lines[i]);
      if (!u || u.action !== "oven-sh/setup-bun") continue;
      sites++;
      let foundVersion: string | undefined;
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        const line = lines[j];
        if (/^\s*-\s+/.test(line)) break;
        const m = /^\s*bun-version\s*:\s*["']?([^"'#\s]+)["']?/.exec(line);
        if (m) {
          foundVersion = m[1];
          break;
        }
      }
      if (foundVersion === undefined) {
        findings.push(`${f}:${i + 1} (no bun-version)`);
      } else if (expected !== undefined && foundVersion !== expected) {
        findings.push(`${f}:${i + 1} (bun-version: ${foundVersion}, expected ${expected})`);
      }
    }
  }
  if (sites > 0 && expected === undefined) {
    return {
      check: "check:bun-pin",
      blocking: true,
      state: "unknown",
      detail: `${sites} setup-bun step(s) found but no .bun-version pin file could be read`,
    };
  }
  if (findings.length > 0) {
    return {
      check: "check:bun-pin",
      blocking: true,
      state: "fail",
      detail: `${findings.length} setup-bun step(s) do not pin ${expected ?? "expected version"}: ${findings.slice(0, 3).join("; ")}`,
    };
  }
  return {
    check: "check:bun-pin",
    blocking: true,
    state: "pass",
    detail:
      sites === 0
        ? `0 direct setup-bun steps across ${files.length} workflow(s) (delegated to reusable workflows)`
        : `${sites} setup-bun step(s) pinned to ${expected}`,
  };
}

export function checkMaterializedFixityForRoot(root = CORE_ROOT): GateResult {
  try {
    const verdicts = runMaterializedFixity(root);
    const mismatch = verdicts.filter((v) => v.kind === "mismatch");
    const absent = verdicts.filter((v) => v.kind === "absent");
    if (mismatch.length > 0 || absent.length > 0) {
      return {
        check: "check:materialized-fixity",
        blocking: true,
        state: "fail",
        detail: `${mismatch.length} edited in place, ${absent.length} missing`,
      };
    }
    return {
      check: "check:materialized-fixity",
      blocking: true,
      state: "pass",
      detail: `${verdicts.length} materialized artefact(s) checked, 0 mismatches, 0 missing`,
    };
  } catch (e) {
    return {
      check: "check:materialized-fixity",
      blocking: true,
      state: "unknown",
      detail: `could not check materialized fixity: ${String(e)}`,
    };
  }
}

export function checkActionPinningForRoot(root = CORE_ROOT): GateResult[] {
  const workflowsDir = join(root, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    return [
      {
        check: "action-sha-pinning",
        blocking: true,
        state: "unknown",
        detail: "no .github/workflows directory",
      },
    ];
  }
  const files = workflowFiles(workflowsDir);
  if (files.length === 0) {
    return [
      {
        check: "action-sha-pinning",
        blocking: true,
        state: "unknown",
        detail: "no workflow YAML files in .github/workflows",
      },
    ];
  }
  const unpinned: string[] = [];
  const stagingUnpinned: string[] = [];
  const dockerUndigested: string[] = [];
  let total = 0;

  for (const f of files) {
    const text = readFileSync(join(workflowsDir, f), "utf-8");
    const exempt = stagingExempt(f, text);
    text.split("\n").forEach((line, i) => {
      const d = parseDockerUses(line);
      if (d) {
        if (!d.digest) dockerUndigested.push(`${f}:${i + 1} docker://${d.image}`);
        return;
      }
      const u = parseUses(line);
      if (!u) return;
      total++;
      if (u.pinned) return;
      const why =
        u.status === "unpinned-unlabelled" ? " (unpinned-unlabelled: no # <ref>)" : "";
      (exempt ? stagingUnpinned : unpinned).push(`${f}:${i + 1} ${u.action}@${u.ref}${why}`);
    });
  }

  const published: GateResult =
    unpinned.length === 0
      ? {
          check: "action-sha-pinning",
          blocking: true,
          state: "pass",
          detail: `every uses: outside exempt staging workflows is SHA-pinned with # <ref> (${total} in all)`,
        }
      : {
          check: "action-sha-pinning",
          blocking: true,
          state: "fail",
          detail: `${unpinned.length} unpinned uses: reference(s): ${unpinned.slice(0, 3).join("; ")}`,
        };
  const staging: GateResult = {
    check: "action-sha-pinning (exempt staging)",
    blocking: false,
    state: stagingUnpinned.length === 0 ? "pass" : "fail",
    detail:
      stagingUnpinned.length === 0
        ? "exempt staging workflows are pinned too, or there are none"
        : `${stagingUnpinned.length} unpinned in exempt staging workflows`,
  };
  const docker: GateResult = {
    check: "docker-image-digest-pinning",
    blocking: false,
    state: dockerUndigested.length === 0 ? "pass" : "fail",
    detail:
      dockerUndigested.length === 0
        ? "every docker:// step carries an @sha256: digest, or there are none"
        : `${dockerUndigested.length} docker:// step(s) by tag, not @sha256: digest: ${dockerUndigested.slice(0, 3).join("; ")}`,
  };
  return [published, staging, docker];
}

function parseSemver(v: string): [number, number, number] | undefined {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return undefined;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverAtLeast(v: string, floor: [number, number, number]): boolean {
  const parsed = parseSemver(v);
  if (!parsed) return false;
  for (let i = 0; i < 3; i++) {
    if (parsed[i] > floor[i]) return true;
    if (parsed[i] < floor[i]) return false;
  }
  return true;
}

export function checkDependencyAdvisoriesForRoot(root = CORE_ROOT): GateResult {
  const lockPath = join(root, "bun.lock");
  if (!existsSync(lockPath)) {
    return {
      check: "check:dependency-advisories",
      blocking: false,
      state: "unknown",
      detail: "no bun.lock in target root",
    };
  }
  const text = readFileSync(lockPath, "utf-8");
  const floors: ReadonlyArray<{ pkg: string; min: [number, number, number]; label: string }> = [
    { pkg: "undici", min: [6, 29, 1], label: "6.29.1" },
    { pkg: "minimatch", min: [11, 0, 1], label: "11.0.1" },
    { pkg: "zod", min: [4, 6, 6], label: "4.6.6" },
  ];
  const below: string[] = [];
  for (const { pkg, min, label } of floors) {
    const re = new RegExp(`"${pkg}@([^"]+)"`, "g");
    const versions = [...text.matchAll(re)].map((m) => m[1]);
    if (versions.length === 0) {
      below.push(`${pkg} (not found in bun.lock)`);
      continue;
    }
    for (const v of versions) {
      if (!semverAtLeast(v, min)) {
        below.push(`${pkg}@${v} < ${label}`);
      }
    }
  }
  if (below.length > 0) {
    return {
      check: "check:dependency-advisories",
      blocking: false,
      state: "fail",
      detail: `advisory floor violation(s): ${below.join(", ")}`,
    };
  }
  return {
    check: "check:dependency-advisories",
    blocking: false,
    state: "pass",
    detail: "undici >= 6.29.1, minimatch >= 11.0.1, zod >= 4.6.6 verified in bun.lock",
  };
}

export function coreSecurityGate(root = CORE_ROOT): GateResult[] {
  return [
    checkWorkflowInjectionForRoot(root),
    checkSecretLeaksForRoot(root),
    checkLockfilePinningForRoot(root),
    checkBunPinForRoot(root),
    checkMaterializedFixityForRoot(root),
    checkDependencyAdvisoriesForRoot(root),
    ...checkActionPinningForRoot(root),
  ];
}

export { blocks, type GateResult, type SecurityGateReport };

if (import.meta.main) {
  const args = process.argv.slice(2);
  const rootIdx = args.indexOf("--root");
  const targetRoot =
    rootIdx >= 0 && args[rootIdx + 1] ? resolve(args[rootIdx + 1]) : CORE_ROOT;
  const results = coreSecurityGate(targetRoot);
  const stop = blocks(results);
  if (args.includes("--json")) {
    const report: SecurityGateReport = {
      $schema: "folio-security-gate/v1",
      results,
      blocked: stop.length > 0,
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of results) {
      const mark = r.state === "pass" ? "✓" : r.state === "fail" ? "✗" : "?";
      console.log(
        `${mark} ${r.check}${r.blocking ? "" : " (advisory)"} — ${r.state}${r.detail ? `: ${r.detail}` : ""}`,
      );
    }
    console.log(
      stop.length === 0
        ? "\nsecurity:gate: no blocking finding. Advisory findings above are reported, not cleared."
        : `\nsecurity:gate: REFUSED — ${stop.length} blocking check(s) failed or could not be run.`,
    );
  }
  process.exit(stop.length === 0 ? 0 : 1);
}
