/**
 * `infrastructure` tests that read the aggregate repository's own root — the
 * `.gitignore`, the CI workflows and cat-harness-tools' MCP Dockerfile — moved
 * here from `cat-harness/scripts/tests/infrastructure.test.ts` (bean `ho66`),
 * as `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has
 * no such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { INSTANCE_ROOT, REPO_ROOT } from "../../scripts/tests/helpers.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { folioTemplates } from "../../scripts/init-folio.ts";

/**
 * The workflows that run in the paper-assistant container: the Lean templates
 * `folio_init` writes into a paper folio (`lean-build.yml`, `blueprint.yml`),
 * which left `.github/workflows/` under bean `52dz` and are read from the
 * templates directory instead. The platform's own `publish.yml` was one too,
 * until folio-assistant#3066 (2026-11-10) dropped it with the qou split: it
 * ran a folio's `cd content` pipeline, which exists in neither repository.
 */
function containerisedWorkflows(): string[] {
  const lean = folioTemplates("paper")
    .filter((t) => ["lean-build.yml", "blueprint.yml"].some((n) => t.target.endsWith(`/${n}`)))
    .map((t) => t.source);
  expect(lean.length).toBe(2);
  return lean;
}

// ── Unified Docker image ───────────────────────────────────────

// The MCP server and its Dockerfile moved to `cat-harness-tools` (bean `w2gr`,
// step 3a); this reads the file there rather than importing anything from it.
const MCP_DOCKERFILE = join(REPO_ROOT, "cat-harness-tools/adapters/mcp-server/Dockerfile");

describe("Unified paper-assistant image", () => {
  test("Dockerfile exists", () => {
    expect(existsSync(MCP_DOCKERFILE)).toBe(true);
  });

  test("Dockerfile includes TeX Live", () => {
    const df = readFileSync(MCP_DOCKERFILE, "utf-8");
    expect(df).toContain("texlive-full");
  });

  test("Dockerfile includes gh CLI", () => {
    const df = readFileSync(MCP_DOCKERFILE, "utf-8");
    expect(df).toMatch(/apt-get\s+install\b[^\n]*\bgh\b/);
    expect(df).toMatch(/\bgh\s+--version\b/);
  });

  test("Dockerfile installs the generated Python set", () => {
    // `requests` used to be retyped here; the image now installs the file
    // `deps:python` writes, which declares it (bean `ar1s`, phase 2).
    const df = readFileSync(MCP_DOCKERFILE, "utf-8");
    expect(df).toContain("COPY cat-harness-tools/python/requirements.txt");
    expect(df).toMatch(/pip3 install[^\n]*\\\s*\n\s*-r \/tmp\/requirements\.txt/);
  });

  test("no CI workflow regressed to a pre-unification image", () => {
    // The point of this test is preventing a slide back to the old
    // `texlive/texlive` / `latex-ci` images. That applies to every workflow.
    for (const wf of containerisedWorkflows()) {
      const content = readFileSync(wf, "utf-8");
      expect(content).not.toContain("texlive/texlive");
      expect(content).not.toContain("latex-ci");
    }
  });

  test("no containerised workflow hardcodes a folio's image", () => {
    // The platform builds exactly ONE image: `paper-assistant`. A builder
    // image belonging to a folio (its TeX set and its licence are the
    // folio's) must not be named here — publish.yml took it as a required
    // `builder_image` input instead, so the pipeline stayed folio-agnostic.
    //
    // Guard against the specific regression: `publish.yml` used to pin
    // `ghcr.io/litlfred/qou-paper-builder:latest` in four container jobs,
    // and the platform carried that image's Dockerfile — labelled with qou's
    // CC-BY-4.0 licence inside an MIT repo.
    for (const wf of containerisedWorkflows()) {
      const content = readFileSync(wf, "utf-8");
      if (!/^\s*container:/m.test(content)) continue;
      const images = [...content.matchAll(/^\s*image:\s*(\S+)/gm)].map((m) => m[1]);
      for (const img of images) {
        // Either the platform's own image, or an expression the caller fills.
        expect(img.includes("paper-assistant") || img.includes("${{")).toBe(true);
      }
    }
  });

  test("publish.yml is gone with the qou split, and no workflow here still calls it", () => {
    // It used to be callable by folios (`workflow_call`, taking `builder_image`).
    // folio-assistant#3066 dropped it (2026-11-10): the scripts it ran exist in
    // neither repository. A `uses:` left pointing at it would fail to start, and
    // only when that workflow next runs — so that is what this looks for.
    const dir = join(repoRootFor(INSTANCE_ROOT), ".github/workflows");
    expect(existsSync(join(dir, "publish.yml"))).toBe(false);
    const callers = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => /\.ya?ml$/.test(f))
          .filter((f) => /uses:\s*\S*\.github\/workflows\/publish\.yml\b/.test(readFileSync(join(dir, f), "utf-8")))
      : [];
    expect(callers).toEqual([]);
  });

  test("the deprecated image workflows are gone, with their images", () => {
    // Removed 2026-10-07 (bean `ar1s`, phase 2, owner GO): both were
    // dispatch-only and built images nothing used. An image is now part of
    // the Tool that uses it, declared by its `install.container`.
    for (const wf of ["docker-ci-image.yml", "build-latex-image.yml"]) {
      expect(existsSync(join(REPO_ROOT, `.github/workflows/${wf}`))).toBe(false);
    }
    expect(existsSync(join(REPO_ROOT, ".github/docker"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "Dockerfile"))).toBe(false);
  });
});
