/**
 * `external-schemas-viz` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/external-schemas-viz.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the external-schema
 * registry and the declarations of every content layer that uses it, which
 * only the checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.js";
import { declaredUsers, page, pageRelPath } from "../../scripts/gen-external-schemas-viz.js";
import { loadSpecs, namespacesInUse } from "../../scripts/external-schemas.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const INSTANCE = resolve(ORIGIN_DIR, "..", "..");
const REPO = resolve(INSTANCE, "..");

describe("the page a reader gets — over the REAL registry", () => {
  const specs = loadSpecs();
  const used = declaredUsers(specs, REPO);

  it("the registry is found at all — an empty one is not a clean run", () => {
    expect(specs.length).toBeGreaterThan(0);
  });

  it("every specification has a declared user, and no declaration names a missing record", () => {
    // The 36 hand-written entries these replaced covered every record; losing
    // one in the move would read as a spec nothing depends on.
    const declared = new Set(used.uses.map((u) => u.spec));
    expect(specs.map((s) => s.id).filter((id) => !declared.has(id))).toEqual([]);
    expect(used.unknown).toEqual([]);
  });

  it("each declaration form is exercised by the real corpus", () => {
    // A form nothing uses is a reader that could be broken without a test failing.
    expect([...new Set(used.uses.map((u) => u.form))].sort()).toEqual(["front-matter", "kind", "tag", "xmlns"]);
  });

  it("every row's link resolves to an anchor ON THIS PAGE", () => {
    const rendered = page(specs, used, namespacesInUse());
    const committed = readFileSync(join(INSTANCE, siteDirFor(INSTANCE), pageRelPath(REPO)!), "utf-8");
    for (const text of [rendered, committed]) {
      // A target is a kramdown heading id (`### Title {#id}`), the form the
      // generator emits since bean `uknu`. A bare `<a id>` beside the heading
      // collided with kramdown's own slug ("HL7 FHIR" -> `hl7-fhir`, twice).
      const targets = new Set([...text.matchAll(/\{#([^}\s]+)\}/g)].map((m) => m[1]));
      const links = [...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(links.length).toBe(specs.length);
      // One element per id: no separate anchor may duplicate a heading's id.
      expect([...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1])).toEqual([]);
      expect(links.filter((l) => !targets.has(l))).toEqual([]);
    }
  });

  it("no cell breaks the table it sits in", () => {
    // `operative` is free prose across 53 terms. An unescaped pipe shifts every
    // column to its right, which renders as a table that is subtly WRONG rather
    // than one that is obviously broken.
    const body = page(specs, used, namespacesInUse()).split("\n");
    const columns = (l: string): number => l.split(/(?<!\\)\|/).length;
    let checked = 0;
    for (let i = 0; i < body.length; i++) {
      if (!body[i]!.startsWith("|") || !body[i + 1]?.startsWith("|---")) continue;
      const want = columns(body[i]!);
      for (let j = i + 2; j < body.length && body[j]!.startsWith("|"); j++) {
        expect({ at: body[j]!.slice(0, 36), columns: columns(body[j]!) }).toEqual({
          at: body[j]!.slice(0, 36),
          columns: want,
        });
        checked += 1;
      }
    }
    // A table scan that found nothing would pass silently — the `dh4f` shape
    // in a test rather than in a report.
    expect(checked).toBeGreaterThan(10);
  });

  it("a spec with NO operative terms says so, rather than showing an empty table", () => {
    // `omg-dd-1.0` conforms without branching on any DD element. That is a
    // determined zero and a different fact from a record nobody filled in.
    const empty = specs.filter((s) => s.terms.length === 0);
    const html = page(specs, used, namespacesInUse());
    if (empty.length > 0) expect(html).toContain("determined zero, not an unfilled field");
    for (const s of empty) expect(html).toContain(s.id);
  });

  it("the page is DECLARED, not composed — and under the docs tree", () => {
    const at = pageRelPath(REPO);
    expect(at).toBeDefined();
    expect(at!.startsWith("..")).toBe(false);
  });
});

/**
 * Bean `qgjh`: a dependent that is a file here links to it; the resolver is
 * asked, never assumed, so one it cannot place stays code.
 */
describe("dependents link to their files (qgjh)", () => {
  const specs = loadSpecs();
  const used = declaredUsers(specs, REPO);
  it("links every dependent the resolver places, and no other", () => {
    const placed = new Set<string>();
    const html = page(specs, used, namespacesInUse(), (p) => {
      if (!p.endsWith(".ts")) return undefined;
      placed.add(p);
      return `https://host/${p}`;
    });
    expect(placed.size).toBeGreaterThan(0);
    for (const p of placed) expect(html).toContain(`[\`${p}\`](https://host/${p})`);
    expect(page(specs, used, namespacesInUse())).not.toContain("](https://host/");
  });
});
