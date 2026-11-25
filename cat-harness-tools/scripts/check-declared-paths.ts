#!/usr/bin/env bun
/**
 * A path a declaration could have answered is not written down in code.
 *
 * The layer's declaration says where its graphs live; a literal such as
 * `processes` hardcoded at a call site turns a topical split into a many-file
 * edit, and a list of such sites always misses some. So this is a gate.
 *
 * ## The rule
 *
 * Hardcoding is permitted but discouraged, so it must be **declared and
 * checked**. A literal naming a declared directory is allowed when:
 *
 *  - **it names a FILE that exists, and the witness list records it.**
 *    Authored prose naming one specific artefact —
 *    `source: "processes/crdm-requirements.bpmn"` in a docs page — is not
 *    discovery and no declaration would answer it. Witnesses are **checked to
 *    resolve**.
 *
 *    The witness list is a one-way baseline, since a declared subgraph's
 *    source may move: a NEW literal naming an existing file fails, and
 *    `--update` may drop a witness but never adds one. A MOVE is not a new
 *    literal: a witness whose literal left its file and is now named in
 *    another is carried by `--update` one for one (`relocatedWitnesses`).
 *  - **it carries `declared-path-literal: <reason>`** in a comment on its own
 *    line or the line above — e.g. the module that supplies the defaults, the
 *    scaffolder that CREATES the layout. Same shape as
 *    `<cat-harness.processes:no-skill reason="…"/>`: exempt, but the reason is
 *    required, and the marked sites are COUNTED in the summary.
 *
 * Everything else — a literal naming a declared DIRECTORY, or naming nothing
 * that resolves — is refused, with the helper that answers it named.
 *
 * ## What it does not look at
 *
 * Comments (a path in prose is documentation), and placeholders (`${…}`,
 * `<locale>`), since a template is not a path a declaration could answer.
 *
 * ## Tests
 *
 * Tests ARE scanned, but are outside the count ratchet: a test that builds a
 * fixture tree names declared directories by necessity. They are governed by
 * the **witness list** (`witnessesOf`, `resolves` in the baseline): the gate
 * fires when a recorded witness stops resolving, which is relocation and
 * nothing else.
 *
 * ## A ratchet, not a wall
 *
 * Existing hardcoded literals in source are recorded debt. The baseline is
 * COMMITTED, **per file rather than per line** (a count churns less than a
 * line number), and a file may only ever lose literals. A new hardcode in a
 * file that had none fails immediately. `--update` rewrites it; raising a
 * count is printed loudly and shows up as a diff somebody reviews.
 *
 * ## A witness inside an ABSENT results tree is unknown, not lost
 *
 * A witness under a declared `qa` or `health` directory (e.g.
 * `test/results/`, `test/health/results/`) that is ABSENT from the checkout
 * (present only once `qa:fetch` has run) is reported as `?` *could not
 * determine*, neither lost nor new debt, and the run exits 2 when nothing
 * determined failed. `--update` refuses in that state.
 *
 * Usage:  bun run cat check:declared-paths  [--update]
 * Exit:   0 at or under baseline · 1 above it, or a marked literal naming nothing
 *         · 2 a witness could not be checked because its results tree is absent
 *
 * @covers cat-harness
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { docsSourceDirFor, readDeclaration, resolveDirectories } from "../schemas/kg/cat-harness.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { resolveImplementingPath } from "../schemas/kg/harness-config.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { legacyHarnessPath, subgraphHarnessPath } from "./lib/harness-layout.ts";
import { isJsonManifest } from "../pipeline/json-manifest.ts";

const root = resolve(HARNESS_ROOT);
const update = process.argv.includes("--update");
const BASELINE = join(TOOLS_ROOT, "scripts", "declared-path-baseline.json");

/**
 * The declared directories, as repo-relative prefixes.
 *
 * Read, never listed — a gate against hardcoded declared paths that hardcoded
 * the declared paths would be the joke that writes itself.
 */
function declaredPrefixes(root: string): string[] {
  return resolveDirectories([{ name: "(local)", root, own: true }])
    .filter((d) => !isAddressedByPath(d))
    .map((d) => d.path.replace(/\/+$/, ""))
    .filter((p) => p.length > 0)
    .sort((a, b) => b.length - a.length);
}

