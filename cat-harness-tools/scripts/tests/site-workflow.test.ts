/**
 * `site:workflow` runs the repository's OWN publish path, read from its
 * index.config.json (owner, 2026-10-30, "Make them generic").
 *
 * Calibrated: dropping the `agentRun` branch from `siteRoute` fails "an
 * agent-run repository publishes through stage-local".
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { missingSiteWorkflows, siteRoute, workflowInputs } from "../site-workflow.ts";

function repo(site: Record<string, unknown> | undefined, workflows: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "site-workflow-"));
  writeFileSync(join(root, "index.config.json"), JSON.stringify({ $schema: "folio-index-config/v1", instances: [], ...(site ? { site } : {}) }));
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  for (const w of workflows) writeFileSync(join(root, ".github", "workflows", w), "on: workflow_dispatch\n");
  return root;
}

describe("siteRoute", () => {
  it("an agent-run repository publishes through stage-local", () => {
    const r = siteRoute(repo({ agentRun: true }), "publish");
    expect(r.kind).toBe("agent-run");
    if (r.kind === "agent-run") {
      expect(r.argv.some((a) => a.endsWith("stage-local.ts"))).toBe(true);
      expect(r.argv).toContain("--main");
    }
  });

  it("a repository with no index config is undeclared, not guessed", () => {
    const root = mkdtempSync(join(tmpdir(), "site-workflow-"));
    expect(siteRoute(root, "stage").kind).toBe("undeclared");
  });

  it("no declaration is undeclared, and not a check:tools finding", () => {
    const root = repo(undefined, ["docs-site.yml"]);
    expect(siteRoute(root, "publish").kind).toBe("undeclared");
    expect(missingSiteWorkflows(root)).toEqual([]);
  });
});

describe("workflowInputs", () => {
  it("passes other flags as workflow inputs, dash read as underscore", () => {
    expect(workflowInputs(["--repo", ".", "--branch", "b", "--cleanup-slug", "x", "--check"])).toEqual({ cleanup_slug: "x" });
  });
});
