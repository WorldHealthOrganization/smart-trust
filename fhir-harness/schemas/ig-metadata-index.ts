/**
 * IG metadata indexes — the Publisher's own metadata exports, given somewhere
 * to live.
 *
 * @module schemas/ig-metadata-index
 * @graphNode schema
 *
 * A published FHIR Implementation Guide carries, beside its artefacts, three
 * machine-readable files the Publisher writes ABOUT what it built:
 * `valueset-ref-list.json`, `codesystem-ref-list.json` and `usage-stats.json`.
 * They are the only structured statement any IG makes about how its artefacts
 * refer to one another.
 *
 * ## Why this is not `fhir-artifact-index`
 *
 * Registered on the owner's ruling, 2026-09-30 — **Option B** of bean `rjug`:
 * *"a sibling kind `ig-metadata-index`, `holds: "derived"`. Keeps 'what
 * artefacts exist' apart from 'what the toolchain reported'."*
 *
 * Option A would have extended `fhir-artifact-index` with a `metadataExports`
 * block, and the bean's own objection to it is the reason it lost:
 * *"Risks making the index a bag."* The two answer different questions:
 *
 * - **`fhir-artifact-index`** answers *what artefacts does this IG contain* —
 *   reconstructed from four partial published views, with `provenance` naming
 *   the file each field came out of, because no IG publishes such an index.
 * - **`ig-metadata-index`** answers *what did the toolchain say about them* —
 *   a verbatim reading of three files the IG DOES publish.
 *
 * Folding the second into the first would put a reconstruction and a
 * transcription in one document, and a consumer could no longer tell a fact
 * this repository assembled from a fact the Publisher asserted.
 *
 * ## Why `derived` and not `content`
 *
 * The ruling gives `holds`, and it agrees with the axis's own two questions.
 * **Does it stand on its own?** No — every record here is an edge or a count
 * ABOUT artefacts named elsewhere; detach it from the IG and a ValueSet→
 * CodeSystem edge asserts nothing. **Regenerate or re-author?** Regenerate:
 * re-harvest the same published IG and you get the same file back, which is
 * exactly `derived`'s test and exactly what separates it from
 * {@link module:schemas/binary-release | `binary-release`}, where re-running
 * produces a different release.
 *
 * It also buys what `derived` bought `library/`: a QA finding against one of
 * these documents is a finding against the HARVEST that made it, never
 * against an author, so the content sweep is right to skip it.
 *
 * ## The measured ceiling, kept representable
 *
 * Bean `nsbb` measured these exports across two real WHO IGs (re-derive the
 * numbers from `docs/ig-publisher.md` rather than quoting them; they are a
 * measurement, and a measurement in prose is a claim nothing checks). Two
 * findings shape this schema, and both are about an ABSENCE that must not read
 * as a zero:
 *
 * 1. **`uses` is declared and never populated**, in both IGs. A
 *    declared-and-empty field is worse than an absent one, because a consumer
 *    cannot tell "no dependencies" from "not computed". {@link IgUsesState}
 *    makes those three states unrepresentable as one.
 * 2. **Nothing exports dependencies among `Library`, `PlanDefinition` or
 *    `Measure`** — the decision-logic core. So these exports reach
 *    *terminology* dependencies and structurally cannot reach *logic* ones,
 *    and a consumer that reads "no edges" as "no dependencies" will conclude
 *    the opposite of the truth over most of an IG.
 *    {@link IG_METADATA_UNREACHED_TYPES} and {@link dependencyReach} are that
 *    fact as an API rather than as a paragraph.
 *
 * ## Three things enforced structurally
 *
 * 1. **A determined empty is never a not-found.** Each of the three exports
 *    declares its {@link IgExportPresence}, and `absent` — the Publisher did
 *    not write the file — carries no records, while `present` with no records
 *    is a real and different answer. Same rule as `qa-report`'s
 *    `files_missing` ⊆ `files_expected`.
 * 2. **`unknown` is never a pass.** An export nobody looked for reports
 *    `unknown`, and {@link igMetadataVerdict} returns `unknown` for the
 *    document rather than `ok`. Could-not-determine is never rendered as
 *    clean — the rule `check-ci-health.ts`, `kg-qa.ts` and `health-report.ts`
 *    each carry.
 * 3. **`usesState` and `uses` may not disagree.** `populated` with an empty
 *    list, or `declared-empty` with entries, is a record that lies about
 *    itself, and finding #1 is precisely the case where the lie would be
 *    invisible.
 */
import { z } from "zod";

/** The tag an `ig-metadata-index` document carries, so it is identified by declaration. */
export const IG_METADATA_INDEX_SCHEMA_TAG = "folio-ig-metadata-index/v1";

