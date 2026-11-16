/**
 * The repository health checks — the registry, and the pure verdict logic.
 *
 * ## What this module is, and what it deliberately is not
 *
 * Every function here is **pure**: it is handed already-gathered evidence and
 * returns a {@link HealthCheckResult}. Nothing here runs `git`, touches the
 * network or reads a file. The gathering lives in `./probes.ts`, behind
 * {@link HealthContext}.
 *
 * That split is not tidiness. **A checker that returns `[]` for everything
 * passes a corpus test**: run it against a healthy repository and a function
 * that does nothing is indistinguishable from one that works. The only way to
 * know a check can fire is to hand it evidence that should make it fire — and
 * that is only possible if the evidence is a parameter. `checks.test.ts` does
 * exactly that, once per check, per threshold.
 *
 * ## Three states, everywhere
 *
 * A probe returns `ok` with a value, or `unknown` with a reason. A check
 * given an `unknown` probe returns `unknown` and says what it could not
 * determine. **"Could not read `gh-pages`" is never "0 MB of previews"** — the
 * rule `restore-staging.ts` was written for, applied one layer up. A determined
 * empty (the branch was read and carries no previews) is a real `ok`, and is
 * said differently.
 *
 * ## Every threshold carries its basis
 *
 * {@link HealthThreshold} requires `basis` structurally, so a check cannot ship
 * a bare constant. Where no external standard exists the basis says so and
 * gives the measurement it was calibrated against, with its date. A stated
 * arbitrary number is honest; an unstated one implies a rigour it does not have.
 *
 * ## Nothing here deletes anything
 *
 * Every `action` on every finding names something a **person** does. Several
 * of these checks are about artefacts accumulating, and the reflex is to have
 * the sweep tidy up. It must not: see
 * `skills/conduct/conduct-core/deletion-requires-confirmation.md`, and bean `plj1` for
 * what a workflow that tidies up on its own initiative actually costs.
 *
 * @module test/health/checks
 */

import type {
  HealthCheckResult,
  HealthFinding,
  HealthMeasurement,
  HealthThreshold,
  PagesServingObservation,
} from "../../schemas/sdlc/health-report.ts";
import { isPreviewName, MAX_PREVIEW_BYTES } from "../../scripts/staging-rotate.ts";
import type { LsiHealthEvidence } from "../../scripts/lsi-health.ts";
import type { KeywordsState } from "../../scripts/library-keywords.ts";
import { PREVIEW_PREFIX } from "../../schemas/sdlc/preview-prefix.ts";
import {
  EXPIRY_BASIS,
  EXPIRY_URGENT_DAYS,
  EXPIRY_WARN_DAYS,
  INDEX_ROOT,
  defaultDirs,
  judgeSecrets,
  readRepoFiles,
  repoResolver,
  type RepoEvidence,
} from "../../scripts/secrets-check.ts";

// ── Evidence ────────────────────────────────────────────────────

/** A gathered fact, or the reason it could not be gathered. Never both, never neither. */
export type Probe<T> = { state: "ok"; value: T } | { state: "unknown"; reason: string };
/**
 * A STORE's probe: a {@link Probe}, or `absent` — the repository declares no
 * such store at all. A DETERMINED answer, not a missing one: since the
 * separation every repository is checked on its own, and most hold no bean
 * or todo store, so "could not determine" there would make every report
 * permanently unknown — noise that teaches a reader to ignore the state.
 */
export type StoreProbe<T> = Probe<T> | { state: "absent"; reason: string };

/** One preview directory on the publish branch. */
export interface StagingPreview {
  /** The directory name under `branches/` — the sanitised branch slug. */
  slug: string;
  bytes: number;
  files: number;
}

export interface StagingEvidence {
  /**
   * Whether the publish branch exists at all.
   *
   * `absent` is a **determined** answer — a repository whose first deploy has
   * not happened has no previews, and saying so is correct. It is reached only
   * via `git ls-remote --exit-code`, whose exit 2 means "asked, and there is no
   * such ref", as against any other non-zero meaning "could not ask". Collapsing
   * those two is the whole of bean `plj1` in miniature.
   */
  branch: "present" | "absent";
  previews: StagingPreview[];
  /** Where they were read from, for the report's `command` fields. */
  command: string;
}

/**
 * One remote branch whose slug matches a preview, and what could be
 * established about it.
 *
 * **Every field that can be undetermined is optional, and `unevaluated` says
 * which.** A branch whose ancestry could not be computed is NOT a merged
 * branch, and a tip date that could not be read is not an old one. Collapsing
 * either into its determined neighbour is how this check went back to naming
 * live work, which is the whole of bean `w2g5`.
 */
export interface BranchEvidence {
  /** The short ref as the remote carries it — `claude/brave-hypatia-r820sf`, NOT slugified. */
  ref: string;
  /** True when the tip is an ancestor of the default branch: the work is already in it. */
  mergedIntoDefault?: boolean;
  /** ISO 8601 committer date of the tip. */
  headCommittedAt?: string;
  /** Why a field above is absent. Set if and only if at least one is. */
  unevaluated?: string;
}

export interface BranchEvidenceSet {
  /**
   * The remote branches whose slug matches one of the previews — only those.
   *
   * The probe has to fetch a tip it does not already hold, and fetching all
   * 226 branches this repository carried on 2026-09-19 to answer a question
   * about five previews would make a daily sweep cost a clone.
   *
   * An EMPTY set is a **determined** answer — the remote was listed and
   * nothing on it slugifies to any preview — not a failure to look. The
   * distinction is carried by the probe's three states, not by this field.
   */
  candidates: BranchEvidence[];
  /** What the ancestry was measured against, so a finding can name it. */
  defaultBranch: string;
  /** How they were read, for the report's `command` fields. */
  command: string;
}

export interface RepoSizeEvidence {
  /** This clone's `.git`, on disk. Includes local gc state — see the check. */
  gitDirBytes: number;
  /** The sum of blob sizes at HEAD: the repository's CONTENT, gc-independent. */
  trackedBytes: number;
  packs: number;
  packBytes: number;
}

export type DoneWhenState =
  | { kind: "absent" }
  | { kind: "unreadable" }
  | { kind: "open"; ticked: number; total: number }
  | { kind: "all-ticked"; total: number };

export interface BeanEvidence {
  id: string;
  title: string;
  status: string;
  /** ISO 8601, or `undefined` when the front matter carries none. */
  updatedAt?: string;
  /**
   * How many options the bean's own options section lists, or `undefined` when
   * it has no such section.
   *
   * **`undefined` is the third state and the check must not read it as zero.** A
   * bean that records WORK rather than a decision has no options to list, and
   * `madr.md` says so in as many words: "a bean that records a decision carries
   * these sections; a bean that records work does not need them." Collapsing
   * absent into 0 would make every work bean a malformed decision record.
   *
   * Computed in the probe rather than here so the check stays a pure function
   * over evidence and a fixture stays a literal — the reason `HealthContext` is
   * a record of probes at all.
   */
  consideredOptions?: number;
  /** Carries a decision rendered through `renderDecision` — see `hasRenderedDecision`. */
  renderedDecision?: boolean;
  /**
   * What the bean's own `## Done when` criteria say about it — see
   * `doneWhenState`, which carries the four states and why `unreadable`
   * outranks `all-ticked`.
   *
   * `undefined` here means the probe that built this evidence predates the
   * field, NOT that the bean has no criteria — `{ kind: "absent" }` says that.
   * The check must treat the two apart for the reason `consideredOptions`
   * above does: a missing measurement is not a measured zero.
   */
  doneWhen?: DoneWhenState;
  /**
   * The bean this one is a child of, from its `parent:` front matter.
   *
   * `undefined` means a ROOT bean — one nothing parents — which is a real and
   * common answer, not a missing measurement. Nothing here distinguishes it
   * from a probe that predates the field, and nothing needs to: the only
   * consumer asks whether a bean HAS live children, and a bean with no
   * children answers that the same either way.
   */
  parent?: string;
  /**
   * The bean's `type:` front matter — `milestone`, `epic`, `feature`, `task`,
   * `bug` — or `undefined` when the probe predates the field or the file
   * carries none. Read only by `bean-session-log-roots`, which treats
   * `undefined` as "not a root", never as a match.
   */
  type?: string;
}

export interface TodoEvidence {
  id: string;
  status: string;
  /** ISO 8601 date, or `undefined` when the front matter carries none. */
  createdAt?: string;
}

/**
 * Everything the checks are allowed to see.
 *
 * A record of probes rather than a set of methods, so a fixture is a literal.
 */
export interface HealthContext {
  now: Date;
  /** `owner/repo`, or the layer name when there is no GitHub remote. */
  subject: string;
  staging: Probe<StagingEvidence>;
  /** Head refs of the currently open pull requests — `claude/foo`, unsanitised. */
  openPrHeads: Probe<string[]>;
  /**
   * The remote branches that could keep a preview alive.
   *
   * Separate from {@link openPrHeads} because they answer different questions
   * and fail independently: the API can be rate-limited while `git` is fine,
   * and vice versa. A check that needs both says which one it lost.
   */
  branches: Probe<BranchEvidenceSet>;
  repoSize: Probe<RepoSizeEvidence>;
  beans: StoreProbe<BeanEvidence[]>;
  todos: StoreProbe<TodoEvidence[]>;
  /** Every special branch the declaration names, with its budget and tip size. */
  specialBranches: Probe<SpecialBranchEvidence>;
  /**
   * The pages-serving observation a CI job with egress published on
   * `qa-reports` (bean `1dre`), read offline through the qa-store.
   */
  pagesServing: Probe<PagesServingEvidence>;
  /**
   * `mount:remote:check` over the declared remote mounts, read with no
   * network (folio-assistant#2467, decision 3). Optional: a context built
   * before this probe existed reads as `absent`.
   */
  remoteMounts?: StoreProbe<RemoteMountEvidence>;
  /**
   * The LSI indexes over the declared prose graphs, read from the checkout or
   * the `qa-reports` branch (`scripts/lsi-health.ts`, cat-harness#1144).
   * Optional: a context built before this probe existed reads as `absent`.
   */
  lsiIndexes?: StoreProbe<LsiHealthEvidence>;
  /**
   * Each library entry's `keywords.json` against what `library:keywords` would
   * write now (cat-harness#1144). Optional: absent without a probe.
   */
  libraryKeywords?: StoreProbe<KeywordsState[]>;
}

/** One declared remote layer as the mount check left it. */
export interface RemoteMountEvidence {
  outcomes: { instance: string; state: string; detail?: string }[];
  command: string;
}

/** The observation, and the qa-store entry it was read from. */
export interface PagesServingEvidence {
  /** `main/<sha>` — the entry, so a reader can fetch the same file. */
  key: string;
  observation: PagesServingObservation;
}

/** A special branch's size budget, as `branch-budgets.json` states it. */
export interface SpecialBranchBudget {
  bytes: number;
  /** `branch`: each branch on its own. `family`: every branch of a family together. */
  scope: "branch" | "family";
  /** The owner's own words for the number. */
  stated: string;
  basis: string;
}

/** One declared special branch (or family), as measured on the remote. */
export interface SpecialBranchMeasure {
  id: string;
  name: string;
  shape: "branch" | "family";
  budget?: SpecialBranchBudget;
  /**
   * `measured`: budgeted, present, every member's tip tree summed.
   * `absent`: no branch on the remote carries the name (a determined answer).
   * `unbudgeted`: present, but the declaration states no budget — never read
   * as within one.
   */
  state: "measured" | "absent" | "unbudgeted";
  /** The name (new or legacy) the remote actually carries. */
  resolved?: string;
  branches: { ref: string; bytes: number; files: number }[];
}

export interface SpecialBranchEvidence {
  rows: SpecialBranchMeasure[];
  command: string;
}

// ── Helpers ─────────────────────────────────────────────────────

const MB = 1024 * 1024;

export function formatBytes(n: number): string {
  if (n >= 1024 * MB) return `${(n / (1024 * MB)).toFixed(2)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${n} B`;
}

/**
 * Slugify a branch name the way `feature-staging.yml` does.
 *
 * Copied from that workflow's `Determine staging slug` step, 2026-09-19:
 * `sed 's|[^a-zA-Z0-9._-]|-|g' | sed 's|--*|-|g' | sed 's|^-||;s|-$||'`.
 *
 * **Forward only, deliberately.** The orphan check slugifies the open PRs'
 * heads and compares against the directory names; it never tries to recover a
 * branch name from a slug. That direction is ambiguous — `claude/a-b` and
 * `claude-a-b` produce the same slug — and an ambiguous inverse would let the
 * check name the wrong PR, which on a finding whose action is "consider
 * removing this" is the worst available failure.
 */
