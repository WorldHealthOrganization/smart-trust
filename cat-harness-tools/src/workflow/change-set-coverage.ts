/**
 * The change-set path through the corpus gate.
 *
 * `editing-hci-validation` is the process for ONE edit to ONE block. A folio
 * that works in change sets (a review-log row, a CS-NNN record, one PR that
 * touches many blocks) goes through `content-change-review` instead: make,
 * stage, committee, merge. Both are approved routes into the corpus. Before
 * this module the gate knew only the first, so every change-set PR failed it,
 * and change sets were merged with the gate red.
 *
 * ## What counts as cover
 *
 * A changed block is covered when a `content-change-review` instance:
 *
 * 1. is **in this diff** — its `beans/workflows/<id>.json` is one of the
 *    changed files. This ties the record to the PR that makes the change, so
 *    an old change set cannot authorise a later edit of the same block;
 * 2. is **still running** — a completed instance is a change set that has
 *    already been published;
 * 3. **names the block** in `scope.blocks`;
 * 4. has **finished its make phase** (`Call_MakeChange`): the scope was
 *    detected and the change committed through the process, not beside it.
 *
 * Committee approval and the merge are NOT checked here. They are person
 * steps that come after the PR exists, and the merge itself needs a person.
 * The gate's verdict says so, so green reads as "scoped to a change set",
 * never as "approved".
 *
 * @module folio-assistant/workflow/change-set-coverage
 */

import type { InstanceState } from "./instance.js";

/** The parent process a change set runs as. */
export const CHANGE_REVIEW_PROCESS = "Process_ContentChangeReview";
/** The call activity whose completion means the change was made in-process. */
export const MAKE_PHASE = "Call_MakeChange";

/** What a change-set instance says it changes. Written at `Task_DetectScope`. */
export interface ChangeSetScope {
  /** The change set this instance runs, e.g. "CS-014". */
  changeSet: string;
  /** Labels of every block the change set changes. */
  blocks: string[];
}

export interface ChangeSetCover {
  instance: string;
  changeSet: string;
}

/** Has the make phase finished? A history line or a completed child both say so. */
export function madeInProcess(state: InstanceState): boolean {
  return (
    state.history.some((h) => h.node === MAKE_PHASE) ||
    state.children?.[MAKE_PHASE]?.status === "completed"
  );
}

/**
 * The change-set instance that covers `label`, from the instances changed in
 * this diff, or `undefined`. Pure: the caller loads the instances.
 */
export function changeSetCover(
  changedInstances: readonly InstanceState[],
  label: string,
): ChangeSetCover | undefined {
  for (const s of changedInstances) {
    if (s.processId !== CHANGE_REVIEW_PROCESS) continue;
    if (s.status !== "running") continue;
    if (!s.scope?.blocks.includes(label)) continue;
    if (!madeInProcess(s)) continue;
    return { instance: s.id, changeSet: s.scope.changeSet };
  }
  return undefined;
}

/**
 * Why a change-set instance in the diff does NOT cover `label`, for the
 * refusal message, or `undefined` when no instance in the diff is close.
 */
export function nearMiss(changedInstances: readonly InstanceState[], label: string): string | undefined {
  const mine = changedInstances.filter((s) => s.processId === CHANGE_REVIEW_PROCESS);
  if (mine.length === 0) return undefined;
  const naming = mine.filter((s) => s.scope?.blocks.includes(label));
  if (naming.length === 0) {
    return `change set(s) ${mine.map((s) => s.scope?.changeSet ?? s.id).join(", ")} in this diff do not list ${label} in scope.blocks`;
  }
  const s = naming[0]!;
  if (s.status !== "running") return `${s.id} is already completed, so it cannot authorise a new edit`;
  return `${s.id} has not finished ${MAKE_PHASE}: record the make phase before the change is gated`;
}
