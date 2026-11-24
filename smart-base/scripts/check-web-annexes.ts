#!/usr/bin/env bun
/**
 * check-web-annexes.ts — what a WHO publication's web annexes SAY is
 * consistent, not only how they are shaped. (`check-dak-annexes.ts` until
 * 2026-10-24, when the `dak-annex` kind widened into `web-annex` for L1 and
 * L2 annexes alike; `check:dak-annexes` is kept as an alias of
 * `check:web-annexes`, because folio-assistant's gates call it.)
 *
 * The `web-annex` kind (typologies/web-annex.json) is TYPED by its validators:
 * `check:kind-validators` parses every node against `dak-data-dictionary/v1`
 * or `dak-swimlanes/v1`. Typing is not judging (`audit-coverage`: a kind can
 * parse perfectly while nothing has an opinion about what it says), and the
 * kind read `typed-only` the day it arrived (folio-assistant#2529). This is
 * the opinion, kept to rules a schema cannot state:
 *
 * - **which publication, which section** — every node's `section`
 *   (`<kind>#<section>`) names a section of a document kind some layer
 *   declares (`document-kind/1.0.0`, e.g. `smart-base/document-kinds/dak.json`),
 *   counting the sections a kind `extends`; and its `annexOf`, when it is a
 *   library entry (`<instance>/library/<slug>`), is an entry this checkout
 *   holds. An IRIS handle (`annexOf`, or the optional `iris`) is a WHO record
 *   this check cannot open, and the run says it is not verified rather than
 *   counting it as resolved.
 * - **data dictionary** — every sheet that has rows declares the `idColumn`;
 *   every row has exactly one cell per column; every data element id is
 *   present, and no id is used twice across the workbook. A repeated or empty
 *   id is a dictionary a reader cannot look a data element up in.
 * - **swimlanes** — no lane word is BOTH a persona's alias (or its name) and a
 *   declared not-a-persona, and no alias belongs to two personas. Either makes
 *   the mapping `dak-swimlanes.ts` reads ambiguous, and a lane would be linked
 *   to whichever entry it met first.
 *
 * - **references** — what the annexes name resolves in the SAME layer's
 *   artefact index (the directory it declares `fhir-artifact-index`): every
 *   data element id belongs to a CodeSystem the index lists (`IMMZ.C.DE.1` to
 *   `IMMZ.C`), and every annex record in the index's `annexes.json` names a
 *   file that exists and, for a dictionary, columns every sheet with rows
 *   has. Persona aliases are NOT resolved: the index carries no persona
 *   artefact to resolve them against, and the run says so rather than
 *   counting them as resolved. A layer that holds no `index.json` (an IG
 *   repository commits none; fhir-harness builds it at publish, its #124)
 *   has its ids reported UNRESOLVED, said and not counted, rather than
 *   failed: there is nothing here to resolve them against, which is not
 *   the same as an id that resolves to nothing.
 * - **annex records** — the `annexes.json` of every `ig-annex` directory the
 *   same layer declares (fhir-harness's contract, `ig-annexes/v1`,
 *   `{ $schema, annexes: [...] }`; an IG repository's web-annex directory
 *   nests inside one) is judged as an index's is.
 *
 * Every `web-annex` directory any layer in the checkout declares is read,
 * through the declarations — never a hard-coded path.
 *
 *   bun run smart-base/scripts/check-web-annexes.ts
 *
 * Exit: 0 consistent, 1 a finding, 2 nothing to judge could be read.
 *
 * @module smart-base/scripts/check-web-annexes
 * @covers web-annex
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { DOCUMENT_KIND_SCHEMA_TAG, directoriesForGraph, layerRootsIn, readDeclaration, repoRootFor } from "../platform/index.js";
import {
  IRIS_HANDLE,
  LIBRARY_ENTRY_REF,
  DAK_DATA_DICTIONARY_SCHEMA,
  DAK_SWIMLANES_SCHEMA,
  DakDataDictionaryAnnexSchema,
  DakSwimlaneMapSchema,
  type DakDataDictionaryAnnex,
  type DakSwimlaneMap,
} from "../schemas/dak-annexes.ts";

/** Findings about one data dictionary. */
export function judgeDictionary(d: DakDataDictionaryAnnex): string[] {
  const out: string[] = [];
  const seen = new Map<string, string>();
  for (const sheet of d.sheets) {
    if (sheet.rows.length === 0) continue;
    const idAt = sheet.columns.findIndex((c) => c.key === d.idColumn);
    if (idAt < 0) {
      out.push(`sheet "${sheet.name}" has rows but no "${d.idColumn}" column`);
      continue;
    }
    sheet.rows.forEach((row, i) => {
      const where = `sheet "${sheet.name}" row ${i + 1}`;
      if (row.length !== sheet.columns.length) out.push(`${where} has ${row.length} cell(s) for ${sheet.columns.length} column(s)`);
      const id = (row[idAt] ?? "").trim();
      if (id === "") {
        out.push(`${where} has no ${d.idColumn}`);
        return;
      }
      const first = seen.get(id);
      if (first !== undefined) out.push(`${d.idColumn} "${id}" is used twice: ${first} and ${where}`);
      else seen.set(id, where);
    });
  }
  return out;
}