export function stagingSlug(branch: string): string {
  return branch
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

/** Build an `unknown` result for a check whose evidence did not arrive. */
/** A check over a store this repository does not declare: ok, and says why there was nothing to check. */
function absentResult(id: string, summary: string, thresholds: HealthThreshold[], reason: string): HealthCheckResult {
  return { id, state: "ok", summary, thresholds, measurements: [], findings: [], reason: `not applicable: ${reason}` };
}

function unknownResult(
  id: string,
  summary: string,
  thresholds: HealthThreshold[],
  reason: string,
): HealthCheckResult {
  return { id, state: "unknown", summary, thresholds, measurements: [], findings: [], reason };
}

function settle(
  id: string,
  summary: string,
  thresholds: HealthThreshold[],
  measurements: HealthMeasurement[],
  findings: HealthFinding[],
): HealthCheckResult {
  return {
    id,
    state: findings.length > 0 ? "finding" : "ok",
    summary,
    thresholds,
    measurements,
    findings,
  };
}

function daysBetween(later: Date, iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.floor((later.getTime() - t) / 86_400_000);
}

/**
 * Minutes between an ISO timestamp and `now`, or `undefined` if it is unreadable.
 *
 * Signed, deliberately: a tip dated in the future — clock skew on a runner, or
 * an author date that outruns the committer date — yields a negative age and
 * so reads as RECENT. That is the safe direction. Every error this module can
 * make about a timestamp should end in sparing a preview, never in accusing
 * one.
 */
function minutesSince(now: Date, iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return (now.getTime() - t) / 60_000;
}

/**
 * Whole hours between an ISO timestamp and `now`, or `undefined` if unreadable.
 *
 * Floored, and never negative: clock skew on a runner can date a write in the
 * future, and a claim written "in the future" is the most recent claim there
 * is. Reading it as 0 hours is the safe direction — the error spares a claim
 * rather than accusing one of being quiet.
 */
function hoursBetween(later: Date, iso: string | undefined): number | undefined {
  const m = minutesSince(later, iso);
  return m === undefined ? undefined : Math.max(0, Math.floor(m / 60));
}

/** An age a person reads, from minutes. */
export function formatAge(minutes: number): string {
  const m = Math.max(0, minutes);
  if (m < 120) return `${Math.round(m)} min`;
  if (m < 2880) return `${(m / 60).toFixed(1)} h`;
  return `${Math.round(m / 1440)} days`;
}

// ── Thresholds ──────────────────────────────────────────────────

/**
 * The owner's number, 2026-09-19: *"issue warning to user when exceeds >
 * 100mb"*.
 *
 * It is not arbitrary even though it was given as a round one. GitHub
 * documents a hard limit of **1 GB for a published Pages site**, and the
 * previews share that budget with the main site, so 100 MB is a tenth of the
 * ceiling — an early-warning point that leaves room to act. Measured against
 * this repository on 2026-09-19, a single preview is 37.5–39.0 MB, so the
 * third concurrent review breaches it.
 *
 * ## The floor, stated — because the threshold sits below it
 *
 * **This limit cannot be met by pruning, and that is not a defect in the
 * limit.** A preview whose branch is live must not be removed (see
 * {@link LIVENESS_SIGNALS}), so N concurrent reviews put a floor of
 * `N x ~38 MB` under the total. Nine open previews on 2026-09-19 totalled
 * 346 MB, of which exactly **two** were prunable orphans — 76.7 MB, leaving
 * 269 MB. Two previews alone exceed 100 MB, so from the third concurrent
 * review onward the only honest readings are "over" and "over".
 *
 * A check whose finding names an action must therefore name the RIGHT one, and
 * for this threshold the action is never "prune more". Measured the same day:
 * 27.5 MB of each 37.5 MB preview is HTML, and **zero HTML blobs are shared
 * between any two previews** — every page carries the slug and the build
 * timestamp, so git's content-hash deduplication has nothing to grip and nine
 * previews store nine copies of a site identical apart from its own address.
 * The 9x is in the addressing, not the content.
 *
 * Four independent sources put per-preview text on every page, and any ONE of
 * them defeats deduplication on its own:
 *
 *  1. the **build timestamp** and commit SHA in the staging banner — the most
 *     fundamental, because it makes every page unique even across two builds
 *     of ONE branch, so each re-push adds ~27.5 MB of new blobs permanently;
 *  2. `baseurl`-prefixed hrefs, ~235 per page (Jekyll's `relative_url`
 *     prepends `baseurl`; it is not document-relative);
 *  3. the `fa-translation-index` JSON island, which published `site.baseurl`
 *     to `docs-ui.js` because the language switcher rebuilds nav hrefs from it
 *     — **removed** 2026-10-02: it was 9.3 KB in every page's `<head>` and the
 *     SAME 9.3 KB on all 1571 of them (14.26 MB, ONE distinct payload), and it
 *     is now fetched once from `assets/harness/site.json`. This paragraph
 *     named the remedy — *"derive the per-preview facts in the browser instead
 *     of baking them into 390 pages"* — and `R4`'s relaxation to "reachable
 *     without XSS" is what made it available;
 *  4. the three SEO identity claims — **removed** as of
 *     `scripts/strip-preview-seo.ts`, on correctness grounds rather than size.
 *
 * So the number to act on is preview SIZE, and the tractable shape is the one
 * this repository already uses for the sidebar QR: derive the per-preview facts
 * in the browser instead of baking them into 390 pages, which turns 390
 * differing files into one small differing file. Bean `xxku`.
 *
 * ## 100 MB → 500 MB, 2026-09-20, and WHY the old reasoning stopped applying
 *
 * This comment used to end *"the threshold stays at 100 MB regardless… it is
 * a statement that the current arrangement is not sustainable, and it is
 * correct."* That was sound **under the retention policy of the day**, and
 * the owner changed that policy the same afternoon.
 *
 * The old argument turned on the total being **monotonic**. Previews were
 * retained on close as well as on merge, so nothing ever left: any threshold
 * was breached eventually and stayed breached, and "over" carried no
 * information after the first time. A number that can only ever be exceeded
 * is a statement about the arrangement, which is exactly what that paragraph
 * said it was.
 *
 * `folio-assistant-1feu` removed the monotonicity. A merged pull request's
 * preview is now removed automatically — the merge is the confirmation, since
 * the main site then shows what the preview showed — so the store **drains**.
 * What remains is bounded by CONCURRENT REVIEWS rather than by cumulative
 * history, and a threshold over a draining quantity is a live signal again
 * rather than a permanent verdict.
 *
 * So the number now answers a different question: *how many reviews can be
 * open at once before this is a problem?* That was answered as **about
 * thirteen**, from a measured ~38 MB per preview.
 *
 * ## The per-preview figure was stale by more than 2x — bean `tebu`
 *
 * **Re-measured 2026-09-22: a full preview is ~88 MiB.** So 500 MB is about
 * **five or six** concurrent reviews, not thirteen — below the concurrency
 * this repository reaches routinely, which is why an ordinary working day now
 * trips `critical`, and a threshold that always fires has stopped
 * discriminating.
 *
 * The 500 MB value is the owner's (*"set stagfing to 500mb"*) and is left
 * alone. What is corrected is the arithmetic beneath it; whether the number
 * still buys what they wanted is theirs to decide.
 *
 * ## Two budgets, and this threshold is about only one of them
 *
 * The paragraphs above give a DEDUPLICATION argument — zero HTML blobs shared,
 * nine previews storing nine copies — as the reason to act on a threshold
 * stated against *"the documented 1 GB Pages ceiling"*. Those are different
 * budgets and the argument cannot move that limit:
 *
 * | budget | what it counts | does blob sharing help? |
 * |---|---|---|
 * | **1 GB Pages ceiling** | the PUBLISHED tree — each preview materialises its own copies | **no** |
 * | `gh-pages` repository size | git objects, where identical content is stored once | yes |
 *
 * Measured 2026-09-22: **878.7 MiB summed, 616.7 MiB unique, 47.3 MiB shared.**
 * So sharing now exists — `g196` made the banner a constant fragment, which is
 * exactly source 1 below and why it is no longer "the most fundamental" — and
 * it still cannot reduce what Pages counts.
 *
 * The four addressing sources remain correct and remain worth fixing. They are
 * a REPOSITORY-growth remedy, and this threshold is not about that.
 *
 * ## Where the published bytes actually are
 *
 * Of 676 HTML pages in one preview, `reference/` is 257 of them and 35.8 MiB
 * — **38 % of the pages, 66 % of the HTML**, at 143 KiB per page against
 * 26 KiB for TypeDoc's. The inflation is just-the-docs inlining the whole
 * navigation into every page, so the directory with the most pages and the
 * least content each is the one that costs.
 *
 * `tebu` acted on that rather than on dedup: a preview omits `reference/` and
 * `api/` unless its branch touches their sources. Measured on a real preview,
 * **88.3 → 39.2 MiB, 55.6 %** — larger than the 43.2 MiB the directories alone
 * predicted, because the nav shrinks on every remaining page too (mean page
 * size 83 → 68 KiB). A projection could name that effect and not compute it,
 * which is why the bean demanded a measurement.
 *
 * The floor argument above is unchanged and still governs: a preview whose
 * branch is live must not be removed, so pruning cannot be the action. What
 * changed is that draining is now automatic, so the floor falls on its own
 * as work merges instead of being carried forever.
 *
 * Owner, 2026-09-20: *"set stagfing to 500mb. drain if branches merged"*.
 *
 * **Superseded 2026-10-04.** The owner replaced the #1868 count cap with a size
 * budget — *"Cap by size, not count"*, *"3gb"* — which `staging-rotate.ts`
 * ENFORCES on every deploy. This check now reports against that same number,
 * imported rather than restated: two budgets for one quantity would put a
 * permanent finding (500 MB) beside a rotation that allows 3 GB, which is the
 * monotonic-verdict failure the 2026-09-20 note above describes. Over it now
 * means the rotation did not hold, which is news.
 */
export const STAGING_WARN_BYTES = MAX_PREVIEW_BYTES;


/**
 * How recently a branch must have been committed to for its preview to count
 * as still in use. **Minutes, not days — the shortness is the whole point.**
 *
 * See {@link ORPHAN_THRESHOLDS} for the measurement it was calibrated on: a
 * longer horizon spares every just-merged preview and leaves the check with
 * nothing to say, which is the failure mode opposite to the one bean `w2g5`
 * reports and no better.
 */
export const RECENT_COMMIT_MINUTES = 30;

/** See {@link repositorySizeCheck} for the basis of each of these. */
export const TRACKED_WARN_BYTES = 250 * MB;
export const TRACKED_MAJOR_BYTES = 1024 * MB;
export const GIT_DIR_RATIO = 8;
export const GIT_DIR_FLOOR_BYTES = 100 * MB;

/** See {@link beanStoreCheck}. */
export const BEAN_STALE_DAYS = 14;
/**
 * Hours of silence after which an in-progress claim is **quiet**.
 *
 * A DIFFERENT question from {@link BEAN_STALE_DAYS}, not a tighter version of
 * it. Fourteen days asks whether a claim has been ABANDONED. This asks whether
 * anybody is on it RIGHT NOW — which is what a session about to pick up an
 * item needs to know, and what 14 days cannot answer.
 *
 * Bean `fgnw`, measured 2026-09-20: 60 beans `in-progress`, **43 with no change
 * in a four-hour window**, and 38 of those last touched by one bulk move at
 * 09:37. Eight sessions were active, so at most 17 claims corresponded to a
 * session working them — and `status` cannot tell a reviewer which 17.
 */
export const BEAN_QUIET_HOURS = 72;
export const BEAN_RESOLVED_INLINE_LIMIT = 100;
export const BEAN_OPEN_LIMIT = 150;

/** See {@link todoStoreCheck}. */
export const TODO_OPEN_LIMIT = 25;
export const TODO_STALE_DAYS = 90;

// ── The checks ──────────────────────────────────────────────────

const STAGING_SIZE_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "staging-total-bytes",
    value: STAGING_WARN_BYTES,
    unit: "bytes",
    severity: "major",
    basis:
      "The owner's size budget for previews, 2026-10-04 (\"Cap by size, not count\", \"3gb\"), " +
      "which replaced the #1868 count cap of ten and which `staging-rotate.ts` enforces on every " +
      "deploy; this threshold IS that constant (`MAX_PREVIEW_BYTES`), imported, so the check and " +
      "the rotation cannot disagree. Previews had grown from ~88 MiB (2026-09-22) to 200-780 MB, " +
      "so ten of them was 3-5 GB and any one lasted an hour or two. Being over it means the " +
      "rotation did not hold. HISTORY, kept because the reasoning still applies: " +
      "the owner's explicit instruction, 2026-09-20 (\"set stagfing to 500mb. drain if branches " +
      "merged\"), RAISED from the 100 MB they set on 2026-09-19 — and the raise went with a policy " +
      "change that made the old number mean something different. Until `folio-assistant-1feu`, " +
      "previews were retained on close AND on merge, so the total was monotonic: any threshold was " +
      "breached eventually and stayed breached, and \"over\" carried no information after the first " +
      "time. Now a merged pull request's preview is removed automatically, so the store DRAINS and " +
      "what remains is bounded by concurrent reviews rather than by cumulative history. " +
      "RE-MEASURED 2026-09-22 (bean `tebu`): a full preview is ~88 MiB, not the ~38 MB this " +
      "basis reasoned from, so 500 MB is about FIVE OR SIX concurrent reviews rather than the " +
      "thirteen once claimed — below concurrency this repository reaches routinely, which is why " +
      "an ordinary day trips it. The 500 MB value is the owner's and is left alone; what is " +
      "corrected here is the arithmetic under it, and whether the number still buys what they " +
      "wanted is theirs to say. " +
      "THE FLOOR IS STILL REAL AND STILL ABOVE PRUNING: a live branch's preview must not be " +
      "removed, so N concurrent reviews floor the total at N x ~88 MiB. What changed is that the " +
      "floor now falls on its own as work merges. The action this finding names is therefore " +
      "never \"prune more\" but preview SIZE. " +
      "TWO BUDGETS, AND THIS THRESHOLD IS ABOUT ONE OF THEM. The 1 GB Pages ceiling governs the " +
      "PUBLISHED TREE, where each preview materialises its own copies and blob sharing is " +
      "irrelevant; git's deduplication governs REPOSITORY growth. This basis used to give a " +
      "dedup argument (\"27.5 MB of each preview shares ZERO blobs\") as the reason to act on a " +
      "published-size threshold, which cannot move it. Measured: 878.7 MiB summed against " +
      "616.7 MiB unique, only 47.3 MiB shared — so sharing now exists (bean `g196` made the " +
      "banner a constant fragment) and still cannot reduce what Pages counts. " +
      "WHERE THE BYTES ARE, measured rather than estimated: of 676 HTML pages, `reference/` is " +
      "257 of them and 35.8 MiB — 38% of the pages, 66% of the HTML, at 143 KiB per page against " +
      "26 KiB for TypeDoc's. The inflation is just-the-docs inlining the whole navigation into " +
      "every page. `tebu` acted on that: a preview omits `reference/` and `api/` unless its " +
      "branch touches their sources, measured at 88.3 -> 39.2 MiB (55.6%) on a real preview. " +
      "See STAGING_WARN_BYTES for the per-page addressing sources and bean `xxku` for the " +
      "flushable-container framing.",
  },
];

