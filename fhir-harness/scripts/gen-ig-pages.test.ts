/**
 * `gen-ig-pages.ts` is generic: what it may and may not take from a chrome
 * ingested from ANOTHER IG.
 *
 * The chrome is the TEMPLATE's (`folio-ig-chrome/v2`) and states no IG's
 * status; each IG's status is its own, recorded in its artefact index. Here
 * two IGs share one chrome: IPS's index records a status, IPA's does not. The runs write real
 * pages into a scratch repository, so these tests assert what a reader would
 * be served, not what a function returns.
 *
 * The subject is a non-WHO IG on purpose (#1963): this layer refuses to know
 * about WHO (`ig-build-pipeline.md`). The same assertions about the COMMITTED
 * WHO pages live in `smart-base/scripts/ig-pages-committed.test.ts`.
 *
 * Calibrated: dropping the status from IPS's index fails the first test;
 * giving `statusFor` any value but the index's own fails the second.
 *
 * @module fhir-harness/scripts/gen-ig-pages.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { IPA, IPS, artifactIndex, scratchRepo } from "../test/support/ig-fixture";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "fhir-harness/scripts/gen-ig-pages.ts");

/**
 * IPS's index with a second profile, and the FIRST made a compiled copy — the
 * shape `ast-to-artifact-index` writes. The second stays referenced, so a page
 * that must NOT get the resource section exists beside one that must.
 */
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
    provenance: {
      upstream: `${IPS.published}/StructureDefinition-Composition-uv-ips.html`,
      local: "fsh-generated/resources/StructureDefinition-Composition-uv-ips.json",
    },
    localPath: "output-ast/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json",
    gates: Object.fromEntries(
      ["size", "restrictions", "retention", "sourceLoss", "copyright"].map((g) => [g, { verdict: "unknown", basis: "test" }]),
    ),
    purpose: "compiled",
    inputs: { toolchain: "ig-publisher test", sourceRevision: "0".repeat(40), inputDigest: "0".repeat(64) },
    materializedAt: "2026-10-02T00:00:00Z",
  };
  return ix;
}

/**
 * The same compiled index as a BUILD's (`ast-to-artifact-index` output, source
 * kind `output`) at `revision`, with the second profile compiled at `other`.
 */
function builtIndex(id: string, revision: string, other: string): Record<string, unknown> {
  type Mat = { inputs: Record<string, string> } & Record<string, unknown>;
  const ix = compiledIndex(id) as { artifacts: Array<{ materialization: Mat }>; source: Record<string, unknown> };
  ix.source = { kind: "output", of: "output-ast", readAt: "2026-10-06", revision };
  const m = ix.artifacts[0].materialization;
  m.inputs.sourceRevision = revision;
  ix.artifacts[1].materialization = { ...m, inputs: { ...m.inputs, sourceRevision: other } };
  return ix;
}

