#!/usr/bin/env bun
/**
 * Is a minted glossary candidate already somebody else's concept?
 *
 * The contract, the three states and why `exact` and `concept` are a pair are
 * in `schemas/content/term-mapping.ts`. Here:
 *
 *   * TWO TARGETS, NEVER MERGED. `skos` is authoritative for meaning, `fhir`
 *     for a clinical code's operational semantics (OCL constrains only
 *     `fhir`). A term can be mapped in one and unmapped in the other.
 *
 *   * A RESOLVER THAT CANNOT BE REACHED RETURNS `undetermined`, WITH ITS
 *     REASON — never `unmapped`. Both resolve locally against the
 *     `who-smart-base@v1.0.0` snapshot in
 *     `cat-harness/external-schemas/who-smart-base.terminology.json`; an
 *     absent or unusable snapshot returns `undetermined` with its reason.
 *
 *   * IT REPORTS AND NEVER GRADES. No ratio, no threshold, no exit code that
 *     depends on how many mapped.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-term-mapping.ts
 *   bun run cat-harness-tools/scripts/check-term-mapping.ts --check   # compute and judge; write nothing
 *   … --check --against <ref>   # ...and say what moved against a qa-reports baseline
 *
 * @module scripts/check-term-mapping
 * @covers glossary
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { instanceDirectoriesForGraph, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";

import { instanceRoots, schemeOwner } from "./lib/scheme-owner.ts";

import {
  MAPPING_TARGETS,
  type ConceptMatch,
  type MappingScope,
  type MatchState,
  type TermMapping,
  TermMappingsFileSchema,
  normaliseLabel,
} from "../schemas/content/term-mapping.ts";
import { PinnedTerminologySchema } from "../schemas/content/pinned-terminology.ts";
import {
  TERM_ADJUDICATIONS_SUFFIX,
  TermAdjudicationsFileSchema,
  adjudicationStatus,
  type AdjudicationStatus,
} from "../schemas/content/term-adjudication.ts";
import { againstOrUsage, buildQaResult, judgeQaResult, judgeUsage, writeQaResult } from "./qa-results.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { contentLayerInstance } from "../schemas/kg/graph-typology-registry.js";
import { dirname } from "node:path";

const ROOT = resolve(dirname(HARNESS_ROOT));

/** The content layer's name, or a refusal: this check judges that layer's glossary and has nothing to judge without it. */
function contentLayerName(): string {
  const c = contentLayerInstance();
  if (c === undefined) throw new Error("check-term-mapping: no content layer is composed, so there is no glossary to check");
  return c.name;
}
const STEM = "term-mapping";

/** The pinned published IG the `fhir` half resolves against — owner, 2026-09-30. */
// declared-path-literal: the two pinned IG records in cat-harness's `external-schemas/` registry, named by file because the pin is a decision about THESE two records, not a scan of the directory. cat-harness-tools reads cat-harness's directory here; 70lx moved this code up a layer and kept the path, which is now an implementer reading the layer below it (downward). Resolving it through cat-harness's declaration is the follow-up; counted, not hidden.
export const FHIR_PIN = "cat-harness/external-schemas/who-smart-base.json";
export const FHIR_SNAPSHOT = "cat-harness/external-schemas/who-smart-base.terminology.json";

interface GlossTerm {
  id: string;
  prefLabel: string;
  altLabel?: string[];
  exactMatch?: string[];
  status?: string;
  source?: string;
}
interface GlossScheme {
  id: string;
  terms: GlossTerm[];
  /**
   * The layer that owns the scheme, by {@link schemeOwner}. With `id` it
   * is the scheme's key (bean `q3n9`, owner ruling A, 2026-10-24): a scheme
   * id such as `kg-tools` is every layer's Tool extraction.
   */
  instance: string;
}

/**
 * Every file whose name ends in `suffix` under a declared `glossary` graph of
 * any layer in this checkout.
 *
 * Found through the declarations, not a literal path: this script lives in
 * cat-harness and the glossary is declared by the content core, a layer
 * ABOVE it. A hard-coded path to that layer's `glossary` was an upward path no
 * import gate sees, and it would scan nothing — silently — the day cat-harness
 * stands alone (separation placement review, 2026-10-06, bean `0r7u` step 0).
 */
