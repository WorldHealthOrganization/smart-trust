/**
 * `folio-root` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/folio-root.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the root layer's declaration
 * (`folio-assistant.json`), which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { INSTANCE_ROOT } from "../../scripts/tests/helpers.ts";
import { readDeclaration, repoRootFor } from "../../schemas/kg/cat-harness.js";

describe("FOLIO_ROOT detection", () => {
  test("INSTANCE_ROOT is this platform checkout", () => {
    expect(isAbsolute(INSTANCE_ROOT)).toBe(true);
    // `cat-harness`, not `folio-assistant`. The two were one directory until
    // the move (bean `wggr`): this is the LAYER root, and the repository is
    // still `folio-assistant`. Asserted on the directory rather than on the
    // stub deliberately — the stub stays `folio-assistant` because it names
    // published artefacts, so the two now differ and a test that conflated
    // them would pass for the wrong reason.
    expect(INSTANCE_ROOT.endsWith("cat-harness")).toBe(true);
    // The repository was identified by its DECLARED name, not its folder (bean
    // `t5dm`), and that name was the root layer's: `folio-assistant`.
    // RESTATED 2026-10-09. The owner removed that declaration on 2026-10-08
    // (3d4caf6: "folio-asst should be purely declarative / should not need
    // folio-assistant declared at all"); the checkout root now holds an INDEX,
    // not a layer. So the root declares nothing, and what makes it this
    // checkout -- still by declaration, never by folder name -- is the
    // `index.config.json` there, listing this platform layer.
    const root = repoRootFor(INSTANCE_ROOT);
    expect(readDeclaration(root)).toBeUndefined();
    const index = JSON.parse(readFileSync(join(root, "index.config.json"), "utf-8")) as {
      $schema?: string;
      instances?: { name?: string }[];
      layers?: { name?: string }[];
    };
    expect(index.$schema).toBe("folio-index-config/v1");
    expect((index.instances ?? index.layers ?? []).map((i) => i.name)).toContain(basename(INSTANCE_ROOT));
  });
});
