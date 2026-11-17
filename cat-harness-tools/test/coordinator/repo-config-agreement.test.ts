/**
 * This repository's content root and its layer config AGREE — bean `zkgs`.
 *
 * @module test/repo-config-agreement
 * @graphNode none — a test
 *
 * ## The defect this pins
 *
 * `findContentRepoRoot()` stopped at `cat-harness/` while the config sat one
 * level up under another name, so `readDeclaredFolioProfile()` answered the
 * third state ("undetermined") from anywhere in this checkout. Every
 * `profiles: ["paper"]` criterion then ran on workflow documentation, and no
 * optional QA axis could be opted into here at all. Neither half was wrong on
 * its own; nothing asserted they MET. The resolver answered with a plausible
 * path rather than a fault — which is why it survived.
 *
 * It was fixed incidentally, by per-instance config names
 * (`<instance>.config.json`) and a resolver that walks outward from the
 * layer root. This test is the part that was missing: it runs the REAL
 * resolution on the REAL repository, not a fixture, so the next rename that
 * separates them fails here instead of silently re-scoping QA.
 *
 * Moved here from `cat-harness/scripts/tests/repo-config-agreement.test.ts` to
 * the checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it reads the aggregate root's config
 * and declaration, which only the whole checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. Paths are composed from ORIGIN_DIR, the directory
 * it was written in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { findContentRepoRoot } from "../../pipeline/repo-root.ts";
import { readDeclaredFolioProfile } from "../../pipeline/profile-check.ts";
import { folioOptionalAxes } from "../../pipeline/qa-criteria-registry.ts";
import { readEffectiveConfig } from "../../schemas/kg/harness-config.ts";

/**
 * RESTATED 2026-10-09 for the index. The tests below required a
 * `<name>.config.json` FILE at the end of an outward walk. Since the split the
 * checkout root carries `index.config.json` (`folio-index-config/v1`), whose
 * per-instance ENTRIES are the config, and the per-instance files are gone
 * (the owner's 3d4caf6 removed the root's; cat-harness carries none). Every
 * config reader now goes through `readEffectiveConfig` -- the index entry
 * first, then the file (cat-harness#19). So "the content root and its config
 * agree" is asked of that reader: it must find the entry (`state: "ok"`, `via:
 * "index"`, `from` naming it), and the two consumers the `zkgs` defect broke
 * -- the declared profile and the optional axes -- must read the same answer.
 * The defect this pins is unchanged: a resolver that answers with a plausible
 * place rather than the config fails here.
 */
describe("this repository's content root and its config agree — bean `zkgs`", () => {
  const root = findContentRepoRoot();

  test("the content root resolves to its index entry, not to nothing", () => {
    const eff = readEffectiveConfig(root);
    expect(eff.state).toBe("ok"); // anything else is the zkgs defect
    expect(eff.via).toBe("index");
    expect(eff.from).toMatch(/^index\.config\.json entry "/);
  });

  test("the declared profile is `document`, never the third state", () => {
    const p = readDeclaredFolioProfile(root);
    expect(p.profile).toBe("document");
    expect(p.declaredBy).not.toMatch(/undetermined/);
  });

  /**
   * THE NESTED LAYER RESOLVES TO ITS OWN CONFIG, not the root's.
   *
   * Added 2026-09-23 from a duplicate investigation of this bean. `cat-harness/`
   * is the directory the walk USED to stop at, and the root the one it used to
   * miss -- the two ends of the defect. In the composed checkout cat-harness IS
   * the content root, and its config is its OWN index entry: a resolver that
   * answered some other layer's entry (or cat-harness's own nested
   * `index.config.json`, which names it with no `contentType` -- the mount-scope
   * defect cat-harness#19 fixed) would hand every layer the wrong
   * `contentType`.
   */
  test("`cat-harness/` resolves to its OWN entry, not another instance's", () => {
    const dir = join(root, "..", "cat-harness");
    const eff = readEffectiveConfig(dir);
    expect(eff.state).toBe("ok");
    expect(eff.from).toContain('entry "cat-harness"');
    const nested = readDeclaredFolioProfile(dir);
    expect(nested.profile).toBe("document");
    expect(nested.declaredBy).toContain('entry "cat-harness"');
    expect(nested.declaredBy).not.toMatch(/undetermined/);
  });

  test("the optional-axes reader reads where the config actually is", () => {
    // `folioOptionalAxes()` reads `readEffectiveConfig(findContentRepoRoot())`.
    // If it read anywhere else, every axis opt-in would be silently ignored --
    // the other half of the defect, invisible because "no axes" is also a
    // legitimate answer. So its answer must be exactly the entry's `qaAxes`.
    const eff = readEffectiveConfig(root);
    expect(eff.state).toBe("ok");
    const declared = (eff.state === "ok" ? (eff.config as { qaAxes?: unknown }).qaAxes : undefined) ?? [];
    expect(folioOptionalAxes()).toEqual(declared as string[]);
  });
});
