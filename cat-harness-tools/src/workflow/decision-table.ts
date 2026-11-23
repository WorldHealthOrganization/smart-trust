/**
 * Read a DMN decision table, and evaluate it against facts.
 *
 * Ten exclusive gateways sit across the six BPMN diagrams, and they are not all
 * the same kind of question. `Accept, revise or discard?` is the editor's call
 * and should stay one. `Build green, no sorries?` is not a call at all — it is
 * arithmetic over `proof_status` and `lean_build`, and asking an agent to
 * "decide" it invites a judgement where a computation belongs.
 *
 * A gateway that carries `<cat-harness.processes:decision ref="file.dmn#Decision_Id"/>` has its
 * outcome **computed** from facts the caller supplies, rather than chosen. The
 * agent reports numbers; the table returns the branch. That is determinism in
 * the strict sense, as opposed to a recorded judgement.
 *
 * ## The FEEL subset, and why it is a subset
 *
 * FEEL is a language. This implements the part decision tables in this repo
 * actually use, and **throws on the rest naming the expression it could not
 * read**:
 *
 * | unary test        | meaning                          |
 * |-------------------|----------------------------------|
 * | `-`               | any value                        |
 * | `0`, `"green"`, `true` | equals that literal         |
 * | `> 0`, `>= 3`, `< 10`, `<= 2`, `= 5` | comparison    |
 * | `1, 2, 3`         | one of                           |
 * | `"a", "b"`        | one of                           |
 *
 * Ranges (`[1..5]`), `not(...)`, function calls, date arithmetic: refused. The
 * alternative — evaluating what is understood and quietly treating the rest as
 * "no match" — produces a table that returns an answer and is not the table on
 * the page. This repo has that failure recorded twice in other guises.
 *
 * @module folio-assistant/workflow/decision-table
 */

import { DmnModdle } from "dmn-moddle";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

/** Hit policies whose semantics this evaluator implements. */
const HIT_POLICIES = new Set(["UNIQUE", "FIRST"]);

export interface TableInput {
  /** Human label from the table header. */
  label?: string;
  /** The fact this column reads, e.g. `deferredSorries`. */
  expression: string;
  typeRef?: string;
  /**
   * The column's declared values (DMN `inputValues`), as the literals written
   * there, e.g. `["\"assigned\"", "\"not assigned\"", "\"unknown\""]`.
   * Absent when the file declares none. The evaluator does not read it; the
   * table checks in `dmn-qa.ts` use it as the column's domain.
   */
  allowedValues?: string[];
}

export interface TableRule {
  id: string;
  /** One unary test per input column, in order. */
  when: string[];
  /** One literal per output column, in order. */
  then: string[];
  description?: string;
  /** DMN 1.3 rule annotations (`annotationEntry`), in column order. */
  annotations?: string[];
}

export interface DecisionTable {
  id: string;
  name: string;
  source: string;
  hitPolicy: "UNIQUE" | "FIRST";
  inputs: TableInput[];
  /** Output column names. A single-output table is the common case. */
  outputs: string[];
  /**
   * Each output column's human label (DMN `output/@label`), in column order,
   * where the file gives one. Only the HTML rendering reads it
   * (`pipeline/render-dmn-table.ts`); the evaluator keys on {@link outputs}.
   */
  outputLabels?: (string | undefined)[];
  rules: TableRule[];
}

export class UnsupportedDmn extends Error {}
export class DecisionError extends Error {}

interface ModdleAny {
  $type?: string;
  id?: string;
  name?: string;
  drgElement?: ModdleAny[];
  decisionLogic?: ModdleAny;
  hitPolicy?: string;
  input?: {
    label?: string;
    inputExpression?: { text?: string; typeRef?: string };
    inputValues?: { text?: string };
  }[];
  output?: { name?: string; label?: string; typeRef?: string }[];
  rule?: {
    id?: string;
    description?: string;
    inputEntry?: { text?: string }[];
    outputEntry?: { text?: string }[];
    annotationEntry?: { text?: string }[];
  }[];
}