/**
 * How much of the publish branch the review previews occupy.
 *
 * **This is a growth curve for the first time.** Until #377, `docs-site.yml`
 * deleted every preview on every push to `main` (bean `plj1`), so the total
 * never accumulated — it was garbage-collected by accident, against
 * `feature-staging.yml`'s written retention policy, and nobody had decided
 * that. Fixing it is what makes a size check necessary: previews now persist
 * until somebody explicitly asks for one to go.
 */
export function stagingSizeCheck(ctx: HealthContext): HealthCheckResult {
  const id = "staging-preview-size";
  const summary =
    "How much of the publish branch the review previews occupy, against the owner's budget for " +
    "them. It MEASURES and makes no claim about publishing: whether the served site is accepted " +
    "by GitHub is `pages-publish-health`'s subject, and bean `qj9a` is why the two are apart.";
  if (ctx.staging.state === "unknown") {
    return unknownResult(id, summary, STAGING_SIZE_THRESHOLDS, ctx.staging.reason);
  }
  const ev = ctx.staging.value;
  const total = ev.previews.reduce((s, p) => s + p.bytes, 0);
  const measurements: HealthMeasurement[] = [
    { metric: "staging-total-bytes", value: total, unit: "bytes", command: ev.command },
    { metric: "staging-preview-count", value: ev.previews.length, unit: "count", command: ev.command },
  ];
  const findings: HealthFinding[] = [];

  // ONE THRESHOLD, since bean `qj9a` split this check. There used to be a
  // second at 750 MB whose whole justification was a publish consequence —
  // "the next deploy is the one that fails to publish" — and nothing in this
  // repository can observe GitHub's enforcement. That argument, and the
  // documented-ceiling number it rested on, moved to `pages-publish-health`,
  // which owns the serving question. A threshold belongs with its argument.
  //
  // What remains is the owner's own number, and it is a BUDGET rather than a
  // cliff: 3 GB since 2026-10-04 (500 MB from 2026-09-20), the same constant
  // the rotation enforces. Being over it is worth telling a person about
  // whatever GitHub does.
  if (total > STAGING_WARN_BYTES) {
    findings.push({
      metric: "staging-total-bytes",
      severity: "major",
      // DERIVED, not written out. This said "over the 100 MB warning point"
      // with the number as a literal, so raising STAGING_WARN_BYTES to 500 MB
      // left the finding reporting a threshold that no longer existed — the
      // constant and the sentence describing it are one fact, and the summary
      // is the copy a reader sees first.
      summary:
        `${ev.previews.length} staging preview(s) total ${formatBytes(total)}, ` +
        `over the ${formatBytes(STAGING_WARN_BYTES)} budget the deploy rotation enforces.`,
      action:
        "The rotation in `feature-staging.yml`'s stage job should have held this, so first read its " +
        "last run's `staging-rotate` output: a single preview larger than the budget is kept on its " +
        "own (and says so in a warning), anything else is the rotation failing. Then report the list " +
        "below to the owner and ask which are finished with. Removal is by adding " +
        "`staging:cleanup` to that PR WHILE IT IS STILL OPEN, or a `feature-staging.yml` dispatch once " +
        "it has closed (bean `7umv`) — never by this sweep, and never on an agent's own initiative.",
    });
  }
  return settle(id, summary, STAGING_SIZE_THRESHOLDS, measurements, findings);
}

/**
 * Each declared special branch against its declared size budget.
 *
 * Owner, 2026-10-04: *"also update healthchecks for limits on the other specal
 * branches (e.g. lean cache 4gb, auto-docs 1gb, beans 100mb, todos 100mb)"*,
 * and qa-reports at 500 MB. The budgets live in `branch-budgets.json`, a
 * file this check owns (owner, 2026-10-05: special-branches.json is gone;
 * choice 3 of 3), and every threshold below is built from them, basis and
 * all. The preview budget on `gh-pages` is not here: it
 * is `staging-preview-size`'s, and the deploy rotation enforces it.
 *
 * A family is measured as the owner scoped it: `lake-cache` in TOTAL, because
 * a full clone fetches every cache branch; `auto-docs` PER BRANCH.
 */
export function specialBranchSizeCheck(ctx: HealthContext): HealthCheckResult {
  const id = "special-branch-size";
  const summary =
    "Each special data branch (beans, todos, qa-reports, the Lean cache family, auto-docs) against the " +
    "size budget its row in `branch-budgets.json` states. Measures tip trees; removes nothing.";
  if (ctx.specialBranches.state === "unknown") {
    return unknownResult(id, summary, [], ctx.specialBranches.reason);
  }
  const ev = ctx.specialBranches.value;
  const metric = (r: SpecialBranchMeasure) => `special-branch-bytes:${r.id}`;
  const thresholds: HealthThreshold[] = ev.rows
    .filter((r) => r.budget !== undefined)
    .map((r) => ({
      metric: metric(r),
      value: r.budget!.bytes,
      unit: "bytes",
      severity: "major",
      basis: `${r.budget!.scope === "family" ? `Every branch under \`${r.name}\` together` : `\`${r.name}\`${r.shape === "family" ? ", each branch" : ""}`}: ${r.budget!.stated}. ${r.budget!.basis}`,
    }));
  const measurements: HealthMeasurement[] = [];
  const findings: HealthFinding[] = [];
  for (const r of ev.rows) {
    if (r.state !== "measured" || r.budget === undefined) continue;
    const total = r.branches.reduce((n, b) => n + b.bytes, 0);
    measurements.push({ metric: metric(r), value: total, unit: "bytes", command: ev.command });
    const over =
      r.budget.scope === "family"
        ? total > r.budget.bytes
          ? [{ what: `${r.branches.length} branch(es) under \`${r.resolved ?? r.name}\``, bytes: total }]
          : []
        : r.branches.filter((b) => b.bytes > r.budget!.bytes).map((b) => ({ what: `\`${b.ref}\``, bytes: b.bytes }));
    for (const o of over) {
      findings.push({
        metric: metric(r),
        severity: "major",
        summary: `${o.what} ${o.bytes === total && r.budget.scope === "family" ? "total" : "is"} ${formatBytes(o.bytes)}, over the ${formatBytes(r.budget.bytes)} budget (${r.budget.stated}) for \`${r.id}\`.`,
        action:
          "Report it to the owner with what the branch holds and its largest paths, and ask what to prune or " +
          "whether the budget should change. Nothing here removes anything; the budget is the owner's.",
      });
    }
  }
  const counted = (state: SpecialBranchMeasure["state"]) => ev.rows.filter((r) => r.state === state);
  measurements.push(
    { metric: "special-branches-measured", value: counted("measured").length, unit: "count", command: ev.command },
    // Said, not dropped: a branch the declaration gives no budget is NOT within one.
    { metric: "special-branches-unbudgeted", value: counted("unbudgeted").length, unit: "count", command: `present without a budget: ${counted("unbudgeted").map((r) => r.id).join(", ") || "none"}` },
    { metric: "special-branches-absent", value: counted("absent").length, unit: "count", command: `not on the remote: ${counted("absent").map((r) => r.id).join(", ") || "none"}` },
  );
  return settle(id, summary, thresholds, measurements, findings);
}

/**
 * The signals that say somebody is still using a preview.
 *
 * **A disjunction, never a conjunction.** Any one of these sparing the preview
 * is the design: they are cheap, independent proxies for one question the
 * check cannot ask directly — *is anybody still using this?* — and a proxy
 * that is sometimes silent must not be able to convict on its own.
 */
export const LIVENESS_SIGNALS = ["open-pr", "unmerged-branch", "recent-commit"] as const;
export type LivenessSignal = (typeof LIVENESS_SIGNALS)[number];

/** What the signals said about one preview. */
export interface PreviewLiveness {
  slug: string;
  /** Every signal that fired. **Empty means orphan** — but only when `undetermined` is unset. */
  live: LivenessSignal[];
  /**
   * Set when a signal could not be evaluated AND nothing else said live.
   *
   * A preview in this state is neither live nor an orphan: it is **not
   * known**, and the check reports it as such. It is never folded into the
   * orphan list.
   */
  undetermined?: string;
  /** One line of the evidence behind the verdict, for a finding a person can act on. */
  evidence: string;
}

/**
 * Is this preview still in use?
 *
 * Pure, and exported on its own rather than buried in the check, because
 * **the same question is asked again at deletion time** —
 * `scripts/staging-cleanup-preflight.ts` calls this function, so the mechanism
 * that removes a preview and the sweep that proposes removing one cannot
 * disagree about what "live" means. Two implementations of one judgement is
 * two answers free to diverge, and the one that diverges here deletes
 * somebody's work.
 *
 * The three signals, and what each covers that the others do not:
 *
 * - **`open-pr`** — a pull request is open on the branch. The original test,
 *   and still the strongest, because it is a statement about a person's
 *   intent rather than about a commit graph.
 * - **`unmerged-branch`** — a branch on the remote slugifies to this preview
 *   and its tip is NOT an ancestor of the default branch, so it carries work
 *   that is not in `main`. This is what makes the preview worth looking at.
 * - **`recent-commit`** — that branch's tip is newer than
 *   {@link RECENT_COMMIT_MINUTES}. It covers exactly one window, and it is the
 *   window bean `w2g5` was written from: between one PR merging and the same
 *   session's next push, a merge commit has put the branch back INSIDE the
 *   default branch, so `unmerged-branch` goes quiet and `open-pr` has already
 *   gone quiet. Measured on `claude/brave-hypatia-r820sf`, that window was
 *   5m42s wide and the sweep landed in the middle of it.
 *
 * **An unevaluable signal cannot change a verdict that is already live.**
 * Liveness is a disjunction, so one true disjunct settles it; asking for
 * certainty about the others would turn a decided "leave it alone" into an
 * `unknown` for no gain.
 */
export function previewLiveness(
  slug: string,
  openPrHeads: readonly string[],
  branches: BranchEvidenceSet,
  now: Date,
): PreviewLiveness {
  const fired = new Set<LivenessSignal>();
  const notes: string[] = [];
  const blind: string[] = [];

  if (openPrHeads.some((ref) => stagingSlug(ref) === slug)) {
    fired.add("open-pr");
    notes.push("an open pull request has it as its head");
  } else {
    notes.push("no open pull request");
  }

  // Forward only: every branch is slugified and compared, and no slug is ever
  // turned back into a branch name. `stagingSlug` says why — the inverse is
  // ambiguous, and an ambiguous inverse on a finding whose action is "consider
  // removing this" would name the wrong thing.
  const candidates = branches.candidates.filter((b) => stagingSlug(b.ref) === slug);
  if (candidates.length === 0) {
    notes.push("and no branch on the remote slugifies to it");
  }
  for (const b of candidates) {
    const age = minutesSince(now, b.headCommittedAt);
    if (b.mergedIntoDefault === false) fired.add("unmerged-branch");
    if (age !== undefined && age <= RECENT_COMMIT_MINUTES) fired.add("recent-commit");
    const merged =
      b.mergedIntoDefault === undefined
        ? `ancestry against \`${branches.defaultBranch}\` unknown`
        : b.mergedIntoDefault
          ? `already in \`${branches.defaultBranch}\``
          : `NOT in \`${branches.defaultBranch}\``;
    notes.push(`\`${b.ref}\` is ${merged}, tip ${age === undefined ? "date unknown" : `${formatAge(age)} old`}`);
    if (b.mergedIntoDefault === undefined || b.headCommittedAt === undefined) {
      blind.push(`\`${b.ref}\`: ${b.unevaluated ?? "the probe returned neither an ancestry nor a tip date for it"}`);
    }
  }

  const live = LIVENESS_SIGNALS.filter((sig) => fired.has(sig));
  const evidence = notes.join("; ");
  if (live.length > 0) return { slug, live, evidence };
  if (blind.length > 0) return { slug, live: [], undetermined: blind.join("; "), evidence };
  return { slug, live: [], evidence };
}

/**
 * The one number this check compares against, and it needed a basis.
 *
 * The orphan verdict itself is a reference that resolves to nothing rather
 * than a quantity, so it still has no threshold — "more than zero orphans"
 * would be a number pretending to be a judgement. The recency horizon is a
 * real quantity, and {@link HealthThreshold} requires its basis structurally.
 */
export const ORPHAN_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "preview-branch-idle-minutes",
    value: RECENT_COMMIT_MINUTES,
    unit: "minutes",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated on this repository, 2026-09-19, and deliberately SHORT. The signal " +
      "exists for one window only — between a session's pull request merging and its next push to the same " +
      "branch, during which the merge commit has made the branch an ancestor of the default branch again so " +
      "the unmerged-work signal goes quiet. Measured: `claude/brave-hypatia-r820sf` had PR #396 merged at " +
      "10:37:21Z and its next commit at 10:43:03Z, a gap of 5m42s; 30 minutes is roughly five times that. " +
      "It CANNOT be much longer: measured at 11:19Z the same day, the four previews whose branches were " +
      "fully merged had tips 42, 56, 59 and 80 minutes old, so a horizon past ~40 minutes would have spared " +
      "every genuine orphan and left this check with nothing to say — the opposite failure to bean `w2g5` " +
      "and no better. The error it can still make is naming a preview whose session returns after a longer " +
      "pause; that costs one line in a report somebody reads, which is why " +
      "`scripts/staging-cleanup-preflight.ts` re-runs these signals at REMOVAL time rather than trusting a " +
      "verdict that may be a day old.",
  },
];