/**
 * Is this directory one you address BY PATH on purpose, rather than one you
 * DISCOVER through the declaration?
 *
 * ## Why the distinction, and why it had to be drawn
 *
 * This gate's rule is in its header: *a path a declaration could have answered
 * is not written down in code*. Every prefix it guarded when it was written
 * was a graph whose access pattern is discovery — `workflowDirs()` answers
 * "where are the processes", so a literal `processes/` is a site that would
 * break under a topical split.
 *
 * **A declaration cannot answer "which script is the gate runner".** Code
 * directories are named by path deliberately: `package.json` and the CI
 * workflows invoke `cat-harness/scripts/*.ts` by name, which is precisely what
 * `check:ci-invocations` and `check:command-paths` exist to keep honest. There
 * is no helper to reach for, so the finding this gate would raise names no
 * remedy.
 *
 * ## Measured, 2026-09-22, bean `ylj7`
 *
 * Declaring the four code directories took this gate from 0 refusals to
 * **822**, against a recorded baseline of 38 — a twentyfold jump, in one
 * change, with not one of them a real instance of the defect the gate
 * describes. A baseline bump would have hidden that; it would also have raised
 * the bar under every prefix where the rule DOES apply, which is the failure
 * mode a shared baseline has.
 *
 * So the scope is narrowed at the premise instead. The rule is unchanged for
 * every kind it was written for.
 *
 * ## It is a property of the KIND, never of the path
 *
 * Keyed on `code`, not on the strings `src`/`scripts`. Matching on a path
 * would exempt any future directory that happened to be called `scripts/`,
 * including one holding a graph you genuinely discover — and it would stop
 * exempting this one the moment it moved, which is the same reason overrides
 * here match on an entry's `id` rather than its `path`.
 *
 * A directory holding `code` AND a discoverable kind is NOT exempt: the
 * discoverable half is the access pattern that needs guarding, and a directory
 * is a place to look that may hold more than one part of a graph.
 */
export function isAddressedByPath(d: { graphTypologies?: readonly string[] }): boolean {
  const kinds = d.graphTypologies ?? [];
  return kinds.length > 0 && kinds.every((k) => k === "code");
}

/**
 * The kinds whose files are DERIVED results a process writes — and which, by
 * proposal §2 of `qa-reports-branch-and-test-process-2026-10-01.md`, live on
 * the `qa-reports` branch rather than in every checkout.
 */
const RESULT_KINDS = new Set(["qa", "health"]);

/**
 * Declared `qa` / `health` directories that are ABSENT from this checkout,
 * absolute. A literal under one of them cannot be checked here, which is a
 * different fact from naming nothing (bean `c8uq`).
 */
export function absentResultDirs(root: string): string[] {
  return resolveDirectories([{ name: "(local)", root, own: true }])
    .filter((d) => (d.graphTypologies ?? []).some((k) => RESULT_KINDS.has(k)))
    .map((d) => d.absPath)
    .filter((abs) => !existsSync(abs));
}

/**
 * Declared `qa` / `health` directories whose record lives on a branch
 * (`storage`), absolute. Even after one writer creates part of the working
 * copy on disk, any other recorded witness under the directory is still off
 * `main` and cannot be verified from the working tree alone (bean `7mwa`).
 */
export function storedResultDirs(root: string): string[] {
  return resolveDirectories([{ name: "(local)", root, own: true }])
    .filter((d) => (d.graphTypologies ?? []).some((k) => RESULT_KINDS.has(k)) && d.storage !== undefined)
    .map((d) => d.absPath);
}

/** Is `literal` (relative to `root`) inside one of `absent`? */
export function underAbsentResults(root: string, literal: string, absent: readonly string[]): boolean {
  const abs = join(root, literal);
  return absent.some((d) => abs === d.replace(/\/+$/, "") || abs.startsWith(d.replace(/\/+$/, "") + "/"));
}

/**
 * Is `literal` (relative to `root`) an artefact `root` declares it BUILDS AT
 * PUBLISH (`builtAtPublish`, `schemas/kg/built-at-publish.ts`; owner,
 * 2026-10-14, "B1")? Such a file is never committed and is on disk only after
 * `derive:publish`, so a recorded witness naming it is held by the
 * declaration when this checkout has not built it: absent is its correct
 * state here, not a lost artefact (the `check-declared-dirs.ts`
 * `builtAtPublishDirs` rule, for a file).
 */
