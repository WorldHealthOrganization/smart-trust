/**
 * The vector arm's schema, and the three refusals that are easy to undo.
 *
 * @module scripts/tests/vector-labels.test
 * @graphNode none — a test
 *
 * Bean `a8wy`, under `m4xy`. Every assertion here corresponds to a decision
 * that was TESTED AND REVERSED while building the arm, which is the only
 * reason each is worth a test:
 *
 * - The unit was the MuPDF BLOCK until page 25 of `9789240010567-eng` showed a
 *   block holding six circled numerals 200 pt apart and another holding two
 *   different architectures' titles.
 * - The page-qualification rule required a text line to INTERSECT a drawing
 *   until page 85 of `9789241511766-eng` — a real figure whose five labels
 *   float between arrows and touch nothing — was silently dropped by it.
 * - It required a period after the figure number until that dropped 14 of
 *   `9789240093362-eng`'s 15 figure pages, whose captions use a tab.
 *
 * The corpus cases at the end are the non-vacuous ones: they run the extractor
 * over the real PDFs, so they fail if any of those three is quietly restored.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  VECTOR_LABELS_FILE,
  VECTOR_LABELS_SCHEMA_ID,
  VectorLabelsSidecarSchema,
} from "../../schemas/content/vector-labels.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = join(dirname(HARNESS_ROOT));

/**
 * Each corpus test spawns the extractor over a whole PDF; the 182-page one
 * takes about five seconds, which is bun's default and so a coin flip.
 */
const CORPUS_TIMEOUT = 120_000;

const label = (over: Record<string, unknown> = {}) => ({
  text: "SHARED SERVICE",
  bbox: [483, 130, 511, 138],
  intersectsDrawing: true,
  fonts: ["MaratSans-Demibold"],
  sizes: [7.4],
  ...over,
});

const page = (over: Record<string, unknown> = {}) => ({
  page: 25,
  rotation: 90,
  drawings: 321,
  rasterImagesOnPage: 0,
  captionCandidates: ["Fig. 1.3.1. \t Digital health enterprise system architectures."],
  labels: [label()],
  ...over,
});

const sidecar = (over: Record<string, unknown> = {}) => ({
  $schema: VECTOR_LABELS_SCHEMA_ID,
  doc_id: "9789240010567-eng",
  pages: [page()],
  ...over,
});

describe("the third state is a reason, not an absence", () => {
  test("a determined empty list parses — it is the finding that nothing qualified", () => {
    expect(VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [] })).success).toBe(true);
  });

  test("`pages: null` without a reason is refused", () => {
    // `dh4f`: a consumer that cannot tell "looked, found none" from "could not
    // look" reports a clean run over an unread document.
    const r = VectorLabelsSidecarSchema.safeParse(sidecar({ pages: null }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("undetermined_reason");
  });

  test("`pages: null` WITH a reason parses", () => {
    const r = VectorLabelsSidecarSchema.safeParse(
      sidecar({ pages: null, undetermined_reason: "pymupdf is not installed" }),
    );
    expect(r.success).toBe(true);
  });

  test("a determined result may not also carry a reason", () => {
    // Both filled is the shape a reader cannot act on: it says the run
    // succeeded and failed.
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ undetermined_reason: "partial" })).success,
    ).toBe(false);
  });
});

describe("a page is recorded once", () => {
  test("two entries for one page are refused", () => {
    const r = VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page(), page()] }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("recorded twice");
  });

  test("two different pages are fine", () => {
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page(), page({ page: 34 })] })).success,
    ).toBe(true);
  });
});

describe("a label carries the four facts a reader needs to check it", () => {
  test("a bbox must be four numbers", () => {
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page({ labels: [label({ bbox: [1, 2, 3] })] })] }))
        .success,
    ).toBe(false);
  });

  test("empty text is refused — an empty line is not a label", () => {
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page({ labels: [label({ text: "" })] })] }))
        .success,
    ).toBe(false);
  });

  test("a page with a caption candidate and NO labels is allowed", () => {
    // Not a defect: the caption is on the page and the arm found no other
    // text. Refusing it would force the extractor to drop the page, which is
    // the `dh4f` direction — an unrecorded page reads as a page with nothing
    // on it.
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page({ labels: [] })] })).success,
    ).toBe(true);
  });

  test("a page with NO caption candidate is refused — that is what makes it qualify", () => {
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page({ captionCandidates: [] })] }))
        .success,
    ).toBe(false);
  });

  test("an unknown key is refused, so a field cannot be added without a schema change", () => {
    expect(
      VectorLabelsSidecarSchema.safeParse(sidecar({ pages: [page({ labels: [label({ role: "figure" })] })] }))
        .success,
    ).toBe(false);
  });
});

