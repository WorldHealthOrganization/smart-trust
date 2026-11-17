/**
 * Glossary consistency of a layer's translations, against a term base
 * merged from the glossaries of the layers it mounts.
 *
 * Owner, 2026-11-06, for the translation watcher: the layered glossaries
 * provide precedence for fixed translation terms. The rules are ported from
 * the instance-side `tools/translation/glossary_qa.py` (smart-trust-demo #54,
 * by the EN translation team) and made generic: every path comes from a
 * declaration, and no layer is named here.
 *
 * ## The term base, and which layer wins
 *
 * A term's translation in a locale is FIXED by the first glossary that
 * translates it, in this order:
 *
 * 1. reference glossaries named with `--layer <name>=<pattern>` (normative
 *    content, such as a WHO glossary, outranks the platform);
 * 2. the layers of the layer's `needs` chain, deepest (most authoritative)
 *    first — `declarationChain`, the order every layered reader here uses;
 * 3. the layer's own glossaries, last: they may ADD terms, never change one.
 *
 * In each layer the glossaries are its declared `translation-sources`
 * directory's `<locale>/glossary/<owner>--<scheme>.po` (the per-scheme
 * catalogues `glossary:pot` writes) and `<locale>/glossary.po` (the
 * hand-authored terminology file). A scheme catalogue is ranked by the layer
 * that OWNS the scheme (its `<owner>--` prefix), not by the layer that hosts
 * the file: cat-harness hosts bootstrap's terms, and bootstrap is the lower
 * layer.
 *
 * What fixes a term: a label (a scheme entry whose `#.` comment says "Glossary
 * term label" or "alternative label"; in `glossary.po`, any short entry that is
 * not a sentence) under 60 characters, with a non-empty msgstr, not marked
 * `#, localised` (which says the term is localised, not how) and not fuzzy.
 *
 * ## Scope: a fixed term binds only within its subject area
 *
 * The platform's terms (bootstrap's Reference, Actor, Skill; cat-harness's
 * policy) carry no sense of their own, so applying them as fixed translations
 * to health content gives wrong answers — FHIR `Reference(...)`, IHE "actors",
 * health "policy" (政策, not the harness's 策略). The owner chose "scoped fixed
 * terms" (`folio-glossary/v1`, 2026-11-07): a scheme, or a
 * term, declares the subject area its translations bind in (`subject`,
 * `dcterms:subject`); a term's own overrides its scheme's; with neither, the
 * term binds only in its own scheme (`<instance>--<scheme id>`). Only
 * `authored` terms fix anything. `scopeNote` is prose and is never compared.
 * The glossary is read as data from the file each scheme catalogue's `#:`
 * names, since its schema belongs to a layer above this one.
 *
 * Precedence applies within one subject area. A term binds the layer's
 * catalogues when its area is one of the layer's own (its glossaries'
 * subjects and schemes, its terminology file), or it came from a `--layer`
 * reference glossary, whose area is every area.
 *
 * ## In sense: by rule, then by an adjudicator
 *
 * Owner, 2026-11-07: "If a glossary term is used in the narrative in the
 * correct context, then the glossary translation is used in the translated
 * narrative." Each use of a fixed term in a msgid is one of:
 *
 * - **in sense by rule**: the term binds here (above), so the catalogue's
 *   subject area is the term's. Its fixed translation is enforced.
 * - **pending**: a term of another area. Undecided until an untainted
 *   adjudicator agent, given the term, its definition and the sentence, rules
 *   `in-sense`, `other-sense` or `exception` (`--pending --json` lists what
 *   to ask, `--record <file>` stores the answers). Listed; fails nothing.
 * - **adjudicated**: `in-sense` is enforced, `other-sense` checks nothing,
 *   `exception` ("in sense, but the fixed term is wrong here because …")
 *   passes and is listed. An `exception` also passes a use in sense by rule.
 *
 * Verdicts are stored in the layer, `<translation-sources>/glossary-sense.json`
 * (`schemas/kg/glossary-sense.ts`), keyed by the term's id and the msgid's
 * SHA-256: sense is a property of the English, so one verdict serves every
 * locale, and a changed msgid is asked again. This script never asks a model;
 * the adjudication is an agent's, outside it.
 *
 * A use whose msgstr renders the fixed translation needs no verdict. Keeping
 * the English term verbatim counts as rendering it only where the term is part
 * of a code or resource name: the term and a name-shaped neighbour (Capitalised,
 * ALL-CAPS, or an identifier such as `Provenance.agent`) kept together, as
 * written, in the msgstr — "WHO SMART Trust" left as the product's name. The
 * term kept alone, in prose, is not a rendering.
 *
 * ## What is flagged, per locale
 *
 * - `not-fixed-rendering`: a msgid uses a fixed term IN SENSE (by rule or by
 *   verdict; prefLabel or altLabel; whole word; case-insensitive, except a
 *   short all-caps acronym) and its msgstr does not use the term's fixed
 *   translation. Matching is by word stem (ru, ar, fr, es) or substring (zh,
 *   ar), as the prior art did.
 * - `inconsistent`: a term that two or more of the layer's entries — whose
 *   whole msgid is the term — render differently in one locale.
 * - `override`: a second, different translation of a fixed term in the SAME
 *   subject area (or of a reference glossary's term). The layer translating
 *   another area's label otherwise is a sense check.
 *
 * Exit: 0 clean, 1 on findings, 2 when it cannot determine (no declared
 * `translation-sources`, an unknown locale). Without `--check` the result is
 * also written as `glossary-consistency.qa-results.json` (`qa-results/v1`, one
 * family per locale) in the layer's QA directory, where `kg-qa-report`
 * reads it into its "Glossary consistency" section.
 *
 * A use pending adjudication, or ruled `other-sense` or `exception`, never
 * changes the exit code.
 *
 * Usage:
 *   bun run cat translation:glossary:check --instance <dir> --locale fr [--layer who=<dir>/{locale}/*.po]
 *   bun run cat translation:glossary:check --instance <dir> --all-locales
 *   bun run cat translation:glossary --instance <dir>        # every locale; writes the record
 *   bun run cat translation:glossary:check --instance <dir> --pending --json   # what the adjudicator is asked
 *   bun run cat translation:glossary:check --instance <dir> --record <verdicts.json>
 *
 * @module pipeline/translation-glossary
 * @covers translation-sources, qa
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { directoryForGraph, readDeclaration, resolveDirectories } from "../schemas/kg/cat-harness.ts";
import {
  GLOSSARY_SENSE_FILE,
  GLOSSARY_SENSE_SCHEMA,
  GlossarySenseStoreSchema,
  GlossarySenseVerdictSchema,
  senseKey,
  type GlossarySenseStore,
  type GlossarySenseVerdict,
} from "../schemas/kg/glossary-sense.ts";
import { declarationChain, resolveInstanceGraph } from "../schemas/kg/harness-config.ts";
import { explicitInstanceRoot, HARNESS_ROOT, TOOLS_ROOT } from "../scripts/lib/roots.ts";
import { GATE_OWN_PATHS_ENV } from "../scripts/lib/gate-own.ts";
import { buildQaResult, writeQaResult } from "../scripts/qa-results.ts";
import { GLOSSARY_SUBJECT_KIND } from "../scripts/kg-qa-report.ts";
import { parsePoEntries, type PoEntry } from "./po-inject.ts";

/** This module, as a QA producer names it. */
export const GLOSSARY_CHECK_SCRIPT = "pipeline/translation-glossary.ts";

