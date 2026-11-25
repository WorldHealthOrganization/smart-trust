/**
 * Every QA verdict is written by an actor holding the `qa-reporting`
 * permission (declared in `skills/permissions/permissions.json`).
 *
 * A `QaReviewer.id` is often a script path or an ad-hoc agent name rather than
 * a declared actor, so three outcomes are counted apart:
 *
 * | outcome | meaning | gate |
 * |---|---|---|
 * | **permitted** | `actor` resolves and holds `qa-reporting` | pass |
 * | **forbidden** | `actor` resolves and does NOT hold it | **FAIL, always** |
 * | **unresolved** | no `actor`, or one naming no declared actor | baseline; fails on a NEW one |
 *
 * `forbidden` is never baselined. The `unresolved` baseline can only shrink:
 * an entry that stops matching is reported **stale**.
 *
 * Exception: a **"could not dispatch"** record may be written by anyone,
 * including the producer. It is identified structurally (`metrics.dispatch:
 * "unavailable"`, per `isCouldNotDispatch`), never by reviewer name.
 *
 * The gate reads the derived results tree and the declared `attestations`
 * tree (`test/attestations/`), and reports its population:
 *
 * - a `forbidden` entry fails (exit 1) wherever it was found;
 * - an ABSENT results tree is exit 2, *could not determine*, and the baseline
 *   is NOT judged — no entry is called stale over a corpus nobody looked at;
 * - zero verdict-bearing entries examined is exit 2 through `vacuityRefusal`.
 *
 * On a CONTENT root (`rootProfile`, `lib/root-gate-set.ts`), which does not
 * own the derived corpus, an absent tree with nothing forbidden exits 78
 * (`lib/not-applicable.ts`), not applicable. A harness root with the tree
 * absent still exits 2, and a `forbidden` entry still exits 1 in either.
 *
 * @module scripts/check-qa-reviewer-permission
 * @covers policies, scenarios
 */

import { readPolicyGrants } from "../schemas/content/odrl.js";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { findDeclarationFile, layerRootNamed } from "../schemas/kg/instance-roots.ts";
import type { QaCriterionEntry, QaReviewer } from "../schemas/sdlc/block-qa.ts";
import { vacuityRefusal, type Source } from "./vacuity-refusal.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { rootProfile } from "./lib/root-gate-set.ts";
import { overlayDirs } from "./lib/layer-output.ts";
const TOOLS_ROOT = resolve(import.meta.dir, "..");

/**
 * True when the derived tree is absent and `root` is a CONTENT root
 * (`rootProfile`): the corpus is not this root's, so the gate does not apply
 * (exit 78). False for a harness root, which owns the corpus and exits 2 when
 * it is absent, and whenever the tree is present.
 */
export function absentCorpusIsNotOurs(derivedPresent: boolean, root: string): boolean {
  return !derivedPresent && rootProfile(root) === "content";
}

/** Why the gate does not apply in a root that does not own the derived corpus — printed with exit 78. */
export function notOwnedReason(results: string, baselined: number, attested: number): string {
  return (
    `${results} is absent and this is a content root (no gates workflow publishes the derived QA corpus here), ` +
    `so the corpus is not this root's to judge; ${baselined} baselined reviewer id(s) were not evaluated and none is stale. ` +
    `${attested} attested entr(y/ies) were examined and none is forbidden`
  );
}

function isCheckerWitness(entry: QaCriterionEntry): boolean {
  return entry.result === "n/a" && entry.metrics?.role === "checker";
}

function isCouldNotDispatch(entry: QaCriterionEntry): boolean {
  return entry.result === "n/a" && entry.metrics?.dispatch === "unavailable";
}

function directoryForGraph(instanceRoot: string, graphKind: string): string | undefined {
  const file = findDeclarationFile(instanceRoot);
  if (!file) return undefined;
  try {
    const decl = JSON.parse(readFileSync(join(instanceRoot, file), "utf-8")) as {
      directories?: Array<{ path?: string; scope?: string; graphTypologies?: string[]; graphKinds?: string[] }>;
    };
    const hit = (decl.directories ?? []).find(
      (d) => typeof d.path === "string" && (d.graphTypologies ?? d.graphKinds ?? []).includes(graphKind),
    );
    if (!hit?.path) return undefined;
    const base = hit.scope === "repository" ? resolve(instanceRoot, "..") : instanceRoot;
    return join(base, hit.path.replace(/\/+$/, ""));
  } catch {
    return undefined;
  }
}

