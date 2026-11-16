/**
 * `check:qa-corpus` over a FIXTURE tree laid out like a fetched `qa-reports`
 * entry — never over the committed corpus (bean `cxcn`, reader audit F7).
 *
 * The falsifier is a planted conflict marker in a HOSTED home, the exact shape
 * merge `48aab0bd` committed (8-wide rename/rename markers) and the place the
 * old `kg-qa.test.ts` walk never looked.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { KG_QA_MANIFEST_SCHEMA, KG_QA_SCHEMA, tally, type KgQaReport } from "../../schemas/sdlc/kg-qa.ts";
import { badgePages, corpusLayout, judgeReport, judgeWitnesses, validateQaTree, WITNESS_TREE } from "../check-qa-corpus.ts";

const HOSTED = "cat-harness/test/results/bootstrap";
const OWN = "cat-harness/test/results";

const MANIFEST = JSON.stringify({
  $schema: KG_QA_MANIFEST_SCHEMA,
  auditor: { script: "scripts/kg-audit.ts", script_hash: "abc", engine_version: "1" },
});

function report(criteria: KgQaReport["criteria"], kind: KgQaReport["subject"]["kind"] = "process"): string {
  const r: KgQaReport = {
    $schema: KG_QA_SCHEMA,
    subject: { kind, id: "P", path: "p.bpmn" },
    source_hash: "sha256:x",
    criteria,
    totals: tally(criteria),
  };
  return JSON.stringify(r, null, 2);
}

const CLEAN = report({ "skill-ref-resolves": { result: "pass", findings: [] } });

/** The shape `48aab0bd` committed: a rename/rename conflict, 8-wide markers. */
const CONFLICTED = [
  "{",
  '  "$schema": "kg-qa/v1",',
  "<<<<<<<< HEAD:cat-harness/test/results/kg-qa/skills/a.kg-qa.json",
  '  "x": 1,',
  "========",
  '  "x": 2,',
  ">>>>>>>> pr1-content-up:cat-harness/test/results/bootstrap/kg-qa/skills/b.kg-qa.json",
  "}",
  "",
].join("\n");

/** A fetched-tree-shaped fixture: an own home and a hosted home, both clean. */
function tree(extra: Record<string, string> = {}): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "qa-corpus-test-"));
  const files: Record<string, string> = {
    [`${OWN}/kg-qa.manifest.json`]: MANIFEST,
    [`${OWN}/kg-qa/processes/p.kg-qa.json`]: CLEAN,
    [`${HOSTED}/kg-qa.manifest.json`]: MANIFEST,
    [`${HOSTED}/kg-qa/skills/s.kg-qa.json`]: CLEAN,
    ...extra,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, body);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the layout it walks comes from the declarations, hosted homes included", () => {
  const layout = corpusLayout();
  it("names cat-harness's own qa directory and every hosted kg-qa home", () => {
    expect(layout.dirs).toContain(OWN);
    const hosted = layout.homes.filter((h) => h.by === "hosted").map((h) => h.home);
    for (const h of [HOSTED, "cat-harness/test/results/bootstrap-tools", "cat-harness/test/results/cat-harness-tools"]) {
      expect(hosted).toContain(h);
    }
  });
});

