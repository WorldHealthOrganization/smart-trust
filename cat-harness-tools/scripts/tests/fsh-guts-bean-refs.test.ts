/**
 * Every fsh-guts record's `bean:` names a bean that exists (#1168 B8).
 *
 * `BeanIdSchema` checks the SHAPE of the id; this checks that it resolves. A
 * retirement record whose bean is gone points a reader at nothing — the one
 * reader who most needs the reasons is the one about to reinstate the field.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Glob } from "bun";

import { fshGutsDirectory, withoutFrozenSubtrees } from "../../schemas/kg/fsh-guts.ts";
import { notApplicableAlone } from "../../test/support/checkout.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { beanStores } from "../unlinked-beans.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/** The declared trashcan, never `fsh-guts/` spelled (bean 9c7h): it follows the move to its branch. */
const GUTS = fshGutsDirectory(REPO);

// Both graphs this reads — the trashcan and the work plan — are kept on state
// branches that only a composed checkout mounts. Standing alone, neither is
// there, so the file is not applicable; composed, it runs, and an unmounted
// graph fails it.
const STATE_ABSENT = notApplicableAlone(
  "the `fsh-guts` trashcan and the bean store (state branches, mounted only in a composed checkout)",
);

/**
 * Every bean id in every store the checkout declares. Since
 * cat-harness-tools#459 a bean has one home, which may be the platform's
 * store, cat-harness-tools' or core's, so the root store alone misses the
 * layers' beans.
 */
function beanIds(): Set<string> {
  const out = new Set<string>();
  for (const store of beanStores(REPO)) {
    const defs = join(store, "defs");
    if (!existsSync(defs)) continue;
    for (const rel of new Glob("**/*.md").scanSync({ cwd: defs })) {
      const m = /^([a-z0-9]+(?:-[a-z0-9]+)*?-[a-z0-9]{4})--/.exec(basename(rel));
      if (m) out.add(m[1]!);
    }
  }
  return out;
}

/**
 * Every `bean:` an fsh-guts record carries.
 *
 * A frozen subtree's files are not records of THIS work plan: they are
 * another repository's, frozen at one commit, and a `bean:` inside one names
 * a bean of that history. Its NOTE is a record of ours and is checked like
 * any other — against main's beans, with no "pending" escape: a cutover
 * deposits the note in the same step that merges the PR carrying its bean
 * (sub-kg-lifecycle stage 13, bean 61t6).
 */
function beanRefs(): { rel: string; bean: string }[] {
  const { live } = withoutFrozenSubtrees(GUTS, [...new Glob("**/*.md").scanSync({ cwd: GUTS })]);
  return live.flatMap((rel) => {
    const m = /^bean:\s*(\S+)\s*$/m.exec(readFileSync(join(GUTS, rel), "utf-8").slice(0, 4000));
    return m ? [{ rel, bean: m[1]! }] : [];
  });
}

describe.skipIf(STATE_ABSENT)("fsh-guts bean references resolve", () => {
  // Read inside the tests: `describe.skipIf` still runs this body.
  let read: { ids: Set<string>; refs: { rel: string; bean: string }[] } | undefined;
  const corpus = () => (read ??= { ids: beanIds(), refs: beanRefs() });

  test("the corpus is non-empty, so the assertion below is not vacuous", () => {
    const { ids, refs } = corpus();
    expect(ids.size).toBeGreaterThan(0);
    expect(refs.length).toBeGreaterThan(0);
    expect(readdirSync(GUTS).length).toBeGreaterThan(0);
  });

  test("every `bean:` names a bean in the work plan", () => {
    const { ids, refs } = corpus();
    const dangling = refs.filter((r) => !ids.has(r.bean)).map((r) => `${r.rel} → ${r.bean}`);
    expect(dangling).toEqual([]);
  });
});
