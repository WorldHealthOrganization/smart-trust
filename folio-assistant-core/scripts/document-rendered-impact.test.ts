/**
 * The document folio's rendered impact (bean `bnjs`), read from a ChangeSet and
 * an outline as the staging build publishes them, never from source. The
 * real-folio acceptance case is recorded in the bean: litlfred/smart-ra, one
 * block sentence plus one chapter title, predicted 2 / measured 2 / 0 missed.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { reviewList } from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.js";
import { CHANGESET_SCHEMA, type ChangeSet } from "../schemas/changeset.js";
import {
  documentRenderedImpact,
  DOCUMENT_RENDERER,
  PUBLIC_COMMENT_RENDERER,
  LIBRARY_RENDERER,
  libraryOf,
  buildSteps,
  siteMayRead,
  siteReadsOf,
  type SiteReads,
} from "./document-rendered-impact.js";

const at = (file: string) => ({ file, kind: "prose", section: "doc/ch1::s1", index: 0 });
const changeset: ChangeSet = {
  $schema: CHANGESET_SCHEMA,
  folio: "folio",
  base: { ref: "main", commit: "a".repeat(40) },
  head: { ref: "HEAD", commit: "b".repeat(40) },
  summary: { added: 1, removed: 1, changed: 1, unchanged: 9, renamed: 0, prose: 1, manifest: 0, moved: 0 },
  changes: [
    { change: "changed", label: "prose:edited", aspects: ["prose"], base: at("doc/ch1/p-1.ts"), head: at("doc/ch1/p-1.ts") },
    { change: "added", label: "prose:new", head: at("doc/ch1/p-2.ts") },
    { change: "removed", label: "prose:gone", base: at("other/ch1/p-9.ts") },
  ],
};
const outline = { documents: [{ slug: "doc" }, { slug: "other" }] };
const run = (changed: string[], site?: string) => documentRenderedImpact({ changed, changeset, outline, ...(site ? { site } : {}) });
const line = (f: { role: string; path: string; anchors?: string[] }) => `${f.role}:${f.path}${f.anchors ? "#" + f.anchors.join(",") : ""}`;

describe("documentRenderedImpact — blocks, from the ChangeSet", () => {
  test("blocksLandOnOwnPage", () => {
    const [doc] = run(["folio/doc/ch1/p-1.md", "folio/doc/ch1/p-2.ts", "folio/other/ch1/p-9.ts"]);
    expect(doc.renderer).toBe(DOCUMENT_RENDERER);
    expect(doc.files.map(line)).toEqual(["content:en/doc/index.html#prose:edited,prose:new", "content:en/other/index.html#prose:gone"]);
    expect(doc.undetermined).toEqual([]);
  });

  test("reviewListLinksBlocks", () => {
    expect(reviewList(run(["folio/doc/ch1/p-1.md"])[0]).map(line)).toEqual(["content:en/doc/index.html#prose:edited"]);
  });

  test("sitePrefixPlacesPages", () => {
    expect(run(["folio/doc/ch1/p-1.ts"], "smart-ra")[0].files.map((f) => f.path)).toEqual(["smart-ra/en/doc/index.html"]);
  });
});

describe("documentRenderedImpact — files the ChangeSet does not name", () => {
  test("manifestMovesPageAndOutline", () => {
    expect(run(["folio/doc/ch1/ch1.ts"])[0].files.map(line)).toEqual(["content:en/doc/index.html", "index:outline.json"]);
    expect(run(["folio/doc/doc.ts"])[0].files.map(line)).toEqual(["content:en/doc/index.html", "index:index.html", "index:outline.json"]);
  });

  test("mediaIsFileAndPage", () => {
    expect(run(["folio/doc/media/fig1.png"])[0].files.map(line)).toEqual(["content:en/doc/index.html", "data:en/doc/media/fig1.png"]);
  });

  test("commentStoreReachesDashboard", () => {
    const out = run(["review/public-comment/comments/PC-0001.json"]);
    expect(out.map((i) => i.renderer)).toEqual([DOCUMENT_RENDERER, PUBLIC_COMMENT_RENDERER]);
    expect(out[1].files.map(line)).toEqual(["content:en/doc/index.html", "content:en/folio-assistant-core/public-comments/folio/doc/index.html", "content:en/folio-assistant-core/public-comments/folio/other/index.html", "content:en/other/index.html"]);
  });

  test("pagesUnderLocaleOutlineWins", () => {
    // An outline published before the locale names its page where it was, and
    // that is the page the change alters on that site.
    const old = { documents: [{ slug: "doc", page: "doc/index.html" }, { slug: "other", page: "other/index.html" }] };
    expect(documentRenderedImpact({ changed: ["folio/doc/ch1/p-1.md"], changeset, outline: old })[0].files.map(line)).toEqual(["content:doc/index.html#prose:edited"]);
    expect(documentRenderedImpact({ changed: ["folio/doc/media/fig1.png"], changeset, outline: old })[0].files.map(line)).toEqual(["content:doc/index.html", "data:doc/media/fig1.png"]);
    // No outline: where build-document-site puts the page now.
    expect(documentRenderedImpact({ changed: ["folio/doc/ch1/p-1.md"], changeset })[0].files.map(line)).toEqual(["content:en/doc/index.html#prose:edited"]);
  });

  test("elseUndeterminedAll", () => {
    const [doc] = run(["dpi-h-ra.config.json", "folio-assistant"]);
    expect(doc.files).toEqual([]);
    expect(doc.undetermined.map((u) => [u.input, u.scope])).toEqual([["dpi-h-ra.config.json", "all"], ["folio-assistant", "all"]]);
  });
});

describe("documentRenderedImpact — a file no builder of the site reads (bean ehh6)", () => {
  // smart-ra#26, the first real run: the branch's bean was "may change any
  // page", and an undetermined input holds the coverage gate shut.
  const reads: SiteReads = { reads: ["folio/", "library/", "review/public-comment/"], submodules: ["folio-assistant"] };
  const changed = ["beans/dpi-h-ra-7ss8--verify.md", "README.md", "input/fsh/x.fsh", "folio-assistant", "dpi-h-ra.json", "library/a.pdf", ".github/workflows/staging.yml"];

  test("unreadFileReachesNoPage", () => {
    const [doc] = documentRenderedImpact({ changed, changeset, outline, reads });
    expect(doc.inputs).toEqual([...changed].sort());
    expect(doc.files).toEqual([]);
    expect(doc.undetermined.map((u) => u.input).sort()).toEqual([".github/workflows/staging.yml", "dpi-h-ra.json", "folio-assistant", "library/a.pdf"]);
  });

  test("platformAndConfigMayBeRead", () => {
    for (const f of ["folio-assistant", "folio-assistant/cat-harness/x.ts", "library/a.pdf", ".github/x.yml", "package.json", "bun.lock"]) expect(siteMayRead(f, reads)).toBe(true);
    for (const f of ["beans/x.md", "AGENTS.md", "test/results/block-qa/x.json"]) expect(siteMayRead(f, reads)).toBe(false);
  });

  test("nothingDeclaredNothingExcluded", () => {
    expect(siteMayRead("beans/x.md", undefined)).toBe(true);
    expect(documentRenderedImpact({ changed: ["beans/x.md"], changeset, outline })[0].undetermined.map((u) => u.input)).toEqual(["beans/x.md"]);
  });

  describe("siteReadsOf: what the build command's builders say they read", () => {
    // smart-ra#26's second run: it DECLARED beans/ and todos/, so "declared"
    // read as "read", yet the site renders todos and never beans.
    const T = mkdtempSync(join(tmpdir(), "site-reads-"));
    afterAll(() => rmSync(T, { recursive: true, force: true }));
    const repo = (name: string, builders: Record<string, string> = {}) => {
      const r = join(T, name);
      mkdirSync(join(r, "b"), { recursive: true });
      writeFileSync(join(r, "x.json"), JSON.stringify({ name: "x", directories: [{ id: "folio", path: "folio/", graphTypologies: ["folio"] }, { id: "beans", path: "beans/", graphTypologies: ["bean-defs"] }] }));
      writeFileSync(join(r, ".gitmodules"), '[submodule "folio-assistant"]\n\tpath = folio-assistant\n\turl = https://example.invalid/fa.git\n');
      for (const [f, body] of Object.entries(builders)) writeFileSync(join(r, "b", f), body);
      return r;
    };

    test("buildStepsScriptsAndArgs", () => {
      expect(buildSteps("bun run a/x.ts --out _site && bun run y.ts --root . ; jekyll build")).toEqual([
        { script: "a/x.ts", args: ["--out", "_site"] },
        { script: "y.ts", args: ["--root", "."] },
        undefined,
      ]);
    });

    test("commandUnionOfReads", async () => {
      const r = repo("a", {
        "doc.ts": "export const siteReads = () => ['folio'];",
        "todo.ts": "export const siteReads = async (_r, args) => (args.includes('--todos') ? ['todos/items'] : []);",
      });
      const got = await siteReadsOf(r, "bun run b/doc.ts --out _site && bun run b/todo.ts --todos");
      expect(got).toEqual({ reads: ["folio", "todos/items"], submodules: ["folio-assistant"] });
      expect(siteMayRead("beans/x.md", got)).toBe(false);
      expect(siteMayRead("todos/items/a.md", got)).toBe(true);
    });

    test("nonBuilderExcludesNothing", async () => {
      const r = repo("b", { "dumb.ts": "export const x = 1;", "doc.ts": "export const siteReads = () => ['folio'];" });
      expect(await siteReadsOf(r, "bun run b/doc.ts && bun run b/dumb.ts")).toBeUndefined();
      expect(await siteReadsOf(r, "bun run b/doc.ts && jekyll build")).toBeUndefined();
      expect(await siteReadsOf(r, "bun run b/gone.ts")).toBeUndefined();
    });

    test("noCommandDeclaredDirs", async () => {
      expect(await siteReadsOf(repo("c"))).toEqual({ reads: ["folio/", "beans/"], submodules: ["folio-assistant"] });
    });

    test("noDeclarationUndefined", async () => {
      const r = join(T, "none");
      mkdirSync(r);
      expect(await siteReadsOf(r, "bun run x.ts")).toBeUndefined();
    });
  });
});

describe("documentRenderedImpact — a lazy page (bean v433)", () => {
  // `doc` is lazy: three chunks, the edited block in the first, the added one in the second.
  const lazyOutline = { documents: [{ slug: "doc", lazy: { hydrated: "en/doc/index.hydrated.html", chunks: 3, of: { "prose:edited": 0, "prose:new": 1 } } }, { slug: "other" }] };
  const runLazy = (changed: string[]) => documentRenderedImpact({ changed, changeset, outline: lazyOutline })[0];

  test("lazyTextEditChunkAndHydrated", () => {
    expect(runLazy(["folio/doc/ch1/p-1.md"]).files.map(line)).toEqual(["data:doc/blocks/000.json", "content:en/doc/index.hydrated.html#prose:edited"]);
  });

  test("lazyAddedBlockShiftsChunks", () => {
    expect(runLazy(["folio/doc/ch1/p-2.ts"]).files.map(line)).toEqual([
      "data:doc/blocks/001.json",
      "data:doc/blocks/002.json",
      "content:en/doc/index.html",
      "content:en/doc/index.hydrated.html#prose:new",
    ]);
  });

  test("nonLazyUnchanged", () => {
    expect(runLazy(["folio/other/ch1/p-9.ts"]).files.map(line)).toEqual(["content:en/other/index.html#prose:gone"]);
  });

  test("commentStoreReachesLazyNotes", () => {
    const pc = documentRenderedImpact({ changed: ["review/public-comment/comments/PC-1.json"], changeset, outline: lazyOutline })[1];
    expect(pc.files.map(line)).toContain("data:doc/pc-notes.json");
    expect(pc.files.map(line)).toContain("content:en/doc/index.hydrated.html");
  });
});

describe("documentRenderedImpact — a folio's library (library-site)", () => {
  const library = { dirs: ["library"], anchors: { "folio/doc/review-anchors.json": "library/v1" } };
  const lib = (changed: string[]) => documentRenderedImpact({ changed, changeset, outline, library });

  test("libraryStructureReachesPage", () => {
    const out = lib(["library/v1/structure.json", "library/v2/sections/s1.md"]);
    expect(out.map((i) => i.renderer)).toEqual([DOCUMENT_RENDERER, LIBRARY_RENDERER]);
    expect(out[0].undetermined).toEqual([]);
    expect(out[1].files.map(line).sort()).toEqual([
      "content:en/folio-assistant-core/library/v1/index.html",
      "data:folio-assistant-core/library/v1/entries/v1.doc.json",
      "data:folio-assistant-core/library/v2/entries/v2.doc.json",
      "index:en/folio-assistant-core/library/index.html",
    ]);
  });

  test("reviewAnchorsReachEntry", () => {
    const out = lib(["folio/doc/review-anchors.json"]);
    expect(out[0].undetermined).toEqual([]);
    expect(out[1].files.map(line)).toContain("data:folio-assistant-core/library/v1/entries/v1.doc.json");
  });

  test("libraryOfReadsDeclared", () => {
    const root = mkdtempSync(join(tmpdir(), "impact-lib-"));
    writeFileSync(join(root, "f.json"), JSON.stringify({ name: "f", directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }, { id: "folio", path: "folio/", graphTypologies: ["folio"] }] }));
    mkdirSync(join(root, "library", "v1"), { recursive: true });
    mkdirSync(join(root, "folio", "doc"), { recursive: true });
    writeFileSync(join(root, "folio", "doc", "review-anchors.json"), JSON.stringify({ $schema: "folio-review-anchors/v1", library: "v1", sections: [], blocks: [] }));
    expect(libraryOf(root, ["folio/doc/review-anchors.json"])).toEqual({ dirs: ["library"], anchors: { "folio/doc/review-anchors.json": "library/v1" } });
    rmSync(root, { recursive: true, force: true });
  });
});
