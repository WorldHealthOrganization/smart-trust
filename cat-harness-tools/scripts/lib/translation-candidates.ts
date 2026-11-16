/**
 * The ONE writer of candidate translations: the `translation-candidates/v1`
 * sidecar, the empty `msgstr` it fills, and the translation node.
 *
 * @module scripts/lib/translation-candidates
 * @covers translation-sources
 *
 * Every candidate source calls {@link addCandidates}: the open MT adapters in
 * `translation-sources/`, an agent model, and the translation-platform import
 * (Weblate, Crowdin, Transifex) with `kind: "web-service"`. The rules live
 * here once:
 *
 *   1. **Append, never duplicate.** A candidate whose text and source
 *      (`kind`, `id`) are already recorded for the entry is not added again.
 *   2. **Placeholders must round-trip** (`machine-translation.ts`
 *      `checkedCandidate`). A candidate that fails is not recorded, and is
 *      reported. `check: false` turns this off for a source a person wrote.
 *   3. **Candidates are never a barrier to having a translation** (owner,
 *      2026-11-14). An EMPTY `msgstr` gets the entry's first good candidate,
 *      marked `#, fuzzy`, so it is the default until a person adjudicates.
 *      A non-empty `msgstr` is never overwritten. A plural entry's candidate
 *      carries every form (`forms`, one per the catalogue's plural count),
 *      each checked against the English it translates, and fills the entry
 *      only when all its forms are empty (owner, 2026-11-14).
 *   4. **A candidate is never a verdict.** Nothing here sets `official`.
 *      The node records what produced the strings it filled.
 *   5. **The catalogue's author can say no.** A catalogue that says `DO NOT
 *      MACHINE-FILL`, or that is signed off as official (its node, or its
 *      `X-Folio-Official: yes` header), still collects candidates
 *      for a reviewer, but none is put in its `.po`: the sidecar is not
 *      shipped, the catalogue is.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { TranslationNodeSchema } from "../../schemas/content/translation.ts";
import {
  applyForms,
  applySuggestion,
  CANDIDATES_SCHEMA,
  CANDIDATES_SUFFIX,
  candidatesProblems,
  poEntries,
  type CandidateSource,
  type CandidateSourceKind,
  type CandidatesFile,
} from "./translation-adjudication.ts";
import { checkedCandidate, entryKey, forbidsMachineFill, nplurals, pluralSources, poFromPot, type Skipped } from "./machine-translation.ts";

/** One candidate for one entry. */
export interface CandidateInput {
  msgctxt?: string;
  msgid: string;
  /** The translation; for a plural entry, its form 0. */
  text: string;
  /** For a plural entry: every `msgstr[n]`, in order, as many as the catalogue's plural count. */
  forms?: string[];
  source: CandidateSource;
}

/** What one {@link mergeCandidates} call did. */
export interface MergeResult {
  sidecar: CandidatesFile;
  po: string;
  /** Candidates newly recorded. */
  added: number;
  /** Entries whose empty `msgstr` was filled, and from which source. */
  filled: Array<{ msgctxt?: string; msgid: string; source: CandidateSource }>;
  /** Candidates not recorded (placeholders, unknown entry). */
  rejected: Skipped[];
}

export interface MergeOptions {
  /** Check placeholders (default true). */
  check?: boolean;
  /** Fill an empty `msgstr` with the first good candidate (default true). */
  fill?: boolean;
}

const sameSource = (a: CandidateSource, b: CandidateSource) => a.kind === b.kind && a.id === b.id;

/** An empty sidecar for a catalogue. */
export function emptySidecar(locale: string, catalogue: string): CandidatesFile {
  return { $schema: CANDIDATES_SCHEMA, locale, catalogue, entries: [] };
}

/** The checked forms of a plural candidate, or why they are refused. */
function checkedForms(sources: string[], forms: string[] | undefined, check: boolean): { forms: string[] } | { refused: string } {
  if (forms === undefined) return { refused: "plural entry: the candidate gives no forms" };
  if (forms.length !== sources.length) return { refused: `plural entry: ${forms.length} form(s) given, the catalogue has ${sources.length}` };
  if (!check) return { forms };
  const out: string[] = [];
  for (let k = 0; k < forms.length; k++) {
    const r = checkedCandidate(sources[k]!, forms[k]!);
    if ("refused" in r) return { refused: `form ${k}: ${r.refused}` };
    out.push(r.text);
  }
  return { forms: out };
}

/**
 * Merge candidates into a sidecar and a catalogue, in memory. Pure: the
 * caller decides whether to write.
 */
