#!/usr/bin/env bun
/**
 * No path or message still names the RETIRED declaration file,
 * `harness.json`; `<name>.config.json` is the single declaration at an
 * instantiation root.
 *
 * ## What FAILS
 *
 * - **A path literal**: a quoted string literal whose whole value is the
 *   retired filename (or a template literal building a path to it), in a
 *   non-test `.ts` file, outside the definition site. Matching the *whole*
 *   literal keeps this free of judgement: prose is never a whole-string
 *   literal.
 * - **A user-visible string**: the retired name, as a whole token, in a
 *   NON-comment line of a non-test `.ts` file that is not a path (a log
 *   line, a thrown `Error`, a tool description). An operator reads it and
 *   looks for the file, so name the file actually used (a computed path, or
 *   `<name>.config.json`), or the Jekyll file by its `_data/` path. This
 *   fails outside the owning layer too.
 * - **A workflow `use`**: {@link classifyWorkflowLine} splits each `.yml`
 *   line into `prose` (reworded by a rename), `jekyll-data` (must never be
 *   renamed) and `use`, which fails.
 * - **A Markdown `use`**: a skill tells a reader where to look, so prose
 *   naming the retired file fails unless it is `jekyll-data`, a `record`
 *   under a declared historical directory, `generated`, or `historical` (the
 *   same paragraph names the current declaration beside it).
 *
 * ## COUNTED, not failed
 *
 * | class | why not a failure |
 * |---|---|
 * | prose — the name inside a doc comment | a rename REWORDS these; it does not substitute a constant into them |
 * | test fixtures | a fixture writing `join(root, "harness.json")` constructs the file the code under test looks for; routing it through a constant would make the test pass vacuously after a rename. An open judgement, not decided here |
 * | path literals outside the owning layer | making them use the constant would add a cross-instance code dependency, and a second copy would be two constants; a boundary decision, so counted rather than silently excluded |
 *
 * @covers cat-harness
 */

import { readdirSync, readFileSync } from "node:fs";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { join, relative, resolve } from "node:path";

import { layerRootsIn, siteDirFor } from "../schemas/kg/cat-harness.js";
import { historicalPrefixes } from "../src/docs/declaration-claims.js";

/**
 * The RETIRED declaration filename.
 *
 * Kept as a constant so this gate can FIND it, never so a reader can fall back
 * to it — the same shape as `LEGACY_HARNESS_CONFIG` in
 * `schemas/kg/harness-config.ts`, and for the reason recorded there: the previous
 * rename was a silent hard break, and `9ici` is what that cost.
 */
const RETIRED_DECLARATION = "harness.json";

const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Where the constant itself is defined — the one legitimate literal. */
const DEFINITION_SITE = "cat-harness/schemas/kg/cat-harness.ts";

/** This gate itself — the one file that must still name the retired string. */
const THIS_GATE = "cat-harness-tools/scripts/check-declaration-filename.ts";

/**
 * The layer that owns the constant, DERIVED from where it is defined.
 *
 * A call site outside it cannot import the constant without creating a
 * cross-instance dependency — a boundary decision, not a refactor. See the
 * module header.
 *
 * Derived rather than written out a second time: the owning layer and the
 * definition site are one fact, and this repository has paid for stating one
 * fact twice often enough to have a rule about it. Moving the constant moves
 * this with it.
 */
const OWNING_INSTANCE = DEFINITION_SITE.slice(0, DEFINITION_SITE.indexOf("/") + 1);

// input-site: inert #ed52e1dd — names a build-output directory only to leave it out of a walk
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next"]);

export interface Bypass {
  /** Repo-relative path. */
  file: string;
  line: number;
  /** The source line, trimmed. */
  text: string;
  kind: "literal" | "template";
}

/** A user-visible string naming the retired declaration. These FAIL. */
export interface UserVisibleRef {
  /** Repo-relative path. */
  file: string;
  line: number;
  /** The source line, trimmed. */
  text: string;
}

/** One workflow line naming the retired declaration, with what it is. */
export interface WorkflowRef {
  file: string;
  line: number;
  text: string;
  klass: "prose" | "jekyll-data" | "use";
}

