/**
 * One string's translations, in every locale: its status, its candidates with
 * their provenance, and the default pick when no collaborator has chosen.
 *
 * @module scripts/lib/translation-strings
 * @covers translation-sources
 *
 * The owner's rulings of 2026-11-18 on per-block translation feedback:
 *
 *   1. A block's 🌐 pane lists every locale's current translation and its
 *      status: {@link STRING_STATUSES}.
 *   2. Several proposals per msgid × locale live in the candidates sidecar
 *      (`translation-candidates/v1`); the pane offers each with its
 *      provenance — source and version, date, author, the source-string hash
 *      (so a stale one shows), and QA results.
 *   3. Collaborators adjudicate (the entry's `chosen`, `how: "adjudicated"`).
 *   4. When nobody has adjudicated, the auto-pick is ranked {@link PICK_TIERS}:
 *      official 0, adjudicated 1, human 2, translation platform 3, agent 4,
 *      MT 5, plus {@link QA_PENALTY} for a QA failure; ties to the newest; a
 *      stale candidate is never picked. An auto-pick is fuzzy and unofficial,
 *      except an official candidate whose source English matches the msgid
 *      exactly (owner amendment, 2026-11-18), which is `auto-official`.
 *
 * This module is pure: it reads text it is given. The projection a site
 * publishes ({@link stringsProjection}) is what the pane reads, so the pane
 * restates none of these rules beyond drawing what it is told.
 */
import {
  applyAdjudication,
  applySuggestion,
  msgidHash,
  poEntries,
  type Candidate,
  type CandidatesEntry,
  type CandidatesFile,
  type Chosen,
  type PoEntry,
} from "./translation-adjudication.ts";

/** The translation platforms whose strings people translate (`translation-sources/platforms.ts` PLATFORMS). */
const PLATFORM_IDS: readonly string[] = ["weblate", "crowdin", "transifex"];

/**
 * A string's status in one locale (owner, 2026-11-18: "official /
 * adjudicated / proposed / agent / MT / missing / stale").
 *
 * | status        | the `msgstr` the page shows …                                              |
 * |---------------|-----------------------------------------------------------------------------|
 * | `official`    | is in a catalogue signed off as official, or an exact-match official text   |
 * | `adjudicated` | is what a collaborator chose, for the source text as it is now              |
 * | `proposed`    | is a person's proposal (an issue, a translation platform) nobody adjudicated |
 * | `agent`       | is an agent model's candidate                                               |
 * | `mt`          | is a machine-translation model's or service's candidate                     |
 * | `missing`     | is empty: the page shows the source language                                |
 * | `stale`       | translates an older source text (`#| msgid`, or a hash that no longer matches) |
 * | `unattributed`| is a translation whose provenance nothing records                           |
 */
export const STRING_STATUSES = ["official", "adjudicated", "proposed", "agent", "mt", "missing", "stale", "unattributed"] as const;
export type StringStatus = (typeof STRING_STATUSES)[number];

/**
 * The auto-pick's rank, best first (owner, 2026-11-18): official 0,
 * adjudicated 1, human 2, translation platform (Weblate, Crowdin, Transifex)
 * 3, agent 4, MT 5. A QA failure adds {@link QA_PENALTY}.
 */
export const PICK_TIERS = ["official", "human-adjudicated", "human-proposed", "platform", "agent", "mt"] as const;
export type PickTier = (typeof PICK_TIERS)[number];
export const QA_PENALTY = 10;

/** The tier of one candidate. `chosenText` is what a collaborator chose for this string, if anyone did. */
export function pickTier(c: Pick<Candidate, "text" | "source">, chosenText?: string): PickTier {
  const k = c.source.kind;
  if (k === "official") return "official";
  if (chosenText !== undefined && c.text === chosenText) return "human-adjudicated";
  if (k === "human") return "human-proposed";
  if (k === "web-service" && PLATFORM_IDS.includes(c.source.id.toLowerCase())) return "platform";
  if (k === "agent") return "agent";
  return "mt";
}

/** What a candidate's QA results say failed; empty when it passes, or carries none (a check not run is not a failure). */
export function qaFailures(c: Pick<Candidate, "qa">): string[] {
  const out: string[] = [];
  const q = c.qa;
  if (q?.glossary && !q.glossary.pass) out.push(`glossary: ${(q.glossary.missing ?? []).join(", ") || "terms"} not translated as the glossary fixes`);
  if (q?.placeholders && !q.placeholders.pass) out.push("placeholders do not round-trip");
  if (q?.roundtrip && !q.roundtrip.pass) out.push(`round trip ${q.roundtrip.score.toFixed(2)} < ${q.roundtrip.threshold}`);
  return out;
}

