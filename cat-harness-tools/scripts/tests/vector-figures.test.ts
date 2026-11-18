/**
 * The vector FIGURE arm — bean `ay3x`, owner ruling 2026-10-03 ("Yes, build it").
 *
 * Four things are pinned here, one per Done-when item plus the arm itself:
 *
 * 1. The extractor ASSIGNS NO ROLE. A render carries a basis naming the script
 *    that made it and `role: "undetermined"`; the schema refuses anything
 *    else. A threshold choosing figure-vs-furniture is what `m4xy` and `j820`
 *    refuse, so the refusal is structural rather than a convention.
 * 2. A role arrives only by INSPECTION, through `apply-image-verdicts.ts` —
 *    the same `inspection` basis a raster image gets.
 * 3. The arm is measured against the BARE figures only, and only `shows` on an
 *    inspected render counts as reaching one. A caption candidate does not:
 *    it may be a cross-reference.
 * 4. `image-descriptions` stays `not-derivable` where neither the caption nor
 *    an inspected render reaches, and is never made `unmet` by the arm — CI
 *    fails on any `unmet`, so a new arm turning gaps into blockers is the
 *    `pn6j` failure.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { applyToVector, runStaging } from "../apply-image-verdicts.ts";
import { checkEntry, ENTRY_DIRECTORIES, ENTRY_SIDECARS, vectorFigureReach } from "../check-l1-complete.ts";
import {
  VECTOR_FIGURES_FILE,
  VectorFigureSchema,
  VectorFiguresSidecarSchema,
} from "../../schemas/content/vector-figure.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";
import { narrativeFor } from "../../schemas/content/narrative.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const AGENT = { kind: "agent", id: "claude", model: "not-disclosed", session: "https://claude.ai/code/session_test" };
const SCRIPT = { kind: "script", id: "cat-harness/scripts/pdf-vector-figures.py" };

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const assembly = {
  drawings: 3,
  background: 0,
  groups: [{ bbox: [0, 0, 10, 10], drawings: 3, pageEdge: false, rendered: true, labels: ["A"] }],
  boxes: [{ id: "b0", bbox: [0, 0, 10, 10], parent: null, labels: ["A"] }],
  unlabelledClosedShapes: 0,
  connectors: [],
  between: [],
  outside: 2,
};

/** A render as the extractor leaves it. */
function rendered(page: number, captionLabels: string[]) {
  return {
    id: `vfig-p${String(page).padStart(3, "0")}`,
    file: `figures/vfig-p${String(page).padStart(3, "0")}.png`,
    role: "undetermined",
    basis: { method: "assembly", by: SCRIPT, page },
    page,
    rotation: 0,
    captionLabels,
    region: [0, 0, 10, 10],
    assembly,
  };
}

function sidecar(figures: unknown[]) {
  return { $schema: "folio-vector-figures/v1", doc_id: "doc", figures };
}

