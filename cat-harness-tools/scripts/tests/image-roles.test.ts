/**
 * The image-role gate's judgements, pinned.
 *
 * Bean `5yrl`. Six of these tests exist for the states that are NOT failures —
 * `by-id`, `declined`, and the permitted orphan — because those are where a
 * check of this shape goes wrong. A gate that only knows "fine" and "broken"
 * would have reported six false positives on this repository's own corpus (the
 * `landing-*` theme roles, consumed through a declared `imageRole` rather than
 * a lookup call) and would have failed `mark`, whose image is reached by id.
 *
 * @module scripts/tests/image-roles.test
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import {
  PERMITTED_ORPHANS,
  code,
  failing,
  hasDynamicLookup,
  judge,
  mentionsIn,
  permitKey,
  run,
  stalePermits,
  type Mention,
  type RoleFinding,
} from "../check-image-roles.ts";

const keyed: Mention = { file: "a.ts", via: "lookup", fn: "imagesForRole" };
const plain: Mention = { file: "a.ts", via: "lookup", fn: "imageForRole" };
const themed: Mention = { file: "themes.ts", via: "imageRole", fn: "resolveThemeBackdrop" };

const finding = (role: string, verdict: RoleFinding["verdict"]): RoleFinding => ({
  instance: "cat-harness",
  role,
  images: 1,
  withLayout: 0,
  verdict,
  why: "",
});

describe("half one — is the role named at all", () => {
  test("nothing names it, nothing reaches it: ORPHAN", () => {
    expect(judge("x", [{}], [], false, false).verdict).toBe("orphan");
  });

  test("a theme's declared `imageRole` counts as a consumer", () => {
    // The six `landing-*` roles are consumed this way and by no lookup call.
    // A check that only looked inside call sites would fail all six.
    expect(judge("landing-analyst", [{ layout: "card" }], [themed], false, false).verdict).toBe(
      "consumed",
    );
  });

  test("reached by a declared id but not by role: BY-ID, and not a failure", () => {
    // `mark`. The role is genuinely unread and the image is genuinely reached,
    // so failing it would be wrong and passing it silently would be a lie.
    const r = judge("mark", [{}], [], true, false);
    expect(r.verdict).toBe("by-id");
    expect(failing([finding("mark", "by-id")])).toEqual([]);
  });

  test("a dynamic lookup exists and nothing names it: DECLINED, never clean", () => {
    const r = judge("x", [{}], [], false, true);
    expect(r.verdict).toBe("declined");
    expect(failing([finding("x", "declined")])).toEqual([]);
  });

  test("being reached by id OUTRANKS declined — the stronger fact wins", () => {
    expect(judge("mark", [{}], [], true, true).verdict).toBe("by-id");
  });
});

describe("half two — can the consumer MATCH what is declared", () => {
  test("layout-keyed consumer, layout-less images: UNREACHABLE", () => {
    // The favicon defect, reproduced: `browser-icon` declares no layout, so
    // `imagesForRole` returns an empty map however many callers name it.
    const r = judge("browser-icon", [{}], [keyed], false, false);
    expect(r.verdict).toBe("unreachable");
    expect(r.why).toContain("imagesForRole");
    expect(failing([finding("browser-icon", "unreachable")])).toHaveLength(1);
  });

  test("layout-keyed consumer, images that DO carry a layout: consumed", () => {
    expect(judge("landing", [{ layout: "card" }], [keyed], false, false).verdict).toBe("consumed");
  });

  test("a non-layout-keyed consumer rescues a layout-less role", () => {
    // `imageForRole` was added as a SIBLING for exactly this, rather than
    // loosening `imagesForRole` and hiding the layout contract the landing
    // path depends on.
    expect(judge("browser-icon", [{}], [plain], false, false).verdict).toBe("consumed");
  });

  test("ONE reachable consumer is enough, even beside a layout-keyed one", () => {
    expect(judge("browser-icon", [{}], [keyed, plain], false, false).verdict).toBe("consumed");
  });
});

describe("what counts as a mention", () => {
  test("both forms are found, and attributed to the right function", () => {
    const m = mentionsIn(
      "x.ts",
      `const a = imageForRole(d.images, "browser-icon");
       const b = imagesForRole(d.images, "landing");
       const t = { imageRole: "landing-analyst" };`,
    );
    expect(m.get("browser-icon")?.[0]?.fn).toBe("imageForRole");
    expect(m.get("landing")?.[0]?.fn).toBe("imagesForRole");
    expect(m.get("landing-analyst")?.[0]?.via).toBe("imageRole");
  });

  test("PROSE IS NOT EVIDENCE — a comment naming a lookup is stripped", () => {
    // This gate's own doc comment quotes `imagesForRole()`, and that alone was
    // enough to mark the whole corpus dynamic on the first run, turning the one
    // live orphan into a `declined` and hiding the defect the gate was built
    // to find. A tool that reads its own prose is measuring itself.
    expect(hasDynamicLookup("other.ts", "/* calls imagesForRole(images, role) */")).toBe(false);
    expect(code("/* imagesForRole(x, role) */ const q = 1;")).not.toContain("imagesForRole");
  });

  test("the module that DEFINES the lookups is never a consumer of them", () => {
    const src = "const byLayout = imagesForRole(images, role);";
    expect(hasDynamicLookup("cat-harness/schemas/kg/kg-node.ts", src)).toBe(false);
    expect(hasDynamicLookup("cat-harness/scripts/other.ts", src)).toBe(true);
  });
});