/** Findings about one swimlane declaration. */
export function judgeSwimlanes(m: DakSwimlaneMap): string[] {
  const out: string[] = [];
  const owner = new Map<string, string>();
  for (const [persona, aliases] of Object.entries(m.personas)) {
    for (const word of [persona, ...aliases]) {
      const prior = owner.get(word);
      if (prior !== undefined && prior !== persona) out.push(`"${word}" names two personas: "${prior}" and "${persona}"`);
      else owner.set(word, persona);
    }
  }
  for (const lane of Object.keys(m.notPersonas)) {
    const persona = owner.get(lane);
    if (persona !== undefined) out.push(`"${lane}" is declared not a persona, and is also persona "${persona}"`);
  }
  return out;
}

/** The CodeSystem ids an artefact index lists (`index.json`, `artifacts[]`). */
export function codeSystemsIn(index: unknown): Set<string> {
  const arts = (index as { artifacts?: { resourceType?: unknown; id?: unknown }[] }).artifacts ?? [];
  return new Set(arts.filter((a) => a.resourceType === "CodeSystem" && typeof a.id === "string").map((a) => a.id as string));
}

/**
 * Findings about the data element ids a dictionary names: each must belong to
 * a CodeSystem the index lists, as a dot-separated prefix of the id.
 */
export function judgeDictionaryReferences(d: DakDataDictionaryAnnex, codeSystems: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const sheet of d.sheets) {
    const idAt = sheet.columns.findIndex((c) => c.key === d.idColumn);
    if (idAt < 0) continue; // judgeDictionary reports it
    sheet.rows.forEach((row, i) => {
      const id = (row[idAt] ?? "").trim();
      if (id === "") return; // judgeDictionary reports it
      const parts = id.split(".");
      const owned = parts.some((_, n) => n > 0 && codeSystems.has(parts.slice(0, n).join(".")));
      if (!owned) out.push(`sheet "${sheet.name}" row ${i + 1}: ${d.idColumn} "${id}" belongs to no CodeSystem the artefact index lists`);
    });
  }
  return out;
}

/** One record of an index's `annexes.json`: the page that shows an annex, the file it reads, and for a dictionary the columns it shows. */
export interface AnnexRecord {
  page?: string;
  file?: string;
  columns?: string[];
}

/**
 * Findings about the annex records of one index: each names a file that
 * exists (relative to the index directory), and each column a dictionary view
 * shows is a column of every sheet that has rows.
 */
export function judgeAnnexRecords(
  records: AnnexRecord[],
  indexDir: string,
  read: (abs: string) => string | undefined,
): string[] {
  const out: string[] = [];
  for (const r of records) {
    const label = r.page ?? r.file ?? "(unnamed record)";
    if (typeof r.file !== "string" || r.file === "") {
      out.push(`annex record "${label}" names no file`);
      continue;
    }
    const abs = resolve(indexDir, r.file);
    const text = read(abs);
    if (text === undefined) {
      out.push(`annex record "${label}" names ${r.file}, which does not exist`);
      continue;
    }
    if (!r.columns || r.columns.length === 0) continue;
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    const parsed = DakDataDictionaryAnnexSchema.safeParse(json);
    if (!parsed.success) {
      out.push(`annex record "${label}" shows columns of ${r.file}, which is not a ${DAK_DATA_DICTIONARY_SCHEMA}`);
      continue;
    }
    for (const sheet of parsed.data.sheets.filter((s) => s.rows.length > 0)) {
      const keys = new Set(sheet.columns.map((c) => c.key));
      for (const col of r.columns) if (!keys.has(col)) out.push(`annex record "${label}" shows column "${col}", which sheet "${sheet.name}" does not have`);
    }
  }
  return out;
}

/**
 * The data element ids of a dictionary, judged against the artefact indexes
 * its layer holds. With none held, nothing is a finding: the ids are
 * returned as `unresolved`, a count the run says instead of a pass.
 */