export function mergeCandidates(po: string, sidecar: CandidatesFile, input: CandidateInput[], o: MergeOptions = {}): MergeResult {
  const out: CandidatesFile = { ...sidecar, entries: sidecar.entries.map((e) => ({ ...e, candidates: [...e.candidates] })) };
  const byKey = new Map(out.entries.map((e) => [entryKey(e.msgctxt, e.msgid), e]));
  const poByKey = new Map(poEntries(po).map((e) => [entryKey(e.msgctxt, e.msgid), e]));
  const n = nplurals(po, sidecar.locale);
  const sourcesOf = (e: { msgid: string; msgidPlural?: string }) => pluralSources(e.msgid, e.msgidPlural!, n);
  const check = o.check !== false;
  const rejected: Skipped[] = [];
  let added = 0;
  for (const c of input) {
    const ctx = c.msgctxt !== undefined ? { msgctxt: c.msgctxt } : {};
    const key = entryKey(c.msgctxt, c.msgid);
    const target = poByKey.get(key);
    if (!target) {
      rejected.push({ ...ctx, msgid: c.msgid, reason: "no such entry in the catalogue" });
      continue;
    }
    let text = c.text;
    let forms: string[] | undefined;
    if (target.msgidPlural !== undefined) {
      const r = checkedForms(sourcesOf(target), c.forms, check);
      if ("refused" in r) {
        rejected.push({ ...ctx, msgid: c.msgid, reason: `${c.source.id}: ${r.refused}` });
        continue;
      }
      forms = r.forms;
      text = forms[0]!;
    } else if (check) {
      const r = checkedCandidate(c.msgid, c.text);
      if ("refused" in r) {
        rejected.push({ ...ctx, msgid: c.msgid, reason: `${c.source.id}: ${r.refused}` });
        continue;
      }
      text = r.text;
    }
    let entry = byKey.get(key);
    if (!entry) {
      entry = { ...ctx, msgid: c.msgid, candidates: [] };
      out.entries.push(entry);
      byKey.set(key, entry);
    }
    const same = (x: { text: string; forms?: string[]; source: CandidateSource }) =>
      x.text === text && sameSource(x.source, c.source) && JSON.stringify(x.forms ?? null) === JSON.stringify(forms ?? null);
    if (entry.candidates.some(same)) continue;
    entry.candidates.push({ text, ...(forms ? { forms } : {}), source: c.source });
    added++;
  }

  // Fill each empty msgstr (every form, for a plural) from its entry's first good candidate.
  let text = po;
  const filled: MergeResult["filled"] = [];
  if (o.fill !== false) {
    for (const e of poEntries(po)) {
      const plural = e.msgidPlural !== undefined;
      if (e.forms.some((f) => f !== "")) continue;
      const entry = byKey.get(entryKey(e.msgctxt, e.msgid));
      const ctx = e.msgctxt !== undefined ? { msgctxt: e.msgctxt } : {};
      let r: { text: string } | { refused: string } | undefined;
      let from: CandidateSource | undefined;
      if (plural) {
        const first = entry?.candidates.find((x) => !("refused" in checkedForms(sourcesOf(e), x.forms, check)));
        if (first) [r, from] = [applyForms(text, { ...ctx, msgid: e.msgid, forms: first.forms! }), first.source];
      } else {
        const first = entry?.candidates.find((x) => !check || !("refused" in checkedCandidate(e.msgid, x.text)));
        if (first) [r, from] = [applySuggestion(text, { ...ctx, msgid: e.msgid, current: "", suggested: first.text }), first.source];
      }
      if (!r || "refused" in r) continue;
      text = r.text;
      filled.push({ ...ctx, msgid: e.msgid, source: from! });
    }
  }
  return { sidecar: out, po: text, added, filled, rejected };
}

/** Whether a catalogue's header says a person signed it off (`X-Folio-Official: yes`). */
export function officialByHeader(po: string): boolean {
  return /^"X-Folio-Official:\s*yes\b/im.test(po);
}

/** What a translation node says produced its strings, by source kind. */
export function generatedByFor(kind: CandidateSourceKind): string {
  return kind === "open-mt" ? "machine" : kind === "human" ? "human-draft" : kind;
}

export interface AddCandidatesOptions extends MergeOptions {
  /** The layer root; node paths are written relative to it. */
  root: string;
  /** The `translation-sources` directory, relative to `root`. */
  translations: string;
  locale: string;
  /** Path inside the locale directory, without extension: `start/contributing`. */
  catalogue: string;
  /** Start the `.po` from its `.pot` when it does not exist yet. */
  init?: boolean;
  /** Write a minimal node when there is none (default true); otherwise nothing is filled. */
  createNode?: boolean;
  dryRun?: boolean;
  now?: () => Date;
}

export interface AddCandidatesReport extends Omit<MergeResult, "sidecar" | "po"> {
  locale: string;
  catalogue: string;
  /** Why candidates were recorded but no `msgstr` was filled. */
  noFill?: string;
  /** Why nothing at all was written. */
  refused?: string;
  initialised?: boolean;
  nodeCreated?: boolean;
}

/** The first `#:` source file of a template, line number dropped. */
function firstSource(pot: string): string | undefined {
  for (const e of poEntries(pot)) for (const r of e.references) return r.replace(/:\d+$/, "");
  return undefined;
}

/**
 * Add candidates to one catalogue on disk: the sidecar, the `.po` and the
 * node. Every file is validated before anything is written, and nothing is
 * written with `dryRun`.
 */
