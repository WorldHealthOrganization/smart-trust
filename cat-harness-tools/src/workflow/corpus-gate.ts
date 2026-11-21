/**
 * The commit boundary: refuse a corpus write the process never authorised.
 *
 * Everything before this was answerable — `workflow_gate` will tell an agent
 * whether a step is enabled, if it asks. This is the piece that does not
 * depend on asking. It runs from a pre-commit hook or from CI, so an agent
 * that ignored the whole orchestration still cannot land a block change that
 * no instance records the editor having seen the findings for.
 *
 * That is the difference the proposal called a map versus a rail
 * (`docs/proposals/workflow-orchestration.md` §4), and the reason it is here
 * rather than inside each of twenty-five capability tools: it is one place,
 * and it is not the agent that runs it.
 *
 * ## What counts as a corpus write
 *
 * A changed file that is a block manifest, or a sibling of one — `<block>.ts`,
 * `.md`, `.lean`, and *not* `.qa.json`, which is machine-written by the sweep
 * and would make every sweep look like an unauthorised edit. Anything else is
 * ignored: this gate is about content, not about the platform.
 *
 * ## Identity comes from the module, and failure is closed
 *
 * The block's label is read by importing it (`loadBlockModuleSync`), gated by
 * the cheap textual check so only real manifests are executed — the same split
 * `walkBlocks` uses. Only the changed files are loaded, so the cost is O(the
 * diff) rather than O(the corpus).
 *
 * A block whose label cannot be established is **refused**, not waved through.
 * A gate that fails open is a gate that reports clean by not looking.
 *
 * ## Two approved routes
 *
 * One edit to one block goes through `editing-hci-validation`, and its
 * instance must have reached `Task_Commit`. A change set (one PR, many blocks)
 * goes through `content-change-review` instead: a block passes when a running
 * change-set instance committed in the same diff, or started in the workflow
 * store since the PR's base, lists it in `scope.blocks`
 * and has finished its make phase (`change-set-coverage.ts`). Committee
 * approval and the merge stay person steps after that, and the verdict says
 * so. A block in neither is refused as before.
 *
 * @module folio-assistant/workflow/corpus-gate
 */

import { existsSync } from "node:fs";
import { workflowFiles } from "../../scripts/known-skills.js";
import { basename, relative, resolve } from "node:path";
import { loadProcessModel, type ProcessModel } from "./process-model.js";
import { checkGate, loadRelaxations, validateRelaxations, type Relaxation } from "./gate.js";
import { instanceId, listInstances, loadInstance, workflowDir } from "./store.js";
import { changeSetCover, nearMiss, startedSince } from "./change-set-coverage.js";
import type { InstanceState } from "./instance.js";

/** The step a corpus write must have been authorised by. */
export const COMMIT_ACTIVITY = "Task_Commit";
/**
 * The diagram this gate exists for, by NAME — not by path.
 *
 * Naming it is correct and stays: `editing-hci-validation` is one of the
 * three STRICT base processes, and the gate's whole job is refusing a corpus
 * write the editor did not authorise IN THAT process. A discovered "whatever
 * process happens to be there" would be a different and much weaker check.
 *
 * What was wrong was looking for it at a fixed `processes/` — a
 * layer that declares its knowledge graph elsewhere has the diagram and
 * the gate cannot find it, so the gate throws rather than gating. The name is
 * the base case; the LOCATION comes from the declaration.
 */
const EDITING_PROCESS_STEM = "editing-hci-validation";

/** Extensions that are a block's own content. `.qa.json` is machine-written. */
const CONTENT_SIBLINGS = [".ts", ".md", ".lean"];

export interface GateFinding {
  /** Repo-relative path that triggered this. */
  file: string;
  /** Block label, when it could be established. */
  label?: string;
  /** Instance id looked for. */
  instance?: string;
  allowed: boolean;
  reason: string;
}

/** Reduce a changed sibling to the block manifest it belongs to. */
function manifestFor(repoRoot: string, file: string): string | undefined {
  const abs = resolve(repoRoot, file);
  const dot = abs.lastIndexOf(".");
  if (dot === -1) return undefined;
  const ext = abs.slice(dot);
  if (!CONTENT_SIBLINGS.includes(ext)) return undefined;
  const ts = `${abs.slice(0, dot)}.ts`;
  return existsSync(ts) ? ts : undefined;
}

