/**
 * How to enumerate a corpus you will never hold, and how to ask it for a subset.
 *
 * @module cat-harness/schemas/source-descriptor
 * @graphNode schema
 *
 * `materialize-remote` answers *"may we take this, and what does holding it
 * cost"*. A descriptor answers the question before that: how do you enumerate
 * a corpus, and how do you ask it for a part? Every source answers
 * differently, so the answer is written down here rather than told to an agent
 * each time.
 *
 * ## Two worked descriptors
 *
 * | | WHO IRIS | Lean mathlib |
 * |---|---|---|
 * | what a node is | a repository item | a declaration |
 * | enumerate by | paged REST over communities and collections | the module graph |
 * | subset by | collection, handle, MeSH subject | the import closure of a declaration |
 * | identifiers | UUID, Handle, govdoc — three systems | fully-qualified name — one |
 * | is a subset self-contained? | **yes** — an item stands alone | **no** — a declaration needs its closure |
 *
 * The last row is why {@link SubsetStrategy} carries `closure`: a mathlib
 * declaration without its closure does not compile.
 *
 * ## Cost is declared
 *
 * Enumerating a large corpus over a paged, rate-limited API may be refused. A
 * descriptor states what enumeration COSTS, so {@link enumerationCost} can
 * answer the size gate before anything is fetched.
 *
 * ## Characterising a source decides how it may be REFERENCED
 *
 * A reference is a promise that the thing will still be there, and still be
 * the same thing. Three properties decide whether that promise can be kept:
 *
 * | remote | large | volatile | how it may be referenced |
 * |---|---|---|---|
 * | no | – | – | hold it; the question does not arise |
 * | yes | no | no | materialise working; a bare reference is honest |
 * | yes | yes | no | reference the whole, materialise a subset |
 * | yes | – | **yes** | **archive, or do not cite it** |
 *
 * A reference to a moving target silently resolves to something other than
 * what was cited. So {@link archivalImperative} returns `required` on a
 * volatile source, and the `sourceLoss` gate can then only be discharged by an
 * archival copy.
 *
 * ## Delegating search is a fallback
 *
 * Search over what is NOT materialised may be sent to the source itself, but
 * only when the source is reachable, has a search of its own, and is stable
 * enough that a link composed today still means the same thing.
 * {@link canDelegateSearch} answers that from the characterisation.
 */
import { z } from "zod";

export const SOURCE_DESCRIPTOR_SCHEMA_TAG = "folio-source-descriptor/v1";

/**
 * How a subset is named.
 *
 * `closure` is not a nicety. For a corpus whose nodes depend on each other, a
 * subset that omits what its members need is not a smaller corpus — it is a
 * broken one, and the breakage shows up at build time rather than at fetch
 * time, long after the decision was made.
 */
export const SUBSET_STRATEGIES = [
  /** By position in the source's own containment tree — a collection, a directory, a set. */
  "container",
  /** By identifier, one at a time. Always available; never efficient. */
  "identifier",
  /** By a controlled vocabulary or facet the source indexes — MeSH, a keyword, a variable name. */
  "facet",
  /** By a range the source can slice — a bounding box, a time window, an epoch. */
  "range",
  /** By dependency closure: take these nodes AND everything they need. */
  "closure",
] as const;
export type SubsetStrategy = (typeof SUBSET_STRATEGIES)[number];

/**
 * How fast the corpus changes under a citation.
 *
 * Not "how often is it updated" — how likely is it that a thing cited today is
 * a DIFFERENT thing tomorrow at the same address.
 */
export const VOLATILITIES = [
  /** Published versions are immutable; new ones get new identifiers. A citation keeps meaning. */
  "versioned",
  /** Records are corrected in place, rarely. A citation usually keeps meaning. */
  "revised",
  /** Content at an address changes routinely — a feed, a live dataset, a rolling snapshot. */
  "volatile",
  /** Nobody has established which. Never read as `versioned`. */
  "unknown",
] as const;
export type Volatility = (typeof VOLATILITIES)[number];

