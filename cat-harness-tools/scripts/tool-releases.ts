#!/usr/bin/env bun
/**
 * Tool releases and profiles — validate every declared one (`--check`), resolve
 * and provision tool profiles or releases with per-tool runtime closure (`use`,
 * `which`), build `folio-run-context/v1` and `prov:used` records (`prov-used`),
 * export SPDX 3.0.1 build SBOMs (`sbom`), and export GITB Test Assertion Reports
 * (`itb-export`).
 *
 * @module scripts/tool-releases
 * @covers tool-release
 *
 * Design: `docs/proposals/tool-releases-2026-10-07.md`.
 *
 *   bun run cat-harness-tools/scripts/tool-releases.ts --check
 *   bun run cat-harness-tools/scripts/tool-releases.ts use [profile|ref] [--dry-run]
 *   bun run cat-harness-tools/scripts/tool-releases.ts which <tool> [--profile <p>]
 *   bun run cat-harness-tools/scripts/tool-releases.ts prov-used [--profile <p>]
 *   bun run cat-harness-tools/scripts/tool-releases.ts sbom [--profile <p>] [--run-context <file>]
 *   bun run cat-harness-tools/scripts/tool-releases.ts itb-export <test-run.json> [--run-context <file>]
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, join, relative, resolve } from "node:path";

import type { ProvActivity } from "../schemas/content/prov.ts";
import {
  RUN_CONTEXT_SCHEMA_TAG,
  RunContextSchema,
  canonicalRunContext,
  runContextRef,
  unprovisioned,
  type RunContext,
  type RunContextRef,
  type RunRelease,
} from "../schemas/sdlc/run-context.ts";
import { loadSpdxLicenseList } from "../schemas/library/spdx-license-expression.ts";
import type { TestReport } from "../schemas/sdlc/test-report.ts";
import { TestRunSchema, UNKNOWN_HASH, type HashBasis, type TestRun } from "../schemas/sdlc/test-run.ts";
import {
  TOOL_PROFILE_SCHEMA_TAG,
  ToolProfileSchema,
  toolReleaseGraphProblems,
  type ToolProfile,
} from "../schemas/tools/tool-profile.ts";
import {
  TOOL_RELEASE_SCHEMA_TAG,
  ToolReleaseSchema,
  parseToolReleaseRef,
  toolReleaseLicenceProblem,
  toolReleaseRef,
  type ToolPlatform,
  type ToolRelease,
  type ToolReleaseRef,
} from "../schemas/tools/tool-release.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

/** SPDX 3.0.1 JSON-LD context URL (`methodologies/spdx-3.md`). */
export const SPDX_3_0_1_CONTEXT_URL = "https://spdx.org/rdf/3.0.1/spdx-context.jsonld";

/**
 * The tool-release directories a layer can see, in overlay order —
 * resolved from declarations, including every dependency, the way
 * `codeListDirs` does. T1: every layer inherits cat-harness's.
 */
export async function toolReleaseDirs(instanceRoot: string): Promise<string[]> {
  const { orderedDependencies } = await import("../schemas/kg/harness-config.js");
  const { ownDirectories } = await import("../schemas/kg/cat-harness.js");
  const dirs: string[] = [];
  const add = (name: string, root: string, own: boolean) => {
    for (const d of ownDirectories({ name, root, own })) {
      if (d.graphTypologies.includes("tool-release")) dirs.push(d.absPath);
    }
  };
  for (const dep of orderedDependencies(instanceRoot)) add(dep.dependency.name, dep.rootPath, false);
  add("(root)", resolve(instanceRoot), true);
  return [...new Set(dirs)];
}

export interface LoadedToolReleases {
  releases: { file: string; release: ToolRelease }[];
  profiles: { file: string; profile: ToolProfile }[];
  problems: string[];
}

/** Read every `.json` in the directories, routing each by its `$schema` tag. Never throws. */
export function loadToolReleases(dirs: readonly string[], base: string): LoadedToolReleases {
  const out: LoadedToolReleases = { releases: [], profiles: [], problems: [] };
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const p = join(dir, f);
      const where = relative(base, p);
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(p, "utf-8"));
      } catch (e) {
        out.problems.push(`${where}: not JSON — ${(e as Error).message}`);
        continue;
      }
      const tag = (raw as { $schema?: unknown }).$schema;
      const stem = basename(f, ".json");
      if (tag === TOOL_RELEASE_SCHEMA_TAG) {
        const r = ToolReleaseSchema.safeParse(raw);
        if (!r.success) out.problems.push(`${where}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        else out.releases.push({ file: where, release: r.data });
      } else if (tag === TOOL_PROFILE_SCHEMA_TAG) {
        const r = ToolProfileSchema.safeParse(raw);
        if (!r.success) out.problems.push(`${where}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        else out.profiles.push({ file: where, profile: r.data });
      } else {
        out.problems.push(`${where}: carries neither \`${TOOL_RELEASE_SCHEMA_TAG}\` nor \`${TOOL_PROFILE_SCHEMA_TAG}\` — a file here must say what it is`);
        continue;
      }
      const name = (raw as { name?: unknown }).name;
      if (typeof name === "string" && name === stem) {
        out.problems.push(`${where}: its stem equals its \`name\`, so \`findDeclarationFile\` would take it for an instance declaration — rename the file`);
      }
    }
  }
  return out;
}

// ── Step 2: Resolver and provisioning cache (`tools:use`, `tools:which`) ───

/**
 * Root of the local tool-release cache:
 * `$CAT_HARNESS_TOOLS_CACHE` > `$XDG_CACHE_HOME/cat-harness/tools` > `~/.cache/cat-harness/tools`.
 */