/**
 * The three exports this kind holds, named as the Publisher names them.
 *
 * Closed, and deliberately so: a fourth export is a change to what the
 * Publisher emits, and that is worth failing validation over rather than
 * absorbing silently. `ig-publisher.md` records what it emits today.
 */
export const IG_METADATA_EXPORTS = ["valueset-ref-list", "codesystem-ref-list", "usage-stats"] as const;
export type IgMetadataExport = (typeof IG_METADATA_EXPORTS)[number];

/**
 * Did the IG publish this export?
 *
 * Three states, weakest first. `unknown` is NOT a kind of `absent`: the first
 * says nobody looked, the second says somebody looked and it was not there.
 * An IG built by an older Publisher genuinely lacks some of these, and a
 * harvest that skipped a file is a different fact about a different IG.
 */
export const IG_EXPORT_PRESENCE = ["unknown", "absent", "present"] as const;
export const IgExportPresenceSchema = z.enum(IG_EXPORT_PRESENCE);
export type IgExportPresence = z.infer<typeof IgExportPresenceSchema>;

/**
 * The state of a `uses` field on one `codesystem-ref-list` record.
 *
 * The schema's reason for existing, in one enum. Bean `nsbb` measured `uses`
 * as **declared and never populated** in both IGs it looked at, so all three
 * of these are real states of a real corpus:
 *
 * - **`populated`** — the export carried the field and it had entries;
 * - **`declared-empty`** — the export carried the field and it was empty. The
 *   measured case, and the one a boolean or a bare array would erase;
 * - **`not-exported`** — the export did not carry the field at all.
 */
export const IG_USES_STATES = ["not-exported", "declared-empty", "populated"] as const;
export const IgUsesStateSchema = z.enum(IG_USES_STATES);
export type IgUsesState = z.infer<typeof IgUsesStateSchema>;

/**
 * The resource types no IG metadata export carries dependency edges for.
 *
 * Measured, not assumed — the edges among these are produced in
 * `org.hl7.fhir.core` where dependencies are loaded, not in the Publisher, so
 * no fork of the Publisher alone would change it (`ig-publisher-fork`).
 *
 * Exported because the fact is load-bearing for every consumer: over the
 * decision-logic core of a real IG these exports emit nothing, and a consumer
 * without this list reads that silence as "no dependencies".
 */
export const IG_METADATA_UNREACHED_TYPES = ["Library", "PlanDefinition", "Measure"] as const;

/**
 * Can these exports say anything about dependencies of `resourceType`?
 *
 * Two answers, and the second is the one worth having: `out-of-reach` means
 * an empty edge list is **uninformative**, not clean. Anything needing the
 * logic layer's dependencies has to get them elsewhere.
 */
export function dependencyReach(resourceType: string): "exported" | "out-of-reach" {
  return (IG_METADATA_UNREACHED_TYPES as readonly string[]).includes(resourceType) ? "out-of-reach" : "exported";
}

/** Which IG this document is about. Keyed the way an IG keys itself. */
export const IgIdentitySchema = z
  .object({
    /** The NPM-style package id, e.g. `who.smart.trust`. */
    packageId: z.string().min(1),
    /** The IG version this harvest was taken at. An id alone collides across versions. */
    version: z.string().min(1),
    /** The IG's canonical URL, where it declares one. */
    canonical: z.string().url().optional(),
  })
  .strict();
export type IgIdentity = z.infer<typeof IgIdentitySchema>;

/**
 * Where the harvest came from. OURS — the Publisher records no provenance in
 * these files, which is the same gap `fhir-artifact-index` fills with its own
 * `provenance` field.
 */
export const IgMetadataSourceSchema = z
  .object({
    /** The published site or package the exports were read out of. */
    harvestedFrom: z.string().min(1),
    /** When the harvest ran. */
    harvestedAt: z.string().min(1),
    /**
     * A URL for the harvest run, if one exists.
     *
     * Optional, and absent is a real answer: a local harvest has none, and
     * inventing a plausible one is the `blv9` shape — a link-shaped value
     * resolving to nothing.
     */
    runUrl: z.string().url().optional(),
  })
  .strict();

/**
 * What built the IG, version by version.
 *
 * It matters here for the reason it matters on `qa-report`: the WHO build
 * re-downloads `publisher.jar` from the LATEST release on every run, so two
 * harvests of an unchanged source can differ and nothing else in the document
 * would say why.
 */
export const IgMetadataToolchainSchema = z
  .object({
    publisher: z.string().optional(),
    sushi: z.string().optional(),
    fhirVersion: z.string().optional(),
  })
  .strict();