export function underBuiltAtPublish(root: string, literal: string): boolean {
  const decl = readDeclaration(root) as { builtAtPublish?: Array<{ path: string }> } | undefined;
  return isBuiltAtPublish(decl?.builtAtPublish ?? [], literal.replace(/^\.\//, ""));
}

/**
 * Which helper answers a prefix, so a finding says what to do rather than
 * only what is wrong. Absent means "read the declaration" with no shorthand.
 */
const HELPERS: Record<string, string> = {
  skills: "skillMdDirs() / workflowDirs() / workflowFiles() in scripts/known-skills.ts",
  schemas: "resolveDirectories() in schemas/kg/cat-harness.ts",
};

/** Source trees this layer authors. Generated output is not code. */
const SOURCE_DIRS = ["src", "scripts", "schemas", "content", "tools", "adapters", "simulators", "computations"];

const MARKER = /declared-path-literal:\s*\S/;

/**
 * Which lines a marker covers: its own, and everything down to the next
 * blank line.
 *
 * "The line above" alone was tried first and is too tight to be usable — it
 * covers `write("beans/.gitkeep", "")` and not `DEFAULT_DIRECTORIES`, whose
 * eight entries sit on eight lines under one comment. Marking each entry
 * separately would put the same sentence in the file eight times, which is
 * the duplication this whole gate is about.
 *
 * A blank line is the boundary rather than a brace or an indent because it is
 * the one a reader already sees. The cost is that a marker can cover more
 * than its author meant; the marked literals are PRINTED with their reason on
 * every run, so an over-broad marker is visible rather than silent.
 */
/**
 * A Tool declared as data (`tools/<id>/<id>.json`, `"$schema": "tool-definition/v1"`,
 * bean `y9r6`) is scanned like code. Its comments live in a trailing
 * `$comment` list of `{ at, comment }`, `at` being a JSON pointer into `tool`.
 * That list is blanked out of the scan, as comments are in `.ts` (a path in
 * prose is not a reference), and a `declared-path-literal:` comment covers
 * the lines carrying the string(s) at its pointer. `undefined` for other JSON.
 */
export function toolDefinitionText(raw: string): { code: string; cover: Map<number, string> } | undefined {
  let parsed: { $schema?: unknown; tool?: unknown; $comment?: Array<{ at?: string; comment?: string }> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return undefined;
  }
  if (!parsed || parsed.$schema !== "tool-definition/v1") return undefined;
  const lines = raw.split("\n");
  const at = lines.findIndex((l) => /^\s*"\$comment":/.test(l));
  const end = at === -1 ? lines.length : at;
  const code = [...lines.slice(0, end), ...lines.slice(end).map((l) => " ".repeat(l.length))].join("\n");
  const cover = new Map<number, string>();
  const strings = (v: unknown): string[] =>
    typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
  for (const c of parsed.$comment ?? []) {
    const m = /declared-path-literal:\s*([\s\S]+)$/.exec(c.comment ?? "");
    if (m === null) continue;
    const reason = m[1]!.replace(/\s+/g, " ").trim();
    let node: unknown = parsed.tool;
    for (const k of (c.at ?? "").split("/").slice(1)) {
      const key = k.replace(/~1/g, "/").replace(/~0/g, "~");
      node = node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined;
    }
    for (const v of strings(node)) {
      const quoted = JSON.stringify(v);
      for (let n = 0; n < end; n++) if (lines[n]!.includes(quoted) && !cover.has(n)) cover.set(n, reason);
    }
  }
  return { code, cover };
}

export function markerCoverage(rawLines: string[]): Map<number, string> {
  const cover = new Map<number, string>();
  for (let n = 0; n < rawLines.length; n++) {
    if (!MARKER.test(rawLines[n]!)) continue;
    // The reason runs on into the comment lines below it — a one-line reason
    // is rarely the whole of one, and a truncated reason in the summary is
    // exactly as unhelpful as no reason.
    const parts = [/declared-path-literal:\s*(.+?)\s*(?:\*\/)?$/.exec(rawLines[n]!)?.[1] ?? ""];
    for (let m = n + 1; m < rawLines.length; m++) {
      const c = /^\s*(?:\/\/|\*)\s?(.*)$/.exec(rawLines[m]!);
      if (c === null || MARKER.test(rawLines[m]!)) break;
      parts.push(c[1]!.replace(/\s*\*\/\s*$/, "").trim());
    }
    const reason = parts.join(" ").replace(/\s+/g, " ").trim();
    for (let m = n; m < rawLines.length; m++) {
      if (rawLines[m]!.trim() === "") break;
      if (!cover.has(m)) cover.set(m, reason);
    }
  }
  return cover;
}

/**
 * Blank out comments, so a path in a doc block is not read as code.
 *
 * Runs before the literal scan for the same reason `ns-export`'s scanner
 * does: that one matched its own documentation and reported a phantom term.
 * Replaces with spaces rather than deleting, so line and column survive.
 *
 * ## Quote state resets at every newline, and that is a deliberate bound
 *
 * This is not a TypeScript parser and must not pretend to be one. It does not
 * understand REGEX LITERALS, and a regex containing a quote —
 * `/^"POT-Creation-Date:.*$/m`, which is real code in `translate-bpmn.ts` —
 * looks exactly like an opening string. Carrying that state forward
 * desynchronised the scanner for **the whole rest of the file**: measured
 * 2026-09-19, it reported a `beans/` inside a `//` comment as live code and
 * would equally have hidden real literals after any such line.
 *
 * Resetting EVERY quote mode at the newline bounds the damage to the one line
 * that confused it. Measured three ways over this corpus on 2026-09-19:
 * carrying all state forward reported 125, resetting only `'` and `"` reported
 * 120, and resetting the backtick too reports 117. Fewer each time — so the
 * multi-line template literals this was written to protect were themselves a
 * source of desync, not a thing worth carrying state for. The residue in each
 * case was BOTH extra findings and hidden ones, and the hidden half is what
 * made the state worth giving up.
 */
export function stripComments(text: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "line" | "block" | "s" | "d" | "t" = "code";
  while (i < text.length) {
    const c = text[i]!;
    const two = text.slice(i, i + 2);
    // A quote that never closed on its line was not a string — almost always
    // a regex literal or an apostrophe the scanner cannot tell from one.
    if (c === "\n" && mode !== "block" && mode !== "line") mode = "code";
    if (mode === "code") {
      if (two === "//") { mode = "line"; out += "  "; i += 2; continue; }
      if (two === "/*") { mode = "block"; out += "  "; i += 2; continue; }
      if (c === "'") mode = "s";
      else if (c === '"') mode = "d";
      else if (c === "`") mode = "t";
      out += c; i++; continue;
    }
    if (mode === "line") {
      if (c === "\n") { mode = "code"; out += c; } else out += " ";
      i++; continue;
    }
    if (mode === "block") {
      if (two === "*/") { mode = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? c : " "; i++; continue;
    }
    // inside a string: copy verbatim, honouring escapes
    if (c === "\\") { out += text.slice(i, i + 2); i += 2; continue; }
    if ((mode === "s" && c === "'") || (mode === "d" && c === '"') || (mode === "t" && c === "`")) mode = "code";
    out += c; i++;
  }
  return out;
}

/**
 * Offsets of every string literal sitting inside a path-building call.
 *
 * ## Why context and not shape alone
 *
 * A literal containing `/` is a path whatever surrounds it. A BARE segment is
 * not: `join(root, "processes")` is the nine-site defect this gate
 * exists for, and `{ id: "beans", module: … }` in `server.ts` is a tool-group
 * identifier that happens to spell a declared directory. Refusing both would
 * put ~100 identifiers in the findings, and `known-skills.ts`'s own header
 * says why that is fatal: *"a check that cries wolf is a check somebody
 * switches off"*.
 *
 * So a bare segment counts only where the code is demonstrably building a
 * path with it. Nesting is tracked, so `join(a, join(b, "skills"))` is caught
 * at the inner call.
 */
export function pathContextRanges(code: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const call = /\b(?:join|joinPath|resolve|relative)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(code)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < code.length && depth > 0) {
      const c = code[i]!;
      if (c === "(") depth++;
      else if (c === ")") depth--;
      i++;
    }
    out.push([start, i]);
  }
  return out;
}

/**
 * Offset of the first string literal inside a path-building call, or -1.
 *
 * "First" is what makes a bare segment a DECLARED directory rather than a
 * word: only the segment directly under the root can be one.
 */
export function firstLiteralIn(code: string, [a, b]: [number, number]): number {
  const re = /(["'`])(?:[^\\\n]|\\.)*?\1/g;
  re.lastIndex = a;
  const m = re.exec(code);
  return m !== null && m.index < b ? m.index : -1;
}

interface Site { file: string; line: number; literal: string; prefix: string }
export interface Scan {
  prefixes: string[];
  /** Names a file that exists — authored prose, checked to dereference. */
  artefacts: Site[];
  /** Carries `declared-path-literal: <reason>`. */
  marked: Array<Site & { reason: string }>;
  /** Neither — the debt. */
  refused: Array<Site & { why: string }>;
}

export const LITERAL = /(["'`])((?:[^\\\n]|\\.)*?)\1/g;

/**
 * Every declared-path literal in the layer's own source, classified.
 *
 * Exported so `scripts/tests/kg/declared-paths.test.ts` asserts the property
 * rather than shelling out to the CLI and reading its exit code — the pattern
 * `activity-skill-coverage.test.ts` set, and for its reason: a test that
 * parses console output breaks on a wording change and proves nothing about
 * the data.
 */
/**
 * `codeRoots`: the trees whose code is scanned (bean 70lx — the code moved to
 * cat-harness-tools, the content it names stayed). Literals still resolve in the
 * layer root, where the content is; a site is keyed relative to its own tree.
 */
export function scanDeclaredPaths(root: string, codeRoots: string[] = [...new Set([resolve(root), TOOLS_ROOT])]): Scan {
  let base = root;
  const prefixes = declaredPrefixes(root);
  const refused: Scan["refused"] = [];
  const artefacts: Site[] = [];
  const marked: Scan["marked"] = [];

  const scan = (file: string): void => {
  const raw = readFileSync(file, "utf-8");
  const rawLines = raw.split("\n");
  const tool = file.endsWith(".json") ? toolDefinitionText(raw) : undefined;
  const code = tool ? tool.code : stripComments(raw);
  const lines = code.split("\n");
  const cover = tool ? tool.cover : markerCoverage(rawLines);
  const ranges = pathContextRanges(code);
  // Offset of each line's first character, so a literal's position in the
  // line maps back to a position in the file the ranges are measured in.
  const lineStart: number[] = [];
  { let acc = 0; for (const l of lines) { lineStart.push(acc); acc += l.length + 1; } }

  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!;
    LITERAL.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LITERAL.exec(line)) !== null) {
      const value = m[2]!;
      const prefix = prefixes.find((p) => value === p || value.startsWith(`${p}/`));
      if (prefix === undefined) continue;
      // A bare declared segment is a path only where the code builds one
      // with it; a literal carrying a separator is a path on its face.
      //
      // And only as the FIRST segment of that path. `join(root, "skills")` is
      // the declared knowledge graph; `join(repoRootFor(root), ".claude", "skills",
      // "roles")` is a Claude-harness directory that merely spells the same
      // word, and no declaration answers it. Measured 2026-09-19: of the
      // ~55 bare `"skills"` findings, most were the second kind — so without
      // this the check says "a declaration already answers this" about
      // directories where that is simply false, which is worse than a miss.
      // A checker that over-claims teaches people to disbelieve it.
      if (!value.includes("/")) {
        const at = lineStart[n]! + m.index;
        const range = ranges.find(([a, b]) => at >= a && at < b);
        if (range === undefined) continue;
        if (firstLiteralIn(code, range) !== at) continue;
      }
      const site: Site = { file: relative(base, file), line: n + 1, literal: value, prefix };

      // A template is not a path. `translations/${loc}/x.pot` and
      // `translations/<locale>/<name>.pot` name a SHAPE, and no declaration
      // answers the placeholder either.
      if (/[$<]/.test(value)) continue;

      // Neither is a SENTENCE that opens with one. Three literals in this
      // corpus do — `"library/ — source material somebody else wrote"`,
      // `"voices/milnor.json, 12 rules. Complements…"` and a QA message
      // naming `test/results/block-qa/` — and each is a description a human
      // reads, which no declaration would supply. A space is the
      // discriminator because no path in this corpus contains one; a real
      // path that did would be missed, and that is a bounded cost against
      // three standing false findings in a check whose whole value is that
      // its findings are worth acting on.
      if (/\s/.test(value)) continue;

      // Read from the RAW text: the marker lives in a comment, which the
      // scan above has blanked out by design.
      const reason = cover.get(n);
      if (reason !== undefined) {
        marked.push({ ...site, reason });
        continue;
      }

      // A declared path the harness names may be code an implementing layer
      // holds since bean `8lcl` moved it (`schemas/**/*.ts`); resolve it there
      // as the readers do (`implementingRootFor`), so the witness survives.
      let abs = join(root, value);
      // TRANSITIONAL, as `witnessesOf` is: a harness path that moved into a
      // named sub-graph resolves in whichever layout this checkout has, so a
      // witness holds on both sides of the move.
      if (!existsSync(abs)) {
        for (const alt of [subgraphHarnessPath(value), legacyHarnessPath(value)]) {
          if (alt !== value && existsSync(join(root, alt))) {
            abs = join(root, alt);
            break;
          }
        }
      }
      // Code only: the implementing layer also holds its OWN state graphs
      // (its `beans/` store, say), and a harness literal naming `beans/…` is
      // not a module that moved, so it must not resolve against that layer.
      if (!existsSync(abs) && /\.(?:[cm]?[jt]s|tsx)$/.test(value)) {
        const r = resolveImplementingPath(root, value);
        if (r.state === "found") abs = join(r.root, value);
      }
      if (!existsSync(abs)) {
        refused.push({ ...site, why: "names nothing that resolves" });
        continue;
      }
      if (statSync(abs).isDirectory()) {
        refused.push({ ...site, why: "a DIRECTORY the declaration already answers" });
        continue;
      }
      artefacts.push(site);
    }
  }
}

  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".ts") || (e.name.endsWith(".json") && toolDefinitionText(readFileSync(p, "utf-8")))) scan(p);
    }
  };

  for (const r of codeRoots) { base = r; for (const d of SOURCE_DIRS) walk(join(r, d)); }
  base = root;
  // The docs graph's content-object manifests carry path literals too (a
  // page's processes). They lived under `content/` until 2026-10-09 and are
  // the docs graph's declared source now, so the declaration says where.
  // A manifest there may be a `.json` one (bean `y9r6`); its literals are read the same way.
  const walkDocs = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walkDocs(p);
      else if (e.name.endsWith(".ts") || (e.name.endsWith(".json") && isJsonManifest(p))) scan(p);
    }
  };
  walkDocs(docsSourceDirFor(root));
  return { prefixes, artefacts, marked, refused };
}

