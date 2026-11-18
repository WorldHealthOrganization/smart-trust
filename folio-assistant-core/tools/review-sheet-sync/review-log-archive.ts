/**
 * review-log-archive — keep a copy of a review log (a Google Sheet) in the
 * working document's knowledge graph, beside its comments and change-sets
 * (issue #682; owner, 2026-11-08).
 *
 *   review/public-comment/logs/<log-id>.xlsx   the log as a workbook
 *   review/public-comment/logs/<log-id>.json   its `review-log/1.0.0` node
 *
 * The workbook is .xlsx so a person opens it in Excel, Google Sheets, Numbers
 * or LibreOffice ("i dont want custom json"). It is OVERWRITTEN, and only when
 * the log changed: there is no list of snapshots ("i dont want a long list of
 * snapshots"); git history is the history, and the commit message this tool
 * prints lists the cells that changed. An unchanged log writes nothing: the
 * workbook is built byte for byte the same (xlsx-write.py), so git sees no
 * change and the watcher makes no commit.
 *
 * No reviewer's contact details reach the repository: columns whose header
 * names an email, phone, address or contact are blanked, and any email address
 * left in another cell is removed (returned spreadsheets hold reviewers'
 * emails and are never committed).
 *
 *   bun run folio-assistant-core/tools/review-sheet-sync/review-log-archive.ts \
 *     --sheets <read.json> [--sheets <read.json> …] [--sheet-id <id>] \
 *     --repo <document repo> --log-id dpi-h-master --document dpi-h-ra \
 *     --role master [--title <text>] [--commit]
 *
 * Each <read.json> is a Sheets API spreadsheet resource with grid data, read
 * with the fields in `ARCHIVE_FIELDS`, a tab or two at a time (one read of a
 * whole log is too large to fetch). Skill `review-sheet-script`,
 * "Archiving the log".
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const HERE = dirname(new URL(import.meta.url).pathname);

/** The field mask to read a log for archiving (`get_spreadsheet` `fields`). */
export const ARCHIVE_FIELDS = [
  "spreadsheetId",
  "properties.title",
  "sheets.properties.title",
  "sheets.data.rowData.values.formattedValue",
  "sheets.data.rowData.values.effectiveValue",
  "sheets.data.rowData.values.hyperlink",
  "sheets.data.rowData.values.note",
  "sheets.data.rowData.values.textFormatRuns.format.link",
  "sheets.data.rowData.values.effectiveFormat.backgroundColor",
];

export type Role = "human" | "editor" | "agent" | "script";
export type Value = string | number | boolean | null;
export interface Cell {
  v: Value;
  link?: string;
  note?: string;
  fill?: string;
}
export interface Tab {
  name: string;
  /** 1-based. */
  headerRow: number;
  columns: Array<{ header: string; role?: Role }>;
  rows: Array<Array<Cell | null>>;
}

interface Rgb {
  red?: number;
  green?: number;
  blue?: number;
}
interface ApiCell {
  formattedValue?: string;
  effectiveValue?: { stringValue?: string; numberValue?: number; boolValue?: boolean };
  hyperlink?: string;
  note?: string;
  textFormatRuns?: Array<{ format?: { link?: { uri?: string } } }>;
  effectiveFormat?: { backgroundColor?: Rgb };
}
export interface ApiSpreadsheet {
  spreadsheetId?: string;
  properties?: { title?: string };
  sheets: Array<{ properties?: { title?: string }; data?: Array<{ rowData?: Array<{ values?: ApiCell[] }> }> }>;
}