export interface DeclarationFilenameReport {
  filesRead: number;
  /** Non-test call sites building the path from a literal. These FAIL. */
  bypasses: Bypass[];
  /**
   * Message strings, log lines, error text and tool descriptions naming the
   * retired declaration, in any layer. These FAIL (bean `k8rc`).
   */
  userVisible: UserVisibleRef[];
  /** Counted, never failed — see the module header for each reason. */
  counted: { tests: number; prose: number };
  /**
   * Workflow lines naming the retired declaration, CLASSIFIED — not a count.
   *
   * `null` means the directory could not be read, which the report renders as
   * unknown and never as zero. A `use` in here fails the check.
   */
  workflows: WorkflowRef[] | null;
  /**
   * Bypasses outside {@link OWNING_INSTANCE}. Counted with their locations
   * rather than as a bare number: a boundary question needs the sites named
   * so somebody can decide it, and a count alone cannot be acted on.
   */
  crossInstance: Bypass[];
  /**
   * Markdown lines naming the retired declaration, CLASSIFIED — bean `vzur`.
   *
   * `null` means the corpus could not be read, rendered as unknown and never
   * as zero. A `use` in here fails the check.
   */
  markdown: MarkdownRef[] | null;
}

/** One markdown line naming the retired declaration, with what it IS. */
export interface MarkdownRef {
  file: string;
  line: number;
  text: string;
  klass: MarkdownClass;
}

export type MarkdownClass = "record" | "generated" | "historical" | "jekyll-data" | "use";

/**
 * Is this the whole value of a quoted string literal?
 *
 * The whole-value test is the rule. `"harness.json"` is a path segment;
 * `"no harness.json at ${root}"` is a sentence, and no amount of constant
 * substitution improves it.
 */
function wholeStringLiteral(line: string, filename: string): boolean {
  return line.includes(`"${filename}"`) || line.includes(`'${filename}'`);
}

/**
 * A template literal that builds a PATH rather than a message.
 *
 * Measured at zero on this corpus, and implemented regardless: the class is
 * reachable the moment somebody writes `` `${dir}/harness.json` ``, and a
 * check that only catches the shapes already present cannot catch the next
 * one.
 *
 * ## The first draft of this guard was wrong, and the corpus said so
 *
 * It accepted **a separator OR an interpolation** before the filename, which
 * made a `/` sufficient — and immediately reported two sentences:
 *
 * - `` `docs/_data/harness.json is stale.\n` `` — prose, and see below
 * - a tool description containing `` `cat-harness/harness.json` `` mid-sentence
 *
 * A static path inside backticks is prose: it is a sentence naming a file, and
 * a rename rewords it. **Only an INTERPOLATION is construction** — that is the
 * thing a constant can be substituted into. The rule narrowed to that, and the
 * class went back to the zero it was measured at.
 *
 * ## `docs/_data/harness.json` is a DIFFERENT FILE
 *
 * Found by that false positive and worth more than the rule it corrected: the
 * Jekyll data file under `docs/_data/` shares the basename and is **not** a
 * layer declaration. Under the REPLACE ruling it must not be renamed. The
 * whole-value test already excludes it — nothing joins to it as a bare
 * filename — but a sweep run by hand over the basename would take it, which is
 * exactly how a rename breaks a site build.
 */
function pathTemplate(line: string, filename: string): boolean {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("\\$\\{[^}]*\\}/?" + escaped + "(?![\\w.-])").test(line);
}

/** A comment line — prose by construction. */
function isComment(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*");
}

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) out.push(p);
  }
}

/**
 * What a workflow line naming the retired declaration actually is.
 *
 * - `jekyll-data` — `docs/_data/harness.json` is JEKYLL's data file. It merely
 *   shares a basename and **must not be renamed**. Checked FIRST, because a
 *   comment naming it is both a comment and an exemption, and the exemption is
 *   the part a rename needs to hear.
 * - `prose` — the name inside a `#` comment. A rename REWORDS these. Same
 *   reasoning, and the same words, as the TypeScript side's prose class.
 * - `use` — anything else: a step, an argument, a path. **Fails.** A `.yml`
 *   cannot import the constant, so this cannot be fixed the way a call site
 *   is; it is a broken reference to a file that does not exist, which is
 *   worse than a bypass rather than better.
 *
 * Returns `null` when the line does not name the retired declaration at all.
 */
