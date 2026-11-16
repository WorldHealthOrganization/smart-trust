/**
 * What the prose side of a declared pair says about the code side, checked
 * where it can be — and counted where it cannot.
 *
 * @module scripts/pair-claims
 *
 * Claims naming a resolvable thing are checked mechanically; anything else is
 * not parsed, counted, never passed. It generalises `check:agents-claims`
 * from `AGENTS.md` to every declared prose ↔ code pair, and reuses that
 * module's claim shapes rather than restating them.
 *
 * ## Three outcomes per claim
 *
 * `holds` · `false` · `undetermined`. Many claims name things in a FOLIO's
 * repository (`bun run validate-refs`, `content/schema/references.ts`) that
 * this platform cannot resolve, so they are `undetermined`, not `false`:
 *
 * - a cited path is `false` only when the DIRECTORY it names exists here — the
 *   check can then honestly say the file is not in it. A path whose directory
 *   is not here points outside this repository and is `undetermined`;
 * - `folio-assistant/…` is tried as this layer's own root, because that is
 *   where a folio mounts the platform, and adapter skills are written from a
 *   folio's point of view;
 * - `bun run <name>` is `holds` when the root `package.json` has the script,
 *   and otherwise `undetermined` — there is no declaration saying which
 *   `package.json` a skill means.
 *
 * ## The shapes
 *
 * | shape | from | false when |
 * |---|---|---|
 * | location | `` `Sym` in `path.ts` `` (from `check-agents-claims`) | the module is missing from an existing directory, or does not declare `Sym` |
 * | absence | `` `sym` `` + "has no caller" (from `check-agents-claims`) | a non-test, non-declaring file references it |
 * | file-run | `` `bun run path/to/x.ts` `` | the file's directory exists here and the file does not |
 * | job | `# bpmn-node: <id>` inside a workflow's job | the diagram the workflow names has no element with that id |
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { absenceClaims, checkClaims, declares, locationClaims, normalise } from "./check-agents-claims.js";
import type { ProseCodePair } from "./prose-code-pairs.js";
import { bpmnIds, workflowBpmn } from "./workflow-bpmn.js";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

export type ClaimOutcome = "holds" | "false" | "undetermined";

export interface PairClaim {
  shape: "location" | "absence" | "file-run" | "script" | "job";
  /** What the prose names — a symbol, a path, a script or a job. */
  subject: string;
  outcome: ClaimOutcome;
  reason?: string;
}

/** Roots a cited path may be written from, including a folio's view of the platform. */
const ALIASES: [string, string][] = [
  ["folio-assistant/", "cat-harness/"],
];

const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory();

/** A cited path: found, or missing from a directory that exists here, or neither. */
export function resolveCited(repo: string, cited: string): { file?: string; knownDir: boolean } {
  const spellings = [cited, ...ALIASES.filter(([a]) => cited.startsWith(a)).map(([a, b]) => b + cited.slice(a.length))];
  const bases = ["", "cat-harness", "cat-harness/src"];
  let knownDir = false;
  for (const s of spellings) {
    for (const b of bases) {
      const p = join(repo, b, s);
      if (existsSync(p) && !isDir(p)) return { file: p, knownDir: true };
      const d = dirname(p);
      // A bare filename's directory is a base itself, which says nothing about
      // where the file was meant to be.
      if (s.includes("/") && isDir(d)) knownDir = true;
    }
  }
  return { knownDir };
}

/** The prose of a pair: a skill's markdown, or every <documentation> in a diagram. */
export function proseOf(repo: string, pair: ProseCodePair): string {
  const text = readFileSync(join(repo, pair.prose), "utf-8");
  if (pair.kind !== "implements") return text;
  return [...text.matchAll(/<(?:bpmn:)?documentation>([\s\S]*?)<\/(?:bpmn:)?documentation>/g)]
    .map((m) => m[1]!)
    .join("\n\n");
}

/** Every claim one pair's prose makes, judged. */
export function judgePair(repo: string, pair: ProseCodePair, scripts: ReadonlySet<string>): PairClaim[] {
  const out: PairClaim[] = [];
  const prose = proseOf(repo, pair);
  const norm = normalise(prose);

  // Location and absence: reuse check-agents-claims wholesale, then soften a
  // "no such module" whose directory is not here into undetermined.
  const { findings } = checkClaims(repo, prose);
  const bad = new Map(findings.map((f) => [f.claim, f.reason]));
  for (const c of [...locationClaims(norm), ...absenceClaims(norm)]) {
    const reason = [...bad].find(([k]) => k.symbol === c.symbol && k.kind === c.kind && k.sentence === c.sentence)?.[1];
    if (c.kind === "location") {
      const r = resolveCited(repo, c.module!);
      if (r.file) {
        const declared = declares(readFileSync(r.file, "utf-8"), c.symbol);
        out.push({ shape: "location", subject: `${c.symbol} in ${c.module}`, outcome: declared ? "holds" : "false", ...(declared ? {} : { reason: `${c.module} declares no \`${c.symbol}\`` }) });
      } else {
        out.push({
          shape: "location",
          subject: `${c.symbol} in ${c.module}`,
          outcome: r.knownDir ? "false" : "undetermined",
          reason: r.knownDir ? `no ${c.module} — its directory exists here and the file is not in it` : `${c.module} is not in this repository (a folio's file?)`,
        });
      }
    } else {
      out.push({ shape: "absence", subject: c.symbol, outcome: reason ? "false" : "holds", ...(reason ? { reason } : {}) });
    }
  }

  // `bun run <x>`: a path to a file, or a script name.
  for (const m of norm.matchAll(/`bun run (?:cat )?([^\s`]+)/g)) {
    const arg = m[1]!;
    if (/[/.]/.test(arg)) {
      if (!/\.[cm]?[jt]sx?$/.test(arg)) continue; // a flag or something else — not a claim this parses
      const r = resolveCited(repo, arg);
      out.push({
        shape: "file-run",
        subject: arg,
        outcome: r.file ? "holds" : r.knownDir ? "false" : "undetermined",
        ...(r.file ? {} : { reason: r.knownDir ? `no ${arg} — its directory exists here` : `${arg} is not in this repository` }),
      });
    } else {
      out.push({
        shape: "script",
        subject: arg,
        outcome: scripts.has(arg) ? "holds" : "undetermined",
        ...(scripts.has(arg) ? {} : { reason: "not a script in this repository's package.json — which package.json the prose means is not declared" }),
      });
    }
  }

  // Each job's named node against the diagram. The workflow holds the
  // pointer (bean `61ca`), so a missing workflow means no claim was made.
  if (pair.kind === "implements") {
    const wf = join(repo, pair.code);
    if (existsSync(wf)) {
      const ids = bpmnIds(readFileSync(join(repo, pair.prose), "utf-8"));
      for (const { job, node } of workflowBpmn(readFileSync(wf, "utf-8")).nodes) {
        const has = ids.has(node);
        out.push({ shape: "job", subject: `${job} → ${node}`, outcome: has ? "holds" : "false", ...(has ? {} : { reason: `${pair.prose} has no element \`${node}\`` }) });
      }
    }
  }
  return out;
}

