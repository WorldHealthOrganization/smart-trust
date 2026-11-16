/**
 * Materialising remote content — the three states, and the five gates.
 *
 * @module schemas/materialization
 * @graphNode schema
 *
 * ## One process, and this repository already runs it twice
 *
 * The owner, 2026-09-20:
 *
 * > *"so if large remote collection, and no restrictions known in context, user
 * > can import/maertialize locally. size considerations apply. similar concept
 * > in bootstrapping harness... it is remtoe. content. bootstrape materelaiz
 * > cat-harness locally (or other harness)... similar, should share common
 * > subprocess. also need to know about refreshing amterialed remote content.
 * > general process used everywhere."*
 *
 * | layer | remote source | materialised locally | refresh today |
 * |---|---|---|---|
 * | the IRIS catalogue layer | IRIS, 361.55 GB | three items under `library/` | nothing |
 * | `bootstrap` | a harness | the `cat-harness` checkout | `upstream-pins.json` + `check:upstream-pins` |
 *
 * The second row is the one that makes this a discovery rather than a design.
 * `bootstrap/processes/initialize-harness.bpmn` fetches a harness that is
 * REMOTE CONTENT and lands it locally; `upstream-pins.json` exists because that
 * local copy goes stale. That is a materialisation and its refresh, built, in
 * production, and named neither.
 *
 * ## Three states — the vocabulary lives in the harness
 *
 * `referenced`, `materialized` and `unknown`, and {@link FixitySchema}, are
 * defined in `cat-harness-tools/schemas/kg/materialization-state.ts` and re-exported
 * here. Bean `tlat` (placement PR5, owner ruling 2, 2026-09-30, option A) moved
 * only that VOCABULARY down; the gates, the purposes and the record that binds
 * them stay in this module, because each gate is a decision about CONTENT. The
 * argument for three states and no default is in that module's doc, with the
 * ruling's addition: a remote-KG subscription is a materialization whose
 * minimum is the chosen subgraphs' metadata under `library/<source>/`.
 *
 * ## The five gates, and why a warning is not a gate
 *
 * Each is a decision a PERSON makes and none is answerable from a file. A gate
 * that only warns is a gate nobody fails, which is the `xom7` shape — a
 * workflow that failed all thirty times it ran with nothing in the repository
 * saying so.
 *
 *   - **size** — what fraction is being taken and what the whole would cost.
 *     361.55 GB is the measured reason the IRIS import is by reference.
 *   - **restrictions** — the owner's phrase is *"no restrictions known in
 *     context"*, and that is a STATE, not a green light. {@link GateVerdict}
 *     has `unknown` for exactly this, and it is never rendered as `permitted`.
 *   - **retention** — what expires this copy. A copy with no expiry cannot be
 *     told from an abandoned one, which is the argument `bean-blocking` already
 *     makes about a block with no expiry.
 *   - **sourceLoss** — what survives if the origin goes. Not hypothetical here:
 *     the one IRIS record this repository holds carries
 *     `http://iris.wpro.who.int/handle/10665.1/14518`, a regional instance that
 *     was merged away. The failure mode is already in the evidence.
 *   - **copyright** — what the licence permits, per bitstream, and whether it
 *     permits the derived work. `LICENSE-CONTENT.md` exists in this repository
 *     and the ingestion pipeline does not read it.
 *
 * ## Two purposes, and they want opposite things
 *
 * The owner, 2026-09-20: *"someone may want the blob/binary/pdf for archival
 * purposes (like a KG version of internet archive/wayback)."*
 *
 * That is not a variant of working materialisation, it is its opposite, and
 * three of the five gates change meaning under it:
 *
 * | | `working` | `archival` |
 * |---|---|---|
 * | what is kept | the DERIVED content — sections, OCR, structure | the ORIGINAL BYTES, unchanged |
 * | retention | expires; the original can be re-fetched | **no expiry, by design** |
 * | `sourceLoss` | unanswered — the derivation is not the source | **discharged** — this copy IS the answer |
 * | fixity | not needed; the derivation is the artefact | **required** — an archive that cannot prove it is unchanged is a copy |
 *
 * So {@link freshness} must not report an archival copy as `no-expiry`, which
 * reads as a finding; for an archive it is the specification. And an archival
 * copy with no {@link Fixity} is not an archive — it is a file somebody kept.
 *
 * **The fixity data already exists.** Every ingested entry's `structure.json`
 * carries `sha256` and `bytes` — `wpr-rdo-2020-003-eng` records
 * `5021518ccd91e26a9533edd8efc643bc24ab7bf2d4eb425c9644967e0bf72842` and
 * 2 810 648 bytes. Nothing reads them as fixity today.
 *
 * **Archival is also the only honest answer to `sourceLoss`.** The one IRIS
 * record this repository holds carries a handle on `iris.wpro.who.int`, a
 * regional instance merged into the global one. A `working` materialisation
 * cannot discharge that gate — the derived sections are not the publication —
 * and saying otherwise is how a repository believes it has a copy it does not.
 */
