#!/usr/bin/env bun
/**
 * publish-extracted-statements — every statement extracted from a library
 * source, published as a readable page, each one linked to its library entry
 * and to the section it came from. `--check` fails when the page is stale.
 *
 * The executable half of the standard step of the same name
 * (`skills/library/ingestion/publish-extracted-statements.md`,
 * `processes/library/publish-extracted-statements.bpmn`).
 *
 * ## What is generic here, and what the caller supplies
 *
 * Generic, and so here: reading `folio-extracted-statements/v1` lists,
 * resolving each source through {@link resolveLibraryRef}, finding the section
 * a page falls in from the entry's `structure.json`, labelling it in the
 * source's own unit ("Catch up schedule, slide 7"), rendering the table, and
 * the check mode.
 *
 * The caller's, and so a committed page spec (`folio-statement-page/v1`):
 * where its page goes, the URLs of its library viewer and of its sources, the
 * page's title and introduction, and the content type's look (for example the
 * kramdown class an implementation guide's pages use). A spec rather than
 * flags because those are free text, and free text is never a command-line
 * word. How a
 * folio's own extraction becomes a statement list is the folio's or its
 * content layer's collector, never this script's.
 *
 * ## A statement with no resolvable source is never published without a link
 *
 * It is reported and the run exits 1, writing nothing. A page that quietly
 * dropped the link would be exactly the untraceable statement this step
 * exists to prevent.
 *
 * ## The section a page falls in
 *
 * The section that STARTS latest at or before the page. Sections of a paged
 * source share boundary pages, so "contains the page" is ambiguous and
 * "starts at or before" is not. When several sections start on that same page
 * (a one-page poster, cut into many short sections), none of them is the
 * section, and the label names only the page. The front matter the PDF rung
 * synthesises (`sec-front-matter`) is never the section while an authored one
 * starts at or before the page.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { readStructure, type BaseSection, type BaseStructure } from "@litlfred/cat-harness-tools/schemas/content/document-structure.ts";
import { explainFailure, resolveLibraryRef } from "../schemas/library-ref.ts";
import {
  EXTRACTED_STATEMENTS_SCHEMA_ID,
  ExtractedStatementsSchema,
  STATEMENT_PAGE_SCHEMA_ID,
  StatementPageSchema,
  libraryRefOf,
  type ExtractedStatement,
  type ExtractedStatements,
  type StatementPage,
} from "../schemas/extracted-statement.ts";

/** The unit a source counts its places in, as a reader says it. */
export function unitOf(structure: BaseStructure): { one: string; many: string } {
  const first = structure.sections[0]?.locator.kind;
  if (structure.variant === "notebook" || first === "cells") return { one: "cell", many: "cells" };
  if (structure.variant === "text" || first === "lines") return { one: "line", many: "lines" };
  const granularity = (structure.raw as { granularity?: unknown }).granularity;
  return granularity === "slide" ? { one: "slide", many: "slides" } : { one: "page", many: "pages" };
}

/**
 * The section a page falls in: the one that starts latest at or before it,
 * or none when several start on that page. Only paged sources have pages.
 */
/**
 * The section `pdf-structure.py` synthesises for the pages before the first
 * real one. It is not a section the author wrote, so a statement is placed in
 * it only when no authored section starts at or before its page.
 */
export const FRONT_MATTER_SECTION_ID = "sec-front-matter";

export function sectionForPage(sections: BaseSection[], page: number): BaseSection | undefined {
  const authored = sections.filter((s) => s.id !== FRONT_MATTER_SECTION_ID);
  const hit = startsLatestAtOrBefore(authored, page);
  if (hit !== null) return hit;
  return startsLatestAtOrBefore(sections.filter((s) => s.id === FRONT_MATTER_SECTION_ID), page) ?? undefined;
}

/** `null` when no section starts at or before the page; `undefined` when several tie. */
function startsLatestAtOrBefore(sections: BaseSection[], page: number): BaseSection | undefined | null {
  let bestStart = -Infinity;
  let best: BaseSection[] = [];
  for (const s of sections) {
    if (s.locator.kind !== "pages") continue;
    const start = s.locator.start;
    if (start > page) continue;
    if (start > bestStart) {
      bestStart = start;
      best = [s];
    } else if (start === bestStart) {
      best.push(s);
    }
  }
  if (best.length === 0) return null;
  return best.length === 1 ? best[0] : undefined;
}

