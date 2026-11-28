/**
 * Quality checks for DMN decision tables (bean `lo3p`, owner's answers Q-S4-3 A
 * and Q-S4-4 A, 2026-11-01).
 *
 * Errors (the table gives a wrong or no answer):
 *
 * | check                | what it finds                                              |
 * |----------------------|------------------------------------------------------------|
 * | `dmn-table-complete` | an input combination that matches no rule                  |
 * | `dmn-rule-shadowed`  | a rule that never fires: under FIRST an earlier rule takes  |
 * |                      | every case it matches; under UNIQUE two rules overlap       |
 * | `dmn-unknown-last`   | the last rule does not return `"unknown"`                  |
 *
 * Warnings (the table is right but hard to trace):
 *
 * | check                         | what it finds                                     |
 * |-------------------------------|---------------------------------------------------|
 * | `dmn-rule-cites-source`       | a rule whose annotation names no source           |
 * | `dmn-structure-matches-folio` | the folio block's "Decision structure" table names |
 * |                               | other columns than the DMN file, or other rows     |
 *
 * Completeness and shadowing are the formal checks of Calvanese et al. 2016
 * (BPM). They are decided here by enumerating each column's domain, which is
 * exact for the tables we write: literals, booleans, lists and numeric
 * comparisons. A column's domain is, in order of preference:
 *
 * 1. its declared `inputValues`;
 * 2. `true`/`false` for a boolean column;
 * 3. every literal the rules test, plus one value none of them names. That
 *    extra value is why a free-text column with no catch-all is incomplete:
 *    any value the author did not list falls through every rule;
 * 4. for a numeric comparison, a point on each side of and at every threshold.
 *
 * Every test is run through the evaluator's own `unaryTest`, so these checks
 * never disagree with what `evaluate` would do.
 *
 * "The last rule returns unknown" accepts both house patterns: a FIRST table
 * whose last rule is the all-`-` catch-all, and a UNIQUE table whose last rule
 * matches an explicit `"unknown"` input value. The name check is for DTH
 * tables only: harness gateway tables return branch names, so a caller there
 * turns `requireUnknown` off.
 *
 * @module folio-assistant/workflow/dmn-qa
 */

import { literal, splitTop, unaryTest, type DecisionTable } from "./decision-table.js";

export type DmnCheck =
  | "dmn-loads"
  | "dmn-table-complete"
  | "dmn-rule-shadowed"
  | "dmn-unknown-last"
  | "dmn-rule-cites-source"
  | "dmn-structure-matches-folio"
  | "dmn-one-copy";

export type Severity = "error" | "warning";

/** The severity each check reports at. */
export const CHECK_SEVERITY: Record<DmnCheck, Severity> = {
  "dmn-loads": "error",
  "dmn-table-complete": "error",
  "dmn-rule-shadowed": "error",
  "dmn-unknown-last": "error",
  "dmn-rule-cites-source": "warning",
  "dmn-structure-matches-folio": "warning",
  "dmn-one-copy": "warning",
};

export interface DmnFinding {
  check: DmnCheck;
  severity: Severity;
  /** The decision id. */
  decision: string;
  /** The rule id, when the finding is about one rule. */
  rule?: string;
  detail: string;
}

export interface TableCheckOptions {
  /** Require the last rule to return "unknown" (DTH tables). Default true. */
  requireUnknown?: boolean;
  /** Stop enumerating past this many input combinations. Default 200 000. */
  maxCombinations?: number;
}

type Value = string | number | boolean;

/** A value no rule names: it stands for "anything else" in an open column. */
const OTHER = "\u0000any other value";

interface Domain {
  values: Value[];
  /** True when the domain includes {@link OTHER}. */
  open: boolean;
}

function show(v: Value): string {
  return v === OTHER ? "(any other value)" : JSON.stringify(v);
}