describe("validateQaTree over a fixture", () => {
  it("a clean tree is ok, and the hosted home's sidecar is counted", () => {
    const t = tree();
    try {
      const r = validateQaTree(t.dir);
      expect(r.findings).toEqual([]);
      expect(judgeReport(r)).toBe("ok");
      expect(r.homes.find((h) => h.home === HOSTED)?.sidecars).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("FAILS on a planted conflict marker in a hosted home", () => {
    const t = tree({ [`${HOSTED}/kg-qa/skills/bad.kg-qa.json`]: CONFLICTED });
    try {
      const r = validateQaTree(t.dir);
      expect(judgeReport(r)).toBe("finding");
      expect(r.findings.map((f) => [f.path, f.problem])).toEqual([
        [`${HOSTED}/kg-qa/skills/bad.kg-qa.json`, "conflict-marker"],
      ]);
    } finally {
      t.cleanup();
    }
  });

  it("fails on a schema break, an unknown criterion, a fail without findings and a failing critical", () => {
    const t = tree({
      [`${OWN}/kg-qa/a.kg-qa.json`]: JSON.stringify({ $schema: KG_QA_SCHEMA }),
      [`${OWN}/kg-qa/b.kg-qa.json`]: report({ "no-such-criterion": { result: "pass", findings: [] } }),
      [`${OWN}/kg-qa/c.kg-qa.json`]: report({ "activity-names-skill": { result: "fail", findings: [] } }),
      [`${OWN}/kg-qa/d.kg-qa.json`]: report({
        "skill-ref-resolves": { result: "unknown", findings: [{ where: "n", detail: "d" }] },
      }),
    });
    try {
      const got = validateQaTree(t.dir).findings.map((f) => [f.path.split("/").pop(), f.problem]);
      expect(got).toEqual([
        ["a.kg-qa.json", "schema"],
        ["b.kg-qa.json", "unknown-criterion"],
        ["c.kg-qa.json", "fail-without-findings"],
        ["d.kg-qa.json", "critical-failing"],
      ]);
    } finally {
      t.cleanup();
    }
  });

  it("a home holding sidecars with no manifest beside them is a finding", () => {
    const t = tree();
    try {
      rmSync(join(t.dir, HOSTED, "kg-qa.manifest.json"));
      const r = validateQaTree(t.dir);
      expect(r.findings.map((f) => [f.path, f.problem])).toEqual([[`${HOSTED}/kg-qa.manifest.json`, "manifest-missing"]]);
    } finally {
      t.cleanup();
    }
  });

  it("an empty tree is UNKNOWN, never ok — a miss is not a clean corpus", () => {
    const dir = mkdtempSync(join(tmpdir(), "qa-corpus-empty-"));
    try {
      const r = validateQaTree(dir);
      expect(r.examined).toBe(0);
      expect(judgeReport(r)).toBe("unknown");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the witness tree the site publishes, against the pages that fetch from it", () => {
  // A page as `gen-docs-pages.ts` emits it: one openable badge, painted from
  // the page's index and opening its projection.
  const badge = (key: string) =>
    `<button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-key="${key}" ` +
    `data-qa-src="{{ '/assets/qa/demo/${key}.json' | relative_url }}" ` +
    `data-qa-index="{{ '/assets/qa/demo/qa-index.json' | relative_url }}">`;
  const PAGE = { path: "docs/demo.md", text: `# Demo\n${badge("overview.block")}\n${badge("other.block")}\n` };
  const INDEX = JSON.stringify({ badges: { "overview.block": {}, "other.block": {} } });

  it("a tree holding the index, every row and every projection is clean", () => {
    const t = tree({
      [`${WITNESS_TREE}/demo/qa-index.json`]: INDEX,
      [`${WITNESS_TREE}/demo/overview.block.json`]: "{}",
      [`${WITNESS_TREE}/demo/other.block.json`]: "{}",
    });
    try {
      expect(judgeWitnesses(t.dir, [PAGE])).toEqual([]);
      expect(validateQaTree(t.dir, corpusLayout(), [PAGE]).pages).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it("names a missing index, a missing row, a missing projection and a `_`-prefixed path", () => {
    const t = tree({
      [`${WITNESS_TREE}/demo/qa-index.json`]: JSON.stringify({ badges: { "overview.block": {} } }),
      [`${WITNESS_TREE}/demo/overview.block.json`]: "{}",
      [`${WITNESS_TREE}/demo/_hidden.json`]: "{}",
    });
    try {
      expect(judgeWitnesses(t.dir, [PAGE]).map((f) => [f.path, f.problem])).toEqual([
        [`${WITNESS_TREE}/demo/qa-index.json`, "witness-index-row-missing"],
        [`${WITNESS_TREE}/demo/other.block.json`, "witness-url-missing"],
        [`${WITNESS_TREE}/demo/_hidden.json`, "witness-underscore-path"],
      ]);
    } finally {
      t.cleanup();
    }
    const empty = tree();
    try {
      expect(judgeWitnesses(empty.dir, [PAGE]).map((f) => f.problem)).toContain("witness-index-missing");
    } finally {
      empty.cleanup();
    }
  });

  it("a key the index lists as `unswept` needs no row and no projection (bean `4l4d`)", () => {
    const t = tree({
      [`${WITNESS_TREE}/demo/qa-index.json`]: JSON.stringify({
        corpus: "present",
        badges: { "overview.block": {} },
        unswept: ["other.block"],
      }),
      [`${WITNESS_TREE}/demo/overview.block.json`]: "{}",
    });
    try {
      expect(judgeWitnesses(t.dir, [PAGE])).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it("an index written WITHOUT the corpus is a finding in a published tree", () => {
    const t = tree({
      [`${WITNESS_TREE}/demo/qa-index.json`]: JSON.stringify({ corpus: "absent", badges: {}, unswept: [] }),
    });
    try {
      const problems = judgeWitnesses(t.dir, [PAGE]).map((f) => f.problem);
      expect(problems).toContain("witness-index-corpus-absent");
      // And it is not silently clean on the rows either.
      expect(problems).toContain("witness-index-row-missing");
    } finally {
      t.cleanup();
    }
  });

  it("finds this checkout's generated badge pages — a filter over nothing would pass", () => {
    // The guard on the guard: the CLI passes these pages, so an empty list
    // would judge every witness tree clean.
    // 2 since moves M6–M8 took the other badge pages up to folio-assistant-core.
    expect(badgePages().length).toBeGreaterThanOrEqual(2);
  });
});

describe("the CLI", () => {
  const SCRIPT = resolve(import.meta.dir, "..", "check-qa-corpus.ts");
  const run = (args: string[]) => Bun.spawnSync(["bun", "run", SCRIPT, ...args], { stdout: "pipe", stderr: "pipe" });

  it("exits 1 on the planted marker and 0 on the clean fixture", () => {
    const bad = tree({ [`${HOSTED}/kg-qa/skills/bad.kg-qa.json`]: CONFLICTED });
    const good = tree();
    try {
      expect(run(["--dir", bad.dir]).exitCode).toBe(1);
      // `--no-pages`: the fixture holds no witnesses, so this checkout's
      // badge pages would (rightly) find every index missing in it.
      expect(run(["--dir", good.dir, "--no-pages"]).exitCode).toBe(0);
      expect(run(["--dir", good.dir]).exitCode).toBe(1);
    } finally {
      bad.cleanup();
      good.cleanup();
    }
  }, 30_000);

  it("refuses an ambiguous invocation with exit 2", () => {
    expect(run([]).exitCode).toBe(2);
  }, 30_000);
});