function actorsDir(repoRoot: string): string | undefined {
  const platform = layerRootNamed(repoRoot, "cat-harness");
  if (!platform) return undefined;
  const scenarios = directoryForGraph(platform, "scenarios");
  return scenarios ? join(scenarios, "actors") : undefined;
}

const ROOT = join(import.meta.dir, "..", "..");
const ACTOR_DIR = actorsDir(ROOT);
// declared-path-literal: the convention home of cat-harness's ODRL policies
// (issue #1180), beside the actor registry this gate already reads by path.
const POLICY_DIR = join(ROOT, "cat-harness", "policies");
const RESULTS = join(ROOT, "cat-harness", "test", "results");
/**
 * The judgement half (bean `2gst`), read from the DECLARATION. Agent and human
 * entries are what this gate exists to judge, and they stay on `main` when the
 * derived results leave it — so this is the half that is never "not fetched".
 */
function attestationsDir(): string | undefined {
  return directoryForGraph(join(ROOT, "cat-harness"), "attestations");
}
const BASELINE = join(TOOLS_ROOT, "scripts", "qa-reviewer-permission-baseline.json");
const PERMISSION = "qa-reporting";

export type Outcome = "permitted" | "forbidden" | "unresolved";

/** Every declared actor's permission set, keyed by id. */
export function readActors(
  dir: string | undefined = ACTOR_DIR,
  grants: ReadonlyMap<string, readonly string[]> = readPolicyGrants(POLICY_DIR),
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!dir || !existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const d = JSON.parse(readFileSync(join(dir, f), "utf-8")) as {
        id?: string;
        permissions?: string[];
      };
      // The ODRL policies hold what an actor may do (issue #1180); a file that
      // still lists its own `permissions` is an unmigrated registry, and wins.
      if (d.id) out.set(d.id, new Set(d.permissions ?? grants.get(d.id) ?? []));
    } catch {
      // A malformed actor file is not this gate's finding to make — the role
      // audit owns it. Skipping here would be wrong if it hid a defect, but an
      // actor nobody can parse resolves nothing, which the `unresolved` count
      // already says.
    }
  }
  return out;
}

/**
 * May this reviewer emit a verdict?
 *
 * Three outcomes, never two. Collapsing `unresolved` into either of the others
 * is the whole failure mode: into `permitted` and the gate is decorative; into
 * `forbidden` and it fails on a corpus nobody has migrated yet.
 */
export function reviewerOutcome(reviewer: QaReviewer | undefined, actors: Map<string, Set<string>>): Outcome {
  const id = reviewer?.actor;
  if (!id) return "unresolved";
  const perms = actors.get(id);
  if (!perms) return "unresolved";
  return perms.has(PERMISSION) ? "permitted" : "forbidden";
}

export interface Finding {
  file: string;
  criterion: string;
  reviewer: string;
  actor?: string;
  outcome: Outcome;
}