/** Whether a candidate was made for another source text than `hash`. */
export const isStale = (x: { msgidHash?: string }, hash: string): boolean => x.msgidHash !== undefined && x.msgidHash !== hash;

/** One candidate as ranked: its index in the sidecar, tier, score, QA and staleness. */
export interface RankedCandidate {
  index: number;
  candidate: Candidate;
  tier: PickTier;
  /** Tier index, plus {@link QA_PENALTY} for a QA failure. Lower is better. */
  score: number;
  qaFailures: string[];
  stale: boolean;
}

/**
 * Rank a string's candidates: by score; ties to the newest `source.at`, then
 * the order recorded. Stale candidates are listed after every other one and
 * are never the auto-pick ({@link autoPickOf}). `hash` is the string's
 * {@link msgidHash} now.
 */
export function rankCandidates(entry: Pick<CandidatesEntry, "candidates" | "chosen"> | undefined, hash: string, accept: (c: Candidate) => boolean = () => true): RankedCandidate[] {
  if (!entry) return [];
  const chosenText = entry.chosen?.how === "adjudicated" ? entry.chosen.text : undefined;
  const ranked = entry.candidates
    .map((candidate, index) => {
      const tier = pickTier(candidate, chosenText);
      const qa = qaFailures(candidate);
      return { index, candidate, tier, score: PICK_TIERS.indexOf(tier) + (qa.length > 0 ? QA_PENALTY : 0), qaFailures: qa, stale: isStale(candidate, hash) };
    })
    .filter((r) => accept(r.candidate));
  const at = (r: RankedCandidate) => r.candidate.source.at ?? "";
  return ranked.sort((a, b) => Number(a.stale) - Number(b.stale) || a.score - b.score || at(b).localeCompare(at(a)) || a.index - b.index);
}

/** The auto-pick: the best-ranked candidate that is not stale. */
export function autoPickOf(entry: Pick<CandidatesEntry, "candidates" | "chosen"> | undefined, hash: string, accept?: (c: Candidate) => boolean): RankedCandidate | undefined {
  return rankCandidates(entry, hash, accept).find((r) => !r.stale);
}

/**
 * Whether an official candidate's auto-pick is official: only when it names
 * its source English and that English is the entry's msgid exactly (owner
 * amendment, 2026-11-18). Whitespace, case or punctuation differences are not
 * a match.
 */
export const exactOfficial = (c: Candidate, e: { msgid: string }): boolean => c.source.kind === "official" && c.sourceText !== undefined && c.sourceText === e.msgid;

/** The default pick: the collaborator's choice when there is one, else the auto-pick. */
export type DefaultPick =
  | { kind: "adjudicated"; text: string; chosen: Chosen }
  | { kind: "auto"; text: string; index: number; tier: PickTier; official: boolean; unofficial: boolean };

export function defaultPick(entry: CandidatesEntry | undefined, e: { msgid: string; msgctxt?: string; msgidPlural?: string }): DefaultPick | undefined {
  if (entry?.chosen?.how === "adjudicated") return { kind: "adjudicated", text: entry.chosen.text, chosen: entry.chosen };
  const top = autoPickOf(entry, msgidHash(e));
  if (!top) return undefined;
  const official = exactOfficial(top.candidate, e);
  return { kind: "auto", text: top.candidate.text, index: top.index, tier: top.tier, official, unofficial: !official };
}

/**
 * Apply the auto-pick to one singular entry of a catalogue, in memory: the
 * `msgstr` changes only when it is empty or is itself an earlier auto-pick,
 * never over a collaborator's choice or text whose provenance is not an
 * auto-pick. An exact-match official candidate is written without `fuzzy`
 * (`auto-official`); any other is fuzzy and unofficial (`auto`). Returns the
 * new catalogue and the entry's new `chosen`, or `undefined` for no change.
 */