export function classifyWorkflowLine(line: string): "prose" | "jekyll-data" | "use" | null {
  const at = boundedIndexOf(line, RETIRED_DECLARATION);
  if (at === -1) return null;
  if (line.includes("_data")) return "jekyll-data";
  const hash = line.indexOf("#");
  return hash !== -1 && hash < at ? "prose" : "use";
}

/**
 * What a MARKDOWN line naming the retired declaration actually is.
 *
 * Bean `vzur`, turned on once its backlog was cleared and not before — a gate
 * red on arrival teaches nobody anything, and the order was settled in that
 * bean: clear the backlog, then turn the gate on.
 *
 * Markdown needed the same treatment as `.yml` and for a sharper reason.
 * Prose was exempt on the TypeScript side because *"a rename REWORDS these"*,
 * which is sound for a doc comment beside the code it describes. **It is not
 * sound for a skill**, whose whole job is telling a reader where to look: a
 * reversal does not reword anything, it silently inverts what the existing
 * words mean, and 113 live path claims went stale in one commit with nothing
 * reading them for ten days.
 *
 * - `jekyll-data` — `docs/_data/harness.json` is JEKYLL's data file, shares a
 *   basename, and **must not be renamed**. Checked FIRST, as on the YAML side.
 * - `record` — the file sits under a directory DECLARED as a place for
 *   retired or foreign material (`fsh-guts/`, `beans/`, any `library/`).
 *   Correct history, written where history belongs. Derived from the
 *   declarations via {@link historicalPrefixes}, never listed here: a
 *   hand-written second list is the duplicated-fact defect.
 * - `generated` — under a generated reference directory. It FOLLOWS its
 *   source, so failing on it would demand a hand-edit of a file the repo
 *   forbids hand-editing.
 * - `historical` — the passage states a former name **beside** its
 *   replacement. The test is a current declaration filename in the enclosing
 *   PARAGRAPH, not a past-tense word: vocabulary is a guess, a neighbouring
 *   correct filename is evidence.
 *
 *   **The paragraph rather than the line, and that was measured.** The first
 *   version tested the line alone and reported `kg-export.md`'s retirement
 *   note as a stale path — a passage that opens *"That argument ran:"* and
 *   whose previous sentence names `<name>.json`. History is a property of the
 *   passage; a line-local test makes correctly-written history the one thing
 *   the gate cannot recognise, which would push authors to delete the record
 *   rather than mark it.
 * - `use` — anything else. **Fails.** A markdown file cannot import the
 *   constant, so this is a reader sent to a file that does not exist.
 *
 * Returns `null` when the line does not name the retired declaration at all.
 */
export function classifyMarkdownLine(
  rel: string,
  line: string,
  records: string[],
  paragraph = line,
  generated: string[] = [],
): MarkdownClass | null {
  if (boundedIndexOf(line, RETIRED_DECLARATION) === -1) return null;
  if (line.includes("_data")) return "jekyll-data";
  if (records.some((r) => rel.startsWith(r))) return "record";
  if (generated.some((g) => rel.startsWith(g))) return "generated";
  return namesACurrentDeclaration(paragraph) ? "historical" : "use";
}

/**
 * Prefixes holding GENERATED reference markdown, composed rather than typed.
 *
 * Each layer's site root comes from `siteDirFor()` — the declaration — and
 * the two reference trees hang off it, exactly as `gen-skill-docs.ts` and
 * `gen-schema-docs.ts` compose their own output. Writing the paths out here
 * would be a third copy of a fact the declaration already carries, and
 * `check:declared-paths` says so.
 */
function generatedPrefixes(repoRoot: string): string[] {
  const out = new Set<string>();
  for (const instance of layerRootsIn(repoRoot)) {
    let site: string;
    try {
      site = siteDirFor(instance);
    } catch {
      continue; // a layer whose site root cannot be resolved is not pruned
    }
    const base = relative(repoRoot, join(instance, site)).split("\\").join("/");
    for (const leaf of ["skill-instructions", "skills"]) {
      out.add(`${base}/reference/${leaf}/`);
    }
  }
  return [...out].sort();
}