import { z } from "zod";

// Bean `bf5l`: the source-side provenance pair lives in the BASE layer, so
// `cat-harness/schemas/intake.ts` can reach it without importing up the
// declared dependency order. This import points DOWN and is legal.
import {
  SignatureSchema,
  SourceProvenanceSchema,
  type Signature,
  type SourceProvenance,
} from "@litlfred/cat-harness-tools/schemas/library/source-provenance.ts";

// Re-exported because this module was their home and consumers name it.
export { SignatureSchema, SourceProvenanceSchema };
export type { Signature, SourceProvenance };

// Bean `tlat`: the state vocabulary and fixity live in the harness. Same
// direction as the pair above — DOWN — and re-exported for the same reason.
import {
  FixitySchema,
  MATERIALIZATION_STATES,
  type Fixity,
  type MaterializationState,
} from "@litlfred/cat-harness-tools/schemas/kg/materialization-state.ts";
export { FixitySchema, MATERIALIZATION_STATES };
export type { Fixity, MaterializationState };

export const MATERIALIZATION_SCHEMA_TAG = "folio-materialization/v1";

/**
 * Why the bytes were taken. See the module doc — `working` and `archival` want
 * opposite things from retention, fixity and the source-loss gate.
 *
 * `both` is a real state and not a hedge: the same PDF can be the archival
 * master AND the input a derivation was run over. It carries archival's
 * obligations (fixity required, no expiry expected).
 *
 * `compiled` is the third kind (bean `gpdo`, owner's pick 2026-09-23, "Third
 * purpose"): a Lean `.olean`, or the AST sushi builds from FSH. It is DERIVED,
 * so it is not archival (the source is what you would rebuild from); it is
 * EXPENSIVE, so it is not merely working (regenerating costs minutes or hours);
 * and it is INVALIDATED BY ITS INPUTS, which neither other purpose models. So
 * it carries {@link CompiledInputsSchema} instead of a lifetime, and its
 * validity is asked of {@link compiledValidity} BEFORE use, never on a schedule.
 */
export const MATERIALIZATION_PURPOSES = ["working", "archival", "both", "compiled"] as const;
export type MaterializationPurpose = (typeof MATERIALIZATION_PURPOSES)[number];

/**
 * What a COMPILED copy was built from. Its validity is a statement about
 * these, not about its own bytes.
 *
 * The fixity question inverts here. For an archive it asks "are these the
 * bytes we stored"; for a compiled artefact it asks "was this built from the
 * inputs we have NOW". A cache that passes a self-digest and was built from
 * stale inputs is exactly the failure, and it passes every byte check.
 *
 * `toolchain` and `sourceRevision` are required: without them nothing can be
 * compared. `inputDigest` is optional because not every builder exposes one
 * whole-input hash. Lake keeps per-module `.trace` files instead, and a
 * revision match is then the coarser test (see `lean-cache-restore`).
 */
export const CompiledInputsSchema = z
  .object({
    /** The compiler and its version: `leanprover/lean4:v4.24.0`, `sushi 3.12.0`. */
    toolchain: z.string().min(1),
    /** The revision of the source the artefact was built from, e.g. a commit sha. */
    sourceRevision: z.string().min(1),
    /** A sha256 over the build inputs, where the builder can produce one. */
    inputDigest: z.string().regex(/^[0-9a-f]{64}$/, "a sha256 digest is 64 lowercase hex characters").optional(),
  })
  .strict();
