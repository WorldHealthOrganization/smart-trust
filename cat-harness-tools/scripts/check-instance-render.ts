#!/usr/bin/env bun
/**
 * Can this layer render its own JSON-LD, and does it publish what it owns?
 *
 * Rendering JSON-LD is a conformance requirement of every layer, including
 * one whose declaration names directories this repository does not have.
 *
 * ## Why "did it throw" is not the check
 *
 * **An export of nothing succeeds**: a reader resolving a directory against
 * the wrong root finds nothing and renders cleanly, and an export can publish
 * kinds the layer never declared. So this compares what the layer
 * DECLARES with what it PUBLISHES.
 *
 * ## Declared means transitively declared
 *
 * The layer declaration names a directory and the graph typologies in it;
 * a graph file inside that directory may name more. `beans/beans.json`
 * declares `bean-defs` and `workflow-state`, `todos/todos.json` declares
 * `todo-items` and `todo-feedback`. Those are the layer's, declared one
 * level down.
 *
 * ## Three states
 *
 * - **rendered** — it declared, it published, and everything it published is
 *   its own.
 * - **undetermined** — no declaration, or one that will not parse. NEVER a
 *   pass: a layer whose declaration cannot be read has not been shown to
 *   render, it has been shown to be unreadable. Exit 2.
 * - **failed** — the render threw, or it published nothing, or it published a
 *   kind it does not own. Exit 1.
 *
 * ## A layer that declares no directories renders nothing, and passes
 *
 * A layer may declare `directories: []` (e.g. an index that mounts none
 * of a repository's directories). Its render is then empty BY DECLARATION,
 * so it is **rendered**, flagged `noDirectories`, and reported as "declares
 * no directories" in the summary. The exemption is exactly the explicit
 * empty list: a layer that declares a directory and renders nothing
 * still fails, and so does one whose declaration leaves `directories` out.
 *
 * Usage:
 *   bun run cat check:instance-render
 *   bun run cat check:instance-render -- --json
 *
 * @module scripts/check-instance-render
 * @covers docs, cat-harness
 */

import { readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import {
  findDeclarationFile,
  instanceRootFor,
  layerRootsIn,
  declaredKinds,
  readDeclaration,
  renderExemptionProblems,
  repoRootFor,
  type CatHarnessDeclaration,
} from "../schemas/kg/cat-harness.js";
import { collectInstanceNodes } from "./kg-export.js";

/** How a layer's render came out. Never two states. */
export type RenderVerdict = "rendered" | "undetermined" | "failed";

export interface InstanceRender {
  /** The layer's directory name, for reporting. */
  name: string;
  root: string;
  verdict: RenderVerdict;
  /** Graph typologies the layer declares, transitively. */
  declared: string[];
  /** Graph typologies it actually published nodes for. */
  published: string[];
  /**
   * Published and not declared — REPORTED, not yet fatal.
   *
   * Measured on `35b868a45d`: cat-harness 1 (`folio`, contributed by core),
   * bootstrap 15. Both layers publish all 16 registered kinds because
   * `collectGraphTypologies()` takes no root — `COLLECTOR_SCOPE` files `graphTypologies`
   * as `universal`, "reads nothing instance-specific at all". A graph typology is
   * contributed by a LAYER, so the registry is global in STORAGE and not in
   * OWNERSHIP, and that classification is what needs revisiting.
   *
   * Not made fatal here, deliberately. The count is 16, and the repository's
   * own rule — stated in `code-quality-gates.yml` for ruff — is that a check
   * becomes an error once its count is zero. Failing on day one would mean
   * either a red gate nobody can clear or this module quietly deciding an
   * ownership question that belongs to bean `z4mq`. PROMOTE IT the moment
   * `collectGraphTypologies` becomes instance-scoped and this reaches zero.
   */
  undeclared: string[];
  /**
   * Nodes the layer itself contributed — skills, processes, roles, its
   * declaration. Zero is a FAILURE, not an empty success.
   *
   * Excludes the graph-typology registry, which every layer gets for free
   * because `collectGraphTypologies()` takes no root. Counting those made the
   * emptiness guard unreachable; see `renderInstance`.
   */
  nodeCount: number;
  /** Everything rendered, registry included — reported so both are visible. */
  totalNodes: number;
  /** Collectors deliberately not run, so "has none" is distinct from "never looked". */
  omitted: readonly string[];
  /**
   * Determined empties — things this layer was looked for and has none of.
   *
   * Reported, never fatal, and that is the distinction it exists to carry.
   * "No workflow diagrams under a declared knowledge-graph directory" is a
   * fact worth printing and not a reason to fail a layer: a skills
   * package with no process is ordinary. Before this, it was a `problem`, and
   * three layers holding one skill each failed on it alone.
   *
   * Different from `omitted`, which is "never looked for". This one IS the
   * result of looking.
   */
  notes?: readonly string[];
  /** Why, when the verdict is not `rendered`. */
  reasons: string[];
  /**
   * It declares `directories: []`, so it has no nodes of its own to render and
   * a zero `nodeCount` is accepted (C1, see the module note). Reported.
   */
  noDirectories?: boolean;
}

/**
 * Every graph typology a layer declares, following nested graph files.
 *
 * A directory entry names kinds; a graph file INSIDE that directory may name
 * more, and those are equally the layer's. Reading only `harness.json`
 * makes `bean-defs` look like something bootstrap smuggled in.
 */

/**
 * Whether the declaration as WRITTEN says `directories: []` (C1). Read raw:
 * the parsed declaration gives a layer that leaves `directories` out the
 * same empty list, and that one has not declared that it holds nothing.
 */
export function declaresNoDirectories(root: string): boolean {
  const file = findDeclarationFile(root);
  if (file === undefined) return false;
  try {
    const d = (JSON.parse(readFileSync(join(root, file), "utf-8")) as { directories?: unknown }).directories;
    return Array.isArray(d) && d.length === 0;
  } catch {
    return false;
  }
}

/**
 * Render one layer and judge it.
 *
 * `base` is a placeholder rather than the layer's `canonicalUrl`: this asks
 * whether the layer CAN render, not where it publishes, and a layer
 * with no canonical URL must still be checkable.
 */
export async function renderInstance(root: string): Promise<InstanceRender> {
  const name = basename(resolve(root));
  const reasons: string[] = [];

  let decl: CatHarnessDeclaration | undefined;
  try {
    decl = readDeclaration(root);
  } catch (e) {
    return {
      name, root, verdict: "undetermined", declared: [], published: [], undeclared: [],
      nodeCount: 0, totalNodes: 0, omitted: [],
      reasons: [`declaration will not parse: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
  if (!decl) {
    return {
      name, root, verdict: "undetermined", declared: [], published: [], undeclared: [],
      nodeCount: 0, totalNodes: 0, omitted: [],
      reasons: [`no declaration at ${root} — nothing declares what this instance is`],
    };
  }

  const declared = declaredKinds(root, decl);
  const problems: string[] = [];
  let nodes: Awaited<ReturnType<typeof collectInstanceNodes>>;
  try {
    nodes = await collectInstanceNodes(root, "doc", "https://instance-render.invalid", problems);
  } catch (e) {
    return {
      name, root, verdict: "failed", declared: [...declared].sort(), published: [], undeclared: [],
      nodeCount: 0, totalNodes: 0, omitted: [],
      reasons: [`render threw: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  // THE LAYER'S OWN NODES, which is not the node count.
  //
  // `collectGraphTypologies()` is classified `universal` — it takes no root and
  // emits the whole registry — so EVERY layer gets those nodes for free,
  // including one that declares nothing. The first version of this check
  // failed a layer on `nodes.length === 0`, and its own test proved that
  // condition unreachable: an empty layer renders 16 nodes, all of them
  // the registry's.
  //
  // A guard that cannot fire is a guard that reports a clean run, which is
  // the defect this module was written to catch — arriving in the module
  // itself. So the count that decides the verdict excludes what the universal
  // collector contributed, and `nodeCount` reports it separately from the
  // total so a reader can see both.
  const isGraphTypology = (n: (typeof nodes.nodes)[number]): boolean =>
    // Slash IRIs (owner card Q-GLO-6 A, cat-harness-tools#1378): the type is
    // `…/ns/GraphTypology`. The `#` form is still read so a checkout whose
    // lower layers predate the slash re-pin is not judged as publishing nothing.
    /[/#]GraphTypology$/.test(String(n["@type"] ?? ""));
  const published = [...new Set(nodes.nodes.filter(isGraphTypology).map((n) => String(n.name)))].sort();
  const undeclared = published.filter((k) => !declared.has(k));
  const ownNodes = nodes.nodes.filter((n) => !isGraphTypology(n)).length;

  // WHAT MAKES A RENDER FAIL, and what is merely reported. The split follows
  // this repository's own precedent, stated in `code-quality-gates.yml` for
  // ruff: "a check is an error only once its count is zero". These three are
  // at zero and so are errors; `undeclared` is at 16 and so is a finding.
  // An explicit `directories: []` is a layer that declares nothing to
  // render (C1): its empty graph is the declaration's, not a lost directory's.
  const noDirectories = declaresNoDirectories(root);
  if (ownNodes === 0 && !noDirectories) {
    reasons.push(
      "rendered zero nodes of its own — an empty graph is a failure, not an empty success. " +
        `(${nodes.nodes.length} node(s) total, all contributed by the universal graph-typology registry.)`,
    );
  }
  for (const p of problems) reasons.push(`collector problem: ${p}`);

  return {
    name, root,
    verdict: reasons.length === 0 ? "rendered" : "failed",
    declared: [...declared].sort(),
    published,
    undeclared,
    nodeCount: ownNodes,
    totalNodes: nodes.nodes.length,
    omitted: nodes.omitted,
    notes: nodes.notes,
    reasons,
    ...(noDirectories ? { noDirectories: true } : {}),
  };
}

/**
 * Every layer this repository owns — the root, and any beside it.
 *
 * The docstring above is unchanged and was FALSE in both halves until
 * 2026-09-20: this listed `["cat-harness", "bootstrap"]`, so the root was not
 * in it and two layers beside it were missing. There are four —
 * `folio-assist-core` and the repository root are the two that were going
 * unchecked, and `check-declared-assets` carried the same literal and the same
 * blind spot (bean `6tkl`).
 *
 * Now it asks the filesystem. A list that must be edited when a directory is
 * added is a list that will be wrong, and this one had already been wrong once
 * before — the sibling gate's own docstring recorded that.
 */
export function instancesIn(repoRoot: string): string[] {
  return layerRootsIn(repoRoot);
}

export function formatReport(rs: InstanceRender[]): string {
  const out: string[] = ["Instance render conformance", ""];
  for (const r of rs) {
    const mark = r.verdict === "rendered" ? "✓" : r.verdict === "undetermined" ? "?" : "✗";
    out.push(
      `  ${mark} ${r.name.padEnd(14)} ${r.verdict.padEnd(13)} ` +
        `${r.nodeCount} own node(s) of ${r.totalNodes}, ${r.declared.length} declared, ${r.published.length} published`,
    );
    for (const why of r.reasons) out.push(`      ${why}`);
    if (r.noDirectories) out.push("      declares no directories (`directories: []`): nothing of its own to render, accepted by declaration");
    if (r.undeclared.length) {
      out.push(
        `      \u2717 publishes ${r.undeclared.length} kind(s) it does not declare — ` +
          `${r.undeclared.join(", ")}`,
      );
    }
    if (r.omitted.length) out.push(`      not looked for: ${r.omitted.join(", ")}`);
    // Printed for a RENDERED layer too — a determined empty that only
    // shows up on failures is a determined empty nobody reads.
    for (const n of r.notes ?? []) out.push(`      looked, found none: ${n}`);
  }
  const failed = rs.filter((r) => r.verdict === "failed").length;
  const undet = rs.filter((r) => r.verdict === "undetermined").length;
  out.push("");
  const findings = rs.reduce((n, r) => n + r.undeclared.length, 0);
  const empty = rs.filter((r) => r.verdict === "rendered" && r.noDirectories);
  out.push(
    `${rs.length - failed - undet} rendered${empty.length ? ` (${empty.length} declare no directories: ${empty.map((r) => r.name).join(", ")})` : ""}, ${failed} failed, ${undet} undetermined.`,
  );
  if (findings) {
    // FATAL since bean `3jj9`. The line here used to read "reported and not
    // fatal … they become fatal when collectGraphTypologies() is instance-scoped
    // and the count reaches zero — bean z4mq". Both halves have happened:
    // `collectGraphTypologies` takes a root and filters by `declaredKinds`, and
    // the count is zero across every layer in this repository.
    //
    // The repository's standing rule is that a check is an error only once
    // its count is zero, and the corollary is that it should become one THEN
    // rather than later — a finding left advisory after it is clearable is
    // how the next layer quietly reacquires it.
    out.push(
      `${findings} instance(s) publish a graph typology they do not declare. An instance that ` +
        `advertises a vocabulary it cannot reach is a type that does not dereference.`,
    );
  }
  if (undet) out.push("undetermined is NOT a pass — an unreadable instance has not been shown to render.");
  return out.join("\n");
}

if (import.meta.main) {
  const repoRoot = repoRootFor(instanceRootFor(import.meta.dir));
  const roots = instancesIn(repoRoot);
  if (roots.length === 0) {
    console.error("No instance carries a declaration. That is not a clean run — nothing was checked.");
    process.exit(2);
  }
  const reports = await Promise.all(roots.map((r) => renderInstance(r)));
  console.log(process.argv.includes("--json") ? JSON.stringify(reports, null, 2) : formatReport(reports));

  // THE EXEMPTION, checked here because this is the gate it is an exemption
  // FROM. Bean `hfkl`: bootstrap is excused the visualiser and the
  // workflow visualiser, and owes its own `.jsonld`/`.json` instead.
  //
  // Checked across every layer in ONE call rather than per layer,
  // because the property that matters is not "is this claim well-formed" but
  // "how many layers claim it". The exemption is the bottom of the stack and
  // there is one bottom; a second claimant is the requirement spreading
  // upward, which a per-instance check structurally cannot see. See
  // `renderExemptionProblems`.
  const exemptionProblems = renderExemptionProblems(
    roots.map((r) => {
      const d = readDeclaration(r);
      return { name: d?.name ?? (relative(repoRoot, r) || "."), renderExemption: d?.renderExemption };
    }),
  );
  if (exemptionProblems.length) {
    console.error("");
    for (const p of exemptionProblems) console.error(`  \u2717 ${p}`);
    process.exit(1);
  }

  if (reports.some((r) => r.verdict === "failed")) process.exit(1);
  // Bean `3jj9`: fatal now that the count is zero. See the report text above
  // for why it was advisory until this change, and why leaving it advisory
  // after it became clearable is how the defect returns.
  if (reports.some((r) => r.undeclared.length > 0)) process.exit(1);
  if (reports.some((r) => r.verdict === "undetermined")) process.exit(2);
  process.exit(0);
}

// Re-exported for callers that already import it from here (bean `3jj9`
// moved the implementation to the declaration reader to break a cycle).
export { declaredKinds };
