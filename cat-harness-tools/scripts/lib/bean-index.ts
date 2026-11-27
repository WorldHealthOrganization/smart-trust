/**
 * The bean board's data, `folio-bean-index/v1`, built for ANY checkout.
 *
 * ## Why this is its own module
 *
 * `gen-docs-pages.ts` built this projection inline, for the layer it runs in.
 * A folio (qou) keeps its own bean store and publishes its own site, and wants
 * the same board over it. Building the document a second time there would be
 * a second answer to "what does the work plan hold", free to disagree with the
 * platform's while both look right in review. So the projection moved here,
 * unchanged, and both callers use it: `gen-docs-pages.ts` for a platform
 * layer, `beans-board.ts` for any other checkout.
 *
 * What the caller still decides: whether there is a store at all (a `null`
 * from `readBeans` is "no store", never an empty one), and how a proposal path
 * becomes a link, because only the platform's own declarations know which
 * layer holds a proposal.
 *
 * @module scripts/lib/bean-index
 */
import { listInstances } from "../../src/workflow/store.js";
import { workPlanFindings, workPlanOf } from "../../schemas/sdlc/work-plan.js";
import { tileCounts } from "../../schemas/ui/tile-count.js";
import { beanFindings, blockEdges, blockedBy, blocksOf, type BeanNode } from "../beans.js";
import { branchKeptLocation } from "../branch-kept-href.js";
import { milestoneRollup } from "../milestone-rollup.js";
import { OPEN_BEANS_UNIT, openBeanCount } from "../bean-store-read.js";

/** The schema tag the board's client (`work-plan.js`) dispatches on. */
export const BEAN_INDEX_SCHEMA = "folio-bean-index/v1";

/**
 * How much of a bean's body the projection carries.
 *
 * Enough for a sticky's preview and no more. A reader who wants the argument
 * follows `editHref` to the file, which is the same affordance every other
 * node gets.
 *
 * **Measured at this length, 2026-09-20:** 239 beans project to 235 KB raw and
 * **62 KB gzipped** — 0.26 KB per bean against the todo index's 1.5 KB per
 * todo, so the per-item cost is already the lower of the two. The number is
 * recorded because the next person to change this constant should be changing
 * a measurement rather than a guess.
 */
export const BEAN_BODY_PREVIEW = 400;

export interface BeanIndexOptions {
  /** The checkout whose `beans/` was read; bean files are relative to it. */
  repoRoot: string;
  /** That checkout's forge address, `https://github.com/<owner>/<repo>`. */
  repoWeb: string;
  /** The branch a file not kept on a state branch is read from. Default `main`. */
  sourceBranch?: string;
  /**
   * A proposal path (checkout-relative) as a link. Default: the path on
   * `repoWeb`'s `sourceBranch`. The platform passes its declaration-aware
   * resolver, since a proposal there may live in another layer.
   */
  proposalHref?: (path: string) => string;
}

/** The document, plus the parts the platform's console line reports. */
export interface BeanIndex {
  document: Record<string, unknown>;
  /** The beans, with each `file` rewritten to its path on the branch that keeps it. */
  beans: BeanNode[];
  edges: ReturnType<typeof blockEdges>["edges"];
  dangling: ReturnType<typeof blockEdges>["dangling"];
}

/**
 * Build the bean index for the beans `readBeans(repoRoot)` returned.
 *
 * WHERE THE FILES ARE ON THE FORGE. A bean store kept on its own branch is
 * untracked on `main`, so `<repo>/blob/main/<file>` answers 404 for every bean.
 * Each `file` is rewritten to its path ON THE BRANCH that keeps it, and the
 * branch travels once as `fileRef` (with `fileWeb`, the repository that holds
 * it) — never re-derived in the client. See `branch-kept-href.ts`.
 */