/** The `qa-results/v1` stem, and the subject kind `kg-qa-report` renders as "Glossary consistency". */
export const GLOSSARY_RESULT_STEM = "glossary-consistency";
export { GLOSSARY_SUBJECT_KIND };

/** Labels this long or longer are prose, not terms (the prior art's rule). */
const MAX_TERM = 60;

/** One glossary file in precedence order. */
export interface GlossarySource {
  /** The layer the entry is ranked by: the scheme's owner, or the hosting layer. */
  layer: string;
  file: string;
  /** From `--layer`: normative, binds every catalogue of the layer. */
  reference: boolean;
  /** The scheme's subject area (`dcterms:subject`), when its glossary declares one. */
  scope?: string;
  /** Per lower-cased label: the term's own subject, where it overrides the scheme's; `null` for a term that is not `authored`. */
  termScopes?: Map<string, string | null>;
}

/**
 * The subject area an entry of `s` binds in — `subjectOf(scheme, term)` of
 * `folio-glossary/v1` (owner's choice, "scoped fixed terms"): the
 * term's `subject`, else its scheme's, else the scheme itself
 * (`<instance>--<scheme id>`, the catalogue's own name). A reference glossary
 * is its own area and binds everything; a terminology `glossary.po` is its
 * layer's.
 */
export function scopeOf(s: GlossarySource, label: string): string {
  if (s.reference) return `reference:${s.layer}`;
  const own = s.termScopes?.get(label.toLowerCase());
  if (typeof own === "string") return own;
  if (s.scope !== undefined) return s.scope;
  return basename(s.file) === "glossary.po" ? `${s.layer}--terminology` : basename(s.file).replace(/\.po$/, "");
}

/** A fixed term: the first in-precedence translation of a label in one subject area. */
export interface FixedTerm {
  term: string;
  /** The term's id, the same in every locale: its IRI (a scheme catalogue's `#.` comment), else `<scope>#<label>`. */
  id: string;
  /** What the term means: the English definition its scheme catalogue carries, or a terminology pin's comment. */
  definition?: string;
  fixed: string;
  layer: string;
  file: string;
  /** The subject area it is fixed in. */
  scope: string;
  /** Whether it binds the checked layer's catalogues: a reference, or one of the layer's own areas. */
  inScope: boolean;
}

export interface Override {
  term: string;
  fixed: FixedTerm;
  /** The later layer's translation, and where. */
  rendering: string;
  layer: string;
  file: string;
}

export interface TermBase {
  /** Keyed by subject area and lower-cased label. */
  terms: Map<string, FixedTerm>;
  /** A different translation of a fixed term IN ITS SUBJECT AREA: a violation. */
  overrides: Override[];
  /** The same label translated otherwise in ANOTHER area, by the layer: a sense check. */
  senseOverrides: Override[];
}

/** One `folio-glossary/v1` file, as far as scope goes. */
interface SchemeScope {
  subject?: string;
  terms: Map<string, string | null>;
}

const LANG_SOURCE = (t: unknown): string | undefined =>
  typeof t === "string" ? t : t && typeof t === "object" ? ((t as Record<string, string>).en ?? Object.values(t as Record<string, string>)[0]) : undefined;

/**
 * Read a glossary file's subject areas: the scheme's `subject` and each term's
 * own (by prefLabel and altLabel), and which terms are not `authored` (they fix
 * nothing). Read as DATA — the schema belongs to a layer above this one.
 * A JSON Schema that publishes its terms in `$defs` and a top-level `subject`
 * is read the same way: that subject, for every term.
 */
export function readSchemeScope(file: string): SchemeScope | undefined {
  let g: { $schema?: string; subject?: unknown; terms?: Array<Record<string, unknown>> };
  try {
    g = JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return undefined;
  }
  if (g?.$schema !== "folio-glossary/v1") {
    // A JSON Schema whose `$defs` ARE the terms (bootstrap's graph.schema.json,
    // read as a scheme by the content core): the subject area it publishes
    // beside them applies to every term, and every term is authored (owner,
    // 2026-11-07: "do it in the schema"; litlfred/bootstrap-tools#82).
    const schema = g as { $defs?: unknown; subject?: unknown } | null;
    if (schema && typeof schema.$defs === "object" && typeof schema.subject === "string") {
      return { subject: schema.subject, terms: new Map() };
    }
    return undefined;
  }
  const terms = new Map<string, string | null>();
  for (const t of g.terms ?? []) {
    const value = t.status !== "authored" ? null : typeof t.subject === "string" ? t.subject : undefined;
    for (const l of [LANG_SOURCE(t.prefLabel), ...((t.altLabel as string[] | undefined) ?? [])]) {
      if (l && value !== undefined) terms.set(l.toLowerCase(), value);
    }
  }
  return { ...(typeof g.subject === "string" ? { subject: g.subject } : {}), terms };
}

/** The glossary file a scheme catalogue was extracted from: its first `#:` reference, under one of `roots`. */
function schemeFileOf(po: string, roots: readonly string[]): string | undefined {
  const ref = parsePoEntries(readFileSync(po, "utf-8")).flatMap((e) => e.references)[0];
  if (ref === undefined) return undefined;
  const path = ref.split(/\s+/)[0]!.replace(/:\d+$/, "");
  return roots.map((r) => join(r, path)).find((p) => existsSync(p));
}

/**
 * Every subject area the layer's OWN content belongs to: its glossaries'
 * scheme and term subjects (the scheme itself where none is declared), and its
 * terminology file's.
 */
