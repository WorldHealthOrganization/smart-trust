/**
 * The tracking-issue path, exercised without opening one.
 *
 * Opening a real issue to test this code is forbidden here without the owner's
 * asking — so {@link render} is run over a fixture report and the resulting
 * issue body asserted, built through the same path the CLI uses.
 *
 * The workflow half — the daily trigger, and the clauses that decide which
 * step runs on which verdict, above all that **nothing may close the tracking
 * issue on `unknown`** — parses the index repository's own
 * `.github/workflows/health-check.yml`, so it lives in that repository's
 * `test/workflows/health-check-workflow.test.ts` (owner's ruling 2026-10-09,
 * litlfred/folio-assistant#2521, ruling 1(c)). What stays here is the issue
 * body, and the script name the workflow and a person run.
 *
 * @module test/health/workflow.test
 */
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { buildReport, gates, render } from "./run.ts";
import { runHealthChecks, type HealthContext } from "./checks.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

describe("the trigger", () => {
  it("is also runnable locally, under a script name a person would guess", () => {
    const pkg = { scripts: scriptsOf(repoRootFor(ROOT)) };
    expect(pkg.scripts.health).toContain("test/health/run.ts");
    expect(pkg.scripts["health:list"]).toContain("--list");
  });
});

describe("the issue body", () => {
  /** A context that makes three checks fire and one go blind. */
  function fixture(): HealthContext {
    const MB = 1024 * 1024;
    return {
      now: new Date("2026-09-19T12:00:00Z"),
      subject: "example/fixture",
      staging: {
        state: "ok",
        value: {
          branch: "present",
          // 2 x 300 MB, not 2 x 60 MB. The sizes are fixture values chosen to
          // BREACH the size threshold, and that threshold moved from 100 MB to
          // 500 MB on 2026-09-20 with `folio-assistant-1feu` — which made a
          // merged PR's preview go away, so the total drains and the number
          // now expresses a concurrency rather than a cumulative ceiling.
          // Two previews keeps the orphan case below intact; only the bytes
          // change. 2 x 1600 MiB since 2026-10-04, when the budget became the
          // deploy rotation's 3 GB.
          previews: [
            { slug: "claude-one", bytes: 1600 * MB, files: 700 },
            { slug: "claude-two", bytes: 1600 * MB, files: 700 },
          ],
          command: "fixture",
        },
      },
      openPrHeads: { state: "ok", value: ["claude/one"] },
      // Listed, and nothing on the remote slugifies to either preview — a
      // determined empty, so `claude-two` is a decided orphan rather than an
      // undetermined one.
      branches: { state: "ok", value: { candidates: [], defaultBranch: "main", command: "fixture" } },
      repoSize: { state: "unknown", reason: "git count-objects -v exited 128: not a git repository" },
      beans: { state: "ok", value: [{ id: "b1", title: "one", status: "todo" }] },
      todos: { state: "ok", value: [] },
      specialBranches: { state: "ok", value: { rows: [], command: "fixture" } },
      pagesServing: {
        state: "ok",
        value: {
          key: "main/0000000000000000000000000000000000000000",
          observation: {
            $schema: "pages-serving/v1",
            observedAt: "2026-09-19T06:00:00Z",
            site: "https://example.github.io/fixture/",
            urls: [{ url: "https://example.github.io/fixture/", status: 200, bytes: 18000, expectedPage: true }],
          },
        },
      },
    };
  }

  const report = (() => {
    const ctx = fixture();
    // Deliberately built through the same path the CLI uses, so the issue body
    // under test is the one the workflow would post.
    return buildReport(ctx, runHealthChecks(ctx), {
      hash: "0123456789ab",
      updatedAt: "2026-09-19T12:00:00Z",
    });
  })();

  it("leads with 'could not determine' when anything went blind, not with the findings", () => {
    expect(report.verdict).toBe("unknown");
    const md = render(report);
    expect(md).toContain("**Could not determine.**");
    expect(md).toContain("This is NOT a clean report");
    // And it still says WHAT went blind.
    expect(md).toContain("not a git repository");
  });

  it("names every finding and what a person should do about it", () => {
    const md = render(report);
    expect(md).toContain("staging-preview-size");
    expect(md).toContain("3.13 GB");
    expect(md).toContain("branches/claude-two");
    expect(md).toContain("staging:cleanup");
    // The preview whose PR is open is not proposed for anything.
    expect(md).not.toContain("STAGING/claude-one` (");
    // Every finding of every check, with its severity, summary and action.
    const findings = report.checks.flatMap((c) => c.findings);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(md).toContain(`- **${f.severity}** — ${f.summary}`);
      expect(md).toContain(`  - *What to do:* ${f.action}`);
    }
  });

  it("shows every threshold with the basis it was chosen on", () => {
    const md = render(report);
    expect(md).toContain("Thresholds, and what each is based on");
    expect(md).toContain("owner's explicit instruction");
    // The honest-arbitrary ones say so in those words rather than implying a standard.
    expect(md).toContain("NO EXTERNAL STANDARD");
    // Every threshold of every check, named by its metric and carrying its basis.
    const thresholds = report.checks.flatMap((c) => c.thresholds);
    expect(thresholds.length).toBeGreaterThan(0);
    for (const t of thresholds) {
      expect(md).toContain(`- \`${t.metric}\` > `);
      expect(md).toContain(`→ *${t.severity}*. ${t.basis}`);
    }
  });

  it("gates on a major finding, and not on a minor one alone", () => {
    const majorOnly = { ...report, checks: report.checks.filter((c) => c.id === "staging-preview-size") };
    expect(gates(majorOnly, false)).toBe(true);
    const minorOnly = { ...report, checks: report.checks.filter((c) => c.id === "staging-preview-orphans") };
    expect(gates(minorOnly, false)).toBe(false);
    expect(gates(minorOnly, true)).toBe(true);
  });
});
