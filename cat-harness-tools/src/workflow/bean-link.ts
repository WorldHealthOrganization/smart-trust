/**
 * The one place where a workflow instance and its bean become the same answer.
 *
 * `beans/` says *what is being worked on*; an instance says *where it got to*.
 * Kept apart they diverge, and a work plan that disagrees with itself is worse
 * than one that is merely coarse. Eleven activities across the six diagrams
 * carry `<cat-harness.processes:bean op="…"/>` — completing one is not a step
 * *about* the work plan, it **is** the work-plan operation, so doing one does
 * the other.
 *
 * Four operations, and the difference between them is who may decide:
 *
 * | op        | effect                                                |
 * |-----------|-------------------------------------------------------|
 * | `claim`   | status → `in-progress`. Safe and idempotent.          |
 * | `note`    | append a line to the bean body.                       |
 * | `resolve` | status → `completed`, **only if the process finished** |
 * | `archive` | move the bean into the archive, **only if the process finished and the bean is terminal** |
 *
 * `resolve` is the careful one. `AGENTS.md` is explicit that a bean is not
 * closed on someone else's judgement, and "Resolve **or re-open** the bean" is
 * the activity's actual name — whether work is done is a judgement. So it is
 * not taken on the caller's say-so: the bean completes only when the instance
 * it tracks has itself completed, which is a fact derived from the process
 * rather than an assertion. A still-running instance gets a note instead.
 * One exception: a diagram that ends in an `archive` step resolves the step
 * before it, so "finished" there means nothing is left but archive steps that
 * run straight to an end ({@link onlyArchiveLeft}). Without it, adding the
 * archive step would turn the resolve before it into a note.
 *
 * `archive` is the per-activity disposition of bean `folio-assistant-m8gz`
 * (owner, 2026-10-20: "a step op"). Since 2026-10-24 (option A) claim, resolve
 * and archive are drawn only in `Process_BeanOpen` and `Process_BeanClose`,
 * which every bean-touching process calls; `check:bean-calls` holds that.
 * Archiving is a VIEW, not a terminal state (bean `e8m3`): the bean keeps its
 * status and moves to the store's `archive/`, and `check:bean-archive` holds
 * that everything there is terminal. So the op refuses to move a bean that is
 * not `completed` or `scrapped`, or one whose process is still running, and
 * notes why instead. It records WHY in the bean, which is the one thing the
 * periodic sweep (`beans archive`) cannot: the sweep stays the floor, the op is
 * the exception (`todo-manager` § Archiving).
 *
 * Since 2026-11-02 (Q-BR-8 F) a step may also say it works the bean with a
 * standard data output association to the Beans store (`work-plan`) instead
 * of `op="note"`. That step is where an agent takes the bean up, so it claims
 * a `todo` bean before noting (`claimIfNotStarted`); OPEN and CLOSE still
 * decide whose bean it is and how it ends.
 *
 * Only ever `state.bean` — the bean whoever started the instance nominated.
 * This never touches a bean it was not handed.
 *
 * @module folio-assistant/workflow/bean-link
 */

import type { InstanceState } from "./instance.js";
import type { ProcessModel } from "./process-model.js";
import { ARCHIVE_DIR, MountedGitBranchStore } from "./work-plan-store-git-mount.ts";
import { TERMINAL_STATUSES, type WorkPlanStore } from "./work-plan-store.ts";

export type WorkPlanOp = "claim" | "note" | "resolve" | "archive";

export const WORK_PLAN_OPS = new Set<string>(["claim", "note", "resolve", "archive"]);

/** The status a step that works the bean may claim from (Q-BR-8 F). A draft is not work yet. */
const NOT_STARTED = new Set(["todo"]);

export interface BeanRef {
  id: string;
  title: string;
  status: string;
  path: string;
}

/**
 * Find a bean by id in the mounted store: its file, for a caller that reads
 * the file itself. The engine does not; it goes through {@link WorkPlanStore}.
 *
 * Bean filenames are `<id>--<slugged-title>.md`, so the id is a prefix rather
 * than the whole name; matching on the prefix plus the `--` separator avoids
 * `fq0b` also matching a hypothetical `fq0bx`.
 */
export function findBean(repoRoot: string, id: string): BeanRef | undefined {
  const e = new MountedGitBranchStore(repoRoot).all().get(id);
  return e ? { id, title: e.bean.title, status: e.bean.status, path: e.path } : undefined;
}

/** The beans in the mounted store's first directory, archived ones left out. */
export function listBeans(repoRoot: string): BeanRef[] {
  const store = new MountedGitBranchStore(repoRoot);
  const first = store.dirs()[0];
  if (!first) return [];
  return [...store.all().values()]
    .filter((e) => e.path.startsWith(`${first}/`) && !e.path.slice(first.length + 1).includes("/"))
    .map((e) => ({ id: e.bean.id, title: e.bean.title, status: e.bean.status, path: e.path }));
}

export interface WorkPlanResult {
  /** What was done, for the caller to report. */
  summary: string;
  bean?: Pick<BeanRef, "id" | "title" | "status">;
}

/**
 * Apply a work-plan operation to the instance's bean, through the store's
 * operations (cat-harness#991 step 3). `opts.store` is the Tool; the default
 * is the git state branch on its mount, which is every checkout today.
 *
 * Never throws for a missing bean: an instance may legitimately have none (a
 * one-off run, a subject that is not tracked). It says so instead, because
 * silently doing nothing is how the two records drift apart again.
 */
