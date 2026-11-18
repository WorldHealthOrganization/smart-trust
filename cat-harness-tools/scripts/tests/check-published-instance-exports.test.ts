/**
 * The gate that runs every workflow's foreign-instance exports.
 *
 * Its subject is not the export — that is `kg-export.test.ts` — but the
 * DERIVATION: which commands it decides to run, across which files, and what
 * it does when it decides on none.
 *
 * The literals below are workflow source text on purpose. This file feeds
 * fixture text to the matcher, so rewriting those strings to reference a
 * constant would leave every detection test passing while asserting nothing
 * — the failure `check-declaration-filename.test.ts` already paid for once
 * (bean `jijc`). They stay literal.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  publishesNoInstanceGraph,
  COMMITTED_SIDECAR,
  committedSidecarSubjects,
  sidecarSubjectsFrom,
  formatReport,
  publishedInstances,
} from "../check-published-instance-exports.js";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const wf = (n: string) => join(REPO_ROOT, ".github", "workflows", n);

describe("publishedInstances", () => {
  test("finds the invocation in the real deploy workflow", () => {
    // The witness that keeps the pattern honest. A regex proven only against
    // fixtures is a regex proven against its own author's idea of the file.
    const found = publishedInstances(readFileSync(wf("docs-site.yml"), "utf-8"), "docs-site.yml");
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((i) => i.instance)).toContain("./bootstrap");
  });

  test("finds it in the STAGING workflow too — the file `3jhq` showed was missed", () => {
    // Before `3jhq`, feature-staging.yml published no site-root export at all,
    // and this gate read only docs-site.yml, so neither half saw the other.
    // Asserted against the real file: a staged preview that stops publishing
    // it should fail here rather than 404 for a reviewer.
    const found = publishedInstances(readFileSync(wf("feature-staging.yml"), "utf-8"), "feature-staging.yml");
    expect(found.map((i) => i.instance)).toContain("./bootstrap");
    // ...and it is the one that passes a base, which the report must not
    // present as the same evidence as a base-less run.
    expect(found.find((i) => i.instance === "./bootstrap")?.standInBase).toBe(true);
  });

  test("reads every invocation, in the order the workflow runs them", () => {
    const yml = [
      "          bun run cat-harness/scripts/kg-export.ts --instance ./first --out a.jsonld",
      "          bun run cat-harness/scripts/kg-export.ts --instance ./second --out b.jsonld",
    ].join("\n");
    expect(publishedInstances(yml, "w.yml").map((i) => i.instance)).toEqual(["./first", "./second"]);
  });

  test("a `--base-url` on the line is recorded, and its absence is too", () => {
    // The distinction that stops the report overstating what it checked: a
    // base-less invocation exercises the declaration fallback, a based one
    // cannot, and they are not interchangeable evidence.
    const withBase = 'kg-export.ts --instance ./x --base-url "$BASE" --out x.jsonld';
    const without = 'kg-export.ts --instance ./x --out x.jsonld';
    expect(publishedInstances(withBase, "w.yml")[0]!.standInBase).toBe(true);
    expect(publishedInstances(without, "w.yml")[0]!.standInBase).toBe(false);
  });

  test("a `--base-url` on the NEXT line is not this invocation's", () => {
    // The regex takes the remainder of the line only. A following command's
    // flag is not evidence about this one.
    const yml = 'kg-export.ts --instance ./x --out x.jsonld\nsomething-else --base-url "$BASE"';
    expect(publishedInstances(yml, "w.yml")[0]!.standInBase).toBe(false);
  });

  test("a DIFFERENT script taking --instance is not this export", () => {
    // A neighbour script that happens to take `--instance` (the removed
    // `gen-bootstrap-graph.ts` was one) is not the export. Running it here
    // would report failures that say nothing about the published graph, which
    // is how a gate earns the habit of being ignored.
    expect(publishedInstances("bun run cat-harness/scripts/some-other-writer.ts --instance ./bootstrap", "w.yml")).toEqual([]);
  });

  test("this instance's own export carries no --instance and is not counted", () => {
    expect(publishedInstances('bun run cat-harness/scripts/kg-export.ts             --scope instance --out "./_site/${STUB}/${STUB}.jsonld"', "w.yml")).toEqual([]);
  });
});

// cat-harness-tools#1701: an IG repository that is its own index deploys no
// folio site, so "examined nothing" there is determined, not a pattern drift.
describe("publishesNoInstanceGraph", () => {
  test("no deploy workflow and no publisher named anywhere: determined, with a reason", () => {
    const wf = new Map([["ghbuild.yml", "run: ./_genonce.sh"], ["release.yml", "run: echo"]]);
    expect(publishesNoInstanceGraph(wf)).toContain("publishes no instance graph");
  });

  test("the deploy workflow present: not determined, judged as before", () => {
    expect(publishesNoInstanceGraph(new Map([["docs-site.yml", "run: echo"]]))).toBeUndefined();
  });

  test("a publisher named in a line the patterns miss: not determined (the pattern may have drifted)", () => {
    expect(publishesNoInstanceGraph(new Map([["x.yml", "run: bun kg-export.ts\\\n  --instance ./a"]]))).toBeUndefined();
  });
});

describe("formatReport", () => {
  const inv = (workflow: string, instance: string, standInBase = false) => ({ workflow, instance, standInBase });

  test("finding nothing is reported as examining nothing, NOT as a pass", () => {
    // The third-state rule, where a gate is most tempted to break it: if the
    // pattern stops matching, this would sweep an empty set and print a tick.
    const out = formatReport({ invocations: [], results: [], workflowsRead: 39 });
    expect(out).toContain("EXAMINED NOTHING");
    expect(out).toContain("39 workflow file(s)");
    expect(out).not.toContain("✓");
  });

  test("an unreadable workflow is its own state, and says so", () => {
    const out = formatReport({ invocations: [], results: [], unreadable: "x.yml: EACCES", workflowsRead: 38 });
    expect(out).toContain("COULD NOT READ");
    expect(out).toContain("not a pass");
    expect(out).not.toContain("✓");
  });

  test("an unreadable workflow OUTRANKS green results — a partial sweep is not a clean one", () => {
    // A sweep blind on one file has not cleared the others, and the report
    // must not let a row of ticks read as coverage.
    const out = formatReport({
      invocations: [inv("docs-site.yml", "./bootstrap")],
      results: [{ ...inv("docs-site.yml", "./bootstrap"), ok: true, nodes: 85 }],
      unreadable: "feature-staging.yml: EACCES",
      workflowsRead: 38,
    });
    expect(out).toContain("COULD NOT READ");
    expect(out).toContain("partial");
    expect(out).not.toContain("every graph a workflow publishes builds");
  });

  test("each row names its workflow, so two files' results cannot be confused", () => {
    const out = formatReport({
      invocations: [inv("docs-site.yml", "./bootstrap"), inv("feature-staging.yml", "./bootstrap", true)],
      results: [
        { ...inv("docs-site.yml", "./bootstrap"), ok: true, nodes: 85 },
        { ...inv("feature-staging.yml", "./bootstrap", true), ok: true, nodes: 85 },
      ],
      workflowsRead: 39,
    });
    expect(out).toContain("docs-site.yml: ./bootstrap");
    expect(out).toContain("feature-staging.yml: ./bootstrap");
    expect(out).toContain("2 workflow(s)");
  });

  test("a stood-in base is disclosed, never presented as the workflow's own run", () => {
    const out = formatReport({
      invocations: [inv("feature-staging.yml", "./bootstrap", true)],
      results: [{ ...inv("feature-staging.yml", "./bootstrap", true), ok: true, nodes: 85 }],
      workflowsRead: 39,
    });
    expect(out).toContain("stood in");
  });

  test("the node count rides with the tick, so a drop to nothing is visible", () => {
    // `exit 0` alone was not enough and the falsification proved it: an
    // invocation pointed at a nonexistent layer exited 0 and this gate
    // printed a tick over an empty graph.
    const out = formatReport({
      invocations: [inv("docs-site.yml", "./bootstrap")],
      results: [{ ...inv("docs-site.yml", "./bootstrap"), ok: true, nodes: 85 }],
      workflowsRead: 39,
    });
    expect(out).toContain("85 node(s)");
  });

  test("a failure names the workflow, the instance, and what the export reported", () => {
    const out = formatReport({
      invocations: [inv("docs-site.yml", "./bootstrap")],
      results: [{ ...inv("docs-site.yml", "./bootstrap"), ok: false, detail: "✗ no canonicalUrl in x" }],
      workflowsRead: 39,
    });
    expect(out).toContain("✗ docs-site.yml: ./bootstrap");
    expect(out).toContain("no canonicalUrl in x");
  });

  test("a failure that said nothing is distinguishable from one that did", () => {
    const out = formatReport({
      invocations: [inv("w.yml", "./x")],
      results: [{ ...inv("w.yml", "./x"), ok: false, detail: "exited 1 with no diagnosis" }],
      workflowsRead: 39,
    });
    expect(out).toContain("no diagnosis");
  });
});

describe("committedSidecarSubjects — the comparison has a subject (bean r7v6, C2)", () => {
  // Before r7v6, both deploy invocations were `export-graph.ts`, which writes
  // no sidecar, so the committed `kg-export.bootstrap.qa-results.json` was
  // never compared: identical output with it present and absent.
  function qaDir(names: string[]): { dir: string; cleanup: () => void } {
    const dir = mkdtempSync(join(tmpdir(), "pie-qa-"));
    for (const n of names) writeFileSync(join(dir, n), "{}");
    return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
  }
  const graphInv = { workflow: "docs-site.yml", instance: "./bootstrap", standInBase: true, tool: "export-graph" as const };

  test("a committed foreign sidecar that only export-graph invocations cover becomes a subject", () => {
    const q = qaDir(["kg-export.bootstrap.qa-results.json", "kg-export.qa-results.json", "other.qa-results.json"]);
    try {
      const subs = committedSidecarSubjects([graphInv], q.dir);
      // The host's own bare-stem sidecar is not a foreign export.
      expect(subs.map((s) => s.instance)).toEqual(["./bootstrap"]);
      expect(subs[0]!.workflow).toBe(COMMITTED_SIDECAR);
      expect(subs[0]!.tool).toBe("kg-export");
    } finally {
      q.cleanup();
    }
  });

  test("a sidecar a workflow's kg-export invocation already covers is not compared twice", () => {
    const q = qaDir(["kg-export.bootstrap.qa-results.json"]);
    try {
      const kgInv = { workflow: "w.yml", instance: "./bootstrap", standInBase: false, tool: "kg-export" as const };
      expect(committedSidecarSubjects([kgInv], q.dir)).toEqual([]);
    } finally {
      q.cleanup();
    }
  });

  test("the real checkout's committed bootstrap sidecar is a subject — or its absence is UNKNOWN, never an empty list", () => {
    const found = publishedInstances(readFileSync(wf("docs-site.yml"), "utf-8"), "docs-site.yml");
    const r = sidecarSubjectsFrom(found);
    // Bean id4s: with `test/results/` off `main` the subjects cannot be
    // listed, and that must be SAID — the C2 shape was exactly a comparison
    // that silently had nothing to compare.
    if (r.unknown !== undefined) {
      expect(r.subjects).toEqual([]);
      expect(r.unknown).toContain("--against");
      return;
    }
    expect(r.subjects.map((s) => s.instance)).toContain("./bootstrap");
    expect(committedSidecarSubjects(found).map((s) => s.instance)).toContain("./bootstrap");
  });

  test("an unlisted subject set is reported, not dropped", () => {
    const out = formatReport({
      invocations: [graphInv],
      sidecarSubjects: [],
      sidecarSubjectsUnknown: "cat-harness/test/results is not in this checkout",
      results: [{ ...graphInv, ok: true, nodes: 82 }],
      workflowsRead: 33,
    });
    expect(out).toContain("UNKNOWN");
    expect(out).toContain("NOT made");
  });

  test("the report says a compared sidecar has no workflow producer, and shows each row's sidecar state", () => {
    const sub = { workflow: COMMITTED_SIDECAR, instance: "./bootstrap", standInBase: false, tool: "kg-export" as const };
    const out = formatReport({
      invocations: [graphInv],
      sidecarSubjects: [sub],
      results: [
        { ...graphInv, ok: true, nodes: 82 },
        { ...sub, ok: false, nodes: 94, qaSidecar: "stale", detail: "STALE" },
      ],
      workflowsRead: 33,
    });
    expect(out).toContain("1 committed sidecar(s) compared");
    expect(out).toContain("writes no QA sidecar");
    expect(out).toContain("QA sidecar stale");
    expect(out).toContain("no workflow runs `kg-export.ts --instance` for ./bootstrap");
  });
});

describe("the bootstrap kg-export sidecar has a WORKFLOW producer (bean 0utt)", () => {
  test("code-quality-gates.yml runs `kg-export.ts --instance ./bootstrap`, so the sidecar is no orphan", () => {
    // Owner ruling 2026-10-01: keep the file and give it a producer. The
    // qa-publish job regenerates it before publishing, and this gate reads that
    // line as the producer, so it stops reporting "no workflow producer".
    const found = publishedInstances(readFileSync(wf("code-quality-gates.yml"), "utf-8"), "code-quality-gates.yml");
    expect(found.filter((i) => i.tool === "kg-export").map((i) => i.instance)).toContain("./bootstrap");
    const r = sidecarSubjectsFrom(found);
    if (r.unknown === undefined) expect(r.subjects.map((s) => s.instance)).not.toContain("./bootstrap");
  });

  test("the producer step is in the PUBLISH job, ahead of the publish", () => {
    const text = readFileSync(wf("code-quality-gates.yml"), "utf-8");
    const job = text.slice(text.indexOf("\n  qa-publish:"));
    const produce = job.indexOf("kg-export.ts --instance ./bootstrap");
    expect(produce).toBeGreaterThan(-1);
    expect(produce).toBeLessThan(job.indexOf("bun run cat qa:publish"));
  });
});
