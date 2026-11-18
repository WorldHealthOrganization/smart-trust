/** Publishing a folio's block QA verdicts for the heat map (bean qbfi, option 2). */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { agentCriteriaFor, publishBlockQa, summariseBlock } from "../../publish-block-qa.js";
import { QA_CRITERIA_REGISTRY } from "../../../pipeline/qa-criteria-registry.js";

// `voice-status-leak` and `voice-ai-slop` are registered criteria that depend on `md`.
const entry = (result: "pass" | "fail" | "warn" | "n/a", md: string, severity?: "critical" | "major" | "minor") => ({
  field_hash: { md },
  result,
  ...(severity ? { severity } : {}),
  reviewer: { kind: "script", id: "qa-sweep" },
  reviewed_at: "2026-09-23T08:00:00Z",
});
const report = (criteria: Record<string, ReturnType<typeof entry>[]>) =>
  ({ $schema: "block-qa/v1", label: "p:x", kind: "prose", paths: { ts: "x.ts", md: "x.md" }, source_hashes: { md: "m1" }, criteria, updated_at: "2026-09-23T08:00:00Z" }) as never;

describe("summariseBlock", () => {
  test("no sidecar is unaudited", () => {
    expect(summariseBlock(undefined, { md: "m1" }).state).toBe("unaudited");
  });

  test("a fresh fail is failing, with its severity", () => {
    const s = summariseBlock(report({ "voice-status-leak": [entry("fail", "m1", "critical")], "voice-ai-slop": [entry("pass", "m1")] }), { md: "m1" });
    expect(s).toEqual({ state: "failing", fails: 1, warns: 0, worst: "critical", staleCriteria: 0, needsAgent: 0 });
  });

  test("all fresh and none failing is passing", () => {
    expect(summariseBlock(report({ "voice-ai-slop": [entry("pass", "m1")] }), { md: "m1" }).state).toBe("passing");
  });

  test("a stale fail is NOT counted as failing, and a stale verdict is never a pass", () => {
    const s = summariseBlock(report({ "voice-status-leak": [entry("fail", "OLD", "critical")], "voice-ai-slop": [entry("pass", "m1")] }), { md: "m1" });
    expect(s).toEqual({ state: "stale", fails: 0, warns: 0, worst: null, staleCriteria: 1, needsAgent: 0 });
  });

  test("an agent-judged criterion never given a verdict is counted, so 'passing' says scripts only (9791)", () => {
    const s = summariseBlock(report({ "voice-ai-slop": [entry("pass", "m1")] }), { md: "m1" }, ["agent-a", "agent-b"]);
    expect(s.state).toBe("passing");
    expect(s.needsAgent).toBe(2);
  });

  test("a FRESH verdict on an agent-judged criterion counts as judged; a stale one does not (9791)", () => {
    const s = summariseBlock(
      report({ "voice-ai-slop": [entry("pass", "m1")], "voice-status-leak": [entry("pass", "OLD")] }),
      { md: "m1" },
      ["voice-ai-slop", "voice-status-leak"],
    );
    expect(s.needsAgent).toBe(1);
  });

  test("no sidecar: every agent-judged criterion still needs an agent", () => {
    expect(summariseBlock(undefined, { md: "m1" }, ["a", "b", "c"]).needsAgent).toBe(3);
  });
});

describe("agentCriteriaFor (9791)", () => {
  test("comes from the criteria's own declarations: exactly the non-automated ones that apply", () => {
    const got = agentCriteriaFor(QA_CRITERIA_REGISTRY, "prose", undefined);
    const byId = new Map(QA_CRITERIA_REGISTRY.map((c) => [c.id, c]));
    expect(got.length).toBeGreaterThan(0);
    for (const id of got) {
      const c = byId.get(id)!;
      expect(c.automated).toBe(false);
      expect(!c.applies_to || c.applies_to.includes("prose")).toBe(true);
    }
    const expected = QA_CRITERIA_REGISTRY.filter((c) => !c.automated && (!c.applies_to || c.applies_to.includes("prose")));
    expect(got.length).toBe(expected.length);
  });

  test("a criterion scoped to a voice the folio does not activate is not asked for", () => {
    const voiced = { ...QA_CRITERIA_REGISTRY.find((c) => !c.automated)!, id: "voice-x", applies_to: undefined, voices: ["who"] };
    expect(agentCriteriaFor([voiced], "prose", [])).toEqual([]);
    expect(agentCriteriaFor([voiced], "prose", ["who"])).toEqual(["voice-x"]);
  });
});

describe("the corpus itself (bean `tfqf`, R60)", () => {
  /** A folio root with one block and, optionally, its results tree. */
  function folio(withResults: boolean): { root: string; folioDir: string } {
    // Nested one level: the voice registry scans the root's SIBLINGS for
    // layers, and a sibling in the shared tmpdir is somebody else's fixture.
    const root = join(mkdtempSync(join(tmpdir(), "pbqa-")), "repo");
    const chapter = join(root, "folio", "demo", "ch");
    mkdirSync(chapter, { recursive: true });
    writeFileSync(join(chapter, "alpha.ts"), `export default { kind: "prose", label: "p:alpha", title: "T", chapter: "ch" };\n`);
    writeFileSync(join(chapter, "alpha.md"), "Body.\n");
    if (withResults) mkdirSync(join(root, "test", "results", "block-qa"), { recursive: true });
    return { root, folioDir: join(root, "folio") };
  }

  test("no results tree and no verdict anywhere is `absent`: the unaudited count is then unknown", () => {
    const { root, folioDir } = folio(false);
    const f = publishBlockQa(root, folioDir);
    expect(f.corpus).toMatchObject({ state: "absent", examined: 0 });
    rmSync(join(root, ".."), { recursive: true, force: true });
  });

  test("a results tree holding no verdict for these blocks is `present`: genuinely never swept", () => {
    const { root, folioDir } = folio(true);
    const f = publishBlockQa(root, folioDir);
    expect(f.corpus).toMatchObject({ state: "present", examined: 0 });
    rmSync(join(root, ".."), { recursive: true, force: true });
  });
});