function glossaryFiles(root: string, suffix: string): string[] {
  return declaredGlossaryFiles(root, suffix).map((f) => f.abs);
}

/** {@link glossaryFiles}, each with the layer whose declared directory holds it. */
function declaredGlossaryFiles(root: string, suffix: string): { abs: string; declaredBy: string }[] {
  const out: { abs: string; declaredBy: string }[] = [];
  let declaredBy = "";
  const walk = (dir: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const n of names.sort()) {
      if (n.startsWith(".") || n === "node_modules") continue;
      const abs = join(dir, n);
      let s;
      try {
        s = statSync(abs);
      } catch {
        continue;
      }
      if (s.isDirectory()) walk(abs);
      else if (n.endsWith(suffix)) out.push({ abs, declaredBy });
    }
  };
  for (const instance of layerRootsIn(root)) {
    declaredBy = readDeclaration(instance)?.name ?? "";
    for (const dir of instanceDirectoriesForGraph(instance, "glossary")) walk(dir);
  }
  return out;
}

/**
 * Every `*.term-adjudications.json` beside the schemes, validated, and each
 * record set against what this run found (bean `2i5f` leg 1).
 *
 * An invalid file FAILS the check. A record that cannot be acted on is a
 * defect, not a finding. A record's status is only reported: see
 * {@link adjudicationStatus}.
 */
export function adjudications(
  root: string,
  mappings: readonly TermMapping[],
): { files: number; invalid: string[]; status: { key: string; status: AdjudicationStatus }[] } {
  const files = glossaryFiles(root, TERM_ADJUDICATIONS_SUFFIX);
  const invalid: string[] = [];
  const status: { key: string; status: AdjudicationStatus }[] = [];
  const byKey = new Map(mappings.map((m) => [`${m.scheme}\0${m.term}\0${m.target}`, m]));
  for (const abs of files) {
    const rel = abs.slice(root.length + 1);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(abs, "utf-8"));
    } catch (e) {
      invalid.push(`${rel}: not JSON (${(e as Error).message})`);
      continue;
    }
    const parsed = TermAdjudicationsFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues) invalid.push(`${rel} at \`${i.path.join(".") || "(root)"}\`: ${i.message}`);
      continue;
    }
    for (const r of parsed.data.adjudications) {
      const s = r.subject;
      status.push({
        key: `${s.scheme}/${s.term} on ${s.target}`,
        status: adjudicationStatus(r, byKey.get(`${s.scheme}\0${s.term}\0${s.target}`)),
      });
    }
  }
  return { files: files.length, invalid, status };
}

/**
 * Every `*.glossary.json` in the checkout, authored and generated alike, each
 * keyed by its owning layer.
 *
 * The owner is {@link schemeOwner}'s answer, the same rule the glossary page
 * places terms by, so the record and the page cannot key one scheme two ways.
 * Where it has no answer (terms sourced in several layers, no defining
 * source) the page drops the scheme and `check:glossary` reports it; this
 * drops it too, rather than guess an owner the page does not show.
 */
export function glossarySchemes(root: string): GlossScheme[] {
  const out: GlossScheme[] = [];
  const owners = instanceRoots(root);
  for (const { abs, declaredBy } of declaredGlossaryFiles(root, ".glossary.json")) {
    try {
      const d = JSON.parse(readFileSync(abs, "utf-8")) as { id?: string; source?: string; terms?: GlossTerm[] };
      if (!d.terms) continue;
      const own = schemeOwner(root, { source: d.source, terms: d.terms }, declaredBy, owners);
      if ("error" in own) continue;
      out.push({ id: d.id ?? basename(abs), terms: d.terms, instance: own.owner });
    } catch {
      // A scheme that will not parse is `check:glossary`'s finding, not
      // this one's. Saying it twice would make one defect look like two.
    }
  }
  return out;
}

/**
 * The SKOS half, resolved LOCALLY against authored concepts.
 *
 * "Authoritative for meaning" does not mean "somewhere else": an authored
 * term in this layer is a concept somebody decided, and a candidate that
 * duplicates one is the promotion `glossary-terms` describes. External
 * schemes reached through an authored term's `exactMatch` travel with it, so
 * a match against `policy` also reports the ODRL URI it is an exact match for.
 */
