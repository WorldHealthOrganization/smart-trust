/**
 * `bootstrap-graph` tests that read the aggregate repository's own root —
 * `.github/workflows/docs-site.yml` and the checkout's git index — moved here
 * from `cat-harness/scripts/tests/bootstrap-graph.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

import { exportGraph } from "@litlfred/bootstrap-tools/scripts/export-graph.ts";
import {
  repoRootFor,
  readDeclaration,
  artefactStub,
} from "../../schemas/kg/cat-harness.js";
import { sitePathOf } from "../../scripts/print-published-path.ts";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");
// `bootstrap/` is at the REPOSITORY root, not inside this layer — it is
// the graph read before anything knows which layer it is looking at.
const CAT_BOOTSTRAP = join(repoRootFor(ROOT), "bootstrap");
const STUB = artefactStub(readDeclaration(CAT_BOOTSTRAP)!);
/** The document as the site build makes it: `@id` = base + the `--out` file name. */
const build = (provenance = false) =>
  exportGraph(CAT_BOOTSTRAP, { docIri: `https://example.org/${STUB}/${STUB}.jsonld`, provenance });

/**
 * The steps in a workflow that publish a bootstrap GRAPH document.
 *
 * bootstrap-tools' `export-graph.ts` is the publisher; `kg-export.ts` pointed
 * at that layer was the previous one, and stays named so it cannot come
 * back unnoticed as a second. `ns-export.ts` also writes into `bootstrap/`, and is not one of these:
 * it publishes the NAMESPACE document, a different subject at a different URL.
 */
function bootstrapGraphPublishers(workflowText: string): string[] {
  const code = workflowText
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  return [...code.matchAll(/(?:cat-harness(?:-tools)?|bootstrap-tools)\/scripts\/([a-z0-9-]+)\.ts([^\n]*)/g)]
    .filter((m) => {
      const [script, rest] = [m[1]!, m[2] ?? ""];
      if (!/--out\s/.test(rest)) return false;
      if (script === "export-graph") return true;
      return script === "kg-export" && /--instance\s+\.?\/?bootstrap\b/.test(rest);
    })
    .map((m) => `${m[1]}${m[2]}`);
}

/**
 * Every `--out` path a workflow writes, with its shell variables expanded.
 *
 * The workflow captures stubs — `BOOT_STUB=$(… print-stub.ts ./bootstrap)` —
 * and the layer's directory — `BOOT_DIR=$(… print-published-path.ts
 * ./bootstrap)`, the resolver's `<name>/` (bean `sthf`) — so a literal-text
 * match cannot see the path at all. Expanding the capture rather than
 * hardcoding `bootstrap` keeps the assertion pointed at the DECLARATION: rename
 * the layer and both sides move together, which is the whole reason the
 * workflow captures it instead of spelling it out. A directory capture expands
 * without its trailing slash, as the workflow writes `${BOOT_DIR}/`.
 */
function siteOutputs(workflowText: string): string[] {
  const stubs = new Map<string, string>();
  for (const m of workflowText.matchAll(
    /(\w+)=\$\(bun run cat-harness(?:-tools)?\/scripts\/(print-stub|print-published-path)\.ts\s+(\S+)\)/g,
  )) {
    const decl = readDeclaration(join(repoRootFor(ROOT), m[3]!));
    if (!decl) continue;
    const value = m[2] === "print-stub" ? artefactStub(decl) : sitePathOf(decl)?.replace(/\/$/, "");
    if (value !== undefined) stubs.set(m[1]!, value);
  }
  const expand = (v: string): string =>
    v.replace(/\$\{(\w+)\}/g, (whole, name: string) => stubs.get(name) ?? whole);
  return [...workflowText.matchAll(/--out\s+"([^"]+)"/g)].map((m) => expand(m[1]!));
}

