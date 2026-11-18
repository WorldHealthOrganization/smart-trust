#!/usr/bin/env bun
/**
 * check-closure.ts — bootstrap-tools imports nothing but itself, `zod`,
 * `liquidjs`, `@playwright/test` and the runtime.
 *
 * ## Why this is a gate, not a convention
 *
 * bootstrap-tools exists to be released and run without anything above
 * bootstrap: its Zod is bootstrap's contract, and a bootstrap release must not
 * wait on a harness. A boundary nothing checks is the boundary that erodes
 * first, so this gate is tested with planted violations.
 *
 * ## The rule
 *
 * For every `.ts` file under `bootstrap-tools/`:
 * - a RELATIVE import must resolve to a file inside `bootstrap-tools/`;
 * - a BARE import must be `zod`, `liquidjs`, `@playwright/test`, a `node:`
 *   builtin, or — in a test file only — `bun:test` or `ajv`. `liquidjs` is the
 *   README writers' template engine and Playwright drives the Chromium that
 *   draws a Process. bpmn-js is loaded into that browser as a file, never
 *   imported.
 *
 * Imports are read with comments and string literals of other statements
 * stripped, so a docblock that quotes an import is not one.
 *
 * ```sh
 * bun run check:closure
 * ```
 *
 * ## One walker: the transitive resolver the gate and a mount share
 *
 * {@link importClosure} is the walk: from a set of entry files, every module
 * they import, transitively, with each edge resolved or said not to be. This
 * gate is one caller (every file of the package, followed only inside it);
 * a remote mount that brings a chosen Tool is another (its definition and
 * implementation, followed across the mounted layers); the staging cone is
 * a third. There is one walker, not one per caller: two walkers are two
 * answers to "what does this code load", and the one a gate does not exercise
 * is the one that drifts.
 *
 * The walker reads through a {@link ClosureHost}, so a caller can walk a tree
 * it has not checked out (a remote mount reads the pin), and it never decides
 * what a BARE specifier is: `resolveBare` maps a package the caller holds to a
 * file, and anything it does not map is `external`, left to the package
 * manager. It judges nothing; the gate below and each other caller do.
 *
 * @module bootstrap-tools/scripts/check-closure
 * @covers code
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** Bare specifiers any file may import. */
export const ALLOWED = [/^zod$/, /^liquidjs$/, /^@playwright\/test$/, /^node:/];
/** …and a test file may also import. */
export const ALLOWED_IN_TESTS = [/^bun:test$/, /^ajv$/];

export interface ClosureFinding {
  file: string;
  specifier: string;
  why: string;
}

