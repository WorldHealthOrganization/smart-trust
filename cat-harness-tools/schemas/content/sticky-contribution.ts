/**
 * A sticky is a CONTRIBUTION from a layer, declared by that layer.
 *
 * @module schemas/sticky-contribution
 * @graphNode schema
 *
 * Each initiator creates its own sticky; the landing set is **composed from
 * the layers present** rather than enumerated in one place — *a layer owns
 * what it can serve, and the layer above does not enumerate it*
 * (`folio-graph-typology.ts`).
 *
 * ## A DECLARATION, not a code registry
 *
 * | | code registry | declaration |
 * |---|---|---|
 * | bootstrap can contribute | **no** — `bootstrap/` holds no TypeScript, and `bootstrap/harness.json` declares a layer that *may not import from the layer composed on top of it* | yes |
 * | a downstream folio can contribute | only by shipping code | yes |
 * | inheritance | hand-wired | already resolved, `resolveDirectories`-style |
 * | expressiveness | arbitrary | the fields below, and no more |
 *
 * The first row settles it. The cost is a small vocabulary for *"my
 * description"* and *"the four onboarding links"*. A sticky's text is subject
 * matter, which `AGENTS.md` puts in the folio as data.
 *
 * ## When a sticky is minted, and its docs link
 *
 * 1. **A harness's sticky is its initiation's last act.** Each layer declares
 *    its own card in its own `harness.json`. The minting is not yet split:
 *    `scripts/ensure-landing-sticky.ts` runs at the end of cat-harness's
 *    initiation and writes every layer's card. `contributingRoots` already
 *    takes a LIST of roots, so per-harness minting is a caller change.
 * 2. **Every sticky links to ITS OWN harness's docs**, not the composing
 *    layer's — bootstrap's card points at `bootstrap/README.md` on the
 *    forge.
 *
 * ## Harness vocabulary, not core
 *
 * The declaration field lives on `CatHarnessDeclarationSchema`
 * (`schemas/kg/cat-harness.ts`), so defining the shape in
 * `landing-sticky.ts` would make the harness import core, which
 * `check:partition:edges` reports. `repo-partition.ts` classifies this module
 * `agentic-harness`: it is declaration vocabulary and imports only `zod`.
 * {@link StickyLinkSchema} is defined here and re-exported from
 * `landing-sticky.ts`.
 */
import { z } from "zod";
import { ThemeRefSchema } from "../ui/theme.js";

/** The tag a declared contribution set is identified by, for documentation. */
export const STICKY_CONTRIBUTION_SCHEMA_TAG = "folio-sticky-contribution/v1";

/**
 * One link a sticky offers.
 *
 * ## `href` must be site-root-relative or absolute — never bare-relative
 *
 * The one validation here that is about a defect rather than a shape. Bean
 * `blv9`'s entire subject is **link-shaped values that resolve by luck**, and it
 * carries seven layers. The site is a *project* Pages site with
 * `baseurl: /folio-assistant`, so:
 *
 * | form | what happens |
 * |---|---|
 * | `/guides/index.html` | correct — the template adds the baseurl with `relative_url` |
 * | `guides/index.html` | resolves against **whatever page is rendering**, and works only by position |
 * | `https://…` | correct — and must NOT be passed through `relative_url` |
 *
 * The middle form is the trap, and it was live in the file the sticky board
 * replaced: `docs/index.md` carried `[Install](installation.html)` written bare,
 * beside four siblings that went through `relative_url` properly. Those worked
 * because `index.md` declares `permalink: /`, which is *position-safe rather than
 * baseurl-safe*. Refusing the form here means a link moved into a sticky cannot
 * inherit that luck.
 *
 * `external` is DERIVED rather than declared, and the derivation is exact rather
 * than a guess: a URL scheme is what makes a link absolute, so reading it off the
 * scheme cannot disagree with the value the way a hand-set flag can.
 */
export const StickyLinkSchema = z
  .object({
    /** The link text. Translatable — it is what a reader sees. */
    label: z.string().min(1),
    /**
     * Site-root-relative (`/guides/index.html`) or absolute (`https://…`).
     *
     * A bare-relative path is refused; see the schema docs for why.
     */
    href: z
      .string()
      .min(1)
      .refine((h) => h.startsWith("/") || /^[a-z][a-z0-9+.-]*:\/\//i.test(h), {
        message:
          "an href is site-root-relative (/path) or absolute (https://…); a bare-relative path resolves by position — see bean blv9",
      }),
    /** One line under the label, when the label alone is not enough. Translatable. */
    note: z.string().min(1).optional(),
  })
  .strict();