function walkJson(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkJson(p, out);
    else if (e.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Scan every QA sidecar and classify each verdict-bearing entry. */
export function scan(resultsDir: string = RESULTS, actors = readActors()): Finding[] {
  return scanCounted(resultsDir, actors).findings;
}

/**
 * {@link scan}, plus the population: how many verdict-bearing entries were
 * EXAMINED (permitted ones included), and whether the directory was there.
 * Zero examined must not read as "no defect" (bean `c8uq`).
 */
export function scanCounted(
  resultsDir: string,
  actors = readActors(),
): { findings: Finding[]; examined: number; present: boolean } {
  const findings: Finding[] = [];
  let examined = 0;
  // The results tree through the layer output overlay (bean `cat-tools-sm8r`,
  // item 4): a mounted layer's results are under `build/layers/<instance>/`.
  // Each file is named by its path in the layer, the output root winning.
  const dirs = overlayDirs(resultsDir);
  const byLogical = new Map<string, string>();
  for (const d of dirs) {
    for (const at of walkJson(d)) {
      const logical = join(resultsDir, relative(d, at));
      if (!byLogical.has(logical)) byLogical.set(logical, at);
    }
  }
  for (const [file, at] of [...byLogical].sort(([a], [b]) => a.localeCompare(b))) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(at, "utf-8"));
    } catch {
      continue;
    }
    const criteria = (doc as { criteria?: Record<string, QaCriterionEntry[]> }).criteria;
    if (!criteria || typeof criteria !== "object") continue;
    for (const [criterion, entries] of Object.entries(criteria)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        // Two exemptions, both identified STRUCTURALLY so neither can be
        // claimed by asserting it.
        //
        // 1. A "could not dispatch" record — the producer may write this one,
        //    and only this one. The owner's ruling of 2026-09-21.
        // 2. A CHECKER's witness. `untainted-checker` deliberately holds no
        //    `qa-reporting`, because it rules on nothing; its `n/a` carries
        //    the intermediate a reader needs, not a finding. Without this the
        //    honest half of the mechanism would fail the gate built to protect
        //    it — while a checker entry carrying a REAL verdict still lands in
        //    `forbidden`, which is the defect worth catching.
        //
        // Rejected: exempting every `n/a`. It is the tempting simplification
        // and it is wrong — 3,173 of 5,896 entries are `n/a` (54%), and "this
        // criterion does not apply here" is precisely the claim that produces
        // a false pass when it is wrong. Exempting it would blind the gate to
        // the `dh4f` shape this whole epic is about.
        examined++;
        if (isCouldNotDispatch(entry) || isCheckerWitness(entry)) continue;
        const outcome = reviewerOutcome(entry.reviewer, actors);
        if (outcome === "permitted") continue;
        findings.push({
          file: relative(ROOT, file),
          criterion,
          reviewer: entry.reviewer?.id ?? "(none)",
          actor: entry.reviewer?.actor,
          outcome,
        });
      }
    }
  }
  return { findings, examined, present: dirs.length > 0 };
}

/** The backlog key: a reviewer id, not a file — the corpus has thousands of files and nine ids. */
export function baselineKey(f: Finding): string {
  return `${f.outcome}:${f.reviewer}`;
}

interface Baseline {
  _comment: string;
  known: string[];
}

function readBaseline(): Baseline {
  if (!existsSync(BASELINE)) return { _comment: "", known: [] };
  return JSON.parse(readFileSync(BASELINE, "utf-8")) as Baseline;
}

export function report(findings: Finding[], known: Set<string>) {
  const forbidden = findings.filter((f) => f.outcome === "forbidden");
  const unresolved = findings.filter((f) => f.outcome === "unresolved");
  const keys = new Set(findings.map(baselineKey));
  const novel = [...keys].filter((k) => !known.has(k) && !k.startsWith("forbidden:"));
  const stale = [...known].filter((k) => !keys.has(k));
  return { forbidden, unresolved, novel, stale };
}

