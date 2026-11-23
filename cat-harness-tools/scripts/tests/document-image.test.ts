/**
 * The image schema, and its agreement with the extractor. Bean `d5f1`.
 *
 * The interesting tests here are the two refinements, because they encode the
 * measurement rather than a preference: a decided role must show its working,
 * and only a figure may carry a narrative. Of 164 placed images in this corpus
 * 140 are page scans, so a schema that let every image carry a description
 * would invite 140 narratives reading "a scanned page".
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { blockRefIn, buildDocumentNodes, orphanedBlocks } from "../../pipeline/gen-library-jsonld.ts";
import {
  DESCRIBABLE_ROLES,
  requiresInspection,
  DocumentImageSchema,
  IMAGE_ROLES,
  ImagesSidecarSchema,
  PAGE_COVERAGE_THRESHOLD,
  roleFor,
  SETTLED_BY_COMPUTATION,
  withEmptyNarrative,
  type DocumentImage,
} from "../../schemas/content/document-image.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import { narrativeFor } from "../../schemas/content/narrative.ts";

const ROOT = resolve(HARNESS_ROOT);

/** A decided figure entry; spread by the cases that vary one field. */
const FIGURE: DocumentImage = {
  id: "img-p007-1",
  file: "images/img-p007-1.png",
  role: "figure",
  basis: { method: "geometry" as const, coverage: 0.013, imagesOnPage: 3, page: 7 },
};

describe("what geometry implies", () => {
  test("a near-full-bleed image alone on its page is the page", () => {
    expect(roleFor({ method: "geometry", coverage: 0.998, imagesOnPage: 1, page: 1 })).toBe("page-scan");
  });

  test("the half-page figure measured in 9789241548960_eng is a figure", () => {
    // 0.495, and the threshold is 0.80. The corpus has NOTHING between 0.50
    // and 0.99, which is why the line can sit where it does.
    expect(roleFor({ method: "geometry", coverage: 0.495, imagesOnPage: 1, page: 12 })).toBe("figure");
  });

  test("a full-bleed image SHARING its page is not the page", () => {
    // Something else is on that page, so the image is not the page itself.
    expect(roleFor({ method: "geometry", coverage: 0.998, imagesOnPage: 2, page: 3 })).toBe("figure");
  });

  test("the threshold is a boundary, not a vibe", () => {
    expect(roleFor({ method: "geometry", coverage: PAGE_COVERAGE_THRESHOLD, imagesOnPage: 1, page: 1 })).toBe("page-scan");
    expect(roleFor({ method: "geometry", coverage: PAGE_COVERAGE_THRESHOLD - 1e-9, imagesOnPage: 1, page: 1 })).toBe("figure");
  });

  test("no basis is UNDETERMINED, never a default role", () => {
    // The expensive direction: an image wrongly filed as `page-scan` is
    // dropped silently from every later description pass.
    expect(roleFor(undefined)).toBe("undetermined");
    expect(IMAGE_ROLES).toContain("undetermined");
  });
});

describe("a verdict must show its working", () => {
  test("a decided role with no basis is refused", () => {
    const { basis: _drop, ...noBasis } = FIGURE;
    const r = DocumentImageSchema.safeParse(noBasis);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/basis|working/);
  });

  test("`undetermined` WITH a basis is also refused", () => {
    // Symmetric on purpose. A basis implies the geometry was read, and if it
    // was read the role is decidable — so the pair is incoherent.
    const r = DocumentImageSchema.safeParse({ ...FIGURE, role: "undetermined" });
    expect(r.success).toBe(false);
  });

  test("undetermined without a basis is fine", () => {
    const { basis: _drop, ...bare } = FIGURE;
    expect(DocumentImageSchema.safeParse({ ...bare, role: "undetermined" }).success).toBe(true);
  });
});