/**
 * Load one decision from a `.dmn` file.
 *
 * `ref` is `path#DecisionId`; the id half is required rather than defaulting to
 * "the first decision", because a file that grows a second decision would
 * silently repoint every gateway that referenced it.
 */
export async function loadDecisionTable(dmnPath: string, decisionId: string): Promise<DecisionTable> {
  const moddle = new DmnModdle();
  const { rootElement, warnings } = await moddle.fromXML(readFileSync(dmnPath, "utf-8"));
  if (warnings.length > 0) {
    throw new UnsupportedDmn(
      `${basename(dmnPath)}: ${warnings.length} parse warning(s) — ` +
        warnings.map((w: unknown) => String(w)).join("; "),
    );
  }
  const defs = rootElement as unknown as ModdleAny;
  const decision = (defs.drgElement ?? []).find(
    (e) => e.$type === "dmn:Decision" && e.id === decisionId,
  );
  if (!decision) {
    const available = (defs.drgElement ?? [])
      .filter((e) => e.$type === "dmn:Decision")
      .map((e) => e.id)
      .join(", ");
    throw new UnsupportedDmn(
      `${basename(dmnPath)} has no decision "${decisionId}". Available: ${available || "none"}`,
    );
  }

  const table = decision.decisionLogic;
  if (!table || table.$type !== "dmn:DecisionTable") {
    throw new UnsupportedDmn(
      `${decisionId} in ${basename(dmnPath)} is not a decision table ` +
        `(${table?.$type ?? "no decision logic"}). Only decision tables are implemented.`,
    );
  }

  // DMN's default hit policy is UNIQUE when the attribute is absent.
  const hitPolicy = (table.hitPolicy ?? "UNIQUE").toUpperCase();
  if (!HIT_POLICIES.has(hitPolicy)) {
    throw new UnsupportedDmn(
      `${decisionId}: hit policy ${hitPolicy} is not implemented. ` +
        `Supported: ${[...HIT_POLICIES].join(", ")}.`,
    );
  }

  const inputs: TableInput[] = (table.input ?? []).map((i, n) => {
    const expression = i.inputExpression?.text?.trim();
    if (!expression) {
      throw new UnsupportedDmn(`${decisionId}: input column ${n + 1} has no input expression`);
    }
    const declared = i.inputValues?.text?.trim();
    return {
      label: i.label,
      expression,
      typeRef: i.inputExpression?.typeRef,
      ...(declared ? { allowedValues: splitTop(declared) } : {}),
    };
  });

  const outputs = (table.output ?? []).map((o, n) => o.name ?? o.label ?? `output${n + 1}`);
  const outputLabels = (table.output ?? []).map((o) => o.label);
  if (outputs.length === 0) throw new UnsupportedDmn(`${decisionId}: no output column`);

  const rules: TableRule[] = (table.rule ?? []).map((r, n) => {
    const when = (r.inputEntry ?? []).map((e) => (e.text ?? "").trim());
    const then = (r.outputEntry ?? []).map((e) => (e.text ?? "").trim());
    if (when.length !== inputs.length || then.length !== outputs.length) {
      throw new UnsupportedDmn(
        `${decisionId}: rule ${n + 1} has ${when.length} input entries and ` +
          `${then.length} output entries; the table has ${inputs.length} inputs ` +
          `and ${outputs.length} outputs`,
      );
    }
    const annotations = (r.annotationEntry ?? []).map((e) => (e.text ?? "").trim()).filter(Boolean);
    return {
      id: r.id ?? `rule-${n + 1}`,
      when,
      then,
      description: r.description,
      ...(annotations.length > 0 ? { annotations } : {}),
    };
  });
  if (rules.length === 0) throw new UnsupportedDmn(`${decisionId}: no rules`);

  return {
    id: decisionId,
    name: decision.name ?? decisionId,
    source: dmnPath,
    hitPolicy: hitPolicy as "UNIQUE" | "FIRST",
    inputs,
    outputs,
    ...(outputLabels.some(Boolean) ? { outputLabels } : {}),
    rules,
  };
}