export function skosIndex(schemes: GlossScheme[]): Map<string, ConceptMatch[]> {
  const idx = new Map<string, ConceptMatch[]>();
  const add = (label: string, m: ConceptMatch) => {
    const k = normaliseLabel(label);
    if (!k) return;
    const list = idx.get(k) ?? [];
    list.push(m);
    idx.set(k, list);
  };
  for (const s of schemes) {
    for (const t of s.terms) {
      if (t.status !== "authored") continue;
      // The external URI where there is one, otherwise the in-repo id — a
      // concept without a URI is still a concept somebody authored.
      const uri = t.exactMatch?.[0] ?? `${s.id}:${t.id}`;
      add(t.prefLabel, { uri, predicate: "skos:exactMatch", via: t.prefLabel, scheme: s.id });
      for (const alt of t.altLabel ?? []) {
        add(alt, { uri, predicate: "skos:closeMatch", via: alt, scheme: s.id });
      }
    }
  }
  return idx;
}

/** A candidate term, with its scheme's key: (instance, scheme). */
export interface Candidate {
  term: GlossTerm;
  instance: string;
  scheme: string;
}

/** Candidates, which are what the check is ABOUT. */
export function candidates(schemes: GlossScheme[]): Candidate[] {
  return schemes.flatMap((s) =>
    s.terms.filter((t) => t.status !== "authored").map((term) => ({ term, instance: s.instance, scheme: s.id })),
  );
}

export function resolveSkos(
  cands: Candidate[],
  idx: Map<string, ConceptMatch[]>,
): TermMapping[] {
  return cands.map(({ term, instance, scheme }) => {
    const key = normaliseLabel(term.prefLabel);
    const hits = idx.get(key) ?? [];
    const exactHit = hits.filter((h) => h.predicate === "skos:exactMatch");
    const exact: MatchState = exactHit.length ? "mapped" : "unmapped";
    const concept: MatchState = hits.length ? "mapped" : "unmapped";
    return {
      term: term.id,
      instance,
      scheme,
      target: "skos" as const,
      exact,
      concept,
      ...(hits.length ? { matches: hits } : {}),
    };
  });
}

/**
 * The FHIR half, resolved against a PUBLISHED IG AT A VERSION.
 *
 * Owner, 2026-09-30, choosing between the two assertions this could make:
 * **"this code is in the published base IG at version X"**, not "this code is
 * in the collection this organisation curates today". They can disagree, and
 * only the first is checkable offline and reproducible from the repository.
 *
 * So OCL is not the resolver here. It remains the terminology-MANAGEMENT tool
 * the owner named for the SMART Guidelines side (bean `ejug`) — a different
 * job from answering "does this code exist in v1.0.0".
 *
 * Matching is on the concept's DISPLAY, normalised, because a glossary
 * candidate is a label and a FHIR code is an identifier: the display is the
 * only field the two share. A code match would be a coincidence of spelling.
 */
export function resolveFhir(
  cands: Candidate[],
  pinned: PinnedTerminology | string,
): TermMapping[] {
  if (typeof pinned === "string") {
    // No snapshot: undetermined WITH the reason, never `unmapped`.
    return cands.map(({ term, instance, scheme }) => ({
      term: term.id,
      instance,
      scheme,
      target: "fhir" as const,
      exact: "undetermined" as const,
      concept: "undetermined" as const,
      undetermined_reason: pinned,
    }));
  }
  const idx = new Map<string, ConceptMatch[]>();
  for (const c of pinned.concepts) {
    const k = normaliseLabel(c.display);
    if (!k) continue;
    idx.set(k, [
      ...(idx.get(k) ?? []),
      {
        uri: `${c.system}#${c.code}`,
        predicate: "skos:closeMatch" as const,
        via: c.display,
        scheme: `who-smart-base@${pinned.version}`,
      },
    ]);
  }
  return cands.map(({ term, instance, scheme }) => {
    const hits = idx.get(normaliseLabel(term.prefLabel)) ?? [];
    // `closeMatch`, never `exactMatch`: a label matching a code's display
    // means the two are about the same thing, not that the glossary term IS
    // that code. Claiming exactness across vocabularies is the overreach
    // `vocabulary-authority` exists to prevent.
    return {
      term: term.id,
      instance,
      scheme,
      target: "fhir" as const,
      exact: "unmapped" as const,
      concept: (hits.length ? "mapped" : "unmapped") as MatchState,
      ...(hits.length ? { matches: hits } : {}),
    };
  });
}