describe("only a figure is worth describing", () => {
  test("a page scan carrying a narrative is refused", () => {
    const r = DocumentImageSchema.safeParse({
      ...FIGURE,
      role: "page-scan",
      basis: { method: "geometry" as const, coverage: 0.998, imagesOnPage: 1, page: 4 },
      narrative: { text: null, state: "not-authored" },
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/scanned page/);
  });

  test("a figure carrying one is accepted", () => {
    const r = DocumentImageSchema.safeParse({
      ...FIGURE,
      narrative: { text: null, state: "not-authored" },
    });
    expect(r.success).toBe(true);
  });

  test("`withEmptyNarrative` gives a slot to figures and to nothing else", () => {
    const emptied = withEmptyNarrative(FIGURE).narrative;
    expect(emptied && narrativeFor(emptied).state).toBe("not-authored");
    const scan: DocumentImage = {
      ...FIGURE, role: "page-scan", basis: { method: "geometry" as const, coverage: 0.998, imagesOnPage: 1, page: 4 },
    };
    expect(withEmptyNarrative(scan).narrative).toBeUndefined();
  });

  test("DESCRIBABLE_ROLES is derived, and excludes the two that earn nothing", () => {
    // Derived from IMAGE_ROLES rather than listed, so a role added to the
    // union cannot quietly become describable. Widened 2026-09-20: a `logo`
    // and a `decorative` photograph DO earn a description, because a reader
    // on a screen reader still needs to know whose mark is on the page.
    expect(DESCRIBABLE_ROLES).toEqual(["figure", "logo", "decorative"]);
    // A page scan's text is already extracted; nothing is known about an
    // undetermined image yet. Neither earns one.
    expect(DESCRIBABLE_ROLES).not.toContain("page-scan");
    expect(DESCRIBABLE_ROLES).not.toContain("undetermined");
  });
});

describe("could-not-determine is not emptiness", () => {
  test("`images: null` must say why", () => {
    const r = ImagesSidecarSchema.safeParse({
      $schema: "folio-document-images/v1", doc_id: "x", images: null,
    });
    expect(r.success).toBe(false);
  });

  test("an empty array is a FINDING and needs no reason", () => {
    // "This document places no images" is a determined answer. Conflating it
    // with "could not look" is the failure this pair exists to prevent.
    expect(ImagesSidecarSchema.safeParse({
      $schema: "folio-document-images/v1", doc_id: "x", images: [],
    }).success).toBe(true);
  });

  test("a reason WITHOUT null is refused", () => {
    expect(ImagesSidecarSchema.safeParse({
      $schema: "folio-document-images/v1", doc_id: "x", images: [],
      undetermined_reason: "some reason",
    }).success).toBe(false);
  });
});

describe("the extractor's real output satisfies the schema", () => {
  // Fixtures prove the schema is self-consistent. Only real output proves the
  // Python writer and the TypeScript reader agree — which is the join that
  // silently broke twice already today, once in an outline regex and once in
  // a probe fixture.
  const pdf = join(ROOT, "uploads", "milnorlink.pdf");
  // Never a silent pass: without the PDF the extractor arm does not run, and
  // the run reports a skip rather than a pass.
  const NO_PDF = !existsSync(pdf);

  test.skipIf(NO_PDF)("milnorlink's sidecar parses, and is 19 scans + 1 figure", () => {
    const r = Bun.spawnSync([
      "python3", join(TOOLS_ROOT, "scripts", "pdf-images.py"),
      "-o", join(ROOT, "library"), "--dry-run", "--json", pdf,
    ]);
    const out = new TextDecoder().decode(r.stdout).trim();

    // NO fallback-and-skip here. An earlier draft of this test quietly
    // returned when stdout held no JSON, which would have passed against a
    // broken extractor — the exact vacuity this suite keeps finding elsewhere.
    // If the backend is missing the sidecar still parses, as `images: null`
    // with a reason, and that is asserted rather than skipped.
    expect(r.exitCode === 0 || r.exitCode === 2).toBe(true);
    const parsed = ImagesSidecarSchema.safeParse(JSON.parse(out));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const images = parsed.data.images;
    if (images === null) {
      // Could-not-determine is a legitimate result, and must say why.
      expect(parsed.data.undetermined_reason).toBeTruthy();
      console.log("  NOTE no PDF backend — asserted the undetermined shape instead");
      return;
    }
    expect(images.filter((i) => i.role === "page-scan")).toHaveLength(19);
    expect(images.filter((i) => i.role === "figure")).toHaveLength(1);
    // Every decided entry shows its working, on REAL output.
    for (const i of images) expect(i.basis !== undefined).toBe(i.role !== "undetermined");
  });
});

describe("figures reach the manifest as blocks", () => {
  // Bean `d5f1`. Measured against `wpr-rdo-2020-003-eng`, whose 21 figures sit
  // on pages 8, 9, 10, 26, 29, 30 and 31.
  /** A minimal StructureSection; only the page range matters to these tests. */
  const sec = (id: string, page: number) => ({
    id, number: null, title: id, level: 1,
    page_start: page, page_end: page, n_chars: 0, n_words: 0,
  });
  const structure = {
    doc_id: "d",
    sections: [
      sec("page-008", 8), sec("page-009", 9), sec("page-012", 12),
    ],
  };
  const sidecar = {
    $schema: "folio-document-images/v1" as const,
    doc_id: "d",
    images: [
      { id: "img-p008-1", file: "images/img-p008-1.png", role: "figure" as const,
        basis: { method: "geometry" as const, coverage: 0.005, imagesOnPage: 4, page: 8 },
        narrative: { text: null, state: "not-authored" as const } },
      { id: "img-p009-1", file: "images/img-p009-1.png", role: "figure" as const,
        basis: { method: "geometry" as const, coverage: 0.01, imagesOnPage: 1, page: 9 } },
      // A page scan on a page that HAS a section. Must not become a block.
      { id: "img-p012-1", file: "images/img-p012-1.png", role: "page-scan" as const,
        basis: { method: "geometry" as const, coverage: 0.998, imagesOnPage: 1, page: 12 } },
    ],
  };
  const build = (images?: typeof sidecar) =>
    buildDocumentNodes("d", structure, undefined, () => false, images);

  test("a figure becomes a block, typed as a figure in both vocabularies", () => {
    const f = build(sidecar).find((o) => o.path === "blocks/figure-img-p008-1.jsonld");
    expect(f).toBeDefined();
    const node = JSON.parse(f!.content);
    expect(node.kind).toBe("figure");
    expect(node["@type"]).toEqual(["folio-assistant-core:Figure", "doco:Figure"]);
    // Relative to the BLOCK, as prose's `text` already is.
    expect(node.file).toBe("../images/img-p008-1.png");
    expect(node.pageStart).toBe(8);
  });

  test("a PAGE SCAN never becomes a block, even on a page that has a section", () => {
    // The measurement, enforced at the last step: 140 of 164 placed images in
    // this corpus are scans, and a block for each would be 140 figure nodes
    // describing pages.
    const paths = build(sidecar).map((o) => o.path);
    expect(paths).not.toContain("blocks/figure-img-p012-1.jsonld");
    expect(paths.filter((p) => p.startsWith("blocks/figure-"))).toHaveLength(2);
  });

  test("the figure is contained by the section whose pages hold it", () => {
    const sec = build(sidecar).find((o) => o.path === "sections/page-008.jsonld");
    const node = JSON.parse(sec!.content);
    expect(node.contains).toContain("library/d/blocks/figure-img-p008-1");
    const other = JSON.parse(
      build(sidecar).find((o) => o.path === "sections/page-009.jsonld")!.content,
    );
    expect(other.contains).not.toContain("library/d/blocks/figure-img-p008-1");
  });

  test("narrative STATE travels, so absence is distinguishable from rejection", () => {
    const withN = JSON.parse(
      build(sidecar).find((o) => o.path === "blocks/figure-img-p008-1.jsonld")!.content,
    );
    expect(withN.narrative).toEqual({ text: null, state: "not-authored" });
    // And a figure carrying none says nothing rather than inventing a state.
    const without = JSON.parse(
      build(sidecar).find((o) => o.path === "blocks/figure-img-p009-1.jsonld")!.content,
    );
    expect(without.narrative).toBeUndefined();
  });

  test("no sidecar means no figure blocks — and no crash", () => {
    // `images.json` is absent for every document ingested before `d5f1`.
    expect(build(undefined).map((o) => o.path).filter((p) => p.includes("figure-"))).toEqual([]);
  });
});

describe("a judgement is not a measurement", () => {
  // Bean `d5f1`, 2026-09-20. Geometry gives ONE bit: is this the page, or
  // something on it. Of the 24 images it called `figure` across this corpus,
  // 2 were real figures, 12 were organisation logos, 8 were photographs (7
  // of them the same picture at seven sizes) and 2 were unreplaced template
  // text. No measurement of a placed rectangle separates those.
  const INSPECTED = {
    method: "inspection" as const,
    by: { kind: "agent" as const, id: "claude", model: "claude-opus-5" },
    at: "2026-09-20",
    saw: "the WHO emblem and wordmark",
    page: 9,
  };
  const GEOMETRY = { method: "geometry" as const, coverage: 0.01, imagesOnPage: 4, page: 9 };

  test("a `logo` backed by geometry is refused", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p009-2", file: "images/img-p009-2.png", role: "logo", basis: GEOMETRY,
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/looking|emblem/);
  });

  test("...and backed by inspection is accepted", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p009-2", file: "images/img-p009-2.png", role: "logo", basis: INSPECTED,
    });
    expect(r.success).toBe(true);
  });

  test("`decorative` is the same — unreachable from a rectangle", () => {
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "decorative", basis: GEOMETRY,
    }).success).toBe(false);
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "decorative", basis: { ...INSPECTED, saw: "children on a dirt road" },
    }).success).toBe(true);
  });

  test("`figure` and `page-scan` still accept geometry — the cheap path stays", () => {
    // The inspection rule must not make the total, automatic classification
    // unavailable; it only stops geometry claiming what it cannot see.
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "figure", basis: GEOMETRY,
    }).success).toBe(true);
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "page-scan",
      basis: { method: "geometry" as const, coverage: 0.998, imagesOnPage: 1, page: 4 },
    }).success).toBe(true);
  });

  test("an inspection must name WHO looked, and an agent must name its model", () => {
    // `attribution.ts` already enforces the model rule; this pins that the
    // inspection basis is bound by it rather than carrying a bare string.
    const noModel = {
      ...INSPECTED, by: { kind: "agent" as const, id: "claude" },
    };
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "logo", basis: noModel,
    }).success).toBe(false);
  });

  test("an inspection must say what was SEEN — the reason, not the description", () => {
    const { saw: _drop, ...noSaw } = INSPECTED;
    expect(DocumentImageSchema.safeParse({
      id: "x", file: "x.png", role: "logo", basis: noSaw,
    }).success).toBe(false);
  });

  test("roleFor cannot be handed an inspection basis at all", () => {
    // Compile-time, really: `roleFor` takes GeometryBasis. This pins the
    // behaviour that matters — it never returns an inspection-only role.
    expect(requiresInspection(roleFor(GEOMETRY))).toBe(false);
    expect(requiresInspection("logo")).toBe(true);
    expect(requiresInspection("figure")).toBe(false);
  });
});