export type StickyLink = z.infer<typeof StickyLinkSchema>;

/** Is this link off-site, and therefore NOT to be passed through `relative_url`? */
export function isExternalLink(link: StickyLink): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(link.href);
}

/**
 * Where a contribution's body text comes from, when it is not written out.
 *
 * An enum rather than a boolean so a source can be added without a second
 * flag — `bodyFrom: "summary"` reads better than `useSummary: true`.
 *
 * Both sources read the DECLARING layer, not the root's. That is the point
 * of a contribution: bootstrap's sticky carries bootstrap's words, and
 * cat-harness's carries cat-harness's. Reading the root's for every layer would
 * give a board of one sentence repeated.
 *
 * - **`summary`** is the reader's text, the same text the landing page's
 *   harness section shows: the declaration's `summary` (else its
 *   `description`), then its `alsoWritten` spellings under "Also written".
 *   See {@link readerText}. Use this one.
 * - **`description`** is the declaration's `description` verbatim. A
 *   description is written for an AUTHOR, so it can hold a naming rationale.
 *   The owner's ruling on bean `ob3m` finding 3 (2026-10-01): a sticky shows
 *   the same text as the landing page, never authoring notes. The member stays
 *   because `bootstrap/bootstrap.json`, a pinned submodule, still declares it.
 *   `landing:sticky:check` fails when it makes a card differ from the
 *   reader's text, which happens as soon as that declaration gains a `summary`.
 */
export const STICKY_BODY_SOURCES = ["summary", "description"] as const;
export type StickyBodySource = (typeof STICKY_BODY_SOURCES)[number];

/**
 * The order a contribution asks for, on a shared scale.
 *
 * **Declared, never inherited from dependency resolution.** This is the cost the
 * work-plan item called out before any of it was written: a composed set with no
 * declared order renders in `resolveDirectories`' deepest-dependency-first order,
 * which would put bootstrap's sticky **above the layer's own description** —
 * and the description has to come first, because a reader needs to know what the
 * layer IS before anything else means anything.
 *
 * The scale reads *how early should a reader meet this*, 0 first. A layer can
 * only state its own priority — it cannot see the others — so bootstrap declaring
 * {@link STICKY_ORDER_TRAILING} is bootstrap's own judgement that it is the least
 * interesting card on the board, not cat-harness reaching down to place it.
 *
 * Gaps of ten, so a contribution can be slipped between two without renumbering
 * a file in another layer.
 */
/**
 * How a harness's initiation went, as its sticky reports it.
 *
 * The owner, 2026-09-20: *"it is skill/tool to add sticky note at end of harnes
 * sinitialziation. (maybe create it a the beingnngin, update when done, to show
 * some status)"*, and *"each own intiaization sticky note to show sucess"*.
 *
 * So a sticky is a **receipt**: the board is what initiation left behind, and a
 * card on it means that harness ran.
 *
 * ## Three states, and `running` is the one that earns the design
 *
 * Writing the card only at the END would make a crashed initiation
 * indistinguishable from one that never started — in both cases the board is
 * simply missing a card, and "missing" is the least informative thing a status
 * display can say. Creating it at the START as `running` and updating it at the
 * end turns that silence into a visible state: a board still showing `running`
 * long after the fact is a harness that died mid-initiation, which is exactly
 * the failure nobody would otherwise see.
 *
 * That is the same third-state discipline `ci-health` and the QA sidecars
 * follow: **could-not-determine is never rendered as clean.**
 */
export const INITIATION_STATUSES = ["running", "ok", "failed"] as const;
export type InitiationStatus = (typeof INITIATION_STATUSES)[number];

/**
 * What a harness's initiation reported, written onto its sticky.
 *
 * Optional on the node: a sticky authored by hand, or one from a layer that
 * does not run an initiation, has no status and renders as it always did. An
 * ABSENT status is not `ok` — it means nothing reported, which is a different
 * fact and must not be painted green.
 */
