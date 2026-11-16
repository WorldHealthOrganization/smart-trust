/**
 * Which lines of a check's source can make its answer depend on something the
 * input hash does not see — and the reviewed annotation that says why one does
 * not.
 *
 * @module scripts/input-sites
 * @graphNode none — a source scanner read by `input-hash.ts`
 *
 * `input-hash.ts` skips a check whose declared inputs hash to its last pass,
 * which is sound only if the check reads NOTHING else: no environment variable,
 * no network, no clock, no git history, no file outside the working tree, no
 * module it reaches by a computed path. That claim is about a script's whole
 * IMPORT CLOSURE, so it is checked mechanically on every fingerprint: the
 * closure is walked, every line matching a {@link RISKS} pattern is a SITE,
 * and a site must carry a reviewed annotation (below) whose pin matches the
 * code it annotates. One unannotated or stale site anywhere in the closure
 * makes the fingerprint UNDETERMINED, and the check runs.
 *
 * ## The annotation
 *
 * A `//` comment on the line(s) directly above the site:
 *
 * ```ts
 * // input-site: env-unset FOLIO_FIXTURE_CHECKOUT #3f9c2a1b — a test-only override naming a checkout outside the tree
 * const fixture = process.env[FIXTURE_ENV];
 * ```
 *
 * The verdicts, separated by `;` when a site needs more than one:
 *
 * | verdict | means | the fingerprint then |
 * |---|---|---|
 * | `env A,B` | the site reads these variables, and their VALUES are all that reaches the answer | hashes each value (unset distinct from empty) |
 * | `env-unset A` | the variable names something outside the tree (a path, a URL) | is undetermined unless `A` is unset or empty |
 * | `tree` | the answer is a function of the working tree and index — `git ls-files`, `git rev-parse --show-toplevel` | is undetermined unless the declaration is `{tracked}` |
 * | `head` | the answer reads commit history reachable from `HEAD` — `git log`, `git rev-list HEAD` | hashes the `HEAD` commit id and the shallow boundary: a commit id names its whole history |
 * | `store` | configures or performs a branch-store read (`branch-store.ts`, `qa-store.ts`), whose every git call is reported to the trace — by `qa-store`'s snapshot as the ref it reads, by `TreeStore.git()` otherwise | nothing; a recording run tolerates only `qa-ref` lines for the `--against` refs whose identity it hashed |
 * | `refs A,B` | the answer reads these refs (`origin/main`) and the history they reach | hashes what each resolves to, missing included |
 * | `traced` | a read no check is known to reach, behind a call to `inputSiteReached()` on the line directly above it (`input-trace.ts`) | nothing — a run that reaches it records no hash |
 * | `inert` | the value read never reaches the exit code: a timestamp in a message, a duration, a temp dir removed before exit | nothing |
 * | `imports <glob>,…` | a computed `import()` / `require()` whose targets all lie under these globs | adds the globs' files to the closure as IMPORTED modules |
 * | `declared <source>,…` | a computed `import()` / `require()` whose targets are the modules these DECLARATION SOURCES name (`declared-imports.ts`): what the site itself reads to choose them | adds the modules the declarations name NOW, resolved at fingerprint time, as IMPORTED modules; a source that does not resolve is undetermined |
 * | `scripts <name>,…` | a spawned `bun run <name>` of these package.json scripts, with this process's environment | adds each script's entry files (`entryFiles`) as ENTRIES; a name that does not resolve is undetermined |
 * | `runs <glob>,…` | a spawned `bun` script whose entry files all lie under these globs, run with this process's environment | adds the globs' files to the closure as ENTRIES — their `import.meta.main` blocks run |
 * | `spawned` | a spawn of `bun` (or `process.execPath`) or `python3` — inline code (`-c`, `-e`) or a script — and of nothing else on the line; implicit in a test file ({@link testSpawnVerdict}) | is undetermined unless the run is traced: the cone audits the child from its read set (`ci-cone.ts` `childInputsOf`) |
 *
 * ## A computed load is audited in full, and hashed only where no trace is
 *
 * What an `imports` or `declared` verdict adds — and everything those modules
 * import or run — is AUDITED like any other source, so an environment read in
 * a validator module still reaches the fingerprint. Which of them a run
 * actually loads is a function of code and data, so {@link AuditedClosure}
 * lists them apart (`computed`): a fingerprint whose run is traced
 * (`ci-cone.ts`, whose read set records every module file the run opened)
 * need not hash them, since the trace holds the ones that run loaded, and only
 * those can change its answer (`input-hash.ts`).
 *
 * The PIN is the first 8 hex digits of the sha-256 of the site's STATEMENT
 * (the site line plus the lines up to where its brackets balance, at most
 * {@link MAX_STATEMENT_LINES}, whitespace-normalised). Change the statement —
 * `git ls-files` to `git log` — and the pin is stale: the site counts as
 * unannotated until a person re-reads it and re-pins. `bun run
 * input-hash:coverage --sites <file>` prints the current pins.
 *
 * ## What this cannot see
 *
 * - packages (bare specifiers): covered by `bun.lock`'s content, not scanned;
 * - an access spelled to dodge every pattern (`globalThis["proc"+"ess"]`) —
 *   the scanner is a reviewer's aid with a refusal default, not a sandbox;
 * - `.py` / `.sh` sources: not scanned at all, so a check that runs one is
 *   undetermined (`input-hash.ts`).
 */
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** A statement longer than this is pinned on its first lines only. */
export const MAX_STATEMENT_LINES = 12;

