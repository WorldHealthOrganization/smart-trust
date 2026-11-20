/**
 * `groupDepthFor` — the derivation that replaced `SCAN`'s hardcoded depths.
 *
 * @module cat-harness/scripts/tests/detangle-group-depth.test
 *
 * The table it replaces had no test, and could not usefully have had one: a
 * literal agrees with itself. What is testable is a RULE, and the rule's whole
 * claim is that it reproduces every depth the table asserted while continuing to
 * work on directories the table never named — which is what makes
 * *"sub-dir = named subgraph declared by harness"* true mechanically.
 *
 * It imports from `group-depth.ts`, NOT from `kg-detangle.ts` where the rule is
 * used, and the last `describe` here is what keeps it that way. `kg-detangle.ts`
 * is an unguarded script: importing it runs the tool and writes the 29 sidecars
 * `kg:detangle:check` reads. This file's first version did exactly that, and
 * `bun test` said so — *"wrote 29 pinned measurement(s)"* above *"10 pass"* —
 * which is `ymsu`: a test that writes what a later gate reads makes the gate
 * green over any tree at all.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { groupDepthFor } from "../../../skills/kg/graph-management/group-depth.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const ROOT = resolve(dirname(HARNESS_ROOT));
/** Absolute paths, the way `corpusOf` hands them over. */
const at = (dir: string, ...rel: string[]): string[] => rel.map((r) => join(ROOT, dir, r));

describe("the rule: nodes nested below outnumber nodes directly present", () => {
  test("nodes in subdirectories name groups one level DOWN", () => {
    expect(groupDepthFor("a/b", at("a/b", "p/one.md", "p/two.md", "q/three.md"))).toBe(3);
  });

  test("nodes directly present name the directory ITSELF", () => {
    expect(groupDepthFor("a/b", at("a/b", "one.md", "two.md", "three.md"))).toBe(2);
  });

  test("majority, not presence — a PARTIAL carve does not flip it", () => {
    // Three moved into a theme, four still loose: not yet a carve.
    const partial = at("a/b", "t/1.md", "t/2.md", "t/3.md", "4.md", "5.md", "6.md", "7.md");
    expect(groupDepthFor("a/b", partial)).toBe(2);
    // Once most have moved, the themed directories become groups on their own.
    const mostly = at("a/b", "t/1.md", "t/2.md", "t/3.md", "t/4.md", "5.md");
    expect(groupDepthFor("a/b", mostly)).toBe(3);
  });

  test("an empty corpus is the directory itself, not a throw", () => {
    expect(groupDepthFor("a/b", [])).toBe(2);
  });

  test("depth follows the path's own length, so it is not a constant", () => {
    expect(groupDepthFor("x", at("x", "one.md"))).toBe(1);
    expect(groupDepthFor("a/b/c/d", at("a/b/c/d", "one.md"))).toBe(4);
  });
});

describe("it reproduces what the hardcoded table asserted", () => {
  /**
   * These four are the entries that killed every simpler rule, so they are
   * pinned by VALUE rather than by re-deriving them from disk — a test that
   * recomputed the corpus would only be asserting the implementation against
   * itself.
   *
   * `cat-harness/skills` vs `bootstrap/skills` is the decisive pair: same graph
   * kind, opposite depth. Any rule reading the KIND gets one of them wrong.
   */
  const CASES: Array<{ path: string; here: number; nested: number; was: number }> = [
    { path: "cat-harness/skills", here: 1, nested: 364, was: 3 },
    { path: "cat-harness/processes", here: 69, nested: 9, was: 2 },
    { path: "cat-harness/schemas", here: 182, nested: 54, was: 2 },
    { path: "bootstrap/skills", here: 9, nested: 0, was: 2 },
  ];

  test.each(CASES.map((c) => [c.path, c.here, c.nested, c.was, c] as const))("%s — %d here / %d nested -> %d", (_p, _h, _n, _w, c) => {
    const corpus = [
      ...at(c.path, ...Array.from({ length: c.here }, (_, i) => `h${i}.md`)),
      ...at(c.path, ...Array.from({ length: c.nested }, (_, i) => `sub/n${i}.md`)),
    ];
    expect(groupDepthFor(c.path, corpus)).toBe(c.was);
  });

  test("the two `skills` directories DISAGREE, so no kind-based rule passes", () => {
    const harness = at("cat-harness/skills", "kg-qa.manifest.json", "p/a.md", "p/b.md");
    const boot = at("bootstrap/skills", "a.md", "b.md", "c.md");
    expect(groupDepthFor("cat-harness/skills", harness)).not.toBe(
      groupDepthFor("bootstrap/skills", boot),
    );
  });
});

describe("importing the rule must not run the tool", () => {
  /**
   * The narrow invariant, asserted on the source rather than on behaviour,
   * because behaviour is the thing that already passed while being wrong: the
   * sidecars exist either way, so a test that merely reads one cannot tell a
   * write from a no-op. What CAN be stated exactly is the import surface — a
   * module that imports only `node:path` has nothing to run.
   *
   * Measured before and after the extraction, by mtime on
   * `cat-harness/schemas.detangle.json`: importing `group-depth.ts` left it
   * untouched; importing `kg-detangle.ts` moved it 348s. So the probe this test
   * stands in for was not vacuous — it distinguished the two cases.
   *
   * Comments are stripped first, and that is not incidental tidiness. The
   * obvious spelling — assert the source never CONTAINS "kg-detangle" — was
   * written, run, and failed here: the module's docblock names the script it was
   * extracted from, because that is the one fact a reader needs. A test over raw
   * source forbids a module from explaining itself.
   */
  const code = readFileSync(
    join(TOOLS_ROOT, "skills", "kg", "graph-management", "group-depth.ts"),
    "utf-8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  test("it imports nothing but node:path, so it has no side effect to run", () => {
    const imported = [...code.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imported).toEqual(["node:path"]);
  });

  test("and no dynamic form, which the static import list cannot see", () => {
    // The gap the test above leaves: `await import(...)` and `require(...)`
    // carry no `from` clause, so an exact match on the static list passes over
    // them. Both would re-open exactly the trap this module exists to close.
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\bimport\s*\(/);
  });
});
