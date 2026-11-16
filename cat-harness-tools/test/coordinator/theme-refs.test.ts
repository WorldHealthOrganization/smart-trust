/**
 * Every theme a declaration references is installed (#1168 B8).
 *
 * Theme references became `ThemeRef` objects `{instance?, themeId}` on
 * 2026-09-30 (owner: "migrate to ThemeRef"). The schema checks the shape;
 * this checks the reference RESOLVES. Before it, an unknown theme fell back
 * silently to the default at render time — a declaration that reads as a
 * choice and renders as none.
 *
 * Resolved BY REFERENCE, owner first (`themeByRef`, bean `v8n5`), not against
 * the platform table alone: who-iris's card cites its own `iris-sticky`,
 * which the platform deliberately does not hold, and a platform-only lookup
 * would call that correct reference broken.
 *
 * Moved here from `cat-harness/scripts/tests/theme-refs.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it resolves every theme reference every
 * layer in the checkout declares, which only the whole checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. Paths are
 * composed from ORIGIN_DIR, the directory it was written in, so nothing it
 * reads changed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { Glob } from "bun";

import { declarationPathIn, layerRootsIn } from "../../schemas/kg/cat-harness.js";
import { themeByRef } from "../../schemas/ui/theme-by-ref.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

type Ref = { themeId: string; instance?: string };
type Found = { where: string; ref: Ref; citing?: string };

function refs(): Found[] {
  const out: Found[] = [];
  for (const root of layerRootsIn(REPO)) {
    const p = declarationPathIn(root);
    if (!p) continue;
    const d = JSON.parse(readFileSync(p, "utf-8")) as {
      name?: string;
      directories?: { id: string; theme?: Ref; tile?: { theme?: Ref } }[];
      stickies?: { id: string; theme?: Ref }[];
    };
    const at = (s: string) => `${d.name ?? root}: ${s}`;
    for (const e of d.directories ?? []) {
      if (e.theme) out.push({ where: at(`directory ${e.id}`), ref: e.theme, citing: d.name });
      if (e.tile?.theme) out.push({ where: at(`tile ${e.id}`), ref: e.tile.theme, citing: d.name });
    }
    for (const s of d.stickies ?? []) if (s.theme) out.push({ where: at(`sticky ${s.id}`), ref: s.theme, citing: d.name });
  }
  // Sticky contributions declared as their own files.
  for (const rel of new Glob("*.json").scanSync({ cwd: resolve(REPO, "cat-harness", "folio") })) {
    const c = JSON.parse(readFileSync(resolve(REPO, "cat-harness", "folio", rel), "utf-8")) as { theme?: Ref; contributedBy?: string };
    if (c.theme) out.push({ where: `cat-harness/folio/${rel}`, ref: c.theme, citing: c.contributedBy });
  }
  return out;
}

describe("declared theme references resolve", () => {
  const all = refs();

  test("the corpus is non-empty, so the assertion below is not vacuous", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  test("every reference is a ThemeRef naming an installed theme", () => {
    const bad = all
      .filter(({ ref, citing }) => typeof ref !== "object" || !themeByRef(ref, REPO, citing).ok)
      .map(({ where, ref }) => `${where} → ${JSON.stringify(ref)}`);
    expect(bad).toEqual([]);
  });
});
