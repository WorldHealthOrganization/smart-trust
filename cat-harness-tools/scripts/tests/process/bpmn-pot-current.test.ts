/**
 * Every diagram has a current `.pot` in every locale that translates diagrams.
 *
 * ## Why this is a test and why the gate is per-locale
 *
 * `render-bpmn` has `render:bpmn:check` and `AGENTS.md` records why at length:
 * a generated artefact with no staleness check drifts silently. `translate-bpmn`
 * had no counterpart, so adding a diagram and not re-extracting cost nothing
 * until somebody ran extract by hand. Bean `0hd6`, measured 2026-09-19:
 * **12 of 32** diagrams had no `fr` template at all, and **18 of the 20 that
 * existed were stale** — still naming `.beans/`, the dot-prefixed directory
 * that moved to `beans/` on 2026-09-18. A translator working from those would
 * have translated a path that no longer exists.
 *
 * The gate is per-locale because `fr` is the only locale with workflow
 * coverage; `ar`, `es`, `ru` and `zh` carry `kg-viewer` and nothing else.
 * Demanding 32 templates each would invent 128 files of coverage those locales
 * do not have anywhere, which is worse than the gap. They are REPORTED by the
 * checker instead — a locale scanned, found empty and called clean is the
 * `dh4f` defect.
 *
 * ## Read a failure here as one of two things
 *
 * A diagram you added needs `bun run cat translate-bpmn --extract`, or a diagram
 * you edited changed a label and the template must follow. Both are the same
 * one-line fix. What a failure is NEVER is a reason to drop the locale from
 * the gate.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { directoryForGraph } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";

const root = resolve(HARNESS_ROOT);

describe("BPMN translation templates", () => {
  test("at least one locale gates — otherwise this proves nothing", () => {
    // Without this, deleting `translations/fr/processes/` makes the checker
    // report every locale as "not a target" and exit 0, which is a vacuous
    // pass over the exact defect being guarded against.
    // RESOLVED from the declaration, not composed. This read
    // `join(root, "translations")`, and `wggr` moved that directory under the
    // layer stub — which made this very guard vacuous in the way its own
    // comment above warns about, except by RELOCATION rather than deletion.
    // A guard against a vacuous pass that is itself addressed by convention
    // can be silenced by a `git mv`.
    // declared-path-literal: the convention fallback for a layer that
    // declares nothing, matching `translationSourcesDir` in
    // src/tools/translation.ts.
    const dir = directoryForGraph(root, "translation-sources") ?? join(root, "translations");
    const gating = existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true }).filter(
          (e) => e.isDirectory() && existsSync(join(dir, e.name, "processes")),
        )
      : [];
    expect(gating.map((e) => e.name)).toContain("fr");
  });

  test("no diagram is missing or stale in a gating locale", () => {
    const r = spawnSync("bun", ["run", join(TOOLS_ROOT, "scripts/translate-bpmn.ts"), "--check"], {
      cwd: root,
      encoding: "utf-8",
    });
    expect(r.stdout, "run `bun run cat translate-bpmn --extract`").toContain("never extracted");
    expect(r.status).toBe(0);
  });
});

/**
 * The checker's OWN behaviour, on a throwaway layer.
 *
 * The test above proves the committed tree is fresh; it cannot prove the
 * checker would notice if it were not — a `--check` that always exits 0
 * passes it too. These run the real script with `--instance <tmp>` against an
 * undeclared layer (so the conventional `processes/` and `translations/`
 * apply) and walk every state: missing, fresh, timestamp-only, stale,
 * orphaned, and nothing-examined. Bean `0hd6`.
 */
describe("translate-bpmn --check — every state", () => {
  const script = join(TOOLS_ROOT, "scripts", "translate-bpmn.ts");
  const bpmn = (label: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <process id="P" name="Demo process">
    <startEvent id="S" name="Begin"/>
    <task id="T" name="${label}"/>
  </process>
</definitions>
`;
  const run = (inst: string, ...args: string[]) =>
    spawnSync("bun", ["run", script, "--instance", inst, ...args], { encoding: "utf-8" });

  const withInstance = (fn: (inst: string) => void): void => {
    const inst = mkdtempSync(join(tmpdir(), "translate-bpmn-check-"));
    try {
      mkdirSync(join(inst, "processes"), { recursive: true });
      mkdirSync(join(inst, "translations", "fr"), { recursive: true });
      writeFileSync(join(inst, "processes", "demo.bpmn"), bpmn("Do the thing"));
      fn(inst);
    } finally {
      rmSync(inst, { recursive: true, force: true });
    }
  };
  const pot = (inst: string): string => join(inst, "translations", "fr", "processes", "demo.pot");

  test("no locale gates → exit 2, never a clean pass over nothing", () => {
    withInstance((inst) => {
      const r = run(inst, "--check");
      expect(r.stdout).toContain("Nothing was checked");
      expect(r.status).toBe(2);
    });
  });

  test("a missing .pot fails; extracting it makes the check pass", () => {
    withInstance((inst) => {
      const before = run(inst, "--check", "--locale", "fr");
      expect(before.stdout).toContain("NEVER EXTRACTED");
      expect(before.status).toBe(1);

      expect(run(inst, "--extract", "--locale", "fr").status).toBe(0);
      expect(existsSync(pot(inst))).toBe(true);

      // The locale now has a processes/ tree, so it gates without --locale.
      const after = run(inst, "--check");
      expect(after.stdout).toContain("gating on: fr");
      expect(after.status).toBe(0);
    });
  });

  test("a POT-Creation-Date difference alone is not staleness", () => {
    withInstance((inst) => {
      run(inst, "--extract", "--locale", "fr");
      const text = readFileSync(pot(inst), "utf-8");
      expect(text).toMatch(/^"POT-Creation-Date:/m);
      writeFileSync(pot(inst), text.replace(/^"POT-Creation-Date:.*$/m, '"POT-Creation-Date: 1999-01-01 00:00+0000\\n"'));
      expect(run(inst, "--check").status).toBe(0);
    });
  });

  test("a label changed after extraction makes the .pot stale", () => {
    withInstance((inst) => {
      run(inst, "--extract", "--locale", "fr");
      writeFileSync(join(inst, "processes", "demo.bpmn"), bpmn("Do a different thing"));
      const r = run(inst, "--check");
      expect(r.stdout).toContain("OUT OF DATE");
      expect(r.stdout).toContain("demo.pot");
      expect(r.status).toBe(1);
    });
  });

  test("a template whose diagram is gone is a finding", () => {
    withInstance((inst) => {
      run(inst, "--extract", "--locale", "fr");
      writeFileSync(join(inst, "translations", "fr", "processes", "gone.pot"), readFileSync(pot(inst), "utf-8"));
      const r = run(inst, "--check");
      expect(r.stdout).toContain("gone.pot");
      expect(r.status).toBe(1);
    });
  });
});