/** One decision a `.dmn` file declares, as far as a catalogue needs it. */
export interface DecisionSummary {
  id: string;
  name: string;
  /** The table's hit policy as written (DMN's default, `UNIQUE`, if absent); undefined for non-table logic. */
  hitPolicy?: string;
}

/**
 * Every decision a `.dmn` file declares — id, name, hit policy — WITHOUT
 * checking that this evaluator can run it.
 *
 * Deliberately separate from `loadDecisionTable`. The knowledge-graph export
 * (owner, 2026-09-27: each decision table is a node) catalogues what the file
 * SAYS; refusing to list a decision because its hit policy is one this engine
 * does not evaluate would hide a real artefact from the graph, and that
 * refusal already has a home: the process loader, at the gateway that uses it.
 */
export async function listDecisions(dmnPath: string): Promise<DecisionSummary[]> {
  const moddle = new DmnModdle();
  const { rootElement } = await moddle.fromXML(readFileSync(dmnPath, "utf-8"));
  const defs = rootElement as unknown as ModdleAny;
  return (defs.drgElement ?? [])
    .filter((e) => e.$type === "dmn:Decision" && e.id)
    .map((e) => ({
      id: e.id!,
      name: e.name ?? e.id!,
      hitPolicy:
        e.decisionLogic?.$type === "dmn:DecisionTable"
          ? (e.decisionLogic.hitPolicy ?? "UNIQUE").toUpperCase()
          : undefined,
    }));
}

// ── the FEEL subset ──────────────────────────────────────────────

/** Parse a DMN literal: a quoted string, a number, or a boolean. */
export function literal(text: string): string | number | boolean {
  const t = text.trim();
  if (/^".*"$/.test(t)) return t.slice(1, -1);
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  throw new UnsupportedDmn(
    `cannot read \`${text}\` as a DMN literal — expected a quoted string, a number, or true/false`,
  );
}

/**
 * Split on commas that are at the top level — outside quotes AND outside
 * parentheses.
 *
 * The parenthesis half was missing until 2026-10-04, when `not(...)` was
 * implemented: `not("red","green")` split into `not("red"` and `"green")`, and
 * the first half then raised `UnsupportedDmn` for an unbalanced paren. FEEL
 * allows a negation among a list (`"a", not("b"), "c"`), so depth has to be
 * tracked even though no shipped table does that yet.
 *
 * An unbalanced paren is left for {@link unaryTest} to refuse — this function
 * only decides where the commas are.
 */