export function toolCacheRoot(override?: string): string {
  if (override) return resolve(override);
  if (process.env.CAT_HARNESS_TOOLS_CACHE) return resolve(process.env.CAT_HARNESS_TOOLS_CACHE);
  const xdg = process.env.XDG_CACHE_HOME ? resolve(process.env.XDG_CACHE_HOME) : join(homedir(), ".cache");
  return join(xdg, "cat-harness", "tools");
}

/**
 * Cache directory for one release:
 * `<cacheRoot>/<name>/<version>-<sha256_prefix12>/`.
 * Two versions or digests of the same runtime (e.g. `temurin-jre@17.0.12+7` and
 * `temurin-jre@21.0.4+7`) sit in sibling directories and never overwrite each other.
 */
export function releaseCacheDir(release: Pick<ToolRelease, "name" | "version" | "digest">, cacheRoot?: string): string {
  const prefix = release.digest.digest.slice(0, 12);
  return join(toolCacheRoot(cacheRoot), release.name, `${release.version}-${prefix}`);
}

/** Where the primary artefact of a release lives inside its cache directory. */
export function releaseArtefactPath(release: ToolRelease, cacheRoot?: string): string {
  if (release.source.type === "oci") return release.source.reference;
  const dir = releaseCacheDir(release, cacheRoot);
  const urlPath = new URL(release.source.url).pathname;
  const base = basename(urlPath) || `${release.name}-${release.version}`;
  return join(dir, base);
}

/** Where `entry.home` resolves inside the release's cache directory, when declared. */
export function releaseHomePath(release: ToolRelease, cacheRoot?: string): string | undefined {
  if (release.entry.home === undefined) return undefined;
  return join(releaseCacheDir(release, cacheRoot), release.entry.home);
}

/** Expand `{path}` and `{home}` placeholders in a release's `entry.template`. */
export function expandEntryTemplate(release: ToolRelease, cacheRoot?: string): string {
  const art = releaseArtefactPath(release, cacheRoot);
  const home = releaseHomePath(release, cacheRoot) ?? releaseCacheDir(release, cacheRoot);
  return release.entry.template.replaceAll("{path}", art).replaceAll("{home}", home);
}

export interface ResolvedReleaseNode {
  ref: ToolReleaseRef;
  release: ToolRelease;
  cacheDir: string;
  artefactPath: string;
  homePath?: string;
  entryCommand: string;
  /** Direct runtime dependencies of THIS release, with their injection mode and resolved paths. */
  injectedRuntimes: {
    ref: ToolReleaseRef;
    inject: "JAVA_HOME" | "PATH";
    homePath: string;
    binPath: string;
  }[];
  /** Environment variables injected specifically for THIS release (`JAVA_HOME`, `PATH`). */
  env: Record<string, string>;
  /** Provisioning status (`provisioned` or `could-not-provision` with reason). */
  runRelease: RunRelease;
}

export interface ToolResolutionResult {
  profile?: { name: string; sha256: string; profile: ToolProfile };
  /** Every release in topological order (runtimes before the tools that depend on them). */
  closure: ResolvedReleaseNode[];
  /** Lookup by `<name>@<version>` ref. */
  byRef: ReadonlyMap<ToolReleaseRef, ResolvedReleaseNode>;
  /** Lookup by tool `name` for the top-level tools selected. */
  byToolName: ReadonlyMap<string, ResolvedReleaseNode>;
  /** Ready-to-record `RunRelease[]` entries for `folio-run-context/v1`. */
  runReleases: RunRelease[];
}

export interface ResolveToolsOptions {
  cacheRoot?: string;
  platform?: ToolPlatform;
  /**
   * - `"resolve-only"` (default for `--dry-run`): computes paths, runtime closure
   *   and `provisioned` state from the declared digests without network I/O.
   * - `"provision"`: verifies existing cached bytes or fetches via `fetcher`
   *   (or `fetch`), checks sha256 against `release.digest.digest`, and refuses
   *   mismatches without writing unverified bytes.
   */
  mode?: "resolve-only" | "provision";
  /** Optional injectable byte fetcher for deterministic provisioning tests. */
  fetcher?: (release: ToolRelease) => Promise<Uint8Array | Buffer> | Uint8Array | Buffer;
  /** Base PATH to prepend runtime `<home>/bin` entries onto. */
  basePath?: string;
}

function canonicalJson(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x !== null && typeof x === "object") {
      return Object.fromEntries(
        Object.keys(x as Record<string, unknown>)
          .sort()
          .map((k) => [k, sort((x as Record<string, unknown>)[k])]),
      );
    }
    return x;
  };
  return JSON.stringify(sort(v));
}

function selectReleaseForPlatform(candidates: readonly ToolRelease[], platform?: ToolPlatform): ToolRelease | undefined {
  if (candidates.length === 0) return undefined;
  const universal = candidates.find((c) => c.platform === undefined);
  if (universal) return universal;
  if (platform) {
    const exact = candidates.find(
      (c) =>
        c.platform?.os === platform.os &&
        c.platform?.arch === platform.arch &&
        (platform.distribution === undefined || c.platform?.distribution === undefined || c.platform.distribution === platform.distribution),
    );
    if (exact) return exact;
    return undefined;
  }
  return candidates[0];
}