/** One `valueset-ref-list` edge set: a ValueSet and the CodeSystems it draws on. */
export const IgValueSetRefSchema = z
  .object({
    valueSet: z.string().min(1),
    codeSystems: z.array(z.string().min(1)),
  })
  .strict();
export type IgValueSetRef = z.infer<typeof IgValueSetRefSchema>;

/**
 * One `codesystem-ref-list` record.
 *
 * `usesState` is required and `uses` is always an array, so the
 * declared-empty case is written down rather than inferred from a length.
 */
export const IgCodeSystemRefSchema = z
  .object({
    codeSystem: z.string().min(1),
    usesState: IgUsesStateSchema,
    uses: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.usesState === "populated" && r.uses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["usesState"],
        message: "`usesState` says populated but `uses` is empty — the one case bean `nsbb` measured is declared-empty, and recording it as populated erases the finding",
      });
    }
    if (r.usesState !== "populated" && r.uses.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uses"],
        message: `\`usesState\` is \`${r.usesState}\` but ${r.uses.length} entr${r.uses.length === 1 ? "y" : "ies"} are present — one of the two is wrong, and guessing which is how a not-computed field becomes a computed one`,
      });
    }
  });
export type IgCodeSystemRef = z.infer<typeof IgCodeSystemRefSchema>;

/**
 * One `usage-stats` record: a definition and the element paths it is used at.
 *
 * `subject` distinguishes an extension from a profile because the export
 * carries both and they are counted separately wherever this is quoted.
 */
export const IgUsageStatSchema = z
  .object({
    url: z.string().min(1),
    subject: z.enum(["extension", "profile"]),
    paths: z.array(z.string().min(1)),
  })
  .strict();
export type IgUsageStat = z.infer<typeof IgUsageStatSchema>;

/** Each export's presence, decided for all three. No default: not-asked is a state. */
const ExportPresenceShape = z
  .object({
    "valueset-ref-list": IgExportPresenceSchema,
    "codesystem-ref-list": IgExportPresenceSchema,
    "usage-stats": IgExportPresenceSchema,
  })
  .strict();

/** An IG metadata index, as a `folio-ig-metadata-index/v1` document. */
export const IgMetadataIndexSchema = z
  .object({
    $schema: z.literal(IG_METADATA_INDEX_SCHEMA_TAG),
    ig: IgIdentitySchema,
    source: IgMetadataSourceSchema,
    toolchain: IgMetadataToolchainSchema.optional(),
    exports: ExportPresenceShape,
    valueSetRefs: z.array(IgValueSetRefSchema),
    codeSystemRefs: z.array(IgCodeSystemRefSchema),
    usageStats: z.array(IgUsageStatSchema),
  })
  .strict()
  .superRefine((d, ctx) => {
    // An export that is `absent` or `unknown` cannot have produced records.
    // This is what keeps "the IG published no ValueSet edges" apart from "the
    // file was not there" — `qa-report`'s files_missing ⊆ files_expected, one
    // corpus over.
    const pairs: Array<[IgMetadataExport, "valueSetRefs" | "codeSystemRefs" | "usageStats", number]> = [
      ["valueset-ref-list", "valueSetRefs", d.valueSetRefs.length],
      ["codesystem-ref-list", "codeSystemRefs", d.codeSystemRefs.length],
      ["usage-stats", "usageStats", d.usageStats.length],
    ];
    for (const [exportName, field, count] of pairs) {
      const presence = d.exports[exportName];
      if (presence !== "present" && count > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${count} record(s) are present but \`exports["${exportName}"]\` is \`${presence}\` — records cannot come from a file that was absent or never looked for`,
        });
      }
    }
  });

export type IgMetadataIndex = z.infer<typeof IgMetadataIndexSchema>;

/**
 * Did this harvest establish what the IG's metadata says?
 *
 * **Three states, and the third is why this exists.** A caller writing
 * `index.valueSetRefs.length === 0 ? "no edges" : …` gets a confident answer
 * for a harvest that never opened the file. `unknown` is returned whenever any
 * of the three exports was not looked for, because a partial harvest has not
 * cleared the checks it skipped — the same rule `audit:coverage` states as
 * *a sweep blind on one check has not cleared the others*.
 *
 * `finding` is returned when an export was looked for and the Publisher did
 * not write it: that is a determined gap in the IG, which is a result rather
 * than an error.
 */
export function igMetadataVerdict(d: IgMetadataIndex): "ok" | "finding" | "unknown" {
  const states = IG_METADATA_EXPORTS.map((e) => d.exports[e]);
  if (states.includes("unknown")) return "unknown";
  if (states.includes("absent")) return "finding";
  return "ok";
}