describe("the extractor assigns no role — the schema refuses one", () => {
  test("an assembly-basis render is undetermined", () => {
    expect(VectorFigureSchema.safeParse(rendered(3, ["1"])).success).toBe(true);
  });

  test("an assembly basis claiming `figure` is refused", () => {
    // The threshold-shaped shortcut: the script deciding a render is a figure.
    const r = VectorFigureSchema.safeParse({ ...rendered(3, ["1"]), role: "figure" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("assigns no role");
  });

  test("`shows` and a narrative need somebody to have looked", () => {
    expect(VectorFigureSchema.safeParse({ ...rendered(3, ["1"]), shows: ["1"] }).success).toBe(false);
    const narrative = [{ text: "x", lang: "en", state: "draft", drafted_by: AGENT, drafted_at: "2026-10-03" }];
    expect(VectorFigureSchema.safeParse({ ...rendered(3, ["1"]), narrative }).success).toBe(false);
  });

  test("an assembly basis must name a SCRIPT — the machine says it was the machine", () => {
    const r = VectorFigureSchema.safeParse({ ...rendered(3, ["1"]), basis: { method: "assembly", by: AGENT, page: 3 } });
    expect(r.success).toBe(false);
  });

  test("an unrendered page says why, and cannot be inspected", () => {
    const bare = { ...rendered(3, ["1"]), file: null, region: null };
    expect(VectorFigureSchema.safeParse(bare).success).toBe(false);
    expect(VectorFigureSchema.safeParse({ ...bare, unrendered_reason: "no labelled component" }).success).toBe(true);
  });

  test("`figures: null` must carry a reason — could-not-determine is not empty", () => {
    expect(VectorFiguresSidecarSchema.safeParse({ ...sidecar([]), figures: null }).success).toBe(false);
    expect(VectorFiguresSidecarSchema.safeParse(sidecar([])).success).toBe(true);
  });
});

describe("a role arrives by inspection, through apply-image-verdicts", () => {
  const verdict = { role: "figure" as const, saw: "an architecture diagram", draft: "Three layers…", shows: ["3"] };

  test("the verdict becomes an inspection basis naming who looked, with a draft", () => {
    const { text, result } = applyToVector(
      JSON.stringify(sidecar([rendered(34, ["3"])])),
      { "vfig-p034": verdict },
      AGENT,
      "2026-10-03",
    );
    expect(result).toEqual({ applied: 1, unjudged: [], orphaned: [] });
    const f = VectorFiguresSidecarSchema.parse(JSON.parse(text)).figures![0]!;
    expect(f.role).toBe("figure");
    expect(f.basis).toMatchObject({ method: "inspection", by: AGENT, saw: "an architecture diagram", page: 34 });
    expect(f.shows).toEqual(["3"]);
    // A draft, never confirmed — only a human confirms (schemas/content/narrative.ts).
    expect(f.narrative && narrativeFor(f.narrative).state).toBe("draft");
  });

  test("a render with no verdict is reported unjudged, and a verdict with no render is orphaned", () => {
    const { result } = applyToVector(
      JSON.stringify(sidecar([rendered(34, ["3"])])),
      { "vfig-p099": verdict },
      AGENT,
      "2026-10-03",
    );
    expect(result.unjudged).toEqual(["vfig-p034"]);
    expect(result.orphaned).toEqual(["vfig-p099"]);
  });

  test("staging mode writes both sidecars from one verdict file, and refuses an orphan before writing either", () => {
    const root = mkdtempSync(join(tmpdir(), "ay3x-"));
    made.push(root);
    const entryDir = join(root, "staging", "doc");
    const lib = join(root, "library");
    mkdirSync(entryDir, { recursive: true });
    mkdirSync(lib, { recursive: true });
    writeFileSync(join(entryDir, "images.json"), JSON.stringify({ $schema: "folio-document-images/v1", doc_id: "doc", images: [] }));
    const vpath = join(entryDir, VECTOR_FIGURES_FILE);
    writeFileSync(vpath, JSON.stringify(sidecar([rendered(34, ["3"])])));
    const write = (v: Record<string, unknown>) =>
      writeFileSync(join(lib, "image-verdicts.json"), JSON.stringify({ inspected_by: AGENT, inspected_at: "2026-10-03", verdicts: { doc: v } }));

    write({ "vfig-p034": verdict, "vfig-p099": verdict });
    const before = readFileSync(vpath, "utf-8");
    expect(runStaging(entryDir, lib, false)).toBe(1);
    expect(readFileSync(vpath, "utf-8")).toBe(before);

    write({ "vfig-p034": verdict });
    expect(runStaging(entryDir, lib, false)).toBe(0);
    expect(JSON.parse(readFileSync(vpath, "utf-8")).figures[0].basis.method).toBe("inspection");
  });
});

/** An entry declaring figures in its text, placing no raster image, with this vector sidecar. */
function entry(sections: string, vector?: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "ay3x-l1-"));
  made.push(root);
  const dir = join(root, "doc");
  mkdirSync(join(dir, "sections"), { recursive: true });
  writeFileSync(join(dir, "sections", "s1.md"), sections);
  writeFileSync(join(dir, "images.json"), JSON.stringify({ $schema: "folio-document-images/v1", doc_id: "doc", images: [] }));
  if (vector !== undefined) writeFileSync(join(dir, VECTOR_FIGURES_FILE), JSON.stringify(vector));
  return dir;
}
const imgReq = (dir: string) => checkEntry(dir).requirements.find((q) => q.name === "image-descriptions")!;

// Fig. 1 has a caption; Fig. 2 and Fig. 3 are BARE — mentioned, never captioned.
const TEXT = "Fig. 1. A captioned figure\nsee below\nFig. 2 shows the flow\nFig. 3 illustrates the layers\n";

function inspected(page: number, shows: string[]) {
  return {
    ...rendered(page, shows),
    role: "figure",
    basis: { method: "inspection", by: AGENT, at: "2026-10-03", saw: "a flow diagram", page },
    shows,
    narrative: [{ text: "A flow.", lang: "en", state: "draft", drafted_by: AGENT, drafted_at: "2026-10-03" }],
  };
}

describe("measured against the BARE figures, and only an inspected render reaches one", () => {
  test("reach splits the bare set three ways, and a caption candidate is not coverage", () => {
    const dir = entry(TEXT, sidecar([inspected(5, ["2"]), rendered(9, ["3"])]));
    expect(vectorFigureReach(dir, ["2", "3", "4"])).toEqual({
      shown: ["2"],
      candidate: ["3"],
      neither: ["4"],
      renders: 2,
      inspected: 1,
    });
  });

  test("no sidecar is undefined — not 'reached nothing'", () => {
    expect(vectorFigureReach(entry(TEXT), ["2"])).toBeUndefined();
  });

  test("neither reaches → not-derivable, naming the bare figures and the uninspected render", () => {
    const r = imgReq(entry(TEXT, sidecar([rendered(9, ["2", "3"])])));
    expect(r.state).toBe("not-derivable");
    expect(r.detail).toContain("Fig. 2, 3");
    expect(r.detail).toContain("named on a render nobody has inspected (Fig. 2, 3)");
  });

  test("an inspected render reaching SOME bare figures still leaves the rest not-derivable", () => {
    const r = imgReq(entry(TEXT, sidecar([inspected(5, ["2"])])));
    expect(r.state).toBe("not-derivable");
    expect(r.detail).toContain("Fig. 3.");
    expect(r.detail).not.toContain("Fig. 2, 3");
  });

  test("every bare figure shown by an inspected, described render → met, saying how", () => {
    const r = imgReq(entry(TEXT, sidecar([inspected(5, ["2"]), inspected(9, ["3"])])));
    expect(r.state).toBe("met");
    expect(r.detail).toContain("shown by a vector render somebody inspected");
  });

  test("the arm never produces `unmet` — an uninspected render is a gap, not a blocker", () => {
    const r = imgReq(entry(TEXT, sidecar([rendered(5, ["2"]), rendered(9, ["3"])])));
    expect(r.state).not.toBe("unmet");
  });
});

