/**
 * The mechanical half of a review-log watcher: compare a drafting sheet's
 * Contributor Feedback tab and its repository's issues with the last
 * check, and say whether anything changed. It changes nothing itself: the
 * watcher agent does work only when it reports `changed`.
 *
 * Owner, 2026-11-01: "watch agents should look for new issues and update
 * google sheets with summary … should not trigger any agentic activity unless
 * a change to google sheet or issues". Q-WATCH1 B: a core tool the watcher
 * runs on each poll. Q-WATCH2 B: each issue no row links gets a
 * Contributor Feedback row. Owner, 10:18Z: "current google sheets should be
 * reviewed to add in existing issues. if issue is closed it correpsonds to
 * hidden row that text has line through it/hidden".
 *
 * Owner, 2026-11-04: it watches public-comment logs too. Read their Review
 * Change Sets, which has no Issue column: only `change-set` issues count
 * there, and an issue no row links is reported, never appended.
 *
 * Skill: `review-log-watch`. Process: `processes/content/review-log-watch.bpmn`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

import { hashOf } from "../review-sheet-sync/feedback-issue.js";

export type Issue = {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  updated_at: string;
  /** The issues API's state; absent counts as open. */
  state?: "open" | "closed";
  user?: { login: string } | null;
  labels?: ({ name: string } | string)[];
  pull_request?: unknown;
};

export type WatchState = {
  /** One hash of everything below, so "unchanged" is one comparison. */
  digest: string;
  /** Issue number → "open|<updated_at>" or "closed|<updated_at>". */
  issues: Record<string, string>;
  /**
   * "key:Header" → cell text, for the cells a person or the script sets. The
   * key is the row's Change-set id (CS-004) when it has one, so a row someone
   * inserts above it does not make every later row look changed; a row with
   * no id is keyed by its sheet row (1-based).
   */
  cells: Record<string, string>;
};

export type Change =
  | { kind: "issue-opened" | "issue-updated" | "issue-closed"; issue: number; title?: string }
  /** An open issue no row links, on a read with no Issue column, where no row is appended: link it by hand or on the Agent tab. */
  | { kind: "issue-unlinked"; issue: number; title: string }
  | {
      kind: "cell";
      /** The row as the sheet is now (1-based); 0 when the row is gone. Read the row again before writing to it. */
      row: number;
      /** The row's Change-set id, when it has one. */
      cs?: string;
      header: string; from: string; to: string;
    };

/** A row to append. A closed issue's row is appended hidden, its text struck through. */
export type AppendRow = {
  issue: number; url: string; closed: boolean; row: string[];
  /** The links in the feedback cell (`column`, 0-based), to write as rich text so they are clickable. */
  links: { column: number; runs: CellLink[] };
  /**
   * The row's Change-set id, set in `row` too, and the Agent tab row to write
   * with it. The sheet script fills Contributor Feedback's Issue column from
   * the Agent tab, by Change-set, so an Issue written only on Contributor
   * Feedback is cleared on its next refresh. Absent when the read has no
   * Change-set column.
   */
  agent?: { csId: string; issue: string };
};

export type WatchResult =
  | { status: "unchanged"; digest: string }
  | {
      status: "changed"; digest: string; changes: Change[]; append: AppendRow[];
      /** No state file yet: append the rows and accept, but start no agent pass for the cells. */
      baseline: boolean;
      /** Sheet rows (1-based) linking a closed issue: hide them and strike their text through. */
      closedRows: number[];
      state: WatchState;
    };

/**
 * The headers whose cells wake the agent: what people (Blue, Orange) set, on a
 * drafting log's Contributor Feedback and a public-comment log's Review
 * Change Sets and Review Public Comments (owner, 2026-11-04).
 */
export function watchedHeader(h: string): boolean {
  return (
    h === "Title" || h === "Selected Sections" || h === "Disposition" ||
    h === "Ready for agent" || h === "Ready for merge" || h === "Dispositions confirmed" ||
    h === "TWG (CS)" || h === "TWG (human)" || h === "Change Set (human)" ||
    (h.startsWith("Contributor Feedback") && h !== "Contributor Feedback (agent)") ||
    (h.startsWith("Committee Feedback") && h !== "Committee Feedback (agent)")
  );
}

/**
 * The header row: the first row whose first cell is `Change-set`, else (for a
 * poll that reads only the Issue column) the first row with an `Issue` cell.
 */
export function headerIndex(values: string[][]): number {
  const i = values.findIndex((r) => String(r[0] ?? "").trim() === "Change-set");
  return i >= 0 ? i : values.findIndex((r) => r.some((c) => String(c ?? "").trim() === "Issue"));
}

