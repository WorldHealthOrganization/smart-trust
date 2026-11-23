/**
 * Voices — named editorial profiles that overlay the base house voice.
 *
 * A **voice** is a named set of editorial rules an agent applies when authoring
 * or reviewing prose. Voices are OVERLAID, not chosen: a folio may activate
 * several, and the union of their rules applies on top of the base house voice
 * in `skills/authoring/authoring-core/one-voice-style-guide.md`.
 *
 * ## A voice is a third axis
 *
 * **Adapters partition block KINDS** and **profiles nest**; a voice does
 * neither. It governs HOW PROSE READS — spelling, punctuation, terminology,
 * register, citation form, and for a design voice the visual conventions
 * around the prose. Two folios can share an adapter and a profile and still
 * speak differently.
 *
 * ## Voices are OPT-IN
 *
 * The default is the empty set, and `harness.config.json` opts in:
 *
 *     { "voices": { "active": ["who-editorial", "who-guideline-development"] } }
 *
 * This is the opposite of `criterionProfiles`, which defaults to EVERY
 * profile: an unasked-for voice produces confident findings against prose
 * never written to that standard — a wrong FAIL at scale.
 *
 * ## Every rule cites its source
 *
 * {@link VoiceRuleSource} is REQUIRED on every rule. A plausible rule without
 * the passage it comes from can be plainly wrong about the style guide it
 * claims to follow.
 *
 * @module schemas/voices
 * @graphNode schema
 */

import { RoleRefSchema } from "../process/role-graph";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolveHarnessConfigPath, readEffectiveConfig } from "../kg/harness-config";
import { join, relative, resolve } from "node:path";
import { z } from "zod";
import { RepoFullNameSchema } from "../kg/repo-full-name.js";

import { kgNodeLabelShape, type KgNodeLabels } from "../kg/kg-node";
import { defaultGraphTypologies, directoryForGraph } from "../kg/cat-harness.js";
import { BLOCK_KINDS } from "./block-kinds.js";
import { discoveredEnum } from "../kg/discovered-vocabulary.js";
import { ProcessElementIdSchema } from "../process/process-element-id.js";

/** Which aspect of the prose (or of its presentation) a rule governs. */
export const VOICE_RULE_CATEGORIES = [
  "spelling",
  "punctuation",
  "terminology",
  "capitalization",
  "citation",
  "person",
  "register",
  "structure",
  "numbers",
  "formatting",
  "accessibility",
  "methodology",
  "visual-identity",
] as const;
export type VoiceRuleCategory = (typeof VOICE_RULE_CATEGORIES)[number];

/**
 * Where a rule comes from, in the ingested corpus.
 *
 * `libraryId` + `sectionId` resolve to a real file under `library/`, which is
 * what `library-is-l1.md` requires of every knowledge-graph reference to a
 * source: "resolves to it THROUGH `library/`, never to a loose path or a bare
 * URL". `quote` is the sentence the rule was read from, so a reviewer can check
 * the derivation without opening the PDF.
 *
 * `pages` is the page range in the SOURCE DOCUMENT, not in the ingested file —
 * it is what a reader cites when they are holding the paper copy.
 */
export const VoiceRuleSourceSchema = z
  .object({
    /**
     * The layer holding the corpus, as its planned `owner/repo` (bean
     * `6rmv`; it was the declared name until then), when it is not this one. Absent means this layer, so every existing citation keeps its
     * meaning unchanged.
     *
     * Bean `r1lz` predicted why this is needed, on 2026-09-19, while deciding
     * the WHO documents would leave for a repository of their own: *"a skill
     * derived from a source text in another repo would cite evidence its own
     * instance cannot resolve."* Moving `voices/who-*.json` out without this
     * breaks all 25 cited rules at once — and provenance was the entire reason
     * those rules were rewritten.
     *
     * An identity, never a path. `../<instance>/library/...` would work today and
     * hardcode a checkout layout into content, which is the practice
     * `AGENTS.md` opens by warning against and which this repository paid for
     * twice in one week. Resolution is `folio-assist-core`'s
     * `resolveLibraryRef`, which reports an unknown layer as its own
     * finding and NEVER falls back to local.
     */
    instance: RepoFullNameSchema.optional(),
    /** `doc_id` under `library/`, e.g. `who-pub-tps-931`. */
    libraryId: z.string().min(1).optional(),
    /** `section_id` within that document, e.g. `page-014` or `sec-180-106-…`. */
    sectionId: z.string().min(1).optional(),
    /** Page range in the source document, e.g. "14" or "131-132". */
    pages: z.string().min(1).optional(),
    /**
     * A node of THIS layer's knowledge graph, as a repo-relative path, for a
     * voice that is a house standard rather than a reading of an outside
     * document.
     *
     * A house standard citing the file that states it is honest; a house
     * standard citing a PDF that is not in `library/` is not — giving a rule a
     * `libraryId` for a document nobody ingested is exactly the false
     * provenance this schema exists to prevent.
     *
     * **`milnor` was this field's worked example and is no longer one.** Its
     * hallmarks were named after Milnor's exposition without being extracted
     * from his writing, so `path` was the honest citation at the time. The
     * paper was then ingested and each hallmark traced to a page — the last on
     * 2026-09-21, bean `w0hi` — so all twelve rules now carry a `libraryId`.
     * The voice keeps `provenance: "house"` regardless, because the citations
     * are evidence FOR this project's standard rather than its source; see
     * {@link VOICE_PROVENANCE}. `technical-writer` is the live `path` case,
     * citing `skills/authoring/authoring-core/technical-documentation.md`.
     */
    // Named `kgRef` until #1168 B9d (owner, 2026-09-30): it holds a PATH, not
    // a `{kind, id}` KG reference, and the old name said the other thing.
    path: z.string().min(1).optional(),
    /**
     * The passage the rule was read from. Required: a citation with no quote
     * cannot be checked without re-reading the source, which is the cost this
     * field exists to remove.
     */
    quote: z.string().min(1),
  })
  .refine(
    (src) =>
      (src.libraryId !== undefined && src.sectionId !== undefined) !==
      (src.path !== undefined),
    {
      message:
        "a rule cites EITHER an ingested source (libraryId + sectionId) OR a node of this instance's KG (path) — exactly one, never both and never neither",
    },
  );