export interface PinnedTerminology {
  version: string;
  concepts: { system: string; code: string; display: string }[];
}

/**
 * The pinned snapshot, or the REASON there is none.
 *
 * Returns a string rather than throwing, because "no pinned terminology" is a
 * determined state of this repository and belongs on every row as its
 * `undetermined_reason` — not as a crash, and not as `unmapped`.
 */
export function pinnedTerminology(root: string): PinnedTerminology | string {
  const rec = join(root, FHIR_PIN);
  const snap = join(root, FHIR_SNAPSHOT);
  if (!existsSync(rec)) return `${FHIR_PIN} is absent, so no published IG is pinned`;
  let version: string | undefined;
  try {
    version = (JSON.parse(readFileSync(rec, "utf-8")) as { version?: string }).version;
  } catch {
    return `${FHIR_PIN} will not parse`;
  }
  if (!version || version === "unpinned") {
    return `${FHIR_PIN} is \`unpinned\` — the fhir half asserts a published IG at a VERSION, and none is chosen`;
  }
  if (!existsSync(snap)) {
    return `${FHIR_PIN} pins ${version} but ${FHIR_SNAPSHOT} is absent — run the \`pin-ig-terminology\` Tool`;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(snap, "utf-8"));
  } catch {
    return `${FHIR_SNAPSHOT} will not parse`;
  }
  // VALIDATE, never cast. A bare `as PinnedTerminology` checked only
  // `version`, so a snapshot whose `concepts` were empty, absent or
  // malformed was returned as a CONSULTED terminology — every candidate then
  // came back `unmapped`, determined and with no reason. That is the false
  // measured-zero this whole check exists to refuse, reached from inside it.
  // Found by a review bot on #1633; the schema was already written and simply
  // not called.
  const parsed = PinnedTerminologySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` at \`${first.path.join(".")}\`` : "";
    return `${FHIR_SNAPSHOT} does not satisfy PinnedTerminologySchema${where}: ${first?.message ?? "invalid"} — re-snapshot with the \`pin-ig-terminology\` Tool`;
  }
  const d = parsed.data;
  if (d.version !== version) {
    // The one way this could assert something false: a snapshot of a
    // different version than the record names.
    return `${FHIR_SNAPSHOT} holds ${d.version} while ${FHIR_PIN} pins ${version} — re-snapshot at the pinned tag`;
  }
  // A snapshot of NO concepts cannot support a determined miss. The schema
  // permits an empty array because an empty terminology is a representable
  // thing; what is not representable is consulting one and calling the result
  // a measurement. So the emptiness is refused HERE, where the consequence
  // lives, rather than by tightening the schema for every other reader.
  if (d.concepts.length === 0) {
    return `${FHIR_SNAPSHOT} pins ${version} but holds NO concepts — nothing was consulted, so a miss is undetermined rather than unmapped`;
  }
  return d;
}

export function run(root: string): { mappings: TermMapping[]; scope: MappingScope[] } {
  const schemes = glossarySchemes(root);
  const cands = candidates(schemes);
  const idx = skosIndex(schemes);
  const authoredSchemes = [
    ...new Set(schemes.filter((s) => s.terms.some((t) => t.status === "authored")).map((s) => s.id)),
  ].sort();

  const pinned = pinnedTerminology(root);
  const scope: MappingScope[] = [
    {
      target: "skos",
      consulted: authoredSchemes,
      via: "local — authored terms in this checkout's declared glossary schemes",
    },
    {
      target: "fhir",
      consulted: typeof pinned === "string" ? [] : [`who-smart-base@${pinned.version}`],
      via:
        typeof pinned === "string"
          ? FHIR_PIN
          : `${FHIR_SNAPSHOT} — a published IG at a version, snapshotted offline`,
      ...(typeof pinned === "string"
        ? {
            unreachable_reason:
              `${pinned}. Every fhir row is therefore \`undetermined\`, NOT \`unmapped\` — ` +
              "a terminology nobody consulted has said nothing.",
          }
        : {}),
    },
  ];

  const mappings = [...resolveSkos(cands, idx), ...resolveFhir(cands, pinned)];
  return { mappings, scope };
}

