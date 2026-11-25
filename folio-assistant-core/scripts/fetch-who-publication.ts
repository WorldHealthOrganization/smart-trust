#!/usr/bin/env bun
/**
 * Fetch one WHO publication from its who.int item page
 * (`https://www.who.int/publications/m/item/<slug>`, or `/publications/i/item/`)
 * into an `uploads/<doc_id>/` directory that `bun run cat ingest` takes as it
 * stands — the same three files `fetch-dspace-item.ts` writes for an IRIS item.
 *
 * Bean `mffs`. Most of what a DAK's Component 1 cites is on IRIS, and
 * `fetch-dspace-item.ts` takes it from the repository's own metadata. Some is
 * not: the immunizations DAK's routine-immunization summary tables, its
 * facility-data guidance and its COVID-19 monitoring metrics are who.int items
 * with no IRIS record. A who.int item page has no Dublin Core, no
 * `citation_*` tags and no API, so this reads the page's own structure — the
 * `dynamic-content__*` blocks WHO's CMS renders — and nothing else.
 *
 * It sits beside `fetch-dspace-item.ts` because both are acquisition routes
 * the DAK library step calls. It is WHO-specific, so its natural home is the
 * IRIS catalogue layer; that layer left this repository (for its own
 * repository) on 2026-10-07, and the move is a follow-up there.
 *
 * ## What it writes, and what it reads where
 *
 *   - the item's one download (a PDF), under its own filename;
 *   - `<doc_id>.dc.json`, a `folio-dublin-core/v1` record:
 *
 *     | field | from the page |
 *     |---|---|
 *     | `dc.title` | the `h1` heading |
 *     | `dc.title.alternative` | the line under it, when there is one ("Working document") |
 *     | `dc.date.issued` | the date block, as ISO 8601 |
 *     | `dc.type` | the tag after the date ("Publication", "Technical document", "Meeting report") |
 *     | `dc.description.abstract` | the Overview paragraphs, related-item links excluded |
 *     | `dc.format.extent` | "Number of pages", as `N p.` |
 *     | `dc.rights` | "Copyright" |
 *     | `dc.identifier.uri` | the item page itself |
 *
 *   - `intake.json`, naming the record and the PDF with its sha256.
 *
 * **The licence is left `unknown`.** A who.int item page states copyright,
 * not a licence; the licence WHO prints is on the PDF's own imprint page,
 * which is not item metadata, so the early licence step does not act on it
 * (`fetch-dspace-item.ts` holds the same line). The record says where it
 * looked.
 *
 * **A field the page does not carry is absent, never guessed** — no
 * publisher is inferred from the copyright line, no ISBN from the filename.
 *
 *   bun run folio-assistant-core/scripts/fetch-who-publication.ts <item page URL> --out uploads [--dry-run]
 *
 * Exit: 0 fetched (or reported), 1 the page has no single PDF or the site refused, 2 usage.
 *
 * @module folio-assistant-core/scripts/fetch-who-publication
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { IntakeSchema, INTAKE_SCHEMA_TAG, type Intake } from "@litlfred/cat-harness-tools/schemas/library/intake.ts";
import { safeSegment } from "@litlfred/cat-harness-tools/src/core/safe-path.js";
import { DUBLIN_CORE_SCHEMA_TAG, DublinCoreRecordSchema, type DcField, type DublinCoreRecord } from "../schemas/dublin-core.ts";
import { assertHttpsHost, fetchChecked } from "./lib/safe-url.ts";

/** Expected hosts for WHO publication item pages and their PDF download bitstreams. */
export const ALLOWED_WHO_HOSTS: ReadonlySet<string> = new Set([
  "www.who.int",
  "cdn.who.int",
  "iris.who.int",
  "apps.who.int",
]);
const WHO_ITEM_PAGE_HOSTS: ReadonlySet<string> = new Set(["www.who.int"]);

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const decode = (s: string): string =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** "1 February 2018" → "2018-02-01"; undefined when it is not that shape. */
export function isoDate(s: string): string | undefined {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(s.trim());
  const month = m ? MONTHS.indexOf(m[2]!.toLowerCase()) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : undefined;
}