export type VoiceRuleSource = z.infer<typeof VoiceRuleSourceSchema>;

/** A regex the mechanical half of a voice check may look for. */
export const VoicePatternSchema = z.object({
  regex: z.string().min(1),
  caseSensitive: z.boolean().optional(),
  /** What a match MEANS. Shown as the finding's evidence. */
  message: z.string().min(1),
});

/** A preferred/deprecated wording pair. */
export const VoiceTerminologySchema = z.object({
  correct: z.string().min(1),
  incorrect: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  /** When the pair applies only in a particular context. */
  context: z.string().min(1).optional(),
});

/**
 * One editorial rule.
 *
 * `severity` grades the RULE's authors' concern, not the confidence of any
 * particular match — the same caveat `voice-editorial-review.md` states for the
 * house voice, and the reason three of that axis's four `critical` findings in
 * this repo turned out to be quotations.
 */
export const VoiceRuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "a rule id is lower-case kebab"),
  ...kgNodeLabelShape,
  /** Required here even though `kgNodeLabelShape` makes it optional: an unnamed rule cannot be reported. */
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(VOICE_RULE_CATEGORIES),
  severity: z.enum(["critical", "major", "minor"]),
  source: VoiceRuleSourceSchema,
  patterns: z.array(VoicePatternSchema).optional(),
  terminology: z.array(VoiceTerminologySchema).optional(),
  /**
   * True when no lexical check can decide this rule and a reviewer must.
   * Recorded rather than inferred from the absence of `patterns`, because
   * "nobody has written the pattern yet" and "no pattern could work" are
   * different states and only the second is a finished rule.
   */
  judgementOnly: z.boolean().optional(),
});
export type VoiceRule = z.infer<typeof VoiceRuleSchema>;

/**
 * A voice in this layer, or in another one.
 *
 * Mirrors `ThemeRef` and `LibraryRef` exactly, and for the same reason: a
 * NAME, never a path. `../<instance>/skills/voices/who-editorial/voice.json` would
 * work today and hardcode a checkout layout into content.
 */
export const VoiceRefSchema = z
  .object({
    /** The layer holding it, as `owner/repo` (bean `6rmv`). Absent means this one. */
    instance: RepoFullNameSchema.optional(),
    voiceId: z.string().regex(/^[a-z0-9-]+$/, "a voice id is lower-case kebab"),
  })
  .strict();
export type VoiceRef = z.infer<typeof VoiceRefSchema>;

/**
 * Where a voice's rules come from, EPISTEMICALLY — the one thing about a
 * published source that no amount of reading the rules will tell you.
 *
 * - `assertion` — a publisher describing its own product or house style. True
 *   by declaration, revisable without notice, and in one case in this
 *   repository describing a product that no longer exists.
 * - `evidence` — the voice's rules are CITED. Each one names the document and
 *   the place in it that the rule was read from, and carries the passage
 *   verbatim, so a reader can go and check. Owner, 2026-09-21: *"start
 *   formalizeing evidence. already a process…. citation is evidence"* — which
 *   is why this is not the narrower "a measurement somebody else can repeat"
 *   it said until then. A measurement is one kind of citable source and not
 *   the only one: a judgement about exposition, read off a named page of a
 *   named paper, is evidence in exactly the sense that matters here — somebody
 *   else can open the page. The apparatus already exists and is REQUIRED by
 *   {@link VoiceRuleSourceSchema}: a `libraryId` + `sectionId` or a `path`,
 *   plus the quote. Formalising `evidence` means naming that apparatus as what
 *   the value MEANS, not building a second one.
 * - `house` — a standard THIS PROJECT set for itself. The `milnor` voice is
 *   the case, and it keeps the value although all twelve of its rules cite an
 *   ingested paper, because the citations are evidence FOR the standard rather
 *   than its source: Milnor did not write a style guide, and the decision to
 *   adopt his exposition as this project's is ours. Owner, 2026-09-21, asked
 *   whether `milnor` should be reclassified: *"c) keep, but is a QA flag"*.
 *
 * ## The value is a property of the VOICE, not of its rules
 *
 * Asked on 2026-09-21 whether `provenance` should move onto the rule — a
 * corpus sweep had found `milnor` declaring `house` with 12/12 rules citing an
 * ingested document, and `technical-writer` declaring `assertion` with 3/9
 * citing a node in this project — the owner refused it, and the reason is the
 * part worth keeping:
 *
 * > voices may be comprised of many composite voices w/ unclear attribution.
 * > attrinution by rule makes no sense in a collaborative/synethsizing process.
 *
 * A voice is a SYNTHESIS. Its rules are read, merged, narrowed and re-derived
 * from several sources by several hands, and the attribution of any one rule
 * to any one of them is frequently not recoverable — so a per-rule field would
 * be precise about something nobody can actually determine, which is worse
 * than a coarse field that is honest. `overrides` already carries composition;
 * this carries the character of the result.
 *
 * **The divergence is therefore a QA FLAG, never a schema error.** A voice
 * whose declared value sits oddly against its rules' citations is a question
 * for a person, and {@link VOICE_PROVENANCE_FLAGS} is where that is computed.
 * Refusing such a voice at parse time would encode the per-rule model the
 * owner just refused, one level down.
 *
 * REQUIRED, with no default. A rule read from a vendor page is a CONVENTION
 * and a cited rule is one a reader can go and check; treating the first as the
 * second is how "best practice" acquires the authority of a result. Nothing in
 * the rule text distinguishes them, and a default would pick one silently for
 * every voice somebody forgets to classify.
 */
export const VOICE_PROVENANCE = ["assertion", "evidence", "house"] as const;
export type VoiceProvenance = (typeof VOICE_PROVENANCE)[number];