export const InitiationSchema = z
  .object({
    status: z.enum(INITIATION_STATUSES),
    /** ISO 8601, when the harness began. Set by `--begin`. */
    startedAt: z.string().min(1),
    /** ISO 8601, when it finished. Absent while `running`. */
    completedAt: z.string().min(1).optional(),
    /**
     * One line on what happened. Required on `failed`.
     *
     * A failure with no detail is a red light nobody can act on, which is the
     * same objection `ThemeArtFailure.remedy` answers.
     */
    detail: z.string().min(1).optional(),
  })
  .strict()
  .refine((i) => i.status !== "failed" || (i.detail?.trim().length ?? 0) > 0, {
    message: "a `failed` initiation must say what failed — a red light nobody can act on is not a report",
  })
  .refine((i) => i.status === "running" || i.completedAt !== undefined, {
    message: "a finished initiation carries `completedAt`; only `running` may omit it",
  });
export type Initiation = z.infer<typeof InitiationSchema>;

export const STICKY_ORDER_LEADING = 10;
export const STICKY_ORDER_TRAILING = 90;

/**
 * Where a sticky's words sit inside it, as fractions of the sticky.
 *
 * **Fractions, not pixels**, because the same box has to hold across three
 * crops of different sizes — and because the art it is positioned against is
 * declared in fractions already (`KgImage.textRegion`).
 */
export const TextBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .strict();
export type TextBox = z.infer<typeof TextBoxSchema>;