/**
 * Whether the source can be reached and asked at all, **from here**.
 *
 * KNOWN MODELLING LIMITATION, recorded rather than discovered later: this is
 * environment-relative and the descriptor stores it as though it were a
 * property of the source. Measured 2026-09-20, the IRIS source is `blocked` from
 * this container (403 at the egress proxy) and is plainly reachable from an
 * ordinary browser — so `canDelegateSearch` refuses a delegation that would
 * work perfectly for a reader.
 *
 * Left as-is deliberately for now: the alternative is a per-environment
 * availability map, which is a second store of a fact that changes for reasons
 * nothing here can observe. The honest reading of a `blocked` value is "the
 * agent that wrote this could not reach it", and the `basis` field is required
 * so that reading is available to whoever looks.
 */
export const AVAILABILITIES = ["reachable", "blocked", "offline", "unknown"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** One identifier system the source mints, and whether it is the one to resolve by. */
export const IdentifierSystemSchema = z
  .object({
    name: z.string().min(1),
    /**
     * Whether this identifier is guaranteed by an authority outside the source.
     * A Handle is; a DSpace UUID is the source's own; a local slug is neither.
     * The distinction decides which identifier survives the source moving, and
     * IRIS is the worked case — one of its two handles points at a regional
     * instance that was merged away.
     */
    authoritative: z.boolean(),
    example: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

export const SourceDescriptorSchema = z
  .object({
    $schema: z.literal(SOURCE_DESCRIPTOR_SCHEMA_TAG),
    id: z.string().min(1),
    title: z.string().min(1),
    /** The software, where there is some — `DSpace 7`, `Lean 4 / Lake`. Descriptors for one system are often reusable. */
    system: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
    /** What one node IS in this corpus. Different per source, and never assumed. */
    nodeKind: z.string().min(1),
    subsetStrategies: z.array(z.enum(SUBSET_STRATEGIES)).min(1),
    /**
     * Whether a subset chosen by the strategies above stands on its own.
     * `false` means every request must be closed over dependencies first.
     */
    subsetIsSelfContained: z.boolean(),
    /**
     * Why `subsetIsSelfContained` has the value it has. Optional, because a
     * self-contained source (IRIS: fetch an item and you have it) has little
     * to say; the `false` case is the one that needs its reason recorded.
     *
     * Added 2026-09-23 (bean `w5bn`). mathlib carried this as an
     * `_subsetIsSelfContained_note` key, which `.strict()` rejects, so the
     * second worked descriptor, the one meant to prove the abstraction, had
     * failed its own schema since it was written. Nothing noticed, because
     * no gate read `sources/`. A field is checked; an underscore is not.
     */
    subsetBasis: z.string().min(1).optional(),
    identifiers: z.array(IdentifierSystemSchema).min(1),
    enumeration: z
      .object({
        /** How the whole is listed. Prose, because it is an instruction to a human or agent, not a URL template. */
        method: z.string().min(1),
        pageSize: z.number().int().positive().optional(),
        /** Total nodes, where the source publishes it. `undefined` is UNKNOWN and never zero. */
        totalNodes: z.number().int().nonnegative().optional(),
        /** How the two numbers above were arrived at. A denominator with no provenance cannot be checked. */
        basis: z.string().min(1),
        /** Requests per second the source tolerates, where it says. Absent means unstated, not unlimited. */
        rateLimit: z.number().positive().optional(),
      })
      .strict(),
    /** Whether the source states terms, and where. Feeds the `restrictions` and `copyright` gates; `unknown` stays unknown. */
    termsUrl: z.string().url().optional(),
    /**
     * The characterisation the "ingest a new data source" process produces.
     * Required — these are what decide how the source may be REFERENCED, and a
     * descriptor that has not said cannot answer that question.
     */
    character: z
      .object({
        /** Is it somewhere else? A local corpus raises none of these questions. */
        remote: z.boolean(),
        /**
         * Is acquiring all of it a different activity from acquiring some?
         * Judgement, not a byte threshold — what is large for a laptop is not
         * large for a cluster, and the descriptor records the CALL with its
         * basis rather than pretending a universal number exists.
         */
        large: z.boolean(),
        volatility: z.enum(VOLATILITIES),
        availability: z.enum(AVAILABILITIES),
        /** Does the source offer a search a reader could be sent to instead? */
        hasOwnSearch: z.boolean(),
        /** How each of the above was established. A characterisation with no basis is an assumption. */
        basis: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export type SourceDescriptor = z.infer<typeof SourceDescriptorSchema>;

/**
 * Requests needed to enumerate the whole corpus, or `undefined` when it cannot
 * be computed.
 *
 * `undefined` rather than a guess, and rather than 0: an uncomputable cost is
 * exactly the case where the size gate must REFUSE, and a zero would read as
 * free. Same three-state discipline as `materialization.ts`.
 */
export function enumerationCost(d: SourceDescriptor): number | undefined {
  const { totalNodes, pageSize } = d.enumeration;
  if (totalNodes === undefined || pageSize === undefined) return undefined;
  return Math.ceil(totalNodes / pageSize);
}

/** Whether a request for a subset is expressible against this source at all. */
export function supportsSubset(d: SourceDescriptor, by: SubsetStrategy): boolean {
  return d.subsetStrategies.includes(by);
}

/**
 * Whether an archival copy is obligatory, and why.
 *
 * Returns the REASON with the verdict, because "you must archive this" is an
 * instruction somebody has to act on and an unexplained one gets ignored.
 *
 * The rule, in one sentence: **a reference is a promise that the thing will
 * still be there and still be the same thing**, and a volatile source cannot
 * keep it. A silently-changed citation is worse than a broken one — a broken
 * link announces itself.
 */
export function archivalImperative(
  d: SourceDescriptor,
): { verdict: "required" | "recommended" | "optional"; reason: string } {
  const c = d.character;
  if (!c.remote) {
    return { verdict: "optional", reason: "the corpus is local; a reference to it cannot outlive it" };
  }
  if (c.volatility === "volatile") {
    return {
      verdict: "required",
      reason:
        "the source changes content at an address, so a citation made today resolves later to " +
        "something that is not what was cited, and nothing records that it changed. Worse than a " +
        "broken link, which at least announces itself. Cite an archived copy or do not cite it.",
    };
  }
  if (c.volatility === "unknown") {
    return {
      verdict: "required",
      reason:
        "volatility was never established, and `unknown` is not `versioned`. Until somebody " +
        "checks, the cautious reading is the one that keeps citations meaningful.",
    };
  }
  if (c.availability === "blocked" || c.availability === "offline") {
    return {
      verdict: "required",
      reason:
        `the source is ${c.availability} from here, so a reference cannot be resolved by whoever ` +
        "reads it either. Only a held copy makes the citation followable.",
    };
  }
  if (c.volatility === "revised") {
    return {
      verdict: "recommended",
      reason:
        "records are corrected in place. A citation usually keeps its meaning, but 'usually' is " +
        "not a property a proof or a guideline should rest on.",
    };
  }
  return {
    verdict: "optional",
    reason: "published versions are immutable and new ones get new identifiers, so a citation keeps meaning",
  };
}

/**
 * Whether search over the non-materialised part may be delegated to the source.
 *
 * The owner's preferred fallback — *"3 is fallback for all data sources, if
 * possible"* — and `if possible` is the whole of this function. Delegating to a
 * source that cannot be reached is a dead end presented as an answer.
 */
export function canDelegateSearch(d: SourceDescriptor): { ok: boolean; reason: string } {
  const c = d.character;
  if (!c.hasOwnSearch) {
    return { ok: false, reason: "the source offers no search of its own to send a reader to" };
  }
  if (c.availability !== "reachable") {
    return {
      ok: false,
      reason: `the source is ${c.availability}; a reader following the link would get nothing, and a ` +
        "dead end presented as an answer is worse than saying search is unavailable",
    };
  }
  if (c.volatility === "volatile") {
    return {
      ok: true,
      reason:
        "delegation WORKS here and is in fact the only thing that does — a local index of a moving " +
        "target is stale the moment it is built. Note the asymmetry: volatility forbids citing the " +
        "source but favours searching it.",
    };
  }
  return { ok: true, reason: "reachable, searchable, and stable enough that a composed link keeps meaning" };
}
