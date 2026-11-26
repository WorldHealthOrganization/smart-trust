#!/usr/bin/env bun
/**
 * A path inside a **fenced command** still resolves.
 *
 * A command an agent copies, such as the cold-start line in `AGENTS.md`,
 * fails outright when a path in it has moved. Neighbouring checks each read
 * something else:
 *
 * | check | reads |
 * |---|---|
 * | `check:agent-entry-links` | markdown **links** out of the entry files |
 * | `check:agents-claims` | LOCATION claims — `symbol` in `module.ts` — and absence claims |
 * | `check:declared-paths` | path literals in **code** |
 * | *this* | paths inside fenced **commands**, and in the prose of a skill |
 *
 * ## What counts as a path
 *
 * A token is a candidate when it **contains a `/` and looks like a file or
 * directory**, or ends in a known script extension. It is checked only when it
 * is **repository-relative and static**: a token carrying `$`, `<`, `*`, `~`
 * or a URL scheme is a template or an example, and is not judged.
 *
 * The rule is conservative on purpose: a check over prose must be right
 * rather than thorough. Everything it declines to judge is COUNTED in the
 * summary, so the coverage is visible.
 *
 * Exit: 0 every checked path resolves, 1 one does not, 2 could not check.
 *
 * @module folio-assistant/scripts/check-command-paths
 * @covers docs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { findDeclarationFile, repoRootFor, KG_CONTENT_GRAPH_TYPOLOGIES } from "../schemas/kg/cat-harness.js";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { gateOwnsFile } from "./lib/gate-own.ts";

import { findEntryFiles, movesResolver } from "./check-agent-entry-links.ts";
import { isSyncedSkillDir } from "./sync-remote-skills.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
export const INSTANCE_ROOT = HARNESS_ROOT;

/** A fenced block, with its info string. */
const FENCE = /^([ \t]*)```([^\n`]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;

/** Info strings whose contents are commands a person runs. */
const SHELL_INFO = /^(sh|bash|shell|zsh|console|terminal|sh\b.*)$/i;

/**
 * Commands this check declines to read at all, with the reason.
 *
 * Every entry was MEASURED as a false positive on the first run over this
 * corpus, and each is a different way a path-shaped string is not a path in
 * this tree. Declining a whole line is the conservative move: a check over
 * prose has to be right rather than thorough, because its findings are read by
 * a person deciding whether to keep it.
 */
export function skipCommand(cmd: string): string | undefined {
  // `cd content`, then `pipeline/bib-qa.ts` run from there — the base is not this root, and
  // guessing it is how a check starts reporting a folio's layout as a defect.
  if (/(^|[;&|]\s*)cd\s/.test(cmd)) return "changes directory — the base is not the repository root";
  // `git show origin/main:beans/defs/x.md` — a ref is path-shaped and is not a path.
  if (/(^|[;&|]\s*)git\s/.test(cmd)) return "a git command — refs are path-shaped and are not paths";
  return undefined;
}

/**
 * Split a command line into shell words, with expansions and URLs removed
 * WHOLE rather than tokenised through.
 *
 * This is the part the first draft got wrong, and every false positive it
 * produced came from the same mistake: matching path-shaped RUNS inside a
 * larger string. `https://bun.sh/install` yielded `bun.sh/install`,
 * `$HOME/.local/bin` yielded `HOME/.local/bin`, and `/path/to/x` yielded
 * `path/to/x` — three tokens that never appeared in the text, each reported as
 * a missing file. A word is checked only as a WHOLE word.
 */
