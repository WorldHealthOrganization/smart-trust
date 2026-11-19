/**
 * The bootstrap graph resolves at the URL it names itself by, has exactly one
 * publisher, and holds what is on disk.
 *
 * Since 2026-09-30 (owner, bean `xsqm`) the one publisher is bootstrap-tools'
 * `export-graph.ts`, and `gen-bootstrap-graph.ts`, the cat-harness generator
 * these tests were first written against, is gone (owner: "remove
 * gen-bootstrap-graph"). The exporter's own properties — purity, ordering, no
 * absolute path, provenance only when asked, the `omitted` list — are asserted
 * beside it in `bootstrap-tools/scripts/export-graph.test.ts`. What stays here
 * is what only this repository can see: which workflow step publishes it,
 * where, and whether the export agrees with a disk read made independently of
 * the declaration.
 *
 * @module scripts/tests/bootstrap-graph.test
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/docs-site.yml` and the checkout's git index) live in
 * `test/bootstrap-graph-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { GraphExportSchema } from "@litlfred/bootstrap-tools/schemas/graph-export.ts";
// A namespace import: `subjectBase` exists from bootstrap-tools#52, and a
// checkout pinned below it must still typecheck and load this file.
import * as bootstrapExport from "@litlfred/bootstrap-tools/scripts/export-graph.ts";
const { exportGraph } = bootstrapExport;
const subjectBase = (bootstrapExport as { subjectBase?: (docIri: string) => string }).subjectBase;
import { isSkillMd } from "../known-skills.js";
import {
  repoRootFor,
  declarationPathIn,
  readDeclaration,
  artefactStub,
} from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
// `bootstrap/` is at the REPOSITORY root, not inside this layer — it is
// the graph read before anything knows which layer it is looking at.
const CAT_BOOTSTRAP = join(repoRootFor(ROOT), "bootstrap");
const STUB = artefactStub(readDeclaration(CAT_BOOTSTRAP)!);
/** The document as the site build makes it: `@id` = base + the `--out` file name. */
const build = (provenance = false) =>
  exportGraph(CAT_BOOTSTRAP, { docIri: `https://example.org/${STUB}/${STUB}.jsonld`, provenance });

describe("what it contains, read against the disk", () => {
  test("every skill bootstrap holds is in the graph", () => {
    // DERIVED, not pinned. It asserted `Skill` === 2 until 2026-09-20 and
    // broke the moment `log-message` landed — a count makes "the export still
    // works" and "somebody deleted a skill" indistinguishable, and the failure
    // it produces is on the change that was correct.
    //
    // The property is that the export sees what is on disk. A new skill passes
    // without an edit here; a skill the scan misses fails, which is the case
    // worth defending.
    expect(skillIds(build())).toEqual(skillFilesOnDisk());
  });

  test("bootstrap publishes only the graph typologies it DECLARES", () => {
    // Bean `3jj9`: the universal registry once leaked into every layer, so
    // bootstrap advertised `folio`, `voices` and `beans`, none of which it can
    // reach. Derived from the declaration, read here independently of the
    // exporter: published is a subset of declared.
    const kinds = (build()["@graph"] as Array<Record<string, unknown>>)
      .filter((n) => n["@type"] === "bootstrap:Subgraph")
      .flatMap((n) => (n["type"] as string[]).map((k) => k.split("/").pop()!));
    const declared = new Set(
      (JSON.parse(readFileSync(declarationPathIn(CAT_BOOTSTRAP)!, "utf-8")) as {
        directories?: Array<{ graphTypologies?: string[] }>;
      }).directories?.flatMap((d) => d.graphTypologies ?? []) ?? [],
    );
    expect(kinds.length).toBeGreaterThan(0); // not vacuous
    for (const k of kinds) expect([...declared]).toContain(k);
  });

  test("bootstrap's process IS in the graph, with its flows and lanes", () => {
    // This asserted the OPPOSITE until 2026-09-19 — "the missing BPMN
    // directory is reported rather than passed over", against the real
    // `bootstrap/`, which had no `workflows/` when it was written. #413 gave
    // bootstrap its decision tree and the assertion inverted: the directory is
    // no longer missing, so nothing reports it missing.
    //
    // The behaviour it meant to pin — an absent directory is REPORTED, not
    // passed over — is real and still guarded, on a FIXTURE that declares the
    // absence, in `kg-export-instance.test.ts`. A property of a real layer
    // that is still being built cannot carry it: the test breaks when the
    // layer grows the feature, which is a fact about the subject rather
    // than about the code.
    //
    // What belongs here is the fact that is now true and worth defending.
    //
    // `Process: 1` was pinned here and broke when `log-message.bpmn` landed —
    // the same count-vs-property failure as the skills above, and the count
    // was ALSO stating a rule it could not enforce. "One process" was never
    // the constraint; "one place to START" is. A sub-process is a second
    // diagram and does not compete for being the thing a Bootstrapping Agent begins.
    const doc = build();
    const counts = doc["counts"] as Record<string, number>;
    expect({
      processes: processIds(doc),
      hasNodes: (counts["bootstrap:ProcessNode"] ?? 0) > 0,
      hasFlows: (counts["bootstrap:SequenceFlow"] ?? 0) > 0,
      hasRoles: (counts["bootstrap:Role"] ?? 0) > 0,
    }).toEqual({ processes: diagramsOnDisk(), hasNodes: true, hasFlows: true, hasRoles: true });
    // And nothing about the diagram is reported as a problem.
    expect((doc["problems"] as string[]).filter((p) => p.includes("bpmn"))).toEqual([]);
  });
});

