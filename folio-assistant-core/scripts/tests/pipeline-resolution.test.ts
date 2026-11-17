/**
 * Pipeline scripts must be findable from a folio that does not vendor them.
 *
 * `runPipeline` resolved `content/pipeline/<script>.ts` against the FOLIO
 * only. That directory exists in the `qou` layout, where the platform was
 * vendored inside the content repo, and does not exist in anything
 * `folio_init` scaffolds. So roughly twenty-five tools — the whole QA, audit,
 * bibliography and transform surface — returned `pipeline script not found` on
 * every scaffolded folio.
 *
 * Unlike the sibling defect in `content_validate` (which reported a clean run
 * having executed nothing), this one was at least honest. But honest and inert
 * is still inert, and the fix is the same fallback.
 */
import { describe, test, expect } from "bun:test";
import { existsSync } from "fs";
import { basename } from "path";

import {
  resolvePipelineScript,
  runPipeline,
} from "../../adapters/document/tools/_pipeline";
import { resolveValidateScript } from "../../adapters/document/tools/validate";

describe("resolvePipelineScript", () => {
  test("findsPlatformScript", () => {
    const p = resolvePipelineScript("qa-sweep");
    expect(p).toBeDefined();
    expect(existsSync(p!)).toBe(true);
    expect(basename(p!)).toBe("qa-sweep.ts");
  });

  test("nameWithOrWithoutTs", () => {
    expect(resolvePipelineScript("qa-sweep")).toBe(resolvePipelineScript("qa-sweep.ts"));
  });

  test("findsContentLayerScript", () => {
    // Bean `yj6r`: `build-glossary` and `codemod-refterm` moved up into
    // `folio-assistant-core/scripts/`, beside the `schemas/glossary.ts` they
    // read. They are still addressed as pipeline scripts — `glossary_check` and
    // the `refterm` transform tool name them by id — so the resolver gained a
    // third location. Without this test the move reads as a clean run: the tool
    // returns `pipeline script not found`, which is honest and inert, and no
    // gate distinguishes that from a script nobody asked for.
    const p = resolvePipelineScript("build-glossary");
    expect(p).toBeDefined();
    expect(existsSync(p!)).toBe(true);
    expect(basename(p!)).toBe("build-glossary.ts");
    expect(p!).toContain("folio-assistant-core");
  });

  test("nobodyHasUndefined", () => {
    // The caller decides what absence means. Handing back a path that does not
    // exist is how `runPipeline` would spawn `bun run <missing>` and surface a
    // module-not-found instead of a clear "no such script".
    expect(resolvePipelineScript("no-such-pipeline-script-anywhere")).toBeUndefined();
  });
});

describe("runPipeline on a missing script", () => {
  test("missingReportsAbsence", () => {
    const r = runPipeline("no-such-pipeline-script-anywhere");
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
    // The message must say BOTH places were checked, or the reader's next move
    // is to go create the file in the folio — which is not the fix.
    expect(r.error).toContain("folio");
    expect(r.error).toContain("platform");
    // Three places are searched since bean `yj6r`; naming two of them would
    // send the reader to create the file in one of the two that are not it.
    expect(r.error).toContain("folio-assistant-core/scripts/");
  });
});

describe("content_validate shares the resolver", () => {
  test("validateSharesResolver", () => {
    // These were separate copies of the same fallback for exactly one commit.
    // Pinning the agreement is cheaper than noticing the day they diverge.
    expect(resolveValidateScript()).toBe(resolvePipelineScript("validate"));
  });
});