/**
 * Does this text name a declaration that EXISTS, by either spelling?
 *
 * `<name>.json` — the placeholder a generic skill has to write — or a
 * concrete `<instance>/<instance>.json`. The retired word itself never
 * counts, which is what keeps a paragraph from excusing itself.
 */
function namesACurrentDeclaration(text: string): boolean {
  if (/`<[A-Za-z0-9._-]+>\.(config\.)?json`/.test(text)) return true;
  for (const m of text.matchAll(/`([A-Za-z0-9-]+\/)?([A-Za-z0-9-]+)\.json`/g)) {
    if (m[2] !== "harness") return true;
  }
  return false;
}

/**
 * The blank-line-delimited block containing each line, in LINEAR time.
 *
 * One pass records where each block starts and ends; a block's text is joined
 * the first time a line in it asks, and reused after. Walking out from each
 * line to the nearest blank lines instead (this function's shape until
 * 2026-11-13) copies a block of B lines B times: about 8.5 GB of strings over
 * the composed index, whose extracted library sections run to 3,000-line
 * blocks with no blank line, and a 384 s scan on CI.
 */
export function paragraphsOf(lines: string[]): (i: number) => string {
  const start = new Array<number>(lines.length);
  const end = new Array<number>(lines.length);
  let a = 0;
  for (let i = 0; i <= lines.length; i++) {
    if (i === lines.length || lines[i]!.trim() === "") {
      for (let k = a; k < i; k++) end[k] = i - 1;
      if (i < lines.length) {
        start[i] = i; // a blank line names nothing, so is never classified
        end[i] = i;
      }
      a = i + 1;
    } else {
      start[i] = a;
    }
  }
  const joined = new Map<number, string>();
  return (i) => {
    const s = start[i]!;
    let text = joined.get(s);
    if (text === undefined) {
      text = lines.slice(s, end[i]! + 1).join("\n");
      joined.set(s, text);
    }
    return text;
  };
}

/**
 * Every markdown line naming the retired declaration, classified.
 *
 * Throws rather than returning `[]` when the corpus cannot be read — the
 * `dh4f` shape, and the caller turns it into `? COULD NOT DETERMINE`.
 */
function scanMarkdown(root: string): MarkdownRef[] {
  const records = historicalPrefixes(root);
  const generated = generatedPrefixes(root);
  const out: MarkdownRef[] = [];
  const skip = new Set([".git", "node_modules"]);
  // ASKED OF GIT, not walked — and this walk skipped NO dot-directory, so it
  // descended into `.claude/worktrees/<id>/`, where a worktree-isolated agent
  // keeps a complete second checkout of this repository. Measured 2026-09-30
  // with one worktree live: 528 stale-path findings, whose paths begin
  // `.claude/worktrees/agent-...`, on a branch that touched none of them.
  //
  // `.claude/worktrees/` is gitignored (`.gitignore:31`) and untracked, so
  // `git ls-files --cached --others --exclude-standard` never lists it. Bean
  // `vpek` fixed the same class in eslint and left the general question open;
  // this is the second of two sweeps that answer it yes.
  //
  // The fallback is NOT silent: `gitCorpus` returns `undefined` when git
  // cannot answer rather than an empty list, and an empty corpus here would
  // make this check vacuously pass — the `dh4f` shape. So the walk survives
  // for that case and the caller is told which enumeration ran.
  const listed = gitCorpus(root, ["*.md"]);
  if (listed !== undefined) {
    for (const abs of listed.sort()) {
      const rel = relative(root, abs).split("\\").join("/");
      const lines = readFileSync(abs, "utf8").split("\n");
      const paragraphAt = paragraphsOf(lines);
      for (const [i, line] of lines.entries()) {
        // Only a line naming the retired file is classified, so only that
        // line's paragraph is built: building one per line was quadratic in
        // a long block, 12 of the scan's 13.5 s (core main, 2026-11-13).
        if (!line.includes(RETIRED_DECLARATION)) continue;
        const klass = classifyMarkdownLine(rel, line, records, paragraphAt(i), generated);
        if (klass) out.push({ file: rel, line: i + 1, text: line.trim(), klass });
      }
    }
    return out;
  }
  const walkMd = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name) || e.name === ".claude") continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        walkMd(abs);
        continue;
      }
      if (!e.name.endsWith(".md")) continue;
      const rel = relative(root, abs).split("\\").join("/");
      const lines = readFileSync(abs, "utf8").split("\n");
      const paragraphAt = paragraphsOf(lines);
      for (const [i, line] of lines.entries()) {
        // Only a line naming the retired file is classified, so only that
        // line's paragraph is built: building one per line was quadratic in
        // a long block, 12 of the scan's 13.5 s (core main, 2026-11-13).
        if (!line.includes(RETIRED_DECLARATION)) continue;
        const klass = classifyMarkdownLine(rel, line, records, paragraphAt(i), generated);
        if (klass) out.push({ file: rel, line: i + 1, text: line.trim(), klass });
      }
    }
  };
  walkMd(root);
  return out;
}