/**
 * Where a voice's DECLARED provenance sits oddly against what its rules cite.
 *
 * Owner, 2026-09-21, on `milnor` declaring `house` while all twelve of its
 * rules cite an ingested paper: *"c) keep, but is a QA flag"*.
 *
 * **A flag is a question for a person, never a defect and never a gate.** That
 * is forced by the same ruling that produced it: a voice is a synthesis of
 * composite voices *"w/ unclear attribution"*, so a mixed citation pattern is
 * the NORMAL case and refusing it would encode per-rule attribution one level
 * down from where the owner refused it. Nothing here exits non-zero; the
 * voices viewer renders the flags and a person decides.
 *
 * ## What can actually diverge
 *
 * {@link VoiceRuleSourceSchema} already refuses a rule that cites nothing, so
 * "declared `evidence`, cites nothing" is unfireable and is deliberately NOT a
 * flag — a check that cannot fire is indistinguishable from one that always
 * passes, and this repository has paid for that confusion often enough to stop
 * writing them. What remains is the axis the refinement leaves open: whether a
 * rule cites an OUTSIDE document or a node of this project's own graph.
 *
 * | declared | cites this project's own nodes | flag |
 * |---|---|---|
 * | `assertion` | any | **yes** — a publisher describing its own house style does not cite ours |
 * | `evidence` | any | **yes** — a node we wrote is not a source a reader checks us against |
 * | `house` | none | **no**, by the ruling above — the citations are evidence FOR the standard |
 *
 * Measured over the five voices this repository ships, 2026-09-21: **one
 * fires.** `technical-writer` declares `assertion` with 3 of 9 rules citing
 * `skills/authoring/authoring-core/technical-documentation.md`; `milnor` does not fire, by
 * the ruling; the three WHO voices cite only ingested documents. A flag on
 * `technical-writer` is the right outcome rather than a false positive — it is
 * a genuinely mixed voice, and asking whether that makes it `house` is a
 * question only a person can answer.
 */
export interface VoiceProvenanceFlag {
  code: "declared-outside-cites-inside";
  /** Rule ids that cite a node of this layer's own graph. */
  ruleIds: string[];
  detail: string;
}

/**
 * The flags for one voice. Empty is the common and correct case.
 *
 * Takes the pieces rather than a parsed voice so a caller holding a raw record
 * — the viewer's projection does — need not round-trip it through Zod first.
 */
export function voiceProvenanceFlags(
  provenance: string,
  rules: readonly { id: string; source?: { path?: string } }[],
): VoiceProvenanceFlag[] {
  if (provenance === "house") return [];
  const inside = rules.filter((r) => r.source?.path !== undefined).map((r) => r.id);
  if (inside.length === 0) return [];
  return [
    {
      code: "declared-outside-cites-inside",
      ruleIds: inside,
      detail:
        // Plain text, no markup: the detail is read by a console reporter AND
        // escaped into HTML by the voices viewer, so a backtick here renders as
        // a literal backtick on the page.
        `declares "${provenance}" — a voice read from outside this project — while ` +
        `${inside.length} of ${rules.length} rule(s) cite a node of this project's own ` +
        "graph. That part of it is a house standard. A voice may legitimately be a " +
        "synthesis of both; this asks whether the declared value still describes the " +
        "result, and only a person can answer it",
    },
  ];
}

/**
 * When a voice is IN FORCE — the process axis.
 *
 * Owner, 2026-09-20: *"specialized voices depending on context/process or user
 * scenario/requirements like in CRDM"*. A voice is not only a property of the
 * folio, it is a property of WHAT YOU ARE DOING. The register that belongs in
 * a requirements interview is not the one that belongs in a published
 * guideline, and CRDM already models the phases as lanes and activities of a
 * BPMN process, so the binding it needs already exists as declared objects.
 *
 * **This is a DIFFERENT axis from `appliesTo`, which is block kinds**, and the
 * two are kept apart rather than merged into one "scope" field. A voice can
 * govern `prose` blocks everywhere, or every block kind but only inside one
 * process. Collapsing them would make those two indistinguishable.
 *
 * Every list is optional and ABSENT MEANS EVERYWHERE — the same default
 * `appliesTo` takes. An empty array is not the same thing and is rejected:
 * `processes: []` reads as "no processes", which would silently switch the
 * voice off, and a voice that is off for a reason nobody wrote down is the
 * failure this whole module's opt-in default exists to prevent.
 */