describe("the document is published where it says it is", () => {
  /**
   * These two replaced "`bootstrap.jsonld` is committed" and "it is current",
   * which went with the committed file on 2026-09-20.
   *
   * Their premise was that a cold reader is told to load the file from a fresh
   * clone. **No prose file under `bootstrap/` mentions this document** — the
   * README sends that reader to `workflows/initialize-harness.bpmn` and
   * `skills/bootstrap-kg-navigation.md`. So the pair defended an instruction
   * that does not exist, while the thing worth defending went unguarded: the
   * `@id` resolved to nothing, because the site build published
   * `bootstrap/ns.jsonld` — the NAMESPACE document — and never this one.
   *
   * That is `blv9` in the artefact whose whole purpose is being dereferenced,
   * and it is what these assert instead.
   */
  test("its `@id` is the URL the site build writes it to", () => {
    // Each publishing step passes `--base-url <site>/<stub>/` and
    // `--out ./_site/<stub>/<file>`, and the exporter names the document
    // `<base-url><file>`, so the `@id` is the served path by construction.
    // What can still go wrong is the two arguments naming different
    // directories, which is what this reads off each step.
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", wf), "utf-8");
      for (const step of bootstrapGraphPublishers(text)) {
        const base = /--base-url\s+"[^"]*\/([^"/]+)\/"/.exec(step)?.[1];
        const outDir = /--out\s+"\.\/_site\/([^"/]+)\//.exec(step)?.[1];
        expect({ wf, base, outDir }).toEqual({ wf, base: outDir, outDir: expect.any(String) });
      }
    }
  });

  test("the site build actually writes it, at that path", () => {
    // The assertion is against the WORKFLOW, because the failure being
    // guarded is a publication gap rather than a generator bug: the generator
    // worked perfectly for months while nothing published what it produced.
    //
    // Matched on the `--out` path rather than on the script name: a build that
    // runs the generator and writes it somewhere else leaves the `@id` dead
    // just as surely as one that never runs it, and the script name alone
    // cannot tell the two apart.
    //
    // That sentence was written here on 2026-09-20 and the assertion did not
    // honour it — the literal it matched named `gen-bootstrap-graph.ts`. Bean
    // `dyd3` then found TWO publishers writing a bootstrap graph, disagreeing
    // about its contents, and retired this one; the site now writes that URL
    // from `kg-export --instance ./bootstrap`, and since 2026-09-30 from
    // bootstrap-tools' `export-graph.ts`. A script-name match would have
    // gone red on the change that FIXED the defect it was guarding. Matching
    // the path, as the comment always said, it goes red only if nothing
    // writes there.
    const wf = readFileSync(
      join(repoRootFor(ROOT), ".github", "workflows", "docs-site.yml"),
      "utf-8",
    );
    const id = String(build()["@id"]);
    // `<base>/bootstrap/bootstrap.jsonld` → `bootstrap/bootstrap.jsonld`, the
    // path under `_site/`. Taken from the `@id` rather than written out, so
    // the two sides cannot drift into agreeing about different URLs.
    const served = new URL(id).pathname.split("/").slice(-2).join("/");
    expect(siteOutputs(wf)).toContain(`./_site/${served}`);
  });

  test("exactly ONE step publishes it — the rival generator no longer does", () => {
    // `dyd3`. Two generators minted the SAME document: this one at
    // `<base>/bootstrap/bootstrap.jsonld`, and `kg-export --instance
    // ./bootstrap` at `<base>/bootstrap.jsonld`. Measured 2026-09-21: 88 nodes
    // each, 85 of them doc-relative, so 85 subjects existed under two
    // identities no consumer will ever merge.
    //
    // Collapsing the PATHS is not what settles it, which is why this test is
    // about the COUNT rather than about a path: at one URL the two documents
    // still disagree on 74 of those 88 nodes, so the site would serve whichever
    // step ran last. The invariant is one publisher, and the failure mode it
    // guards is somebody re-adding the other because the generator is still
    // here and still works.
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", wf), "utf-8");
      expect({ workflow: wf, publishers: bootstrapGraphPublishers(text).length }).toEqual({
        workflow: wf,
        publishers: 1,
      });
    }
  });

  test("it is NOT committed — it is a build artefact now", () => {
    // The inverse of the test this replaces, and it earns its place: an
    // ignored path is easy to re-add with `git add -f`, and a re-added copy
    // silently goes stale with no gate left to catch it. The file may exist
    // locally, from a hand run of the exporter; what must not
    // exist is a TRACKED copy.
    const tracked = execFileSync("git", ["ls-files", "--", "bootstrap/bootstrap.jsonld"], {
      cwd: repoRootFor(ROOT),
      encoding: "utf-8",
    }).trim();
    expect(tracked).toBe("");
  });
});

describe("the document has a schema, and the published build satisfies it (bean n350)", () => {

  test("the published copy carries provenance; the @graph carries none (hwzu)", () => {
    // Owner, 2026-09-23: every published graph carries PROV provenance. Both
    // workflows pass `--provenance`; no node carries a build time.
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", wf), "utf-8");
      expect({ wf, provenance: bootstrapGraphPublishers(text).every((p) => p.includes("--provenance")) }).toEqual({ wf, provenance: true });
    }
    const doc = build(true);
    expect("generatedAtTime" in doc).toBe(true);
    expect(JSON.stringify(doc["@graph"]).includes("generatedAtTime")).toBe(false);
  });
});
