/**
 * review-log-import — bring feedback that was written outside the master
 * review log back into it (issue #683; owner, 2026-11-08). One process for
 * every source:
 *
 *   - an offline copy of the log (downloaded as .xlsx, edited, sent back);
 *   - the feedback template returned with the line-numbered review PDF;
 *   - a night's archived workbook (review-log-archive.ts), to restore.
 *
 *   check <returned.xlsx> --log <logs/<id>.json> [--master <xlsx>] [--base <xlsx>]
 *         [--line-map <pdf-line-map.json>] [--tab-map "<theirs>=<ours>"] [--out <report.json>]
 *   plan  <report.json> --log <node.json> --select <1,4,7|all> [--accept-conflicts]
 *         [--out <plan.json>] [--intake-out <new-comments.csv>]
 *
 * check validates the returned workbook against the log's template and lists
 * every candidate row in one of five groups: Add to existing, New, Possible
 * duplicate, Conflict, Rejected (plus Unchanged, not shown for selection).
 * A PERSON then picks the rows; plan turns the picked rows into cell writes
 * on the master log (A1 range + value), which the agent applies.
 *
 * The rules the owner set:
 *   - the returned sheet is validated to match the template first;
 *   - imported CS# / PC# numbers are NOT authoritative: they are hints. The
 *     same number and the same title is an addition to that row; the same
 *     number with a different title is a conflict; near-identical text under
 *     another number is a possible duplicate; a new row is numbered by the
 *     master, never by the file;
 *   - the person selects what is imported;
 *   - careful with conflicts: a cell changed offline AND in the master since
 *     the copy was taken is never overwritten silently.
 * And the sheet's own rule: only human (blue) cells are written. Editor
 * (orange), agent (green) and script (grey) cells never are.
 *
 * The master defaults to the log's archived workbook (the node's `file`), so
 * run the nightly archive, or archive now, before checking. --base is the
 * copy the returned file was made from (the archived workbook at that day's
 * commit: `git show <commit>:<file>`); without it a filled master cell may
 * only be EXTENDED offline, and any other change to it is a conflict.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { headerRowOf, keyColumn, readWorkbook, type Value, type ValueTab } from "./review-log-archive.js";

export interface LogColumn {
  header: string;
  role?: "human" | "editor" | "agent" | "script";
}
export interface LogNode {
  id: string;
  file: string;
  tabs: Array<{ name: string; headerRow: number; columns: LogColumn[] }>;
}
export interface LineMap {
  pages: Record<string, { printed?: string | null; lines?: Record<string, string> }>;
}

export type Group = "add" | "new" | "duplicate" | "conflict" | "rejected" | "unchanged";
export interface CellChange {
  column: string;
  from: string;
  to: string;
  conflict?: boolean;
}
export interface Candidate {
  /** Selection number, 1-based, stable within a report. */
  n: number;
  group: Group;
  tab: string;
  /** Their row (1-based) in the returned file. */
  sourceRow: number;
  /** The number the file gave the row: a hint only. */
  givenKey: string;
  /** The master row it adds to, conflicts with or duplicates. */
  masterKey?: string;
  masterRow?: number;
  reason: string;
  cells: CellChange[];
  /** A new or duplicate row's whole source row, by its header, for comment intake. */
  fields?: Record<string, string>;
}
export interface Report {
  log: string;
  source: string;
  problems: string[];
  warnings: string[];
  candidates: Candidate[];
}