const repo = scratchRepo({
  ips: { index: artifactIndex(IPS, "ips", "active") },
  ipa: { index: artifactIndex(IPA, "ipa") },
  plain: { index: artifactIndex(IPS, "plain", "active") },
  prefixed: { index: artifactIndex(IPS, "prefixed", "active") },
  compiled: { index: compiledIndex("compiled") },
  uncompiled: { index: compiledIndex("uncompiled") },
  built1: { index: builtIndex("built1", "1".repeat(40), "9".repeat(40)) },
  built2: { index: builtIndex("built2", "2".repeat(40), "9".repeat(40)) },
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

function generate(instance: string, ...args: string[]): void {
  const run = Bun.spawnSync(["bun", "run", SCRIPT, "--instance", join(repo, instance), "--full-pages", ...args], { cwd: ROOT });
  if (run.exitCode !== 0) throw new Error(`gen-ig-pages failed for ${instance}:\n${run.stderr.toString()}`);
}

// IPS: its index records a status, no --summary. IPA: no status, --summary.
// Both name a WHO-free publish note and sidecar label, as a WHO caller names its own.
generate("ips", "--label", "International Patient Summary", "--chrome-owner", "chrome-owner",
  "--publish-note", "This page mirrors a published HL7 Implementation Guide.", "--sidecar-label", "HL7 sidecars");
generate("ipa", "--label", "International Patient Access", "--chrome-owner", "chrome-owner",
  "--publish-note", "This page mirrors a published HL7 Implementation Guide.", "--sidecar-label", "HL7 sidecars", "--summary");
// `plain`: no --publish-note, no --sidecar-label — the layer's own defaults.
generate("plain", "--label", "Plain", "--chrome-owner", "chrome-owner");
// `prefixed`: published somewhere other than /<instance>/, as staging's AST sites are.
generate("prefixed", "--label", "Prefixed", "--chrome-owner", "chrome-owner", "--site-prefix", "/prefixed/ast");

const page = (instance: string): string => readFileSync(join(repo, instance, "docs", "index.md"), "utf8");

/** The banner markup only — the stylesheet above it legitimately names `.ig-status-*`. */
function banner(src: string): string {
  const start = src.indexOf('<div class="st-ig">');
  const end = src.indexOf("</div>\n\n", start);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, end);
}

describe("gen-ig-pages: the banner's identity is the index's", () => {
  it("ownIdentityKeepsWatermark", () => {
    const b = banner(page("ips"));
    expect(b).toContain(`>${IPS.packageId}</a>`);
    expect(b).toContain('class="ig-status-active"');
  });

  it("noIdentityNoBorrowedStatus", () => {
    const b = banner(page("ipa"));
    expect(b).toContain(`>${IPA.packageId}</a>`);
    expect(b).toContain(IPA.canonical);
    expect(b).not.toContain(IPS.packageId);
    expect(b).not.toMatch(/class="ig-status-/);
  });
});

describe("gen-ig-pages --summary: the landing page", () => {
  it("summaryOpensWithHarnessSection", () => {
    const src = page("ipa");
    expect(src).toMatch(/^---\ntitle: "International Patient Access"\n/);
    const include = src.indexOf('{% include harness_details.html instance="ipa" %}');
    const index = src.indexOf("## Artefact index");
    expect(include).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(include);
  });

  it("noSummaryArtefactIndexTitle", () => {
    const src = page("ips");
    expect(src).not.toContain("harness_details.html");
    expect(src).toMatch(/^---\ntitle: "International Patient Summary — artefact index"\n/);
  });
});

describe("gen-ig-pages: the publish note and the sidecar label are the caller's", () => {
  it("callerNoteAndLabelCarried", () => {
    const index = page("ips");
    expect(index).toContain('<p id="publish-box">This page mirrors a published HL7 Implementation Guide.');
    expect(index).toContain("## HL7 sidecars surface");
  });

  it("neutralDefaults", () => {
    const index = page("plain");
    // The banner is drawn (a chrome is given), so the publish note is really on the page.
    expect(index).toContain('<p id="publish-box">This page mirrors a published FHIR Implementation Guide.');
    expect(index).toContain("## IG API surface");
    expect(index).not.toContain("HL7");
    // The per-artefact page carries the label too, as a heading of its own.
    const artefact = readFileSync(join(repo, "plain", "docs", "artifact", "StructureDefinition-Composition-uv-ips.md"), "utf8");
    expect(artefact).toMatch(/^## IG API$/m);
    expect(artefact).not.toContain("HL7 sidecars");
  });
});

describe("gen-ig-pages --compiled-data: an AST-built artefact page loads its resource", () => {
  // The two runs differ only in the flag.
  generate("compiled", "--compiled-data", "../ast-data");
  generate("uncompiled");
  const artefact = (instance: string, name: string): string =>
    readFileSync(join(repo, instance, "docs", "artifact", `${name}.md`), "utf8");

  it("compiledDataLoadsResource", () => {
    const md = artefact("compiled", "StructureDefinition-Composition-uv-ips");
    // `artifact/Name.html` → docs root `../` → the data beside the docs.
    expect(md).toContain('data-ast-src="../../ast-data/resources/StructureDefinition/Composition-uv-ips--7ae5e8a1.json"');
    expect(md).toContain('data-ast-pages="../assets/ast-pages.json"');
    // The base the IG publishes from, read off the artefact's own published page.
    expect(md).toContain(`data-ast-published="${IPS.published}/"`);
    expect(md).toContain('<p class="ast-state">');
    expect(md).toMatch(/<noscript>.*href="\.\.\/\.\.\/ast-data\/resources\/StructureDefinition\/Composition-uv-ips--7ae5e8a1\.json"/);
    expect(md).toContain('<script src="../assets/ast-resource.js" defer></script>');
    expect(existsSync(join(repo, "compiled", "docs", "assets", "ast-resource.js"))).toBe(true);
    const list = JSON.parse(readFileSync(join(repo, "compiled", "docs", "assets", "ast-pages.json"), "utf8")) as string[];
    expect(list).toContain("StructureDefinition-Composition-uv-ips.html");
    // Only the one compiled artefact gets the section; the rest are as before.
    expect(artefact("compiled", "StructureDefinition-Patient-uv-ips")).not.toContain("data-ast-src");
  });

  it("noCompiledDataNoLoader", () => {
    expect(artefact("uncompiled", "StructureDefinition-Composition-uv-ips")).not.toContain("data-ast-src");
    expect(existsSync(join(repo, "uncompiled", "docs", "assets", "ast-resource.js"))).toBe(false);
  });
});

describe("gen-ig-pages: an AST build's revision is printed once, on the index (bean c65n)", () => {
  generate("built1", "--label", "Same");
  generate("built2", "--label", "Same");
  const read = (instance: string, rel: string): string => readFileSync(join(repo, instance, "docs", rel), "utf8");

  it("indexCarriesRevision", () => {
    expect(read("built1", "index.md")).toContain('<a id="build-revision"></a>');
    expect(read("built1", "index.md")).toContain("`" + "1".repeat(12) + "`");
  });

  it("sameRevisionLinksIndex", () => {
    const md = read("built1", "artifact/StructureDefinition-Composition-uv-ips.md");
    expect(md).toContain("compiled copy of the [build revision](../#build-revision)");
    expect(md).not.toContain("1".repeat(12));
    // The two scratch layers differ in NAME, which the asset paths carry; that is the fixture, not the stamp.
    expect(read("built2", "artifact/StructureDefinition-Composition-uv-ips.md").replaceAll("/built2/", "/built1/")).toBe(md);
  });

  it("otherRevisionNamesOwn", () => {
    expect(read("built1", "artifact/StructureDefinition-Patient-uv-ips.md")).toContain("`" + "9".repeat(12) + "`");
  });
});

describe("gen-ig-pages --site: only the declared route pages, under the site", () => {
  // A layer that declares the artefact-index visualiser, per layer, as
  // a harness does (`renderedBy: ig-pages`, `subgraphs: "instance"`).
  const siteRepo = scratchRepo({ sited: { index: artifactIndex(IPS, "sited") } });
  const decl = join(siteRepo, "sited", "sited.json");
  writeFileSync(decl, JSON.stringify({
    ...JSON.parse(readFileSync(decl, "utf8")),
    visualisers: [{ id: "artifact-index", renderedBy: "ig-pages", coversKinds: ["fhir-artifact-index"], subgraphs: "instance", title: "Artefact index" }],
  }));
  const site = mkdtempSync(join(tmpdir(), "fhir-harness-site-"));
  const withIndex = mkdtempSync(join(tmpdir(), "fhir-harness-site-"));
  afterAll(() => [siteRepo, site, withIndex].forEach((d) => rmSync(d, { recursive: true, force: true })));
  const run = (...args: string[]) => Bun.spawnSync(["bun", "run", SCRIPT, "--instance", join(siteRepo, "sited"), ...args], { cwd: ROOT });
  const files = (dir: string): string[] => (readdirSync(dir, { recursive: true }) as string[]).filter((f) => !statSync(join(dir, f)).isDirectory()).sort();
  const full = join("en", "sited", "artifact-index", "index.html");
  const sub = join("en", "sited", "artifact-index", "sited", "index.html");

  const first = run("--site", site, "--label", "Sited IG");
  mkdirSync(join(withIndex, "sited"), { recursive: true });
  writeFileSync(join(withIndex, "sited", "index.md"), "---\ntitle: held\n---\n");
  const second = run("--site", withIndex);

  it("toolDeclaresSiteFlags", async () => {
    const { tools } = await import("../tools/index.ts");
    const t = tools().find((x) => x.id === "ig-pages")!;
    const flag = (n: string): string | undefined => {
      const a = t.io?.inputs?.find((i) => i.name === n)?.arg;
      return a !== undefined && "flag" in a ? a.flag : undefined;
    };
    expect(flag("instance")).toBe("--instance");
    expect(flag("site")).toBe("--site");
  });

  it("siteWritesRoutePagesOnly", () => {
    expect(first.exitCode).toBe(0);
    expect(files(site)).toEqual([full, sub].sort());
  });

  it("siteWritesNothingInInstance", () => {
    expect(existsSync(join(siteRepo, "sited", "docs"))).toBe(false);
    expect(existsSync(join(siteRepo, "_site"))).toBe(false);
  });

  it("siteWithoutIndexGetsIndex", () => {
    const html = readFileSync(join(site, full), "utf8");
    expect(html).toContain('<meta name="rendered-by" content="ig-pages">');
    expect(html).toContain("<title>Sited IG — artefact index</title>");
    expect(html).toContain(`href="${IPS.published}/StructureDefinition-Composition-uv-ips.html"`);
    expect(html).not.toContain("http-equiv=\"refresh\"");
    expect(readFileSync(join(site, sub), "utf8")).toBe(html);
  });

  it("siteWithIndexRedirects", () => {
    expect(second.exitCode).toBe(0);
    expect(readFileSync(join(withIndex, full), "utf8")).toContain('content="0; url=../../../sited/"');
    expect(readFileSync(join(withIndex, sub), "utf8")).toContain('content="0; url=../../../../sited/"');
  });

  it("siteCheckJudgesRoutes", () => {
    expect(run("--site", site, "--label", "Sited IG", "--check").exitCode).toBe(0);
    expect(run("--site", site, "--label", "Another", "--check").exitCode).toBe(1);
  });

  it("siteAndOutRefused", () => {
    expect(run("--site", site, "--out", join(site, "x")).exitCode).toBe(2);
  });

  it("noIndexDirStillGetsPage", () => {
    const bare = scratchRepo({ bare: { index: artifactIndex(IPS, "bare") } });
    const d = join(bare, "bare", "bare.json");
    writeFileSync(d, JSON.stringify({
      ...JSON.parse(readFileSync(d, "utf8")),
      directories: [],
      visualisers: [{ id: "artifact-index", renderedBy: "ig-pages", coversKinds: ["fhir-artifact-index"], subgraphs: "instance", title: "Artefact index" }],
    }));
    const out = mkdtempSync(join(tmpdir(), "fhir-harness-site-"));
    try {
      const r = Bun.spawnSync(["bun", "run", SCRIPT, "--instance", join(bare, "bare"), "--site", out, "--label", "Bare IG"], { cwd: ROOT });
      expect(r.exitCode).toBe(0);
      expect(existsSync(join(out, "en", "bare", "artifact-index", "bare", "index.html"))).toBe(true);
    } finally {
      [bare, out].forEach((x) => rmSync(x, { recursive: true, force: true }));
    }
  });
});

describe("gen-ig-pages --site-prefix: the shared assets are linked where the pages are published", () => {
  it("assetsUnderInstanceByDefault", () => {
    expect(page("plain")).toContain("{{ '/plain/assets/ig-pages.css' | relative_url }}");
  });

  it("assetsUnderNamedPrefix", () => {
    const p = page("prefixed");
    expect(p).toContain("{{ '/prefixed/ast/assets/ig-pages.css' | relative_url }}");
    expect(p).not.toContain("'/prefixed/assets/");
  });

  it("refusesBadSitePrefix", () => {
    for (const bad of ["prefixed/ast", "/prefixed/ast/", "/a/../b", "/a//b"]) {
      const r = Bun.spawnSync(["bun", "run", SCRIPT, "--instance", join(repo, "plain"), "--full-pages", "--site-prefix", bad], { cwd: ROOT });
      expect(r.exitCode).toBe(2);
    }
  });
});
