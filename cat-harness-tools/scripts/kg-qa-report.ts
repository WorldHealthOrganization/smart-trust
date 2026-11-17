/**
 * kg-qa-report — the KNOWLEDGE-GRAPH half of a site's QA report: what the
 * harness's graph checks recorded for each layer of a checkout, and where
 * the site publishes the harness's own view of that QA.
 *
 * Owner, 2026-11-06: *"QA report should link to harness QA reports = FHIR QA
 * reports + KG QA"*. The FHIR half is the layer that builds an IG's; this
 * module is the other half, and knows nothing of FHIR or of any IG. A layer
 * above composes the two into one page (an IG layer's QA page).
 *
 * Two sources, both read off declarations, never a path:
 *
 * - the **records**: every `*.qa-results.json` (`qa-results/v1`) in the
 *   directories a layer declares for the `qa` graph. A file that does not
 *   parse, or is not `qa-results/v1`, is listed as unreadable rather than
 *   dropped: a page that silently omits a record reads as one with nothing to
 *   report. A layer whose `qa` directory holds none says so; for a
 *   mounted layer that is the usual case, since its records are computed and
 *   kept on its own store (`layer-qa.ts`), not in the mount;
 * - the **view**: the visualiser some layer declares over the `qa` kind
 *   with per-instance sub-graphs (the state viewer's `qa` page), at its
 *   localised route — the whole graph, and one sub-page per layer holding
 *   a `qa` directory. Nothing is linked that no declaration names.
 *
 * @module scripts/kg-qa-report
 * @graphNode none — a reader and renderer over QA records other checks wrote
 * @covers none — it publishes QA records other checks wrote, and judges nothing
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { instanceDirectoriesForGraph, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { visualiserRoute } from "../schemas/kg/visualiser-route.ts";
import { checkoutInstanceRoots, declaredVisualisers, pageParts } from "./viewer-declarations.ts";

/**
 * The subject kind of the record `translation:glossary` writes. A record of
 * this kind is drawn as a "Glossary consistency" section, one sub-section per
 * locale (one family each), rather than as a generic table.
 */
export const GLOSSARY_SUBJECT_KIND = "glossary-consistency";

/** One family of a `qa-results/v1` record. */
export interface QaFamily {
  summary?: string;
  count?: number;
  entries?: unknown[];
}

/** A `*.qa-results.json` file, parsed, or the reason it could not be. */
export interface QaRecord {
  file: string;
  record?: {
    $schema?: string;
    producer?: { script?: string; script_hash?: string };
    subject?: { kind?: string; id?: string };
    families?: Record<string, QaFamily>;
    total?: number;
  };
  unreadable?: string;
}

/** Every `*.qa-results.json` in `dirs`, parsed, in a stable order. */
export function readQaRecords(dirs: readonly string[]): QaRecord[] {
  const out: QaRecord[] = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".qa-results.json")).sort()) {
      const file = join(dir, f);
      try {
        const record = JSON.parse(readFileSync(file, "utf-8"));
        if (record?.$schema !== "qa-results/v1") out.push({ file, unreadable: `not qa-results/v1 (${JSON.stringify(record?.$schema)})` });
        else out.push({ file, record });
      } catch (e) {
        out.push({ file, unreadable: `does not parse: ${(e as Error).message}` });
      }
    }
  }
  return out;
}

/** One layer's KG QA: its declared `qa` directories, the records in them, and its page in the view. */
export interface KgQaInstance {
  instance: string;
  /** Absolute. Empty when the layer declares no `qa` directory. */
  dirs: string[];
  records: QaRecord[];
  /** Site-root-relative route of this layer's sub-page of the view, when one is declared. */
  page?: string;
}

export interface KgQaReport {
  /** Site-root-relative route of the whole `qa` view, when a layer declares one. */
  view?: string;
  instances: KgQaInstance[];
}

/** The declared visualiser over the `qa` kind that draws one sub-page per layer. */
function qaView(repoRoot: string): { harness: string; id: string } | undefined {
  const v = declaredVisualisers(repoRoot).find((x) => (x.coversKinds ?? []).includes("qa") && x.subgraphs === "instance");
  return v ? { harness: v.harness, id: v.id } : undefined;
}

/**
 * The KG QA of every layer in the checkout at `repoRoot` that declares a
 * `qa` directory, and of `subject` (the layer the site is about) whether
 * or not it declares one: it is listed FIRST, so a site that records no QA of
 * its own says so rather than showing only its layers'.
 */
