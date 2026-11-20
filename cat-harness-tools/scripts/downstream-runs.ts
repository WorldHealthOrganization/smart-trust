/**
 * The downstream-tool criterion family — one evaluator for every Tool that
 * declares `downstream`.
 *
 * @module scripts/downstream-runs
 *
 * Every downstream tool is a Tool node declaring its output and inputs
 * (`schemas/tools/tool.ts#ToolDownstreamSchema`); each run writes a
 * `folio-tool-run/v1` record (`schemas/tools/tool-run.ts`). QA reads
 * **fresh** only for a successful run over the current inputs, **stale**
 * when an input moved since, and **not-run / failed** — never green — when
 * there is no successful record.
 *
 * `kg:audit` projects two criteria from here:
 *
 * - `tool-downstream-fresh`, per Tool — the three-state verdict over each of
 *   its targets, or `unknown` naming the publish verifier for an output that
 *   exists only in an assembled site;
 * - `downstream-tool-declared`, once per run — a downstream tool that is NOT
 *   declared: a member reader, a run record or a publish verifier naming a
 *   Tool with no `downstream` declaration.
 *
 * ## Members
 *
 * {@link MEMBERS} maps a Tool id to the function that enumerates its targets
 * and reads each one's state with the tool's OWN fingerprint (see
 * `schemas/tools/tool-run.ts` for why not a generic file hash). A `checkout`-judged
 * declaration with no member cannot be judged, which is `unknown`, not a pass.
 * Adding a member is one entry here plus the Tool's declaration.
 */
import type { ToolDefinition } from "../schemas/tools/tool.ts";
import { listToolRuns, TOOL_RUNS_DIR, type DownstreamState } from "../schemas/tools/tool-run.ts";
import type { KgCriterionEntry, KgFinding } from "../schemas/sdlc/kg-qa.ts";
import { graphVerdict, LSI_TOOL_ID, proseGraphs, targetOf } from "./lsi.ts";

/** One target of a downstream tool, as its member reads it. */
export interface DownstreamRow {
  target: string;
  /** `n/a` when the member does not judge this target (LSI: a graph below threshold). */
  state: DownstreamState | "n/a";
  /** Stable text — no counts — so a committed sidecar moves only with a verdict. */
  detail: string;
}

/** Member readers, by Tool id. */
export const MEMBERS: Readonly<Record<string, () => DownstreamRow[]>> = {
  [LSI_TOOL_ID]: () =>
    proseGraphs().map((g) => {
      const v = graphVerdict(g);
      return { target: targetOf(g), state: v.state ?? "n/a", detail: v.stableDetail };
    }),
};

/** The per-Tool verdict. `verifiers` is the publish-verify set's ids. */
export function toolDownstreamEntry(tool: ToolDefinition, verifiers: readonly string[]): KgCriterionEntry {
  const d = tool.downstream;
  if (!d) return { result: "n/a", findings: [] };
  if (d.judgedAt === "published") {
    if (!d.verifier || !verifiers.includes(d.verifier))
      return {
        result: "fail",
        findings: [{ where: tool.id, detail: `names publish verifier "${d.verifier ?? ""}", which is not in publish-verify's set — nothing judges "${d.output}" before deployment.` }],
      };
    // NEVER `pass` from a checkout — the output is a fact about the assembled site.
    return {
      result: "unknown",
      findings: [{ where: tool.id, detail: `"${d.output}" exists only in the assembled site. Judged by publish-verify's \`${d.verifier}\` verifier before deployment, not from a checkout.` }],
    };
  }
  const member = MEMBERS[tool.id];
  if (!member)
    return {
      result: "unknown",
      findings: [{ where: tool.id, detail: `declares a downstream output judged in the checkout but no member reader is registered in scripts/downstream-runs.ts, so its runs cannot be judged.` }],
    };
  const rows = member().filter((r) => r.state !== "n/a");
  if (rows.length === 0) return { result: "n/a", findings: [] };
  const bad = rows.filter((r) => r.state !== "fresh");
  return bad.length
    ? { result: "fail", findings: bad.map((r) => ({ where: `${tool.id}/${r.target}`, detail: `${r.state}: ${r.detail}` })) }
    : { result: "pass", findings: [] };
}

/**
 * Downstream tools with no declaration, as `downstream-tool-declared`'s entry.
 * Three ways one shows itself: a member reader for an undeclared Tool, a run
 * record naming one, and a publish verifier that says it judges one.
 *
 * ## Records that are not in the checkout are `unknown`, never a pass
 *
 * Bean `oq1j` (reader `R26`). The run records are derived QA bound for the
 * `qa-reports` branch. With no record directory to list, the record half of
 * the question was not asked ({@link listToolRuns}). The entry is then
 * `unknown`, and it carries the reason as a finding beside whatever the other
 * two halves found. `unknown` outranks `fail`, the rule `qa-results.ts`'s
 * judge mode keeps: a sweep blind on one part has not cleared the others.
 * Returning the findings alone, as this did, would make an unlisted directory
 * a quiet pass.
 */
export function undeclaredDownstreamEntry(
  tools: readonly ToolDefinition[],
  instanceRoot: string,
  verifiers: ReadonlyArray<{ id: string; tool?: string }>,
): KgCriterionEntry {
  const declared = new Map(tools.filter((t) => t.downstream).map((t) => [t.id, t.downstream!]));
  const out: KgFinding[] = [];
  for (const id of Object.keys(MEMBERS)) {
    if (declared.get(id)?.judgedAt !== "checkout")
      out.push({ where: id, detail: `scripts/downstream-runs.ts registers a member reader for "${id}", but no Tool node declares it \`downstream\` with \`judgedAt: checkout\`.` });
  }
  const listing = listToolRuns(instanceRoot);
  for (const { path, record } of listing.state === "hit" ? listing.runs : []) {
    if (!record) {
      out.push({ where: path, detail: "a run record that does not parse as folio-tool-run/v1 — it records nothing." });
      continue;
    }
    if (declared.get(record.tool)?.judgedAt !== "checkout")
      out.push({ where: path, detail: `a run record for Tool "${record.tool}", which declares no \`downstream\` output judged in the checkout — the run is recorded and nothing reads it.` });
  }
  for (const v of verifiers) {
    if (v.tool === undefined) continue;
    const d = declared.get(v.tool);
    if (!d || d.judgedAt !== "published" || d.verifier !== v.id)
      out.push({ where: v.id, detail: `publish verifier "${v.id}" judges Tool "${v.tool}", which does not declare a \`downstream\` output judged by it.` });
  }
  if (listing.state === "unknown") {
    return { result: "unknown", findings: [...out, { where: TOOL_RUNS_DIR.split("\\").join("/"), detail: `run records not examined: ${listing.reason}.` }] };
  }
  return { result: out.length ? "fail" : "pass", findings: out };
}
