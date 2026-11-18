#!/usr/bin/env bun
/**
 * The claims `AGENTS.md` makes ABOUT CODE are checked against the code.
 *
 * @module scripts/check-agents-claims
 * @covers code — its subject is the CODE a prose claim asserts about — the symbols and paths it
 *   names. The `AGENTS.md` it reads is this layer's declared `agent-instructions` asset
 *
 * `check:agents-xref` verifies citations INTO `AGENTS.md`,
 * `check:agent-entry-links` verifies links OUT of it; this reads what the
 * prose ASSERTS.
 *
 * ## Two claim shapes
 *
 * **LOCATION** — `` `symbol` in `module.ts` ``. Catches a symbol renamed or
 * removed while the prose kept its old name.
 *
 * **ABSENCE** — `` `symbol` `` … "has no caller", "nothing calls it", "is not
 * reachable". A stale gap notice is worse than none: an agent that believes
 * it either avoids the feature or rebuilds it.
 *
 * A claim about a config file's CONTENTS is caught by neither, and the report
 * says so.
 *
 * ## It does not grep English
 *
 * Every claim must carry a BACKTICKED symbol and a recognised shape; anything
 * else is counted as **not parsed** and reported as its own state. A sentence
 * the checker did not understand is not a sentence it verified.
 *
 * Usage:  bun run cat check:agents-claims
 * Exit:   0 clean · 1 a claim is false · 2 nothing could be parsed
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { AGENT_INSTRUCTIONS_ROLE, declaredAssetPath, repoRootFor } from "../schemas/kg/cat-harness.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const HERE = resolve(HARNESS_ROOT);
const REPO = repoRootFor(HERE);

/**
 * The file whose claims are checked: THIS layer's declared
 * `agent-instructions`.
 *
 * It was the checkout root's `AGENTS.md` until 2026-10-09. The root of an
 * index checkout declares no layer, and its `AGENTS.md` became a RENDERED
 * file (`scripts/index-render.ts`) — an index of the layers, carrying no
 * claim about code. The pointers it held, claims included, moved to this
 * layer's own `AGENTS.md`, so that is where they are checked; and it works
 * the same in a checkout of this layer standing alone, where there is no root
 * file to read.
 */
export function agentsFile(instanceRoot: string = HERE): string {
  return declaredAssetPath(instanceRoot, AGENT_INSTRUCTIONS_ROLE) ?? join(instanceRoot, "AGENTS.md");
}

/**
 * Roots a cited module path may be written relative to: the checkout, this
 * layer, and this layer's `src/`. The layer is located rather than
 * spelled — it was the literal `cat-harness`, which named nothing in a clone
 * of this layer under any other directory name.
 */
const HERE_IN_REPO = relative(REPO, HERE).split("\\").join("/");
const BASES = ["", HERE_IN_REPO, `${HERE_IN_REPO}/src`];

export interface Claim {
  kind: "location" | "absence";
  symbol: string;
  /** The module, for a location claim. */
  module?: string;
  /** The sentence, trimmed, so a report names what it read. */
  sentence: string;
}

/**
 * Flatten the document so a claim can span lines.
 *
 * Blockquote markers and list bullets are stripped FIRST: the claims that went
 * stale were inside `>` blocks, and a continuation line carrying `>` is what
 * stopped a naive whitespace match from bridging them.
 */
export function normalise(md: string): string {
  let s = md.replace(/```[\s\S]*?```/g, " "); // fenced code is not prose
  s = s.replace(/^[ \t]*(?:>[ \t]*)+/gm, " ");
  s = s.replace(/^[ \t]*[-*+][ \t]+/gm, " ");
  return s.replace(/\s+/g, " ");
}

/**
 * Claims of the form `` `A` `` (and `` `B` ``)* in `` `module` ``.
 *
 * Coordination is accepted only WITHOUT a comma. `` `A` and `B` in `M` `` is
 * one claim about two symbols; `` …`A`, and `B` in `M` `` is a clause
 * boundary, and treating it as a list produced a real false positive —
 * `DocumentContentAdapter` attributed to `schemas/content/block-kinds.ts`, which it
 * has nothing to do with. A checker that cries wolf is one somebody switches
 * off, so the comma is respected.
 */