export type CompiledInputs = z.infer<typeof CompiledInputsSchema>;


/**
 * A gate's answer.
 *
 * `unknown` is a first-class verdict and NOT a synonym for `permitted`. The
 * whole reason this enum is three-valued is the owner's "no restrictions known
 * in context": an absence of known restrictions is an absence of knowledge.
 */
export const GATE_VERDICTS = ["unknown", "refused", "permitted"] as const;
export type GateVerdict = (typeof GATE_VERDICTS)[number];

export const GateSchema = z
  .object({
    verdict: z.enum(GATE_VERDICTS),
    /**
     * Why. REQUIRED on every verdict including `permitted`, because "we checked
     * and it is fine" and "nobody looked" are indistinguishable from a bare
     * `permitted`, and this whole module exists to keep such pairs apart.
     */
    basis: z.string().min(1),
    /** Who or what decided, and when. A verdict with no date cannot be re-checked. */
    decidedAt: z.string().min(1).optional(),
    decidedBy: z.string().min(1).optional(),
  })
  .strict();
export type Gate = z.infer<typeof GateSchema>;

/** The five, all required. A materialisation that skipped one would be a materialisation whose worst risk is the one nobody wrote down. */
export const GatesSchema = z
  .object({
    size: GateSchema,
    restrictions: GateSchema,
    retention: GateSchema,
    sourceLoss: GateSchema,
    copyright: GateSchema,
  })
  .strict();
export type Gates = z.infer<typeof GatesSchema>;

/**
 * What a node says about itself.
 *
 * `gates` is required when `state` is `materialized` and forbidden otherwise —
 * see the refinement below. Bytes on disk without the five answers is exactly
 * the state this module exists to make unrepresentable.
 */