/**
 * Node ids of one `@type`, reduced to the id after their kind segment, sorted.
 *
 * A subject is a PATH beside the document, `<doc dir>/<kind>/<id>`, not a
 * `#<kind>/<id>` fragment of it (bootstrap-tools#52, cat-harness-tools#958).
 * Read against `subjectBase`, the exporter's own answer to where that
 * directory is; an id outside it is thrown on rather than reduced to nonsense.
 */
function idsOfType(doc: Record<string, unknown>, type: string): string[] {
  const graph = (doc["@graph"] ?? []) as Array<Record<string, unknown>>;
  const base = typeof subjectBase === "function" ? subjectBase(String(doc["@id"])) : undefined;
  const stem = (iri: string): string => {
    if (base === undefined) return iri.split("#")[1]!.split("/").slice(1).join("/");
    if (base === "" || !iri.startsWith(base)) throw new Error(`${iri} is not a subject path under ${base || "(no base)"}`);
    return iri.slice(base.length).split("/").slice(1).join("/");
  };
  return graph
    .filter((n) => {
      const t = n["@type"];
      const ts = Array.isArray(t) ? t.map(String) : [String(t)];
      // `@type` is a CURIE, `bootstrap:Skill`. Matched on the whole local
      // name rather than a suffix, so `ProcessNode` does not answer for `Process`.
      return ts.some((x) => x === `bootstrap:${type}`);
    })
    .map((n) => stem(String(n["@id"])))
    .sort();
}

function skillIds(doc: Record<string, unknown>): string[] {
  return idsOfType(doc, "Skill");
}

function processIds(doc: Record<string, unknown>): string[] {
  return idsOfType(doc, "Process");
}

/**
 * The skill bodies actually sitting in `bootstrap/skills/`.
 *
 * Shares `isSkillMd` with the exporter deliberately — a README or a node
 * declaring `$schema:` is not a skill, and a disk side that disagreed about
 * THAT would fail on a correct tree. What the two sides do NOT share is which
 * directory to look in: this one names it, the exporter resolves it from the
 * declaration. That axis is the one worth defending, because a resolver that
 * stops finding `bootstrap/skills/` exports an empty section and reports a
 * clean run over it — the `dh4f` defect, verified by probe to fail here.
 */
function skillFilesOnDisk(): string[] {
  // ONE directory again, named. `tools/` (earlier `render/`) held the two
  // skills governing bootstrap's own `.jsonld`/`.json` emission from bean
  // `hfkl` until bean `n350` moved them into `skills/`: they are skills, the
  // Tool that performs the emission is bootstrap-tools' `export-graph.ts`,
  // and the document's shape is its `GraphExportSchema`.
  //
  // The list is STILL hardcoded on
  // purpose. Reading the declaration here would collapse the two axes into
  // one and the comparison below would compare the export against itself —
  // which is the whole defect this file exists to catch. The literal going
  // stale and failing loudly IS the mechanism, not a cost of it.
  return ["skills"]
    .flatMap((name) => {
      const dir = join(CAT_BOOTSTRAP, name);
      return readdirSync(dir)
        .filter((f) => f.endsWith(".md") && isSkillMd(join(dir, f)))
        .map((f) => f.slice(0, -3));
    })
    .sort();
}

/** The processes actually drawn in `bootstrap/processes/`, by their BPMN id. */
function diagramsOnDisk(): string[] {
  const dir = join(CAT_BOOTSTRAP, "processes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".bpmn"))
    .map((f) => /<bpmn:process id="([^"]+)"/.exec(readFileSync(join(dir, f), "utf-8"))?.[1] ?? f)
    .sort();
}

describe("the document has a schema, and the published build satisfies it (bean n350)", () => {
  // `renderExemption.owes` names this document. Until n350 it had no schema:
  // its properties lived in the emission skill's prose and the code that read
  // it cast `doc.problems as string[]`.
  // The published document is bootstrap-tools' since 2026-09-30 (owner,
  // bean `xsqm`), with its own schema; its properties are tested beside it
  // (`bootstrap-tools/scripts/export-graph.test.ts`). These two stay here
  // because the PUBLISHING — which step, with what flags — is this site's.
  test("the published document — bootstrap-tools' export-graph, the one publisher — parses", () => {
    const doc = build(true);
    const r = GraphExportSchema.safeParse(doc);
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  test("the two emission skills are in bootstrap's skills package", () => {
    const manifest = JSON.parse(readFileSync(join(CAT_BOOTSTRAP, "skills", "package-manifest.json"), "utf8"));
    expect(manifest.skills).toEqual(expect.arrayContaining(["bootstrap-graph-emission", "bootstrap-graph-publication"]));
  });
});
