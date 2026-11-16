/**
 * Dependency injection point for FORMAL REFERENCES — the `lean:` field's
 * grammar and the package list it resolves against.
 *
 * The grammar is science-layer vocabulary even though the `lean` field sits
 * on shared kinds (remark, example, algorithm, simulator). Core reaches it
 * only through this module, so it has no `core → sci` import edge.
 *
 * ## What core needs is NOT the grammar
 *
 * Every core call site does the same three steps: `parseLeanRef(ref)`,
 * `leanPackageByName(pkg)`, then build source paths from the package's
 * `lakeRoot` and the parsed `module` / `decl` / `name`. **Core wants
 * candidate source paths**, which it tries with its own file access
 * (`ctx.fileExists`, `readFileBranch`, `existsSync`, a `grep`).
 *
 * So {@link FormalRefResolution} is a *resolution record*, and the grammar,
 * the package registry and the path convention stay behind it in the layer
 * that owns them. Core does not learn what a Lake root is, what a module path
 * is, or that the separator is a dot.
 *
 * ## The same shape as the other DI points
 *
 * `pipeline/references-registry-di.ts` (the bibliography) and
 * `value-registry-di.ts` (the values registry) have the same shape: a
 * `configure…`, a `…Configured()` predicate, and a getter that returns
 * `undefined` rather than throwing.
 *
 * The predicate lets a caller tell "nothing configured" from "the check did
 * not run". Every consumer must distinguish the two and say "not checked"
 * rather than silently take the `undefined` branch — otherwise a lookup that
 * returns `undefined` makes checks fail closed or open in opposite
 * directions.
 *
 * @module schemas/formal-ref
 * @graphNode schema
 */

/**
 * What a formal reference resolves to, expressed in terms core already
 * understands: repo-relative paths, a directory to search, and a bare name.
 *
 * Deliberately carries no `package`, `module` or `lakeRoot` field. Those are
 * the owning layer's vocabulary, and re-exporting them here would move the
 * import edge without moving the knowledge — the failure mode the Tier-2
 * `markovZ` migration is recorded for (it removed a square root and left the
 * convention exactly as hard to see).
 */
export interface FormalRefResolution {
  /**
   * Candidate source files, **repo-root-relative**, in priority order.
   *
   * Core tries them with whatever file access it has. The list is allowed to
   * be empty — that means the ref parsed but named a package this folio has
   * not declared, which is different from the ref being malformed (that is a
   * `undefined` return from {@link resolveFormalRef}).
   */
  candidatePaths: string[];
  /**
   * Weaker candidates, tried only after {@link candidatePaths} and only by a
   * caller that is prepared to accept a file which may declare nothing.
   *
   * Two lists rather than one because the call sites genuinely disagreed:
   * `schemas/constraints.ts` accepted a module-path file that turns out to be
   * an import-only aggregator, and the two source resolvers did not. Merging
   * them would put the aggregator ahead of the real declaration file for the
   * resolvers, so the MCP server would start serving an `import` list as a
   * block's source. The layer says which candidates are weak; core decides
   * whether it can live with one.
   *
   * Absent or empty means there are none.
   */
  fallbackPaths?: string[];
  /**
   * The bare declaration name, for a `grep -rl` fallback and for the
   * "does this file actually declare it" check in `qa-utils`.
   */
  declName: string;
  /**
   * Directory to search when the candidate paths all miss, **repo-root-relative**,
   * or `undefined` when the folio declares no searchable tree for this package.
   */
  searchDir?: string;
  /**
   * The basename a whole-tree scan should look for (`<declName>.lean` for the
   * Lean resolver). Kept separate from `declName` so core does not have to
   * know the file extension of somebody else's formalism.
   */
  basename: string;
  /**
   * Root the basename scan is confined to, repo-root-relative. Distinct from
   * `searchDir`, which is narrower (a library subtree rather than a Lake root).
   */
  treeRoot?: string;
}

/**
 * A resolver's own scan cache, threaded through by bulk callers so a source
 * tree is walked once for a whole sweep rather than once per reference.
 *
 * `Map<treeRoot, Map<key, absolutePath>>` — core treats both levels as opaque.
 * It is declared HERE rather than in the resolver because core's `qa-utils`
 * has always exported it (as `LakeTreeCache`) and three qou scripts hold one;
 * moving the type out of core would break them for no gain, and the shape
 * carries no formalism vocabulary.
 */
