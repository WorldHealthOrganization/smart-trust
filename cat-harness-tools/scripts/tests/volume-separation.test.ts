/**
 * Volume separation — `volume-separation.py` (cat-harness-tools#132).
 *
 * Each claim is made against a page-granularity entry and votes this file
 * builds, so the expected proposal is known before the script runs.
 *
 * @module scripts/tests/volume-separation
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(new URL("..", import.meta.url).pathname, "volume-separation.py");
const GDZ_FIXTURE_DIR = join(new URL("../../test/fixtures/volume-separation/gdz-invent-math-106", import.meta.url).pathname);
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A page-granularity volume entry. */
function volume(pages = 10, name = "invent-math-106"): { root: string; entry: string } {
  const root = mkdtempSync(join(tmpdir(), "vsep-"));
  made.push(root);
  const entry = join(root, "library", name);
  mkdirSync(join(entry, "sections"), { recursive: true });
  const sections = Array.from({ length: pages }, (_, i) => ({ id: `page-${String(i + 1).padStart(3, "0")}`, page_start: i + 1, page_end: i + 1 }));
  writeFileSync(join(entry, "structure.json"), JSON.stringify({ granularity: "page", sections }));
  for (const s of sections) writeFileSync(join(entry, "sections", `${s.id}.md`), `---\nsection_id: ${s.id}\n---\nText of page ${s.page_start}\n`);
  return { root, entry };
}

type Span = { start: number; end: number; title?: string };
function votes(root: string, voters: Span[][]): string {
  const p = join(root, "votes.json");
  writeFileSync(
    p,
    JSON.stringify({ $schema: "separation-votes/v1", voters: voters.map((spans, i) => ({ id: `v${i}`, model: `model-${i}`, spans })) }),
  );
  return p;
}