export const MaterializationSchema = z
  .object({
    $schema: z.literal(MATERIALIZATION_SCHEMA_TAG).optional(),
    state: z.enum(MATERIALIZATION_STATES),
    /**
     * WHERE THIS CAME FROM — see {@link SourceProvenanceSchema}.
     *
     * This replaced a single `of` on 2026-09-22. `of` meant "the remote thing"
     * and 6 of the 9 IRIS catalogue records were using it for a local one, so the
     * split is a correction to the corpus as much as to the model.
     */
    provenance: SourceProvenanceSchema,
    /** Where the bytes landed, layer-relative. Present iff `materialized`. */
    localPath: z.string().min(1).optional(),
    /** Bytes held locally. Absent means not measured, which is not zero. */
    bytes: z.number().int().nonnegative().optional(),
    /**
     * Bytes the WHOLE remote collection holds, where it is known. This is what
     * makes a `size` gate answerable: 3 items of 361.55 GB is a fraction, and
     * "3 items" alone is not.
     */
    collectionBytes: z.number().int().nonnegative().optional(),
    gates: GatesSchema.optional(),
    /** Why the bytes were taken. Required on anything materialized — the gates mean different things under each. */
    purpose: z.enum(MATERIALIZATION_PURPOSES).optional(),
    /** Required when `purpose` is `archival` or `both`. */
    fixity: FixitySchema.optional(),
    /** Required when `purpose` is `compiled`, and only allowed then. See {@link CompiledInputsSchema}. */
    inputs: CompiledInputsSchema.optional(),
    /** When the local copy was taken, and against what upstream version. */
    materializedAt: z.string().min(1).optional(),
    upstreamVersion: z.string().min(1).optional(),
    /**
     * When this copy expires. Absent on a `working` copy is a `retention`
     * finding, not a default of "forever". Absent on an `archival` one is the
     * SPECIFICATION — see {@link freshness}, which reports the two differently.
     */
    expiresAt: z.string().min(1).optional(),
    /**
     * When this copy was last read. Absent means 'not recorded'.
     *
     * Recorded by readers or explicit touch helpers (bean 7wgs).
     */
    lastReadAt: z.string().min(1).optional(),
    /**
     * Why the record cannot say more than it does.
     *
     * Two jobs, and both are the same discipline. Why the state is `unknown`,
     * where it is — an unexplained `unknown` is indistinguishable from an
     * unfilled field. And why BOTH provenance pointers are absent, which the
     * refinement below requires: a record that knows neither where a thing came
     * from upstream nor which local original it was taken from has either
     * looked and failed, or not looked, and only the first is a fact.
     */
    note: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (!m.provenance.upstream && !m.provenance.local && !m.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "a record with neither `provenance.upstream` nor `provenance.local` requires a `note`. " +
          "Knowing a thing came from somewhere and not knowing where is a real state — the " +
          "IRIS catalogue item whose handle was never recorded is one — but it is only a state " +
          "once somebody says so. Silent, it cannot be told from a field nobody filled in",
      });
    }
    if (m.state === "materialized") {
      if (!m.localPath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "state `materialized` requires `localPath`: bytes that are here are somewhere",
        });
      }
      if (!m.purpose) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "state `materialized` requires a `purpose`. `working` and `archival` want opposite " +
            "things from retention, fixity and the source-loss gate, so a copy that has not said " +
            "which it is cannot have any of the three judged",
        });
      }
      if ((m.purpose === "archival" || m.purpose === "both") && !m.fixity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "an archival copy requires `fixity`. An archive that cannot demonstrate it is " +
            "unchanged is a copy — and it cannot be re-fetched to check, because the thing it " +
            "would be re-fetched from is what it exists to survive",
        });
      }
      if ((m.purpose === "working" || m.purpose === "compiled") && m.gates?.sourceLoss.verdict === "permitted") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `a \`${m.purpose}\` materialization cannot discharge \`sourceLoss\`: the derived content is ` +
            "not the source. Only an archival copy of the original bytes answers that gate",
        });
      }
      if (m.purpose === "compiled" && !m.inputs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "a `compiled` copy requires `inputs` (toolchain and sourceRevision at least). Its validity " +
            "is a statement about what it was built from, and with no inputs recorded nothing can " +
            "tell a current build from a stale one",
        });
      }
      if (!m.gates) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "state `materialized` requires all five `gates`. Bytes on disk with no recorded " +
            "size / restrictions / retention / source-loss / copyright answer is the state this " +
            "schema exists to make unrepresentable",
        });
      }
    }
    if (m.inputs && m.purpose !== "compiled") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "`inputs` belongs to a `compiled` copy only. On any other purpose it would claim a " +
          "build-validity rule that nothing applies",
      });
    }
    if (m.state !== "materialized" && m.gates) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "gates are recorded only where something was materialized. A gate verdict on a " +
          "`referenced` node claims a decision nobody had to make",
      });
    }
  });
export type Materialization = z.infer<typeof MaterializationSchema>;

/**
 * Whether the local copy may be trusted right now.
 *
 * Deliberately NOT a boolean. "Expired", "never had an expiry" and "not
 * materialised at all" are three different situations calling for three
 * different actions, and a boolean would send all three down one branch.
 */
export type FreshnessVerdict =
  | "fresh"
  | "expired"
  | "no-expiry"
  | "permanent"
  /** A `compiled` copy: its lifetime is its inputs, not a date. Ask {@link compiledValidity} before use. */
  | "input-bound"
  | "not-materialized";

/**
 * `permanent` is NOT a kind of `no-expiry`, and that is the point of having
 * both. `no-expiry` is a finding — a working copy nobody gave a lifetime, which
 * cannot be told from abandoned work. `permanent` is a specification: an
 * archive is supposed to outlive its source, so reporting it as a finding would
 * put every archived blob on a list of things to chase.
 *
 * `now` has no default on purpose (bean `f017`): a default `new Date()` here
 * put a clock read in the import closure of every check that reaches this
 * schema, and a clock read is something the input-hash skip cannot see. The
 * one caller that wants "now" says so.
 */
export function freshness(m: Materialization, now: Date): FreshnessVerdict {
  if (m.state !== "materialized") return "not-materialized";
  if (m.purpose === "compiled" && !m.expiresAt) return "input-bound";
  if (!m.expiresAt) {
    return m.purpose === "archival" || m.purpose === "both" ? "permanent" : "no-expiry";
  }
  return new Date(m.expiresAt).getTime() > now.getTime() ? "fresh" : "expired";
}