export type FormalTreeCache = Map<string, Map<string, string>>;

/** The contract a formalism layer implements. */
export interface FormalRefResolverAPI {
  /**
   * Resolve a ref, or `undefined` when it does not parse as one this layer
   * owns. A parseable ref naming an undeclared package resolves to a record
   * with an empty `candidatePaths` — the two cases are not merged, because a
   * caller reporting a diagnostic needs to say which one it hit.
   */
  resolve(ref: string): FormalRefResolution | undefined;
  /**
   * Statement-level content hash of the declarations in `file`, or `undefined`
   * when this layer cannot compute one. Optional: a formalism with no
   * statement granularity simply omits it.
   *
   * Takes the FILE only, deliberately — that is the real arity of the
   * implementation it wraps (`pipeline/lean-signature.ts`
   * `leanStatementHash(path)`), which hashes the file's signature lines rather
   * than one declaration. An earlier draft of this interface declared
   * `(file, declName)` on the assumption that a statement hash must be
   * per-declaration; it is not, and inventing the wider signature would have
   * obliged every future implementer to accept an argument the established one
   * ignores.
   */
  statementHash?(file: string): string | undefined;
  /**
   * The shape a reference of this formalism must have, and the message to
   * report when it does not.
   *
   * Consumed by `schemas/constraints.ts`. **It must be read at VALIDATE time,
   * not at schema-construction time**, and that is not a style preference: the
   * schema object is built at module init, which is strictly before any layer
   * can install itself, so a `z.string().regex(pattern)` freezes whatever
   * `pattern` was available during import. That is exactly why `LeanRefSchema`
   * could not take an injected pattern until it moved to `superRefine`.
   */
  refPattern?: RegExp;
  /** Failure message for {@link refPattern}, in the layer's own vocabulary. */
  refPatternMessage?: string;
  /**
   * Resolve a reference to the **canonical** source file — the one that really
   * declares it — as an absolute path, or `undefined`.
   *
   * Distinct from {@link resolve}, which hands back candidate paths for a
   * caller with its own file access (a git-branch reader, a validator's
   * `fileExists`). This one does the whole job on disk, because doing it well
   * needs formalism knowledge core does not have: rejecting an import-only
   * aggregator that shares a module name, and indexing declaration names whose
   * file basename differs. Measured on the qou corpus, skipping the aggregator
   * gate made 65 of 1220 blocks resolve onto a list of `import` lines, where
   * every checker passed vacuously (bean `qou-cu0a`).
   */
  resolveCanonical?(
    ref: string,
    repoRoot: string,
    cache?: FormalTreeCache,
  ): string | undefined;
  /**
   * Every source file of this formalism under every configured package, as
   * absolute paths.
   *
   * Feeds orphan-coverage scans — files reachable by no block's reference — so
   * the implementation is responsible for excluding vendored dependencies. It
   * returns `[]` when nothing is configured, and a caller that needs to tell
   * that from "configured, and genuinely none" asks
   * {@link formalRefResolverConfigured}.
   */
  listSourceFiles?(repoRoot: string): string[];
}

let currentApi: FormalRefResolverAPI | null = null;

/**
 * Has the "nobody installed a layer" warning already been emitted?
 *
 * One warning per process, not per call: these getters run once per block on a
 * corpus sweep, and a per-call warning would bury the sweep's own output.
 */
let warnedUnconfigured = false;

/**
 * Say once, on stderr, that a reference could not be resolved because no layer
 * is installed — as distinct from the reference being wrong.
 *
 * **This is the point of the module.** A getter returning `undefined` is
 * indistinguishable, at the call site, from a malformed reference or a missing
 * file, and every consumer here degrades quietly: the validator's
 * `lean-file-exists` fails CLOSED (a false "requires Lean formalization"), the
 * §3b-cond propagation audit fails OPEN (a false "not class-axiomatised"), and
 * the two source resolvers simply serve nothing. Three consumers, two
 * directions, no signal — which is qou bean `qou-i2ed`, whose entire content is
 * that `leanPackagesConfigured()` has zero callers.
 *
 * A warning is not a substitute for asking {@link formalRefResolverConfigured};
 * it is what makes the omission visible to somebody who did not know to ask. It
 * goes to stderr so a pipeline's JSON on stdout stays parseable.
 */