/**
 * A term that matched, and HOW. Bean `5yhm` asks for the exact/concept pair,
 * and the gap between the two is the finding: `exact: false` is the right
 * concept under a different authorised label, which is a different and
 * specifiable outcome from a miss. Projecting only `concept` dropped that half
 * on the way to the committed file.
 */
export interface MappedTerm {
  term: string;
  /** `true` when the label matched a concept's `prefLabel`; `false` when only an `altLabel`, or a cross-vocabulary display, did. */
  exact: boolean;
  /** The URIs of the concepts it matched, which is what a reader follows. */
  concepts: string[];
  /**
   * The subset of {@link concepts} whose `prefLabel` the term matched — the
   * only ones an `exactMatch` may point at. Empty when `exact` is false.
   *
   * `exact` alone could not say WHICH concept was exact: a term matching
   * concept A's prefLabel and concept B's altLabel is `exact: true` with both
   * in `concepts`, and publishing `skos:exactMatch` to B would assert an
   * equivalence nothing measured (bean `5yhm`, the SKOS-publish slice).
   */
  exactConcepts: string[];
}

/**
 * One row per (instance, scheme, target), with all three counts and the mapped terms.
 *
 * Exported because `glossary-page.ts` renders these rows and must not have a
 * second idea of their shape — the page and the record disagreeing about what
 * a state means is the drift a shared type prevents.
 */
export interface SchemeState {
  /**
   * The layer that owns the scheme. A row is keyed by (instance, scheme,
   * target), because a scheme id alone is shared across layers: `kg-tools`
   * is every layer's Tool extraction (beans `wvzp`, `q3n9`; owner ruling A,
   * 2026-10-24).
   */
  instance: string;
  scheme: string;
  target: string;
  mapped: number;
  unmapped: number;
  undetermined: number;
  /** Why the whole target could not be determined, where that is the case. */
  reason?: string;
  /** The terms that matched, each saying whether the match was exact. Few by construction. */
  mappedTerms: MappedTerm[];
  /**
   * Present ONLY when a row mixes `unmapped` and `undetermined`. Otherwise a
   * term's state follows from the counts alone (see {@link termState}), and
   * listing thousands of ids that all say one thing is what the per-scheme
   * shape exists to avoid. In a mixed row the counts cannot say which term is
   * which, so the record names the undetermined ones instead.
   */
  undeterminedTerms?: string[];
}

/**
 * One term's state on one target, read back from the committed per-scheme rows.
 *
 * The ONE place that turns the record into a per-term answer, so the glossary
 * page holds no second implementation (bean `5yhm`, Done-when "the glossary
 * page reports mapped / unmapped / undetermined per term").
 *
 * `unknown` is a fourth answer and is NOT a mapping state. It means the
 * committed record cannot say: there is no row for the (instance, scheme), there is more
 * than one, or a mixed row does not name its undetermined terms. It is never
 * folded into `unmapped`, for the same reason `undetermined` is not (bean
 * `dh4f`).
 */
export type TermStateAnswer =
  | { state: "mapped"; exact: boolean; concepts: string[] }
  | { state: "unmapped" }
  | { state: "undetermined"; reason?: string }
  | { state: "unknown"; why: string };