export const VoiceApplicabilitySchema = z
  .object({
    /**
     * BPMN process ids, as `<bpmn:process id>` spells them —
     * `Process_CRDM_Requirements`, not a filename (#1168, B8: the element
     * id, as `calledElement` uses it). Resolved against the loaded diagrams
     * by `process-refs.test.ts`, so a typo is a dangling reference rather
     * than a voice that quietly never activates.
     */
    processes: z.array(ProcessElementIdSchema).min(1).optional(),
    /**
     * The roles this voice addresses — the reader it is written FOR.
     *
     * The voice points at the role, never the other way (#1168, B2): until
     * then each role carried a one-sentence `voice` of its own, so adding a
     * voice meant editing the role, and a role could hold only one. A role is
     * the swimlane, so a voice bound here applies for exactly the duration
     * somebody acts in it. `check:voices` resolves each against the named
     * layer's role graph.
     */
    roles: z.array(RoleRefSchema).min(1).optional(),
    /**
     * User scenarios or requirement ids this voice serves.
     *
     * FREE TEXT, deliberately, where `processes` and `roles` resolve against
     * declared objects. A scenario is the thing that has not been formalised
     * yet — it is what a requirement looks like before CRDM turns it into a
     * process — so demanding a declared id here would mean no voice could be
     * written until the process existed, which is backwards.
     */
    scenarios: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
export type VoiceApplicability = z.infer<typeof VoiceApplicabilitySchema>;

/**
 * A source that has been replaced, recorded rather than dropped.
 *
 * The case, measured 2026-09-20 off the document's own face: the Gemini CLI
 * *Agent Skill best practices* page carries a banner reading *"Gemini CLI was
 * replaced by Antigravity CLI on June 18th, 2026"* and a footer reading *"Last
 * updated: Apr 30, 2026"*.
 *
 * Dropping such a voice loses the guidance, which may still be sound; keeping
 * it unmarked lets a rule be followed on the authority of a dead product. So
 * it is kept and marked, and `successor` — when there IS one — is what lets a
 * reviewer ask the only question that matters: which of these rules survived?
 *
 * `successor` is OPTIONAL and its absence is a real state rather than an
 * oversight. Antigravity's *Best practices* page replaced the product without
 * replacing the document: it covers operator workflow, not skill authoring.
 * Recording "superseded, successor unknown" is the honest answer, and it is
 * not the same as "superseded by that one over there".
 */
export const VoiceSupersessionSchema = z
  .object({
    /** ISO date the replacement took effect, as the source states it. */
    on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "an ISO date, as the source states it"),
    /** What replaced it, in the source's own words. */
    by: z.string().min(1),
    /** Where that is stated — a quote, so a reader need not re-open the PDF. */
    quote: z.string().min(1),
    /** The voice reading the successor document, when one has been ingested. */
    successor: VoiceRefSchema.optional(),
  })
  .strict();
export type VoiceSupersession = z.infer<typeof VoiceSupersessionSchema>;

/** A named voice profile. */
/**
 * Artefact kinds a voice may audit, beside block kinds.
 *
 * #1168 B8, owner 2026-09-30 (*"union type"*): `appliesTo` was documented as
 * block kinds while the technical-writer voice named `docs`, `skill`, `readme`
 * and `specification` — whole artefacts, not blocks. Declared here so a typo
 * in either vocabulary fails rather than silently auditing nothing.
 */
export const VOICE_ARTEFACT_KINDS = ["docs", "skill", "readme", "specification", "code"] as const;

/**
 * One thing a voice audits: a block kind or a declared artefact kind.
 *
 * The block kinds are the composition's, discovered from the mounted
 * `block-kinds/` graphs, so they are marked as such: the harness's published
 * JSON Schema writes them as an open string rather than whichever kinds were
 * mounted when it was generated (bean `8lcl`).
 */
export const VoiceTargetSchema = z.union([discoveredEnum(BLOCK_KINDS, "block-kinds"), z.enum(VOICE_ARTEFACT_KINDS)]);

export const VoiceProfileSchema = z.object({
  /**
   * EITHER tag, because a voice skill IS a profile plus the skill half.
   *
   * `folio-voice/v1` is the bare profile; `folio-voice-skill/v1` adds
   * `instructions` and the per-rule authoring flags, and every field THIS
   * schema names means the same thing in both. A consumer that needs the skill
   * half parses with `VoiceSkillSchema`, which pins its own tag strictly; a
   * consumer that needs the rules — which is most of them — reads either and
   * does not care.
   *
   * Two tags rather than a rename because the corpus migrates over time. A
   * downstream folio still shipping bare profiles must keep loading after an
   * upgrade it did not ask for, which is the same read-both/write-new rule
   * `qa-paths.ts` states one graph over.
   */
  $schema: z.union([z.literal("folio-voice/v1"), z.literal("folio-voice-skill/v1")]),
  id: z.string().regex(/^[a-z0-9-]+$/, "a voice id is lower-case kebab"),
  ...kgNodeLabelShape,
  title: z.string().min(1),
  description: z.string().min(1),
  /** The ingested documents this voice is derived from. */
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        /** The layer holding it, when not this one. See `VoiceRuleSourceSchema.instance`. */
        instance: RepoFullNameSchema.optional(),
        /** Absent for a house standard — see `VoiceRuleSourceSchema.path`. */
        libraryId: z.string().min(1).optional(),
        /** The KG node stating the standard, for a voice with no ingested source. */
        path: z.string().min(1).optional(),
        /** Where the document came from, for a reader who wants the original. */
        url: z.string().url().optional(),
        year: z.number().int().optional(),
      }),
    )
    .min(1, "a voice must name at least one source — ingested or a KG node"),
  rules: z.array(VoiceRuleSchema).min(1),

  /**
   * How severe a finding against THIS VOICE AS A WHOLE is, for the overlay
   * criterion derived from it.
   *
   * ## It is declared because it is not derivable, and that was measured
   *
   * The obvious rule — take the worst rule's severity — is wrong. Against the
   * four voices this repository shipped when the criteria were hand-written,
   * it agrees twice and disagrees twice: `who-publication-design` carries two
   * `critical` rules and its criterion was registered `major`, while `milnor`'s
   * worst rule is `major` and its criterion was registered `minor`. So the
   * overlay's weight is an editorial judgement about the voice, not a maximum
   * over its rules, and deriving it would have silently re-graded two of four.
   *
   * ## Absent is a documented default, not unknown
   *
   * A voice that declares none gets `major` — the middle grade, and the one a
   * reader can act on without it either blocking a build or being ignored.
   * Stated here rather than at the call site so every consumer reads one
   * answer. A voice that means something else says so.
   */
  overlaySeverity: z.enum(["critical", "major", "minor"]).optional(),
  /** What this voice audits — block kinds or artefact kinds. Absent means every kind the folio has. */
  appliesTo: z.array(VoiceTargetSchema).optional(),
  /**
   * Where this voice's rules come from, epistemically. See
   * {@link VOICE_PROVENANCE} for why it is required and has no default.
   */
  provenance: z.enum(VOICE_PROVENANCE),
  /**
   * The voice this one OVERRIDES — a shared base it adds to and narrows.
   *
   * Owner, 2026-09-20: *"for model specific sources, make those model specific
   * voices."* The vendors overlap heavily — "degrees of freedom", with the same
   * three levels and nearly the same triggers, appears in both Anthropic's and
   * Google's pages — so the agreed part is stated once in a base voice and an
   * override carries only what differs. Stating it three times instead would
   * make it impossible to tell an agreed rule from a coincidence, and would
   * drift the moment one vendor revised.
   *
   * ONE parent, not a list. A voice with two parents has no defined answer
   * when they disagree, and the whole point of an override is that there is
   * one thing being overridden.
   *
   * **Where such a voice LIVES** is the reserved {@link VOICE_VENDORS_DIR}
   * sub-sub-graph, on the owner's ruling of 2026-09-22. This field stays the
   * contract either way: the directory is where a person looks, and nothing
   * infers the relation from a path.
   */
  extends: VoiceRefSchema.optional(),
  /**
   * When this voice is in force, by process, lane or scenario. Absent means
   * everywhere. See {@link VoiceApplicabilitySchema}.
   */
  activeIn: VoiceApplicabilitySchema.optional(),
  /** Set when the source has been replaced. See {@link VoiceSupersessionSchema}. */
  superseded: VoiceSupersessionSchema.optional(),
});
export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;
export type VoiceProfileLabels = KgNodeLabels;

/** The `voices` section of `harness.config.json`. */
export const VoiceConfigSchema = z.object({
  /**
   * Voice ids this folio activates. ABSENT OR EMPTY MEANS NONE — see the
   * module comment on why the default is the empty set rather than everything.
   */
  active: z.array(z.string().min(1)).default([]),
});
export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