/**
 * Where the retired name starts, as a FILENAME rather than as a substring.
 *
 * The YAML side's answer to the TypeScript side's whole-value rule, and it is
 * load-bearing rather than defensive: **`cat-harness.json` contains
 * `harness.json`.** A bare `indexOf` reports the CURRENT declaration of the
 * layer that owns this gate as a reference to the retired one.
 *
 * That is not hypothetical. It was found by writing the fix for
 * `docs-site.yml` — the corrected comment names
 * `cat-harness/cat-harness.json`, and the naive classifier counted the
 * correction as the defect. The same collision class as `docs/_data`, which
 * this file already had a rule for, one character further left.
 *
 * A match must be bounded on BOTH sides by a non-filename character.
 * `/harness.json` and `` `harness.json` `` match; `cat-harness.json`,
 * `x.harness.json` and **`harness.jsonld`** do not.
 *
 * **The right boundary was missing until 2026-09-21 and the omission was
 * already written down.** The bean that added the left check named
 * `harness.jsonld` in the same sentence as `cat-harness.json`, then guarded
 * only the side it had a failing example for. The markdown scanner (`vzur`)
 * found it on its first run: `serving-renderings.md` names this layer's
 * published rendering, and a left-bounded match read `/harness.jsonld` as a
 * reference to the retired declaration.
 *
 * A prefix test is not a filename test in either direction, and one half of
 * the rule is the half that fails silently — it produces a FINDING rather
 * than a miss, so it looks like the check working.
 */
function boundedIndexOf(line: string, name: string): number {
  let from = 0;
  for (;;) {
    const at = line.indexOf(name, from);
    if (at === -1) return -1;
    const before = at === 0 ? "" : line[at - 1]!;
    const after = line[at + name.length] ?? "";
    if (!/[A-Za-z0-9._-]/.test(before) && !/[A-Za-z0-9-]/.test(after)) return at;
    from = at + 1;
  }
}

/**
 * Every workflow line naming the retired declaration, classified.
 *
 * Throws rather than returning `[]` when the directory cannot be read: an
 * empty list from an unreadable directory is the `dh4f` shape, and the caller
 * turns the throw into the report's `? COULD NOT DETERMINE` rather than into
 * a zero.
 */
function scanWorkflows(root: string): WorkflowRef[] {
  const out: WorkflowRef[] = [];
  const yml = join(root, ".github", "workflows");
  for (const e of readdirSync(yml, { withFileTypes: true })) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith(".yml") && !e.name.endsWith(".yaml")) continue;
    const lines = readFileSync(join(yml, e.name), "utf8").split("\n");
    for (const [i, line] of lines.entries()) {
      const klass = classifyWorkflowLine(line);
      if (klass) out.push({ file: `.github/workflows/${e.name}`, line: i + 1, text: line.trim(), klass });
    }
  }
  return out;
}

