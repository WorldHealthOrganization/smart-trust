/**
 * Every test has a Gherkin — the scanner behind `check:test-gherkin` and the
 * kg-audit criterion `test-has-gherkin`.
 *
 * The rule (owner, 2026-11-06: "A test should always have a Gherkin") is the
 * `test-engineer` skill's section *Every test has a Gherkin*. This module
 * only finds the two ends and joins them:
 *
 * - **tests**, found by a LANGUAGE ADAPTER per source language, each named by
 *   its qualified name `<file>::<scope>::…::<name>`;
 * - **Scenarios**, found in `.feature` files, each carrying zero or more
 *   `@test:<qualified name>` tags (and other binding tags, below).
 *
 * ## The one grammar
 *
 * `<file>` is the test's source file relative to the scanned root, with `/`.
 * Then the enclosing scopes in source order (a Rust `mod`, a Kotlin or Python
 * class, a `describe()` title), then the test's own name, joined by `::`.
 * Whitespace inside a segment is written `_`, because a Gherkin tag ends at
 * whitespace — {@link normaliseSegment} is applied to tests and tags alike.
 * Sibling sessions backfill `.feature` files against this grammar, so a change
 * to it is a change to every one of those files: announce it before making it.
 *
 * ## Other bindings, and dialects
 *
 * Owner, 2026-11-07: binding is by tag, and the schemes are an extensible
 * list. Besides `@test:`, a Scenario may carry `@itb:<testSuite id>/<testCase
 * id>` — a WHO-ITB GITB TDL test case — resolved by {@link itbResolver}
 * against a pinned checkout. A new scheme is an entry in
 * {@link BINDING_SCHEMES} and a {@link BindingResolver}. Feature files may be
 * written in any Gherkin dialect; the keywords are `gherkin-dialects.ts`.
 *
 * ## Specifications, which are not tests of this tree
 *
 * Owner, 2026-11-13: some `.feature` files are test SPECIFICATIONS for
 * implementers (a DAK's L2 scenarios, for one), not tests of the repository's
 * code. A repository says so BY DECLARATION, in its harness configuration —
 * {@link SPECIFICATION_DECLARATIONS}: `testSpecifications` on a
 * `contentTypes` section of `index.config.json` — never by a path or a type
 * the checker names. In a declared specification, a
 * Scenario with no binding is counted as a specification rather than reported
 * `scenario-names-no-test`; once it carries a binding (`@itb:` or `@test:`)
 * it is checked like any other. Nothing else is relaxed: every test still
 * needs a Scenario.
 *
 * ## What the adapters are, and are not
 *
 * Each adapter is a lexical scanner, not a parser: it skips comments and
 * string literals, tracks brace (or, for Python, indentation) scopes, and
 * recognises the runner's test marker. It names a test the way a reader of
 * the file would, which is what a tag has to be written against. A test it
 * cannot see is a false "clean", so the adapters err towards seeing more —
 * skipped, ignored and parameterised tests are all tests. No adapter names a
 * repository, a crate or a folio.
 *
 * @module scripts/lib/test-gherkin
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GHERKIN_DIALECTS, type GherkinDialect } from "./gherkin-dialects.ts";

/** One executable test, as a language adapter found it. */
export interface FoundTest {
  /** `<file>::<scope>::…::<name>`, whitespace normalised. */
  name: string;
  file: string;
  /** 1-based line of the test's declaration. */
  line: number;
  /** Which adapter found it. */
  language: string;
  /**
   * Its title (or an enclosing scope's) is computed — a variable, or a
   * template with `${…}` — so no tag can name it. Reported, never dropped:
   * a test the scan cannot name is still a test.
   */
  dynamic?: true;
}

/** A language adapter: which files it reads, and the tests it finds in one. */
export interface TestLanguageAdapter {
  id: string;
  /** Does this repo-relative path hold tests in this language? */
  matches(file: string): boolean;
  /** The tests declared in `src`, named against `file`. */
  findTests(file: string, src: string): FoundTest[];
  /**
   * Does this file, by what it declares, hold tests its name does not show?
   * Asked of a file no adapter `matches` (e.g. a suite with its own runner);
   * `read` gives its text, so an adapter that rules a file out by name reads nothing.
   */
  claims?(file: string, read: () => string): boolean;
}

/** One Scenario (or Scenario Outline / Example) in a `.feature` file. */
export interface FoundScenario {
  file: string;
  line: number;
  title: string;
  /** The qualified names its `@test:` tags carry, normalised. */
  tests: string[];
  /** Its other bindings — `@<scheme>:<target>` for every non-`test` scheme the scan knows (e.g. `itb`). */
  bindings: Binding[];
  /** Tagged `@manual`: a person executes it, so it needs no `@test:` tag. */
  manual: boolean;
}

export interface ParsedFeature {
  file: string;
  scenarios: FoundScenario[];
  /** The `# language:` the file declares, when no dialect has that code. Parsed as English. */
  unknownLanguage?: string;
  /** Binding tags on a `Feature:` or `Rule:` line — inherited by every Scenario, so refused. */
  misplaced: { line: number; tag: string }[];
  /**
   * Set when a declaration ({@link SPECIFICATION_DECLARATIONS}) says this file
   * specifies tests for implementers: the declaration that says so.
   */
  specification?: string;
}

/** Whitespace inside a segment becomes `_`: a Gherkin tag ends at whitespace. */
export function normaliseSegment(s: string): string {
  return s.trim().replace(/\s+/g, "_");
}

/** The qualified name of a test: `<file>::<scope>::…::<name>`. */
export function qualifiedTestName(file: string, scopes: readonly string[], name: string): string {
  return [file.split(sep).join("/"), ...scopes.map(normaliseSegment), normaliseSegment(name)].join("::");
}

// ── A lexer shared by the brace languages ───────────────────────────────────

