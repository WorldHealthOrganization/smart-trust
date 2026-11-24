import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ReviewAnchors } from "./docx-to-folio.js";
import { checkRows, commentWorkbook, formFields, googleFormScript, issueForm, issuesCsv, releaseReferences } from "./public-comment-channels.js";
import { readRows, tableRows } from "./public-comment.js";

const anchors = {
  $schema: "folio-review-anchors/1.0.0",
  document: "demo",
  library: "lib",
  source: { docx: { file: "d.docx", sha256: "aa" }, pdf: { file: "d.pdf", sha256: "bb", pages: 30 } },
  chapters: [{ dir: "ch1", title: "Intro", number: 1, label: "ch1" }],
  sections: [
    { label: "s1", number: "1", title: "Introduction", chapter: "ch1", page: 12 },
    { label: "s2", number: "3.4.5", title: "Governance", chapter: "ch1", page: 14 },
    { label: "s3", number: "C", title: "Appendix C: Glossary", chapter: "ch1" },
  ],
  blocks: [
    { label: "b1", kind: "prose", chapter: "ch1", root: "b1", sections: ["s1"], hash: "x", excerpt: "e", page: 12, printedPage: "1", method: "m" },
    { label: "b2", kind: "table", chapter: "ch1", root: "b2", sections: ["s2"], caption: "Table 3.1", hash: "y", excerpt: "e", page: 14, pageEnd: 15, printedPage: "3", method: "m" },
  ],
} as unknown as ReviewAnchors;

const refs = releaseReferences(anchors, { id: "demo-pc-v1", title: "Draft for Public Comment Release v1" });

describe("release references", () => {
  test("releaseReferences", () => {
    expect(refs.sections.map((s) => s.ref)).toEqual(["1 Introduction", "3.4.5 Governance", "Appendix C: Glossary"]);
    expect(refs.pages).toEqual(["1", "3", "4"]);
    expect(refs.captions).toEqual(["Table 3.1"]);
    expect(refs.release.pdfSha256).toBe("bb");
  });
});

describe("the offline sheet comes back through the importer", () => {
  test("offlineSheetImported", () => {
    const dir = mkdtempSync(join(tmpdir(), "pcc-"));
    const file = join(dir, "sheet.xlsx");
    writeFileSync(file, commentWorkbook(refs));
    const sheets = readRows(file);
    expect(sheets.map((s) => s.name)).toEqual(["Instructions", "Comments", "References"]);
    const c = sheets.find((s) => s.name === "Comments")!;
    // Fill it as a reviewer would: details at the top, two comments.
    const at = (label: string) => c.rows.findIndex((r) => r[0] === label);
    c.rows[at("Name")][1] = "Jane Doe";
    c.rows[at("Acknowledge by name (Yes/No)")][1] = "Yes";
    const h = c.rows.findIndex((r) => r[0] === "No.");
    c.rows[h + 1] = [1, "3.4.5 Governance", "3", "Table 3.1", "technical", "Unclear", "Say X"];
    c.rows[h + 2] = [2, "9 Nope", "99", null, "general", "Off the map", null];
    const t = tableRows(c.rows);
    expect(t.rows.length).toBe(2);
    expect(t.rows[0].reviewer).toEqual({ name: "Jane Doe", acknowledge: true });
    expect(t.rows[0].citation.caption).toBe("Table 3.1");
    const problems = checkRows([c], refs);
    expect(problems.map((p) => p.problem)).toEqual(['section "9 Nope" is not in demo-pc-v1', 'page "99" is not in demo-pc-v1']);
  });
});

describe("GitHub issues come back as a form export", () => {
  const body = [
    "### Section", "", "3.4.5 Governance", "",
    "### Page", "", "3", "",
    "### Line no(s), Table or Figure", "", "_No response_", "",
    "### Comment type", "", "technical", "",
    "### Comment / issue", "", 'Unclear, "really".', "",
    "### Suggested revision", "", "Say X.", "",
    "### Acknowledgement", "", "- [X] Name me (my GitHub login) in the acknowledgements",
  ].join("\n");
  test("issueFormFields", () => {
    const f = formFields(body);
    expect(f.get("Section")).toBe("3.4.5 Governance");
    expect(f.get("Line no(s), Table or Figure")).toBe("");
  });
  test("onlyReleaseIssues", () => {
    const csv = issuesCsv(
      [
        { number: 7, title: "[demo-pc-v1] unclear", body, user: { login: "octo" }, created_at: "2026-11-02T10:00:00Z" },
        { number: 8, title: "something else", body: "" },
      ],
      "demo-pc-v1",
    );
    const dir = mkdtempSync(join(tmpdir(), "pcc-"));
    writeFileSync(join(dir, "gh.csv"), csv);
    const t = tableRows(readRows(join(dir, "gh.csv"))[0].rows);
    expect(t.rows.length).toBe(1);
    expect(t.rows[0]).toMatchObject({ entry: "7", channel: "github", reviewer: { name: "octo", acknowledge: true }, text: 'Unclear, "really".', suggestedRevision: "Say X." });
  });
});

describe("the form and issue form offer only the release's references", () => {
  test("issueFormOptions", () => {
    const y = issueForm(refs);
    for (const s of refs.sections) expect(y).toContain(JSON.stringify(s.ref));
    expect(y).toContain('title: "[demo-pc-v1] "');
  });
  test("googleFormScript", () => {
    const gs = googleFormScript(refs);
    expect(gs).toContain('"3.4.5 Governance"');
    expect(() => new Function(gs)).not.toThrow();
  });
});
