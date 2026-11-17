/**
 * The landing page, as a board of sticky notes.
 *
 * @module schemas/landing-sticky
 * @graphNode schema
 *
 * Initiation creates an empty folio (if none exists) and attaches a sticky
 * per initiator, carrying the initiated harness's description and the four
 * onboarding links.
 *
 * ## The set is COMPOSED, not enumerated here
 *
 * This module holds the **node type and one projection**:
 * {@link stickyFromContribution} turns a layer's declared
 * {@link StickyContribution} into a sticky. The layers declare; this builds.
 * Where each sticky comes from, and why it is a declaration rather than a
 * code registry, is in `schemas/content/sticky-contribution.ts`.
 *
 * ## A note, not a todo
 *
 * A landing description is not a task: no status, nothing to complete. So it
 * extends {@link CarriedNoteSchema} directly — the general "note somebody
 * carries, attached to the graph" that `TodoNodeSchema` also extends — and
 * stays out of the `todos` graph.
 *
 * ## The anchor is NARROWED, not merely set
 *
 * `CarriedNote.anchor` is optional across three states. Here it is
 * `PageAnchorSchema` and required: a landing sticky is page-global, with no
 * block to sit on, so one carrying a block anchor does not parse.
 */
import { z } from "zod";

import { CarriedNoteSchema } from "../kg/carried-note.js";
import { PageAnchorSchema } from "../ui/note-anchor.js";
import {
  InitiationSchema,
  StickyLinkSchema,
  StickyTextSchema,
  isExternalLink,
  readerText,
  type DeclaredContribution,
  type Initiation,
  type StickyLink,
} from "./sticky-contribution.js";
import { ThemeRefSchema } from "../ui/theme.js";

/**
 * The link shape, and the external-link test, **re-exported**.
 *
 * Both moved to `schemas/content/sticky-contribution.ts` when the board became a
 * composed set: the declaration field that carries contributions lives on
 * `CatHarnessDeclarationSchema`, which is `agentic-harness`, and this module is
 * `folio-assist-core` — so defining the shape here would make the harness import
 * core, a wrong-direction edge. Re-exported rather than moved silently so that
 * nothing which imported `LandingLinkSchema` has to change, and so a reader
 * following the old name arrives at the new home.
 */
export { StickyLinkSchema as LandingLinkSchema, isExternalLink };
export type LandingLink = StickyLink;

/** The tag this node declares, per the `$schema` convention. */
export const LANDING_STICKY_SCHEMA_TAG = "folio-landing-sticky/v1";

/**
 * The page a landing sticky is global to.
 *
 * `index` rather than `/` because this is an identifier compared against another
 * note's `anchor.page`, not a URL. `PageAnchorSchema` carries the page precisely
 * so *"global"* means global **to a page** — a sticky on the landing page must
 * not surface on every other one.
 */
export const LANDING_STICKY_PAGE = "index";

/**
 * The landing sticky.
 *
 * Extends {@link CarriedNoteSchema}; see the module docs for why it is a note
 * rather than a todo, and why `anchor` is narrowed.
 */
