/**
 * Every path a declaration NAMES resolves — directories, assets, visualisers
 * and `needs` — in the checkout being checked, whatever its layout.
 *
 * @module cat-harness-tools/scripts/check-declaration-resolution
 * @covers cat-harness — every layer declaration in the checkout
 *
 * ## Mostly composition
 *
 * Four existing gates each resolve one field; this gate CALLS them rather
 * than restating them, and resolves the rest itself:
 *
 * | field | resolved by | what it answers |
 * |---|---|---|
 * | `directories` (and those declared from within) | `check:declared-dirs` → `auditInstance` | the directory is on disk, mounted, or exempt with a reason |
 * | `assets` | `check:declared-assets` → `auditInstance` | the file exists |
 * | `visualisers[].renderedBy` | `check:visualiser-routes` → `checkVisualiserRoutes` | names a discovered Tool node |
 * | `needs` | `check:instance-graph` → `resolveInstanceGraph` | every dependency resolves, no cycle |
 * | `enableSubgraphs` (and each opt-in entry's `requires`) | here → `enableSubgraphsProblems`, `requiresProblems` | each id names an opt-in sub-graph of this layer or its `needs` closure; only an opt-in entry requires, never itself |
 * | `optInLinks` (the opt-in `directories`, as link targets) | `check:optin-links` → `checkOptInLinks` | no always-on page links into an opt-in sub-graph, which is absent wherever it is switched off |
| `optInRefs` (the opt-in `directories`, as skill homes) | `check:optin-refs` → `checkOptInRefs` | no always-on Tool's `satisfies` or workflow's skill ref names a skill only an opt-in sub-graph holds |
 *
 * It also resolves `visualisers[].coversKinds`, a graph typology, which
 * `checkVisualiserRoutes` drops unjudged (it filters to PUBLISHED kinds).
 * `covers`, a directory id, is refused by the declaration schema itself; a
 * declaration that does not parse is a finding.
 *
 * The result is one run, one verdict, per layer and per field, over the
 * checkout as it is actually laid out.
 *
 * ## The checkout is `cwd`
 *
 * There is no fixed-depth repository root. Every gate composed here reads the
 * checkout from its argument, and the graph-typology registry reads kinds
 * from the checkout under inspection (`cwd`) before the one the harness
 * module sits in (`defaultTypologyRoots`, cat-harness). So `--root` re-runs
 * this script with `cwd` set to that root: a declaration whose kinds come
 * from a mounted layer is judged against that layer, standalone or mounted
 * alike.
 *
 * ## Three states, never two
 *
 * Exit 0 every reference resolves · 1 at least one does not (reported even
 * when something else was undetermined: a certain finding is never hidden) ·
 * 2 could not determine (no layer in the checkout, or a composed gate that
 * could not run). 2 is never a pass.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-declaration-resolution.ts [--root <checkout>] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { instanceDirectories, readDeclaration, nestedDirectories, type CatHarnessDeclaration } from "../schemas/kg/cat-harness.js";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.js";
import { orderedDependencies, resolveInstanceGraph } from "../schemas/kg/harness-config.js";
import { declaredEnableSubgraphs, enableSubgraphsProblems, requiresProblems, splitQualifiedSubgraphId, type DeclaredOptIns } from "../schemas/kg/opt-in-subgraphs.js";
import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.js";
import "../schemas/kg/folio-graph-typology.js";

import { auditInstance as auditDirs } from "./check-declared-dirs.ts";
import { auditInstance as auditAssets } from "./check-declared-assets.ts";
import { checkVisualiserRoutes } from "./check-visualiser-routes.ts";
import { checkOptInLinks } from "./check-optin-links.ts";
import { checkOptInRefs } from "./check-optin-refs.ts";

/** The fields a declaration names paths or layers in, and the declaration itself (it must parse for any to be read). */
export const RESOLVED_FIELDS = ["declaration", "directories", "assets", "visualisers", "needs", "enableSubgraphs", "optInLinks", "optInRefs"] as const;
export type ResolvedField = (typeof RESOLVED_FIELDS)[number];