export function instanceScopes(instanceRoot: string, sources: readonly GlossarySource[] = []): Set<string> {
  const self = readDeclaration(instanceRoot)?.name ?? basename(instanceRoot);
  const out = new Set<string>([`${self}--terminology`]);
  let dirs: string[] = [];
  try {
    const d = directoryForGraph(instanceRoot, "glossary");
    if (d !== undefined) dirs = [d];
  } catch {
    // Two declared glossary directories: the catalogues below still say.
  }
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".glossary.json"))) {
      const sc = readSchemeScope(join(d, f));
      if (sc === undefined) continue;
      let id: string | undefined;
      try {
        id = (JSON.parse(readFileSync(join(d, f), "utf-8")) as { id?: string }).id;
      } catch {
        id = undefined;
      }
      out.add(sc.subject ?? `${self}--${id}`);
      for (const v of sc.terms.values()) if (v) out.add(v);
    }
  }
  for (const s of sources) {
    if (s.layer !== self || s.reference) continue;
    out.add(s.scope ?? scopeOf(s, ""));
    for (const v of s.termScopes?.values() ?? []) if (v) out.add(v);
  }
  return out;
}

// ── reading ─────────────────────────────────────────────────────

function isLabel(e: PoEntry, terminology: boolean): boolean {
  if (e.msgid.length >= MAX_TERM) return false;
  if (terminology) return !/[.;:]\s|\.$/.test(e.msgid) && !e.msgid.startsWith("<");
  return e.comments.some((c) => /^Glossary term (label|alternative label)\b/.test(c));
}

/** The declared `translation-sources` of `root`, or undefined (a layer that declares two is skipped, not guessed). */
function translationsOf(root: string): string | undefined {
  try {
    return directoryForGraph(root, "translation-sources");
  } catch {
    return undefined;
  }
}

/**
 * Every glossary for `locale`, in precedence order: references, then the
 * `needs` chain deepest first, then the layer itself.
 */
export function glossarySources(
  instanceRoot: string,
  locale: string,
  references: ReadonlyArray<{ name: string; pattern: string }> = [],
): GlossarySource[] {
  const out: GlossarySource[] = [];
  for (const r of references) {
    for (const file of expand(r.pattern.replaceAll("{locale}", locale))) out.push({ layer: r.name, file, reference: true });
  }
  const self = readDeclaration(instanceRoot)?.name ?? basename(instanceRoot);
  const chain = declarationChain(instanceRoot).map((c) => ({ name: c.own ? self : c.name, root: c.root }));
  const rank = new Map(chain.map((c, i) => [c.name, i]));
  // A `#:` reference names its glossary from the checkout, or from its layer.
  const roots = [...new Set([...chain.map((c) => c.root), ...chain.map((c) => dirname(c.root))])];
  const ranked: Array<GlossarySource & { at: number; seq: number }> = [];
  let seq = 0;
  chain.forEach((c, at) => {
    const dir = translationsOf(c.root);
    if (dir === undefined) return;
    // declared-path-literal: `<translations>/<locale>/glossary/` is where glossary:pot writes the scheme catalogues inside the declared translation-sources directory, not a layer's `glossary` directory.
    const schemes = join(dir, locale, "glossary");
    if (existsSync(schemes)) {
      for (const f of readdirSync(schemes).filter((x) => x.endsWith(".po")).sort()) {
        const owner = /^(.+?)--/.exec(f)?.[1];
        const layer = owner !== undefined && rank.has(owner) ? owner : c.name;
        const file = join(schemes, f);
        const json = schemeFileOf(file, roots);
        const sc = json === undefined ? undefined : readSchemeScope(json);
        ranked.push({
          layer,
          file,
          reference: false,
          ...(sc?.subject !== undefined ? { scope: sc.subject } : {}),
          ...(sc !== undefined ? { termScopes: sc.terms } : {}),
          at: rank.get(layer) ?? at,
          seq: seq++,
        });
      }
    }
    const terminology = join(dir, locale, "glossary.po");
    if (existsSync(terminology)) ranked.push({ layer: c.name, file: terminology, reference: false, at, seq: seq++ });
  });
  ranked.sort((a, b) => a.at - b.at || a.seq - b.seq);
  for (const { at: _at, seq: _seq, ...src } of ranked) out.push(src);
  return out;
}

