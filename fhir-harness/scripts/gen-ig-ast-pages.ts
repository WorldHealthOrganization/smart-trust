#!/usr/bin/env bun
/**
 * The `ig-ast` viewer: one page per layer that declares an `ig-ast`
 * directory, listing the IG ASTs it holds, and a hub at the visualiser's route.
 *
 * @module fhir-harness/scripts/gen-ig-ast-pages
 * @covers ig-ast — every directory of that kind any layer in the checkout declares
 *
 * ## Where the pages go, and who says so
 *
 * The HARNESS declares the visualiser (`visualisers` in `fhir-harness.json`,
 * `renderedBy: ig-ast-pages`, `subgraphs: "instance"`), and the route is
 * `visualiserRoute` of it: `<locale>/fhir-harness/<id>/` for the hub and
 * `<locale>/fhir-harness/<id>/<instance>/` per layer. Nothing here chooses
 * a URL. With `--site <dir>` (a site being built, `visualiser-writers.ts` in
 * cat-harness-tools) the pages are written under that site; without it, under
 * the checkout's site directory (`siteOwnerDir`). The route belongs to this
 * writer alone (`check:visualiser-routes`), so a run replaces it wholesale.
 *
 * ## What a layer page says, and what it refuses to say
 *
 * Per AST: the IG's package id (read from the AST's own ImplementationGuide
 * resource, else the branch-family key it sits under), resources in total and
 * by type, the dependency document's edges (resolved inside the IG, by
 * origin, by kind), the rebuild plan when one is recorded, and what the
 * manifest says stays provisional. Every page carries the AST's own mark: it
 * is a cache, never an authority (`ig-ast.ts`).
 *
 * An `ig-ast` directory is normally a member of a BRANCH FAMILY
 * (`storage.keyedBy: "family"`, one branch per IG package id), restored by
 * `ig-cache` and absent from a checkout by design. A declared directory that
 * is not on disk is therefore **unknown** in this build — never "0 ASTs" —
 * and the page names the family it would be restored from instead. A
 * directory that is on disk but holds no `manifest.json` says exactly that.
 *
 * ## An IG repository declares nothing: its ASTs are inherited
 *
 * An IG repository needs no `ig-ast` declaration of its own: it builds on this
 * layer through `needs`, and its site is built from the AST on its own
 * repository's branch family (`ig-build-pipeline`, "The IG repository's site
 * route"). So the viewer does not wait for one. Every layer in the checkout
 * that needs this layer, directly or through a layer above it, and declares a
 * `repository` is asked for the families in {@link AST_FAMILY_PREFIXES}
 * (`git ls-remote`, as `stage-ast-sites.ts` asks). Each family it carries
 * becomes an INHERITED directory on that layer's page, listed by key and
 * shown as unknown in this build, like any unrestored family. A layer that
 * declares an `ig-ast` directory itself is shown as declared and not asked. A
 * lookup that fails is said on the page, never read as "no AST".
 *
 * Authored text (resource names, the plan's reasons) is escaped and the page
 * is marked `render_with_liquid: false`, so a `{{` in an IG's resource name
 * cannot reach Liquid.
 *
 * Usage:
 *   bun run fhir-harness/scripts/gen-ig-ast-pages.ts [--root <checkout>] [--site <dir>] [--check]
 *
 * Exit: 0 written (or current, with `--check`) · 1 `--check` found a stale or missing page.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { checkoutRootFor, declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { checkoutDirectories } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.js";
import { declaredVisualisers, pageParts, siteOwnerDir, visualiserPageDir, withRenderedByFrontMatter, type DeclaredVisualiser } from "../../cat-harness-tools/scripts/viewer-declarations.js";
import { siteArg } from "../../cat-harness-tools/scripts/lib/site-target.ts";
import { AstPlanSchema, type AstPlan } from "../schemas/ig-ast.ts";
import { listAst, readAst, type AstListing } from "./ig-ast.ts";

/**
 * The branch families an IG's AST cache sits on: the `cat/<harness>/` scheme
 * (bean tlk2). The older `cat-fhir-ast/` and `fhir-ast/` names were retired on
 * 2026-10-24, once no IG remote carried one (bean folio-assistant-oycs).
 * `ig-cache.sh` and `stage-ast-sites.ts` read the same name.
 */