/**
 * The end (just past the closing backtick) of the JS template literal opening
 * at `i`, and its literal text. Each `${…}` is skipped by brace depth, and the
 * strings, templates and comments inside it are skipped whole, so a backtick
 * nested in an expression does not close the outer template.
 */
function templateEnd(src: string, i: number): { end: number; text: string } {
  let j = i + 1;
  let text = "";
  while (j < src.length) {
    const ch = src[j];
    if (ch === "\\") {
      text += src.slice(j, j + 2);
      j += 2;
      continue;
    }
    if (ch === "`") return { end: j + 1, text };
    if (ch === "$" && src[j + 1] === "{") {
      // The expression's source is kept verbatim in the text, as before:
      // a looped test's title `id[${key}]` is its name.
      const from = j;
      j += 2;
      let depth = 1;
      // The last significant character of the expression, so a `/` can be
      // told apart: a regex where an operand may start, division elsewhere.
      // Without it, `${x.replace(/^a\//, "")}` read `\//` as a line comment
      // and swallowed the closing backtick, so every test after it vanished.
      let prev = "{";
      while (j < src.length && depth > 0) {
        const e = src[j];
        if (e === "`") {
          j = templateEnd(src, j).end;
          prev = "`";
          continue;
        }
        if (e === "/" && src[j + 1] !== "/" && src[j + 1] !== "*" && /[(,=:[!&|?{};+\-*%~^]/.test(prev)) {
          let k = j + 1;
          let inClass = false;
          while (k < src.length && src[k] !== "\n") {
            if (src[k] === "\\") { k += 2; continue; }
            if (src[k] === "[") inClass = true;
            else if (src[k] === "]") inClass = false;
            else if (src[k] === "/" && !inClass) break;
            k++;
          }
          if (k < src.length && src[k] === "/") {
            j = k + 1;
            while (j < src.length && /[a-z]/.test(src[j])) j++;
            prev = "/";
            continue;
          }
        }
        if (e === '"' || e === "'") {
          let k = j + 1;
          while (k < src.length && src[k] !== e && src[k] !== "\n") k += src[k] === "\\" ? 2 : 1;
          j = k + 1;
          prev = e;
          continue;
        }
        if (e === "/" && src[j + 1] === "/") {
          const nl = src.indexOf("\n", j);
          j = nl < 0 ? src.length : nl;
          continue;
        }
        if (e === "/" && src[j + 1] === "*") {
          const close = src.indexOf("*/", j + 2);
          j = close < 0 ? src.length : close + 2;
          continue;
        }
        if (e === "{") depth++;
        else if (e === "}") depth--;
        if (!/\s/.test(e)) prev = e;
        j++;
      }
      text += src.slice(from, j);
      continue;
    }
    text += ch;
    j++;
  }
  return { end: src.length, text };
}

/**
 * If the `/` at `i` opens a JS regex literal, the offset just past it (flags
 * included); otherwise 0. A `/` opens a regex where an expression may start:
 * after an operator or opening punctuation, after `return`-like keywords, or
 * at the start of the file. `masked` is the output so far, so the previous
 * significant character is read with comments and strings already blanked.
 */
function regexLiteralEnd(src: string, i: number, masked: readonly string[]): number {
  if (src[i + 1] === "/" || src[i + 1] === "*") return 0;
  // The last ~16 significant characters, walking back over the output so far.
  let tail = "";
  for (let k = masked.length - 1; k >= 0 && tail.replace(/\s+$/, "").length < 16; k--) tail = masked[k] + tail;
  const before = tail.replace(/\s+$/, "");
  const prev = before.at(-1);
  const keyword = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|void|yield|await|throw|delete|new)$/.test(before);
  // `>` only as the arrow `=>`: after a closing angle (`</t>`, a generic) a
  // `/` is not a regex.
  const opens = prev !== undefined && (/[(,=:[!&|?{};+\-*%~^]/.test(prev) || before.endsWith("=>"));
  if (prev !== undefined && !keyword && !opens) return 0;
  let j = i + 1;
  let inClass = false;
  while (j < src.length) {
    const ch = src[j];
    if (ch === "\n") return 0;
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === "[") inClass = true;
    else if (ch === "]") inClass = false;
    else if (ch === "/" && !inClass) break;
    j++;
  }
  if (j >= src.length) return 0;
  j++;
  while (j < src.length && /[a-z]/.test(src[j])) j++;
  return j;
}

/**
 * Blank out comments and string literals, keeping every newline and every
 * other character's offset. What is left is code a regex can be run over
 * without matching a `{` in a string or a `#[test]` in a comment. The string
 * CONTENTS are returned separately, keyed by offset, because a JS test title
 * IS a string literal.
 */
export function maskSource(
  src: string,
  opts: { rustChars?: boolean; templates?: boolean; rawStrings?: boolean; tripleQuotes?: boolean; backtickNames?: boolean },
): { code: string; strings: Map<number, string> } {
  const out: string[] = [];
  const strings = new Map<number, string>();
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "/" && n === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      out.push(blank(src.slice(i, stop)));
      i = stop;
      continue;
    }
    if (c === "/" && n === "*") {
      // Rust and Kotlin nest block comments; JS does not, and a JS comment
      // that mentions a glob (`schemas/**`) would never close if counted.
      const nests = !opts.templates;
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth > 0) {
        if (nests && src[j] === "/" && src[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (src[j] === "*" && src[j + 1] === "/") {
          depth--;
          j += 2;
        } else j++;
      }
      out.push(blank(src.slice(i, j)));
      i = j;
      continue;
    }
    if (opts.rawStrings && c === "r" && (n === '"' || n === "#") && !/[\w]/.test(src[i - 1] ?? "")) {
      const m = /^r(#*)"/.exec(src.slice(i));
      if (m) {
        const close = `"${m[1]}`;
        const end = src.indexOf(close, i + m[0].length);
        const stop = end < 0 ? src.length : end + close.length;
        strings.set(i, src.slice(i + m[0].length, end < 0 ? src.length : end));
        out.push(blank(src.slice(i, stop)));
        i = stop;
        continue;
      }
    }
    if (opts.backtickNames && c === "`") {
      // A Kotlin backtick identifier (`fun \`the vector's kid\`()`): a name,
      // not a string, so it is kept as written. A quote inside it opens
      // nothing; read as a char literal, `'s … DSC's` swallowed the rest of
      // the name and the enclosing class's scope with it.
      const end = src.indexOf("`", i + 1);
      const nl = src.indexOf("\n", i + 1);
      if (end > 0 && (nl < 0 || end < nl)) {
        out.push(src.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }
    if (opts.tripleQuotes && c === '"' && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const stop = end < 0 ? src.length : end + 3;
      strings.set(i, src.slice(i + 3, end < 0 ? src.length : end));
      out.push(blank(src.slice(i, stop)));
      i = stop;
      continue;
    }
    if (opts.templates && c === "/") {
      // A JS regex literal: its quotes and backticks open no string. Without
      // this, `/`([^`]+)`/` or `/["']x["']/` started a "string" that swallowed
      // the tests after it.
      const end = regexLiteralEnd(src, i, out);
      if (end > 0) {
        out.push(blank(src.slice(i, end)));
        i = end;
        continue;
      }
    }
    if (c === "`" && opts.templates) {
      // A template literal: its `${…}` expressions may hold strings and
      // further templates, so the closing backtick is found by nesting,
      // not by the next backtick. The literal text is its string.
      const { end, text } = templateEnd(src, i);
      strings.set(i, text);
      out.push(blank(src.slice(i, end)));
      i = end;
      continue;
    }
    if (c === '"' || (c === "'" && !opts.rustChars)) {
      let j = i + 1;
      let body = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          body += src.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (src[j] === "\n") break; // unterminated: stop at the line
        body += src[j];
        j++;
      }
      strings.set(i, body);
      out.push(blank(src.slice(i, Math.min(j + 1, src.length))));
      i = j + 1;
      continue;
    }
    if (c === "'" && opts.rustChars) {
      // A char literal ('a', '\n', '\u{1F600}') or a lifetime ('a). Only the
      // first is masked; a lifetime has no closing quote.
      const m = /^'(?:\\(?:u\{[0-9a-fA-F]+\}|x[0-9a-fA-F]{2}|.)|[^\\'\n])'/.exec(src.slice(i, i + 12));
      if (m) {
        out.push(blank(m[0]));
        i += m[0].length;
        continue;
      }
    }
    out.push(c);
    i++;
  }
  return { code: out.join(""), strings };
}

const lineAt = (src: string, offset: number): number => src.slice(0, offset).split("\n").length;

/**
 * Walk masked code, keeping a stack of named brace scopes. `opener` is asked,
 * at every `{`, whether the code just before it opens a named scope.
 */
function braceScopes(
  code: string,
  opener: (before: string) => string | undefined,
): (offset: number) => string[] {
  // Scope stack per offset, built once; queried by offset.
  const events: { at: number; stack: string[] }[] = [];
  const stack: { name?: string }[] = [];
  let last = 0;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{") {
      stack.push({ name: opener(code.slice(last, i)) });
      last = i + 1;
      events.push({ at: i, stack: stack.flatMap((s) => (s.name ? [s.name] : [])) });
    } else if (c === "}") {
      stack.pop();
      last = i + 1;
      events.push({ at: i, stack: stack.flatMap((s) => (s.name ? [s.name] : [])) });
    } else if (c === ";") {
      last = i + 1;
    }
  }
  return (offset) => {
    let lo = 0;
    let hi = events.length - 1;
    let found: string[] = [];
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].at < offset) {
        found = events[mid].stack;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };
}