export function termState(
  states: readonly SchemeState[],
  key: { instance: string; scheme: string } | string,
  target: string,
  term: string,
): TermStateAnswer {
  if (typeof key === "string") {
    const scheme = key;
    const rows = states.filter((s) => s.scheme === scheme && s.target === target);
    const which = `scheme \`${scheme}\``;
    if (rows.length === 0) return { state: "unknown", why: `no row for ${which} on \`${target}\`` };
    const hits = rows.flatMap((r) => r.mappedTerms.filter((m) => m.term === term));
    if (hits.length > 1) return { state: "unknown", why: `${hits.length} rows match \`${term}\` in ${which} on \`${target}\`` };
    if (hits.length === 1) return { state: "mapped", exact: hits[0]!.exact, concepts: hits[0]!.concepts };
    const reason = rows.find((r) => r.reason)?.reason;
    const undetermined = (): TermStateAnswer => ({ state: "undetermined", ...(reason ? { reason } : {}) });
    if (rows.every((r) => r.undetermined === 0)) return { state: "unmapped" };
    if (rows.every((r) => r.unmapped === 0)) return undetermined();
    return { state: "unknown", why: `${which} on \`${target}\` mixes unmapped and undetermined terms` };
  }
  const { instance, scheme } = key;
  const rows = states.filter((s) => s.instance === instance && s.scheme === scheme && s.target === target);
  const which = `scheme \`${scheme}\` of \`${instance}\``;
  if (rows.length !== 1) {
    return {
      state: "unknown",
      why: rows.length
        ? `${rows.length} rows for ${which} on \`${target}\`, so the record is ambiguous`
        : `no row for ${which} on \`${target}\``,
    };
  }
  const row = rows[0]!;
  const hit = row.mappedTerms.find((m) => m.term === term);
  if (hit) return { state: "mapped", exact: hit.exact, concepts: hit.concepts };
  const undetermined = (): TermStateAnswer => ({ state: "undetermined", ...(row.reason ? { reason: row.reason } : {}) });
  if (row.undeterminedTerms) return row.undeterminedTerms.includes(term) ? undetermined() : { state: "unmapped" };
  if (row.undetermined === 0) return { state: "unmapped" };
  if (row.unmapped === 0) return undetermined();
  return {
    state: "unknown",
    why: `${which} on \`${target}\` mixes unmapped and undetermined terms and names neither`,
  };
}

