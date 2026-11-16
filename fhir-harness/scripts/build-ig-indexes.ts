#!/usr/bin/env bun
/**
 * Build each IG layer's `fhir-artifact-index/` at publish, from the IG's
 * cached AST and its own source, so no IG layer commits one (issue #124).
 *
 * @module fhir-harness/scripts/build-ig-indexes
 * @covers fhir-artifact-index
 *
 * ```sh
 * bun run fhir-harness/scripts/build-ig-indexes.ts [--root <checkout>] [--only <instance>] [--work <dir>] [--plan]
 *
 * Without `--work`, the work directory is a new one under `os.tmpdir()`,
 * removed when the run ends, fails or is cancelled (`withWorkDir`).
 * ```
 *
 * ## Which layers
 *
 * An IG layer declares nothing of this layer's (AGENTS.md). It is found
 * the way the `ig-ast` viewer finds one (`gen-ig-ast-pages.ts`): it needs
 * this layer, directly or through a layer above it, it declares a
 * `repository`, and that repository carries an AST branch family
 * ({@link AST_FAMILY_PREFIXES}). A layer missing any of the three is
 * skipped, and the run says which and why.
 *
 * ## What it writes, per layer, at the paths every reader already uses
 *
 * - `index.json`: `ast-to-artifact-index.ts` over the AST `ig-cache.sh
 *   restore` lays down from the branch family. The AST is a cache, and the
 *   index says so (`authority: "cache"` in its manifest's inputs).
 * - `menu.json`: `buildMenu` over the IG source's `sushi-config.yaml`, at the
 *   commit cloned. `stage-ig-sites.ts` clones the IG from the `source.of` and
 *   `source.ref` this records.
 * - `releases.json`: `ingest-ig-releases.ts`, from the repository's GitHub
 *   releases. A failed read is reported and the file is not written: no
 *   release list is not the same as an empty one.
 *
 * ## The IG API sidecars a layer above leaves
 *
 * When a mounted layer provides the checkout script `ig-site:sidecars` (the
 * step an IG repository's own site runs, `ig-repo-site.ts` §"What a layer
 * above leaves for this one"), it is run here too, over the same clone and a
 * work directory of its own. What it leaves in `<work>/ig-api/sidecars/` is
 * copied to `<instance>/fhir-artifact-index/sidecars/` and bound to the
 * artefacts (`ast-to-artifact-index.ts --sidecars`), so the pages keep their
 * IG API links once no committed copy carries them. This layer runs the step
 * by its name and never knows what it writes. No such script, nothing is bound,
 * and the run says so. A step that fails fails that IG.
 *
 * ## The package, from the AST
 *
 * The JSON view pages read each resource out of `package.tgz`, at
 * `package/<Type>-<id>.json`, as the Publisher packages it. {@link packFromAst}
 * writes that file from the AST's resources, with a `package/package.json`
 * read from the IG's `sushi-config.yaml`, to `fhir-artifact-index/package.tgz`.
 * It is the AST's package, not the published one, and holds what the AST holds.
 *
 * ## The JSON-LD contexts and the FHIR version, from the IG's source
 *
 * The Publisher copies `input/images/` to the site root as it is, so a JSON-LD
 * context the IG publishes is a `.jsonld` file there whose only key is
 * `@context` ({@link contextsFrom}); a `.jsonld` holding data (`@graph`, ...)
 * is not one. Each is copied to `fhir-artifact-index/contexts/` and indexed by
 * its path without the extension. `fhirVersion` is read from
 * `sushi-config.yaml`.
 *
 * ## The IG API hub: drawn from the index, named by the layer above
 *
 * A layer above that writes the sidecars names in its descriptor
 * (`ig-api.json`) what the API is called (`label`) and the marker the IG's own
 * hub page holds (`placeholder`). The index's `igApiHub` records both and the
 * hub page's address ({@link hubFrom}); it holds no copy, because the hub is
 * drawn from the index's own bound sidecars (`ig-api-hub.ts`, bean `h7ap`).
 *
 * ## Where the IG is published
 *
 * The published links (`published.json`, `.html`, ...) need the address the
 * IG is published at, which a canonical URL is not ({@link publishedBase}). It is
 * the committed copy's `source.of` when that names a published site (the rule
 * `ig-ast-site.sh` follows), else the layer declaration's `iriBase`, else
 * none, and the run says which.
 *
 * The two are laid out differently. A committed copy's site is a Publisher's
 * output: `<Type>-<id>.html` at its root. An `iriBase` is the layer's own
 * site, which this harness builds: the page is `artifact/<Type>-<id>.html`
 * and the root holds only the `.json`. The index's links follow the site
 * they name (`PublishedLayout`); a Publisher-shaped link on the harness's own
 * site is a dead link (every journey actor on smart-trust-demo, 2026-11-11).
 *
 * The SITE decides the owner, not the declaration. A declaration names one
 * repository and one `iriBase`, and both travel with every copy of the
 * layer. A checkout that mounts the layer from a different repository
 * (a sync of the same IG to another owner, say) is building that repository's
 * site. So the repository is the one the checkout's `index.lock.json` mounts
 * the layer from, when it names one, and the IG is cloned from there. An
 * `iriBase` that is the declared repository's own GitHub Pages address is
 * re-based on the mounted repository's ({@link rebaseOnMount}). Any other
 * `iriBase` is a site the IG chose, and is kept.
 *
 * A committed `index.json` still on disk is read for its grouping
 * (`--keep-published-grouping`) before it is replaced, so the Publisher's
 * editorial categories survive the first build. Once the committed copy is
 * deleted, the grouping is the Publisher's default by resource type, and
 * `ast-to-artifact-index.ts` names every artefact where that differs.
 *
 * `--plan` prints what would be built and touches nothing.
 *
 * Exit: 0 every IG found was built · 1 one or more failed (each named) · 2 usage.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { checkoutRootFor, declarationPathIn, instanceRootsIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { scriptTable } from "@litlfred/cat-harness-tools/schemas/sdlc/script-table.ts";
import { IG_API_DESCRIPTOR, IG_API_WORK } from "./ig-repo-site.ts";
import { igApiHubPageOf } from "./ig-api-hub.ts";
import { AST_FAMILY_PREFIXES, LAYER, lsRemote, needing, type BranchLister, type InstanceFacts } from "./gen-ig-ast-pages.ts";
import { buildMenu } from "./ingest-ig-menu.ts";
import { igReadScope } from "./ig-read-scope.ts";
import { annotateReleases, readAstHistory } from "./ig-ast-history.ts";
import { realPathWithin, safeSegment } from "../../cat-harness-tools/src/core/safe-path.js";
import { astPinsIn, IG_AST_LOCK_FILE, type IgAstPin } from "../schemas/ig-ast-lock.ts";
import type { PublishedLayout } from "./ast-to-artifact-index.ts";
import { indexReadPath, indexWritePath } from "./lib/ig-index-at.ts";

const HERE = import.meta.dir;

/** One IG layer this run builds the index of. */
export interface IgTarget {
  name: string;
  root: string;
  /** The repository the checkout mounts the layer from, else the declared one. */
  repository: string;
  /** The repository the layer's declaration names, when the mount differs from it. */
  declaredRepository?: string;
  /**
   * The commit the checkout's lock pins the layer at. The IG is cloned AT
   * this commit, so `menu.json`'s `source.ref` is the pin and not whatever the
   * repository's default branch says at build time (a live read of an unpinned
   * branch made the published index move without a re-pin, bean `fwtz`).
   */
  sha?: string;
  /** The family branches found on the repository. */
  branches: string[];
}

