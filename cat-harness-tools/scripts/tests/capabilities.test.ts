/**
 * `.claude/skills/capabilities/*.json` described how to detect each external
 * tool, and nothing executed them. Skills declare `requiredCapabilities`
 * against those ids, so a skill's prerequisite could be missing with no way to
 * find out — and the integration contract's rule is **absent tool ⇒ `n/a`,
 * never a false pass**, which an unexecuted probe cannot deliver.
 *
 * These pin the runner, and especially the `requires` resolution: a capability
 * whose prerequisite is absent must report *that*, not a bare probe failure,
 * because the two call for different fixes.
 */
import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import {
  loadCapabilities,
  probe,
  probeAll,
  formatCapabilityReport,
  type Capability,
} from "../../src/tools/capabilities";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { notApplicableAlone } from "../../test/support/checkout.js";

const REPO = repoRootFor(join(import.meta.dir, "..", ".."));

const cap = (id: string, detection: Capability["detection"], requires?: string[]): Capability => ({
  id,
  name: id,
  description: "",
  detection,
  requires,
});

describe("loading", () => {
  test("reads the repo's declared capabilities", () => {
    const caps = loadCapabilities(REPO);
    expect(caps.length).toBeGreaterThan(10);
    expect(caps.map((c) => c.id)).toContain("bun-runtime");
  });

  test("an absent directory yields none rather than throwing", () => {
    expect(loadCapabilities("/nonexistent-repo-root")).toEqual([]);
  });

  test("every declared capability's `requires` resolves to a declared id", () => {
    // A dangling prerequisite silently makes a capability permanently absent.
    const caps = loadCapabilities(REPO);
    const ids = new Set(caps.map((c) => c.id));
    for (const c of caps) {
      for (const r of c.requires ?? []) {
        expect({ cap: c.id, requires: r, known: ids.has(r) }).toEqual({
          cap: c.id,
          requires: r,
          known: true,
        });
      }
    }
  });
});

describe("probe methods", () => {
  test("always", () => {
    expect(probe(cap("x", { method: "always" }))).toBe(true);
  });

  test("env-var reads the passed environment, not the ambient one", () => {
    expect(probe(cap("x", { method: "env-var", variable: "FOO" }), { FOO: "1" })).toBe(true);
    expect(probe(cap("x", { method: "env-var", variable: "FOO" }), {})).toBe(false);
  });

  test("file-exists", () => {
    expect(probe(cap("x", { method: "file-exists", path: REPO }))).toBe(true);
    expect(probe(cap("x", { method: "file-exists", path: "/nope" }))).toBe(false);
  });

  test("command", () => {
    expect(probe(cap("x", { method: "command", command: "true" }))).toBe(true);
    expect(probe(cap("x", { method: "command", command: "exit 3" }))).toBe(false);
  });

  test("a declared non-zero exit code counts as present", () => {
    expect(probe(cap("x", { method: "command", command: "exit 3", expectExitCode: 3 }))).toBe(true);
  });

  test("mcp-probe is not attempted — a check that hangs is worse than one that abstains", () => {
    expect(probe(cap("x", { method: "mcp-probe", endpoint: "http://localhost:1" }))).toBe(false);
  });
});

describe("requires resolution", () => {
  const caps = [
    cap("base", { method: "always" }),
    cap("missing-base", { method: "command", command: "exit 1" }),
    cap("needs-ok", { method: "always" }, ["base"]),
    cap("needs-missing", { method: "always" }, ["missing-base"]),
  ];

  test("a met prerequisite lets the probe run", () => {
    expect(probeAll(caps).find((s) => s.id === "needs-ok")!.present).toBe(true);
  });

  test("an unmet prerequisite is named, not reported as a probe failure", () => {
    // The two call for different fixes: install the prerequisite, versus
    // investigate why this tool's own probe fails.
    const s = probeAll(caps).find((x) => x.id === "needs-missing")!;
    expect(s.present).toBe(false);
    expect(s.missingRequires).toEqual(["missing-base"]);
    expect(s.reason).toBe("requires missing-base");
  });

  test("the dependent's own probe is not run when a prerequisite is unmet", () => {
    // Running it would either fail confusingly or succeed and hide the break.
    const marker = join(REPO, "___probe_should_not_run___");
    const cs = [
      cap("gone", { method: "command", command: "exit 1" }),
      cap("dependent", { method: "command", command: `touch ${marker}` }, ["gone"]),
    ];
    probeAll(cs);
    expect(existsSync(marker)).toBe(false);
  });

  test("a cycle is unmet rather than infinite", () => {
    const cyclic = [
      cap("a", { method: "always" }, ["b"]),
      cap("b", { method: "always" }, ["a"]),
    ];
    expect(() => probeAll(cyclic)).not.toThrow();
    expect(probeAll(cyclic).every((s) => !s.present)).toBe(true);
  });

  test("an unknown prerequisite is unmet, not ignored", () => {
    const s = probeAll([cap("x", { method: "always" }, ["nope"])])[0]!;
    expect(s.present).toBe(false);
  });
});

/**
 * smart-base's probe is declared by the layer whose toolchain it is, in that
 * layer's own `scenarios/capabilities/` (the overlay `loadCapabilities`
 * reads), never down here; only a composed checkout holds it.
 */
const NO_SMART_BASE_PROBE = notApplicableAlone(
  "the `smart-base` capability probe, declared in a higher layer's scenarios/capabilities/ and read through the checkout overlay",
);

describe.skipIf(NO_SMART_BASE_PROBE)("the smart-base capability", () => {
  const smartBase = () => loadCapabilities(REPO).find((c) => c.id === "smart-base")!;

  test("is declared and depends on python3", () => {
    expect(smartBase().requires).toEqual(["python3"]);
  });

  test("honours SMART_BASE_HOME and is absent without a checkout", () => {
    // Loaded from, never vendored: smart-base stays the DAK repos' own
    // authoritative copy because their GitHub Actions invoke it.
    const c = smartBase();
    expect(c.detection.command).toContain("SMART_BASE_HOME");
    expect(probe(c, { PATH: process.env.PATH, SMART_BASE_HOME: "/nonexistent" })).toBe(false);
  });
});

describe("report", () => {
  test("says so when nothing is declared, rather than printing nothing", () => {
    expect(formatCapabilityReport([])).toContain("no capability probes declared");
  });

  test("names the reason for each absent capability", () => {
    const out = formatCapabilityReport(
      probeAll([cap("a", { method: "always" }), cap("b", { method: "command", command: "exit 1" })]),
    );
    expect(out).toContain("✓ a");
    expect(out).toContain("probe failed");
  });
});