/**
 * A preview no liveness signal claims.
 *
 * `minor`, and the severity is the argument. A retained preview is
 * `feature-staging.yml`'s **policy working as written**: it removes one on PR
 * close only with a `staging:cleanup` label, and otherwise posts "Staging
 * preview retained … so reviewers can continue comparing". So this is not a
 * defect report. It is the list somebody needs in order to make the decision
 * the policy reserves for them, and it is the only place the size curve above
 * can actually be bent.
 *
 * ## Why "no open pull request" is not the question — bean `w2g5`
 *
 * It was, until 2026-09-19, and on that day it named
 * `branches/claude-brave-hypatia-r820sf` an orphan while the branch carried an
 * unmerged commit **two minutes old**, on a branch a sibling session had used
 * for five successive pull requests, each merged and closed before the next
 * opened. "No open PR" is true of such a branch for the entire gap between
 * them, and a session that reuses one branch spends much of its life in that
 * gap. The finding invited a person to remove a live collaborator's review
 * artefact — the one false positive this check must never produce, guarded
 * against for the 403 case and not for this one, because "no open PR" had
 * been read as a synonym for "abandoned".
 *
 * So the test is {@link previewLiveness}: three independent signals, any one
 * of which spares the preview.
 *
 * ## One preview that cannot be judged takes the whole check to `unknown`
 *
 * Not to a finding, and not quietly dropped. `probes.ts` keeps the same rule
 * one layer down — *"one unreadable preview makes the TOTAL unknown, not
 * smaller"* — and `healthVerdict` keeps it one layer up, where `unknown`
 * outranks `findings` so that a blind check cannot hide behind a sighted one.
 * The reason is the same at all three levels: a partial answer compared
 * against a threshold is a wrong answer wearing a right one's clothes. The
 * `reason` still NAMES the previews that were determined to be orphans, so
 * nothing measured is lost — it is simply not offered as a list to act on
 * while a signal is unreadable.
 */
export function stagingOrphanCheck(ctx: HealthContext): HealthCheckResult {
  const id = "staging-preview-orphans";
  const summary =
    "A `STAGING/` preview that no liveness signal claims — no open pull request, no branch carrying " +
    "unmerged work, no recent commit. Retained by policy, not by mistake: this is the list a person " +
    "needs in order to decide, never a list to act on unasked.";
  if (ctx.staging.state === "unknown") return unknownResult(id, summary, ORPHAN_THRESHOLDS, ctx.staging.reason);
  // NO PREVIEWS, NO ORPHANS — determined without the liveness signals. Every
  // signal below exists to keep a preview from being called orphaned; with no
  // preview there is nothing to keep, so a repository whose pull requests the
  // API will not list (a private one, unauthenticated) is not thereby unknown.
  if (ctx.staging.value.previews.length === 0) {
    return { id, state: "ok", summary, thresholds: ORPHAN_THRESHOLDS, measurements: [], findings: [], reason: `no previews on the publish branch (${ctx.staging.value.branch}), so none can be orphaned` };
  }
  if (ctx.openPrHeads.state === "unknown") {
    return unknownResult(
      id,
      summary,
      ORPHAN_THRESHOLDS,
      `the previews were read, but the open pull requests were not: ${ctx.openPrHeads.reason}. ` +
        "Without them every preview looks orphaned, which is the one false positive this check must never produce.",
    );
  }
  if (ctx.branches.state === "unknown") {
    return unknownResult(
      id,
      summary,
      ORPHAN_THRESHOLDS,
      `the previews and the open pull requests were read, but the remote branches were not: ${ctx.branches.reason}. ` +
        "Without them a branch carrying unmerged work cannot be told from an abandoned one, and the gap between " +
        "one pull request merging and the next opening reads as abandonment — the false positive bean `w2g5` " +
        "was written from.",
    );
  }
  const ev = ctx.staging.value;
  const branches = ctx.branches.value;
  // Read out here rather than inside the callback: TypeScript discards a
  // narrowing of `ctx.openPrHeads` across a closure boundary, and the cast
  // that would silence it is exactly how a three-state value gets treated as
  // a two-state one.
  const openHeads = ctx.openPrHeads.value;
  // `branches/_retired/` is the retired-record store (bean `6pfo`), and other
  // `_`/dot names are reserved: none is a preview, so none has a branch or a
  // pull request to claim it. Judging them would name the record store an
  // orphan every day (folio-assistant#860). The same rule `staging-rotate.ts`
  // uses, so rotation and this check agree on what a preview is. Their bytes
  // still count in `staging-preview-size`: Pages publishes them.
  const judged = ev.previews.filter((preview) => isPreviewName(preview.slug)).map((preview) => ({
    preview,
    liveness: previewLiveness(preview.slug, openHeads, branches, ctx.now),
  }));
  const blind = judged.filter((j) => j.liveness.undetermined !== undefined);
  const orphans = judged.filter((j) => j.liveness.undetermined === undefined && j.liveness.live.length === 0);

  if (blind.length > 0) {
    const determined =
      orphans.length > 0
        ? `Determined but NOT reported this run: ${orphans.map((j) => `\`${PREVIEW_PREFIX}/${j.preview.slug}\``).join(", ")} — ` +
          "named here so the measurement is not lost, but nothing should be acted on while a signal is unreadable."
        : "No other preview was determined to be an orphan this run.";
    return unknownResult(
      id,
      summary,
      ORPHAN_THRESHOLDS,
      `${blind.length} preview(s) could not be judged: ` +
        `${blind.map((j) => `\`${PREVIEW_PREFIX}/${j.preview.slug}\` — ${j.liveness.undetermined}`).join("; ")}. ` +
        "A signal that cannot be evaluated sends that preview to `unknown`, never to the orphan list. " +
        determined,
    );
  }

  const measurements: HealthMeasurement[] = [
    { metric: "staging-orphan-count", value: orphans.length, unit: "count", command: ev.command },
    {
      metric: "staging-orphan-bytes",
      value: orphans.reduce((s, j) => s + j.preview.bytes, 0),
      unit: "bytes",
      command: ev.command,
    },
    {
      metric: "staging-live-count",
      value: judged.length - orphans.length,
      unit: "count",
      command: `${ev.command} + ${branches.command}`,
    },
  ];
  // Named, not counted: a reader acts on a slug, never on a number. And the
  // evidence travels with the name, so the reader can see WHICH signals were
  // silent rather than being asked to trust the verdict.
  const findings: HealthFinding[] = orphans.map((j) => ({
    severity: "minor" as const,
    summary:
      `\`${PREVIEW_PREFIX}/${j.preview.slug}\` (${formatBytes(j.preview.bytes)}, ${j.preview.files} files) — ` +
      `${j.liveness.evidence}.`,
    // THE LABEL CANNOT REACH AN ORPHAN, so it is not offered here — bean
    // `7umv`. `feature-staging.yml` says why, in its own words: `cleanup`
    // fires on `pull_request_target: closed` and reads the labels from THAT
    // event's payload, and "being findable as an orphan REQUIRES the pull
    // request to be closed already — so the event has fired, the job has run,
    // and the label was absent. Labelling afterwards fires nothing" (bean
    // `w2g5`). The condition that puts a preview in THIS list is the same
    // condition that has already spent its one chance to read a label.
    //
    // This action used to name the label FIRST and the dispatch as an
    // alternative. Measured cost, 2026-09-23: the owner read it, applied
    // `staging:cleanup` to both orphaned slugs, and nothing happened —
    // 201.2 MB still on the publish branch. An action whose first option
    // cannot work for the finding it is attached to is the `o5qj` shape, and
    // this one spends somebody else's effort rather than just failing to
    // clear.
    action:
      `Ask the owner whether the review of \`${j.preview.slug}\` is finished. Nothing here removes it. ` +
      "Removal is a `feature-staging.yml` `workflow_dispatch` with " +
      `\`cleanup_slug: ${j.preview.slug}\` and \`cleanup_confirm: ${j.preview.slug}\`, ` +
      "which re-runs these same liveness signals and refuses if any of them has come back. " +
      "THE `staging:cleanup` LABEL DOES NOT WORK HERE: `cleanup` reads labels from the " +
      "`pull_request_target: closed` payload, and a preview is only findable as an orphan once that " +
      "event has already fired — so labelling now fires nothing (bean `w2g5`). Leaving it is a " +
      "valid answer.",
  }));
  return settle(id, summary, ORPHAN_THRESHOLDS, measurements, findings);
}

const REPO_SIZE_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "tracked-tree-bytes",
    value: TRACKED_WARN_BYTES,
    unit: "bytes",
    severity: "minor",
    basis:
      "A quarter of the 1 GB that GitHub's own documentation recommends a repository stay under " +
      "(\"ideally less than 1 GB\"). Chosen as an early-warning point that leaves time to act before " +
      "the documented recommendation, NOT as a limit in itself.",
  },
  {
    metric: "tracked-tree-bytes",
    value: TRACKED_MAJOR_BYTES,
    unit: "bytes",
    severity: "major",
    basis: "GitHub's documented recommendation that a repository remain under 1 GB.",
  },
  {
    metric: "git-dir-to-tree-ratio",
    value: GIT_DIR_RATIO,
    unit: "ratio",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD EXISTS for this ratio and this number is calibrated on this repository, " +
      "which measured 12.0x on 2026-09-19 (`.git` 349 MB against 29 MB of blobs at HEAD). It is " +
      "worth measuring because `ci-health.yml` documents `fetch-depth: 0` as load-bearing here, so " +
      "every CI job and every agent container downloads the PACK, not the tree — at 8x, seven " +
      "eighths of that download is content no longer present anywhere in the checkout.",
  },
  {
    metric: "git-dir-bytes",
    value: GIT_DIR_FLOOR_BYTES,
    unit: "bytes",
    severity: "minor",
    basis:
      "A floor on the ratio above, not a limit of its own: a 2 MB clone with a 0.16 MB tree is " +
      "12x and means nothing. Both must be exceeded before the ratio is reported.",
  },
];

/**
 * How big the repository is, measured two ways that answer different questions.
 *
 * **`tracked-tree-bytes` is the content** — the sum of blob sizes at `HEAD`. It
 * is independent of how recently anyone ran `git gc`, so it is the number to
 * compare against an external recommendation.
 *
 * **`git-dir-bytes` is what a clone costs**, and it is partly a measurement of
 * THIS clone's housekeeping: 42 packs and 857 prune-packable objects were
 * measured here on 2026-09-19, and a `git gc` moves the number without a single
 * byte of history changing. The finding says so, because a check that reported
 * "your repository is large" when the answer is "run `git gc`" would send the
 * reader after the wrong thing.
 */
export function repositorySizeCheck(ctx: HealthContext): HealthCheckResult {
  const id = "repository-size";
  const summary =
    "The repository's tracked content, and what a full-history clone of it costs. " +
    "Two different questions, reported separately.";
  if (ctx.repoSize.state === "unknown") return unknownResult(id, summary, REPO_SIZE_THRESHOLDS, ctx.repoSize.reason);
  const ev = ctx.repoSize.value;
  const ratio = ev.trackedBytes > 0 ? ev.gitDirBytes / ev.trackedBytes : 0;
  const measurements: HealthMeasurement[] = [
    {
      metric: "tracked-tree-bytes",
      value: ev.trackedBytes,
      unit: "bytes",
      command: "git ls-tree -r -l HEAD (blob sizes summed)",
    },
    { metric: "git-dir-bytes", value: ev.gitDirBytes, unit: "bytes", command: "du -sb .git" },
    { metric: "pack-bytes", value: ev.packBytes, unit: "bytes", command: "git count-objects -v" },
    { metric: "pack-count", value: ev.packs, unit: "count", command: "git count-objects -v" },
    {
      metric: "git-dir-to-tree-ratio",
      value: Number(ratio.toFixed(2)),
      unit: "ratio",
      command: "git-dir-bytes / tracked-tree-bytes",
    },
  ];
  const findings: HealthFinding[] = [];
  if (ev.trackedBytes > TRACKED_MAJOR_BYTES) {
    findings.push({
      metric: "tracked-tree-bytes",
      severity: "major",
      summary: `Tracked content at HEAD is ${formatBytes(ev.trackedBytes)}, past GitHub's recommended 1 GB.`,
      action:
        "Find the largest tracked blobs (`git ls-tree -r -l HEAD | sort -k4 -rn | head`) and decide, WITH the " +
        "owner, whether any belong in release assets or an LFS store instead. Nothing is removed by this sweep.",
    });
  } else if (ev.trackedBytes > TRACKED_WARN_BYTES) {
    findings.push({
      metric: "tracked-tree-bytes",
      severity: "minor",
      summary: `Tracked content at HEAD is ${formatBytes(ev.trackedBytes)}, past the 250 MB early-warning point.`,
      action:
        "Note it and re-measure next sweep. No action is due until it approaches 1 GB; this exists so the " +
        "approach is visible rather than sudden.",
    });
  }
  if (ratio > GIT_DIR_RATIO && ev.gitDirBytes >= GIT_DIR_FLOOR_BYTES) {
    findings.push({
      metric: "git-dir-to-tree-ratio",
      severity: "minor",
      summary:
        `\`.git\` is ${formatBytes(ev.gitDirBytes)} against ${formatBytes(ev.trackedBytes)} of tracked ` +
        `content — ${ratio.toFixed(1)}x, in ${ev.packs} pack(s).`,
      action:
        "Run `git gc` in this clone FIRST and re-measure: a high pack count is local housekeeping, not " +
        "repository history, and moves the number without anything changing upstream. If the ratio survives a " +
        "gc, the history carries large objects no longer in the tree, and what to do about that is the owner's " +
        "call — a history rewrite is not something a sweep proposes on its own.",
    });
  }
  return settle(id, summary, REPO_SIZE_THRESHOLDS, measurements, findings);
}

/** Bean statuses that mean the item is still live. */
const OPEN_BEAN_STATUSES = new Set(["todo", "in-progress", "in_progress", "blocked"]);
/** Bean statuses that mean it is finished with — and so archivable, never deletable. */
const RESOLVED_BEAN_STATUSES = new Set(["completed", "done", "scrapped"]);

