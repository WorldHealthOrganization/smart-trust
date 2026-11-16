/**
 * `readme-sections` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/readme-sections.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the root layer's
 * declaration (`memory/`) or the checkout's own submodule layout, which only
 * the checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { existsSync, rmSync } from "fs";
import { join, resolve } from "path";

import {
  SECTIONS,
  isForeignRoot,
} from "../../pipeline/readme-sections.ts";
import { loadReadmeConfig } from "../../pipeline/readme-toc.ts";
import {  } from "../../schemas/kg/cat-harness.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("cat-harness:instances — both entries, per instance (issue #592)", () => {
  const repo = resolve(ORIGIN_DIR, "..", "..", "..");
  const section = SECTIONS.find((s) => s.marker === "cat-harness:instances")!;
  const out = section.render({ root: repo, cfg: loadReadmeConfig(repo), fetch: false });

  it("every relative link in the table resolves in the checkout", () => {
    // A dead link in a generated table is worse than a missing row, because
    // the row asserts the entry exists. This once guarded one case — the
    // root `memory/` rendered as `./cat-harness/memory/` — and memory now
    // lives in each harness (bean `ar1s`), so `./cat-harness/memory/` is the
    // right link. The property was never about memory: resolve every link.
    const links = [...out.markdown.matchAll(/\]\(([^)#\s]+)\)/g)]
      .map((m) => m[1]!)
      .filter((l) => !/^[a-z]+:/.test(l));
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => !existsSync(join(repo, l)))).toEqual([]);
    expect(out.markdown).toContain("[memory](./cat-harness/memory/)");
  });
});

describe("isForeignRoot — `--all` skips a README another repository owns (bean kye5)", () => {
  const made: string[] = [];
  afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });

  it("this checkout's bootstrap-tools is one — a remote mount since bean nn8e, a submodule before (the case the skip exists for)", () => {
    const bt = resolve(ORIGIN_DIR, "../../../bootstrap-tools");
    expect(isForeignRoot(bt)).toBe(true);
  });
});