/** A path, or a `*` pattern in its last segment. */
function expand(pattern: string): string[] {
  if (!pattern.includes("*")) return existsSync(pattern) ? [pattern] : [];
  const dir = dirname(pattern);
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^${basename(pattern).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return readdirSync(dir).filter((f) => re.test(f)).sort().map((f) => join(dir, f));
}

/**
 * Merge the glossaries into one term base, ONE SUBJECT AREA AT A TIME: in an
 * area the first translation of a label wins and a later, different one is an
 * override (a violation). The same label in another area is a different term;
 * where the layer translates it otherwise, that is a sense-check note.
 */
export function termBase(
  instance: string,
  locale: string,
  sources: readonly GlossarySource[],
  scopes: ReadonlySet<string> = new Set(),
): TermBase {
  const terms = new Map<string, FixedTerm>();
  const overrides: Override[] = [];
  const senseOverrides: Override[] = [];
  const mine = new Set(scopes);
  for (const s of sources) if (s.layer === instance && !s.reference) mine.add(s.scope ?? scopeOf(s, ""));
  for (const s of sources) {
    const terminology = basename(s.file) === "glossary.po";
    const entries = parsePoEntries(readFileSync(s.file, "utf-8"));
    const definitions = new Map<string, string>();
    for (const e of entries) {
      const iri = termIri(e, "definition");
      if (iri !== undefined) definitions.set(iri, e.msgid);
    }
    for (const e of entries) {
      if (!e.msgstr.trim() || e.flags.includes("localised") || e.flags.includes("fuzzy") || !isLabel(e, terminology)) continue;
      if (s.termScopes?.get(e.msgid.toLowerCase()) === null) continue; // not an authored term
      const scope = scopeOf(s, e.msgid);
      const k = `${scope}\u0000${e.msgid.toLowerCase()}`;
      const have = terms.get(k);
      if (have === undefined) {
        for (const other of terms.values()) {
          if (other.scope === scope || other.term.toLowerCase() !== e.msgid.toLowerCase()) continue;
          if (norm(other.fixed, locale) === norm(e.msgstr, locale)) continue;
          const o = { term: e.msgid, fixed: other, rendering: e.msgstr, layer: s.layer, file: s.file };
          // A reference glossary's area is every area: changing its term is an override.
          if (other.scope.startsWith("reference:")) overrides.push(o);
          else if (s.layer === instance) senseOverrides.push(o);
        }
        const iri = termIri(e, "label");
        const definition = iri !== undefined ? definitions.get(iri) : e.comments.filter((c) => !c.startsWith("Glossary term")).join(" ").trim() || undefined;
        terms.set(k, {
          term: e.msgid,
          id: iri ?? `${scope}#${e.msgid.toLowerCase()}`,
          ...(definition !== undefined ? { definition } : {}),
          fixed: e.msgstr,
          layer: s.layer,
          file: s.file,
          scope,
          inScope: s.reference || mine.has(scope),
        });
        continue;
      }
      if (norm(have.fixed, locale) === norm(e.msgstr, locale)) continue;
      overrides.push({ term: e.msgid, fixed: have, rendering: e.msgstr, layer: s.layer, file: s.file });
    }
  }
  return { terms, overrides, senseOverrides };
}

/** The IRI a scheme catalogue's `#. Glossary term label|alternative label|definition: <IRI>` comment names. */
function termIri(e: PoEntry, what: "label" | "definition"): string | undefined {
  const re = what === "label" ? /^Glossary term (?:label|alternative label):\s*(.+?)\s*$/ : /^Glossary term definition:\s*(.+?)\s*$/;
  for (const c of e.comments) {
    const m = re.exec(c);
    if (m) return m[1];
  }
  return undefined;
}

// ── matching (ported from glossary_qa.py) ───────────────────────

const TASHKEEL = /[ً-ْـ]/g;

export function norm(s: string, locale: string): string {
  let t = s.normalize("NFC").toLowerCase();
  if (locale === "ar") t = t.replace(TASHKEEL, "").replace(/[أإآ]/g, "ا").replaceAll("ى", "ي").replaceAll("ة", "ه");
  return t.replaceAll("’", "'");
}

function stem(w: string, locale: string): string {
  if (locale === "ru" && w.length === 4) return w.slice(0, 3);
  if (w.length <= 4) return w;
  const cut = locale === "ru" && w.length > 6 ? 3 : 2;
  return w.slice(0, Math.max(4, w.length - cut));
}

/**
 * The stems a word of a fixed translation may appear under. Russian drops a
 * fleeting «е»/«о»/«ё» before a final consonant in every form but the
 * nominative singular — «узел» → «узла», «узлу», «узлы» — so the nominative's
 * stem «узе» never prefixes them; the stem without that vowel, «узл», does.
 */
function stems(w: string, locale: string): string[] {
  const out = [stem(w, locale)];
  if (locale === "ru" && w.length >= 4 && /[^аеёиоуыэюяйь][еоё][^аеёиоуыэюяйь]$/u.test(w)) out.push(w.slice(0, -2) + w.slice(-1));
  return out;
}

/** Does `msgstr` use the fixed translation? By stem, or by substring in zh and ar. */
export function renders(fixed: string, msgstr: string, locale: string): boolean {
  // A fixed translation may gloss itself in parentheses — an abbreviation, «Infrastructure
  // à clés publiques (ICP)», or the English, «Servicio de confianza (Trusted Service)».
  // The gloss is given once, where the term is introduced; running text that renders
  // the term without it still renders the term.
  const bare = fixed.replace(/\s*[(（][^()（）]*[)）]\s*/gu, " ").trim();
  if (bare && bare !== fixed.trim() && rendersExactly(bare, msgstr, locale)) return true;
  return rendersExactly(fixed, msgstr, locale);
}

function rendersExactly(fixed: string, msgstr: string, locale: string): boolean {
  const t = norm(msgstr, locale);
  let f = norm(fixed, locale);
  if (locale === "zh") return t.includes(f);
  if (locale === "ar") {
    f = f.replace(/(^|\s)ال/g, "$1");
    const toks = t.match(/[\p{L}\p{N}_]+/gu) ?? [];
    return f.split(/\s+/).filter(Boolean).every((w) => t.includes(w) || toks.some((x) => arabicFormOf(w, x)));
  }
  const toks = t.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return (f.match(/[\p{L}\p{N}_]+/gu) ?? []).every((w) => stems(w, locale).some((s) => toks.some((x) => x.startsWith(s))));
}

// ── Arabic inflected forms (owner, Q-GLOSS-REST A, 2026-11-12) ──
//
// A fixed rendering is one word form, «المهارة», and the substring match
// above finds it only where that form, less its article, appears. Correct
// Arabic inflects it: «مهارات» (plural), «مهاراتك» (plural + possessive),
// «مهمته» (the tāʾ marbūṭa becomes ت before a suffix), «الأدوار» (a broken
// plural of «الدور»). cat-harness#1279 left 12 such uses reported as not
// rendered. A token counts as a form of the word when, after its proclitics
// and enclitics are removed, its stem is the word's — but only if a SUFFIX
// was removed (a plural, a possessive) or it is the word's broken plural:
// the bare stem, with or without the article («مهم», «المهم», "important"),
// is a different word, not a form of «مهمة».
// Strings here are already `norm`ed: no tashkeel, أإآ→ا, ى→ي, ة→ه.

const AR_PROCLITICS = ["وبال", "وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];
const AR_ENCLITICS = ["كما", "هما", "هم", "هن", "كم", "كن", "نا", "ها", "ه", "ك", "ي"];
// Only the sound feminine plural and the tāʾ marbūṭa: the masculine plural
// and dual endings (ون، ين، ان) also end unrelated words («الدوران»,
// "rotation", is not «الدور»), and no recorded use needs them.
const AR_INFLECTIONS = ["ات", "ه", "ت"];

/** The word's stem: a final ه (from ة) dropped. */
function arabicStem(word: string): string {
  return word.length > 2 && word.endsWith("ه") ? word.slice(0, -1) : word;
}

/** The candidate stems of a token, each with whether a suffix was removed to reach it. */
function arabicStems(token: string): Array<{ stem: string; affixed: boolean }> {
  const out: Array<{ stem: string; affixed: boolean }> = [];
  const bases = [token, ...AR_PROCLITICS.filter((p) => token.startsWith(p) && token.length - p.length >= 2).map((p) => token.slice(p.length))];
  for (const b of bases) {
    const enc = [b, ...AR_ENCLITICS.filter((s) => b.endsWith(s) && b.length - s.length >= 2).map((s) => b.slice(0, -s.length))];
    for (const e of enc) {
      out.push({ stem: arabicStem(e), affixed: e !== b });
      for (const s of AR_INFLECTIONS) {
        if (e.endsWith(s) && e.length - s.length >= 2) out.push({ stem: e.slice(0, -s.length), affixed: true });
      }
    }
  }
  return out;
}

/** The afʿāl broken plural of a three-letter stem: «دور» → «ادوار». */
function arabicBrokenPlural(stem: string): string | undefined {
  const c = [...stem];
  return c.length === 3 ? `ا${c[0]}${c[1]}ا${c[2]}` : undefined;
}

/** Is `token` an inflected form of the fixed rendering's `word` (both `norm`ed, the word without its article)? */
export function arabicFormOf(word: string, token: string): boolean {
  const stem = arabicStem(word);
  const broken = arabicBrokenPlural(stem);
  return arabicStems(token).some((c) => (c.stem === stem && c.affixed) || (broken !== undefined && c.stem === broken));
}

/** Is `term` a word of the prose in `msgid` — not inside an identifier, a path, code or a placeholder? */
export function uses(term: string, msgid: string): boolean {
  const clean = msgid.replace(/\{[^}]*\}|`[^`]*`|https?:\/\/\S+/g, " ");
  // An acronym is case-sensitive: DID is not "did".
  const flags = term === term.toUpperCase() && term.length <= 6 && /[A-Z]/.test(term) ? "u" : "iu";
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_\\-/.@])${esc}(?![A-Za-z0-9_\\-/@]|\\.\\w)`, flags).test(clean);
}