/** Thrown when a voice file will not load. */
export class VoiceLoadError extends Error {
  constructor(file: string, detail: string) {
    super(`voice ${file}: ${detail}`);
    this.name = "VoiceLoadError";
  }
}

/**
 * The directory a voice graph lives in, relative to a layer root.
 *
 * **Asked of the declaration, not composed.** Every layer that ships voices
 * declares a `voices` graph in its own `<name>.config.json`, and that entry is
 * the answer — the same rule `po-resolve.ts` follows for `translation-sources`
 * and for the same reason: the layout moved once already (2026-09-21, from
 * `voices/` to `skills/voices/`, because a voice IS a skill) and a composed
 * path would have gone stale in every reader at once.
 */
export function voicesDirFor(instanceRoot: string): string | undefined {
  return directoryForGraph(instanceRoot, "voices");
}

/**
 * The convention for a layer that declares nothing.
 *
 * declared-path-literal: the fallback, stated at the call site so the choice is
 * visible. It names the CURRENT layout, so an undeclared layer and a
 * declared one land in the same place rather than the reader silently serving
 * the pre-migration one.
 */
export const VOICES_DIR = "skills/voices";

/**
 * The pre-2026-09-21 layout, still probed.
 *
 * declared-path-literal: the layout a folio created before the move to
 * `skills/` has on disk. It is named here rather than at the call site so
 * "where voices used to live" is one fact with one home.
 *
 * Voices moved under `skills/` because a voice IS a skill (bean `btuv`). A
 * layer that declares its directory is unaffected either way; this is for
 * the one that declares nothing and has not migrated, and it is the same
 * read-both/write-new asymmetry {@link voiceFilesIn} applies to the two FILE
 * layouts one level down. An upgrade must not make a downstream folio's voices
 * disappear silently — that is indistinguishable from having none.
 */
export const LEGACY_VOICES_DIR = "voices";

/**
 * Where to look when the layer declares nothing: the current layout, or the
 * legacy one if that is what is actually on disk.
 *
 * Returns the CURRENT path when neither exists, so a caller reporting "absent"
 * names the place a voice should go rather than the place it used to.
 */
function voicesFallbackDir(instanceRoot: string): string {
  const now = resolve(instanceRoot, VOICES_DIR);
  if (existsSync(now)) return now;
  const legacy = resolve(instanceRoot, LEGACY_VOICES_DIR);
  return existsSync(legacy) ? legacy : now;
}

/**
 * The reserved sub-sub-graph holding VENDOR OVERRIDES of a base voice.
 *
 * Owner, 2026-09-22: *"vendor overides go in sub-sub-grahiphs like
 * voice/vendors or voices-vendors"*.
 *
 * Of the two spellings offered, the NESTED one is the shape this declaration
 * model already has. `voices-vendors/` would need a SECOND declared graph for
 * one concept, and a declaration inside a declaration is the defect #263's own
 * comment names — so the vendors live inside the `voices` graph as a
 * subdirectory, one declaration, and every consumer that already asks for
 * `voices` gets them with no change.
 *
 * **The directory is where a person looks; the FILE is still the contract.** A
 * vendor voice declares what it overrides through its own {@link
 * VoiceProfileSchema} `extends` field — the field is `extends`, not
 * `overrides`, and writing the latter is how this comment was wrong for one
 * draft — exactly as one sitting flat would, so nothing downstream infers a
 * relation from a path. That is this repository's standing rule — extension and
 * location are coincidences, a declaration inside the file is the contract —
 * and it is why this name is a convention for humans rather than a second
 * source of truth.
 */
/**
 * **Superseded 2026-09-30 (bean `rkqp`)**: the loader no longer descends by
 * this name. The owner asked for `vendors/` and each `vendors/<id>/` to be
 * DECLARED sub-graphs, so `voiceFilesIn` follows `voices.json` and
 * `vendors/vendors.json`. The name stays as the conventional spelling a person
 * uses when creating the directory.
 */
export const VOICE_VENDORS_DIR = "vendors";

/**
 * Every voice file under one voices directory, whichever layout it uses.
 *
 * THREE shapes are read, because the migration is a fact about a corpus rather
 * than an instant:
 *
 *  - `skills/voices/<id>/voice.json` — a voice SKILL, rules beside the
 *    `SKILL.md` that says how to use them. What this repository ships.
 *  - `skills/voices/<id>.json` — a bare profile, the shape before the move,
 *    still valid and still loaded so a downstream folio is not broken by an
 *    upgrade it did not ask for.
 *  - `skills/voices/vendors/<id>/voice.json` (and `<id>.json`) — a vendor
 *    override, in the reserved {@link VOICE_VENDORS_DIR} sub-sub-graph.
 *
 * Read all three, prefer none — the first two cannot collide, because a
 * directory and a file cannot share a name, and the third is one reserved name
 * deeper. The same read-both/write-new asymmetry `qa-paths.ts` argues for, one
 * graph over.
 *
 * **Descending is not cosmetic, and the cost of not descending was measured
 * before it was paid.** This scanned ONE level and treated a directory as a
 * voice only where it held a `voice.json`. `vendors/` holds none — its children
 * do — so on the owner's layout every vendor override would have been skipped
 * in silence, and `loadVoices` would have reported a clean read over real
 * content. That is `dh4f` exactly: a consumer scans nothing and calls it a
 * clean run. Found by reading this function when the layout was chosen, not
 * after shipping into it.
 */