export function shellWords(cmd: string): string[] {
  const stripped = cmd
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, " ") // URLs, whole
    .replace(/\$\{[^}]*\}\S*/g, " ") // ${VAR}... whole
    .replace(/\$\w+\S*/g, " ") // $VAR... whole
    // `<paper>/<paper>.ts` — a placeholder and everything glued to it. Removed
    // WHOLE for the same reason as `$VAR`: splitting it yielded `.ts`, a token
    // that never appears in the text, reported as a missing file.
    .replace(/\S*<[^>]*>\S*/g, " ")
    .replace(/['"]/g, " ");
  return stripped.split(/[\s;|&<>()]+/).filter(Boolean);
}

/** A word this check declines to judge, with the reason it declines. */
export function skipReason(tok: string): string | undefined {
  if (tok.startsWith("-")) return "a flag";
  // `export SMART_BASE_HOME=/path/to/checkout` — an assignment, not a path.
  if (tok.includes("=")) return "an assignment";
  if (/[$<>*?~{}|@:]/.test(tok)) return "a template, a placeholder or a ref";
  if (tok.startsWith("/")) return "absolute — not repository-relative";
  if (tok.startsWith("..")) return "escaping — not repository-relative";
  // `uploads/FILE.pdf`, `-o OUTDIR` — an ALL-CAPS segment is a stand-in.
  if (tok.split("/").some((seg) => /^[A-Z][A-Z0-9_]+(\.[a-z]+)?$/.test(seg))) return "an upper-case stand-in";
  if (!tok.includes("/") && !/\.(sh|ts|js|py|mjs|cjs|json|md|yml|yaml)$/.test(tok)) return "not path-shaped";
  if (!/[./]/.test(tok)) return "not path-shaped";
  // `bun run`, `npm ci` and friends: a bare word with a dot is not a path.
  if (!tok.includes("/")) return undefined;
  return undefined;
}

export interface CommandPathReport {
  filesRead: number;
  checked: number;
  declined: number;
  /** Folio-relative: named in a skill, unresolvable here BY CONSTRUCTION. */
  folioRelative: number;
  /** Blocks carrying `command-path-ok:` with a reason. Counted, never hidden. */
  exempt: number;
  /**
   * Printed-command findings HELD pending the owner's decision.
   *
   * **Not a baseline and not a pass.** A baseline asserts "these are accepted";
   * this asserts "these are found, and whether they fail is not yet decided" —
   * a third state, and collapsing it into either of the other two would be
   * deciding the question by default. They are printed in full every run and
   * excluded from the exit code until the decision lands.
   */
  held: { file: string; line: number; token: string; command: string }[];
  dead: { file: string; line: number; token: string; command: string }[];
  /**
   * Paths that resolve only through a move some layer declares, in its
   * window (sdlc skill `two-phase-move`): checked and passing, each still to
   * switch to the new path. Past `until` the same path is `dead`.
   */
  moved: { file: string; line: number; token: string; command: string; move: string }[];
}

const RESOLVERS = new Map<string, ReturnType<typeof movesResolver>>();

/** Does {@link tok} resolve through a declared move? If so it is recorded on {@link report} as moved. */
function throughMove(repo: string, tok: string, report: CommandPathReport, at: Omit<CommandPathReport["moved"][number], "token" | "move">): boolean {
  let resolveMoved = RESOLVERS.get(repo);
  if (resolveMoved === undefined) RESOLVERS.set(repo, (resolveMoved = movesResolver(repo)));
  const through = resolveMoved(resolve(repo, tok));
  if (through === undefined) return false;
  report.moved.push({ ...at, token: tok, move: through.move });
  return true;
}

/**
 * The two corpora, and why they get different verdicts.
 *
 * **An entry document is about THIS repository by definition** — `AGENTS.md`
 * and `README.md` tell an agent what to run *here*, so every repository-relative
 * path in one of their commands must resolve, full stop. That is the `b963`
 * case: `scripts/install-beans.sh` names a directory this repository does not
 * have, and it is a defect precisely because the document is about this tree.
 *
 * **A skill may be about a FOLIO.** Running `pipeline/content-graph.ts` is
 * correct in a folio and unresolvable in the platform, which carries no
 * folio — `AGENTS.md` says so in its first banner. Failing on those would make
 * the check unrunnable, and exempting the whole corpus would give up the `z9eb`
 * case, where `session-intent` named `STATUS.md` and `docs/coordination/` and
 * neither has ever existed anywhere.
 *
 * So in a skill a path is checked when it **claims to be about this tree**:
 * its first segment is a directory that exists at the repository root
 * (`cat-harness/…`, `beans/…`), or it names a root-level file with no
 * directory part at all (`STATUS.md`). Everything else is COUNTED as
 * folio-relative rather than passing silently, so the coverage is visible.
 */
export type Corpus = "entry" | "skill";

/** Is this path one the SKILL corpus is entitled to judge? */
export function aboutThisTree(repo: string, tok: string): boolean {
  const path = tok.replace(/^\.\//, "");
  const first = path.split("/")[0]!;
  // A bare name with no directory part: judged only when it is MARKDOWN. A
  // root-level document a skill tells you to open is about this repository —
  // `STATUS.md` is the `z9eb` case. `proof-objects.json` and
  // `harness.config.json` are a FOLIO's artefacts, named with no directory
  // because the skill is speaking from inside one, and judging those here
  // reports a folio's layout as a defect.
  if (first === path) return path.endsWith(".md");
  // A head a FOLIO has means the skill is speaking from inside one, and this
  // tree is not entitled to judge it — even when a directory of that name
  // happens to sit here too.
  //
  // Added 2026-09-21 with `docs`, and the pairing is the whole point. The two
  // notions were already both present and answered separately: line ~407
  // HOLDS a folio-addressed command in the entry corpus, while the skill
  // corpus asked only "does a directory of that name exist here". They agreed
  // by accident until the repository root gained a `docs/` (bean `n0nf`), at
  // which point `docs/audits/…` in a paper-adapter skill became "about this
  // tree" and was reported missing. Measured: 7 findings with the directory
  // present, 0 without.
  //
  // The skill was never wrong. `docs/audits/…` is a FOLIO's audit output, and
  // the platform's own documentation is spelled `cat-harness/docs/…` with its
  // layer prefix, so it still carries a head this tree does judge.
  if (SKILL_FOLIO_HEADS.has(first)) return false;
  try {
    return statSync(join(repo, first)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * An exemption for one fenced block, on the line above it.
 *
 * ```
 * <!-- command-path-ok: this probes for a directory that may not be here -->
 * ```
 *
 * Same shape as `declared-path-literal:` in `check:declared-paths` and
 * `<cat-harness.processes:no-skill reason="…"/>`: exempt, but **the reason is required**, so
 * silencing the check costs more than satisfying it, and exempted blocks are
 * COUNTED in the summary rather than disappearing.
 *
 * The case it exists for is real and is not a template: the onboarding guide's
 * `ls content/` is a PROBE — it tells you which repository you are in by
 * whether the directory is there. A path whose absence is the answer cannot be
 * required to resolve.
 */
const EXEMPT = /<!--\s*command-path-ok:\s*(\S[^>]*?)\s*-->/;

/** Every fenced shell block in a markdown file, as `{line, text, exempt}`. */
export function shellBlocks(md: string): { line: number; text: string; exempt: boolean }[] {
  const out: { line: number; text: string; exempt: boolean }[] = [];
  const lines = md.split("\n");
  for (const m of md.matchAll(FENCE)) {
    const info = (m[2] ?? "").trim();
    if (!SHELL_INFO.test(info)) continue;
    const before = md.slice(0, m.index ?? 0);
    const line = before.split("\n").length;
    // The nearest non-blank line above the fence.
    let i = line - 2;
    while (i >= 0 && lines[i]!.trim() === "") i--;
    out.push({ line, text: m[3] ?? "", exempt: i >= 0 && EXEMPT.test(lines[i]!) });
  }
  return out;
}

/** Check one file's fenced commands against the tree at `repo`. */
export function checkFile(repo: string, rel: string, report: CommandPathReport, corpusOf: Corpus): void {
  let md: string;
  try {
    md = readFileSync(join(repo, rel), "utf8");
  } catch {
    return;
  }
  report.filesRead++;
  for (const block of shellBlocks(md)) {
    if (block.exempt) {
      report.exempt++;
      continue;
    }
    const lines = block.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]!;
      // A comment inside a command block is prose again.
      const cmd = raw.replace(/#.*$/, "");
      if (!cmd.trim()) continue;
      if (skipCommand(cmd) !== undefined) {
        report.declined++;
        continue;
      }
      const words = shellWords(cmd);
      for (let w = 0; w < words.length; w++) {
        const tok = words[w]!.replace(/[.,:)\]}]+$/, "");
        if (!tok) continue;
        // `-o extracted-text.md`, `> out.md`: an output target is a file the
        // command CREATES, so requiring it to exist inverts the check.
        if (/^(-o|--out|--output|-out)$/.test(words[w - 1] ?? "")) {
          report.declined++;
          continue;
        }
        if (skipReason(tok) !== undefined) {
          report.declined++;
          continue;
        }
        if (corpusOf === "skill" && !aboutThisTree(repo, tok)) {
          report.folioRelative++;
          continue;
        }
        report.checked++;
        const at = { file: rel, line: block.line + 1 + i, command: raw.trim() };
        if (!existsSync(join(repo, tok)) && !throughMove(repo, tok, report, at)) report.dead.push({ ...at, token: tok });
      }
    }
  }
}

/**
 * `owns`, when given, keeps only the files it accepts as SUBJECTS (a layer's
 * PR checks judge only the caller's own files: owner ruling 2026-11-05, "Move
 * the checks"; `lib/gate-own.ts`). A path a command names still resolves
 * against the whole checkout.
 */
export function checkCommandPaths(repo: string = repoRootFor(INSTANCE_ROOT), owns: (rel: string) => boolean = () => true): CommandPathReport {
  const report: CommandPathReport = { filesRead: 0, checked: 0, declined: 0, folioRelative: 0, exempt: 0, held: [], dead: [], moved: [] };
  for (const { file, corpus: c } of corpus(repo)) if (owns(file)) checkFile(repo, file, report, c);
  checkHooks(repo, report, owns);
  checkPrintedCommands(repo, report, owns);
  return report;
}

/**
 * A command a program PRINTS, or tells a reader to run in its own header.
 *
 * Bean `b963`, third occurrence class, found by CI going red. The message
 * `docs:harness:check` printed **while failing** read:
 *
 * ```
 * Run `bun run cat-harness-tools/scripts/sync-docs-harness.ts` and commit the result.
 * ```
 *
 * There is no root `scripts/`. The instruction telling a reader how to fix the
 * failure named a path that does not exist — and neither of the two readers
 * above can see it: it is neither a fenced block nor a JSON `command` field,
 * but a string literal in a `.ts` file.
 *
 * ## Two signals, and the second is what makes it decidable
 *
 * The corpus overlaps `check:declared-paths`, which walks every literal here.
 * The question is what differs: not *does this path resolve* but **is this a
 * command somebody will type, written from the wrong place**.
 *
 * **First, a RUNNER VERB.** `scripts/x.ts` appears in this source two ways
 * that must not be confused, and both are the same string:
 *
 * | | example | correct relative to |
 * |---|---|---|
 * | a cross-reference in prose | ``see `scripts/known-skills.ts` `` | the LAYER — and it resolves |
 * | a command in a header or a message | `bun run cat-harness-tools/scripts/lean-audit.ts` | the REPOSITORY — where a person stands |
 *
 * Only the second is wrong. `bun run`, `bunx`, `bash`, `npx`, `python3`,
 * `deno run` say a human is about to execute this, and nothing else does.
 *
 * **Second, the path must RESOLVE UNDER A LAYER.** This is what the first
 * draft got wrong and it gutted the check: it reused {@link aboutThisTree},
 * which judges a path only when its first segment exists at the repository
 * root — and `scripts/` does not exist there, *which is the entire defect*.
 * The check declined the one case it was written for, and reported 43 paths
 * checked where a hand grep found 370 candidates.
 *
 * So the rule is inverted, and the inversion is the design:
 *
 * > **The path does not resolve from the repository root, but
 * > `<instance>/<path>` does.** That is not "a path that might be wrong" — it
 * > is a path that is wrong *and whose fix is known*, so the finding names it.
 *
 * A path that resolves nowhere is a folio's (`pipeline/qa-sweep.ts` is
 * correct in a folio and this repository carries none) and is COUNTED, never
 * failed. Layer roots are discovered as the directories carrying their own
 * `harness.json`, not listed here — a list would rot on the next split, which
 * is the defect this whole check exists for.
 *
 * ## Two stated limits
 *
 * **`node` and `sh` are not in the verb list.** They are ordinary words in
 * this codebase — "node" appears in nearly every graph module — and including
 * them matched prose like *"node resolves to its `.md`"*. Measured: four
 * findings, all four false. A verb that is also English is not a signal.
 *
 * **A bare invocation with no runner verb is not detected.**
 * `scripts/install-beans.sh && export PATH=…` has no verb in front of it.
 * Named rather than papered over: widening to "a line beginning with a path"
 * would match the prose class above, which is the larger one. Where such a
 * line is printed it usually sits in a fenced block or a hook command, which
 * the other two readers cover.
 */
export function checkPrintedCommands(repo: string, report: CommandPathReport, owns: (rel: string) => boolean = () => true): void {
  const RUNNER = /\b(?:bun run|bunx|bash|npx|python3|python|deno run)\s+(?=[A-Za-z0-9_.])/;
  const instances = instanceRoots(repo);
  for (const file of sourceFiles(repo)) {
    if (!owns(file)) continue;
    let text: string;
    try {
      text = readFileSync(join(repo, file), "utf8");
    } catch {
      continue;
    }
    report.filesRead++;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const m = RUNNER.exec(line);
      if (!m) continue;
      // From the verb to the end of the line, with the syntax that carried it
      // stripped: quotes and backticks, a closing JSDoc, a trailing comma.
      // A verb that opens a code span (`` `bun run x` ``) ends at the span's
      // closing backtick: the prose after it is not part of the command.
      const opensSpan = line[m.index - 1] === "`";
      const close = opensSpan ? line.indexOf("`", m.index) : -1;
      const cmd = line
        .slice(m.index, close === -1 ? undefined : close)
        .replace(/[`'"]/g, " ")
        .replace(/\s*\*\/\s*$/, "")
        .replace(/,\s*$/, "");
      if (skipCommand(cmd) !== undefined) {
        report.declined++;
        continue;
      }
      for (const word of shellWords(cmd)) {
        const tok = word.replace(/[.,:)\]}]+$/, "");
        if (!tok || skipReason(tok) !== undefined) {
          report.declined++;
          continue;
        }
        if (existsSync(join(repo, tok)) || throughMove(repo, tok, report, { file, line: i + 1, command: cmd.trim() })) {
          report.checked++;
          continue;
        }
        const under = instances.find((r) => existsSync(join(repo, r, tok)));
        if (under === undefined) {
          // Resolves nowhere: a folio's path, or something this cannot judge.
          report.folioRelative++;
          continue;
        }
        report.checked++;
        const finding = {
          file,
          line: i + 1,
          token: `${tok}  →  ${under}/${tok}`,
          command: cmd.trim(),
        };
        // The owner's verdict, 2026-09-20: a command addressed to a FOLIO is
        // counted; anything else naming this repository's own tooling is a
        // defect, and the finding already carries its fix.
        if (FOLIO_OWNED.has(tok.split("/")[0]!)) report.held.push(finding);
        else report.dead.push(finding);
      }
    }
  }
}

/**
 * The layer roots, DISCOVERED rather than listed.
 *
 * A directory carrying its own `harness.json` is a layer by this
 * repository's own definition. Hardcoding the list would rot on the next
 * split — which is the exact defect this check exists to catch, and writing it
 * into the check would be a poor joke.
 */
/**
 * Directories a FOLIO owns, whose commands are counted rather than failed.
 *
 * **The owner's verdict on the 237, 2026-09-20: fail on `scripts/`, count
 * `content/`.** The two groups were not the same defect. A command naming
 * `scripts/x.ts` can only mean this repository's tooling — a folio has no
 * `scripts/` at all — so from the repository root it is simply broken. A
 * command naming `pipeline/x.ts` is written for somebody standing in a
 * FOLIO, where it is correct; the onboarding guide already carries three such
 * blocks marked *"run IN A FOLIO"*.
 *
 * ## The basis, stated rather than dressed up
 *
 * `init-folio` writes `folio/`, `uploads/` and `library/` — that much is read
 * from the scaffolder, not from prose. `content/` is here because a folio may
 * declare its content root there and `litlfred/qou` does; `lean/` and `.lake/`
 * because the paper adapter puts a folio's proofs and build output there.
 *
 * **This is a LAYOUT, not a declaration, and that is weaker than this
 * repository's usual standard.** No `harness.json` names either `scripts/` or
 * `content/`, so nothing mechanical separates them — which is exactly why the
 * question went to the owner rather than being decided here. The weakness is
 * carried as an open Done-when on bean `b963` so a later session can tighten
 * it against a declaration instead.
 *
 * Note what this list is NOT: it is not "directories that exist in a folio",
 * which would be unbounded. It is the set whose appearance at the head of a
 * command means *this command is addressed to a folio*.
 */
export const FOLIO_OWNED = new Set(["folio", "content", "uploads", "library", "lean", ".lake"]);

/**
 * Path heads that mean "a folio's", **for the SKILL corpus only**.
 *
 * It is `FOLIO_OWNED` plus `docs`, and the difference is not an oversight —
 * the two sets answer different questions and `docs` is the one place they
 * disagree.
 *
 * | corpus | `docs/x` means | verdict |
 * |---|---|---|
 * | entry (README, AGENTS) | THIS repository's, spelled short | **fail**, with the fix `docs/x -> cat-harness/docs/x` |
 * | skill | an instruction to a folio author, run in THEIR folio | not this tree's to judge |
 *
 * An entry document describes this repository, so a bare `docs/` there is a
 * reference that lost its layer prefix and the finding carries its repair.
 * A skill is executed by an agent working inside a folio, where `docs/` is
 * that folio's — `docs/audits/…` is its audit output and `docs/_site` its
 * rendered pages. Both readings are right for their corpus, which is what
 * `Corpus` exists to distinguish.
 *
 * **Adding `docs` to `FOLIO_OWNED` instead was tried and is WRONG**: it turns
 * the entry corpus's real correction into a silent hold, and
 * `check-command-paths.test.ts` says so directly — *"`docs/` is this
 * repository's, so it fails"*. That test caught the mistake.
 *
 * The case is not hypothetical. The repository root gained a `docs/` on
 * 2026-09-21 (bean `n0nf`), and `docs/audits/…` in a paper-adapter skill
 * immediately became "about this tree" and was reported missing. Measured:
 * **7 findings with the directory present, 0 without**, and adding the head
 * here moves exactly those 7 — 297 checked before, 290 after.
 */
const SKILL_FOLIO_HEADS = new Set([...FOLIO_OWNED, "docs"]);

export function instanceRoots(repo: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(repo)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    try {
      if (statSync(join(repo, name)).isDirectory() && findDeclarationFile(join(repo, name)) !== undefined) {
        out.push(name);
      }
    } catch {
      /* unreadable entry: not a layer root as far as this can tell */
    }
  }
  return out.sort();
}

/** Every `.ts` and `.sh` file whose printed commands are read. */
export function sourceFiles(repo: string): string[] {
  // DISCOVERED from the layer roots, not listed. The first draft named
  // `cat-harness/{scripts,src,content,schemas}`, and a merge from `main`
  // brought the IRIS replica layer with its own `scripts/` that the check
  // then walked straight past — a hardcoded list going stale inside the check
  // whose whole subject is hardcoded paths going stale.
  const out: string[] = [];
  for (const inst of instanceRoots(repo)) {
    for (const sub of ["scripts", "src", "content", "schemas"]) {
      const dir = join(repo, inst, sub);
      if (!existsSync(dir)) continue;
      for (const f of walkSource(dir)) out.push(f.slice(repo.length + 1));
    }
  }
  return out;
}

function walkSource(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkSource(p));
    else if (/\.(ts|sh)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The commands in `.claude/settings.json` — the ones nobody types.
 *
 * **This is the `b963` class at its most consequential, and it was found by
 * this check's own corpus NOT covering it.** On 2026-09-20 the `SessionStart`
 * hook read:
 *
 * ```
 * bash "$CLAUDE_PROJECT_DIR/scripts/session-start-coord-sweep.sh"
 * ```
 *
 * There is no root `scripts/`. So the hook that installs the `beans` CLI and
 * prints the work-plan sweep had been a **silent no-op for every session since
 * the split** — and a hook that fails is indistinguishable from a hook that ran
 * and found nothing to say, which is the `xom7` shape exactly.
 *
 * It needs its own reader because a hook command is not in a fenced block and
 * not in markdown: it is a JSON string field, so the whole corpus above walks
 * straight past it. `$CLAUDE_PROJECT_DIR` is the repository root, so the path
 * after it is repository-relative and judged as one — the expansion is
 * stripped by {@link shellWords} like any other, which is why it is put back
 * here rather than left for the tokenizer to guess at.
 *
 * **`.mcp.json` is the same class, and it was the next one to break.** On
 * 2026-09-30 the root file still named `scripts/sage-mcp.sh` and
 * `scripts/google-drive-mcp.sh` ten days after both moved to
 * `cat-harness/scripts/`. Every session's host reported the two servers as
 * failing to connect (`ENOENT`), and nothing here read the file, because this
 * reader was written for hooks and named for them. A host launches an MCP
 * server from the project root, so its `command` and each `args` entry are
 * judged as repository-relative words exactly like a hook's.
 */
export const HOST_COMMAND_FILES = [join(".claude", "settings.json"), ".mcp.json"] as const;

export function checkHooks(repo: string, report: CommandPathReport, owns: (rel: string) => boolean = () => true): void {
  for (const file of HOST_COMMAND_FILES) if (owns(file)) checkHostCommandFile(repo, file, report);
}

function checkHostCommandFile(repo: string, file: string, report: CommandPathReport): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(join(repo, file), "utf8"));
  } catch {
    return; // No such file is a determined absence: this layer has no hooks, or no MCP servers.
  }
  report.filesRead++;
  const commands: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "command" && typeof val === "string") commands.push(val);
        else if (k === "args" && Array.isArray(val)) {
          for (const a of val) if (typeof a === "string") commands.push(a);
        } else walk(val);
      }
    }
  };
  walk(parsed);
  for (const cmd of commands) {
    if (skipCommand(cmd) !== undefined) {
      report.declined++;
      continue;
    }
    // Put the project root back before the expansion is stripped: it IS the
    // repository root, so what follows it is a repository-relative path.
    for (const word of shellWords(cmd.replace(/\$\{?CLAUDE_PROJECT_DIR\}?\//g, ""))) {
      const tok = word.replace(/[.,:)\]}]+$/, "");
      if (!tok || skipReason(tok) !== undefined) {
        report.declined++;
        continue;
      }
      report.checked++;
      if (!existsSync(join(repo, tok)) && !throughMove(repo, tok, report, { file, line: 0, command: cmd })) {
        report.dead.push({ file, line: 0, token: tok, command: cmd });
      }
    }
  }
}

/**
 * The files whose commands are checked.
 *
 * The agent entry files — reusing `findEntryFiles`, so the corpus cannot drift
 * from the one `check:agent-entry-links` gates — plus `README.md` and every
 * skill body. Skills are in because `z9eb` is a skill: a user-invocable one
 * whose step 1 named a file that has never existed in this repository.
 */
export function corpus(repo: string): { file: string; corpus: Corpus }[] {
  const out: { file: string; corpus: Corpus }[] = [];
  for (const p of findEntryFiles(repo)) out.push({ file: p.slice(repo.length + 1), corpus: "entry" });
  // declared-path-literal: the two ENTRY pages a newcomer copies commands from, named repo-relative because this check reads them as the reader does. One is the harness's onboarding guide; the script moved up to cat-harness-tools in 70lx B2b, so a path that was its own layer's is now its implementer's (downward).
  for (const f of ["README.md", "cat-harness/docs/guides/agent-onboarding.md"]) {
    if (existsSync(join(repo, f))) out.push({ file: f, corpus: "entry" });
  }
  // ASKED, not composed. The first draft listed `cat-harness/skills`,
  // `cat-harness/methodologies` and `bootstrap/skills`, and
  // `check:declared-paths` refused it — correctly, and with some irony for a
  // check whose whole subject is a path that moved. A topical split of the
  // knowledge graph is exactly the relocation this check would then have
  // stopped seeing.
  // `.claude/skills/` is not a declared kg directory — it is the HOST agent's
  // skill directory, which this repository fills with trigger stubs. Named
  // explicitly for that reason, and checked because a stub's whole job is to
  // point at the canonical skill: a stub with a dead link is worse than no
  // stub, since it reads as a working pointer.
  for (const f of existsSync(join(repo, ".claude/skills")) ? walkMarkdown(join(repo, ".claude/skills")) : []) {
    out.push({ file: f.slice(repo.length + 1), corpus: "skill" });
  }
  // `docs` too: the onboarding translations and `docs/start/installation.md`
  // rotted unseen while only the English entry page was read (folio-assistant#740).
  for (const graph of [...KG_CONTENT_GRAPH_TYPOLOGIES, "methodology", "docs"]) {
    for (const dir of corpusDirectoriesForGraph(INSTANCE_ROOT, graph)) {
      if (!existsSync(dir)) continue;
      for (const f of walkMarkdown(dir)) out.push({ file: f.slice(repo.length + 1), corpus: "skill" });
    }
  }
  const seen = new Set<string>();
  return out.filter((e) => !seen.has(e.file) && seen.add(e.file)).sort((a, b) => a.file.localeCompare(b.file));
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  // A SYNCED skill is upstream's prose, pinned: a dead path in it is not ours
  // to repair, and editing it would fork the copy fixity vouches for (#556).
  if (isSyncedSkillDir(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkMarkdown(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function formatReport(r: CommandPathReport): string {
  const out = [
    `Command paths (${r.filesRead} file(s); ${r.checked} checked, ${r.folioRelative} folio-relative, ` +
      `${r.exempt} exempt, ${r.declined} declined as templates, URLs, refs or non-paths)`,
  ];
  if (r.filesRead === 0) return "Command paths\n  ? EXAMINED NOTHING — no entry files or skills found. Not a pass.";
  if (r.held.length) {
    const byFirst = new Map<string, number>();
    for (const h of r.held) {
      const seg = h.token.split("/")[0]!;
      byFirst.set(seg, (byFirst.get(seg) ?? 0) + 1);
    }
    out.push(
      `  · ${r.held.length} printed command(s) addressed to a FOLIO — counted, not failed ` +
        `(the owner's verdict on bean \`b963\`, 2026-09-20):`,
    );
    for (const [seg, n] of [...byFirst].sort((a, b) => b[1] - a[1])) {
      out.push(`      ${String(n).padStart(4)}  ${seg}/…`);
    }
    out.push("      `--held` lists them. The basis is a LAYOUT, not a declaration — see FOLIO_OWNED.");
  }
  if (r.moved.length) {
    out.push(`  · ${r.moved.length} path(s) resolve only through a declared move — passing until its \`until\`, still to switch:`);
    for (const m of r.moved) out.push(`      ${m.file}:${m.line}  \`${m.token}\`  (${m.move})`);
  }
  if (r.dead.length === 0) {
    // The claim names its FRAME, because bean `7iog` is what a claim
    // without one costs: `check:workflow-paths` said "every workflow script
    // path resolves" over three calls that aborted their step, and the
    // sentence was true of the repository and false of the run. Every path
    // here is judged from the repository root, which is where a reader of a
    // doc or a hook stands — and is NOT where a workflow step stands.
    out.push("  ✓ every repository-relative path resolves — FROM THE REPOSITORY ROOT,");
    out.push("    in prose, printed commands and hooks. A workflow step runs somewhere");
    out.push("    else; that frame is `bun run cat check:workflow-paths` (bean `7iog`).");
    return out.join("\n");
  }
  for (const d of r.dead) {
    out.push(`  ✗ ${d.file}:${d.line}  \`${d.token}\` does not exist`);
    out.push(`      in: ${d.command}`);
  }
  out.push("");
  out.push("  An agent copy-pastes these. A path that moved is a first instruction that fails.");
  return out.join("\n");
}

if (import.meta.main) {
  let report: CommandPathReport;
  // In a layer's PR checks, only the caller's own files (owner ruling 2026-11-05).
  const scoped = gateOwnsFile(".") !== undefined;
  try {
    report = checkCommandPaths(undefined, (rel) => gateOwnsFile(rel) ?? true);
  } catch (e) {
    console.error(`Could not check command paths: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  if (process.argv.includes("--held")) {
    for (const h of report.held) console.log(`${h.file}:${h.line}  ${h.token}\n    in: ${h.command}`);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  if (scoped && report.filesRead === 0) {
    console.log("✓ check:command-paths: the caller commits none of the files it reads; the mounted layers' are judged by their own CI.");
    process.exit(0);
  }
  process.exit(report.dead.length || report.filesRead === 0 ? 1 : 0);
}