/**
 * Establish the block label a changed file belongs to.
 *
 * `undefined` means the file is not part of a block — a helper module, a
 * script, a chapter manifest. Those are not corpus writes and are not this
 * gate's business. A file that *is* a manifest but will not load must throw,
 * because "cannot tell" must not read as "fine".
 *
 * **Supplied by the caller, not imported here.** Reading a block manifest is
 * the content pipeline's job, and this gate is harness-layer: importing
 * `pipeline/` from `src/workflow/` was two of the six wrong-direction
 * edges bean `zlmp` is draining, and after the five-repo split each is a
 * circular dependency between repositories. The gate needs a label for a path;
 * it does not need to know what a block manifest is.
 */
export type LabelForPath = (tsPath: string) => string | undefined;

export interface CorpusGateOptions {
  /** Files changed in this commit, repo-relative. */
  files: string[];
  /** Where the folio's `processes/` lives — the platform checkout. */
  platformRoot: string;
  /**
   * Resolve a changed `.ts` path to the block label it declares.
   *
   * Required rather than defaulted: a default would have to import the content
   * pipeline here, which is the dependency this parameter exists to remove.
   */
  labelFor: LabelForPath;
  /**
   * The commit time (ISO) of the PR's fork point ({@link prBaseTime}). When
   * set, a running change-set instance in the repository's workflow store that
   * was started after it also covers the blocks it names, as one committed in the
   * diff does. A layer whose store is kept on `cat/<instance>/beans` can only
   * use change sets this way (`change-set-coverage.ts`).
   */
  baseTime?: string;
}

/**
 * A store's record of `id`, or why the store cannot be read here.
 *
 * A store whose bean graph is kept on an unmounted branch (in a layer's CI,
 * `cat/<layer>/beans` is usually not mounted) throws from `workflowDir`. That
 * is "this store cannot say", not a crash: the caller still refuses a block
 * with no record, and names the unreadable store so the finding says why
 * (litlfred/dth-sfp#14, the first full-tier run of a folio content PR). A
 * malformed record is still an error.
 */
