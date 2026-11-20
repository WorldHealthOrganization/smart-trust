#!/usr/bin/env bun
/**
 * public-comment-channels — the channels a public-comment RELEASE goes out on,
 * each limited to the release's fixed references, and the way each one comes
 * back in. Skill: `public-comment-channels` (folio-document-adapter). Process:
 * `public-comment-release.bpmn`, Task_SetUpChannels; intake lands in
 * `public-comment.bpmn`, Task_Ingest.
 *
 * ## One list of references, every channel built from it
 *
 * A comment can only cite what the frozen review version holds: its numbered
 * sections, its printed pages, its captioned tables and figures. `refs` reads
 * those from the release's `review-anchors.json` into one
 * `release-references.json`. Every channel is generated from that file, so the
 * Excel sheet's drop-downs, the Google Form's lists and the GitHub issue
 * form's options are the same list, and none of them offers a section the
 * release does not have.
 *
 * ```sh
 * bun run folio-assistant-core/scripts/public-comment-channels.ts refs <review-anchors.json> --release <id> --title "<release title>" [--draft-url <url>] [--out release-references.json]
 * bun run folio-assistant-core/scripts/public-comment-channels.ts xlsx <release-references.json> --out <comment-sheet.xlsx>
 * bun run folio-assistant-core/scripts/public-comment-channels.ts google-form <release-references.json> --out <CreatePublicCommentForm.gs>
 * bun run folio-assistant-core/scripts/public-comment-channels.ts issue-form <release-references.json> --out <.github/ISSUE_TEMPLATE/public-comment.yml>
 * bun run folio-assistant-core/scripts/public-comment-channels.ts issues-csv <issues.json> --release <id> --out <github-issues.csv>
 * bun run folio-assistant-core/scripts/public-comment-channels.ts check <returned.xlsx|.csv> --refs <release-references.json>
 * ```
 *
 * ## Coming back in: one importer
 *
 * Every channel returns a table the existing importer already reads
 * (`public-comment.ts import`): the Excel sheet is a comment matrix (submitter
 * details in label/value rows above the header), the Form's response sheet
 * and the GitHub issues (through `issues-csv`) are form exports. The column
 * headers here are the importer's (`HEADERS` in `public-comment.ts`), so
 * nothing is parsed twice. `check` reports a returned row that cites a
 * section or page outside the release before it is imported.
 *
 * Submitter details (name, organisation, country, stakeholder type, email,
 * consent) are asked once per submission and never written to the repository
 * except as the importer allows: a pseudonymous id, and the name only with
 * consent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { deflateRawSync } from "node:zlib";

import type { ReviewAnchors } from "./docx-to-folio.js";
import { readRows, tableRows } from "./public-comment.js";
import { PUBLIC_COMMENT_TYPES, parseSection } from "../schemas/public-comment.js";

export const RELEASE_REFERENCES_SCHEMA = "public-comment-release-references/1.0.0" as const;

export interface ReleaseReferences {
  $schema: typeof RELEASE_REFERENCES_SCHEMA;
  release: {
    /** "dpi-h-pc-2026-11", stamped on every channel and every returned batch. */
    id: string;
    /** "Draft for Public Comment Release v0.9". */
    title: string;
    /** The frozen, line-numbered draft every reference points into. */
    draftUrl?: string;
    pdfSha256: string;
    docxSha256: string;
  };
  document: string;
  /** Numbered sections as a reader cites them: "3.4.5 Governance". */
  sections: Array<{ ref: string; number?: string; title: string; page?: string }>;
  /** Printed page numbers, in reading order. */
  pages: string[];
  /** "Table 3.1", "Figure 2.2". */
  captions: string[];
}

// ── refs ─────────────────────────────────────────────────────────

