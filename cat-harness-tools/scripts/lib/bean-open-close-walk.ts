/**
 * Walk a process's OPEN and CLOSE calls (bean `m8gz`) the way `workflow_complete`
 * would, for a driver or test that only cares about what lies between them.
 *
 * Every process that works a bean calls `Process_BeanOpen` first and
 * `Process_BeanClose` last, so a walker that used to start at the process's
 * first own step now meets `Open_CheckExists`, and one that ended on the last
 * own step now meets `Close_Outcome`. These are the steps of the common path —
 * a bean that does not exist yet, created and claimed here; closed as done —
 * named once, so the step ids live in one place beside the two diagrams.
 */
import { complete, type InstanceState } from "../../src/workflow/instance";
import type { ProcessModel } from "../../src/workflow/process-model";

type CompleteOptions = NonNullable<Parameters<typeof complete>[3]>;

/** One step: the node, and the outcome a gateway takes. */
export type WalkStep = readonly [node: string, outcome?: string];

/** Process_BeanOpen on a new bean: checked, created, claimed. */
export const OPEN_NEW_BEAN: readonly WalkStep[] = [
  ["Open_CheckExists"],
  ["Open_Exists", "no"],
  ["Open_Create"],
  ["Open_Claim"],
];

/** Process_BeanClose on finished work: completed, then archived. */
export const CLOSE_DONE: readonly WalkStep[] = [["Close_Outcome", "done"], ["Close_Complete"], ["Close_Archive"]];

/** Complete each step in order; returns the state the engine hands back. */
export function walkSteps(
  model: ProcessModel,
  state: InstanceState,
  steps: readonly WalkStep[],
  opts: Omit<CompleteOptions, "outcome"> = {},
): InstanceState {
  let s = state;
  for (const [node, outcome] of steps) s = complete(model, s, node, outcome === undefined ? opts : { ...opts, outcome });
  return s;
}

/** OPEN on a new bean, then the caller's own gateway after it, taken as claimed. */
export function openNewBean(
  model: ProcessModel,
  state: InstanceState,
  opts: Omit<CompleteOptions, "outcome"> = {},
  gateway = "GW_BeanYours",
): InstanceState {
  return walkSteps(model, state, [...OPEN_NEW_BEAN, [gateway, "claimed"]], opts);
}
