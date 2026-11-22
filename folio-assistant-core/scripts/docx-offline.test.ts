/**
 * The offline round trip without a full folio: document-export.lua puts a
 * bookmark on every anchor, docx-offline.py finish sets line numbers and
 * Track Changes reproducibly, and docx-offline.py changes carries an author's
 * tracked changes back onto the block's Markdown, refusing what it cannot
 * place safely (an unknown source commit, a block changed since export).
 *
 * The .docx is made by pandoc from Markdown shaped like the assembly
 * (`<a id="…"></a>` before each block), and the author's edits are written
 * into its XML as Word writes them (`w:ins`, `w:del`, an inserted paragraph
 * mark), so the test needs no Word.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exportNames, LUA_FILTER, DOCX_OFFLINE } from "./document-export.js";

const hasPandoc = spawnSync("sh", ["-c", "command -v pandoc"]).status === 0;
const bookmark = (label: string) => "folio_" + createHash("sha1").update(label).digest("hex").slice(0, 16);

function sh(cmd: string, args: string[], cwd?: string) {
  const r = spawnSync(cmd, args, {
    cwd, stdio: "pipe",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" },
  });
  return { status: r.status, out: r.stdout.toString(), err: r.stderr.toString() };
}

// Writes the author's edits into the .docx, as Word would: a word replaced
// inside a list item, and a new list item (inserted paragraph mark).
const EDIT = String.raw`
import re, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src); files = {n: z.read(n) for n in z.namelist()}
x = files["word/document.xml"].decode()
A = 'w:author="Jane Smith" w:date="2026-11-01T09:00:00Z"'
m = re.search(r'<w:r><w:t(?: [^>]*)?>([^<]*?)data problems([^<]*)</w:t></w:r>', x)
x = (x[:m.start()] + f'<w:r><w:t xml:space="preserve">{m.group(1)}</w:t></w:r>'
     f'<w:del w:id="91" {A}><w:r><w:delText xml:space="preserve">data problems</w:delText></w:r></w:del>'
     f'<w:ins w:id="92" {A}><w:r><w:t xml:space="preserve">data and planning problems</w:t></w:r></w:ins>'
     f'<w:r><w:t xml:space="preserve">{m.group(2)}</w:t></w:r>' + x[m.end():])
m = re.search(r'<w:p>(?:(?!<w:p>).)*?Describe the value(?:(?!</w:p>).)*</w:p>', x)
ppr = re.search(r"<w:pPr>.*?</w:pPr>", m.group(0)).group(0).replace("</w:pPr>", f'<w:rPr><w:ins w:id="93" {A}/></w:rPr></w:pPr>')
x = x[:m.end()] + f'<w:p>{ppr}<w:ins w:id="94" {A}><w:r><w:t>Name the data the registry holds.</w:t></w:r></w:ins></w:p>' + x[m.end():]
files["word/document.xml"] = x.encode()
with zipfile.ZipFile(out, "w") as zo:
    for k, v in files.items(): zo.writestr(k, v)
`;

const BLOCK_MD = [
  "**Chapter objectives.** This chapter will help readers to:",
  "",
  "- Explain the health workforce data problems that a registry solves.",
  "- Describe the value of a registry.",
  "",
].join("\n");

describe.skipIf(!hasPandoc)("offline .docx round trip", () => {
  let dir: string, repo: string, sha: string, offline: string, edited: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "docx-offline-"));
    repo = join(dir, "repo");
    mkdirSync(join(repo, "folio", "doc", "ch01"), { recursive: true });
    writeFileSync(join(repo, "folio", "doc", "ch01", "p-objectives.md"), BLOCK_MD);
    writeFileSync(join(repo, "folio", "doc", "review-anchors.json"), JSON.stringify({
      chapters: [{ label: "chap:ch01" }],
      sections: [{ label: "sec:1-1", chapter: "ch01" }],
      blocks: [{ label: "prose:ch01-objectives", kind: "prose", chapter: "ch01", root: "p-objectives" }],
    }));
    sh("git", ["init", "-q"], repo);
    sh("git", ["add", "."], repo);
    sh("git", ["commit", "-q", "-m", "seed"], repo);
    sha = sh("git", ["rev-parse", "HEAD"], repo).out.trim();

    // The assembly's shape: anchors alone before a heading, and before a block.
    const assembled = [
      "# Doc", "", '<a id="chap:ch01"></a>', "## Chapter 1", "", '<a id="sec:1-1"></a>', "### 1.1 Objectives", "",
      '<a id="prose:ch01-objectives"></a>', BLOCK_MD,
    ].join("\n");
    writeFileSync(join(dir, "doc.md"), assembled);
    writeFileSync(join(dir, "meta.json"), JSON.stringify({ "folio-source-commit": sha, "folio-document": "doc" }));
    const raw = join(dir, "raw.docx");
    const p = sh("pandoc", [join(dir, "doc.md"), "-o", raw, "--from", "gfm-gfm_auto_identifiers+raw_html",
      "--shift-heading-level-by=-1", "--lua-filter", LUA_FILTER, "--metadata-file", join(dir, "meta.json")]);
    expect(p.err).toBe("");
    offline = join(dir, "offline.docx");
    expect(sh("python3", ["-I", DOCX_OFFLINE, "finish", raw, "--out", offline, "--line-numbers", "--track-changes", "--epoch", "1793000000"]).status).toBe(0);
    edited = join(dir, "edited.docx");
    expect(sh("python3", ["-I", "-c", EDIT, offline, edited]).status).toBe(0);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const xml = (docx: string, part: string) => sh("unzip", ["-p", docx, part]).out;

  test("anchorsAreBookmarks", () => {
    const doc = xml(offline, "word/document.xml");
    for (const label of ["chap:ch01", "sec:1-1", "prose:ch01-objectives"]) {
      expect(doc).toContain(`w:name="${bookmark(label)}"`);
    }
    // the chapter anchor moved into its heading rather than standing alone
    const firstHeading = /<w:p>(?:(?!<\/w:p>).)*Chapter 1/.exec(doc)![0];
    expect(firstHeading).toContain(bookmark("chap:ch01"));
    // and the block's first paragraph starts with its text, not a stray space
    expect(doc).not.toMatch(/<w:t xml:space="preserve"> Chapter objectives/);
  });

  test("finishLineNumbersTrackChangesSameBytes", () => {
    expect(xml(offline, "word/document.xml")).toMatch(/<w:lnNumType [^>]*w:restart="continuous"/);
    expect(xml(offline, "word/settings.xml")).toContain("<w:trackRevisions");
    const again = join(dir, "again.docx");
    sh("python3", ["-I", DOCX_OFFLINE, "finish", join(dir, "raw.docx"), "--out", again, "--line-numbers", "--track-changes", "--epoch", "1793000000"]);
    const h = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");
    expect(h(again)).toBe(h(offline));
    expect(xml(offline, "docProps/custom.xml")).toContain(sha);
  });

  test("changesApplyCarriesTrackedChange", () => {
    const out = join(dir, "changes.json");
    const r = sh("python3", ["-I", DOCX_OFFLINE, "changes", edited, "--repo", repo, "--apply", "--out", out]);
    expect(r.status).toBe(0);
    const report = JSON.parse(readFileSync(out, "utf-8"));
    expect(report.source.commit).toBe(sha);
    expect(report.blocks).toHaveLength(1);
    const [b] = report.blocks;
    expect(b.label).toBe("prose:ch01-objectives");
    expect(b.status).toBe("applied");
    expect(b.authors).toEqual(["Jane Smith"]);
    expect(readFileSync(join(repo, "folio", "doc", "ch01", "p-objectives.md"), "utf-8")).toBe([
      "**Chapter objectives.** This chapter will help readers to:",
      "",
      "- Explain the health workforce data and planning problems that a registry solves.",
      "- Describe the value of a registry.",
      "- Name the data the registry holds.",
      "",
    ].join("\n"));
    sh("git", ["checkout", "-q", "."], repo);
  });

  test("changedBlockIsConflict", () => {
    const md = join(repo, "folio", "doc", "ch01", "p-objectives.md");
    writeFileSync(md, BLOCK_MD + "- Added on main.\n");
    const out = join(dir, "conflict.json");
    sh("python3", ["-I", DOCX_OFFLINE, "changes", edited, "--repo", repo, "--apply", "--out", out]);
    expect(JSON.parse(readFileSync(out, "utf-8")).blocks[0].status).toBe("conflict");
    expect(readFileSync(md, "utf-8")).toBe(BLOCK_MD + "- Added on main.\n");
    sh("git", ["checkout", "-q", "."], repo);
  });

  test("unknownCommitRefused", () => {
    const other = join(dir, "other");
    mkdirSync(other);
    sh("git", ["init", "-q"], other);
    const r = sh("python3", ["-I", DOCX_OFFLINE, "changes", edited, "--repo", other]);
    expect(r.status).toBe(2);
    expect(r.err).toContain("cannot be merged safely");
  });
});

test("exportNamesCommitAndDate", () => {
  expect(exportNames("dth-hrh", "6748b4bb3e818b8f", "2026-11-02")).toEqual({
    pdf: "dth-hrh-public-comment-6748b4b-2026-11-02.pdf",
    reviewDocx: "dth-hrh-public-comment-6748b4b-2026-11-02.docx",
    offlineDocx: "dth-hrh-offline-6748b4b.docx",
    manifest: "dth-hrh-export-6748b4b.json",
  });
  expect(exportNames("d", "6748b4bb3e818b8f-dirty", "2026-11-02").offlineDocx).toBe("d-offline-6748b4b-dirty.docx");
});