// ── Rust ────────────────────────────────────────────────────────────────────

/** `#[test]`, `#[tokio::test]`, `#[rstest]`, `#[test_case(..)]` — each a test the runner discovers. */
const RUST_TEST_ATTR = /#\[\s*(?:[\w]+::)*(?:test|rstest|test_case|test_log::test)\b[^\]]*\]/g;

export const RUST_ADAPTER: TestLanguageAdapter = {
  id: "rust",
  matches: (f) => f.endsWith(".rs"),
  findTests(file, src) {
    const { code } = maskSource(src, { rustChars: true, rawStrings: true });
    const scopeAt = braceScopes(code, (before) => /\bmod\s+([A-Za-z_]\w*)\s*$/.exec(before)?.[1]);
    const tests: FoundTest[] = [];
    const seen = new Set<number>();
    for (const m of code.matchAll(RUST_TEST_ATTR)) {
      // The function the attribute (and any further attributes) decorates.
      const rest = code.slice(m.index! + m[0].length);
      const fn = /^(?:\s*#\[[^\]]*\])*\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+([A-Za-z_]\w*)/.exec(rest);
      if (!fn) continue;
      const at = m.index! + m[0].length + fn.index + fn[0].length - fn[1].length;
      if (seen.has(at)) continue; // `#[test]` and `#[tokio::test]` on one fn is one test
      seen.add(at);
      tests.push({ name: qualifiedTestName(file, scopeAt(at), fn[1]), file, line: lineAt(src, at), language: "rust" });
    }
    return tests;
  },
};

// ── Kotlin (JUnit 4/5, kotlin.test) ─────────────────────────────────────────

const KOTLIN_TEST_ANN = /@(?:org\.junit\.(?:jupiter\.api\.|jupiter\.params\.)?)?(?:Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b/g;

export const KOTLIN_ADAPTER: TestLanguageAdapter = {
  id: "kotlin",
  matches: (f) => f.endsWith(".kt"),
  findTests(file, src) {
    // Backtick names (`fun \`decodes a QR\`()`) are identifiers, not strings:
    // read them from the raw source at the masked offset.
    // `'` opens only a char literal ('a', '"', '\n'), as in Rust.
    const { code } = maskSource(src, { tripleQuotes: true, rustChars: true, backtickNames: true });
    const scopeAt = braceScopes(code, (before) => {
      const m = /\b(?:class|object|interface)\s+([A-Za-z_]\w*)[^{]*$/.exec(before);
      // A `fun` after the header in the same chunk means this brace is the function's.
      return m && !/\bfun\b/.test(before.slice(m.index)) ? m[1] : undefined;
    });
    const tests: FoundTest[] = [];
    for (const m of code.matchAll(KOTLIN_TEST_ANN)) {
      const rest = code.slice(m.index! + m[0].length);
      const fn = /^(?:\s*\([^)]*\))?(?:\s*@[\w.]+(?:\([^)]*\))?)*\s*(?:(?:public|internal|private|override|suspend|open)\s+)*fun\s+(`[^`\n]+`|[A-Za-z_]\w*)/.exec(rest);
      if (!fn) continue;
      const at = m.index! + m[0].length + fn.index + fn[0].length - fn[1].length;
      const name = fn[1].startsWith("`") ? fn[1].slice(1, -1) : fn[1];
      tests.push({ name: qualifiedTestName(file, scopeAt(at), name), file, line: lineAt(src, at), language: "kotlin" });
    }
    return tests;
  },
};

// ── JavaScript / TypeScript (bun:test, vitest, jest, node:test) ─────────────

const JS_TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?|(?:^|\/)__tests__\/.+\.[cm]?[jt]sx?)$/;
/**
 * The head of a test or scope call: `test`, `it`, `describe` and friends.
 * What follows is walked by hand (`callChain`), because modifiers can carry
 * their own arguments and chain: `test.skipIf(c).each(t)("… %s", …)`. A
 * regex over the modifier names alone missed every chain with arguments
 * between them, and the test it hid read as no test at all.
 */
