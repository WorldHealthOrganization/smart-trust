/**
 * The thin IG artefact pages and the JSON-LD node each one renders (owner,
 * 2026-10-11, option A: "tiny html w/ dynamic load from json(ld) KG").
 *
 * Over a non-WHO IG (`ig-fixture.ts`): the node's shape and vocabulary, the
 * kind's QA check failing on each defect it names, and `gen-ig-pages` writing
 * real files into a scratch repository — thin by default (owner, 2026-10-12),
 * beside a `--full-pages` run that must keep the old path. Then the IG's own
 * `artifacts` and `toc` pages as thin shells over the one index node.
 *
 * Calibrated: each `checkArtifactJsonLd` case below breaks one thing in a site
 * that passes, and asserts the finding names it.
 *
 * @module fhir-harness/scripts/ig-thin-pages.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { FhirArtifactIndexSchema, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG, IG_ARTIFACT_JSONLD_SCHEMA_TAG, IgArtifactIndexJsonLdSchema, IgArtifactJsonLdSchema } from "../schemas/ig-artifact-jsonld.js";
import { IPS, artifactIndex, scratchRepo } from "../test/support/ig-fixture";
import { artifactIndexJsonLd, artifactJsonLd, artifactJsonLdFiles, checkArtifactJsonLd } from "./ig-artifact-jsonld.ts";
import { THIN_INDEX_CONFIG_ID, THIN_PAGE_CONFIG_ID, isArtifactPage, thinArtifactPage, thinIndexPage } from "./ig-thin-pages.ts";
import { pageNodeOf, pageNodeProblems, thinPageConfigOf } from "../../cat-harness-tools/scripts/thin-page.ts";
import { composeIgSite, stageIgSite } from "./build-ig-site";
import { artifactsFor } from "./stage-ig-sites";

/** A `data-kg-<name>` on the page's node element, unescaped. */
function kgData(html: string, name: string): string | undefined {
  const m = new RegExp(`<main[^>]*\\sdata-kg-${name}="([^"]*)"`).exec(html);
  return m?.[1]?.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** A parsed JSON-LD node, mutated in place by the rewrite helpers below. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- arbitrary JSON-LD, indexed freely by each case
type Json = Record<string, any>;

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "fhir-harness/scripts/gen-ig-pages.ts");
const RESOURCE = "output-ast/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json";

/** IPS's index with its one profile made a compiled copy, and a second, referenced one. */
function compiledIndex(id: string): Record<string, unknown> {
  const ix = artifactIndex(IPS, id) as { artifacts: Record<string, unknown>[]; count: number };
  const [composition] = ix.artifacts;
  const page = `${IPS.published}/StructureDefinition-Patient-uv-ips`;
  ix.artifacts.push({
    ...composition,
    key: "StructureDefinition/Patient-uv-ips",
    id: "Patient-uv-ips",
    published: { json: { url: `${page}.json` }, html: { url: `${page}.html` } },
    materialization: { state: "referenced", provenance: { upstream: `${page}.html` } },
    canonical: `${IPS.canonical}/StructureDefinition/Patient-uv-ips`,
    name: "PatientUvIps",
    title: "Patient (IPS)",
  });
  ix.count = ix.artifacts.length;
  composition.materialization = {
    state: "materialized",
    provenance: { upstream: `${IPS.published}/StructureDefinition-Composition-uv-ips.html`, local: "x.json" },
    localPath: RESOURCE,
    gates: Object.fromEntries(["size", "restrictions", "retention", "sourceLoss", "copyright"].map((g) => [g, { verdict: "unknown", basis: "test" }])),
    purpose: "compiled",
    inputs: { toolchain: "ig-publisher test", sourceRevision: "a".repeat(40) },
  };
  return ix;
}

const IX: FhirArtifactIndex = FhirArtifactIndexSchema.parse(compiledIndex("ips"));
const [COMPOSITION, PATIENT] = IX.artifacts as [FhirArtifactIndex["artifacts"][0], FhirArtifactIndex["artifacts"][0]];