export function releaseReferences(a: ReviewAnchors, release: { id: string; title: string; draftUrl?: string }): ReleaseReferences {
  const printed = (page?: number, p?: string) => p ?? (page === undefined ? undefined : String(page));
  const sections = a.sections.map((s) => {
    const ref = !s.number ? s.title : s.title.startsWith(`Appendix ${s.number}`) ? s.title : `${s.number} ${s.title}`;
    const firstBlock = a.blocks.find((b) => b.sections.includes(s.label));
    const page = printed(firstBlock?.page ?? s.page, firstBlock?.printedPage);
    return { ref, ...(s.number ? { number: s.number } : {}), title: s.title, ...(page ? { page } : {}) };
  });
  const seenRef = new Set<string>();
  const uniqueSections = sections.filter((s) => (seenRef.has(s.ref) ? false : (seenRef.add(s.ref), true)));
  const pages: string[] = [];
  const seenPage = new Set<string>();
  for (const b of [...a.blocks].sort((x, y) => x.page - y.page)) {
    for (let p = b.page; p <= (b.pageEnd ?? b.page); p++) {
      // A block's later pages are counted on from its printed first page;
      // a page printed as a roman numeral is listed only where a block starts.
      const first = printed(b.page, b.printedPage)!;
      const label = p === b.page ? first : /^\d+$/.test(first) ? String(Number(first) + p - b.page) : undefined;
      if (label && !seenPage.has(label)) {
        seenPage.add(label);
        pages.push(label);
      }
    }
  }
  const captions = [...new Set(a.blocks.map((b) => b.caption).filter((c): c is string => !!c))];
  return {
    $schema: RELEASE_REFERENCES_SCHEMA,
    release: { ...release, pdfSha256: a.source.pdf.sha256, docxSha256: a.source.docx.sha256 },
    document: a.document,
    sections: uniqueSections,
    pages,
    captions,
  };
}

// ── The headers every channel writes, as the importer reads them ──

export const COLUMNS = {
  no: "No.",
  section: "Section",
  page: "Page",
  lines: "Line no(s), Table or Figure",
  type: "Comment type",
  text: "Comment / issue",
  revision: "Suggested revision",
} as const;

export const DETAILS = {
  release: "Release",
  name: "Name",
  organisation: "Organisation",
  country: "Country / region",
  stakeholder: "Stakeholder type",
  email: "Email (never published)",
  acknowledge: "Acknowledge by name (Yes/No)",
} as const;

const instructions = (r: ReleaseReferences, channel: string) =>
  [
    `${r.release.title} (${r.release.id})`,
    "",
    `Comment on this release only${r.release.draftUrl ? `: ${r.release.draftUrl}` : ""}.`,
    "Every section, page and line you cite refers to that frozen, line-numbered draft.",
    channel,
    "Pick the section from the list. Give the page and, where you can, the line numbers, or the table or figure.",
    "Comment type: general, technical or editorial. Put the change you propose in Suggested revision.",
    "Your email is used only to contact you about your comments and is never published.",
    "Your name is published in the acknowledgements only if you answer Yes.",
  ].join("\n");

