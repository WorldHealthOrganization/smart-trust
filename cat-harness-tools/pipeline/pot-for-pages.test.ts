/**
 * The page-template generator, tested for its CONSUMER — a translator.
 *
 * Bean `f6r1` / `ngxj`. Currency is the question `--check` already asks; these
 * are the questions a currency check structurally cannot ask, and every one of
 * them corresponds to a defect this module actually shipped on 2026-09-26:
 *
 * 1. Is the page set DERIVED from the gate's own findings? A hardcoded list is
 *    a second answer to "which page needs a catalogue", free to drift the
 *    moment one is finished.
 * 2. Is the English source resolved against the layer ROOT? `siteDirFor`
 *    returns a RELATIVE path, so a missing join resolves against the process's
 *    CWD — which answers correctly only while the CWD happens to be a
 *    layer holding a `docs/`. That shipped.
 * 3. Does the module keep owning a template after its page LEAVES the trigger
 *    set? 20 templates went stale behind a `--check` whose scope had shrunk
 *    away from its own output, and reported clean. That shipped too.
 * 4. Is `translations/<locale>/processes/` left alone? It belongs to
 *    `translate-bpmn.ts`, and `docs/processes/<name>.md` exists, so a
 *    source-exists filter would adopt 58 of another module's templates.
 * 5. Is a template whose source is GONE reported rather than deleted or
 *    silently dropped? `deletion-requires-confirmation`.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, setDefaultTimeout, test } from "bun:test";

import { siteDirFor } from "../schemas/kg/cat-harness.js";
import { needingCatalogue, owned, plan, sourceFor } from "./pot-for-pages.js";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const INSTANCE = join(HARNESS_ROOT);

// Every real-corpus question here runs `driftFor` over the whole checkout, at
// about five seconds a call on a CI runner, and `owned` runs it again — two
// tests timed out at bun's 5s default on folio-assistant#2614. The budget is
// raised rather than the corpus narrowed, and each answer is computed once.
setDefaultTimeout(60_000);
const once = <T>(f: () => T): (() => T) => {
  let v: { value: T } | undefined;
  return () => (v ??= { value: f() }).value;
};
const NEEDING = once(() => needingCatalogue(INSTANCE));
const OWNED = once(() => owned(INSTANCE));
const PLAN = once(() => plan(INSTANCE));

describe("the English source is resolved against the instance root", () => {
  test("sourceFor is ABSOLUTE and inside the instance", () => {
    // The defect this pins: `join(siteDirFor(root), page)` with no root is a
    // relative path, and `existsSync` then answers about the CWD. It produced
    // 25 templates that looked right because one run's CWD happened to suit.
    const p = sourceFor(INSTANCE, "getting-started");
    expect(p.startsWith("/")).toBe(true);
    expect(p.startsWith(INSTANCE)).toBe(true);
  });

  test("and it composes the DECLARED site root, not a `docs` literal", () => {
    // Weaker and truer than asserting `docs`: whatever the declaration says is
    // what must appear, so moving the site directory cannot break this module
    // and cannot silently pass either.
    expect(sourceFor(INSTANCE, "x")).toBe(join(INSTANCE, siteDirFor(INSTANCE), "x.md"));
  });
});

describe("the page set is derived, never written down", () => {
  test("every derived pair names a locale and a page", () => {
    // Guards the parse of the gate's `subject` field. A finding whose subject
    // failed to split would otherwise become a pair with an empty page and a
    // template written to `<locale>/.pot`.
    for (const x of NEEDING()) {
      expect(x.locale.length).toBeGreaterThan(0);
      expect(x.page.length).toBeGreaterThan(0);
      expect(x.page.endsWith(".pot")).toBe(false);
    }
  });

  test("the derived set is a SUBSET of what the module owns", () => {
    // The containment that makes clause 3 above true: a page the gate names is
    // always in scope, whether or not a template exists for it yet.
    const own = new Set(OWNED().map((x) => `${x.locale}/${x.page}`));
    for (const x of NEEDING()) {
      expect(own.has(`${x.locale}/${x.page}`)).toBe(true);
    }
  });

  test("ownership is strictly WIDER than the trigger set on the real corpus", () => {
    // Vacuity guard. If these were equal, clause 3 would be untested here and
    // the regression that shipped would be invisible again. Measured
    // 2026-09-26: 36 derived, 68 owned.
    expect(OWNED().length).toBeGreaterThan(NEEDING().length);
  });

  test("no pair is listed twice", () => {
    const keys = OWNED().map((x) => `${x.locale}/${x.page}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the ownership boundary with translate-bpmn", () => {
  test("nothing under `processes/` is adopted", () => {
    // `translations/<locale>/processes/*.pot` is `translate-bpmn.ts`'s output.
    // The boundary is the traversal (top level only), not a name filter — and
    // it has to be, because `docs/processes/<name>.md` EXISTS, so "the source
    // exists" would have adopted every one of them.
    // `not.toContain("/")` stood in for this while every page sat at the top
    // level; since the docs graph's named groups (bean `xka5`) a page may be
    // `concepts/architecture`, so the rule is stated as itself.
    for (const x of OWNED()) expect(x.page).not.toMatch(/^processes\//);
  });

  test("and the real corpus has such templates to be wrong about", () => {
    // Without this the test above passes on an empty subdirectory. The other
    // module's templates must actually be there for the exclusion to mean
    // anything.
    const translations = join(INSTANCE, "translations");
    const onDisk = readdirSync(translations, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(translations, d.name, "processes")))
      .flatMap((d) => readdirSync(join(translations, d.name, "processes")).filter((f) => f.endsWith(".pot")));
    expect(onDisk.length).toBeGreaterThan(0);
    const bpmn = PLAN().filter((p) => p.pot.includes(`${"processes"}/`));
    expect(bpmn).toHaveLength(0);
  });
});

describe("a template whose source is gone is REPORTED", () => {
  test("`sourceExists` is false and the entry survives in the plan", () => {
    // Not dropped, not deleted: `deletion-requires-confirmation`. The runner
    // prints these as `?` and writes nothing for them, so an orphan stays
    // visible until a person decides. Measured: `kg-viewer`, `agent-onboarding`.
    const orphans = PLAN().filter((p) => !p.sourceExists);
    expect(orphans.length).toBeGreaterThan(0);
    for (const o of orphans) expect(o.current).toBe(false);
  });
});

describe("a fixture instance, so the traversal is tested and not just the corpus", () => {
  test("a locale's top-level .pot is owned and its subdirectory is not", () => {
    const root = mkdtempSync(join(tmpdir(), "pot-owned-"));
    try {
      mkdirSync(join(root, "translations", "es", "processes"), { recursive: true });
      writeFileSync(join(root, "translations", "es", "page.pot"), "");
      writeFileSync(join(root, "translations", "es", "processes", "proc.pot"), "");
      // `needingCatalogue` needs no declaration here — a fixture with no site
      // and no published translation derives nothing, which is the point: what
      // is left is exactly what the traversal adopted.
      const own = owned(root).map((x) => `${x.locale}/${x.page}`);
      expect(own).toEqual(["es/page"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