/** Literals and numeric thresholds a column's tests mention. */
function atomsOf(test: string, lits: Value[], thresholds: number[]): void {
  const t = test.trim();
  if (t === "" || t === "-") return;
  for (const atom of splitTop(t)) {
    const neg = /^not\s*\(([\s\S]*)\)$/.exec(atom);
    if (neg) {
      atomsOf(neg[1]!, lits, thresholds);
      continue;
    }
    const cmp = /^(<=|>=|<|>|=)\s*(.+)$/.exec(atom);
    try {
      if (cmp) {
        const v = literal(cmp[2]!);
        if (typeof v === "number" && cmp[1] !== "=") thresholds.push(v);
        else lits.push(v);
      } else lits.push(literal(atom));
    } catch {
      // Unreadable FEEL is `unreadableExpressions`' finding, not this one's.
    }
  }
}

/** The values one input column is enumerated over. */
export function columnDomain(table: DecisionTable, column: number): Domain {
  const input = table.inputs[column]!;
  if (input.allowedValues && input.allowedValues.length > 0) {
    try {
      return { values: input.allowedValues.map(literal), open: false };
    } catch {
      // A declared range or expression: fall back to what the rules say.
    }
  }
  if (input.typeRef === "boolean") return { values: [true, false], open: false };

  const lits: Value[] = [];
  const thresholds: number[] = [];
  for (const rule of table.rules) atomsOf(rule.when[column] ?? "-", lits, thresholds);

  const values = new Set<Value>(lits);
  if (thresholds.length > 0) {
    const ts = [...new Set(thresholds)].sort((a, b) => a - b);
    values.add(ts[0]! - 1);
    values.add(ts[ts.length - 1]! + 1);
    ts.forEach((t, i) => {
      values.add(t);
      if (i > 0) values.add((ts[i - 1]! + t) / 2);
    });
  }
  const numericOnly = [...values].every((v) => typeof v === "number") && thresholds.length > 0;
  if (!numericOnly) values.add(OTHER);
  return { values: [...values], open: !numericOnly };
}

function matches(test: string, value: Value): boolean {
  try {
    return unaryTest(test, value);
  } catch {
    // A comparison against a string, say: the rule cannot match this value.
    return false;
  }
}

