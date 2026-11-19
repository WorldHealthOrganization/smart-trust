#!/usr/bin/env bun
/**
 * dak-data-dictionary.ts: a DAK's core data dictionary workbook, as a JSON
 * annex a page can load.
 *
 * Owner, 2026-10-10: the IG's `dictionary.html` says "see Web Annex A of the
 * DAK" and links out. The data dictionary should be ON the site, held in the
 * knowledge graph, loaded dynamically, and NOT offered as the full Excel.
 * This writes the annex. fhir-harness's generic `annex` fill renders it
 * (`ig-annex.js`), knowing nothing of DAKs.
 *
 * ## Which sheets, and why by header rather than by position
 *
 * A data sheet is one whose header row has both a `Data element ID` and a
 * `Data element label` column. Measured
 * on an immunization DAK's `IMMZ DAK_core data dictionary.xlsx` against WHO's
 * v2.1 template (bean `sopq`): the column ORDER differs from the template, the
 * header sits on row 1 rather than row 2, `*` required-markers are absent, and
 * even sibling sheets disagree (`Input option` / `Input options`). Names
 * normalised (case, whitespace, `*`, a trailing parenthetical) are stable;
 * positions are not. COVER, READ ME and References carry no such column and
 * are not data.
 *
 * ## Stdlib only
 *
 * An xlsx is a zip of XML. `node:zlib`'s `inflateRawSync` and the zip central
 * directory are enough. No workbook library is a dependency of this
 * repository, and adding one for read-only cell text is not worth it (the
 * same call `cat-harness-tools/scripts/tabular-records.py` made).
 *
 *   bun run smart-base/L2/scripts/dak-data-dictionary.ts --xlsx <workbook> --out <annex.json> \
 *     --annex-of <instance/library/slug | 10665/n> --label "Web Annex A" --section dak#core-data-elements \
 *     [--iris 10665/n] [--source <label>]
 *
 * The three `web-annex` facts (`annexOf`, `label`, `section`; `iris` only when
 * WHO gave the annex a record of its own) are said, never guessed: the
 * workbook does not carry them.
 *
 * @module smart-base/L2/scripts/dak-data-dictionary
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { inflateRawSync } from "node:zlib";

import {
  DAK_DATA_DICTIONARY_SCHEMA,
  DakDataDictionaryAnnexSchema,
  type DakAnnexSheet,
  type DakDataDictionaryAnnex,
} from "../../schemas/dak-annexes.ts";

/** What the web annex says about itself (`WebAnnexOfShape`). */
export interface WebAnnexOf {
  annexOf: string;
  label: string;
  section: string;
  iris?: string;
}

export const ANNEX_SCHEMA = DAK_DATA_DICTIONARY_SCHEMA;

/** Every entry of a zip, by name, inflated. */
export function unzip(buf: Uint8Array): Map<string, Uint8Array> {
  const b = Buffer.from(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip: no end-of-central-directory record");
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error("zip central directory is malformed");
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString("utf-8", p + 46, p + 46 + nameLen);
    const lName = b.readUInt16LE(local + 26);
    const lExtra = b.readUInt16LE(local + 28);
    const data = b.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
    out.set(name, method === 0 ? data : method === 8 ? inflateRawSync(data) : (() => { throw new Error(`${name}: zip method ${method} unsupported`); })());
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

/** The text of every `<t>` in an element (rich text runs joined). */
const textOf = (xml: string) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1]!)).join("");