export interface WhoItemPage {
  title: string;
  subtitle?: string;
  date?: string;
  type?: string;
  overview?: string;
  details: Record<string, string>;
  downloads: string[];
}

/** Read a who.int item page's `dynamic-content__*` blocks. Nothing outside them. */
export function readItemPage(html: string): WhoItemPage {
  const header = /<header class="dynamic-content__header[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
  const title = decode(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(header)?.[1] ?? "");
  if (!title) throw new Error("no dynamic-content__heading — not a who.int publication item page");
  const subtitle = decode(/<\/div>\s*<p>([\s\S]*?)<\/p>/.exec(header)?.[1] ?? "") || undefined;
  const date = decode(/dynamic-content__date">([\s\S]*?)<\/div>/.exec(header)?.[1] ?? "") || undefined;
  const type = decode(/dynamic-content__tag">([\s\S]*?)<\/div>/.exec(header)?.[1] ?? "").replace(/^\|\s*/, "") || undefined;
  // The Overview: paragraphs after its heading, up to the related-items accordion.
  const desc = /dynamic-content__description">([\s\S]*?)(?:<div id="dynamic-content__accordion"|<\/div>\s*<\/div>\s*<div class="col-md-4")/.exec(html)?.[1] ?? "";
  // Its paragraphs are <p> on some pages and <div> on others, so blocks are split on either.
  const overview =
    desc
      .replace(/<h3>[\s\S]*?<\/h3>/, "")
      .split(/<\/p>|<\/div>|<br\s*\/?>/i)
      .map(decode)
      .filter(Boolean)
      .join("\n\n") || undefined;
  const details: Record<string, string> = {};
  for (const m of html.matchAll(/<div class="label">([\s\S]*?)<\/div>\s*<div class="value">([\s\S]*?)<\/div>/g)) details[decode(m[1]!)] = decode(m[2]!);
  const figure = /dynamic-content__figure-container">([\s\S]*?)<\/div>\s*<div class="dynamic-content__description-container/.exec(html)?.[1] ?? "";
  const downloads = [...new Set([...figure.matchAll(/href=["']?([^"' >]+)/g)].map((m) => decode(m[1]!)))];
  return { title, subtitle, date, type, overview, details, downloads };
}

/** The page → a Dublin Core record. Only what the page states. */
export function pageToRecord(page: WhoItemPage, url: string, retrievedAt: string): DublinCoreRecord {
  const f = (element: string, value: string | undefined, qualifier?: string): DcField[] =>
    value ? [{ schema: "dc", element, ...(qualifier ? { qualifier } : {}), values: [{ value }] }] : [];
  const pages = page.details["Number of pages"];
  return DublinCoreRecordSchema.parse({
    $schema: DUBLIN_CORE_SCHEMA_TAG,
    id: new URL(url).pathname,
    fields: [
      ...f("title", page.title),
      ...f("title", page.subtitle, "alternative"),
      ...f("date", page.date ? isoDate(page.date) ?? page.date : undefined, "issued"),
      ...f("type", page.type),
      ...f("description", page.overview, "abstract"),
      ...f("format", pages ? `${pages} p.` : undefined, "extent"),
      ...f("rights", page.details["Copyright"]),
      ...f("identifier", url, "uri"),
    ],
    provenance: { source: url, retrievedAt, method: "who.int publication item page, HTML (dynamic-content blocks)" },
  });
}

/** The PDF's filename from its URL, query and fragment dropped. */
export const fileNameOf = (href: string): string => decodeURIComponent(new URL(href).pathname.split("/").pop()!);

export interface Fetched {
  docId: string;
  pdf: Buffer;
  pdfName: string;
  record: DublinCoreRecord;
  intake: Intake;
}

export async function fetchWhoPublication(
  url: string,
  now = new Date(),
  fetcher: typeof fetch = fetch,
  allowedHosts: ReadonlySet<string> = ALLOWED_WHO_HOSTS,
): Promise<Fetched> {
  assertHttpsHost(url, WHO_ITEM_PAGE_HOSTS);
  if (!/^https:\/\/www\.who\.int\/publications\/[a-z]\/item\//.test(url)) throw new Error(`${url} is not a who.int publication item page (…/publications/<m|i>/item/<slug>)`);
  const { response: res } = await fetchChecked(
    url,
    WHO_ITEM_PAGE_HOSTS,
    { headers: { "user-agent": "fetch-who-publication" } },
    fetcher,
  );
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const page = readItemPage(await res.text());
  const pdfs = page.downloads.filter((d) => /\.pdf(\?|$)/i.test(d));
  // More than one is a choice (language editions, annexes) and is refused, not guessed.
  if (pdfs.length !== 1) throw new Error(`${url}: ${pdfs.length} PDF download(s) (${page.downloads.join(", ") || "none"}) — name the one to ingest`);
  const href = assertHttpsHost(pdfs[0]!, allowedHosts, url).href;
  const { response: got } = await fetchChecked(href, allowedHosts, {}, fetcher);
  if (!got.ok) throw new Error(`${href}: HTTP ${got.status}`);
  const pdf = Buffer.from(await got.arrayBuffer());
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`${href}: not a PDF (starts ${JSON.stringify(pdf.subarray(0, 8).toString())})`);
  const pdfName = fileNameOf(href);
  const docId = pdfName.replace(/\.pdf$/i, "");
  if (safeSegment(pdfName) === undefined || safeSegment(docId) === undefined) {
    throw new Error(`Refused unsafe PDF filename '${pdfName}'`);
  }
  const retrievedAt = now.toISOString().replace(/\.\d+Z$/, "Z");
  const record = pageToRecord(page, url, retrievedAt);
  const intake = IntakeSchema.parse({
    $schema: INTAKE_SCHEMA_TAG,
    doc_id: docId,
    record: `${docId}.dc.json`,
    _comment: `Fetched from ${url} by folio-assistant-core/scripts/fetch-who-publication.ts; the PDF is the page's one download, ${href}.`,
    source: { upstream: url, capturedAt: retrievedAt, capturedBy: "fetch-who-publication.ts (who.int item page)" },
    files: [{ path: pdfName, bytes: pdf.length, sha256: createHash("sha256").update(pdf).digest("hex"), type: "publication", role: "original-bitstream", note: `downloaded from ${href}` }],
    licence: {
      status: "unknown",
      searched: [{ where: `${url}, item page`, result: page.details["Copyright"] ? `states copyright only ('${page.details["Copyright"]}'), no licence` : "no copyright or licence stated" }],
    },
  });
  return { docId, pdf, pdfName, record, intake };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outAt = args.indexOf("--out");
  const url = args.find((a, i) => !a.startsWith("--") && i !== outAt + 1);
  if (!url || outAt < 0 || !args[outAt + 1]) {
    console.error("usage: fetch-who-publication.ts <who.int item page URL> --out <uploads dir> [--dry-run]");
    process.exit(2);
  }
  try {
    const f = await fetchWhoPublication(url);
    const dir = join(args[outAt + 1]!, f.docId);
    console.log(`${url} -> ${dir}/${f.pdfName} (${f.pdf.length} bytes)`);
    for (const fl of f.record.fields) console.log(`  dc.${fl.element}${fl.qualifier ? `.${fl.qualifier}` : ""}: ${fl.values[0]!.value.slice(0, 100)}`);
    if (args.includes("--dry-run")) process.exit(0);
    if (existsSync(join(dir, "intake.json"))) {
      console.error(`  ${dir}/intake.json exists — not overwritten (an intake may carry a person's corrections)`);
      process.exit(1);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, f.pdfName), f.pdf);
    writeFileSync(join(dir, `${f.docId}.dc.json`), `${JSON.stringify(f.record, null, 2)}\n`);
    writeFileSync(join(dir, "intake.json"), `${JSON.stringify(f.intake, null, 2)}\n`);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