export interface ResolutionFinding {
  /** The layer's declared name, or its path when it has none. */
  instance: string;
  field: ResolvedField;
  /** The entry, as the declaration spells it (a directory id, an asset id, `visualisers[<id>]`, a needs name). */
  subject: string;
  /** Which composed gate decided it, so the remedy is read where the rule lives. */
  by: string;
  detail: string;
}

export interface ResolutionReport {
  root: string;
  instances: string[];
  /** Entries examined per field, summed over layers — a zero is printed, never hidden. */
  examined: Record<ResolvedField, number>;
  findings: ResolutionFinding[];
  /** Reasons this run could not decide something. Non-empty means exit 2. */
  undetermined: string[];
  /**
   * References this root cannot see and another root judges, each with the
   * reason: a mounted layer's `enableSubgraphs` id into its OWN declaration,
   * when that layer's opt-in directories are not laid down here. Printed,
   * never counted.
   */
  notJudgedHere?: string[];
}

type Visualiser = { id: string; renderedBy?: string; covers?: string[]; coversKinds?: string[] };

/**
 * `coversKinds` — the one reference no composed gate resolves. Pure, so a test
 * can hand it any visualisers and any notion of a known kind.
 */
export function coverageFindings(
  instance: string,
  visualisers: readonly Visualiser[],
  isKind: (k: string) => boolean,
): ResolutionFinding[] {
  const out: ResolutionFinding[] = [];
  for (const v of visualisers) {
    for (const k of v.coversKinds ?? []) {
      if (!isKind(k)) {
        out.push({
          instance,
          field: "visualisers",
          subject: `visualisers[${v.id}].coversKinds`,
          by: "check:declaration-resolution",
          detail: `"${k}" is not a registered graph typology in this checkout (its own, or one a layer it mounts contributes)`,
        });
      }
    }
  }
  return out;
}