async function provisionOneRelease(
  release: ToolRelease,
  artefactPath: string,
  homePath: string | undefined,
  options: ResolveToolsOptions,
): Promise<RunRelease> {
  const ref = toolReleaseRef(release);
  const mode = options.mode ?? (options.fetcher ? "provision" : "resolve-only");
  if (mode === "resolve-only") {
    return {
      state: "provisioned",
      release: ref,
      digest: release.digest,
    };
  }

  if (release.source.type === "oci") {
    // OCI images are addressed by @sha256: digest in the reference itself.
    const atDigest = release.source.reference.split("@sha256:")[1];
    if (atDigest !== release.digest.digest) {
      return {
        state: "could-not-provision",
        release: ref,
        reason: `OCI reference digest mismatch for ${ref}: expected ${release.digest.digest}, got ${atDigest ?? "none"}`,
        expected: release.digest,
      };
    }
    return { state: "provisioned", release: ref, digest: release.digest };
  }

  let bytes: Buffer | undefined;
  if (existsSync(artefactPath) && !options.fetcher) {
    try {
      bytes = readFileSync(artefactPath);
    } catch (e) {
      return {
        state: "could-not-provision",
        release: ref,
        reason: `could not read cached artefact ${artefactPath}: ${(e as Error).message}`,
        expected: release.digest,
      };
    }
  } else if (options.fetcher) {
    try {
      const raw = await options.fetcher(release);
      bytes = Buffer.from(raw);
    } catch (e) {
      return {
        state: "could-not-provision",
        release: ref,
        reason: `fetch failed for ${ref} (${release.source.url}): ${(e as Error).message}`,
        expected: release.digest,
      };
    }
  } else {
    try {
      const res = await fetch(release.source.url);
      if (!res.ok) {
        return {
          state: "could-not-provision",
          release: ref,
          reason: `HTTP ${res.status} fetching ${release.source.url}`,
          expected: release.digest,
        };
      }
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      return {
        state: "could-not-provision",
        release: ref,
        reason: `network error fetching ${release.source.url}: ${(e as Error).message}`,
        expected: release.digest,
      };
    }
  }

  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== release.digest.digest) {
    return {
      state: "could-not-provision",
      release: ref,
      reason: `sha256 mismatch for ${ref}: expected ${release.digest.digest}, got ${actual}`,
      expected: release.digest,
    };
  }

  mkdirSync(releaseCacheDir(release, options.cacheRoot), { recursive: true });
  writeFileSync(artefactPath, bytes);
  if (homePath) {
    mkdirSync(join(homePath, "bin"), { recursive: true });
  }
  return {
    state: "provisioned",
    release: ref,
    digest: release.digest,
  };
}

/**
 * Resolve a profile (by name, e.g. `"default"`) or a list of tool release refs
 * (`["plantuml@1.2026.9"]`), computing the full transitive runtime dependency
 * closure and per-tool environment injection (`JAVA_HOME` and `PATH`).
 */
export async function resolveTools(
  loaded: Pick<LoadedToolReleases, "releases" | "profiles">,
  target: { profile?: string; refs?: readonly ToolReleaseRef[] },
  options: ResolveToolsOptions = {},
): Promise<ToolResolutionResult> {
  const candidatesByRef = new Map<ToolReleaseRef, ToolRelease[]>();
  for (const { release } of loaded.releases) {
    const ref = toolReleaseRef(release);
    candidatesByRef.set(ref, [...(candidatesByRef.get(ref) ?? []), release]);
  }

  let selectedProfile: { name: string; sha256: string; profile: ToolProfile } | undefined;
  const rootRefs: ToolReleaseRef[] = [];

  if (target.profile !== undefined) {
    const found = loaded.profiles.find((p) => p.profile.name === target.profile);
    if (!found) {
      throw new Error(`unknown tool profile \`${target.profile}\``);
    }
    const sha256 = createHash("sha256").update(canonicalJson(found.profile)).digest("hex");
    selectedProfile = { name: found.profile.name, sha256, profile: found.profile };
    for (const ref of Object.values(found.profile.tools)) rootRefs.push(ref);
  }
  if (target.refs) {
    for (const r of target.refs) rootRefs.push(r);
  }

  const resolvedByRef = new Map<ToolReleaseRef, ResolvedReleaseNode>();
  const visiting = new Set<ToolReleaseRef>();
  const closure: ResolvedReleaseNode[] = [];
  const missingRunReleases: RunRelease[] = [];

  const visit = async (ref: ToolReleaseRef): Promise<ResolvedReleaseNode | undefined> => {
    const existing = resolvedByRef.get(ref);
    if (existing) return existing;
    if (visiting.has(ref)) {
      throw new Error(`circular runtime dependency involving \`${ref}\``);
    }
    const allCandidates = candidatesByRef.get(ref) ?? [];
    const chosen = selectReleaseForPlatform(allCandidates, options.platform);
    if (!chosen) {
      const reason =
        allCandidates.length === 0
          ? `no tool-release record declares \`${ref}\``
          : `no release of \`${ref}\` matches platform ${options.platform ? `${options.platform.os}-${options.platform.arch}` : "host"}`;
      missingRunReleases.push({
        state: "could-not-provision",
        release: ref,
        reason,
        ...(allCandidates[0] ? { expected: allCandidates[0].digest } : {}),
      });
      return undefined;
    }

    visiting.add(ref);
    const injectedRuntimes: ResolvedReleaseNode["injectedRuntimes"] = [];
    let failedRuntime: { ref: ToolReleaseRef; reason: string } | undefined;

    for (const rt of chosen.runtimes) {
      const rtNode = await visit(rt.release);
      if (!rtNode || rtNode.runRelease.state === "could-not-provision") {
        const why =
          rtNode?.runRelease.state === "could-not-provision"
            ? rtNode.runRelease.reason
            : `runtime \`${rt.release}\` could not be resolved`;
        failedRuntime = { ref: rt.release, reason: why };
        continue;
      }
      const home = rtNode.homePath ?? rtNode.cacheDir;
      injectedRuntimes.push({
        ref: rt.release,
        inject: rt.inject,
        homePath: home,
        binPath: join(home, "bin"),
      });
    }
    visiting.delete(ref);

    const cacheDir = releaseCacheDir(chosen, options.cacheRoot);
    const artefactPath = releaseArtefactPath(chosen, options.cacheRoot);
    const homePath = releaseHomePath(chosen, options.cacheRoot);
    const entryCommand = expandEntryTemplate(chosen, options.cacheRoot);

    const env: Record<string, string> = {};
    const pathBins: string[] = [];
    for (const rt of injectedRuntimes) {
      if (rt.inject === "JAVA_HOME") {
        env.JAVA_HOME = rt.homePath;
        pathBins.push(rt.binPath);
      } else if (rt.inject === "PATH") {
        pathBins.push(rt.binPath);
      }
    }
    if (homePath) {
      pathBins.push(join(homePath, "bin"));
    }
    const basePath = options.basePath ?? process.env.PATH ?? "";
    if (pathBins.length > 0) {
      env.PATH = [...pathBins, ...(basePath ? [basePath] : [])].join(delimiter);
    } else if (basePath) {
      env.PATH = basePath;
    }

    let runRelease: RunRelease;
    if (failedRuntime) {
      runRelease = {
        state: "could-not-provision",
        release: ref,
        reason: `required runtime ${failedRuntime.ref} could not be provisioned: ${failedRuntime.reason}`,
        expected: chosen.digest,
      };
    } else {
      runRelease = await provisionOneRelease(chosen, artefactPath, homePath, options);
    }

    const node: ResolvedReleaseNode = {
      ref,
      release: chosen,
      cacheDir,
      artefactPath,
      ...(homePath ? { homePath } : {}),
      entryCommand,
      injectedRuntimes,
      env,
      runRelease,
    };
    resolvedByRef.set(ref, node);
    closure.push(node);
    return node;
  };

  const byToolName = new Map<string, ResolvedReleaseNode>();
  for (const ref of rootRefs) {
    const node = await visit(ref);
    if (node) {
      byToolName.set(node.release.name, node);
    } else {
      const { name } = parseToolReleaseRef(ref);
      void name;
    }
  }

  const runReleases: RunRelease[] = [...closure.map((c) => c.runRelease), ...missingRunReleases];
  return {
    ...(selectedProfile ? { profile: selectedProfile } : {}),
    closure,
    byRef: resolvedByRef,
    byToolName,
    runReleases,
  };
}