/** A test file's literals are governed by the witness list, not by the count. */
export function isTestFile(file: string): boolean {
  return file.endsWith(".test.ts");
}

/**
 * The literals that RESOLVE today, as a committed positive list.
 *
 * ## Why a witness list and not a count
 *
 * The per-file count is a ratchet over what is WRONG. It cannot express the
 * thing this check is ultimately for — *this literal names a real artefact,
 * and must go on naming one*. Two defects followed from that, both found
 * 2026-09-20 (bean `dhol`):
 *
 *  - `declared-paths.test.ts` asserted "every artefact dereferences" over a
 *    list whose membership test IS `existsSync`. **Structurally vacuous** —
 *    it could never fail. Relocate an artefact and the literal silently
 *    leaves `artefacts` for `refused`; the assertion goes on passing over a
 *    shorter list.
 *  - Counting test files would have fired on every NEW test that builds a
 *    fixture tree, because a fixture literal correctly names nothing. A gate
 *    that routinely fires for a non-defect is the one this module's header
 *    twice says somebody switches off. Measured immediately: a sibling's
 *    `schemas/folio-dir.test.ts`, merged from main the same hour, tripped it
 *    with two literals that were both entirely correct.
 *
 * A witness inverts both. It fires when a recorded literal STOPS resolving —
 * which is relocation, the actual defect — and stays silent for a new fixture
 * literal, which was never a witness. So test files leave the count ratchet
 * entirely: for a test, naming nothing is the normal case and counting it is
 * noise.
 */