export const AST_FAMILY_PREFIXES = ["cat/fhir-harness/fhir-ast/"] as const;

/** The layer whose `needs` makes a layer an IG this viewer asks about. */
export const LAYER = "fhir-harness";

/** The Tool that draws these pages — the `renderedBy` a harness declares. */
export const TOOL_ID = "ig-ast-pages";
/** The kind it draws. */
export const KIND = "ig-ast";

// ── reading ────────────────────────────────────────────────────────────────

/** How a declared directory is stored, as far as a page needs to say. */
export interface FamilyStorage {
  branchPrefix: string;
  keyFrom?: string;
  repository?: string;
  tool?: string;
}

/** One AST found on disk. */
export interface AstSummary {
  /** Path under the declared directory, `.` when the directory itself is the AST. */
  at: string;
  /** The IG's package id, or `undefined` when neither the AST nor its location says. */
  packageId?: string;
  /** Where the package id was read from. */
  packageIdFrom?: "implementation-guide" | "family-key";
  version?: string;
  generatedAt?: string;
  sourceRevision?: string;
  toolchain?: string;
  listing?: AstListing;
  /** The edges counted by `kind`, most frequent first. */
  edgesByKind?: [string, number][];
  plan?: AstPlan;
  /** Why the plan could not be read, when `plan.json` exists but does not parse. */
  planError?: string;
  /** Why the AST could not be read at all. */
  error?: string;
}

/** One declared `ig-ast` directory of a layer. */
export interface AstDirectory {
  id: string;
  path: string;
  absPath: string;
  storage?: FamilyStorage;
  /** `null`: the directory is not on disk, so what it holds is unknown. */
  asts: AstSummary[] | null;
  /**
   * Set when the layer does not declare this directory: it was found on the
   * layer's repository because the layer needs this layer. `keys` are the
   * family's branch keys (package ids); `error` says the lookup failed.
   */
  inherited?: { keys: string[]; error?: string };
}