/** Vertical placement of the words within their box. */
export const TEXT_ALIGNMENTS = ["start", "center", "end"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

/**
 * How a sticky places and sizes its own words.
 *
 * ## This reverses a decision, deliberately, and the reversal is the owner's
 *
 * `landing-sticky.ts` said outright that **nothing reads `textRegion`** —
 * *"a sticky note is not a thought cloud"* — on the reasoning that once the
 * sticky IS the container, it should size to its content and a fixed interior
 * would reimpose geometry the change removed.
 *
 * The owner, 2026-09-20, having looked at one:
 *
 * > i want stickys to be the same fixd size … dispalyed content matches layout
 * > ratios. placemetn of markdown and scaling/size can be adjusted (in schema)
 * > to allow more control. default is centered in the various clouds positions
 * > of the default grump cloud (across three layouts)
 *
 * So a sticky is a **fixed shape** whose aspect is its crop's aspect, and the
 * words default into the cloud — which is what `textRegion` has always
 * measured, per layout, and which the three declared regions on the `landing`
 * role already give: laptop `0.33, 0.25, 0.53 × 0.28`; mobile
 * `0.13, 0.225, 0.72 × 0.225`; card `0.30, 0.255, 0.58 × 0.235`.
 *
 * **The old objection was real and is answered by `scale` rather than by
 * refusing the box.** Text that does not fit a fixed interior used to clip or
 * spill silently. A sticky that needs more room now says so — it shrinks its
 * words, or widens its box — and that is a visible authoring choice rather
 * than a quiet overflow.
 *
 * Every field is optional: an absent `text` means *use the art's declared
 * cloud region for each layout, at normal size*, which is the default the owner
 * asked for.
 */
export const StickyTextSchema = z
  .object({
    /**
     * Override the art's cloud region.
     *
     * One box for all three layouts. The cloud moves between crops, so an
     * override is a deliberate statement that this sticky's words do not follow
     * it — a caption pinned low, say. Per-layout overrides are not offered
     * until something needs them: three boxes to keep in step is three that can
     * drift.
     */
    box: TextBoxSchema.optional(),
    /**
     * Multiply the words' size. `1` is normal; `0.8` fits more in.
     *
     * The answer to a box that is too small for its content. Bounded well away
     * from illegible: below about 0.6 the words stop being readable at all,
     * and a sticky nobody can read is worse than one that overflows.
     */
    scale: z.number().min(0.6).max(2).optional(),
    /** Vertical placement within the box. Defaults to `center`. */
    align: z.enum(TEXT_ALIGNMENTS).optional(),
  })
  .strict();
export type StickyText = z.infer<typeof StickyTextSchema>;

/**
 * One sticky a layer contributes, as that layer declares it.
 *
 * `.strict()` so a misspelled key is refused rather than silently dropped — the
 * same reason `ThemeBackdropSchema` is strict, where a `src` key had to become
 * impossible rather than merely discouraged.
 */
export const StickyContributionSchema = z
  .object({
    /**
     * The sticky's id — and **the idempotency key**.
     *
     * Initiation runs again: a re-initialisation, a sibling session, a resumed
     * container. A generated id would mint a second sticky every time. `beans
     * create` dedupes on nothing and one unguarded re-run produced **14,688**
     * duplicates, 92 % of every open bean in that repository; the same shape
     * applied to a landing page is one store's worth of the same defect.
     *
     * Unique across the **composed** set, not merely within a layer — two layers
     * declaring `landing` would write one file twice. {@link composeContributions}
     * refuses that rather than letting the last writer win.
     */
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, "a sticky id is lowercase kebab-case"),
    /** See {@link STICKY_ORDER_LEADING}. Required: an absent order is a tie with everything. */
    order: z.number().int(),
    /**
     * The theme id, by reference. **No default, and that is load-bearing.**
     *
     * A default here is exactly how *"a bare bootstrap instance gets no cat"*
     * would stop being true: the owner's ruling was *"i want the grumpy cat moved
     * out of bootstrap and into cat harness"*, and a schema defaulting to
     * `grumpy-cat` would hand one back to every layer that forgot to say
     * otherwise. Requiring it makes the choice visible in the declaration.
     *
     * Validated for **shape and not existence**, as `ThemedTodoFields` does:
     * whether a theme is installed is a question about the layer's theme set,
     * which a declaration cannot see. Resolution happens at render time, where a
     * missing theme degrades rather than failing the page.
     */
    theme: ThemeRefSchema,
    /** Shown where notes are listed. Derived from the body's first line when absent. */
    summary: z.string().min(1).optional(),
    /** The sticky's text, markdown, written out. Mutually exclusive with `bodyFrom`. */
    body: z.string().min(1).optional(),
    /** Read the body from the declaring layer instead. See {@link STICKY_BODY_SOURCES}. */
    bodyFrom: z.enum(STICKY_BODY_SOURCES).optional(),
    /**
     * Markdown appended after the body, whichever way the body was obtained.
     *
     * Exists for one case, and it is a real one: a card that must carry the
     * layer's `description` VERBATIM and then say something more. The owner:
     * *"dont lose acronym definitions"* — this layer's description is the
     * `c@t-harness` derivation chain, and the alternative to composing was
     * copying it into a literal `body`, which is the same words in two places
     * and free to drift the moment one is edited.
     *
     * Deliberately NOT a general template mechanism. One append, at the end, in
     * markdown. Anything richer belongs in the declaring layer's own
     * description or in its own card.
     */
    bodyAppend: z.string().min(1).optional(),
    /**
     * Links the sticky offers, written out.
     *
     * **Declared rather than composed, including a link to the layer's own
     * source.** Composing that from the git remote was the first design and is
     * wrong: a fork has a different remote, so the minted file would differ from
     * the committed one and `ensure-landing-sticky --check` would fail on every
     * fork — a gate that reports a defect nobody introduced. A declared URL is
     * the same in every checkout.
     */
    links: z.array(StickyLinkSchema).default([]),
    /**
     * Also offer the platform's four onboarding links.
     *
     * A flag rather than four declared links, because the set is maintained in
     * one place and a layer copying it would be the `BLOCK_KINDS` failure shape —
     * an enumeration kept in two places, one of which goes short.
     */
    onboardingLinks: z.boolean().optional(),
    /**
     * Which crop this sticky takes, overriding the one derived from its content.
     *
     * The content-derived default guessed `card` for a note the owner wanted
     * landscape, so the derivation is a starting point rather than an answer.
     * Named layouts only — a sticky cannot invent a fourth shape.
     */
    shape: z.enum(["laptop", "mobile", "card"]).optional(),
    /** Where and how big this sticky's words are. See {@link StickyTextSchema}. */
    text: StickyTextSchema.optional(),
    /** Free-form note for a reader of the declaration. Never rendered. */
    _comment: z.string().optional(),
  })
  .strict()
  .refine((c) => (c.body === undefined) !== (c.bodyFrom === undefined), {
    message:
      "a contribution declares exactly one of `body` or `bodyFrom`: both is a contradiction, neither leaves the sticky with no words",
  });
export type StickyContribution = z.infer<typeof StickyContributionSchema>;

