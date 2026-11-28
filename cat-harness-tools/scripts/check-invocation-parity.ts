#!/usr/bin/env bun
/**
 * check-invocation-parity.ts — a preview must run the generators the deploy
 * runs, with the same layer arguments.
 *
 * A preview that skips an export the deploy runs (e.g. `kg-export.ts
 * --instance ./bootstrap`) publishes links to documents its build never
 * wrote. This checks SYMMETRY, not resolution: does the preview invoke what
 * the deploy invokes?
 *
 * Deploy and preview are derived, never named: the deploy is the workflow
 * whose graph export passes no `--base-url` (it publishes at the declared
 * `canonicalUrl`); a preview passes one. A new site workflow is classified as
 * soon as it exists.
 *
 * Not checked: that the documents resolve. Both workflows dropping a
 * generator together passes.
 *
 * @module scripts/check-invocation-parity
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { exitNotApplicable } from "./lib/not-applicable.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const WORKFLOW_DIR = join(REPO_ROOT, ".github", "workflows");

/** A `bun run cat-harness-tools/scripts/<name>.ts` (pre-70lx: `cat-harness/scripts/…`) (or `bootstrap-tools/scripts/…`) call and the rest of its line. */
// bootstrap-tools' scripts count too, under their repository's name: since
// 2026-09-30 (bean `xsqm`) bootstrap's own graph is written by
// `bootstrap-tools/scripts/export-graph.ts --root ./bootstrap`, and a matcher
// that saw only cat-harness would be blind to the one foreign-instance export
// `3jhq` exists to protect.
const INVOCATION = /(?:cat-harness(?:-tools)?\/|(bootstrap-tools\/))scripts\/([a-z0-9-]+)\.ts([^\n]*)/g;

/**
 * A `bun run check:<name>` call: a CHECK the deploy runs over its built tree.
 *
 * Counted as an obligation like a generator (bean `63es`). `check:escaped-markup`
 * and `check:maintained-artefacts` ran only in the deploy, so the matcher above
 * (which reads script PATHS) never saw them, and a `<slide>` line that broke
 * every publish from #1615 on stayed green on each pull request's preview
 * (#1726). They are invoked by declared script name on purpose (`unrunScripts`
 * reads names), so the name is the thing to match.
 */
const NAMED_CHECK = /\bbun run (?:cat )?(check:[a-z0-9:-]+)/g;

/**
 * Generators the deploy runs that a preview is not expected to.
 *
 * A LIST, and a short one — two entries, each with the reason it is not a
 * finding. It is the hand-maintained part of this check and therefore the part
 * most likely to rot, so a stale entry is itself reported: an exemption for a
 * generator the deploy no longer runs is a finding, not a silent no-op. That
 * is the `ALLOWED` discipline `tdu3` already established one gate over.
 */
export interface Exemption {
  script: string;
  reason: string;
}
export const EXEMPT: readonly Exemption[] = [
  {
    script: "fsh-guts-export",
    reason:
      "the trashcan, reachable BY NAME and by nothing else — the export strips " +
      "`fsh-guts` from every graph it publishes, so no link target depends on it",
  },
  {
    script: "restore-staging",
    reason: "restores the previews a deploy would otherwise overwrite; a preview has none to restore",
  },
  {
    script: "docs-cone-dryrun",
    reason:
      "a DRY RUN of the deploy's page cone (bean fwtz): it writes no page, only its verdict into " +
      "the deploy's build.json, so a preview that skips it serves exactly the same site",
  },
  {
    script: "writer-cone-verify",
    reason:
      "a DRY RUN that judges the deploy's writers against the records writer-records.yml kept " +
      "after the last deploy (bean fwtz); it writes no page, and a preview has no deploy to compare",
  },
] as const;

export interface Invocation {
  /** The generator's basename, without `.ts`. */
  script: string;
  /** Its `--instance` argument, when it takes one — the flag `3jhq` turned on. */
  instance?: string;
}

export interface PeerVerdict {
  workflow: string;
  /** Deploy invocations this workflow does not make, exemptions removed. */
  missing: Invocation[];
}