/**
 * Blank out everything that is not code — comments, and the contents of every
 * string that is not itself a module specifier — keeping line structure.
 *
 * A docblock that quotes an import is not an import, and neither is a test
 * fixture that builds one inside a string (measured: this gate's own test file
 * tripped it before strings were blanked). A string IS kept when the code
 * right before it is `from`, `import` or `import(` / `require(`.
 */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const blank = (t: string) => t.replace(/[^\n]/g, " ");
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === "/" && n === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      const body = src.slice(i + 1, j);
      const isSpecifier = c !== "`" && /(\bfrom|\bimport|\bimport\s*\(|\brequire\s*\()\s*$/.test(out);
      out += c + (isSpecifier ? body : blank(body)) + (j < src.length ? c : "");
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Every module specifier a TypeScript file imports, statically or dynamically. */
export function specifiersOf(src: string): string[] {
  const s = stripComments(src);
  const out: string[] = [];
  const patterns = [
    /(?:^|[\n;])\s*import\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g,
    /(?:^|[\n;])\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of s.matchAll(re)) out.push(m[1]!);
  return out;
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

// ── The walker ───────────────────────────────────────────────────────────────

/** Where the walker reads: the disk by default, or a tree a caller has not checked out. */
export interface ClosureHost {
  /** Is `abs` a file (not a directory)? */
  isFile(abs: string): boolean;
  /** The text of file `abs`. Called only for a module the walker parses. */
  read(abs: string): string;
}

export const diskHost: ClosureHost = {
  isFile: (abs) => existsSync(abs) && statSync(abs).isFile(),
  read: (abs) => readFileSync(abs, "utf-8"),
};

/** Files whose imports are read; anything else (JSON, a stylesheet) is a leaf of the closure. */
export const MODULE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * A relative specifier, resolved the way Bun resolves this code: as written,
 * then `.js` → `.ts` (the `allowImportingTsExtensions` convention), then by
 * extension, then a directory's `index`.
 */
export function resolveRelative(from: string, spec: string, host: ClosureHost = diskHost): string | undefined {
  const base = resolve(dirname(from), spec);
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.mjs$/, ".mts"),
    ...["ts", "tsx", "js", "mjs"].map((e) => `${base}.${e}`),
    join(base, "index.ts"),
    join(base, "index.js"),
  ];
  return candidates.find((c) => host.isFile(c));
}

/** One import: who, what it says, and — when it resolved — the file it names. */
export interface ImportEdge {
  from: string;
  specifier: string;
  /** `relative` starts with `.`; anything else is `bare`. */
  kind: "relative" | "bare";
  /** The file it resolved to; absent when it did not resolve or was left `external`. */
  to?: string;
}

export interface ImportClosureResult {
  /** Every file reached, entries included, sorted. Leaves (JSON, …) are listed, not parsed. */
  files: string[];
  /** Every import read, in walk order. */
  edges: ImportEdge[];
  /** Relative imports that name no file, and bare ones `resolveBare` claimed and could not find. */
  unresolved: ImportEdge[];
  /** Bare imports `resolveBare` left to the package manager. */
  external: ImportEdge[];
  /** Files that `import()` a COMPUTED path: the closure may reach modules it cannot list. */
  computed: string[];
  /** Entries that are not files. */
  missing: string[];
}

export interface ImportClosureOptions {
  host?: ClosureHost;
  /**
   * A bare specifier's file, for the packages the caller holds as source (a
   * workspace sibling, a mounted layer). Return a path to follow it,
   * `null` when the package is the caller's and the path names nothing
   * (unresolved), or `undefined` to leave it `external`. Absent: every bare
   * import is external.
   */
  resolveBare?: (specifier: string, from: string) => string | null | undefined;
  /** Whether to read a reached file's own imports. Default: every file. The edge is recorded either way. */
  follow?: (abs: string) => boolean;
  /** Targets a file loads by a computed path that are DECLARED somewhere, walked like imports. */
  declaredEdges?: (abs: string) => readonly string[];
}

/** `import(` followed by anything but a string literal, in code with comments and strings blanked. */
const COMPUTED_IMPORT = /\bimport\s*\(\s*[^"'\s)]/;

/**
 * Every file `entries` load, transitively: THE closure walker (module note,
 * §"One walker"). It resolves and records; whether an edge is allowed is the
 * caller's to judge.
 */
export function importClosure(entries: readonly string[], opts: ImportClosureOptions = {}): ImportClosureResult {
  const host = opts.host ?? diskHost;
  const seen = new Set<string>();
  const out: ImportClosureResult = { files: [], edges: [], unresolved: [], external: [], computed: [], missing: [] };
  const queue: string[] = [];
  for (const e of entries) {
    const abs = resolve(e);
    if (host.isFile(abs)) queue.push(abs);
    else out.missing.push(abs);
  }
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!MODULE_FILE.test(file) || !(opts.follow?.(file) ?? true)) continue;
    const src = host.read(file);
    if (COMPUTED_IMPORT.test(stripComments(src))) out.computed.push(file);
    for (const t of opts.declaredEdges?.(file) ?? []) if (host.isFile(resolve(t))) queue.push(resolve(t));
    for (const specifier of specifiersOf(src)) {
      const kind = specifier.startsWith(".") ? "relative" : "bare";
      let to: string | undefined;
      if (kind === "relative") {
        to = resolveRelative(file, specifier, host);
        if (to === undefined) out.unresolved.push({ from: file, specifier, kind });
      } else {
        const r = opts.resolveBare?.(specifier, file);
        if (r === undefined) out.external.push({ from: file, specifier, kind });
        else if (r === null || !host.isFile(resolve(r))) out.unresolved.push({ from: file, specifier, kind });
        else to = resolve(r);
      }
      out.edges.push({ from: file, specifier, kind, ...(to !== undefined ? { to } : {}) });
      if (to !== undefined) queue.push(to);
    }
  }
  out.files = [...seen].sort();
  return out;
}

// ── The gate ─────────────────────────────────────────────────────────────────

/** Every import under `root` that leaves the package or names a package it may not use. */
export function checkClosure(root: string): ClosureFinding[] {
  const findings: ClosureFinding[] = [];
  const top = resolve(root);
  const inside = (p: string): boolean => p === top || p.startsWith(`${top}/`);
  // Every file of the package is an entry, and the walk stays inside it: an
  // edge out is recorded (and judged below), never followed.
  const walk = importClosure(tsFiles(top), { follow: inside });
  for (const e of walk.edges) {
    const isTest = e.from.endsWith(".test.ts");
    const rel = relative(top, e.from);
    if (e.kind === "relative") {
      if (e.to === undefined) findings.push({ file: rel, specifier: e.specifier, why: "does not resolve to a file" });
      else if (!inside(e.to)) findings.push({ file: rel, specifier: e.specifier, why: `leaves bootstrap-tools (${relative(top, e.to)})` });
    } else if (!ALLOWED.some((re) => re.test(e.specifier)) && !(isTest && ALLOWED_IN_TESTS.some((re) => re.test(e.specifier)))) {
      findings.push({ file: rel, specifier: e.specifier, why: isTest ? "a package tests may not use" : "a package bootstrap-tools may not use" });
    }
  }
  return findings;
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const findings = checkClosure(root);
  const files = tsFiles(root).length;
  if (files === 0) {
    console.error("✗ no .ts files found under bootstrap-tools/ — nothing was checked, which is not a pass.");
    process.exit(2);
  }
  if (findings.length === 0) {
    console.log(`✓ bootstrap-tools imports only itself, zod, liquidjs, @playwright/test and the runtime (${files} files).`);
    process.exit(0);
  }
  console.error(`✗ ${findings.length} import(s) leave bootstrap-tools' closure:`);
  for (const f of findings) console.error(`  · ${f.file}: "${f.specifier}" — ${f.why}`);
  console.error("bootstrap-tools may depend on bootstrap and nothing above it: move the piece down, or call it from the harness instead.");
  process.exit(1);
}