export function dictionaryReferences(
  d: DakDataDictionaryAnnex,
  indexesHeld: number,
  codeSystems: ReadonlySet<string>,
): { findings: string[]; unresolved?: number } {
  if (indexesHeld > 0) return { findings: judgeDictionaryReferences(d, codeSystems) };
  const ids = d.sheets.reduce((n, s) => n + s.rows.length, 0);
  return { findings: [], unresolved: ids };
}

/**
 * The records of an `annexes.json`: a bare array (an artefact index's,
 * as fhir-harness#33 wrote it) or `{ annexes: [...] }` (fhir-harness's
 * `ig-annexes/v1`). Anything else holds none.
 */
export function annexRecordsOf(json: unknown): AnnexRecord[] {
  if (Array.isArray(json)) return json as AnnexRecord[];
  const list = (json as { annexes?: unknown } | null)?.annexes;
  return Array.isArray(list) ? (list as AnnexRecord[]) : [];
}

/** A document kind as this check reads it: its id, its sections' ids, and the kind it extends. */
export interface KindSections {
  id: string;
  sections: string[];
  extends?: string;
}

/** `<kind>#<section>` for every section of every kind, a kind's `extends` chain included. */
export function sectionRefs(kinds: ReadonlyArray<KindSections>): Set<string> {
  const byId = new Map(kinds.map((k) => [k.id, k]));
  const out = new Set<string>();
  for (const k of kinds) {
    const seen = new Set<string>();
    for (let at: KindSections | undefined = k; at && !seen.has(at.id); at = at.extends ? byId.get(at.extends) : undefined) {
      seen.add(at.id);
      for (const sec of at.sections) out.add(`${k.id}#${sec}`);
    }
  }
  return out;
}

/** What a web annex says about itself: `annexOf`, `label`, `iris`, `section` (`WebAnnexOfShape`). */
export interface WebAnnexOf {
  annexOf: string;
  label: string;
  iris?: string;
  section: string;
}

/**
 * Findings, and what was not verified, about which publication and section
 * an annex names. `libraryHeld` answers whether `<instance>/library/<slug>`
 * is an entry this checkout holds.
 */
export function judgeWebAnnexOf(
  a: WebAnnexOf,
  sections: ReadonlySet<string>,
  libraryHeld: (ref: string) => boolean,
): { findings: string[]; unverified: string[] } {
  const findings: string[] = [];
  const unverified: string[] = [];
  if (!sections.has(a.section)) findings.push(`section "${a.section}" is no section of a document kind this checkout declares`);
  if (LIBRARY_ENTRY_REF.test(a.annexOf)) {
    if (!libraryHeld(a.annexOf)) findings.push(`annexOf "${a.annexOf}" is no library entry this checkout holds`);
  } else if (IRIS_HANDLE.test(a.annexOf)) unverified.push(`annexOf IRIS ${a.annexOf}`);
  if (a.iris !== undefined) unverified.push(`own IRIS record ${a.iris}`);
  return { findings, unverified };
}

/** The document kinds the checkout's layers declare, read from their `document-kinds` directories. */
function documentKindsIn(roots: ReadonlyArray<string>): KindSections[] {
  const out: KindSections[] = [];
  for (const inst of roots) {
    for (const d of directoriesForGraph(inst, "document-kinds")) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d).filter((n) => n.endsWith(".json"))) {
        let j: { $schema?: unknown; id?: unknown; extends?: unknown; sections?: { id?: unknown }[] };
        try {
          j = JSON.parse(readFileSync(join(d, f), "utf-8"));
        } catch {
          continue;
        }
        if (j.$schema !== DOCUMENT_KIND_SCHEMA_TAG || typeof j.id !== "string") continue;
        out.push({
          id: j.id,
          sections: (j.sections ?? []).map((x) => x.id).filter((x): x is string => typeof x === "string"),
          ...(typeof j.extends === "string" ? { extends: j.extends } : {}),
        });
      }
    }
  }
  return out;
}

/** Whether `<instance>/library/<slug>` is an entry one of the named layer's library directories holds. */
function libraryHeldIn(roots: ReadonlyArray<string>): (ref: string) => boolean {
  return (ref) => {
    const [name, , slug] = ref.split("/");
    const root = roots.find((r) => (readDeclaration(r)?.name ?? "") === name);
    return root !== undefined && directoriesForGraph(root, "library").some((d) => existsSync(join(d, slug!)));
  };
}

