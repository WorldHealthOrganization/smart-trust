/**
 * One graph per declared layer — bean `4ak5` items 1 and 5.
 *
 * The workflow literals below are fixture text on purpose (bean `jijc`): a
 * matcher fed a constant it was built from asserts nothing.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  DEPLOY_WORKFLOW,
  declaredExportNames,
  incompleteExports,
  publishedInstances,
  unpublishedInstanceSchemas,
  unpublishedZodSchemas,
} from "../check-published-instance-exports.js";
import { publishedIdentity, publishedInstanceSchemas, scannedInstanceSchemas } from "../kg-export.js";
import { inAggregate } from "../../test/support/checkout.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { artefactStub, layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { isPublished, publishedPath } from "../../schemas/kg/url-space.js";
import {
  PUBLISHED_ELSEWHERE,
  declaredInstanceStubs,
  instanceDocPath,
  instanceExportPlan,
  instanceSitePath,
  ownCodeListsDocument,
  publishesInstanceSchema,
  type PlannedExport,
} from "../instance-exports.js";

const REPO = resolve(import.meta.dir, "..", "..", "..");
const wf = (n: string) => readFileSync(join(REPO, ".github", "workflows", n), "utf-8");

/** A workflow body that runs every publisher, minus whatever `drop` names. */
function workflow(drop: string[] = []): string {
  const lines: Record<string, string> = {
    plan: "          bun run cat-harness/scripts/instance-exports.ts --out-dir ./_site",
    "cat-harness": '          bun run cat-harness/scripts/kg-export.ts             --scope instance --out "./_site/${STUB}/${STUB}.jsonld"',
    bootstrap: '          bun run bootstrap-tools/scripts/export-graph.ts --root ./bootstrap --base-url "x" --out y',
  };
  return Object.entries(lines)
    .filter(([k]) => !drop.includes(k))
    .map(([, v]) => v)
    .join("\n");
}

describe("the plan is the declarations, partitioned", () => {
  const plan = instanceExportPlan(REPO);
  const declared = declaredInstanceStubs(REPO);

  test("every declared instance is exactly one of: planned, published elsewhere, or declared not published", () => {
    const planned = new Set(plan.map((p) => p.stub));
    const disabled = new Set(
      layerRootsIn(REPO)
        .map((r) => readDeclaration(r))
        .filter((d) => d !== undefined && !isPublished(d))
        .map((d) => artefactStub(d!)),
    );
    for (const s of declared) {
      expect({ s, legs: [planned.has(s), s in PUBLISHED_ELSEWHERE, disabled.has(s)].filter(Boolean).length }).toEqual({ s, legs: 1 });
    }
  });

  test("the instances this bean found unpublished are in it", () => {
    // Measured 2026-10-02 against gh-pages: declared, no document.
    const planned = plan.map((p) => p.stub);
    for (const s of ["smart-base", "who-iris", "folio-assistant-core", "fhir-harness"]) expect(planned).toContain(s);
  });

  test("an instance with its own canonical URL is marked so, and one without is not", () => {
    const by = new Map(plan.map((p) => [p.stub, p]));
    expect(by.get("smart-base")?.ownCanonical).toBe(true);
    expect(by.get("who-iris")?.ownCanonical).toBe(false);
  });
});

describe("a plan line expands to one invocation per planned instance", () => {
  const plan: PlannedExport[] = [
    { path: "./a", name: "a", stub: "a", ownCanonical: false },
    { path: "./b", name: "b", stub: "b", ownCanonical: true },
  ];
  test("without a base, nothing stands in", () => {
    const got = publishedInstances("bun run cat-harness/scripts/instance-exports.ts --out-dir ./_site", "w.yml", () => plan);
    expect(got.map((i) => [i.instance, i.standInBase])).toEqual([
      ["./a", false],
      ["./b", false],
    ]);
    // A plan row is the one whose document must link a schema index.
    expect(got.every((i) => i.planned === true)).toBe(true);
  });
  test("with a base, it stands in only where the publisher passes it", () => {
    const got = publishedInstances('instance-exports.ts --out-dir ./_site --base-url "$BASE"', "w.yml", () => plan);
    expect(got.map((i) => [i.instance, i.standInBase])).toEqual([
      ["./a", true],
      ["./b", false],
    ]);
  });
  test("a workflow with no plan line never asks for the plan", () => {
    let asked = false;
    publishedInstances("kg-export.ts --instance ./x --out x.jsonld", "w.yml", () => {
      asked = true;
      return plan;
    });
    expect(asked).toBe(false);
  });
});