/** A layer that is not built, and why. */
export interface Skipped {
  name: string;
  why: string;
}

/**
 * The layer declaration at `root`: the file that names itself, found as
 * every reader finds one (`declarationPathIn`), never `<directory>.json`. A
 * checkout's directory is not its layer's name: CI checks an IG repository
 * out at `fa/`, where `fa/fa.json` is absent, so the IG read as a layer
 * named `fa` that needs nothing, and no index was built for it.
 */
function declarationOf(root: string): Record<string, unknown> | undefined {
  const p = declarationPathIn(root);
  try {
    return p !== undefined && existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

const OWNER_REPO = /^[\w.-]+\/[\w.-]+$/;

/**
 * A layer name this run will use as a directory under `--work`: one path
 * segment of letters, digits, `.`, `_` and `-`, starting with a letter or digit.
 * Any other name is refused (skipped), never rewritten.
 */
const INSTANCE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** True when `name` is a name this run may use as a directory. */
export function isSafeInstanceName(name: string): boolean {
  return safeSegment(name) !== undefined && INSTANCE_NAME.test(name);
}

/** One layer's mount in the checkout's `index.lock.json`: its repository and, when the lock records one, the commit it is pinned at. */
export interface LockedMount {
  repository: string;
  sha?: string;
}

const SHA = /^[0-9a-f]{40}$/;

/** Each layer's mount as the checkout's `index.lock.json` records it; empty when there is no lock. */
export function lockedMounts(checkout: string): Map<string, LockedMount> {
  const out = new Map<string, LockedMount>();
  try {
    const lock = JSON.parse(readFileSync(join(checkout, "index.lock.json"), "utf-8")) as { instances?: { instance?: unknown; repository?: unknown; sha?: unknown }[] };
    for (const i of lock.instances ?? []) {
      if (typeof i.instance === "string" && typeof i.repository === "string" && OWNER_REPO.test(i.repository)) {
        out.set(i.instance, { repository: i.repository, ...(typeof i.sha === "string" && SHA.test(i.sha) ? { sha: i.sha } : {}) });
      }
    }
  } catch {
    // No lock, or not one this reads: the declarations' repositories stand.
  }
  return out;
}

/** Each layer's repository as the checkout's `index.lock.json` mounts it; empty when there is no lock. */
export function lockedRepositories(checkout: string): Map<string, string> {
  return new Map([...lockedMounts(checkout)].map(([k, v]) => [k, v.repository]));
}

/** The checkout's layers, as the inheritance needs them, with their roots. The repository is the mounted one, else the declared one. */
export function instancesIn(checkout: string): (InstanceFacts & { root: string; declaredRepository?: string; sha?: string })[] {
  const out: (InstanceFacts & { root: string; declaredRepository?: string; sha?: string })[] = [];
  const locked = lockedMounts(checkout);
  for (const root of instanceRootsIn(checkout)) {
    const d = declarationOf(root);
    const name = typeof d?.["name"] === "string" ? (d["name"] as string) : basename(root);
    const declared = typeof d?.["repository"] === "string" ? (d["repository"] as string) : undefined;
    const mount = locked.get(name);
    const mounted = mount?.repository;
    const repository = mounted ?? declared;
    const needs = Array.isArray(d?.["needs"]) ? (d!["needs"] as unknown[]).filter((x): x is string => typeof x === "string") : [];
    out.push({ name, root, needs, ...(repository ? { repository } : {}), ...(declared && mounted && declared !== mounted ? { declaredRepository: declared } : {}), ...(mount?.sha ? { sha: mount.sha } : {}) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The IG layers to build, and every layer that needs this layer but is skipped. */
export function igTargets(instances: readonly (InstanceFacts & { root: string; declaredRepository?: string; sha?: string })[], list: BranchLister, only?: string): { targets: IgTarget[]; skipped: Skipped[] } {
  const targets: IgTarget[] = [];
  const skipped: Skipped[] = [];
  const need = needing(instances, LAYER);
  for (const i of instances) {
    if (!need.has(i.name)) continue;
    if (only !== undefined && i.name !== only) continue;
    if (!isSafeInstanceName(i.name)) {
      skipped.push({ name: i.name, why: "name is not a single safe path segment ([A-Za-z0-9][A-Za-z0-9._-]*)" });
      continue;
    }
    if (i.repository === undefined || !OWNER_REPO.test(i.repository)) {
      skipped.push({ name: i.name, why: "declares no repository (owner/repo)" });
      continue;
    }
    const found = list(i.repository);
    if ("error" in found) {
      skipped.push({ name: i.name, why: `could not determine: ${found.error}` });
      continue;
    }
    const branches = found.branches.filter((b) => AST_FAMILY_PREFIXES.some((p) => b.startsWith(p)));
    if (branches.length === 0) {
      skipped.push({ name: i.name, why: `${i.repository} carries no AST branch family (${AST_FAMILY_PREFIXES.join(", ")}): not an IG, or its AST was never seeded` });
      continue;
    }
    targets.push({ name: i.name, root: i.root, repository: i.repository, ...(i.declaredRepository ? { declaredRepository: i.declaredRepository } : {}), ...(i.sha ? { sha: i.sha } : {}), branches });
  }
  return { targets, skipped };
}

function run(cmd: string, args: string[], cwd?: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf-8", timeout: 600_000 });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

/**
 * `iri` re-based on the mounted repository, when it is the declared
 * repository's own GitHub Pages address (`https://<owner>.github.io/<repo>`,
 * and anything under it). Any other address is returned unchanged.
 */
export function rebaseOnMount(iri: string, declared: string | undefined, mounted: string | undefined): string {
  if (!declared || !mounted || declared === mounted || !OWNER_REPO.test(declared) || !OWNER_REPO.test(mounted)) return iri;
  const [dOwner, dRepo] = declared.split("/");
  const [mOwner, mRepo] = mounted.split("/");
  const m = /^https?:\/\/([^/]+)\.github\.io\/([^/]+)(\/.*)?$/i.exec(iri);
  if (!m || m[1]!.toLowerCase() !== dOwner!.toLowerCase() || m[2] !== dRepo) return iri;
  return `https://${mOwner!.toLowerCase()}.github.io/${mRepo}${m[3] ?? ""}`;
}

/**
 * An artefact the index calls `materialized` must have its bytes under the
 * layer root, because that is where `check:materialized-fixity` looks.
 * Built at publish, the compiled AST sits in a temporary clone that is gone
 * when the index is read, so such an artefact is only `referenced`: the
 * published page is where it is, and the note keeps what it was built from.
 * Returns how many records were rewritten. Pure but for the existence check.
 */
export function referenceAbsent(index: Record<string, unknown>, instanceRoot: string): number {
  const arts = Array.isArray(index["artifacts"]) ? (index["artifacts"] as Record<string, unknown>[]) : [];
  let n = 0;
  for (const a of arts) {
    const m = a["materialization"] as Record<string, unknown> | undefined;
    if (m?.["state"] !== "materialized" || typeof m["localPath"] !== "string") continue;
    if (existsSync(join(instanceRoot, m["localPath"] as string))) continue;
    const prov = (m["provenance"] ?? {}) as { upstream?: string; local?: string };
    const rev = (m["inputs"] as { sourceRevision?: string } | undefined)?.sourceRevision;
    a["materialization"] = {
      state: "referenced",
      provenance: prov.upstream ? { upstream: prov.upstream } : prov,
      note: `built at publish from a compiled AST that this checkout does not keep${rev ? ` (source revision ${rev})` : ""}`,
    };
    n++;
  }
  return n;
}

/**
 * Where the IG is published: the committed copy's site, else the
 * declaration's `iriBase` (re-based on the mounted repository, {@link
 * rebaseOnMount}), else none.
 */
export function publishedBase(committed: Record<string, unknown> | undefined, declaration: Record<string, unknown> | undefined, mounted?: string): { base?: string; layout?: PublishedLayout; from: string } {
  const src = committed?.["source"] as { kind?: unknown; of?: unknown } | undefined;
  if ((src?.kind === "gh-pages" || src?.kind === "url") && typeof src.of === "string" && src.of.length > 0) return { base: src.of.replace(/\/+$/, ""), layout: "publisher", from: "the committed copy's source" };
  const iri = declaration?.["iriBase"];
  if (typeof iri === "string" && /^https?:\/\//.test(iri)) {
    const declared = typeof declaration?.["repository"] === "string" ? (declaration["repository"] as string) : undefined;
    const base = rebaseOnMount(iri, declared, mounted).replace(/\/+$/, "");
    // The layer's own site, which this harness builds: its pages are `artifact/…` (`PublishedLayout` "site").
    return { base, layout: "site", from: base === iri.replace(/\/+$/, "") ? "the declaration's iriBase" : `the declaration's iriBase, re-based on ${mounted}, the repository this checkout mounts` };
  }
  return { from: "nowhere: no published links" };
}

/** GNU tar flags that make an archive depend only on the files' names and contents. */
export const REPRODUCIBLE_TAR: readonly string[] = ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "--mode=a+rX,u+w,go-w", "--use-compress-program=gzip -n"];

/**
 * Write `out` as a Publisher-shaped `package.tgz` from the AST in `ast`: each
 * resource at `package/<Type>-<id>.json`, and `package/package.json` from the
 * IG's `sushi-config.yaml`. Returns the number of resources packed.
 */
export function packFromAst(ast: string, igSource: string, out: string, stage: string, log: (s: string) => void = (s) => console.error(s)): number {
  const manifest = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as { resources: { resourceType: string; id: string; file: string }[] };
  rmSync(stage, { recursive: true, force: true });
  const pkg = join(stage, "package");
  mkdirSync(pkg, { recursive: true });
  let n = 0;
  for (const r of manifest.resources) {
    if (typeof r.file !== "string" || !/^[A-Za-z]+$/.test(r.resourceType) || !/^[A-Za-z0-9.-]+$/.test(r.id)) continue;
    const joined = join(ast, r.file);
    if (!existsSync(joined)) continue;
    // The manifest's file must resolve inside the AST, symlinks followed.
    const from = realPathWithin(ast, joined);
    if (from === undefined) {
      log(`  package: refused ${r.resourceType}/${r.id}: its file is outside the AST`);
      continue;
    }
    cpSync(from, join(pkg, `${r.resourceType}-${r.id}.json`));
    n++;
  }
  const cfg = parseYaml(readFileSync(igReadScope(igSource).path("sushi-config.yaml"), "utf-8")) as Record<string, unknown>;
  const fhirVersion = cfg["fhirVersion"];
  writeFileSync(
    join(pkg, "package.json"),
    `${JSON.stringify(
      {
        name: String(cfg["packageId"] ?? cfg["id"] ?? ""),
        version: String(cfg["version"] ?? ""),
        ...(cfg["canonical"] ? { canonical: String(cfg["canonical"]) } : {}),
        ...(fhirVersion ? { fhirVersions: Array.isArray(fhirVersion) ? fhirVersion.map(String) : [String(fhirVersion)] } : {}),
        description: "Built from the IG's cached AST by fhir-harness build-ig-indexes.ts, not by the IG Publisher.",
      },
      null,
      2,
    )}\n`,
  );
  mkdirSync(join(out, ".."), { recursive: true });
  // Same AST, same bytes (cat-harness-tools#1230): GNU tar with a fixed order,
  // time and owner, gzip without its own name and time. A tar without those
  // flags (bsdtar) packs as before.
  let t = spawnSync("tar", [...REPRODUCIBLE_TAR, "-cf", out, "-C", stage, "package"], { encoding: "utf-8" });
  if (t.status !== 0) t = spawnSync("tar", ["-czf", out, "-C", stage, "package"], { encoding: "utf-8" });
  if (t.status !== 0) throw new Error(`tar failed: ${t.stderr}`);
  return n;
}

/** The Publisher's folder copied verbatim to the site root. */
export const IG_IMAGES = join("input", "images");

/** `.jsonld` files under `dir`, as paths relative to it, sorted. */
function jsonldUnder(dir: string, rel = ""): string[] {
  if (!existsSync(join(dir, rel))) return [];
  return readdirSync(join(dir, rel), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? jsonldUnder(dir, join(rel, e.name)) : e.name.endsWith(".jsonld") ? [join(rel, e.name)] : []))
    .sort();
}

/**
 * The JSON-LD contexts the IG publishes: each `.jsonld` under `input/images/`
 * whose only key is `@context`, copied to `dir/contexts/<path>`. Returns the
 * index's `contexts` entries, empty when there are none.
 */
export function contextsFrom(igSource: string, dir: string, base: string | undefined): { id: string; representation: { url: string; localPath: string; bytes: number } }[] {
  const images = join(igSource, IG_IMAGES);
  const out: { id: string; representation: { url: string; localPath: string; bytes: number } }[] = [];
  // Only the images contentTypes.ig.include declares; none when it declares none there.
  const scope = igReadScope(igSource);
  const imagesRel = IG_IMAGES.split("\\").join("/");
  if (!scope.reaches(imagesRel)) return out;
  for (const rel of jsonldUnder(images).filter((r) => scope.declares(`${imagesRel}/${r.split("\\").join("/")}`))) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(join(images, rel), "utf-8"));
    } catch {
      continue;
    }
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) continue;
    const keys = Object.keys(doc);
    if (keys.length !== 1 || keys[0] !== "@context") continue;
    const path = rel.split("\\").join("/");
    const to = join(dir, "contexts", rel);
    mkdirSync(join(to, ".."), { recursive: true });
    cpSync(join(images, rel), to);
    out.push({
      id: path.replace(/\.jsonld$/, ""),
      representation: { url: base ? `${base}/${path}` : `fhir-artifact-index/contexts/${path}`, localPath: `fhir-artifact-index/contexts/${path}`, bytes: statSync(to).size },
    });
  }
  return out;
}

/** The IG's FHIR versions, from its `sushi-config.yaml`; none when it names none. */
export function fhirVersionsOf(igSource: string): string[] {
  const p = join(igSource, "sushi-config.yaml");
  if (!igReadScope(igSource).declares("sushi-config.yaml") || !existsSync(p)) return [];
  const v = (parseYaml(readFileSync(p, "utf-8")) as Record<string, unknown> | null)?.["fhirVersion"];
  return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]).map(String);
}