export function locationClaims(norm: string): Claim[] {
  const pat =
    /(`[A-Za-z_$][\w$.]*`(?:\s+(?:and|or)\s+`[A-Za-z_$][\w$.]*`)*)\s+in\s+`([^`]+\.(?:ts|tsx|js|json))`/g;
  const out: Claim[] = [];
  for (const m of norm.matchAll(pat)) {
    for (const sym of [...m[1]!.matchAll(/`([^`]+)`/g)].map((x) => x[1]!)) {
      out.push({ kind: "location", symbol: sym, module: m[2]!, sentence: m[0]! });
    }
  }
  return out;
}

/** Phrases that assert a symbol is unused or unreachable. */
const ABSENCE = /\b(?:has\s+)?no\s+caller|nothing\s+(?:calls|reads|uses)\s+it|not\s+yet\s+reachable|is\s+never\s+called/i;

/**
 * Claims that a symbol has no caller.
 *
 * Scoped to one sentence, and the sentence must carry exactly one backticked
 * identifier — with two, which of them the phrase is about is a guess, and a
 * guess here is a false finding on the file every agent reads first.
 */
export function absenceClaims(norm: string): Claim[] {
  const out: Claim[] = [];
  for (const sentence of norm.split(/(?<=[.!?])\s+/)) {
    if (!ABSENCE.test(sentence)) continue;
    const syms = [...sentence.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((m) => m[1]!);
    if (syms.length !== 1) continue;
    out.push({ kind: "absence", symbol: syms[0]!, sentence: sentence.trim() });
  }
  return out;
}

/** Resolve a cited module path against the roots it might be written from. */
export function resolveModule(repo: string, cited: string): string | undefined {
  for (const b of BASES) {
    const p = join(repo, b, cited);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Resolve a module an AGENTS.md cites: against the checkout's roots, then
 * against this tools layer, which holds the code a harness AGENTS.md names
 * since it moved here (beans `70lx`, `8lcl`).
 */
export function resolveCitedModule(repo: string, cited: string): string | undefined {
  return resolveModule(repo, cited) ?? resolveModule(TOOLS_ROOT, cited);
}

/** Does `module` declare `symbol`? `A.B` asks for a member of `A`. */
export function declares(src: string, symbol: string): boolean {
  const [head, member] = symbol.split(".");
  const decl = new RegExp(
    `\\b(?:export\\s+)?(?:const|let|var|function|class|interface|type|enum)\\s+${head!.replace(/\$/g, "\\$")}\\b`,
  );
  if (!decl.test(src)) return false;
  if (member === undefined) return true;
  // A member is asked for by name anywhere in the file. Parsing the interface
  // body properly would need a TypeScript AST; the cheap test is enough to
  // catch a field renamed away, and it never reports a member that is there.
  return new RegExp(`\\b${member.replace(/\$/g, "\\$")}\\b`).test(src);
}

/**
 * Every `.ts` file GIT accounts for, minus the trees this check does not read.
 *
 * `xd1g`. Two different exclusions used to sit in one `SKIP` set and they are
 * not the same kind of thing. `_site`, `dist`, `build` and `.lake` are
 * GENERATED and gitignored — git now excludes them, by rule rather than by
 * whoever remembered to name them. `docs` and `translations` are TRACKED
 * content this check deliberately does not read, so they stay listed here,
 * which is what makes them legible as a choice.
 *
 * Measured at the conversion: **1290 before, 1290 after** — behaviour-
 * identical today, because the hand-written list happened to name the
 * generated trees that currently exist. That is correct by coincidence, and
 * the next one nobody names is `check-code-accounting`'s `dist/index.d.ts`.
 */
function sourceFiles(repo: string): string[] {
  const NOT_READ = new Set(["docs", "translations"]);
  return gitFiles(
    repo,
    (rel) => {
      const segs = rel.split("/");
      if (segs.some((s) => s.startsWith(".") || NOT_READ.has(s))) return false;
      return /\.(ts|tsx)$/.test(rel) && statSync(join(repo, rel)).size < 2_000_000;
    },
  ).files;
}

/**
 * Files that reference `symbol` other than the one declaring it.
 *
 * Comments are stripped first. This repository has already paid for a check
 * that grepped source TEXT and went red on a documentation comment — the
 * repair was `codeWithoutComments`, and the same trap is live here: `AGENTS.md`
 * quotes these symbol names, and so do the modules' own docstrings.
 */
export function callersOf(repo: string, symbol: string): string[] {
  const re = new RegExp(`\\b${symbol.replace(/\$/g, "\\$")}\\b`);
  const out: string[] = [];
  for (const f of sourceFiles(repo)) {
    const code = readFileSync(f, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/.*$/gm, " ");
    if (re.test(code)) out.push(relative(repo, f));
  }
  return out;
}

export interface Finding {
  claim: Claim;
  reason: string;
}

export function checkClaims(repo: string, md: string): { claims: Claim[]; findings: Finding[] } {
  const norm = normalise(md);
  const claims = [...locationClaims(norm), ...absenceClaims(norm)];
  const findings: Finding[] = [];

  for (const c of claims) {
    if (c.kind === "location") {
      const file = resolveCitedModule(repo, c.module!);
      if (file === undefined) {
        findings.push({ claim: c, reason: `no such module: ${c.module}` });
        continue;
      }
      if (!declares(readFileSync(file, "utf-8"), c.symbol)) {
        findings.push({
          claim: c,
          reason: `${relative(repo, file)} declares no \`${c.symbol}\``,
        });
      }
      continue;
    }
    // ABSENCE — the costly class. The claim is FALSE when a caller exists
    // SOMEWHERE ELSE, which needs two exclusions that a first draft missed:
    //
    //   - the DECLARING file. A symbol referenced only where it is defined
    //     has no caller, and reporting its own declaration as one would turn
    //     a true gap notice into a finding.
    //   - TESTS. A function exercised only by its own unit test is precisely
    //     what "not yet wired in" means; counting that as a caller would
    //     contradict the claim while agreeing with it.
    //
    // Both were visible in the historical case: of four files referencing
    // `resolveSkillDirs`, one was its declaration and one its test. The claim
    // was false because of the third, `src/tools/skill-fetch.ts`.
    const all = callersOf(repo, c.symbol);
    const declaring = all.filter((f) => declares(readFileSync(join(repo, f), "utf-8"), c.symbol));
    const rest = all.filter((f) => !declaring.includes(f));
    const tests = rest.filter((f) => /\.(test|spec)\.[cm]?tsx?$|(^|\/)tests?\//.test(f));
    const real = rest.filter((f) => !tests.includes(f));
    if (real.length > 0) {
      findings.push({
        claim: c,
        reason:
          `claims \`${c.symbol}\` has no caller, but ${real.length} file(s) call it: ` +
          `${real.slice(0, 3).join(", ")}${real.length > 3 ? ", …" : ""}` +
          (tests.length > 0 ? ` (plus ${tests.length} test file(s), which would not by itself refute it)` : ""),
      });
    }
  }
  return { claims, findings };
}

if (import.meta.main) {
  const file = agentsFile();
  if (!existsSync(file)) {
    console.error(`✗ no AGENTS.md at ${file}`);
    process.exit(2);
  }
  const { claims, findings } = checkClaims(REPO, readFileSync(file, "utf-8"));
  const loc = claims.filter((c) => c.kind === "location").length;
  const abs = claims.filter((c) => c.kind === "absence").length;

  console.log(`${relative(REPO, file)} claims about code — ${loc} location, ${abs} absence\n`);

  // A green run over zero parsed claims is not a green run. The file is
  // thousands of words of prose about this codebase; parsing none of it means
  // the shapes changed, not that the prose became true.
  if (claims.length === 0) {
    console.error(
      "✗ NOT ONE claim could be parsed. That is a broken checker, not a clean file — " +
        "a sentence this tool did not understand is not a sentence it verified.",
    );
    process.exit(2);
  }

  for (const c of claims) {
    const bad = findings.find((f) => f.claim === c);
    const where = c.kind === "location" ? `in ${c.module}` : "(no caller)";
    console.log(`  ${bad ? "✗" : "✓"} ${c.symbol.padEnd(26)} ${where}`);
  }

  if (findings.length > 0) {
    console.error(`\n✗ ${findings.length} claim(s) are FALSE:\n`);
    for (const f of findings) {
      console.error(`  \`${f.claim.symbol}\` — ${f.reason}`);
      console.error(`      “${f.claim.sentence.slice(0, 150)}”`);
    }
    console.error(
      "\nAGENTS.md's own banner: a stale gap notice is worse than none, because an\n" +
        "agent that believes it either avoids the feature or rebuilds it.",
    );
    process.exit(1);
  }

  console.log(`\nEvery parsed claim holds.`);
  console.log(
    `NOT checked: prose naming no backticked symbol, and claims about a config\n` +
      `file's contents — bean \`77ex\`'s second example is of that shape.`,
  );
  process.exit(0);
}