describe("completeness — bean 4ak5 item 5", () => {
  const declared = new Set(Object.keys(PUBLISHED_ELSEWHERE));

  test("a deploy running every publisher is complete", () => {
    expect(incompleteExports(new Map([[DEPLOY_WORKFLOW, workflow()]]), declared)).toEqual([]);
  });

  test("a deploy without the plan line is incomplete — the state this bean found", () => {
    const got = incompleteExports(new Map([[DEPLOY_WORKFLOW, workflow(["plan"])]]), declared);
    expect(got.join("\n")).toContain("does not run `instance-exports.ts --out-dir`");
  });

  test("dropping an exempt instance's own publisher leaves it published by nobody", () => {
    for (const stub of Object.keys(PUBLISHED_ELSEWHERE)) {
      const got = incompleteExports(new Map([[DEPLOY_WORKFLOW, workflow([stub])]]), declared);
      expect(got).toHaveLength(1);
      expect(got[0]).toContain(`\`${stub}\` is exempt`);
    }
  });

  test("the host publisher is accepted with the default scope and with `instance`, never `checkout`", () => {
    // Bean `4ak5` item 2: `checkout` would publish every stacked layer's
    // nodes under the host's name again — the state the split ended.
    const host = (flags: string, out = "./_site/\${STUB}/\${STUB}.jsonld"): string[] =>
      incompleteExports(
        new Map([[DEPLOY_WORKFLOW, `${workflow(["cat-harness"])}\n          bun run cat-harness/scripts/kg-export.ts ${flags}--out "${out}"`]]),
        declared,
      );
    expect(host("")).toEqual([]);
    expect(host('--base-url "$BASE" --scope instance ')).toEqual([]);
    expect(host("--scope checkout ").join("\n")).toContain("`cat-harness` is exempt");
    // #603 decision 1b (owner, 2026-10-23): the host's document sits under its
    // own directory. The old root `--out` is still accepted for the release
    // the tombstones cover, because the exporter places the document at its
    // published path whichever it is given (`placedOut`); any other path is not.
    expect(host("--scope instance ", "./_site/\${STUB}.jsonld")).toEqual([]);
    expect(host("--scope instance ", "./_site/elsewhere/\${STUB}.jsonld").join("\n")).toContain("`cat-harness` is exempt");
  });

  test("a publisher named only in a COMMENT is not a publisher", () => {
    const text = workflow(["bootstrap"]) + "\n          # bun run bootstrap-tools/scripts/export-graph.ts --root ./bootstrap --out y";
    expect(incompleteExports(new Map([[DEPLOY_WORKFLOW, text]]), declared).join("\n")).toContain("`bootstrap` is exempt");
  });

  test("an exemption naming no declared instance is a finding, not a pass", () => {
    // Pinned on `folio-assistant` until 2026-10-09: the case was "the declared
    // set lacks an exempt stub", and that stub was the only one the fixed set
    // `["cat-harness", "bootstrap"]` left out. Its exemption went with the
    // checkout root's declaration (cat-harness 080df096), so that set lacked
    // nothing and the case passed over no exemption at all. Asked of EVERY
    // exemption now, so the next one removed cannot empty it again.
    const stubs = Object.keys(PUBLISHED_ELSEWHERE);
    expect(stubs.length).toBeGreaterThan(0);
    for (const stub of stubs) {
      const without = new Set([...declared].filter((s) => s !== stub));
      const got = incompleteExports(new Map([[DEPLOY_WORKFLOW, workflow()]]), without);
      expect(got.join("\n")).toContain(`\`${stub}\`, which no instance in this checkout declares`);
    }
  });

  test("the REAL workflows are complete", () => {
    const real = new Map([
      [DEPLOY_WORKFLOW, wf(DEPLOY_WORKFLOW)],
      ["feature-staging.yml", wf("feature-staging.yml")],
    ]);
    expect(incompleteExports(real, declaredInstanceStubs(REPO))).toEqual([]);
  });
});