function run(root: string, ...args: string[]) {
  const r = Bun.spawnSync(["python3", SCRIPT, ...args], { cwd: root });
  return { code: r.exitCode, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a JSON report, read by path in the assertions
function propose(root: string, entry: string, v: string): any {
  const r = run(root, "propose", entry, "--votes", v, "--stdout");
  expect(r.code).toBe(0);
  return JSON.parse(r.out);
}

describe("volume-separation", () => {
  test("the queue holds every page's text", () => {
    const { root, entry } = volume(3);
    const r = run(root, "queue", entry, "--out", "build/q.json");
    expect(r.code).toBe(0);
    const q = JSON.parse(readFileSync(join(root, "build", "q.json"), "utf8"));
    expect(q.$schema).toBe("separation-queue/v1");
    expect(q.pages.map((p: { page: number }) => p.page)).toEqual([1, 2, 3]);
    expect(q.pages[0].text).toContain("Text of page 1");
  });

  test("spans the majority agrees on are proposed; the rest are undetermined", () => {
    const { root, entry } = volume();
    const a = { start: 1, end: 4, title: "On cusps" };
    const v = votes(root, [
      [a, { start: 5, end: 10, title: "Volumes" }, { start: 9, end: 10 }],
      [a, { start: 5, end: 10, title: "volumes " }],
      [{ ...a, title: "Cusps" }, { start: 5, end: 8, title: "Volumes" }],
    ]);
    const out = propose(root, entry, v);
    expect(out.state).toBe("proposed");
    expect(out.spans.map((s: Span) => [s.start, s.end, s.title])).toEqual([
      [1, 4, "On cusps"],
      [5, 10, "Volumes"],
    ]);
    expect(out.spans[1].votes).toEqual({ start: 3, end: 2, title: 3, of: 3 });
    expect(out.undetermined.map((u: { start: number }) => u.start)).toEqual([9]);
  });

  test("an end page with no majority is undetermined, never cut", () => {
    const { root, entry } = volume();
    const v = votes(root, [[{ start: 1, end: 3 }], [{ start: 1, end: 4 }], [{ start: 1, end: 5 }]]);
    const out = propose(root, entry, v);
    expect(out.spans).toEqual([]);
    expect(out.undetermined[0].why).toContain("no end page");
    expect(out.undetermined[0].answers).toHaveLength(3);
  });

  test("an agreed span that runs into the next agreed start is undetermined", () => {
    const { root, entry } = volume();
    const s = [{ start: 1, end: 6 }, { start: 5, end: 10 }];
    const out = propose(root, entry, votes(root, [s, s, s]));
    expect(out.spans.map((x: Span) => x.start)).toEqual([5]);
    expect(out.undetermined[0].why).toContain("runs into");
  });

  test("fewer than three voters, a voter with no model, or a span off the volume is refused", () => {
    const { root, entry } = volume();
    expect(run(root, "propose", entry, "--votes", votes(root, [[], []])).err).toContain("at least three");
    const bad = join(root, "bad.json");
    writeFileSync(bad, JSON.stringify({ $schema: "separation-votes/v1", voters: [{ id: "a", spans: [] }, { id: "b", model: "m" }, { id: "c", model: "m" }] }));
    expect(run(root, "propose", entry, "--votes", bad).err).toContain("model");
    expect(run(root, "propose", entry, "--votes", votes(root, [[{ start: 1, end: 11 }], [], []])).err).toContain("<= 10");
  });

  test("propose writes the proposal beside the volume, and score compares it with a hand cut", () => {
    const { root, entry } = volume();
    const s = [{ start: 1, end: 4 }, { start: 5, end: 10 }];
    expect(run(root, "propose", entry, "--votes", votes(root, [s, s, s])).code).toBe(0);
    expect(existsSync(join(entry, "separation-proposal.json"))).toBe(true);
    const truth = join(root, "truth.json");
    writeFileSync(truth, JSON.stringify({ spans: [{ start: 1, end: 4 }, { start: 5, end: 7 }, { start: 8, end: 10 }] }));
    const r = run(root, "score", entry, "--truth", truth);
    expect(r.code).toBe(0);
    const sc = JSON.parse(r.out);
    expect(sc.exact_spans).toBe(1);
    expect(sc.starts).toEqual({ precision: 1, recall: 0.667 });
    expect(sc.ends).toEqual({ precision: 1, recall: 0.667 });
  });

  test("a non-page entry is refused", () => {
    const { root, entry } = volume();
    writeFileSync(join(entry, "structure.json"), JSON.stringify({ granularity: "section", sections: [] }));
    expect(run(root, "queue", entry, "--out", "build/q.json").err).toContain("not 'page'");
  });

  test("GDZ Invent. Math. 106 (PPN356556735_0106) acceptance run: majority vote proposes all 26 articles and matches the 4-article hand cut", () => {
    const { root, entry } = volume(673, "PPN356556735_0106");
    const votesFile = join(GDZ_FIXTURE_DIR, "votes.json");
    const expectedProposal = JSON.parse(readFileSync(join(GDZ_FIXTURE_DIR, "separation-proposal.json"), "utf8"));
    expect(run(root, "propose", entry, "--votes", votesFile).code).toBe(0);
    const actualProposal = JSON.parse(readFileSync(join(entry, "separation-proposal.json"), "utf8"));
    expect(actualProposal).toEqual(expectedProposal);
    expect(actualProposal.spans).toHaveLength(26);
    expect(actualProposal.undetermined).toHaveLength(9);

    const scoreContent26 = JSON.parse(run(root, "score", entry, "--truth", join(GDZ_FIXTURE_DIR, "truth-content-pages-26.json")).out);
    expect(scoreContent26.exact_spans).toBe(26);
    expect(scoreContent26.starts).toEqual({ precision: 1, recall: 1 });
    expect(scoreContent26.ends).toEqual({ precision: 1, recall: 1 });

    const scoreHandCut4 = JSON.parse(run(root, "score", entry, "--truth", join(GDZ_FIXTURE_DIR, "truth-qou-hand-cut-4.json")).out);
    expect(scoreHandCut4.exact_spans).toBe(4);
    expect(scoreHandCut4.starts).toEqual({ precision: 0.154, recall: 1 });
    expect(scoreHandCut4.ends).toEqual({ precision: 0.154, recall: 1 });

    const scoreOutline26 = JSON.parse(run(root, "score", entry, "--truth", join(GDZ_FIXTURE_DIR, "truth-gdz-outline-26.json")).out);
    expect(scoreOutline26.exact_spans).toBe(15);
    expect(scoreOutline26.starts).toEqual({ precision: 1, recall: 1 });
    expect(scoreOutline26.ends).toEqual({ precision: 0.577, recall: 0.577 });
  });
});
