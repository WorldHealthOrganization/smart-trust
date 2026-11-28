/** review-log archive (#682) and offline import (#683). */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ApiSpreadsheet, archive, commitMessage, diffLogs, fromSheetsApi, headerRowOf, mergeReads, readWorkbook, redact, roleOf, writeWorkbook } from "./review-log-archive.js";
import { check, citeProblems, intakeCsv, type LogNode, plan, reviewList, similarity } from "./review-log-import.js";

// The review sheet's own header colours (DPI-H master log, 2026-11-08).
const BLUE = { red: 0.6196, green: 0.7686, blue: 0.9098 };
const ORANGE = { red: 0.9569, green: 0.698, blue: 0.4196 };
const GREEN = { red: 0.5765, green: 0.7647, blue: 0.4863 };
const GREY = { red: 0.7176, green: 0.7176, blue: 0.7176 };

const cell = (v: string | number, bg?: object, extra: object = {}) => ({
  formattedValue: String(v),
  ...(typeof v === "number" ? { effectiveValue: { numberValue: v } } : { effectiveValue: { stringValue: v } }),
  ...(bg ? { effectiveFormat: { backgroundColor: bg } } : {}),
  ...extra,
});

function sheet(rows: Array<Array<ReturnType<typeof cell> | object>>, title = "Review Change Sets"): ApiSpreadsheet["sheets"][number] {
  return { properties: { title }, data: [{ rowData: rows.map((values) => ({ values })) }] };
}

const header = [
  cell("Change-set", GREY),
  cell("Title", BLUE, { note: "A short name. You fill this in." }),
  cell("Committee Feedback (CL)", BLUE),
  cell("Ready for agent", ORANGE),
  cell("Change Set Feedback (agent)", GREEN),
  cell("Submitter email", BLUE),
];
const api = (rows: object[][] = []): ApiSpreadsheet => ({
  spreadsheetId: "SHEET",
  properties: { title: "Test log" },
  sheets: [
    sheet([
      [cell("Instructions"), cell("Blue = people", undefined, { note: "Ask c@example.org" })],
      header,
      [cell("CS-001"), cell("Clarify the scope"), cell(""), cell("No"), cell("Proposal: …", undefined, { hyperlink: "https://example.org/pr/1" }), cell("a.reviewer@example.org")],
      [cell("CS-002"), cell("Define the registry"), cell("Agree; contact b@example.org"), cell("Yes"), cell("2:245177"), cell("")],
      ...rows,
    ]),
    sheet([[cell("x")]], "Watch"),
    sheet([[cell("Name"), cell("Email")], [cell("A Reviewer"), cell("a@example.org")]], "Public Comment Source"),
  ],
});

