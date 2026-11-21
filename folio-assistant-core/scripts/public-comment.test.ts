import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ChangeSetSchema,
  parseCaptionRef,
  parseLines,
  parseSection,
  PUBLIC_COMMENT_TRANSITIONS,
  type PublicComment,
  transition,
} from "../schemas/public-comment.js";
import type { ReviewAnchors } from "./docx-to-folio.js";
import {
  addChangeSet,
  canonicalText,
  changeSets,
  checkChangeSets,
  closedIssues,
  linkedChangeSets,
  executeActions,
  formFields,
  getChangeSet,
  type GithubApi,
  type GithubEvent,
  handleGithubEvent,
  installTemplates,
  membership,
  MENTION_OPEN_LIMIT,
  parseCommands,
  reconcilePlan,
  renderSection,
  rerouteChangeSet,
  saveChangeSet,
  seed,
  spliceBody,
  splitBody,
} from "./public-comment-changesets.js";
import {
  applyGithubComment,
  channelOf,
  consentByName,
  filterComments,
  importRows,
  isCommittee,
  isEditor,
  lineRanges,
  logStatusMove,
  nameKey,
  narrativeRows,
  parseGithubTag,
  resolveAnchor,
  sectionsNamed,
  Store,
  summary,
  tableRows,
} from "./public-comment.js";

const anchors: ReviewAnchors = {
  $schema: "folio-review-anchors/v1",
  document: "doc",
  library: "lib",
  source: { docx: { file: "d.docx", sha256: "a" }, pdf: { file: "d.pdf", sha256: "b", pages: 30 } },
  chapters: [{ dir: "ch1-intro", title: "Introduction", number: 1, label: "chap:ch1-intro" }],
  sections: [
    { label: "sec:1-1", number: "1.1", title: "About", chapter: "ch1-intro" },
    { label: "sec:1-1-2", number: "1.1.2", title: "DPI", chapter: "ch1-intro", parent: "sec:1-1" },
    { label: "sec:3-4", number: "3.4", title: "Governance", chapter: "ch1-intro" },
  ],
  blocks: [
    // Printed page 9 is PDF page 20.
    { label: "prose:1-1-2-aaa", kind: "prose", chapter: "ch1-intro", root: "p-1-1-2-aaa", sections: ["sec:1-1", "sec:1-1-2"], hash: "h1", excerpt: "In 2020, WHO and ITU", page: 20, printedPage: "9", lineStart: 20, lineEnd: 41, method: "numbered" },
    { label: "prose:1-1-2-bbb", kind: "prose", chapter: "ch1-intro", root: "p-1-1-2-bbb", sections: ["sec:1-1", "sec:1-1-2"], hash: "h2", excerpt: "Building on this understanding, the G20", page: 20, printedPage: "9", lineStart: 42, lineEnd: 55, method: "numbered" },
    { label: "prose:1-1-2-ccc", kind: "prose", chapter: "ch1-intro", root: "p-1-1-2-ccc", sections: ["sec:1-1", "sec:1-1-2"], hash: "h3", excerpt: "Spans a page", page: 20, pageEnd: 21, printedPage: "9", lineStart: 56, lineEnd: 70, method: "numbered" },
    { label: "tbl:2-2", kind: "table", chapter: "ch1-intro", root: "t-2-2", sections: ["sec:1-1"], caption: "Table 2.2", hash: "h4", excerpt: "Foundational capability", page: 22, method: "inherited-page" },
  ],
};

describe("citation parsing", () => {
  test("lineRangesParsed", () => {
    expect(parseLines("618–624")).toEqual([[618, 624]]);
    expect(parseLines("618-24")).toEqual([[618, 624]]);
    expect(parseLines("l. 618")).toEqual([[618, 618]]);
    expect(parseLines("618, 620–622")).toEqual([[618, 618], [620, 622]]);
    expect(parseLines(undefined)).toEqual([]);
  });
  test("captionRefsParsed", () => {
    expect(parseCaptionRef("Table 3.1")).toBe("Table 3.1");
    expect(parseCaptionRef("see fig. 2.2 above")).toBe("Figure 2.2");
    expect(parseCaptionRef("lines 4-5")).toBeUndefined();
  });
  test("sectionNumbersParsed", () => {
    expect(parseSection("§3.4.5")).toBe("3.4.5");
    expect(parseSection("Section 2.1.")).toBe("2.1");
    expect(parseSection("Appendix C")).toBe("C");
  });
});

describe("resolveAnchor", () => {
  test("pageLinesLandOnParagraph", () => {
    const a = resolveAnchor({ section: "1.1.2", page: "9", lines: "42-46" }, "", anchors);
    expect(a).toMatchObject({ targetLabel: "prose:1-1-2-bbb", method: "page-line", confidence: "high" });
  });
  test("secondPageOfBlock", () => {
    expect(resolveAnchor({ page: "21", lines: "3" }, "", anchors).targetLabel).toBe("prose:1-1-2-ccc");
  });
  test("citedTableWins", () => {
    expect(resolveAnchor({ lines: "Table 2.2" }, "", anchors)).toMatchObject({ targetLabel: "tbl:2-2", method: "caption" });
  });
  test("sectionAloneAnchorsSection", () => {
    expect(resolveAnchor({ section: "3.4" }, "", anchors)).toMatchObject({ targetLabel: "sec:3-4", method: "section" });
  });
  test("quotationFound", () => {
    const a = resolveAnchor({}, "The phrase “Building on this understanding, the G20” is vague.", anchors, (b) => b.excerpt);
    expect(a).toMatchObject({ targetLabel: "prose:1-1-2-bbb", method: "quote" });
  });
  test("nothingIsUnplaced", () => {
    expect(resolveAnchor({}, "Overall useful.", anchors)).toMatchObject({ targetLabel: null, method: "unplaced" });
  });
  test("disagreeingSectionReported", () => {
    const a = resolveAnchor({ section: "3.4", page: "9", lines: "42" }, "", anchors);
    expect(a.confidence).toBe("low");
    expect(a.note).toContain("does NOT agree");
  });
});

