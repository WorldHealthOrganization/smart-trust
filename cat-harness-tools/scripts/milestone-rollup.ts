/**
 * A milestone's progress, as the closure of the beans beneath it.
 *
 * @module scripts/milestone-rollup
 * @graphNode none — a pure function over the bean store
 * @covers none — it measures the work plan; the verdicts on it live in `check-bean-*`
 *
 * One definition for three consumers: the terminal report
 * (`milestone-status.ts`), the committed projection the board fetches
 * (`gen-docs-pages.ts` writes `milestones` into `assets/beans/index.json`),
 * and the board itself, which RENDERS the projection rather than recomputing
 * it.
 *
 * ## The closure is TRANSITIVE, not two levels
 *
 * `check-bean-parents` rule 3 admits a parent whose `type` is `epic` **or**
 * `milestone`, and an epic may be parented to another epic, so the depth is
 * whatever the store holds. Descent is transitive, with a visited guard,
 * because nothing forbids a cycle among epics.
 *
 * ## `unclassified` is a THIRD bucket, never folded into either
 *
 * `OPEN_STATUSES` and `CLOSED_STATUSES` do not partition every string a
 * `status` field can hold. A descendant in neither set is counted on its own
 * and left out of both, because folding it into `open` inflates the work
 * remaining and folding it into `closed` reports progress that was never made.
 * A zero here is the normal case; a non-zero one is a finding about the store.
 *
 * ## The percentage is REPORTED, not graded — and it is bean-weighted
 *
 * `share` is `closed / classified`, which weights every bean equally, so the
 * counts are the answer and the share is a convenience derived from them.
 * Nothing here sets an exit code on it.
 *
 * `orphanOpen` counts open beans under no milestone at all; if it is large,
 * the per-milestone shares do not describe the repository.
 *
 * ## `coveredOpen` is SUMMED, never subtracted
 *
 * `coveredOpen` is the sum of the bars, not `openTotal - orphanOpen`: counts
 * are taken over DISTINCT ids (a bean is its id), and two bean files can
 * share an id. `duplicateIds` reports such ids; which file keeps the id is
 * its owner's call, and nothing here changes or deletes a bean.
 */
import { z } from "zod";

import type { BeanNode } from "./beans.ts";
import { childrenOf } from "./check-bean-rollup.ts";
import { CLOSED_STATUSES, OPEN_STATUSES } from "./bean-store-read.ts";
import { MilestonePlanSchema, MilestoneRollupSchema } from "../schemas/sdlc/bean-graph.ts";

/** The type whose beans are the roots of this report. */
export const MILESTONE_TYPE = "milestone";

/**
 * One milestone and the state of everything beneath it.
 *
 * INFERRED from the Zod schema in `schemas/ui/site-indexes.ts`, which is where the
 * projection declares it. Writing the fields twice — once as an interface here
 * and once as a schema there — is two declarations of one shape, and the
 * `.strict()` object only refuses the extra key in one direction.
 */
export type MilestoneRollup = z.infer<typeof MilestoneRollupSchema>;

/** Every milestone's rollup, plus what the per-milestone shares leave out. */
export type MilestoneReport = z.infer<typeof MilestonePlanSchema>;

/**
 * The transitive descendants of `id`, excluding `id` itself.
 *
 * The visited set is shared with the caller so a bean reachable twice — which
 * takes a cycle, since a bean has one `parent` — is counted once.
 */
function descendants(
  id: string,
  kids: Map<string, BeanNode[]>,
  seen: Set<string>,
): BeanNode[] {
  const out: BeanNode[] = [];
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length > 0) {
    const b = stack.pop()!;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
    for (const k of kids.get(b.id) ?? []) stack.push(k);
  }
  return out;
}

/** Roll every `type: milestone` bean up over its closure. */
export function milestoneRollup(input: readonly BeanNode[]): MilestoneReport {
  // Counted over DISTINCT ids. A bean IS its id, and the store currently holds
  // one id twice — see the module note. First occurrence wins, which is
  // arbitrary and therefore reported rather than relied on.
  const byId = new Map<string, BeanNode>();
  for (const b of input) if (!byId.has(b.id)) byId.set(b.id, b);
  const duplicateIds = input.length - byId.size;
  const beans = [...byId.values()];

  const kids = childrenOf(beans);
  const roots = beans.filter((b) => b.type === MILESTONE_TYPE);

  // Ordered by TITLE, numerically ("GOAL 2" before "GOAL 10"), then by id —
  // not by share or count, since a report that reorders between runs looks
  // like it is reporting a change. It was by id alone, which is just as
  // stable but read as GOAL 5, 2, 4, 1, 3 on the board (owner, 2026-10-16:
  // "why are they listed out of order?"). The goals are named in order, so
  // their names are the order.
  const ordered = [...roots].sort(
    (a, b) => (a.title ?? "").localeCompare(b.title ?? "", "en", { numeric: true }) || a.id.localeCompare(b.id),
  );

  const underAMilestone = new Set<string>();
  const milestones: MilestoneRollup[] = [];

  for (const m of ordered) {
    const seen = new Set<string>([m.id]);
    const kin = descendants(m.id, kids, seen);
    for (const b of kin) underAMilestone.add(b.id);

    let closed = 0;
    let inProgress = 0;
    let todo = 0;
    let draft = 0;
    let unclassified = 0;
    for (const b of kin) {
      if (CLOSED_STATUSES.has(b.status)) closed++;
      else if (b.status === "in-progress") inProgress++;
      else if (b.status === "todo") todo++;
      else if (b.status === "draft") draft++;
      else unclassified++;
    }
    const open = inProgress + todo + draft;
    const classified = closed + open;
    milestones.push({
      id: m.id,
      title: m.title,
      file: m.file,
      status: m.status,
      epics: (kids.get(m.id) ?? []).filter((k) => k.type === "epic").length,
      total: kin.length,
      closed,
      open,
      inProgress,
      todo,
      draft,
      unclassified,
      share: classified === 0 ? null : closed / classified,
    });
  }

  let orphanOpen = 0;
  let openTotal = 0;
  let coveredOpen = 0;
  for (const b of beans) {
    if (!OPEN_STATUSES.has(b.status)) continue;
    openTotal++;
    if (underAMilestone.has(b.id)) coveredOpen++;
    else if (b.type !== MILESTONE_TYPE) orphanOpen++;
  }

  return { milestones, orphanOpen, openTotal, coveredOpen, duplicateIds };
}