export function perScheme(
  ms: TermMapping[],
  target: string,
  scope: MappingScope[],
): SchemeState[] {
  const of = ms.filter((m) => m.target === target);
  const reason = scope.find((s) => s.target === target)?.unreachable_reason;
  // One row per (instance, scheme): a scheme id is shared across layers
  // (bean `wvzp`), and folding them into one row mixed their terms.
  const keyOf = (m: TermMapping) => `${m.instance}\0${m.scheme}`;
  const keys = [...new Map(of.map((m) => [keyOf(m), m] as const)).entries()]
    .map(([k, m]) => ({ k, instance: m.instance, scheme: m.scheme }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return keys.map(({ k, instance, scheme }) => {
    const rows = of.filter((m) => keyOf(m) === k);
    const n = (k: MatchState) => rows.filter((r) => r.concept === k).length;
    const unmapped = n("unmapped");
    const undetermined = n("undetermined");
    const byTerm = (a: { term: string }, b: { term: string }) => (a.term < b.term ? -1 : a.term > b.term ? 1 : 0);
    return {
      instance,
      scheme,
      target,
      mapped: n("mapped"),
      unmapped,
      undetermined,
      ...(reason ? { reason } : {}),
      mappedTerms: rows
        .filter((r) => r.concept === "mapped")
        .map((r) => ({
          term: r.term,
          exact: r.exact === "mapped",
          concepts: [...new Set((r.matches ?? []).map((m) => m.uri))].sort(),
          exactConcepts: [
            ...new Set((r.matches ?? []).filter((m) => m.predicate === "skos:exactMatch").map((m) => m.uri)),
          ].sort(),
        }))
        .sort(byTerm),
      ...(unmapped > 0 && undetermined > 0
        ? { undeterminedTerms: rows.filter((r) => r.concept === "undetermined").map((r) => r.term).sort() }
        : {}),
    };
  });
}

function summarise(ms: TermMapping[], target: string): string {
  const of = ms.filter((m) => m.target === target);
  const n = (k: MatchState) => of.filter((m) => m.concept === k).length;
  // Three counts, never a ratio — see the module header.
  return `${of.length} candidate(s): ${n("mapped")} mapped, ${n("unmapped")} unmapped, ${n("undetermined")} undetermined`;
}

const GATE = "check:term-mapping";

function main(): number {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  if (check) {
    const usage = judgeUsage(GATE, argv, ["--against"]);
    if (usage !== undefined) return usage;
  }
  const { against, exit: badRef } = againstOrUsage(GATE, argv);
  if (badRef !== undefined) return badRef;
  const { mappings, scope } = run(ROOT);

  // input-site: traced #4492df34 — checked_at of the mappings it writes; main() runs only as an entry
  inputSiteReached("check-term-mapping: clock");
  const checkedAt = new Date().toISOString().slice(0, 10);
  const file = {
    $schema: "folio-term-mappings/v1" as const,
    checked_at: checkedAt,
    scope,
    mappings,
  };
  const parsed = TermMappingsFileSchema.safeParse(file);
  if (!parsed.success) {
    console.error("the result does not satisfy its own schema:");
    console.error(JSON.stringify(parsed.error.issues, null, 2));
    return 2;
  }

  for (const t of MAPPING_TARGETS) {
    const s = scope.find((x) => x.target === t)!;
    console.log(`  ${t}: ${summarise(mappings, t)}`);
    console.log(`    consulted ${s.consulted.length ? s.consulted.join(", ") : "(none declared)"} via ${s.via}`);
    if (s.unreachable_reason) console.log(`    ! ${s.unreachable_reason}`);
  }

  // Leg 1 of `2i5f`: the decisions taken where a candidate and a terminology
  // disagree. Validated in BOTH modes, because an invalid record is a defect
  // whether or not anything is being written.
  const adj = adjudications(ROOT, mappings);
  if (adj.invalid.length) {
    console.error(`  ✗ ${adj.invalid.length} problem(s) in *${TERM_ADJUDICATIONS_SUFFIX}:`);
    for (const i of adj.invalid) console.error(`    ${i}`);
    return 2;
  }
  const tally = (k: AdjudicationStatus) => adj.status.filter((x) => x.status === k).length;
  console.log(
    `  adjudications: ${adj.status.length} in ${adj.files} file(s): ${tally("applied")} applied, ` +
      `${tally("pending")} pending, ${tally("holds")} hold, ${tally("stale")} stale`,
  );
  for (const x of adj.status.filter((y) => y.status === "stale")) console.log(`    ! stale: ${x.key}`);

  const result = buildQaResult({
    script: "cat-harness-tools/scripts/check-term-mapping.ts",
    scriptAbsPath: import.meta.path,
    // declared-path-literal: a QA subject ID (the glossary's declared route), recorded in the sidecar; nothing reads it as a filesystem path.
    // The glossary's owner: the layer declaring the `core` layer's kinds,
    // `glossary` among them (folio-assistant#2598).
    subject: { kind: "glossary", id: `${contentLayerName()}/glossary` },
    families: Object.fromEntries(
      MAPPING_TARGETS.map((t) => [
        t,
        {
          summary: summarise(mappings, t),
          // PER SCHEME, not per term. One row per candidate per target is
          // 5 210 entries here of which 5 210 say the same thing, and burying
          // the actionable ones under them is the failure this file's whole
          // shape exists to avoid. Per scheme is 5 rows, carries all three
          // counts, and is what the glossary page renders.
          //
          // The mapped TERMS are named inside each row, because those are the
          // ones a reader acts on and there are few of them by construction —
          // if that ever stops being true, the page is the thing to page, not
          // the record to truncate.
          entries: perScheme(mappings, t, scope),
        },
      ]),
    ),
  });
  if (check) {
    // `--check` VERIFIES: it never writes, because writing in check mode would
    // make the gate green by repairing what it was asked to inspect.
    //
    // COMPUTE AND JUDGE (bean `0dav`). It used to fail on the committed
    // record's families differing from this run, and on the record being
    // absent — which is the state QA results are in once they leave `main`
    // (owner rulings D1/D4). Nothing here was ever a FINDING: this check
    // "never fails on WHAT IT FOUND" (below), so it fails on no family. What
    // it still fails on is a result that does not satisfy its own schema
    // (exit 2, above). What moved against a baseline is REPORTED: the
    // committed working copy today, `--against <ref>` after the move, and a
    // missing one is UNKNOWN. `check:glossary` renders this computation
    // directly, so the page and the record cannot disagree through this file.
    return judgeQaResult({
      gate: GATE,
      fresh: result,
      baseline: { root: join(ROOT, "cat-harness"), stem: STEM, writer: "term:mapping", against },
    }).exit;
  }
  const out = writeQaResult(join(ROOT, "cat-harness"), STEM, result);
  console.log(`  wrote ${out.slice(ROOT.length + 1)}`);
  // Never fails on WHAT IT FOUND. The three states are the report, and an
  // unmapped candidate may be a term this corpus is right to coin.
  return 0;
}

if (import.meta.main) process.exit(main());
