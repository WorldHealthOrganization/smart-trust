/**
 * The preconditions of a process, asked BEFORE an instance is created.
 *
 * @module folio-assistant/workflow/preflight
 *
 * ## Why this module exists at all
 *
 * `<bootstrap.processes:precondition>` (bean `lv3j`) has been parsed, three-valued and
 * tested since it landed. It has also, until now, had **zero non-test
 * callers**: `workflow_start` created the instance without ever asking. So the
 * repository carried a declaration that reads as a control and enforced
 * nothing — `a58y`'s finding about the `qa-reporting` permission, in the
 * component a pre-execution gate would be built on (issue #853, requirement 3).
 *
 * That is the whole reason the gate is a named module rather than four lines
 * inside the tool handler. `mcp-graph-tools.test.ts` records what happens to
 * logic that lives in a closure inside a request handler: *"the wiring between
 * a declared tool and its implementation was covered by `tsc` and nothing
 * else"* — and both defects in that work typechecked cleanly. A gate whose
 * only proof of life is that it compiles is the defect it exists to catch.
 *
 * ## The three verdicts do three different things
 *
 * | verdict | effect on starting |
 * |---|---|
 * | `unsatisfied` | **refused** — the claim was checked and is false |
 * | `could-not-determine` | started, and **named** in the output |
 * | `satisfied` | started, counted |
 *
 * The middle row is the one worth arguing for. Three of the four preconditions
 * that exist in this repository are `stated`, and `evaluatePrecondition`
 * returns `could-not-determine` for every one of them on its first line — the
 * guarantee is structural, not a rule somebody remembers. Blocking on them
 * would make `initialize-harness` unstartable, which is not a gate, it is an
 * outage. Reading them as satisfied is the `dh4f` shape: a clean run reported
 * over a question nobody could answer.
 *
 * So they are reported. {@link describePreflight} has no silent output — a
 * process with no preconditions says so, in those words. A caller that has to
 * go and look somewhere else to find out whether a gate ran does not have one
 * it can rely on, which is the argument `workflow_start` already makes for
 * `describeCapture` and is applied here for the same reason.
 */
import {
  evaluatePreconditions,
  type Precondition,
  type PreconditionVerdict,
  type ProcessModel,
} from "./process-model.js";

/** One precondition and the verdict it came back with. */
export interface PreflightEntry {
  precondition: Precondition;
  verdict: PreconditionVerdict;
}

/**
 * Every precondition of a process, grouped by what a caller does about it.
 *
 * `entries` is kept alongside the three groups rather than derived by the
 * caller, so a reporter that wants declaration order has it without
 * re-evaluating anything.
 */
export interface PreflightReport {
  entries: PreflightEntry[];
  unsatisfied: PreflightEntry[];
  undetermined: PreflightEntry[];
  satisfied: PreflightEntry[];
}

/**
 * Ask every precondition of `model`. A `file-exists` ref resolves against the
 * root of the layer that owns the diagram, carried on the check itself.
 *
 * A process declaring none yields four empty lists, which is a determined
 * answer and not a missing one — {@link describePreflight} says so in words
 * rather than printing nothing.
 */
export function preflight(
  model: Pick<ProcessModel, "preconditions">,
): PreflightReport {
  const entries = evaluatePreconditions(model);
  return {
    entries,
    unsatisfied: entries.filter((e) => e.verdict === "unsatisfied"),
    undetermined: entries.filter((e) => e.verdict === "could-not-determine"),
    satisfied: entries.filter((e) => e.verdict === "satisfied"),
  };
}

/**
 * The refusal message, or `undefined` when nothing blocks.
 *
 * **Only `unsatisfied` blocks.** A `could-not-determine` is not a soft
 * failure — it says the question has no observable answer, and refusing on it
 * would stop the one process in this repository that declares preconditions
 * from ever starting.
 *
 * The message names each offender by `id` and quotes the author's own `text`,
 * because "a precondition failed" sends a reader to the diagram to find out
 * which, and the point of the `id` field is that a report can say so.
 */
export function preflightRefusal(report: PreflightReport): string | undefined {
  if (report.unsatisfied.length === 0) return undefined;
  const lines = report.unsatisfied.map(
    (e) => `  - \`${e.precondition.id}\` — ${e.precondition.text}`,
  );
  return (
    `Refusing to start: ${report.unsatisfied.length} precondition(s) of this ` +
    `process were checked and are NOT met.\n${lines.join("\n")}\n\n` +
    `These are conditions the diagram says must hold BEFORE the start event. ` +
    `Satisfy them and call workflow_start again — an instance created over an ` +
    `unmet precondition records a run of a process that was never entered.`
  );
}

/**
 * What the gate found, in words, for the tool's own output.
 *
 * Never empty. A process with no preconditions is a **determined** result —
 * it declared none — and saying nothing about it is indistinguishable from
 * the gate not having run, which is the failure this whole module is about.
 */
export function describePreflight(report: PreflightReport): string {
  if (report.entries.length === 0) {
    return "Preconditions: none declared by this process.";
  }
  const parts = [`${report.satisfied.length} satisfied`];
  if (report.unsatisfied.length > 0) parts.push(`${report.unsatisfied.length} unsatisfied`);
  parts.push(`${report.undetermined.length} could not be determined`);
  const head = `Preconditions: ${report.entries.length} declared — ${parts.join(", ")}.`;
  if (report.undetermined.length === 0) return head;
  // NAMED, not just counted. A count tells a reader how much was unobservable;
  // only the ids tell them WHICH claim they are now carrying themselves.
  const named = report.undetermined.map((e) => `\`${e.precondition.id}\``).join(", ");
  return `${head}\n  Unobservable, so **not** treated as met: ${named}.`;
}
