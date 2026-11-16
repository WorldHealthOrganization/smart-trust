import { describe, expect, test } from "bun:test";

import { feedbackCell, issueRow, linkedIssues, richSummary, sheetCells, summary, watch, watchedHeader, type Issue } from "./watch.js";

const repo = "litlfred/dth-phc";
const header = ["Change-set", "Title", "Selected Sections", "Section links", "Contributor Feedback (initials/name)", "Contributor Feedback (initials/name)", "Disposition", "Ready for agent", "Ready for merge", "Feedback (agent)", "Issue"];
const sheet = (rows: string[][]) => [["Instructions", "…"], header, ...rows];
const row1 = ["CS-001", "Sign off exclusions", "Front matter", "", "", "", "", "", "", "Proposal …", "https://github.com/litlfred/dth-phc/issues/5"];

const issue = (n: number, extra: Partial<Issue> = {}): Issue => ({
  number: n, title: `Issue ${n}`, body: `First paragraph of ${n}.\n\nMore.`, html_url: `https://github.com/${repo}/issues/${n}`,
  updated_at: "2026-11-01T10:00:00Z", user: { login: "alice" }, labels: [], ...extra,
});

describe("review-log-watch", () => {
  test("firstCheckAppendsUnlinked", () => {
    const r = watch(sheet([row1]), [issue(5), issue(8), issue(9, { pull_request: {} }), issue(10, { labels: [{ name: "no-sheet" }] })], repo, undefined);
    expect(r.status).toBe("changed");
    if (r.status !== "changed") return;
    expect(r.append.map((a) => a.issue)).toEqual([8]);
    expect(r.baseline).toBe(true);
    expect(r.changes.filter((c) => c.kind === "issue-opened").map((c) => (c as { issue: number }).issue)).toEqual([5, 8]);
  });

  test("sameInputUnchanged", () => {
    const values = sheet([row1]);
    const first = watch(values, [issue(5)], repo, undefined);
    if (first.status !== "changed") throw new Error("expected changed");
    expect(watch(values, [issue(5)], repo, first.state)).toEqual({ status: "unchanged", digest: first.digest });
  });

  test("readyCellOrIssueUpdateChanges", () => {
    const first = watch(sheet([row1]), [issue(5)], repo, undefined);
    if (first.status !== "changed") throw new Error("expected changed");
    const agentEdit = [...row1]; agentEdit[9] = "New proposal";
    expect(watch(sheet([agentEdit]), [issue(5)], repo, first.state).status).toBe("unchanged");
    const ready = [...row1]; ready[7] = "Yes";
    const r = watch(sheet([ready]), [issue(5, { updated_at: "2026-11-01T10:05:00Z" })], repo, first.state);
    expect(r.status).toBe("changed");
    if (r.status !== "changed") return;
    expect(r.changes).toEqual([
      { kind: "issue-updated", issue: 5, title: "Issue 5" },
      { kind: "cell", row: 3, cs: "CS-001", header: "Ready for agent", from: "", to: "Yes" },
    ]);
  });

  test("closedIssueRowStruck", () => {
    const first = watch(sheet([row1]), [issue(5), issue(8)], repo, undefined);
    if (first.status !== "changed") throw new Error("expected changed");
    const r = watch(sheet([row1]), [issue(5, { state: "closed", updated_at: "2026-11-01T10:20:00Z" }), issue(8)], repo, first.state);
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.changes).toEqual([{ kind: "issue-closed", issue: 5, title: "Issue 5" }]);
    expect(r.closedRows).toEqual([3]);
    const gone = watch(sheet([row1]), [issue(5)], repo, first.state);
    expect(gone.status === "changed" && gone.changes).toEqual([{ kind: "issue-closed", issue: 8 }]);
  });

  test("closedUnlinkedAppendedAuthorFilter", () => {
    const r = watch(sheet([row1]), [issue(5), issue(7, { state: "closed" }), issue(8, { user: { login: "bob" } })], repo, undefined, { author: "alice" });
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.append.map((a) => [a.issue, a.closed])).toEqual([[7, true]]);
  });

  test("appendedRowFillsThree", () => {
    const row = issueRow(issue(8), header);
    expect(row[1]).toBe("Issue 8");
    expect(row[4]).toBe("@alice (#8): First paragraph of 8.");
    expect(row[5]).toBe("");
    expect(row[10]).toBe(`https://github.com/${repo}/issues/8`);
    expect(row.filter(Boolean).length).toBe(3);
  });

  test("appendedRowNextCsAndAgent", () => {
    const row7 = [...row1]; row7[0] = "CS-007"; row7[10] = "https://github.com/litlfred/dth-phc/issues/6";
    const r = watch(sheet([row1, row7]), [issue(5), issue(6), issue(8), issue(9)], repo, undefined);
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.append.map((a) => [a.row[0], a.agent])).toEqual([
      ["CS-008", { csId: "CS-008", issue: `https://github.com/${repo}/issues/8` }],
      ["CS-009", { csId: "CS-009", issue: `https://github.com/${repo}/issues/9` }],
    ]);
    const noCs = watch([["Ready for agent", "Ready for merge", "Issue"], ["", "", "dth-phc#5"]], [issue(5), issue(8)], repo, undefined);
    if (noCs.status !== "changed") throw new Error("expected changed");
    expect(noCs.append[0].agent).toBeUndefined();
  });

  test("insertedRowMovesBelow", () => {
    const ready = [...row1]; ready[7] = "Yes";
    const row2 = ["CS-002", "Second", "", "", "", "", "", "", "", "", "https://github.com/litlfred/dth-phc/issues/6"];
    const first = watch(sheet([ready, row2]), [issue(5), issue(6)], repo, undefined);
    if (first.status !== "changed") throw new Error("expected changed");
    const blank = Array(11).fill("");
    expect(watch(sheet([blank, ready, row2]), [issue(5), issue(6)], repo, first.state).status).toBe("unchanged");
    const merge = [...row2]; merge[8] = "Yes";
    const r = watch(sheet([blank, ready, merge]), [issue(5), issue(6)], repo, first.state);
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.changes).toEqual([{ kind: "cell", row: 5, cs: "CS-002", header: "Ready for merge", from: "", to: "Yes" }]);
    expect(r.closedRows).toEqual([]);
    const closed = watch(sheet([blank, ready, row2]), [issue(5, { state: "closed", updated_at: "2026-11-01T11:00:00Z" }), issue(6)], repo, first.state);
    expect(closed.status === "changed" && closed.closedRows).toEqual([4]);
  });

  test("oldStateIsBaseline", () => {
    const first = watch(sheet([row1]), [issue(5)], repo, undefined);
    if (first.status !== "changed") throw new Error("expected changed");
    const old = { ...first.state, digest: "older", cells: { "3:Title": "Sign off exclusions", "3:Selected Sections": "Front matter" } };
    const r = watch(sheet([row1]), [issue(5)], repo, old);
    expect(r.status === "changed" && r.changes).toEqual([]);
  });

  test("linksFromHeaderRow", () => {
    expect([...linkedIssues(sheet([row1]), repo)]).toEqual([[5, [3]]]);
    expect(linkedIssues(sheet([row1]), "litlfred/dth-pc").size).toBe(0);
    const short = [...row1]; short[10] = "dth-phc#6, litlfred/dth-phc#7; dth-pc#9";
    expect([...linkedIssues(sheet([short]), repo).keys()]).toEqual([6, 7]);
    expect(sheetCells(sheet([row1]))).toEqual({ "CS-001:Title": "Sign off exclusions", "CS-001:Selected Sections": "Front matter" });
    const noId = [...row1]; noId[0] = "";
    expect(sheetCells(sheet([noId]))).toEqual({ "3:Title": "Sign off exclusions", "3:Selected Sections": "Front matter" });
  });

  test("sheetHashIssueColumnOnly", () => {
    const issuesOnly = [[], ["Issue"], ["https://github.com/litlfred/dth-phc/issues/5"]];
    const first = watch(issuesOnly, [issue(5), issue(8)], repo, undefined, { sheetHash: "abc" });
    if (first.status !== "changed") throw new Error("expected changed");
    expect(first.append.map((a) => [a.issue, a.row])).toEqual([[8, [`https://github.com/${repo}/issues/8`]]]);
    expect(watch(issuesOnly, [issue(5), issue(8)], repo, first.state, { sheetHash: "abc" }).status).toBe("unchanged");
    const r = watch(issuesOnly, [issue(5), issue(8)], repo, first.state, { sheetHash: "xyz" });
    expect(r.status === "changed" && r.changes).toEqual([{ kind: "cell", row: 0, header: "#hash", from: "abc", to: "xyz" }]);
  });

  test("peopleColumnsWake", () => {
    for (const h of ["Committee Feedback (CL)", "TWG (CS)", "TWG (human)", "Change Set (human)", "Dispositions confirmed"]) expect([h, watchedHeader(h)]).toEqual([h, true]);
    for (const h of ["Committee Feedback (agent)", "PC Committee Feedback", "Change Set Feedback (agent)", "TWG (agent)", "TWG (PCs)"]) expect([h, watchedHeader(h)]).toEqual([h, false]);
  });

  test("noIssueColumnChangeSetIssues", () => {
    const rcs = [["Instructions"], ["Change-set", "Title", "TWG (CS)", "Committee Feedback (CL)", "Ready for agent", "Change Set Feedback (agent)"], ["CS-001", "Fix scope", "TWG-A", "", "", "Proposal"]];
    const cs = { labels: [{ name: "change-set" }] };
    const r = watch(rcs, [issue(5), issue(6, cs), issue(7, { ...cs, state: "closed" })], repo, undefined);
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.append).toEqual([]);
    expect(r.closedRows).toEqual([]);
    expect(Object.keys(r.state.issues)).toEqual(["6", "7"]);
    expect(r.changes.filter((c) => c.kind === "issue-unlinked")).toEqual([{ kind: "issue-unlinked", issue: 6, title: "Issue 6" }]);
    expect(r.state.cells).toEqual({ "CS-001:Title": "Fix scope", "CS-001:TWG (CS)": "TWG-A" });
    const twg = rcs.map((row) => [...row]); twg[2][3] = "CL: agree";
    const next = watch(twg, [issue(5), issue(6, cs), issue(7, { ...cs, state: "closed" })], repo, r.state);
    expect(next.status === "changed" && next.changes.filter((c) => c.kind === "cell")).toEqual([
      { kind: "cell", row: 3, cs: "CS-001", header: "Committee Feedback (CL)", from: "", to: "CL: agree" },
    ]);
    const labelled = watch(sheet([row1]), [issue(5), issue(8), issue(9, cs)], repo, undefined, { label: "change-set" });
    expect(labelled.status === "changed" && labelled.append.map((a) => a.issue)).toEqual([9]);
  });

  test("summaryCleansText", () => {
    expect(summary("### Comment\n\n_No response_\n\n### Proposed\n\nDo this.")).toBe("Do this.");
    expect(summary("x".repeat(400)).length).toBe(300);
    expect(summary(null)).toBe("");
    expect(summary("**Content:** `dth-hrh` **Block:** `fig:x`")).toBe("Content: dth-hrh Block: fig:x");
  });

  test("linksBecomeRuns", () => {
    const r = richSummary("_Requested by litlfred · [project thread](https://claude.ai/x?y=1)_");
    expect(r.text).toBe("Requested by litlfred · project thread");
    expect(r.links).toEqual([{ start: 24, end: 38, url: "https://claude.ai/x?y=1" }]);
    expect(r.text.slice(r.links[0].start, r.links[0].end)).toBe("project thread");
    const bare = richSummary("*Source:* see https://example.org/a_b. Then **more**.");
    expect(bare.text).toBe("Source: see https://example.org/a_b. Then more.");
    expect(bare.text.slice(bare.links[0].start, bare.links[0].end)).toBe("https://example.org/a_b");
    const cell = feedbackCell(issue(1, { body: "Plan: [`docs/workplan.md`](https://github.com/o/r/blob/main/docs/workplan.md)." }));
    expect(cell.text).toBe("@alice (#1): Plan: docs/workplan.md.");
    expect(cell.text.slice(cell.links[0].start, cell.links[0].end)).toBe("docs/workplan.md");
  });

  test("appendedRowCarriesLinks", () => {
    const r = watch(sheet([]), [issue(3, { body: "See [it](https://x.org/y)." })], repo, undefined);
    if (r.status !== "changed") throw new Error("expected changed");
    expect(r.append[0].links).toEqual({ column: 4, runs: [{ start: 17, end: 19, url: "https://x.org/y" }] });
  });
});