const JS_HEAD = /(?<![\w.$])(describe|suite|context|test|it)(?=\s*[.(])/g;
/**
 * A suite with its own runner names it in a comment, `@test-runner run`:
 * each `run("title", …)` call in that file is then a test, and the file is
 * read whatever its name. The runner is the file's own function, so the file
 * says so; the adapter names no runner of any one repository.
 */
const JS_RUNNER_DIRECTIVE = /@test-runner\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)/g;
const JS_SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** The runner functions a file declares with `@test-runner`. */
export function declaredTestRunners(src: string): string[] {
  return [...src.matchAll(JS_RUNNER_DIRECTIVE)].flatMap((m) => m[1].split(",").map((x) => x.trim()));
}

/** Modifiers that take no arguments. */
const JS_BARE_MODS = new Set(["skip", "only", "todo", "failing", "concurrent", "serial"]);
/** Modifiers whose own argument list comes before the title call. */
const JS_ARG_MODS = new Set(["each", "if", "skipIf", "runIf"]);

/**
 * A JS string literal's source text as the runtime string: what a runner
 * prints as the title, and so what a tag is written against. `"a \"b\""`
 * is the title `a "b"`, not `a \"b\"`. Covers the single-character escapes,
 * `\xHH`, `\uHHHH`, `\u{…}` and a line continuation; any other escaped
 * character stands for itself, as in JS.
 */
export function unescapeJsString(body: string): string {
  const single: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
  return body.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|\r\n|[\s\S])/g, (_, e: string, cp?: string, u?: string, x?: string) => {
    if (cp) return String.fromCodePoint(parseInt(cp, 16));
    if (u) return String.fromCharCode(parseInt(u, 16));
    if (x) return String.fromCharCode(parseInt(x, 16));
    if (e === "\n" || e === "\r\n" || e === "\r" || e === "\u2028" || e === "\u2029") return "";
    return single[e] ?? e;
  });
}

/** `id[${key}]`: a literal id, then one interpolation in brackets, nothing else computed. */
const LOOPED_ID = /^[^`$\s\[\]]+\[\$\{[^{}`]*\}\]$/;