// ── xlsx: the offline comment sheet ──────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const cell = (ref: string, v: string | number | undefined, style = 0) =>
  v === undefined || v === ""
    ? style
      ? `<c r="${ref}" s="${style}"/>`
      : ""
    : typeof v === "number"
      ? `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;

function sheetXml(rows: Array<Array<string | number | undefined>>, opts: { widths?: number[]; styles?: (r: number, c: number) => number; validations?: string; protect?: boolean; freezeRow?: number } = {}) {
  const cols = opts.widths ? `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const views = opts.freezeRow
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${opts.freezeRow}" topLeftCell="A${opts.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const data = rows
    .map((r, i) => {
      const cells = r.map((v, j) => cell(`${colName(j)}${i + 1}`, v, opts.styles?.(i, j) ?? 0)).join("");
      return cells ? `<row r="${i + 1}">${cells}</row>` : "";
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}${cols}<sheetData>${data}</sheetData>${opts.protect ? `<sheetProtection sheet="1" objects="1" scenarios="1"/>` : ""}${opts.validations ?? ""}</worksheet>`;
}

const listRule = (sqref: string, formula: string, prompt: string) =>
  `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Not in this release" error="${esc(
    "Pick a value from the list: it holds every reference in this release.",
  )}" promptTitle="From the list" prompt="${esc(prompt)}" sqref="${sqref}"><formula1>${esc(formula)}</formula1></dataValidation>`;

/** Rows the sheet offers for comments. */
export const XLSX_COMMENT_ROWS = 500;

export function commentWorkbook(r: ReleaseReferences): Buffer {
  const details: Array<[string, string]> = [
    [DETAILS.release, `${r.release.title} (${r.release.id})`],
    [DETAILS.name, ""],
    [DETAILS.organisation, ""],
    [DETAILS.country, ""],
    [DETAILS.stakeholder, ""],
    [DETAILS.email, ""],
    [DETAILS.acknowledge, ""],
  ];
  const headerRow = details.length + 2; // 1-based
  const first = headerRow + 1;
  const last = headerRow + XLSX_COMMENT_ROWS;
  const header = [COLUMNS.no, COLUMNS.section, COLUMNS.page, COLUMNS.lines, COLUMNS.type, COLUMNS.text, COLUMNS.revision];
  const commentRows: Array<Array<string | number | undefined>> = [
    ...details.map(([k, v]) => [k, v]),
    [],
    header,
    ...Array.from({ length: XLSX_COMMENT_ROWS }, (_, i) => [i + 1]),
  ];
  const ackRow = details.length; // "Acknowledge" is the last detail row
  const validations =
    `<dataValidations count="5">` +
    listRule(`B${ackRow}`, `"Yes,No"`, "Yes: your name may be published in the acknowledgements.") +
    listRule(`B${first}:B${last}`, "Sections", "A section of this release.") +
    listRule(`C${first}:C${last}`, "Pages", "A printed page of this release.") +
    listRule(`E${first}:E${last}`, `"${PUBLIC_COMMENT_TYPES.join(",")}"`, "general, technical or editorial.") +
    `<dataValidation type="textLength" operator="lessThanOrEqual" allowBlank="1" sqref="D${first}:D${last}"><formula1>200</formula1></dataValidation>` +
    `</dataValidations>`;
  const comments = sheetXml(commentRows, {
    widths: [34, 34, 8, 22, 14, 70, 70],
    styles: (i, j) => (i === headerRow - 1 || (i < details.length && j === 0) ? 1 : i >= headerRow && j >= 5 ? 2 : 0),
    validations,
    freezeRow: headerRow,
  });
  const refRows: Array<Array<string | undefined>> = [["Section", "Page", "Table or figure"]];
  const n = Math.max(r.sections.length, r.pages.length, r.captions.length);
  for (let i = 0; i < n; i++) refRows.push([r.sections[i]?.ref, r.pages[i], r.captions[i]]);
  const references = sheetXml(refRows, { widths: [60, 10, 30], styles: (i) => (i === 0 ? 1 : 0), protect: true, freezeRow: 1 });
  const readme = sheetXml([[instructions(r, "Use the Comments tab: one row per comment. Do not add, rename or move columns.")]], {
    widths: [120],
    styles: () => 2,
    protect: true,
  });
  const sheets = ["Instructions", "Comments", "References"];
  const defined = [
    `<definedName name="Sections">References!$A$2:$A$${Math.max(2, r.sections.length + 1)}</definedName>`,
    `<definedName name="Pages">References!$B$2:$B$${Math.max(2, r.pages.length + 1)}</definedName>`,
  ].join("");
  const files: Array<[string, string]> = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="1"/></bookViews><sheets>${sheets
        .map((s, i) => `<sheet name="${s}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets><definedNames>${defined}</definedNames></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ],
    ["xl/worksheets/sheet1.xml", readme],
    ["xl/worksheets/sheet2.xml", comments],
    ["xl/worksheets/sheet3.xml", references],
  ];
  return zip(files.map(([name, body]) => [name, Buffer.from(body, "utf-8")]));
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A deflated ZIP, written with node:zlib only (no new dependency). */
export function zip(files: Array<[string, Buffer]>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, "utf-8");
    const body = deflateRawSync(data);
    const crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6); // UTF-8 names
    h.writeUInt16LE(8, 8); // deflate
    h.writeUInt32LE(0x00210000, 10); // 1980-01-01, so the file is reproducible
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(body.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(nameBuf.length, 26);
    local.push(h, nameBuf, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(0x00210000, 12);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

// ── google-form: an Apps Script that builds the Form ─────────────

export function googleFormScript(r: ReleaseReferences): string {
  const R = {
    id: r.release.id,
    title: `${r.release.title}: public comment`,
    description: instructions(r, "One comment per response. After you submit, use \"Submit another response\" for the next comment."),
    sections: r.sections.map((s) => s.ref),
    pages: r.pages,
    types: [...PUBLIC_COMMENT_TYPES],
    columns: COLUMNS,
    details: DETAILS,
  };
  return `/**
 * Builds the Google Form for ${r.release.id}, generated by
 * folio-assistant-core/scripts/public-comment-channels.ts from the release's
 * fixed references. Skill: public-comment-channels.
 *
 * Paste into the Apps Script editor of the review sheet (Extensions > Apps
 * Script) or of a new standalone script, then run createPublicCommentForm once.
 * Its responses go to a new tab of the sheet the script is bound to, or to a
 * new spreadsheet. Run closePublicCommentForm when the comment period ends.
 * Do not edit the questions by hand: regenerate from the references instead,
 * because the question titles are the column headers the importer reads.
 */
var RELEASE = ${JSON.stringify(R, null, 2)};

function createPublicCommentForm() {
  var form = FormApp.create(RELEASE.title);
  form.setDescription(RELEASE.description);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage("Thank you. Use \\"Submit another response\\" for your next comment.");

  form.addSectionHeaderItem().setTitle("About you");
  form.addTextItem().setTitle(RELEASE.details.name);
  form.addTextItem().setTitle(RELEASE.details.organisation);
  form.addTextItem().setTitle(RELEASE.details.country);
  form.addTextItem().setTitle(RELEASE.details.stakeholder);
  form.addTextItem().setTitle(RELEASE.details.email)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addMultipleChoiceItem().setTitle(RELEASE.details.acknowledge)
    .setChoiceValues(["Yes", "No"]).setRequired(true);

  form.addPageBreakItem().setTitle("Your comment");
  form.addListItem().setTitle(RELEASE.columns.section)
    .setHelpText("A section of this release. Choose the nearest one for a general comment.")
    .setChoiceValues(RELEASE.sections).setRequired(true);
  form.addListItem().setTitle(RELEASE.columns.page)
    .setHelpText("A printed page of this release.").setChoiceValues(RELEASE.pages);
  form.addTextItem().setTitle(RELEASE.columns.lines)
    .setHelpText("Line numbers (for example 618-624), or a table or figure (for example Table 3.1).");
  form.addMultipleChoiceItem().setTitle(RELEASE.columns.type)
    .setChoiceValues(RELEASE.types).setRequired(true);
  form.addParagraphTextItem().setTitle(RELEASE.columns.text).setRequired(true);
  form.addParagraphTextItem().setTitle(RELEASE.columns.revision);

  var ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) ss = SpreadsheetApp.create(RELEASE.title + " (responses)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  PropertiesService.getScriptProperties().setProperty("PC_FORM_ID", form.getId());
  Logger.log("Form to share: " + form.getPublishedUrl());
  Logger.log("Edit the form: " + form.getEditUrl());
  Logger.log("Responses: " + ss.getUrl());
}

function closePublicCommentForm() {
  var id = PropertiesService.getScriptProperties().getProperty("PC_FORM_ID");
  if (!id) throw new Error("No form recorded: run createPublicCommentForm first.");
  var form = FormApp.openById(id);
  form.setAcceptingResponses(false);
  form.setCustomClosedFormMessage("The public comment period for " + RELEASE.id + " has closed.");
  Logger.log("Closed: " + form.getPublishedUrl());
}
`;
}

// ── issue-form: a GitHub issue form for public comments ──────────

const yamlStr = (s: string) => JSON.stringify(s);

export function issueForm(r: ReleaseReferences): string {
  const list = (xs: string[]) => xs.map((x) => `        - ${yamlStr(x)}`).join("\n");
  return `# Generated by folio-assistant-core/scripts/public-comment-channels.ts for ${r.release.id}.
# Regenerate from the release references; do not edit the options by hand.
name: ${yamlStr(`Public comment on ${r.release.title}`)}
description: ${yamlStr(`Comment on ${r.release.id}. Every reference is to the frozen draft of this release.`)}
title: ${yamlStr(`[${r.release.id}] `)}
labels: ["public-comment"]
body:
  - type: markdown
    attributes:
      value: |
${instructions(r, "One comment per issue. This issue is public: do not put an email address in it.")
  .split("\n")
  .map((l) => `        ${l}`)
  .join("\n")}
  - type: dropdown
    id: section
    attributes:
      label: ${COLUMNS.section}
      options:
${list(r.sections.map((s) => s.ref))}
    validations:
      required: true
  - type: dropdown
    id: page
    attributes:
      label: ${COLUMNS.page}
      options:
${list(r.pages)}
  - type: input
    id: lines
    attributes:
      label: ${yamlStr(COLUMNS.lines)}
      placeholder: 618-624, or Table 3.1
  - type: dropdown
    id: type
    attributes:
      label: ${COLUMNS.type}
      options:
${list([...PUBLIC_COMMENT_TYPES])}
    validations:
      required: true
  - type: textarea
    id: comment
    attributes:
      label: ${yamlStr(COLUMNS.text)}
    validations:
      required: true
  - type: textarea
    id: revision
    attributes:
      label: ${COLUMNS.revision}
  - type: input
    id: organisation
    attributes:
      label: ${DETAILS.organisation}
  - type: input
    id: country
    attributes:
      label: ${yamlStr(DETAILS.country)}
  - type: checkboxes
    id: acknowledge
    attributes:
      label: Acknowledgement
      options:
        - label: Name me (my GitHub login) in the acknowledgements
`;
}

// ── issues-csv: GitHub issues back as a form export ──────────────

interface Issue {
  number: number;
  title: string;
  body?: string | null;
  user?: { login?: string } | null;
  html_url?: string;
  created_at?: string;
  pull_request?: unknown;
}

/** The value under each `### Label` of an issue form's body. "_No response_" is empty. */
export function formFields(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = body.replace(/\r\n/g, "\n").split(/^### +/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    const label = (nl < 0 ? p : p.slice(0, nl)).trim();
    const value = (nl < 0 ? "" : p.slice(nl + 1)).trim();
    out.set(label, value === "_No response_" ? "" : value);
  }
  return out;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function issuesCsv(issues: Issue[], releaseId: string): string {
  const header = [COLUMNS.no, "Date received", "Channel", DETAILS.name, DETAILS.organisation, DETAILS.country, DETAILS.acknowledge, COLUMNS.section, COLUMNS.page, COLUMNS.lines, COLUMNS.type, COLUMNS.text, COLUMNS.revision, "Issue"];
  const rows = issues
    .filter((i) => !i.pull_request && i.title.startsWith(`[${releaseId}]`))
    .sort((a, b) => a.number - b.number)
    .map((i) => {
      const f = formFields(i.body ?? "");
      const ack = /- \[x\]/i.test(f.get("Acknowledgement") ?? "") ? "Yes" : "No";
      return [
        String(i.number),
        i.created_at?.slice(0, 10) ?? "",
        "github",
        i.user?.login ?? "",
        f.get(DETAILS.organisation) ?? "",
        f.get(DETAILS.country) ?? "",
        ack,
        f.get(COLUMNS.section) ?? "",
        f.get(COLUMNS.page) ?? "",
        f.get(COLUMNS.lines) ?? "",
        f.get(COLUMNS.type) ?? "",
        f.get(COLUMNS.text) ?? "",
        f.get(COLUMNS.revision) ?? "",
        i.html_url ?? "",
      ];
    });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

// ── check: a returned file against the release ───────────────────

export interface CheckProblem {
  sheet: string;
  row: number;
  problem: string;
}

export function checkRows(sheets: Array<{ name: string; rows: Array<Array<string | number | boolean | null>> }>, r: ReleaseReferences): CheckProblem[] {
  const sectionRefs = new Set(r.sections.map((s) => s.ref));
  const sectionNumbers = new Set(r.sections.map((s) => s.number).filter(Boolean));
  const pages = new Set(r.pages);
  const out: CheckProblem[] = [];
  for (const sh of sheets) {
    let t;
    try {
      t = tableRows(sh.rows);
    } catch {
      continue;
    }
    const release = sh.rows.find((row) => String(row[0] ?? "").trim() === DETAILS.release);
    if (release && !String(release[1] ?? "").includes(r.release.id)) {
      out.push({ sheet: sh.name, row: sh.rows.indexOf(release) + 1, problem: `release is "${release[1]}", not ${r.release.id}` });
    }
    for (const row of t.rows) {
      const s = row.citation.section;
      if (s && !sectionRefs.has(s) && !sectionNumbers.has(parseSection(s) ?? "")) out.push({ sheet: sh.name, row: row.row ?? 0, problem: `section "${s}" is not in ${r.release.id}` });
      const p = row.citation.page;
      if (p && !pages.has(String(p))) out.push({ sheet: sh.name, row: row.row ?? 0, problem: `page "${p}" is not in ${r.release.id}` });
    }
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const [cmd, input, ...rest] = process.argv.slice(2);
  const args = [input, ...rest];
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const need = (n: string) => {
    const v = opt(n);
    if (!v) throw new Error(`--${n} is required`);
    return v;
  };
  const refsFrom = (p: string) => JSON.parse(readFileSync(p, "utf-8")) as ReleaseReferences;
  const write = (out: string, body: string | Buffer) => {
    writeFileSync(out, body);
    console.error(`wrote ${out}`);
  };
  try {
    if (!input) throw new Error("usage: public-comment-channels.ts <refs|xlsx|google-form|issue-form|issues-csv|check> <input> [options]");
    switch (cmd) {
      case "refs": {
        const a = JSON.parse(readFileSync(input, "utf-8")) as ReviewAnchors;
        const r = releaseReferences(a, { id: need("release"), title: need("title"), ...(opt("draft-url") ? { draftUrl: opt("draft-url") } : {}) });
        write(opt("out") ?? "release-references.json", JSON.stringify(r, null, 2) + "\n");
        console.error(`  ${r.sections.length} sections, ${r.pages.length} pages, ${r.captions.length} tables and figures`);
        break;
      }
      case "xlsx":
        write(need("out"), commentWorkbook(refsFrom(input)));
        break;
      case "google-form":
        write(need("out"), googleFormScript(refsFrom(input)));
        break;
      case "issue-form":
        write(need("out"), issueForm(refsFrom(input)));
        break;
      case "issues-csv":
        write(need("out"), issuesCsv(JSON.parse(readFileSync(input, "utf-8")) as Issue[], need("release")));
        break;
      case "check": {
        const problems = checkRows(readRows(input), refsFrom(need("refs")));
        for (const p of problems) console.log(`${basename(input)} ${p.sheet} row ${p.row}: ${p.problem}`);
        console.error(problems.length ? `${problems.length} problem(s)` : "every reference is in the release");
        process.exit(problems.length ? 1 : 0);
      }
      default:
        throw new Error(`unknown command ${cmd}`);
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
}
