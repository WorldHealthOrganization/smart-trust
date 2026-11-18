/**
 * One writer for the SVGs drawn beside their `.bpmn` (bean `gm9g`).
 *
 * `bootstrap/processes/*.svg` were written by TWO generators that disagreed:
 * bootstrap-tools' renderer stamps a generated-by note (`GENERATED_BY`) on
 * what it writes into bootstrap (bean `xsqm`), and the platform's copy of that
 * writer did not. Each called the other's output stale, `render:bpmn:check`
 * went red on `main`, and regenerating "fixed" it by deleting the note.
 *
 * `6c7acb5` settled ownership: the platform's `render-bpmn.ts` calls
 * bootstrap-tools' own `besideSource` rather than re-implementing it. These
 * pin both halves, so the next widening of a scan set cannot quietly bring
 * back a second implementation.
 *
 * @module scripts/tests/render-bpmn-single-writer
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { GENERATED_BY } from "@litlfred/bootstrap-tools/scripts/generated-by.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const PLATFORM_RENDERER = join(TOOLS_ROOT, "scripts", "render-bpmn.ts");
const BOOTSTRAP_PROCESSES = join(REPO, "bootstrap", "processes");

describe("the platform renderer delegates beside-source SVGs (bean gm9g)", () => {
  const src = readFileSync(PLATFORM_RENDERER, "utf8");

  test("it imports bootstrap-tools' own besideSource", () => {
    expect(src).toMatch(/besideSource as besideSourceSvg[\s\S]*?from "@litlfred\/bootstrap-tools\/scripts\/render-bpmn\.ts"/);
    // Called with the renderer and the diagram. The third argument is the
    // process-id map; since e48025f9 it is resolved per referrer
    // (`definersFrom`), so its spelling is not what this test is about.
    expect(src).toMatch(/besideSourceSvg\(renderer, file, [^)]+\)/);
  });

  test("every diagram gets a copy beside its source, not only an exempt layer's (bean akiq)", () => {
    // Owner, 2026-11-05: each layer draws its own diagrams. Filtering this set
    // to the layers exempt from `workflow-visualiser` left every other layer's
    // drawing in cat-harness, which then hand-listed each one.
    expect(src).toContain("const besideSource = new Set(sources);");
  });

  test("it does not carry its own copy of the beside-source writer", () => {
    // `siblingLinks` was the platform's re-implementation; its return is the
    // regression this test exists to catch.
    expect(src).not.toMatch(/\bsiblingLinks\s*\(/);
  });
});

describe("every committed beside-source SVG keeps its provenance note (bean gm9g)", () => {
  const svgs = existsSync(BOOTSTRAP_PROCESSES)
    ? readdirSync(BOOTSTRAP_PROCESSES).filter((f) => f.endsWith(".svg"))
    : [];

  test("there are SVGs to check — the bootstrap submodule is checked out", () => {
    expect(svgs.length).toBeGreaterThan(0);
  });

  // The wording is bootstrap-tools' own constant, so this follows it: since
  // 2026-10-01 (#1770) a non-README note names the toolset by ADDRESS.
  test.each(svgs.map((f) => [f]))("%s says the bootstrap toolset generated it", (f) => {
    const head = readFileSync(join(BOOTSTRAP_PROCESSES, f), "utf8").split("\n", 3).join("\n");
    expect(head).toContain(GENERATED_BY);
  });
});