/**
 * Resolve a single tool by tool name (e.g. `"plantuml"` in profile `"default"`)
 * or by explicit `<name>@<version>` ref (`tools:which`).
 */
export async function whichTool(
  loaded: Pick<LoadedToolReleases, "releases" | "profiles">,
  toolOrRef: string,
  options: ResolveToolsOptions & { profile?: string } = {},
): Promise<ResolvedReleaseNode> {
  if (toolOrRef.includes("@")) {
    const res = await resolveTools(loaded, { refs: [toolOrRef] }, options);
    const node = res.byRef.get(toolOrRef);
    if (!node) {
      const miss = res.runReleases.find((r) => r.release === toolOrRef && r.state === "could-not-provision");
      throw new Error(miss && miss.state === "could-not-provision" ? miss.reason : `could not resolve ${toolOrRef}`);
    }
    return node;
  }
  const profileName = options.profile ?? "default";
  const prof = loaded.profiles.find((p) => p.profile.name === profileName);
  if (prof && prof.profile.tools[toolOrRef]) {
    const res = await resolveTools(loaded, { profile: profileName }, options);
    const node = res.byToolName.get(toolOrRef);
    if (node) return node;
  }
  // Fallback: match a unique tool release by name.
  const matching = loaded.releases.filter((r) => r.release.name === toolOrRef);
  if (matching.length === 0) {
    throw new Error(`no tool release named \`${toolOrRef}\` in profile \`${profileName}\` or declared releases`);
  }
  const ref = toolReleaseRef(matching[0]!.release);
  const res = await resolveTools(loaded, { refs: [ref] }, options);
  const node = res.byRef.get(ref);
  if (!node) throw new Error(`could not resolve ${ref}`);
  return node;
}

// ── Step 3: `prov:used` and `folio-run-context/v1` emission ────────────────

export interface BuildRunContextOptions {
  platformCommit: string;
  mounts?: RunContext["mounts"];
  resolution: ToolResolutionResult;
  invoker: RunContext["invoker"];
  inputs?: HashBasis[];
  provActivity?: string;
}

/**
 * Construct and validate a `folio-run-context/v1` record from a
 * {@link ToolResolutionResult}, and return both the context and its
 * content-addressed `{ sha256 }` reference (`C1 = a`).
 */
export function buildRunContext(opts: BuildRunContextOptions): {
  context: RunContext;
  ref: RunContextRef;
  canonicalBytes: string;
} {
  const seen = new Set<string>();
  const dedupedReleases: RunRelease[] = [];
  for (const r of opts.resolution.runReleases) {
    if (seen.has(r.release)) continue;
    seen.add(r.release);
    dedupedReleases.push(r);
  }
  const context = RunContextSchema.parse({
    $schema: RUN_CONTEXT_SCHEMA_TAG,
    platform: { commit: opts.platformCommit },
    mounts: opts.mounts ?? { state: "none" },
    ...(opts.resolution.profile
      ? { profile: { name: opts.resolution.profile.name, sha256: opts.resolution.profile.sha256 } }
      : {}),
    releases: dedupedReleases,
    invoker: opts.invoker,
    inputs: opts.inputs ?? [],
    ...(opts.provActivity ? { prov: { activity: opts.provActivity } } : {}),
  });
  return {
    context,
    ref: runContextRef(context),
    canonicalBytes: canonicalRunContext(context),
  };
}

/**
 * The `prov:used` entity identifiers (`<name>@<version>`) for all releases that
 * were actually provisioned in a {@link RunContext}. Releases in state
 * `could-not-provision` were NOT used by the activity and are omitted here
 * (while remaining recorded with their reason in `RunContext.releases[]`).
 */
export function provUsedFromRunContext(context: Pick<RunContext, "releases">): ToolReleaseRef[] {
  return context.releases
    .filter((r): r is Extract<RunRelease, { state: "provisioned" }> => r.state === "provisioned")
    .map((r) => r.release);
}