// ── The schema half — bean `4ak5` item 1 ───────────────────────────────────
//
// Reads other layers' real contracts and skills, so only where they are
// checked out together (standalone rule, bean `ho66`).
describe.skipIf(!inAggregate())("every contract a planned instance's skills name reaches its schema/", () => {
  const plan = instanceExportPlan(REPO);

  test("the deploy's own publisher leaves nothing out", () => {
    expect(unpublishedInstanceSchemas(plan)).toEqual([]);
  });

  test("the instances measured on 2026-10-05 with unpublished contracts now publish them", () => {
    const counts = new Map(plan.map((p) => [p.stub, publishedInstanceSchemas(resolve(REPO, p.path)).contracts.length]));
    for (const s of ["folio-assistant-core", "fhir-harness", "folio-assistant-sci", "smart-base"]) {
      expect(counts.get(s) ?? 0).toBeGreaterThan(0);
    }
  });

  test("FALSIFIED: a publisher that drops a contract fails the gate, naming it", () => {
    // The gate reads what the layer HAS from its skills' front matter and
    // what the publisher WRITES from the publisher, so a publisher that loses
    // a file is seen — the shape `folio-assistant-sci` would have had if the
    // contracts were read from its declared `schemas` graph (`sources/`).
    const dropping = (root: string) => {
      const built = publishedInstanceSchemas(root);
      return { ...built, contracts: built.contracts.slice(1), files: built.files.filter(([f]) => f !== built.contracts[0]?.published) };
    };
    const got = unpublishedInstanceSchemas(plan, dropping).join("\n");
    expect(got).toContain("which the publisher does not write into");
    expect(got).toContain("folio-assistant-sci");
  });

  test("FALSIFIED: a publisher that writes no index fails the gate", () => {
    const noIndex = (root: string) => {
      const built = publishedInstanceSchemas(root);
      return { ...built, files: built.files.slice(1) };
    };
    const got = unpublishedInstanceSchemas(plan.slice(0, 1), noIndex);
    expect(got).toHaveLength(1);
    expect(got[0]).toContain(`${plan[0]!.stub}.schema.json\` index`);
  });

  test("the document links an index exactly for the planned instances — the plan is the one answer", () => {
    for (const p of plan) expect(publishesInstanceSchema(resolve(REPO, p.path), REPO)).toBe(true);
    // The exempt layers keep their own publishers and get no schema/ from this one.
    expect(publishesInstanceSchema(REPO, REPO)).toBe(false); // the checkout root, `folio-assistant`
    expect(publishesInstanceSchema(join(REPO, "cat-harness"), REPO)).toBe(false);
    expect(publishesInstanceSchema(join(REPO, "bootstrap"), REPO)).toBe(false);
  });
});

