/**
 * The viewer's inline scripts parse, and its Lean badges read `lean.ref`.
 *
 * ## Why a parse test exists
 *
 * `viewer/index.html` carries the whole viewer as one inline module script.
 * On 2026-10-20 it did not parse: two block-index loops in `renderPaper` had
 * lost a closing brace and a sidebar helper had its callers pasted inside it,
 * so the browser stopped at "Unexpected end of input" and NONE of the module
 * ran. No test loaded the page under `bun test`, so nothing went red. This
 * test parses every inline script with TypeScript's parser, which is cheap
 * and needs no browser, and fails on the first syntax error with its line.
 *
 * ## Why the Lean helpers are pinned
 *
 * Manifests carry `lean.ref` (`"<package>:<Decl.Name>"`) since the lean.ref
 * migration, and the resolver passes it through. The viewer read only
 * `lean.file` / `lean.decl`, so a ref-only block showed "no lean" and printed
 * "undefined" (bean `cat-tools-og5t`). The helpers are evaluated from the page
 * itself, so the test is of the shipped code, not of a copy.
 *
 * @module scripts/tests/viewer-script
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { TOOLS_ROOT } from "../../lib/roots.ts";

const PAGE = readFileSync(join(TOOLS_ROOT, "viewer", "index.html"), "utf-8");

/** Every inline `<script>` body, with the page line it starts on. */
function inlineScripts(html: string): { line: number; body: string }[] {
  const out: { line: number; body: string }[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    out.push({ line: html.slice(0, m.index).split("\n").length, body: m[1]! });
  }
  return out;
}

describe("viewer/index.html", () => {
  const scripts = inlineScripts(PAGE);

  test("has inline scripts to check — finding none is not a pass", () => {
    expect(scripts.length).toBeGreaterThan(0);
    expect(Math.max(...scripts.map((s) => s.body.length))).toBeGreaterThan(100_000);
  });

  test("every inline script parses", () => {
    const errors: string[] = [];
    for (const s of scripts) {
      const out = ts.transpileModule(s.body, {
        reportDiagnostics: true,
        fileName: "inline.js",
        compilerOptions: { allowJs: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      for (const d of out.diagnostics ?? []) {
        const at = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line : 0;
        errors.push(`page line ${s.line + at}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
      }
    }
    expect(errors).toEqual([]);
  });

  // A script that PARSES can still die before it draws anything. On
  // 2026-10-21 the paper view threw "Cannot access 'chId' before
  // initialization": the sidebar loop read `chId` eight lines above its
  // `const`. A parse cannot see that; TypeScript's checker can, on plain
  // JavaScript, and only those diagnostics are asked for (a viewer is not
  // type-annotated, so every other check would be noise).
  test("no variable is used before its declaration", () => {
    const BEFORE_DECLARATION = new Set([2448, 2449, 2450, 2454]);
    const found: string[] = [];
    scripts.forEach((s, n) => {
      const name = `inline-${n}.js`;
      const options = { allowJs: true, checkJs: true, noEmit: true, noLib: true, types: [] };
      const host = ts.createCompilerHost(options);
      const read = host.getSourceFile.bind(host);
      host.getSourceFile = (f, lang) =>
        f === name ? ts.createSourceFile(f, s.body, lang, true, ts.ScriptKind.JS) : read(f, lang);
      const program = ts.createProgram([name], options, host);
      for (const d of program.getSemanticDiagnostics(program.getSourceFile(name))) {
        if (!BEFORE_DECLARATION.has(d.code) || d.file === undefined || d.start === undefined) continue;
        const at = d.file.getLineAndCharacterOfPosition(d.start).line;
        found.push(`page line ${s.line + at}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`);
      }
    });
    expect(found).toEqual([]);
  });
});

describe("the viewer's Lean helpers read both shapes", () => {
  // Evaluated from the page, so this tests what ships.
  const src = ["hasLean", "leanDeclName", "leanSourceHref"].map((name) => {
    const m = PAGE.match(new RegExp(`function ${name}\\(l\\) \\{[\\s\\S]*?\\n    \\}|function ${name}\\(l\\) \\{[^\\n]*\\}`));
    if (!m) throw new Error(`viewer/index.html no longer defines ${name}(l)`);
    return m[0];
  });
  // input-site: inert #026b2ca6 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const { hasLean, leanDeclName, leanSourceHref } = new Function(
    `${src.join("\n")}; return { hasLean, leanDeclName, leanSourceHref };`,
  )() as {
    hasLean: (l: unknown) => boolean;
    leanDeclName: (l: unknown) => string;
    leanSourceHref: (l: unknown) => string;
  };

  test("a ref-only block has Lean, named by its declaration without the package", () => {
    const l = { ref: "qou:QOU.ChiSymAlt.chiPairProductC_eq" };
    expect(hasLean(l)).toBe(true);
    expect(leanDeclName(l)).toBe("QOU.ChiSymAlt.chiPairProductC_eq");
  });

  test("the older `decl` / `file` shape still reads", () => {
    expect(leanDeclName({ decl: "Foo.bar", file: "Foo/Bar.lean" })).toBe("Foo.bar");
    expect(leanDeclName({ file: "Foo/Bar.lean" })).toBe("Foo/Bar.lean");
  });

  test("no ref, decl or file is no Lean, and names nothing rather than `undefined`", () => {
    expect(hasLean({ validation: "ok" })).toBe(false);
    expect(hasLean(undefined)).toBe(false);
    expect(leanDeclName(undefined)).toBe("");
  });

  test("the GitHub source link is used only in the shape the server builds (og5t, ruling A)", () => {
    const ok = "https://github.com/litlfred/qou/blob/77e7f0e/folio/q/lean/QOU/A.lean#L7";
    expect(leanSourceHref({ ref: "qou:QOU.A.x", sourceUrl: ok })).toBe(ok);
    for (const bad of [
      "javascript:alert(1)",
      "https://evil.example/litlfred/qou/blob/77e7f0e/a.lean",
      "https://github.com/litlfred/qou/blob/main/a.lean",
      'https://github.com/o/r/blob/77e7f0e/a.lean" onmouseover="x',
    ]) expect(leanSourceHref({ sourceUrl: bad })).toBe("");
    expect(leanSourceHref({ ref: "qou:QOU.A.x" })).toBe("");
    expect(leanSourceHref(undefined)).toBe("");
  });
});

describe("the viewer's route recogniser takes every block label, not a hand-kept list (og5t)", () => {
  // Evaluated from the page, so this tests what ships.
  const m = PAGE.match(/const LABEL_RE = (\/.*\/[a-z]*);/);
  if (!m) throw new Error("viewer/index.html no longer defines LABEL_RE");
  // input-site: inert #2cb163d1 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const LABEL_RE = new Function(`return ${m[1]};`)() as RegExp;

  test("tables, algorithms and the other prefixes qou uses are labels", () => {
    for (const label of [
      "tbl:hecke-log-decomposition-table-data",
      "alg:delta-lambda-closure",
      "def:quantum-universe",
      "ssec:foo",
      "subsec:foo",
      "viz:foo",
      "proof:foo",
      "prose:foo",
    ]) expect(LABEL_RE.test(label)).toBe(true);
  });

  test("a paper id, a cross-paper reference, a route or a URL is not a label", () => {
    for (const slug of [
      "quantum-observable-universe",
      "unital-groebner-bases:cor:pbw",
      "/view/quantum-observable-universe",
      "@claude/some-branch",
      "https://folio.example.org/viewer/",
    ]) expect(LABEL_RE.test(slug)).toBe(false);
  });
});
