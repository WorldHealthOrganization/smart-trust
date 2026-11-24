/**
 * The viewer-navbar audit — the common navbar rail as data.
 *
 * Every page carries the rail unless a harness visualisation explicitly
 * removes it, so a page with no rail is not automatically a defect. The audit
 * therefore records a VERDICT PER PAGE rather than a count, and the count is
 * derived from the verdicts: a count alone cannot say which page regressed,
 * or whether a missing rail was deliberate.
 *
 * ## A sidecar rather than a console report
 *
 * As with `kg:audit`: committed, the diff tells "unrailed since it was drawn"
 * from "lost its rail in the commit under review".
 *
 * ## What this does NOT audit
 *
 * **Whether the rail's links resolve.** They cannot be checked from the source
 * tree: the `/<instance>/` roots of mounted layers are mount routes
 * `mount-instance-docs.ts` creates AFTER Jekyll, and `/bootstrap/initialization.html`
 * is a `.md` Jekyll renders. `check:subgraphs` and the site-link tests own
 * that question against the built site; this one owns presence.
 *
 * @graphNode schema
 * @module schemas/viewer-nav-qa
 */
import { z } from "zod";

export const VIEWER_NAV_QA_SCHEMA = "viewer-nav-qa/v1";

/**
 * What a page's state is, and the three are NOT a severity scale.
 *
 * - `railed` — the fixture is on the page.
 * - `declined` — the page declares `<meta name="folio-navbar" content="none">`.
 *   A decision, recorded where a reader of the page can see it.
 * - `linked` — the page declares `<meta name="folio-navbar" content="linked">`:
 *   the build's rail pass gives it the rail with its style linked rather than
 *   inlined (a thin page, bean `lnoy`). Not railed in the commit, by design.
 * - `missing` — a standalone page with neither. The finding this exists for.
 *
 * There is no `could-not-determine`, and that is a claim rather than an
 * omission: every input is a file this repository committed, read as text, and
 * the three tests are total over it. A file that cannot be read is an error
 * from the audit, not a verdict about a page — the distinction
 * `instantiatedHarnesses` makes with `undefined`, for the same reason.
 */
export const ViewerNavVerdictSchema = z.enum(["railed", "declined", "linked", "missing"]);
export type ViewerNavVerdict = z.infer<typeof ViewerNavVerdictSchema>;

/**
 * The LAYOUT criteria a railed page is held to — owner, 2026-10-01 (#1757).
 *
 * | flag | the page FAILS it when |
 * |---|---|
 * | `header` | the rail has no `.fa-nav-head` — *"todos/ page has no header in LHS navbar"* |
 * | `clickable-mark` | the header is not a control for the open box, or carries no mark (avatar or letter) — *"each page needs avatar or atleast letter to be clickable"* |
 * | `visualiser-nav` | the page declares no section of its own — *"define LHS navbar for any visualizer"* |
 * | `single-open` | more or fewer than one disclosure arrives open, or the open one is not the page's own — *"only the current pages visualiers LHS navbar is open"* |
 * | `no-redundant-toggle` | a `☰` or an `[x]` duplicates the header — *"excise [hamburger] and [x]"* |
 * | `rail-tips` | a control whose name is in `aria-label` and nowhere visible carries no `data-fa-tip` equal to it, or the page paints no tooltip on hover AND keyboard focus — bean `ob3m` finding 1, owner's ruling 2026-10-01: *"show each icon's name as a tooltip on hover or keyboard focus"* |
 * | `harnesses-at-rest` | the rail has no `▦ Harnesses` disclosure, or its stylesheet hides that summary at rest — same ruling: *"make ▦ Harnesses visible … too"* |
 * | `declared-mark` | the header draws its LETTER for a harness whose row in `_data/harness.json` carries a resolved `mark` — bean `2vpn`, owner 2026-10-04, paraphrased: one layer's site was missing the top icon on the left-hand navbar, and all of them need to be consistent and consolidated. The letter is the floor for a harness with no mark, never a substitute for one it has |
 *
 * Only RAILED pages are graded: a page with no rail is already `missing`, and
 * failing it five more times would be one finding counted six ways.
 */
export const ViewerNavFlagSchema = z.enum([
  "header",
  "clickable-mark",
  "visualiser-nav",
  "single-open",
  "no-redundant-toggle",
  "rail-tips",
  "harnesses-at-rest",
  "declared-mark",
]);
export type ViewerNavFlag = z.infer<typeof ViewerNavFlagSchema>;

export const ViewerNavPageSchema = z.object({
  /** The page's published path, e.g. `/cat-harness/library/<instance>/`. */
  path: z.string().min(1),
  /** Repo-relative source, so a finding names a file somebody can open. */
  source: z.string().min(1),
  verdict: ViewerNavVerdictSchema,
  /**
   * Why, for anything other than `railed`.
   *
   * Required on `declined` and on `missing`, because both are states somebody
   * has to act on or accept, and a bare verdict makes the next reader
   * re-derive what this run already knew. Absent on `railed`: a page that
   * works owes no explanation.
   */
  reason: z.string().min(1).optional(),
  /** The layout criteria this railed page FAILS. Absent when it fails none. */
  flags: z.array(ViewerNavFlagSchema).optional(),
});
export type ViewerNavPage = z.infer<typeof ViewerNavPageSchema>;

export const ViewerNavQaSchema = z.object({
  $schema: z.literal(VIEWER_NAV_QA_SCHEMA),
  /** The published docs root the audit walked, repo-relative. */
  root: z.string().min(1),
  totals: z.object({
    pages: z.number().int().nonnegative(),
    railed: z.number().int().nonnegative(),
    declined: z.number().int().nonnegative(),
    /** Thin pages railed at build with linked style (bean `lnoy`). Absent in sidecars written before it existed. */
    linked: z.number().int().nonnegative().optional(),
    missing: z.number().int().nonnegative(),
    /** Railed pages failing at least one layout flag. */
    flagged: z.number().int().nonnegative().optional(),
  }),
  /** Every page, sorted by published path, so the diff is stable. */
  pages: z.array(ViewerNavPageSchema),
});
export type ViewerNavQa = z.infer<typeof ViewerNavQaSchema>;