export const JS_ADAPTER: TestLanguageAdapter = {
  id: "js",
  matches: (f) => JS_TEST_FILE.test(f),
  claims: (f, read) => JS_SOURCE_FILE.test(f) && declaredTestRunners(read()).length > 0,
  findTests(file, src) {
    const { code, strings } = maskSource(src, { templates: true });
    const runners = declaredTestRunners(src).filter((r) => !/^(?:describe|suite|context|test|it)$/.test(r));
    const heads = runners.length
      ? new RegExp(`(?<![\\w.$])(describe|suite|context|test|it|${runners.map((r) => r.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")).join("|")})(?=\\s*[.(])`, "g")
      : JS_HEAD;
    /** Offset of the `)` matching the `(` at `open`. */
    const closeOf = (open: number): number => {
      let depth = 0;
      for (let j = open; j < code.length; j++) {
        if (code[j] === "(") depth++;
        else if (code[j] === ")" && --depth === 0) return j;
      }
      return code.length;
    };
    /**
     * The call's first argument as a fixed title, or `undefined` when it is
     * computed: an identifier, an expression, or a template with `${…}`.
     * One template is fixed: a literal id followed by a single `[${…}]`, the
     * looped-test convention `id[${key}]` (owner, 2026-11-06). It is named
     * verbatim, so its tag names `id[${key}]`, and the id stays unique in its
     * file however many cases the loop runs. Every other literal is named by
     * its runtime string ({@link unescapeJsString}).
     */
    const firstArgString = (open: number): string | undefined => {
      for (let j = open + 1; j < code.length; j++) {
        if (strings.has(j)) {
          const body = strings.get(j)!;
          if (src[j] === "`" && body.includes("${")) return LOOPED_ID.test(body) ? body : undefined;
          return unescapeJsString(body);
        }
        if (!/\s/.test(code[j])) return undefined;
      }
      return undefined;
    };
    const scopes: { from: number; to: number; title: string | undefined }[] = [];
    const calls: { at: number; title: string | undefined }[] = [];
    /**
     * Walk `.mod`, `.mod(args)` links after a head to the `(` of the title
     * call, or `undefined` when the chain is not a call of a known shape
     * (e.g. `test.each` passed as a value).
     */
    const callChain = (from: number): number | undefined => {
      let j = from;
      for (;;) {
        const ws = /^\s*/.exec(code.slice(j))![0].length;
        j += ws;
        if (code[j] === "(") return j;
        const mod = /^\.\s*([A-Za-z_$][\w$]*)/.exec(code.slice(j));
        if (!mod) return undefined;
        j += mod[0].length;
        if (JS_BARE_MODS.has(mod[1])) continue;
        if (!JS_ARG_MODS.has(mod[1])) return undefined;
        const argsOpen = j + /^\s*/.exec(code.slice(j))![0].length;
        if (code[argsOpen] !== "(") return undefined;
        j = closeOf(argsOpen) + 1;
      }
    };
    for (const m of code.matchAll(heads)) {
      const open = callChain(m.index! + m[0].length);
      if (open === undefined) continue;
      const title = firstArgString(open);
      if (m[1] === "test" || m[1] === "it" || runners.includes(m[1])) calls.push({ at: m.index!, title });
      else scopes.push({ from: open, to: closeOf(open), title });
    }
    return calls.map((c) => {
      const line = lineAt(src, c.at);
      // A looped test `id[${key}]` carries its loop key itself, so a computed
      // describe around it (`describe(label, …)` in the same loop) adds
      // nothing a tag needs: it is left out of the name, not reported.
      const looped = c.title !== undefined && LOOPED_ID.test(c.title);
      const enclosing = scopes.filter((d) => d.from < c.at && c.at < d.to && !(looped && d.title === undefined));
      const dynamic = c.title === undefined || enclosing.some((d) => d.title === undefined);
      const name = qualifiedTestName(
        file,
        enclosing.map((d) => d.title ?? "<computed>"),
        c.title ?? `<computed at line ${line}>`,
      );
      return { name, file, line, language: "js", ...(dynamic ? { dynamic: true as const } : {}) };
    });
  },
};

// ── Python (pytest, unittest) ───────────────────────────────────────────────

const PY_TEST_FILE = /(?:^|\/)(?:test_[^/]*|[^/]*_test)\.py$/;