describe("review-log archive (#682)", () => {
  test("roles come from the header colours, as the sheet's legend says", () => {
    const [t] = fromSheetsApi(api());
    expect(t.headerRow).toBe(2);
    expect(t.columns.map((c) => c.role)).toEqual(["script", "human", "human", "editor", "agent", "human"]);
    expect(roleOf(undefined)).toBeUndefined();
    expect(roleOf("FFFFFF")).toBeUndefined();
  });

  test("a feedback basis like 2:245177 stays text, never a time", () => {
    const [t] = fromSheetsApi(api());
    expect(t.rows[3][4]?.v).toBe("2:245177");
    expect(fromSheetsApi({ sheets: [sheet([[cell(3)]])] })[0].rows[0][0]?.v).toBe(3);
  });

  test("private tabs are left out and email addresses removed", () => {
    const merged = mergeReads([api()]);
    expect(merged.sheets.map((s) => s.properties?.title)).toEqual(["Review Change Sets"]);
    const tabs = fromSheetsApi(merged);
    const r = redact(tabs);
    expect(r.columns).toEqual(["Review Change Sets!Submitter email"]);
    expect(r.emails).toBe(2);
    expect(tabs[0].rows[0][1]?.note).toBe("Ask [email removed]");
    expect(tabs[0].rows[2][5]?.v).toBeNull();
    expect(tabs[0].rows[3][2]?.v).toBe("Agree; contact [email removed]");
  });

  test("the workbook round-trips its values and is byte-identical when rebuilt", () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-"));
    try {
      const tabs = fromSheetsApi(mergeReads([api()]));
      writeWorkbook(tabs, join(dir, "a.xlsx"));
      writeWorkbook(tabs, join(dir, "b.xlsx"));
      expect(readFileSync(join(dir, "a.xlsx")).equals(readFileSync(join(dir, "b.xlsx")))).toBe(true);
      const back = readWorkbook(join(dir, "a.xlsx"));
      expect(back[0].name).toBe("Review Change Sets");
      expect(back[0].rows[2].slice(0, 2)).toEqual(["CS-001", "Clarify the scope"]);
      const xml = readFileSync(join(dir, "a.xlsx")).toString("latin1");
      expect(xml.includes("xl/comments1.xml")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("one file per log, overwritten only when it changed, the commit message lists the cells", () => {
    const repo = mkdtempSync(join(tmpdir(), "rl-repo-"));
    try {
      const o = { repo, logId: "test-log", document: "doc", role: "master" as const, now: "2026-11-08T00:00:00Z" };
      const first = archive(mergeReads([api()]), o);
      expect(first.changed).toBe(true);
      expect(first.file.endsWith("review/public-comment/logs/test-log.xlsx")).toBe(true);
      const node = JSON.parse(readFileSync(first.node, "utf-8"));
      expect(node.$schema).toBe("review-log/1.0.0");
      expect(node.tabs[0].columns[1]).toEqual({ header: "Title", role: "human" });
      expect(archive(mergeReads([api()]), o).changed).toBe(false);
      const next = api([[cell("CS-003"), cell("A new change set")]]);
      next.sheets[0].data![0].rowData![2].values![2] = cell("Looks right");
      const second = archive(mergeReads([next]), o);
      expect(second.changed).toBe(true);
      expect(second.message).toContain("1 cell changed, 1 row added");
      expect(second.message).toContain("Review Change Sets CS-001, Committee Feedback (CL): (empty) -> Looks right");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("diffLogs keys rows by their id, not their position", () => {
    const before = [{ name: "T", rows: [["No.", "Text"], ["1", "a"], ["2", "b"]] }];
    const after = [{ name: "T", rows: [["No.", "Text"], ["2", "b"], ["1", "A"]] }];
    const d = diffLogs(before, after);
    expect(d.changes).toEqual([{ tab: "T", row: "1", column: "Text", from: "a", to: "A" }]);
    expect(commitMessage("T", d)).toContain("1 cell changed");
    expect(headerRowOf([[{ v: "x" }], [{ v: "a" }, { v: "b" }]])).toBe(2);
  });
});

const node: LogNode = {
  id: "test-log",
  file: "review/public-comment/logs/test-log.xlsx",
  tabs: [
    {
      name: "Review Change Sets",
      headerRow: 1,
      columns: [
        { header: "Change-set", role: "script" },
        { header: "Title", role: "human" },
        { header: "Committee Feedback (CL)", role: "human" },
        { header: "Ready for agent", role: "editor" },
      ],
    },
  ],
};
const H = ["Change-set", "Title", "Committee Feedback (CL)", "Ready for agent"];
const master = [{ name: "Review Change Sets", rows: [H, ["CS-001", "Clarify the scope", "", "No"], ["CS-002", "Define the registry for health facilities", "Agree", "Yes"]] }];

describe("review-log import (#683)", () => {
  test("the returned file must match the template", () => {
    const r = check({ node, master, returned: [{ name: "Something else", rows: [["a"]] }] });
    expect(r.problems[0]).toContain("not this log's template");
    expect(plan(r, master, "all").writes).toEqual([]);
  });

  test("numbers are hints: same number and title adds; another title conflicts; same words is a duplicate; new is numbered by the master", () => {
    const returned = [
      {
        name: "Review Change Sets",
        rows: [
          H,
          ["CS-001", "Clarify the scope", "Offline: fine", "Yes"],
          ["CS-002", "Something else entirely", "x", "No"],
          ["CS-777", "Define the registry for health facilities", "dup", ""],
          ["", "A brand new change set", "", ""],
        ],
      },
    ];
    const r = check({ node, master, returned });
    const by = Object.fromEntries(r.candidates.map((c) => [c.sourceRow, c]));
    expect(by[2].group).toBe("add");
    expect(by[2].cells).toEqual([{ column: "Committee Feedback (CL)", from: "", to: "Offline: fine" }]);
    expect(by[3].group).toBe("conflict");
    expect(by[4].group).toBe("duplicate");
    expect(by[4].masterKey).toBe("CS-002");
    expect(by[5].group).toBe("new");
    expect(reviewList(r)).toContain("Possible duplicate (1)");
    const p = plan(r, master, [by[2].n, by[5].n]);
    // Ready for agent (an Editor's) is never written; the new row goes below the last.
    expect(p.writes).toEqual([
      { range: "'Review Change Sets'!C2", value: "Offline: fine", candidate: by[2].n },
      { range: "'Review Change Sets'!B4", value: "A brand new change set", candidate: by[5].n },
    ]);
    expect(plan(r, master, [by[3].n]).refused[0]).toContain("conflict");
  });

  test("a filled cell may only be extended offline, unless the base copy shows who changed it", () => {
    const returned = [{ name: "Review Change Sets", rows: [H, ["CS-002", "Define the registry for health facilities", "Disagree", "Yes"]] }];
    expect(check({ node, master, returned }).candidates[0].group).toBe("conflict");
    const extended = [{ name: "Review Change Sets", rows: [H, ["CS-002", "Define the registry for health facilities", "Agree, with one change", "Yes"]] }];
    expect(check({ node, master, returned: extended }).candidates[0].group).toBe("add");
    const base = [{ name: "Review Change Sets", rows: [H, ["CS-002", "Define the registry for health facilities", "", "Yes"]] }];
    // Changed in both since the base: a conflict. Changed only in the master: nothing to import.
    expect(check({ node, master, returned, base }).candidates[0].group).toBe("conflict");
    expect(check({ node, master, returned: base, base }).candidates.map((c) => c.group)).toEqual(["unchanged"]);
  });

  test("the PDF feedback template: page and line are checked against the frozen review version", () => {
    const map = { pages: { "4": { printed: "3", lines: {} }, "14": { printed: "3", lines: { "100": "a", "101": "b" } } } };
    expect(citeProblems("3", "100-101", map)).toEqual([]);
    expect(citeProblems("3", "Table 7, line 100", map)).toEqual([]);
    expect(citeProblems("3", "9999", map)[0]).toContain("not on page 3");
    expect(citeProblems("999", "1", map)[0]).toContain("not in the review version");
    expect(similarity("Define the registry", "define the REGISTRY")).toBe(1);
    expect(intakeCsv([{ Page: "3", "Comment / issue": 'He said "hi", twice' }])).toBe('Page,Comment / issue\n3,"He said ""hi"", twice"\n');
  });
});