function warnUnconfiguredOnce(): void {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn(
    "[formal-ref] No formalism layer is installed, so every formal reference " +
      "resolves to `undefined`. This is NOT the same as 'no references' — " +
      "downstream checks will degrade, some failing closed and some open. " +
      "Install one where the package list is configured (for the Lean layer: " +
      "import `configureLeanPackages` from `pipeline/lean-formal-ref`, " +
      "which installs the resolver as it loads). Ask " +
      "`formalRefResolverConfigured()` if your code can legitimately proceed " +
      "without resolution.",
  );
}

/** Install the resolver. Called once, by the layer that owns the formalism. */
export function configureFormalRefResolver(api: FormalRefResolverAPI): void {
  currentApi = api;
}

/**
 * Has a layer supplied a resolver at all?
 *
 * **Unconfigured is not "no formal references".** Those are different facts,
 * and conflating them is how `leanPackagesConfigured()` came to have zero
 * callers while eight sites silently took the unresolved branch (qou bean
 * `qou-i2ed`). A consumer that can proceed without resolution must ASK, and
 * report "not checked" rather than a clean result.
 */
export function formalRefResolverConfigured(): boolean {
  return currentApi !== null;
}

/**
 * Resolve a ref, or `undefined`.
 *
 * Returns `undefined` for BOTH "no resolver configured" and "does not parse".
 * A caller that must tell them apart calls {@link formalRefResolverConfigured}
 * first — which is the whole point of that predicate existing.
 */
export function resolveFormalRef(
  ref: string | undefined,
): FormalRefResolution | undefined {
  if (!ref) return undefined;
  if (currentApi === null) {
    warnUnconfiguredOnce();
    return undefined;
  }
  try {
    return currentApi.resolve(ref);
  } catch {
    return undefined;
  }
}

/** Statement-level hash, or `undefined` when unconfigured or unsupported. */
export function formalStatementHash(file: string): string | undefined {
  if (currentApi === null) return undefined;
  try {
    return currentApi.statementHash?.(file);
  } catch {
    return undefined;
  }
}

/**
 * The configured reference pattern, or a deliberately permissive fallback.
 *
 * The fallback is `/^\S+$/` — non-empty, no whitespace — and it is permissive
 * on purpose. An unconfigured core does not know the grammar, so the only
 * honest check left is that the field holds a token at all; a stricter guess
 * would reject valid references of a formalism nobody has declared. Callers
 * that need to report *which* state they are in ask
 * {@link formalRefResolverConfigured} first.
 */
export function formalRefPattern(): RegExp {
  return currentApi?.refPattern ?? /^\S+$/;
}

/** Message for a reference failing {@link formalRefPattern}. */
export function formalRefPatternMessage(): string {
  return (
    currentApi?.refPatternMessage ??
    "Formal reference must be a single non-empty token with no whitespace. " +
      "No formalism layer is installed, so its grammar cannot be checked here."
  );
}

/**
 * Canonical source file for a reference, absolute, or `undefined` when
 * unconfigured, unsupported, or unresolvable.
 */
export function resolveCanonicalFormal(
  ref: string | undefined,
  repoRoot: string,
  cache?: FormalTreeCache,
): string | undefined {
  if (!ref) return undefined;
  if (currentApi === null) {
    warnUnconfiguredOnce();
    return undefined;
  }
  try {
    return currentApi.resolveCanonical?.(ref, repoRoot, cache);
  } catch {
    return undefined;
  }
}

/**
 * Every formal source file under the configured packages, absolute.
 *
 * `[]` when unconfigured — which reads identically to "configured and empty",
 * so an orphan-coverage scan reporting nothing must say which it measured.
 */
export function listFormalSourceFiles(repoRoot: string): string[] {
  if (currentApi === null) {
    warnUnconfiguredOnce();
    return [];
  }
  try {
    return currentApi.listSourceFiles?.(repoRoot) ?? [];
  } catch {
    return [];
  }
}

/** Reset — for tests only, so one spec's resolver cannot leak into the next. */
export function __resetFormalRefResolverForTests(): void {
  currentApi = null;
  // Reset the one-shot too, or the FIRST spec to run consumes the warning and
  // a later spec asserting on it sees nothing — a test that passes because an
  // earlier test ran, which is the class of green this module is about.
  warnedUnconfigured = false;
}