/** A token that is a name, not prose: Capitalised, ALL-CAPS, or an identifier (`Provenance.agent`, `my-ig-repo`). */
const NAME_TOKEN = /^(?:[A-Z][\p{L}\p{N}]*|[\p{L}\p{N}]+(?:[._:/-][\p{L}\p{N}]+)+)$/u;
/** An identifier: a name with a separator inside it — code, a path, a repository. */
const IDENTIFIER = /^[\p{L}\p{N}]+(?:[._:/-][\p{L}\p{N}]+)+$/u;

/** Prose with code, placeholders, URLs and inline tags blanked, as {@link uses} reads it. */
const prose = (s: string): string => s.replace(/\{[^}]*\}|`[^`]*`|https?:\/\/\S+|<\/?[a-z]\d*>/g, " ");

/** A quotation's text: "…", “…”, «…». */
const QUOTED = /"([^"]+)"|“([^”]+)”|«\s*([^»]+?)\s*»/g;

/**
 * Is `term`, kept verbatim in `msgstr`, part of a code or resource name there?
 *
 * - the msgid writes it beside a neighbour that is an identifier
 *   (`Provenance.agent verifier`), or, the term itself name-shaped, beside a
 *   name-shaped one ("WHO SMART Trust"), and the msgstr keeps that pair as
 *   written; or
 * - it is inside a quotation (a cited title) that the msgstr keeps whole.
 *
 * The term on its own kept in English is untranslated prose, not a name.
 */
export function keptAsName(term: string, msgid: string, msgstr: string): boolean {
  const target = prose(msgstr).replace(/\s+/g, " ");
  for (const m of prose(msgid).matchAll(QUOTED)) {
    const q = (m[1] ?? m[2] ?? m[3] ?? "").replace(/\s+/g, " ").trim();
    if (q && uses(term, q) && target.includes(q)) return true;
  }
  const words = term.split(/\s+/).filter(Boolean).map((w) => w.toLowerCase());
  const toks = prose(msgid).split(/[\s()]+/).map((t) => t.replace(/^["'«“]+|["'»”,;:!?.]+$/g, "")).filter(Boolean);
  for (let i = 0; i + words.length <= toks.length; i++) {
    const at = toks.slice(i, i + words.length);
    if (!words.every((w, j) => at[j]!.toLowerCase() === w)) continue;
    const named = at.every((t) => NAME_TOKEN.test(t));
    const pairs: Array<[string | undefined, string[]]> = [
      [toks[i - 1], [toks[i - 1]!, ...at]],
      [toks[i + words.length], [...at, toks[i + words.length]!]],
    ];
    for (const [n, pair] of pairs) {
      if (n === undefined || !(IDENTIFIER.test(n) || (named && NAME_TOKEN.test(n)))) continue;
      // As written in the msgstr: the pair, allowing the punctuation between them.
      const esc = pair.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (new RegExp(esc.join(`[\\s()"'«»“”,:]+`), "u").test(target)) return true;
    }
  }
  return false;
}

// ── the check ───────────────────────────────────────────────────

export type GlossaryRule = "not-fixed-rendering" | "inconsistent" | "override";

export interface GlossaryFinding {
  rule: GlossaryRule;
  term: string;
  fixed?: string;
  layer?: string;
  catalogue?: string;
  msgid?: string;
  rendering?: string | string[];
  /** For `not-fixed-rendering`: how the use was found in sense — by rule (subject area), or by an adjudicator's verdict. */
  inSense?: "rule" | "adjudicated";
}

/** The layer translating another subject area's glossary label otherwise: a note on the term base, never a violation. */
export interface SenseNote {
  term: string;
  fixed: string;
  layer: string;
  catalogue: string;
  msgid: string;
}

/** One use of a fixed term in a msgid whose sense matters: pending, ruled other-sense, or an exception. */
export interface Occurrence {
  /** The label that matched. */
  term: string;
  /** The term's id, the first half of a verdict's key. */
  termId: string;
  definition?: string;
  fixed: string;
  layer: string;
  scope: string;
  catalogue: string;
  msgid: string;
  /** The second half of a verdict's key. */
  msgidSha256: string;
  rendering: string;
  /** The verdict, when one is recorded. */
  verdict?: GlossarySenseVerdict;
}

export interface LocaleResult {
  locale: string;
  fixedTerms: number;
  catalogues: number;
  findings: GlossaryFinding[];
  sense: SenseNote[];
  /** Uses no rule decides and no verdict covers yet: listed, never failing. */
  pending: Occurrence[];
  /** Uses an adjudicator ruled another sense: not checked. */
  otherSense: Occurrence[];
  /** Uses in sense whose fixed translation an adjudicator ruled wrong here: passing, listed. */
  exceptions: Occurrence[];
}

// ── the verdict store ───────────────────────────────────────────

/** SHA-256 (hex) of a msgid, exactly as the catalogue holds it. */
export const msgidSha256 = (msgid: string): string => createHash("sha256").update(msgid, "utf-8").digest("hex");

/** The verdicts, by {@link senseKey}. */
export type Verdicts = ReadonlyMap<string, GlossarySenseVerdict>;

/** Where a layer keeps its verdicts: `<translation-sources>/glossary-sense.json`. */
export const senseStorePath = (translations: string): string => join(translations, GLOSSARY_SENSE_FILE);

/** Read the store; an absent file is an empty one. Throws on a file that does not parse against the schema. */
export function readVerdicts(file: string): Map<string, GlossarySenseVerdict> {
  const out = new Map<string, GlossarySenseVerdict>();
  if (!existsSync(file)) return out;
  const store = GlossarySenseStoreSchema.parse(JSON.parse(readFileSync(file, "utf-8")));
  for (const v of store.verdicts) out.set(senseKey(v.term, v.msgidSha256), v);
  return out;
}

/**
 * Merge `incoming` into the store at `file` (a later verdict on the same key
 * replaces the earlier) and write it, sorted so it diffs well. Each incoming
 * verdict may give `msgid` instead of `msgidSha256`; a given hash must match a
 * given msgid. Returns how many were added and replaced.
 */
