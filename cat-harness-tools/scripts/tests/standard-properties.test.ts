/**
 * A term that restated a published standard IS that standard's property —
 * in the exporter, in the published vocabulary, and in bootstrap's own graph.
 *
 * Owner, 2026-09-30 (bean `xsqm`): "emphasize preexisting standards … now
 * align". The mechanism is one field, `replacedBy` in `schemas/content/vocabulary.ts`;
 * these tests are what make it one source rather than three copies.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { exportGraph } from "@litlfred/bootstrap-tools/scripts/export-graph.ts";
import { propertyIri, replacementIri, termIri } from "../../schemas/kg/namespaces.ts";
import { PROPERTY_GLOSSES } from "../../schemas/content/vocabulary.ts";
import { buildContext } from "../kg-export.ts";
import { buildVocabulary } from "../ns-export.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const replaced = Object.entries(PROPERTY_GLOSSES).filter(([, g]) => g.replacedBy !== undefined);
const ctxIri = (ctx: Record<string, unknown>, key: string): string | undefined => {
  const v = ctx[key];
  return typeof v === "string" ? v : (v as { "@id"?: string } | undefined)?.["@id"];
};

describe("a term that restates a standard is the standard's property", () => {
  test("there are replaced terms at all — an empty set must not pass", () => {
    expect(replaced.length).toBeGreaterThan(0);
  });

  test("every replacement resolves to an absolute IRI outside this platform's namespaces", () => {
    for (const [name] of replaced) {
      const iri = replacementIri(name)!;
      expect(iri).toMatch(/^https?:\/\//);
      expect(iri).not.toBe(termIri(name));
    }
  });

  test("kg-export writes each replaced key as its replacement, never the retired term", () => {
    const ctx = buildContext();
    for (const [name] of replaced) {
      if (!(name in ctx)) continue;
      expect(ctxIri(ctx, name)).toBe(replacementIri(name));
      expect(ctxIri(ctx, name)).not.toBe(termIri(name));
    }
    // And the reverse: no key of the context names a retired IRI.
    const retired = new Set(replaced.map(([name]) => termIri(name)));
    for (const key of Object.keys(ctx)) expect(retired.has(String(ctxIri(ctx, key)))).toBe(false);
  });

  test("a term never replaced is still minted here", () => {
    expect(propertyIri("performedBy")).toBe(termIri("performedBy"));
  });

  test("the published vocabulary keeps each retired term, deprecated, saying what replaced it", () => {
    const graph = (buildVocabulary().doc as { "@graph": Record<string, unknown>[] })["@graph"];
    const byName = new Map(graph.map((n) => [String(n["@id"]).split(":").pop()!, n]));
    for (const [name] of replaced) {
      const node = byName.get(name);
      expect(node).toBeDefined();
      expect(node!["deprecated"]).toBe(true);
      expect(node!["isReplacedBy"]).toBe(replacementIri(name));
    }
    expect(graph.filter((n) => n["deprecated"] === true).length).toBe(replaced.length);
  });

  test("kg-export and bootstrap's own graph name one relation with one IRI", () => {
    const ours = buildContext();
    const theirs = exportGraph(join(dirname(HARNESS_ROOT), "bootstrap"), {
      docIri: "https://example.test/bootstrap/bootstrap.jsonld",
    })["@context"] as Record<string, unknown>;
    const expand = (v: string | undefined, ctx: Record<string, unknown>) => {
      const m = v && /^([a-z]+):(.+)$/.exec(v);
      return m && typeof ctx[m[1]!] === "string" && !v!.includes("//") ? `${ctx[m[1]!] as string}${m[2]}` : v;
    };
    const pairs: [string, string][] = [
      ["from", "sourceRef"],
      ["to", "targetRef"],
      ["partOf", "isPartOf"],
      ["holdsGraph", "type"],
      // Task → Skill: `requires` on both sides, `dcterms:requires` (owner,
      // 2026-10-16; was `implementedBy` here and `skill` there).
      ["requires", "requires"],
      ["title", "title"],
      ["description", "description"],
    ];
    for (const [k, b] of pairs) expect(expand(ctxIri(ours, k), ours)).toBe(expand(ctxIri(theirs, b), theirs));
    expect(replacementIri("requires")).toBe("http://purl.org/dc/terms/requires");
  });
});
