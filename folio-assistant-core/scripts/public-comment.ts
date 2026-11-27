#!/usr/bin/env bun
/**
 * public-comment — intake and adjudication of public-review comments on a
 * document folio. Bean `v26p`, issue #197. Schema and lifecycle:
 * `folio-assistant-core/schemas/public-comment.ts`. Process:
 * `folio-assistant-core/collab/processes/content/public-comment.bpmn`. Skill:
 * `public-comment`.
 *
 * ## The store
 *
 * One JSON file per comment, `<store>/comments/PC-0042.json`, so two editors
 * deciding two comments never conflict, plus `<store>/batches/<batch>.json`,
 * one per intake file, recording what it held and what became of each row.
 * `<store>/config.json` names the document, the editors and the committee.
 * The default store is `review/public-comment/` in the folio repository.
 *
 * ## The operations (each a task in public-comment.bpmn)
 *
 *   import <file.xlsx|.csv> [--channel comment-matrix|online-form] [--batch id] [--series id]
 *   import-narrative <file.md|.txt> --reviewer "Name" [--org ..] [--country ..] [--acknowledge]
 *   list [--status open|<status>] [--page N] [--line L] [--block <label>] [--section 3.4] [--unplaced] [--json]
 *   triage <ref> [--type technical] [--priority high] [--to <label>]
 *   reassign <ref> --to <label>
 *   assign <ref> --to <login>[,<login>]
 *   recommend <ref> --code <decision> --by <login> [--rationale ..] [--url ..]
 *   decide <ref> --code <decision> --by <login> [--reason ..] [--branch ..] [--pr N]
 *   edit <ref> --branch <b> [--pr N] [--to <author login>] --by <login>   the author's step, human or agentic
 *   incorporate <ref> [--branch <b>] [--pr N] [--staging <url>] --by <login>
 *   reopen <ref> --by <login> --note "why"   take a decision back (from decided, editing or incorporated)
 *   duplicate <ref> --of <ref> --by <login>
 *   withdraw <ref> --by <login>
 *   github --event <event.json> [--dry-run]
 *                                   an issue, issue comment or PR event: tags, change-set
 *                                   issues and commands, and the PR that closes them. Handled
 *                                   by `public-comment-changesets.ts`, which owns change-sets.
 *   summary [--json]                counts by status, decision, type and section
 *
 * Every command accepts `--repo <folio root>` and `--store <dir>`.
 *
 * ## The GitHub tag a committee member or editor writes
 *
 *     pc: PC-0042, PC-0043
 *     recommend: accepted-modified
 *
 *     The rationale, in as many lines as needed.
 *
 * `decide:` instead of `recommend:` records the editor's decision; a
 * `recommend:` is honoured from an editor or a committee member. Both roles
 * are DYNAMIC by default, read from the repository itself (owner, 2026-10-05:
 * *"committee list = dynamic list of collaborators in github repo. editor =
 * owner"*). GitHub stamps every comment event with the commenter's
 * `author_association`, so this needs no API call and no token:
 *
 * - **editor** = the repository's OWNER;
 * - **committee** = its collaborators: OWNER, MEMBER or COLLABORATOR.
 *
 * Adding someone as a collaborator on GitHub is the whole committee
 * on-boarding. An `editors` or `committee` list in `config.json` replaces that
 * role's default with exactly those logins. Anyone else's tag is reported and
 * left alone: a public comment thread is open to everyone, and the record is
 * not.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import { directoryForGraph, folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

import type { AnchorBlock, ReviewAnchors } from "./docx-to-folio.js";
import {
  IN_EDIT_STATUSES,
  type Anchor,
  type Citation,
  DECISION_CODES,
  type DecisionCode,
  formatRef,
  INTAKE_CHANNELS,
  OPEN_STATUSES,
  parseCaptionRef,
  parseLines,
  parseSection,
  PUBLIC_COMMENT_SCHEMA,
  PUBLIC_COMMENT_TRANSITIONS,
  PUBLIC_COMMENT_TYPES,
  type PublicComment,
  PublicCommentSchema,
  type PublicCommentType,
  reviewerId,
  transition,
} from "../schemas/public-comment.js";

type Cell = string | number | boolean | null;

// ── Store ────────────────────────────────────────────────────────

export interface StoreConfig {
  /** Document slug under folio/. */
  document: string;
  /**
   * GitHub logins whose `decide:` tags are honoured. Absent (the default): the
   * repository's owner, read from the comment event's `author_association`.
   * Present: exactly these logins.
   */
  editors?: string[];
  /**
   * GitHub logins whose `recommend:` tags are honoured. Absent (the default):
   * the repository's collaborators, read from the comment event's
   * `author_association`. Present: exactly these logins.
   */
  committee?: string[];
  /** Base URL of the published site, for deep links (main and branches/<slug>/). */
  site?: string;
  /** "owner/name" on GitHub: where change-set issues are opened. */
  repo?: string;
}

/**
 * The folio's public-comment store: the directory its declaration gives graph
 * typology `public-comments`.
 */
export function storeDirOf(repo: string): string {
  return (
    directoryForGraph(repo, "public-comments") ??
    // declared-path-literal: the convention fallback for a folio that declares
    // no `public-comments` directory. `import` creates the store on a first
    // intake, so resolving to nothing would make the first intake impossible.
    resolve(repo, "review/public-comment")
  );
}