export function beanIndexOf(beansRead: readonly BeanNode[], opts: BeanIndexOptions): BeanIndex {
  const { repoRoot, repoWeb } = opts;
  const sourceBranch = opts.sourceBranch ?? "main";
  const beanForge = beansRead[0] ? branchKeptLocation(repoRoot, beansRead[0].file, repoWeb) : undefined;
  const beans = beansRead.map((b) => {
    const at = branchKeptLocation(repoRoot, b.file, repoWeb);
    if (beanForge && (at.ref !== beanForge.ref || at.web !== beanForge.web)) {
      throw new Error(`bean ${b.id} is kept at ${at.web}@${at.ref}, the store at ${beanForge.web}@${beanForge.ref}: one store, one branch`);
    }
    return { ...b, file: at.path };
  });
  // ONE edge set over both declarations (bean `vhqq`): `blocking:` alone
  // published 7 of a store's 83 edges, because most beans declare the block
  // from the blocked end with `blocked_by:`.
  const { edges, dangling } = blockEdges(beans);
  const blockers = blockedBy(beans);
  const blocks = blocksOf(beans);
  // WORK PLANS (owner 2026-11-05: "Epic is the plan"): an epic or milestone
  // naming the process it runs, joined with the layer instances that name it.
  // A store that cannot be read gives `runs: null`, said rather than shown as
  // none.
  let instancesRead: ReturnType<typeof listInstances> | null;
  try {
    instancesRead = listInstances(repoRoot);
  } catch {
    instancesRead = null;
  }
  const runsOf = (id: string) =>
    instancesRead === null
      ? null
      : instancesRead
          .filter((i) => i.plan === id)
          .map((i) => ({ id: i.id, processId: i.processId, status: i.status, at: i.tokens, updatedAt: i.updatedAt }));
  const proposalHref = opts.proposalHref ?? ((path: string) => `${repoWeb}/blob/${sourceBranch}/${path}`);
  const planField = (id: string, tags: readonly string[] | undefined) => {
    const plan = workPlanOf(tags);
    if (plan === undefined) return {};
    return {
      plan: {
        ...plan,
        ...(plan.proposal !== undefined ? { proposalHref: proposalHref(plan.proposal) } : {}),
        runs: runsOf(id),
      },
    };
  };
  const items = beans.map((b) => ({
    id: b.id,
    title: b.title,
    status: b.status,
    type: b.type,
    priority: b.priority,
    parent: b.parent,
    // Present only on a work plan; absent is "not a plan", never "a plan with
    // nothing known".
    ...planField(b.id, b.tags),
    // Both directions, resolved once, from the one edge set.
    blocking: blocks.get(b.id) ?? [],
    blockedBy: blockers.get(b.id) ?? [],
    createdAt: b.createdAt,
    // Published as a FACT, with no age computed from it. See `beanFindings`.
    updatedAt: b.updatedAt,
    preview: b.body.trim().slice(0, BEAN_BODY_PREVIEW),
    // Repo-relative; the renderer derives both a view and an edit URL from it.
    file: b.file,
  }));
  const document = {
    $schema: BEAN_INDEX_SCHEMA,
    // OPEN beans, the same number `count.json` gives the icon row (bean `v215`).
    ...tileCounts({ beans: [openBeanCount(beans), OPEN_BEANS_UNIT] }),
    // The forge, so `work-plan.js` composes its links from DATA rather than
    // carrying one layer's address in shared client code.
    repoWeb,
    // The repository and branch every `file` below is a path on.
    fileWeb: beanForge?.web ?? repoWeb,
    fileRef: beanForge?.ref ?? sourceBranch,
    items,
    // `blocker → blocked`, with the key(s) that declared each. A dangling edge
    // stays here AND is a `blocking-unknown` finding: reported, never dropped.
    edges,
    findings: beanFindings(beans),
    planFindings: workPlanFindings(beans),
    // The milestone rollup, computed here so the board renders a number it
    // does not derive: one definition, shared with `milestone:status`.
    plan: milestoneRollup(beans),
  };
  return { document, beans, edges, dangling };
}