describe("ig-artifact-jsonld: one node per artefact, in borrowed vocabularies", () => {
  it("compiledNodeShape", () => {
    const n = artifactJsonLd(IX, COMPOSITION, { compiledData: "ast-data" });
    expect(IgArtifactJsonLdSchema.safeParse(n).success).toBe(true);
    expect(n.$schema).toBe(IG_ARTIFACT_JSONLD_SCHEMA_TAG);
    expect(n["@type"]).toBe("fhir:StructureDefinition");
    expect(n["@context"].fhir).toBe("http://hl7.org/fhir/");
    expect(n["dcterms:identifier"]).toBe("StructureDefinition/Composition-uv-ips");
    expect(n["schema:sameAs"]).toEqual({ "@id": `${IPS.canonical}/StructureDefinition/Composition-uv-ips` });
    // Extensionless kind/id (cat-harness-tools#1830), relative to the node's own
    // file: its JSON-LD is the IRI plus `.jsonld`, its page the IRI plus `.html`.
    expect(n["@id"]).toBe("StructureDefinition-Composition-uv-ips");
    const local = n["schema:encoding"].filter((e) => e["dcterms:source"] === "local");
    expect(local.map((e) => e["schema:contentUrl"]["@id"])).toEqual(["../ast-data/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json"]);
    expect(n["prov:wasGeneratedBy"]).toEqual({ "@type": "prov:Activity", "schema:instrument": "ig-publisher test", "prov:used": "a".repeat(40) });
    expect(n["dcterms:isPartOf"]["dcterms:identifier"]).toBe(IPS.packageId);
  });

  it("baseMakesIrisAbsolute", () => {
    const n = artifactJsonLd(IX, COMPOSITION, { base: "https://example.org/ig/", compiledData: "ast-data" });
    expect(n["@id"]).toBe("https://example.org/ig/artifact/StructureDefinition-Composition-uv-ips");
    expect(n["schema:encoding"][0]!["schema:contentUrl"]["@id"]).toBe("https://example.org/ig/ast-data/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json");
  });

  it("referencedNodeUpstreamOnly", () => {
    const n = artifactJsonLd(IX, PATIENT, { compiledData: "ast-data" });
    expect(n["schema:creativeWorkStatus"]).toBe("referenced");
    expect(n["schema:encoding"].every((e) => e["dcterms:source"] === "upstream")).toBe(true);
    expect(n["prov:wasGeneratedBy"]).toBeUndefined();
    expect(JSON.stringify(n)).not.toContain(".html");
  });

  it("refusesTypeKeyMismatch", () => {
    const n = { ...artifactJsonLd(IX, COMPOSITION), "@type": "fhir:ValueSet" };
    expect(IgArtifactJsonLdSchema.safeParse(n).success).toBe(false);
  });

  it("nodeNamesNoOverlay", () => {
    const text = [...artifactJsonLdFiles(IX).values()].join("\n");
    expect(text).not.toMatch(/who\.int|smart-base|\bDAK\b/i);
  });
});