export function checkDeclarationFilename(root = REPO_ROOT): DeclarationFilenameReport {
  const files: string[] = [];
  walk(root, files);

  const bypasses: Bypass[] = [];
  const crossInstance: Bypass[] = [];
  const userVisible: UserVisibleRef[] = [];
  let tests = 0;
  let prose = 0;

  for (const abs of files) {
    const rel = relative(root, abs).split("\\").join("/");
    const isTest = /\.test\.tsx?$|\.e2e\.tsx?$|(^|\/)tests?\//.test(rel);
    const lines = readFileSync(abs, "utf8").split("\n");

    for (const [i, line] of lines.entries()) {
      // A whole token: `cat-harness.json` CONTAINS the retired name and is the
      // CURRENT declaration, the same collision the workflow side guards.
      if (boundedIndexOf(line, RETIRED_DECLARATION) === -1) continue;

      if (isComment(line)) {
        prose++;
        continue;
      }

      const literal = wholeStringLiteral(line, RETIRED_DECLARATION);
      const template = pathTemplate(line, RETIRED_DECLARATION);
      if (!literal && !template) {
        // Not a path and not a comment: text somebody reads at run time, which
        // FAILS (bean `k8rc`). Three kinds stay counted prose, as before: this
        // gate's own report (it names the retired file on purpose), the Jekyll
        // data file `docs/_data/harness.json`, and a test's message strings.
        if (isTest || rel === THIS_GATE || line.includes("_data")) prose++;
        else userVisible.push({ file: rel, line: i + 1, text: line.trim() });
        continue;
      }

      // This gate's own definition of the retired name is the one literal
      // that must stay — it is how the gate finds the others.
      if (rel === THIS_GATE) continue;

      // `docs/_data/harness.json` is JEKYLL's data file and has nothing to do
      // with a layer declaration. It merely shares a basename, which is
      // exactly the kind of collision a bare string match gets wrong.
      if (line.includes("_data")) continue;

      if (isTest) {
        tests++;
        continue;
      }

      const found: Bypass = {
        file: rel,
        line: i + 1,
        text: line.trim(),
        kind: literal ? "literal" : "template",
      };
      (rel.startsWith(OWNING_INSTANCE) ? bypasses : crossInstance).push(found);
    }
  }

  return {
    filesRead: files.length,
    bypasses,
    crossInstance,
    userVisible,
    counted: { tests, prose },
    workflows: (() => {
      try {
        return scanWorkflows(root);
      } catch {
        return null; // could not determine — never rendered as zero
      }
    })(),
    markdown: (() => {
      try {
        return scanMarkdown(root);
      } catch {
        return null; // could not determine — never rendered as zero
      }
    })(),
  };
}

/**
 * The workflow lines that FAIL.
 *
 * A helper rather than a filter at each call site, because the exit code and
 * the report must agree about what a failure is — and they are written in two
 * places that a later edit could move apart.
 */
export function workflowUses(r: DeclarationFilenameReport): WorkflowRef[] {
  return (r.workflows ?? []).filter((w) => w.klass === "use");
}

/**
 * The markdown lines that FAIL — same contract, same reason, as above.
 */
export function markdownUses(r: DeclarationFilenameReport): MarkdownRef[] {
  return (r.markdown ?? []).filter((m) => m.klass === "use");
}