export function applyWorkPlanOp(
  repoRoot: string,
  beanId: string | undefined,
  op: WorkPlanOp,
  opts: { note?: string; instanceCompleted?: boolean; claimIfNotStarted?: boolean; store?: WorkPlanStore } = {},
): WorkPlanResult {
  if (!beanId) {
    return { summary: `no bean on this instance, so the ${op} step recorded nothing in beans/` };
  }
  const store = opts.store ?? new MountedGitBranchStore(repoRoot);
  const got = store.get(beanId);
  if (got.state !== "hit") {
    return { summary: `bean ${beanId} is not in beans/ — nothing recorded` };
  }
  const bean = { id: got.bean.id, title: got.bean.title, status: got.bean.status };
  const note = opts.note?.trim();
  const BY = "workflow";

  /** A status change on the version just read; a refusal is reported, never thrown. */
  const setStatus = (status: string, version: string): string | undefined => {
    const r = store.update(bean.id, { status }, version);
    return r.state === "updated" ? undefined : r.state === "refused" ? `${r.why}: ${r.detail}` : "the bean is gone";
  };

  if (op === "archive") {
    if (got.bean.archived) return { summary: `bean ${bean.id} already archived`, bean };
    const why = !opts.instanceCompleted
      ? "the process it tracks is still running"
      : !TERMINAL_STATUSES.has(bean.status)
        ? `it is ${bean.status}, and only a completed or scrapped bean may be archived`
        : undefined;
    if (why) {
      store.note(bean.id, `${note ? `${note} ` : ""}Archive step reached, bean not archived: ${why}.`, BY);
      return { summary: `bean ${bean.id} left in place: ${why} — noted instead of archived`, bean };
    }
    const noted = store.note(bean.id, note ?? "Archived by the process that completed it (workflow `archive` step).", BY);
    if (noted.state !== "noted") return { summary: `bean ${bean.id} is not in beans/ — nothing recorded` };
    const r = store.update(bean.id, { archived: true }, noted.version);
    if (r.state !== "updated") return { summary: `bean ${bean.id} not archived: ${r.state === "refused" ? `${r.why}: ${r.detail}` : "the bean is gone"}`, bean };
    return { summary: `bean ${bean.id} archived (${bean.status}) to ${ARCHIVE_DIR}/`, bean };
  }

  if (op === "note" || (op === "resolve" && !opts.instanceCompleted)) {
    // A step drawn against the Beans store is where an agent takes the bean
    // up (Q-BR-8 F), so a bean nobody has started is claimed there. Never a
    // bean that is already in progress or finished: only NOT_STARTED moves.
    const claimed = op === "note" && opts.claimIfNotStarted === true && NOT_STARTED.has(bean.status);
    if (claimed) {
      const refused = setStatus("in-progress", got.version);
      if (refused) return { summary: `bean ${bean.id} not claimed: ${refused}`, bean };
    }
    store.note(bean.id, note ?? `Workflow step reached (${op}).`, BY);
    return {
      summary:
        op === "note"
          ? claimed
            ? `bean ${bean.id}: ${bean.status} → in-progress, and noted`
            : `noted on bean ${bean.id}`
          : `bean ${bean.id} left ${bean.status}: the process it tracks is still running, ` +
            `so whether the work is done is not settled — noted instead of resolved`,
      bean,
    };
  }

  const status = op === "claim" ? "in-progress" : "completed";
  if (bean.status === status) {
    return { summary: `bean ${bean.id} already ${status}`, bean };
  }
  const refused = setStatus(status, got.version);
  if (refused) return { summary: `bean ${bean.id} left ${bean.status}: ${refused}`, bean };
  if (note) store.note(bean.id, note, BY);
  return { summary: `bean ${bean.id}: ${bean.status} → ${status}`, bean };
}

/**
 * Whether the work an instance tracks is finished, for `resolve`: the instance
 * completed, or every token waits on an `archive` step (or on a phase whose
 * own tokens do) and nothing but archive steps lies between it and an end.
 *
 * A token anywhere else means work remains, so the answer is false. That
 * includes an archive step placed mid-flow: it does not let a resolve fire
 * while later steps are still to come.
 */
export function onlyArchiveLeft(model: ProcessModel, state: InstanceState): boolean {
  if (state.status === "completed") return true;
  if (state.tokens.length === 0) return false;
  return state.tokens.every((t) => {
    const node = model.nodes.get(t);
    if (!node || !finishesAfter(model, t, new Set())) return false;
    if (node.workPlanOp === "archive") return true;
    const child = state.children?.[t];
    const childModel = model.children.get(t);
    return child !== undefined && childModel !== undefined && onlyArchiveLeft(childModel, child);
  });
}

/** Every path out of `nodeId` reaches an end through archive steps only. */
function finishesAfter(model: ProcessModel, nodeId: string, seen: Set<string>): boolean {
  if (seen.has(nodeId)) return false;
  seen.add(nodeId);
  const out = model.nodes.get(nodeId)?.outgoing ?? [];
  return (
    out.length > 0 &&
    out.every((f) => {
      const to = model.nodes.get(model.flows.get(f)?.to ?? "");
      if (!to) return false;
      if (to.kind === "end") return true;
      return to.workPlanOp === "archive" && finishesAfter(model, to.id, seen);
    })
  );
}