/** Check one loaded table. Findings for the folio block come from {@link checkFolioStructure}. */
export function checkTable(table: DecisionTable, opts: TableCheckOptions = {}): DmnFinding[] {
  const requireUnknown = opts.requireUnknown ?? true;
  const max = opts.maxCombinations ?? 200_000;
  const out: DmnFinding[] = [];
  const add = (check: DmnCheck, detail: string, rule?: string) =>
    out.push({ check, severity: CHECK_SEVERITY[check], decision: table.id, ...(rule ? { rule } : {}), detail });

  // ── completeness and shadowing, by enumeration ──
  const domains = table.inputs.map((_, i) => columnDomain(table, i));
  const total = domains.reduce((n, d) => n * d.values.length, 1);
  if (total > max) {
    add("dmn-table-complete", `${total} input combinations, more than the ${max} this check enumerates; completeness and shadowing were not checked.`);
  } else {
    const firstHits = new Array<number>(table.rules.length).fill(0);
    const anyHits = new Array<number>(table.rules.length).fill(0);
    const gaps: Value[][] = [];
    let gapCount = 0;
    const overlaps = new Map<string, Value[]>();
    const combo: Value[] = new Array(domains.length);

    const visit = (col: number): void => {
      if (col === domains.length) {
        const hit: number[] = [];
        table.rules.forEach((r, i) => {
          if (r.when.every((test, c) => matches(test, combo[c]!))) hit.push(i);
        });
        if (hit.length === 0) {
          gapCount++;
          if (gaps.length < 3) gaps.push([...combo]);
          return;
        }
        firstHits[hit[0]!]++;
        for (const i of hit) anyHits[i]++;
        if (table.hitPolicy === "UNIQUE" && hit.length > 1) {
          const key = `${hit[0]}|${hit[1]}`;
          if (!overlaps.has(key)) overlaps.set(key, [...combo]);
        }
        return;
      }
      for (const v of domains[col]!.values) {
        combo[col] = v;
        visit(col + 1);
      }
    };
    visit(0);

    const describe = (c: Value[]) =>
      "{" + c.map((v, i) => `${table.inputs[i]!.expression}: ${show(v)}`).join(", ") + "}";

    if (gapCount > 0) {
      const open = table.inputs
        .filter((_, i) => domains[i]!.open)
        .map((i) => `\`${i.expression}\``);
      add(
        "dmn-table-complete",
        `${gapCount} of ${total} input combination(s) match no rule, e.g. ${gaps.map(describe).join("; ")}.` +
          (open.length > 0
            ? ` Column(s) ${open.join(", ")} declare no inputValues, so any value the rules do not list falls through: declare the values, or add a last catch-all rule.`
            : " Add the missing rule(s), or a last catch-all rule."),
      );
    }

    // A last all-`-` rule under FIRST is the catch-all for facts outside the
    // columns' domains (not supplied, not answered). Earlier rules taking
    // every enumerated case is what a complete table looks like, not a fault.
    const lastIdx = table.rules.length - 1;
    const isCatchAll = (i: number) =>
      table.hitPolicy === "FIRST" && i === lastIdx && table.rules[i]!.when.every((t) => t.trim() === "" || t.trim() === "-");
    table.rules.forEach((r, i) => {
      if (isCatchAll(i)) return;
      if (anyHits[i] === 0) {
        add("dmn-rule-shadowed", `rule ${i + 1} matches no value in its columns' domains, so it can never fire.`, r.id);
      } else if (table.hitPolicy === "FIRST" && firstHits[i] === 0) {
        add("dmn-rule-shadowed", `rule ${i + 1} never fires: under FIRST, earlier rules take every case it matches.`, r.id);
      }
    });
    for (const [key, c] of overlaps) {
      const [a, b] = key.split("|").map(Number) as [number, number];
      add(
        "dmn-rule-shadowed",
        `rules ${a + 1} and ${b + 1} both match ${describe(c)}, which a UNIQUE table forbids. Make the rules disjoint, or use FIRST and order them.`,
        table.rules[b]!.id,
      );
    }
  }

  // ── the last rule returns "unknown" ──
  if (requireUnknown) {
    const last = table.rules[table.rules.length - 1]!;
    const isUnknown = (cell: string) => {
      try {
        const v = literal(cell);
        return typeof v === "string" && v.trim().toLowerCase() === "unknown";
      } catch {
        return false;
      }
    };
    if (!isUnknown(last.then[0] ?? "")) {
      add(
        "dmn-unknown-last",
        `the last rule returns ${last.then[0] || "nothing"} for \`${table.outputs[0]}\`, not "unknown". ` +
          `Add a last rule for the case the facts do not settle: an all-\`-\` catch-all under FIRST, or an explicit "unknown" input value under UNIQUE.`,
        last.id,
      );
    }
  }

  // ── every rule cites its source ──
  const SOURCE =
    /\bpp?\.\s*\d|\bpages?\b|\bfig(?:ure)?s?\.?\s*\d|§|\bsection\b|\bch(?:apter)?\.?\s*\d|\btable\s*\d|\b(?:prose|fig|tbl|sec|page):[\w-]+|\b(?:sec|page)-\d+/i;
  // The last "unknown" rule is the table's own bookkeeping, not a rule the
  // source states, so it is not asked for a citation.
  const lastIsUnknown = (() => {
    try {
      const v = literal(table.rules[table.rules.length - 1]!.then[0] ?? "");
      return typeof v === "string" && v.trim().toLowerCase() === "unknown";
    } catch {
      return false;
    }
  })();
  table.rules.forEach((r, i) => {
    if (lastIsUnknown && i === table.rules.length - 1) return;
    const text = [r.description ?? "", ...(r.annotations ?? [])].join(" ").trim();
    if (text === "") {
      add("dmn-rule-cites-source", `rule ${i + 1} has no description or annotation, so nothing says where it comes from.`, r.id);
    } else if (!SOURCE.test(text)) {
      add("dmn-rule-cites-source", `rule ${i + 1}'s annotation names no page, figure, section or block it comes from.`, r.id);
    }
  });

  return out;
}