/**
 * Patterns for a line whose code can read something the hash does not see.
 * Matched against code lines only (comment lines are skipped). Broad on
 * purpose: a false site costs an annotation, a missed one costs a false skip.
 */
export const RISKS: Readonly<Record<string, RegExp>> = {
  env: /\bprocess\.env\b|\bBun\.env\b|\bimport\.meta\.env\b|\bDeno\.env\b/,
  network: /\bfetch\s*\(|["']node:(?:https?|http2|net|dns|tls|dgram)["']|\bWebSocket\b|\bBun\.connect\b|\bXMLHttpRequest\b/,
  clock: /\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bperformance\.now\s*\(|\bprocess\.hrtime\b|\bBun\.nanoseconds\b/,
  random: /\bMath\.random\s*\(|\brandomUUID\s*\(|\brandomBytes\s*\(|\bgetRandomValues\s*\(/,
  spawn: /(?<!typeof\s)\bspawnSync\b|(?<!\w)spawn\s*\(|\bexecSync\b|\bexecFileSync\b|(?<!\w)execFile\s*\(|(?<![\w.])exec\s*\(|\bBun\.spawn(?:Sync)?\b|\bBun\.\$|\bnew Worker\s*\(/,
  host: /\bhomedir\s*\(|\btmpdir\s*\(|\bhostname\s*\(|\buserInfo\s*\(|\bcpus\s*\(|\bnetworkInterfaces\s*\(/,
  computed: /(?:^|[^\w$.])import\s*\(\s*(?!["'][^"'`$]*["']\s*\))|\brequire\s*\(\s*(?!["'][^"'`$]*["']\s*\))|\beval\s*\(|\bnew Function\s*\(/,
  outside: /["'`]\/(?:home|root|tmp|etc|usr|var|proc)\//,
};

/** One reviewed verdict on a site. */
export type SiteVerdict =
  | { kind: "env"; names: string[] }
  | { kind: "env-unset"; names: string[] }
  | { kind: "tree" }
  /** It runs a `bun` or `python3` child, which only the cone audits, from its trace. Implicit in a test file (see {@link testSpawnVerdict}). */
  | { kind: "spawned" }
  | { kind: "head" }
  | { kind: "store" }
  | { kind: "traced" }
  | { kind: "refs"; names: string[] }
  | { kind: "inert" }
  | { kind: "imports"; globs: string[] }
  | { kind: "declared"; sources: string[] }
  | { kind: "runs"; globs: string[] }
  | { kind: "scripts"; names: string[] };

/** What `bun test` collects: `*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*` (also `affected-tests.ts`'s). */
export const TEST_FILE_RE = /(?:\.test|_test|\.spec|_spec)\.(?:[cm]?[jt]sx?)$/;

/**
 * The one site that needs no annotation (owner ruling, 2026-11-05: "Rule for
 * test scratch dirs"): in a TEST file, a line whose only risk is `host` and
 * whose every host match is `tmpdir()` asks where the scratch directory goes,
 * almost always for `mkdtempSync(join(tmpdir(), …))`. It is `inert`: what a
 * test writes there and reads back is its own, and paths outside the
 * checkout are the environment the cone already leaves out of read sets.
 * `homedir()`, `hostname()`, `userInfo()` and the rest still need a reviewed
 * annotation, in a test as anywhere.
 */
export function isTestScratchDir(file: string, risks: readonly string[], code: string): boolean {
  if (!TEST_FILE_RE.test(file)) return false;
  if (risks.length !== 1 || risks[0] !== "host") return false;
  return /\btmpdir\s*\(/.test(code) && !RISKS.host!.test(code.replace(/\btmpdir\s*\(/g, ""));
}

/** `process.env` written, deleted, or spread whole into a child's environment: no value of it is read here. */
const ENV_WRITE_RE = /\bprocess\.env(?:\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])\s*=(?!=)|\bdelete\s+process\.env(?:\.[A-Za-z_$][\w$]*|\[[^\]\n]+\])|\.\.\.process\.env\b(?![.[])/g;

/**
 * The third and fourth sites that need no annotation in a TEST file (a test
 * is only ever fingerprinted as a cone gate, `ci-cone.ts` `test:`):
 *
 * - `env`, when every `process.env` on the line is written (`process.env.X =`),
 *   deleted, or spread whole into a child's environment (`{ ...process.env }`).
 *   None of those reads a value into the test; a child's own reads are audited
 *   from the trace (`childInputsOf`) or carry their spawn's own verdict.
 * - `build`, a build-output directory named in a string. That risk exists
 *   because the f017 tree digest leaves those directories out; the cone's read
 *   set records every path a test opens under them, as any other.
 *
 * Both are `inert`. A read such as `const prev = process.env.X` still needs a
 * reviewed annotation, as does any line with another risk beside these.
 */
export function isTestInertWrite(file: string, risks: readonly string[], code: string): boolean {
  if (!TEST_FILE_RE.test(file)) return false;
  // input-site: inert #6add3b6e — the risk's name, compared; no path is read
  if (risks.length === 1 && risks[0] === "build") return true;
  if (risks.length !== 1 || risks[0] !== "env") return false;
  const rest = code.replace(ENV_WRITE_RE, "");
  return rest !== code && !RISKS.env!.test(rest);
}

/** The call that starts a process, then its command or argv[0]. */
const SPAWN_CALL = String.raw`(?:\bBun\.spawn(?:Sync)?|\bspawnSync|(?<!\w)spawn|\bexecFileSync|(?<!\w)execFile)\s*\(\s*\[?\s*`;
/** A spawn of a literal `git`. */
const GIT_SPAWN_RE = new RegExp(`${SPAWN_CALL}["']git["']`, "g");
/** A spawn of `bun` itself (the literal, or the running binary) or of `python3`: a child whose sources the cone audits. */
const CHILD_SPAWN_RE = new RegExp(`${SPAWN_CALL}(?:["'](?:bun|python3?)["']|process\\.execPath\\b)`, "g");

/**
 * The implicit verdict of a TEST file's spawn line, if it has one: the second
 * site, after the scratch dir, that needs no annotation in a test. Its only
 * risk is `spawn`, and every spawn on it runs a literal `git`, `bun` itself or `python3`.
 * A test is only ever fingerprinted as a cone gate (`ci-cone.ts`, `test:`):
 *
 * - `git` is `tree`. The cone replays every git command the run executed in
 *   the checkout, and keeps the reads of one it ran in a scratch directory it
 *   created (its own repository, `parseTrace`); any other git command leaves
 *   the run unrecorded.
 * - `bun` or `python3` is `spawned`. The child's sources are in the traced
 *   read set, so a change to one reruns the test, and what they read from the
 *   environment is audited from that read set when the run is recorded
 *   (`ci-cone.ts` `childInputsOf`; Python by `input-sites-py.ts`), never
 *   declared. A child that ran inline code (`-c`, `-e`) records nothing.
 *
 * A fingerprint that does not replay a trace answers neither, so it stays
 * undetermined.
 */
/** Does `raw` spawn `bun` or `python3` — and, besides `git`, nothing else? What an explicit `spawned` verdict may annotate. */
export function isChildSpawn(raw: string): boolean {
  const noGit = raw.replace(GIT_SPAWN_RE, "");
  const rest = noGit.replace(CHILD_SPAWN_RE, "");
  return rest !== noGit && !RISKS.spawn!.test(rest);
}

export function testSpawnVerdict(file: string, risks: readonly string[], raw: string): SiteVerdict[] | undefined {
  if (!TEST_FILE_RE.test(file)) return undefined;
  if (risks.length !== 1 || risks[0] !== "spawn") return undefined;
  // `raw` is the line as written: the blanked code has no string text to name the command.
  const noGit = raw.replace(GIT_SPAWN_RE, "");
  const rest = noGit.replace(CHILD_SPAWN_RE, "");
  if (rest === raw || RISKS.spawn!.test(rest)) return undefined;
  const out: SiteVerdict[] = [];
  if (rest !== noGit) out.push({ kind: "spawned" });
  if (noGit !== raw) out.push({ kind: "tree" });
  return out;
}

/** A line of a source file that matched a risk. */
export interface Site {
  file: string;
  /** 1-based. */
  line: number;
  risks: string[];
  /** The pin the annotation must carry for this statement as it stands. */
  pin: string;
  /** The annotation's verdicts — `undefined` when unannotated, `"stale"` when the pin does not match. */
  verdicts: SiteVerdict[] | "stale" | undefined;
  /** Why an annotation could not be read, when it could not. */
  malformed?: string;
  /**
   * Inside an `if (import.meta.main) { … }` block: it runs only when this file
   * is the process's entry, never when it is imported.
   */
  inMain?: boolean;
}

/**
 * Annotations for files this repository cannot edit — the `bootstrap` and
 * `bootstrap-tools` submodules, whose source is pinned by commit. Keyed by
 * file, then by the statement's PIN, so a submodule bump that changes the
 * statement leaves the site unannotated, exactly as an inline pin would. Each
 * value is the verdict text an inline annotation would carry, then ` — why`.
 * Inline annotations are preferred; an entry here moves upstream with the file.
 */
export const SUBMODULE_SITES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "bootstrap-tools/scripts/git-files.ts": {
    "7e7c88ec": "tree — ls-files --cached --others --exclude-standard: the index and the untracked files",
    "481c0381": "tree — ls-files: the index and the untracked files",
  },
};

const ANNOTATION_RE = /^\s*\/\/\s*input-site:\s*(.+?)\s*#([0-9a-f]{8})\b/;

/** Parse `env A,B; tree` into verdicts, or say what is wrong with it. */
export function parseVerdicts(text: string): SiteVerdict[] | { error: string } {
  const out: SiteVerdict[] = [];
  for (const part of text.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [word, ...rest] = part.split(/\s+/);
    const args = rest.join(" ").split(",").map((a) => a.trim()).filter(Boolean);
    switch (word) {
      case "env":
      case "env-unset":
        if (args.length === 0 || !args.every((a) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(a))) {
          return { error: `\`${word}\` needs variable names` };
        }
        out.push({ kind: word, names: args });
        break;
      case "scripts":
        if (args.length === 0 || !args.every((a) => /^[A-Za-z0-9:_-]+$/.test(a))) return { error: "`scripts` needs package script names" };
        out.push({ kind: "scripts", names: args });
        break;
      case "refs":
        if (args.length === 0 || !args.every((a) => /^[A-Za-z0-9_./-]+$/.test(a))) return { error: "`refs` needs ref names" };
        out.push({ kind: "refs", names: args });
        break;
      case "declared":
        if (args.length === 0 || !args.every((a) => /^[a-z][a-z0-9-]*$/.test(a))) return { error: "`declared` needs declaration source names" };
        out.push({ kind: "declared", sources: args });
        break;
      case "imports":
      case "runs":
        if (args.length === 0) return { error: `\`${word}\` needs globs` };
        out.push({ kind: word, globs: args });
        break;
      case "tree":
      case "spawned":
      case "head":
      case "store":
      case "traced":
      case "inert":
        if (args.length > 0) return { error: `\`${word}\` takes no arguments` };
        out.push({ kind: word });
        break;
      default:
        return { error: `unknown verdict \`${word}\`` };
    }
  }
  return out.length > 0 ? out : { error: "no verdict" };
}

/** The pin of the statement that starts at `lines[i]`. */
export function statementPin(lines: readonly string[], i: number): string {
  let depth = 0;
  const parts: string[] = [];
  for (let j = i; j < lines.length && j < i + MAX_STATEMENT_LINES; j++) {
    const code = lines[j]!.replace(/\/\/.*$/, "").replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    parts.push(lines[j]!.trim().replace(/\s+/g, " "));
    for (const c of code) {
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
    }
    if (depth <= 0) break;
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 8);
}

/**
 * A static import whose bindings keep their own names — `import { spawnSync }
 * from "node:child_process"`. Not a site itself: every USE of those names is
 * matched where it is called. A renamed, default or namespace import of a
 * module that carries a risk IS a site, since its uses no longer match.
 */
const RISKY_MODULE_RE = /["']node:(?:child_process|os|https?|http2|net|dns|tls|dgram|worker_threads)["']|["'](?:child_process|os|https?|net|dns|tls|dgram|worker_threads)["']/;
function isPlainImport(code: string): boolean {
  if (!/^\s*(?:import|export)\b[^(]*\bfrom\s*["']/.test(code) && !/^\s*\}\s*from\s*["']/.test(code)) return false;
  if (!RISKY_MODULE_RE.test(code)) return true;
  return /^\s*(?:import|export)\s*(?:type\s*)?\{[^}]*\}\s*from/.test(code) && !/\bas\b/.test(code.replace(/\bimport\s+type\b/, ""));
}

/**
 * The source with every comment removed and every string literal's CONTENTS
 * blanked, line for line — a template literal keeps its `${…}` expressions,
 * which are code. A `/…/` after an operator or at a statement start is read as
 * a regular expression and blanked too, so `/["']/` does not open a string.
 * A heuristic lexer, not a parser: where it guesses wrong it can only blank
 * too little (ADD a site) or treat a regex as division and read on — the
 * lines it then mis-blanks are still scanned.
 */
export function blankSource(text: string): string[] {
  return lexSource(text, false).lines;
}

/**
 * The source with comments removed and every TEMPLATE literal's text blanked,
 * its `${…}` expressions kept, while quoted strings stay whole — so an import
 * specifier can still be read, but an import a template literal WRITES
 * (`init-folio.ts`'s generated manifests and shims) is not taken for one of
 * this file. Only when the lexer ends the file balanced (in code, every brace
 * and `${` closed): a misread regex that opens a template would blank real
 * code to the end of the file, so an unbalanced lex returns the text
 * unchanged, and a doubtful file keeps every import it had.
 */
export function outsideTemplates(text: string): string {
  const { lines, balanced } = lexSource(text, true);
  return balanced ? lines.join("\n") : text;
}

function lexSource(text: string, keepQuoted: boolean): { lines: string[]; balanced: boolean } {
  const out: string[] = [];
  let cur = "";
  type Mode = "code" | "line" | "block" | "sq" | "dq" | "tpl" | "re";
  let mode: Mode = "code";
  const tplDepth: number[] = []; // brace depth at each open `${`
  let depth = 0;
  let reClass = false;
  let prevSig = ""; // last significant code character, for regex detection
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const n = text[i + 1];
    if (c === "\n") {
      out.push(cur);
      cur = "";
      if (mode === "line") mode = "code";
      if (mode === "sq" || mode === "dq" || mode === "re") mode = "code"; // unterminated: recover
      continue;
    }
    switch (mode) {
      case "line":
        continue;
      case "block":
        if (c === "*" && n === "/") {
          mode = "code";
          i++;
        }
        continue;
      case "sq":
      case "dq":
        if (c === "\\") {
          cur += keepQuoted ? text.slice(i, i + 2) : "  ";
          i++;
        } else if ((mode === "sq" && c === "'") || (mode === "dq" && c === '"')) {
          cur += c;
          mode = "code";
          prevSig = c;
        } else cur += keepQuoted ? c : " ";
        continue;
      case "re":
        if (c === "\\") {
          cur += "  ";
          i++;
        } else if (c === "[") {
          reClass = true;
          cur += " ";
        } else if (c === "]") {
          reClass = false;
          cur += " ";
        } else if (c === "/" && !reClass) {
          cur += c;
          mode = "code";
          prevSig = c;
        } else cur += " ";
        continue;
      case "tpl":
        if (c === "\\") {
          cur += "  ";
          i++;
        } else if (c === "`") {
          cur += c;
          mode = "code";
          prevSig = c;
        } else if (c === "$" && n === "{") {
          cur += "${";
          i++;
          tplDepth.push(depth);
          depth++;
          mode = "code";
        } else cur += " ";
        continue;
      case "code":
        if (c === "/" && n === "/") {
          mode = "line";
          continue;
        }
        if (c === "/" && n === "*") {
          mode = "block";
          i++;
          continue;
        }
        if (c === "'" || c === '"' || c === "`") {
          cur += c;
          mode = c === "'" ? "sq" : c === '"' ? "dq" : "tpl";
          continue;
        }
        if (c === "/" && (prevSig === "" || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || /\b(?:return|typeof|case|in|of)\s*$/.test(cur))) {
          cur += c;
          mode = "re";
          reClass = false;
          continue;
        }
        if (c === "{") depth++;
        if (c === "}") {
          depth--;
          if (tplDepth.length > 0 && tplDepth[tplDepth.length - 1] === depth) {
            tplDepth.pop();
            cur += c;
            mode = "tpl";
            continue;
          }
        }
        cur += c;
        if (!/\s/.test(c)) prevSig = c;
        continue;
    }
  }
  out.push(cur);
  return { lines: out, balanced: (mode === "code" || mode === "line") && depth === 0 && tplDepth.length === 0 };
}

/** Risks whose evidence is a string's CONTENT, matched on the raw line of a code line. */
const STRING_RISKS: Readonly<Record<string, RegExp>> = {
  network: /["']node:(?:https?|http2|net|dns|tls|dgram)["']/,
  outside: RISKS.outside!,
  // A build-output directory (`input-hash.ts` BUILD_OUTPUT_DIRS), which the tree digest leaves out.
  build: /["'`](?:\.\/)?(?:build|_kg|_site|dist)(?:\/[^"'`]*)?["'`]/,
};

/**
 * The 0-based lines inside a top-level `if (import.meta.main) { … }` block,
 * found on the blanked source (so a brace in a string does not count). Only
 * the plain block form: `if (import.meta.main) await main();` runs a function
 * whose body is elsewhere, and its sites stay reachable.
 */
export function mainBlockLines(code: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < code.length; i++) {
    if (!/^if\s*\(\s*import\.meta\.main\s*\)\s*\{/.test(code[i]!)) continue;
    let depth = 0;
    for (let j = i; j < code.length; j++) {
      for (const ch of code[j]!) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      out.add(j);
      if (depth <= 0) {
        i = j;
        break;
      }
    }
  }
  return out;
}

/** Every site in one source text, with its annotation (if any) read and checked. */
export function scanSource(file: string, text: string): Site[] {
  const lines = text.split("\n");
  const code = blankSource(text);
  const main = mainBlockLines(code);
  const sites: Site[] = [];
  for (let i = 0; i < lines.length; i++) {
    const c = code[i] ?? "";
    if (c.trim() === "") continue;
    const raw = lines[i]!;
    // A multi-line `import { … } from "…"` is judged as one statement.
    if (/^\s*(?:import|export)\s*(?:type\s*)?\{[^}]*$/.test(c) && !/\bfrom\s*["']/.test(raw)) {
      let j = i;
      const parts = [raw];
      while (j + 1 < lines.length && !/\bfrom\s*["']/.test(lines[j]!) && j - i < 200) parts.push(lines[++j]!);
      if (isPlainImport(parts.map((p) => p.trim()).join(" "))) {
        i = j;
        continue;
      }
    }
    if (isPlainImport(raw)) continue;
    const risks = new Set<string>();
    // A renamed, default or namespace import of a risky module: its uses may
    // not match a call pattern (`cp.exec(…)`), so the import itself is a site.
    if (/^\s*(?:import|export)\b/.test(c) && RISKY_MODULE_RE.test(raw)) risks.add("aliased-import");
    for (const [k, re] of Object.entries(RISKS)) if (k !== "outside" && re.test(c)) risks.add(k);
    for (const [k, re] of Object.entries(STRING_RISKS)) if (re.test(raw.replace(/\s\/\/\s.*$/, ""))) risks.add(k);
    if (risks.size === 0) continue;
    const pin = statementPin(lines, i);
    let verdicts: Site["verdicts"];
    let malformed: string | undefined;
    // A `traced` site's annotation sits above its `inputSiteReached(…)` call.
    const hook = i > 0 && /^\s*inputSiteReached\(/.test(lines[i - 1]!);
    for (let j = i - (hook ? 2 : 1); j >= 0 && lines[j]!.trim().startsWith("//"); j--) {
      const m = ANNOTATION_RE.exec(lines[j]!);
      if (m === null) continue;
      const parsed = parseVerdicts(m[1]!);
      if ("error" in parsed) malformed = parsed.error;
      else if (parsed.some((v) => v.kind === "traced") !== hook) {
        malformed = hook ? "a site behind inputSiteReached() must be annotated `traced`" : "`traced` needs an inputSiteReached() call on the line directly above the site";
      } else if (parsed.some((v) => v.kind === "spawned") && !isChildSpawn(raw)) {
        malformed = "`spawned` is for a spawn of `bun`, `process.execPath` or `python3`, and of nothing else on the line";
      } else verdicts = m[2] === pin ? parsed : "stale";
      break;
    }
    const side = verdicts === undefined && malformed === undefined ? SUBMODULE_SITES[file]?.[pin] : undefined;
    if (side !== undefined) {
      const parsed = parseVerdicts(side.split(" — ")[0]!);
      if ("error" in parsed) malformed = `SUBMODULE_SITES: ${parsed.error}`;
      else verdicts = parsed;
    }
    if (verdicts === undefined && malformed === undefined && isTestScratchDir(file, [...risks], c)) verdicts = [{ kind: "inert" }];
    if (verdicts === undefined && malformed === undefined && isTestInertWrite(file, [...risks], c)) verdicts = [{ kind: "inert" }];
    if (verdicts === undefined && malformed === undefined) verdicts = testSpawnVerdict(file, [...risks], raw);
    sites.push({ file, line: i + 1, risks: [...risks], pin, verdicts, ...(malformed ? { malformed } : {}), ...(main.has(i) ? { inMain: true } : {}) });
  }
  return sites;
}

const IMPORT_RE =
  /(?:^|[^\w$.])(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|(?:^|[^\w$.])import\s*["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Whether an import specifier names a module of this tree to follow: a
 * relative one, and not template text. A `${` in a quoted specifier is the
 * text of a file a template literal writes; it survives {@link outsideTemplates}
 * only when that lex was unbalanced. A real import spelled so names a literal
 * `${` path and fails to load, so its check can never give a skip.
 */
export function followedSpecifier(spec: string | undefined): spec is string {
  return spec !== undefined && spec.startsWith(".") && !spec.includes("${");
}

function resolveModule(fromFile: string, spec: string): string | undefined {
  const base = resolve(dirname(fromFile), spec);
  for (const c of [base, base.replace(/\.js$/, ".ts"), `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, "index.ts"), join(base, "index.js")]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* try the next */
    }
  }
  return undefined;
}

/** What an audited closure contributes to a fingerprint. */
export interface AuditedClosure {
  /** Every source file reached, repo-relative, sorted. */
  files: string[];
  /**
   * The part of `files` reached ONLY through a computed load (`imports`,
   * `declared`) — the modules a run loads or not, depending on its data, and
   * what they import or run. Audited like the rest; a traced fingerprint does
   * not hash them (see the module comment).
   */
  computed: string[];
  /**
   * With `deferComputed`: the modules a computed load could reach, neither
   * scanned nor followed here. A traced run audits the ones it opened
   * (`ci-cone.ts` `deferredInputsOf`); one it never opened cannot have run.
   */
  deferred: string[];
  /** Variables whose values must be hashed. */
  env: string[];
  /** Variables that must be unset or empty. */
  envUnset: string[];
  /** Whether some site's answer is a function of the whole tree (`tree`). */
  needsTree: boolean;
  /** Whether some site runs a `bun` child whose reads only a trace shows (`spawned`). */
  spawnsChildren: boolean;
  /** Whether some site reads history reachable from `HEAD` (`head`). */
  needsHead: boolean;
  /** Refs some site reads (`refs`). */
  refs: string[];
}

/** Per-run memo of each file's scan, keyed by absolute path + size + mtime. */
export class SiteMemo {
  private memo = new Map<string, { key: string; sites: Site[]; imports: string[] }>();
  read(abs: string, root: string): { sites: Site[]; imports: string[] } {
    const st = statSync(abs);
    const key = `${st.size}:${st.mtimeMs}`;
    const hit = this.memo.get(abs);
    if (hit !== undefined && hit.key === key) return hit;
    const text = readFileSync(abs, "utf-8");
    const sites = scanSource(relative(root, abs), text);
    const imports: string[] = [];
    // Imports are read from code lines only, as sites are, so an example in a
    // docblock is not followed.
    // `import type` / `export type … from` are erased before the module runs,
    // so they load nothing and are not followed.
    const code = outsideTemplates(text)
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n")
      .replace(/(^|\n)\s*(?:import|export)\s+type\s[^;]*?from\s*["'][^"']+["']/g, "$1");
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (followedSpecifier(spec)) imports.push(spec);
    }
    const entry = { key, sites, imports };
    this.memo.set(abs, entry);
    return entry;
  }
  private globs = new Map<string, string[]>();
  /** A glob's matches under `root`, memoised for the run: a `**` glob walks the whole tree. */
  glob(root: string, g: string): string[] {
    const key = `${root}\0${g}`;
    let hit = this.globs.get(key);
    if (hit === undefined) {
      hit = [...new Bun.Glob(g).scanSync({ cwd: root, onlyFiles: true })].filter(
        // Tests are never a load target (bun runs them, a check does not), and
        // packages are covered by `bun.lock`.
        (f) => !/(^|\/)node_modules\//.test(f) && !/\.test\.[jt]sx?$/.test(f),
      );
      this.globs.set(key, hit);
    }
    return hit;
  }
  clear(): void {
    this.memo.clear();
    this.globs.clear();
  }
}

/** Why a site is not good enough, in the words `--explain` prints. */
export function siteProblem(s: Site): string | undefined {
  const where = `${s.file}:${s.line} (${s.risks.join(", ")})`;
  if (s.malformed !== undefined) return `malformed input-site annotation at ${where}: ${s.malformed}`;
  if (s.verdicts === undefined) {
    return s.risks.includes("computed")
      ? `unannotated non-literal dynamic import or computed load at ${where}`
      : `unannotated input site at ${where}`;
  }
  if (s.verdicts === "stale") return `stale input-site pin at ${where} — the statement changed; re-read it and re-pin #${s.pin}`;
  return undefined;
}

/**
 * Walk the RELATIVE-import closure of `entries` and audit every site in it.
 * Returns undetermined on the first site that is unannotated, stale or
 * malformed, on an import that does not resolve, and on a `declared` source
 * that does not resolve. An `imports` glob that matches nothing is allowed.
 */
export function auditClosure(
  root: string,
  entries: readonly string[],
  memo: SiteMemo = new SiteMemo(),
  /** Report: gather EVERY problem instead of stopping at the first (`input-hash:coverage`). */
  problems?: string[],
  /** Resolves a `scripts` verdict's package script to its entry files; absent, such a site is undetermined. */
  scriptEntries?: (name: string) => string[] | undefined,
  /** Resolves a `declared` verdict's source to the repo-relative modules it names; absent, such a site is undetermined. */
  declaredImports?: (source: string) => readonly string[] | undefined,
  /**
   * Leave the modules reached only through a computed load (`imports`,
   * `declared`) to the trace: list them in `deferred`, unscanned. Only a
   * caller whose run is traced may pass it (`fingerprint`'s `treeReplayed`).
   */
  deferComputed = false,
): AuditedClosure | { undetermined: string } {
  // A file is visited at most four times: IMPORTED (its `import.meta.main`
  // block does not run) or as an ENTRY (it does), each reached only through a
  // computed load or not. Entry subsumes import, and static subsumes computed;
  // a file reached again with a state its first visit did not cover is
  // walked again, so what it reaches inherits the stronger state.
  const seen = new Map<string, { entry: boolean; computed: boolean }>();
  const env = new Set<string>();
  const envUnset = new Set<string>();
  let needsTree = false;
  let spawnsChildren = false;
  let needsHead = false;
  const refs = new Set<string>();
  const deferred = new Set<string>();
  const stack: { file: string; entry: boolean; computed: boolean }[] = entries.map((e) => ({ file: resolve(root, e), entry: true, computed: false }));
  const fail = (why: string): { undetermined: string } | undefined => {
    if (problems === undefined) return { undetermined: why };
    if (!problems.includes(why)) problems.push(why);
    return undefined;
  };
  const pushGlobs = (globs: readonly string[], entry: boolean, computed: boolean) => {
    // A glob matching nothing is allowed: a computed load that today loads
    // nothing reads nothing. That the globs cover what the DATA names is a
    // test's job (`input-sites.test.ts`), since the data is in the tree a
    // {tracked} fingerprint hashes anyway. Tests are never a target: bun runs
    // them, a check does not.
    for (const g of globs) for (const f of memo.glob(root, g)) stack.push({ file: join(root, f), entry, computed });
  };
  while (stack.length > 0) {
    const { file, entry, computed } = stack.pop()!;
    const prior = seen.get(file);
    if (prior !== undefined && (prior.entry || !entry) && (!prior.computed || computed)) continue;
    const now = { entry: entry || (prior?.entry ?? false), computed: computed && (prior?.computed ?? true) };
    seen.set(file, now);
    if (!/\.(m?[jt]sx?)$/.test(file)) continue;
    if (deferComputed && now.computed) {
      deferred.add(file);
      continue;
    }
    deferred.delete(file);
    const { sites, imports } = memo.read(file, root);
    for (const s of sites) {
      if (s.inMain === true && !now.entry) continue;
      const problem = siteProblem(s);
      if (problem !== undefined) {
        const out = fail(problem);
        if (out !== undefined) return out;
        continue;
      }
      for (const v of s.verdicts as SiteVerdict[]) {
        if (v.kind === "env") v.names.forEach((n) => env.add(n));
        else if (v.kind === "env-unset") v.names.forEach((n) => envUnset.add(n));
        else if (v.kind === "tree") needsTree = true;
        else if (v.kind === "spawned") spawnsChildren = true;
        else if (v.kind === "head") needsHead = true;
        else if (v.kind === "refs") v.names.forEach((n) => refs.add(n));
        else if (v.kind === "imports") pushGlobs(v.globs, false, true);
        else if (v.kind === "runs") pushGlobs(v.globs, true, now.computed);
        else if (v.kind === "declared") {
          for (const source of v.sources) {
            const files = declaredImports?.(source);
            if (files === undefined) {
              const out = fail(`input-site at ${s.file}:${s.line} loads the modules declaration source ${source} names, which does not resolve`);
              if (out !== undefined) return out;
              continue;
            }
            for (const f of files) stack.push({ file: resolve(root, f), entry: false, computed: true });
          }
        } else if (v.kind === "scripts") {
          for (const name of v.names) {
            const files = scriptEntries?.(name);
            if (files === undefined) {
              const out = fail(`input-site at ${s.file}:${s.line} runs package script ${name}, which does not resolve to script files`);
              if (out !== undefined) return out;
              continue;
            }
            for (const f of files) stack.push({ file: resolve(root, f), entry: true, computed: now.computed });
          }
        }
      }
    }
    for (const spec of imports) {
      const target = resolveModule(file, spec);
      // A module Bun cannot load fails the script when run; running it is the answer.
      if (target === undefined) return { undetermined: `${relative(root, file)} imports unresolvable ${spec}` };
      stack.push({ file: target, entry: false, computed: now.computed });
    }
  }
  if (problems !== undefined && problems.length > 0) return { undetermined: problems[0]! };
  return {
    files: [...seen.keys()].map((f) => relative(root, f)).sort(),
    computed: [...seen].filter(([, v]) => v.computed).map(([f]) => relative(root, f)).sort(),
    deferred: [...deferred].map((f) => relative(root, f)).sort(),
    env: [...env].sort(),
    envUnset: [...envUnset].sort(),
    needsTree,
    spawnsChildren,
    needsHead,
    refs: [...refs].sort(),
  };
}