export function checkDeclarationResolution(rootArg: string): ResolutionReport {
  const root = resolve(rootArg);
  const roots = layerRootsIn(root);
  const examined: Record<ResolvedField, number> = { declaration: 0, directories: 0, assets: 0, visualisers: 0, needs: 0, enableSubgraphs: 0, optInLinks: 0, optInRefs: 0 };
  const findings: ResolutionFinding[] = [];
  const undetermined: string[] = [];
  const notJudgedHere: string[] = [];
  const names = new Map<string, string>();

  if (roots.length === 0) {
    return { root, instances: [], examined, findings, undetermined: [`no instance declaration under ${root}`] };
  }

  for (const inst of roots) {
    let decl: CatHarnessDeclaration | undefined;
    examined.declaration += 1;
    try {
      decl = readDeclaration(inst);
    } catch (e) {
      // A declaration that does not parse names something that does not
      // resolve — an unknown kind, a `covers` id with no directory. With the
      // kinds read from THIS checkout (lesson 6) that is a finding, not "could not tell".
      findings.push({
        instance: findDeclarationFile(inst)?.replace(/\.json$/, "") ?? (relative(root, inst) || "."),
        field: "declaration",
        subject: relative(root, inst) || ".",
        by: "readDeclaration",
        detail: (e as Error).message.replace(/\s+/g, " ").slice(0, 600),
      });
      continue;
    }
    if (decl === undefined) continue;
    const name = decl.name ?? (relative(root, inst) || basename(root));
    names.set(resolve(inst), name);

    // directories — check:declared-dirs, own and from within.
    let nestedIds: string[] = [];
    try {
      nestedIds = nestedDirectories(inst, decl).map((n) => n.id);
    } catch {
      nestedIds = [];
    }
    examined.directories += (decl.directories?.length ?? 0) + nestedIds.length;
    try {
      for (const f of auditDirs(inst, root, roots)) {
        findings.push({ instance: name, field: "directories", subject: `${f.id} (${f.path})`, by: "check:declared-dirs", detail: `${f.kind} — ${f.detail}` });
      }
    } catch (e) {
      undetermined.push(`${name}: check:declared-dirs could not run — ${(e as Error).message.split("\n")[0]}`);
    }

    // assets — check:declared-assets (missing only: a dead link inside a file is not a path the DECLARATION names).
    const assets = (decl as { assets?: unknown[] }).assets ?? [];
    examined.assets += assets.length;
    try {
      for (const f of auditAssets(inst).findings) {
        if (f.kind !== "missing") continue;
        findings.push({ instance: name, field: "assets", subject: f.asset, by: "check:declared-assets", detail: `declared and not on disk: ${f.detail}` });
      }
    } catch (e) {
      undetermined.push(`${name}: check:declared-assets could not run — ${(e as Error).message.split("\n")[0]}`);
    }

    // visualisers — coversKinds here; renderedBy below, once per checkout.
    const vis = ((decl as { visualisers?: Visualiser[] }).visualisers ?? []) as Visualiser[];
    examined.visualisers += vis.length;
    findings.push(...coverageFindings(name, vis, (k) => defaultGraphTypologies.has(k)));

    // needs — check:instance-graph's resolver.
    examined.needs += decl.needs?.length ?? 0;
    try {
      for (const p of resolveInstanceGraph(inst).problems) {
        findings.push({
          instance: name,
          field: "needs",
          subject: p.kind === "missing" ? p.name : p.roots.map((r) => relative(root, r) || ".").join(" → "),
          by: "check:instance-graph",
          detail: `${p.kind} — ${p.detail}`,
        });
      }
    } catch (e) {
      undetermined.push(`${name}: the dependency graph could not be resolved — ${(e as Error).message.split("\n")[0]}`);
    }

    // enableSubgraphs — each id names an opt-in sub-graph (`optIn: true`) of
    // this layer or one in its `needs` closure, top level or from within.
    // An opt-in entry's `requires` is held to the same rule, and only an
    // opt-in entry may carry one (owner, 2026-11-13).
    const enable = decl.enableSubgraphs ?? [];
    // Top level AND from within: an opt-in group inside an opt-in level
    // (an `L2/collab/` inside `L2/`) carries its `requires` in that level's
    // graph.json, and `promoteFromWithin` keeps the raw field.
    let all: ReturnType<typeof instanceDirectories>;
    try {
      all = instanceDirectories(inst, decl);
    } catch {
      all = (decl.directories ?? []) as ReturnType<typeof instanceDirectories>; // a nested file that will not read is check:harness-dirs' finding
    }
    const requiring = all.filter(
      (d): d is typeof d & { requires: string[] } => Array.isArray((d as { requires?: unknown }).requires) && (d as { requires: unknown[] }).requires.length > 0,
    ) as Array<{ id: string; optIn?: boolean; requires: string[] }>;
    examined.enableSubgraphs += enable.length + requiring.reduce((n, d) => n + d.requires.length, 0);
    if (enable.length > 0 || requiring.length > 0) {
      try {
        const closure: DeclaredOptIns[] = [{ name, directories: instanceDirectories(inst, decl) }];
        for (const dep of orderedDependencies(inst)) {
          const dd = readDeclaration(dep.rootPath);
          if (dd !== undefined) closure.push({ name: dd.name, directories: instanceDirectories(dep.rootPath, dd) });
        }
        // A layer's id into its OWN declaration can name a group declared from
        // within one of its opt-in directories (`<layer>.L2-collab`, inside
        // `L2/graph.json`). A root that does not enable that directory does not
        // have it mounted, so the group's declaration is not on disk here, and
        // "declares no directory" would be a claim about bytes this root never
        // received. The layer's own root has every directory on disk and judges
        // it there; this root says which ids it left to that root.
        const optInDirs = (decl.directories ?? []) as Array<{ id?: string; path?: string; optIn?: boolean }>;
        const unmounted =
          resolve(inst) === root
            ? []
            : optInDirs
                .filter((d) => d.optIn === true && typeof d.path === "string" && !existsSync(join(inst, d.path)))
                .map((d) => d.id ?? d.path);
        for (const p of enableSubgraphsProblems(name, enable, closure)) {
          const own = splitQualifiedSubgraphId(p.id)?.instance === name;
          if (own && unmounted.length > 0 && p.detail.startsWith(`\`${name}\` declares no directory`)) {
            notJudgedHere.push(
              `${name} enableSubgraphs ${p.id}: ${name}'s opt-in director${unmounted.length === 1 ? "y" : "ies"} ` +
                `${unmounted.map((u) => `\`${u}\``).join(", ")} ${unmounted.length === 1 ? "is" : "are"} not mounted in this root, ` +
                `so a group declared from within ${unmounted.length === 1 ? "it" : "them"} cannot be seen here; ${name}'s own root judges it`,
            );
            continue;
          }
          findings.push({ instance: name, field: "enableSubgraphs", subject: p.id, by: "check:declaration-resolution", detail: p.detail });
        }
        for (const p of requiresProblems(name, requiring, closure)) {
          findings.push({ instance: name, field: "enableSubgraphs", subject: `${p.id}.requires`, by: "check:declaration-resolution", detail: p.detail });
        }
      } catch (e) {
        undetermined.push(`${name}: its enableSubgraphs could not be resolved — ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }

  // An index root declares no layer, so its `enableSubgraphs` is in its
  // index.config.json (step 23.4). Each id names an opt-in sub-graph of a
  // layer in this checkout, held to the same rule as a declaration's list.
  if (findDeclarationFile(root) === undefined) {
    const enable = declaredEnableSubgraphs(root);
    examined.enableSubgraphs += enable.length;
    if (enable.length > 0) {
      try {
        const closure: DeclaredOptIns[] = [];
        for (const r of roots) {
          const d = readDeclaration(r);
          if (d !== undefined) closure.push({ name: d.name, directories: instanceDirectories(r, d) });
        }
        for (const p of enableSubgraphsProblems("this index", enable, closure)) {
          findings.push({ instance: "(index)", field: "enableSubgraphs", subject: p.id, by: "check:declaration-resolution", detail: p.detail });
        }
      } catch (e) {
        undetermined.push(`(index): its enableSubgraphs could not be resolved — ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }

  // renderedBy — check:visualiser-routes, which discovers the Tool nodes once.
  if (examined.visualisers > 0) {
    try {
      const routes = checkVisualiserRoutes(root);
      if (routes.undetermined) undetermined.push(`check:visualiser-routes: ${routes.undetermined}`);
      for (const f of routes.findings) {
        if (f.kind !== "unknown-tool") continue;
        findings.push({ instance: f.subject.split(".visualisers[")[0] ?? f.subject, field: "visualisers", subject: f.subject, by: "check:visualiser-routes", detail: f.detail });
      }
    } catch (e) {
      undetermined.push(`check:visualiser-routes could not run — ${(e as Error).message.split("\n")[0]}`);
    }
  }

  // A link from an always-on page into an opt-in sub-graph resolves only where
  // the group is switched on — check:optin-links (owner, 2026-11-11: a gate
  // fails on them, each fixed by hand; turned on once every link was fixed).
  // `optInLinks` counts the pages read.
  try {
    const links = checkOptInLinks(root);
    examined.optInLinks = links.files;
    const own = [...names.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const f of links.findings) {
      const abs = resolve(root, f.file);
      const layer = own.find(([dir]) => abs === dir || abs.startsWith(dir + "/"));
      findings.push({
        instance: layer?.[1] ?? f.file.split("/")[0]!,
        field: "optInLinks",
        subject: f.file,
        by: "check:optin-links",
        detail: `links ${f.target}, inside opt-in \`${f.group}\` — dead wherever that group is switched off; fix the link by hand`,
      });
    }
  } catch (e) {
    undetermined.push(`check:optin-links could not run — ${(e as Error).message.split("\n")[0]}`);
  }

  // The same defect for references that are not Markdown links: an always-on
  // Tool's `satisfies`, or a workflow's skill ref, naming a skill only an
  // opt-in sub-graph holds — check:optin-refs (owner, 2026-11-12, card
  // Q-OPTINREFS-CI B: gated now, each finding fixed at its source).
  // `optInRefs` counts the Tools and workflow files read.
  try {
    const refs = checkOptInRefs(root);
    examined.optInRefs = refs.tools + refs.workflows;
    const own = [...names.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const f of refs.findings) {
      const abs = resolve(root, f.from);
      // A Tool is named by id (discovery keeps no file), so it stands as its own subject.
      const layer = f.kind === "workflow" ? own.find(([dir]) => abs === dir || abs.startsWith(dir + "/")) : undefined;
      findings.push({
        instance: layer?.[1] ?? (f.kind === "workflow" ? f.from.split("/")[0]! : f.from),
        field: "optInRefs",
        subject: f.from,
        by: "check:optin-refs",
        detail: `names skill ${f.ref} (${f.kind}), held only inside opt-in ${f.groups.map((g) => `\`${g}\``).join(", ")} — dangling wherever that group is switched off; fix it at its source by hand`,
      });
    }
  } catch (e) {
    undetermined.push(`check:optin-refs could not run — ${(e as Error).message.split("\n")[0]}`);
  }

  // A kind problem is reported once per needs edge by every dependent; say each once.
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const k = `${f.instance}\u0000${f.field}\u0000${f.subject}\u0000${f.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { root, instances: [...names.values()].sort(), examined, findings: unique, undetermined, notJudgedHere };
}

/** A certain finding is never hidden behind an undetermined one: 1 before 2. */
export function exitCodeOf(r: ResolutionReport): 0 | 1 | 2 {
  if (r.findings.length > 0) return 1;
  if (r.undetermined.length > 0 || r.instances.length === 0) return 2;
  return 0;
}

export function formatResolution(r: ResolutionReport): string {
  const lines: string[] = [];
  for (const f of r.findings) lines.push(`  ✗ ${f.instance} ${f.field} ${f.subject} [${f.by}]: ${f.detail}`);
  for (const u of r.undetermined) lines.push(`  ? ${u}`);
  for (const n of r.notJudgedHere ?? []) lines.push(`  · not judged here: ${n}`);
  const counts = RESOLVED_FIELDS.map((k) => `${r.examined[k]} ${k}`).join(", ");
  const verdict = exitCodeOf(r) === 0 ? "✓ every reference resolves" : exitCodeOf(r) === 1 ? `✗ ${r.findings.length} unresolved` : "? COULD NOT DETERMINE — not a pass";
  lines.push(`${verdict}: ${counts} across ${r.instances.length} instance(s) (${r.instances.join(", ")}) in ${r.root}`);
  return lines.join("\n");
}

function main(argv: readonly string[]): number {
  const at = argv.indexOf("--root");
  const rootArg = at >= 0 ? argv[at + 1] : argv.find((a) => a.startsWith("--root="))?.slice("--root=".length);
  if (rootArg !== undefined && resolve(rootArg) !== resolve(process.cwd())) {
    // The registry reads kinds from the checkout under inspection, which is
    // `cwd` at import time — so a different root is a re-run there, never a
    // path handed to modules that already loaded (lesson 6).
    const rest = argv.filter((a, i) => !(a === "--root" || i === at + 1 || a.startsWith("--root=")));
    const r = spawnSync(process.execPath, [import.meta.path, ...rest], { cwd: resolve(rootArg), stdio: "inherit" });
    return r.status ?? 2;
  }
  const report = checkDeclarationResolution(process.cwd());
  if (argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(formatResolution(report));
  return exitCodeOf(report);
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