/** Judge one file; `undefined` when it is not a node of this kind. */
export function judgeFile(text: string): { schema: string; findings: string[] } | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const schema = (json as { $schema?: unknown }).$schema;
  if (schema === DAK_DATA_DICTIONARY_SCHEMA) {
    const r = DakDataDictionaryAnnexSchema.safeParse(json);
    return { schema, findings: r.success ? judgeDictionary(r.data) : [`does not parse as ${schema}: ${r.error.issues[0]?.message}`] };
  }
  if (schema === DAK_SWIMLANES_SCHEMA) {
    const r = DakSwimlaneMapSchema.safeParse(json);
    return { schema, findings: r.success ? judgeSwimlanes(r.data) : [`does not parse as ${schema}: ${r.error.issues[0]?.message}`] };
  }
  return undefined;
}

function readOrUndefined(abs: string): string | undefined {
  try {
    return readFileSync(abs, "utf-8");
  } catch {
    return undefined;
  }
}

function main(): number {
  const repo = repoRootFor(resolve(import.meta.dir, ".."));
  const dirs = new Set<string>();
  const roots = layerRootsIn(repo);
  const sections = sectionRefs(documentKindsIn(roots));
  const libraryHeld = libraryHeldIn(roots);
  /** Each web-annex directory's layer's artefact index directories. */
  const indexesOf = new Map<string, string[]>();
  /** Each web-annex directory's layer's `ig-annex` directories (fhir-harness), whose `annexes.json` names its files. */
  const annexDirsOf = new Map<string, string[]>();
  for (const inst of roots) {
    const indexes = directoriesForGraph(inst, "fhir-artifact-index");
    const annexDirs = directoriesForGraph(inst, "ig-annex");
    for (const d of directoriesForGraph(inst, "web-annex")) {
      dirs.add(d);
      indexesOf.set(d, indexes);
      annexDirsOf.set(d, annexDirs);
    }
  }
  if (dirs.size === 0) {
    console.log("check:web-annexes — no instance here declares a web-annex directory; nothing to judge.");
    return 0;
  }
  let judged = 0;
  let findings = 0;
  for (const dir of [...dirs].sort()) {
    if (!existsSync(dir)) {
      console.error(`✗ ${relative(repo, dir)}: declared, and absent from this checkout`);
      return 2;
    }
    const indexes = (indexesOf.get(dir) ?? []).filter((d) => existsSync(join(d, "index.json")));
    const codeSystems = new Set<string>();
    for (const d of indexes) for (const c of codeSystemsIn(JSON.parse(readFileSync(join(d, "index.json"), "utf-8")))) codeSystems.add(c);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const text = readFileSync(join(dir, f), "utf-8");
      const r = judgeFile(text);
      if (r === undefined) continue;
      judged++;
      const rel = relative(repo, join(dir, f));
      if (r.findings.length === 0) {
        const of = judgeWebAnnexOf(JSON.parse(text) as WebAnnexOf, sections, libraryHeld);
        r.findings.push(...of.findings);
        if (of.unverified.length) console.log(`  · ${rel}: not verified here — ${of.unverified.join("; ")} (a WHO record this check cannot open)`);
      }
      if (r.schema === DAK_DATA_DICTIONARY_SCHEMA && r.findings.length === 0) {
        const refs = dictionaryReferences(DakDataDictionaryAnnexSchema.parse(JSON.parse(text)), indexes.length, codeSystems);
        r.findings.push(...refs.findings);
        if (refs.unresolved !== undefined) console.log(`  · ${rel}: ${refs.unresolved} data element id(s) UNRESOLVED — its instance holds no artefact index with an index.json to resolve them against`);
      }
      if (r.schema === DAK_SWIMLANES_SCHEMA) console.log(`  · ${rel}: persona aliases not resolved — the artefact index carries no persona artefact`);
      if (r.findings.length === 0) console.log(`✓ ${rel} (${r.schema})`);
      for (const x of r.findings) console.error(`✗ ${rel}: ${x}`);
      findings += r.findings.length;
    }
    for (const d of [...indexes, ...(annexDirsOf.get(dir) ?? []).filter((a) => existsSync(a))]) {
      const recordsAt = join(d, "annexes.json");
      if (!existsSync(recordsAt)) continue;
      const records = annexRecordsOf(JSON.parse(readFileSync(recordsAt, "utf-8")));
      const found = judgeAnnexRecords(records, dirname(recordsAt), readOrUndefined);
      const rel = relative(repo, recordsAt);
      if (found.length === 0) console.log(`✓ ${rel} (${records.length} annex record(s) resolve)`);
      for (const x of found) console.error(`✗ ${rel}: ${x}`);
      findings += found.length;
    }
  }
  if (judged === 0) {
    console.error("check:web-annexes — web-annex directories are declared, and none holds a node to judge.");
    return 2;
  }
  console.log(`check:web-annexes — ${judged} annex(es) judged, ${findings} finding(s).`);
  return findings > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main());