export function voiceFilesIn(dir: string, kind: string = "voices"): { id: string; path: string }[] {
  const out: { id: string; path: string }[] = [];
  // The directory's own from-within declaration (bean `rkqp`, owner
  // 2026-09-30: "vendors/<id>/ should be declared subgraphs along with
  // vendors/"). It names the sub-graphs this directory holds, and it is not a
  // voice, so it is not read as one.
  const declFile = defaultGraphTypologies.get(kind)?.declarationFile;
  const subgraphs = declaredSubgraphs(dir, declFile);
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isDirectory()) {
      const inner = join(dir, e.name, "voice.json");
      const sub = subgraphs.get(e.name);
      if (existsSync(inner)) {
        // Inside a SUB-graph (`vendors/`) the declaration is the member list:
        // the owner asked for each `vendors/<id>/` to be declared, so an
        // undeclared one is refused rather than loaded on its shape. At the
        // top of `voices` a `<id>/voice.json` is the graph itself and needs no
        // entry.
        if (kind !== "voices" && sub === undefined) {
          throw new Error(
            `voices: ${join(dir, e.name)} is a voice in the "${kind}" sub-graph but is not declared. ` +
              `Add it to ${declFile ? join(dir, declFile) : `a declaration for kind "${kind}"`}.`,
          );
        }
        out.push({ id: e.name, path: inner });
      } else if (sub !== undefined) {
        // Descend only where a declaration says to. Replaces the reserved
        // name `vendors`: a convention nothing declared, which the owner
        // asked to be declared instead.
        out.push(...voiceFilesIn(join(dir, e.name), sub));
      } else if (voiceFilesPresent(join(dir, e.name))) {
        // A directory holding voices that nothing declares. Skipping it is
        // `dh4f` (a consumer scans nothing and calls the read clean), so it is
        // refused, with the fix named.
        throw new Error(
          `voices: ${join(dir, e.name)} holds voice files but is not declared. ` +
            `Add it to ${declFile ? join(dir, declFile) : `a declaration for kind "${kind}"`} as a sub-graph.`,
        );
      }
    } else if (e.isFile() && e.name.endsWith(".json") && e.name !== declFile) {
      out.push({ id: e.name.replace(/\.json$/, ""), path: join(dir, e.name) });
    }
  }
  return out;
}

/** The file name of a voices directory's from-within declaration, if the kind has one. */
export const VOICES_DECLARATION_FILE = defaultGraphTypologies.get("voices")?.declarationFile;

/** The sub-graphs `dir`'s declaration names: directory name → its graph typology. */
function declaredSubgraphs(dir: string, declFile: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  if (declFile === undefined) return out;
  const p = join(dir, declFile);
  if (!existsSync(p)) return out;
  // A declaration that will not parse throws, as a malformed voice does: an
  // unreadable declaration must not present as a directory with no sub-graphs.
  const parsed = JSON.parse(readFileSync(p, "utf-8")) as {
    directories?: Array<{ path?: string; graphTypologies?: string[] }>;
  };
  for (const d of parsed.directories ?? []) {
    const name = (d.path ?? "").replace(/^\.\//, "").replace(/\/+$/, "");
    const kind = d.graphTypologies?.[0];
    if (name !== "" && !name.includes("/") && kind !== undefined) out.set(name, kind);
  }
  return out;
}

/** Does `dir` hold a voice file anywhere beneath it? */
function voiceFilesPresent(dir: string): boolean {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && e.name === "voice.json") return true;
    if (e.isDirectory() && voiceFilesPresent(join(dir, e.name))) return true;
  }
  return false;
}

/**
 * Load every voice profile a layer ships.
 *
 * Reads and VALIDATES — a malformed voice throws rather than being skipped.
 * PR #210 declared `export const VOICE_REGISTRY: VoiceProfile[] = []` with the
 * comment "Populated by loadVoices() at startup", and no `loadVoices` existed,
 * so every consumer saw an empty registry and reported no rules. That is the
 * `resolveSkillDirs` pattern again: a declaration with no reader.
 *
 * "Could not read" is NOT an empty registry. A directory that is absent returns
 * `[]` and says so through {@link voicesPresent}; a file that will not parse
 * throws. An unreadable voice must not present as a folio with no voices,
 * because the second is a legitimate state and the first is a defect.
 */
export function loadVoices(instanceRoot: string): VoiceProfile[] {
  const dir = voicesDirFor(instanceRoot) ?? voicesFallbackDir(instanceRoot);
  if (!existsSync(dir)) return [];
  const out: VoiceProfile[] = [];
  for (const { id, path } of voiceFilesIn(dir)) {
    const f = relative(dir, path);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf-8"));
    } catch (e) {
      throw new VoiceLoadError(f, `not valid JSON — ${(e as Error).message}`);
    }
    // A voice SKILL is a superset of a profile — it adds `instructions` and
    // the per-rule authoring flags. Parsed as a profile here because that is
    // what every consumer of this function needs; `schemas/content/voice-skill.ts`
    // parses the whole thing where the skill half matters. `passthrough` so
    // the added keys survive rather than being stripped into a lie about the
    // file's contents.
    const parsed = VoiceProfileSchema.passthrough().safeParse(raw);
    if (!parsed.success) {
      throw new VoiceLoadError(f, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    if (parsed.data.id !== id) {
      throw new VoiceLoadError(
        f,
        `declares id "${parsed.data.id}" — the ${path.endsWith("voice.json") ? "directory" : "filename"} must match the id`,
      );
    }
    out.push(parsed.data as VoiceProfile);
  }
  return out;
}

/** Whether this layer ships a voice graph at all — the third state. */
export function voicesPresent(instanceRoot: string): boolean {
  const dir = voicesDirFor(instanceRoot) ?? resolve(instanceRoot, VOICES_DIR);
  return existsSync(dir);
}

/**
 * The voices a folio has ACTIVATED, in the order their rules should be read.
 *
 * An id in `active` that names no shipped voice is an error, not a silent skip:
 * a folio that thinks it is applying the WHO editorial voice and is applying
 * nothing is the worst of the three outcomes, because the output looks clean.
 */
export function activeVoices(
  shipped: VoiceProfile[],
  config: VoiceConfig | undefined,
): VoiceProfile[] {
  const wanted = config?.active ?? [];
  const byId = new Map(shipped.map((v) => [v.id, v]));
  const missing = wanted.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new VoiceLoadError(
      missing.join(", "),
      `activated in <name>.config.json but no such voice is shipped. ` +
        `Available: ${[...byId.keys()].join(", ") || "(none)"}`,
    );
  }
  return wanted.map((id) => byId.get(id)!);
}

/**
 * Every rule from a set of voices, with the voice each came from.
 *
 * Rules are UNIONED rather than merged: two voices may both speak about
 * capitalisation and both rules stand, because a reviewer reading a finding
 * needs to know which voice raised it. Deduplication by rule id across voices
 * would silently drop the second voice's reasoning.
 */