const BEAN_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "bean-duplicate-title-groups",
    value: 0,
    unit: "count",
    severity: "major",
    basis:
      "Zero, and the zero is the point. `beans create` is not idempotent and dedupes on nothing " +
      "(AGENTS.md); an unguarded re-run in the `qou` folio on 2026-08-04 produced 14,688 duplicates — " +
      "92% of every open bean — which starved the idle-backlog policy of signal and collided with 15 " +
      "real ids. Any duplicate at all is the leading edge of that, so there is no tolerance band.",
  },
  {
    metric: "bean-thin-decision-records",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "MADR's own refusal, adopted whole 2026-09-20: \"never fewer than two considered options — one " +
      "option is not a choice; a straw option is worse than a short list\" " +
      "(`cat-harness/methodologies/madr.md`). Zero rather than a tolerance band because the rule has no " +
      "tolerant form: a record listing one option has not compared anything, and the methodology says " +
      "what to write instead — why no alternative existed, which is a finding about the constraint " +
      "rather than a decision. MINOR, not major, because this maps analytical debt rather than corpus " +
      "integrity; a thin record misleads a future reader, it does not break a consumer. Measured " +
      "2026-09-20: 2 decision records in the store, 0 of them thin — so this locks in a property the " +
      "store already has rather than demanding work. " +
      "THE COUNTER READ ONE MARKDOWN FORM UNTIL BEAN `vq8g`, and was wrong in BOTH DIRECTIONS. " +
      "Re-measured 2026-09-23 across the 12 records the store had grown to: `j6t3` and `xgd8` " +
      "enumerate their options as bold paragraphs (`**A. …**`) and counted ZERO, while carrying FIVE " +
      "options each against the typical three — so the two most developed analyses in the corpus were " +
      "the two reported empty, against an action that says to DROP THE SECTION. `dhvf` enumerates four " +
      "options as `### A —` subheadings over Pro/Con/Cost bullets and counted TEN. MADR is the " +
      "authority and it is FORMAT-AGNOSTIC — \"at least two, every one real\", never a markdown list — " +
      "so the detector changed rather than the beans: three forms are recognised and the most " +
      "structured one present wins, never summed (summing `dhvf` gives 14 for 4). After the fix: " +
      "dhvf 10 -> 4, j6t3 0 -> 5, xgd8 0 -> 5, the other nine unchanged at 3, and 0 records thin.",
  },
  {
    metric: "bean-self-declared-done",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated here, and zero because the condition has no tolerant form. " +
      "`bean-coordination` makes `in-progress` a CLAIM a sibling is expected to honour, so a bean whose " +
      "every Done-when box is ticked while its front matter still says claimed is two answers to one " +
      "question — and the one a sibling reads first is the wrong one. Measured 2026-09-21 and the cost " +
      "is not hypothetical: `tyyc` was picked up as fresh work and turned out to have landed, gate " +
      "registered in CI and passing, costing a session's opening to re-derive. MINOR because the " +
      "remedy is a person re-deriving and closing, not a broken consumer. Of 96 claimed beans that day, " +
      "4 met this and 6 had met a cruder body-wide version — the difference is `z4mq` and the reason " +
      "`doneWhenState` has an `unreadable` state. " +
      "ONLY A CLOSABLE BEAN IS COUNTED (bean `v9ah`). Measured 2026-09-25: every bean this named was " +
      "inside the 72 h mid-flight window, which `bean-coordination` puts off limits, and `5a3l` had 16 " +
      "open children of 26, so its own ticked boxes could not close it at any age. Both are now " +
      "counted separately, as `bean-self-declared-done-mid-flight` and " +
      "`bean-self-declared-done-open-children`, and never silently dropped. THE EPIC CASE IS RULED IN " +
      "THE CHECK: a parent with an open child is not self-declared done, because its children are the " +
      "work.",
  },
  {
    metric: "bean-stale-in-progress",
    value: BEAN_STALE_DAYS,
    unit: "days",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated here. A claimed bean is a claim a sibling session is expected " +
      "to respect, and `work-plan/skills/work-plan/bean-blocking.md` says a block with no expiry cannot be told " +
      "from abandoned work. Sessions are container-scoped and reclaimed, so a claim that has outlived " +
      "two weeks of containers is not one anybody is honouring. Measured 2026-09-19: 29 in-progress, " +
      "0 of them older than 14 days.",
  },
  {
    metric: "bean-quiet-claims",
    value: BEAN_QUIET_HOURS,
    unit: "hours",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated here, and the number is the weaker half of the rule. What " +
      "actually settles whether a claim is live is a LIVENESS SIGNAL — an open PR naming the bean, an " +
      "unmerged branch touching it, a note since. `work-plan/skills/work-plan/bean-coordination.md` " +
      "§\"A claim is branch-local\" is why: a claim becomes visible to a sibling when the PR opens, so " +
      "a claim with no PR and no branch has announced nothing to anybody. **This check computes only " +
      "the offline half** — time since `updated_at` — so its count is an UPPER BOUND on quiet claims " +
      "and must be read as one: a bean here may have an open PR this sweep cannot see. " +
      "**THE UPPER BOUND IS NOW CLOSABLE** — `scripts/check-quiet-claim-liveness.ts` (bean `omki`) " +
      "supplies the network half, and this check stays offline on purpose: `bun run cat health` must not " +
      "need a token or a reachable API to say anything. Measured 2026-09-25 on this store, 55 quiet " +
      "claims resolved to 10 live and 45 genuinely quiet — so the over-count is real and is about " +
      "a fifth of the number. Read the two together; neither replaces the other. " +
      "72 hours because a claim is meant to become visible at the FIRST commit " +
      "(`continual-progress` invariant 1), sessions are container-scoped and reclaimed, and three days " +
      "spans a weekend without firing on one. It is deliberately far below the 14-day abandonment " +
      "threshold and answers a different question, so both are reported. " +
      "ONE PART OF THE OFFLINE HALF WAS ALSO WRONG, and bean `thux` fixed it: a bean worked through " +
      "its CHILDREN is quiet on its own file by design, because nothing touches the parent while they " +
      "move — so it accrued hours for doing exactly what it is for, and the finding named no action a " +
      "person could take, since refreshing it means editing a file for no reason (`o5qj` one check " +
      "over). A claim with a child whose own file moved inside this window is therefore excused, and " +
      "counted under `bean-quiet-claims-parenting-live-work` rather than dropped. Measured 2026-09-23 " +
      "on the real store: 39 quiet claims became 31, with 8 excused. It is keyed on PARENTHOOD rather " +
      "than on `type: epic` — the relation carries the argument, and `type` is a label a bean sets " +
      "about itself while `parent` is a fact another bean asserts about it. A parent ALL of whose " +
      "children are also quiet still fires, which is the discrimination: `bzyu` had 8 open children " +
      "and none moving. The UPPER BOUND sentence above still stands for the network half, which this " +
      "check still cannot see; a sweep of all 298 unmerged branches and 20 open pull requests the same " +
      "day found 7 more of the 39 live that way, and none of that is computable from the store.",
  },
  {
    metric: "bean-session-log-roots",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "Zero, because the condition has no tolerant form: a session is a LOG, and a roadmap root is a claim " +
      "about where to look for a SUBJECT (`todo-manager` §\"A session is a log, not a parent\"). Measured in " +
      "the `qou` folio 2026-10-04: 292 of 353 `type: epic` beans were session logs, minted because " +
      "`todo-manager` Core Directive 1 and `session-intent` step 4b told every session to run " +
      "`beans create \"Session: …\" --type milestone` (bean `8unf`, issue #2106). Measured on this store the " +
      "same day: 0 open, so this locks in a property the store has. MINOR because a mis-typed log misleads " +
      "the roadmap rather than breaking a consumer. OPEN beans only — a completed session epic is history, " +
      "and back-filling it changes no plan, the same scope `check-bean-parents` takes.",
  },
  {
    metric: "bean-resolved-inline",
    value: BEAN_RESOLVED_INLINE_LIMIT,
    unit: "count",
    severity: "minor",
    basis:
      "AGENTS.md already calls this repo's flat `beans list` \"100+ ids in creation order … data, not a " +
      "plan\". The `beans` CLI ships `beans archive` for exactly this, and archiving MOVES rather than " +
      "deletes, so it is the one tidy-up here that is not a deletion. Measured 2026-09-19: 182 resolved " +
      "beans still inline.",
  },
  {
    metric: "bean-open",
    value: BEAN_OPEN_LIMIT,
    unit: "count",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated against 81 open beans measured 2026-09-19. Roughly double that " +
      "is a backlog that has grown faster than it drains, which is a fact about the plan rather than " +
      "about any one bean.",
  },
];

/**
 * The state of the work plan as a store, rather than of any item in it.
 *
 * Four findings, and none of their actions is "delete". `beans archive` MOVES
 * resolved items; a bean that turned out not to be wanted is `scrapped`, which
 * records that it was considered and rejected. AGENTS.md: *"never delete ANY
 * bean, including your own"*.
 */
/**
 * The four populations `bean-store` computes over `in-progress` beans, as a
 * pure function of the evidence and a clock.
 *
 * **Extracted so a second consumer cannot disagree with the check.**
 * `bean-quiet-claims`' own `basis` calls its count an UPPER BOUND, because it
 * has only the offline half of the question — time since `updated_at`. The
 * network half (an open pull request naming the bean, an unmerged branch
 * touching its file) is supplied by `scripts/check-quiet-claim-liveness.ts`,
 * which needs exactly this list as its input. Re-deriving "which claims are
 * quiet" there would give two definitions of quiet free to drift, and the one
 * a reader met first would be the one with no threshold `basis` behind it.
 *
 * The comments inside came with the code and are load-bearing: `thux`'s
 * parenthood rule, and why `quietButParenting` is reported rather than
 * silently subtracted.
 */
export function claimPopulations(
  beans: BeanEvidence[],
  now: Date,
): {
  claimed: BeanEvidence[];
  stale: { bean: BeanEvidence; age: number }[];
  quiet: { bean: BeanEvidence; hours: number }[];
  quietButParenting: BeanEvidence[];
} {
    const claimed = beans.filter((b) => b.status === "in-progress" || b.status === "in_progress");
    const stale = claimed
      .map((b) => ({ bean: b, age: daysBetween(now, b.updatedAt) }))
      .filter((x): x is { bean: BeanEvidence; age: number } => x.age !== undefined && x.age > BEAN_STALE_DAYS);
    // Quiet, not abandoned — see BEAN_QUIET_HOURS. The already-stale ones are
    // excluded so one bean does not produce two findings saying the same thing
    // at two timescales; the 14-day finding is the stronger claim and wins.
    //
    // AN EPIC IS ALIVE THROUGH ITS CHILDREN — bean `thux`, measured 2026-09-23.
    //
    // This check reads one signal, `updated_at` on the bean's own file, and for
    // a task that is the right signal. For an EPIC it is the wrong one: an epic
    // is worked by its children, and nothing touches the parent's file while
    // they move. So an epic accrued quiet hours for doing exactly what an epic
    // does, and the finding had no action a person could take — refreshing it
    // means editing a file for no reason, which is `o5qj`'s shape one check
    // over.
    //
    // Measured on the real store the day this landed: of 39 quiet claims, FIVE
    // were epics with children carrying a live signal — `1xhc` with 8 of them
    // while reported quiet for 100 hours, `ahvw` with 8, `1swy` and `0lmb` with
    // 2 each, `8jt6` with 1. `bzyu` was the one epic genuinely quiet (8 open
    // children, none live) and it still reports, which is the discrimination
    // this exists for.
    //
    // A CHILD IS "MOVING" BY THE SAME CLOCK, and deliberately so. The network
    // signals — an open pull request naming the bean, an unmerged branch
    // touching it — are the ones this check has never had and still does not:
    // `bean-quiet-claims`' own basis calls its count an UPPER BOUND for exactly
    // that reason, and that sentence stays true. What is removed here is only
    // the part answerable from the store itself.
    //
    // KEYED ON PARENTHOOD, NOT ON `type: epic`. The relation is what carries the
    // argument — a bean worked through its children is quiet for a reason,
    // whatever it calls itself — and `type` is a label a bean sets about itself
    // while `parent` is a fact another bean asserts about it. Keying on the
    // label would also have to decide what `feature` means, which this check has
    // no business ruling on. Measured consequence: the network sweep that
    // motivated this found FIVE epics with live children, and this store-local
    // rule excuses EIGHT claimed beans. The two numbers answer different
    // questions and neither corrects the other — network liveness of a child
    // against a child's file having moved.
    const movedRecently = (b: BeanEvidence): boolean => {
      const h = hoursBetween(now, b.updatedAt);
      return h !== undefined && h <= BEAN_QUIET_HOURS;
    };
    const liveChildren = new Set(
      beans.filter((b) => b.parent !== undefined && movedRecently(b)).map((b) => b.parent!),
    );
    const quiet = claimed
      .map((b) => ({ bean: b, hours: hoursBetween(now, b.updatedAt) }))
      .filter(
        (x): x is { bean: BeanEvidence; hours: number } =>
          x.hours !== undefined &&
          x.hours > BEAN_QUIET_HOURS &&
          !stale.some((s) => s.bean.id === x.bean.id) &&
          !liveChildren.has(x.bean.id),
      );
    // REPORTED, NEVER SILENTLY SUBTRACTED. Without this, "no claim went quiet"
    // and "the quiet ones were all parents of moving work" read identically —
    // `dh4f`, and the same argument `bean-duplicate-title-groups-adjudicated`
    // makes above. It counts CLAIMED beans only, so it is a subset of the
    // denominator the finding already prints.
    const quietButParenting = claimed.filter(
      (b) =>
        liveChildren.has(b.id) &&
        !stale.some((s) => s.bean.id === b.id) &&
        (hoursBetween(now, b.updatedAt) ?? 0) > BEAN_QUIET_HOURS,
    );
  return { claimed, stale, quiet, quietButParenting };
}

/**
 * Bean types that are ROOTS of the roadmap — what `beans roadmap` draws as a
 * heading. The same pair `check-bean-parents`' `ROOT_TYPES` names.
 */
const ROADMAP_ROOT_TYPES = new Set(["epic", "milestone"]);

/**
 * A title that says the bean records ONE SITTING rather than a subject:
 * `Session: …`, `Session 3 — …`, `SESSION …`, `Handoff: …`, `Handover …`.
 * Anchored at the start, because "session" mid-title is usually a subject
 * ("session-start sweep", "sibling sessions") and is not a log.
 */