export function kgQaReport(repoRoot: string, subject?: string): KgQaReport {
  const view = qaView(repoRoot);
  const route = (sub?: string) => (view ? visualiserRoute(pageParts({ harness: view.harness, visualiser: view.id, ...(sub ? { subgraph: sub } : {}) })) : undefined);
  const instances: KgQaInstance[] = [];
  for (const root of checkoutInstanceRoots(repoRoot)) {
    const instance = readDeclaration(root)?.name;
    if (!instance) continue;
    let dirs: string[] = [];
    try {
      dirs = instanceDirectoriesForGraph(root, "qa");
    } catch {
      dirs = [];
    }
    if (!dirs.length && instance !== subject) continue;
    const page = dirs.length ? route(instance) : undefined;
    instances.push({ instance, dirs, records: readQaRecords(dirs), ...(page ? { page } : {}) });
  }
  instances.sort((a, b) => (a.instance === subject ? -1 : b.instance === subject ? 1 : a.instance.localeCompare(b.instance)));
  const all = route();
  return { ...(all ? { view: all } : {}), instances };
}

/** Where a record is published under `assets`: one directory per layer, so two layers' same-named records never collide. */
export function recordHref(assets: string, instance: string, file: string): string {
  return `${assets.replace(/\/$/, "")}/${instance}/${basename(file)}`;
}

/** Copy every readable record to `<site>/<assets>/<instance>/`. Returns how many were copied. */
export function copyKgQaRecords(report: KgQaReport, site: string, assets: string): number {
  let n = 0;
  for (const i of report.instances) {
    for (const r of i.records) {
      if (r.unreadable) continue;
      const to = join(site, recordHref(assets, i.instance, r.file));
      mkdirSync(join(to, ".."), { recursive: true });
      copyFileSync(r.file, to);
      n++;
    }
  }
  return n;
}

const cell = (v: unknown): string => {
  const s = typeof v === "string" ? v : v === undefined || v === null ? "" : JSON.stringify(v);
  return s.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
};

/** A record's findings, as the sum of its families when it gives no total. */
export function recordTotal(r: NonNullable<QaRecord["record"]>): number {
  return r.total ?? Object.values(r.families ?? {}).reduce((n, f) => n + (f.count ?? f.entries?.length ?? 0), 0);
}

/**
 * The section's Markdown, headings from `level` down. Data, not Liquid: the
 * caller wraps it in `{% raw %}`. Every href is site-root-relative, prefixed
 * with `up` (the way from the page to the site root).
 */
export function kgQaMarkdown(report: KgQaReport, o: { assets: string; up?: string; level?: number } = { assets: "assets/kg-qa" }): string[] {
  const up = o.up ?? "";
  const h = "#".repeat(o.level ?? 2);
  const lines: string[] = [];
  lines.push(
    report.view
      ? `The harness's checks over the knowledge graph, as each instance recorded them. [Every instance's QA](${up}${report.view}) is the harness's own view of the same graph.`
      : "The harness's checks over the knowledge graph, as each instance recorded them. No instance of this site declares a view of the `qa` graph.",
    "",
  );
  if (!report.instances.length) lines.push("No instance of this site declares a `qa` directory.", "");
  // A mounted layer's records are computed and kept on its own store, not in the mount: say so once, rather than print a zero.
  if (report.instances.some((i) => i.dirs.length && !i.records.length)) {
    lines.push("An instance with no records in this checkout keeps them on its own QA store, keyed by commit; its view says what that store holds.", "");
  }
  if (report.instances.length) {
    lines.push("| instance | records | findings | view |", "|---|---|---|---|");
    for (const i of report.instances) {
      const ok = i.records.filter((r) => r.record);
      const bad = i.records.length - ok.length;
      const findings = ok.reduce((n, r) => n + recordTotal(r.record!), 0);
      const records = !i.dirs.length ? "declares no `qa` directory" : !i.records.length ? "none in this checkout" : `${ok.length}${bad ? ` (+${bad} unreadable)` : ""}`;
      lines.push(`| \`${i.instance}\` | ${records} | ${ok.length ? findings : "—"} | ${i.page ? `[${i.instance}](${up}${i.page})` : "—"} |`);
    }
    lines.push("");
  }
  for (const i of report.instances) {
    if (!i.records.length) continue;
    lines.push(`${h} \`${i.instance}\``, "");
    for (const r of i.records) {
      const name = basename(r.file).replace(/\.qa-results\.json$/, "");
      if (r.unreadable) {
        lines.push(`**${name}: unreadable.** \`${basename(r.file)}\` ${r.unreadable}.`, "");
        continue;
      }
      const rec = r.record!;
      if (rec.subject?.kind === GLOSSARY_SUBJECT_KIND) {
        lines.push(...glossaryConsistencyMarkdown(rec, { href: `${up}${recordHref(o.assets, i.instance, r.file)}`, level: (o.level ?? 2) + 1 }));
        continue;
      }
      const total = recordTotal(rec);
      lines.push(
        `**${name}:** ${total === 0 ? "no findings" : `${total} finding(s)`}, written by \`${rec.producer?.script ?? "?"}\`` +
          `${rec.subject?.id ? ` about \`${rec.subject.id}\`` : ""}. [Record (JSON)](${up}${recordHref(o.assets, i.instance, r.file)})`,
        "",
      );
      const fams = Object.entries(rec.families ?? {});
      if (fams.length) {
        lines.push("| check | what it reports | findings |", "|---|---|---|");
        for (const [id, f] of fams) lines.push(`| \`${id}\` | ${cell(f.summary)} | ${f.count ?? f.entries?.length ?? 0} |`);
        lines.push("");
      }
      for (const [id, f] of fams) {
        const entries = (f.entries ?? []).filter((e) => e !== undefined);
        if (!entries.length) continue;
        const cols = [...new Set(entries.flatMap((e) => (e && typeof e === "object" && !Array.isArray(e) ? Object.keys(e) : ["value"])))];
        lines.push(`<details><summary><code>${id}</code>: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}</summary>`, "", `| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`);
        for (const e of entries) {
          const row = e && typeof e === "object" && !Array.isArray(e) ? (e as Record<string, unknown>) : { value: e };
          lines.push(`| ${cols.map((c) => cell(row[c])).join(" | ")} |`);
        }
        lines.push("", "</details>", "");
      }
    }
  }
  return lines;
}