export function addCandidates(input: CandidateInput[], o: AddCandidatesOptions): AddCandidatesReport {
  const ldir = join(o.root, o.translations, o.locale);
  const poPath = join(ldir, `${o.catalogue}.po`);
  const potPath = join(ldir, `${o.catalogue}.pot`);
  const sidecarPath = join(ldir, `${o.catalogue}${CANDIDATES_SUFFIX}`);
  const nodePath = join(ldir, `${o.catalogue}.json`);
  const report: AddCandidatesReport = { locale: o.locale, catalogue: o.catalogue, added: 0, filled: [], rejected: [] };
  const rel = (p: string) => relative(o.root, p).split(sep).join("/");

  let po: string;
  if (existsSync(poPath)) po = readFileSync(poPath, "utf-8");
  else if (o.init && existsSync(potPath)) {
    try {
      po = poFromPot(readFileSync(potPath, "utf-8"), o.locale);
    } catch (e) {
      return { ...report, refused: `could not start the catalogue: ${(e as Error).message}` };
    }
    report.initialised = true;
  } else return { ...report, refused: existsSync(potPath) ? "no .po beside the template (start one with --init)" : "no such catalogue" };

  let sidecar = emptySidecar(o.locale, o.catalogue);
  if (existsSync(sidecarPath)) {
    const raw = JSON.parse(readFileSync(sidecarPath, "utf-8")) as unknown;
    const p = candidatesProblems(raw);
    if (p.length) return { ...report, refused: `its candidates file is not ${CANDIDATES_SCHEMA}: ${p[0]}` };
    sidecar = raw as CandidatesFile;
  }

  let node: Record<string, unknown> | undefined;
  let noFill: string | undefined;
  if (existsSync(nodePath)) {
    const raw = JSON.parse(readFileSync(nodePath, "utf-8")) as Record<string, unknown>;
    const parsed = TranslationNodeSchema.safeParse(raw);
    if (!parsed.success) return { ...report, refused: `its node does not validate as translation-node/v1: ${parsed.error.issues[0]?.message ?? "invalid"}` };
    node = raw;
    if ((raw.status as Record<string, unknown>).official === true) noFill = "its node is official; candidates are recorded for a reviewer, the catalogue is not changed";
  } else if (o.createNode === false) noFill = "no translation node beside it (--no-create-node); candidates are recorded, the catalogue is not changed";
  if (officialByHeader(po)) noFill = "its header says X-Folio-Official: yes; candidates are recorded for a reviewer, the catalogue is not changed";
  if (forbidsMachineFill(po)) noFill = "the catalogue says DO NOT MACHINE-FILL; candidates are recorded for a reviewer, the catalogue is not changed";

  const merged = mergeCandidates(po, sidecar, input, { ...o, fill: o.fill !== false && noFill === undefined });
  Object.assign(report, { added: merged.added, filled: merged.filled, rejected: merged.rejected }, noFill ? { noFill } : {});
  const sidecarIssues = candidatesProblems(merged.sidecar);
  if (sidecarIssues.length) return { ...report, refused: `the candidates file would not validate: ${sidecarIssues[0]}`, added: 0, filled: [] };

  let nextNode: Record<string, unknown> | undefined;
  if (merged.filled.length > 0) {
    const at = (o.now ?? (() => new Date()))().toISOString();
    const kinds = [...new Set(merged.filled.map((f) => f.source.kind))];
    const generator = [...new Set(merged.filled.map((f) => `${f.source.id}${f.source.version ? ` ${f.source.version}` : ""}`))].join(", ");
    const status = { ...((node?.status as Record<string, unknown>) ?? { locale: o.locale, official: false }), generatedBy: generatedByFor(kinds[0]!), generator, generatedAt: at };
    nextNode = node
      ? { ...node, status }
      : {
          $schema: "translation-node/v1",
          label: `trans:${o.locale}/${o.catalogue}`,
          locale: o.locale,
          sourceFile: (existsSync(potPath) ? firstSource(readFileSync(potPath, "utf-8")) : undefined) ?? rel(existsSync(potPath) ? potPath : poPath),
          ...(existsSync(potPath) ? { potFile: rel(potPath) } : {}),
          poFile: rel(poPath),
          status,
        };
    const check = TranslationNodeSchema.safeParse(nextNode);
    if (!check.success) return { ...report, refused: `the updated node would not validate: ${check.error.issues[0]?.message ?? "invalid"}`, added: 0, filled: [] };
    report.nodeCreated = node === undefined;
  }

  if (!o.dryRun) {
    if (merged.added > 0) writeFileSync(sidecarPath, `${JSON.stringify(merged.sidecar, null, 2)}\n`);
    // A catalogue started here is written whenever it gained anything, so a
    // sidecar never sits beside no catalogue.
    if (merged.filled.length > 0 || (report.initialised && merged.added > 0)) writeFileSync(poPath, merged.po);
    if (nextNode) writeFileSync(nodePath, `${JSON.stringify(nextNode, null, 2)}\n`);
  }
  return report;
}