export function unionRules(
  voices: VoiceProfile[],
): Array<{ voice: string; rule: VoiceRule }> {
  return voices.flatMap((v) => v.rules.map((rule) => ({ voice: v.id, rule })));
}

/**
 * The voice ids a folio has activated, read from its harness config —
 * resolved by `resolveHarnessConfigPath`, never by a filename spelled here.
 *
 * THREE-VALUED, and the distinction is what the QA voice gate turns on:
 *
 * - `[]` — the config was read and activates no voice. The common case, and this
 *   layer's. A voice-scoped criterion is `n/a`.
 * - `["who-editorial", …]` — the config was read and activates these.
 * - `undefined` — the config could NOT be read: absent, or present and
 *   unparseable. A criterion must then RUN, because "could not determine" must
 *   not be spent granting a skip. Same rule `readDeclaredFolioProfile` follows,
 *   and the reason that function exists as a named thing rather than an inline
 *   read.
 *
 * Collapsing the first and third into "no voices" is the defect this shape
 * exists to prevent: a folio whose config a tool cannot parse would silently
 * lose every voice check while reporting a clean run.
 */
export function readActiveVoices(repoRoot: string): string[] | undefined {
  // ONE name, through the one resolver, like every other reader (bean `9ici`).
  //
  // This looped over `[HARNESS_CONFIG, "folio.config.json"]` until 2026-09-20,
  // which is a LEFTOVER rather than a decision. Bean `6nfy` renamed the file
  // and shipped a legacy fallback, then took a HARD BREAK on the owner's
  // instruction — "folio.config.json is no longer read at all" — and this one
  // of its eleven consolidated sites kept the loop.
  //
  // Which is `6nfy`'s own prediction landing on `6nfy`: *"a legacy fallback
  // written eleven times diverges at ten of them, and the one that forgets is
  // the one a folio silently stops being configured by."* It diverged at one,
  // in the direction that keeps a dead name alive.
  //
  // The cost was worse than a missed rename, because it defeated the three
  // states below. `resolveHarnessConfigPath`'s doc says an old-name folio "is
  // NOT configured, rather than quietly half-configured by a path nothing else
  // agrees about" — and this function was the path nothing else agreed about.
  // Such a folio got a DETERMINED voice list here while losing every other
  // setting silently, so the one signal that could have said "your config is
  // not being read" instead said "no voices are active", which is a legitimate
  // answer. Reaching the third state is the point: it makes the criteria RUN.
  // An indexed layer's voices are its index ENTRY's (2026-10-09): it has
  // no `<name>.config.json`, and reading only the file put every layer in
  // the index checkout in the third state.
  const eff = readEffectiveConfig(repoRoot);
  if (eff.via === "index") {
    if (eff.state !== "ok") return undefined;
    const parsed = VoiceConfigSchema.safeParse(eff.config.voices ?? {});
    return parsed.success ? parsed.data.active : undefined;
  }
  const found = resolveHarnessConfigPath(repoRoot);
  if (!found) return undefined; // no config at all — third state
  try {
    const raw = JSON.parse(readFileSync(found.path, "utf-8")) as {
      voices?: unknown;
    };
    const parsed = VoiceConfigSchema.safeParse(raw.voices ?? {});
    // A `voices` key that will not parse is not "no voices": the author meant
    // something, and guessing which voices they meant is worse than running
    // every check.
    return parsed.success ? parsed.data.active : undefined;
  } catch {
    return undefined; // unparseable config — third state
  }
}

// ── Inheritance: a shared base, and what each override adds ────────────────

/** Why a voice chain could not be resolved. Each names what to fix. */
export type VoiceResolveFailure =
  | { kind: "cycle"; chain: string[] }
  | { kind: "no-such-voice"; ref: VoiceRef; from: string };

/** `<instance>/<voiceId>`, the key a chain is deduplicated on. */
export function voiceKey(instance: string, voiceId: string): string {
  return `${instance}/${voiceId}`;
}

/**
 * A voice with its inherited rules folded in, root-first.
 *
 * ## Rules UNION; they do not override
 *
 * This is where a voice differs from a theme, and it is not a detail. Two
 * themes setting `palette.ink` must resolve to one colour, so a child wins.
 * Two voices carrying a rule about the same subject are two editorial rules,
 * and the union is the honest result: the vendors AGREE about degrees of
 * freedom, and an override silently replacing the base's rule with a
 * near-identical one would delete the evidence that they agree.
 *
 * A child DOES override by rule `id`, and only by rule `id` — which is an
 * explicit act, spelled the same as the rule it replaces, and visible in a
 * diff. Anything else accumulates.
 *
 * ## What is NOT merged, and why
 *
 * `provenance` and `superseded` are the child's own, never inherited. A voice
 * read from a vendor page does not become `evidence` by extending one read
 * from a paper, and a live source does not become superseded by inheriting
 * from a dead one. These describe the DOCUMENT the voice was read from, and a
 * voice has exactly one of those.
 */
export interface VoiceScope {
  /** Block kinds. Absent means every kind the folio has. */
  appliesTo?: string[];
  /** Process, lane and scenario. Absent means everywhere. */
  activeIn?: VoiceApplicability;
}

export interface ResolvedVoice {
  id: string;
  instance: string;
  /** Root-first, so a reader can see where each rule entered. */
  chain: Array<{ instance: string; voiceId: string }>;
  rules: VoiceRule[];
  /** Which voice in the chain contributed each rule, by rule id. */
  origin: Map<string, string>;
  /**
   * The scope each rule was DECLARED under, by rule id — not the resolved
   * voice's own.
   *
   * ## One scope cannot describe a union of rules
   *
   * `appliesTo` and `activeIn` belong to a VOICE, and after resolution the
   * rules come from several. The first version of this carried a single
   * `activeIn` taken from the child and dropped `appliesTo` altogether, so a
   * base voice scoped to `prose` blocks inside one process contributed its
   * rules to a child that declared neither — and they applied to every block
   * kind everywhere. **Inherited rules escaped the scope they were declared
   * under**, silently, which is the opposite of what an override is for.
   *
   * Inheriting the parent's scope when the child omits one does not fix it
   * either: it makes the CHILD's own rules answer to a scope their author
   * never wrote. Both halves of a union want their own answer, so each rule
   * keeps the scope of the voice that declared it.
   *
   * Use {@link ruleAppliesHere}, which reads this rather than the voice-level
   * fields.
   */
  scopeOf: Map<string, VoiceScope>;
  provenance: VoiceProvenance;
  /**
   * The START voice's own declaration, kept for a consumer reporting on the
   * voice as authored. NOT the effective scope of its resolved rules — that
   * is {@link ResolvedVoice.scopeOf}, and conflating them is the defect above.
   */
  appliesTo?: string[];
  activeIn?: VoiceApplicability;
  superseded?: VoiceSupersession;
}