/**
 * A glossary-consistency record (`translation:glossary`) as its own section:
 * one sub-section per locale, its summary (fixed terms, catalogues, sense-check
 * notes) and its findings by rule.
 */
export function glossaryConsistencyMarkdown(rec: NonNullable<QaRecord["record"]>, o: { href: string; level?: number }): string[] {
  const h = "#".repeat(o.level ?? 3);
  const total = recordTotal(rec);
  const lines = [
    `${h} Glossary consistency`,
    "",
    `${total === 0 ? "No findings" : `${total} finding(s)`} against the term base merged from the layers' glossaries, ` +
      `written by \`${rec.producer?.script ?? "?"}\`${rec.subject?.id ? ` about \`${rec.subject.id}\`` : ""}. [Record (JSON)](${o.href})`,
    "",
  ];
  for (const [locale, f] of Object.entries(rec.families ?? {})) {
    const entries = (f.entries ?? []) as Array<Record<string, unknown>>;
    const inSense = entries.filter((e) => e.rule === "not-fixed-rendering").length;
    lines.push(
      `${h}# ${locale}`,
      "",
      `${cell(f.summary)}. ${entries.length === 0 ? "No findings." : `${entries.length} finding(s), ${inSense} of them in-sense violation(s):`}`,
      "",
    );
    if (entries.length) {
      lines.push("| rule | term | fixed (layer) | where | rendering |", "|---|---|---|---|---|");
      for (const e of entries) {
        const rule = `\`${cell(e.rule)}\`${e.inSense ? ` (in sense by ${e.inSense === "rule" ? "rule" : "verdict"})` : ""}`;
        lines.push(
          `| ${rule} | ${cell(e.term)} | ${e.fixed ? `${cell(e.fixed)} (${cell(e.layer)})` : "—"} | ${e.catalogue ? `\`${cell(e.catalogue)}\`` : "—"} | ${cell(e.rendering)} |`,
        );
      }
      lines.push("");
    }
    lines.push(...adjudicationMarkdown((f as GlossaryFamily).adjudication, `${h}##`));
  }
  return lines;
}

/** A glossary family's adjudication lists, as `translation:glossary` records them beside its findings. */
interface GlossaryFamily extends QaFamily {
  adjudication?: Partial<Record<"pending" | "otherSense" | "exceptions", Array<Record<string, unknown>>>>;
}

/**
 * The uses of a term whose sense an adjudicator decides: pending (listed,
 * failing nothing), ruled other-sense (not checked) and exceptions (in sense,
 * the fixed translation ruled wrong there; passing).
 */
function adjudicationMarkdown(a: GlossaryFamily["adjudication"], h: string): string[] {
  if (!a) return [];
  const lines: string[] = [];
  const parts: Array<[string, Array<Record<string, unknown>>, string]> = [
    ["Exceptions", a.exceptions ?? [], "in sense, but the fixed translation was ruled wrong here; they pass"],
    ["Pending adjudication", a.pending ?? [], "a term of another subject area, not yet ruled on; they fail nothing"],
    ["Other sense", a.otherSense ?? [], "ruled another concept; not checked"],
  ];
  for (const [title, list, what] of parts) {
    if (!list.length) continue;
    lines.push(`${h} ${title}`, "", `${list.length} use(s): ${what}.`, "", "| term | fixed (layer) | where | sentence | ruling |", "|---|---|---|---|---|");
    for (const o of list) {
      lines.push(
        `| ${cell(o.term)} | ${cell(o.fixed)} (${cell(o.layer)}) | \`${cell(o.catalogue)}\` | ${cell(String(o.msgid ?? "").slice(0, 120))} | ${o.reason ? `${cell(o.reason)} (${cell(o.decidedBy)})` : "—"} |`,
      );
    }
    lines.push("");
  }
  return lines;
}