export const PYTHON_ADAPTER: TestLanguageAdapter = {
  id: "python",
  matches: (f) => PY_TEST_FILE.test(f),
  findTests(file, src) {
    const tests: FoundTest[] = [];
    // Open `class` and `def` blocks, innermost last, closed by dedent.
    const open: { indent: number; kind: "class" | "def"; name: string; collects: boolean }[] = [];
    let inTriple: string | null = null;
    src.split("\n").forEach((raw, idx) => {
      // Lines inside a multi-line string are not code.
      if (inTriple) {
        if (raw.includes(inTriple)) inTriple = null;
        return;
      }
      const t = /("""|''')/.exec(raw);
      if (t && raw.split(t[1]).length === 2) inTriple = t[1];
      if (!raw.trim() || raw.trim().startsWith("#")) return;
      const indent = raw.length - raw.trimStart().length;
      while (open.length && open[open.length - 1].indent >= indent) open.pop();
      const parent = open[open.length - 1];
      const cls = /^\s*class\s+([A-Za-z_]\w*)\s*[:(]/.exec(raw);
      if (cls) {
        // pytest collects `Test*` classes; unittest collects TestCase subclasses.
        const collects = (/^Test/.test(cls[1]) || /\bTestCase\b/.test(raw)) && (!parent || (parent.kind === "class" && parent.collects));
        open.push({ indent, kind: "class", name: cls[1], collects });
        return;
      }
      const fn = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/.exec(raw);
      if (!fn) return;
      open.push({ indent, kind: "def", name: fn[1], collects: false });
      // A function nested in a function is not collected; nor is one in a class pytest skips.
      if (!fn[1].startsWith("test") || (parent && (parent.kind === "def" || !parent.collects))) return;
      const classes = open.filter((o) => o.kind === "class").map((o) => o.name);
      tests.push({ name: qualifiedTestName(file, classes, fn[1]), file, line: idx + 1, language: "python" });
    });
    return tests;
  },
};

/** The adapters `check:test-gherkin` runs, in order. A new language is a new entry. */
export const TEST_LANGUAGE_ADAPTERS: readonly TestLanguageAdapter[] = [RUST_ADAPTER, KOTLIN_ADAPTER, JS_ADAPTER, PYTHON_ADAPTER];

// ── Gherkin ─────────────────────────────────────────────────────────────────

/** One `@<scheme>:<target>` tag on a Scenario, other than `@test:`. */
export interface Binding {
  scheme: string;
  target: string;
}

/**
 * What a binding tag names, and how to tell whether it exists.
 *
 * Owner, 2026-11-07: binding is BY TAG, and the tag schemes are an extensible
 * list — `@test:` binds an executable test in this tree, `@itb:` a WHO-ITB
 * (GITB TDL) test case. A resolver says which targets exist. When its source
 * is not held, it says so, and every tag it would have resolved is reported
 * as unresolved: never a pass over a source nobody read.
 *
 * `@test:` is not a resolver: its targets are the tests the language adapters
 * find, and it is the one scheme checked in BOTH directions (every test needs
 * a Scenario). A resolver's targets are checked one way only — a tag must
 * name one that exists — because an external suite is not this repository's
 * to cover.
 */
export interface BindingResolver {
  /** The tag prefix, without `@` and `:` — `itb` for `@itb:`. */
  scheme: string;
  /** The targets that exist, or why they could not be read. */
  resolve(): { held: true; targets: ReadonlySet<string> } | { held: false; reason: string };
}

/**
 * `@itb:<testSuite id>/<testCase id>` — a GITB TDL test case, named by the
 * `id` attribute of the `<testsuite>` and of the `<testcase>` it references.
 * Ids, not paths: ITB reports results by id, and ids survive a re-layout.
 * `source` is a checkout of the test suites at a pinned commit; absent, every
 * `@itb:` tag is unresolved ("source not held").
 */
export function itbResolver(source: string | undefined): BindingResolver {
  return {
    scheme: "itb",
    resolve() {
      if (!source) return { held: false, reason: "source not held — pass the ITB test-suite checkout (`--itb <dir>`)" };
      if (!existsSync(source) || !statSync(source).isDirectory()) return { held: false, reason: `source not held — ${source} is not a directory` };
      const targets = new Set<string>();
      for (const f of listFiles(source)) {
        if (!f.endsWith(".xml")) continue;
        const xml = withoutXmlComments(readFileSync(join(source, f), "utf-8"));
        const suite = /<(?:[\w-]+:)?testsuite\b[^>]*?\bid\s*=\s*"([^"]+)"/.exec(xml);
        if (!suite) continue;
        for (const tc of xml.matchAll(/<(?:[\w-]+:)?testcase\b[^>]*?\bid\s*=\s*"([^"]+)"/g)) targets.add(`${suite[1]}/${tc[1]}`);
      }
      return { held: true, targets };
    },
  };
}

/**
 * `src` with every `<!-- … -->` cut out, by scanning rather than one regex
 * pass: an unterminated comment drops the rest of the file, so a commented-out
 * `<testcase>` can never be read as present.
 */
export function withoutXmlComments(src: string): string {
  let out = "";
  let at = 0;
  for (;;) {
    const open = src.indexOf("<!--", at);
    if (open < 0) return out + src.slice(at);
    out += src.slice(at, open);
    const close = src.indexOf("-->", open + 4);
    if (close < 0) return out;
    at = close + 3;
  }
}

/** The binding schemes every scan knows, besides `test`. A new scheme is a new entry here and a resolver. */
export const BINDING_SCHEMES: readonly string[] = ["itb"];

/** The dialect's element keywords, longest first so `Scenario Outline` wins over `Scenario`. */
function keywordMatchers(d: GherkinDialect) {
  const re = (words: readonly string[]) => {
    const alts = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`^\\s*(?:${alts.join("|")})\\s*:\\s*(.*)$`, "u");
  };
  return {
    scenario: re([...d.scenario, ...d.scenarioOutline]),
    container: re([...d.feature, ...d.rule]),
    other: re([...d.background, ...d.examples]),
  };
}
const MATCHERS = new Map<string, ReturnType<typeof keywordMatchers>>();
const matchersFor = (lang: string) => {
  let m = MATCHERS.get(lang);
  if (!m) MATCHERS.set(lang, (m = keywordMatchers(GHERKIN_DIALECTS[lang])));
  return m;
};

/**
 * Parse the Scenarios of one `.feature` file, and the binding tags each
 * carries. Any Gherkin dialect: the `# language:` header picks the keywords
 * (owner, 2026-11-07 — a translated `.feature` stays valid); none means `en`.
 */
export function parseFeature(file: string, src: string, schemes: readonly string[] = BINDING_SCHEMES): ParsedFeature {
  const scenarios: FoundScenario[] = [];
  const misplaced: ParsedFeature["misplaced"] = [];
  const lines = src.split("\n");
  // The header comment may appear only before the first non-comment line.
  let lang = "en";
  let unknownLanguage: string | undefined;
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (!t.startsWith("#")) break;
    const m = /^#\s*language\s*:\s*([\w-]+)/.exec(t);
    if (m) {
      if (GHERKIN_DIALECTS[m[1]]) lang = m[1];
      else unknownLanguage = m[1];
      break;
    }
  }
  const kw = matchersFor(lang);
  const isBinding = (tag: string) => tag.startsWith("@test:") || schemes.some((s) => tag.startsWith(`@${s}:`));
  let tags: { line: number; tag: string }[] = [];
  let inDoc: string | null = null;
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (inDoc) {
      if (line.startsWith(inDoc)) inDoc = null;
      return;
    }
    if (line.startsWith('"""') || line.startsWith("```")) {
      inDoc = line.slice(0, 3);
      return;
    }
    if (line.startsWith("@")) {
      for (const tag of line.replace(/\s+#.*$/, "").split(/\s+/)) if (tag.startsWith("@")) tags.push({ line: idx + 1, tag });
      return;
    }
    if (!line || line.startsWith("#")) return;
    const sc = kw.scenario.exec(raw);
    if (sc) {
      scenarios.push({
        file,
        line: idx + 1,
        title: sc[1].trim(),
        tests: tags.filter((t) => t.tag.startsWith("@test:")).map((t) => t.tag.slice("@test:".length).split("::").map(normaliseSegment).join("::")),
        bindings: tags.flatMap((t) => {
          const scheme = schemes.find((s) => t.tag.startsWith(`@${s}:`));
          return scheme ? [{ scheme, target: t.tag.slice(scheme.length + 2) }] : [];
        }),
        manual: tags.some((t) => t.tag === "@manual"),
      });
      tags = [];
      return;
    }
    if (kw.container.test(raw)) {
      misplaced.push(...tags.filter((t) => isBinding(t.tag)));
      tags = [];
      return;
    }
    if (kw.other.test(raw)) tags = []; // Examples tags are per-row, not links
  });
  return { file, scenarios, misplaced, ...(unknownLanguage ? { unknownLanguage } : {}) };
}

// ── Joining the two ─────────────────────────────────────────────────────────

export type GherkinFindingKind =
  | "test-without-scenario"
  | "tag-names-no-test"
  | "test-in-two-scenarios"
  | "scenario-names-no-test"
  | "tag-on-feature"
  | "ambiguous-test-name"
  | "tag-names-no-target"
  | "binding-unresolved"
  | "unknown-dialect"
  | "test-name-not-static";

export interface GherkinFinding {
  kind: GherkinFindingKind;
  file: string;
  line: number;
  /** The qualified test name concerned, where there is one. */
  test?: string;
  detail: string;
}

export interface GherkinReport {
  tests: FoundTest[];
  scenarios: FoundScenario[];
  findings: GherkinFinding[];
  /** Unbound Scenarios in declared specifications — counted, not findings. */
  specifications: FoundScenario[];
}

/** Join tests to Scenarios and report every orphan, both ways. Pure. */
export function joinTestsToScenarios(
  tests: readonly FoundTest[],
  features: readonly ParsedFeature[],
  resolvers: readonly BindingResolver[] = [],
): GherkinReport {
  const findings: GherkinFinding[] = [];
  const byName = new Map<string, FoundTest[]>();
  for (const t of tests) {
    if (t.dynamic) {
      findings.push({
        kind: "test-name-not-static",
        file: t.file,
        line: t.line,
        test: t.name,
        detail: "the test's title (or an enclosing describe's) is computed, so no `@test:` tag can name it — give it a literal title, or write the loop as `test.each(…)(\"… %s\")`",
      });
      continue;
    }
    byName.set(t.name, [...(byName.get(t.name) ?? []), t]);
  }
  for (const [name, ts] of byName) {
    if (ts.length > 1) {
      findings.push({
        kind: "ambiguous-test-name",
        file: ts[0].file,
        line: ts[1].line,
        test: name,
        detail: `${ts.length} tests share the name \`${name}\` (lines ${ts.map((t) => t.line).join(", ")}) — one tag cannot say which`,
      });
    }
  }
  const scenarios = features.flatMap((f) => f.scenarios);
  // Each resolver is read once per join.
  const cache = new Map<string, ReturnType<BindingResolver["resolve"]> | undefined>();
  const resolved = (scheme: string) => {
    if (!cache.has(scheme)) cache.set(scheme, resolvers.find((r) => r.scheme === scheme)?.resolve());
    return cache.get(scheme);
  };
  for (const f of features) {
    if (f.unknownLanguage) {
      findings.push({ kind: "unknown-dialect", file: f.file, line: 1, detail: `\`# language: ${f.unknownLanguage}\` is no Gherkin dialect — read as English, so its Scenarios may be missed` });
    }
  }
  const linkedBy = new Map<string, FoundScenario[]>();
  const specFiles = new Set(features.filter((f) => f.specification).map((f) => f.file));
  const specifications: FoundScenario[] = [];
  for (const s of scenarios) {
    if (s.tests.length === 0 && s.bindings.length === 0 && !s.manual && specFiles.has(s.file)) {
      specifications.push(s);
    } else if (s.tests.length === 0 && s.bindings.length === 0 && !s.manual) {
      findings.push({ kind: "scenario-names-no-test", file: s.file, line: s.line, detail: `Scenario "${s.title}" carries no binding tag (\`@test:\`, ${BINDING_SCHEMES.map((b) => `\`@${b}:\``).join(", ")}) and is not \`@manual\` — nothing executes it` });
    }
    for (const b of s.bindings) {
      const r = resolved(b.scheme);
      const tag = `@${b.scheme}:${b.target}`;
      if (!r) findings.push({ kind: "binding-unresolved", file: s.file, line: s.line, test: tag, detail: `\`${tag}\` is unresolved — no resolver for \`${b.scheme}\` was given` });
      else if (!r.held) findings.push({ kind: "binding-unresolved", file: s.file, line: s.line, test: tag, detail: `\`${tag}\` is unresolved — ${r.reason}` });
      else if (!r.targets.has(b.target)) findings.push({ kind: "tag-names-no-target", file: s.file, line: s.line, test: tag, detail: `\`${tag}\` names no ${b.scheme} target that exists` });
    }
    for (const name of new Set(s.tests)) {
      if (!byName.has(name)) {
        findings.push({ kind: "tag-names-no-test", file: s.file, line: s.line, test: name, detail: `\`@test:${name}\` names no test that exists` });
      }
      linkedBy.set(name, [...(linkedBy.get(name) ?? []), s]);
    }
  }
  for (const f of features) {
    for (const m of f.misplaced) {
      findings.push({ kind: "tag-on-feature", file: f.file, line: m.line, test: m.tag.slice(1), detail: `\`${m.tag}\` is on a Feature or Rule line, so every Scenario under it would inherit it — tag the Scenario` });
    }
  }
  for (const [name, ts] of byName) {
    const by = linkedBy.get(name) ?? [];
    if (by.length === 0) {
      findings.push({ kind: "test-without-scenario", file: ts[0].file, line: ts[0].line, test: name, detail: `no Scenario names \`${name}\`` });
    } else if (by.length > 1) {
      findings.push({
        kind: "test-in-two-scenarios",
        file: ts[0].file,
        line: ts[0].line,
        test: name,
        detail: `\`${name}\` is named by ${by.length} Scenarios (${by.map((s) => `${s.file}:${s.line}`).join(", ")}) — a test maps to exactly one`,
      });
    }
  }
  return { tests: [...tests], scenarios, findings, specifications };
}

