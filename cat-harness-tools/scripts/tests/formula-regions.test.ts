/**
 * Tests for the advisory formula-region arm (`scripts/pdf-formula-regions.py`,
 * bean `folio-assistant-f0hv`, `cat-harness-tools#131`).
 *
 * @module scripts/tests/formula-regions.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ENTRY_SIDECARS } from "../check-l1-complete.ts";
const TOOLS_ROOT = new URL("../..", import.meta.url).pathname;
const SCRIPT = join(TOOLS_ROOT, "scripts", "pdf-formula-regions.py");
const FIXTURE_DIR = join(
  TOOLS_ROOT,
  "test",
  "fixtures",
  "formula-regions",
  "tfd-icdar2019v2-emden76",
);
const DETECTIONS_FIXTURE = join(FIXTURE_DIR, "detections.json");
const TRUTH_FIXTURE = join(FIXTURE_DIR, "truth.json");

function run(cwd: string, ...args: string[]): { code: number; out: string; err: string } {
  const r = spawnSync("python3", ["-B", SCRIPT, ...args], { cwd, encoding: "utf-8" });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function withTmp(fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "formula-regions-"));
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("pdf-formula-regions.py (cat-harness-tools#131, bean f0hv)", () => {
  test("formula-regions.json is registered in ENTRY_SIDECARS as an advisory sidecar", () => {
    expect(ENTRY_SIDECARS).toContain("formula-regions.json");
  });

  test("reads recorded ScanSSD detections and emits an advisory sidecar in visible-frame PDF coordinates without touching sections/", () => {
    withTmp((root) => {
      const entry = join(root, "library", "emden76");
      const sectionsDir = join(entry, "sections");
      mkdirSync(sectionsDir, { recursive: true });
      const sectionPath = join(sectionsDir, "01-page-001.md");
      const originalSection = [
        "---",
        "title: Page 1",
        "page_start: 1",
        "page_end: 1",
        "text_source: pdftotext",
        "---",
        "",
        "Scanned page text that must never be modified by the formula-region arm.",
        "",
      ].join("\n");
      writeFileSync(sectionPath, originalSection, "utf-8");

      const res = run(
        root,
        "--entry",
        entry,
        "--detections",
        DETECTIONS_FIXTURE,
        "--json",
      );
      expect(res.code).toBe(0);

      // sections/ must remain byte-for-byte untouched
      expect(readFileSync(sectionPath, "utf-8")).toBe(originalSection);

      const sidecarPath = join(entry, "formula-regions.json");
      expect(existsSync(sidecarPath)).toBe(true);
      const sidecar = JSON.parse(readFileSync(sidecarPath, "utf-8"));

      expect(sidecar.$schema).toBe("folio-formula-regions/v1");
      expect(sidecar.doc_id).toBe("emden76");
      expect(sidecar.status).toBe("determined");
      expect(sidecar.advisory).toBe(true);
      expect(sidecar.detector.name).toBe("ScanSSD-XYc");
      expect(sidecar.detector.weights_file).toBe("ssd512GTDB_256_epoch15.pth");
      expect(sidecar.pages).toHaveLength(10);

      let totalRegions = 0;
      for (const page of sidecar.pages) {
        expect(page.rotation).toBe(0);
        expect(page.page_size_pt).toEqual([450, 684]);
        for (let i = 0; i < page.regions.length; i++) {
          const r = page.regions[i];
          totalRegions++;
          // Strict advisory contract: only bbox + confidence, never a transcription field
          expect(Object.keys(r).sort()).toEqual(["bbox", "confidence"]);
          expect(r.bbox).toHaveLength(4);
          const [x0, y0, x1, y1] = r.bbox;
          expect(x1).toBeGreaterThan(x0);
          expect(y1).toBeGreaterThan(y0);
          // Must be in 72 DPI PDF user space (450 x 684 pt), not 256 DPI pixels (1600 x 2432)
          expect(x0).toBeGreaterThanOrEqual(0);
          expect(y0).toBeGreaterThanOrEqual(0);
          expect(x1).toBeLessThanOrEqual(450);
          expect(y1).toBeLessThanOrEqual(684);
          expect(r.confidence).toBeGreaterThanOrEqual(0.5);
          expect(r.confidence).toBeLessThanOrEqual(1.0);

          if (i > 0) {
            const prev = page.regions[i - 1].bbox;
            const ordered = prev[1] < y0 || (prev[1] === y0 && prev[0] <= x0);
            expect(ordered).toBe(true);
          }
        }
      }
      expect(totalRegions).toBe(447);
    });
  });

  test("benchmark scores committed ScanSSD detections against TFD-ICDAR2019v2 Emden76 ground-truth boxes", () => {
    expect(existsSync(DETECTIONS_FIXTURE)).toBe(true);
    expect(existsSync(TRUTH_FIXTURE)).toBe(true);

    withTmp((root) => {
      const reportPath = join(root, "build", "emden76-score.json");
      const res = run(
        root,
        "score",
        "--detections",
        DETECTIONS_FIXTURE,
        "--truth",
        TRUTH_FIXTURE,
        "-o",
        reportPath,
        "--json",
      );
      expect(res.code).toBe(0);
      expect(existsSync(reportPath)).toBe(true);

      const report = JSON.parse(readFileSync(reportPath, "utf-8"));
      expect(report.$schema).toBe("folio-formula-region-benchmark/v1");
      expect(report.doc_id).toBe("tfd-icdar2019v2-emden76");
      expect(report.detector.weights_sha256).toBe(
        "2833e2e6417ce202e6e36ec06b01b25270ec2b6270c76869dae78b2c2cf4d937",
      );
      expect(report.truth_provenance.source_pdf_sha256).toBe(
        "911d2ff4a0a65a8d727c8db55431c5b75f5d9e5e72a2e051893505c8ac4051de",
      );

      expect(report.summary).toEqual({
        iou_threshold: 0.5,
        pages: 10,
        gt: 589,
        detected: 447,
        tp: 351,
        fp: 96,
        fn: 238,
        precision: 0.7852,
        recall: 0.5959,
        f1: 0.6776,
        mean_matched_iou: 0.8143,
      });

      expect(report.fine_iou_075).toEqual({
        iou_threshold: 0.75,
        pages: 10,
        gt: 589,
        detected: 447,
        tp: 278,
        fp: 169,
        fn: 311,
        precision: 0.6219,
        recall: 0.472,
        f1: 0.5367,
        mean_matched_iou: 0.8625,
      });
    });
  });

  test("transforms unrotated PDF boxes into the visible rotated frame (matching vector-labels.json)", () => {
    withTmp((root) => {
      const entry = join(root, "library", "rotated-doc");
      mkdirSync(entry, { recursive: true });
      const detPath = join(root, "rot-detections.json");
      // Unrotated page is 595 x 842 pt, rotated 90 deg clockwise -> visible frame is 842 x 595 pt.
      // Box [100, 200, 150, 240] in unrotated frame becomes [842 - 240, 100, 842 - 200, 150] = [602, 100, 642, 150].
      writeFileSync(
        detPath,
        JSON.stringify({
          $schema: "folio-formula-detections/v1",
          doc_id: "rotated-doc",
          pages: [
            {
              page: 1,
              rotation: 90,
              unrotated_page_size_pt: [595, 842],
              page_size_pt: [842, 595],
              coordinate_frame: "unrotated_pt",
              regions: [{ bbox: [100, 200, 150, 240], confidence: 0.91 }],
            },
          ],
        }),
        "utf-8",
      );

      const res = run(root, "--entry", entry, "--detections", detPath);
      expect(res.code).toBe(0);
      const sidecar = JSON.parse(readFileSync(join(entry, "formula-regions.json"), "utf-8"));
      expect(sidecar.pages[0].rotation).toBe(90);
      expect(sidecar.pages[0].regions[0].bbox).toEqual([602, 100, 642, 150]);
    });
  });

  test("records status: undetermined and pages: null (never an empty list) when no detector output is available", () => {
    withTmp((root) => {
      const entry = join(root, "library", "scan-no-weights");
      mkdirSync(entry, { recursive: true });

      const res = run(root, "--entry", entry);
      expect(res.code).toBe(2);

      const sidecar = JSON.parse(readFileSync(join(entry, "formula-regions.json"), "utf-8"));
      expect(sidecar.$schema).toBe("folio-formula-regions/v1");
      expect(sidecar.status).toBe("undetermined");
      expect(sidecar.pages).toBeNull();
      expect(typeof sidecar.undetermined_reason).toBe("string");
      expect(sidecar.undetermined_reason).toContain("NOT 'the document contains no formulas'");
    });
  });

  test("skips born-digital entries whose sections already carry text_source: latex unless --force is passed", () => {
    withTmp((root) => {
      const entry = join(root, "library", "arxiv-overlaid");
      const sectionsDir = join(entry, "sections");
      mkdirSync(sectionsDir, { recursive: true });
      writeFileSync(
        join(sectionsDir, "01-intro.md"),
        [
          "---",
          "title: Introduction",
          "page_start: 1",
          "page_end: 2",
          "text_source: latex",
          "---",
          "",
          "Already overlaid with $$E = mc^2$$ from LaTeX source.",
          "",
        ].join("\n"),
        "utf-8",
      );

      // Default without --force: skips
      const skipped = run(root, "--entry", entry, "--detections", DETECTIONS_FIXTURE);
      expect(skipped.code).toBe(0);
      const skippedSidecar = JSON.parse(readFileSync(join(entry, "formula-regions.json"), "utf-8"));
      expect(skippedSidecar.status).toBe("skipped");
      expect(skippedSidecar.pages).toBeNull();
      expect(skippedSidecar.undetermined_reason).toContain("text_source: latex");

      // With --force: runs and emits determined regions
      const forced = run(root, "--entry", entry, "--detections", DETECTIONS_FIXTURE, "--force");
      expect(forced.code).toBe(0);
      const forcedSidecar = JSON.parse(readFileSync(join(entry, "formula-regions.json"), "utf-8"));
      expect(forcedSidecar.status).toBe("determined");
      expect(forcedSidecar.pages).toHaveLength(10);
    });
  });

  test("score refuses to write its benchmark report into a declared graph path", () => {
    withTmp((root) => {
      writeFileSync(
        join(root, "instance.config.json"),
        JSON.stringify({
          name: "t",
          graphs: [{ kind: "content", path: "content" }],
        }),
        "utf-8",
      );
      const res = run(
        root,
        "score",
        "--detections",
        DETECTIONS_FIXTURE,
        "--truth",
        TRUTH_FIXTURE,
        "-o",
        "library/report.json",
      );
      expect(res.code).not.toBe(0);
      expect(res.err).toContain("declared graph directory");
    });
  });
});
