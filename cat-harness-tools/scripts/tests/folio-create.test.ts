/**
 * `folio-create.ts` — a reader's document goes into the folio, of any kind a
 * loaded knowledge graph declares, and a linked document goes into `library/`
 * as a `referenced` node (bean `95sk`, R28).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ReferencedSourceSchema } from "../../schemas/library/referenced-source.ts";
import { checkEntry } from "../check-l1-complete.ts";
import {
  createDocument,
  documentPage,
  linkDocument,
  loadedDocumentKinds,
  qualifiedKind,
  resolveKind,
  sectionsOf,
} from "../folio-create.ts";
import type { KindEntry } from "../gen-document-kinds-viz.ts";

const kind = (instance: string, id: string, sections: [string, boolean][], ext?: string): KindEntry => ({
  instance,
  file: `${instance}/document-kinds/${id}.json`,
  coverage: [],
  kind: {
    $schema: "document-kind/1.0.0",
    id,
    title: `${id} title`,
    description: "d",
    structure: "semi-fixed",
    ...(ext ? { extends: ext } : {}),
    sections: sections.map(([sid, required]) => ({ id: sid, title: `${sid} heading`, required, description: `about ${sid}` })),
    sources: [{ ref: "x" }],
  } as KindEntry["kind"],
});

const l1 = kind("smart-base", "l1", [["introduction", true], ["annexes", false]]);
const guideline = kind("smart-base", "l1-guideline", [["recommendations", true], ["introduction", true]], "l1");
const otherL1 = kind("other", "l1", [["x", true]]);

describe("resolveKind", () => {
  test("an id one instance declares resolves", () => {
    expect(resolveKind([l1, guideline], "l1")).toBe(l1);
  });
  test("an id two instances declare is refused, naming both", () => {
    const r = resolveKind([l1, otherL1], "l1");
    expect("error" in r && r.error).toContain("smart-base:l1 and other:l1");
    expect(resolveKind([l1, otherL1], "other:l1")).toBe(otherL1);
  });
  test("an unknown kind lists the known ones", () => {
    const r = resolveKind([l1], "dak");
    expect("error" in r && r.error).toContain("smart-base:l1");
  });
});

describe("the page", () => {
  test("a sub-kind carries its parent's sections first, each once", () => {
    expect(sectionsOf(guideline, [l1, guideline]).map((s) => s.id)).toEqual(["introduction", "annexes", "recommendations"]);
  });
  test("front matter names the kind, and every section is a heading marked required or optional", () => {
    const page = documentPage(guideline, [l1, guideline], "My guideline");
    expect(page).toContain('documentKind: "smart-base:l1-guideline"');
    expect(page).toContain("## recommendations heading\n\n<!-- Required. about recommendations -->");
    expect(page).toContain("<!-- Optional. about annexes -->");
  });
});

describe("createDocument", () => {
  test("writes <folio>/<slug>/index.md and refuses to overwrite it", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-create-"));
    try {
      const r = createDocument({ root, kinds: [l1], kind: "l1", slug: "my-doc", title: "My doc" });
      expect(r).toEqual({ path: join(root, "folio", "my-doc", "index.md") });
      expect(readFileSync(join(root, "folio", "my-doc", "index.md"), "utf-8")).toContain("# My doc");
      const again = createDocument({ root, kinds: [l1], kind: "l1", slug: "my-doc", title: "Again" });
      expect("error" in again && again.error).toContain("already exists");
      expect(readFileSync(join(root, "folio", "my-doc", "index.md"), "utf-8")).toContain("# My doc");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("a bad slug or an unknown kind writes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-create-"));
    try {
      expect("error" in createDocument({ root, kinds: [l1], kind: "l1", slug: "Bad Slug", title: "t" })).toBe(true);
      expect("error" in createDocument({ root, kinds: [l1], kind: "nope", slug: "ok", title: "t" })).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("discovers document kinds from the dependency chain and mounted layers when kinds is omitted", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "folio-create-chain-"));
    try {
      // 1. An upstream dependency outside the folio checkout declaring kind `dep-kind`
      const depRoot = join(sandbox, "upstream-dep");
      mkdirSync(join(depRoot, "kinds"), { recursive: true });
      writeFileSync(
        join(depRoot, "upstream-dep.json"),
        JSON.stringify({
          name: "upstream-dep",
          directories: [{ id: "document-kinds", path: "kinds/", graphTypologies: ["document-kinds"] }],
        }),
      );
      writeFileSync(join(depRoot, "kinds", "dep-kind.json"), JSON.stringify(l1.kind));

      // 2. The folio checkout itself, declaring a dependency on `upstream-dep`
      //    AND a remote mount lock placing `mounted-layer` two levels deep under `mounts/mounted-layer`
      const folioRoot = join(sandbox, "my-folio");
      const mountedRoot = join(folioRoot, "mounts", "mounted-layer");
      mkdirSync(join(mountedRoot, "kinds"), { recursive: true });
      writeFileSync(
        join(mountedRoot, "mounted-layer.json"),
        JSON.stringify({
          name: "mounted-layer",
          directories: [{ id: "document-kinds", path: "kinds/", graphTypologies: ["document-kinds"] }],
        }),
      );
      writeFileSync(
        join(mountedRoot, "kinds", "programme.json"),
        JSON.stringify({
          ...l1.kind,
          id: "programme",
          title: "Programme",
        }),
      );
      writeFileSync(
        join(folioRoot, "my-folio.json"),
        JSON.stringify({
          name: "my-folio",
          directories: [{ id: "folio", path: "folio/", graphTypologies: ["folio"] }],
        }),
      );
      writeFileSync(
        join(folioRoot, "my-folio.config.json"),
        JSON.stringify({
          dependencies: {
            folioAssistant: [{ name: "upstream-dep", path: "../upstream-dep" }],
          },
        }),
      );
      const sha = "a".repeat(40);
      const sha256 = "b".repeat(64);
      writeFileSync(
        join(folioRoot, "index.lock.json"),
        JSON.stringify({
          $schema: "cat-harness-mount-lock/v1",
          mounts: [{ harness: "mounted-layer", repository: "litlfred/mounted-layer", ref: sha }],
          instances: [
            {
              instance: "mounted-layer",
              repository: "litlfred/mounted-layer",
              sha,
              upstreamRoot: "",
              path: "mounts/mounted-layer",
              via: "mounted-layer",
              pinnedBy: "declared",
              declaration: { file: "mounted-layer.json", sha256 },
              directories: [],
            },
          ],
          unmounted: [],
        }),
      );

      const loaded = loadedDocumentKinds(folioRoot);
      expect(loaded.map(qualifiedKind).sort()).toEqual(["mounted-layer:programme", "upstream-dep:l1"]);

      const r1 = createDocument({ root: folioRoot, kind: "programme", slug: "anc-programme", title: "ANC programme" });
      expect(r1).toEqual({ path: join(folioRoot, "folio", "anc-programme", "index.md") });
      expect(readFileSync(join(folioRoot, "folio", "anc-programme", "index.md"), "utf-8")).toContain(
        'documentKind: "mounted-layer:programme"',
      );

      const r2 = createDocument({ root: folioRoot, kind: "upstream-dep:l1", slug: "anc-l1", title: "ANC L1" });
      expect(r2).toEqual({ path: join(folioRoot, "folio", "anc-l1", "index.md") });
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe("linkDocument", () => {
  test("writes <library>/<slug>/referenced.json and manifest.jsonld that pass ReferencedSourceSchema and checkEntry", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-link-"));
    try {
      const r = linkDocument({
        root,
        slug: "upstream-overview",
        title: "Upstream overview",
        url: "https://example.org/upstream-ig/",
        date: "2026-10-30",
      });
      expect("error" in r).toBe(false);
      if ("error" in r) return;
      expect(r.path).toBe(join(root, "library", "upstream-overview", "referenced.json"));
      expect(r.manifestPath).toBe(join(root, "library", "upstream-overview", "manifest.jsonld"));

      const rawRef = JSON.parse(readFileSync(r.path, "utf-8"));
      const parsed = ReferencedSourceSchema.safeParse(rawRef);
      expect(parsed.success).toBe(true);
      expect(rawRef.materialization.state).toBe("referenced");
      expect(rawRef.links).toEqual([
        { label: "upstream document", url: "https://example.org/upstream-ig/" },
      ]);

      const manifest = JSON.parse(readFileSync(r.manifestPath, "utf-8"));
      expect(manifest.title).toBe("Upstream overview");
      expect(manifest.contains).toEqual([]);
      expect(manifest.meta.disposition).toContain("referenced source");

      const report = checkEntry(join(root, "library", "upstream-overview"));
      const unmet = report.requirements.filter((q) => q.state === "unmet");
      expect(unmet).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("refuses to overwrite an existing library entry or accept a non-http(s) URL", () => {
    const root = mkdtempSync(join(tmpdir(), "folio-link-refuse-"));
    try {
      const first = linkDocument({
        root,
        slug: "ext-doc",
        title: "External Doc",
        url: "https://example.org/doc",
        date: "2026-10-30",
      });
      expect("error" in first).toBe(false);
      const second = linkDocument({
        root,
        slug: "ext-doc",
        title: "Duplicate",
        url: "https://example.org/other",
      });
      expect("error" in second && second.error).toContain("already exists");

      const badUrl = linkDocument({
        root,
        slug: "bad-url",
        title: "Bad URL",
        url: "javascript:alert(1)",
      });
      expect("error" in badUrl && badUrl.error).toContain("http:// or https://");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