export function applyAutoPick(po: string, entry: CandidatesEntry | undefined, e: PoEntry, at: string, accept?: (c: Candidate) => boolean): { po: string; chosen: Chosen; source: Candidate["source"] } | undefined {
  if (!entry || e.msgidPlural !== undefined) return undefined;
  if (entry.chosen?.how === "adjudicated") return undefined;
  const auto = entry.chosen !== undefined && entry.chosen.text === e.msgstr;
  if (e.msgstr !== "" && !auto) return undefined;
  const top = autoPickOf(entry, msgidHash(e), accept);
  if (!top) return undefined;
  const c = top.candidate;
  const how = exactOfficial(c, e) ? "auto-official" : "auto";
  if (c.text === e.msgstr && entry.chosen?.how === how) return undefined;
  const ctx = e.msgctxt !== undefined ? { msgctxt: e.msgctxt } : {};
  const r = how === "auto-official" ? applyAdjudication(po, { ...ctx, msgid: e.msgid, current: e.msgstr, suggested: c.text }) : applySuggestion(po, { ...ctx, msgid: e.msgid, current: e.msgstr, suggested: c.text });
  if ("refused" in r) return undefined;
  return { po: r.text, chosen: { text: c.text, how, at, candidate: { kind: c.source.kind, id: c.source.id } }, source: c.source };
}

const keyOf = (msgctxt: string | undefined, msgid: string) => `${msgctxt ?? ""}\u0004${msgid}`;

/**
 * The sidecar entry for a catalogue entry, and whether it was found under the
 * entry's PREVIOUS source text (`#| msgid`): candidates recorded for the old
 * source are offered, and shown stale.
 */
export function entryFor(sidecar: CandidatesFile | undefined, e: Pick<PoEntry, "msgctxt" | "msgid" | "previousMsgid" | "previousMsgctxt">): { entry?: CandidatesEntry; previous: boolean } {
  if (!sidecar) return { previous: false };
  const by = new Map(sidecar.entries.map((x) => [keyOf(x.msgctxt, x.msgid), x]));
  const now = by.get(keyOf(e.msgctxt, e.msgid));
  const before = e.previousMsgid !== undefined ? by.get(keyOf(e.previousMsgctxt ?? e.msgctxt, e.previousMsgid)) : undefined;
  if (now && before && before !== now) return { entry: { ...now, candidates: [...now.candidates, ...before.candidates] }, previous: false };
  if (now) return { entry: now, previous: false };
  return before ? { entry: before, previous: true } : { previous: false };
}

/**
 * One string's status in one locale. `officialCatalogue`: the catalogue is
 * signed off as official (the review cell's `official` state).
 * `generatedBy`: what the catalogue's node says produced its strings, the
 * fallback when no candidate matches the text.
 */
export function stringStatus(
  e: Pick<PoEntry, "msgstr" | "forms" | "fuzzy" | "previousMsgid">,
  entry: CandidatesEntry | undefined,
  hash: string,
  o: { officialCatalogue?: boolean; generatedBy?: string; foundUnderPrevious?: boolean } = {},
): StringStatus {
  if (e.forms.every((f) => f === "")) return "missing";
  if (e.previousMsgid !== undefined || o.foundUnderPrevious) return "stale";
  const chosen = entry?.chosen && entry.chosen.text === e.msgstr ? entry.chosen : undefined;
  if (chosen?.how === "adjudicated") return "adjudicated";
  if (chosen?.how === "auto-official" && !e.fuzzy) return "official";
  if (o.officialCatalogue && !e.fuzzy) return "official";
  const matching = (entry?.candidates ?? []).filter((c) => c.text === e.msgstr);
  if (matching.length > 0 && matching.every((c) => isStale(c, hash))) return "stale";
  const tiers = matching.filter((c) => !isStale(c, hash)).map((c) => pickTier(c));
  // An official text that is not an exact match is a proposal until a collaborator chooses it.
  if (tiers.some((t) => t === "official" || t === "human-proposed" || t === "platform")) return "proposed";
  if (tiers.includes("agent")) return "agent";
  if (tiers.includes("mt")) return "mt";
  const g = (o.generatedBy ?? "").toLowerCase();
  if (g === "agent") return "agent";
  if (g === "machine" || g === "open-mt" || g === "web-service") return "mt";
  if (g === "human-draft") return "proposed";
  return "unattributed";
}

// ── The projection ───────────────────────────────────────────────────────

/** The tag of {@link stringsProjection}. */
export const TRANSLATION_STRINGS_SCHEMA = "folio-translation-strings/v1" as const;