/**
 * Attach provisioned tool and runtime releases from a {@link RunContext} onto a
 * PROV-O {@link ProvActivity}'s `prov:used` array (Step 3: tool releases are
 * `prov:Entity` objects used by the activity, never `prov:Agent`).
 */
export function attachProvUsedToActivity(activity: ProvActivity, context: Pick<RunContext, "releases">): ProvActivity {
  const used = provUsedFromRunContext(context);
  const existing = activity["prov:used"] ?? [];
  const merged = [...new Set([...existing, ...used])];
  return {
    ...activity,
    ...(merged.length > 0 ? { "prov:used": merged } : {}),
  };
}

/**
 * Project `QaReport.toolchain` (`{ publisher?, sushi?, fhirVersion? }`) from a
 * {@link RunContext}'s provisioned releases (Step 7, C2).
 */
export function projectQaToolchain(
  context: Pick<RunContext, "releases">,
  extra?: { fhirVersion?: string },
): { publisher?: string; sushi?: string; fhirVersion?: string } {
  const out: { publisher?: string; sushi?: string; fhirVersion?: string } = {};
  for (const r of context.releases) {
    if (r.state !== "provisioned") continue;
    const { name, version } = parseToolReleaseRef(r.release);
    if (name === "fhir-ig-publisher" || name === "ig-publisher" || name === "publisher") {
      out.publisher = version;
    } else if (name === "fsh-sushi" || name === "sushi") {
      out.sushi = version;
    }
  }
  if (extra?.fhirVersion) out.fhirVersion = extra.fhirVersion;
  return out;
}

// ── Step 4: `tools:sbom` — SPDX 3.0.1 JSON-LD export ───────────────────────

export interface ExportSpdxSbomOptions {
  /** Releases in the closure to export as `software_Package` nodes. */
  releases: readonly ToolRelease[];
  /** Optional profile that selected the tools. */
  profile?: ToolProfile;
  /**
   * Optional `folio-run-context/v1`. When provided, emits a `build_Build`
   * element and a `LifecycleScopedRelationship` (`scope: "build"`,
   * `relationshipType: "usesTool"`) to each provisioned `software_Package`.
   */
  runContext?: RunContext;
  created?: string;
  creatorAgentSpdxId?: string;
  creatorName?: string;
  documentSpdxId?: string;
}