/** A colour as RRGGBB, or undefined for white / no fill. */
export function hex(c: Rgb | undefined): string | undefined {
  if (!c) return undefined;
  const [r, g, b] = [c.red ?? 0, c.green ?? 0, c.blue ?? 0];
  if (r > 0.98 && g > 0.98 && b > 0.98) return undefined;
  return [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Who fills a column, from its header colour, as the review sheet's own
 * legend says: Blue = the reviewers / committee, Orange = an Editor, Green =
 * the agent, Grey = the script. Read by hue, so a lighter or darker shade of
 * the same colour reads the same.
 */
export function roleOf(fill: string | undefined): Role | undefined {
  if (!fill) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(fill.slice(i, i + 2), 16) / 255);
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  if (hi - lo < 0.06) return hi < 0.97 ? "script" : undefined;
  if (b === hi) return "human";
  if (r === hi) return "editor";
  if (g === hi) return r > b && r > 0.85 ? "editor" : "agent";
  return undefined;
}

function value(c: ApiCell): Value {
  const f = c.formattedValue;
  const e = c.effectiveValue;
  if (f === undefined || f === "") return null;
  if (e?.boolValue !== undefined && /^(true|false)$/i.test(f)) return e.boolValue;
  // A number only when it reads as one: "2:245177", dates and "CS-001" stay text.
  if (e?.numberValue !== undefined && /^-?\d+(\.\d+)?$/.test(f) && Number(f) === e.numberValue) return e.numberValue;
  return f;
}

const filled = (row: Array<Cell | null>) => row.filter((c) => c && c.v !== null && c.v !== "").length;

/** The header row: the fullest of the first five (a tab may open with an instructions row). */
export function headerRowOf(rows: Array<Array<Cell | null>>): number {
  let best = 0;
  for (let i = 1; i < Math.min(5, rows.length); i++) if (filled(rows[i]) > filled(rows[best])) best = i;
  return best + 1;
}

/** The Sheets API resource as tabs of cells, roles read from the header colours. */
export function fromSheetsApi(api: ApiSpreadsheet): Tab[] {
  return api.sheets.map((s, i) => {
    const rows = (s.data ?? []).flatMap((d) => d.rowData ?? []).map((r) =>
      (r.values ?? []).map((c): Cell | null => {
        const v = value(c);
        const link = c.hyperlink ?? c.textFormatRuns?.find((t) => t.format?.link?.uri)?.format?.link?.uri;
        const fill = hex(c.effectiveFormat?.backgroundColor);
        if (v === null && !link && !c.note && !fill) return null;
        return { v, ...(link ? { link } : {}), ...(c.note ? { note: c.note } : {}), ...(fill ? { fill } : {}) };
      }),
    );
    while (rows.length && !filled(rows[rows.length - 1])) rows.pop();
    const headerRow = rows.length ? headerRowOf(rows) : 1;
    const head = rows[headerRow - 1] ?? [];
    const columns = head.map((c) => ({ header: c?.v === null || c?.v === undefined ? "" : String(c.v), ...(roleOf(c?.fill) ? { role: roleOf(c?.fill) } : {}) }));
    return { name: s.properties?.title ?? `Sheet${i + 1}`, headerRow, columns, rows };
  });
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** A header naming a reviewer's contact details: the column is blanked. */
export const CONTACT_HEADER = /e-?mail|phone|telephone|mobile|whats ?app|address|contact/i;

/** Blank contact columns and remove email addresses. Returns what was left out. */
export function redact(tabs: Tab[]): { columns: string[]; emails: number } {
  const columns: string[] = [];
  let emails = 0;
  for (const t of tabs) {
    const blank = new Set(t.columns.flatMap((c, i) => (CONTACT_HEADER.test(c.header) ? [i] : [])));
    for (const i of blank) columns.push(`${t.name}!${t.columns[i].header}`);
    const scrub = (text: string): string => {
      emails += (text.match(EMAIL) ?? []).length;
      EMAIL.lastIndex = 0;
      return text.replace(EMAIL, "[email removed]");
    };
    t.rows.forEach((row, r) => {
      row.forEach((c, i) => {
        if (!c) return;
        // Notes and the rows above the header can hold an address too.
        if (c.note) c.note = scrub(c.note);
        if (r >= t.headerRow && blank.has(i) && c.v !== null && c.v !== "") {
          c.v = null;
          delete c.link;
          return;
        }
        if (typeof c.v === "string") c.v = scrub(c.v);
        if (c.link?.startsWith("mailto:")) delete c.link;
      });
    });
  }
  return { columns, emails };
}

/** Plain values per tab, as intake-rows.py reads a workbook back. */
export interface ValueTab {
  name: string;
  rows: Value[][];
}

export const valuesOf = (tabs: Tab[]): ValueTab[] => tabs.map((t) => ({ name: t.name, rows: t.rows.map((r) => r.map((c) => (c ? c.v : null))) }));

/** Read a workbook's values back (stdlib reader shared with comment intake). */
export function readWorkbook(file: string): ValueTab[] {
  const r = spawnSync("python3", [join(HERE, "../../scripts/intake-rows.py"), file], { encoding: "utf-8", maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(r.stderr || `intake-rows.py exited ${r.status}`);
  return (JSON.parse(r.stdout).sheets as Array<{ name: string; rows: Value[][] }>).map((s) => ({ name: s.name, rows: s.rows }));
}

const str = (v: Value | undefined) => (v === null || v === undefined ? "" : String(v));
const KEY_HEADER = /^(change[- ]?set|no\.?|#|id|pc|cs|ref)\b/i;

/** The column that keys a row: a change-set id or comment number, else the first. */
export function keyColumn(header: Value[]): number {
  const i = header.findIndex((h) => KEY_HEADER.test(str(h).trim()));
  return i < 0 ? 0 : i;
}

export interface Change {
  tab: string;
  row: string;
  column: string;
  from: string;
  to: string;
}

/** What changed between two copies of a log, cell by cell, keyed by row id and header. */
export function diffLogs(before: ValueTab[], after: ValueTab[]): { changes: Change[]; added: string[]; removed: string[] } {
  const changes: Change[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const prev = new Map(before.map((t) => [t.name, t]));
  for (const t of after) {
    const p = prev.get(t.name);
    if (!p) {
      added.push(`tab ${t.name}`);
      continue;
    }
    prev.delete(t.name);
    const index = (tab: ValueTab) => {
      const cellsOf = tab.rows.map((r) => r.map((c) => ({ v: c }) as Cell));
      const h = headerRowOf(cellsOf) - 1;
      const header = (tab.rows[h] ?? []).map(str);
      const k = keyColumn(tab.rows[h] ?? []);
      const rows = new Map<string, Value[]>();
      tab.rows.slice(h + 1).forEach((r, i) => {
        const key = str(r[k]).trim() || `row ${h + 2 + i}`;
        if (r.some((c) => str(c) !== "")) rows.set(key, r);
      });
      return { header, rows };
    };
    const a = index(p);
    const b = index(t);
    for (const [key, row] of b.rows) {
      const old = a.rows.get(key);
      if (!old) {
        added.push(`${t.name} ${key}`);
        continue;
      }
      a.rows.delete(key);
      b.header.forEach((h, i) => {
        const j = a.header.indexOf(h);
        const from = j < 0 ? "" : str(old[j]);
        const to = str(row[i]);
        if (from !== to) changes.push({ tab: t.name, row: key, column: h || `column ${i + 1}`, from, to });
      });
    }
    for (const key of a.rows.keys()) removed.push(`${t.name} ${key}`);
  }
  for (const name of prev.keys()) removed.push(`tab ${name}`);
  return { changes, added, removed };
}

const clip = (s: string, n = 60) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one || "(empty)";
};

/** The commit message: what changed, so `git log` on the workbook reads as a change log. */
export function commitMessage(title: string, d: ReturnType<typeof diffLogs>, max = 40): string {
  const n = d.changes.length;
  const head = `review log: ${title}: ${n} cell${n === 1 ? "" : "s"} changed` +
    (d.added.length ? `, ${d.added.length} row${d.added.length === 1 ? "" : "s"} added` : "") +
    (d.removed.length ? `, ${d.removed.length} removed` : "");
  const lines = d.changes.slice(0, max).map((c) => `- ${c.tab} ${c.row}, ${c.column}: ${clip(c.from)} -> ${clip(c.to)}`);
  if (n > max) lines.push(`- … and ${n - max} more`);
  if (d.added.length) lines.push(`Added: ${d.added.slice(0, 20).join(", ")}${d.added.length > 20 ? ", …" : ""}`);
  if (d.removed.length) lines.push(`Removed: ${d.removed.slice(0, 20).join(", ")}${d.removed.length > 20 ? ", …" : ""}`);
  return [head, "", ...lines].join("\n").trimEnd();
}

/** Write tabs as an .xlsx (deterministic bytes). */
export function writeWorkbook(tabs: Tab[], out: string): void {
  const book = { sheets: tabs.map((t) => ({ name: t.name, freeze: t.headerRow, rows: t.rows })) };
  const r = spawnSync("python3", [join(HERE, "xlsx-write.py"), out], { input: JSON.stringify(book), encoding: "utf-8", maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(r.stderr || `xlsx-write.py exited ${r.status}`);
}

/**
 * Tabs never archived: hidden helper tabs of the script, and a tab of
 * submitters, which holds names and contact details (the repository gets a
 * reviewer's id only, and a name only with consent).
 */
export const SKIP_TAB = /^(watch|rcs joins.*)$|source|submitter|contributors?$/i;

/** Several reads of one spreadsheet (a tab or two each) as one, private tabs left out. */
export function mergeReads(reads: ApiSpreadsheet[], o: { sheetId?: string } = {}): ApiSpreadsheet {
  const seen = new Set<string>();
  const sheets = reads.flatMap((r) => r.sheets).filter((s) => {
    const name = s.properties?.title ?? "";
    if (SKIP_TAB.test(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
  const first = reads.find((r) => r.spreadsheetId || r.properties?.title);
  return { spreadsheetId: o.sheetId ?? first?.spreadsheetId, properties: first?.properties, sheets };
}

export interface ArchiveOptions {
  repo: string;
  logId: string;
  document: string;
  role: "master" | "contributor";
  title?: string;
  now?: string;
}

export interface ArchiveResult {
  changed: boolean;
  file: string;
  node: string;
  message: string;
}

export const logPaths = (repo: string, id: string) => ({
  file: join(repo, "review/public-comment/logs", `${id}.xlsx`),
  node: join(repo, "review/public-comment/logs", `${id}.json`),
});

/**
 * Archive one log. Writes the workbook and the node only when the log
 * changed; returns the commit message either way.
 */
export function archive(api: ApiSpreadsheet, o: ArchiveOptions): ArchiveResult {
  const tabs = fromSheetsApi(api);
  const redacted = redact(tabs);
  const { file, node } = logPaths(o.repo, o.logId);
  const title = o.title ?? api.properties?.title ?? o.logId;
  const tmp = mkdtempSync(join(tmpdir(), "review-log-"));
  try {
    const next = join(tmp, "next.xlsx");
    writeWorkbook(tabs, next);
    const bytes = readFileSync(next);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const before = existsSync(file) ? readWorkbook(file) : [];
    const same = existsSync(file) && createHash("sha256").update(readFileSync(file)).digest("hex") === sha256;
    const d = diffLogs(before, valuesOf(tabs));
    const message = before.length ? commitMessage(title, d) : `review log: ${title}: first copy (${tabs.length} tabs)`;
    if (same) return { changed: false, file, node, message: `review log: ${title}: unchanged` };
    mkdirSync(dirname(file), { recursive: true });
    renameSync(next, file);
    const sheetId = api.spreadsheetId ?? "";
    const record = {
      $schema: "review-log/1.0.0",
      id: o.logId,
      title,
      sheetId,
      url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      document: o.document,
      role: o.role,
      file: relative(o.repo, file),
      sha256,
      archivedAt: o.now ?? new Date().toISOString(),
      tabs: tabs.map((t) => ({ name: t.name, headerRow: t.headerRow, rows: Math.max(0, t.rows.length - t.headerRow), columns: t.columns })),
      redacted,
    };
    writeFileSync(node, `${JSON.stringify(record, null, 2)}\n`);
    return { changed: true, file, node, message };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const need = (n: string) => {
    const v = opt(n);
    if (!v) {
      console.error(`--${n} is required`);
      process.exit(2);
    }
    return v;
  };
  // A big log is read a tab or two at a time (one read of the whole sheet is
  // too large to fetch), so --sheets may be given more than once.
  const files = args.flatMap((a, i) => (a === "--sheets" ? [args[i + 1]] : []));
  if (!files.length) need("sheets");
  const api = mergeReads(files.map((f) => JSON.parse(readFileSync(f, "utf-8")) as ApiSpreadsheet), { sheetId: opt("sheet-id") });
  const role = (opt("role") ?? "master") as "master" | "contributor";
  const repo = resolve(need("repo"));
  const r = archive(api, { repo, logId: need("log-id"), document: need("document"), role, title: opt("title") });
  console.log(r.message);
  if (r.changed && args.includes("--commit")) {
    execFileSync("git", ["-C", repo, "add", relative(repo, r.file), relative(repo, r.node)], { stdio: "inherit" });
    execFileSync("git", ["-C", repo, "commit", "-q", "-m", r.message], { stdio: "inherit" });
  }
}