describe("the permit list is itself checked", () => {
  // A FIXTURE permit list, not the real one: the real list is empty since the
  // architecture crop arrived (2026-09-24), and a test that took its first
  // entry would then test nothing. The mechanism is what is under test here.
  const PERMITS: ReadonlyMap<string, string> = new Map([
    ["cat-harness/some-role", "fixture permit, waiting on a decision since 2026-01-01"],
  ]);

  test("a permitted orphan does not fail the gate", () => {
    const f: RoleFinding = { ...finding("some-role", "orphan"), instance: "cat-harness" };
    expect(permitKey(f)).toBe("cat-harness/some-role");
    expect(failing([f], PERMITS)).toEqual([]);
    // ...and the same finding with no permit DOES fail it.
    expect(failing([f], new Map())).toEqual([f]);
  });

  test("a permit whose finding is GONE is itself a finding", () => {
    // Without this the list only grows, and every entry reads as a live
    // problem long after it was fixed. A permit is a claim about the corpus,
    // and an unchecked claim about the corpus is what this gate is against.
    expect(stalePermits([], PERMITS)).toEqual(["cat-harness/some-role"]);
  });

  test("...and is NOT stale while its finding stands", () => {
    const f: RoleFinding = { ...finding("some-role", "orphan"), instance: "cat-harness" };
    expect(stalePermits([f], PERMITS)).toEqual([]);
  });

  test("the real list has no stale permit today", () => {
    // Against the REAL findings, the way the runner calls it. With no findings
    // passed this would only hold while the real list is empty.
    const { findings, examined } = run(resolve(import.meta.dir, "..", "..", ".."));
    expect(examined).toBeGreaterThan(0);
    expect(stalePermits(findings)).toEqual([]);
    // ...and the same findings DO make a permit stale that names no finding,
    // so the empty answer above is about the list and not the findings.
    const bogus = new Map([["cat-harness/no-such-role", "fixture"]]);
    expect(stalePermits(findings, bogus)).toEqual(["cat-harness/no-such-role"]);
  });

  test("every permit carries a REASON, not just a name", () => {
    // A suppression list whose entries say nothing is a dustbin. Each entry
    // names the decision it waits on, so the list reads as a queue.
    const unreasoned = (permits: ReadonlyMap<string, string>): string[] =>
      [...permits].filter(([, why]) => why.length <= 80 || !/20\d\d-\d\d-\d\d/.test(why)).map(([k]) => k);
    // A FIXTURE list first: the real one is empty today, and a rule applied
    // only to it would check no entry at all.
    const fixture = new Map([
      ["cat-harness/kept", `waits on the theme decision recorded 2026-01-01; ${"the reason in full. ".repeat(4)}`],
      ["cat-harness/short", "waiting since 2026-01-01"],
      ["cat-harness/undated", `waits on the theme decision; ${"the reason in full, with no date. ".repeat(4)}`],
    ]);
    expect(unreasoned(fixture)).toEqual(["cat-harness/short", "cat-harness/undated"]);
    expect(unreasoned(PERMITTED_ORPHANS)).toEqual([]);
  });
});