/**
 * One subject's claims, folded into a kg-qa criterion entry.
 *
 * `fail` if any claim is false; `unknown` if every parsed claim was
 * undetermined (nothing could be checked, which is not a pass); `pass`
 * otherwise; `n/a` when the subject declares no pair or its prose makes no
 * claim this parses.
 */
export function claimsEntry(claims: PairClaim[]): { result: "pass" | "fail" | "n/a" | "unknown"; findings: { where: string; detail: string }[] } {
  if (claims.length === 0) return { result: "n/a", findings: [] };
  const bad = claims.filter((c) => c.outcome === "false");
  if (bad.length) return { result: "fail", findings: bad.map((c) => ({ where: c.subject, detail: `${c.shape}: ${c.reason ?? "false"}` })) };
  if (claims.every((c) => c.outcome === "undetermined")) {
    return { result: "unknown", findings: claims.map((c) => ({ where: c.subject, detail: `${c.shape}: ${c.reason ?? "undetermined"}` })) };
  }
  return { result: "pass", findings: [] };
}

/**
 * Script names in the root package.json — EMPTY when the checkout has none.
 *
 * A layer standing alone (bean `ho66`) is its own checkout and carries no
 * package.json of the aggregate's. Throwing there took the whole `kg:audit` run
 * down with it; an empty set makes every script claim `undetermined` instead
 * (see {@link judgePair}), which is what the checkout can honestly say.
 */
export function rootScripts(repo: string): Set<string> {
  if (!existsSync(join(repo, "package.json"))) return new Set();
  return new Set(Object.keys(scriptsOf(repo)));
}

if (import.meta.main) {
  const { readdirSync } = await import("node:fs");
  const { discoverPairs } = await import("./prose-code-pairs.js");
  const { isSkillMd, skillMdDirs, workflowFiles } = await import("./known-skills.js");
  const repo = join(dirname(HARNESS_ROOT));
  const inst = join(HARNESS_ROOT);
  // The DECLARED directories, not literals — the same helpers kg-audit reads.
  // `.claude/skills/*` entries are relative to the REPOSITORY, the rest to the layer.
  const skillMds = skillMdDirs(inst).flatMap((segs) => {
    const dir = [join(inst, ...segs), join(repo, ...segs)].find((d) => isDir(d));
    if (!dir) return [];
    return readdirSync(dir).filter((f) => f.endsWith(".md") && isSkillMd(join(dir, f))).map((f) => join(dir, f));
  });
  const subjects = [
    ...skillMds.map((f) => ({ kind: "skill", path: relative(inst, f) })),
    ...workflowFiles(inst).filter((f) => f.endsWith(".bpmn")).map((f) => ({ kind: "process", path: relative(inst, f) })),
  ];
  const scripts = rootScripts(repo);
  const tally: Record<ClaimOutcome, number> = { holds: 0, false: 0, undetermined: 0 };
  let pairs = 0;
  const lines: string[] = [];
  for (const s of subjects) {
    for (const p of discoverPairs(s, inst, repo)) {
      pairs += 1;
      for (const c of judgePair(repo, p, scripts)) {
        tally[c.outcome] += 1;
        if (c.outcome !== "holds") lines.push(`  ${c.outcome === "false" ? "✗" : "?"} ${p.prose}  ${c.shape} ${c.subject} — ${c.reason ?? ""}`);
      }
    }
  }
  console.log(`Declared prose/code pairs: ${pairs} — claims: ${tally.holds} hold, ${tally.false} false, ${tally.undetermined} undetermined`);
  for (const l of lines) console.log(l);
  console.log("NOT checked: prose naming no backticked symbol, path or script, and any undeclared pair (issue #1042, R1/R3).");
  if (tally.holds + tally.false + tally.undetermined === 0) {
    console.error("✗ no claim parsed across any declared pair — a broken checker, not a clean corpus");
    process.exit(2);
  }
  process.exit(tally.false > 0 ? 1 : 0);
}