describe("intake", () => {
  test("commentMatrixIntake", () => {
    const rows = [
      ["Comment matrix", null, null, null, null, null, null],
      ["Reviewer name", null, "Ada Example", null, null, null, null],
      ["Organisation / affiliation", null, "Health Agency", null, null, null, null],
      ["Country / region", null, "Kenya", null, null, null, null],
      ["Email (optional)", null, "ada@example.org", null, null, null, null],
      ["Acknowledgement — may we recognise you? (Yes / No)", null, "Yes", null, null, null, null],
      ["No.", "Section no.", "Page", "Line no(s), Table or Figure", "Comment type", "Comment / issue", "Suggested revision"],
      ["e.g.", "3.4.5", "22", "618–624", "Technical", "Example text", "Example fix"],
      [1, "1.1.2", "9", "42-46", "Technical", "Split the definition.", "Two sentences."],
      [2, null, null, null, null, null, null],
    ];
    const t = tableRows(rows);
    expect(t.rows).toHaveLength(1);
    expect(t.skipped).toEqual([{ row: 8, why: "the template's example row" }]);
    expect(t.rows[0]).toMatchObject({
      row: 9,
      reviewer: { name: "Ada Example", organisation: "Health Agency", country: "Kenya", email: "ada@example.org", acknowledge: true },
      citation: { section: "1.1.2", page: "9", lines: "42-46" },
      type: "Technical",
      text: "Split the definition.",
      suggestedRevision: "Two sentences.",
    });
  });
  test("formExportIntake", () => {
    const t = tableRows([
      ["Name", "Email", "Organisation", "Section", "Page", "Comment"],
      ["B. Example", "b@x.org", "Org", "3.4", "", "Needs governance detail"],
    ]);
    expect(t.rows[0].reviewer).toMatchObject({ name: "B. Example", organisation: "Org" });
    expect(t.rows[0].citation.section).toBe("3.4");
  });
  test("narrativeSplitAtCitations", () => {
    const r = narrativeRows(
      "Thank you for the draft.\n\nIn section 3.4 governance is thin.\n\nOn page 9, lines 42-46, the definition is long.\n\nWe look forward to the final.",
      { name: "C" },
    );
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ type: "general", citation: { raw: "(no citation)" } });
    expect(r[0].text).toContain("Thank you");
    expect(r[0].text).toContain("look forward");
    expect(r[1].citation.section).toBe("3.4");
    expect(r[2].citation).toMatchObject({ page: "9", lines: "42-46" });
  });
});

function tempStore(): Store {
  const repo = mkdtempSync(join(tmpdir(), "pc-"));
  mkdirSync(join(repo, "folio", "doc"), { recursive: true });
  writeFileSync(join(repo, "folio", "doc", "review-anchors.json"), JSON.stringify(anchors));
  mkdirSync(join(repo, "review", "public-comment"), { recursive: true });
  writeFileSync(join(repo, "review", "public-comment", "config.json"), JSON.stringify({ document: "doc", editors: ["ed"], committee: ["cm"] }));
  return Store.open(repo);
}

describe("the store and the lifecycle", () => {
  const at = "2026-10-04T00:00:00Z";
  const rows = [
    { row: 9, reviewer: { name: "Ada", email: "ada@x.org", acknowledge: false }, citation: { section: "1.1.2", page: "9", lines: "42" }, type: "Technical", text: "One." },
    { row: 10, reviewer: { name: "Ada", email: "ada@x.org", acknowledge: false }, citation: {}, text: "Two." },
  ];

  test("importNumbersNoEmail", () => {
    const s = tempStore();
    const r = importRows(s, rows, { channel: "comment-matrix", batch: "m1", sha256: "x" }, at);
    expect(r.created).toEqual(["PC-0001", "PC-0002"]);
    expect(r.unplaced).toEqual(["PC-0002"]);
    const raw = readFileSync(join(s.dir, "comments", "PC-0001.json"), "utf-8");
    expect(raw).not.toContain("ada@x.org");
    // Acknowledgement "No": no name either; same pseudonym for both rows.
    expect(raw).not.toContain("Ada");
    const [a, b] = s.all();
    expect(a.public.reviewer.id).toBe(b.public.reviewer.id);
    expect(importRows(s, rows, { channel: "comment-matrix", batch: "m1-again", sha256: "x" }, at).alreadyImported).toBe(true);
  });

  test("movesAreDiagramTasks", () => {
    for (const t of PUBLIC_COMMENT_TRANSITIONS) {
      const bpmn = readFileSync(join(import.meta.dir, "..", "collab", "processes", "content", t.by.file), "utf-8");
      expect(bpmn).toContain(`<bpmn:process id="${t.by.process}"`);
      expect(bpmn).toMatch(new RegExp(`<bpmn:\\w+ id="${t.by.task}"`));
    }
  });

  test("processCallsChangePhase", () => {
    const bpmn = readFileSync(join(import.meta.dir, "..", "collab", "processes", "content", "public-comment.bpmn"), "utf-8");
    expect(bpmn).toMatch(/<bpmn:callActivity id="CallActivity_MakeChange"[^>]*calledElement="Process_PublicCommentChange"/);
  });

  test("fullLifecycle", () => {
    const s = tempStore();
    importRows(s, rows, { channel: "comment-matrix", batch: "m1", sha256: "y" }, at);
    let c: PublicComment = s.get("PC-0001");
    c = transition(c, "triage", { by: "co", at, type: "editorial" });
    c = transition(c, "assign", { by: "co", at, assignees: ["cm"] });
    c = transition(c, "recommend", { by: "cm", at, recommendation: { by: "cm", code: "accepted-modified", rationale: "yes, shorter" } });
    expect(() => transition(c, "decide", { by: "ed", at, decision: { code: "not-accepted" } })).toThrow(/needs a reason/);
    c = transition(c, "decide", { by: "ed", at, decision: { code: "accepted" } });
    expect(() => transition(c, "edit", { by: "author-agent", at })).toThrow(/names the feature branch/);
    c = transition(c, "edit", { by: "author-agent", at, changeSet: { branch: "pc/definitions" }, assignees: ["author-agent"] });
    expect(c).toMatchObject({ status: "editing", public: { assignees: ["author-agent"], decision: { changeSet: { branch: "pc/definitions" } } } });
    c = transition(c, "incorporate", { by: "ci", at, changeSet: { branch: "pc/definitions", pr: 12 } });
    expect(c.status).toBe("incorporated");
    expect(c.public.decision?.changeSet).toMatchObject({ branch: "pc/definitions", pr: 12 });
    expect(c.public.history.map((h) => h.transition)).toEqual(["ingest", "triage", "assign", "recommend", "decide", "edit", "incorporate"]);
    expect(() => transition(c, "withdraw", { by: "x", at })).toThrow(/cannot withdraw from incorporated/);
  });

  test("onlyAcceptedIncorporated", () => {
    const s = tempStore();
    importRows(s, rows, { channel: "comment-matrix", batch: "m1", sha256: "z" }, at);
    const c = transition(s.get("PC-0001"), "decide", { by: "ed", at, decision: { code: "noted", reason: "already covered in 2.1" } });
    expect(() => transition(c, "edit", { by: "au", at, changeSet: { branch: "b" } })).toThrow(/only an accepted comment/);
    expect(() => transition(c, "incorporate", { by: "ci", at, changeSet: { branch: "b" } })).toThrow(/only an accepted comment/);
  });

  test("reassignKeepsStatus", () => {
    const s = tempStore();
    importRows(s, rows, { channel: "comment-matrix", batch: "m1", sha256: "w" }, at);
    const c = transition(s.get("PC-0002"), "reassign", { by: "co", at, anchor: { targetLabel: "sec:3-4", method: "section", confidence: "high", candidates: [] } });
    expect(c).toMatchObject({ status: "received", targetLabel: "sec:3-4" });
    expect(c.public.anchor.method).toBe("manual");
  });

  test("listByPageSectionUnplaced", () => {
    const s = tempStore();
    importRows(s, rows, { channel: "comment-matrix", batch: "m1", sha256: "v" }, at);
    const all = s.all();
    expect(filterComments(all, anchors, { page: 20, line: 42 }).map((c) => c.public.ref)).toEqual(["PC-0001"]);
    expect(filterComments(all, anchors, { section: "1.1" }).map((c) => c.public.ref)).toEqual(["PC-0001"]);
    expect(filterComments(all, anchors, { unplaced: true }).map((c) => c.public.ref)).toEqual(["PC-0002"]);
    expect(summary(all)).toMatchObject({ total: 2, open: 2, unplaced: 1 });
  });
});