export interface ParityReport {
  deploy?: string;
  peers: PeerVerdict[];
  /** Exemptions naming a generator the deploy no longer runs. */
  staleExemptions: string[];
  unreadable?: string;
  /**
   * Set when the root's workflows were read and NONE builds a site and
   * exports the graph: there is no deploy and no preview to compare, which is
   * a determined fact about this root, not a reference this check failed to
   * find (cat-harness-tools#1701).
   */
  notApplicable?: string;
}

/** A workflow's text with comment lines removed — prose is not an invocation. */
export function withoutComments(text: string): string {
  return text
    .split("\n")
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
}

/** Every generator a workflow invokes, with its `--instance` argument. */
export function invocations(workflowText: string): Invocation[] {
  const out = new Map<string, Invocation>();
  const code = withoutComments(workflowText);
  INVOCATION.lastIndex = 0;
  for (const m of code.matchAll(INVOCATION)) {
    const script = `${m[1] ?? ""}${m[2]!}`;
    const rest = m[3] ?? "";
    // `--root` is bootstrap-tools' spelling of the same argument.
    const inst = /--(?:instance|root)\s+(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(rest);
    const instance = inst ? (inst[1] ?? inst[2] ?? inst[3]) : undefined;
    // Keyed on the PAIR: `kg-export` and `kg-export --instance ./bootstrap`
    // are different obligations, and collapsing them is exactly how `3jhq`
    // hid — staging ran the exporter, just not for the foreign layer.
    const key = `${script}\u0000${instance ?? ""}`;
    if (!out.has(key)) out.set(key, instance === undefined ? { script } : { script, instance });
  }
  NAMED_CHECK.lastIndex = 0;
  for (const m of code.matchAll(NAMED_CHECK)) {
    const key = `${m[1]!}\u0000`;
    if (!out.has(key)) out.set(key, { script: m[1]! });
  }
  return [...out.values()].sort((a, b) =>
    `${a.script}${a.instance ?? ""}`.localeCompare(`${b.script}${b.instance ?? ""}`),
  );
}

/** Does this workflow publish at the canonical base — i.e. is it the deploy? */
export function isDeploy(workflowText: string): boolean {
  const code = withoutComments(workflowText);
  const m = /cat-harness(?:-tools)?\/scripts\/kg-export\.ts([^\n]*)/.exec(code);
  return m !== null && !/--base-url/.test(m[1] ?? "");
}

export function checkInvocationParity(dir: string = WORKFLOW_DIR): ParityReport {
  let files: string[];
  try {
    files = readdirSync(dir)
      .map(String)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
  } catch (e) {
    return { peers: [], staleExemptions: [], unreadable: `${dir} could not be listed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const graphWorkflows: Array<{ name: string; text: string }> = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(join(dir, f), "utf-8");
    } catch {
      continue;
    }
    // Only a workflow that BUILDS A SITE AND EXPORTS THE GRAPH is in this
    // comparison. `discoverability-docs.yml` and `publish.yml` touch `_site`
    // and invoke no generator, so they publish something else and owe nothing
    // here; reporting them would be noise about a question nobody asked.
    if (!/\.\/_site/.test(text)) continue;
    if (!/cat-harness(?:-tools)?\/scripts\/kg-export\.ts/.test(withoutComments(text))) continue;
    graphWorkflows.push({ name: f, text });
  }

  // cat-harness-tools#1701: a root whose workflows build no site that exports
  // the graph (a content instance such as smart-ips-pilgrimage, whose site is
  // built by the IG publisher and whose harness checks run through the
  // reusable layer-pr-checks workflow) has no deploy/preview pair to hold to
  // parity. That is determined from its own workflows, so it is NOT
  // APPLICABLE here rather than "could not determine". A root with at least
  // one such workflow and no identifiable deploy is still undetermined below.
  if (graphWorkflows.length === 0) {
    return {
      peers: [],
      staleExemptions: [],
      notApplicable:
        `none of the ${String(files.length)} workflow(s) in ${dir} builds a site (\`./_site\`) and exports the graph ` +
        "(`kg-export.ts`), so this root has no deploy and no preview to compare",
    };
  }

  const deploy = graphWorkflows.find((w) => isDeploy(w.text));
  if (deploy === undefined) {
    return {
      peers: [],
      staleExemptions: [],
      unreadable:
        `none of ${String(graphWorkflows.length)} site workflow(s) exports the graph without ` +
        "`--base-url`, so none publishes at the canonical base and the deploy cannot be identified",
    };
  }

  const wanted = invocations(deploy.text);
  const exemptScripts = new Set(EXEMPT.map((e) => e.script));
  const deployScripts = new Set(wanted.map((i) => i.script));
  // An exemption for something the deploy no longer runs excuses nothing, and
  // an allow-list nobody prunes becomes a blind spot. Reported as a finding in
  // its own right.
  const staleExemptions = [...exemptScripts].filter((s) => !deployScripts.has(s)).sort();

  const peers: PeerVerdict[] = [];
  for (const w of graphWorkflows) {
    if (w.name === deploy.name) continue;
    const have = new Set(invocations(w.text).map((i) => `${i.script}\u0000${i.instance ?? ""}`));
    const missing = wanted.filter(
      (i) => !exemptScripts.has(i.script) && !have.has(`${i.script}\u0000${i.instance ?? ""}`),
    );
    peers.push({ workflow: w.name, missing });
  }
  return { deploy: deploy.name, peers, staleExemptions };
}

export function formatReport(r: ParityReport): string {
  const out: string[] = ["Invocation parity"];
  if (r.unreadable !== undefined) {
    out.push(`  ? COULD NOT DETERMINE — ${r.unreadable}.`);
    out.push("    A comparison with no reference is not a pass.");
    return out.join("\n");
  }
  if (r.peers.length === 0) {
    out.push(`  ? EXAMINED NOTHING — the deploy is \`${r.deploy ?? "?"}\` and no other workflow`);
    out.push("    builds a site and exports the graph. Either the previews are gone, or this");
    out.push("    check stopped recognising them. Both are findings; neither is a pass.");
    return out.join("\n");
  }

  out[0] = `Invocation parity (deploy: ${r.deploy ?? "?"}, ${r.peers.length} preview(s))`;
  let bad = false;
  for (const s of r.staleExemptions) {
    bad = true;
    out.push(`  ✗ EXEMPTION IS STALE: \`${s}\` — the deploy no longer runs it, so the`);
    out.push("      exemption excuses nothing and hides the next one. Remove it.");
  }
  for (const p of r.peers) {
    if (p.missing.length === 0) {
      out.push(`  ✓ ${p.workflow} — runs everything the deploy runs`);
      continue;
    }
    bad = true;
    out.push(`  ✗ ${p.workflow} does not run ${String(p.missing.length)} of the deploy's invocation(s):`);
    for (const m of p.missing) {
      out.push(`      ${m.script}${m.instance === undefined ? "" : ` --instance ${m.instance}`}`);
    }
  }
  if (!bad) {
    out.push(`    ${String(EXEMPT.length)} deploy-only generator(s) exempt, each with its reason:`);
    for (const e of EXEMPT) out.push(`      ${e.script} — ${e.reason}`);
    return out.join("\n");
  }
  out.push("");
  out.push("  A preview that skips one of the deploy's invocations serves a site missing");
  out.push("  whatever it wrote. `3jhq` was exactly this: the exporter ran, but not for the");
  out.push("  foreign instance, so two links 404ed on every preview.");
  out.push("");
  out.push("  If the difference is DELIBERATE, add it to `EXEMPT` with the reason — that is");
  out.push("  the list's purpose, and a stale entry there is reported rather than tolerated.");
  return out.join("\n");
}

if (import.meta.main) {
  const report = checkInvocationParity();
  if (report.notApplicable !== undefined) exitNotApplicable("check:invocation-parity", report.notApplicable);
  const clean =
    report.unreadable === undefined &&
    report.peers.length > 0 &&
    report.staleExemptions.length === 0 &&
    report.peers.every((p) => p.missing.length === 0);
  (clean ? console.log : console.error)(formatReport(report));
  process.exit(clean ? 0 : 1);
}
