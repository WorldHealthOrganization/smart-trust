/**
 * The fixture helper fails loudly when its subject is gone.
 *
 * Unit-tested here rather than only exercised through the e2e suite, because
 * the behaviour that matters is the THROW — and a throw that only fires inside
 * a Playwright spec is a throw nobody sees until CI is already red.
 *
 * Bean `folio-assistant-iumj`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sidecar, sidecarWithVerdicts } from "../../test/support/qa-fixture.js";

const dir = mkdtempSync(join(tmpdir(), "qa-fixture-"));
const write = (name: string, doc: unknown): string => {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(doc));
  return p;
};

const DOC = {
  counts: { fail: 0, warn: 0, pass: 2, na: 0 },
  criteria: [
    { id: "a-passes", result: "pass", witnesses: [{ kind: "script", id: "s.ts" }] },
    {
      id: "voice-status-leak",
      result: "pass",
      witnesses: [
        { kind: "agent", id: "adjudicator" },
        { kind: "script", id: "qa-checkers-voice.ts" },
      ],
    },
  ],
};

describe("a missing subject throws, and names itself", () => {
  test("an override for a criterion the sidecar lacks is refused", () => {
    const p = write("gone.json", DOC);
    expect(() => sidecarWithVerdicts(p, [{ id: "not-here", result: "fail" }])).toThrow(
      /`not-here` is no longer a criterion/,
    );
  });

  test("the error says WHY it throws rather than defaulting", () => {
    // The whole failure being prevented is silent: every assertion keyed to a
    // vanished criterion tests whichever row sorts first instead. The message
    // has to say that, or the next reader "fixes" it by removing the override.
    const p = write("gone2.json", DOC);
    let msg = "";
    try {
      sidecarWithVerdicts(p, [{ id: "not-here", result: "fail" }]);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    }
    expect(msg).toContain("silently test whichever row sorts");
  });
});

describe("applying a verdict", () => {
  interface Applied {
    counts: Record<string, number>;
    criteria: Array<{
      id: string;
      result: string;
      severity?: string;
      evidence?: string[];
      witnesses: Array<{ kind: string; id: string }>;
    }>;
  }
  const apply = (name: string): Applied =>
    JSON.parse(
      sidecarWithVerdicts(write(name, DOC), [
        {
          id: "voice-status-leak",
          result: "fail",
          severity: "critical",
          witnessKinds: ["script"],
          evidence: ["f.md:36: x"],
        },
      ]),
    ) as Applied;

  test("the verdict, severity and evidence are set", () => {
    const c = apply("a.json").criteria.find((x) => x.id === "voice-status-leak")!;
    expect(c.result).toBe("fail");
    expect(c.severity).toBe("critical");
    expect(c.evidence).toEqual(["f.md:36: x"]);
  });

  test("the adjudicating agent witness is dropped, leaving the script first", () => {
    const c = apply("b.json").criteria.find((x) => x.id === "voice-status-leak")!;
    expect(c.witnesses.map((w) => w.kind)).toEqual(["script"]);
  });

  test("counts are RECOMPUTED from the rows, not adjusted by a delta", () => {
    // #319's version recomputes and mine incremented; recomputing is the more
    // robust of the two. An increment is right only if every prior count was
    // right and no override touches one criterion twice — a recount cannot
    // drift from the rows it summarises. Every bucket is emitted, including
    // the zeroes, so a reader never has to tell "none" from "not counted".
    const d = apply("c.json");
    expect(d.counts).toEqual({ fail: 1, warn: 0, pass: 1, na: 0, unknown: 0 });
  });

  test("`state` follows the worst row, and is left absent if the doc had none", () => {
    const withState = JSON.parse(
      sidecarWithVerdicts(write("st.json", { ...DOC, state: "pass" }), [
        { id: "a-passes", result: "fail" },
      ]),
    ) as { state?: string };
    expect(withState.state).toBe("fail");
    // A document that never carried `state` does not gain one: inventing a
    // field the generator does not write is how a fixture stops being a
    // fixture of the real output.
    expect((apply("st2.json") as { state?: string }).state).toBeUndefined();
  });

  test("other criteria are untouched", () => {
    const c = apply("d.json").criteria.find((x) => x.id === "a-passes")!;
    expect(c.result).toBe("pass");
  });

  test("the corpus file itself is not modified", () => {
    const p = write("e.json", DOC);
    sidecarWithVerdicts(p, [{ id: "a-passes", result: "fail" }]);
    expect(JSON.parse(sidecar(p))).toEqual(DOC);
  });
});

describe("marking a witness stale — by id, never by index", () => {
  test("the named criterion's first witness carries freshness and changed", () => {
    const p = write("s1.json", DOC);
    const d = JSON.parse(
      sidecarWithVerdicts(p, [{ id: "a-passes", result: "pass", stale: { changed: ["md"] } }]),
    ) as { criteria: Array<{ id: string; witnesses: Array<{ freshness?: string; changed?: string[] }> }> };
    const c = d.criteria.find((x) => x.id === "a-passes")!;
    expect(c.witnesses[0]!.freshness).toBe("stale");
    expect(c.witnesses[0]!.changed).toEqual(["md"]);
  });

  test("a DIFFERENT criterion is left fresh — marking is not global", () => {
    // PR #319's finding: the spec asserts on the first RENDERED row, so a
    // fixture marking by index can pass while asserting a stale badge on a row
    // it never touched. Falsified for real against the browser suite: marking
    // criterion 19 instead of 0 turns the stale spec red.
    const p = write("s2.json", DOC);
    const d = JSON.parse(
      sidecarWithVerdicts(p, [{ id: "a-passes", result: "pass", stale: { changed: ["md"] } }]),
    ) as { criteria: Array<{ id: string; witnesses: Array<{ freshness?: string }> }> };
    const other = d.criteria.find((x) => x.id === "voice-status-leak")!;
    expect(other.witnesses.every((w) => w.freshness === undefined)).toBe(true);
  });

  test("a criterion with no witness throws rather than marking nothing", () => {
    const p = write("s3.json", {
      counts: { pass: 1 },
      criteria: [{ id: "bare", result: "pass", witnesses: [] }],
    });
    expect(() =>
      sidecarWithVerdicts(p, [{ id: "bare", result: "pass", stale: { changed: ["md"] } }]),
    ).toThrow(/no witness to mark stale/);
  });
});

// "the real corpus still holds the subject the e2e spec keys to" read a
// committed witness (`witnesses/crdm-methodology/what-is-not-built-yet`) to
// warn early that `qa-panel.e2e.ts` would throw. A test asserting on the
// committed corpus, so it went with bean `cxcn` (reader audit F7). The e2e
// specs that still read corpus witnesses at load (R72 `qa-badge.e2e.ts`, R73
// `qa-panel.e2e.ts`) are recorded on that bean as left to do; their fix is a
// fixture, after which this early warning has nothing to warn about.