const CS_RE = /^CS-\d+$/;

/** Each data row's key: its Change-set id when it has one, else its sheet row (1-based). */
export function rowKeys(values: string[][]): { key: string; row: number }[] {
  const hi = headerIndex(values);
  if (hi < 0) return [];
  const csCol = values[hi].findIndex((h) => String(h ?? "").trim() === "Change-set");
  const out: { key: string; row: number }[] = [];
  for (let r = hi + 1; r < values.length; r++) {
    const id = csCol >= 0 ? String(values[r][csCol] ?? "").trim() : "";
    out.push({ key: CS_RE.test(id) ? id : String(r + 1), row: r + 1 });
  }
  return out;
}

/** The watched cells, keyed by row key (see `rowKeys`) and header. Empty cells are left out. */
export function sheetCells(values: string[][]): Record<string, string> {
  const hi = headerIndex(values);
  if (hi < 0) return {};
  const header = values[hi].map((h) => String(h ?? "").trim());
  const out: Record<string, string> = {};
  for (const { key, row } of rowKeys(values)) {
    header.forEach((h, c) => {
      const v = String(values[row - 1][c] ?? "").trim();
      if (v && watchedHeader(h)) out[`${key}:${h}`] = v;
    });
  }
  return out;
}

/** Issue numbers the sheet already links, from the Issue column (an `/issues/N` URL of the repo, `owner/name#N` or `name#N`), each with its sheet rows (1-based). */
export function linkedIssues(values: string[][], repo: string): Map<number, number[]> {
  const hi = headerIndex(values);
  const out = new Map<number, number[]>();
  if (hi < 0) return out;
  const col = values[hi].findIndex((h) => String(h ?? "").trim() === "Issue");
  if (col < 0) return out;
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const name = repo.split("/")[1] ?? repo;
  // A URL, `owner/name#N`, or the short `name#N` the sheets show.
  const re = new RegExp(`github\\.com/${esc(repo)}/issues/(\\d+)|(?:${esc(repo.split("/")[0])}/)?\\b${esc(name)}#(\\d+)`, "gi");
  for (let r = hi + 1; r < values.length; r++) {
    for (const m of String(values[r][col] ?? "").matchAll(re)) {
      const n = Number(m[1] ?? m[2]);
      out.set(n, [...(out.get(n) ?? []), r + 1]);
    }
  }
  return out;
}

const labelNames = (i: Issue) => (i.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));

/** A link inside a cell's text: characters [start, end) (UTF-16, as Sheets counts) go to `url`. */
export type CellLink = { start: number; end: number; url: string };

/** Cell text with its links, for a Sheets `textFormatRuns` write. */
export type RichText = { text: string; links: CellLink[] };

const URL_RE = /https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"]/g;

/**
 * Markdown inline text as plain cell text plus its links: `[label](url)` keeps
 * the label and links it, a bare URL links itself, and bold, italic and code
 * marks are dropped. Owner, 2026-11-01 10:51Z: imported comments "shiud be links".
 */
