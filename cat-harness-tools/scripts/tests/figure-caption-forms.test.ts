/**
 * Figure captions written `Fig 1.` (no dot after `Fig`) are found.
 *
 * `9789240101197-eng`, the supply chain handbook, writes its captions as
 * `Fig 1. Public health supply chain partners and processes`. The three caption
 * patterns all required `Fig.` or `Figure`, so nine of its figure pages
 * (Figs. 1-4, 6-9, 12) were never rendered, and the folio built from it had no
 * blocks for them. These tests need no PDF: they run the patterns themselves.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { declaredFigureCaptions } from "../check-l1-complete.ts";

const SCRIPTS = join(import.meta.dir, "..");

/** Run `caption_candidates` and `LABEL` from the Python arms over some lines. */
function python(lines: string[]): { candidates: string[]; labels: (string | null)[] } {
  const code = `
import importlib.util, json, os, sys
d = sys.argv[1]
sys.path.insert(0, d)
def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(d, file))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
lab = load("pdf_vector_labels", "pdf-vector-labels.py")
fig = load("pdf_vector_figures", "pdf-vector-figures.py")
lines = json.loads(sys.argv[2])
blocks = [{"lines": [{"spans": [{"text": t}]}]} for t in lines]
cands = lab.caption_candidates(blocks)
labels = [(m.group(1) if (m := fig.LABEL.match(c)) else None) for c in cands]
print(json.dumps({"candidates": cands, "labels": labels}))
`;
  const r = spawnSync("python3", ["-I", "-B", "-c", code, SCRIPTS, JSON.stringify(lines)], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

/**
 * pdf-vector-figures.py needs PyMuPDF at import time; without it there is
 * nothing to run, and the test reports a skip rather than a pass.
 */
const NO_PYMUPDF = spawnSync("python3", ["-I", "-B", "-c", "import fitz"], { encoding: "utf-8" }).status !== 0;

describe("caption patterns accept `Fig N.`", () => {
  test.skipIf(NO_PYMUPDF)("the Python arms find `Fig 1.` and still refuse non-captions", () => {
    const out = python([
      "Fig 1. Public health supply chain partners and processes",
      "Fig. 5. DIIG process for planning and implementing a digital health enterprise",
      "Fig. 13\t Example decision-support logic matrix",
      "Figure 2.13. m4RH monitoring data",
      "Fight the stock-outs",
      "Figs 3 and 4 show",
      "Fig 7. Sample workflow . . . . . 17",
    ]);
    expect(out.candidates).toEqual([
      "Fig 1. Public health supply chain partners and processes",
      "Fig. 5. DIIG process for planning and implementing a digital health enterprise",
      "Fig. 13\t Example decision-support logic matrix",
      "Figure 2.13. m4RH monitoring data",
    ]);
    expect(out.labels).toEqual(["1", "5", "13", "2.13"]);
  });

  test("declaredFigureCaptions reads `Fig 1.` captions", () => {
    const dir = mkdtempSync(join(tmpdir(), "fig-captions-"));
    try {
      writeFileSync(
        join(dir, "page-011.md"),
        "Partners work together (Fig. 1).\nFig 1. Public health supply chain partners and processes\n",
      );
      writeFileSync(join(dir, "page-014.md"), "Fig 4. The stepwise approach used in this handbook\nFighting stock-outs\n");
      const got = declaredFigureCaptions(dir);
      expect(got.get("1")).toBe("Public health supply chain partners and processes");
      expect(got.get("4")).toBe("The stepwise approach used in this handbook");
      expect([...got.keys()].sort()).toEqual(["1", "4"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