describe("GitHub tags", () => {
  test("githubTagParsed", () => {
    expect(parseGithubTag("pc: PC-0042, PC-43\nrecommend: accepted modified\n\nShorter is better.")).toEqual({
      refs: ["PC-0042", "PC-0043"],
      changeSets: [],
      issues: [],
      verb: "recommend",
      code: "accepted-modified",
      text: "Shorter is better.",
    });
    expect(parseGithubTag("Just talking.")).toBeNull();
    // In a change-set's issue a bare verb is a tag; the thread says which change-set.
    expect(parseGithubTag("decide: accepted\n\nAgreed.")).toMatchObject({ refs: [], changeSets: [], verb: "decide" });
    expect(parseGithubTag("cs: CS-12\nrecommend: noted")).toMatchObject({ changeSets: ["CS-012"] });
    expect(parseGithubTag("pc: #7\ndecide: noted\n\nCovered.")).toMatchObject({ refs: [], issues: [7], verb: "decide" });
    expect(parseGithubTag("pc: PC-1\nrecommend: maybe")).toMatchObject({ error: expect.stringContaining("is not one of") });
  });

  test("ownerIsDefaultEditor", () => {
    const s = tempStore();
    writeFileSync(join(s.dir, "config.json"), JSON.stringify({ document: "doc" }));
    importRows(s, [{ row: 1, reviewer: {}, citation: { section: "3.4" }, text: "One." }], { channel: "comment-matrix", batch: "m", sha256: "e" }, "t0");
    const ev = (login: string, association: string, body: string) => ({ login, association, body, url: "https://github.com/o/r/pull/1#issuecomment-1", at: "t1" });
    expect(applyGithubComment(s, ev("member", "COLLABORATOR", "pc: PC-0001\ndecide: noted\n\nx")).refused[0]).toContain("the owner of this repository");
    expect(applyGithubComment(s, ev("me", "OWNER", "pc: PC-0001\ndecide: noted\n\nAlready in 2.1.")).applied).toEqual(["PC-0001"]);
    expect(isEditor({}, "x", "owner")).toBe(true);
    expect(isEditor({ editors: ["ed"] }, "x", "OWNER")).toBe(false);
  });

  test("collaboratorsDefaultCommittee", () => {
    const s = tempStore();
    writeFileSync(join(s.dir, "config.json"), JSON.stringify({ document: "doc", editors: ["ed"] }));
    importRows(s, [{ row: 1, reviewer: {}, citation: { section: "3.4" }, text: "One." }], { channel: "comment-matrix", batch: "m", sha256: "c" }, "t0");
    const ev = (login: string, association: string) => ({ login, association, body: "pc: PC-0001\nrecommend: noted\n\nCovered.", url: "https://github.com/o/r/pull/1#issuecomment-1", at: "t1" });
    expect(applyGithubComment(s, ev("outsider", "CONTRIBUTOR")).refused[0]).toContain("not a collaborator on this repository");
    expect(applyGithubComment(s, ev("member", "COLLABORATOR")).applied).toEqual(["PC-0001"]);
    // A collaborator still cannot decide: deciding is the editors' alone.
    expect(applyGithubComment(s, { ...ev("member", "OWNER"), body: "pc: PC-0001\ndecide: noted\n\nx" }).refused[0]).toContain("an editor");
    expect(isCommittee({}, "x", "member")).toBe(true);
    expect(isCommittee({ committee: ["cm"] }, "x", "OWNER")).toBe(false);
  });

  test("committeeRecommendsEditorDecides", () => {
    const s = tempStore();
    importRows(s, [{ row: 1, reviewer: {}, citation: { section: "3.4" }, text: "One." }], { channel: "comment-matrix", batch: "m", sha256: "q" }, "t0");
    const ev = (login: string, body: string) => ({ login, body, url: "https://github.com/o/r/issues/1#issuecomment-1", at: "t1" });
    expect(applyGithubComment(s, ev("cm", "pc: PC-0001\nrecommend: noted\n\nCovered.")).applied).toEqual(["PC-0001"]);
    expect(s.get("PC-0001").status).toBe("recommended");
    expect(applyGithubComment(s, ev("cm", "pc: PC-0001\ndecide: noted\n\nCovered.")).refused[0]).toContain("is not an editor in config.json");
    expect(applyGithubComment(s, ev("someone", "pc: PC-0001\nrecommend: accepted")).refused[0]).toContain("not on the committee list");
    expect(applyGithubComment(s, ev("ed", "pc: PC-0001\ndecide: noted\n\nAlready in 2.1.")).applied).toEqual(["PC-0001"]);
    expect(s.get("PC-0001").public.decision).toMatchObject({ code: "noted", by: "ed", reason: "Already in 2.1." });
  });
});