/** Column letters to a zero-based index (`A` 0, `AA` 26). */
const colIndex = (ref: string) => [...ref.replace(/\d+$/, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Sheets in workbook order, each as rows of cell text (empty cells are ""). */
export function readWorkbook(buf: Uint8Array): { name: string; rows: string[][] }[] {
  const zip = unzip(buf);
  const str = (n: string) => { const e = zip.get(n); return e ? Buffer.from(e).toString("utf-8") : undefined; };
  const shared = [...(str("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
  const rels = new Map([...(str("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => {
    const a = m[1]!;
    return [/\bId="([^"]+)"/.exec(a)?.[1] ?? "", /\bTarget="([^"]+)"/.exec(a)?.[1] ?? ""] as const;
  }));
  const sheets: { name: string; rows: string[][] }[] = [];
  for (const m of (str("xl/workbook.xml") ?? "").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = decode(/\bname="([^"]*)"/.exec(m[1]!)?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(m[1]!)?.[1] ?? "";
    const target = (rels.get(rid) ?? "").replace(/^\/?xl\//, "");
    const xml = str(`xl/${target}`) ?? "";
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const c of r[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]!;
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const t = /\bt="([^"]+)"/.exec(attrs)?.[1];
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const text = t === "s" && v !== undefined ? shared[Number(v)] ?? "" : t === "inlineStr" ? textOf(body) : v !== undefined ? decode(v) : "";
        const at = ref ? colIndex(ref) : row.length;
        while (row.length < at) row.push("");
        row[at] = text;
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/** A header as a stable key: lowercased, `*` and a trailing parenthetical dropped, whitespace collapsed, singular. */
export function headerKey(h: string): string {
  return h.replace(/\*/g, "").replace(/\([^)]*\)\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase().replace(/s$/, "");
}

export type AnnexSheet = DakAnnexSheet;
export type DataDictionaryAnnex = DakDataDictionaryAnnex;

/** The data sheets of a data-dictionary workbook, as an annex. */
export function dataDictionaryAnnex(buf: Uint8Array, sourceLabel: string, of: WebAnnexOf): DataDictionaryAnnex {
  const ID = headerKey("Data element ID");
  const LABEL = headerKey("Data element label");
  const sheets: AnnexSheet[] = [];
  for (const s of readWorkbook(buf)) {
    // Both columns, in one row: READ ME's explanatory table names "Data element
    // ID" as a VALUE in a single column, and is not a data sheet.
    const hi = s.rows.findIndex((r) => r.some((c) => headerKey(c) === ID) && r.some((c) => headerKey(c) === LABEL));
    if (hi < 0) continue;
    const header = s.rows[hi]!;
    const keep = header.map((h, i) => ({ i, label: h.replace(/\s+/g, " ").trim(), key: headerKey(h) })).filter((c) => c.key);
    const idAt = keep.find((c) => c.key === ID)!.i;
    const rows = s.rows
      .slice(hi + 1)
      .filter((r) => (r[idAt] ?? "").trim())
      .map((r) => keep.map((c) => (r[c.i] ?? "").trim()));
    sheets.push({ name: s.name, columns: keep.map(({ key, label }) => ({ key, label })), rows });
  }
  // Parsed on the way out, so a file this writes is one its validator accepts.
  return DakDataDictionaryAnnexSchema.parse({
    $schema: ANNEX_SCHEMA,
    annexOf: of.annexOf,
    label: of.label,
    ...(of.iris ? { iris: of.iris } : {}),
    section: of.section,
    title: "Core data dictionary",
    source: { label: sourceLabel, sha256: createHash("sha256").update(buf).digest("hex") },
    idColumn: ID,
    sheets,
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const xlsx = opt("--xlsx");
  const out = opt("--out");
  const annexOf = opt("--annex-of");
  const label = opt("--label");
  const section = opt("--section");
  if (!xlsx || !out || !annexOf || !label || !section) {
    console.error("usage: dak-data-dictionary.ts --xlsx <workbook> --out <annex.json> --annex-of <ref> --label <label> --section <kind#section> [--iris <handle>] [--source <label>]");
    process.exit(2);
  }
  const iris = opt("--iris");
  const annex = dataDictionaryAnnex(readFileSync(xlsx), opt("--source") ?? xlsx, { annexOf, label, section, ...(iris ? { iris } : {}) });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(annex, null, 1)}\n`);
  console.error(`${out}: ${annex.sheets.map((s) => `${s.name} (${s.rows.length})`).join(", ")}`);
}
