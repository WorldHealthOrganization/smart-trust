/**
 * The changed-assets list a staging preview's graph carries (owner,
 * 2026-10-14): matching across the two bases, the three states, and pages
 * from the renderer's answer rather than from a guessed URL.
 */
import { describe, expect, test } from "bun:test";

import { PROPERTY_GLOSSES } from "../../../schemas/content/vocabulary.js";
import type { RenderedImpact } from "../../../schemas/ui/rendered-impact.ts";
import { buildContext } from "../../kg-export.ts";
import {
  basesOf,
  CHANGED_ASSETS_FIELDS,
  changedAssets,
  changedAssetsFields,
  diffGraphs,
  readMain,
  undeclaredFields,
  type GraphDoc,
} from "../../kg-changed-assets.ts";

const MAIN = "https://o.github.io/r";
const STAGING = "https://o.github.io/r/STAGING/b";
const DOC = "h.jsonld";
const b = { staging: STAGING, main: MAIN };

const mainDoc = (graph: Record<string, unknown>[]): GraphDoc => ({ "@id": `${MAIN}/${DOC}`, "@graph": graph });
const previewDoc = (graph: Record<string, unknown>[]): GraphDoc => ({
  "@id": `${STAGING}/${DOC}`,
  canonicalDocument: `${MAIN}/${DOC}`,
  "@context": buildContext(),
  // What kg-export writes on a preview node: its own base, plus `alternateOf`.
  "@graph": graph.map((n) => {
    const s = JSON.parse(JSON.stringify(n).split(`${MAIN}/`).join(`${STAGING}/`));
    return { ...s, alternateOf: n["@id"] };
  }),
});

const skill = (id: string, extra: Record<string, unknown> = {}) => ({
  "@id": `${MAIN}/${DOC}#skill/${id}`,
  "@type": "https://x/ns#Skill",
  title: id,
  inPackage: [`${MAIN}/${DOC}#package/p`],
  instructionsPath: `skills/${id}.md`,
  ...extra,
});

/** A renderer that maps `docs/<x>.md` to `<x>.html` and leaves `skills/` to the cone. */
const render = (files: string[]): RenderedImpact => ({
  $schema: "rendered-impact/v1",
  renderer: "docs-site",
  method: "cone",
  inputs: files,
  files: files
    .filter((f) => f.startsWith("docs/"))
    .map((f) => ({ path: f.slice(5).replace(/\.md$/, ".html"), change: "changed" as const, role: "content" as const, via: [f] })),
  undetermined: files.filter((f) => f.startsWith("cat-harness/skills/")).map((f) => ({ input: f, reason: "the staging cone carries cat-harness/skills", scope: "unknown" as const })),
});
const opts = { repoPath: (p: string) => (p.startsWith("docs/") ? p : `cat-harness/${p}`), render };

describe("basesOf", () => {
  test("reads both bases off the document", () => {
    expect(basesOf(previewDoc([]), DOC)).toEqual(b);
  });
  test("a canonical document is not a preview", () => {
    expect(typeof basesOf({ ...mainDoc([]), canonicalDocument: `${MAIN}/${DOC}` }, DOC)).toBe("string");
    expect(typeof basesOf(mainDoc([]), DOC)).toBe("string");
  });
});

describe("diffGraphs", () => {
  test("the same graph minted under the staging base is no change", () => {
    const g = [skill("a"), skill("b")];
    expect(diffGraphs(previewDoc(g), mainDoc(g), b)).toEqual([]);
  });
  test("key order is not a change", () => {
    const { title, ...rest } = skill("a");
    expect(diffGraphs(previewDoc([{ ...rest, title }]), mainDoc([skill("a")]), b)).toEqual([]);
  });
  test("added, changed and removed, in @id order", () => {
    const out = diffGraphs(
      previewDoc([skill("a", { description: "new words" }), skill("c")]),
      mainDoc([skill("a"), skill("b")]),
      b,
    );
    expect(out.map((c) => [c.change, c.id.split("#")[1]])).toEqual([
      ["changed", "skill/a"],
      ["removed", "skill/b"],
      ["added", "skill/c"],
    ]);
  });
  test("a link that moved is a change, though both sides are rebased", () => {
    const out = diffGraphs(previewDoc([skill("a", { inPackage: [`${MAIN}/${DOC}#package/q`] })]), mainDoc([skill("a")]), b);
    expect(out.map((c) => c.change)).toEqual(["changed"]);
  });
});