// ── Reading a tree ──────────────────────────────────────────────────────────

// input-site: inert #fca76dad — names the directories the walk skips; none of them is read
const SKIP_DIRS = new Set([".git", "node_modules", "target", "build", "dist", "vendor", ".venv", "venv", "__pycache__", ".gradle"]);

/** The files under `root` (repo-relative, `/`): git's list where there is one, else a walk. */
export function listFiles(root: string): string[] {
  try {
    // input-site: tree #6c771fee — the tracked and untracked-unignored files under the root: git's view of the working tree, which the cone replays
    const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
    return out.split("\0").filter((f) => f && existsSync(join(root, f)));
  } catch {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (SKIP_DIRS.has(e)) continue;
        const p = join(dir, e);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else files.push(relative(root, p).split(sep).join("/"));
      }
    };
    walk(root);
    return files;
  }
}

// ── Declared specifications ─────────────────────────────────────────────────

/**
 * A declaration a repository makes about itself that marks some of its
 * `.feature` files as test specifications for implementers. `read` returns
 * the files it covers (a subset of the `.feature` files given) and why, or
 * `undefined` when the repository makes no such declaration.
 */
export interface SpecificationDeclaration {
  name: string;
  read(root: string, features: readonly string[]): { files: ReadonlySet<string>; because: string } | undefined;
}