export function readInstance(root: string, id: string): { state?: ReturnType<typeof loadInstance>; unreachable?: string } {
  try {
    return { state: loadInstance(root, id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("cannot resolve the workflow instance directory")) return { unreachable: msg };
    throw e;
  }
}

/** Run git with `args` in the repository, giving its output lines. Throws on a non-zero exit. */
export type GitLines = (args: string[]) => string[];

/**
 * The commit time (ISO) of the PR's fork point: the commit on `since` its own
 * line of work started from. A stored change-set instance started after it is
 * tied to this PR (`change-set-coverage.ts`).
 *
 * Not `git merge-base <since> HEAD`. Once main is merged into the PR, that is
 * the current main tip, which is newer than the change set's instance, and
 * every block the change set made went unauthorised on the next run
 * (WorldHealthOrganization/dth-cs#3, after dth-cs#4 was merged in). The fork
 * point does not move when main is merged in: it is the first parent of the
 * oldest commit on the PR's first-parent line that `since` does not hold.
 *
 * The PR's line is HEAD's, except under the merge commit CI checks out
 * (HEAD^1 is `since`'s tip and HEAD^2 the PR head), where it is HEAD^2.
 * Following first parents only keeps the line the PR's own: a merged-in
 * branch's older base does not widen the window. Where the history does not
 * reach the fork point (a shallow clone), this gives the merge base, as
 * before, which is never older than the fork point: it can only be stricter.
 */
export function prBaseTime(git: GitLines, since: string): string | undefined {
  const time = (ref: string): string | undefined => git(["show", "-s", "--format=%cI", ref])[0];
  const mergeBase = git(["merge-base", since, "HEAD"])[0];
  const fallback = mergeBase ? time(mergeBase) : undefined;
  const has = (ref: string): boolean => {
    try {
      return git(["rev-parse", "-q", "--verify", `${ref}^{commit}`]).length > 0;
    } catch {
      return false;
    }
  };
  const holds = (ancestor: string): boolean => {
    try {
      git(["merge-base", "--is-ancestor", ancestor, since]);
      return true;
    } catch {
      return false;
    }
  };
  const tip = has("HEAD^2") && holds("HEAD^1") && !holds("HEAD^2") ? "HEAD^2" : "HEAD";
  const line = git(["rev-list", "--first-parent", tip, "--not", since]);
  const oldest = line[line.length - 1];
  if (!oldest || !has(`${oldest}^1`)) return fallback;
  const fork = time(`${oldest}^1`);
  if (!fork || !fallback) return fork ?? fallback;
  // The fork point is never later than the merge base; if clocks say it is, keep the stricter one.
  return Date.parse(fork) <= Date.parse(fallback) ? fork : fallback;
}

/**
 * The files a change edited, from `git diff --name-status -M100%` lines.
 *
 * A pure move (`R100`: same bytes, new path) is not an edit: the block's text
 * is what the editor approved, and moving it to another chapter is a change to
 * the chapter manifests, which are not blocks. Any other status keeps its
 * (new) path, so a move that also changes the file is still gated.
 */
export function changedContentFiles(nameStatusLines: string[]): string[] {
  const out: string[] = [];
  for (const line of nameStatusLines) {
    const [status, ...paths] = line.split("\t");
    if (!status || paths.length === 0) continue;
    if (status === "R100") continue;
    out.push(paths[paths.length - 1]);
  }
  return out;
}

/**
 * Check every changed content file against the editing process.
 *
 * Returns one finding per block (not per file — a change to `x.ts` and `x.md`
 * is one block's worth of work, and reporting it twice would suggest two
 * problems). Files that are not content are simply absent from the result.
 */
export async function checkCorpusGate(
  repoRoot: string,
  opts: CorpusGateOptions,
): Promise<GateFinding[]> {
  // The editing process is loaded the first time a changed file turns out to
  // be a block, not before. A change with no block in it (a re-pin, a
  // workflow edit) is not a corpus write, so it is not this gate's business
  // whether the editing process is reachable from here: the diagram lives in
  // an opt-in group of the layer that owns it, and a root that does not
  // enable that group does not have it on disk. A block with no process to
  // check it against is still refused, by the throw below.
  let editing: { model: ProcessModel; relaxations: Relaxation[] } | undefined;
  const loadEditing = async (): Promise<{ model: ProcessModel; relaxations: Relaxation[] }> => {
    if (editing) return editing;
    const bpmn = workflowFiles(opts.platformRoot).find(
      (f) => basename(f, ".bpmn") === EDITING_PROCESS_STEM,
    );
    if (!bpmn) {
      throw new Error(
        `This change writes a content block, and there is no ${EDITING_PROCESS_STEM}.bpmn in any ` +
          `knowledge-graph directory declared by ${opts.platformRoot} to check it against. ` +
          `Enable the opt-in sub-graph that holds it in this root's enableSubgraphs, or point --platform at a checkout that has it.`,
      );
    }
    const model: ProcessModel = await loadProcessModel(bpmn);
    let relaxations: Relaxation[] = [];
    try {
      relaxations = loadRelaxations(opts.platformRoot);
      validateRelaxations(relaxations, [model]);
    } catch (e) {
      // A malformed policy must not silently become "no relaxations", which would
      // refuse work a package had legitimately declared.
      throw new Error(`Workflow policy is not loadable, so the gate cannot run: ${String(e)}`);
    }
    editing = { model, relaxations };
    return editing;
  };

  const seen = new Map<string, GateFinding>();
  const changeSets = [...changedChangeSetInstances(repoRoot, opts.files)];
  if (opts.baseTime !== undefined) {
    for (const st of storedChangeSets(repoRoot, opts.baseTime)) {
      if (!changeSets.some((c) => c.id === st.id)) changeSets.push(st);
    }
  }

  for (const file of opts.files) {
    const ts = manifestFor(repoRoot, file);
    if (!ts) continue;

    let label: string | undefined;
    try {
      label = opts.labelFor(ts);
    } catch (e) {
      const finding: GateFinding = {
        file,
        allowed: false,
        reason: `${String(e)} — a block whose identity cannot be established cannot be checked, and this gate does not fail open.`,
      };
      seen.set(ts, finding);
      continue;
    }
    if (!label) continue; // not a block: not this gate's business
    if (seen.has(ts)) continue;

    const { model, relaxations } = await loadEditing();
    const id = instanceId(model.id, label);
    // The repository's own store first: it is where the editing workflow for
    // its own blocks is recorded. The platform's store is a fallback. In a
    // layer's CI either may be kept on an unmounted branch
    // (`cat/<layer>/beans`), where reading it throws. An unreachable store
    // then counts as "no record there", which still fails closed: the block
    // is refused, and the finding names the store it could not read.
    // Either store may be unreadable here; that counts as "no record there".
    const own = readInstance(repoRoot, id);
    const platform = own.state ? {} : readInstance(opts.platformRoot, id);
    const state = own.state ?? platform.state;
    const unread = [own.unreachable, platform.unreachable].filter((x): x is string => Boolean(x));
    const cover = state && allowedByEditing(model, state, relaxations) ? undefined : changeSetCover(changeSets, label);
    if (cover) {
      seen.set(ts, {
        file,
        label,
        instance: cover.instance,
        allowed: true,
        reason:
          `covered by change set ${cover.changeSet} (\`${cover.instance}\`), made in process; ` +
          `committee approval and the merge stay with a person`,
      });
      continue;
    }
    if (!state) {
      const near = nearMiss(changeSets, label);
      seen.set(ts, {
        file,
        label,
        instance: id,
        allowed: false,
        reason:
          `no workflow instance \`${id}\` — nothing records that the validation findings ` +
          `were shown to the editor for this block. Start one with workflow_start ` +
          `{ process: "editing-hci-validation", subject: "${label}" }, or list the block in ` +
          `a content-change-review instance for its change set` +
          (near ? ` (${near})` : "") +
          `.` +
          (unread.length
            ? ` The workflow store could not be read here, so a record kept there was not seen ` +
              `(${[...new Set(unread)].join("; ")}): mount the bean graph (\`bun run cat state:mount\`) and re-run.`
            : ""),
      });
      continue;
    }

    // Either the commit step is enabled now, or it has already been taken —
    // both mean the editor's decision is on record, which is what this checks.
    const alreadyCommitted = state.history.some((h) => h.node === COMMIT_ACTIVITY);
    const verdict = checkGate(model, state, COMMIT_ACTIVITY, relaxations);
    seen.set(ts, {
      file,
      label,
      instance: id,
      allowed: alreadyCommitted || verdict.allowed,
      reason: alreadyCommitted ? `${COMMIT_ACTIVITY} already recorded` : verdict.reason,
    });
  }

  return [...seen.values()];
}

/** Does the editing instance allow the commit, now or already? */
function allowedByEditing(model: ProcessModel, state: InstanceState, relaxations: Relaxation[]): boolean {
  return (
    state.history.some((h) => h.node === COMMIT_ACTIVITY) ||
    checkGate(model, state, COMMIT_ACTIVITY, relaxations).allowed
  );
}

/**
 * The running change-set instances in the repository's workflow store started
 * after `baseTime`. An unreadable store (its bean graph not mounted) gives
 * none, which still fails closed: no change-set cover.
 */
export function storedChangeSets(repoRoot: string, baseTime: string): InstanceState[] {
  let stored: InstanceState[];
  try {
    stored = listInstances(resolve(repoRoot));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("cannot resolve the workflow instance directory")) return [];
    throw e;
  }
  return startedSince(stored, baseTime);
}

/**
 * The workflow instances this diff adds or changes, read from the repository.
 *
 * Only the changed ones: an instance is cover for the PR that commits it, so
 * an old change set cannot authorise a later edit (`change-set-coverage.ts`).
 * An unreadable instance directory means no change-set cover, which still
 * fails closed.
 */
function changedChangeSetInstances(repoRoot: string, files: string[]): InstanceState[] {
  let dir: string;
  try {
    dir = relative(resolve(repoRoot), workflowDir(resolve(repoRoot)));
  } catch {
    return [];
  }
  const out: InstanceState[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const rel = relative(dir, f);
    if (rel.startsWith("..") || rel.includes("/")) continue;
    const st = loadInstance(repoRoot, basename(f, ".json"));
    if (st) out.push(st);
  }
  return out;
}