export const SESSION_LOG_TITLE = /^\s*(session|hand-?off|hand-?over)\b/i;

/**
 * Open beans typed `epic`/`milestone` whose title marks them as a session or
 * handover log — bean `8unf`. Pure, so a second consumer (a restructure plan
 * generator) cannot disagree with the health finding about what one is.
 */
export function sessionLogRootBeans(beans: BeanEvidence[]): BeanEvidence[] {
  return beans.filter(
    (b) =>
      OPEN_BEAN_STATUSES.has(b.status) &&
      b.type !== undefined &&
      ROADMAP_ROOT_TYPES.has(b.type) &&
      SESSION_LOG_TITLE.test(b.title),
  );
}

export function beanStoreCheck(ctx: HealthContext): HealthCheckResult {
  const id = "bean-store";
  const summary =
    "The work-plan store itself: duplicates, claims nobody is honouring, resolved items still inline, " +
    "the size of the open backlog, decision records that list fewer than two real options, and session " +
    "logs typed as roadmap roots.";
  if (ctx.beans.state === "absent") return absentResult(id, summary, BEAN_THRESHOLDS, ctx.beans.reason);
  if (ctx.beans.state === "unknown") return unknownResult(id, summary, BEAN_THRESHOLDS, ctx.beans.reason);
  const beans = ctx.beans.value;

  const byTitle = new Map<string, BeanEvidence[]>();
  for (const b of beans) {
    const key = b.title.trim().toLowerCase();
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(b);
    else byTitle.set(key, [b]);
  }
  // A DUPLICATE IS A GROUP WITH MORE THAN ONE **LIVE** MEMBER — bean `o5qj`.
  //
  // This used to keep any bucket with two members in it, whatever their status,
  // which made the finding UNCLEARABLE BY ITS OWN ACTION. That action says to
  // set the loser to `scrapped` and never to delete it; a scrapped bean was
  // still a member, so the group survived the remedy. Measured: `qa1p` was
  // scrapped at 2026-09-22T08:58:46Z naming `2yyh` as the survivor, and the
  // 2026-09-23T06:58:47Z sweep — 22 hours later — reported the pair unchanged.
  // The only state that WOULD have cleared it is `beans delete`, which the
  // action forbids and `deletion-requires-confirmation` forbids again, so the
  // check asked for a state it treated as unchanged and rejected the one state
  // that satisfied it. `major` with no tolerance band, on #860, which closes
  // only when every check is clean — so one unclearable finding pins that issue
  // open and every other finding on it goes stale with it (`1xhc`).
  //
  // `scrapped` ADJUDICATES; `completed` DOES NOT. What the threshold's basis is
  // about is accidental duplicates polluting the plan — the `qou` re-run that
  // made 14,688 of them. A bean scrapped with a note naming its survivor is a
  // duplicate somebody RULED ON, and is the record the skill asks for. An open
  // bean duplicating finished work is still a real duplicate, so a `completed`
  // member keeps counting.
  const live = (b: BeanEvidence): boolean => b.status !== "scrapped";
  const titleGroups = [...byTitle.values()].filter((g) => g.length > 1);
  const dupGroups = titleGroups.filter((g) => g.filter(live).length > 1);
  // REPORTED, NEVER SILENTLY DROPPED. Without this measurement "no duplicate
  // was ever created" and "every duplicate was adjudicated" read identically,
  // which is `dh4f` — and it is the same argument `bean-claimed` makes below
  // for a count nothing thresholds.
  const adjudicatedDupGroups = titleGroups.filter((g) => g.filter(live).length <= 1);
  const open = beans.filter((b) => OPEN_BEAN_STATUSES.has(b.status));
  const resolved = beans.filter((b) => RESOLVED_BEAN_STATUSES.has(b.status));
  // `undefined` means NO options section, which is a bean recording work rather
  // than a decision — not a decision record with nothing in it. `!== undefined`
  // rather than a truthiness test, because 0 is a real and reportable count.
  const decisionRecords = beans.filter((b) => b.consideredOptions !== undefined);
  const thin = decisionRecords.filter((b) => (b.consideredOptions ?? 0) < 2);
  const rendered = beans.filter((b) => b.renderedDecision === true);
  const { claimed, stale, quiet, quietButParenting } = claimPopulations(beans, ctx.now);
  const sessionLogRoots = sessionLogRootBeans(beans);

  // A CLAIM THAT ITS OWN CRITERIA SAY IS FINISHED — bean `fkjo`.
  //
  // Read from the BODY's Done-when section, so the denominators below carry a
  // different `command` from the front-matter ones for the reason the options
  // measurements already do.
  //
  // The three populations are reported side by side deliberately. `absent` and
  // `unreadable` are the beans this cannot judge, and folding either into the
  // pass is the `dh4f` defect — a clean run reported over a corpus the tool
  // could not read. They are counted and left alone.
  const withDoneWhen = claimed.filter((b) => b.doneWhen !== undefined);
  const criteriaAbsent = withDoneWhen.filter((b) => b.doneWhen!.kind === "absent");
  const criteriaUnreadable = withDoneWhen.filter((b) => b.doneWhen!.kind === "unreadable");
  const allTicked = withDoneWhen.filter((b) => b.doneWhen!.kind === "all-ticked");
  // ONLY THE CLOSABLE ONES ARE FINDINGS — bean `v9ah`, `o5qj`'s shape on a
  // second axis. `bean-coordination` closes a bean on EVIDENCE, and puts a
  // MID-FLIGHT one off limits; measured 2026-09-25, every bean this finding
  // named was inside the 72 h window, so every finding named something no
  // session was allowed to act on. The finding cannot say that, so it is
  // split, the way `thux` split quiet claims:
  //
  // - touched inside BEAN_QUIET_HOURS: somebody's live work. Its ticks are
  //   news, not a task. The same clock as `bean-quiet-claims`, on purpose,
  //   because two definitions of "recent" would drift apart.
  // - a parent with OPEN children (`5a3l`: 16 of 26): its boxes are the epic's
  //   own criteria while its children are the work, so it does not close at
  //   ANY age. Keyed on the parent relation, not `type: epic`, for the reason
  //   `claimPopulations` gives.
  //
  // Both are REPORTED as measurements, never silently subtracted: "nothing is
  // self-declared done" and "they were all mid-flight" must not read the same
  // (`dh4f`).
  const openChildren = new Set(
    beans.filter((b) => b.parent !== undefined && OPEN_BEAN_STATUSES.has(b.status)).map((b) => b.parent!),
  );
  const recent = (b: BeanEvidence): boolean => {
    const h = hoursBetween(ctx.now, b.updatedAt);
    return h !== undefined && h <= BEAN_QUIET_HOURS;
  };
  const doneButParenting = allTicked.filter((b) => openChildren.has(b.id));
  const doneButMidFlight = allTicked.filter((b) => !openChildren.has(b.id) && recent(b));
  const selfDeclaredDone = allTicked.filter((b) => !openChildren.has(b.id) && !recent(b));

  const cmd = "beans/defs/*.md front matter";
  const bodyCmd = "beans/defs/*.md — list items under the first `## Options` / `## Considered options` heading";
  const doneWhenCmd = "beans/defs/*.md — task-list items under every `## Done when` heading";
  const measurements: HealthMeasurement[] = [
    { metric: "bean-total", value: beans.length, unit: "count", command: cmd },
    { metric: "bean-open", value: open.length, unit: "count", command: cmd },
    { metric: "bean-resolved-inline", value: resolved.length, unit: "count", command: cmd },
    { metric: "bean-duplicate-title-groups", value: dupGroups.length, unit: "count", command: cmd },
    {
      metric: "bean-duplicate-title-groups-adjudicated",
      value: adjudicatedDupGroups.length,
      unit: "count",
      command: cmd,
    },
    { metric: "bean-stale-in-progress", value: stale.length, unit: "count", command: cmd },
    { metric: "bean-session-log-roots", value: sessionLogRoots.length, unit: "count", command: cmd },
    // The DENOMINATOR, reported so the next number is legible. "12 quiet" means
    // nothing without it; "12 of 60 claimed" is a finding a person can act on,
    // and `fgnw` is the bean that measured why — 43 of 60 read very differently
    // from 43.
    { metric: "bean-claimed", value: claimed.length, unit: "count", command: cmd },
    { metric: "bean-quiet-claims", value: quiet.length, unit: "count", command: cmd },
    {
      metric: "bean-quiet-claims-parenting-live-work",
      value: quietButParenting.length,
      unit: "count",
      command: cmd,
    },
    // REPORTED EVEN THOUGH NOTHING THRESHOLDS IT, and that is the point. The
    // finding below can only fire on a bean this count includes, so a detector
    // that stops matching — a heading respelled, the regex narrowed — shows up
    // here as 0 subjects instead of as a green tick over an empty walk. A check
    // with no subjects is not a check that passed.
    // A DIFFERENT provenance from the four above, and it has to say so: those
    // read front matter, these read the BODY's options section. A measurement
    // that misreports where it came from sends whoever re-derives it to the
    // wrong place, which is the whole reason `command` is on the record.
    { metric: "bean-decision-records", value: decisionRecords.length, unit: "count", command: bodyCmd },
    {
      metric: "bean-rendered-decision-records",
      value: rendered.length,
      unit: "count",
      command: "beans/defs/*.md — the five-row table `renderDecision` emits",
    },
    { metric: "bean-thin-decision-records", value: thin.length, unit: "count", command: bodyCmd },
    // THE THREE POPULATIONS `fkjo` NEEDS KEPT APART, and the two that are not
    // findings are reported for the same reason `bean-decision-records` is: the
    // finding can only fire on a bean `bean-claimed-with-criteria` includes, so
    // a heading respelled or a regex narrowed shows up here as a denominator
    // that fell rather than as a green tick over a walk that matched nothing.
    {
      metric: "bean-claimed-with-criteria",
      value: withDoneWhen.length,
      unit: "count",
      command: doneWhenCmd,
    },
    {
      metric: "bean-claimed-criteria-absent",
      value: criteriaAbsent.length,
      unit: "count",
      command: doneWhenCmd,
    },
    {
      metric: "bean-claimed-criteria-unreadable",
      value: criteriaUnreadable.length,
      unit: "count",
      command: doneWhenCmd,
    },
    { metric: "bean-self-declared-done", value: selfDeclaredDone.length, unit: "count", command: doneWhenCmd },
    {
      metric: "bean-self-declared-done-mid-flight",
      value: doneButMidFlight.length,
      unit: "count",
      command: `${doneWhenCmd}, touched within ${BEAN_QUIET_HOURS} h`,
    },
    {
      metric: "bean-self-declared-done-open-children",
      value: doneButParenting.length,
      unit: "count",
      command: `${doneWhenCmd}, with an open child`,
    },
  ];
  const findings: HealthFinding[] = [];
  for (const g of dupGroups) {
    // THE LIVE ONES, because those are what the action touches. Listing a
    // scrapped sibling here would send a reader to adjudicate a bean somebody
    // already adjudicated; its existence is said separately, so the group's
    // history is not lost either.
    const alive = g.filter(live);
    const settled = g.length - alive.length;
    findings.push({
      metric: "bean-duplicate-title-groups",
      severity: "major",
      summary:
        `${alive.length} beans share the title "${g[0].title}": ` +
        `${alive.map((b) => b.id).join(", ")}` +
        (settled > 0 ? ` (${settled} more already \`scrapped\`).` : "."),
      action:
        "Keep the earliest, and set each of the others to `scrapped` with a note naming the one that " +
        "survives. Never `beans delete` — a scrapped bean records a considered rejection, a deleted one " +
        "leaves a sibling unable to tell abandonment from accident.",
    });
  }
  for (const b of thin) {
    const n = b.consideredOptions ?? 0;
    findings.push({
      metric: "bean-thin-decision-records",
      severity: "minor",
      summary:
        `\`${b.id}\` records a decision and lists ${n === 0 ? "no options" : "one option"} ` +
        `("${b.title}").`,
      action:
        n === 0
          ? "Either list the options that were weighed, or drop the section — an empty options section " +
            "claims an analysis that did not happen, which is worse than not claiming one."
          : "Add the alternatives that were actually considered, with why each lost. If there genuinely " +
            "was only one, say WHY NO ALTERNATIVE EXISTED and make that the record: per `madr.md` that " +
            "is a finding about the constraint, not a decision. Never invent a straw option to reach " +
            "two — the methodology refuses that more firmly than it refuses a short list.",
    });
  }
  for (const b of selfDeclaredDone) {
    const n = b.doneWhen!.kind === "all-ticked" ? b.doneWhen!.total : 0;
    findings.push({
      metric: "bean-self-declared-done",
      severity: "minor",
      summary:
        `\`${b.id}\` is \`in-progress\` with all ${n} of its Done-when boxes ticked, untouched for over ` +
        `${BEAN_QUIET_HOURS} h and with no open child ("${b.title}").`,
      action:
        "It is past the mid-flight window, so you MAY act on it — but RE-DERIVE IT first, then close it " +
        "or record why not; never close it on the strength of its ticks. " +
        "The boxes are the bean's claim about itself: measured 2026-09-21, four of six such beans had " +
        "genuinely landed, `jijc` disagreed with its own gate (which prints an open judgement on it " +
        "while its last box says that work was migrated), and `z4mq` was not finished at all. If it has " +
        "landed, close it with the evidence you re-derived; if it has not, untick what is not done.",
    });
  }
  for (const s of stale) {
    findings.push({
      metric: "bean-stale-in-progress",
      severity: "minor",
      summary: `\`${s.bean.id}\` has been \`in-progress\` for ${s.age} days ("${s.bean.title}").`,
      action:
        "Ask whoever claimed it whether it is still live. If nobody answers, move it back to `todo` with a " +
        "note saying the claim expired — never CLOSE a sibling's bean on staleness (closing is governed by " +
        "evidence, `bean-coordination` §\"Closing a bean whose work has already landed\"), and never delete it.",
    });
  }
  for (const q of quiet) {
    findings.push({
      metric: "bean-quiet-claims",
      severity: "minor",
      summary:
        `\`${q.bean.id}\` has been \`in-progress\` with no change for ${q.hours} hours ` +
        `("${q.bean.title}") — ${quiet.length} of ${claimed.length} claims are quiet.`,
      action:
        "Check for a liveness signal this sweep cannot see: an open PR naming the bean, or an unmerged " +
        "branch touching it. If there is one, the claim is live and there is nothing to do. If there is " +
        "none, the claim has announced nothing to anybody and the item is fair game — take it, and say " +
        "in the bean that you did and what you found. NOBODY AND NOTHING re-statuses it automatically: " +
        "this check reports, and a person or the session taking the work acts. " +
        "See `work-plan/skills/work-plan/bean-coordination.md` §\"A quiet claim\".",
    });
  }
  for (const b of sessionLogRoots) {
    findings.push({
      metric: "bean-session-log-roots",
      severity: "minor",
      summary: `\`${b.id}\` is an open \`${b.type}\` whose title says it is a session log ("${b.title}").`,
      action:
        "A session is a LOG, not a roadmap root (`todo-manager` §\"A session is a log, not a parent\"). " +
        "Re-parent each open child to the epic whose SUBJECT it is, move the narrative into a bean note " +
        "(`bun run cat beans:note`) or the PR body, then set this bean to `completed` or `scrapped` with a note " +
        "naming where its children went. For many at once, use a reviewed `work-plan-restructure` plan. " +
        "This check reports and never acts; never `beans delete` it — commits and other beans cite its id.",
    });
  }
  if (resolved.length > BEAN_RESOLVED_INLINE_LIMIT) {
    findings.push({
      metric: "bean-resolved-inline",
      severity: "minor",
      summary: `${resolved.length} completed or scrapped beans are still inline in \`beans/defs/\`.`,
      action:
        "Run `beans archive`, which MOVES them to the archive rather than removing them — the one tidy-up " +
        "in this sweep that is not a deletion. Confirm with the owner first all the same: it rewrites the " +
        "store a sibling session may be reading.",
    });
  }
  if (open.length > BEAN_OPEN_LIMIT) {
    findings.push({
      metric: "bean-open",
      severity: "minor",
      summary: `${open.length} open beans (todo + in-progress), past the ${BEAN_OPEN_LIMIT} calibration point.`,
      action:
        "Read `beans roadmap` rather than `beans list` and check the backlog still has a shape. This is a " +
        "fact about the plan, not about any one item.",
    });
  }
  return settle(id, summary, BEAN_THRESHOLDS, measurements, findings);
}

