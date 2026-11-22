/**
 * Generate, ONCE and before any worker starts, the artefacts the e2e specs
 * read from `_kg/`.
 *
 * @module test/e2e-global-setup
 *
 * Bean `dlqu`. These were three module-level `execFileSync` calls in
 * `kg-viewer.e2e.ts` and `a11y.e2e.ts`. With `workers: 1` a module loaded once
 * and they ran in sequence, so nothing could overlap. With several workers
 * every worker loads the spec module, and the fixture script ran
 * UNCONDITIONALLY from two of them: worker A rewriting
 * `_kg/folio-assistant-i18n-fixture/index.html` while worker B's page was
 * fetching it. A race of that kind does not fail every run, it fails one in
 * N, which is the shape a reviewer calls a flake and re-runs, so it is
 * removed rather than tolerated.
 *
 * The suite still generates what it needs when it is absent, so what is under
 * test is what the deploy emits, never a committed fixture that could agree
 * with the test and disagree with what ships. Only WHERE it happens moved.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { artefactStubFor } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

export default function globalSetup(): void {
  // B1 (owner, 2026-10-14): the pages the specs read that no layer commits
  // any more — built at publish because they are computed over the checkout's
  // other layers or from a branch-kept graph (`builtAtPublish`). Built here
  // the way the deploy builds them, from the mounted state, so the beans count
  // in `_data/harness.json` and in `assets/beans/count.json` come from ONE
  // mount (`beans-count-agrees` failed on two snapshots taken at different
  // times). Needs `state:mount` first, which the e2e job runs; a missing mount
  // fails here, loudly, rather than in forty specs. `E2E_DERIVED=present`
  // skips it when a local run has already built them.
  if (process.env.E2E_DERIVED !== "present") {
    execFileSync("bun", ["run", "cat", "derive:publish"], { stdio: "inherit" });
  }
  // The same resolution both specs use: the layer directory above `test/`.
  const stub = artefactStubFor(join(HARNESS_ROOT));
  for (const [file, script, ...args] of [
    // The document's published path under `_kg/`, the layer's own
    // directory (#603 decision 1b), which the exporter's default `--out` is.
    [`_kg/${stub}/${stub}.jsonld`, "cat-harness-tools/scripts/kg-export.ts"],
    [`_kg/${stub}/index.html`, "cat-harness-tools/scripts/kg-viewer.ts", "--out", `_kg/${stub}/index.html`],
  ] as const) {
    if (!existsSync(file)) execFileSync("bun", ["run", script, ...args], { stdio: "inherit" });
  }
  // Unconditional, as it was: the fixture is cheap and must reflect the
  // generator in THIS tree, not one an earlier run left behind.
  execFileSync("bun", ["run", "cat-harness-tools/scripts/tests/kg-viewer-fixture.ts"], { stdio: "inherit" });
}