export const LandingStickySchema = CarriedNoteSchema.extend({
  $schema: z.literal(LANDING_STICKY_SCHEMA_TAG),
  /**
   * Page-global, and required — not the three-state optional the base carries.
   *
   * See module docs: a landing sticky has no block to sit on, so `block` and
   * `none` are states that cannot be true of it.
   */
  anchor: PageAnchorSchema,
  /**
   * The theme id, by reference.
   *
   * Validated for **shape and not existence**, exactly as `ThemedTodoFields`
   * does: whether a theme is installed is a question about the layer's theme
   * set, which a note cannot see. Resolution happens at render time, where a
   * missing theme degrades rather than failing the page.
   */
  theme: ThemeRefSchema,
  /**
   * The links this sticky offers, in the order a reader should meet them.
   *
   * An **array rather than a map**, because the order is the content: `alox`
   * records the onboarding block as *"Four things, in order"*, and the order is
   * load-bearing — claim a bean before you work, then scaffold, then know which
   * kind of thing you are writing. A map would lose it, and re-deriving an order
   * from labels would invent one.
   *
   * Empty is legitimate: a sticky that is only words.
   */
  links: z.array(StickyLinkSchema).default([]),
  /**
   * Which layer contributed this sticky.
   *
   * Recorded on the node rather than left implicit, because the board is now
   * composed and *"which layer put this here"* is the first question anyone
   * debugging it asks. It is also what lets a test assert the owner's ruling
   * structurally: a board composed over bootstrap alone carries only stickies
   * whose `contributedBy` is `bootstrap`, and therefore no cat.
   */
  contributedBy: z.string().min(1),
  /**
   * The declaration this sticky came from, relative to the REPOSITORY.
   *
   * `contributedBy` says which layer, which is what attribution needs.
   * This says which FILE, which is what a link to the source needs — and
   * they are different questions: a name is not resolvable, and two
   * layers sharing one is a collision this repository has already had.
   */
  declaredIn: z.string().min(1),
  /**
   * The crop this sticky takes, when it chooses rather than being derived.
   *
   * Absent means *derive it from the content*, which is what the generator does.
   * The owner asked for one sticky to be landscape after the derivation picked
   * `card` for it, so the derivation is a starting point and this is the
   * override.
   */
  shape: z.enum(["laptop", "mobile", "card"]).optional(),
  /**
   * Where and how big this sticky's words are.
   *
   * Absent means *the art's declared cloud region for each layout, at normal
   * size* — the default the owner asked for. See `StickyTextSchema` for why
   * this reverses the earlier "nothing reads textRegion" decision.
   */
  text: StickyTextSchema.optional(),
  /**
   * What this harness's initiation reported — the sticky as a RECEIPT.
   *
   * Written by the minting tool rather than declared: a layer says what its
   * card SAYS, and initiation says how it WENT. Absent means no initiation has
   * reported, which is not the same as `ok` and must never render as it.
   */
  initiation: InitiationSchema.optional(),
});
export type LandingSticky = z.infer<typeof LandingStickySchema>;

/**
 * The four onboarding links this platform offers, for `onboardingLinks: true`.
 *
 * Taken from the block `alox` shipped on `docs/index.md` rather than rewritten,
 * so the sticky says what the page already says. The fourth label is the owner's
 * own phrasing and is **kept rather than sanded off** — `alox` explains why, and
 * it is honestly true of every thorough docs site.
 *
 * Kept in code rather than moved into the declaration with the rest of the text,
 * and the reason is the flag: `onboardingLinks` exists so a layer asks for *the
 * set* instead of copying it. A copy in each declaration would be the
 * `BLOCK_KINDS` failure shape — one enumeration in several places, one of which
 * goes short. The words are still checked against the live pages by
 * `landing-sticky.test.ts`.
 */
export const DEFAULT_ONBOARDING_LINKS: readonly LandingLink[] = [
  {
    label: "The work plan is where you say what you are doing",
    href: "/guides/beans-and-todos.html",
    note: "Claim a bean before you work, so a sibling session does not pick up the same item.",
  },
  {
    label: "Make your first folio",
    href: "/start/getting-started.html",
    note: "This repository is the platform; your content lives in its own.",
  },
  {
    label: "Know which kind of thing you are writing",
    href: "/concepts/content-types.html",
    note: "A document is structured prose; a paper adds the block kinds whose assertion is a formal claim.",
  },
  {
    label: "The documentation you will never read",
    href: "/guides/index.html",
    note: "All of it. The honest expectation is that you arrive from a search engine when something breaks.",
  },
] as const;

/** What {@link stickyFromContribution} needs beyond the contribution itself. */
export interface StickyBuildContext {
  /**
   * ISO 8601. Supplied rather than read from the clock.
   *
   * **`createdAt` is an argument and not `new Date()`.** A function reading the
   * clock cannot be tested for the thing that matters here — that running it
   * twice produces the same node — and initiation is exactly the code that runs
   * twice. It also makes the write diff-free on a re-run, which is what lets a
   * check say *nothing changed* instead of *the timestamp moved*.
   */
  createdAt: string;
  /** Defaults to {@link LANDING_STICKY_PAGE}. */
  page?: string;
  /** Carried onto the node when initiation has reported. See {@link Initiation}. */
  initiation?: Initiation;
}

/**
 * Build one sticky from the contribution a layer declared.
 *
 * `summary` is derived from the body's first line when the contribution does not
 * give one. A second field the caller must keep in step with the first is a field
 * that drifts, and the sticky renders `comment`; `summary` exists for the places
 * that list notes.
 *
 * **The body stays markdown.** The `c@t-harness` derivation chain is several
 * lines rather than a sentence, and rendering it as real text is what keeps it
 * selectable, translatable and readable by a screen reader. The composited path
 * already did this — `landing.html` renders `h.description | markdownify` with
 * the artwork `alt=""` — and this must not regress it into an image.
 */
