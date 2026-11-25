/**
 * The Bun-runtime guard, and the two ways it could be silently useless.
 *
 * Bean `3ozg`. This check reports on the MACHINE rather than the corpus, so its
 * interesting states cannot be reached by pointing it at this repository: in CI
 * it always matches, and in an agent container it always mismatches. Every case
 * here therefore builds the state rather than describing it, which is the only
 * way a check like this is ever shown to fire.
 *
 * @module folio-assistant/scripts/tests/bun-runtime
 */

import { describe, expect, test } from "bun:test";

import { ENGINE_PREFIX, judge, markdown } from "../check-bun-runtime.ts";

/** `n` sidecars stamped with `version`, in the on-disk `bun-X.Y.Z` spelling. */
function stamped(version: string, n: number): string[] {
  return Array.from({ length: n }, () => `${ENGINE_PREFIX}${version}`);
}

describe("the three states", () => {
  test("equal versions are a match, and nothing is stamped elsewhere", () => {
    const r = judge("1.3.14", "1.3.14", stamped("1.3.14", 86));
    expect(r.verdict).toBe("match");
    expect(r.stampedElsewhere).toBe(0);
    expect(r.sidecars).toBe(86);
  });

  test("differing versions are a mismatch, and it COUNTS what was stamped elsewhere", () => {
    // The real corpus on 2026-09-27: 72 at 1.3.14, 14 at 1.3.11, container 1.3.11.
    const r = judge("1.3.14", "1.3.11", [...stamped("1.3.14", 72), ...stamped("1.3.11", 14)]);
    expect(r.verdict).toBe("mismatch");
    expect(r.pinned).toBe("1.3.14");
    expect(r.running).toBe("1.3.11");
    // 72, not 86: the 14 already stamped with the RUNNING engine are not counted.
    // Until #1452 this was also the churn count, because engine_version was
    // compared in saveQaScriptSidecar's write-skip guard. It no longer is, so
    // this is a record of where the last CONTENT change happened and NOT a
    // prediction that anything will move.
    expect(r.stampedElsewhere).toBe(72);
    expect(r.sidecars).toBe(86);
  });

  test("an unreadable pin is `cannot-tell`, NOT a match", () => {
    const r = judge(undefined, "1.3.11", stamped("1.3.11", 3));
    expect(r.verdict).toBe("cannot-tell");
    expect(r.reason).toContain(".bun-version");
  });

  test("no reported Bun version is `cannot-tell`, NOT a match", () => {
    // `process.versions.bun` is undefined under Node. Silently passing there
    // would make the guard vanish in exactly the environment it cannot vouch for.
    const r = judge("1.3.14", undefined, stamped("1.3.14", 3));
    expect(r.verdict).toBe("cannot-tell");
    expect(r.reason).toContain("did not report");
  });
});

describe("the `bun-` prefix", () => {
  test("the count is against the PREFIXED stamp, so a match reads 0 and not everything", () => {
    // THE POINT OF THIS TEST. `.bun-version` holds `1.3.14`; a sidecar holds
    // `bun-1.3.14`. Compare them bare and every sidecar looks due for a rewrite
    // in every container, a matched one included — the count would be every
    // sidecar always and therefore mean nothing. Same shape as the tagPrefix
    // defect #1442 found in the pin machinery: `1.3.14` vs `bun-v1.3.14`.
    expect(judge("1.3.14", "1.3.14", stamped("1.3.14", 40)).stampedElsewhere).toBe(0);
    // And a sidecar carrying the BARE version is genuinely not what this engine
    // writes, so it does count.
    expect(judge("1.3.14", "1.3.14", ["1.3.14"]).stampedElsewhere).toBe(1);
  });

  test("a sidecar with no engine_version at all counts as stamped elsewhere", () => {
    expect(judge("1.3.14", "1.3.14", [undefined]).stampedElsewhere).toBe(1);
  });
});

describe("an empty scan does not read clean", () => {
  test("zero sidecars is reported rather than rendered as nothing to do", () => {
    const r = judge("1.3.14", "1.3.11", []);
    // Still a mismatch — the versions differ whatever the corpus holds — but
    // `sidecars: 0` is what tells a reader the count means "found none", not
    // "found none stamped elsewhere".
    expect(r.verdict).toBe("mismatch");
    expect(r.sidecars).toBe(0);
    expect(r.stampedElsewhere).toBe(0);
  });
});

describe("the session-start section", () => {
  test("a mismatch says you are not running what CI runs", () => {
    const md = markdown(judge("1.3.14", "1.3.11", stamped("1.3.14", 72)));
    expect(md).toContain("1.3.11");
    expect(md).toContain("1.3.14");
    expect(md).toContain("different code from the gates");
  });

  test("it states that the count is NOT churn — the retraction, asserted", () => {
    // THE POINT OF THIS TEST. Until #1452 this section told the reader that
    // 72 sidecars would be rewritten by any sweep, and instructed them to
    // discard. The write-skip comparison no longer includes `engine_version`,
    // so nothing is rewritten, and a guard that still said so would be a
    // false claim printed at every session start — worse than no guard. The
    // wording is pinned here so it cannot drift back.
    const md = markdown(judge("1.3.14", "1.3.11", stamped("1.3.14", 72)));
    expect(md).toContain("72");
    expect(md).toContain("not churn and will not dirty your tree");
    expect(md).toContain("#1452");
    // And the old instruction must be gone, not merely de-emphasised.
    expect(md).not.toContain("git checkout --");
    expect(md).not.toContain("Discard them");
  });

  test("it names the residue that IS still live — a downgraded stamp", () => {
    // What survived #1452: `engine_version` is now the last CONTENT change's
    // engine, so changing a checker on an older bun commits a stamp that goes
    // backwards. Rare, because it needs a real content change.
    const md = markdown(judge("1.3.14", "1.3.11", stamped("1.3.14", 72)));
    expect(md).toContain("bun-1.3.11");
    expect(md).toContain("sfjo");
  });

  test("`cannot-tell` says unknown rather than matched", () => {
    const md = markdown(judge(undefined, "1.3.11", []));
    expect(md).toContain("unknown, not as matched");
    expect(md).not.toContain("matches");
  });

  test("a match is one line and raises no alarm", () => {
    const md = markdown(judge("1.3.14", "1.3.14", stamped("1.3.14", 86)));
    expect(md).toContain("runs what CI runs");
    expect(md).not.toContain("sfjo");
  });
});

describe("a mismatch with a UNIFORM corpus", () => {
  test("zero stamped elsewhere does not produce \"older than the 0 above\"", () => {
    // Measured, not imagined. #1452's merge normalised all 86 committed
    // sidecars to `bun-1.3.11`, which is this container's engine, so the count
    // went to 0 and the mismatch text read "older than the 0 above" — a
    // sentence that cannot be true. No fixture here had a zero count, so
    // nothing caught it. This is that fixture.
    const md = markdown(judge("1.3.14", "1.3.11", stamped("1.3.11", 86)));
    expect(md).not.toContain("older than the 0");
    expect(md).not.toContain("**0**");
    expect(md).toContain("All 86 committed script sidecars already record");
    // The pin mismatch is still the point and must survive the special case.
    expect(md).toContain("different code from the gates");
  });

  test("a non-zero count still names the axis to watch", () => {
    const md = markdown(judge("1.3.14", "1.3.11", [...stamped("1.3.14", 72), ...stamped("1.3.11", 14)]));
    expect(md).toContain("**72**");
    expect(md).toContain("moves backwards");
  });
});
