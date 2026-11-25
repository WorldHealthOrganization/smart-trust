/**
 * `tool` is a QA subject kind, and its criteria PROJECT rather than decide.
 *
 * @module scripts/tests/tool-qa-subjects.test
 *
 * ## What this guards, and what it deliberately does not
 *
 * Issue #853 requirement 1: *"Each tool node needs a QA check."* The bean
 * behind it called the 69 Tool nodes unaudited. Measured 2026-09-22, that is
 * true of `kg:audit` and **false of the repository** — `check-tools.ts`,
 * `tools.test.ts` and `check-maintained-artefacts.ts` already decide every
 * property a Tool has.
 *
 * So the criteria here are a REPORTING SURFACE: a committed sidecar per Tool,
 * which is what makes "unbound since it was drawn" distinguishable from
 * "broken in the commit under review". A first draft instead added a
 * `maintains` criterion with its own logic, which would have been a second
 * answer to a question `check-maintained-artefacts` already answers — free to
 * disagree with it. The first test below is what stops that coming back.
 *
 * ## The third state is the load-bearing one
 *
 * `tool-maintains-in-tree` can only ever be `unknown` from a checkout: whether
 * an artefact is in the published tree is a fact about `_site/`, which does
 * not exist here. Recording it as `pass` would be green in exactly the place
 * nobody built the site — `xom7`, where a workflow failed 30 times over two
 * months while a checkout looked clean.
 *
 * ## Falsified before it was trusted
 *
 * | break | result |
 * |---|---|
 * | `tool-maintains-in-tree` returns `pass` instead of `unknown` | **fails** |
 * | `tool-alternative-selectable` returns `pass` instead of `n/a` | **fails** |
 * | `tool` removed from `KG_SUBJECT_KINDS` | does not compile |
 * | restored | all pass |
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  KG_CRITERIA,
  KG_SUBJECT_KINDS,
  KgQaReportSchema,
  type KgQaReport,
  worstSeverity,
} from "../../../schemas/sdlc/kg-qa.ts";
import { tools } from "../../../schemas/tools/harness-tools.ts";
import { deriveAlternatives } from "../../../schemas/tools/tool.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const INSTANCE = HARNESS_ROOT;

const toolCriteria = KG_CRITERIA.filter((c) => c.applies.includes("tool"));

/**
 * The Tool reports of a FRESH audit, computed now — never the committed
 * sidecars (bean `cxcn`, reader audit F7 R68: four tests here failed only
 * because `test/results/kg-qa/tools/` was absent). `--check --json` computes
 * every report and writes nothing, so the run cannot touch the checkout.
 * Spawned once, at load, because `kg-audit.ts` is a script that runs on import.
 */
const FRESH: Map<string, KgQaReport> = (() => {
  const run = Bun.spawnSync(["bun", "run", resolve(TOOLS_ROOT, "scripts", "kg-audit.ts"), "--check", "--json"], {
    cwd: INSTANCE,
    stdout: "pipe",
    stderr: "pipe",
  });
  const text = run.stdout.toString();
  const at = text.indexOf("{");
  let reports: KgQaReport[] = [];
  try {
    reports = (JSON.parse(at < 0 ? "{}" : text.slice(at)) as { reports?: KgQaReport[] }).reports ?? [];
  } catch {
    reports = [];
  }
  return new Map(reports.filter((r) => r.subject.kind === "tool").map((r) => [r.subject.id, r]));
})();

/**
 * One fresh report, validated against the schema and returned as the typed
 * report.
 *
 * The parse result is deliberately discarded. `KgQaReportSchema` infers
 * `totals` as a PARTIAL record — `z.record(z.enum(KG_RESULTS), number)` makes
 * every key optional — while `KgQaReport` declares it total, so the parse
 * output does not satisfy the interface `worstSeverity` takes. Validating and
 * then returning the raw object keeps both: the report is checked, and the
 * value has the type the consumer needs.
 */