/**
 * The IG API hub's index entry (see "The IG API hub"): the IG's page holding
 * the descriptor's `placeholder` (else `ig-api.html`) on the published site,
 * and the descriptor's `label`. `undefined` when no layer above left a
 * descriptor, so there is no API to name.
 */
export function hubFrom(siteWork: string, igSource: string, base: string | undefined): { url: string; placeholder?: string; label?: string } | undefined {
  const descriptor = join(siteWork, IG_API_WORK, IG_API_DESCRIPTOR);
  if (!existsSync(descriptor)) return undefined;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(readFileSync(descriptor, "utf-8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const placeholder = typeof d["placeholder"] === "string" && d["placeholder"].length > 0 ? (d["placeholder"] as string) : undefined;
  const label = typeof d["label"] === "string" && d["label"].trim().length > 0 ? (d["label"] as string).trim() : undefined;
  const page = igApiHubPageOf(igSource, placeholder);
  return { url: base ? `${base}/${page}` : page, ...(placeholder ? { placeholder } : {}), ...(label ? { label } : {}) };
}

/** The step name a layer above provides for the IG API sidecars. */
export const SIDECARS_STEP = "ig-site:sidecars";

/**
 * Run the layer-provided sidecars step over `clone`, and copy what it left into
 * `dir/sidecars`. Returns the copied directory, `undefined` when no layer
 * provides the step or it left nothing, or an error.
 */
export function sidecarsFor(checkout: string, clone: string, work: string, dir: string, log: (s: string) => void): { at?: string } | { error: string } {
  const entry = scriptTable(checkout).get(SIDECARS_STEP);
  if (entry === undefined) {
    log(`  sidecars: no mounted layer provides ${SIDECARS_STEP}; none bound`);
    return {};
  }
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  // The step's command is a shell command by design; the paths are passed as
  // positional parameters, never spliced into it.
  const r = spawnSync("sh", ["-c", `${entry.command} --ig "$1" --work "$2"`, "sh", clone, work], {
    cwd: checkout,
    encoding: "utf-8",
    timeout: 900_000,
    env: { ...process.env, SITE_WORK: work, PATH: `${join(checkout, "node_modules", ".bin")}:${process.env.PATH ?? ""}` },
  });
  if (r.status !== 0) return { error: `${SIDECARS_STEP} failed: ${`${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-3).join(" ")}` };
  const from = join(work, IG_API_WORK, "sidecars");
  const target = join(dir, "sidecars");
  rmSync(target, { recursive: true, force: true });
  if (!existsSync(from) || readdirSync(from).length === 0) {
    log(`  sidecars: ${SIDECARS_STEP} (${entry.manifest}) left none`);
    return {};
  }
  cpSync(from, target, { recursive: true });
  log(`  sidecars: ${readdirSync(target).length} file(s) from ${SIDECARS_STEP} (${entry.manifest})`);
  return { at: target };
}

/**
 * A shallow clone of `repository` into `dir`: at `sha` when the lock pins one
 * (fetched by commit, so a pin that is not a branch tip still works), else
 * the default branch, as before.
 */
export function cloneAt(repository: string, dir: string, sha?: string, git: typeof run = run): { ok: boolean; out: string } {
  const url = `https://github.com/${repository}`;
  if (!sha) return git("git", ["clone", "--quiet", "--depth", "1", url, dir]);
  for (const args of [
    ["init", "--quiet", dir],
    ["-C", dir, "remote", "add", "origin", url],
    ["-C", dir, "fetch", "--quiet", "--depth", "1", "--no-tags", "origin", sha],
    ["-C", dir, "checkout", "--quiet", "--detach", "FETCH_HEAD"],
  ]) {
    const r = git("git", args);
    if (!r.ok) return r;
  }
  return { ok: true, out: "" };
}

/**
 * The pinned commit's committer time (ISO 8601), or undefined when the clone
 * has no HEAD. A pinned read stamps this, never the wall clock: the same pin
 * then writes the same bytes on any day, so the writer reads only its pin
 * (bean fwtz, "Shrinking the cone" step 1).
 */
export function pinnedAt(clone: string, git: typeof run = run): string | undefined {
  const r = git("git", ["-C", clone, "show", "-s", "--format=%cI", "HEAD"]);
  const at = r.ok ? r.out.trim() : "";
  return /^\d{4}-\d{2}-\d{2}T/.test(at) ? at : undefined;
}

/**
 * How the restored AST relates to the pin: the AST cache branch is read at its
 * tip, and its manifest names the IG commit it was compiled from. When that
 * is not the pinned commit, the index describes the older commit's resources,
 * and the log says so instead of letting a stale index pass as the pin's.
 */
export function astAgainstPin(ast: string, pin: string | undefined): { sourceRevision?: string; matchesPin?: boolean } {
  try {
    const m = JSON.parse(readFileSync(join(ast, "manifest.json"), "utf-8")) as { inputs?: { sourceRevision?: unknown } };
    const src = typeof m.inputs?.sourceRevision === "string" ? m.inputs.sourceRevision : undefined;
    if (!src) return {};
    return { sourceRevision: src, ...(pin ? { matchesPin: src === pin } : {}) };
  } catch {
    return {};
  }
}

/** Build one IG's index, menu and releases. Returns the problems; empty means built. */
export function buildOne(t: IgTarget, work: string, log: (s: string) => void, checkout = resolve(t.root, "..")): string[] {
  const problems: string[] = [];
  if (!isSafeInstanceName(t.name)) return [`refused: instance name is not a single safe path segment`];
  const clone = join(work, t.name);
  rmSync(clone, { recursive: true, force: true });
  const c = cloneAt(t.repository, clone, t.sha);
  if (!c.ok) return [`clone of ${t.repository}${t.sha ? `@${t.sha.slice(0, 7)}` : ""} failed: ${c.out}`];
  // The paths the harness reads in the IG: its contentTypes.ig.include. An IG
  // that declares none is read as before, and the warning lands in this log.
  try {
    const scope = igReadScope(clone, { warn: (s) => log(`  ${s}`) });
    if (!scope.legacy) log(`  reads: ${scope.section!.include.join(", ")} (contentTypes.ig.include)`);
  } catch (e) {
    return [(e as Error).message];
  }

  // The AST at its pin (ig-ast.lock.json), else the cache branch tip as before.
  let astPin: IgAstPin | undefined;
  try {
    astPin = astPinsIn(checkout).get(t.name);
  } catch (e) {
    return [`${IG_AST_LOCK_FILE}: ${(e as Error).message}`];
  }
  if (astPin && astPin.repository !== t.repository) return [`${IG_AST_LOCK_FILE} pins ${t.name}'s AST in ${astPin.repository}, but the IG is mounted from ${t.repository}`];
  log(astPin ? `  AST: pinned at ${astPin.branch}@${astPin.sha.slice(0, 7)} (${IG_AST_LOCK_FILE})` : `  AST: no pin in ${IG_AST_LOCK_FILE}; reading the cache branch tip`);
  // The commit restored, for each release's AST commit in releases.json (#329).
  const astRecord = join(work, `${t.name}.ast-source.json`);
  rmSync(astRecord, { force: true });
  const restore = run("bash", [join(HERE, "ig-cache.sh"), "restore", "--ig-root", clone, "--record", astRecord, ...(astPin ? ["--commit", astPin.sha] : [])]);
  if (!restore.ok) return [`no AST restored from ${t.repository}: ${restore.out.split("\n").slice(-3).join(" ")}`];
  const ast = join(clone, "output-ast");
  const head = run("git", ["-C", clone, "rev-parse", "HEAD"]);
  const pin = t.sha ?? (head.ok ? head.out.trim() : undefined);
  const at = pinnedAt(clone);
  const vs = astAgainstPin(ast, pin);
  if (vs.matchesPin === false) {
    log(`  ! AST is from ${t.repository}@${vs.sourceRevision!.slice(0, 7)}, not the pin ${pin!.slice(0, 7)}: the index describes that commit's resources until the AST cache is re-seeded at the pin`);
  } else if (vs.matchesPin) log(`  AST: compiled from the pin ${pin!.slice(0, 7)}`);

  // The layer's output root (bean `sm8r` item 4): `build/layers/<instance>/`
  // for a mounted layer, so no run writes inside a mount; in place for the
  // checkout's own layer. Every reader reads through the same overlay.
  const dir = indexWritePath(t.root);
  mkdirSync(dir, { recursive: true });
  const indexPath = join(dir, "index.json");
  // The index a previous run left, read through the overlay, for its grouping.
  const previous = indexReadPath(t.root, "index.json");
  const grouping = existsSync(previous) ? ["--compare", previous, "--keep-published-grouping"] : [];
  const sc = sidecarsFor(checkout, clone, join(work, `${t.name}.site-work`), dir, log);
  if ("error" in sc) return [`sidecars: ${sc.error}`];
  const sidecars = sc.at ? ["--sidecars", sc.at, "--sidecars-local", "fhir-artifact-index/sidecars"] : [];
  const committedIx = existsSync(previous) ? (JSON.parse(readFileSync(previous, "utf-8")) as Record<string, unknown>) : undefined;
  const pub = publishedBase(committedIx, declarationOf(t.root), t.repository);
  log(`  published at: ${pub.base ?? "unknown"} (from ${pub.from})`);
  const built = join(work, `${t.name}.index.json`);
  const ix = run("bun", ["run", join(HERE, "ast-to-artifact-index.ts"), "--ast", ast, "--instance-id", t.name, "--out", built, ...grouping, ...sidecars, ...(pub.base ? ["--published-base", pub.base, "--published-layout", pub.layout ?? "publisher"] : [])]);
  if (!ix.ok) problems.push(`index: ${ix.out}`);
  else {
    const next = JSON.parse(readFileSync(built, "utf-8")) as Record<string, unknown>;
    try {
      const tgz = join(dir, "package.tgz");
      const packed = packFromAst(ast, clone, tgz, join(work, `${t.name}.package`), log);
      next["package"] = { url: pub.base ? `${pub.base}/package.tgz` : "fhir-artifact-index/package.tgz", localPath: "fhir-artifact-index/package.tgz", bytes: statSync(tgz).size };
      log(`  package: ${packed} resource(s) packed from the AST`);
    } catch (e) {
      problems.push(`package: ${(e as Error).message}`);
    }
    const fv = fhirVersionsOf(clone);
    if (fv.length) next["fhirVersion"] = fv;
    rmSync(join(dir, "contexts"), { recursive: true, force: true });
    const ctx = contextsFrom(clone, dir, pub.base);
    if (ctx.length) next["contexts"] = ctx;
    else delete next["contexts"];
    log(`  contexts: ${ctx.length} JSON-LD context(s) from ${IG_IMAGES}/`);
    const hub = hubFrom(join(work, `${t.name}.site-work`), clone, pub.base);
    if (hub) next["igApiHub"] = hub;
    log(`  API hub: ${hub ? `${hub.label ?? "IG API"} at ${hub.url}, drawn from the index` : "no IG API descriptor from a layer above"}`);
    const referenced = referenceAbsent(next, t.root);
    if (referenced) log(`  materialization: ${referenced} artefact(s) referenced, not materialized: their compiled bytes are not in this checkout`);
    writeFileSync(indexPath, `${JSON.stringify(next, null, 2)}\n`);
    log(`  index: ${ix.out.split("\n")[0]}`);
  }

  try {
    // The pinned commit's date, not today's: a menu is the same bytes for the same pin.
    const menu = buildMenu(clone, (at ?? new Date().toISOString()).slice(0, 10));
    writeFileSync(join(dir, "menu.json"), `${JSON.stringify(menu, null, 2)}\n`);
    log(`  menu: ${menu.groups.length} group(s) from ${t.repository}@${menu.source.ref.slice(0, 7)}`);
  } catch (e) {
    problems.push(`menu: ${(e as Error).message}`);
  }

  // As of the pinned commit: releases published later belong to a later pin.
  const rel = run("bun", ["run", join(HERE, "ingest-ig-releases.ts"), "--instance", t.root, "--repo", t.repository, ...(t.sha && at ? ["--as-of", at] : [])]);
  if (!rel.ok) log(`  releases: not written, could not read ${t.repository}'s releases: ${rel.out.split("\n").find((l) => l.startsWith("error:")) ?? rel.out.split("\n").slice(-1)[0]}`);
  else {
    log("  releases: written");
    // Each release's AST commit, read off the cache branch's history (#329), so a page never asks the GitHub API.
    const releases = indexReadPath(t.root, "releases.json");
    const commit = existsSync(astRecord) ? (JSON.parse(readFileSync(astRecord, "utf-8")) as { commit?: string }).commit : undefined;
    const history = commit && /^[0-9a-f]{40}$/.test(commit) ? readAstHistory({ ig: clone, commit, repository: t.repository }) : undefined;
    if (history && existsSync(releases)) log(`  releases: ${annotateReleases(releases, history)} name the AST commit compiled from their tag`);
    else log("  releases: no AST commit recorded for any (the cache branch's history could not be read)");
  }
  return problems;
}

/**
 * Run `fn` in the work directory: the one `--work` names, kept, or else a new
 * `ig-index-*` under `os.tmpdir()`, removed when `fn` returns or throws, or
 * the run is cancelled (SIGINT, SIGTERM). Every output is copied out of it
 * into the layer, so nothing is lost; a directory left behind holds a clone
 * per IG, and those filled a session's disk (measured 2026-11-05: 447 MB each).
 */
export function withWorkDir<T>(given: string | undefined, fn: (work: string) => T): T {
  if (given !== undefined) return fn(given);
  const work = mkdtempSync(join(tmpdir(), "ig-index-"));
  const remove = () => rmSync(work, { recursive: true, force: true });
  const onSignal = (sig: NodeJS.Signals) => {
    remove();
    process.exit(128 + (sig === "SIGINT" ? 2 : 15));
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  try {
    return fn(work);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    remove();
  }
}

function main(): number {
  const argv = process.argv.slice(2);
  const val = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = checkoutRootFor(resolve(val("--root") ?? process.cwd()));
  const only = val("--only");
  const plan = argv.includes("--plan");
  const { targets, skipped } = igTargets(instancesIn(root), lsRemote, only);
  for (const s of skipped) console.error(`skipped: ${s.name} — ${s.why}`);
  if (only !== undefined && targets.length === 0 && !skipped.some((s) => s.name === only)) {
    console.error(`--only ${only}: no instance of that name needs ${LAYER} in ${root}`);
    return 2;
  }
  if (plan) {
    for (const t of targets) console.log(`${t.name}\t${t.repository}\t${t.branches.join(",")}`);
    return 0;
  }
  let failed = 0;
  withWorkDir(val("--work"), (work) => {
    for (const t of targets) {
      console.log(`${t.name} (${t.repository})`);
      const problems = buildOne(t, work, (s) => console.log(s), root);
      for (const p of problems) console.error(`✗ ${t.name}: ${p}`);
      if (problems.length) failed++;
    }
  });
  console.log(`${targets.length - failed} of ${targets.length} IG index(es) built${skipped.length ? `, ${skipped.length} skipped` : ""}`);
  return failed ? 1 : 0;
}

if (import.meta.main) process.exit(main());
