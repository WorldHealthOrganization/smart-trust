#!/usr/bin/env bun
/**
 * WHERE BYTES CAME FROM — the source-side provenance pair, and a signature.
 *
 * Not to be confused with `ProvenanceSchema` in
 * `cat-harness/schemas/content/attribution.ts` (`INGESTED | Attribution`),
 * which answers *who wrote this*; `SourceProvenance` answers *where these
 * bytes came from*. It lives in the harness so both the harness's intake
 * record and the content core can use it.
 *
 * @module cat-harness/schemas/source-provenance
 * @graphNode schema
 */
import { z } from "zod";

/**
 * A digital signature over the materialized bytes.
 *
 * Owner, 2026-09-22: *"Maternalized may have provenance/digital signature later
 * that can be checked ... (see trusted data objects)"*.
 *
 * ## Why a slot exists before a verifier does
 *
 * {@link FixitySchema} answers *"unchanged since **we** recorded it"*. A
 * signature answers *"signed by whom, and verifiable against **their** key"* —
 * strictly stronger, because it survives the recorder being wrong or
 * dishonest, which a self-recorded digest does not.
 *
 * The slot is here from the start so that arrival needs no migration. What is
 * NOT here is a trusted-data-object format: "trusted data object" appears
 * nowhere else in this checkout, so inventing one would be modelling a thing
 * this repository has not adopted.
 *
 * ## A recorded signature is NOT a verified one
 *
 * There is no verifier, and nothing here pretends otherwise. `format` and
 * `value` say a signature was recorded; only `verifiedAt` says it was ever
 * checked, and `check-materialized-fixity` reports a signature it cannot check
 * under its own verdict rather than folding it into a pass. A field that reads
 * as coverage while nothing verifies it is the `dh4f` shape, and it would be
 * worse here than elsewhere: the whole point of a signature is that somebody
 * relies on it.
 */
export const SignatureSchema = z
  .object({
    /**
     * How to interpret `value` — a media type or a named scheme.
     *
     * REQUIRED. An unlabelled blob cannot be checked by anybody, so a
     * signature with no format is not a weaker signature, it is a string.
     */
    format: z.string().min(1),
    /** The signature itself, or a URI that resolves to it. */
    value: z.string().min(1),
    /**
     * Who signed, as a key identifier.
     *
     * Optional only because some formats carry the signer inside `value`. A
     * signature whose signer cannot be established either way is unverifiable,
     * and is reported as such rather than as absent.
     */
    signer: z.string().min(1).optional(),
    /** When it was last CHECKED against the signer's key — never when it was recorded. Same discipline as {@link FixitySchema.verifiedAt}. */
    verifiedAt: z.string().min(1).optional(),
  })
  .strict();
export type Signature = z.infer<typeof SignatureSchema>;

/**
 * WHERE THIS CAME FROM — a pointer pair, not a flag.
 *
 * Owner, 2026-09-22: *"Materialized assets not a flag true, but [a pointer] to
 * asset in `folio/` or elsewhere and a reference to the `library/` original
 * reference"*.
 *
 * ## The two references are different questions
 *
 * - **`upstream`** — the remote thing this ultimately derives from.
 * - **`local`** — the original **in this repository** it was taken from.
 *
 * They are not one field with two kinds of value, and this module already
 * proved it the hard way. Until 2026-09-22 there was a single `of`, documented
 * as *"the remote thing. A URI, always — never a path, never a bare name"* —
 * and **5 of the 9 IRIS replica item records violated that documentation**, in
 * three shapes, two of them inside a single file:
 *
 * | record | old `of` | what it actually was |
 * |---|---|---|
 * | the item | `local:9789241548960-eng` | its own id — a bare name, and not provenance at all |
 * | its PDF | `https://iris.who.int/handle/10665/145714` | genuine upstream |
 * | its cover PNG | `local:who-iris/uploads/…/foo.pdf#page=1` | a **local** original — a path |
 *
 * So the conflation was not hypothetical and not introduced by the copy-out:
 * it was live, and the field's own doc comment forbade the majority of its
 * contents.
 *
 * The count is 5 of 9 because it was RE-COUNTED after the migration rather
 * than carried over from the note that prompted it, which said 6. A measured
 * number quoted from prose is the failure this repository names in
 * `bpmn-processes` — count the thing, do not quote the paragraph.
 *
 * ## Why this matters before the copy-out is built
 *
 * When a reader copies materialized content into their own `folio/` to work on
 * it, a single `of` still points upstream — so the copy records where the bytes
 * ultimately came FROM and not which local original they were taken from. One
 * rename later that copy is indistinguishable from original work. `local` is
 * the field that makes a copy answerable for what it is a copy of.
 *
 * ## Both absent is legitimate, and must say so
 *
 * The IRIS replica's item above knows it came from IRIS and does **not** know the
 * handle. That is a real state, not an unfilled field — so both pointers may be
 * absent, and then {@link MaterializationSchema}'s `note` is REQUIRED. Same
 * discipline as {@link GateSchema}'s `basis`: *"we looked and could not
 * establish it"* and *"nobody looked"* must not share a spelling.
 */
export const SourceProvenanceSchema = z
  .object({
    /** The remote thing. A URI, always — never a path, never a bare name. Absent means NOT RECORDED, which is not "there is none". */
    upstream: z.string().min(1).optional(),
    /**
     * The original **in this repository** this was taken from.
     *
     * A `library/` node id or an instance-relative path; the corpus carries
     * both and the migration preserved each verbatim rather than guessing a
     * normal form. Normalising them is a separate decision with a separate
     * answer, and a migration that quietly picked one would have destroyed the
     * evidence for making it.
     */
    local: z.string().min(1).optional(),
    signature: SignatureSchema.optional(),
  })
  .strict();
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;
