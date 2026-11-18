/**
 * Issue #1164 — the bootstrap `Requirement`, what builds on it, and the two
 * checks that hold it: `check:requirements` and `check:bootstrap-concepts`.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv from "ajv";

import {
  RequirementRefSchema,
  RequirementSchema,
  requirementRef,
} from "@litlfred/bootstrap-tools/schemas/requirement.ts";
import { RequirementSchema as HarnessRequirementSchema } from "../../schemas/kg/skill-package.ts";
import { TestRunSchema } from "../../schemas/sdlc/test-run.ts";
import { checkRequirementPage, collisions, declaredDirFor, statementsWithoutCriteria } from "../check-requirements.ts";
import { bootstrapSchemaDirs, bootstrapSchemaSources, scan } from "@litlfred/bootstrap-tools/scripts/check-bootstrap-concepts.ts";

const REPO = join(import.meta.dir, "..", "..", "..");

const base = {
  id: "req:glass-navigation",
  title: "Getting around the glass",
  description: "A reader can zoom, pan and return home on the folio glass.",
  actors: ["reader"],
  statements: [
    {
      key: "zoom",
      label: "Zoom by slider and by pinch",
      conformance: "SHALL",
      requirement: "The glass SHALL zoom by a slider and by a two-finger pinch.",
      kind: "functional",
      activity: "arranging the folio",
      capability: "zoom the glass in and out",
      benefit: "I can see everything or read one card",
    },
    {
      key: "no-drag-only",
      label: "Nothing needs dragging",
      conformance: "SHALL",
      requirement: "Every drag SHALL have a pressing alternative.",
      kind: "non-functional",
      category: "accessibility",
    },
  ],
};

describe("the bootstrap Requirement", () => {
  test("a functional and a non-functional statement, together", () => {
    expect(RequirementSchema.safeParse(base).success).toBe(true);
  });

  test("a KIND is a promise about the fields — a non-functional statement cannot want", () => {
    const bad = structuredClone(base);
    (bad.statements[1] as Record<string, unknown>).capability = "go faster";
    const r = RequirementSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("capability");
  });

  test("…and a functional one has no quality category", () => {
    const bad = structuredClone(base);
    (bad.statements[0] as Record<string, unknown>).category = "performance";
    expect(RequirementSchema.safeParse(bad).success).toBe(false);
  });

  test("a statement key is its address, so it appears once", () => {
    const bad = structuredClone(base);
    bad.statements[1].key = "zoom";
    expect(RequirementSchema.safeParse(bad).success).toBe(false);
  });

  test("superseded names what superseded it", () => {
    expect(RequirementSchema.safeParse({ ...base, status: "superseded" }).success).toBe(false);
    expect(RequirementSchema.safeParse({ ...base, status: "superseded", supersededBy: "req:x" }).success).toBe(true);
  });

  test("an id is `req:<slug>`", () => {
    expect(RequirementSchema.safeParse({ ...base, id: "Glass Navigation" }).success).toBe(false);
  });

  test("a statement MAY carry success criteria (issue #2405 — optional until migrated)", () => {
    const withSc = structuredClone(base) as Record<string, unknown> & typeof base;
    (withSc.statements[0] as Record<string, unknown>).successCriteria = [
      { key: "pinch", criterion: "A two-finger pinch on the glass changes its zoom.", verification: "test" },
    ];
    expect(RequirementSchema.safeParse(withSc).success).toBe(true);
    expect(RequirementSchema.safeParse(base).success).toBe(true); // still optional
  });

  test("…and when it does: at least one, a known verification method, keys unique", () => {
    const sc = (v: unknown) => {
      const b = structuredClone(base);
      (b.statements[0] as Record<string, unknown>).successCriteria = v;
      return RequirementSchema.safeParse(b).success;
    };
    expect(sc([])).toBe(false);
    expect(sc([{ key: "a", criterion: "x", verification: "vibes" }])).toBe(false);
    expect(sc([{ key: "a", criterion: "x", verification: "review" }, { key: "a", criterion: "y", verification: "test" }])).toBe(false);
    expect(sc([{ key: "a", criterion: "x", verification: "review" }, { key: "b", criterion: "y", verification: "analysis" }])).toBe(true);
  });

  test("a reference may name one success criterion of a statement", () => {
    expect(requirementRef("req:glass-navigation", "zoom", "pinch")).toBe("req:glass-navigation#zoom/pinch");
    expect(RequirementRefSchema.safeParse("req:glass-navigation#zoom/pinch").success).toBe(true);
    expect(RequirementRefSchema.safeParse("req:glass-navigation/pinch").success).toBe(false);
    expect(RequirementRefSchema.safeParse("req:glass-navigation#zoom/").success).toBe(false);
  });

  test("a reference names a requirement, or one statement in it", () => {
    expect(requirementRef("req:glass-navigation", "zoom")).toBe("req:glass-navigation#zoom");
    expect(RequirementRefSchema.safeParse("req:glass-navigation").success).toBe(true);
    expect(RequirementRefSchema.safeParse("req:glass-navigation#zoom").success).toBe(true);
    expect(RequirementRefSchema.safeParse("glass-navigation#zoom").success).toBe(false);
  });
});

describe("the PUBLISHED schema refuses what the Zod refuses (FR-7: bootstrap holds only the JSON)", () => {
  const published = JSON.parse(readFileSync(join(REPO, "bootstrap", "schemas", "requirement.schema.json"), "utf8"));
  const validate = new Ajv({ allErrors: true }).compile(published);
  test("a valid requirement passes", () => {
    expect(validate(base)).toBe(true);
  });
  test("success criteria: optional, but never empty and never an unknown method", () => {
    const sc = (v: unknown) => {
      const b = structuredClone(base);
      (b.statements[0] as Record<string, unknown>).successCriteria = v;
      return validate(b);
    };
    expect(sc([{ key: "pinch", criterion: "A pinch zooms.", verification: "test" }])).toBe(true);
    expect(sc([])).toBe(false);
    expect(sc([{ key: "pinch", criterion: "A pinch zooms.", verification: "vibes" }])).toBe(false);
    expect(sc([{ key: "pinch", verification: "test" }])).toBe(false);
  });
  test("a non-functional statement cannot want", () => {
    const bad = structuredClone(base);
    (bad.statements[1] as Record<string, unknown>).capability = "go faster";
    expect(validate(bad)).toBe(false);
  });
  test("a functional statement has no quality category", () => {
    const bad = structuredClone(base);
    (bad.statements[0] as Record<string, unknown>).category = "performance";
    expect(validate(bad)).toBe(false);
  });
  test("superseded names what superseded it", () => {
    expect(validate({ ...base, status: "superseded" })).toBe(false);
    expect(validate({ ...base, status: "superseded", supersededBy: "req:x" })).toBe(true);
  });
});

describe("the harness's Requirement is built on it", () => {
  test("every existing requirement file still parses — building on the base moved nothing", () => {
    const dir = join(REPO, "cat-harness", "skills", "requirements");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const r = HarnessRequirementSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
      expect(r.success ? "ok" : `${f}: ${JSON.stringify(r.error?.issues)}`).toBe("ok");
    }
  });

  test("the base's rules survive the narrowing", () => {
    const bad = structuredClone(base);
    (bad.statements[1] as Record<string, unknown>).capability = "go faster";
    expect(HarnessRequirementSchema.safeParse(bad).success).toBe(false);
  });
});

describe("a test run lists the requirements it checks", () => {
  const run = {
    $schema: "folio-test-run/v1",
    skill: "content-test",
    subject: "glass navigation",
    data: { hash: "abc123def456", inputs: ["a.json"] },
    process: { hash: "123abc456def", inputs: ["b.ts"] },
    outcome: { passed: 22 },
    updated_at: "2026-09-23T00:00:00Z",
  };
  test("as references", () => {
    expect(TestRunSchema.safeParse({ ...run, requirements: ["req:glass-navigation#zoom"] }).success).toBe(true);
  });
  test("never as free text", () => {
    expect(TestRunSchema.safeParse({ ...run, requirements: ["the zoom works"] }).success).toBe(false);
  });
  test("a run recorded before the field existed still parses", () => {
    expect(TestRunSchema.safeParse(run).success).toBe(true);
  });
});

describe("check:requirements", () => {
  const page = (fm: string) => `---\n${fm}\n---\n\n# Body\n`;
  const valid = [
    "title: Getting around the glass",
    "layout: default",
    "id: req:glass-navigation",
    "description: A reader can zoom.",
    "actors: [reader]",
    "statements:",
    "  - key: zoom",
    "    label: Zoom",
    "    conformance: SHALL",
    "    requirement: The glass SHALL zoom.",
  ].join("\n");

  test("a valid page passes, its layout keys ignored", () => {
    expect(checkRequirementPage("glass-navigation.md", page(valid))).toEqual([]);
  });
  test("the id is the file name", () => {
    const p = checkRequirementPage("other-name.md", page(valid));
    expect(p.map((x) => x.message).join()).toContain("req:other-name");
  });
  test("a statement without success criteria is WARNED, not failed (#2405 decision 3)", () => {
    expect(checkRequirementPage("glass-navigation.md", page(valid))).toEqual([]);
    expect(statementsWithoutCriteria(base)).toEqual(["req:glass-navigation#zoom", "req:glass-navigation#no-drag-only"]);
    const b = structuredClone(base);
    for (const s of b.statements) (s as Record<string, unknown>).successCriteria = [{ key: "a", criterion: "x", verification: "review" }];
    expect(statementsWithoutCriteria(b)).toEqual([]);
  });
  test("no front matter is no requirement", () => {
    expect(checkRequirementPage("x.md", "# nothing")).toHaveLength(1);
  });
  test("a slug in both sub-graphs is a collision", () => {
    expect(collisions(["a", "b", "c"], ["c", "d"])).toEqual(["c"]);
    expect(collisions(["a"], ["b"])).toEqual([]);
  });
  test("both sub-graphs are declared, from within docs/, and exist", () => {
    const inst = join(REPO, "cat-harness");
    // Declared FROM WITHIN `docs/` (`docs/docs.json`), not by the root.
    expect(declaredDirFor(inst, "requirements")).toEndWith("docs/requirements/");
    expect(declaredDirFor(inst, "proposals")).toEndWith("docs/proposals/");
  });
});

describe("check:bootstrap-concepts", () => {
  test("names outside concepts, and leaves plain English alone", () => {
    const found = scan([{ path: "x.ts", text: "who is asking\nthe WHO model\na smart-base term\nFHIR here\nsmart choice" }]);
    expect(found.map((f) => f.term)).toEqual(["WHO", "smart-base", "FHIR"]);
  });
  test("reads the declared schema directories — never an empty list", () => {
    expect(bootstrapSchemaDirs(REPO).length).toBeGreaterThan(0);
  });
  test("…and the Zod sources they are generated from, not the generator's helpers", () => {
    const names = bootstrapSchemaSources(REPO).map((p) => p.split("/").pop());
    expect(names).toContain("requirement.ts");
    expect(names).not.toContain("cat-harness.ts");
  });
});