/** One layer holding `ig-ast` directories: the page's subject. */
export interface AstSubject {
  name: string;
  /** The layer's declared `repository`, for the family's branch links. */
  repository?: string;
  directories: AstDirectory[];
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

function readJson(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf-8"));
}

/** A layer's declaration read raw: a page must not fail on a field a newer schema refuses. */
function rawDeclaration(instanceRoot: string): Record<string, unknown> | undefined {
  try {
    const p = declarationPathIn(instanceRoot);
    return p === undefined ? undefined : (readJson(p) as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

/** The package id an AST names for itself: its ImplementationGuide resource's `packageId`. */
function packageIdOf(dir: string, resources: readonly { resourceType: string; file: string }[]): string | undefined {
  const ig = resources.find((r) => r.resourceType === "ImplementationGuide");
  if (ig === undefined) return undefined;
  try {
    return str((readJson(join(dir, ig.file)) as Record<string, unknown>)["packageId"]);
  } catch {
    return undefined;
  }
}

/** Summarise the AST in `dir`. `familyKey` is the branch-family key it sits under, when it is a member directory. */
export function summariseAst(root: string, dir: string, familyKey?: string): AstSummary {
  const at = relative(root, dir).split(sep).join("/") || ".";
  let ast;
  try {
    ast = readAst(dir);
  } catch (e) {
    return { at, ...(familyKey ? { packageId: familyKey, packageIdFrom: "family-key" as const } : {}), error: (e as Error).message };
  }
  const m = ast.manifest as typeof ast.manifest & { ig?: { version?: unknown } };
  const own = packageIdOf(dir, ast.manifest.resources);
  const byKind = new Map<string, number>();
  for (const e of ast.edges) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1);
  const out: AstSummary = {
    at,
    ...(own ? { packageId: own, packageIdFrom: "implementation-guide" as const } : familyKey ? { packageId: familyKey, packageIdFrom: "family-key" as const } : {}),
    ...(str(m.ig?.version) ? { version: str(m.ig?.version) } : {}),
    ...(m.generatedAt ? { generatedAt: m.generatedAt } : {}),
    ...(m.inputs?.sourceRevision ? { sourceRevision: m.inputs.sourceRevision } : {}),
    ...(m.inputs?.toolchain ? { toolchain: m.inputs.toolchain } : {}),
    listing: listAst(ast),
    edgesByKind: [...byKind.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
  const planFile = join(dir, "plan.json");
  if (existsSync(planFile)) {
    try {
      const p = AstPlanSchema.safeParse(readJson(planFile));
      if (p.success) out.plan = p.data;
      else out.planError = `${p.error.issues[0]?.path.join(".")}: ${p.error.issues[0]?.message}`;
    } catch (e) {
      out.planError = (e as Error).message;
    }
  }
  return out;
}

/**
 * The ASTs a declared directory holds: the directory itself when it carries a
 * `manifest.json` (a mount of ONE family member lands at the declared path),
 * else each immediate sub-directory that does (one per key). `null` when the
 * directory is not on disk — unknown, not empty.
 */
export function astsIn(absPath: string): AstSummary[] | null {
  if (!existsSync(absPath)) return null;
  if (existsSync(join(absPath, "manifest.json"))) return [summariseAst(absPath, absPath)];
  const subs = readdirSync(absPath)
    .filter((n) => !n.startsWith(".") && statSync(join(absPath, n)).isDirectory() && existsSync(join(absPath, n, "manifest.json")))
    .sort();
  return subs.map((n) => summariseAst(absPath, join(absPath, n), n));
}

interface DirLike {
  id: string;
  path: string;
  absPath: string;
  declaredBy: string;
  member?: string;
  graphTypologies?: readonly string[];
  storage?: unknown;
}

/** The layers holding a directory of `kinds`, one subject each, sorted by name. */
export function astSubjects(dirs: readonly DirLike[], kinds: readonly string[], repositoryOf: (instance: string) => string | undefined = () => undefined): AstSubject[] {
  const out = new Map<string, AstSubject>();
  for (const d of dirs) {
    if (!(d.graphTypologies ?? []).some((k) => kinds.includes(k))) continue;
    const name = d.member ?? d.declaredBy;
    const s = out.get(name) ?? { name, ...(repositoryOf(name) ? { repository: repositoryOf(name) } : {}), directories: [] };
    const st = d.storage as { keyedBy?: string; branchPrefix?: string; keyFrom?: string; repository?: string; tool?: string } | undefined;
    const storage: FamilyStorage | undefined =
      st?.keyedBy === "family" && st.branchPrefix
        ? { branchPrefix: st.branchPrefix, ...(st.keyFrom ? { keyFrom: st.keyFrom } : {}), ...(st.repository ? { repository: st.repository } : {}), ...(st.tool ? { tool: st.tool } : {}) }
        : undefined;
    s.directories.push({ id: d.id, path: d.path, absPath: d.absPath, ...(storage ? { storage } : {}), asts: astsIn(d.absPath) });
    out.set(name, s);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What `git ls-remote` found: the branch names under the families, or why it could not tell. */
export type BranchLister = (repository: string) => { branches: string[] } | { error: string };

/** Ask GitHub for `repository`'s AST family branches. */
export const lsRemote: BranchLister = (repository) => {
  const ls = spawnSync("git", ["ls-remote", "--heads", `https://github.com/${repository}`, ...AST_FAMILY_PREFIXES.map((p) => `refs/heads/${p}*`)], {
    encoding: "utf-8",
    timeout: 60_000,
  });
  if (ls.status !== 0) return { error: `git ls-remote https://github.com/${repository} failed` };
  return {
    branches: ls.stdout
      .split("\n")
      .map((l) => l.split("\t")[1]?.trim())
      .filter((r): r is string => r !== undefined && r.startsWith("refs/heads/"))
      .map((r) => r.slice("refs/heads/".length)),
  };
};

/** One layer of the checkout as the inheritance needs it. */
export interface InstanceFacts {
  name: string;
  repository?: string;
  needs: string[];
}

/** The layers that need `layer`, directly or through any layer they need. */
export function needing(instances: readonly InstanceFacts[], layer: string): Set<string> {
  const byName = new Map(instances.map((i) => [i.name, i]));
  const memo = new Map<string, boolean>();
  const visit = (name: string, seen: Set<string>): boolean => {
    if (memo.has(name)) return memo.get(name)!;
    if (seen.has(name)) return false;
    seen.add(name);
    const needs = byName.get(name)?.needs ?? [];
    const yes = needs.includes(layer) || needs.some((n) => visit(n, seen));
    memo.set(name, yes);
    return yes;
  };
  return new Set(instances.filter((i) => i.name !== layer && visit(i.name, new Set())).map((i) => i.name));
}

/**
 * The inherited subjects: every layer that needs {@link LAYER}, declares a
 * `repository`, has no declared `ig-ast` directory, and whose repository
 * carries a family (or whose lookup failed, which is said, not dropped).
 */
export function inheritedSubjects(instances: readonly InstanceFacts[], declared: ReadonlySet<string>, list: BranchLister): AstSubject[] {
  const out: AstSubject[] = [];
  const need = needing(instances, LAYER);
  for (const i of instances) {
    if (!need.has(i.name) || declared.has(i.name) || i.repository === undefined || !/^[\w.-]+\/[\w.-]+$/.test(i.repository)) continue;
    const found = list(i.repository);
    if ("error" in found) {
      out.push({ name: i.name, repository: i.repository, directories: [{ id: `${i.name} (inherited)`, path: AST_FAMILY_PREFIXES[0], absPath: "", asts: null, inherited: { keys: [], error: found.error } }] });
      continue;
    }
    const directories: AstDirectory[] = [];
    for (const prefix of AST_FAMILY_PREFIXES) {
      const keys = found.branches.filter((b) => b.startsWith(prefix) && !AST_FAMILY_PREFIXES.some((q) => q.length > prefix.length && b.startsWith(q))).map((b) => b.slice(prefix.length)).filter((k) => k.length > 0).sort();
      if (keys.length === 0) continue;
      directories.push({
        id: `${i.name} (inherited)`,
        path: prefix,
        absPath: "",
        storage: { branchPrefix: prefix, keyFrom: "the IG's package id", repository: i.repository, tool: "ig-cache" },
        asts: null,
        inherited: { keys },
      });
    }
    if (directories.length) out.push({ name: i.name, repository: i.repository, directories });
  }
  return out;
}

// ── rendering ──────────────────────────────────────────────────────────────

const esc = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (x: number): string => x.toLocaleString("en-US");

const CSS = `.iga-page table{border-collapse:collapse;margin:.5rem 0 1rem}
.iga-page th,.iga-page td{border:1px solid var(--border-color,#ccc);padding:.2rem .5rem;text-align:left;vertical-align:top}
.iga-page td.num{text-align:right}
.iga-mark{border-left:4px solid #c90;padding:.4rem .7rem;margin:.5rem 0 1rem}
.iga-sub{opacity:.8}`;

/** The page shell: Jekyll front matter, no Liquid, provenance in `rendered-by`. */
function page(title: string, body: string): string {
  return withRenderedByFrontMatter(
    `---\nlayout: default\ntitle: ${JSON.stringify(title)}\nnav_exclude: true\nrender_with_liquid: false\n---\n` +
      `<!-- Generated by fhir-harness/scripts/gen-ig-ast-pages.ts; built at publish, never edited. -->\n` +
      `<style>\n${CSS}\n</style>\n<div class="iga-page">\n${body}\n</div>\n`,
    TOOL_ID,
  );
}

/** A GitHub link to a branch, or to the family's branch list when no key is known. */
function familyHref(storage: FamilyStorage, repository: string | undefined, key?: string): string | undefined {
  const repo = storage.repository ?? repository;
  if (repo === undefined || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return undefined;
  return key === undefined
    ? `https://github.com/${repo}/branches/all?query=${encodeURIComponent(storage.branchPrefix)}`
    : `https://github.com/${repo}/tree/${storage.branchPrefix.split("/").map(encodeURIComponent).join("/")}${encodeURIComponent(key)}`;
}

/** One line for the hub and the layer list: what a directory holds, or that it is unknown. */
export function directoryVerdict(d: AstDirectory): string {
  if (d.inherited?.error !== undefined) return "inherited — lookup failed, unknown";
  if (d.inherited !== undefined) return `inherited — ${d.inherited.keys.length} branch(es) on the repository, not in this build`;
  if (d.asts === null) return "unknown — not in this build";
  if (d.asts.length === 0) return "on disk, holds no AST (no manifest.json)";
  const resources = d.asts.reduce((s, a) => s + (a.listing?.resources ?? 0), 0);
  const unreadable = d.asts.filter((a) => a.error !== undefined).length;
  return `${d.asts.length} AST(s), ${n(resources)} resource(s)${unreadable ? `, ${unreadable} unreadable` : ""}`;
}

function countTable(head: [string, string], rows: readonly [string, number][]): string {
  if (rows.length === 0) return "<p>none</p>";
  return `<table><thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead><tbody>${rows
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="num">${n(v)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function astSection(a: AstSummary, d: AstDirectory, repository: string | undefined): string {
  const id = a.packageId ?? "unknown";
  const branch = d.storage && a.packageId ? familyHref(d.storage, repository, a.packageId) : undefined;
  const heading = `<h3>${branch ? `<a href="${esc(branch)}"><code>${esc(id)}</code></a>` : `<code>${esc(id)}</code>`}${a.version ? ` ${esc(a.version)}` : ""}</h3>`;
  const from =
    a.packageIdFrom === "family-key"
      ? `<p class="iga-sub">Package id read from the family key this AST sits under; the AST names no ImplementationGuide package id itself.</p>`
      : a.packageId === undefined
        ? `<p class="iga-sub">The package id is <strong>unknown</strong>: the AST has no ImplementationGuide resource naming one.</p>`
        : "";
  if (a.error !== undefined) {
    return `${heading}${from}<p>At <code>${esc(a.at)}</code>. Could not be read, so what it holds is <strong>unknown</strong>: ${esc(a.error)}</p>`;
  }
  const l = a.listing!;
  const facts = [
    `<li>${a.at === "." ? "The declared directory itself" : `At <code>${esc(a.at)}</code>`}${a.generatedAt ? `, generated ${esc(a.generatedAt)}` : ""}</li>`,
    a.sourceRevision ? `<li>Built from source revision <code>${esc(a.sourceRevision)}</code></li>` : "",
    a.toolchain ? `<li>Toolchain: ${esc(a.toolchain)}</li>` : "",
    `<li><strong>${n(l.resources)}</strong> resource(s) across ${n(Object.keys(l.byType).length)} type(s)</li>`,
    `<li><strong>${n(l.edges)}</strong> dependency edge(s), ${n(l.edgesResolvedInIg)} resolved inside the IG, ${n(l.edges - l.edgesResolvedInIg)} pointing elsewhere</li>`,
    l.mixed ? `<li>Mixed provenance: ${Object.entries(l.builtAt).map(([k, v]) => `${n(v)} built at <code>${esc(k)}</code>`).join(", ")}</li>` : "",
  ].filter(Boolean);
  const plan =
    a.plan !== undefined
      ? `<h4>Rebuild plan</h4><ul><li>Decision: <code>${esc(a.plan.decision)}</code></li>` +
        (a.plan.rebuild !== undefined ? `<li>${n(a.plan.rebuild.length)} resource(s) to rebuild</li>` : "") +
        (a.plan.coneFraction !== undefined ? `<li>Cone fraction: ${a.plan.coneFraction}</li>` : "") +
        (a.plan.fullBuildBecause?.length ? `<li>Full build because: ${a.plan.fullBuildBecause.map(esc).join("; ")}</li>` : "") +
        `</ul>`
      : a.planError !== undefined
        ? `<h4>Rebuild plan</h4><p><code>plan.json</code> does not read as ig-ast-plan/v1, so the plan is <strong>unknown</strong>: ${esc(a.planError)}</p>`
        : `<p class="iga-sub">No rebuild plan (<code>plan.json</code>) is recorded beside this AST.</p>`;
  const provisional = l.provisional.length
    ? `<h4>Provisional until a full Publisher run</h4><ul>${l.provisional.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
    : "";
  return (
    `${heading}${from}<ul>${facts.join("")}</ul>` +
    `<details><summary>Resources by type (${n(Object.keys(l.byType).length)})</summary>${countTable(["type", "resources"], Object.entries(l.byType))}</details>` +
    `<details><summary>Edges by origin and by kind</summary>${countTable(["origin", "edges"], Object.entries(l.edgesByOrigin))}${countTable(["kind", "edges"], a.edgesByKind ?? [])}</details>` +
    plan +
    provisional
  );
}

function directorySection(d: AstDirectory, repository: string | undefined): string {
  const head = `<h2><code>${esc(d.path)}</code> <span class="iga-sub">(${esc(d.id)})</span></h2>`;
  const where = d.storage
    ? `<p class="iga-sub">Kept on the branch family <code>${esc(d.storage.branchPrefix)}</code>${d.storage.keyFrom ? `, one branch per key (${esc(d.storage.keyFrom)})` : ""}` +
      `${d.storage.repository ?? repository ? ` of <code>${esc((d.storage.repository ?? repository)!)}</code>` : ""}` +
      `${d.storage.tool ? `, restored by <code>${esc(d.storage.tool)}</code>` : ""}.` +
      `${familyHref(d.storage, repository) ? ` <a href="${esc(familyHref(d.storage, repository)!)}">The family's branches</a>.` : ""}</p>`
    : "";
  if (d.inherited !== undefined) {
    const why = `<p class="iga-sub">Not declared by the instance: inherited, because it needs <code>${LAYER}</code> and its repository is asked for the AST branch families.</p>`;
    if (d.inherited.error !== undefined) return `${head}${why}<p>The lookup failed, so whether it holds an AST is <strong>unknown</strong>: ${esc(d.inherited.error)}</p>`;
    const keys = d.inherited.keys
      .map((k) => {
        const href = d.storage ? familyHref(d.storage, repository, k) : undefined;
        return `<li>${href ? `<a href="${esc(href)}"><code>${esc(k)}</code></a>` : `<code>${esc(k)}</code>`}</li>`;
      })
      .join("");
    return `${head}${where}${why}<ul>${keys}</ul><p>Not restored in this build, so what each holds is <strong>unknown</strong>, not none.</p>`;
  }
  if (d.asts === null) {
    return `${head}${where}<p>Not in this build, so the ASTs it holds are <strong>unknown</strong>, not none. ${
      d.storage ? "A branch-family directory is absent from a checkout by design until it is restored." : ""
    }</p>`;
  }
  if (d.asts.length === 0) return `${head}${where}<p>On disk, but holds no AST: neither it nor any directory directly inside it has a <code>manifest.json</code>.</p>`;
  return `${head}${where}${d.asts.map((a) => astSection(a, d, repository)).join("\n")}`;
}

const MARK = `<p class="iga-mark">An IG AST is a <strong>cache, never an authority</strong>: each manifest lists what stays provisional until a full IG Publisher run, and these counts are what the cache holds, not what the IG publishes.</p>`;

/** `<route>/<instance>/`: one layer's ASTs. */
export function subjectPage(v: Pick<DeclaredVisualiser, "id" | "title">, s: AstSubject, all: readonly AstSubject[]): string {
  const title = `${v.title ?? "IG ASTs"} — ${s.name}`;
  const others = all.map((o) => (o.name === s.name ? `<li><strong>${esc(o.name)}</strong></li>` : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`)).join("");
  return page(
    title,
    `<h1>${esc(title)}</h1>\n${MARK}\n${s.directories.map((d) => directorySection(d, s.repository)).join("\n")}\n` +
      `<h2>Every instance</h2><p><a href="../">All IG ASTs</a></p><ul>${others}</ul>`,
  );
}

/** `<route>/`: every layer holding an `ig-ast` directory, with what each holds. */
export function hubPage(v: Pick<DeclaredVisualiser, "id" | "title">, all: readonly AstSubject[]): string {
  const title = v.title ?? "IG ASTs";
  const rows = all
    .flatMap((s) =>
      s.directories.map(
        (d) => `<tr><td><a href="${esc(s.name)}/">${esc(s.name)}</a></td><td><code>${esc(d.path)}</code></td><td>${esc(directoryVerdict(d))}</td></tr>`,
      ),
    )
    .join("");
  const body = all.length
    ? `<table><thead><tr><th>instance</th><th>directory</th><th>holds</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p>No instance in this checkout declares an <code>ig-ast</code> directory or carries an AST branch family.</p>`;
  return page(
    title,
    `<h1>${esc(title)}</h1>\n${MARK}\n<p>One page per instance in this checkout that declares a directory of kind <code>ig-ast</code>, or that needs <code>${LAYER}</code> and whose repository carries an AST branch family (inherited).</p>\n${body}`,
  );
}

// ── writing ────────────────────────────────────────────────────────────────

/** Every page the declared visualisers rendered by this Tool owe, absolute path → content. */
export function plannedPages(root: string, site: string, list: BranchLister = lsRemote): { pages: Map<string, string>; routes: string[] } {
  const pages = new Map<string, string>();
  const routes: string[] = [];
  const vis = declaredVisualisers(root).filter((v) => v.renderedBy === TOOL_ID);
  if (vis.length === 0) return { pages, routes };
  const repoOf = new Map<string, string>();
  const facts = new Map<string, InstanceFacts>();
  const dirs = checkoutDirectories(root);
  for (const d of dirs) {
    const name = d.member ?? d.declaredBy;
    if (facts.has(name)) continue;
    const up = d.path.split("/").filter((x) => x.length > 0 && x !== ".").length;
    const instRoot = resolve(d.absPath, ...Array.from({ length: up }, () => ".."));
    const decl = rawDeclaration(instRoot);
    const repo = str(decl?.["repository"]);
    if (repo) repoOf.set(name, repo);
    const needs = Array.isArray(decl?.["needs"]) ? (decl!["needs"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
    facts.set(name, { name, ...(repo ? { repository: repo } : {}), needs });
  }
  for (const v of vis) {
    const kinds = v.coversKinds?.length ? v.coversKinds : [KIND];
    const declaredSubjects = astSubjects(dirs, kinds, (i) => repoOf.get(i));
    const subjects = [...declaredSubjects, ...inheritedSubjects([...facts.values()], new Set(declaredSubjects.map((s) => s.name)), list)].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const full = pageParts({ harness: v.harness, visualiser: v.id });
    const dir = visualiserPageDir(site, full);
    routes.push(dir);
    pages.set(join(dir, "index.html"), hubPage(v, subjects));
    if (v.subgraphs === "instance") {
      for (const s of subjects) pages.set(join(visualiserPageDir(site, { ...full, subgraph: s.name }), "index.html"), subjectPage(v, s, subjects));
    }
  }
  return { pages, routes };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)).filter((p) => statSync(p).isFile());
}

function main(): number {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = checkoutRootFor(resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : process.cwd()));
  const site = siteArg(argv) ?? siteOwnerDir(root);
  const check = argv.includes("--check");
  const { pages, routes } = plannedPages(root, site);
  if (routes.length === 0) {
    console.log(`${TOOL_ID}: no instance in this checkout declares a visualiser rendered by ${TOOL_ID} — nothing to write`);
    return 0;
  }
  if (check) {
    const stale = [...pages].filter(([p, html]) => !existsSync(p) || readFileSync(p, "utf-8") !== html).map(([p]) => p);
    const orphans = routes.flatMap(filesUnder).filter((p) => !pages.has(p));
    for (const p of stale) console.error(`✗ ${relative(site, p)} is stale or missing`);
    for (const p of orphans) console.error(`✗ ${relative(site, p)} is an orphan — no declared subject produces it`);
    if (stale.length || orphans.length) return 1;
    console.log(`✓ ${pages.size} ${KIND} page(s) current under ${site}`);
    return 0;
  }
  for (const r of routes) rmSync(r, { recursive: true, force: true });
  for (const [p, html] of pages) {
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, html);
  }
  console.log(`${TOOL_ID}: ${pages.size} page(s) written under ${relative(process.cwd(), site) || basename(site)} (${routes.map((r) => relative(site, r)).join(", ")})`);
  return 0;
}

if (import.meta.main) process.exit(main());