/**
 * Read the "Decision structure" from a folio block's Markdown. Two layouts are
 * in use:
 *
 * - a `## Decision structure` section with `**Inputs:**` and `**Outputs:**`
 *   bullet lists, each item starting with a backticked name, and a
 *   `**Rules:** N` line (dth-phc);
 * - otherwise, the first pipe table whose header row holds backticked names,
 *   one body row per rule (dth-sc, dth-pc).
 *
 * Returns the names in order and the rule count (undefined when the section
 * gives none), or undefined when the block has neither.
 */
export function folioStructure(markdown: string): { names: string[]; rows?: number } | undefined {
  const lines = markdown.split(/\r?\n/);

  const h = lines.findIndex((l) => /^#{1,6}\s+Decision structure\b/i.test(l.trim()));
  if (h >= 0) {
    const level = /^#+/.exec(lines[h]!.trim())![0].length;
    const names: string[] = [];
    let rows: number | undefined;
    let inList = false;
    for (let j = h + 1; j < lines.length; j++) {
      const l = lines[j]!;
      const head = /^(#+)\s/.exec(l.trim());
      if (head && head[1]!.length <= level) break;
      if (/\*\*(Inputs|Outputs):\*\*/i.test(l)) {
        inList = true;
        continue;
      }
      const r = /\*\*Rules:\*\*\s*(\d+)/i.exec(l);
      if (r) {
        rows = Number(r[1]);
        inList = false;
        continue;
      }
      if (/^\s*-\s+\*\*/.test(l)) inList = false;
      const item = /^\s+-\s+`([^`]+)`/.exec(l);
      if (inList && item) names.push(item[1]!.trim());
    }
    if (names.length > 0) return { names, rows };
  }

  for (let i = 0; i + 1 < lines.length; i++) {
    const head = lines[i]!.trim();
    const sep = lines[i + 1]!.trim();
    if (!head.startsWith("|") || !/^\|?\s*:?-{3,}/.test(sep)) continue;
    const cells = head.replace(/^\||\|$/g, "").split("|");
    const names = cells
      .map((c) => /`([^`]+)`/.exec(c)?.[1]?.trim())
      .filter((n): n is string => !!n);
    if (names.length === 0) continue;
    let rows = 0;
    for (let j = i + 2; j < lines.length && lines[j]!.trim().startsWith("|"); j++) rows++;
    return { names, rows };
  }
  return undefined;
}

/** Compare a table with its folio block's "Decision structure". */
export function checkFolioStructure(table: DecisionTable, markdown: string | undefined, blockPath: string): DmnFinding[] {
  const add = (detail: string): DmnFinding => ({
    check: "dmn-structure-matches-folio",
    severity: CHECK_SEVERITY["dmn-structure-matches-folio"],
    decision: table.id,
    detail,
  });
  if (markdown === undefined) return [add(`no folio block ${blockPath} beside the table, so its decision structure cannot be compared.`)];
  const s = folioStructure(markdown);
  if (!s) {
    return [add(`${blockPath} has no decision structure: neither a "Decision structure" section listing the inputs and outputs nor a rule table with backticked column names.`)];
  }

  const want = [...table.inputs.map((i) => i.expression), ...table.outputs];
  const missing = want.filter((n) => !s.names.includes(n));
  const extra = s.names.filter((n) => !want.includes(n));
  const out: DmnFinding[] = [];
  if (missing.length > 0 || extra.length > 0) {
    out.push(
      add(
        `${blockPath} names other columns than the DMN file.` +
          (missing.length ? ` Missing from the block: ${missing.map((n) => `\`${n}\``).join(", ")}.` : "") +
          (extra.length ? ` In the block but not the DMN: ${extra.map((n) => `\`${n}\``).join(", ")}.` : ""),
      ),
    );
  }
  if (s.rows !== undefined && s.rows !== table.rules.length) {
    out.push(add(`${blockPath} shows ${s.rows} rule row(s); the DMN file has ${table.rules.length}.`));
  }
  return out;
}