function spdxSafeSlug(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function packageSpdxId(ref: ToolReleaseRef): string {
  const { name, version } = parseToolReleaseRef(ref);
  return `urn:spdx:pkg:${spdxSafeSlug(name)}-${spdxSafeSlug(version)}`;
}

/**
 * Generate an SPDX 3.0.1 JSON-LD document (`@context: "https://spdx.org/rdf/3.0.1/spdx-context.jsonld"`)
 * from resolved tool releases, an optional profile, and an optional `RunContext`.
 *
 * Implements the mapping in `docs/proposals/tool-releases-2026-10-07.md` §4:
 * - `CreationInfo` (`specVersion: "3.0.1"`) and `Agent`
 * - `SpdxDocument` and `software_Sbom` (`sbomType: ["build"]`)
 * - one `software_Package` per release (`name`, `packageVersion`, `downloadLocation`,
 *   `verifiedUsing: [{ type: "Hash", algorithm: "sha256", hashValue }]`)
 * - one `simplelicensing_LicenseExpression` per distinct SPDX licence expression,
 *   linked via `Relationship` (`relationshipType: "hasDeclaredLicense"`)
 * - one `Relationship` (`relationshipType: "dependsOn"`) from each tool package
 *   to each of its `runtimes[]` packages
 * - when `runContext` is given: a `build_Build` element and a
 *   `LifecycleScopedRelationship` (`scope: "build"`, `relationshipType: "usesTool"`)
 *   linking the build to every provisioned `software_Package`.
 */
export function exportSpdxSbom(options: ExportSpdxSbomOptions): Record<string, unknown> {
  const created = options.created ?? "2026-10-07T00:00:00Z";
  const agentId = options.creatorAgentSpdxId ?? "urn:spdx:agent:cat-harness";
  const docId =
    options.documentSpdxId ??
    (options.runContext
      ? `urn:spdx:doc:run-${runContextRef(options.runContext).sha256.slice(0, 12)}`
      : options.profile
        ? `urn:spdx:doc:profile-${spdxSafeSlug(options.profile.name)}`
        : "urn:spdx:doc:tool-releases");
  const sbomId = `${docId}:sbom`;
  const creationInfoId = "_:creationInfo";

  const profilesUsed = ["core", "software", "simpleLicensing", ...(options.runContext ? ["build"] : [])];
  const graph: Record<string, unknown>[] = [
    {
      type: "CreationInfo",
      "@id": creationInfoId,
      specVersion: "3.0.1",
      created,
      createdBy: [agentId],
      profile: profilesUsed,
    },
    {
      type: "Agent",
      spdxId: agentId,
      creationInfo: creationInfoId,
      name: options.creatorName ?? "cat-harness tools:sbom",
    },
  ];

  const elementIds: string[] = [agentId];
  const licenseIdByExpr = new Map<string, string>();

  // Sort releases deterministically by `<name>@<version>`.
  const sortedReleases = [...options.releases].sort((a, b) => toolReleaseRef(a).localeCompare(toolReleaseRef(b)));

  for (const rel of sortedReleases) {
    if (!licenseIdByExpr.has(rel.licence)) {
      const licId = `urn:spdx:license:${spdxSafeSlug(rel.licence)}`;
      licenseIdByExpr.set(rel.licence, licId);
      graph.push({
        type: "simplelicensing_LicenseExpression",
        spdxId: licId,
        creationInfo: creationInfoId,
        simplelicensing_licenseExpression: rel.licence,
      });
      elementIds.push(licId);
    }
  }

  for (const rel of sortedReleases) {
    const ref = toolReleaseRef(rel);
    const pkgId = packageSpdxId(ref);
    const downloadLocation = rel.source.type === "url" ? rel.source.url : rel.source.reference;
    graph.push({
      type: "software_Package",
      spdxId: pkgId,
      creationInfo: creationInfoId,
      name: rel.name,
      packageVersion: rel.version,
      software_packageVersion: rel.version,
      downloadLocation,
      software_downloadLocation: downloadLocation,
      software_primaryPurpose: "application",
      verifiedUsing: [
        {
          type: "Hash",
          algorithm: "sha256",
          hashValue: rel.digest.digest,
        },
      ],
    });
    elementIds.push(pkgId);

    const licId = licenseIdByExpr.get(rel.licence)!;
    const licRelId = `urn:spdx:rel:license:${spdxSafeSlug(rel.name)}-${spdxSafeSlug(rel.version)}`;
    graph.push({
      type: "Relationship",
      spdxId: licRelId,
      creationInfo: creationInfoId,
      from: pkgId,
      to: [licId],
      relationshipType: "hasDeclaredLicense",
    });
    elementIds.push(licRelId);

    if (rel.runtimes.length > 0) {
      const depTargets = rel.runtimes.map((rt) => packageSpdxId(rt.release));
      const depRelId = `urn:spdx:rel:dependsOn:${spdxSafeSlug(rel.name)}-${spdxSafeSlug(rel.version)}`;
      graph.push({
        type: "Relationship",
        spdxId: depRelId,
        creationInfo: creationInfoId,
        from: pkgId,
        to: depTargets,
        relationshipType: "dependsOn",
      });
      elementIds.push(depRelId);
    }
  }

  const rootElements: string[] = sortedReleases
    .filter((r) => r.role === "tool")
    .map((r) => packageSpdxId(toolReleaseRef(r)));

  if (options.runContext) {
    const ctxRef = runContextRef(options.runContext);
    const buildId = `urn:spdx:build:${ctxRef.sha256.slice(0, 16)}`;
    graph.push({
      type: "build_Build",
      spdxId: buildId,
      creationInfo: creationInfoId,
      build_buildId: ctxRef.sha256,
      build_buildType: "https://litlfred.github.io/cat-harness/ns/v0/schemas/run-context",
      verifiedUsing: [
        {
          type: "Hash",
          algorithm: "sha256",
          hashValue: ctxRef.sha256,
        },
      ],
      ...(options.runContext.prov?.activity
        ? {
            externalIdentifier: [
              {
                type: "ExternalIdentifier",
                externalIdentifierType: "other",
                identifier: options.runContext.prov.activity,
              },
            ],
          }
        : {}),
    });
    elementIds.push(buildId);
    rootElements.unshift(buildId);

    const provisionedRefs = provUsedFromRunContext(options.runContext);
    if (provisionedRefs.length > 0) {
      const usesToolRelId = `urn:spdx:rel:usesTool:${ctxRef.sha256.slice(0, 16)}`;
      graph.push({
        type: "LifecycleScopedRelationship",
        spdxId: usesToolRelId,
        creationInfo: creationInfoId,
        from: buildId,
        to: provisionedRefs.map((r) => packageSpdxId(r)),
        relationshipType: "usesTool",
        scope: "build",
      });
      elementIds.push(usesToolRelId);
    }
  }

  graph.push({
    type: "software_Sbom",
    spdxId: sbomId,
    creationInfo: creationInfoId,
    sbomType: ["build"],
    software_sbomType: ["build"],
    rootElement: rootElements,
    element: elementIds,
  });

  graph.push({
    type: "SpdxDocument",
    spdxId: docId,
    creationInfo: creationInfoId,
    rootElement: [sbomId],
    element: [sbomId, ...elementIds],
  });

  return {
    "@context": SPDX_3_0_1_CONTEXT_URL,
    "@graph": graph,
  };
}

// ── Step 8: `test:itb-export` — GITB TAR from `folio-test-run` ─────────────

export type GitbTarResult = "SUCCESS" | "FAILURE" | "UNDEFINED";

export interface GitbTarAssertionReport {
  id: string;
  description: string;
  result: GitbTarResult;
  [key: string]: unknown;
}

export interface GitbTarReport {
  $schema: "gitb-tar/v1";
  name: string;
  version: string;
  date: string;
  result: GitbTarResult;
  counters: {
    nrOfAssertions: number;
    nrOfErrors: number;
    nrOfWarnings: number;
  };
  context: {
    skill: string;
    subject: string;
    data: HashBasis;
    process: HashBasis;
    plan?: TestRun["plan"];
    sut?: TestRun["sut"];
    requirements?: string[];
    runContext?: RunContextRef;
    platformCommit?: string;
    mounts?: RunContext["mounts"];
    profile?: RunContext["profile"];
    releases?: RunRelease[];
  };
  reports: GitbTarAssertionReport[];
}

export interface ExportGitbTarOptions {
  runContext?: RunContext;
  testReport?: TestReport;
}

/**
 * Generate a GITB Test Assertion Report (TAR) from a `folio-test-run/v1` record
 * (and optional `folio-run-context/v1` and `test-report/v1`), placing the
 * `runContext` reference (`{ sha256 }`, owner C1 = a) and resolved tool
 * releases in the TAR's `context` block (Step 8 of
 * `docs/proposals/tool-releases-2026-10-07.md`).
 */
export function exportGitbTar(testRunInput: TestRun, options: ExportGitbTarOptions = {}): GitbTarReport {
  const testRun = TestRunSchema.parse(testRunInput);
  const ctxRef =
    testRun.runContext ??
    options.testReport?.runContext ??
    (options.runContext ? runContextRef(options.runContext) : undefined);

  const reports: GitbTarAssertionReport[] = [];
  let nrOfErrors = 0;
  let nrOfWarnings = 0;
  let nrOfPassed = 0;

  if (options.testReport) {
    for (const [caseId, verdicts] of Object.entries(options.testReport.cases)) {
      const current = verdicts.at(-1);
      if (!current) continue;
      let caseResult: GitbTarResult = "UNDEFINED";
      if (current.result === "pass") {
        caseResult = "SUCCESS";
        nrOfPassed += 1;
      } else if (current.result === "fail") {
        caseResult = "FAILURE";
        nrOfErrors += 1;
      } else if (current.result === "warn") {
        caseResult = "SUCCESS";
        nrOfWarnings += 1;
        nrOfPassed += 1;
      } else {
        caseResult = "UNDEFINED";
      }
      reports.push({
        id: caseId,
        description: current.notes ?? current.reason ?? `Test case ${caseId}`,
        result: caseResult,
        reviewer: current.reviewer,
        reviewed_at: current.reviewed_at,
      });
    }
  } else if (testRun.cases && testRun.cases.length > 0) {
    testRun.cases.forEach((c, idx) => {
      const outObj = c.output !== null && typeof c.output === "object" ? (c.output as Record<string, unknown>) : {};
      const status = outObj.result ?? outObj.status ?? (outObj.pass === true ? "pass" : outObj.pass === false ? "fail" : "pass");
      let caseResult: GitbTarResult = "SUCCESS";
      if (status === "fail" || status === "failed" || status === "FAILURE") {
        caseResult = "FAILURE";
        nrOfErrors += 1;
      } else if (status === "warn" || status === "warning") {
        caseResult = "SUCCESS";
        nrOfWarnings += 1;
        nrOfPassed += 1;
      } else if (status === "unknown" || status === "skipped" || status === "n/a") {
        caseResult = "UNDEFINED";
      } else {
        caseResult = "SUCCESS";
        nrOfPassed += 1;
      }
      reports.push({
        id: typeof outObj.id === "string" ? outObj.id : `case-${idx + 1}`,
        description: typeof outObj.description === "string" ? outObj.description : `Case ${idx + 1} for ${testRun.skill}`,
        result: caseResult,
      });
    });
  } else {
    const outcome = testRun.outcome;
    const failCount = typeof outcome.fail === "number" ? outcome.fail : typeof outcome.failed === "number" ? outcome.failed : 0;
    const warnCount = typeof outcome.warn === "number" ? outcome.warn : typeof outcome.warnings === "number" ? outcome.warnings : 0;
    const passCount = typeof outcome.pass === "number" ? outcome.pass : typeof outcome.passed === "number" ? outcome.passed : 0;
    nrOfErrors = failCount;
    nrOfWarnings = warnCount;
    nrOfPassed = passCount;
  }

  let overall: GitbTarResult = "UNDEFINED";
  if (testRun.data.hash === UNKNOWN_HASH || testRun.process.hash === UNKNOWN_HASH) {
    overall = "UNDEFINED";
  } else if (options.testReport && options.testReport.status !== "completed") {
    overall = nrOfErrors > 0 ? "FAILURE" : "UNDEFINED";
  } else if (nrOfErrors > 0) {
    overall = "FAILURE";
  } else if (nrOfPassed > 0) {
    overall = "SUCCESS";
  }

  return {
    $schema: "gitb-tar/v1",
    name: testRun.plan?.id ?? testRun.skill,
    version: testRun.plan?.version ?? "1",
    date: testRun.updated_at,
    result: overall,
    counters: {
      nrOfAssertions: reports.length > 0 ? reports.length : nrOfPassed + nrOfErrors + nrOfWarnings,
      nrOfErrors,
      nrOfWarnings,
    },
    context: {
      skill: testRun.skill,
      subject: testRun.subject,
      data: testRun.data,
      process: testRun.process,
      ...(testRun.plan ? { plan: testRun.plan } : {}),
      ...(testRun.sut ? { sut: testRun.sut } : {}),
      ...(testRun.requirements ? { requirements: testRun.requirements } : {}),
      ...(ctxRef ? { runContext: ctxRef } : {}),
      ...(options.runContext
        ? {
            platformCommit: options.runContext.platform.commit,
            mounts: options.runContext.mounts,
            ...(options.runContext.profile ? { profile: options.runContext.profile } : {}),
            releases: options.runContext.releases,
          }
        : {}),
    },
    reports,
  };
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────

function argVal(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

async function runCheck(argv: string[]): Promise<number> {
  const instance = argVal(argv, "--instance") ? resolve(argVal(argv, "--instance")!) : ROOT;
  const base = resolve(instance, "..");
  const dirs = await toolReleaseDirs(instance);
  const loaded = loadToolReleases(dirs, base);
  const problems = [...loaded.problems];

  console.log(
    `${loaded.releases.length} tool release(s) and ${loaded.profiles.length} profile(s) from ${dirs.length} declared director${dirs.length === 1 ? "y" : "ies"}:`,
  );
  for (const { release: r } of loaded.releases) {
    const plat = r.platform ? ` [${r.platform.os}-${r.platform.arch}${r.platform.distribution ? `-${r.platform.distribution}` : ""}]` : "";
    console.log(`  ${(toolReleaseRef(r) + plat).padEnd(50)} ${r.role.padEnd(8)} ${r.kind.padEnd(8)} ${r.digest.digest.slice(0, 12)}`);
  }
  for (const { profile: p } of loaded.profiles) console.log(`  profile ${p.name.padEnd(42)} ${Object.values(p.tools).join(", ")}`);

  if (loaded.releases.length === 0 && problems.length === 0) {
    console.error("\nNo tool release found — `could not determine`, not a pass.");
    return 2;
  }

  const list = loadSpdxLicenseList(resolve(instance, ".."));
  if (typeof list === "string") problems.push(`licences could not be checked: ${list}`);
  else {
    for (const { file, release } of loaded.releases) {
      const problem = toolReleaseLicenceProblem(release, list);
      if (problem) problems.push(`${file}: licence \`${release.licence}\` — ${problem}`);
    }
  }
  problems.push(...toolReleaseGraphProblems(loaded.releases.map((r) => r.release), loaded.profiles.map((p) => p.profile)));

  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} finding(s):`);
    for (const p of problems) console.error(`    ${p}`);
    return 1;
  }
  console.log("\n✓ every release and profile parses, every licence is on the pinned SPDX list, and every ref resolves");
  return 0;
}

async function run(argv: string[]): Promise<number> {
  const sub = argv[0];
  if (!sub || sub === "--check" || sub.startsWith("--")) {
    return runCheck(argv);
  }

  const instance = argVal(argv, "--instance") ? resolve(argVal(argv, "--instance")!) : ROOT;
  const base = resolve(instance, "..");
  const dirs = await toolReleaseDirs(instance);
  const loaded = loadToolReleases(dirs, base);
  const cacheRoot = argVal(argv, "--cache-dir");
  const dryRun = argv.includes("--dry-run") || !argv.includes("--provision");

  if (sub === "use") {
    const targetArg = argv[1] && !argv[1].startsWith("--") ? argv[1] : (argVal(argv, "--profile") ?? "default");
    const target = targetArg.includes("@") ? { refs: [targetArg] } : { profile: targetArg };
    const res = await resolveTools(loaded, target, {
      ...(cacheRoot ? { cacheRoot } : {}),
      mode: dryRun ? "resolve-only" : "provision",
    });
    console.log(
      JSON.stringify(
        {
          ...(res.profile ? { profile: { name: res.profile.name, sha256: res.profile.sha256 } } : {}),
          closure: res.closure.map((c) => ({
            ref: c.ref,
            role: c.release.role,
            kind: c.release.kind,
            cacheDir: c.cacheDir,
            artefactPath: c.artefactPath,
            ...(c.homePath ? { homePath: c.homePath } : {}),
            entryCommand: c.entryCommand,
            injectedRuntimes: c.injectedRuntimes,
            state: c.runRelease.state,
          })),
          releases: res.runReleases,
        },
        null,
        2,
      ),
    );
    return res.runReleases.some((r) => r.state === "could-not-provision") ? 1 : 0;
  }

  if (sub === "which") {
    const tool = argv[1];
    if (!tool || tool.startsWith("--")) {
      console.error("Usage: tool-releases.ts which <tool|name@version> [--profile <name>]");
      return 2;
    }
    const profile = argVal(argv, "--profile");
    const node = await whichTool(loaded, tool, {
      ...(cacheRoot ? { cacheRoot } : {}),
      ...(profile ? { profile } : {}),
      mode: dryRun ? "resolve-only" : "provision",
    });
    console.log(
      JSON.stringify(
        {
          ref: node.ref,
          cacheDir: node.cacheDir,
          artefactPath: node.artefactPath,
          ...(node.homePath ? { homePath: node.homePath } : {}),
          entryCommand: node.entryCommand,
          env: node.env,
          injectedRuntimes: node.injectedRuntimes,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (sub === "prov-used") {
    const profile = argVal(argv, "--profile") ?? "default";
    const commit = argVal(argv, "--commit") ?? "0".repeat(40);
    const res = await resolveTools(loaded, { profile }, { ...(cacheRoot ? { cacheRoot } : {}), mode: "resolve-only" });
    const { context, ref } = buildRunContext({
      platformCommit: commit,
      resolution: res,
      invoker: { kind: "system", id: "cat-harness-tools/scripts/tool-releases.ts", script_hash: "unknown" },
    });
    const out = {
      runContextRef: ref,
      provUsed: provUsedFromRunContext(context),
      unprovisioned: unprovisioned(context),
      runContext: context,
    };
    const outFile = argVal(argv, "--out");
    if (outFile) writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  if (sub === "sbom") {
    const profileName = argVal(argv, "--profile") ?? "default";
    const runCtxFile = argVal(argv, "--run-context");
    const runContext = runCtxFile ? RunContextSchema.parse(JSON.parse(readFileSync(runCtxFile, "utf-8"))) : undefined;
    const res = await resolveTools(loaded, { profile: profileName }, { ...(cacheRoot ? { cacheRoot } : {}), mode: "resolve-only" });
    const sbom = exportSpdxSbom({
      releases: res.closure.map((c) => c.release),
      ...(res.profile ? { profile: res.profile.profile } : {}),
      ...(runContext ? { runContext } : {}),
    });
    const outFile = argVal(argv, "--out");
    if (outFile) writeFileSync(outFile, `${JSON.stringify(sbom, null, 2)}\n`);
    console.log(JSON.stringify(sbom, null, 2));
    return 0;
  }

  if (sub === "itb-export") {
    const testRunFile = argv[1];
    if (!testRunFile || testRunFile.startsWith("--")) {
      console.error("Usage: tool-releases.ts itb-export <test-run.json> [--run-context <ctx.json>] [--out <tar.json>]");
      return 2;
    }
    const testRun = TestRunSchema.parse(JSON.parse(readFileSync(testRunFile, "utf-8")));
    const runCtxFile = argVal(argv, "--run-context");
    const runContext = runCtxFile ? RunContextSchema.parse(JSON.parse(readFileSync(runCtxFile, "utf-8"))) : undefined;
    const tar = exportGitbTar(testRun, { ...(runContext ? { runContext } : {}) });
    const outFile = argVal(argv, "--out");
    if (outFile) writeFileSync(outFile, `${JSON.stringify(tar, null, 2)}\n`);
    console.log(JSON.stringify(tar, null, 2));
    return 0;
  }

  console.error(`Unknown subcommand \`${sub}\``);
  return 2;
}

if (import.meta.main) process.exit(await run(process.argv.slice(2)));