/** One candidate as the pane shows it. */
export interface ProjectedCandidate extends Candidate {
  tier: PickTier;
  /** {@link RankedCandidate.score}. */
  score: number;
  stale: boolean;
  /** For an official candidate: whether its source English matches the msgid exactly. */
  exactMatch?: boolean;
  qaFailures: string[];
  /** Its text is what the catalogue says now. */
  current: boolean;
}

/** One string in one locale. */
export interface ProjectedLocaleString {
  text: string;
  forms?: string[];
  status: StringStatus;
  fuzzy: boolean;
  /** How the text came to be what it is, when the sidecar records it. */
  chosen?: Chosen;
  /** The auto-pick when no collaborator has chosen: unofficial unless an exact official match. */
  pick?: { text: string; candidate: number; tier: PickTier; unofficial: boolean };
  /** Best-ranked first. */
  candidates: ProjectedCandidate[];
}

export interface ProjectedString {
  msgctxt?: string;
  msgid: string;
  msgidPlural?: string;
  /** {@link msgidHash} of the source string as the template has it. */
  hash: string;
  /** Source files (`#:`, line numbers dropped). */
  sources: string[];
  locales: Record<string, ProjectedLocaleString>;
}

export interface StringsProjection {
  $schema: typeof TRANSLATION_STRINGS_SCHEMA;
  layer: string;
  repository?: string;
  translations: string;
  catalogue: string;
  /** Per locale: the `poHash` of the catalogue, which an issue is pinned to. */
  hashes: Record<string, string>;
  strings: ProjectedString[];
}

/** One locale's inputs to {@link stringsProjection}. */
export interface LocaleInput {
  po: string;
  sidecar?: CandidatesFile;
  officialCatalogue?: boolean;
  generatedBy?: string;
  poHash: string;
}

/**
 * Every string of one catalogue, in every locale that has a `.po`: what the
 * pane lists. Strings are taken from the first locale's catalogue order, and
 * a string one locale lacks is simply absent from that locale.
 */
export function stringsProjection(meta: { layer: string; repository?: string; translations: string; catalogue: string }, locales: Record<string, LocaleInput>): StringsProjection {
  const strings = new Map<string, ProjectedString>();
  const hashes: Record<string, string> = {};
  for (const [locale, l] of Object.entries(locales).sort(([a], [b]) => a.localeCompare(b, "en"))) {
    hashes[locale] = l.poHash;
    for (const e of poEntries(l.po)) {
      const key = keyOf(e.msgctxt, e.msgid);
      const hash = msgidHash(e);
      const s = strings.get(key) ?? {
        ...(e.msgctxt !== undefined ? { msgctxt: e.msgctxt } : {}),
        msgid: e.msgid,
        ...(e.msgidPlural !== undefined ? { msgidPlural: e.msgidPlural } : {}),
        hash,
        sources: [...new Set(e.references.map((r) => r.replace(/:\d+$/, "")))].sort(),
        locales: {},
      };
      strings.set(key, s);
      const found = entryFor(l.sidecar, e);
      const ranked = rankCandidates(found.entry, hash);
      const chosen = found.entry?.chosen;
      const pickIx = chosen?.how === "adjudicated" || found.previous ? -1 : ranked.findIndex((r) => !r.stale);
      const pick = pickIx >= 0 ? ranked[pickIx]! : undefined;
      s.locales[locale] = {
        text: e.msgstr,
        ...(e.msgidPlural !== undefined ? { forms: e.forms } : {}),
        status: stringStatus(e, found.entry, hash, { officialCatalogue: l.officialCatalogue, generatedBy: l.generatedBy, foundUnderPrevious: found.previous }),
        fuzzy: e.fuzzy,
        ...(chosen ? { chosen } : {}),
        ...(pick ? { pick: { text: pick.candidate.text, candidate: pickIx, tier: pick.tier, unofficial: !exactOfficial(pick.candidate, e) } } : {}),
        candidates: ranked.map((r) => ({
          ...r.candidate,
          tier: r.tier,
          score: r.score,
          stale: r.stale || found.previous,
          ...(r.candidate.source.kind === "official" ? { exactMatch: exactOfficial(r.candidate, e) } : {}),
          qaFailures: r.qaFailures,
          current: r.candidate.text === e.msgstr,
        })),
      };
    }
  }
  return { $schema: TRANSLATION_STRINGS_SCHEMA, ...meta, hashes, strings: [...strings.values()] };
}