describe("generated blocks nothing points at", () => {
  // Bean `d5f1`. The generator writes and never removed, so a block whose
  // subject stopped qualifying stayed on disk. Reclassifying 22 of 24 images
  // from `figure` to `logo`/`decorative` left 22 orphans on the real corpus —
  // one of them asserting the JSTOR publisher mark is a figure of Milnor's
  // paper. Nothing referenced them, so nothing failed.
  const fs = (files: Record<string, string[]>, texts: Record<string, string>) => ({
    list: (d: string) => files[d] ?? [],
    read: (f: string) => texts[f],
  });

  test("a block no section contains is reported", () => {
    const { list, read } = fs(
      { "d/sections": ["s1.jsonld"], "d/blocks": ["figure-a.jsonld", "figure-b.jsonld"] },
      { "d/sections/s1.jsonld": JSON.stringify({ contains: ["library/d/blocks/figure-a"] }) },
    );
    expect(orphanedBlocks("d", list, read)).toEqual(["figure-b"]);
  });

  test("a block that IS contained is not", () => {
    const { list, read } = fs(
      { "d/sections": ["s1.jsonld"], "d/blocks": ["figure-a.jsonld"] },
      { "d/sections/s1.jsonld": JSON.stringify({ contains: ["library/d/blocks/figure-a"] }) },
    );
    expect(orphanedBlocks("d", list, read)).toEqual([]);
  });

  test("an UNREADABLE section makes it refuse to judge, not report everything", () => {
    // The dangerous failure: if the reference set cannot be built, every block
    // looks orphaned and a `--prune` would delete the lot. Better to report
    // nothing than a deletable list computed from an unknown.
    const { list, read } = fs(
      { "d/sections": ["s1.jsonld"], "d/blocks": ["figure-a.jsonld", "figure-b.jsonld"] },
      { "d/sections/s1.jsonld": "{ not json" },
    );
    expect(orphanedBlocks("d", list, read)).toEqual([]);
  });

  test("no sections directory at all is a determined empty, not a refusal: its blocks are reported", () => {
    const { list, read } = fs({ "d/blocks": ["figure-a.jsonld"] }, {});
    // No sections means no references means everything looks orphaned. It is
    // reported, because an empty sections list is a DETERMINED empty — the
    // directory was listed and held nothing. The unreadable case above is the
    // undetermined one.
    expect(orphanedBlocks("d", list, read)).toEqual(["figure-a"]);
  });

  test("non-jsonld files in blocks/ are ignored", () => {
    const { list, read } = fs(
      { "d/sections": [], "d/blocks": ["figure-a.jsonld", "figure-a.md", "README"] },
      {},
    );
    expect(orphanedBlocks("d", list, read)).toEqual(["figure-a"]);
  });

  // ── bean `p67i`: a tabular entry has no `sections/` ────────────────────
  //
  // Scanning `sections/` alone was correct while every library entry was a
  // paged document. The moment `gen-library-jsonld` grew a tabular branch it
  // became a live hazard: a tabular entry's groupings are `sheets/`, and a
  // CSV has no grouping at all, so EVERY table block read as orphaned — and
  // `--prune` calls `rmSync` on what this reports, plus its `.md` sibling.

  test("a CSV's table, contained by the MANIFEST alone, is not orphaned", () => {
    // The `jg8s` shape: no sheet is invented for a CSV, so the manifest holds
    // the block directly and nothing sits between them.
    const { list, read } = fs(
      { "d/blocks": ["table-001.jsonld"] },
      { "d/manifest.jsonld": JSON.stringify({ contains: ["library/d/blocks/table-001"] }) },
    );
    expect(orphanedBlocks("d", list, read)).toEqual([]);
  });

  test("a workbook's table, contained through sheets/, is not orphaned", () => {
    const { list, read } = fs(
      { "d/sheets": ["sheet-001.jsonld"], "d/blocks": ["table-001.jsonld"] },
      {
        "d/manifest.jsonld": JSON.stringify({ contains: ["library/d/sheets/sheet-001"] }),
        "d/sheets/sheet-001.jsonld": JSON.stringify({ contains: ["library/d/blocks/table-001"] }),
      },
    );
    expect(orphanedBlocks("d", list, read)).toEqual([]);
  });

  test("a table nothing points at is STILL reported — the widening is not an amnesty", () => {
    const { list, read } = fs(
      { "d/sheets": ["sheet-001.jsonld"], "d/blocks": ["table-001.jsonld", "table-002.jsonld"] },
      {
        "d/manifest.jsonld": JSON.stringify({ contains: ["library/d/sheets/sheet-001"] }),
        "d/sheets/sheet-001.jsonld": JSON.stringify({ contains: ["library/d/blocks/table-001"] }),
      },
    );
    expect(orphanedBlocks("d", list, read)).toEqual(["table-002"]);
  });

  test("an UNREADABLE manifest is the same refusal an unreadable section is", () => {
    const { list, read } = fs(
      { "d/blocks": ["table-001.jsonld"] },
      { "d/manifest.jsonld": "{ not json" },
    );
    expect(orphanedBlocks("d", list, read)).toEqual([]);
  });

  test("a manifest pointing at SECTIONS adds no block reference", () => {
    // The manifest is now scanned for every entry, and a paged manifest holds
    // section ids. Taking the last path segment would enter `page-001` into
    // the block reference set, where it would mask a block of that name.
    const { list, read } = fs(
      { "d/sections": [], "d/blocks": ["page-001.jsonld"] },
      { "d/manifest.jsonld": JSON.stringify({ contains: ["library/d/sections/page-001"] }) },
    );
    expect(orphanedBlocks("d", list, read)).toEqual(["page-001"]);
  });
});