export function recordVerdicts(file: string, incoming: unknown): { added: number; replaced: number } {
  const list = Array.isArray(incoming) ? incoming : (incoming as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(list)) throw new Error("expected an array of verdicts, or { verdicts: [...] }");
  const store = readVerdicts(file);
  let added = 0;
  let replaced = 0;
  list.forEach((raw, i) => {
    const r = { ...(raw as Record<string, unknown>) };
    if (typeof r.msgid === "string") {
      const h = msgidSha256(r.msgid);
      if (r.msgidSha256 !== undefined && r.msgidSha256 !== h) throw new Error(`verdict ${i}: msgidSha256 does not match its msgid`);
      r.msgidSha256 = h;
    }
    const v = GlossarySenseVerdictSchema.parse(r);
    const k = senseKey(v.term, v.msgidSha256);
    if (store.has(k)) replaced++;
    else added++;
    store.set(k, v);
  });
  const doc: GlossarySenseStore = {
    $schema: GLOSSARY_SENSE_SCHEMA,
    verdicts: [...store.values()].sort((a, b) => a.term.localeCompare(b.term) || a.msgidSha256.localeCompare(b.msgidSha256)),
  };
  GlossarySenseStoreSchema.parse(doc);
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  return { added, replaced };
}

/** Every `.po` under the layer's `<translations>/<locale>/`, the glossaries included. */
function catalogues(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? catalogues(join(dir, e.name)) : e.name.endsWith(".po") ? [join(dir, e.name)] : []));
}

/**
 * The `catalogues` pattern the layer's `translation-sources` directory declares,
 * or undefined (the catalogues are then only under `<translations>/<locale>/`).
 */
export function cataloguePatternOf(root: string): string | undefined {
  try {
    const dirs = resolveDirectories([{ name: "(local)", root, own: true }]).filter((d) =>
      d.graphTypologies.includes("translation-sources"),
    );
    return dirs.length === 1 ? dirs[0]?.catalogues : undefined;
  } catch {
    return undefined;
  }
}

/** One path segment of a `catalogues` pattern as a whole-name regex; `{locale}` is captured. */
const segmentRe = (seg: string): RegExp =>
  new RegExp(
    `^${seg
      .split(/(\{locale\}|\*)/)
      .map((p) => (p === "{locale}" ? "(?<locale>[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*)" : p === "*" ? "[^/]*" : p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")))
      .join("")}$`,
  );

/**
 * The files under `root` that the `catalogues` pattern matches, each with the
 * locale it names. With `locale` given, `{locale}` must be that locale.
 */
export function patternCatalogues(root: string, pattern: string, locale?: string): Array<{ file: string; locale: string }> {
  const segs = pattern.replace(/^\.?\//, "").split("/").filter(Boolean);
  const out: Array<{ file: string; locale: string }> = [];
  const walk = (dir: string, i: number, found: string | undefined): void => {
    if (!existsSync(dir)) return;
    const re = segmentRe(locale === undefined ? segs[i]! : segs[i]!.replaceAll("{locale}", locale));
    const last = i === segs.length - 1;
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const m = re.exec(e.name);
      if (!m) continue;
      const loc = m.groups?.locale ?? found;
      if (last) {
        if (e.isFile() && e.name.endsWith(".po")) out.push({ file: join(dir, e.name), locale: locale ?? loc ?? "" });
      } else if (e.isDirectory()) walk(join(dir, e.name), i + 1, loc);
    }
  };
  if (segs.length > 0) walk(root, 0, undefined);
  return out.filter((c) => c.locale !== "");
}

/** Check one locale of the layer at `root`, whose catalogues are in `translations`. */
export function checkLocale(
  root: string,
  translations: string,
  locale: string,
  references: ReadonlyArray<{ name: string; pattern: string }> = [],
  /** The glossaries in precedence order; {@link glossarySources} when not given. */
  sources?: readonly GlossarySource[],
  /** The adjudicator's verdicts; the layer's store when not given. */
  verdicts?: Verdicts,
): LocaleResult {
  const ruled = verdicts ?? readVerdicts(senseStorePath(translations));
  const pending: Occurrence[] = [];
  const otherSense: Occurrence[] = [];
  const exceptions: Occurrence[] = [];
  const instance = readDeclaration(root)?.name ?? basename(root);
  const srcs = sources ?? glossarySources(root, locale, references);
  const base = termBase(instance, locale, srcs, instanceScopes(root, srcs));
  const labels = new Set([...base.terms.values()].map((t) => t.term.toLowerCase()));
  const findings: GlossaryFinding[] = [];
  const sense: SenseNote[] = [];
  for (const o of base.overrides) {
    findings.push({ rule: "override", term: o.term, fixed: o.fixed.fixed, layer: o.fixed.layer, catalogue: relative(root, o.file), rendering: o.rendering });
  }
  for (const o of base.senseOverrides) {
    sense.push({ term: o.term, fixed: o.fixed.fixed, layer: o.fixed.layer, catalogue: relative(root, o.file), msgid: `${o.layer} renders it «${o.rendering}»` });
  }
  // Longest first, so "Health worker" is judged before "worker".
  const terms = [...base.terms.values()].sort((a, b) => b.term.length - a.term.length);
  // A label that binds here in one area is not also a sense check from another.
  const binding = new Set(terms.filter((t) => t.inScope).map((t) => t.term.toLowerCase()));
  const exact = new Map<string, Map<string, string[]>>();
  const pattern = cataloguePatternOf(root);
  const files = [
    ...catalogues(join(translations, locale)),
    ...(pattern === undefined ? [] : patternCatalogues(root, pattern, locale).map((c) => c.file)),
  ];
  for (const po of files) {
    const rel = relative(root, po);
    for (const e of parsePoEntries(readFileSync(po, "utf-8"))) {
      if (!e.msgstr.trim() || e.flags.includes("fuzzy")) continue;
      const whole = e.msgid.trim().toLowerCase();
      if (whole.length < MAX_TERM && (labels.has(whole) || basename(po) === "glossary.po" || isLabel(e, false))) {
        const r = exact.get(whole) ?? new Map<string, string[]>();
        const n = norm(e.msgstr.trim(), locale);
        r.set(n, [...(r.get(n) ?? []), `${rel}: ${e.msgstr.trim()}`]);
        exact.set(whole, r);
      }
      let hash: string | undefined;
      for (const t of terms) {
        if (!uses(t.term, e.msgid)) continue;
        if (t.file === po) continue; // the glossary entry itself
        // A label that binds here in one area is decided by that area alone.
        if (!t.inScope && binding.has(t.term.toLowerCase())) continue;
        if (renders(t.fixed, e.msgstr, locale) || keptAsName(t.term, e.msgid, e.msgstr)) continue;
        hash ??= msgidSha256(e.msgid);
        const v = ruled.get(senseKey(t.id, hash));
        const occ = (): Occurrence => ({
          term: t.term,
          termId: t.id,
          ...(t.definition !== undefined ? { definition: t.definition } : {}),
          fixed: t.fixed,
          layer: t.layer,
          scope: t.scope,
          catalogue: rel,
          msgid: e.msgid,
          msgidSha256: hash!,
          rendering: e.msgstr,
          ...(v !== undefined ? { verdict: v } : {}),
        });
        const violation = (inSense: "rule" | "adjudicated"): GlossaryFinding => ({
          rule: "not-fixed-rendering",
          term: t.term,
          fixed: t.fixed,
          layer: t.layer,
          catalogue: rel,
          msgid: e.msgid,
          rendering: e.msgstr,
          inSense,
        });
        // In sense by rule: the catalogue's subject area is the term's. Only an
        // exception lets it pass; a rule is not overruled by an `other-sense`.
        if (t.inScope) {
          if (v?.verdict === "exception") exceptions.push(occ());
          else findings.push(violation("rule"));
        } else if (v === undefined) pending.push(occ());
        else if (v.verdict === "other-sense") otherSense.push(occ());
        else if (v.verdict === "exception") exceptions.push(occ());
        else findings.push(violation("adjudicated"));
      }
    }
  }
  for (const [term, renderings] of exact) {
    if (renderings.size < 2) continue;
    findings.push({ rule: "inconsistent", term: [...base.terms.values()].find((t) => t.term.toLowerCase() === term)?.term ?? term, rendering: [...renderings.values()].map((v) => v[0]!) });
  }
  return { locale, fixedTerms: base.terms.size, catalogues: files.length, findings, sense, pending, otherSense, exceptions };
}