const str = (v: Value | undefined) => (v === null || v === undefined ? "" : String(v));
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[“”"'’]/g, "").trim();
/** "Committee Feedback (CL)" and "Committee Feedback (initials)" share a base. */
const base = (h: string) => norm(h.replace(/\(.*\)\s*$/, ""));

/** Word-set similarity in [0, 1] (Jaccard on words of three letters or more). */
export function similarity(a: string, b: string): number {
  const words = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

export const DUPLICATE_AT = 0.8;

interface Indexed {
  tab: ValueTab;
  header: string[];
  h: number;
  key: number;
  rows: Map<string, { row: Value[]; at: number }>;
}

function indexTab(tab: ValueTab, headerRow?: number): Indexed {
  const h = (headerRow ?? headerRowOf(tab.rows.map((r) => r.map((v) => ({ v }))))) - 1;
  const header = (tab.rows[h] ?? []).map(str);
  const key = keyColumn(tab.rows[h] ?? []);
  const rows = new Map<string, { row: Value[]; at: number }>();
  tab.rows.slice(h + 1).forEach((row, i) => {
    const k = str(row[key]).trim();
    if (k) rows.set(k, { row, at: h + 2 + i });
  });
  return { tab, header, h, key, rows };
}

const TITLE = /^title$/i;
const TEXT = /^(comment|issue|comment \/ issue|feedback|text)\b/i;
const PAGE = /^page\b/i;
const LINE = /^line/i;

/** Page and line problems against the frozen review version's line map. */
export function citeProblems(page: string, lines: string, map: LineMap): string[] {
  const out: string[] = [];
  if (!page.trim()) return out;
  const pages = Object.entries(map.pages);
  // A reviewer cites the page number printed on the page, and a printed
  // number can repeat (front matter, then the body); the PDF's own page index
  // is the fallback. The cite is good when one such page holds every line.
  const p = page.trim();
  const hits = [...pages.filter(([, x]) => (x.printed ?? "") === p), ...pages.filter(([k]) => k === p)];
  if (!hits.length) return [`page ${page} is not in the review version`];
  const wanted: number[] = [];
  for (const m of lines.matchAll(/\d+/g)) {
    // A number after "table" or "figure" is not a line number.
    if (/(table|figure|fig\.?|box)\s*$/i.test(lines.slice(0, m.index))) continue;
    wanted.push(Number(m[0]));
  }
  if (!wanted.length) return out;
  const fits = hits.some(([, x]) => {
    const known = new Set(Object.keys(x.lines ?? {}).map(Number));
    return known.size > 0 && wanted.every((n) => known.has(n));
  });
  if (!fits && hits.some(([, x]) => Object.keys(x.lines ?? {}).length)) out.push(`line(s) ${lines.trim()} are not on page ${page}`);
  return out;
}

export interface CheckOptions {
  node: LogNode;
  master: ValueTab[];
  returned: ValueTab[];
  base?: ValueTab[];
  lineMap?: LineMap;
  /** Their tab name -> our tab name (the PDF feedback template's comment tab). */
  tabMap?: Record<string, string>;
  source?: string;
}

/** Validate the returned workbook and sort every row into a group. */
export function check(o: CheckOptions): Report {
  const problems: string[] = [];
  const warnings: string[] = [];
  const candidates: Candidate[] = [];
  const ours = new Map(o.node.tabs.map((t) => [t.name, t]));
  const masterTabs = new Map(o.master.map((t) => [t.name, t]));
  const baseTabs = new Map((o.base ?? []).map((t) => [t.name, t]));
  let matched = 0;
  for (const theirs of o.returned) {
    const name = o.tabMap?.[theirs.name] ?? theirs.name;
    const spec = ours.get(name);
    if (!spec) {
      warnings.push(`tab "${theirs.name}" is not a tab of this log; passed over`);
      continue;
    }
    const masterTab = masterTabs.get(name);
    if (!masterTab) {
      problems.push(`tab "${name}" is missing from the master workbook`);
      continue;
    }
    matched++;
    const t = indexTab(theirs);
    const m = indexTab(masterTab, spec.headerRow);
    const b = baseTabs.get(name) ? indexTab(baseTabs.get(name)!, spec.headerRow) : undefined;
    // ── 1. the header row against the template ──
    const roleOf = new Map(spec.columns.map((c) => [c.header, c.role]));
    const colMap = new Map<number, number>(); // their column -> master column
    let tabBad = false;
    t.header.forEach((h, i) => {
      if (!h.trim()) return;
      const exact = m.header.indexOf(h);
      if (exact >= 0) return void colMap.set(i, exact);
      const sameBase = m.header.findIndex((x) => x && base(x) === base(h));
      if (sameBase >= 0) {
        warnings.push(`${theirs.name}: column "${h}" is a new reviewer column; the master has none of that name, so it is not imported (add the column to the master first)`);
        return;
      }
      warnings.push(`${theirs.name}: column "${h}" is not in the template; ignored`);
    });
    const humanMissing = spec.columns.filter((c) => c.role === "human" && c.header && !t.header.includes(c.header) && !t.header.some((x) => base(x) === base(c.header)));
    const keyHeader = m.header[m.key];
    const textCol = m.header.findIndex((h) => TITLE.test(h)) >= 0 ? m.header.findIndex((h) => TITLE.test(h)) : m.header.findIndex((h) => TEXT.test(h));
    const theirText = [...colMap].find(([, mc]) => mc === textCol)?.[0];
    if (theirText === undefined && !t.header.includes(keyHeader)) {
      problems.push(`${theirs.name}: neither "${keyHeader}" nor a title or comment column; not this log's template`);
      tabBad = true;
    }
    // A comment form (the feedback template sent with the line-numbered PDF)
    // has the comment and its page, and none of the review columns.
    const commentForm = theirText !== undefined && t.header.some((h) => PAGE.test(h));
    if (!commentForm && humanMissing.length === spec.columns.filter((c) => c.role === "human").length && humanMissing.length) {
      problems.push(`${theirs.name}: none of the template's feedback columns (${humanMissing.map((c) => c.header).join(", ")})`);
      tabBad = true;
    }
    if (tabBad) continue;
    const humanCols = [...colMap].filter(([, mc]) => roleOf.get(m.header[mc]) === "human");
    // A choice column: one with few distinct values in the master.
    const choices = new Map<number, Set<string>>();
    for (const [, mc] of humanCols) {
      const vals = new Set([...m.rows.values()].map((r) => str(r.row[mc]).trim()).filter(Boolean));
      if (vals.size && vals.size <= 12 && m.rows.size >= 20 && [...vals].every((v) => v.length <= 40)) choices.set(mc, vals);
    }
    const pageCol = t.header.findIndex((h) => PAGE.test(h));
    const lineCol = t.header.findIndex((h) => LINE.test(h));
    // ── 2. each row ──
    theirs.rows.slice(t.h + 1).forEach((row, i) => {
      const sourceRow = t.h + 2 + i;
      const given = t.header.includes(keyHeader) ? str(row[t.header.indexOf(keyHeader)]).trim() : "";
      const text = theirText !== undefined ? str(row[theirText]) : "";
      const human = humanCols.map(([tc, mc]) => ({ tc, mc, v: str(row[tc]) })).filter((x) => x.v.trim());
      if (!human.length && !(text.trim() && !given)) return;
      const push = (c: Omit<Candidate, "n" | "tab" | "sourceRow" | "givenKey">) =>
        candidates.push({ n: candidates.length + 1, tab: name, sourceRow, givenKey: given, ...c });
      const reject: string[] = [];
      for (const x of human) {
        const allowed = choices.get(x.mc);
        if (allowed && !allowed.has(x.v.trim())) reject.push(`${m.header[x.mc]} "${x.v}" is not one of ${[...allowed].join(", ")}`);
      }
      if (o.lineMap && pageCol >= 0) reject.push(...citeProblems(str(row[pageCol]), lineCol >= 0 ? str(row[lineCol]) : "", o.lineMap));
      const all = (): CellChange[] => human.map((x) => ({ column: m.header[x.mc], from: "", to: x.v }));
      if (reject.length) return push({ group: "rejected", reason: reject.join("; "), cells: all() });
      const at = given ? m.rows.get(given) : undefined;
      if (at) {
        const theirTitle = text;
        const ourTitle = textCol >= 0 ? str(at.row[textCol]) : "";
        if (theirText !== undefined && norm(theirTitle) !== norm(ourTitle) && similarity(theirTitle, ourTitle) < 0.9) {
          return push({
            group: "conflict",
            masterKey: given,
            masterRow: at.at,
            reason: `${given} has another title in the master ("${ourTitle.slice(0, 60)}" here, "${theirTitle.slice(0, 60)}" in the file): the number may be wrong or reused`,
            cells: all(),
          });
        }
        const was = b?.rows.get(given)?.row;
        const cells: CellChange[] = [];
        for (const x of human) {
          const now = str(at.row[x.mc]);
          if (norm(now) === norm(x.v)) continue;
          let conflict: boolean;
          if (was) {
            const then = str(was[b!.header.indexOf(m.header[x.mc])]);
            conflict = norm(now) !== norm(then) && norm(x.v) !== norm(then);
            if (norm(x.v) === norm(then)) continue; // changed only in the master: keep the master's
          } else {
            conflict = now.trim() !== "" && !norm(x.v).startsWith(norm(now));
          }
          cells.push({ column: m.header[x.mc], from: now, to: x.v, ...(conflict ? { conflict } : {}) });
        }
        if (!cells.length) return push({ group: "unchanged", masterKey: given, masterRow: at.at, reason: "the master already says this", cells });
        const clash = cells.some((c) => c.conflict);
        return push({
          group: clash ? "conflict" : "add",
          masterKey: given,
          masterRow: at.at,
          reason: clash ? "changed both offline and in the master since the copy was taken" : `adds to ${given}`,
          cells,
        });
      }
      // No row of that number: a duplicate of another, or new.
      let best: { key: string; at: number; s: number } | undefined;
      if (text.trim() && textCol >= 0) {
        for (const [k, r] of m.rows) {
          const s = similarity(text, str(r.row[textCol]));
          if (s >= DUPLICATE_AT && (!best || s > best.s)) best = { key: k, at: r.at, s };
        }
      }
      const cells = all();
      if (text.trim() && theirText !== undefined && textCol >= 0 && !cells.some((c) => c.column === m.header[textCol])) cells.unshift({ column: m.header[textCol], from: "", to: text });
      const fields = Object.fromEntries(t.header.flatMap((h, j) => (h.trim() && str(row[j]).trim() ? [[h, str(row[j])]] : [])));
      if (best) {
        return push({
          fields,
          group: "duplicate",
          masterKey: best.key,
          masterRow: best.at,
          reason: `${Math.round(best.s * 100)}% the same words as ${best.key}${given ? ` (the file numbered it ${given})` : ""}`,
          cells,
        });
      }
      push({ group: "new", fields, reason: given ? `no ${given} in the master; the master gives it a new number` : "a new row; the master gives it a number", cells });
    });
  }
  // Number the rows a person can pick, 1, 2, 3 …, in the order of the review list.
  const order: Group[] = ["add", "new", "duplicate", "conflict", "rejected", "unchanged"];
  candidates.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.tab.localeCompare(b.tab) || a.sourceRow - b.sourceRow);
  candidates.forEach((c, i) => (c.n = c.group === "unchanged" ? 0 : i + 1));
  if (!matched) problems.push("no tab of this workbook is a tab of the log: not this log's template (use --tab-map for a feedback template's comment tab)");
  return { log: o.node.id, source: o.source ?? "", problems, warnings, candidates };
}

const GROUP_TITLE: Record<Group, string> = {
  add: "Add to existing",
  new: "New",
  duplicate: "Possible duplicate",
  conflict: "Conflict",
  rejected: "Rejected",
  unchanged: "Unchanged",
};

/** The review list a person selects from. */
export function reviewList(r: Report): string {
  const out: string[] = [];
  if (r.problems.length) out.push("Not imported, the file does not match the template:", ...r.problems.map((p) => `- ${p}`), "");
  if (r.warnings.length) out.push("Warnings:", ...r.warnings.map((p) => `- ${p}`), "");
  for (const g of ["add", "new", "duplicate", "conflict", "rejected"] as Group[]) {
    const cs = r.candidates.filter((c) => c.group === g);
    if (!cs.length) continue;
    out.push(`${GROUP_TITLE[g]} (${cs.length})`);
    for (const c of cs) {
      out.push(`  [${c.n}] ${c.tab} row ${c.sourceRow}${c.givenKey ? ` (${c.givenKey})` : ""}: ${c.reason}`);
      for (const x of c.cells) out.push(`      ${x.conflict ? "! " : ""}${x.column}: ${x.from ? `"${x.from.slice(0, 50)}" -> ` : ""}"${x.to.slice(0, 80)}"`);
    }
    out.push("");
  }
  const same = r.candidates.filter((c) => c.group === "unchanged").length;
  if (same) out.push(`${same} row(s) unchanged: the master already says the same.`);
  return out.join("\n").trimEnd();
}

const colName = (i: number) => {
  let s = "";
  for (let n = i + 1; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export interface Write {
  range: string;
  value: string;
  candidate: number;
}

/**
 * The cell writes for the selected candidates. Only human columns (the
 * report holds no other). New rows go below the master's last row; their
 * number is left to the master's script. A selected conflict or rejected row
 * needs --accept-conflicts; a selected duplicate is written as an addition
 * to the row it duplicates.
 */
export function plan(
  r: Report,
  master: ValueTab[],
  select: number[] | "all",
  o: { acceptConflicts?: boolean; node?: LogNode } = {},
): { writes: Write[]; intake: Array<Record<string, string>>; refused: string[] } {
  const acceptConflicts = o.acceptConflicts ?? false;
  if (r.problems.length) return { writes: [], intake: [], refused: r.problems };
  const writes: Write[] = [];
  const intake: Array<Record<string, string>> = [];
  const refused: string[] = [];
  const picked = r.candidates.filter((c) => c.group !== "unchanged" && (select === "all" ? c.group === "add" || c.group === "new" : select.includes(c.n)));
  const next = new Map<string, number>();
  for (const c of picked) {
    if ((c.group === "conflict" || c.group === "rejected") && !acceptConflicts) {
      refused.push(`[${c.n}] is a ${c.group}: decide it, then pass --accept-conflicts to write the file's value`);
      continue;
    }
    const tab = master.find((t) => t.name === c.tab);
    if (!tab) continue;
    const roles = new Map((o.node?.tabs.find((t) => t.name === c.tab)?.columns ?? []).map((x) => [x.header, x.role]));
    // A new comment whose cells are all the script's (the PDF feedback
    // template: page, line, comment) is not typed into the sheet: it enters
    // through comment intake, which numbers it and places it.
    if (c.group === "new" && o.node && c.cells.every((x) => roles.get(x.column) !== "human")) {
      intake.push(c.fields ?? Object.fromEntries(c.cells.map((x) => [x.column, x.to])));
      continue;
    }
    const ix = indexTab(tab);
    let row = c.masterRow;
    const cells = c.group === "duplicate" ? c.cells.filter((x) => !TEXT.test(x.column) && !TITLE.test(x.column)) : c.cells;
    if (c.group === "new" || (c.group === "rejected" && !row) || (c.group === "conflict" && !row)) {
      const last = next.get(c.tab) ?? tab.rows.reduce((n, r, i) => (r.some((v) => str(v).trim()) ? i + 1 : n), 0);
      row = last + 1;
      next.set(c.tab, row);
    }
    for (const x of cells) {
      const col = ix.header.indexOf(x.column);
      if (col < 0 || (o.node && roles.get(x.column) !== "human")) continue;
      writes.push({ range: `'${c.tab}'!${colName(col)}${row}`, value: x.to, candidate: c.n });
    }
  }
  return { writes, intake, refused };
}

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** New comments for `public-comment.ts import` (a CSV with the template's headers). */
export function intakeCsv(rows: Array<Record<string, string>>): string {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

if (import.meta.main) {
  const [cmd, file, ...rest] = process.argv.slice(2);
  const args = [file, ...rest];
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const out = opt("out");
  if (cmd === "check" && file) {
    const nodePath = opt("log");
    if (!nodePath) throw new Error("--log <review/public-comment/logs/<id>.json> is required");
    const node = JSON.parse(readFileSync(nodePath, "utf-8")) as LogNode;
    const repo = resolve(dirname(nodePath), "../../..");
    const tabMap = Object.fromEntries((opt("tab-map") ?? "").split(",").filter(Boolean).map((p) => p.split("=").map((s) => s.trim()) as [string, string]));
    const r = check({
      node,
      master: readWorkbook(opt("master") ?? resolve(repo, node.file)),
      returned: readWorkbook(file),
      base: opt("base") ? readWorkbook(opt("base")!) : undefined,
      lineMap: opt("line-map") ? (JSON.parse(readFileSync(opt("line-map")!, "utf-8")) as LineMap) : undefined,
      tabMap,
      source: file,
    });
    if (out) writeFileSync(out, `${JSON.stringify(r, null, 2)}\n`);
    console.log(reviewList(r));
    process.exit(r.problems.length ? 1 : 0);
  } else if (cmd === "plan" && file) {
    const r = JSON.parse(readFileSync(file, "utf-8")) as Report;
    const sel = opt("select");
    if (!sel) throw new Error("--select <1,4,7|all> is required: a person picks the rows");
    const node = JSON.parse(readFileSync(opt("log") ?? "", "utf-8")) as LogNode;
    const repo = resolve(dirname(opt("log")!), "../../..");
    const p = plan(r, readWorkbook(opt("master") ?? resolve(repo, node.file)), sel === "all" ? "all" : sel.split(",").map(Number), {
      acceptConflicts: args.includes("--accept-conflicts"),
      node,
    });
    if (out) writeFileSync(out, `${JSON.stringify(p, null, 2)}\n`);
    if (p.intake.length) {
      const csv = opt("intake-out") ?? "intake.csv";
      writeFileSync(csv, intakeCsv(p.intake));
      console.log(`${p.intake.length} new comment(s) for intake: public-comment.ts import ${csv} --channel comment-matrix (keep it out of the repository: it may hold names)`);
    }
    for (const w of p.writes) console.log(`${w.range}  <- ${JSON.stringify(w.value.slice(0, 80))}  [${w.candidate}]`);
    for (const x of p.refused) console.error(`refused: ${x}`);
    process.exit(p.refused.length ? 1 : 0);
  } else {
    console.error("usage: check <returned.xlsx> --log <node.json> [...] | plan <report.json> --log <node.json> --select <ids|all> [...]");
    process.exit(2);
  }
}