export function richInline(md: string): RichText {
  let text = "";
  const links: CellLink[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0;
  const plain = (t: string) => {
    const base = text.length;
    for (const m of t.matchAll(URL_RE)) links.push({ start: base + m.index!, end: base + m.index! + m[0].length, url: m[0] });
    text += t;
  };
  for (const m of md.matchAll(re)) {
    plain(md.slice(last, m.index));
    const start = text.length;
    text += m[1].replace(/\*\*|__|`/g, "");
    links.push({ start, end: text.length, url: m[2] });
    last = m.index! + m[0].length;
  }
  plain(md.slice(last));
  // Emphasis marks, keeping link offsets right: drop a mark only outside links.
  const marks = /\*\*|__|`|(?<![\w*])\*(?=\S)|(?<=\S)\*(?![\w*])|(?<![\w])_(?=\S)|(?<=\S)_(?![\w])/g;
  let out = "";
  let pos = 0;
  const shift: number[] = [];
  for (const m of text.matchAll(marks)) {
    const i = m.index!;
    if (links.some((l) => i >= l.start && i < l.end)) continue;
    out += text.slice(pos, i);
    shift.push(i, m[0].length);
    pos = i + m[0].length;
  }
  out += text.slice(pos);
  const moved = (n: number) => { let d = 0; for (let k = 0; k < shift.length; k += 2) if (shift[k] < n) d += shift[k + 1]; return n - d; };
  return { text: out, links: links.map((l) => ({ ...l, start: moved(l.start), end: moved(l.end) })) };
}

/** The issue's first paragraph, without form headings, emphasis or code marks, with its links, cut to `max` characters. */
export function richSummary(body: string | null | undefined, max = 300): RichText {
  const para = String(body ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s.*$/gm, "").replace(/\s+/g, " ").trim())
    .find((p) => p && p !== "_No response_") ?? "";
  const r = richInline(para);
  const text = r.text.trim();
  const lead = r.text.length - r.text.trimStart().length;
  const links = r.links.map((l) => ({ ...l, start: l.start - lead, end: l.end - lead }));
  if (text.length <= max) return { text, links };
  const cut = text.slice(0, max - 1).trimEnd();
  return { text: cut + "…", links: links.filter((l) => l.start < cut.length).map((l) => ({ ...l, end: Math.min(l.end, cut.length) })) };
}

/** The issue's first paragraph as plain text (see `richSummary`). */
export function summary(body: string | null | undefined, max = 300): string {
  return richSummary(body, max).text;
}

/** The first Contributor Feedback cell for an issue: "@login (#N): summary", with its links. */
export function feedbackCell(issue: Issue): RichText {
  const prefix = `@${issue.user?.login ?? "unknown"} (#${issue.number}): `;
  const s = richSummary(issue.body);
  return {
    text: (prefix + s.text).trimEnd(),
    links: s.links.map((l) => ({ ...l, start: l.start + prefix.length, end: l.end + prefix.length })),
  };
}

/** The column of the first Contributor Feedback column a person writes, or -1. */
export function feedbackColumn(header: string[]): number {
  return header.findIndex((h) => h.trim().startsWith("Contributor Feedback") && h.trim() !== "Contributor Feedback (agent)");
}

/**
 * The Contributor Feedback row for an issue, aligned to the header: Title is
 * the issue's title, the first Contributor Feedback column "@login (#N): the
 * first paragraph", Issue the issue's URL. Every other cell is empty, so
 * people keep their columns; `watch` sets the Change-set id when the read has
 * that column.
 */
export function issueRow(issue: Issue, header: string[]): string[] {
  const row = header.map(() => "");
  const at = (name: string) => header.findIndex((h) => h.trim() === name);
  const fb = feedbackColumn(header);
  if (at("Title") >= 0) row[at("Title")] = issue.title;
  if (fb >= 0) row[fb] = feedbackCell(issue).text;
  if (at("Issue") >= 0) row[at("Issue")] = issue.html_url;
  return row;
}

export function digestOf(issues: Record<string, string>, cells: Record<string, string>): string {
  const lines = [
    ...Object.keys(issues).sort().map((k) => `i${k}=${issues[k]}`),
    ...Object.keys(cells).sort().map((k) => `c${k}=${cells[k]}`),
  ];
  return hashOf(lines.join("\n"));
}

/**
 * `sheetHash`: the sheet script's hash of the person-set cells (Watch!G1,
 * Q-WATCH4 A). Given, it stands for the cells, so a poll reads one cell and the
 * Issue column instead of the log; a change is then reported as one `cell`
 * change on header `#hash`, and the watcher reads the rows it needs.
 */
export type WatchOptions = {
  skipLabel?: string; author?: string; sheetHash?: string;
  /**
   * Only issues with this label are tracked. Default: none on a read with an
   * Issue column, and `change-set` on one without (a public-comment log's
   * Review Change Sets), whose issues are the change sets people ask for.
   */
  label?: string;
};

const isClosed = (i: Issue) => i.state === "closed";

/**
 * Compare this check with the last one, over the repository's open AND
 * closed issues. Pull requests are left out (the issues API lists them too),
 * and so are issues with the `skipLabel`, issues without the `label` and,
 * when `author` is given, issues someone else opened. A read with no Issue
 * column gets no rows to append: its unlinked open issues are reported as
 * `issue-unlinked` changes instead.
 */
export function watch(
  values: string[][],
  issues: Issue[],
  repo: string,
  prev: WatchState | undefined,
  opts: WatchOptions = {},
): WatchResult {
  const skipLabel = opts.skipLabel ?? "no-sheet";
  const hi = headerIndex(values);
  const header = hi < 0 ? [] : values[hi].map((h) => String(h ?? ""));
  const hasIssue = header.some((h) => h.trim() === "Issue");
  const label = opts.label ?? (hasIssue ? undefined : "change-set");
  const tracked = issues.filter((i) =>
    !i.pull_request && !labelNames(i).includes(skipLabel) && (!label || labelNames(i).includes(label)) &&
    (!opts.author || i.user?.login === opts.author));
  const issueMap: Record<string, string> = {};
  for (const i of tracked) issueMap[String(i.number)] = `${isClosed(i) ? "closed" : "open"}|${i.updated_at}`;
  const cells = opts.sheetHash !== undefined ? { "0:#hash": opts.sheetHash } : sheetCells(values);
  const digest = digestOf(issueMap, cells);
  if (prev && prev.digest === digest) return { status: "unchanged", digest };

  const changes: Change[] = [];
  const before = prev?.issues ?? {};
  for (const i of tracked) {
    const was = before[String(i.number)];
    const now = issueMap[String(i.number)];
    if (was === now) continue;
    const closedNow = isClosed(i);
    const closedBefore = was?.startsWith("closed|");
    const kind = closedNow && !closedBefore ? "issue-closed" : was === undefined ? "issue-opened" : "issue-updated";
    changes.push({ kind, issue: i.number, title: i.title });
  }
  // Gone from the list: deleted, transferred, labelled no-sheet, or out of the author filter.
  for (const n of Object.keys(before)) if (!(n in issueMap)) changes.push({ kind: "issue-closed", issue: Number(n) });
  const oldCells = prev?.cells ?? {};
  // State written before cells were keyed by Change-set id: its row keys cannot
  // be matched to ids, so take this check's cells as the new baseline.
  const keyedById = (c: Record<string, string>) => Object.keys(c).some((k) => k.startsWith("CS-"));
  const legacy = !!prev && !keyedById(oldCells) && keyedById(cells);
  const rowOf = new Map(rowKeys(values).map(({ key, row }) => [key, row]));
  for (const k of legacy ? [] : new Set([...Object.keys(oldCells), ...Object.keys(cells)])) {
    if ((oldCells[k] ?? "") === (cells[k] ?? "")) continue;
    const at = k.indexOf(":");
    const key = k.slice(0, at);
    const cs = CS_RE.test(key) ? key : undefined;
    const row = cs ? rowOf.get(cs) ?? 0 : Number(key);
    changes.push({ kind: "cell", row, ...(cs ? { cs } : {}), header: k.slice(at + 1), from: oldCells[k] ?? "", to: cells[k] ?? "" });
  }

  const linked = linkedIssues(values, repo);
  const csCol = header.findIndex((h) => h.trim() === "Change-set");
  let next = 1 + values.slice(hi + 1).reduce((m, r) => {
    const x = /^CS-(\d+)$/.exec(String(r[csCol] ?? "").trim());
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  if (!hasIssue) {
    for (const i of tracked) if (!isClosed(i)) changes.push({ kind: "issue-unlinked", issue: i.number, title: i.title });
  }
  const append: AppendRow[] = !hasIssue ? [] : tracked
    .filter((i) => !linked.has(i.number))
    .sort((a, b) => a.number - b.number)
    .map((i) => {
      const row = issueRow(i, header);
      const out: AppendRow = { issue: i.number, url: i.html_url, closed: isClosed(i), row, links: { column: feedbackColumn(header), runs: feedbackCell(i).links } };
      if (csCol >= 0) {
        const csId = `CS-${String(next++).padStart(3, "0")}`;
        row[csCol] = csId;
        out.agent = { csId, issue: i.html_url };
      }
      return out;
    });
  const closedRows = tracked
    .filter(isClosed)
    .flatMap((i) => linked.get(i.number) ?? [])
    .sort((a, b) => a - b);

  return { status: "changed", digest, changes, append, closedRows, baseline: !prev, state: { digest, issues: issueMap, cells } };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fetchIssues(repo: string): Issue[] {
  const out = execFileSync("gh", ["api", "--paginate", `repos/${repo}/issues?state=all&per_page=100`], { encoding: "utf8" });
  // --paginate concatenates one JSON array per page.
  return JSON.parse(`[${out.trim().replace(/\]\s*\[/g, "],[")}]`).flat();
}

if (import.meta.main) {
  const repo = arg("repo");
  const sheet = arg("sheet");
  const statePath = arg("state");
  if (!repo || !sheet || !statePath) {
    console.error("usage: watch.ts --repo owner/name --sheet values.json --state state.json [--issues issues.json] [--skip-label no-sheet] [--label change-set] [--author login] [--sheet-hash h] [--accept]");
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(sheet, "utf8"));
  const values: string[][] = Array.isArray(raw) ? raw : raw.values ?? [];
  const issues: Issue[] = arg("issues") ? JSON.parse(readFileSync(arg("issues")!, "utf8")) : fetchIssues(repo);
  const prev: WatchState | undefined = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : undefined;
  const result = watch(values, issues, repo, prev, { skipLabel: arg("skip-label"), label: arg("label"), author: arg("author"), sheetHash: arg("sheet-hash") });
  if (result.status === "changed" && process.argv.includes("--accept")) {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(result.state, null, 2) + "\n");
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "unchanged" ? 0 : 10);
}