/**
 * Fold a voice's `extends` chain into one rule set.
 *
 * `lookup` resolves a {@link VoiceRef} the same way `resolveTheme`'s does, and
 * for the same reason: this module cannot read another layer's directory
 * without hardcoding a layout, so the caller that already resolved the
 * declaration supplies it.
 */
export function resolveVoice(
  start: { instance: string; voice: VoiceProfile },
  lookup: (ref: VoiceRef, citingInstance: string) => { instance: string; voice: VoiceProfile } | undefined,
): { ok: true; voice: ResolvedVoice } | { ok: false; failure: VoiceResolveFailure } {
  const chain: Array<{ instance: string; voice: VoiceProfile }> = [];
  const seen = new Set<string>();
  let cur: { instance: string; voice: VoiceProfile } | undefined = start;
  while (cur) {
    const key = voiceKey(cur.instance, cur.voice.id);
    if (seen.has(key)) return { ok: false, failure: { kind: "cycle", chain: [...seen, key] } };
    seen.add(key);
    chain.unshift(cur);
    const ref = cur.voice.extends;
    if (!ref) break;
    const parent = lookup(ref, cur.instance);
    if (!parent) return { ok: false, failure: { kind: "no-such-voice", ref, from: key } };
    cur = parent;
  }

  // Keyed by rule id so a child can replace one deliberately; insertion order
  // is preserved, so a base rule stays where it was rather than moving to the
  // end when an override restates it.
  const byId = new Map<string, VoiceRule>();
  const origin = new Map<string, string>();
  const scopeOf = new Map<string, VoiceScope>();
  for (const link of chain) {
    // The declaring voice's scope, captured per rule. A child that overrides a
    // rule id takes over its scope too — it is the child's rule now.
    const scope: VoiceScope = {
      ...(link.voice.appliesTo ? { appliesTo: link.voice.appliesTo } : {}),
      ...(link.voice.activeIn ? { activeIn: link.voice.activeIn } : {}),
    };
    for (const r of link.voice.rules) {
      byId.set(r.id, r);
      origin.set(r.id, voiceKey(link.instance, link.voice.id));
      scopeOf.set(r.id, scope);
    }
  }

  return {
    ok: true,
    voice: {
      id: start.voice.id,
      instance: start.instance,
      chain: chain.map((l) => ({ instance: l.instance, voiceId: l.voice.id })),
      rules: [...byId.values()],
      origin,
      scopeOf,
      // The CHILD's own — see the interface comment.
      provenance: start.voice.provenance,
      ...(start.voice.appliesTo ? { appliesTo: start.voice.appliesTo } : {}),
      ...(start.voice.activeIn ? { activeIn: start.voice.activeIn } : {}),
      ...(start.voice.superseded ? { superseded: start.voice.superseded } : {}),
    },
  };
}

/** A failure, as a sentence naming what to do about it. */
export function explainVoiceFailure(f: VoiceResolveFailure): string {
  switch (f.kind) {
    case "cycle":
      return `voice inheritance is a cycle: ${f.chain.join(" -> ")}. A voice may extend at most one other, and the chain must terminate.`;
    case "no-such-voice":
      return (
        `${f.from} extends ${f.ref.instance ? `${f.ref.instance}/` : ""}${f.ref.voiceId}, which no instance serves. ` +
        `Check the voice id, and that the instance declares a \`voices\` graph holding it.`
      );
  }
}

/**
 * Is this voice in force for the process, role and scenario at hand?
 *
 * ABSENT MEANS EVERYWHERE, per {@link VoiceApplicabilitySchema} — so a voice
 * with no `activeIn` answers true for every context, including one that names
 * nothing.
 *
 * `role` is the id of the role whose lane the work is in. It matches a
 * declared {@link RoleRefSchema} by role id; two layers declaring a role of
 * the same id are not told apart here.
 *
 * Each declared list is an OR within itself and an AND across the three: a
 * voice naming two processes and one role is in force in either process, but
 * only while acting in that role's lane. That is the CRDM shape — an activity sits in
 * one lane of one process — rather than a free-for-all union, which would put
 * a lane-scoped voice in force anywhere its process ran.
 */
export function voiceActiveIn(
  voice: { activeIn?: VoiceApplicability },
  context: { process?: string; role?: string; scenario?: string },
): boolean {
  const a = voice.activeIn;
  if (!a) return true;
  const holds = (declared: string[] | undefined, actual: string | undefined): boolean =>
    declared === undefined || (actual !== undefined && declared.includes(actual));
  return (
    holds(a.processes, context.process) &&
    holds(a.roles?.map((r) => r.role), context.role) &&
    holds(a.scenarios, context.scenario)
  );
}

/**
 * Does this RULE apply here — the per-rule question, which is the only one a
 * resolved voice can answer correctly.
 *
 * Reads {@link ResolvedVoice.scopeOf}, so a rule inherited from a scoped base
 * keeps that base's scope instead of escaping into the child's.
 *
 * A rule id the resolved voice does not carry answers `false` rather than
 * defaulting to "everywhere": an unknown id is a caller bug, and the
 * absent-means-everywhere default is about an absent SCOPE on a rule that
 * exists, never about an absent rule.
 */
export function ruleAppliesHere(
  voice: Pick<ResolvedVoice, "scopeOf">,
  ruleId: string,
  context: { blockKind?: string; process?: string; lane?: string; scenario?: string },
): boolean {
  const scope = voice.scopeOf.get(ruleId);
  if (scope === undefined) return false;
  if (scope.appliesTo !== undefined) {
    if (context.blockKind === undefined || !scope.appliesTo.includes(context.blockKind)) return false;
  }
  return voiceActiveIn({ activeIn: scope.activeIn }, context);
}
