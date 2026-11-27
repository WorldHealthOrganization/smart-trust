/**
 * No published graph mentions `fsh-guts`.
 *
 * Owner, 2026-09-19: *"NEVER include fsh-guts, references to fsh-guts
 * stripped out of KG before sending to publication."*
 *
 * Bean `folio-assistant-uv09`. This is a CORRECTION to work shipped earlier
 * the same day: `fsh-guts/` was kept out of the render pipeline and tested
 * (`fsh-guts-not-rendered.test.ts`), which is a different property from
 * keeping it out of the GRAPH. A layer's declared directories become
 * nodes in `<stub>.jsonld`, so declaring the trashcan locally — required, or
 * no tool can find it — put its id, path and description into the published
 * document.
 *
 * **Not a contradiction of `<base>/fsh-guts.jsonld`.** That document IS the
 * trashcan's graph and is asked for by name. Every OTHER published artefact
 * must carry no path to it: a consumer may go there deliberately and must
 * never arrive by following an edge.
 *
 * @module scripts/tests/fsh-guts-unpublished.test
 */
import { describe, expect, test } from "bun:test";

import {
  UNPUBLISHED_GRAPH_TYPOLOGIES,
  isPublishedDirectory,
  isPublishedGraphTypology,
  isPublishedSkill,
} from "../../schemas/kg/cat-harness.ts";
import { buildExport } from "../kg-export.js";
import { unpublishedSkills } from "../known-skills.js";

import { resolve } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

const EXPORT = await buildExport();

describe("the exclusion predicates", () => {
  test("fsh-guts is excluded and the ordinary kinds are not", () => {
    expect(UNPUBLISHED_GRAPH_TYPOLOGIES).toContain("fsh-guts");
    expect(isPublishedGraphTypology("fsh-guts")).toBe(false);
    for (const ok of ["cat-harness", "schemas", "beans", "qa", "tools"]) {
      expect(isPublishedGraphTypology(ok)).toBe(true);
    }
  });

  test("a directory is excluded when ANY graph it holds is excluded", () => {
    // `graphs` is an array and `schemas/` already holds two. An "every kind
    // is excluded" test would publish a directory holding both `kg` and
    // `fsh-guts`, naming the trashcan's path on the way past.
    expect(isPublishedDirectory({ graphTypologies: ["fsh-guts"] })).toBe(false);
    expect(isPublishedDirectory({ graphTypologies: ["cat-harness", "fsh-guts"] })).toBe(false);
    expect(isPublishedDirectory({ graphTypologies: ["schemas", "cat-harness"] })).toBe(true);
    // No declared graph is not a reason to drop it.
    expect(isPublishedDirectory({})).toBe(true);
  });
});

describe("the built export", () => {
  test("contains no `fsh-guts` anywhere, at any depth", () => {
    // Serialised rather than walked: a structural check has to know every
    // field that could carry the string — @id, path, name, holdsGraph,
    // description, a summary quoting it — and the one it forgets is the one
    // that leaks. The substring is the whole assertion.
    const serialised = JSON.stringify(EXPORT);
    expect(serialised).not.toContain("fsh-guts");
  });

  test("the export is not empty, so the check above is not vacuous", () => {
    // Without this, a buildExport that returned nothing would pass the
    // assertion above and read as proof. Same shape as `pzdv`.
    const serialised = JSON.stringify(EXPORT);
    expect(serialised.length).toBeGreaterThan(10_000);
    expect(serialised).toContain("cat-harness");
  });

  test("no individual node names it, and the node list is real", () => {
    // The key is `@graph`, NOT `graph`. The first version of this test read
    // `.graph`, got `undefined`, filtered an empty array and passed — a test
    // that could not fail, over a graph that was leaking two nodes at the
    // time. Hence the length assertion: the list must be real before the
    // filter over it means anything.
    const nodes = (EXPORT as unknown as { "@graph"?: unknown[] })["@graph"] ?? [];
    expect(nodes.length).toBeGreaterThan(100);
    const named = nodes.filter((n) => JSON.stringify(n).includes("fsh-guts"));
    expect(named).toEqual([]);
  });

  test("the skill documenting the trashcan is excluded, and ordinary skills are not", () => {
    // The SECOND leak, found only because the substring sweep kept failing
    // after the graph-typology and directory emitters were filtered:
    // `skill/fsh-guts` plus the `declaresSkill` edge from
    // `package/folio-core`. An edge to a stripped node is a dangling
    // reference that still spells the name it was meant to remove.
    expect(isPublishedSkill("fsh-guts")).toBe(false);
    expect(isPublishedSkill("where-a-proposal-goes")).toBe(true);
    expect(isPublishedSkill("prepare-merge")).toBe(true);
  });
});

/**
 * The DECLARED half of the strip.
 *
 * `isPublishedSkill` matched a skill's NAME against `UNPUBLISHED_GRAPH_TYPOLOGIES`,
 * and its own note said where that stops: *"Same list, because the skill and
 * the kind share a name by construction. If that ever stops being true this
 * needs its own list, not a cleverer derivation."*
 *
 * The owner asked for that list on 2026-09-20, as a declaration rather than
 * a list in code — the same "a directory is a place to look and the file says
 * what it is" rule as `isSkillMd`, bean front matter and a workflow
 * instance's `$schema`. A skill that must not be published says so.
 *
 * These pin the INPUT. The blanket test above pins the outcome over the built
 * document, which is what makes the mechanism safe to change at all — but an
 * outcome test cannot tell you WHY it passed, so if the declaration silently
 * vanished the name rule would carry it and nobody would learn that the
 * declared half had stopped working.
 */
describe("the declaration, not just the name", () => {
  test("`fsh-guts` declares `published: false` in its own front matter", () => {
    expect([...unpublishedSkills(ROOT)]).toContain("fsh-guts");
  });

  test("the declaration is what excludes it, independently of the name rule", () => {
    // Both inputs must say no. If someone removes `published: false`, this
    // fails even though the export stays clean — which is the point: the
    // outcome test would go on passing and hide the regression.
    expect(unpublishedSkills(ROOT).has("fsh-guts")).toBe(true);
    expect(isPublishedSkill("fsh-guts")).toBe(false);
  });

  test("an ordinary skill is neither declared nor name-matched", () => {
    // Vacuity: a predicate that excluded everything would pass the two above.
    const declared = unpublishedSkills(ROOT);
    for (const ok of ["todo-manager", "opening-brief", "directory-conventions"]) {
      expect(declared.has(ok), `${ok} is wrongly declared unpublished`).toBe(false);
      expect(isPublishedSkill(ok)).toBe(true);
    }
    // And the declared set is SMALL — a scan that started matching everything
    // would strip the corpus while every assertion above still passed.
    expect(declared.size).toBeLessThan(5);
  });
});