const CLOSED_TODO_STATUSES = new Set(["done", "completed", "closed", "scrapped", "resolved"]);

const TODO_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "todo-open",
    value: TODO_OPEN_LIMIT,
    unit: "count",
    severity: "minor",
    basis:
      "NO EXTERNAL STANDARD; calibrated here. `todos/` holds a PERSON's outstanding items and the human-todos " +
      "page renders them as one list, so the limit is where a single list stops being readable at a glance. " +
      "Measured 2026-09-19: 3 open.",
  },
  {
    metric: "todo-stale-days",
    value: TODO_STALE_DAYS,
    unit: "days",
    severity: "minor",
    basis:
      "A quarter. A todo raised about content and untouched for three months is either already done or no " +
      "longer wanted; either way the status on the file is wrong, and a wrong status is worse than a long list.",
  },
];

/**
 * The human half of memory — `todos/`, as against the agent's `beans/`.
 *
 * Quiet on this repository today (3 open, 2026-09-19) and shipped anyway. **A
 * check that has never had anything to say is still the one that will notice**;
 * the alternative is adding it on the day it is already too late, which is the
 * whole of bean `xom7`.
 */
/**
 * How many instruments this repository has for OBSERVING its published site.
 *
 * Bean `qj9a` split this out of `staging-preview-size`, which had been carrying
 * a threshold whose entire justification was a publish consequence — *"the next
 * deploy is the one that fails to publish, so something is about to be lost"* —
 * over a question nothing here can answer. Rewording that basis fixed the
 * sentence; this check is what stops the sentence drifting back, because the
 * claim now has nowhere to live except a check that must first establish it can
 * see.
 *
 * ## Its subject is the INSTRUMENT, not the site — and that is forced
 *
 * The obvious design is a check whose subject is "is the published site
 * healthy", reporting `unknown` until something can look. **That would break the
 * whole health family**, and the mechanism is {@link healthVerdict}: one
 * `unknown` takes the ENTIRE report to `unknown`, which leaves the tracking
 * issue untouched and exits 2. `health-check.yml`'s own comment says what that
 * is worth — *"the whole verdict goes to `unknown` — correctly, and uselessly"*.
 * A permanently blind check would therefore make the daily sweep permanently
 * useless, and every other check's verdict unreadable behind it.
 *
 * So the subject is narrowed to something DETERMINABLE: does an instrument
 * exist? That is answerable today (it does not), so this reports a `finding`
 * with an action, and it never reports `unknown` about its own subject. The
 * reframing is not a dodge — it is the more useful question, because it
 * ratchets toward the probe instead of restating a gap.
 *
 * ## Measured 2026-09-26 — every route refused
 *
 * | route | result |
 * |---|---|
 * | `GET https://litlfred.github.io/folio-assistant/` | `connect_rejected`, egress policy |
 * | the same for a `branches/<slug>/` page | `connect_rejected` |
 * | `GET /repos/:o/:r/pages` | every field `null` |
 * | `GET /repos/:o/:r/pages/builds` | "not permitted through this proxy" |
 * | `actions/workflows/pages-build-deployment/runs` | `total_count` absent |
 *
 * **And a green deploy is not an observation.** `docs-site.yml` going green
 * proves the push to `gh-pages` succeeded; serving is GitHub's side of the
 * line. That distinction is the one `qj9a` got wrong before it measured, and it
 * is why "CI is green" cannot be counted as an instrument here.
 */
export const PAGES_INSTRUMENTS_REQUIRED = 1;

/**
 * How old an observation may be and still count as one.
 *
 * Bean `1dre`: *"a recorded observation is a measurement with a date … an
 * observation older than N is not an observation — same rule `check:ci-health`
 * applies to a red that has not re-run in a week."* So N is that week. The
 * writer runs daily in `health-check.yml`, so a week is six missed runs, not
 * one late one.
 */
export const PAGES_OBSERVATION_HORIZON_DAYS = 7;

export const PAGES_PUBLISH_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "pages-serving-instruments",
    value: PAGES_INSTRUMENTS_REQUIRED,
    unit: "count",
    severity: "major",
    basis:
      "ONE is the floor, not a calibration: a claim about the published site needs at least one way " +
      "to look at it. The instrument is the observation a CI job with egress publishes on " +
      "`qa-reports` (bean `1dre`, owner's option 1); a missing or out-of-date one reads as " +
      "`unknown`, never as zero and never as clean. `major` rather than `critical` because " +
      "GitHub's documented 1 GB Pages limit was exceeded continuously from 2026-09-23 (1.46 GB) to at " +
      "least 2026-09-26 (2.67 GB served) with every deploy succeeding, so if the ceiling is enforced at " +
      "all it is not enforced as a hard refusal on push. WHETHER IT IS ENFORCED REMAINS UNKNOWN until " +
      "the observations say so.",
  },
  {
    metric: "pages-serving-observation-age-days",
    value: PAGES_OBSERVATION_HORIZON_DAYS,
    unit: "days",
    severity: "major",
    basis:
      "past this an observation is not an observation (bean `1dre`, after `check:ci-health`'s week). " +
      "Reported as `unknown` with the observation's date, not as a finding: an old reading has not " +
      "established anything about the site today.",
  },
  {
    metric: "pages-serving-failing",
    value: 0,
    unit: "count",
    severity: "major",
    basis:
      "a published URL that did not serve its own page — a non-200 status, or Pages' own 404 document " +
      "— is a page a reader cannot open. `major`, not `critical`: nothing is lost by it, and every " +
      "remedy names a person (`deletion-requires-confirmation`).",
  },
];

export function pagesPublishHealthCheck(ctx: HealthContext): HealthCheckResult {
  const id = "pages-publish-health";
  const summary =
    "What the published site served, as the CI pages-serving observation recorded it — read offline " +
    "from `qa-reports`, so the sweep never reaches the network itself.";

  // Owner, 2026-10-11 (bean `1dre`, option 1): missing or old is `unknown`,
  // with its date. That supersedes this check's earlier "never unknown" rule,
  // which held only while there was no instrument to be blind about.
  if (ctx.pagesServing.state === "unknown") {
    return unknownResult(id, summary, PAGES_PUBLISH_THRESHOLDS, `no pages-serving observation could be read: ${ctx.pagesServing.reason}`);
  }
  const { key, observation } = ctx.pagesServing.value;
  const observed = new Date(observation.observedAt);
  const age = (ctx.now.getTime() - observed.getTime()) / 86_400_000;
  if (!(age <= PAGES_OBSERVATION_HORIZON_DAYS)) {
    return unknownResult(
      id,
      summary,
      PAGES_PUBLISH_THRESHOLDS,
      `the pages-serving observation in qa-reports:${key} is dated ${observation.observedAt}, ` +
        (Number.isNaN(age) ? "which is not a date" : `${Math.floor(age)} days old — past the ${PAGES_OBSERVATION_HORIZON_DAYS}-day horizon`) +
        ", so it says nothing about the site today",
    );
  }
  const failing = observation.urls.filter((u) => u.status !== 200 || !u.expectedPage);
  const cmd = `qa:fetch ${key} health/pages-serving.json`;
  const measurements: HealthMeasurement[] = [
    { metric: "pages-serving-instruments", value: 1, unit: "count", command: cmd },
    { metric: "pages-serving-observation-age-days", value: Math.floor(Math.max(0, age)), unit: "days", command: cmd },
    { metric: "pages-serving-urls", value: observation.urls.length, unit: "count", command: cmd },
    { metric: "pages-serving-failing", value: failing.length, unit: "count", command: cmd },
  ];
  const findings: HealthFinding[] = failing.map((u) => ({
    metric: "pages-serving-failing",
    severity: "major",
    summary: u.expectedPage
      ? `${u.url} answered HTTP ${u.status} on ${observation.observedAt}.`
      : `${u.url} served Pages' own 404 document (HTTP ${u.status}, ${u.bytes} bytes) on ${observation.observedAt}, not its page.`,
    action:
      "Open the URL and the publishing run" +
      (observation.run ? ` (${observation.run})` : "") +
      ", and decide whether the page should exist. Nothing here removes or republishes anything: " +
      "a person decides, and a removal goes through `deletion-requires-confirmation`.",
  }));
  return settle(id, summary, PAGES_PUBLISH_THRESHOLDS, measurements, findings);
}

export const REMOTE_MOUNT_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "remote-mounts-not-mounted",
    value: 0,
    unit: "count",
    severity: "major",
    basis:
      "a declared remote instance that is not its pinned bytes on disk is a layer the checkout's tools " +
      "and CI do not run as pinned (folio-assistant#2682 kept testing an old layer this way). `major`: " +
      "nothing is lost, and every remedy is a person's (owner, 2026-10-07, folio-assistant#2467 decision 3: " +
      "the check reports and never acts).",
  },
];

/** What a person does about one remote mount that is not mounted, by what the check said. */
export function remoteMountAction(detail: string): string {
  if (/modified|not the pinned bytes|left untouched|differ:|extra:/.test(detail)) {
    return "Move the edits upstream to the fork, or delete or rename the directory, then `bun run cat mount:remote` (`--fresh` discards them).";
  }
  if (/consent|approver|basis|trust/i.test(detail)) {
    return "Record a person's consent for this pin (`mount:remote --seed … --consent-by`), or drop the mount entry.";
  }
  if (/tracked/.test(detail)) return "The target holds tracked files: move the mount with `path`, or untrack them, then re-mount.";
  return "Run `bun run cat mount:remote` and read the instance's outcome; re-pin from a checkout mounted from the lock if the lock is behind.";
}

export function remoteMountHealthCheck(ctx: HealthContext): HealthCheckResult {
  const id = "remote-mounts";
  const summary = "Each declared remote mount: its pinned bytes on disk, or why not (no network; `mount:remote:check`).";
  const probe = ctx.remoteMounts ?? { state: "absent" as const, reason: "no remote-mount probe ran" };
  if (probe.state === "absent") return absentResult(id, summary, REMOTE_MOUNT_THRESHOLDS, probe.reason);
  if (probe.state === "unknown") return unknownResult(id, summary, REMOTE_MOUNT_THRESHOLDS, probe.reason);
  const { outcomes, command } = probe.value;
  const fine = new Set(["mounted", "unverified-approver", "local", "skipped"]);
  const bad = outcomes.filter((o) => !fine.has(o.state));
  const measurements: HealthMeasurement[] = [
    { metric: "remote-mounts-declared", value: outcomes.length, unit: "count", command },
    { metric: "remote-mounts-not-mounted", value: bad.length, unit: "count", command },
  ];
  const findings: HealthFinding[] = bad.map((o) => ({
    metric: "remote-mounts-not-mounted",
    severity: "major",
    summary: `${o.instance}: ${o.state}${o.detail ? ` — ${o.detail}` : ""}`,
    action: remoteMountAction(o.detail ?? ""),
  }));
  return settle(id, summary, REMOTE_MOUNT_THRESHOLDS, measurements, findings);
}

export const LSI_INDEX_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "lsi-graphs-lacking-fresh-index",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "a prose graph at or over the need-an-index threshold (100 units and 20,000 words, a house number with " +
      "its basis in `scripts/lsi.ts`) with no fresh index answers `lsi query`, `lsi:near` and keyword extraction " +
      "from a stale or missing index. `minor`: an index is a retrieval aid whose every output is a proposal " +
      "(method `lsi`), so a missing one loses nothing; it moved here from the LSI viewer page (cat-harness#1144).",
  },
];

