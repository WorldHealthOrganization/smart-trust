/**
 * QA results: one declared home, and two renderings that cannot disagree.
 *
 * The owner's rule, 2026-09-19: *"if the witnesses were generated as a QA
 * reviewer primarily then it should be under `test/results/` as part of a QA
 * process."* Placement follows PROVENANCE — what produced an artefact and why
 * — not its file family and not who fetches it afterwards.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/docs-site.yml`) live in
 * `test/qa-results-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, it, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  buildQaResult,
  mayLeaveMain,
  qaResultState,
  qaResultsFile,
  sourceHashOf,
  writeQaResult,
  QA_RESULTS_DIR,
} from "../qa-results.js";
import { readDeclaration } from "../../schemas/kg/cat-harness.js";
import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { docsSources } from "../lib/docs-sources.ts";

const ROOT = join(HARNESS_ROOT);

describe("the results directory is DECLARED, not merely created", () => {
  it("`cat-harness.json` declares `test/results/` as a `qa` graph", () => {
    // The 134 witnesses under `docs/assets/qa/` spent their whole existence
    // undeclared: committed files no declaration mentioned, so a consumer
    // scanning the declared directories saw none of them and reported a clean
    // run over the lot — the `dh4f` defect in reverse. Declaring a directory
    // on the day it is created is the remedy, and this asserts it happened.
    const decl = readDeclaration(ROOT);
    expect(decl).toBeDefined();
    const entry = decl!.directories.find((d) => d.path.replace(/\/+$/, "") === QA_RESULTS_DIR);
    expect(entry).toBeDefined();
    expect(entry!.graphTypologies).toContain("qa");
  });

  it("...and the directory it declares exists — or is a kind that leaves `main`", () => {
    // `AGENTS.md`: "Declare only what exists — a declared-but-absent directory
    // is the bean `dh4f` defect, where a consumer scans nothing and reports a
    // clean run over it." Bean `0dav`: a `qa` directory is the one exception
    // the qa-reports arc makes (owner rulings D1/D4) — its working copy may be
    // absent — and every reader of it now says UNKNOWN rather than scanning
    // nothing and reporting clean. So absence is allowed only for that kind.
    const entry = readDeclaration(ROOT)!.directories.find((d) => d.path.replace(/\/+$/, "") === QA_RESULTS_DIR)!;
    if (!existsSync(join(ROOT, QA_RESULTS_DIR))) {
      expect(mayLeaveMain(entry as { graphTypologies?: string[] })).toBe(true);
      return;
    }
    expect(existsSync(join(ROOT, QA_RESULTS_DIR))).toBe(true);
  });
});

/**
 * `buildExport()` walks the whole layer: 2.3 s alone (2026-09-24). Bean
 * `61n5` recorded this test failing in 2 of 4 `bun run cat gates` runs and never
 * alone. Its sibling whole-repo scan in `check-declaration-filename.test.ts`
 * was caught failing the same way at 5.56 s against bun's 5 s default, with
 * an unchanged result. A timeout sized to the work, not to the default.
 */
const BUILD_EXPORT_MS = 30_000;

describe("the result and the document are two renderings of ONE computation", () => {
  it("every family in a freshly rendered result matches the export's own field", async () => {
    // Two computations can disagree; two renderings of one cannot. This is the
    // rule `feature-staging.yml` follows when it copies the `.json` alias AFTER
    // the staging stamp, and the reason `stagingStamp` is one function rather
    // than one per exporter. Asserted against the exporter's own renderer, on
    // a FRESH run: it read the committed file when there was one until bean
    // `cxcn` (reader audit F7), and a test must not assert on the committed
    // corpus. Drift between the exporter and what was last written is the
    // kg-export gate's question, not this test's.
    const { buildExport, kgExportQaDocument } = await import("../kg-export.js");
    const doc = await buildExport();
    const result = kgExportQaDocument(doc, "kg-export.jsonld");
    expect(result.$schema).toBe("qa-results/v1");

    for (const [family, field] of [
      ["undeclaredTerms", doc.undeclaredTerms],
      ["undeclaredSchemaModules", doc.undeclaredSchemaModules],
      ["danglingLinks", doc.danglingLinks],
      ["problems", doc.problems],
    ] as const) {
      expect(result.families[family]).toBeDefined();
      expect(result.families[family]!.entries).toEqual(field as unknown[]);
    }
  }, BUILD_EXPORT_MS);

  it("`total` is the sum, and `count` is never derived on read", () => {
    // A consumer asking only "is this clean" should not have to parse entries
    // whose shape differs per family.
    const r = buildQaResult({
      script: "scripts/demo.ts",
      scriptAbsPath: join(TOOLS_ROOT, "scripts", "kg-export.ts"),
      subject: { kind: "graph", id: "demo.jsonld" },
      families: { a: { summary: "s", entries: [1, 2] }, b: { summary: "s", entries: [] } },
    });
    expect(r.families.a!.count).toBe(2);
    // A determined empty, not an absent answer.
    expect(r.families.b!.count).toBe(0);
    expect(r.total).toBe(2);
  });

  it("families are emitted in sorted order, so a rerun does not churn the diff", () => {
    const r = buildQaResult({
      script: "s", scriptAbsPath: join(TOOLS_ROOT, "scripts", "kg-export.ts"),
      subject: { kind: "graph", id: "d" },
      families: { zeta: { summary: "s", entries: [] }, alpha: { summary: "s", entries: [] } },
    });
    expect(Object.keys(r.families)).toEqual(["alpha", "zeta"]);
  });
});

