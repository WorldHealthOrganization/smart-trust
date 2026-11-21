/**
 * `gen-ig-ast-pages.ts`: the `ig-ast` viewer's pages, written into a site.
 *
 * A scratch checkout of three layers: `harness` declares the visualiser
 * (`renderedBy: ig-ast-pages`, `subgraphs: "instance"`), `held` declares an
 * `ig-ast` directory with an AST on disk, and `remote` declares one on a
 * branch family that is not restored — the normal case, which the page must
 * call unknown rather than zero. The IG is shaped like HL7's IPS
 * (`hl7.fhir.uv.ips`); the resources, edges and plan are made up for the test.
 *
 * Calibrated: making `astsIn` return `[]` for a missing directory fails the
 * "unknown, not zero" test; dropping `render_with_liquid: false` from `page`
 * fails the Liquid test.
 *
 * @module fhir-harness/scripts/gen-ig-ast-pages.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AST_FAMILY_PREFIXES, astsIn, directoryVerdict, inheritedSubjects, needing, subjectPage, type BranchLister, type InstanceFacts } from "./gen-ig-ast-pages.ts";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(import.meta.dir, "gen-ig-ast-pages.ts");

const write = (p: string, v: unknown): void => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof v === "string" ? v : JSON.stringify(v, null, 2));
};

function scratchCheckout(): string {
  const root = mkdtempSync(join(tmpdir(), "fhir-harness-ig-ast-"));
  write(join(root, "harness", "harness.json"), {
    name: "harness",
    version: "0.0.0",
    description: "Scratch harness declaring the ig-ast viewer.",
    directories: [],
    visualisers: [{ id: "ig-ast", renderedBy: "ig-ast-pages", coversKinds: ["ig-ast"], subgraphs: "instance", title: "IG ASTs" }],
  });
  write(join(root, "held", "held.json"), {
    name: "held",
    version: "0.0.0",
    repository: "example/held",
    description: "Scratch instance holding an AST.",
    directories: [{ id: "held-ast", path: "fhir-ast/", graphTypologies: ["ig-ast"] }],
  });
  const ast = join(root, "held", "fhir-ast");
  write(join(ast, "manifest.json"), {
    $schema: "ig-ast/v1",
    authority: "cache",
    provisional: ["indices"],
    generatedAt: "2026-01-01T00:00:00Z",
    ig: { version: "2.0.0" },
    inputs: { toolchain: "ig-publisher 0.0.0", sourceRevision: "abc1234" },
    resources: [
      { key: "ImplementationGuide/ips", canonical: "http://hl7.org/fhir/uv/ips/ImplementationGuide/ips", version: "2.0.0", resourceType: "ImplementationGuide", id: "ips", file: "resources/ig.json", source: null },
      { key: "http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips|2.0.0", canonical: "http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips", version: "2.0.0", resourceType: "StructureDefinition", id: "Composition-uv-ips", name: "Composition {{ page.title }}", file: "resources/sd.json", source: null },
      { key: "ValueSet/vs", canonical: null, version: null, resourceType: "ValueSet", id: "vs", file: "resources/vs.json", source: null },
    ],
  });
  write(join(ast, "resources", "ig.json"), { resourceType: "ImplementationGuide", id: "ips", packageId: "hl7.fhir.uv.ips" });
  write(join(ast, "dependencies.json"), {
    $schema: "ig-ast-dependencies/v1",
    dependencies: [
      { source: "ValueSet/vs", kind: "meta.profile", target: "http://example.org/p", targetVersion: null, resolved: null, origin: "ast-export" },
      { source: "ImplementationGuide/ips", kind: "uses", target: "ValueSet/vs", targetVersion: null, resolved: "ValueSet/vs", origin: "publisher" },
    ],
  });
  write(join(ast, "plan.json"), { $schema: "ig-ast-plan/v1", decision: "incremental", rebuild: ["ValueSet/vs"] });
  write(join(root, "remote", "remote.json"), {
    name: "remote",
    version: "0.0.0",
    description: "Scratch instance whose AST is on a branch family, not restored.",
    directories: [
      {
        id: "remote-ast",
        path: "fhir-ast/",
        graphTypologies: ["ig-ast"],
        storage: { keyedBy: "family", branchPrefix: "cat/fhir-harness/fhir-ast/", keyFrom: "the IG's package id", repository: "example/remote", tool: "ig-cache" },
      },
    ],
  });
  return root;
}

describe("gen-ig-ast-pages --site", () => {
  const checkout = scratchCheckout();
  const site = mkdtempSync(join(tmpdir(), "fhir-harness-ig-ast-site-"));
  afterAll(() => [checkout, site].forEach((d) => rmSync(d, { recursive: true, force: true })));
  const run = (...args: string[]) => Bun.spawnSync(["bun", "run", SCRIPT, "--root", checkout, "--site", site, ...args], { cwd: ROOT });
  const first = run();
  const files = (): string[] => (readdirSync(site, { recursive: true }) as string[]).filter((f) => statSync(join(site, f)).isFile()).sort();
  const hub = join("en", "harness", "ig-ast", "index.html");
  const held = join("en", "harness", "ig-ast", "held", "index.html");
  const remote = join("en", "harness", "ig-ast", "remote", "index.html");
  const read = (f: string): string => readFileSync(join(site, f), "utf8");

  it("toolDeclaresKindAndSiteFlag", async () => {
    const { tools } = await import("../tools/index.ts");
    const t = tools().find((x) => x.id === "ig-ast-pages")!;
    expect(t.renders).toContain("ig-ast");
    const a = t.io?.inputs?.find((i) => i.name === "site")?.arg;
    expect(a !== undefined && "flag" in a ? a.flag : undefined).toBe("--site");
    expect(t.io?.inputs?.filter((i) => i.required) ?? []).toEqual([]);
  });

  it("writesHubAndDeclaredPages", () => {
    expect(first.exitCode).toBe(0);
    expect(files()).toEqual([hub, held, remote].sort());
    for (const f of files()) expect(read(f)).toContain("rendered-by: ig-ast-pages");
  });

  it("astOnDiskPage", () => {
    const html = read(held);
    expect(html).toContain("hl7.fhir.uv.ips");
    expect(html).toContain("<strong>3</strong> resource(s) across 3 type(s)");
    expect(html).toContain("<strong>2</strong> dependency edge(s), 1 resolved inside the IG");
    expect(html).toContain("<code>incremental</code>");
    expect(html).toContain("1 resource(s) to rebuild");
    expect(html).toContain("cache, never an authority");
  });

  it("remoteDirIsUnknown", () => {
    const html = read(remote);
    expect(html).toContain("<strong>unknown</strong>, not none");
    expect(html).not.toMatch(/\b0 AST/);
    expect(html).toContain("cat/fhir-harness/fhir-ast/");
    expect(html).toContain("https://github.com/example/remote/branches/all?query=");
    expect(read(hub)).toContain("unknown — not in this build");
    expect(read(hub)).toContain("1 AST(s), 3 resource(s)");
  });

  it("authoredTextNeverLiquid", () => {
    for (const f of files()) expect(read(f)).toMatch(/^---\n[\s\S]*?render_with_liquid: false[\s\S]*?\n---\n/);
  });

  it("checkPassesThenFails", () => {
    expect(run("--check").exitCode).toBe(0);
    writeFileSync(join(site, held), "changed");
    expect(run("--check").exitCode).toBe(1);
    run();
    write(join(site, "en", "harness", "ig-ast", "gone", "index.html"), "x");
    expect(run("--check").exitCode).toBe(1);
    run();
    expect(files()).toEqual([hub, held, remote].sort());
  });
});

describe("astsIn", () => {
  it("astsInNullOrEmpty", () => {
    const d = mkdtempSync(join(tmpdir(), "fhir-harness-ig-ast-empty-"));
    try {
      expect(astsIn(join(d, "absent"))).toBeNull();
      expect(astsIn(d)).toEqual([]);
      expect(directoryVerdict({ id: "x", path: "x/", absPath: d, asts: [] })).toContain("holds no AST");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("astsInKeyedByDir", () => {
    const d = mkdtempSync(join(tmpdir(), "fhir-harness-ig-ast-family-"));
    try {
      write(join(d, "example.pkg", "manifest.json"), { $schema: "ig-ast/v1", authority: "cache", provisional: [], resources: [] });
      write(join(d, "example.pkg", "dependencies.json"), { $schema: "ig-ast-dependencies/v1", dependencies: [] });
      write(join(d, "broken.pkg", "manifest.json"), { $schema: "ig-ast/v1", authority: "cache", provisional: [], resources: [] });
      const asts = astsIn(d)!;
      expect(asts.map((a) => [a.packageId, a.packageIdFrom, a.error === undefined])).toEqual([
        ["broken.pkg", "family-key", false],
        ["example.pkg", "family-key", true],
      ]);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("fhir-harness declares the viewer it draws", () => {
  const decl = JSON.parse(readFileSync(join(import.meta.dir, "..", "fhir-harness.json"), "utf8")) as {
    visualisers?: { id: string; renderedBy: string; coversKinds?: string[]; subgraphs?: string }[];
    builtAtPublish?: { path: string; writer: string[] }[];
  };
  // Not `builtAtPublish`: the pages are written under the SITE OWNER's site
  // directory (`siteOwnerDir`, cat-harness's in an index checkout), never
  // under this layer, so an entry here names a directory that stays empty
  // and `derive:publish` refuses it ("built nothing there"). The site build
  // runs the writer as a declared visualiser's (`visualiser-writers.ts`).
  it("declaresViewer", () => {
    const v = decl.visualisers?.find((x) => x.renderedBy === "ig-ast-pages");
    expect(v).toMatchObject({ id: "ig-ast", coversKinds: ["ig-ast"], subgraphs: "instance", writer: ["scripts/gen-ig-ast-pages.ts"] });
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as { checkoutScripts: Record<string, string> };
    expect(pkg.checkoutScripts["ig-ast:pages"]).toContain("gen-ig-ast-pages.ts");
    expect(decl.builtAtPublish?.some((x) => x.writer.includes("ig-ast:pages")) ?? false).toBe(false);
  });
});

describe("an IG repository inherits its AST listing from needing this layer", () => {
  // `ig` needs fhir-harness directly, `overlay-ig` through `overlay`; `held`
  // declares its own ig-ast directory; `lone` needs nothing. Made up for the test.
  const instances: InstanceFacts[] = [
    { name: "fhir-harness", repository: "example/fhir-harness", needs: ["core"] },
    { name: "overlay", repository: "example/overlay", needs: ["fhir-harness"] },
    { name: "ig", repository: "example/ig", needs: ["fhir-harness"] },
    { name: "overlay-ig", repository: "example/overlay-ig", needs: ["overlay"] },
    { name: "held", repository: "example/held", needs: ["fhir-harness"] },
    { name: "lone", repository: "example/lone", needs: [] },
  ];
  const asked: string[] = [];
  const list: BranchLister = (repo) => {
    asked.push(repo);
    if (repo === "example/overlay") return { branches: [] };
    if (repo === "example/overlay-ig") return { error: "git ls-remote https://github.com/example/overlay-ig failed" };
    return { branches: ["cat/fhir-harness/fhir-ast/hl7.fhir.uv.ips", "fhir-ast/hl7.fhir.uv.old"] };
  };

  it("needingFollowsNeeds", () => {
    expect([...needing(instances, "fhir-harness")].sort()).toEqual(["held", "ig", "overlay", "overlay-ig"]);
  });

  it("inheritedSubjectsAsksUndeclared", () => {
    const subjects = inheritedSubjects(instances, new Set(["held"]), list);
    expect(asked.sort()).toEqual(["example/ig", "example/overlay", "example/overlay-ig"]);
    expect(subjects.map((s) => s.name)).toEqual(["ig", "overlay-ig"]);
    const ig = subjects[0]!;
    // A branch left under the retired `fhir-ast/` name is not a family (bean oycs).
    expect(ig.directories.map((d) => [d.path, d.inherited?.keys])).toEqual([
      [AST_FAMILY_PREFIXES[0], ["hl7.fhir.uv.ips"]],
    ]);
    expect(directoryVerdict(ig.directories[0]!)).toContain("inherited");
    const failed = subjects[1]!.directories[0]!;
    expect(failed.inherited?.error).toContain("failed");
    expect(directoryVerdict(failed)).toContain("unknown");
  });

  it("pageLinksBranchesUnknown", () => {
    const subjects = inheritedSubjects(instances, new Set(["held"]), list);
    const html = subjectPage({ id: "ig-ast", title: "IG ASTs" }, subjects[0]!, subjects);
    expect(html).toContain("https://github.com/example/ig/tree/cat/fhir-harness/fhir-ast/hl7.fhir.uv.ips");
    expect(html).toContain("inherited");
    expect(html).toContain("<strong>unknown</strong>, not none");
  });
});