describe("changedAssets", () => {
  const assets = changedAssets(
    diffGraphs(
      previewDoc([skill("a", { description: "x" }), { "@id": `${MAIN}/${DOC}#page/p`, "@type": "https://x/ns#Page", sourcePath: "docs/p.md", title: "P" }]),
      mainDoc([skill("a"), { "@id": `${MAIN}/${DOC}#page/q`, "@type": "https://x/ns#Page", sourcePath: "docs/q.md", name: "Q" }]),
      b,
    ),
    b,
    opts,
  );
  const by = (frag: string) => assets.find((a) => (a.after ?? a.before)!.endsWith(frag))!;

  test("a node links itself on both sides: its @id in each published document", () => {
    expect(by("#skill/a")).toMatchObject({ change: "changed", kind: "Skill", title: "a", before: `${MAIN}/${DOC}#skill/a`, after: `${STAGING}/${DOC}#skill/a` });
  });
  test("a source the renderer cannot map says so, never an empty page list", () => {
    expect(by("#skill/a").pages).toBeUndefined();
    expect(by("#skill/a").pagesUnknown).toContain("staging cone");
    expect(by("#skill/a").source).toBe("cat-harness/skills/a.md");
  });
  test("an added node's page has no before; a removed node's has no after", () => {
    expect(by("#page/p")).toMatchObject({ change: "added", source: "docs/p.md", pages: [{ title: "p.html", after: `${STAGING}/p.html` }] });
    expect(by("#page/p").before).toBeUndefined();
    expect(by("#page/q")).toMatchObject({ change: "removed", title: "Q", pages: [{ title: "q.html", before: `${MAIN}/q.html` }] });
    expect(by("#page/q").after).toBeUndefined();
  });
});

describe("the third state", () => {
  test("no main site, a missing document, or the wrong document is unavailable — never an empty list", () => {
    expect(readMain(undefined, DOC, `${MAIN}/${DOC}`)).toContain("no published main site");
    expect(readMain("/nonexistent-main-site", DOC, `${MAIN}/${DOC}`)).toContain("could not be read");
    const f = changedAssetsFields(previewDoc([skill("a")]), "main's site has no h.jsonld", b, opts);
    expect(f).toEqual({ changedAssetsUnavailable: "main's site has no h.jsonld" });
    expect("changedAssets" in f).toBe(false);
  });
  test("compared and equal is an empty list beside what it was compared with", () => {
    expect(changedAssetsFields(previewDoc([skill("a")]), mainDoc([skill("a")]), b, opts)).toEqual({
      changedAssetsComparedWith: `${MAIN}/${DOC}`,
      changedAssets: [],
    });
  });
});

describe("declared, so a JSON-LD processor keeps it", () => {
  test("the export's @context declares every field this script writes", () => {
    expect(undeclaredFields(previewDoc([]))).toEqual([]);
    expect(undeclaredFields({ ...previewDoc([]), "@context": {} })).toEqual([...CHANGED_ASSETS_FIELDS]);
  });
  test("every term it mints is glossed in the vocabulary (ns:check)", () => {
    type Term = string | { "@id": string };
    const ctx = buildContext() as unknown as {
      changedAssets: { "@id": string; "@context": Record<string, Term> };
      changedAssetsComparedWith: { "@id": string };
      changedAssetsUnavailable: string;
    };
    const iris: string[] = [
      ctx.changedAssets["@id"],
      ctx.changedAssetsComparedWith["@id"],
      ctx.changedAssetsUnavailable,
      ...Object.values(ctx.changedAssets["@context"]).map((v) => (typeof v === "string" ? v : v["@id"])),
    ];
    for (const iri of iris) expect(Object.keys(PROPERTY_GLOSSES)).toContain(iri.split(/[#/]/).pop()!);
  });
});