/** One finding as one line of output. */
export function findingLine(locale: string, f: GlossaryFinding): string {
  switch (f.rule) {
    case "not-fixed-rendering":
      return `✗ ${locale} not-fixed-rendering «${f.term}» → «${f.fixed}» (${f.layer}) not used in ${f.catalogue}${f.inSense === "adjudicated" ? " (in sense by verdict)" : ""}: ${JSON.stringify(f.msgid?.slice(0, 80))}`;
    case "inconsistent":
      return `✗ ${locale} inconsistent «${f.term}» rendered ${(f.rendering as string[]).length} ways: ${(f.rendering as string[]).join(" | ")}`;
    case "override":
      return `✗ ${locale} override «${f.term}»: ${f.layer} fixes «${f.fixed}», ${f.catalogue} has «${f.rendering}»`;
  }
}

/** One use that is pending, other-sense or an exception, as one line of output. */
export function occurrenceLine(locale: string, kind: "pending" | "other-sense" | "exception", o: Occurrence): string {
  const why = o.verdict ? ` — ${o.verdict.decidedBy}: ${o.verdict.reason}` : "";
  return `· ${locale} ${kind} «${o.term}» (${o.layer}: «${o.fixed}», ${o.scope}) in ${o.catalogue}: ${JSON.stringify(o.msgid.slice(0, 80))}${why}`;
}

/** A use as the record keeps it: enough to find it again, and the verdict's who and why. */
const recorded = (o: Occurrence) => ({
  term: o.term,
  termId: o.termId,
  fixed: o.fixed,
  layer: o.layer,
  catalogue: o.catalogue,
  msgid: o.msgid,
  msgidSha256: o.msgidSha256,
  ...(o.verdict ? { reason: o.verdict.reason, decidedBy: o.verdict.decidedBy } : {}),
});

/**
 * The uses an adjudicator is asked about, once each across `results`: sense is
 * a property of the English, so a use pending in several locales is one
 * question. Each carries what the adjudicator is given — the term, its
 * definition and the sentence — and the key its verdict is recorded under.
 */
export function pendingQuestions(results: readonly LocaleResult[]) {
  const out = new Map<
    string,
    { term: string; label: string; definition?: string; scope: string; layer: string; msgid: string; msgidSha256: string; locales: string[]; catalogues: string[] }
  >();
  for (const r of results) {
    for (const o of r.pending) {
      const k = senseKey(o.termId, o.msgidSha256);
      const q =
        out.get(k) ??
        {
          term: o.termId,
          label: o.term,
          ...(o.definition !== undefined ? { definition: o.definition } : {}),
          scope: o.scope,
          layer: o.layer,
          msgid: o.msgid,
          msgidSha256: o.msgidSha256,
          locales: [],
          catalogues: [],
        };
      if (!q.locales.includes(r.locale)) q.locales.push(r.locale);
      // The first directory segment that IS the locale becomes `<locale>`. A
      // segment match, not a RegExp: the locale comes from the command line.
      const parts = o.catalogue.split("/");
      const at = parts.findIndex((p, i) => p === r.locale && i < parts.length - 1);
      if (at >= 0) parts[at] = "<locale>";
      const cat = parts.join("/");
      if (!q.catalogues.includes(cat)) q.catalogues.push(cat);
      out.set(k, q);
    }
  }
  return [...out.values()];
}

/** The `qa-results/v1` record: one family per locale. */
export function glossaryResult(instance: string, results: readonly LocaleResult[]) {
  const rec = buildQaResult({
    script: GLOSSARY_CHECK_SCRIPT,
    scriptAbsPath: join(TOOLS_ROOT, GLOSSARY_CHECK_SCRIPT),
    subject: { kind: GLOSSARY_SUBJECT_KIND, id: instance },
    families: Object.fromEntries(
      results.map((r) => [
        r.locale,
        {
          summary:
            `${r.fixedTerms} fixed term(s), ${r.catalogues} catalogue(s); ` +
            `${r.pending.length} use(s) pending adjudication, ${r.otherSense.length} other-sense, ${r.exceptions.length} exception(s), ` +
            `${r.sense.length} sense-check note(s) (a term of another domain rendered otherwise), not counted as findings`,
          entries: r.findings,
        },
      ]),
    ),
  });
  // The adjudication lists beside each locale's findings: listed, never counted.
  for (const r of results) {
    const f = rec.families[r.locale] as (typeof rec.families)[string] & { adjudication?: unknown };
    f.adjudication = { pending: r.pending.map(recorded), otherSense: r.otherSense.map(recorded), exceptions: r.exceptions.map(recorded) };
  }
  return rec;
}

function args(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  argv.forEach((a, i) => {
    if (a === `--${name}` && argv[i + 1] !== undefined) out.push(argv[i + 1]!);
    else if (a.startsWith(`--${name}=`)) out.push(a.slice(name.length + 3));
  });
  return out;
}

/**
 * The roots a run with no `--instance` judges. The layer PR-check runner names
 * the caller's own layer directories in {@link GATE_OWN_PATHS_ENV}: a gate
 * run in an IG's index judges that IG's catalogues, not the platform's, which
 * their own CI judges (owner ruling 2026-11-05, "Move the checks"). Only those
 * that declare a `translation-sources` directory are returned; `undefined`
 * when the run names no own paths (a local run: the harness, as before).
 */