export function witnessesOf(scan: Scan): string[] {
  // TRANSITIONAL (cat-harness#991 step 23; remove after cat-harness#1014
  // merges): a witness is recorded in the sub-graph layout, so a harness
  // checkout still in the legacy one (`processes/sdlc/…`, `skills/sdlc/…`)
  // holds the same witnesses rather than losing every one of them.
  return [...new Set(scan.artefacts.map((a) => `${subgraphHarnessPath(a.file)}::${subgraphHarnessPath(a.literal)}`))].sort();
}

/**
 * The witnesses the baseline does not record: a literal that names a file
 * existing TODAY, added since the list was written. Bean `gz47`, owner ruling
 * 2026-10-04 (see §"An existing file is not a stable one" in the header).
 *
 * The witness list was a relocation alarm only, so a new literal naming an
 * existing file passed in silence — four had, between 2026-09-20 and the
 * ruling. Under the content-source ruling a declared subgraph may leave its
 * directory, so existing today says nothing about existing after the move.
 */
export function newWitnesses(recorded: readonly string[], current: readonly string[]): string[] {
  const known = new Set(recorded);
  return current.filter((w) => !known.has(w));
}

/**
 * The new witnesses that are recorded witnesses MOVED to another file: a
 * literal the recorded file no longer names (so it is lost), written now in
 * a file that did not name it before (so it is new). Paired one to one, by
 * the literal, so the list never grows.
 *
 * A move of the code naming an artefact is not a new literal. cat-harness #286
 * (bean `tdir`) split `tools/index.ts` into `tools/<id>/<id>.ts`: eight
 * witnesses went lost and the same eight literals came back new, and the gate
 * could neither drop the lost ones (`--update` refused over the new) nor
 * admit the new. Under the `gz47` ruling the debt is the LITERAL, and a move
 * carries it: one lost witness hands on to one new one, never two, and a
 * literal that was EDITED is a different literal, which pairs with nothing.
 */