describe("a consolidated review log (the DPI-H master log, 2026-10-05)", () => {
  // The shape of the owner's "Full_DPI-H_master_log_populated.xlsx": one header
  // row, every reviewer column on every row, "Stakeholder type" LEFT of
  // "Comment type", and the log's own Status, Disposition and categorisations.
  const header = [
    "No.", "Date received", "Channel", "Reviewer name", "Organisation", "Country / region", "Stakeholder type",
    "Section no.", "Page", "Line no(s) / Table / Figure", "Comment type", "Theme",
    "Consider by TWG? Human categorisation", "Comment / issue", "Suggested revision", "Status", "Disposition / rationale", "Handled by",
  ];
  const row = (no: string, status: string, disposition: string, text: string, type = "Technical") =>
    [no, "", "Online form", "NAIR, Tapas", "WHO", "(not stated)", "Academia or research", "1.1.2", "9", "42", type, "Equity", "Core architects", text, "Fix it", status, disposition, "someone"];
  const sheet = [header, row("1", "Pending", "", "Pending one."), row("2", "Accepted", "", "Accepted one."), row("3", "Not accepted", "Out of scope.", "Rejected one."), row("4", "Not accepted", "", "Rejected, no reason."), row("5", "Reviewed", "", "Reviewed one, mail me at tapas@who.int", "Q9 - Conformance and testing")];
  const consent = consentByName([["No.", "Name", "Consent to acknowledge", "Notes"], ["1", "Tapas Nair", "Yes", "Email: tapas@who.int"]]);

  test("logCommentTypeAndLabels", () => {
    const t = tableRows(sheet, consent);
    expect(t.rows).toHaveLength(5);
    const r = t.rows[0]!;
    expect(r).toMatchObject({ entry: "1", type: "Technical", channel: "Online form", status: "Pending" });
    expect(r.labels).toEqual({ "Stakeholder type": "Academia or research", Theme: "Equity", "Consider by TWG? Human categorisation": "Core architects" });
    // A type outside the three is kept verbatim as a label.
    expect(t.rows[4]!.labels?.["Comment type"]).toBe("Q9 - Conformance and testing");
    // Consent, read by name from the contributors sheet, whatever the name order.
    expect(r.reviewer.acknowledge).toBe(true);
    expect(nameKey("NAIR, Tapas")).toBe(nameKey("Tapas Nair"));
  });

  test("logStatusesRecordedNotDecided", () => {
    expect(logStatusMove("Partially accepted")).toEqual({ decide: "accepted-modified" });
    expect(logStatusMove("Pending")).toBeUndefined();
    const s = tempStore();
    const r = importRows(s, tableRows(sheet, consent).rows, { channel: "comment-matrix", batch: "log--master", sha256: "x", sheet: "Master log", series: "log" }, "2026-10-05T00:00:00Z");
    const by = Object.fromEntries(s.all().map((c) => [c.public.source.entry, c]));
    expect(by["1"]!.status).toBe("received");
    // Owner, 2026-10-07: "nothing has been decided". Only an editor decides.
    for (const e of ["2", "3", "4"]) {
      expect(by[e]!.status).toBe("triaged");
      expect(by[e]!.public.decision).toBeUndefined();
    }
    expect(by["2"]!.public.history.at(-1)!.note).toContain('the log\'s status was "Accepted"');
    expect(by["3"]!.public.history.at(-1)!.note).toContain("Out of scope.");
    expect(r.fromLog?.recorded).toHaveLength(3);
    expect(by["5"]!.status).toBe("triaged");
    expect(by["1"]!.public.source.channel).toBe(channelOf("Online form", "comment-matrix"));
    expect(by["1"]!.public.reviewer.name).toBe("NAIR, Tapas");
    // No address survives, from the reviewer columns or typed into a comment.
    for (const f of ["PC-0001", "PC-0005"]) expect(readFileSync(join(s.dir, "comments", `${f}.json`), "utf-8")).not.toContain("@who.int");
  });

  test("resentLogAddsNew", () => {
    const s = tempStore();
    const first = tableRows(sheet, consent).rows;
    importRows(s, first, { channel: "comment-matrix", batch: "log--master", sha256: "v1", sheet: "Master log", series: "log" });
    const later = tableRows([...sheet, row("6", "Pending", "", "A new one.")], consent).rows;
    const r = importRows(s, later, { channel: "comment-matrix", batch: "log-v2--master", sha256: "v2", sheet: "Master log", series: "log" });
    expect(r.known).toBe(5);
    expect(r.created).toHaveLength(1);
    expect(s.all()).toHaveLength(6);
  });

  test("linesOnlyWhenSaid", () => {
    expect(lineRanges("618–624")).toEqual([[618, 624]]);
    expect(lineRanges("L339; L369")).toEqual([[339, 339], [369, 369]]);
    expect(lineRanges("Principle IX L392–427")).toEqual([[392, 427]]);
    expect(lineRanges("Requirement 5")).toEqual([]);
    expect(lineRanges("A14.01")).toEqual([]);
  });

  test("sectionByTitleOrAcronym", () => {
    const named: ReviewAnchors = {
      ...anchors,
      sections: [...anchors.sections, { label: "sec:c-phsp", title: "Public Health Surveillance Platform", chapter: "ch1-intro" }],
      blocks: [...anchors.blocks, { label: "prose:c-phsp-1", kind: "prose", chapter: "ch1-intro", root: "p-c", sections: ["sec:c-phsp"], hash: "h9", excerpt: "PHSP", page: 25, printedPage: "14", lineStart: 3, lineEnd: 9, method: "numbered" }],
    };
    expect(sectionsNamed("PHSP, 5", named).map((x) => x.label)).toEqual(["sec:c-phsp"]);
    expect(sectionsNamed("Public Health Surveillance Platform", named)[0]!.label).toBe("sec:c-phsp");
    expect(resolveAnchor({ section: "PHSP, 5", page: "14", lines: "Requirement 5" }, "", named)).toMatchObject({ targetLabel: "prose:c-phsp-1", method: "page", confidence: "medium" });
    expect(resolveAnchor({ section: "Public Health Surveillance Platform" }, "", named)).toMatchObject({ targetLabel: "sec:c-phsp", method: "section" });
  });
});