/** A built docs root: the nodes, and the resource where the node says it is served. */
function builtSite(ix: FhirArtifactIndex = IX): string {
  const root = mkdtempSync(join(tmpdir(), "fhir-harness-thin-"));
  for (const [rel, text] of artifactJsonLdFiles(ix, { compiledData: "ast-data" })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  const res = join(root, "ast-data", RESOURCE.replace(/^[^/]+\//, ""));
  mkdirSync(dirname(res), { recursive: true });
  writeFileSync(res, "{}");
  return root;
}

describe("ig-artifact-jsonld check: the kind's QA, beyond shape", () => {
  const sites: string[] = [];
  const site = () => {
    const s = builtSite();
    sites.push(s);
    return s;
  };
  afterAll(() => sites.forEach((s) => rmSync(s, { recursive: true, force: true })));
  const node = (s: string, a = COMPOSITION) => join(s, "artifact", `${a.resourceType}-${a.id}.jsonld`);

  it("checkPassesOnWritten", () => {
    expect(checkArtifactJsonLd(IX, site())).toEqual([]);
  });
  it("checkFailsMissingNode", () => {
    const s = site();
    unlinkSync(node(s, PATIENT));
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("StructureDefinition/Patient-uv-ips has no node");
  });
  it("checkFailsOrphan", () => {
    const s = site();
    cpSync(node(s), join(s, "artifact", "ValueSet-gone.jsonld"));
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("ValueSet-gone.jsonld: an orphan");
  });
  it("checkFailsCopiedNode", () => {
    const s = site();
    cpSync(node(s, PATIENT), node(s));
    expect(checkArtifactJsonLd(IX, s).join("\n")).toMatch(/names StructureDefinition\/Patient-uv-ips, but the file is StructureDefinition\/Composition-uv-ips's/);
  });
  it("checkFailsJsonTwinServed", () => {
    const s = site();
    expect(existsSync(node(s).replace(/\.jsonld$/, ".json"))).toBe(false);
    cpSync(node(s), node(s).replace(/\.jsonld$/, ".json"));
    cpSync(join(s, "artifact", "index.jsonld"), join(s, "artifact", "index.json"));
    const out = checkArtifactJsonLd(IX, s).join("\n");
    expect(out).toContain("StructureDefinition-Composition-uv-ips.jsonld: a .json twin is served beside it");
    expect(out).toContain("artifact/index.jsonld: a .json twin is served beside it");
  });
  it("checkFailsResourceMissing", () => {
    const s = site();
    rmSync(join(s, "ast-data"), { recursive: true });
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("is not on the site");
  });
  it("checkFailsNothingWritten", () => {
    const s = mkdtempSync(join(tmpdir(), "fhir-harness-thin-empty-"));
    sites.push(s);
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("that is not a pass");
  });
});

describe("thinArtifactPage: identity and a pointer, nothing of the artefact's content", () => {
  const html = thinArtifactPage(IX, COMPOSITION, { label: "IPS", home: "../index.html", all: "../artifacts.html", prev: "../", next: "StructureDefinition-Patient-uv-ips.html", compiledData: "ast-data" });

  it("pageNamesSelfAndNode", () => {
    expect(html).toContain('<link rel="canonical" href="StructureDefinition-Composition-uv-ips.html">');
    expect(html).toContain('<link rel="alternate" type="application/ld+json" href="StructureDefinition-Composition-uv-ips.jsonld">');
  });
  it("pageLinksRail", () => {
    expect(html).toContain('<meta name="folio-navbar" content="linked">');
    expect(html).not.toContain('class="fa-nav"');
  });
  it("pageDeclaresNodeLoadersOrder", () => {
    // The page declares its node, not a private config block (cat-harness-tools#1830).
    expect(pageNodeProblems(html)).toEqual([]);
    const decl = pageNodeOf(html)!;
    expect(decl.rdfa[0]!.iri).toBe("StructureDefinition-Composition-uv-ips");
    expect(decl.rdfa[0]!.types).toEqual(["http://hl7.org/fhir/StructureDefinition"]);
    expect(isArtifactPage(html)).toBe(true);
    expect(thinPageConfigOf(html, THIN_PAGE_CONFIG_ID)).toBeUndefined();
    expect(html).toContain('<script src="../assets/kg-render.js"></script>');
    expect(html.indexOf("kg-render.js")).toBeLessThan(html.indexOf("ig-artifact.js"));
    expect(kgData(html, "ast-loader")).toBe("../assets/ast-resource.js");
    expect(kgData(html, "prev")).toBe("../");
    expect(kgData(html, "next")).toBe("StructureDefinition-Patient-uv-ips.html");
    expect(kgData(html, "published")).toBe(`${IPS.published}/`);
  });
  it("noscriptLinksNodeAndResource", () => {
    expect(html).toMatch(/<noscript>.*href="StructureDefinition-Composition-uv-ips\.jsonld".*href="\.\.\/ast-data\/resources\/StructureDefinition\/Composition-uv-ips--7ae5e8a1\.json"/s);
  });
  it("pageHoldsNoContent", () => {
    expect(html).not.toContain("A fixture profile.");
    expect(html).not.toContain(`${IPS.canonical}/StructureDefinition`);
  });
  it("pageIsSmall", () => {
    expect(html.length).toBeLessThan(3000);
  });
});

describe("the shared renderer", () => {
  it("rendererParses", () => {
    const src = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
    expect(() => new Function(src)).not.toThrow();
    // It registers with the generic renderer for FHIR classes, and still reads
    // the config block of a page from before the declaration.
    expect(src).toContain('match: FHIR_NS');
    expect(src).toContain(`getElementById("${THIN_PAGE_CONFIG_ID}")`);
  });
});

describe('gen-ig-pages: thin by default, end to end (owner, 2026-10-12: "make thin default")', () => {
  const repo = scratchRepo({ thin: { index: compiledIndex("thin") }, legacy: { index: compiledIndex("legacy") }, fat: { index: compiledIndex("fat") }, both: { index: compiledIndex("both") } });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));
  const spawn = (instance: string, ...args: string[]) =>
    Bun.spawnSync(["bun", "run", SCRIPT, "--instance", join(repo, instance), "--label", "IPS", "--compiled-data", "ast-data", ...args], { cwd: ROOT });
  const run = (instance: string, ...args: string[]) => {
    const r = spawn(instance, ...args);
    if (r.exitCode !== 0) throw new Error(`gen-ig-pages failed for ${instance}:\n${r.stderr.toString()}`);
  };
  run("thin");
  run("legacy", "--thin");
  run("fat", "--full-pages");
  const docs = (i: string) => join(repo, i, "docs");

  it("thinByDefault", () => {
    const art = readdirSync(join(docs("thin"), "artifact")).sort();
    expect(art).toEqual([
      // The compiled profile's tab views (owner, 2026-10-14: "3. Render them
      // too"); the referenced one has no resource here, so no views.
      "StructureDefinition-Composition-uv-ips-definitions.html",
      "StructureDefinition-Composition-uv-ips-examples.html",
      "StructureDefinition-Composition-uv-ips-mappings.html",
      "StructureDefinition-Composition-uv-ips.html",
      "StructureDefinition-Composition-uv-ips.jsonld",
      "StructureDefinition-Composition-uv-ips.profile.json.html",
      "StructureDefinition-Patient-uv-ips.html",
      "StructureDefinition-Patient-uv-ips.jsonld",
      "index.jsonld",
    ]);
    for (const f of ["ig-artifact.js", "kg-render.js", "ig-artifact.css", "ast-resource.js", "ast-pages.json"]) expect(existsSync(join(docs("thin"), "assets", f))).toBe(true);
    const page = readFileSync(join(docs("thin"), "artifact", "StructureDefinition-Composition-uv-ips.html"), "utf8");
    expect(page.startsWith("<!doctype html>")).toBe(true);
    // About 300 B more than before the node declaration (RDFa, its JSON-LD stub, the renderer's script tag).
    expect(page.length).toBeLessThan(3400);
    // The reading order survives: the first artefact's next is the second.
    expect(kgData(page, "next")).toBe("StructureDefinition-Patient-uv-ips.html");
    // The index node is titled after the IG's display name.
    expect(JSON.parse(readFileSync(join(docs("thin"), "artifact", "index.jsonld"), "utf8"))["dcterms:title"]).toBe("IPS");
  });

  it("thinFlagSamePages", () => {
    const list = (i: string) => readdirSync(join(docs(i), "artifact")).sort();
    expect(list("legacy")).toEqual(list("thin"));
  });

  it("nodesPassCheckWhenServed", () => {
    const ix = FhirArtifactIndexSchema.parse(JSON.parse(readFileSync(join(repo, "thin", "fhir-artifact-index", "index.json"), "utf8")));
    const res = join(docs("thin"), "ast-data", RESOURCE.replace(/^[^/]+\//, ""));
    mkdirSync(dirname(res), { recursive: true });
    writeFileSync(res, "{}");
    expect(checkArtifactJsonLd(ix, docs("thin"))).toEqual([]);
  });

  it("fullPagesOldPath", () => {
    const art = readdirSync(join(docs("fat"), "artifact"));
    expect(art.every((f) => f.endsWith(".md"))).toBe(true);
    expect(existsSync(join(docs("fat"), "assets", "ig-artifact.js"))).toBe(false);
  });

  it("thinAndFullRefused", () => {
    const r = spawn("both", "--thin", "--full-pages");
    expect(r.exitCode).toBe(2);
    expect(r.stderr.toString()).toContain("pick one");
  });
});

describe("the index node: every artefact once, each entry naming its node", () => {
  it("indexNodeListsAll", () => {
    const n = artifactIndexJsonLd(IX, { title: "IPS" });
    expect(IgArtifactIndexJsonLdSchema.safeParse(n).success).toBe(true);
    expect(n.$schema).toBe(IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG);
    expect(n["@id"]).toBe("index.jsonld");
    expect(n["schema:numberOfItems"]).toBe(2);
    expect(n["schema:hasPart"].map((e) => e["@id"])).toEqual(["StructureDefinition-Composition-uv-ips", "StructureDefinition-Patient-uv-ips"]);
    expect(n["schema:hasPart"][1]!["dcterms:title"]).toBe("Patient (IPS)");
    // It names nodes, never renderings.
    expect(JSON.stringify(n)).not.toContain(".html");
  });
  it("refusesWrongCount", () => {
    expect(IgArtifactIndexJsonLdSchema.safeParse({ ...artifactIndexJsonLd(IX), "schema:numberOfItems": 3 }).success).toBe(false);
  });
});

describe("ig-artifact-jsonld check over the index node (calibrated: each case breaks one thing)", () => {
  const sites: string[] = [];
  const site = () => {
    const s = builtSite();
    sites.push(s);
    return s;
  };
  afterAll(() => sites.forEach((s) => rmSync(s, { recursive: true, force: true })));
  const indexPath = (s: string) => join(s, "artifact", "index.jsonld");
  const rewrite = (s: string, f: (n: Json) => void) => {
    const n = JSON.parse(readFileSync(indexPath(s), "utf8"));
    f(n);
    const text = `${JSON.stringify(n, null, 2)}\n`;
    writeFileSync(indexPath(s), text);
  };

  it("indexCheckPasses", () => {
    expect(checkArtifactJsonLd(IX, site())).toEqual([]);
  });
  it("indexCheckFailsMissing", () => {
    const s = site();
    unlinkSync(indexPath(s));
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("index.jsonld: missing");
  });
  it("indexCheckFailsOmitted", () => {
    const s = site();
    rewrite(s, (n) => {
      n["schema:hasPart"].pop();
      n["schema:numberOfItems"] = 1;
    });
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("does not list StructureDefinition/Patient-uv-ips");
  });
  it("indexCheckFailsWrongNode", () => {
    const s = site();
    rewrite(s, (n) => {
      n["schema:hasPart"][0]["@id"] = "StructureDefinition-Patient-uv-ips";
    });
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("names a node that is StructureDefinition/Patient-uv-ips");
  });
  it("indexCheckFailsAbsentNode", () => {
    const s = site();
    rewrite(s, (n) => {
      n["schema:hasPart"][0]["@id"] = "StructureDefinition-Gone.jsonld";
    });
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("is not on the site");
  });
  it("indexCheckFailsCount", () => {
    const s = site();
    rewrite(s, (n) => {
      n["schema:numberOfItems"] = 5;
    });
    expect(checkArtifactJsonLd(IX, s).join("\n")).toContain("says 5, lists 2");
  });
});

/**
 * IPS's index plus what a configuration IG holds: an instance (a Basic page)
 * that states only a profile and a code, and the IG's own resource.
 */
function instanceIndex(): FhirArtifactIndex {
  const ix = compiledIndex("cfg") as { artifacts: Record<string, unknown>[]; count: number };
  const ref = (key: string) => ({ state: "referenced", provenance: { upstream: `${IPS.published}/${key.replace("/", "-")}.html` } });
  ix.artifacts.push(
    {
      key: "Basic/page-role",
      resourceType: "Basic",
      id: "page-role",
      title: "page-role",
      category: "Other",
      profiles: [`${IPS.canonical}/StructureDefinition/Patient-uv-ips`, "http://example.org/StructureDefinition/elsewhere|1.0"],
      code: { text: "Page", coding: [{ system: "http://example.org/CodeSystem/kinds", code: "page" }] },
      published: {},
      materialization: ref("Basic/page-role"),
    },
    {
      key: `ImplementationGuide/${IPS.packageId}`,
      resourceType: "ImplementationGuide",
      id: IPS.packageId,
      title: "The IG",
      description: "What the guide is.",
      canonical: `${IPS.canonical}/ImplementationGuide/${IPS.packageId}`,
      profiles: ["http://hl7.org/fhir/StructureDefinition/shareable-ig"],
      published: {},
      materialization: ref("ImplementationGuide/x"),
    },
  );
  ix.count = ix.artifacts.length;
  return FhirArtifactIndexSchema.parse(ix);
}

describe("what an instance states: its profiles and its code, in the node and the index (owner, 2026-10-12)", () => {
  const ix = instanceIndex();
  const basic = ix.artifacts.find((a) => a.key === "Basic/page-role")!;
  it("nodeProfilesAndSubject", () => {
    const n = artifactJsonLd(ix, basic);
    expect(IgArtifactJsonLdSchema.safeParse(n).success).toBe(true);
    expect(n["dcterms:conformsTo"]).toEqual([{ "@id": `${IPS.canonical}/StructureDefinition/Patient-uv-ips` }, { "@id": "http://example.org/StructureDefinition/elsewhere|1.0" }]);
    expect(n["dcterms:subject"]).toEqual([
      // No display in the resource, so no name: nothing is looked up.
      { "@type": "schema:DefinedTerm", "schema:termCode": "page", "schema:inDefinedTermSet": { "@id": "http://example.org/CodeSystem/kinds" } },
      { "@type": "schema:DefinedTerm", "schema:name": "Page" },
    ]);
  });
  it("neitherStatedNeither", () => {
    const n = artifactJsonLd(ix, COMPOSITION);
    expect(n["dcterms:conformsTo"]).toBeUndefined();
    expect(n["dcterms:subject"]).toBeUndefined();
  });
  it("definitionNotByProfile", () => {
    const ig = ix.artifacts.find((a) => a.resourceType === "ImplementationGuide")!;
    expect(ig.profiles).toEqual(["http://hl7.org/fhir/StructureDefinition/shareable-ig"]);
    expect(artifactJsonLd(ix, ig)["dcterms:conformsTo"]).toBeUndefined();
    expect(artifactIndexJsonLd(ix)["schema:hasPart"].find((e) => e["@type"] === "fhir:ImplementationGuide")!["dcterms:conformsTo"]).toBeUndefined();
  });
  it("indexEntryRepeatsStated", () => {
    const n = artifactIndexJsonLd(ix);
    expect(IgArtifactIndexJsonLdSchema.safeParse(n).success).toBe(true);
    const e = n["schema:hasPart"].find((x) => x["dcterms:identifier"] === "Basic/page-role")!;
    expect(e["dcterms:conformsTo"]).toEqual(artifactJsonLd(ix, basic)["dcterms:conformsTo"]);
    expect(e["dcterms:subject"]).toEqual(artifactJsonLd(ix, basic)["dcterms:subject"]);
    expect(n["schema:hasPart"].find((x) => x["dcterms:identifier"] === "StructureDefinition/Patient-uv-ips")!["schema:sameAs"]).toEqual({ "@id": `${IPS.canonical}/StructureDefinition/Patient-uv-ips` });
  });
  it("refusesTermWithoutCodeOrName", () => {
    const n = { ...artifactJsonLd(ix, basic), "dcterms:subject": [{ "@type": "schema:DefinedTerm" }] };
    expect(IgArtifactJsonLdSchema.safeParse(n).success).toBe(false);
  });

  const sites: string[] = [];
  afterAll(() => sites.forEach((s) => rmSync(s, { recursive: true, force: true })));
  const rewrite = (f: (n: Json) => void) => {
    const s = builtSite(ix);
    sites.push(s);
    const p = join(s, "artifact", "index.jsonld");
    const n = JSON.parse(readFileSync(p, "utf8"));
    f(n);
    const text = `${JSON.stringify(n, null, 2)}\n`;
    writeFileSync(p, text);
    return s;
  };
  it("statedCheckPasses", () => {
    expect(checkArtifactJsonLd(ix, rewrite(() => {}))).toEqual([]);
  });
  it("checkFailsEntrySubject", () => {
    const s = rewrite((n) => {
      n["schema:hasPart"].find((x: Json) => x["dcterms:identifier"] === "Basic/page-role")["dcterms:subject"][0]["schema:termCode"] = "role";
    });
    expect(checkArtifactJsonLd(ix, s).join("\n")).toContain("the entry for Basic/page-role says dcterms:subject");
  });
  it("checkFailsEntryProfile", () => {
    const s = rewrite((n) => {
      n["schema:hasPart"][0]["dcterms:conformsTo"] = [{ "@id": "http://example.org/StructureDefinition/invented" }];
    });
    expect(checkArtifactJsonLd(ix, s).join("\n")).toContain("says dcterms:conformsTo");
  });
  it("checkFailsEntryCanonical", () => {
    const s = rewrite((n) => {
      n["schema:hasPart"][0]["schema:sameAs"] = { "@id": "http://example.org/other" };
    });
    expect(checkArtifactJsonLd(ix, s).join("\n")).toContain("says schema:sameAs");
  });
});

describe("thinIndexPage: the IG's artifacts and toc pages as thin shells", () => {
  const base = { label: "IPS", canonical: "artifacts.html", index: "artifact/index.jsonld", pagesHref: "artifact/", assets: "", home: "index.html", artifacts: "artifacts.html", toc: "toc.html" } as const;
  const artifacts = thinIndexPage({ ...base, view: "artifacts", heading: "Artifacts Summary", next: "toc.html" });
  const toc = thinIndexPage({ ...base, view: "toc", heading: "Table of Contents", canonical: "toc.html", outline: '<h2>Pages</h2><ul class="igi-outline"><li><a href="index.html">Home</a></li></ul>' });

  it("indexPagesThinShells", () => {
    for (const html of [artifacts, toc]) {
      expect(html).toContain('<link rel="alternate" type="application/ld+json" href="artifact/index.jsonld">');
      expect(html).toContain('<meta name="folio-navbar" content="linked">');
      expect(html).toContain('<script src="assets/ig-artifact.js"></script>');
      expect(html).toContain('<link rel="stylesheet" href="assets/ig-artifact.css">');
      expect(html).not.toMatch(/<style|<svg/);
      expect(html.length).toBeLessThan(3000);
    }
  });
  it("indexConfigNamesViewIndex", () => {
    const cfg = thinPageConfigOf(artifacts, THIN_INDEX_CONFIG_ID)!;
    expect(cfg).toMatchObject({ view: "artifacts", index: "artifact/index.jsonld", pages: "artifact/", footer: "assets/ig-footer.json", next: "toc.html", root: "" });
    expect(thinPageConfigOf(toc, THIN_INDEX_CONFIG_ID)!.view).toBe("toc");
  });
  it("listsNoArtefactItself", () => {
    expect(artifacts).not.toContain("Patient");
    expect(toc).toContain('<a href="index.html">Home</a>');
  });
});

describe("the shared renderer draws both page families", () => {
  const src = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
  it("rendererReadsEitherConfig", () => {
    expect(src).toContain(`getElementById("${THIN_INDEX_CONFIG_ID}")`);
  });
  it("rendererGuideFirst", () => {
    expect(src).toContain('"This guide"');
    expect(src).toContain("guideOf(ix, all)");
  });
  it("rendererFilledColumnsOnly", () => {
    expect(src).toMatch(/function columnsFor\(rows\)/);
    expect(src).toMatch(/if \(cols\.description\) hr\.append/);
    expect(src).toMatch(/el\("h3", null, t\.name/);
  });
  it("rendererContentsCardBesideGuide", () => {
    // Owner, 2026-11-10 (layout C): a Contents card beside "This guide", not the dotted jump line.
    expect(src).toMatch(/function drawContents\(gs, guide\)/);
    expect(src).toContain('el("div", "igi-head")');
    expect(src).not.toContain("igi-jump");
  });
  it("rendererHtmlBreaksAreParagraphs", () => {
    // A description's `</br>` was drawn as literal text.
    expect(src).toMatch(/function breaks\(text\)/);
    expect(src).toMatch(/breaks\(text\)\.split/);
  });
  it("rendererCategoriesOpen", () => {
    expect(src).not.toMatch(/createElement\("details"\)|el\("details"/);
  });
});

describe("the IG site, thin by default: stageIgSite, composeIgSite and artifactsFor", () => {
  const d = mkdtempSync(join(tmpdir(), "fhir-harness-thin-site-"));
  afterAll(() => rmSync(d, { recursive: true, force: true }));
  const src = join(d, "src");
  mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
  writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\npages:\n  index.md:\n    title: Home\n  concepts.md:\n    title: Concepts\n");
  writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n\nWelcome.\n");
  writeFileSync(join(src, "input", "pagecontent", "concepts.md"), "# Concepts\n\nProse.\n");
  const menu = { groups: [{ label: "Home", items: [{ label: "Concepts", href: "concepts.html" }] }] };
  const list = IX.artifacts.map((a) => ({ ...a }));
  const staged = join(d, "site");
  const r = stageIgSite(src, staged, { menu, baseurl: "/b", artifacts: { list, pagesHref: "artifact/", index: "artifact/index.jsonld" } });

  it("stageWritesThinIndexPages", () => {
    expect(r.generated).toEqual(expect.arrayContaining(["artifacts.html", "toc.html"]));
    expect(existsSync(join(staged, "artifacts.md"))).toBe(false);
    expect(existsSync(join(staged, "toc.md"))).toBe(false);
    const art = readFileSync(join(staged, "artifacts.html"), "utf8");
    expect(art.startsWith("<!doctype html>")).toBe(true);
    expect(art).toContain('<meta name="rendered-by" content="ig-pages">');
    expect(thinPageConfigOf(art, THIN_INDEX_CONFIG_ID)).toMatchObject({ view: "artifacts", index: "artifact/index.jsonld" });
    const toc = readFileSync(join(staged, "toc.html"), "utf8");
    // The IG's own pages stay in the toc's HTML, in sushi-config's order.
    expect(toc).toMatch(/<a href="index\.html">Home<\/a>.*<a href="concepts\.html">Concepts<\/a>/s);
    expect(thinPageConfigOf(toc, THIN_INDEX_CONFIG_ID)!.view).toBe("toc");
  });

  it("composedPagesThinLayout", () => {
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { atRoot: true }).collisions).toEqual([]);
    const page = readFileSync(join(host, "concepts.md"), "utf8");
    expect(page).toContain("layout: ig-thin-x");
    expect(page).not.toContain("layout: default");
    expect(page).toContain("{% include ig/x/_bottom.html %}");
    const layout = readFileSync(join(host, "_layouts", "ig-thin-x.html"), "utf8");
    expect(layout).toContain('<meta name="folio-navbar" content="linked">');
    // The shared page layout first, then the IG's ONE stylesheet (owner, 2026-10-15: "please consolidate behaviours/appearance").
    expect(layout).toContain("{{ '/assets/page-layout.css' | relative_url }}");
    expect(layout).toContain("{{ '/assets/page-layout.js' | relative_url }}");
    expect(layout).toContain("{{ '/assets/ig-artifact.css' | relative_url }}");
    expect(layout.indexOf("page-layout.css")).toBeLessThan(layout.indexOf("ig-artifact.css"));
    expect(layout).not.toContain("ig-topbar.css");
    expect(layout).toContain("data-fa-visualiser-nav");
    expect(layout).not.toMatch(/<style|<svg/);
    // The bar is the layout's, ABOVE the content column, so it spans the page; the column is the layout's full-width one.
    expect(layout).toContain('class="ig-topbar fa-page-bar"');
    expect(layout.indexOf('class="ig-topbar fa-page-bar"')).toBeLessThan(layout.indexOf("<main"));
    expect(layout).toContain('<main class="ig-main main-content fa-page-main" id="main-content">');
    const top = readFileSync(join(host, "_includes", "ig", "x", "_top.html"), "utf8");
    expect(top).not.toContain("ig-topbar");
    expect(top).not.toContain("<style");
    const bottom = readFileSync(join(host, "_includes", "ig", "x", "_bottom.html"), "utf8");
    expect(bottom).toContain("<script src=\"{{ '/assets/ig-source-links.js' | relative_url }}\"></script>");
    expect(existsSync(join(host, "assets", "ig-topbar.css"))).toBe(false);
    expect(existsSync(join(host, "assets", "page-layout.css"))).toBe(true);
    expect(existsSync(join(host, "assets", "page-layout.js"))).toBe(true);
    expect(existsSync(join(host, "assets", "ig-source-links.js"))).toBe(true);
    // The thin list pages carry no front matter, so they are copied as they are.
    expect(readFileSync(join(host, "artifacts.html"), "utf8").startsWith("<!doctype html>")).toBe(true);
  });

  it("fullPagesKeepHostLayout", () => {
    const host = join(d, "host-full");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { atRoot: true, fullPages: true }).collisions).toEqual([]);
    expect(readFileSync(join(host, "concepts.md"), "utf8")).toContain("layout: default");
    expect(existsSync(join(host, "_layouts"))).toBe(false);
  });

  it("artifactsForNamesIndexNode", () => {
    const root = join(d, "inst");
    mkdirSync(join(root, "fhir-artifact-index"), { recursive: true });
    mkdirSync(join(root, "docs", "artifact"), { recursive: true });
    writeFileSync(join(root, "fhir-artifact-index", "index.json"), JSON.stringify({ artifacts: list }));
    expect(() => artifactsFor(root, "artifact/")).toThrow(/--full-pages/);
    expect(artifactsFor(root, "artifact/", { fullPages: true })!.index).toBeUndefined();
    writeFileSync(join(root, "docs", "artifact", "index.jsonld"), "{}");
    expect(artifactsFor(root, "artifact/")!.index).toBe("artifact/index.jsonld");
  });
});

describe("the resource files at the site root, named by the JSON-LD graph (fhir-harness#359)", () => {
  const RAW = `https://raw.githubusercontent.com/o/ig/${"0".repeat(40)}`;
  const ROOT_FILE = "../StructureDefinition-Composition-uv-ips.json";
  const sites: string[] = [];
  afterAll(() => sites.forEach((s) => rmSync(s, { recursive: true, force: true })));

  it("rootCopyFirstMirrorSecond", () => {
    const n = artifactJsonLd(IX, COMPOSITION, { compiledData: RAW, rootResources: true });
    expect(IgArtifactJsonLdSchema.safeParse(n).success).toBe(true);
    expect(n["schema:encoding"].map((e) => [e["dcterms:source"], e["schema:contentUrl"]["@id"]])).toEqual([
      ["local", ROOT_FILE],
      ["mirror", `${RAW}/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json`],
      ["upstream", `${IPS.published}/StructureDefinition-Composition-uv-ips.json`],
    ]);
    // A referenced artefact has no copy in the AST, so none at the root either.
    expect(artifactJsonLd(IX, PATIENT, { compiledData: RAW, rootResources: true })["schema:encoding"].every((e) => e["dcterms:source"] === "upstream")).toBe(true);
    // The site's root copy already IS the compiled copy (`--compiled-data .`): listed once.
    expect(artifactJsonLd(IX, COMPOSITION, { compiledData: ".", rootResources: true })["schema:encoding"].filter((e) => e["dcterms:source"] === "local").length).toBe(1);
  });

  it("indexEntryNamesRootFile", () => {
    const ix = artifactIndexJsonLd(IX, { compiledData: RAW, rootResources: true });
    expect(IgArtifactIndexJsonLdSchema.safeParse(ix).success).toBe(true);
    const by = new Map(ix["schema:hasPart"].map((e) => [e["dcterms:identifier"], e]));
    expect(by.get(COMPOSITION.key)!["schema:contentUrl"]).toEqual({ "@id": ROOT_FILE });
    expect(by.get(PATIENT.key)!["schema:contentUrl"]).toBeUndefined();
  });

  /** A built site: the AST's resources served by publisher-pages, the nodes written beside them as the IG site writes them. */
  async function siteWithRootResources(): Promise<string> {
    const { serveAstData } = await import("./ig-repo-site.ts");
    const root = mkdtempSync(join(tmpdir(), "fhir-harness-root-res-"));
    sites.push(root);
    const ast = join(root, "output-ast");
    const file = RESOURCE.replace(/^[^/]+\//, "");
    mkdirSync(dirname(join(ast, file)), { recursive: true });
    writeFileSync(join(ast, file), JSON.stringify({ resourceType: "StructureDefinition", id: "Composition-uv-ips", text: { status: "generated", div: "<div/>" } }));
    writeFileSync(join(ast, "manifest.json"), JSON.stringify({ resources: [{ resourceType: "StructureDefinition", id: "Composition-uv-ips", file }] }));
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    expect(serveAstData({ site, ast, byUrl: true, rawBase: RAW }).named).toBe(1);
    for (const [rel, text] of artifactJsonLdFiles(IX, { compiledData: RAW, rootResources: true })) {
      mkdirSync(dirname(join(site, rel)), { recursive: true });
      writeFileSync(join(site, rel), text);
    }
    return site;
  }

  it("everyLocalEncodingIsOnTheBuiltSite", async () => {
    const site = await siteWithRootResources();
    for (const f of readdirSync(join(site, "artifact")).filter((f) => f.endsWith(".jsonld") && f !== "index.jsonld")) {
      const n = JSON.parse(readFileSync(join(site, "artifact", f), "utf8")) as Json;
      for (const e of n["schema:encoding"].filter((e: Json) => e["dcterms:source"] === "local")) {
        expect(existsSync(resolve(site, "artifact", e["schema:contentUrl"]["@id"]))).toBe(true);
      }
    }
    expect(checkArtifactJsonLd(IX, site)).toEqual([]);
    // The reduced copy: minified, no narrative.
    const served = readFileSync(join(site, "StructureDefinition-Composition-uv-ips.json"), "utf8");
    expect(served).toBe('{"resourceType":"StructureDefinition","id":"Composition-uv-ips"}');
  });

  it("checkFailsRootFileMissing", async () => {
    const site = await siteWithRootResources();
    unlinkSync(join(site, "StructureDefinition-Composition-uv-ips.json"));
    const out = checkArtifactJsonLd(IX, site).join("\n");
    expect(out).toContain(`StructureDefinition-Composition-uv-ips.jsonld: its resource ${ROOT_FILE} is not on the site`);
    expect(out).toContain(`the entry for ${COMPOSITION.key} names ${ROOT_FILE}, which is not on the site`);
  });
});