/** "slide 7", "pages 3–5", "cells 2–9", "lines 10–40". */
export function locatorLabel(unit: { one: string; many: string }, start: number, end: number): string {
  return start === end ? `${unit.one} ${start}` : `${unit.many} ${start}–${end}`;
}

export interface ResolvedSource {
  libraryId: string;
  /** The section file, relative to the repository root, when a section was determined. */
  sectionPath?: string;
  /** What the section link reads: the section's title and where it is, or only where. */
  label: string;
}

export type Resolution = { ok: true; source: ResolvedSource } | { ok: false; reason: string };

/** Resolve one statement's source to its entry, its section and its label. */
export function resolveSource(s: ExtractedStatement, instanceRoot: string, repoRoot: string): Resolution {
  const entry = resolveLibraryRef({ ...libraryRefOf(s.source), sectionId: undefined }, instanceRoot, repoRoot);
  if (!entry.ok) return { ok: false, reason: explainFailure(entry.failure) };
  const entryDir = dirname(entry.path);
  const structure = readStructure(entryDir);
  if ("reason" in structure) return { ok: false, reason: structure.reason };
  const unit = unitOf(structure);

  let section: BaseSection | undefined;
  if (s.source.sectionId !== undefined) {
    section = structure.sections.find((x) => x.id === s.source.sectionId);
    if (!section) return { ok: false, reason: `${s.source.libraryId} has no section ${s.source.sectionId}` };
  } else if (s.source.page !== undefined) {
    section = sectionForPage(structure.sections, s.source.page);
  } else {
    return { ok: false, reason: "names neither a section nor a page, so where it came from cannot be shown" };
  }

  const where =
    s.source.page !== undefined
      ? locatorLabel(unit, s.source.page, s.source.page)
      : section && section.locator.kind !== "lines"
        ? locatorLabel(unit, section.locator.start, section.locator.end)
        : section && section.locator.kind === "lines"
          ? `${section.locator.file}, ${locatorLabel(unit, section.locator.start, section.locator.end)}`
          : "";
  if (!section) return { ok: true, source: { libraryId: s.source.libraryId, label: where } };

  const file = resolve(entryDir, "sections", `${section.id}.md`);
  if (!existsSync(file)) return { ok: false, reason: `section file ${relative(repoRoot, file)} is absent` };
  return {
    ok: true,
    source: {
      libraryId: s.source.libraryId,
      sectionPath: relative(repoRoot, file),
      // A section named for its own place ("Page 12") is not said twice.
      label: where && where.toLowerCase() !== section.title.toLowerCase() ? `${section.title}, ${where}` : section.title,
    },
  };
}

export interface RenderOptions {
  title: string;
  intro?: string;
  /** Prefix of a library entry's page: the entry's link is `<entryBase>/<libraryId>/`. */
  entryBase: string;
  /** Prefix of a section's source file: its link is `<sectionBase>/<repo-relative path>`. */
  sectionBase: string;
  /** Written on the line after each table: the content type's look, e.g. `{:.grid}`. */
  tableAttr?: string;
}

/**
 * A table cell: one line, with its backslashes escaped BEFORE its pipes, so a
 * statement ending in `\` cannot turn the escape of the next pipe into a
 * literal backslash and break the row.
 */