export function splitTop(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  let depth = 0;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === "(") depth++;
    else if (!inQuotes && ch === ")") depth--;
    if (ch === "," && !inQuotes && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Does `value` satisfy the unary test `test`?
 *
 * Throws rather than returning false when the test cannot be read, so an
 * expression this evaluator does not implement can never be mistaken for a
 * rule that simply did not match.
 */
export function unaryTest(test: string, value: unknown): boolean {
  const t = test.trim();
  if (t === "" || t === "-") return true;

  const parts = splitTop(t);
  if (parts.length > 1) return parts.some((p) => unaryTest(p, value));

  const cmp = /^(<=|>=|<|>|=)\s*(.+)$/.exec(t);
  if (cmp) {
    const want = literal(cmp[2]);
    if (cmp[1] === "=") return value === want;
    if (typeof value !== "number" || typeof want !== "number") {
      throw new DecisionError(
        `\`${t}\` compares numbers, but the fact is ${JSON.stringify(value)}`,
      );
    }
    switch (cmp[1]) {
      case "<":
        return value < want;
      case "<=":
        return value <= want;
      case ">":
        return value > want;
      default:
        return value >= want;
    }
  }

  // FEEL `not(...)` negates a unary-test LIST, so it is the existing list
  // handling read the other way round rather than a new kind of expression.
  //
  // It is implemented here because `merge-priority.dmn` has used `not("green")`
  // since it was drawn and this evaluator threw on it, which means the merge
  // queue's priority table could never be evaluated by ANY caller. Measured
  // 2026-10-04, from this exception. The throw above is why that was findable
  // at all: an evaluator that returned false for what it cannot read would
  // have given the table a plausible wrong answer instead.
  const neg = /^not\s*\(([\s\S]*)\)$/.exec(t);
  if (neg) {
    const inner = neg[1].trim();
    if (inner === "") {
      throw new DecisionError("`not()` has no unary test inside it");
    }
    return !unaryTest(inner, value);
  }

  if (/^\[|^\]|\.\./.test(t) || /\(/.test(t)) {
    throw new UnsupportedDmn(
      `unary test \`${t}\` uses FEEL this evaluator does not implement ` +
        `(ranges, function calls). Supported: -, a literal, a comparison, ` +
        `a comma-separated list, or not() of any of those.`,
    );
  }

  return value === literal(t);
}

/**
 * Every expression in `table` that this evaluator CANNOT READ — the difference
 * between a table that loads and a table that can answer.
 *
 * ## Load is not evaluability, and that cost two months
 *
 * `merge-priority.dmn` carried `not("green")` in `Rule_HeadNotGreen` from the
 * day it was drawn. {@link loadDecisionTable} read it without complaint —
 * nothing in the loader looks inside a rule's cells — and
 * {@link possibleOutcomes} reads the OUTPUT column only. So `kg-audit`'s
 * `decision-outcomes-used` criterion, which calls exactly those two, recorded
 * `"result": "pass"` for a table no caller could evaluate. Measured 2026-10-04,
 * bean `dxqm`.
 *
 * That is `1xhc` one level deeper: **a declared executable artefact that
 * nothing can reach is indistinguishable, from outside, from a decision nobody
 * takes.** The property that made it findable at all is {@link unaryTest}
 * throwing rather than returning false, and this function exists so something
 * ASKS, instead of waiting for a caller to arrive.
 *
 * ## It lives here, not in the gate
 *
 * The FEEL subset is this module's own definition of itself. A checker that
 * restated the grammar would be a second spelling free to disagree with the
 * first — green on a table the engine refuses, or red on one it accepts — so
 * the question is asked by RUNNING the evaluator over a probe rather than by
 * re-deriving what it accepts.
 *
 * ## Why atom by atom, and why the probe is `0`
 *
 * `unaryTest` on a whole comma-separated test cannot be used for this: it is
 * `parts.some(…)`, so the first atom that matches ends the walk and an
 * unreadable atom after it is never reached. A list is therefore split with the
 * same {@link splitTop} the evaluator uses and each atom asked separately.
 *
 * The probe is the number `0` because it is the one value that reaches every
 * branch without a type complaint: a comparison needs a numeric fact, and an
 * equality or literal test simply returns false. So a `DecisionError` under
 * this probe is not "wrong fact type" — it is a rule that can never evaluate
 * for ANY fact, such as `> "a"`, and it is reported alongside the
 * `UnsupportedDmn` cases rather than swallowed.
 *
 * Output cells are checked too. {@link evaluate} calls {@link literal} on every
 * output column, and `possibleOutcomes` reads only the first — so an unreadable
 * literal in the second output column of a multi-output table is invisible to
 * every existing reader.
 *
 * An empty list is the only clean answer; the caller decides what to do with a
 * non-empty one.
 */
export function unreadableExpressions(table: DecisionTable): UnreadableExpression[] {
  const out: UnreadableExpression[] = [];
  const why = (e: unknown): string | undefined =>
    e instanceof UnsupportedDmn || e instanceof DecisionError
      ? e.message
      : // Anything else is a defect in this function, not a finding about the
        // table, and swallowing it would turn a crash into a clean report.
        undefined;

  for (const rule of table.rules) {
    rule.when.forEach((test, i) => {
      const t = test.trim();
      if (t === "" || t === "-") return;
      for (const atom of splitTop(t)) {
        try {
          unaryTest(atom, 0);
        } catch (e) {
          const message = why(e);
          if (message === undefined) throw e;
          out.push({
            rule: rule.id,
            side: "input",
            column: i + 1,
            of: table.inputs[i]?.expression ?? `input${i + 1}`,
            expression: atom === t ? t : `${atom}  (in \`${t}\`)`,
            message,
          });
        }
      }
    });
    rule.then.forEach((cell, i) => {
      try {
        literal(cell);
      } catch (e) {
        const message = why(e);
        if (message === undefined) throw e;
        out.push({
          rule: rule.id,
          side: "output",
          column: i + 1,
          of: table.outputs[i] ?? `output${i + 1}`,
          expression: cell,
          message,
        });
      }
    });
  }
  return out;
}

/** One cell of a decision table that {@link unreadableExpressions} could not read. */
export interface UnreadableExpression {
  /** The rule the cell belongs to. */
  rule: string;
  /** Which half of the table: a unary test, or an output literal. */
  side: "input" | "output";
  /** 1-based column, as a reader counts them on the page. */
  column: number;
  /** The fact an input column reads, or the name of an output column. */
  of: string;
  /** The cell as written — or the offending atom, naming the list it sits in. */
  expression: string;
  /** The evaluator's OWN message, never a restatement of it. */
  message: string;
}

export interface DecisionResult {
  /** The single output value, for the common single-output table. */
  outcome: string | number | boolean;
  /** Every output column, keyed by name. */
  outputs: Record<string, string | number | boolean>;
  /** Which rule fired, for the instance history. */
  rule: string;
  ruleDescription?: string;
}

/**
 * Evaluate a table against facts.
 *
 * A fact the table names but the caller did not supply is an error, not a
 * `false`. A gate that answers on data it never received is the failure this
 * whole mechanism exists to remove.
 */
export function evaluate(table: DecisionTable, facts: Record<string, unknown>): DecisionResult {
  for (const input of table.inputs) {
    if (!(input.expression in facts)) {
      throw new DecisionError(
        `${table.name} needs the fact \`${input.expression}\`` +
          (input.label ? ` (${input.label})` : "") +
          `, which was not supplied. Facts given: ` +
          `${Object.keys(facts).join(", ") || "none"}.`,
      );
    }
  }

  const matched = table.rules.filter((rule) =>
    rule.when.every((test, i) => unaryTest(test, facts[table.inputs[i].expression])),
  );

  if (matched.length === 0) {
    throw new DecisionError(
      `${table.name} matched no rule for ` +
        `${JSON.stringify(pick(facts, table.inputs.map((i) => i.expression)))}. ` +
        `A decision table with a gap is a gate that cannot answer — add a ` +
        `catch-all rule.`,
    );
  }
  if (table.hitPolicy === "UNIQUE" && matched.length > 1) {
    throw new DecisionError(
      `${table.name} is UNIQUE but ${matched.length} rules matched ` +
        `(${matched.map((m) => m.id).join(", ")}). Either the rules overlap or ` +
        `the hit policy should be FIRST.`,
    );
  }

  const rule = matched[0];
  const outputs: Record<string, string | number | boolean> = {};
  table.outputs.forEach((name, i) => {
    outputs[name] = literal(rule.then[i]);
  });
  return {
    outcome: outputs[table.outputs[0]],
    outputs,
    rule: rule.id,
    ruleDescription: rule.description,
  };
}

/**
 * Every distinct value the table's first output column can take.
 *
 * Read straight off the rules rather than by evaluating them: the caller wants
 * to know what the table *could* return, which is not a question about any
 * particular set of facts.
 */
export function possibleOutcomes(table: DecisionTable): string[] {
  return [...new Set(table.rules.map((r) => String(literal(r.then[0]))))];
}

function pick(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
}
