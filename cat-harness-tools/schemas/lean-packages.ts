/**
 * The `lean.ref` grammar and the package registry it resolves against.
 *
 * **Mechanism, not content.** This module knows that a block may cite a formal
 * artefact as `package:Declaration`, how to parse one, and how to look up the
 * package a folio has declared. It does not know which packages exist — a
 * folio injects those with {@link configureLeanPackages}.
 *
 * The `lean` field sits on shared block kinds (`remark`, `example`,
 * `algorithm`, `simulator`) and the document profile forbids its use
 * (`pipeline/profile-check.ts`). The pattern is {@link LEAN_REF_PATTERN}.
 *
 * ## Unconfigured is not empty
 *
 * The registry starts empty and stays empty until a folio configures it, and
 * those two states are different facts: **nobody has said** is not **there are
 * none**. {@link leanPackagesConfigured} is how a caller tells them apart, so
 * a pipeline can report "not checked" rather than silently skipping every
 * library-tree `lean.ref`. There is no built-in default package list.
 *
 * @module schemas/lean-packages
 * @graphNode schema
 */

export interface LeanPackage {
  /** Short-form package name used in `lean.ref` URI prefixes. */
  name: string;
  /** Paper directory under `folio/` (where the `.ts`/`.md` siblings live). */
  paperDir: string;
  /** Path to the paper's Lake package root, relative to repo root. */
  lakeRoot: string;
  /** Default `[[lean_lib]]` name (module root, e.g. "MyPaper"). */
  lib: string;
}

let configuredPackages: readonly LeanPackage[] = [];
let byName = new Map<string, LeanPackage>();
let byPaperDir = new Map<string, LeanPackage>();

/**
 * Whether a folio has configured the registry.
 *
 * Distinct from `LEAN_PACKAGES.length === 0`, and the distinction is the point:
 * a folio may legitimately declare no Lean packages, and that is a different
 * answer from nobody having declared anything. A caller that cannot resolve a
 * `lean.ref` should say which of the two it is.
 */
export function leanPackagesConfigured(): boolean {
  return configured;
}

let configured = false;

/** Has the "registry never configured" warning been emitted this process? */
let warnedUnconfigured = false;

/**
 * Say once, on stderr, that a registry lookup ran before any folio configured
 * the registry.
 *
 * Every lookup below returns `undefined` (or an empty list) in that state, which
 * a caller cannot tell apart from "this package does not exist". qou bean
 * `qou-i2ed` is the cost: two qou checkers scored 425 `lean.ref`s with no
 * sibling `.lean` against nothing, and reported clean. `formal-ref.ts` already
 * warns this way for the resolver; this is the same guard on the registry, so
 * the sites that read it directly are covered too. One warning per process, on
 * stderr, so a sweep's own output and a pipeline's JSON on stdout stay intact.
 */
function warnUnconfiguredOnce(site: string): void {
  if (configured || warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn(
    `[lean-packages] ${site} ran before configureLeanPackages(), so every ` +
      "lean.ref package lookup answers 'not found'. That is NOT the same as " +
      "'no such package': results that depend on it are unchecked, not clean. " +
      "Import `configureLeanPackages` from `pipeline/lean-formal-ref` and call " +
      "it with the folio's package list, or ask `leanPackagesConfigured()` " +
      "if your code can legitimately proceed without the registry.",
  );
}

export function configureLeanPackages(packages: readonly LeanPackage[]) {
  configured = true;
  configuredPackages = packages;
  byName = new Map(packages.map(p => [p.name, p] as const));
  byPaperDir = new Map(packages.map(p => [p.paperDir, p] as const));
}

// Export the array as a proxy so it always reads the injected state
export const LEAN_PACKAGES: readonly LeanPackage[] = new Proxy([] as LeanPackage[], {
  // `Reflect.get` reads an arbitrary key off the injected array without
  // reopening its element type.
  get: (_target, prop) => {
    warnUnconfiguredOnce("LEAN_PACKAGES");
    return Reflect.get(configuredPackages, prop);
  },
  ownKeys: () => {
    warnUnconfiguredOnce("LEAN_PACKAGES");
    return Reflect.ownKeys(configuredPackages);
  },
  getOwnPropertyDescriptor: (_, prop) => Reflect.getOwnPropertyDescriptor(configuredPackages, prop),
  has: (_, key) => key in configuredPackages,
});

export function leanPackageByName(name: string): LeanPackage | undefined {
  warnUnconfiguredOnce("leanPackageByName");
  return byName.get(name);
}

export function leanPackageByPaperDir(dir: string): LeanPackage | undefined {
  warnUnconfiguredOnce("leanPackageByPaperDir");
  return byPaperDir.get(dir);
}

export function isLeanPackageName(name: string): boolean {
  warnUnconfiguredOnce("isLeanPackageName");
  return byName.has(name);
}

export interface ParsedLeanRef {
  package: string;
  decl: string;
  module: string;
  name: string;
}

export function parseLeanRef(ref: string): ParsedLeanRef {
  const idx = ref.indexOf(":");
  if (idx < 0) {
    throw new Error(
      `Invalid lean.ref "${ref}": expected "<package>:<Decl.Path>" (missing ':')`,
    );
  }
  const pkg = ref.slice(0, idx);
  const decl = ref.slice(idx + 1);
  if (!pkg || !decl) {
    throw new Error(
      `Invalid lean.ref "${ref}": both package and decl must be non-empty`,
    );
  }
  const lastDot = decl.lastIndexOf(".");
  const module = lastDot < 0 ? decl : decl.slice(0, lastDot);
  const name = lastDot < 0 ? decl : decl.slice(lastDot + 1);
  return { package: pkg, decl, module, name };
}

export function formatLeanRef(parts: { package: string; decl: string }): string {
  return `${parts.package}:${parts.decl}`;
}

export const LEAN_REF_PATTERN = /^[a-z][a-z0-9-]*:[^\s:]+$/;