export class Store {
  constructor(
    readonly repo: string,
    readonly dir: string,
  ) {}
  static open(repo: string, dir?: string) {
    return new Store(repo, dir === undefined ? storeDirOf(repo) : resolve(repo, dir));
  }
  config(): StoreConfig {
    const p = join(this.dir, "config.json");
    if (!existsSync(p)) throw new Error(`no ${p}: create it with {"document"}; "editors" and "committee" only to override the owner and collaborators defaults`);
    return JSON.parse(readFileSync(p, "utf-8"));
  }
  anchors(): ReviewAnchors {
    const p = join(folioDir(this.repo), this.config().document, "review-anchors.json");
    if (!existsSync(p)) throw new Error(`no ${p}: run docx-to-folio.ts first`);
    return JSON.parse(readFileSync(p, "utf-8"));
  }
  /** Block text, for quote matching. Read lazily: most imports cite lines. */
  blockText(a: AnchorBlock): string {
    const p = join(folioDir(this.repo), this.config().document, a.chapter, `${a.root}.md`);
    return existsSync(p) ? readFileSync(p, "utf-8") : a.excerpt;
  }
  all(): PublicComment[] {
    const d = join(this.dir, "comments");
    if (!existsSync(d)) return [];
    return readdirSync(d)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => PublicCommentSchema.parse(JSON.parse(readFileSync(join(d, f), "utf-8"))));
  }
  get(ref: string): PublicComment {
    const r = normRef(ref);
    const p = join(this.dir, "comments", `${r}.json`);
    if (!existsSync(p)) throw new Error(`no comment ${r}`);
    return PublicCommentSchema.parse(JSON.parse(readFileSync(p, "utf-8")));
  }
  save(c: PublicComment) {
    mkdirSync(join(this.dir, "comments"), { recursive: true });
    writeFileSync(join(this.dir, "comments", `${c.public.ref}.json`), JSON.stringify(c, null, 2) + "\n");
  }
  saveBatch(id: string, data: unknown) {
    mkdirSync(join(this.dir, "batches"), { recursive: true });
    writeFileSync(join(this.dir, "batches", `${id}.json`), JSON.stringify(data, null, 2) + "\n");
  }
  batches(): Array<{ id: string; sha256?: string }> {
    const d = join(this.dir, "batches");
    if (!existsSync(d)) return [];
    return readdirSync(d).map((f) => JSON.parse(readFileSync(join(d, f), "utf-8")));
  }
}

const normRef = (r: string) => {
  const n = /(\d+)/.exec(r)?.[1];
  if (!n) throw new Error(`"${r}" is not a comment reference (PC-0042)`);
  return formatRef(Number(n));
};

// ── Anchor resolution ────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Does the block cover line `l` of PDF page `p`? */
function covers(b: AnchorBlock, p: number, a: number, z: number): number {
  const last = b.pageEnd ?? b.page;
  if (p < b.page || p > last || b.lineStart === undefined) return 0;
  const lo = p === b.page ? b.lineStart : 1;
  const hi = p === last ? (b.lineEnd ?? b.lineStart) : 100_000;
  const o = Math.min(hi, z) - Math.max(lo, a) + 1;
  return o > 0 ? o : 0;
}

/**
 * Resolve where a comment points. In order of how much the reviewer said:
 * a table or figure number; page and lines; a quotation; a section; nothing.
 * The page is tried as the PRINTED page first (what a reader of the PDF
 * sees), then as the PDF's own page index, and a cited section breaks ties.
 */
export function resolveAnchor(c: Citation, text: string, anchors: ReviewAnchors, blockText?: (b: AnchorBlock) => string): Anchor {
  const secLabels = (num: string) => {
    const hits = anchors.sections.filter((s) => s.number === num || s.number?.startsWith(`${num}.`));
    return new Set(hits.map((s) => s.label));
  };
  const inSection = (b: AnchorBlock, labels: Set<string>) => b.sections.some((l) => labels.has(l));
  const section = c.section ? parseSection(c.section) : undefined;
  // A section NAMED rather than numbered: the appendix's components carry no
  // number, and reviewers cite them by title or acronym ("Health Workforce
  // Registry, 6", "PHSP, 5"). Both feed the same tie-break as a number.
  const named = c.section ? sectionsNamed(c.section, anchors) : [];
  const numbered = section ? secLabels(section) : new Set<string>();
  const secSet = numbered.size || named.length ? new Set([...numbered, ...named.map((x) => x.label)]) : undefined;

  const cap = c.caption ?? parseCaptionRef(c.lines) ?? parseCaptionRef(text);
  if (cap) {
    const hit = anchors.blocks.filter((b) => b.caption === cap);
    if (hit.length === 1) return { targetLabel: hit[0].label, method: "caption", confidence: "high", candidates: [], note: `${cap} as cited` };
  }

  const ranges = lineRanges(c.lines);
  const pageNum = c.page ? Number(/\d+/.exec(c.page)?.[0]) : NaN;
  if (ranges.length && Number.isFinite(pageNum)) {
    const pdfPages = new Set<number>();
    // Printed page → PDF page(s). Printed numbering restarts in front matter,
    // so one printed number can be several PDF pages; the section decides.
    for (const b of anchors.blocks) if (b.printedPage === String(pageNum)) pdfPages.add(b.page);
    const tries: Array<[string, number[]]> = [
      ["printed page", [...pdfPages]],
      ["PDF page", [pageNum]],
    ];
    for (const [how, pages] of tries) {
      const scored = anchors.blocks
        .map((b) => ({ b, s: pages.reduce((acc, p) => acc + ranges.reduce((x, [a, z]) => x + covers(b, p, a, z), 0), 0) }))
        .filter((x) => x.s > 0);
      if (!scored.length) continue;
      const preferred = secSet?.size ? scored.filter((x) => inSection(x.b, secSet)) : scored;
      const pool = (preferred.length ? preferred : scored).sort((x, y) => y.s - x.s);
      const agrees = !secSet?.size || preferred.length > 0;
      return {
        targetLabel: pool[0].b.label,
        method: "page-line",
        confidence: agrees && pages.length === 1 ? "high" : agrees ? "medium" : "low",
        candidates: pool.slice(1, 4).map((x) => x.b.label),
        note: `p.${c.page} l.${c.lines} read as the ${how}${section ? `; section ${section} ${agrees ? "agrees" : "does NOT agree"}` : ""}`,
      };
    }
  }

  // A quotation of at least a few words, in curly or straight quotes.
  const quotes = [...text.matchAll(/[“"‘']([^”"’']{24,})[”"’']/g)].map((m) => norm(m[1]));
  if (quotes.length && blockText) {
    const pool = secSet?.size ? anchors.blocks.filter((b) => inSection(b, secSet)) : anchors.blocks;
    for (const q of quotes) {
      const hits = pool.filter((b) => norm(blockText(b)).includes(q));
      if (hits.length) {
        return { targetLabel: hits[0].label, method: "quote", confidence: hits.length === 1 ? "medium" : "low", candidates: hits.slice(1, 4).map((b) => b.label), note: "quotation found in the text" };
      }
    }
  }

  // A page and no usable line: the page's first block, preferring one in the
  // cited section. Coarser than a line, and the confidence says so.
  if (Number.isFinite(pageNum)) {
    const onPage = (pages: number[]) => anchors.blocks.filter((b) => pages.some((p) => p >= b.page && p <= (b.pageEnd ?? b.page)));
    const printed = anchors.blocks.filter((b) => b.printedPage === String(pageNum)).map((b) => b.page);
    for (const [how, pages] of [["printed page", [...new Set(printed)]], ["PDF page", [pageNum]]] as Array<[string, number[]]>) {
      const hits = onPage(pages);
      if (!hits.length) continue;
      const inSec = secSet?.size ? hits.filter((b) => inSection(b, secSet)) : [];
      if (secSet?.size && !inSec.length) continue;
      const pool = inSec.length ? inSec : hits;
      return {
        targetLabel: pool[0].label,
        method: "page",
        confidence: inSec.length ? "medium" : "low",
        candidates: pool.slice(1, 4).map((b) => b.label),
        note: `p.${c.page} read as the ${how}, no line resolved${inSec.length ? `; in the cited section` : ""}`,
      };
    }
  }

  if (section) {
    const s = anchors.sections.find((x) => x.number === section);
    if (s) return { targetLabel: s.label, method: "section", confidence: "medium", candidates: [], note: `section ${section} only` };
  }
  // "Chapter 2": the chapter itself, when nothing finer resolved.
  const chap = /\bch(?:apter|\.)?\s*(\d+)\b/i.exec(c.section ?? "")?.[1];
  const ch = chap ? anchors.chapters.find((x) => x.number === Number(chap)) : undefined;
  if (ch && !named.length) return { targetLabel: ch.label, method: "section", confidence: "low", candidates: [], note: `chapter ${chap} only` };
  if (named.length) {
    return {
      targetLabel: named[0].label,
      method: "section",
      confidence: named.length === 1 ? "medium" : "low",
      candidates: named.slice(1, 4).map((x) => x.label),
      note: `section named "${named[0].title}"`,
    };
  }
  return { targetLabel: null, method: "unplaced", confidence: "low", candidates: [], note: "nothing in the citation resolved; triage places it" };
}