// ── The Zod half — owner ruling 2026-10-05, option C ("every exported *Schema") ──
//
// A fixture layer, so the falsification does not depend on the corpus: the
// gate reads what a module DECLARES from its text and confirms it Zod by
// importing it; what is WRITTEN comes from the publisher it is handed.
describe("an exported Zod *Schema the publisher would not write fails the gate", () => {
  const root = mkdtempSync(join(tmpdir(), "zod-gate-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "schemas"), { recursive: true });
  const zod = JSON.stringify(Bun.resolveSync("zod", import.meta.dir));
  writeFileSync(
    join(root, "schemas", "widgets.ts"),
    `import { z } from ${zod};\nexport const FooSchema = z.object({ a: z.string() });\nexport const BarSchema = { type: "object" };\n`,
  );
  // The stub the publisher names the index by: this fixture declares nothing,
  // so it is whatever the identity falls back to — read, not assumed.
  const stub = publishedIdentity(root).stub;
  const plan: PlannedExport[] = [{ path: root, name: stub, stub, ownCanonical: false }];

  test("the deploy's own publisher writes it: no finding, and the non-Zod BarSchema is not one", async () => {
    expect(await unpublishedZodSchemas(plan, (r) => scannedInstanceSchemas(r), REPO)).toEqual([]);
  });

  test("FALSIFIED: a publisher that drops the rendering is named", async () => {
    const dropping = async (r: string) => {
      const built = await scannedInstanceSchemas(r);
      return { ...built, zod: [], files: built.files.filter(([f]) => !f.startsWith("zod/")) };
    };
    const got = await unpublishedZodSchemas(plan, dropping, REPO);
    expect(got).toEqual([
      `${root}: schemas/widgets.ts#FooSchema is an exported Zod *Schema, which the publisher does not write to ${stub}/schema/zod/widgets/FooSchema.schema.json`,
    ]);
  });

  test("FALSIFIED: a publisher that did not scan, or reports a failure, fails the gate", async () => {
    const unscanned = async (r: string) => publishedInstanceSchemas(r);
    expect((await unpublishedZodSchemas(plan, unscanned, REPO)).join("\n")).toContain("the publisher did not scan");
    const failing = async (r: string) => ({ ...(await scannedInstanceSchemas(r)), zodProblems: ["schemas/x.ts: could not be imported: boom"] });
    expect(await unpublishedZodSchemas(plan, failing, REPO)).toEqual([`${root}: schemas/x.ts: could not be imported: boom`]);
  });
});

// ── Re-exports — the text half reads every export form, and `export *` is reported ──
//
// Bean `4ak5` follow-up (owner-approved 2026-10-05). The text half read only
// `export const`, so a module that re-exported a Zod `*Schema` was invisible
// to it while the publisher's import walk rendered it: the gate could not
// fail on that schema whatever the publisher did.
describe("a re-exported Zod *Schema is read from the text too", () => {
  test("every value-export form yields the name the importer gets; `type` exports and bare `export *` do not", () => {
    const text = [
      "export const DirectSchema = z.string();",
      "export { LocalSchema, other };",
      'export { FooSchema as RenamedSchema, type TypeOnlySchema } from "./a.ts";',
      "export {\n  MultiLineSchema,\n  default as DefaultSchema,\n} from './b.ts';",
      'export type { PureTypeSchema } from "./c.ts";',
      'export * as NamespaceSchema from "./d.ts";',
      'export type * from "./e.ts";',
      "",
    ].join("\n");
    expect(declaredExportNames(text)).toEqual({
      names: ["DirectSchema", "LocalSchema", "other", "RenamedSchema", "MultiLineSchema", "DefaultSchema", "NamespaceSchema"],
      star: false,
    });
    expect(declaredExportNames('export * from "./x.ts";\n').star).toBe(true);
  });

  const root = mkdtempSync(join(tmpdir(), "zod-reexport-gate-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "schemas"), { recursive: true });
  const zod = JSON.stringify(Bun.resolveSync("zod", import.meta.dir));
  writeFileSync(join(root, "schemas", "base.ts"), `import { z } from ${zod};\nexport const BaseSchema = z.object({ b: z.number() });\n`);
  writeFileSync(
    join(root, "schemas", "relay.ts"),
    [
      `import { z } from ${zod};`,
      "const LocalSchema = z.string();",
      "export { LocalSchema };",
      'export { BaseSchema as RenamedSchema } from "./base.ts";',
      'export type { BaseSchema as TypeOnlySchema } from "./base.ts";',
      "",
    ].join("\n"),
  );
  writeFileSync(join(root, "schemas", "star.ts"), 'export * from "./base.ts";\n');
  const stub = publishedIdentity(root).stub;
  const plan: PlannedExport[] = [{ path: root, name: stub, stub, ownCanonical: false }];
  const starFinding =
    `${root}: schemas/star.ts has a bare \`export * from\`, so the gate cannot read from its text which *Schema ` +
    "names it re-exports — whether they are published could not be determined. Name them in an `export { … }` list";

  test("the deploy's own publisher writes every re-export, so the only finding is the undetermined `export *`", async () => {
    expect(await unpublishedZodSchemas(plan, (r) => scannedInstanceSchemas(r), REPO)).toEqual([starFinding]);
  });

  test("FALSIFIED: a publisher that drops the re-exported renderings is named, one finding per re-export", async () => {
    const dropping = async (r: string) => {
      const built = await scannedInstanceSchemas(r);
      const kept = (f: string) => !f.startsWith("zod/relay/");
      return { ...built, zod: built.zod.filter((z) => kept(z.published)), files: built.files.filter(([f]) => kept(f)) };
    };
    expect(await unpublishedZodSchemas(plan, dropping, REPO)).toEqual([
      starFinding,
      `${root}: schemas/relay.ts#LocalSchema is an exported Zod *Schema, which the publisher does not write to ${stub}/schema/zod/relay/LocalSchema.schema.json`,
      `${root}: schemas/relay.ts#RenamedSchema is an exported Zod *Schema, which the publisher does not write to ${stub}/schema/zod/relay/RenamedSchema.schema.json`,
    ]);
  });
});

describe.skipIf(!inAggregate())("every planned instance's exported Zod *Schema reaches its schema/zod/", () => {
  test("the deploy's own publisher leaves nothing out, and reports no failure", async () => {
    expect(await unpublishedZodSchemas(instanceExportPlan(REPO))).toEqual([]);
  });

  test("the re-exports measured on 2026-10-05 are read from the text, and the publisher writes them", async () => {
    // `materialization.ts` re-exports three Zod schemas with `export { … }`;
    // until the text half read lists, the gate could not see them at all.
    const text = readFileSync(join(REPO, "folio-assistant-core", "schemas", "materialization.ts"), "utf-8");
    const { names, star } = declaredExportNames(text);
    expect(names).toEqual(expect.arrayContaining(["SignatureSchema", "SourceProvenanceSchema", "FixitySchema"]));
    expect(star).toBe(false);
    const built = await scannedInstanceSchemas(join(REPO, "folio-assistant-core"));
    const written = new Set(built.files.map(([f]) => f));
    for (const n of ["SignatureSchema", "SourceProvenanceSchema", "FixitySchema"]) {
      expect(written.has(`zod/materialization/${n}.schema.json`)).toBe(true);
    }
  });
});

// ── The one URL-space resolver — bean `cat-tools-sthf` (consumer half of `nbal`) ──

describe("an instance's published files are placed by cat-harness's resolver", () => {
  test("the segment is the instance's NAME and the file is named by its stub", () => {
    // Different on purpose: equal values could not tell which one was used.
    expect(instanceDocPath({ name: "the-name", stub: "the-stub" })).toBe("the-name/the-stub.jsonld");
    expect(instanceSitePath("the-name", "schema")).toBe("the-name/schema");
  });

  test("it is publishedPath's `instance` case, site-relative, not a second spelling of it", () => {
    expect(`/${instanceDocPath({ name: "n", stub: "s" })}`).toBe(publishedPath({ case: "instance", instance: "n", path: "s.jsonld" }));
  });

  test("no published address moved: every planned instance's name is its stub today", () => {
    // The switch from `<stub>/` to `<name>/` is safe only while they agree;
    // a layer whose stub differs would move its `@id`s, which `blv9` gates.
    for (const p of instanceExportPlan(REPO)) expect(instanceDocPath(p)).toBe(`${p.stub}/${p.stub}.jsonld`);
  });
});

describe("an instance declaring `enabled: false` is not planned", () => {
  const repo = mkdtempSync(join(tmpdir(), "instance-plan-enabled-"));
  afterAll(() => rmSync(repo, { recursive: true, force: true }));
  for (const n of ["on", "off"]) mkdirSync(join(repo, n), { recursive: true });
  writeDeclaration(join(repo, "on"), { name: "on", directories: [] });

  test("the default is published, and `false` leaves it out", () => {
    writeDeclaration(join(repo, "off"), { name: "off", directories: [], enabled: false });
    expect(instanceExportPlan(repo).map((p) => p.name)).toEqual(["on"]);
  });

  test("FALSIFIED: the same instance with `enabled: true` is planned again", () => {
    writeDeclaration(join(repo, "off"), { name: "off", directories: [], enabled: true });
    expect(instanceExportPlan(repo).map((p) => p.name)).toEqual(["off", "on"]);
  });
});

describe("a layer's own code lists are published beside its document (#960)", () => {
  test("each concept is a path under that document (slash IRIs, #1379); a layer with none writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "own-code-lists-"));
    try {
      writeDeclaration(dir, {
        name: "demo",
        title: "demo",
        version: "0.1.0",
        directories: [{ id: "demo-code-lists", path: "code-lists", graphTypologies: ["code-list"] }],
      });
      const doc = "https://x.test/site/demo/demo-code-lists.jsonld";
      expect(ownCodeListsDocument(dir, "demo", doc)).toBeUndefined();
      mkdirSync(join(dir, "code-lists"), { recursive: true });
      writeFileSync(
        join(dir, "code-lists", "level.json"),
        JSON.stringify({
          $schema: "folio-code-list/v1",
          id: "level",
          title: "Level",
          description: "How high a thing is.",
          source: { note: "test" },
          codes: [{ code: "high", label: "High", definition: "Higher than most things." }],
        }),
      );
      const built = ownCodeListsDocument(dir, "demo", doc)!;
      expect(built["@id"]).toBe(doc);
      expect((built["@graph"] as Array<{ "@id": string }>).map((n) => n["@id"])).toEqual([`${doc}/level`, `${doc}/level/high`]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