export function ownTranslationRoots(
  base: string = process.cwd(),
  env: Readonly<Record<string, string | undefined>> = process.env,
): string[] | undefined {
  const paths = (env[GATE_OWN_PATHS_ENV] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  if (paths.length === 0) return undefined;
  return paths.map((p) => resolve(base, p)).filter((r) => {
    const t = translationsOf(r);
    return t !== undefined && existsSync(t);
  });
}

function main(argv: readonly string[]): number {
  const explicit = explicitInstanceRoot(argv);
  if (explicit) return mainFor(explicit, argv);
  const own = ownTranslationRoots();
  if (own === undefined) return mainFor(resolve(HARNESS_ROOT), argv);
  if (own.length === 0) {
    console.log("✓ translation:glossary:check: the caller's own instances declare no translation-sources; the mounted layers' catalogues are judged by their own CI.");
    return 0;
  }
  return Math.max(...own.map((r) => mainFor(r, argv)));
}

/**
 * The `needs` of the layer at `root` that resolve to nothing on disk, as the
 * instance graph reports them. Without such a layer its scheme catalogues still
 * sit in the layer's `translations/` (glossary:pot writes them there), so they
 * would be read as the layer's own and judged in sense by rule — a wrong
 * verdict, not a missing one. Measured: a bare clone of the platform without its
 * foundation beside it reported 95 violations where the mounted layer had 12.
 */
export function absentLayers(root: string): string[] {
  return resolveInstanceGraph(root).problems.filter((p) => p.kind === "missing").map((p) => p.detail);
}

function mainFor(root: string, argv: readonly string[]): number {
  const check = argv.includes("--check");
  const translations = translationsOf(root);
  if (translations === undefined || !existsSync(translations)) {
    console.error(`translation-glossary: ${root} declares no \`translation-sources\` directory — nothing can be determined (exit 2)`);
    return 2;
  }
  const pattern = cataloguePatternOf(root);
  const have = [
    ...new Set([
      ...readdirSync(translations, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name),
      ...(pattern === undefined ? [] : patternCatalogues(root, pattern).map((c) => c.locale)),
    ]),
  ].sort();
  const asked = args(argv, "locale").flatMap((l) => l.split(",")).filter(Boolean);
  const unknown = asked.filter((l) => !have.includes(l));
  if (unknown.length > 0) {
    console.error(`translation-glossary: no ${unknown.join(", ")} under ${relative(root, translations)}/ — nothing can be determined (exit 2)`);
    return 2;
  }
  const references = args(argv, "layer").map((s) => {
    const i = s.indexOf("=");
    return { name: s.slice(0, i), pattern: resolve(s.slice(i + 1)) };
  });
  if (references.some((r) => !r.name)) {
    console.error("translation-glossary: --layer takes <name>=<path with {locale}> (exit 2)");
    return 2;
  }
  const absent = absentLayers(root);
  if (absent.length > 0) {
    for (const d of absent) console.error(`translation-glossary: ${d}`);
    console.error(
      `translation-glossary: a layer ${relative(process.cwd(), root) || "."} needs is not on disk, so its glossaries would be read as this instance's own and every use judged in sense by rule — mount the layers (\`mount:lock\`) and run again (exit 2)`,
    );
    return 2;
  }
  const instance = readDeclaration(root)?.name ?? basename(root);
  const store = senseStorePath(translations);
  const record = args(argv, "record");
  if (record.length > 0) {
    // The adjudicator's answers: merged into the store, nothing else run.
    try {
      for (const f of record) {
        const { added, replaced } = recordVerdicts(store, JSON.parse(readFileSync(resolve(f), "utf-8")));
        console.log(`translation-glossary: ${f}: ${added} verdict(s) added, ${replaced} replaced in ${relative(root, store)}`);
      }
    } catch (e) {
      console.error(`translation-glossary: --record: ${(e as Error).message} (exit 2)`);
      return 2;
    }
    return 0;
  }
  let verdicts: Verdicts;
  try {
    verdicts = readVerdicts(store);
  } catch (e) {
    console.error(`translation-glossary: ${relative(root, store)} does not parse: ${(e as Error).message} (exit 2)`);
    return 2;
  }
  const locales = asked.length && !argv.includes("--all-locales") ? asked : have;
  const results = locales.map((l) => checkLocale(root, translations, l, references, undefined, verdicts));
  if (argv.includes("--pending")) {
    // What the adjudicator is asked; listing it fails nothing.
    const questions = pendingQuestions(results);
    if (argv.includes("--json")) {
      console.log(JSON.stringify({ instance, store: relative(root, store), verdicts: ["in-sense", "other-sense", "exception"], pending: questions }, null, 2));
    } else {
      for (const q of questions) console.log(`· pending «${q.label}» (${q.term}) [${q.locales.join(",")}]: ${JSON.stringify(q.msgid.slice(0, 100))}`);
      console.log(`  ${questions.length} use(s) pending adjudication`);
    }
    return 0;
  }
  let findings = 0;
  const known = new Set<string>();
  for (const r of results) {
    for (const f of r.findings) console.log(findingLine(r.locale, f));
    for (const o of r.exceptions) console.log(occurrenceLine(r.locale, "exception", o));
    for (const o of r.otherSense) console.log(occurrenceLine(r.locale, "other-sense", o));
    for (const o of r.pending) console.log(occurrenceLine(r.locale, "pending", o));
    for (const n of r.sense) console.log(`· ${r.locale} sense-check «${n.term}» (${n.layer}: «${n.fixed}») in ${n.catalogue}: ${JSON.stringify(n.msgid.slice(0, 80))}`);
    const inSense = r.findings.filter((f) => f.rule === "not-fixed-rendering").length;
    console.log(
      `  ${r.locale}: ${r.fixedTerms} fixed term(s), ${r.catalogues} catalogue(s), ${r.findings.length} finding(s) (${inSense} in-sense violation(s)), ` +
        `${r.pending.length} pending adjudication, ${r.otherSense.length} other-sense, ${r.exceptions.length} exception(s), ${r.sense.length} sense-check note(s)`,
    );
    findings += r.findings.length;
    for (const o of [...r.pending, ...r.otherSense, ...r.exceptions]) known.add(senseKey(o.termId, o.msgidSha256));
  }
  const stale = [...verdicts.keys()].filter((k) => !known.has(k)).length;
  if (stale > 0) console.log(`  ${stale} recorded verdict(s) match no use that needs one (a changed msgid, or a use now rendered)`);
  if (!check) {
    // `qaResultPath`'s one composition: `<instance>/test/results/`, the `qa`
    // directory every layer in an index declares, where `kg-qa-report` reads it.
    const out = writeQaResult(root, GLOSSARY_RESULT_STEM, glossaryResult(instance, results));
    console.log(`  wrote ${relative(root, out)}`);
  }
  return findings > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv));