if (import.meta.main) {
  if (!ACTOR_DIR) {
    console.log("  ? could not determine — the platform declares no `scenarios` graph in this checkout (actor registry absent)");
    process.exit(2);
  }
  const write = process.argv.includes("--write-baseline");
  const actors = readActors();
  const ATTESTATIONS = attestationsDir();
  const derived = scanCounted(RESULTS, actors);
  const judged = ATTESTATIONS
    ? scanCounted(ATTESTATIONS, actors)
    : { findings: [] as Finding[], examined: 0, present: false };
  const findings = [...derived.findings, ...judged.findings];
  const base = readBaseline();
  const looked: Source[] = [
    { label: "derived results", dir: RESULTS, present: derived.present, found: derived.examined },
    {
      label: "attestations",
      dir: ATTESTATIONS ?? "(no `attestations` directory declared)",
      present: judged.present,
      found: judged.examined,
    },
  ];

  if (write) {
    // Writing a baseline from a corpus that is not here would record "nothing
    // unresolved" — the vacuous pass, made permanent.
    if (!derived.present) {
      console.error(
        `  ✗ refusing --write-baseline: ${relative(ROOT, RESULTS)} is absent, so the baseline would be written ` +
          `over a corpus nobody looked at. Run \`bun run cat qa:fetch --ref main\` first.`,
      );
      process.exit(2);
    }
    const keys = [...new Set(findings.filter((f) => f.outcome !== "forbidden").map(baselineKey))].sort();
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          _comment:
            "Reviewer ids whose ACTOR does not resolve, so `qa-reporting` cannot be evaluated for them. " +
            "One key per reviewer id, not per file: the corpus has thousands of sidecars and nine ids. " +
            "A `forbidden` outcome is NEVER baselined — a producer writing its own verdict is the defect " +
            "the discipline exists to forbid. This list may only SHRINK: an entry that stops matching is " +
            "reported stale so it cannot quietly grow. Refresh with --write-baseline.",
          known: keys,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`  ✓ baseline written — ${keys.length} unresolved reviewer id(s)`);
    process.exit(0);
  }

  const { forbidden, unresolved, novel, stale: staleIfJudged } = report(findings, new Set(base.known));
  // The baseline describes the DERIVED corpus. With that corpus absent every
  // entry would read stale, and "remove it" is the instruction that turns the
  // next run into a pass over nothing. So it is not judged at all.
  const stale = derived.present ? staleIfJudged : [];
  const total = findings.length;
  console.log(
    `QA reviewer permission (${actors.size} declared actor(s), ` +
      `${[...actors.values()].filter((p) => p.has(PERMISSION)).length} holding \`${PERMISSION}\`; ` +
      `${derived.examined} derived + ${judged.examined} attested entr(y/ies) examined)`,
  );

  let bad = false;
  for (const f of forbidden) {
    console.log(
      `  ✗ ${f.file} [${f.criterion}]: reviewer \`${f.reviewer}\` acts as \`${f.actor}\`, ` +
        `which does NOT hold \`${PERMISSION}\` — the producer is writing its own verdict`,
    );
    bad = true;
  }
  for (const k of novel) {
    console.log(`  ✗ NEW unresolved reviewer: ${k.replace(/^unresolved:/, "")} — name its \`actor\``);
    bad = true;
  }
  for (const k of stale) {
    console.log(`  ✗ stale baseline entry, remove it: ${k}`);
    bad = true;
  }

  // A determined defect outranks an unknown: a `forbidden` entry found in the
  // attestations is a failure whether or not the derived half was fetched.
  if (bad) {
    console.log(
      `  · ${total} entr(y/ies) not yet permitted; a "could not dispatch" record is exempt by design`,
    );
    process.exit(1);
  }

  // A downstream (content) root does not own the derived corpus: its absence
  // there is not an unread corpus but one this root never had (owner,
  // 2026-11-03, "(b) policy: 78 downstream"). See the module header.
  if (absentCorpusIsNotOurs(derived.present, ROOT)) {
    exitNotApplicable(
      "check:qa-reviewer-permission",
      notOwnedReason(relative(ROOT, RESULTS), base.known.length, judged.examined),
    );
  }

  const refusal = vacuityRefusal({ script: "check:qa-reviewer-permission", covers: "policies, scenarios" }, looked);
  if (!derived.present || refusal) {
    console.log(
      refusal ??
        `  ? could not determine — ${relative(ROOT, RESULTS)} is ABSENT from this checkout, so ` +
          `${base.known.length} baselined reviewer id(s) were not evaluated and NONE of them is stale.\n` +
          `    ${judged.examined} attested entr(y/ies) were examined and none is forbidden; that is not a ` +
          `verdict on the derived corpus.`,
    );
    console.log(
      `\n  The derived QA corpus lives on the \`qa-reports\` branch. Materialise it with\n` +
        `  \`bun run cat qa:fetch --ref main\` (or \`--ref pr/<n>\`) and re-run. Do NOT edit the baseline.`,
    );
    process.exit(2);
  }

  console.log(
    `  ✓ no NEW defect — 0 forbidden; ${unresolved.length} entr(y/ies) across ` +
      `${new Set(unresolved.map((f) => f.reviewer)).size} reviewer id(s) still name no actor (baselined)`,
  );
  console.log(
    `  · ${total} entr(y/ies) not yet permitted; a "could not dispatch" record is exempt by design`,
  );
  process.exit(0);
}
