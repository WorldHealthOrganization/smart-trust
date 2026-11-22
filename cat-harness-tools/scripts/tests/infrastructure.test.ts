/**
 * Infrastructure tests — MCP config, scripts, schemas, deploy.
 *
 * Migrated from the original bash run-tests.sh, now type-safe
 * and producing structured TestReport output.
 *
 * The tests here that read the aggregate repository's own root (the
 * `.gitignore`, the CI workflows and cat-harness-tools' MCP Dockerfile) live
 * in `test/infrastructure-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { INSTANCE_ROOT, FOLIO_ROOT, hasFolio, REPO_ROOT } from "./helpers";
import { TOOLS_ROOT } from "../lib/roots.ts";
import { maskComments } from "../../pipeline/uses-field";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/** Skip folio-side assertions when no content repo is attached. */
const folio = hasFolio();

// ── check-no-lean-artifacts.sh ──────────────────────────────────

describe("check-no-lean-artifacts.sh", () => {
  test("passes on clean repo", () => {
    const script = join(TOOLS_ROOT, "scripts", "check-no-lean-artifacts.sh");
    expect(() =>
      execSync(script, { cwd: INSTANCE_ROOT, encoding: "utf-8", timeout: 5_000 })
    ).not.toThrow();
  });
});

// ── Config files ────────────────────────────────────────────────