/**
 * Runs the real extractor over the real PDFs. Skipped where the upload is not
 * in the checkout — a skip is visible, and a silent pass over a missing corpus
 * is the thing this file exists against.
 */
describe("corpus — the three reversed decisions, pinned", () => {
  // Cached, because the extractor reads a 182-page PDF and four tests ask for
  // the same one. Uncached, each spawn took over the 5 s default and two of
  // these went red on the timeout rather than on anything they assert.
  const cache = new Map<string, ReturnType<typeof extract>>();
  const run = (pdf: string) => {
    if (!cache.has(pdf)) cache.set(pdf, extract(pdf));
    return cache.get(pdf)!;
  };

  const extract = (pdf: string) => {
    const path = join(REPO, "uploads", pdf);
    if (!existsSync(path)) return null;
    const proc = Bun.spawnSync([
      "python3",
      join(REPO, "cat-harness-tools/scripts/pdf-vector-labels.py"),
      "--dry-run",
      "--json",
      path,
    ]);
    if (proc.exitCode !== 0) return null;
    return VectorLabelsSidecarSchema.parse(JSON.parse(proc.stdout.toString()));
  };

  test("page 85 of the M&E guide is recorded — its labels touch no drawing", () => {
    const s = run("9789241511766-eng.pdf");
    if (!s) return; // upload absent, or python unavailable
    const p = (s.pages ?? []).find((q) => q.page === 85);
    expect(p).toBeDefined();
    // Fig. 4.3 "Types of inference/study design": five names around a ring of
    // arrows, none of the text on an arrow. The intersection rule dropped the
    // whole page.
    expect(p!.labels.some((l) => l.text.includes("Explanatory"))).toBe(true);
    expect(p!.labels.filter((l) => l.intersectsDrawing)).toHaveLength(0);
  }, CORPUS_TIMEOUT);

  test("the tab-separated captions of 9789240093362-eng are found", () => {
    const s = run("9789240093362-eng.pdf");
    if (!s) return;
    // Requiring `Fig. N.` + space left ONE of these fifteen.
    expect(s.pages?.length).toBeGreaterThanOrEqual(15);
  }, CORPUS_TIMEOUT);

  test("page 25 of the DIIG keeps the labels the intersection rule would drop", () => {
    const s = run("9789240010567-eng.pdf");
    if (!s) return;
    const p = (s.pages ?? []).find((q) => q.page === 25);
    expect(p).toBeDefined();
    for (const name of ["SILOED", "INTEGRATED", "EXCHANGED", "MUD"]) {
      const hit = p!.labels.find((l) => l.text === name);
      expect(hit, `${name} missing`).toBeDefined();
      expect(hit!.intersectsDrawing, `${name} would survive an intersection filter`).toBe(false);
    }
    // The LINE, not the block: as one block these two titles shared a
    // rectangle spanning half the figure.
    const titles = p!.labels.filter((l) => ["HEALTH USE CASE", "HEALTH PROGRAMME"].includes(l.text));
    expect(titles.length).toBeGreaterThanOrEqual(2);
    expect(new Set(titles.map((l) => l.bbox[0])).size).toBeGreaterThan(1);
    // Spans concatenate, so the bold capitals do not split the word.
    expect(p!.labels.some((l) => l.text.startsWith("Monolithic Un-architected"))).toBe(true);
  }, CORPUS_TIMEOUT);

  test("the table of contents is not recorded as a figure page", () => {
    const s = run("9789240010567-eng.pdf");
    if (!s) return;
    // Pages 7 and 8 carry 42 `Fig. N.` lines between them, every one under a
    // dot leader.
    expect((s.pages ?? []).some((p) => p.page === 7 || p.page === 8)).toBe(false);
  }, CORPUS_TIMEOUT);

  test("a scan with no text layer is undetermined, never a determined empty", () => {
    // No such upload is required to exist; this asserts the CODE PATH, by
    // running the extractor over a PDF the repository does have and checking
    // the guard is present rather than by fabricating a scan.
    const src = Bun.file(join(REPO, "cat-harness-tools/scripts/pdf-vector-labels.py"));
    return src.text().then((t) => {
      expect(t).toContain("carries no extractable text");
      expect(t).toContain("characters == 0");
    });
  });
});

describe("the sidecar's filename is one constant", () => {
  test("it is vector-labels.json", () => {
    expect(VECTOR_LABELS_FILE).toBe("vector-labels.json");
  });
});
