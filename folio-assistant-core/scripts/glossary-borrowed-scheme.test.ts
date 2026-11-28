/**
 * A scheme a layer declares about a layer it MOUNTS but does not `need` is
 * minted, served and linked on the declaring layer's own site.
 *
 * A document folio's scheme of organizations cited a library layer the folio
 * mounts for its documents. Credited to that layer, its IRIs went to the
 * layer's namespace and its term pages to the layer's instance route. The
 * folio's site build (`--instance <folio>`) skips that layer, and the layer's
 * own site is built from a repository that never holds the file, so the 17
 * IRIs the folio cites, and a translated document's term links, were all 404s
 * (2026-11-23). The fixture is that shape: a host layer `hb`, a mounted layer
 * `lib` it does not need, and `hb`'s scheme citing `lib/library/…`. A second
 * mounted layer `base`, which `hb` needs, keeps the crediting the layers below
 * rely on.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collect, namespaceFiles, repositoryRoots, termPagePath, termPagesOf } from "./glossary-page.ts";
import { glossaryEntries, termLinks } from "./glossary-term-links.ts";
import { servedPath } from "../schemas/glossary-namespace.ts";
import { termIri, toSkos } from "../schemas/glossary.ts";

const HB = "https://example.org/hb/";
const repo = mkdtempSync(join(tmpdir(), "glossary-borrowed-"));
const write = (path: string, body: unknown) => {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), typeof body === "string" ? body : JSON.stringify(body));
};
const declaration = (name: string, iriBase?: string, needs?: string[]) => ({
  $schema: "cat-harness-declaration/1.0.0",
  name,
  title: name,
  version: "0.1.0",
  ...(iriBase ? { iriBase } : {}),
  ...(needs ? { needs } : {}),
  directories: [{ id: "glossary", path: "glossary/", graphTypologies: ["glossary"], description: "The glossary." }],
});
write("hb.json", declaration("hb", HB, ["base"]));
write("lib/lib.json", declaration("lib"));
write("base/base.json", declaration("base"));
write("base/glossary/README.md", "base's own glossary directory.");
write("base/schemas/role.ts", "export {};");
write("lib/glossary/README.md", "lib's own glossary directory.");
write("lib/library/handbook/index.md", "A handbook lib catalogues.");
write("index.lock.json", { instances: [{ instance: "lib", path: "lib" }, { instance: "base", path: "base" }] });
write("glossary/organizations.glossary.json", {
  $schema: "folio-glossary/v1",
  id: "organizations",
  title: "Organizations",
  source: "lib/library/handbook/",
  terms: [
    { id: "who", prefLabel: "World Health Organization", notation: "WHO", status: "candidate" },
    { id: "gs1", prefLabel: "GS1", definition: "A standards body.", status: "candidate" },
  ],
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("a scheme declared about a mounted layer it does not need", async () => {
  const c = collect(repo);
  const orgs = c.glossaries.find((s) => s.glossary.id === "organizations")!;

  test("the mount is another repository", () => {
    expect(repositoryRoots(repo)).toEqual([join(repo, "base"), join(repo, "lib"), repo]);
  });

  test("is the declaring layer's, minted in its namespace", () => {
    expect(c.findings.invalid).toEqual([]);
    expect({ instance: orgs.instance, declaredBy: orgs.declaredBy }).toEqual({ instance: "hb", declaredBy: "hb" });
    expect(termIri(orgs.ns, orgs.glossary, "who")).toBe(`${HB}v0/ns/glossary/organizations/who`);
  });

  test("its site serves every IRI its SKOS mints: a page at each path, an id for each fragment", () => {
    const site = "/site";
    const files = namespaceFiles(c, { site, siteBase: HB, only: "hb" }, new Set());
    const minted = (toSkos(orgs.glossary, orgs.ns)["@graph"] as Array<{ "@id": string }>).map((n) => n["@id"]).filter((i) => i.startsWith(orgs.ns));
    expect(minted).toContain(`${HB}v0/ns/glossary/organizations/who`);
    expect(minted).toContain(`${HB}v0/ns/glossary/organizations/gs1`);
    for (const iri of minted) {
      const at = servedPath(iri, HB)!;
      const page = files.get(join(site, at.dir, "index.html"));
      expect([iri, page !== undefined]).toEqual([iri, true]);
      if (at.fragment !== undefined) expect([iri, page!.includes(`id="${at.fragment}"`)]).toEqual([iri, true]);
    }
  });

  test("its term pages are written under the declaring layer, which its site build keeps", () => {
    const pages = [...termPagesOf(c).keys()];
    expect(pages).toContain(termPagePath(orgs, "who"));
    expect(termPagePath(orgs, "who").split("\\").join("/")).toContain("/instance/hb/organizations/who/");
  });

  test("a document's term links stay on the declaring layer's site", async () => {
    const links = (await termLinks(repo, "es/hb")).filter((l) => l.iri?.includes("/organizations/"));
    expect(links.map((l) => l.href).sort()).toEqual([
      "../../en/folio-assistant-core/glossary/instance/hb/organizations/gs1/",
      "../../en/folio-assistant-core/glossary/instance/hb/organizations/who/",
    ]);
    const entries = await glossaryEntries(repo, "es/hb");
    expect(entries.map((e) => e.href)).toContain("../../en/folio-assistant-core/glossary/instance/hb/#hb--organizations--who");
    expect([...links.map((l) => l.href), ...entries.map((e) => e.href)].filter((h) => h.includes("instance/lib/"))).toEqual([]);
  });

  test("a mounted layer's own scheme stays its own", () => {
    write("lib/glossary/catalogue.glossary.json", {
      $schema: "folio-glossary/v1",
      id: "catalogue",
      title: "Catalogue",
      source: "lib/library/handbook/",
      terms: [{ id: "record", prefLabel: "Record", status: "candidate" }],
    });
    try {
      const own = collect(repo).glossaries.find((s) => s.glossary.id === "catalogue")!;
      expect({ instance: own.instance, declaredBy: own.declaredBy }).toEqual({ instance: "lib", declaredBy: "lib" });
    } finally {
      rmSync(join(repo, "lib/glossary/catalogue.glossary.json"));
    }
  });

  test("a scheme about a mounted layer the declarer needs stays that layer's", () => {
    write("glossary/roles.glossary.json", {
      $schema: "folio-glossary/v1",
      id: "roles",
      title: "Roles",
      source: "base/schemas/role.ts",
      terms: [{ id: "actor", prefLabel: "actor", status: "candidate" }],
    });
    try {
      const roles = collect(repo).glossaries.find((s) => s.glossary.id === "roles")!;
      expect({ instance: roles.instance, declaredBy: roles.declaredBy }).toEqual({ instance: "base", declaredBy: "hb" });
    } finally {
      rmSync(join(repo, "glossary/roles.glossary.json"));
    }
  });
});