export function stickyFromContribution(
  declared: DeclaredContribution,
  ctx: StickyBuildContext,
): LandingSticky {
  const { contribution: c, declaredBy, description } = declared;
  // `bodyFrom: "summary"` is the landing's reader text (`ob3m` finding 3);
  // `bodyFrom: "description"` is the author's text, kept for a pinned layer.
  const fromDeclaration = c.bodyFrom === "summary" ? readerText(declared) : description;
  // `body`, then the declaring layer's `description`, then its `name` — and
  // the last step is a DELIBERATE non-failure, carried over from the fixed-set
  // version rather than re-decided here: *"an instance with no description still
  // gets a sticky: its `name` is what `displayTitle` already falls back to, and a
  // landing page with no words is worse than one naming the instance."* Throwing
  // instead would make initiation fail over a declaration nobody has filled in
  // yet, and initiation failing is worse than a thin card. `name` is required by
  // the declaration schema, so the chain always terminates in something.
  const declaredBody = c.body ?? fromDeclaration;
  const base =
    declaredBody !== undefined && declaredBody.trim().length > 0 ? declaredBody : declaredBy;
  // Appended AFTER the fallback chain, so a card that reads its layer's
  // description verbatim can still add to it without copying the words.
  const body = c.bodyAppend === undefined ? base : `${base}\n\n${c.bodyAppend}`;
  const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim();
  return LandingStickySchema.parse({
    $schema: LANDING_STICKY_SCHEMA_TAG,
    id: c.id,
    // The first non-blank line, when the contribution does not give one. The
    // fallback beyond that cannot be reached — `body` is non-empty by the chain
    // above — but says what the object IS rather than parsing as empty.
    summary: c.summary ?? (firstLine && firstLine.length > 0 ? firstLine : declaredBy),
    comment: body,
    createdAt: ctx.createdAt,
    anchor: { kind: "page", page: ctx.page ?? LANDING_STICKY_PAGE },
    theme: c.theme,
    // Declared links first, then the shared set. A layer that declares its own
    // link to itself wants it read before the platform's onboarding four.
    links: [...c.links, ...(c.onboardingLinks ? DEFAULT_ONBOARDING_LINKS : [])],
    contributedBy: declaredBy,
    declaredIn: declared.declaredIn,
    // Carried only when declared. Writing `shape: undefined` into the node would
    // make every existing sticky file differ by a key, which `--check` reports
    // as stale and an author reads as a change they did not make.
    ...(c.shape === undefined ? {} : { shape: c.shape }),
    ...(c.text === undefined ? {} : { text: c.text }),
    // Preserved across a rebuild rather than reset. The builder runs on every
    // initiation and on every `--check`; dropping the status would make a
    // finished harness read as "never reported" the next time anything touched
    // the board.
    ...(ctx.initiation === undefined ? {} : { initiation: ctx.initiation }),
  });
}

/**
 * Is this note the landing sticky?
 *
 * Reads the **`$schema` tag**, not the id and not the shape. `beans/beans.json`
 * records why in the general case: before workflow instances carried a tag they
 * were identifiable only by SHAPE, and *"extension is a coincidence; a
 * declaration inside the file is the contract."* An id check would also match a
 * note somebody happened to call `landing`.
 */
export function isLandingSticky(note: unknown): note is LandingSticky {
  return (note as { $schema?: unknown } | null)?.$schema === LANDING_STICKY_SCHEMA_TAG;
}

/**
 * Re-exported so this module's existing callers read as they did.
 *
 * The IMPLEMENTATION moved DOWN to `cat-harness.ts` (bean `pb04`, owner
 * 2026-09-20: *"notes exist lower down than folio. make sure arrows
 * correct"*). It had nothing to do with landing stickies — it is "where is
 * this file on the forge" — and once the TODO index needed it too, a note-layer
 * generator was reaching sideways into the folio-facing module for a generic
 * helper. `repo-partition` allowed it, because both are `core`; the LAYER
 * arrow was still wrong.
 *
 * Down beside {@link publishedAssetPath}, which is the same shape of transform
 * — a declared path to the URL that serves it — so both callers now point
 * downward at one answer instead of at each other.
 */
export { sourceLinks } from "../kg/cat-harness.js";