export function cell(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").trim();
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** The page, as Markdown. Deterministic: the same lists give the same bytes. */
export function renderPage(
  lists: Array<{ list: ExtractedStatements; resolved: ResolvedSource[] }>,
  o: RenderOptions,
): string {
  const out: string[] = [
    "<!-- GENERATED by folio-assistant-core/scripts/publish-extracted-statements.ts. Do not edit: change the extraction or the source, and regenerate. -->",
    "",
    `# ${o.title}`,
    "",
  ];
  if (o.intro) out.push(o.intro.trim(), "");
  for (const { list, resolved } of lists) {
    if (list.title) out.push(`## ${list.title}`, "");
    if (list.statements.length === 0) {
      out.push("_No statements were extracted._", "");
      continue;
    }
    // A "Derived from" column only for a list that has one, so every other page is unchanged.
    const derived = list.statements.some((s) => s.derivedFrom !== undefined);
    out.push(
      derived ? "| Id | Statement | Kind | Status | Derived from | Source |" : "| Id | Statement | Kind | Status | Source |",
      derived ? "|---|---|---|---|---|---|" : "|---|---|---|---|---|",
    );
    list.statements.forEach((s, i) => {
      const r = resolved[i]!;
      const entryLink = `[${cell(r.libraryId)}](${trimSlash(o.entryBase)}/${r.libraryId}/)`;
      const sectionLink = r.sectionPath
        ? `[${cell(r.label)}](${trimSlash(o.sectionBase)}/${r.sectionPath})`
        : cell(r.label);
      const source = sectionLink ? `${entryLink}: ${sectionLink}` : entryLink;
      const from = derived ? ` ${cell(s.derivedFrom ?? "")} |` : "";
      out.push(`| ${cell(s.id)} | ${cell(s.statement)} | ${cell(s.kind ?? "")} | ${cell(s.status ?? "")} |${from} ${source} |`);
    });
    if (o.tableAttr) out.push(o.tableAttr);
    out.push("");
  }
  return out.join("\n");
}

function readList(path: string): ExtractedStatements {
  const parsed = ExtractedStatementsSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${path}: not a ${EXTRACTED_STATEMENTS_SCHEMA_ID} list: ${issue?.path.join(".")}: ${issue?.message}`);
  }
  return parsed.data;
}

function readPage(path: string): StatementPage {
  const parsed = StatementPageSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${path}: not a ${STATEMENT_PAGE_SCHEMA_ID} spec: ${issue?.path.join(".")}: ${issue?.message}`);
  }
  return parsed.data;
}

/** Build one page from its spec: 0 when written or current, 1 when stale or a source does not resolve. */
export function publishPage(specPath: string, o: { check: boolean; instanceRoot: string; repoRoot: string }): number {
  const spec = readPage(specPath);
  const base = dirname(resolve(specPath));
  const read: Array<{ list: ExtractedStatements; resolved: ResolvedSource[] }> = [];
  const unresolved: string[] = [];
  for (const rel of spec.statements) {
    const path = resolve(base, rel);
    const list = readList(path);
    const resolved: ResolvedSource[] = [];
    for (const s of list.statements) {
      const r = resolveSource(s, o.instanceRoot, o.repoRoot);
      if (r.ok) resolved.push(r.source);
      else unresolved.push(`${relative(o.repoRoot, path)}: ${s.id}: ${r.reason}`);
    }
    read.push({ list, resolved });
  }
  const out = resolve(base, spec.out);
  const shown = relative(process.cwd(), out);
  if (unresolved.length > 0) {
    console.error(`✗ ${shown}: ${unresolved.length} statement(s) whose source does not resolve; nothing written:`);
    for (const u of unresolved) console.error(`  ${u}`);
    return 1;
  }
  const page = renderPage(read, spec);
  const previous = existsSync(out) ? readFileSync(out, "utf8") : undefined;
  if (o.check) {
    if (previous !== page) {
      console.error(`✗ ${shown} is stale: regenerate it without --check`);
      return 1;
    }
    console.log(`✓ ${shown} is current`);
    return 0;
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page);
  const n = read.reduce((t, r) => t + r.list.statements.length, 0);
  console.log(`${previous === page ? "=" : "✓"} ${shown}: ${n} statement(s)`);
  return 0;
}

const USAGE = `Usage: bun run folio-assistant-core/scripts/publish-extracted-statements.ts \\
  --page SPEC.json [--page SPEC2.json …] [--instance-root DIR] [--repo-root DIR] [--check]
SPEC.json is a ${STATEMENT_PAGE_SCHEMA_ID} spec (schemas/extracted-statement.ts).`;

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const pages: string[] = [];
  let check = false;
  let repoRoot = process.cwd();
  let instanceRoot: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--check") check = true;
    else if (a === "--page") pages.push(argv[++i] ?? "");
    else if (a === "--repo-root") repoRoot = argv[++i] ?? "";
    else if (a === "--instance-root") instanceRoot = argv[++i];
    else {
      console.error(`unexpected argument ${a}\n${USAGE}`);
      process.exit(2);
    }
  }
  if (pages.length === 0 || pages.some((p) => !p)) {
    console.error(`at least one --page is required\n${USAGE}`);
    process.exit(2);
  }
  repoRoot = resolve(repoRoot);
  let failed = 0;
  for (const p of pages) {
    try {
      failed += publishPage(p, { check, repoRoot, instanceRoot: resolve(instanceRoot ?? repoRoot) });
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(2);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}