/**
 * The line numbers a "lines" cell actually gives. A cell that starts with a
 * number ("618–624", "L339; L369") is read whole; otherwise only numbers
 * marked as lines ("Principle IX L392–427") count. "Requirement 5",
 * "Governance item 2" and "A14.01" name a row or an item, not line 5, 2 or 14.
 */
export function lineRanges(cell: string | undefined): Array<[number, number]> {
  if (!cell) return [];
  if (/^\s*(?:l{1,2}\.?|lines?\s*(?:no\.?)?)?\s*\d/i.test(cell)) return parseLines(cell);
  const marked = [...cell.matchAll(/\b(?:L|lines?\s*|ll?\.\s*)(\d+(?:\s*[-–]\s*\d+)?)/gi)].map((m) => m[1]);
  return marked.length ? parseLines(marked.join(", ")) : [];
}

/** "Public Health Surveillance Platform" → "PHSP". */
const acronymOf = (title: string) =>
  title
    .split(/[^A-Za-z]+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .filter((w) => !/^(and|of|the|for)$/i.test(w))
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Sections a citation names by TITLE or acronym, best first. The cited text
 * is split at its separators, so "Ch. 4, §4.3.1 (Data models first; FHIR)"
 * tries each part. A part names a section when it equals the title, or is
 * the title's acronym, or is a phrase of at least two words the title
 * contains.
 */
export function sectionsNamed(cited: string, anchors: ReviewAnchors): Array<{ label: string; title: string }> {
  const parts = cited
    .split(/[,;/()]|\s[–-]\s/)
    .map((p) => p.replace(/§/g, "").trim())
    .filter((p) => p && !/^\d+(\.\d+)*$/.test(p));
  const out: Array<{ label: string; title: string; score: number }> = [];
  for (const sec of anchors.sections) {
    const t = norm(sec.title);
    if (!t) continue;
    let score = 0;
    for (const p of parts) {
      const q = norm(p);
      if (!q) continue;
      if (q === t) score = Math.max(score, 3);
      else if (p.trim() === acronymOf(sec.title) && p.trim().length >= 3) score = Math.max(score, 2);
      else if (q.split(" ").length >= 2 && (` ${t} `.includes(` ${q} `) || ` ${q} `.includes(` ${t} `))) score = Math.max(score, 1);
    }
    if (score) out.push({ label: sec.label, title: sec.title, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ── Intake ───────────────────────────────────────────────────────

const str = (v: Cell | undefined) => (v === null || v === undefined ? "" : String(v)).replace(/ /g, " ").trim();

export interface ReviewerInput {
  name?: string;
  organisation?: string;
  country?: string;
  email?: string;
  acknowledge?: boolean;
}
export interface IntakeRow {
  row?: number;
  segment?: number;
  /** The log's own row number ("No."). */
  entry?: string;
  reviewer: ReviewerInput;
  citation: Citation;
  type?: string;
  text: string;
  suggestedRevision?: string;
  /** How the comment reached the log, as the log's own "Channel" column says. */
  channel?: string;
  /** The log's own status and its disposition, where the log already decided. */
  status?: string;
  disposition?: string;
  /** Every other non-empty column, by its header. */
  labels?: Record<string, string>;
}

/** The header cells that identify each column, by the words in them. */
const HEADERS: Array<[keyof IntakeRow | "section" | "page" | "lines" | "name" | "organisation" | "country" | "email" | "acknowledge", RegExp]> = [
  ["entry", /^\s*no\.?\s*$/i],
  ["section", /section/i],
  ["page", /^\s*page/i],
  ["lines", /line|table|figure/i],
  // "Comment type", never "Stakeholder type": the consolidated master log
  // carries both, stakeholder first, and a bare /type/ took the wrong one.
  ["type", /^\s*(comment\s+)?type\b/i],
  ["channel", /^\s*channel/i],
  ["status", /^\s*status\b/i],
  ["disposition", /disposition|rationale/i],
  ["suggestedRevision", /suggest|revision|proposed/i],
  ["text", /comment|issue|feedback/i],
  // A per-row consent column, as the public-comment channels write it
  // ("Acknowledge by name"). Before name: "Name me ..." would read as a name.
  ["acknowledge", /acknowledg|consent/i],
  ["name", /^\s*(reviewer\s*)?name/i],
  ["organisation", /organi[sz]ation|affiliation/i],
  ["country", /country|region/i],
  ["email", /e-?mail/i],
];

/**
 * Rows of a comment table: the WHO comment matrix (reviewer details in
 * label/value rows above a "No. | Section no. | Page | …" header), or a form
 * export (one header row, reviewer columns on every row). The header is the
 * first row naming both a comment column and a section or page column.
 */
/**
 * Consent to be acknowledged, by reviewer NAME, from a log's contributors
 * sheet ("Name | … | Consent to acknowledge"). Only those two columns are
 * read: the sheet also holds emails, and nothing here reads them.
 */
export function consentByName(rows: Cell[][]): Map<string, boolean> | undefined {
  const h = rows.findIndex((r) => r.some((c) => /consent/i.test(str(c))) && r.some((c) => /^\s*name\s*$/i.test(str(c))));
  if (h < 0) return undefined;
  const ni = rows[h].findIndex((c) => /^\s*name\s*$/i.test(str(c)));
  const ci = rows[h].findIndex((c) => /consent/i.test(str(c)));
  const out = new Map<string, boolean>();
  for (const r of rows.slice(h + 1)) {
    const name = str(r[ni]);
    const v = str(r[ci]);
    if (name && v) out.set(nameKey(name), /^y/i.test(v));
  }
  return out;
}

/** "NAIR, Tapas" and "Tapas Nair" are one person: the words, case and order aside. */
export const nameKey = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).sort().join(" ");

/** Columns that are bookkeeping, not a categorisation of the comment. */
const NOT_A_LABEL = /^\s*(date|handled by|transferred|timestamp)/i;

export function tableRows(rows: Cell[][], consent?: Map<string, boolean>): { rows: IntakeRow[]; skipped: Array<{ row: number; why: string }> } {
  const h = rows.findIndex((r) => r.some((c) => /comment|issue|feedback/i.test(str(c))) && r.some((c) => /section|page/i.test(str(c))));
  if (h < 0) throw new Error("no header row naming a comment column and a section or page column");
  const col: Partial<Record<string, number>> = {};
  rows[h].forEach((c, i) => {
    const t = str(c);
    // A cell names ONE column, the first pattern it matches, and each
    // column is taken by its first cell ("Line no(s), Table or Figure" is
    // lines; "Comment type" is type, not text).
    const hit = HEADERS.find(([k, re]) => re.test(t) && col[k] === undefined);
    if (hit) col[hit[0]] = i;
  });
  if (col.text === undefined) throw new Error("the header names no comment column");
  const mapped = new Set(Object.values(col));
  const labelCols = rows[h]
    .map((c, i) => ({ i, name: str(c) }))
    .filter((x) => x.name && !mapped.has(x.i) && !NOT_A_LABEL.test(x.name) && !/e-?mail/i.test(x.name));

  // Matrix-style reviewer details: "Label | value" rows above the header.
  const sheetReviewer: ReviewerInput = {};
  for (const r of rows.slice(0, h)) {
    const label = str(r[0]);
    const value = r.slice(1).map(str).find((v) => v) ?? "";
    if (!value) continue;
    if (/acknowledg/i.test(label)) sheetReviewer.acknowledge = /^y/i.test(value);
    else if (/e-?mail/i.test(label)) sheetReviewer.email = value;
    else if (/organi[sz]ation|affiliation/i.test(label)) sheetReviewer.organisation = value;
    else if (/country|region/i.test(label)) sheetReviewer.country = value;
    else if (/name/i.test(label)) sheetReviewer.name = value;
  }

  const out: IntakeRow[] = [];
  const skipped: Array<{ row: number; why: string }> = [];
  rows.slice(h + 1).forEach((r, k) => {
    const rowNo = h + 2 + k;
    const get = (key: string) => (col[key] === undefined ? "" : str(r[col[key]!]));
    const text = get("text");
    if (!text) return; // an empty template row
    if (/^e\.?g\.?$/i.test(str(r[0]))) {
      skipped.push({ row: rowNo, why: "the template's example row" });
      return;
    }
    const reviewer: ReviewerInput = { ...sheetReviewer };
    for (const k2 of ["name", "organisation", "country", "email"] as const) if (get(k2)) reviewer[k2] = get(k2);
    if (get("acknowledge")) reviewer.acknowledge = /^(y|true|x|\[x\])/i.test(get("acknowledge"));
    if (reviewer.acknowledge === undefined && reviewer.name && consent?.has(nameKey(reviewer.name))) {
      reviewer.acknowledge = consent.get(nameKey(reviewer.name));
    }
    const labels: Record<string, string> = {};
    for (const l of labelCols) if (str(r[l.i])) labels[l.name] = str(r[l.i]);
    // A type outside the three is still the log's categorisation: kept verbatim.
    if (get("type") && !typeOf(get("type")) && col.type !== undefined) labels[str(rows[h][col.type])] = get("type");
    out.push({
      row: rowNo,
      ...(get("entry") ? { entry: get("entry") } : {}),
      reviewer,
      ...(get("channel") ? { channel: get("channel") } : {}),
      ...(get("status") ? { status: get("status") } : {}),
      ...(get("disposition") ? { disposition: get("disposition") } : {}),
      ...(Object.keys(labels).length ? { labels } : {}),
      citation: {
        ...(get("section") ? { section: get("section") } : {}),
        ...(get("page") ? { page: get("page") } : {}),
        ...(get("lines") ? { lines: get("lines") } : {}),
        ...(parseCaptionRef(get("lines")) ? { caption: parseCaptionRef(get("lines")) } : {}),
        raw: [get("section") && `§${get("section")}`, get("page") && `p.${get("page")}`, get("lines") && `l.${get("lines")}`].filter(Boolean).join(" "),
      },
      type: get("type"),
      text,
      ...(get("suggestedRevision") ? { suggestedRevision: get("suggestedRevision") } : {}),
    });
  });
  return { rows: out, skipped };
}

/**
 * A narrative letter or email, split into passages. Each passage that cites
 * something (a section, a page and line, a table, a quotation) becomes its
 * own comment; passages that cite nothing are kept together as one general
 * comment, unplaced, for triage, rather than invented anchors.
 */
export function narrativeRows(text: string, reviewer: ReviewerInput): IntakeRow[] {
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const cited: IntakeRow[] = [];
  const general: string[] = [];
  paras.forEach((p, i) => {
    const sec = /(?:§|section|sect\.|chapter|appendix)\s*((?:[A-Z]\.)?\d+(?:\.\d+)*|[A-Z])\b/i.exec(p)?.[1];
    const page = /\b(?:page|p\.)\s*(\d+)/i.exec(p)?.[1];
    const lines = /\b(?:lines?|ll?\.)\s*(\d+(?:\s*[-–]\s*\d+)?)/i.exec(p)?.[1];
    const cap = parseCaptionRef(p);
    const quoted = /[“"][^”"]{24,}[”"]/.test(p);
    if (sec || (page && lines) || cap || quoted) {
      cited.push({
        segment: i,
        reviewer,
        citation: { ...(sec ? { section: sec } : {}), ...(page ? { page } : {}), ...(lines ? { lines } : {}), ...(cap ? { caption: cap } : {}), raw: p.slice(0, 120) },
        text: p,
      });
    } else general.push(p);
  });
  if (general.length) cited.unshift({ segment: 0, reviewer, citation: { raw: "(no citation)" }, type: "general", text: general.join("\n\n") });
  return cited;
}

const typeOf = (t: string | undefined): PublicCommentType | undefined => {
  const v = (t ?? "").toLowerCase();
  return (PUBLIC_COMMENT_TYPES as readonly string[]).find((x) => v.startsWith(x)) as PublicCommentType | undefined;
};

export interface ImportResult {
  batch: string;
  created: string[];
  unplaced: string[];
  skipped: Array<{ row: number; why: string }>;
  alreadyImported?: boolean;
  /** Rows a previous copy of the same log already brought in (series, sheet and "No." match). */
  known?: number;
  /** Comments the log had already decided or reviewed, carried as decisions or triage. */
  /**
   * What the log's own status column said. NEVER a decision (owner,
   * 2026-10-07: "nothing has been decided"): `recorded` are the rows whose
   * log status reads like a disposition, kept as a note on a triaged
   * comment for the committee and the editor to see.
   */
  fromLog?: { recorded: string[]; triaged: string[] };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/**
 * An address a reviewer typed INTO a comment ("contact dsw@…") is removed
 * too. The rule is that no email is written to the store, and the reviewer
 * column is only one of the places an email turns up.
 */
function scrubRow(r: IntakeRow): IntakeRow {
  const x = (s: string | undefined) => s?.replace(EMAIL, "[email removed]");
  return {
    ...r,
    text: x(r.text)!,
    ...(r.suggestedRevision ? { suggestedRevision: x(r.suggestedRevision) } : {}),
    ...(r.disposition ? { disposition: x(r.disposition) } : {}),
    ...(r.labels ? { labels: Object.fromEntries(Object.entries(r.labels).map(([k, v]) => [k, x(v)!])) } : {}),
    citation: { ...r.citation, ...(r.citation.raw ? { raw: x(r.citation.raw) } : {}) },
  };
}

/** The log's own "Channel" column, as one of the intake channels. */
export function channelOf(v: string | undefined, fallback: IntakeChannel): IntakeChannel {
  const t = (v ?? "").toLowerCase();
  if (!t) return fallback;
  if (/matrix/.test(t)) return "comment-matrix";
  if (/form/.test(t)) return "online-form";
  if (/github/.test(t)) return "github";
  // A Word document, a PDF, an email, a spreadsheet with no matrix: a narrative.
  return "narrative";
}
type IntakeChannel = (typeof INTAKE_CHANNELS)[number];

/**
 * A review log's own status, as the lifecycle's move. The five decision codes
 * map one-to-one ("Partially accepted" is accepted-modified); "Reviewed" is
 * triage; "Pending" and anything unrecognised leave the comment received.
 */
export function logStatusMove(status: string | undefined): { decide: DecisionCode } | { triage: true } | undefined {
  const t = (status ?? "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (!t || t === "pending") return undefined;
  if (/^partial/.test(t) || /modif/.test(t)) return { decide: "accepted-modified" };
  if (/^not accepted|^rejected/.test(t)) return { decide: "not-accepted" };
  if (/^accepted/.test(t)) return { decide: "accepted" };
  if (/^noted/.test(t)) return { decide: "noted" };
  if (/^deferred/.test(t)) return { decide: "deferred" };
  if (/^reviewed|^triaged/.test(t)) return { triage: true };
  return undefined;
}

export function importRows(
  store: Store,
  rows: IntakeRow[],
  src: {
    channel: "comment-matrix" | "online-form" | "narrative";
    batch: string;
    sha256: string;
    skipped?: Array<{ row: number; why: string }>;
    /** The sheet, for a workbook with several comment sheets. */
    sheet?: string;
    /**
     * The log this file is a copy of. Rows whose (series, sheet, "No.") a
     * comment already carries are skipped, so a re-sent log adds only what is
     * new rather than duplicating every row.
     */
    series?: string;
  },
  at = new Date().toISOString(),
): ImportResult {
  if (store.batches().some((b) => b.sha256 === src.sha256 && (b as { sheet?: string }).sheet === src.sheet)) {
    return { batch: src.batch, created: [], unplaced: [], skipped: [], alreadyImported: true };
  }
  const anchors = store.anchors();
  const existing = store.all();
  const seriesKey = (sheet: string | undefined, entry: string) => `${src.series}\u0000${sheet ?? ""}\u0000${entry}`;
  const known = new Set(
    src.series
      ? existing
          .filter((c) => c.public.source.entry && c.public.source.series === src.series)
          .map((c) => seriesKey(c.public.source.sheet, c.public.source.entry!))
      : [],
  );
  let skippedKnown = 0;
  const fromLog = { recorded: [] as string[], triaged: [] as string[] };
  let next = existing.reduce((m, c) => Math.max(m, Number(c.public.ref.slice(3))), 0) + 1;
  const created: string[] = [];
  const unplaced: string[] = [];
  const ingest = PUBLIC_COMMENT_TRANSITIONS.find((t) => t.name === "ingest")!.by;
  for (const raw of rows) {
    const r = scrubRow(raw);
    if (src.series && r.entry && known.has(seriesKey(src.sheet, r.entry))) {
      skippedKnown++;
      continue;
    }
    const ref = formatRef(next++);
    const anchor = resolveAnchor(r.citation, r.text, anchors, (b) => store.blockText(b));
    const ack = r.reviewer.acknowledge === true;
    const who = r.reviewer.email || r.reviewer.name || `${src.batch}#${r.row ?? r.segment ?? 0}`;
    const type = typeOf(r.type);
    const first = r.text.split("\n")[0];
    const c = PublicCommentSchema.parse({
      $schema: PUBLIC_COMMENT_SCHEMA,
      id: ref.toLowerCase(),
      summary: first.length > 120 ? `${first.slice(0, 119)}…` : first,
      comment: r.text,
      createdAt: at,
      targetLabel: anchor.targetLabel,
      status: "received",
      priority: type === "technical" ? "high" : "medium",
      origin: "human",
      tags: {
        roles: ["feedback-provider"],
        processes: [ingest.process],
        tasks: [{ process: ingest.process, task: ingest.task }],
      },
      public: {
        ref,
        source: {
          channel: channelOf(r.channel, src.channel),
          batch: src.batch,
          sha256: src.sha256,
          ...(src.sheet ? { sheet: src.sheet } : {}),
          ...(r.entry ? { entry: r.entry } : {}),
          ...(src.series ? { series: src.series } : {}),
          ...(r.row ? { row: r.row } : {}),
          ...(r.segment !== undefined ? { segment: r.segment } : {}),
          receivedAt: at,
        },
        reviewer: {
          id: reviewerId(who),
          ...(ack && r.reviewer.name ? { name: r.reviewer.name } : {}),
          ...(r.reviewer.organisation ? { organisation: r.reviewer.organisation } : {}),
          ...(r.reviewer.country ? { country: r.reviewer.country } : {}),
          ...(r.reviewer.acknowledge !== undefined ? { acknowledge: r.reviewer.acknowledge } : {}),
        },
        citation: r.citation,
        anchor,
        ...(type ? { type } : {}),
        text: r.text,
        ...(r.suggestedRevision ? { suggestedRevision: r.suggestedRevision } : {}),
        ...(r.labels ? { labels: r.labels } : {}),
        history: [{ at, transition: "ingest", by: "intake", task: `${ingest.process}#${ingest.task}`, note: `${src.batch}${r.row ? ` row ${r.row}` : ""}` }],
      },
    });
    // The log's own status is RECORDED, never carried as a decision. It
    // was, until 2026-10-07: "Accepted" in the master log arrived decided
    // `by: review-log`, a merge then marked PC-0035/36 incorporated, and the
    // dashboard counted decisions nobody had made (owner: "nothing has been
    // decided/incorporated"). Only an editor decides (Task_EditorDecides). So
    // a disposition-like status triages the comment and says what the log
    // said, rationale included, for the committee and the editor to weigh.
    let saved = c;
    const move = logStatusMove(r.status);
    const by = "review-log";
    const note = `the log's status was "${r.status}"`;
    if (move && "decide" in move) {
      const why = r.disposition ? `; its rationale: ${r.disposition}` : "";
      saved = transition(c, "triage", { by, at, note: `${note}${why} (recorded, not a decision: the editor decides)` });
      fromLog.recorded.push(ref);
    } else if (move) {
      saved = transition(c, "triage", { by, at, note });
      fromLog.triaged.push(ref);
    }
    store.save(saved);
    created.push(ref);
    if (!anchor.targetLabel) unplaced.push(ref);
  }
  store.saveBatch(src.batch, {
    id: src.batch,
    channel: src.channel,
    sha256: src.sha256,
    ...(src.sheet ? { sheet: src.sheet } : {}),
    ...(src.series ? { series: src.series } : {}),
    ...(skippedKnown ? { known: skippedKnown } : {}),
    importedAt: at,
    rows: rows.length,
    created,
    unplaced,
    skipped: src.skipped ?? [],
  });
  return { batch: src.batch, created, unplaced, skipped: src.skipped ?? [], known: skippedKnown, fromLog };
}

export function readRows(file: string): Array<{ name: string; rows: Cell[][] }> {
  const here = dirname(new URL(import.meta.url).pathname);
  const r = spawnSync("python3", [join(here, "intake-rows.py"), file], { encoding: "utf-8", maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(r.stderr || `intake-rows.py exited ${r.status}`);
  return (JSON.parse(r.stdout).sheets as Array<{ name?: string; rows: Cell[][] }>).map((s, i) => ({ name: s.name ?? `sheet${i + 1}`, rows: s.rows }));
}

// ── GitHub tags ──────────────────────────────────────────────────

export interface GithubTag {
  /** Comments named as `pc: PC-0042`. */
  refs: string[];
  /** Change-sets named as `cs: CS-012`. */
  changeSets: string[];
  /** Issues named as `pc: #12`: every comment in the change-sets it discusses. */
  issues: number[];
  verb: "recommend" | "decide";
  code: DecisionCode;
  text: string;
}

/**
 * Read a recommend/decide tag from a comment body: header lines `pc:`, `cs:`,
 * `recommend:`, `decide:` in any order, then the rationale. Returns null when
 * the body carries no tag at all.
 *
 * A tag naming no comment and no change-set is still a tag: in a change-set's
 * issue, `decide: accepted` alone means that change-set, which the caller
 * resolves from the thread (`public-comment-changesets.ts`). People do not
 * repeat the ref they are standing on.
 */
export function parseGithubTag(body: string): GithubTag | { error: string } | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const header: Record<string, string> = {};
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  for (; i < lines.length; i++) {
    const m = /^\s*(pc|cs|recommend|decide):\s*(.*?)\s*$/i.exec(lines[i]);
    if (!m) break;
    header[m[1].toLowerCase()] = m[2];
  }
  const verb = header.decide !== undefined ? "decide" : header.recommend !== undefined ? "recommend" : null;
  if (!verb) return header.pc !== undefined ? { error: "`pc:` needs a `recommend:` or `decide:` line" } : null;
  const code = (header[verb] ?? "").toLowerCase().replace(/\s+/g, "-") as DecisionCode;
  if (!DECISION_CODES.includes(code)) return { error: `\`${verb}: ${header[verb]}\` is not one of ${DECISION_CODES.join(", ")}` };
  const named = `${header.pc ?? ""} ${header.cs ?? ""}`;
  const refs = [...named.matchAll(/PC-?\s*(\d+)/gi)].map((m) => formatRef(Number(m[1])));
  const changeSets = [...named.matchAll(/CS-?\s*(\d+)/gi)].map((m) => `CS-${String(Number(m[1])).padStart(3, "0")}`);
  const issues = [...named.matchAll(/(?:^|[\s,])#(\d+)\b/g)].map((m) => Number(m[1]));
  return { refs, changeSets, issues, verb, code, text: lines.slice(i).join("\n").trim() };
}

/** The `author_association` values that make a commenter a collaborator on the repository. */
export const COLLABORATOR_ASSOCIATIONS = ["OWNER", "MEMBER", "COLLABORATOR"] as const;

/** The `author_association` value that makes a commenter the repository's owner. */
export const OWNER_ASSOCIATIONS = ["OWNER"] as const;

const hasAssociation = (set: readonly string[], association?: string) => set.includes((association ?? "").toUpperCase());

/** Is this commenter an editor? See the module docblock. */
export function isEditor(cfg: Pick<StoreConfig, "editors">, login: string, association?: string): boolean {
  if (cfg.editors) return cfg.editors.includes(login);
  return hasAssociation(OWNER_ASSOCIATIONS, association);
}

/** Is this commenter on the review committee? See the module docblock. */
export function isCommittee(cfg: Pick<StoreConfig, "committee">, login: string, association?: string): boolean {
  if (cfg.committee) return cfg.committee.includes(login);
  return hasAssociation(COLLABORATOR_ASSOCIATIONS, association);
}

/** Why this person may not give this tag, or undefined when they may. */
export function tagRefusal(cfg: Pick<StoreConfig, "editors" | "committee">, verb: GithubTag["verb"], login: string, association?: string): string | undefined {
  const editor = isEditor(cfg, login, association);
  if (verb === "decide" ? editor : editor || isCommittee(cfg, login, association)) return undefined;
  const who =
    verb === "decide"
      ? cfg.editors
        ? "an editor in config.json"
        : "the owner of this repository (the default editor)"
      : cfg.committee
        ? "on the committee list in config.json, or an editor"
        : "a collaborator on this repository, or an editor";
  return `${login} is not ${who}`;
}

/** Record a recommendation or decision on each of `refs`. Permission is the caller's check. */
export function applyTag(
  store: Store,
  tag: Pick<GithubTag, "verb" | "code" | "text">,
  refs: readonly string[],
  ev: { login: string; url: string; at: string },
): { applied: string[]; refused: string[] } {
  const applied: string[] = [];
  const refused: string[] = [];
  for (const ref of [...new Set(refs)]) {
    try {
      let c = store.get(ref);
      if (tag.verb === "recommend") {
        // A recommendation on a comment nobody assigned yet assigns it to the
        // recommender first, so the record shows who looked at it.
        if (c.status === "received") c = transition(c, "triage", { by: ev.login, at: ev.at });
        if (c.status === "triaged") c = transition(c, "assign", { by: ev.login, at: ev.at, assignees: [ev.login] });
        c = transition(c, "recommend", { by: ev.login, at: ev.at, recommendation: { by: ev.login, code: tag.code, rationale: tag.text, url: ev.url } });
      } else {
        c = transition(c, "decide", { by: ev.login, at: ev.at, decision: { code: tag.code, reason: tag.text } });
      }
      store.save(c);
      applied.push(ref);
    } catch (e) {
      refused.push(`${ref}: ${(e as Error).message}`);
    }
  }
  return { applied, refused };
}

/**
 * A tag naming comments directly. A tag naming a change-set or an issue, or
 * none at all, needs the change-set records to resolve: the folio's workflow
 * runs `public-comment-changesets.ts github`, which does.
 */
export function applyGithubComment(
  store: Store,
  ev: { login: string; body: string; url: string; at: string; association?: string },
): { applied: string[]; refused: string[] } {
  const tag = parseGithubTag(ev.body);
  if (tag === null) return { applied: [], refused: [] };
  if ("error" in tag) return { applied: [], refused: [tag.error] };
  const no = tagRefusal(store.config(), tag.verb, ev.login, ev.association);
  if (no) return { applied: [], refused: [no] };
  if (!tag.refs.length) return { applied: [], refused: ["the tag names no comment (pc: PC-0042); a change-set or issue is resolved by public-comment-changesets.ts"] };
  return applyTag(store, tag, tag.refs, ev);
}

// ── Listing ──────────────────────────────────────────────────────

export interface ListFilter {
  status?: string;
  page?: number;
  line?: number;
  block?: string;
  section?: string;
  unplaced?: boolean;
}

export function filterComments(all: PublicComment[], anchors: ReviewAnchors, f: ListFilter): PublicComment[] {
  const byLabel = new Map(anchors.blocks.map((b) => [b.label, b]));
  const secOf = (label: string | null) => {
    if (!label) return [];
    const b = byLabel.get(label);
    return b ? b.sections : [label];
  };
  const secNums = new Map(anchors.sections.map((s) => [s.label, s.number ?? ""]));
  return all.filter((c) => {
    if (f.status === "open" && !OPEN_STATUSES.includes(c.status)) return false;
    if (f.status && f.status !== "open" && c.status !== f.status) return false;
    if (f.unplaced && c.targetLabel) return false;
    if (f.block && c.targetLabel !== f.block) return false;
    if (f.section && !secOf(c.targetLabel).some((l) => (secNums.get(l) ?? "") === f.section || (secNums.get(l) ?? "").startsWith(`${f.section}.`))) return false;
    if (f.page !== undefined) {
      const b = c.targetLabel ? byLabel.get(c.targetLabel) : undefined;
      const cited = c.public.citation.page === String(f.page);
      const inBlock = b && f.page >= b.page && f.page <= (b.pageEnd ?? b.page);
      if (!cited && !inBlock) return false;
      if (f.line !== undefined && !(b && covers(b, f.page, f.line, f.line) > 0) && !parseLines(c.public.citation.lines).some(([a, z]) => f.line! >= a && f.line! <= z)) return false;
    }
    return true;
  });
}

export function summary(all: PublicComment[]) {
  const count = (k: (c: PublicComment) => string) =>
    all.reduce<Record<string, number>>((m, c) => ((m[k(c)] = (m[k(c)] ?? 0) + 1), m), {});
  return {
    total: all.length,
    open: all.filter((c) => OPEN_STATUSES.includes(c.status)).length,
    inEdit: all.filter((c) => IN_EDIT_STATUSES.includes(c.status)).length,
    unplaced: all.filter((c) => !c.targetLabel).length,
    byStatus: count((c) => c.status),
    byDecision: count((c) => c.public.decision?.code ?? "undecided"),
    byType: count((c) => c.public.type ?? "untyped"),
  };
}

// ── CLI ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const [cmd, ...args] = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const flag = (n: string) => args.includes(`--${n}`);
  const positional = args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--")));
  const store = Store.open(resolve(opt("repo") ?? process.cwd()), opt("store"));
  const now = new Date().toISOString();
  const by = opt("by") ?? process.env.GITHUB_ACTOR ?? "editor";
  const show = (c: PublicComment) =>
    `${c.public.ref}  ${c.status.padEnd(12)} ${(c.public.type ?? "").padEnd(9)} ${(c.targetLabel ?? "(unplaced)").padEnd(28)} ${c.public.citation.raw ?? ""}  ${c.summary.slice(0, 70)}`;
  try {
    switch (cmd) {
      case "import": {
        if (!positional) throw new Error("import <file.xlsx|file.csv>");
        const file = resolve(positional);
        const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
        const sheets = readRows(file);
        // EVERY sheet with a comment table, not the first: a consolidated log
        // keeps its master log and each large submission on separate tabs.
        // A sheet whose table holds no comment yet (a blank template) is
        // reported and passed over.
        const consent = sheets.map((sh) => consentByName(sh.rows)).find(Boolean);
        const tables = sheets.flatMap((sh) => {
          try {
            return [{ name: sh.name, ...tableRows(sh.rows, consent) }];
          } catch {
            return [];
          }
        });
        if (!tables.length) throw new Error(`${basename(file)}: no sheet has a comment table`);
        const channel = (opt("channel") as "comment-matrix" | "online-form") ?? (file.endsWith(".csv") ? "online-form" : "comment-matrix");
        const batch = opt("batch") ?? basename(file).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-");
        const several = tables.length > 1;
        const series = opt("series") ?? (several ? batch : undefined);
        if (consent) console.error(`  consent to acknowledge read for ${consent.size} contributor(s), by name`);
        for (const t of tables) {
          if (!t.rows.length) {
            console.error(`  · ${t.name}: a comment table with no comments; passed over`);
            continue;
          }
          const id = several ? `${batch}--${t.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+$/, "")}` : batch;
          const r = importRows(store, t.rows, { channel, batch: id, sha256, skipped: t.skipped, ...(several ? { sheet: t.name } : {}), ...(series ? { series } : {}) }, now);
          const where = several ? `${t.name}: ` : "";
          if (r.alreadyImported) {
            console.error(`= ${where}${basename(file)} was already imported (same sha256); nothing to do`);
            continue;
          }
          const log = r.fromLog;
          console.error(
            `✓ ${where}${r.created.length} comment(s) ${r.created[0] ?? ""}${r.created.length > 1 ? `…${r.created.at(-1)}` : ""}, ` +
              `${r.unplaced.length} unplaced, ${r.skipped.length} skipped` +
              (r.known ? `, ${r.known} already in from an earlier copy of ${series}` : "") +
              (log && (log.recorded.length || log.triaged.length)
                ? `; from the log's status: ${log.recorded.length} disposition(s) recorded as notes (not decisions), ${log.triaged.length} triaged`
                : ""),
          );
        }
        break;
      }
      case "import-narrative": {
        if (!positional) throw new Error("import-narrative <file> --reviewer <name>");
        const file = resolve(positional);
        const raw = readFileSync(file);
        const reviewer: ReviewerInput = {
          ...(opt("reviewer") ? { name: opt("reviewer") } : {}),
          ...(opt("org") ? { organisation: opt("org") } : {}),
          ...(opt("country") ? { country: opt("country") } : {}),
          acknowledge: flag("acknowledge"),
        };
        const batch = opt("batch") ?? basename(file).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-");
        const r = importRows(store, narrativeRows(raw.toString("utf-8"), reviewer), { channel: "narrative", batch, sha256: createHash("sha256").update(raw).digest("hex") }, now);
        console.error(r.alreadyImported ? `= already imported` : `✓ ${batch}: ${r.created.length} passage(s) → ${r.created.join(", ")}; ${r.unplaced.length} unplaced`);
        break;
      }
      case "list": {
        const out = filterComments(store.all(), store.anchors(), {
          status: opt("status"),
          page: opt("page") ? Number(opt("page")) : undefined,
          line: opt("line") ? Number(opt("line")) : undefined,
          block: opt("block"),
          section: opt("section"),
          unplaced: flag("unplaced"),
        });
        if (flag("json")) console.log(JSON.stringify(out, null, 2));
        else for (const c of out) console.log(show(c));
        console.error(`${out.length} comment(s)`);
        break;
      }
      case "summary": {
        const s = summary(store.all());
        console.log(flag("json") ? JSON.stringify(s, null, 2) : Object.entries(s).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n"));
        break;
      }
      case "github": {
        // Tags, change-set issues and their PRs all live in the change-set
        // module, which owns the records a tag may name (issue #2183).
        const { githubCommand } = await import("./public-comment-changesets.js");
        await githubCommand(store, resolve(opt("event")!), { dryRun: flag("dry-run"), now });
        break;
      }
      default: {
        const name = cmd;
        if (!PUBLIC_COMMENT_TRANSITIONS.some((t) => t.name === name) || name === "ingest") {
          throw new Error(`unknown command "${cmd}". See the module docblock for the commands.`);
        }
        if (!positional) throw new Error(`${name} <PC-ref>`);
        let c = store.get(positional);
        const anchors = name === "reassign" || (name === "triage" && opt("to")) ? store.anchors() : undefined;
        const target = opt("to");
        if (anchors && target && !anchors.blocks.some((b) => b.label === target) && !anchors.sections.some((s) => s.label === target) && !anchors.chapters.some((ch) => ch.label === target)) {
          throw new Error(`${target} is not a block, section or chapter label in the folio`);
        }
        c = transition(c, name, {
          by,
          at: now,
          note: opt("note"),
          ...(anchors && target ? { anchor: { targetLabel: target, method: "manual", confidence: "high", candidates: [], note: opt("note") ?? `placed by ${by}` } } : {}),
          ...(name === "assign" || name === "edit" ? { assignees: (target ?? "").split(",").filter(Boolean) } : {}),
          ...(opt("type") ? { type: opt("type") as PublicCommentType } : {}),
          ...(opt("priority") ? { priority: opt("priority") } : {}),
          ...(name === "recommend" ? { recommendation: { by, code: opt("code") as DecisionCode, rationale: opt("rationale") ?? "", ...(opt("url") ? { url: opt("url") } : {}) } } : {}),
          ...(name === "decide"
            ? { decision: { code: opt("code") as DecisionCode, reason: opt("reason") ?? "", ...(opt("branch") ? { changeSet: { branch: opt("branch")!, ...(opt("pr") ? { pr: Number(opt("pr")) } : {}) } } : {}) } }
            : {}),
          ...(name === "edit" ? { changeSet: { branch: opt("branch") ?? "", ...(opt("pr") ? { pr: Number(opt("pr")) } : {}) } } : {}),
          ...(name === "incorporate" && opt("branch") ? { changeSet: { branch: opt("branch")!, ...(opt("pr") ? { pr: Number(opt("pr")) } : {}), ...(opt("staging") ? { stagingUrl: opt("staging") } : {}) } } : {}),
          ...(name === "duplicate" ? { duplicateOf: opt("of") ? normRef(opt("of")!) : undefined } : {}),
        });
        store.save(c);
        console.error(`✓ ${c.public.ref}: ${name} → ${c.status}`);
      }
    }
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
}