describe("change-sets and their issues (issue #2183)", () => {
  const at = "2026-10-05T12:00:00Z";
  const url = (n: number) => `https://github.com/o/r/issues/${n}`;
  const store = (n = 8) => {
    const s = tempStore();
    importRows(s, Array.from({ length: n }, (_, i) => ({ row: i + 1, reviewer: { name: "R" }, citation: { section: "1.1.2", page: "9", lines: "42" }, type: "technical", text: `Comment ${i + 1}.` })), { channel: "comment-matrix", batch: "b", sha256: "s" }, at);
    addChangeSet(s, { title: "Clarify the DPI definition", requirements: "Say what DPI-H is in one sentence.", refs: ["PC-0001", "PC-0002"], by: "agent", at });
    addChangeSet(s, { title: "Align actor terms", requirements: "Use one term.", refs: ["PC-0003"], by: "agent", at });
    return s;
  };
  const comment = (n: number, login: string, body: string): GithubEvent => ({ action: "created", sender: { login }, issue: { number: n, html_url: url(n) }, comment: { body, user: { login }, html_url: `${url(n)}#c` } });
  const opened = (n: number, login: string, body: string): GithubEvent => ({ action: "opened", sender: { login }, issue: { number: n, body, user: { login }, html_url: url(n) } });
  const fake = () => {
    const issues = new Map<number, { body: string; state: string }>();
    const comments: Array<[number, string]> = [];
    let next = 100;
    const api: GithubApi = {
      createIssue: async (_t, body) => (issues.set(next, { body, state: "open" }), next++),
      getIssue: async (n) => issues.get(n) ?? { body: "", state: "open" },
      updateIssue: async (n, p) => void issues.set(n, { body: p.body ?? issues.get(n)?.body ?? "", state: p.state ?? issues.get(n)?.state ?? "open" }),
      comment: async (n, b) => void comments.push([n, b]),
    };
    return { issues, comments, api };
  };
  const run = async (s: Store, ev: GithubEvent, f = fake()) => {
    const out = handleGithubEvent(s, ev, at);
    out.log.push(...(await executeActions(s, out.actions, f.api, "bot", at)));
    return { ...out, ...f };
  };

  test("proposalHasNoIssue", () => {
    const s = store();
    expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "proposed", issues: [] });
    expect(membership(s).get("PC-0001")!.map((c) => c.id)).toEqual(["CS-001"]);
    expect("issues" in s.get("PC-0001").public).toBe(false);
    expect(seed(s).flatMap((b) => b.comments as Array<{ ref: string }>).map((c) => c.ref)).toEqual(["PC-0004", "PC-0005", "PC-0006", "PC-0007", "PC-0008"]);
    expect(checkChangeSets(s).errors).toEqual([]);
  });

  test("discussFormAdoptsIssue", async () => {
    const s = store();
    const form = "### Change-set\n\nCS-001\n\n### Discussion\n\nShould this mention the G20?";
    expect(formFields(form)).toEqual({ cs: "CS-001", text: "Should this mention the G20?" });
    const f = fake();
    f.issues.set(60, { body: form, state: "open" });
    const r = await run(s, opened(60, "anyone", form), f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "discussing", issue: 60, issues: [60] });
    // The section is rendered into the issue; the person's text stays below it.
    expect(f.issues.get(60)!.body).toContain("<!-- public-comment-changeset CS-001 -->");
    expect(f.issues.get(60)!.body).toContain("Should this mention the G20?");
    expect(r.actions.some((a) => a.kind === "create")).toBe(false);
    // Disorganised people: another Discuss issue for the same change-set.
    f.issues.set(61, { body: form, state: "open" });
    const again = await run(s, opened(61, "someone", form), f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ issue: 60, issues: [60, 61] });
    expect(again.log.join("\n")).toContain("discussed mainly in #60");
    expect(f.issues.get(60)!.body).toContain("### Also discussed in\n\n#61");
    expect(f.issues.get(61)!.body).not.toContain("public-comment-changeset");
  });

  test("decisionOpensIssue", async () => {
    const s = store();
    const r = await run(s, comment(50, "ed", "pc: PC-0001\ndecide: accepted\n\nAgreed."));
    expect(s.get("PC-0001").status).toBe("decided");
    const cs = getChangeSet(s, "CS-001");
    expect(cs).toMatchObject({ status: "discussing", issue: 100 });
    expect(cs.issues).toEqual([50, 100]);
    expect(r.comments.find(([n]) => n === 100)![1]).toContain("@ed decided **accepted** on PC-0001");
    expect(r.issues.get(100)!.body).toContain("decided: **accepted**");
    // In that issue a bare verb means the whole change-set.
    await run(s, comment(100, "ed", "decide: accepted\n\nBoth, then."), r);
    expect(s.get("PC-0002").public.decision?.code).toBe("accepted");
  });

  test("mentionLinksIssue", async () => {
    const s = store(12);
    const r = await run(s, comment(70, "anyone", "PC-0003 is wrong, I think."));
    expect(getChangeSet(s, "CS-002")).toMatchObject({ issue: 100, issues: [70, 100] });
    expect(r.log.join("\n")).toContain("#70 linked to CS-002");
    for (let i = 4; i <= 4 + MENTION_OPEN_LIMIT; i++) addChangeSet(s, { title: `T${i}`, requirements: "r", refs: [`PC-${String(i).padStart(4, "0")}`], by: "agent", at });
    const many = handleGithubEvent(s, comment(71, "anyone", "See PC-0004 PC-0005 PC-0006 PC-0007 PC-0008 PC-0009"), at);
    expect(many.actions.filter((a) => a.kind === "create")).toHaveLength(0);
    expect(many.log.join("\n")).toContain("too many to open from one mention");
  });

  test("commandsFromCommittee", async () => {
    const s = store();
    const f = fake();
    f.issues.set(60, { body: "", state: "open" });
    await run(s, opened(60, "x", "cs: CS-001"), f);
    expect(parseCommands("cs-requirements: One.\nTwo.\ncs-title: New")).toEqual([{ cmd: "requirements", arg: "One.\nTwo." }, { cmd: "title", arg: "New" }]);
    const no = await run(s, comment(60, "stranger", "cs-add: PC-0004"), f);
    expect(no.log[0]).toContain("not on the committee");
    await run(s, comment(60, "cm", "cs-add: PC-0004, PC-0005\ncs-remove: PC-0002\ncs-requirements: Define DPI-H once.\nIn 1.1.2."), f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ refs: ["PC-0001", "PC-0004", "PC-0005"], requirements: "Define DPI-H once.\nIn 1.1.2." });
    expect(f.issues.get(60)!.body).toContain("Define DPI-H once.");
    await run(s, comment(60, "cm", "cs-merge: CS-002"), f);
    expect(getChangeSet(s, "CS-002")).toMatchObject({ status: "merged", mergedInto: "CS-001" });
    expect(getChangeSet(s, "CS-001").refs).toContain("PC-0003");
    const split = await run(s, comment(60, "cm", "cs-split: PC-0004, PC-0005 as Say who stewards it"), f);
    expect(getChangeSet(s, "CS-003")).toMatchObject({ title: "Say who stewards it", refs: ["PC-0004", "PC-0005"], status: "discussing" });
    expect(split.log.join("\n")).toContain("split from CS-001");
    expect(checkChangeSets(s).errors).toEqual([]);
  });

  test("newChangeSetFromForm", async () => {
    const s = store();
    const form = "### Title\n\nCite the WHO guidance\n\n### Comments\n\nPC-0006, PC-0007\n\n### Requirements\n\nAdd the citation.";
    expect(canonicalText(form)).toContain("cs-new: Cite the WHO guidance");
    const f = fake();
    f.issues.set(80, { body: form, state: "open" });
    await run(s, opened(80, "cm", form), f);
    expect(getChangeSet(s, "CS-003")).toMatchObject({ refs: ["PC-0006", "PC-0007"], requirements: "Add the citation.", issue: 80, status: "discussing" });
  });

  test("handEditReplaced", async () => {
    const s = store();
    const f = fake();
    f.issues.set(60, { body: "", state: "open" });
    await run(s, opened(60, "x", "cs: CS-001"), f);
    const body = f.issues.get(60)!.body;
    const edited = body.replace("Say what DPI-H is", "Say whatever");
    const ev = (to: string, from: string): GithubEvent => ({ action: "edited", sender: { login: "x" }, changes: { body: { from } }, issue: { number: 60, body: to, html_url: url(60) } });
    f.issues.set(60, { body: edited, state: "open" });
    const r = await run(s, ev(edited, body), f);
    expect(r.log[0]).toContain("edit to it was replaced");
    expect(f.issues.get(60)!.body).toContain("Say what DPI-H is");
    const tail = spliceBody(f.issues.get(60)!.body, renderSection(getChangeSet(s, "CS-001"), s)) + "\n\nAlso, see the annex.";
    expect(splitBody(tail).rest).toContain("see the annex");
    expect((await run(s, ev(tail, f.issues.get(60)!.body), f)).log.filter((l) => l.includes("replaced"))).toEqual([]);
  });

  test("prClosesLinkedIssue", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001, PC-0002\ndecide: accepted\n\nYes."), f);
    expect(closedIssues("Closes #50, fixes #9")).toEqual([50, 9]);
    const pr = (merged: boolean, state: string): GithubEvent => ({ action: merged || state === "closed" ? "closed" : "opened", sender: { login: "au" }, pull_request: { number: 12, user: { login: "cm" }, body: "Closes #50", head: { ref: "cs-001" }, merged, state, html_url: "https://github.com/o/r/pull/12" } });
    await run(s, pr(false, "open"), f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "editing", pr: { number: 12, branch: "cs-001" } });
    expect(s.get("PC-0001").status).toBe("editing");
    await run(s, pr(false, "closed"), f);
    expect(getChangeSet(s, "CS-001").status).toBe("discussing");
    await run(s, pr(false, "open"), f);
    const m = await run(s, pr(true, "closed"), f);
    expect(getChangeSet(s, "CS-001").status).toBe("incorporated");
    expect(s.get("PC-0002").status).toBe("incorporated");
    expect(m.actions).toContainEqual({ kind: "state", issue: 100, state: "closed", reason: "completed" });
  });

  test("mergeWithUndecidedStaysOpen", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001\ndecide: accepted\n\nYes."), f);
    const merged: GithubEvent = { action: "closed", sender: { login: "au" }, pull_request: { number: 12, user: { login: "cm" }, body: "Closes #50", head: { ref: "cs-001" }, merged: true, state: "closed", html_url: "https://github.com/o/r/pull/12" } };
    const m = await run(s, merged, f);
    expect(s.get("PC-0001").status).toBe("incorporated");
    expect(s.get("PC-0002").status).not.toBe("incorporated");
    expect(getChangeSet(s, "CS-001").status).not.toBe("incorporated");
    expect(m.actions.filter((a) => a.kind === "state")).toEqual([]);
    expect(m.log.join("\n")).toContain("1 of 2 comment(s) are not decided");
  });

  test("prLinksOnlyFromCommittee", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001, PC-0002\ndecide: accepted\n\nYes."), f);
    const pr = (author: string, sender: string, extra: Partial<NonNullable<GithubEvent["pull_request"]>> = {}): GithubEvent => ({
      action: "opened",
      sender: { login: sender },
      pull_request: { number: 12, user: { login: author }, body: "Closes #50", head: { ref: "cs-001" }, merged: false, state: "open", html_url: "https://github.com/o/r/pull/12", ...extra },
    });
    // Not on the committee: nothing is linked and nothing moves, whoever sent the event.
    const no = await run(s, pr("stranger", "cm", { author_association: "OWNER" }), f);
    expect(no.log.join("\n")).toContain("PR #12: stranger is not on the committee or an editor");
    expect(getChangeSet(s, "CS-001").pr).toBeUndefined();
    expect(getChangeSet(s, "CS-001").status).not.toBe("editing");
    expect(s.get("PC-0001").status).toBe("decided");
    // With no committee list, the PR author's own association is judged.
    const byRole = store();
    writeFileSync(join(byRole.dir, "config.json"), JSON.stringify({ document: "doc", editors: ["ed"] }));
    await run(byRole, comment(50, "ed", "pc: PC-0001\ndecide: accepted\n\nYes."));
    expect((await run(byRole, pr("someone", "maint", { author_association: "NONE" }))).log.join("\n")).toContain("someone is not on the committee");
    expect(getChangeSet(byRole, "CS-001").pr).toBeUndefined();
    await run(byRole, pr("member", "member", { author_association: "MEMBER" }));
    expect(getChangeSet(byRole, "CS-001").pr?.number).toBe(12);
    // A committee author links the change-set and moves its decided comments.
    await run(s, pr("cm", "cm"), f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "editing", pr: { number: 12, branch: "cs-001" } });
    expect(s.get("PC-0001").status).toBe("editing");
    // A merge is judged by the merger's write access, not the author's role.
    await run(s, { ...pr("stranger", "ed", { merged: true, state: "closed" }), action: "closed" }, f);
    expect(s.get("PC-0001").status).toBe("incorporated");
    expect(getChangeSet(s, "CS-001").status).toBe("incorporated");
  });

  test("editByOtherRecordsNothing", async () => {
    const s = store();
    const before = "Context.";
    const after = "pc: PC-0001\ndecide: accepted\n\nContext.";
    const edit = (sender: string): GithubEvent => ({ action: "edited", sender: { login: sender }, changes: { body: { from: before } }, issue: { number: 60, body: after, user: { login: "ed" }, author_association: "OWNER", html_url: url(60) } });
    const r = await run(s, edit("cm"));
    expect(r.log.join("\n")).toContain("edited by cm, not its author ed");
    expect(s.get("PC-0001").status).not.toBe("decided");
    // The author's own edit is judged by the author.
    await run(s, edit("ed"));
    expect(s.get("PC-0001").status).toBe("decided");
  });

  test("onlyKeywordLinks", () => {
    expect(linkedChangeSets("Closes CS-12, fixes CS-3 and resolves cs-7")).toEqual(["CS-012", "CS-003", "CS-007"]);
    expect(linkedChangeSets("Pin bump.\ncs: CS-236, CS-237\n")).toEqual(["CS-236", "CS-237"]);
    expect(linkedChangeSets("Staging for CS-236 and CS-237, which were reopened.")).toEqual([]);
  });

  test("settledNeverRelinked", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001, PC-0002\ndecide: accepted\n\nYes."), f);
    await run(s, { action: "closed", sender: { login: "au" }, pull_request: { number: 12, user: { login: "cm" }, body: "Closes #50", head: { ref: "cs-001" }, merged: true, state: "closed", html_url: "https://github.com/o/r/pull/12" } }, f);
    expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "incorporated", pr: { number: 12 } });
    for (const body of ["Pin bump; mentions CS-001 in prose.", "Closes CS-001", "Closes #50"]) {
      const r = await run(s, { action: "opened", sender: { login: "au" }, pull_request: { number: 24, user: { login: "cm" }, body, head: { ref: "pin" }, merged: false, state: "open", html_url: "https://github.com/o/r/pull/24" } }, f);
      expect(getChangeSet(s, "CS-001")).toMatchObject({ status: "incorporated", pr: { number: 12 } });
      expect(s.get("PC-0001").status).toBe("incorporated");
      if (body !== "Pin bump; mentions CS-001 in prose.") expect(r.log.join("\n")).toContain("does not re-link it");
    }
  });

  test("writerKeepsSchema", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001\ndecide: accepted\n\nYes."), f);
    const raw = JSON.parse(readFileSync(join(s.dir, "changesets", "CS-001.json"), "utf-8"));
    expect(raw.$schema).toBe("changeset/1.0.0");
    saveChangeSet(s, getChangeSet(s, "CS-001"));
    expect(JSON.parse(readFileSync(join(s.dir, "changesets", "CS-001.json"), "utf-8")).$schema).toBe("changeset/1.0.0");
  });

  test("reopenedBackToDiscussing", async () => {
    const s = store();
    const f = fake();
    await run(s, comment(50, "ed", "pc: PC-0001, PC-0002\ndecide: accepted\n\nYes."), f);
    await run(s, { action: "closed", sender: { login: "au" }, pull_request: { number: 12, user: { login: "cm" }, body: "Closes #50", head: { ref: "cs-001" }, merged: true, state: "closed", html_url: "https://github.com/o/r/pull/12" } }, f);
    const cs = getChangeSet(s, "CS-001");
    expect(cs.status).toBe("incorporated");
    await run(s, { action: "reopened", sender: { login: "ed" }, issue: { number: cs.issue!, html_url: url(cs.issue!) } }, f);
    expect(getChangeSet(s, "CS-001").status).toBe("discussing");
  });

  test("closedByHandReopened", async () => {
    const s = store();
    const f = fake();
    await run(s, opened(60, "x", "cs: CS-002"), f);
    const closed: GithubEvent = { action: "closed", sender: { login: "x" }, issue: { number: 60, html_url: url(60) } };
    const r = await run(s, closed, f);
    expect(r.actions).toContainEqual({ kind: "state", issue: 60, state: "open" });
    await run(s, comment(60, "ed", "decide: not-accepted\n\nOut of scope."), f);
    await run(s, closed, f);
    expect(getChangeSet(s, "CS-002").status).toBe("closed");
  });

  test("installWritesTemplates", () => {
    const repo = mkdtempSync(join(tmpdir(), "pc-install-"));
    const r = installTemplates(repo, { assistant: "platform" });
    expect(r.written.sort()).toEqual(["ISSUE_TEMPLATE/change-set-new.yml", "ISSUE_TEMPLATE/change-set.yml", "ISSUE_TEMPLATE/comment-decision.yml", "workflows/public-comment-check.yml", "workflows/public-comment.yml"]);
    const wf = readFileSync(join(repo, ".github", "workflows", "public-comment.yml"), "utf-8");
    expect(wf).toContain("bun run platform/folio-assistant-core/scripts/public-comment-changesets.ts github");
    expect(wf).not.toContain("{{assistant}}");
    // The forms' labels are the ones the parser reads.
    const form = readFileSync(join(repo, ".github", "ISSUE_TEMPLATE", "comment-decision.yml"), "utf-8");
    for (const label of ["Comments", "Recommend or decide", "Decision", "Reason"]) expect(form).toContain(`label: ${label}`);
    expect(installTemplates(repo, { assistant: "platform" }).kept).toHaveLength(5);
  });

  test("checkFindsContradictions", () => {
    const s = store();
    const cs = getChangeSet(s, "CS-001");
    saveChangeSet(s, { ...cs, issue: 5, issues: [5] });
    expect(checkChangeSets(s).errors.join("\n")).toContain("proposed, yet has issue #5");
    saveChangeSet(s, cs);
    s.save(transition(s.get("PC-0003"), "decide", { by: "ed", at, decision: { code: "noted", reason: "Already there." } }));
    expect(checkChangeSets(s).warnings.join("\n")).toContain("CS-002");
    expect(reconcilePlan(s)).toEqual([{ kind: "create", cs: "CS-002", notes: [expect.stringContaining("PC-0003")] }]);
    expect(changeSets(s)).toHaveLength(2);
  });

  test("personReroutesCommittee", async () => {
    const s = store();
    // Seed routing.json so CS-001's derived plurality committee is "Core architects".
    writeFileSync(
      join(s.dir, "routing.json"),
      JSON.stringify({
        $schema: "twg-routing/0.1",
        taxonomy: "DPI-H",
        routings: {
          "PC-0001": { category: "Core architects", by: "claude-agent" },
          "PC-0002": { category: "Core architects", by: "claude-agent" },
        },
      }),
    );
    const f = fake();
    await run(s, opened(60, "x", "cs: CS-001"), f);

    // 1. Committee member moves CS-001 from Core architects -> Clinical with a reason.
    const r1 = await run(s, comment(60, "cm", "cs-committee: Clinical — Clinical workflow question, not architecture"), f);
    expect(r1.log.join("\n")).toContain("CS-001: committee Core architects → Clinical (Clinical workflow question, not architecture)");
    const after1 = getChangeSet(s, "CS-001");
    expect(after1.committee).toBe("Clinical");
    expect(after1.committeeMoves).toEqual([
      {
        who: "cm",
        when: at,
        from: "Core architects",
        to: "Clinical",
        why: "Clinical workflow question, not architecture",
        url: `${url(60)}#c`,
      },
    ]);
    expect(f.issues.get(60)!.body).toContain("### Committee\n\n**Clinical**");
    expect(f.issues.get(60)!.body).toContain("Core architects → **Clinical** by @cm");

    // 2. Editor moves CS-001 again (Clinical -> WHO), using the CLI/programmatic helper.
    const after2 = rerouteChangeSet(s, "CS-001", {
      to: "WHO",
      why: "Cross-cutting WHO governance policy.",
      by: "ed",
      at: "2026-10-07T09:00:00Z",
    });
    expect(after2.committee).toBe("WHO");
    expect(after2.committeeMoves).toHaveLength(2);
    expect(after2.committeeMoves[1]).toEqual({
      who: "ed",
      when: "2026-10-07T09:00:00Z",
      from: "Clinical",
      to: "WHO",
      why: "Cross-cutting WHO governance policy.",
    });

    // 3. Re-ingesting the comment log leaves the change-set's committee and move history untouched.
    importRows(
      s,
      [
        { row: 1, reviewer: { name: "A" }, citation: { section: "1.1.2", page: "20", lines: "42" }, text: "Comment 1" },
        { row: 8, reviewer: { name: "B" }, citation: { section: "1.1.2", page: "20", lines: "42" }, text: "New row 8" },
      ],
      { channel: "comment-matrix", batch: "b-reingest", sha256: "h2" },
      "2026-10-08T00:00:00Z",
    );
    const afterReingest = getChangeSet(s, "CS-001");
    expect(afterReingest.committee).toBe("WHO");
    expect(afterReingest.committeeMoves).toHaveLength(2);

    // 4. Reasonless moves, unknown committees, and non-committee users are refused.
    const noReason = await run(s, comment(60, "cm", "cs-committee: Editorial"), f);
    expect(noReason.log.join("\n")).toContain("needs a reason");
    const badGroup = await run(s, comment(60, "cm", "cs-committee: NotACommittee — because"), f);
    expect(badGroup.log.join("\n")).toContain("is not a TWG committee");
    const outsider = await run(s, comment(60, "stranger", "cs-committee: Editorial — typo only"), f);
    expect(outsider.log.join("\n")).toContain("not on the committee");
    expect(getChangeSet(s, "CS-001").committee).toBe("WHO");

    // 5. Agents cannot make the move on their own ( CLI, GitHub command, or schema ).
    expect(() =>
      rerouteChangeSet(s, "CS-001", { to: "Editorial", why: "Automated guess", by: "claude-agent", at }),
    ).toThrow(/person-only step/);
    expect(() =>
      rerouteChangeSet(s, "CS-001", { to: "Editorial", why: "Automated guess", by: "agent", at }),
    ).toThrow(/person-only step/);
    writeFileSync(join(s.dir, "config.json"), JSON.stringify({ document: "doc", editors: ["ed"], committee: ["cm", "claude-agent"] }));
    const agentTry = await run(s, comment(60, "claude-agent", "cs-committee: Editorial — agent trying"), f);
    expect(agentTry.log.join("\n")).toContain("person-only step");
    expect(getChangeSet(s, "CS-001").committee).toBe("WHO");
    expect(
      ChangeSetSchema.safeParse({
        ...getChangeSet(s, "CS-001"),
        committee: "Editorial",
        committeeMoves: [{ who: "claude-agent", when: at, from: "WHO", to: "Editorial", why: "Agent move" }],
      }).success,
    ).toBe(false);

    // 6. Task_RerouteChangeSet in public-comment.bpmn is a person-only userTask.
    const bpmn = readFileSync(join(import.meta.dir, "..", "collab", "processes", "content", "public-comment.bpmn"), "utf-8");
    expect(bpmn).toMatch(/<bpmn:userTask\s+id="Task_RerouteChangeSet"/);
    expect(bpmn).not.toMatch(/<bpmn:(?:task|serviceTask)\s+id="Task_RerouteChangeSet"/);
  });
});