describe("blockRefIn — only a reference that names a block is one", () => {
  test("a block reference yields its id", () => {
    expect(blockRefIn("library/d/blocks/table-001")).toBe("table-001");
  });
  test("a section reference yields nothing", () => {
    expect(blockRefIn("library/d/sections/page-001")).toBeUndefined();
  });
  test("a sheet reference yields nothing", () => {
    expect(blockRefIn("library/d/sheets/sheet-001")).toBeUndefined();
  });
  test("a bare id, with no directory to judge by, yields nothing", () => {
    expect(blockRefIn("table-001")).toBeUndefined();
  });
});

/**
 * The OPTIONAL role threshold — bean `ay3x`. Owner, 2026-10-03, verbatim: "an
 * optional one can be set, default none". The value used here is arbitrary
 * and recommends nothing; `library-ingestion` forbids shipping one that does.
 */
describe("a caller-supplied threshold reaches `furniture`, and only it does", () => {
  const thresholdBasis = { method: "threshold", value: 0.5, suppliedBy: "caller", coverage: 0.1, imagesOnPage: 2, page: 4 };

  test("`furniture` on a threshold basis is accepted", () => {
    expect(DocumentImageSchema.safeParse({ id: "i", file: "f.png", role: "furniture", basis: thresholdBasis }).success).toBe(true);
  });

  test("`furniture` on any other basis is refused — the cutoff's call cannot be forged", () => {
    for (const basis of [
      { method: "geometry", coverage: 0.1, imagesOnPage: 2, page: 4 },
      { method: "inspection", by: { kind: "human", id: "x" }, at: "2026-10-03", saw: "s", page: 4 },
    ]) {
      expect(DocumentImageSchema.safeParse({ id: "i", file: "f.png", role: "furniture", basis }).success).toBe(false);
    }
  });

  test("a threshold basis decides nothing but `furniture`", () => {
    expect(DocumentImageSchema.safeParse({ id: "i", file: "f.png", role: "figure", basis: thresholdBasis }).success).toBe(false);
  });

  test("the basis must say the CALLER supplied it", () => {
    const forged = { ...thresholdBasis, suppliedBy: "inspector" };
    expect(DocumentImageSchema.safeParse({ id: "i", file: "f.png", role: "furniture", basis: forged }).success).toBe(false);
  });

  test("`furniture` is settled and owes no narrative", () => {
    expect(SETTLED_BY_COMPUTATION).toContain("furniture");
    expect(DESCRIBABLE_ROLES).not.toContain("furniture");
  });
});