function formatReport(r: DeclarationFilenameReport): string {
  if (r.filesRead === 0) {
    return "Declaration filename\n  ? EXAMINED NOTHING — no TypeScript found. Not a pass.";
  }
  const out = [`Declaration filename (${r.filesRead} file(s), retired name \`${RETIRED_DECLARATION}\`)`];

  if (r.bypasses.length === 0) {
    out.push("  ✓ no call site names the retired `harness.json`");
  } else {
    for (const b of r.bypasses) {
      out.push(`  ✗ ${b.file}:${b.line} [${b.kind}]`);
      out.push(`      ${b.text}`);
    }
    out.push("");
    out.push("  `harness.json` was EXCISED on 2026-09-21: a declaration is `<name>.config.json`,");
    out.push("  discovered with `findDeclarationFile(dir)` or `declarationPathIn(dir)`. It cannot be");
    out.push("  composed any more — the filename carries the instance's name, so the only way to");
    out.push("  know it is to look.");
  }

  if (r.crossInstance.length > 0) {
    out.push("");
    out.push(`  ~ ${r.crossInstance.length} call site(s) OUTSIDE ${OWNING_INSTANCE} — counted, not failed:`);
    for (const b of r.crossInstance) out.push(`      ${b.file}:${b.line}`);
    out.push("      Using the constant here would be this repo's first cross-instance import;");
    out.push("      a second copy of it would be two constants. That is a boundary decision for");
    out.push("      the split (`vke6`), not for this check — see the module header.");
  }

  if (r.userVisible.length === 0) {
    out.push("  ✓ no message, log line or description names the retired `harness.json`");
  } else {
    out.push("");
    out.push(`  ✗ ${r.userVisible.length} user-visible string(s) name the retired declaration:`);
    for (const u of r.userVisible) {
      out.push(`      ${u.file}:${u.line}`);
      out.push(`        ${u.text.slice(0, 120)}`);
    }
    out.push("      A reader acts on output (bean `k8rc`): name the file actually used, from the");
    out.push("      path already in hand, or `<name>.config.json`; Jekyll's file is `_data/harness.json`.");
  }

  const uses = workflowUses(r);
  if (uses.length > 0) {
    out.push("");
    out.push(`  ✗ ${uses.length} workflow line(s) USE the retired declaration — a path to a file that is gone:`);
    for (const w of uses) {
      out.push(`      ${w.file}:${w.line}`);
      out.push(`        ${w.text}`);
    }
    out.push("      A `.yml` cannot import the constant, so this is not fixed the way a call");
    out.push("      site is: name the instance's own `<name>.config.json`, or drop the step.");
  }

  const c = r.counted;
  out.push("");
  out.push("  Counted, not failed — each for a reason in the module header:");
  out.push(`    test fixtures      ${c.tests}  (an open judgement on bean \`jijc\`, not a finding)`);
  out.push(`    prose occurrences  ${c.prose}  (doc comments: a rename REWORDS these)`);

  if (r.workflows === null) {
    out.push("    workflow lines     ? COULD NOT DETERMINE — not zero");
  } else {
    const by = (k: WorkflowRef["klass"]) => r.workflows!.filter((w) => w.klass === k);
    out.push(`    workflow prose     ${by("prose").length}  (a rename REWORDS these — listed below)`);
    out.push(`    workflow jekyll    ${by("jekyll-data").length}  (\`docs/_data/harness.json\` — must NOT be renamed)`);
    for (const w of by("prose")) out.push(`      · ${w.file}:${w.line}`);
  }

  if (r.markdown === null) {
    out.push("    markdown lines     ? COULD NOT DETERMINE — not zero");
  } else {
    const md = (k: MarkdownClass) => r.markdown!.filter((m) => m.klass === k);
    const bad = md("use");
    out.push(
      `    markdown           ${md("record").length} record, ${md("generated").length} generated, ` +
        `${md("historical").length} historical, ${md("jekyll-data").length} jekyll` +
        (bad.length ? `, ${bad.length} STALE PATH` : ""),
    );
    for (const m of bad) {
      out.push(`      ✗ ${m.file}:${m.line}`);
      out.push(`          ${m.text.slice(0, 96)}`);
    }
    if (bad.length) {
      out.push("      A markdown file cannot import the constant, so this is not a bypass —");
      out.push("      it is a reader sent to a file that does not exist. Name the current");
      out.push("      declaration: `<name>.json`, or the concrete `<instance>/<instance>.json`.");
    }
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: DeclarationFilenameReport;
  try {
    report = checkDeclarationFilename();
  } catch (e) {
    console.error(`Could not check declaration filename use: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  // `workflows === null` is UNKNOWN, not clean: exit 2, the same code the
  // catch above uses, so a directory that cannot be read never reads as a pass.
  if (report.workflows === null || report.markdown === null) process.exit(2);
  process.exit(
    report.bypasses.length ||
      report.userVisible.length ||
      workflowUses(report).length ||
      markdownUses(report).length ||
      report.filesRead === 0
      ? 1
      : 0,
  );
}