describe("provenance is never fabricated", () => {
  it("an unreadable producer hashes to `unknown`, not to the empty string", () => {
    // A hash of nothing compares unequal to everything and would read as "the
    // script changed" on every run. Same rule the export follows for a source
    // commit it cannot determine, and the staging stamp for a build that is
    // not happening.
    expect(sourceHashOf(join(ROOT, "no", "such", "file.ts"))).toBe("unknown");
    expect(sourceHashOf(join(TOOLS_ROOT, "scripts", "kg-export.ts"))).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("the witnesses are committed in one place and published in another", () => {
  const WITNESS_DIR = qaResultsFile(ROOT, "witnesses");

  it("they live under the declared results tree, not under docs/", () => {
    // Provenance, not consumption: a witness is `qa-witness.ts`'s projection of
    // what a checker found. It sat in `docs/` only because that is where Jekyll
    // could reach it, which is a fact about the build, not about the artefact.
    // With the results tree off `main` (bean `0dav`) there is nothing to find
    // here; the docs/ half below still holds, and is what the move protects.
    if (existsSync(dirname(WITNESS_DIR))) expect(existsSync(WITNESS_DIR)).toBe(true);

    // NARROWED 2026-09-21. This asserted that `docs/assets/qa/` does not exist
    // AT ALL, as a proxy for "no witnesses under docs/". The proxy stopped
    // being equivalent when bean `py74` published the qa graph's projection
    // there — one generated file, the same shape and the same home as
    // `assets/beans/index.json` and `assets/todos/index.json`, and not a
    // witness.
    //
    // So the guard now asserts what it always meant. A committed witness is
    // any of the three shapes the results tree holds, and finding one here
    // would mean the move had been undone.
    const qaAssets = join(ROOT, siteDirFor(ROOT), "assets", "qa");
    const here = existsSync(qaAssets) ? readdirSync(qaAssets) : [];
    expect(here.filter((f) => f !== "index.json")).toEqual([]);
    expect(here.some((f) => /\.(block|qa|qa-results)\.json$/.test(f))).toBe(false);
  });

  it("the badges still point at `/assets/qa/`, unchanged by the move", () => {
    // Where a file LIVES and where it is SERVED FROM are different questions.
    // Moving the URL as well would have rewritten every badge in every
    // generated page and the browser code that fetches them, for no gain.
    const page = readFileSync(join(ROOT, siteDirFor(ROOT), "concepts/agentic-harness.md"), "utf-8");
    expect(page).toContain("data-qa-src=\"{{ '/assets/qa/");
  });
});

describe("a generated page carries structure, never a verdict", () => {
  /** Every page `gen-docs-pages.ts` writes, read from disk. */
  const pages = () => {
    const out: Array<{ path: string; text: string }> = [];
    const walk = (d: string, depth: number) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        // A docs directory and its chapter folders, one level down — where
        // the generator writes `<slug>.md`. Not `reference/`, which holds 153
        // hand-generated instruction bodies this rule has nothing to say
        // about, and not the `_`-prefixed Jekyll or `source`/`site` folders.
        if (e.isDirectory() && depth === 0 && !/^(_|\.)|^(reference|source|site)$/.test(e.name)) walk(p, depth + 1);
        else if (e.isFile() && e.name.endsWith(".md")) {
          const text = readFileSync(p, "utf-8");
          if (text.includes("fa-qa-badge")) out.push({ path: p, text });
        }
      }
    };
    // Every docs source one run renders, not only this layer's: a page
    // about a higher layer's process is authored in that layer.
    for (const s of docsSources(ROOT)) if (existsSync(s.outDir)) walk(s.outDir, 0);
    return out;
  };

  it("finds the generated pages at all", () => {
    // The guard on the guard. Every assertion below is a `for` over this list,
    // so an empty one would report a clean run over nothing — the `dh4f`
    // defect this file opens by describing.
    expect(pages().length).toBeGreaterThan(5);
  });

  it("no page names a verdict state", () => {
    // `fa-qa-pass` and friends were written into the markup until bean `d2kp`.
    // A page carrying a verdict goes stale whenever a sweep changes its mind,
    // which made `gen-docs-pages.ts --check` a gate on the CORPUS rather than
    // on whether anybody regenerated — and, because nobody had, published a
    // page saying a knowledge-graph check FAILED on `publication-workflow.md`
    // when it passed.
    //
    // `fa-qa-unswept` is deliberately NOT in this list: whether a sidecar
    // exists is file existence, which is structure, and deferring it to the
    // browser would collapse "nobody checked" into "the fetch found nothing".
    for (const { path, text } of pages()) {
      for (const verdict of ["fa-qa-pass", "fa-qa-fail", "fa-qa-warn", "fa-qa-empty"]) {
        expect({ page: path, carries: verdict, found: text.includes(verdict) }).toEqual({
          page: path,
          carries: verdict,
          found: false,
        });
      }
    }
  });

  it("no page names a count, and every openable badge says it is still loading", () => {
    // The counts line — "0 fail, 0 warn, 10 pass, 0 n/a" — was the other half
    // of the baked-in verdict, and it lived in `title` and `aria-label` where
    // a class-name check would not see it.
    for (const { path, text } of pages()) {
      expect({ page: path, counts: / \d+ fail, \d+ warn,/.test(text) }).toEqual({
        page: path,
        counts: false,
      });
      // Every button starts `pending`, so the state a reader sees before the
      // fetch lands is "not yet known" rather than a guess.
      const buttons = text.match(/<button type="button" class="fa-qa-badge [^"]*"/g) ?? [];
      for (const b of buttons) expect({ page: path, b, pending: b.includes("fa-qa-pending") })
        .toEqual({ page: path, b, pending: true });
    }
  });

  it("every badge that opens names the index it is painted from", () => {
    // The badge and its page's verdict index are emitted together; a button
    // with no `data-qa-index` would sit at `pending` forever, which reads as
    // "loading" and never resolves.
    for (const { path, text } of pages()) {
      for (const m of text.matchAll(/<button type="button" class="fa-qa-badge[\s\S]*?>/g)) {
        for (const attr of ["data-qa-key=", "data-qa-index=", "data-qa-label=", "data-qa-src="]) {
          expect({ page: path, attr, present: m[0].includes(attr) }).toEqual({
            page: path,
            attr,
            present: true,
          });
        }
      }
    }
  });

  // "each page's verdict index exists, and holds a row for every badge on it"
  // read the committed witness tree, so it moved to `check:qa-corpus`
  // (`witness-index-missing`, `witness-index-row-missing`), which judges the
  // tree `qa:fetch` materialises — bean `cxcn`, reader audit F7 R64. Its
  // logic is tested over fixtures in `check-qa-corpus.test.ts`.
});

// "the badge URLs resolve against a tree built the way the site is" and "no
// published path is `_`-prefixed" walked the COMMITTED witness tree. Both are
// `check:qa-corpus` now (`witness-url-missing`, `witness-underscore-path`),
// over the fetched tree the site build publishes — bean `cxcn`, reader audit
// F7 R64 — and tested over fixtures in `check-qa-corpus.test.ts`.

/**
 * A result whose findings did not change is not rewritten.
 *
 * `updated_at` moves on every run, so an unconditional write made EVERY QA
 * producer dirty the working tree whenever anybody ran it. That is not a
 * tidiness complaint: these sidecars exist so a reviewer can tell "this
 * finding is new" from "this finding was already there", and a file that
 * always appears changed has given up the property it was created to have.
 */
describe("writeQaResult does not churn", () => {
  function result(entries: unknown[]) {
    return buildQaResult({
      script: "scripts/x.ts",
      scriptAbsPath: join(HARNESS_ROOT, "package.json"),
      subject: { kind: "t", id: "t" },
      families: { f: { summary: "s", entries } },
    });
  }

  test("identical findings leave the file untouched", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-churn-"));
    const p = writeQaResult(root, "x", result([]));
    const first = readFileSync(p, "utf-8");
    writeQaResult(root, "x", result([]));
    expect(readFileSync(p, "utf-8")).toBe(first);
  });

  test("CHANGED findings do rewrite", () => {
    // The guard must not be a freeze.
    const root = mkdtempSync(join(tmpdir(), "qa-churn-"));
    const p = writeQaResult(root, "x", result([]));
    writeQaResult(root, "x", result([{ finding: "new" }]));
    expect(readFileSync(p, "utf-8")).toContain("new");
  });

  test("the document carries no timestamp, so two branches cannot collide on one (y7b3)", () => {
    // Measured over 300 merges: 80 of the 86 conflicting lines in
    // skill-register.qa-results.json were `updated_at`, and no reader used it.
    expect(result([])).not.toHaveProperty("updated_at");
  });

  test("an old file that still carries a timestamp reads STALE, so it is regenerated away", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-churn-"));
    const p = writeQaResult(root, "x", result([]));
    const legacy = { ...JSON.parse(readFileSync(p, "utf-8")), updated_at: "2026-01-01T00:00:00.000Z" };
    writeFileSync(p, JSON.stringify(legacy, null, 2) + "\n");
    expect(qaResultState(p, result([]))).toBe("stale");
    writeQaResult(root, "x", result([]));
    expect(readFileSync(p, "utf-8")).not.toContain("updated_at");
  });
});