/** A contribution, plus which layer declared it. */
export interface DeclaredContribution {
  contribution: StickyContribution;
  /** The declaring layer's `name`. */
  declaredBy: string;
  /**
   * The declaration this contribution came from, RELATIVE TO THE REPOSITORY —
   * `cat-harness/cat-harness.json`, `bootstrap/bootstrap.json`: each
   * layer's own `<instance>/<instance>.json`.
   *
   * ## Why the path and not just the name
   *
   * `declaredBy` answers *which layer*, which is what the board needs to render
   * attribution. It does NOT answer *which file*, and those are different
   * questions the moment anything wants to link to the source: a name is not
   * resolvable, and resolving one by searching would reintroduce exactly the
   * ambiguity that two layers sharing a `name` already caused once here.
   *
   * Repo-relative rather than absolute because its consumers are a forge URL
   * (`/edit/<branch>/<path>`) and a published page — neither of which has any
   * use for this checkout's location on somebody's disk.
   */
  declaredIn: string;
  /** The declaring layer's root path on disk, when known. */
  instanceRoot?: string;
  /** The declaring layer's `description`, for `bodyFrom: "description"`. */
  description?: string;
  /** The declaring layer's `summary`, for `bodyFrom: "summary"`. */
  summary?: string;
  /** The declaring layer's `alsoWritten`, for `bodyFrom: "summary"`. */
  alsoWritten?: readonly string[];
}

/**
 * The reader's text for a harness: the declaration's `summary` (else its
 * `description`), then its other spellings under "Also written".
 *
 * **This is the landing page's rule, written once for the sticky board.** The
 * landing's harness section (`docs/_includes/harness_details.html`) renders
 * `t.summary | default: t.description` and then `Also written:` with each
 * spelling in `<code>`. A sticky with `bodyFrom: "summary"` renders this, so
 * the two surfaces read the same two declaration fields and agree. Before the
 * owner's ruling on `ob3m` finding 3, a sticky read `description`, and the
 * folio-assistant card showed why the layer was NAMED what it is.
 *
 * Returns `undefined` when neither field has words. The caller falls back to
 * the layer's name.
 */
export function readerText(fields: {
  summary?: string | undefined;
  description?: string | undefined;
  alsoWritten?: readonly string[] | undefined;
}): string | undefined {
  const has = (s: string | undefined): s is string => s !== undefined && s.trim().length > 0;
  const line = has(fields.summary) ? fields.summary : has(fields.description) ? fields.description : undefined;
  if (line === undefined) return undefined;
  const also = (fields.alsoWritten ?? []).filter(has);
  return also.length === 0
    ? line
    : `${line}\n\nAlso written: ${also.map((w) => `\`${w.trim()}\``).join(", ")}`;
}

/**
 * Sort contributions into render order, deterministically.
 *
 * `order` first, then **`declaredBy` and `id`** — a total order, so two layers
 * choosing the same number still render the same way on every run. A partial
 * order here would make the board depend on the sequence the declarations
 * happened to be read in, which is the dependency-resolution order this design
 * exists to stop deciding the layout.
 */
export function compareContributions(a: DeclaredContribution, b: DeclaredContribution): number {
  return (
    a.contribution.order - b.contribution.order ||
    a.declaredBy.localeCompare(b.declaredBy) ||
    a.contribution.id.localeCompare(b.contribution.id)
  );
}

/** Raised when two layers claim the same sticky id. */
export class StickyIdConflictError extends Error {
  constructor(
    readonly id: string,
    readonly declaredBy: readonly string[],
  ) {
    super(
      `two layers contribute a sticky with id "${id}" (${declaredBy.join(", ")}); ` +
        `an id is the file name and the idempotency key, so one of them would overwrite the other`,
    );
    this.name = "StickyIdConflictError";
  }
}

/**
 * The composed board: every layer's contributions, in declared order.
 *
 * **Refuses a duplicate id rather than letting the last writer win.** The id is
 * the file name *and* the idempotency key, so a collision does not produce two
 * stickies — it produces one file written twice, where which layer's text
 * survives depends on read order. That is the failure mode with no symptom: the
 * board renders, and one layer's card is simply not on it.
 */
export function composeContributions(
  declared: readonly DeclaredContribution[],
): DeclaredContribution[] {
  const byId = new Map<string, DeclaredContribution[]>();
  for (const d of declared) {
    const seen = byId.get(d.contribution.id);
    if (seen) seen.push(d);
    else byId.set(d.contribution.id, [d]);
  }
  for (const [id, group] of byId) {
    if (group.length > 1) throw new StickyIdConflictError(id, group.map((g) => g.declaredBy));
  }
  return [...declared].sort(compareContributions);
}
