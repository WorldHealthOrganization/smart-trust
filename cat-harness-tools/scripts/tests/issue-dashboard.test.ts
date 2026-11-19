/**
 * The issue-body dashboard.
 *
 * The property that matters is NOT how it looks — it is that a field the
 * agent cannot compute never renders as one it can. #203 asked for a status
 * vocabulary whose halves have different epistemic status: `synchronized` /
 * `ready for review` / `dirty` are derivable, `stalled` and level-of-effort
 * are judgements. A PM reading an invented estimate styled like a
 * measurement will plan against it.
 */
import { describe, expect, test } from "bun:test";
import {
  syncState,
  renderDashboard,
  spliceDashboard,
  stagingHeadFromMergeSha,
} from "../../src/issue-watch/dashboard.ts";

describe("syncState", () => {
  test("no commits ahead of base is synchronized", () => {
    expect(syncState({ headSha: "a".repeat(40), commitsAhead: 0 })).toBe("synchronized");
  });

  test("staging at the branch head is ready for review", () => {
    const sha = "b".repeat(40);
    expect(syncState({ headSha: sha, stagingSha: sha, commitsAhead: 3 })).toBe("ready-for-review");
  });

  test("staging behind the branch head is dirty", () => {
    expect(syncState({ headSha: "c".repeat(40), stagingSha: "d".repeat(40), commitsAhead: 3 }))
      .toBe("dirty");
  });

  test("an unknown staging sha is NOT reported as dirty", () => {
    // The distinction that matters. "We cannot tell whether branches/ is
    // current" is not "branches/ is stale" — reporting the latter sends a
    // reviewer away from a preview that may be perfectly fine.
    expect(syncState({ headSha: "e".repeat(40), commitsAhead: 2 })).toBe("not-determined");
  });

  test("an unreadable head declines rather than guessing", () => {
    expect(syncState({})).toBe("not-determined");
  });
});

describe("stagingHeadFromMergeSha", () => {
  test("resolves the merge commit's second parent, not the merge commit", () => {
    // The staging comment stamps `github.sha`, which on a pull_request event
    // is the synthesised merge commit — absent from a contributor's clone.
    // Comparing it to HEAD directly fails as "stale" rather than as "wrong
    // comparison". Measured on PR #249: dbf361c -> parents 6dc2f29 (base) and
    // d645772 (head), and d645772 WAS the branch head.
    const head = stagingHeadFromMergeSha("dbf361c", (s) => (s === "dbf361c" ? "d645772" : undefined));
    expect(head).toBe("d645772");
    expect(syncState({ headSha: "d645772", stagingSha: head, commitsAhead: 3 })).toBe("ready-for-review");
  });

  test("an unfetchable merge ref yields undefined, which declines rather than claiming stale", () => {
    const head = stagingHeadFromMergeSha("deadbee", () => undefined);
    expect(head).toBeUndefined();
    expect(syncState({ headSha: "abc", stagingSha: head, commitsAhead: 1 })).toBe("not-determined");
  });
});

describe("renderDashboard", () => {
  const base = {
    generatedAt: "2026-09-18T17:00:00Z",
    sync: "ready-for-review" as const,
    requests: [{ what: "Thing", source: "initial request", state: "dirty" as const, note: "n" }],
    related: [197, 206],
    repo: "o/r",
  };

  test("names the undetermined fields instead of omitting them", () => {
    // Silence would read as "nothing to report". The ask was for effort and
    // stalled; saying WHY they are blank is the honest form of not having them.
    const out = renderDashboard(base);
    expect(out).toContain("Not determined");
    expect(out).toContain("Level of effort");
    expect(out).toContain("stalled");
  });

  test("never prints an effort number", () => {
    const out = renderDashboard(base);
    expect(out).not.toMatch(/\b\d+\s*(hours?|days?|weeks?|%\s*complete)\b/i);
  });

  test("links related issues and carries the markers", () => {
    const out = renderDashboard(base);
    expect(out).toContain("https://github.com/o/r/issues/197");
    expect(out).toContain("<!-- folio:dashboard:begin -->");
    expect(out).toContain("<!-- folio:dashboard:end -->");
  });
});

describe("spliceDashboard", () => {
  const block = "<!-- folio:dashboard:begin -->\nNEW\n<!-- folio:dashboard:end -->";

  test("appends when no dashboard is present, preserving the body", () => {
    const out = spliceDashboard("Author's original text.", block);
    expect(out).toContain("Author's original text.");
    expect(out).toContain("NEW");
  });

  test("replaces in place on a second run, without duplicating", () => {
    const once = spliceDashboard("Body.", block);
    const twice = spliceDashboard(once, block.replace("NEW", "NEWER"));
    expect(twice).toContain("NEWER");
    expect(twice).not.toContain("NEW\n");
    expect(twice.match(/folio:dashboard:begin/g)).toHaveLength(1);
  });

  test("text OUTSIDE the markers is never touched", () => {
    // The body is the author's. A tool that rewrites the whole thing will one
    // day eat something they wrote — same reason readme-sections is
    // marker-delimited.
    const body = `Intro the author wrote.\n\n${block}\n\nA trailing note they added after.`;
    const out = spliceDashboard(body, block.replace("NEW", "X"));
    expect(out).toContain("Intro the author wrote.");
    expect(out).toContain("A trailing note they added after.");
  });
});