export function relocatedWitnesses(
  lost: readonly string[],
  added: readonly string[],
): Array<{ from: string; to: string }> {
  const literalOf = (w: string) => w.slice(w.indexOf("::") + 2);
  const free = new Map<string, string[]>();
  for (const w of [...lost].sort()) free.set(literalOf(w), [...(free.get(literalOf(w)) ?? []), w]);
  const pairs: Array<{ from: string; to: string }> = [];
  for (const w of [...added].sort()) {
    const from = free.get(literalOf(w))?.shift();
    if (from !== undefined) pairs.push({ from, to: w });
  }
  return pairs;
}

if (import.meta.main) {
  const { prefixes, artefacts, marked, refused } = scanDeclaredPaths(root);

  interface Baseline { _comment: string; files: Record<string, number>; resolves: string[] }

  const prior: Baseline = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, "utf-8")) as Baseline)
    : { _comment: "", files: {}, resolves: [] };

  // Test files are governed by the witness list below, not by this count:
  // for a test, a literal naming nothing is a fixture or a test vector, which
  // is the normal case. See `witnessesOf`.
  // A recorded witness whose literal sits under an ABSENT results tree is not
  // lost and not new debt: this checkout cannot answer for it (bean `c8uq`).
  const absentResults = [...new Set([...absentResultDirs(root), ...storedResultDirs(root)])];
  const priorWitnesses = new Set(prior.resolves ?? []);
  const isUnverifiable = (r: Site) =>
    priorWitnesses.has(`${r.file}::${r.literal}`) && underAbsentResults(root, r.literal, absentResults);
  const unverifiable = refused.filter(isUnverifiable);
  const unverifiableKeys = new Set(unverifiable.map((r) => `${r.file}::${r.literal}`));

  const current: Record<string, number> = {};
  for (const r of refused) {
    if (isTestFile(r.file) || isUnverifiable(r)) continue;
    current[r.file] = (current[r.file] ?? 0) + 1;
  }

  const witnesses = witnessesOf({ prefixes, artefacts, marked, refused });
  const held = new Set(witnesses);
  // A recorded witness naming a publish-time artefact this checkout has not
  // built is held by the declaration, not lost (see `underBuiltAtPublish`).
  const atPublish = (prior.resolves ?? []).filter(
    (w) => !held.has(w) && !unverifiableKeys.has(w) && underBuiltAtPublish(root, w.slice(w.indexOf("::") + 2)),
  );
  const atPublishKeys = new Set(atPublish);
  const lostAll = (prior.resolves ?? []).filter((w) => !held.has(w) && !unverifiableKeys.has(w) && !atPublishKeys.has(w));
  const addedAll = newWitnesses(prior.resolves ?? [], witnesses);
  // A witness whose file was renamed is neither lost nor new: `--update`
  // carries it to the new file (see `relocatedWitnesses`).
  const relocated = relocatedWitnesses(lostAll, addedAll);
  const movedFrom = new Set(relocated.map((r) => r.from));
  const movedTo = new Set(relocated.map((r) => r.to));
  const lost = lostAll.filter((w) => !movedFrom.has(w));
  const added = addedAll.filter((w) => !movedTo.has(w));

  const over: Array<{ file: string; was: number; now: number }> = [];
  for (const [file, n] of Object.entries(current)) {
    const was = prior.files[file] ?? 0;
    if (n > was) over.push({ file, was, now: n });
  }
  const improved: Array<{ file: string; was: number; now: number }> = [];
  for (const [file, was] of Object.entries(prior.files)) {
    const now = current[file] ?? 0;
    if (now < was) improved.push({ file, was, now });
  }

  const priorTotal = Object.values(prior.files).reduce((a, b) => a + b, 0);

  console.log(
    `Declared-path literals  (${prefixes.length} declared prefixes, ` +
      `${artefacts.length + marked.length + refused.length} literals found)\n`,
  );

  console.log(
    `  ${lost.length || added.length || relocated.length ? "✗" : "✓"} ${String(artefacts.length).padStart(3)}  ` +
      `name a file that exists — ${witnesses.length} witnessed, ${lost.length} lost, ${added.length} new` +
      (relocated.length ? `, ${relocated.length} relocated` : "") +
      (unverifiable.length ? `, ${unverifiable.length} could not be checked` : ""),
  );
  if (atPublish.length) {
    console.log(`  · ${String(atPublish.length).padStart(3)}  witnessed, built at publish — declared \`builtAtPublish\`, not built in this checkout`);
  }
  console.log(`  · ${String(marked.length).padStart(3)}  declared base cases, each with a reason`);
  console.log(
    `  ${over.length ? "✗" : "·"} ${String(refused.length).padStart(3)}  ` +
      `unaccounted for — baseline ${priorTotal}${refused.length === priorTotal ? "" : ` (was ${priorTotal})`}`,
  );

  if (marked.length) {
    console.log("\nDECLARED base cases — permitted, and counted so they stay visible:");
    for (const m of marked) console.log(`  · ${m.file}:${m.line}  "${m.literal}"\n      ${m.reason}`);
  }

  if (improved.length) {
    console.log("\nIMPROVED — fewer than the baseline records. Re-run with --update:");
    for (const i of improved) console.log(`  ✓ ${i.file.padEnd(46)} ${i.was} → ${i.now}`);
  }

  if (lost.length) {
    console.log(
      "\nA WITNESSED LITERAL STOPPED RESOLVING — the artefact moved, or was deleted,\n" +
        "and the code naming it was not updated. This is the defect the witness list\n" +
        "exists for; `log-writer.test.ts` went ENOENT this way and then reported a\n" +
        "false finding about the corpus (bean `dhol`).",
    );
    for (const w of lost) {
      const [file, literal] = w.split("::");
      console.log(`  ✗ ${file}  →  "${literal}"`);
    }
    console.log(
      "\nPoint it at where the artefact went. If it was deliberately deleted, re-run\n" +
        "with --update: dropping a witness is a diff somebody reviews.",
    );
  }

  if (added.length) {
    console.log(
      "\nNEW LITERAL NAMING AN EXISTING FILE — not in the recorded witness list.\n" +
        "Existing today is not stable: a declared subgraph's source may move to a\n" +
        "branch or a graph store (owner ruling 2026-10-04, bean `gz47`).",
    );
    for (const w of added) {
      const [file, literal] = w.split("::");
      const site = artefacts.find((a) => a.file === file && a.literal === literal);
      console.log(`  ✗ ${file}${site ? `:${site.line}` : ""}  →  "${literal}"`);
      const helper = site ? HELPERS[site.prefix] : undefined;
      if (helper !== undefined) console.log(`      ask: ${helper}`);
    }
    console.log(
      "\nRead the path from the declaration, or mark the line\n" +
        "`declared-path-literal: <why this one cannot be read>`. `--update` does not\n" +
        "admit a new witness: the list only shrinks.",
    );
  }

  if (over.length) {
    console.log("\nABOVE BASELINE — a declaration answers this, or nothing does:");
    for (const o of over) {
      console.log(`  ✗ ${o.file}  ${o.was} → ${o.now}`);
      for (const r of refused.filter((r) => r.file === o.file)) {
        console.log(`      line ${r.line}: "${r.literal}" — ${r.why}`);
        const helper = HELPERS[r.prefix];
        if (helper !== undefined) console.log(`        ask: ${helper}`);
      }
    }
  }

  if (relocated.length) {
    console.log(
      "\nRELOCATED — a recorded witness's literal left its file and is now named in\n" +
        "another. The code moved, not the artefact: re-run with --update to carry it.",
    );
    for (const r of relocated) {
      console.log(`  ✗ ${r.from.split("::")[0]}  →  ${r.to.split("::")[0]}   "${r.to.split("::")[1]}"`);
    }
  }

  if (unverifiable.length) {
    console.log(
      "\nCOULD NOT DETERMINE — these witnesses name files under a results tree that\n" +
        "is ABSENT from this checkout. Derived QA lives on the `qa-reports` branch, so\n" +
        "their absence says nothing about whether the code still points at the right\n" +
        "place. Neither lost nor counted:",
    );
    for (const r of unverifiable) console.log(`  ? ${r.file}:${r.line}  →  "${r.literal}"`);
    console.log(
      `\nAbsent: ${absentResults.map((d) => relative(root, d)).join(", ")}. Materialise them with\n` +
        "`bun run cat qa:fetch --ref main` (or `--ref pr/<n>`) and re-run. Do NOT --update.",
    );
  }

  if (update) {
    if (unverifiable.length) {
      console.log(
        `\nRefusing --update: ${unverifiable.length} witness(es) cannot be checked here, and ` +
          "rewriting the baseline now would DROP them over a corpus nobody looked at.",
      );
      process.exit(2);
    }
    if (added.length) {
      console.log(
        `\nRefusing --update: ${added.length} new witness(es) above. The list only shrinks ` +
          "(bean `gz47`); read the declaration or mark the line, then re-run.",
      );
      process.exit(1);
    }
    const next: Baseline = {
      // The text the committed baseline already carried. It described only
      // `files` here while the JSON described BOTH records, because the better
      // sentence was written INTO the artefact and never into the writer —
      // so every `--update` silently reverted it, and the next reader learnt
      // nothing about `resolves` from the file `resolves` lives in. Found
      // 2026-09-20 by running `--update` for an unrelated relocation.
      //
      // A generated file's own header is generated; editing it in place is the
      // same defect as hand-editing any other generated output, and it is
      // invisible until somebody regenerates.
      _comment:
        "TWO records, with different jobs. `files`: per-file counts of " +
        "declared-path literals that neither resolve nor carry a " +
        "`declared-path-literal: <reason>` marker — recorded debt for SOURCE " +
        "files, which may only go DOWN. `resolves`: the WITNESS list — every " +
        "literal that resolves to a real artefact today, as `<file>::<literal>`. " +
        "A witness that stops resolving means the artefact moved and the code " +
        "naming it did not follow; that fails the gate. The list only SHRINKS: a " +
        "new literal naming an existing file fails too, and `--update` never adds " +
        "one (bean gz47, owner ruling 2026-10-04). *.test.ts files appear " +
        "ONLY in `resolves`, never in `files`: a test that builds a mkdtemp " +
        "fixture names declared directories by necessity, so counting its " +
        "unresolved literals would fire on every new test (measured 2026-09-20 " +
        "— a sibling's schemas/folio-dir.test.ts tripped it with two correct " +
        "literals). Both are WRITTEN by `bun run cat check:declared-paths --update`; " +
        "raising a count or dropping a witness is a diff somebody reviews. See " +
        "the module header of scripts/check-declared-paths.ts.",
      files: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))),
      // A publish-time witness this checkout did not build is KEPT: dropping it
      // here would lose it over an artefact nobody looked for.
      resolves: [...new Set([...witnesses, ...atPublish])].sort(),
    };
    writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
    const counted = Object.values(current).reduce((a, b) => a + b, 0);
    console.log(
      `\nBaseline written: ${relative(root, BASELINE)} — ${counted} counted across ` +
        `${Object.keys(current).length} source file(s), ${witnesses.length} witnessed literal(s). ` +
        `${refused.length - counted} literal(s) in tests are governed by the witnesses, not counted.`,
    );
    if (over.length) console.log("RAISED for the files above — that belongs in the diff somebody reviews.");
    process.exit(0);
  }

  if (lost.length || added.length || relocated.length) {
    if (lost.length) console.log(`\n${lost.length} witnessed literal(s) no longer resolve.`);
    if (relocated.length) console.log(`\n${relocated.length} witness(es) relocated; the baseline is stale until --update.`);
    if (added.length) console.log(`\n${added.length} new literal(s) name an existing file.`);
    process.exit(1);
  }

  if (over.length) {
    console.log(
      `\n${over.length} file(s) gained a declared-path literal. Either read the\n` +
        `declaration, or mark the site \`declared-path-literal: <why this one cannot\n` +
        `be read>\` — the reason is required, and marked sites are counted above\n` +
        `rather than disappearing.`,
    );
    process.exit(1);
  }

  if (unverifiable.length) {
    console.log(`\nNo determined failure, but ${unverifiable.length} witness(es) could not be checked — not a pass.`);
    process.exit(2);
  }

  console.log("\nNo file gained a declared-path literal.");

}