/** The key a `contentTypes` section uses to declare its implementer specifications. */
export const TEST_SPECIFICATIONS_KEY = "testSpecifications";

/**
 * `testSpecifications` on any section of `contentTypes` in the root
 * `index.config.json`: repository-relative paths (a directory ends in `/`)
 * whose `.feature` files are specifications for implementers.
 *
 * The section a repository puts it on is the content type whose
 * specifications they are, and this reader names none: it is the same for an
 * IG, a DAK or any type registered later. The key is the platform's, as
 * `include` is the IG type's; everything else in a section stays the business
 * of the layer that registered the type. A section with no such key declares
 * nothing, and a key that is not a list of paths is refused, never ignored:
 * a declaration that silently reads as empty would keep every Scenario
 * reported while its author believes otherwise.
 */
export const CONTENT_TYPE_SPECIFICATIONS: SpecificationDeclaration = {
  name: "content-type",
  read(root, features) {
    const path = join(root, "index.config.json");
    if (!existsSync(path)) return undefined;
    let config: { contentTypes?: unknown };
    try {
      config = JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return undefined; // a config that does not parse is the index's own check's finding
    }
    const sections = config?.contentTypes;
    if (!sections || typeof sections !== "object") return undefined;
    const by: string[] = [];
    const paths: string[] = [];
    for (const [type, section] of Object.entries(sections as Record<string, unknown>)) {
      if (!section || typeof section !== "object" || !(TEST_SPECIFICATIONS_KEY in section)) continue;
      const declared = (section as Record<string, unknown>)[TEST_SPECIFICATIONS_KEY];
      if (!Array.isArray(declared) || !declared.every((d) => typeof d === "string" && d.length > 0 && !/^[a-z][a-z0-9+.-]*:/i.test(d) && !d.startsWith("/"))) {
        throw new Error(`index.config.json contentTypes.${type}.${TEST_SPECIFICATIONS_KEY} must be a list of repository-relative paths`);
      }
      by.push(`contentTypes.${type}`);
      paths.push(...(declared as string[]).map((d) => d.replace(/^\.\//, "").replace(/\/+$/, "")));
    }
    if (by.length === 0) return undefined;
    const files = features.filter((f) => paths.some((u) => f === u || f.startsWith(u + "/")));
    return { files: new Set(files), because: `index.config.json ${by.join(", ")} declares ${TEST_SPECIFICATIONS_KEY} ${paths.join(", ")}` };
  },
};

/** Every declaration the scan honours. A new one is an entry here, never a path in a caller. */
export const SPECIFICATION_DECLARATIONS: readonly SpecificationDeclaration[] = [CONTENT_TYPE_SPECIFICATIONS];

export interface ScanOptions {
  /** Restrict to these repo-relative directories or files. Names stay relative to `root`. */
  under?: readonly string[];
  adapters?: readonly TestLanguageAdapter[];
  /** Resolvers for the non-`test` binding schemes. Default: `itb`, with no source held. */
  resolvers?: readonly BindingResolver[];
  /** Declarations that mark `.feature` files as specifications. Default: {@link SPECIFICATION_DECLARATIONS}. */
  declarations?: readonly SpecificationDeclaration[];
}

/** Scan `root`: every test the adapters find, every `.feature`, joined. */
export function scanTree(root: string, opts: ScanOptions = {}): GherkinReport {
  const adapters = opts.adapters ?? TEST_LANGUAGE_ADAPTERS;
  const resolvers = opts.resolvers ?? [itbResolver(undefined)];
  const schemes = [...new Set([...BINDING_SCHEMES, ...resolvers.map((r) => r.scheme)])];
  // A directory or a single file, repo-relative.
  const under = (opts.under ?? []).map((u) => u.replace(/^\.\//, "").replace(/\/+$/, ""));
  const files = listFiles(root).filter((f) => under.length === 0 || under.some((u) => f === u || f.startsWith(u + "/")));
  const tests: FoundTest[] = [];
  const features: ParsedFeature[] = [];
  for (const f of files) {
    if (f.endsWith(".feature")) {
      features.push(parseFeature(f, readFileSync(join(root, f), "utf-8"), schemes));
      continue;
    }
    const a = adapters.find((x) => x.matches(f));
    if (a) {
      tests.push(...a.findTests(f, readFileSync(join(root, f), "utf-8")));
      continue;
    }
    let src: string | undefined;
    const read = () => (src ??= readFileSync(join(root, f), "utf-8"));
    const c = adapters.find((x) => x.claims?.(f, read));
    if (c) tests.push(...c.findTests(f, read()));
  }
  const featureFiles = features.map((f) => f.file);
  for (const d of opts.declarations ?? SPECIFICATION_DECLARATIONS) {
    const spec = d.read(root, featureFiles);
    if (!spec) continue;
    for (const f of features) if (!f.specification && spec.files.has(f.file)) f.specification = spec.because;
  }
  return joinTestsToScenarios(tests, features, resolvers);
}
