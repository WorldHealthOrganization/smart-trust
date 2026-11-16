/**
 * The COMMITTED WHO IG pages and data that fhir-harness's generic scripts
 * produce: what a reader of `/smart-base/` and `/smart-trust/` is served.
 *
 * These assertions lived in fhir-harness's own tests until #1963. They are
 * facts about WHO layers, and fhir-harness refuses to know about WHO
 * (`fhir-harness/skills/fhir-ig-base/ig-build-pipeline.md`), so they moved
 * here unchanged. The generic behaviour behind them is still tested in
 * fhir-harness, over a non-WHO IG.
 *
 * smart-base's chrome was ingested from smart-trust's template chain (bean
 * `bamf`). Since stage D (#1767) the chrome is the TEMPLATE's and states no
 * IG's status; each IG's status is its own, from its sushi-config or its
 * artefact index. (The separate `ig-identity.json` that once held it was
 * excised on 2026-11-14, owner: "excise ig-identy.json in this and other repos".)
 *
 * Coupled to bean `lbz8` (#2082): it plans to move the generated IG pages off
 * `main` to the `cat/fhir-harness/ig-docs` branch. When it lands, the
 * `page("smart-base")` / `page("smart-trust")` reads below find no committed
 * `docs/index.md` and these groups must read the pages from that branch (or
 * generate them into a scratch tree) instead.
 *
 * @module smart-base/scripts/ig-pages-committed.test
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { igSiteData } from "../platform/index.js";

const ROOT = resolve(import.meta.dir, "..", "..");

/**
 * The status an IG's own artefact index records (`index.json` `status`, from its
 * ImplementationGuide), or undefined when it records none or is not on disk.
 * Since the separate `ig-identity.json` was excised (owner, 2026-11-14), the
 * banner's status class comes from here and nowhere else.
 */
function indexStatus(instance: string): string | undefined {
  const f = join(ROOT, instance, "fhir-artifact-index", "index.json");
  if (!existsSync(f)) return undefined;
  const s = (JSON.parse(readFileSync(f, "utf8")) as { status?: unknown }).status;
  return typeof s === "string" && s ? s : undefined;
}

/** The banner's status class as the IG's own index decides it: its status, or none. */
function expectStatusFromIndex(b: string, instance: string): void {
  const status = indexStatus(instance);
  if (status) expect(b).toContain(`class="ig-status-${status}"`);
  else expect(b).not.toMatch(/class="ig-status-/);
}

/** The banner markup only — the stylesheet above it legitimately names `.ig-status-draft`. */
function banner(src: string): string {
  const start = src.indexOf('<div class="st-ig">');
  const end = src.indexOf("</div>\n\n", start);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, end);
}

describe("the committed pages: the banner's identity is the index's", () => {
  // smart-trust's docs build into its IG site (`igSite`, bean `mftp`), whose
  // index the IG writes. Since thin became the default (fhir-harness
  // `gen-ig-pages`, owner 2026-10-12: "make thin default") an ARTEFACT page is
  // a thin `.html` shell that draws itself from its JSON-LD node and carries no
  // banner; the banner is on the full pages that remain — the JSON view and
  // tab pages, and the IG API view pages — so it is read there.
  it("smartTrustStatusIsItsIndexs", () => {
    const b = banner(readFileSync(join(ROOT, "smart-trust", "docs", "artifact", "ActorDefinition-Holder.json.md"), "utf8"));
    expect(b).toContain(">smart.who.int.trust</a>");
    expectStatusFromIndex(b, "smart-trust");
  });

  // smart-base's docs build into its IG site too (bean `mftp`, "no drift").
  // Since fhir-harness#328 (`a6655ad31fc8`), IG API view pages (`.schema.json`)
  // are redirect stubs to `?view=schema` while the JSON view and profile JSON
  // pages (`StructureDefinition-DAK.json.md`, `.profile.json.md`) remain full
  // Markdown pages carrying the banner; fall back to `.schema.json.md` when run
  // against an older fhir-harness pin.
  it("smartBaseBannerNamesItselfNoStatus", () => {
    const dir = join(ROOT, "smart-base", "docs", "artifact");
    const candidates = [
      "StructureDefinition-DAK.json.md",
      "StructureDefinition-DAK.profile.json.md",
      "StructureDefinition-DAK.schema.json.md",
    ].map((f) => join(dir, f));
    const page = candidates.find((p) => existsSync(p)) ?? candidates[0]!;
    const b = banner(readFileSync(page, "utf8"));
    expect(b).toContain(">smart.who.int.base</a>");
    expect(b).toContain("http://smart.who.int/base");
    expect(b).not.toContain("smart.who.int.trust");
    expectStatusFromIndex(b, "smart-base");
  });
});

describe("the committed pages: the landing page", () => {
  // Since bean `mftp` neither IG commits a landing page: its IG site's own
  // home page is the root, and the harness is reached through the navbar.
  // Thin (the default since 2026-10-12), neither commits the artefact index's
  // front matter either: `artifacts.html` is a finished thin page that
  // `build-ig-site` draws from the index NODE and that carries `rendered-by`
  // itself, so what each commits for the index is that node, naming its own
  // IG; the visualiser is declared in the layer's `visualisers` (owner
  // 2026-10-09).
  const indexNode = (instance: string) =>
    JSON.parse(readFileSync(join(ROOT, instance, "docs", "artifact", "index.jsonld"), "utf8")) as Record<string, unknown>;

  it("smartBaseNoLandingPageIndexNode", () => {
    expect(existsSync(join(ROOT, "smart-base", "docs", "index.md"))).toBe(false);
    expect(existsSync(join(ROOT, "smart-base", "docs", "artifacts.md"))).toBe(false);
    const n = indexNode("smart-base");
    expect(n["$schema"]).toBe("folio-ig-artifact-index-jsonld/v1");
    expect(n["dcterms:identifier"]).toBe("smart.who.int.base");
    expect(n["dcterms:title"]).toBe("WHO SMART Base");
  });

  it("smartTrustNoLandingPageIndexNode", () => {
    expect(existsSync(join(ROOT, "smart-trust", "docs", "index.md"))).toBe(false);
    expect(existsSync(join(ROOT, "smart-trust", "docs", "artifacts.md"))).toBe(false);
    const n = indexNode("smart-trust");
    expect(n["$schema"]).toBe("folio-ig-artifact-index-jsonld/v1");
    expect(n["dcterms:identifier"]).toBe("smart.who.int.trust");
    expect(n["dcterms:title"]).toBe("WHO SMART Trust");
  });
});

describe("site.data.fhir from smart-base's committed artifact index", () => {
  const r = igSiteData(join(ROOT, "smart-base"));

  it("writesWhatIndexCarries", () => {
    expect(r.data.packageId).toBe("smart.who.int.base");
    expect(r.data.canonical).toBe("http://smart.who.int/base");
    expect(r.data.ig.version).toBe("0.3.0");
    expect(r.data.ig.fhirVersion).toEqual(["4.0.1"]);
    expect(r.provenance["ig.version"]).toBe("fhir-artifact-index/index.json");
  });

  it("listsUndeterminedNotEmptyStrings", () => {
    expect(r.undetermined).toEqual(expect.arrayContaining(["ig.id", "ig.name", "ig.publisher"]));
    expect(JSON.stringify(r.data)).not.toContain('""');
  });

  it("smartBaseStatesNoStatus", () => {
    expect(r.data.ig.status).toBeUndefined();
    expect(r.refused).toEqual([]);
  });
});