/**
 * Is a COMPILED copy still valid for the inputs we have now? Call it BEFORE
 * use; a scheduled check would let a stale build be used between two runs.
 *
 * Three answers, not a boolean:
 * - `valid`: every input that both sides state matches.
 * - `stale-inputs`: at least one differs, and `differs` names which, so the
 *   caller rebuilds for a reason it can report.
 * - `cannot-tell`: the record is not a compiled copy, or `current` does not
 *   state an input the record needs compared (toolchain and sourceRevision
 *   always; inputDigest when the record has one). Treating that as valid is
 *   the failure this function exists to prevent.
 *
 * An `inputDigest` on the record but not in `current` is `cannot-tell`, not a
 * pass on the revision alone: the record promised a finer check than the
 * caller can make.
 */
export type CompiledValidity =
  | { verdict: "valid" }
  | { verdict: "stale-inputs"; differs: Array<keyof CompiledInputs> }
  | { verdict: "cannot-tell"; why: string };

export function compiledValidity(m: Materialization, current: Partial<CompiledInputs>): CompiledValidity {
  if (m.state !== "materialized" || m.purpose !== "compiled" || !m.inputs) {
    return { verdict: "cannot-tell", why: "not a materialized `compiled` copy with recorded inputs" };
  }
  const want: Array<keyof CompiledInputs> = ["toolchain", "sourceRevision"];
  if (m.inputs.inputDigest) want.push("inputDigest");
  const missing = want.filter((k) => current[k] === undefined);
  if (missing.length) {
    return { verdict: "cannot-tell", why: `the current inputs do not state: ${missing.join(", ")}` };
  }
  const differs = want.filter((k) => current[k] !== m.inputs![k]);
  return differs.length ? { verdict: "stale-inputs", differs } : { verdict: "valid" };
}

/**
 * Whether every gate has been answered — NOT whether every answer was yes.
 *
 * The distinction is the point. A `refused` copyright gate is a completed
 * decision and the materialisation should not have happened; an `unknown` one
 * is an open question. Both are "not permitted", and conflating them is how
 * "we may not" and "we have not asked" become one row in a report.
 */
export function unansweredGates(g: Gates): Array<keyof Gates> {
  return (Object.keys(g) as Array<keyof Gates>).filter((k) => g[k].verdict === "unknown");
}

/**
 * The gates that stop a held copy being PUBLISHED — linked from a page or served
 * from a CDN — as distinct from being held. Bean `cw35`, from the `v048` roast:
 * every held IRIS PDF carried `copyright: unknown` and was redistributed anyway,
 * because nothing turned a verdict into a decision.
 *
 * Only `copyright` and `restrictions` decide publication; the other three are
 * about keeping a copy, not showing it. Anything short of `permitted` blocks,
 * `unknown` included: an unanswered licence is not a licence. No gates at all
 * blocks on both, for the same reason.
 */
export const PUBLICATION_GATES = ["copyright", "restrictions"] as const;
export function publicationBlockers(g: Gates | undefined): Array<(typeof PUBLICATION_GATES)[number]> {
  return PUBLICATION_GATES.filter((k) => g?.[k]?.verdict !== "permitted");
}

/** Gates that came back `refused`. A non-empty result means the copy must not exist. */
export function refusedGates(g: Gates): Array<keyof Gates> {
  return (Object.keys(g) as Array<keyof Gates>).filter((k) => g[k].verdict === "refused");
}

/**
 * Record when a materialized copy was last read (bean 7wgs).
 *
 * Who records a read: explicit touch by a caller or reader helper (e.g. MCP node
 * access, skill_fetch, or renderer). Access time on files is disabled on many
 * mounts (noatime) and reset by a git checkout, so an explicit timestamp in the
 * record is the only reliable signal.
 */
export function recordMaterializationRead(record: Materialization, at?: Date): Materialization {
  const updated: Materialization = {
    ...record,
    // input-site: inert #607e310b — stamps when a copy was last read; the timestamp is recorded data, never part of a check's answer
    lastReadAt: (at ?? new Date()).toISOString(),
  };
  return MaterializationSchema.parse(updated);
}

/** Alias for recordMaterializationRead. */
export const touchMaterializedRead = recordMaterializationRead;