describe("the entry may carry the arm's outputs", () => {
  test("`vector-figures.json` and `figures/` are declared entry contents", () => {
    expect(ENTRY_SIDECARS).toContain(VECTOR_FIGURES_FILE);
    expect(ENTRY_DIRECTORIES).toContain("figures");
    expect(ENTRY_DIRECTORIES).toContain("sheets");
    expect(ENTRY_DIRECTORIES).toContain("figure-data");
    expect(ENTRY_DIRECTORIES).toContain("tables");
  });
});

/**
 * The real extractor over the real PDFs. Skipped where the upload is not in the
 * checkout; ingested uploads retire to `fsh-guts/uploads/` (bean `q7ey`), so
 * both places are looked in.
 */
describe("corpus", () => {
  const CORPUS_TIMEOUT = 120_000;
  const cache = new Map<string, ReturnType<typeof extract>>();
  const extract = (pdf: string) => {
    const path = [join(REPO, "uploads", pdf), join(REPO, "fsh-guts/uploads", pdf)].find(existsSync);
    if (!path) return null;
    const proc = Bun.spawnSync(["python3", join(REPO, "cat-harness-tools/scripts/pdf-vector-figures.py"), "--dry-run", "--json", path]);
    if (proc.exitCode !== 0) return null;
    return VectorFiguresSidecarSchema.parse(JSON.parse(proc.stdout.toString()));
  };
  const run = (pdf: string) => {
    if (!cache.has(pdf)) cache.set(pdf, extract(pdf));
    return cache.get(pdf)!;
  };

  test("Fig. 3 of the SF handbook: nesting recovered by containment", () => {
    const s = run("9789240120747-eng.pdf");
    if (!s) return;
    const f = s.figures!.find((x) => x.page === 34)!;
    expect(f.role).toBe("undetermined");
    expect(f.basis.method).toBe("assembly");
    const box = (t: string) => f.assembly.boxes.find((b) => b.labels.includes(t))!;
    // Checked against the render by eye, 2026-10-03: the registry sits inside
    // Registry Services, which sits inside Shared Services.
    expect(box("Health Worker").parent).toBe(box("Registry Services").id);
    expect(box("Registry Services").parent).toBe(box("Shared Services").id);
  }, CORPUS_TIMEOUT);

  test("a landscape page renders in the visible frame and counts what the crop leaves out", () => {
    const s = run("9789240010567-eng.pdf");
    if (!s) return;
    const f = s.figures!.find((x) => x.page === 25)!;
    expect(f.rotation).toBe(90);
    // Visible frame: wider than tall on a 90°-rotated A4 page.
    const [x0, y0, x1, y1] = f.region!;
    expect(x1 - x0).toBeGreaterThan(y1 - y0);
    // The architecture titles sit in white space above the boxes — the crop's
    // stated limit, counted rather than hidden.
    expect(f.assembly.outside).toBeGreaterThan(0);
  }, CORPUS_TIMEOUT);

  test("the chapter tabs on the page edge stay out of the crop, and are still recorded", () => {
    const s = run("9789240093362-eng.pdf");
    if (!s) return;
    const f = s.figures!.find((x) => x.page === 20)!;
    // Seven tabs at x = 0 (`Introduction` ... `Annexes`). With them in the
    // union, all fifteen of this document's renders were the whole page.
    const tabs = f.assembly.groups.filter((g) => g.pageEdge);
    expect(tabs.length).toBeGreaterThanOrEqual(7);
    expect(tabs.every((g) => !g.rendered)).toBe(true);
    expect(tabs.some((g) => g.labels.includes("Scale-up"))).toBe(true);
    expect(f.region![0]).toBeGreaterThan(28.35);
    // Page 14 holds ONLY tabs, so the fallback keeps them — better a whole
    // strip than no render — and the inspector filed it decorative.
    const only = s.figures!.find((x) => x.page === 14)!;
    expect(only.assembly.groups.every((g) => g.pageEdge && g.rendered)).toBe(true);
  }, CORPUS_TIMEOUT);

  test("no render anywhere in the corpus carries a role", () => {
    for (const pdf of ["9789240120747-eng.pdf", "9789240093362-eng.pdf"]) {
      const s = run(pdf);
      if (!s) continue;
      expect(s.figures!.every((f) => f.role === "undetermined" && f.basis.method === "assembly")).toBe(true);
    }
  }, CORPUS_TIMEOUT);
});