const sidecar = (id: string): KgQaReport => {
  const raw = FRESH.get(id);
  if (!raw) throw new Error(`the fresh audit produced no report for tool ${id}`);
  KgQaReportSchema.parse(raw);
  return raw;
};

describe("the subject kind exists and is not empty", () => {
  test("`tool` is a subject kind", () => {
    expect(KG_SUBJECT_KINDS).toContain("tool");
  });

  test("it carries at least one criterion", () => {
    // The bean's own "Do not": an enum member with nothing behind it makes
    // `kg:audit` report 69 tools as considered-and-clean, which is worse than
    // the visible silence it replaces.
    expect(toolCriteria.length).toBeGreaterThan(0);
  });

  test("the fresh audit ran and reported on Tools at all", () => {
    // The guard on the guard: every assertion below reads FRESH, so an audit
    // that failed to run must fail here, not pass over an empty map.
    expect(FRESH.size).toBeGreaterThan(0);
  });

  test("every Tool node gets a report — all of them, not a sample", () => {
    const missing = tools()
      .map((t) => t.id)
      .filter((id) => !FRESH.has(id));
    expect(missing).toEqual([]);
  });
});

describe("the criteria project, they do not decide", () => {
  test("no tool criterion re-answers `maintains` presence itself", () => {
    // The guard against the first draft coming back. `tool-maintains-in-tree`
    // may REPORT where the answer lives; it may not BE the answer, because
    // `check:maintained-artefacts` already is and two answers can disagree.
    const c = toolCriteria.find((x) => x.id === "tool-maintains-in-tree");
    expect(c).toBeDefined();
    expect(c!.summary).toContain("check:maintained-artefacts");
  });
});

describe("the two results that are not `pass`", () => {
  const withMaintains = tools().filter((t) => (t.maintains ?? []).length > 0);
  const derived = deriveAlternatives(tools());
  const withoutAlternatives = tools().filter((t) => !derived.has(t.id));

  test("there are tools of each shape — otherwise the assertions below are vacuous", () => {
    expect(withMaintains.length).toBeGreaterThan(0);
    expect(withoutAlternatives.length).toBeGreaterThan(0);
  });

  test("a `maintains` claim is `unknown` from a checkout, never `pass`", () => {
    for (const t of withMaintains) {
      const r = sidecar(t.id);
      expect(r.criteria["tool-maintains-in-tree"]!.result).toBe("unknown");
      // Named, not just flagged: the finding has to say where the answer is.
      expect(r.criteria["tool-maintains-in-tree"]!.findings[0]!.detail).toContain(
        "check:maintained-artefacts",
      );
    }
  });

  test("a Tool with no alternative records `n/a`, not a pass", () => {
    // 100-odd non-answers counted as evidence is how a projection starts
    // reading as more coverage than it has.
    for (const t of withoutAlternatives.slice(0, 5)) {
      expect(sidecar(t.id).criteria["tool-alternative-selectable"]!.result).toBe("n/a");
    }
  });
});

describe("the permanent `unknown` cannot put a gate out of reach", () => {
  test("`tool-maintains-in-tree` is `minor`", () => {
    // NOT because a rotted artefact is small — it is a 404 a reader follows.
    // Because from here the criterion can only ever be `unknown`, `unknown`
    // counts toward `worstSeverity`, and at `major` the tools declaring
    // `maintains` would put `kg:audit:strict` permanently beyond reach with no
    // change to the repository able to clear it. Same reasoning this file
    // records on `nested-instance-audited`.
    expect(KG_CRITERIA.find((c) => c.id === "tool-maintains-in-tree")!.severity).toBe("minor");
  });

  test("no Tool sidecar is `critical`, so `kg:audit:check` still passes", () => {
    const critical = tools()
      .map((t) => ({ id: t.id, sev: worstSeverity(sidecar(t.id)) }))
      .filter((x) => x.sev === "critical");
    expect(critical).toEqual([]);
  });
});