export function lsiIndexHealthCheck(ctx: HealthContext): HealthCheckResult {
  const id = "lsi-indexes";
  const summary =
    "Each declared prose graph that needs a latent semantic index: whether its stored index is fresh, and what each stored index found.";
  const probe = ctx.lsiIndexes ?? { state: "absent" as const, reason: "no LSI probe ran" };
  if (probe.state === "absent") return absentResult(id, summary, LSI_INDEX_THRESHOLDS, probe.reason);
  if (probe.state === "unknown") return unknownResult(id, summary, LSI_INDEX_THRESHOLDS, probe.reason);
  const { graphs, indexes, from } = probe.value;
  const command = "bun run cat lsi audit";
  const failing = graphs.filter((g) => g.result === "fail");
  const measurements: HealthMeasurement[] = [
    { metric: "lsi-graphs-needing-index", value: graphs.filter((g) => g.result !== "n/a").length, unit: "count", command },
    { metric: "lsi-graphs-lacking-fresh-index", value: failing.length, unit: "count", command },
    ...indexes.flatMap((i) => [
      { metric: `lsi-narrow-dimensions:${i.graph}`, value: i.narrowDimensions, unit: "count", command: `read ${i.sidecar} (from ${from})` },
      { metric: `lsi-near-duplicate-pairs:${i.graph}`, value: i.nearDuplicates, unit: "count", command: `read ${i.sidecar} (from ${from})` },
    ]),
  ];
  const findings: HealthFinding[] = failing.map((g) => ({
    metric: "lsi-graphs-lacking-fresh-index",
    severity: "minor",
    summary: `${g.graph}: ${g.detail}`,
    action: `Run \`${g.command}\`; the index is a proposal aid, so nothing waits on it.`,
  }));
  return settle(id, summary, LSI_INDEX_THRESHOLDS, measurements, findings);
}

export const LIBRARY_KEYWORD_THRESHOLDS: HealthThreshold[] = [
  {
    metric: "library-keywords-entries-without",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "a library entry the keyword extraction gives nothing has no keywords on the library viewer, the keyword " +
      "viewer or in the derived keywords graph — usually a scanned page with no text layer, or sections under the " +
      "LSI tool's minimum length. `minor`: keywords are derived proposals; nothing waits on them (cat-harness#1144).",
  },
  {
    metric: "library-keywords-legacy-files",
    value: 0,
    unit: "count",
    severity: "minor",
    basis:
      "keywords are EXTRACTED content, so they are built at publish into the derived keywords graph and do not live " +
      "in the ingest record (owner, 2026-11-08, cat-harness#1144). A `keywords.json` still committed inside an entry " +
      "is the old location: nothing reads it once the move lands, and it goes stale on every ingest.",
  },
];

export function libraryKeywordsHealthCheck(ctx: HealthContext): HealthCheckResult {
  const id = "library-keywords";
  const summary = "Each library entry's LSI keywords: whether the extraction gives any, and any keywords.json still committed inside an entry.";
  const probe = ctx.libraryKeywords ?? { state: "absent" as const, reason: "no library-keywords probe ran" };
  if (probe.state === "absent") return absentResult(id, summary, LIBRARY_KEYWORD_THRESHOLDS, probe.reason);
  if (probe.state === "unknown") return unknownResult(id, summary, LIBRARY_KEYWORD_THRESHOLDS, probe.reason);
  const entries = probe.value;
  const command = "bun run cat library:keywords";
  const without = entries.filter((e) => e.keywords === 0);
  const legacy = entries.filter((e) => e.legacy);
  const list = (es: KeywordsState[]): string => es.slice(0, 5).map((e) => e.entry).join(", ") + (es.length > 5 ? ", …" : "");
  const measurements: HealthMeasurement[] = [
    { metric: "library-keywords-entries", value: entries.length, unit: "count", command },
    { metric: "library-keywords-entries-without", value: without.length, unit: "count", command },
    { metric: "library-keywords-legacy-files", value: legacy.length, unit: "count", command: "ls library/*/keywords.json" },
  ];
  const findings: HealthFinding[] = [];
  if (without.length)
    findings.push({
      metric: "library-keywords-entries-without",
      severity: "minor",
      summary: `${without.length} entr(ies) the keyword extraction gives nothing: ${list(without)}`,
      action: "Open the entry's sections: a page with no text layer needs OCR at ingest (`l1-document-ingestion`); a very short entry has nothing to extract.",
    });
  if (legacy.length)
    findings.push({
      metric: "library-keywords-legacy-files",
      severity: "minor",
      summary: `${legacy.length} keywords.json still committed inside an entry: ${list(legacy)}`,
      action: "Remove them in one PR per repository: keywords are built at publish now (`assets/keywords/`), and the ingest record keeps only what was ingested.",
    });
  return settle(id, summary, LIBRARY_KEYWORD_THRESHOLDS, measurements, findings);
}

export function todoStoreCheck(ctx: HealthContext): HealthCheckResult {
  const id = "todo-store";
  const summary = "The human todo store: how many items are open, and whether any have gone stale.";
  if (ctx.todos.state === "absent") return absentResult(id, summary, TODO_THRESHOLDS, ctx.todos.reason);
  if (ctx.todos.state === "unknown") return unknownResult(id, summary, TODO_THRESHOLDS, ctx.todos.reason);
  const todos = ctx.todos.value;
  const open = todos.filter((t) => !CLOSED_TODO_STATUSES.has(t.status));
  const stale = open
    .map((t) => ({ todo: t, age: daysBetween(ctx.now, t.createdAt) }))
    .filter((x): x is { todo: TodoEvidence; age: number } => x.age !== undefined && x.age > TODO_STALE_DAYS);

  const cmd = "todos/items/*.md front matter";
  const measurements: HealthMeasurement[] = [
    { metric: "todo-total", value: todos.length, unit: "count", command: cmd },
    { metric: "todo-open", value: open.length, unit: "count", command: cmd },
    { metric: "todo-stale-open", value: stale.length, unit: "count", command: cmd },
  ];
  const findings: HealthFinding[] = [];
  if (open.length > TODO_OPEN_LIMIT) {
    findings.push({
      metric: "todo-open",
      severity: "minor",
      summary: `${open.length} open todos, past the ${TODO_OPEN_LIMIT} calibration point.`,
      action: "Show the owner the list and ask which are still wanted. Nothing here is an agent's to close.",
    });
  }
  for (const s of stale) {
    findings.push({
      metric: "todo-stale-days",
      severity: "minor",
      summary: `\`${s.todo.id}\` has been open for ${s.age} days.`,
      action:
        "Ask the owner whether it is still wanted. A todo records a PERSON's outstanding work, so only they " +
        "can say it is finished — an agent may neither close nor remove one.",
    });
  }
  return settle(id, summary, TODO_THRESHOLDS, measurements, findings);
}

// ── The registry ────────────────────────────────────────────────

/**
 * One entry per check.
 *
 * **Adding a check is one entry here plus one fixture test.** The runner, the
 * report writer and the markdown renderer all read this array, so nothing else
 * needs touching — the same property `pipeline/readme-sections.ts` has
 * and for the same reason.
 *
 * Order is the order a reader should meet them: the owner's explicit ask
 * first, then what drives it, then the two stores.
 */
// ── Credentials (bean `folio-assistant-jzba`) ───────────────────────────

export const SECRETS_THRESHOLDS: HealthThreshold[] = [
  { metric: "secret-expiry-days", value: EXPIRY_WARN_DAYS, unit: "days", basis: EXPIRY_BASIS.warn, severity: "minor" },
  { metric: "secret-expiry-days", value: EXPIRY_URGENT_DAYS, unit: "days", basis: EXPIRY_BASIS.urgent, severity: "major" },
  { metric: "secret-expiry-days", value: 0, unit: "days", basis: "an expired credential no longer works: whatever needs it is already failing", severity: "critical" },
  {
    metric: "secret-needs-undetermined",
    value: 0,
    unit: "count",
    basis:
      "a repository whose credential needs are not declared cannot be told from one that needs nothing " +
      "(credentials proposal §6.2: could-not-determine outranks clean). Reported as a finding, not as " +
      "`unknown`, so one missing declaration does not take the whole report to `unknown` daily — the " +
      "precedent `pages-publish-health` sets. `bun run cat secrets:check` itself exits 2.",
    severity: "major",
  },
];

/**
 * Credential needs against workflow use and recorded expiry, by NAME only.
 *
 * Offline: `bun run health` needs no token, so presence on GitHub is NOT
 * judged here — `bun run cat secrets:check` lists names when a token allows.
 */
export function secretsHealthCheck(now: Date, evidence: readonly Omit<RepoEvidence, "present">[]): HealthCheckResult {
  const id = "credentials";
  const summary =
    "Declared credential needs against the secret names workflows use, and recorded expiry at 30 / 7 / 0 days. " +
    "Names only, never values; presence on GitHub is `secrets:check`'s, which needs a token.";
  const offline = { reason: "bun run health runs offline" };
  const r = judgeSecrets(evidence.map((e) => ({ ...e, present: offline })), now);
  const needsUnknown = r.undetermined.filter((u) => u.part === "declared-needs").map((u) => u.repo);
  const expiryUnknown = r.undetermined.filter((u) => u.part === "expiry").map((u) => u.repo);
  const measurements: HealthMeasurement[] = [
    { metric: "secret-names-used", value: r.usedCount, unit: "count", command: "bun run cat secrets:check --json (usedCount)" },
    { metric: "secret-needs-undetermined", value: needsUnknown.length, unit: "count", command: "bun run cat secrets:check --json (undetermined, part declared-needs)" },
  ];
  const findings: HealthFinding[] = [];
  if (needsUnknown.length > 0) {
    findings.push({
      metric: "secret-needs-undetermined",
      severity: "major",
      summary: `Declared needs: could not determine for ${needsUnknown.join(", ")} — no credentials/needs.json, so used-vs-declared is not judged.`,
      action: "Author `credentials/needs.json` per the credentials proposal §2.3 (bean 9hxd); until then this is not clean.",
    });
  }
  if (expiryUnknown.length > 0) {
    findings.push({
      metric: "secret-expiry-days",
      severity: "minor",
      summary: `Expiry: no credentials/registry.json records dates for ${expiryUnknown.join(", ")}, so no expiry can be warned of.`,
      action: "Record issue and expiry dates as credentials are added or rotated (credentials proposal §2.3, registry.json).",
    });
  }
  for (const f of r.findings) {
    if (f.severity === "advisory") continue;
    findings.push({
      metric: f.kind === "expired" || f.kind === "expires-soon" ? "secret-expiry-days" : undefined,
      severity: f.severity,
      summary: `${f.repo} · ${f.secret}: ${f.detail}`,
      action: f.kind === "expired" || f.kind === "expires-soon" ? "Rotate the credential and record the new dates." : "Reconcile the declaration with the workflows.",
    });
  }
  return settle(id, summary, SECRETS_THRESHOLDS, measurements, findings);
}

function credentialsCheck(ctx: HealthContext): HealthCheckResult {
  const repoFor = repoResolver();
  return secretsHealthCheck(ctx.now, defaultDirs(INDEX_ROOT).map((d) => readRepoFiles(d, repoFor(d))));
}

export const HEALTH_CHECKS: readonly {
  id: string;
  /** One line for `--list`. */
  summary: string;
  run: (ctx: HealthContext) => HealthCheckResult;
}[] = [
  {
    id: "staging-preview-size",
    summary:
      "Total size of the `STAGING/` review previews on the publish branch, against the owner's " +
      "budget. Measurement only — the serving question is `pages-publish-health`.",
    run: stagingSizeCheck,
  },
  {
    id: "special-branch-size",
    summary:
      "Each special data branch against the size budget its `branch-budgets.json` row states " +
      "(owner, 2026-10-04). Measures tip trees; removes nothing.",
    run: specialBranchSizeCheck,
  },
  {
    id: "pages-publish-health",
    summary:
      "What the published site served, read offline from the CI pages-serving observation on " +
      "`qa-reports` (bean `1dre`). Missing or older than a week is `unknown`, with its date.",
    run: pagesPublishHealthCheck,
  },
  {
    id: "remote-mounts",
    summary:
      "Each declared remote mount: its pinned bytes on disk, or why not, with what a person does " +
      "(folio-assistant#2467). Reads the lock and the disk; fetches nothing, changes nothing.",
    run: remoteMountHealthCheck,
  },
  {
    id: "lsi-indexes",
    summary:
      "Each declared prose graph that needs a latent semantic index, whether its stored index is fresh, " +
      "and each index's narrow-dimension and near-duplicate counts (cat-harness#1144). Builds nothing.",
    run: lsiIndexHealthCheck,
  },
  {
    id: "library-keywords",
    summary:
      "Each library entry's LSI keywords: entries the extraction gives nothing, and keywords.json files still " +
      "committed inside an entry now that keywords are built at publish (cat-harness#1144).",
    run: libraryKeywordsHealthCheck,
  },
  {
    id: "staging-preview-orphans",
    summary:
      "Previews no liveness signal claims — no open PR, no unmerged branch, no recent commit. " +
      "Retained by policy, listed for a person to decide.",
    run: stagingOrphanCheck,
  },
  {
    id: "credentials",
    summary:
      "Declared credential needs vs the secret names workflows use, and recorded expiry (bean `jzba`). " +
      "Names only; `secrets:check` adds presence when a token allows.",
    run: credentialsCheck,
  },
  {
    id: "repository-size",
    summary: "Tracked content at HEAD, and what a full-history clone costs.",
    run: repositorySizeCheck,
  },
  {
    id: "bean-store",
    summary:
      "Duplicate titles, unhonoured claims, resolved items still inline, the open backlog, and " +
      "decision records with fewer than two options.",
    run: beanStoreCheck,
  },
  {
    id: "todo-store",
    summary: "Open and stale items in the human todo store.",
    run: todoStoreCheck,
  },
];

/** Run every registered check against one context. */
export function runHealthChecks(ctx: HealthContext): HealthCheckResult[] {
  return HEALTH_CHECKS.map((c) => c.run(ctx));
}