describe.skipIf(!folio)("lean-mcp.config.json", () => {
  // Folio-side deployment config, not a platform artifact.
  const configPath = join(FOLIO_ROOT ?? INSTANCE_ROOT, "lean-mcp.config.json");

  test("is valid JSON", () => {
    const content = readFileSync(configPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("has required fields", () => {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toHaveProperty("image");
    expect(config).toHaveProperty("mcp_internal_port");
    expect(config).toHaveProperty("auth");
    expect(config).toHaveProperty("folio");
    expect(config.folio).toHaveProperty("domain");
  });

  test("has llm provider config", () => {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toHaveProperty("llm");
    expect(config.llm).toHaveProperty("provider");
    expect(config.llm).toHaveProperty("providers");
  });
});

describe.skipIf(!folio)(".mcp.json", () => {
  // The `paper-assistant` server is registered by the FOLIO, which points it
  // at the folio's own start script. The platform's .mcp.json registers `sage`.
  const mcpPath = join(REPO_ROOT, ".mcp.json");

  test("is valid JSON", () => {
    const content = readFileSync(mcpPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("has paper-assistant server", () => {
    const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
    expect(mcp.mcpServers).toHaveProperty("paper-assistant");
  });
});

describe("Unified paper-assistant image", () => {

  test("the platform ships no folio-specific builder Dockerfile", () => {
    expect(existsSync(join(repoRootFor(INSTANCE_ROOT), ".github/docker/Dockerfile.paper-builder"))).toBe(false);
    expect(existsSync(join(repoRootFor(INSTANCE_ROOT), ".github/workflows/paper-builder-image.yml"))).toBe(false);
  });

  test("docker-tex.sh helper exists", () => {
    expect(existsSync(join(TOOLS_ROOT, "scripts", "lib", "docker-tex.sh"))).toBe(true);
  });

  test("render-on-change.sh uses docker-tex.sh", () => {
    const script = readFileSync(join(TOOLS_ROOT, "scripts", "render-on-change.sh"), "utf-8");
    expect(script).toContain("docker-tex.sh");
  });

  test("render-pre-commit.sh uses docker-tex.sh", () => {
    const script = readFileSync(join(TOOLS_ROOT, "scripts", "render-pre-commit.sh"), "utf-8");
    expect(script).toContain("docker-tex.sh");
  });

  test.skipIf(!folio)("config image matches build workflow", () => {
    // `lean-mcp.config.json` is a FOLIO artifact; the workflow is ours.
    const config = JSON.parse(
      readFileSync(join(FOLIO_ROOT ?? INSTANCE_ROOT, "lean-mcp.config.json"), "utf-8"),
    );
    const workflow = readFileSync(join(repoRootFor(INSTANCE_ROOT), ".github/workflows/build-lean-mcp.yml"), "utf-8");
    expect(config.image).toContain("paper-assistant");
    expect(workflow).toContain("paper-assistant");
  });
});

// ── Deploy infrastructure ───────────────────────────────────────

describe("Deploy infrastructure", () => {
  test("Caddyfile.template uses domain variable", () => {
    const caddyfile = readFileSync(
      join(TOOLS_ROOT, "deploy", "Caddyfile.template"),
      "utf-8"
    );
    expect(caddyfile).toContain("${FOLIO_DOMAIN}");
  });

  test("self-update.sh preserves .env", () => {
    const script = readFileSync(
      join(TOOLS_ROOT, "deploy", "self-update.sh"),
      "utf-8"
    );
    expect(script).toContain("exclude='deploy/.env'");
  });
});

// ── .gitignore ──────────────────────────────────────────────────

describe.skipIf(!folio)(".gitignore", () => {
  // These rules (deploy/.env, the paper's lean/.lake/) belong to the FOLIO.
  const gitignore = readFileSync(join(REPO_ROOT, ".gitignore"), "utf-8");

  test("blocks deploy/.env", () => {
    expect(gitignore).toContain("deploy/.env");
  });

  test("blocks folio/quantum-observable-universe/lean/.lake/", () => {
    expect(gitignore).toContain("folio/quantum-observable-universe/lean/.lake/");
  });
});

// ── Test-suite path anchoring ───────────────────────────────────

/**
 * `run-tests.sh` does `cd "$SCRIPT_DIR"` before `bun test`, so under the
 * canonical runner `process.cwd()` is `scripts/tests/`, NOT the repo root. A
 * test that builds a repo path with `join(process.cwd(), ...)` therefore points
 * at `scripts/tests/<path>`, which does not exist — and the failure surfaces as
 * whatever the code under test does with a missing file rather than as "wrong
 * path". `qa-criterion-hash.test.ts` lost its real-module guard that way: the
 * hash came back `null` from an ENOENT, indistinguishable from the checker
 * shape drift the guard exists to catch, and the test only ever passed when the
 * suite was invoked by hand from the repo root.
 *
 * Repo paths in tests anchor at `import.meta.dir` (`INSTANCE_ROOT` in `helpers.ts`)
 * — which is also what survives a folio embedding this repo by symlink.
 */
describe("tests anchor repo paths at import.meta.dir, not process.cwd()", () => {
  // `join(process.cwd(), ...)` / `resolve(process.cwd(), ...)`, across line
  // breaks, plus the `process.cwd() + "/..."` spelling. Bare `process.cwd()` is
  // NOT flagged: saving and restoring it around a `process.chdir` is legitimate
  // and several tests do exactly that.
  const CWD_ANCHORED = /(?:\b(?:join|resolve)\(\s*process\.cwd\(\)|process\.cwd\(\)\s*\+)/g;
  /** Opt-out for a test that genuinely means "relative to wherever we are". */
  const ALLOW = "allow-cwd-anchored-paths";

  const dir = join(TOOLS_ROOT, "scripts", "tests");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));

  test("scans a plausible number of test files", () => {
    // Guards the guard: a bad directory or filter would make it vacuous.
    expect(files.length).toBeGreaterThan(50);
  });

  test("no test builds a repo path from the runner's cwd", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf-8");
      if (source.includes(ALLOW)) continue;
      // Comments are prose ABOUT the anti-pattern — this block's own docstring
      // included. `maskComments` blanks them in place, so offsets and line
      // numbers still point at the real source.
      const code = maskComments(source);
      for (const m of code.matchAll(CWD_ANCHORED)) {
        const line = code.slice(0, m.index).split("\n").length;
        offenders.push(`${file}:${line}: ${m[0].replace(/\s+/g, " ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── Schema files ────────────────────────────────────────────────

describe("Schema files", () => {
  test("formalization-types.ts exists", () => {
    expect(existsSync(join(TOOLS_ROOT, "schemas/formalization-types.ts"))).toBe(true);
  });

  test("formalization-types.ts exports all key types", () => {
    const content = readFileSync(
      join(TOOLS_ROOT, "schemas/formalization-types.ts"),
      "utf-8"
    );
    // Proof pipeline types
    expect(content).toContain("export interface ProofObjectsManifest");
    expect(content).toContain("export interface ProofObject");
    expect(content).toContain("export interface ReviewRecord");
    // Visualizer types (migrated from schema/viz.json)
    expect(content).toContain("export interface VizState");
    expect(content).toContain("export type VizMode");
    // Skills config types (migrated from skills-config-schema.json)
    expect(content).toContain("export interface SkillsConfig");
    expect(content).toContain("export interface SkillPackage");
  });

  test("constraints.ts exports Zod schemas for cat-harness's own block kinds", () => {
    // The science layer's kinds (definition, theorem, …) are typed by its
    // vocabulary module since 2026-10-22, not by constraints.ts.
    const content = readFileSync(
      join(TOOLS_ROOT, "schemas/constraints.ts"),
      "utf-8"
    );
    for (const schema of [
      "AlgorithmSchema", "ExampleSchema", "RemarkSchema", "ProseSchema",
      "ComputationSchema", "ProvableBaseSchema",
    ]) {
      expect(content).toContain(`export const ${schema}`);
    }
  });

  test.skipIf(!folio)("proof-objects.json has valid structure", () => {
    const manifest = JSON.parse(
      readFileSync(join(FOLIO_ROOT ?? INSTANCE_ROOT, "proof-objects.json"), "utf-8")
    );
    // Version and top-level structure
    expect(manifest.version).toBe("1.0");
    expect(manifest).toHaveProperty("objects");
    expect(manifest).toHaveProperty("manuscript");
    expect(Array.isArray(manifest.objects)).toBe(true);
    // Manuscript metadata
    expect(manifest.manuscript).toHaveProperty("repo");
    expect(manifest.manuscript).toHaveProperty("commit_sha");
    expect(manifest.manuscript).toHaveProperty("generated_at");
    // Validate first object has required fields (structural check)
    if (manifest.objects.length > 0) {
      const obj = manifest.objects[0];
      expect(obj).toHaveProperty("label");
      expect(obj).toHaveProperty("object_type");
      expect(obj).toHaveProperty("latex");
      expect(obj.latex).toHaveProperty("file");
      expect(obj.latex).toHaveProperty("line");
      // object_type must be a valid kind
      const validKinds = [
        "definition", "theorem", "lemma", "proposition",
        "corollary", "conjecture", "example", "remark",
      ];
      expect(validKinds).toContain(obj.object_type);
    }
  });
});
