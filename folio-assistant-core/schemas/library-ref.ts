/**
 * A reference to an L1 source — in this layer, or in another one.
 *
 * @module folio-assistant-core/schemas/library-ref
 * @graphNode schema
 *
 * ## The problem this exists for was predicted before it happened
 *
 * Bean `r1lz`, 2026-09-19, while deciding that the WHO documents would leave
 * for a repository of their own:
 *
 * > *"a skill derived from a source text in another repo would cite evidence
 * > its own instance cannot resolve."*
 *
 * That is exactly what `scripts/check-voices.ts` does. It resolves a
 * `libraryId` as `library/<id>/sections/<sec>.md` **against the voice's own
 * layer root**, so moving `voices/who-*.json` into `who-style-guide/` breaks
 * every citation in all three — 25 rules whose provenance was the whole point
 * of writing them.
 *
 * ## Why not a relative path
 *
 * `../<instance>/library/...` would work today and hardcodes a checkout layout
 * into content. It is the practice `AGENTS.md` opens by warning against, and
 * this repository has already paid for it twice **this week**: a `../`-prefixed
 * declaration that silently resolved outside the checkout, and a test carrying
 * five hardcoded skill directories that had been wrong for months. The whole
 * reason `folio_init` writes a builder shim is so the path to another layer
 * is written down **once**.
 *
 * So a cross-layer reference names the layer by its **declared name**,
 * and where that layer sits is discovered from declarations.
 *
 * ## The three failures this must keep apart
 *
 * A resolver that returned `undefined` for all of these would make them one
 * problem, and they need three different fixes:
 *
 *   - the **layer** is not in this checkout → add it, or fix the name;
 *   - the layer is here but declares **no `library` graph** → it is not a
 *     corpus and the citation is pointing at the wrong kind of thing;
 *   - the library and graph resolve but the **section file** is absent → the
 *     document was never ingested, or the section id is wrong.
 *
 * A fifth answer is not a failure of the citation at all: the layer keeps
 * its corpus in an **opt-in group this checkout's mount left out**
 * (cat-harness's `library/corpus/`, `cat-harness.library`, in a folio that
 * does not switch it on). Nothing here can be checked, and the lock says so,
 * so it is reported as `library-not-mounted`, a third state that a gate lists
 * rather than fails. A corpus the mount DID take and that is gone is still a
 * finding.
 *
 * **An unresolvable layer is never silently treated as local.** Falling back
 * would turn "you cited another repository's corpus and it is not here" into
 * "that section does not exist", which sends the next reader looking in the
 * wrong place entirely.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// The declaration filename comes from the harness, not a second copy of it
// here. This layer already declares `"needs": ["cat-harness"]`, and the
// partition rules call core reading harness DOWNWARD -- so this is the
// declared dependency being used, not a new one being created. Owner ruling,
// 2026-09-21, bean `jijc`.
import { declarationPathIn, optInDirectoriesForGraph } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { mountChoiceOf } from "@litlfred/cat-harness-tools/schemas/kg/remote-mount.js";
import { libraryEntryDir } from "../scripts/lib/library-entries.ts";

/** A citation into L1 content. `instance` absent means *this* layer. */
export interface LibraryRef {
  /** The DECLARED NAME of the layer holding the corpus — not a path. */
  instance?: string;
  libraryId: string;
  sectionId?: string;
}

/** Why a reference did not resolve. Distinct cases, deliberately — see the module doc. */
export type LibraryRefFailure =
  | { kind: "unknown-instance"; instance: string; known: string[] }
  | { kind: "no-library-graph"; instance: string; instanceRoot: string }
  | { kind: "library-not-mounted"; instance: string; instanceRoot: string; dir: string; lock: string }
  | { kind: "not-ingested"; instanceRoot: string; libraryId: string }
  | { kind: "no-such-section"; path: string };

export type LibraryRefResult =
  | { ok: true; instanceRoot: string; libraryDir: string; path: string }
  | { ok: false; failure: LibraryRefFailure };

/**
 * Every layer in a checkout, by its declared `name`.
 *
 * Discovery, not a list: each top-level directory holding a `harness.json` is
 * a layer, and its `name` is what a reference cites. A hardcoded table
 * would go stale at the next directory move, which is the failure this whole
 * module is avoiding.
 */
export function instanceRoots(repoRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  const consider = (dir: string) => {
    const decl = declarationPathIn(dir)!;
    if (!existsSync(decl)) return;
    try {
      const parsed = JSON.parse(readFileSync(decl, "utf8"));
      const name = parsed?.name;
      if (typeof name === "string" && name.length > 0 && !out.has(name)) out.set(name, dir);
      // Also by planned repository, the form a reference takes (bean `6rmv`).
      const repository = parsed?.repository;
      if (typeof repository === "string" && repository.length > 0 && !out.has(repository)) out.set(repository, dir);
    } catch {
      // A declaration that does not parse is not this module's error to raise:
      // `readDeclaration` already throws on one, with a better message. Skipping
      // here keeps one bad file from making every OTHER layer unresolvable.
    }
  };
  consider(repoRoot);
  for (const e of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    consider(join(repoRoot, e.name));
  }
  return out;
}

/**
 * Where a layer keeps its L1 corpus.
 *
 * Reads the layer's own declaration rather than assuming `library/`: a
 * layer may put it anywhere, and that is the entire premise of declared
 * directories. Returns `undefined` when the layer declares no `library`
 * graph at all, which is a different answer from "the directory is empty".
 */
export function libraryDirOf(instanceRoot: string): string | undefined {
  const decl = declarationPathIn(instanceRoot)!;
  if (!existsSync(decl)) return undefined;
  let dirs: Array<{ path?: string; graphTypologies?: string[]; scope?: string }> = [];
  try {
    dirs = JSON.parse(readFileSync(decl, "utf8"))?.directories ?? [];
  } catch {
    return undefined;
  }
  // THIS LAYER'S OWN, which is not "the first one declared".
  //
  // `cat-harness/harness.json` declares FOUR library entries: its own empty
  // `library/`, plus the libraries of the IRIS catalogue layer, the
  // science layer and `agent-skills/library/` — all three `scope: "repository"`, declared there
  // because the consumers that scan libraries run from the repository root.
  // `find` took whichever came first and `resolve(instanceRoot, path)` then
  // resolved a repository-scoped path against the LAYER, which is not
  // where it lives.
  //
  // Measured consequence, found by review 2026-09-20: a bare citation to a
  // document of the IRIS catalogue layer could report "never brought through uploads/ ->
  // library/" about a document that is ingested, and declared in the same
  // file that was just read.
  //
  // `scope` is the discriminator, not `own`: every one of those entries is
  // cat-harness's own declaration. A repository-scoped entry names where
  // ANOTHER layer keeps its corpus, and the caller asking
  // `libraryDirOf(<that instance>)` gets it from that layer's own declaration.
  const mine = dirs.filter(
    (d) => Array.isArray(d.graphTypologies) && d.graphTypologies.includes("library") && d.scope !== "repository",
  );
  if (mine.length === 0) {
    // Not at the top level, so maybe inside a switched-on opt-in sub-graph,
    // declared FROM WITHIN: cat-harness keeps its corpus at
    // `library/corpus/`, named by `library/graph.json`, and switches it on for
    // itself (cat-harness#1032). Asked of the instance's OWN list: the
    // question is where this instance keeps its corpus, not what a folio
    // above it shows.
    const optIn = optInDirectoriesForGraph(instanceRoot, "library");
    if (optIn.length > 1) {
      throw new Error(
        `${decl}: ${optIn.length} switched-on \`library\` sub-graph directories (${optIn.join(", ")}); ` +
          `"where does this instance keep its corpus" has no single answer.`,
      );
    }
    return optIn[0] !== undefined && existsSync(optIn[0]) ? optIn[0] : undefined;
  }
  if (mine.length > 1) {
    // Refuse rather than pick. A layer with two libraries of its own has
    // no answer to "where does this instance keep its corpus", and returning
    // `undefined` would say "it declares none" — a different, wrong fact.
    throw new Error(
      `${decl}: ${mine.length} instance-scoped \`library\` directories (${mine
        .map((d) => d.path ?? "(no path)")
        .join(", ")}); "where does this instance keep its corpus" has no single answer. ` +
        `Mark all but one \`scope: "repository"\`, or merge them.`,
    );
  }
  const hit = mine[0]!;
  if (!hit.path) return undefined;
  const abs = resolve(instanceRoot, hit.path);
  return existsSync(abs) ? abs : undefined;
}

/**
 * Resolve a reference to a file on disk.
 *
 * `sectionId` is optional: without it the reference names the DOCUMENT, and
 * `structure.json` is what proves it was ingested. With it, the section file
 * itself.
 */
/**
 * The layer's corpus directory when it is an opt-in sub-graph that this
 * checkout's mount chose NOT to take: declared, absent on disk, and absent
 * because the lock left it out. Any other
 * absence answers `undefined`, so it stays a finding.
 *
 * `mountChoice` is {@link mountChoiceOf} unless a test supplies the lock's
 * answer.
 */
export function libraryLeftOutByMount(
  instanceRoot: string,
  mountChoice: (instanceRoot: string, absDir: string) => { chosen: boolean; lock: string } | undefined = mountChoiceOf,
): { dir: string; lock: string } | undefined {
  let optIn: string[];
  try {
    // Every opt-in corpus the layer declares, whichever root switched it on or
    // off: resolution now follows the MOUNTING root (cat-harness-tools#1967,
    // card Q-OPTIN-DIRS A), which lists a switched-off group not at all, so
    // the default would hide exactly the directory this asks the lock about.
    optIn = optInDirectoriesForGraph(instanceRoot, "library", "all");
  } catch {
    return undefined;
  }
  if (optIn.length !== 1 || existsSync(optIn[0]!)) return undefined;
  const choice = mountChoice(instanceRoot, optIn[0]!);
  return choice !== undefined && !choice.chosen ? { dir: optIn[0]!, lock: choice.lock } : undefined;
}

export function resolveLibraryRef(
  ref: LibraryRef,
  fromInstanceRoot: string,
  repoRoot: string,
  mountChoice?: (instanceRoot: string, absDir: string) => { chosen: boolean; lock: string } | undefined,
): LibraryRefResult {
  let instanceRoot = fromInstanceRoot;
  if (ref.instance !== undefined) {
    const roots = instanceRoots(repoRoot);
    const hit = roots.get(ref.instance);
    if (!hit) {
      return { ok: false, failure: { kind: "unknown-instance", instance: ref.instance, known: [...roots.keys()].sort() } };
    }
    instanceRoot = hit;
  }
  const libraryDir = libraryDirOf(instanceRoot);
  if (!libraryDir) {
    const leftOut = libraryLeftOutByMount(instanceRoot, mountChoice);
    if (leftOut !== undefined) {
      return {
        ok: false,
        failure: { kind: "library-not-mounted", instance: ref.instance ?? "(this instance)", instanceRoot, ...leftOut },
      };
    }
    return {
      ok: false,
      failure: { kind: "no-library-graph", instance: ref.instance ?? "(this instance)", instanceRoot },
    };
  }
  // Flat or filed in a declared concern group, `library/<group>/<id>/` (bean 6fez).
  const entryDir = libraryEntryDir(libraryDir, ref.libraryId);
  if (entryDir === undefined || !existsSync(join(entryDir, "structure.json"))) {
    return { ok: false, failure: { kind: "not-ingested", instanceRoot, libraryId: ref.libraryId } };
  }
  const path = ref.sectionId
    ? join(entryDir, "sections", `${ref.sectionId}.md`)
    : join(entryDir, "structure.json");
  if (!existsSync(path) || !statSync(path).isFile()) {
    return { ok: false, failure: { kind: "no-such-section", path } };
  }
  return { ok: true, instanceRoot, libraryDir, path };
}

/** A failure as one line somebody can act on. Each case names its own fix. */
export function explainFailure(f: LibraryRefFailure): string {
  switch (f.kind) {
    case "unknown-instance":
      return (
        `no instance in this checkout declares the name "${f.instance}". ` +
        `Declared names: ${f.known.join(", ") || "(none)"}. ` +
        `A cross-instance citation names an instance's DECLARED NAME, never a path.`
      );
    case "no-library-graph":
      return (
        `instance "${f.instance}" (${f.instanceRoot}) declares no \`library\` graph, so it holds no L1 ` +
        `corpus to cite. This is not "the section is missing" — the citation points at the wrong kind of thing.`
      );
    case "library-not-mounted":
      return (
        `instance "${f.instance}" keeps its corpus in ${f.dir}, an opt-in group this checkout's mount did not take ` +
        `(${f.lock}). Not checked here: there is nothing on disk to check it against.`
      );
    case "not-ingested":
      return `${f.libraryId} is not ingested under ${f.instanceRoot} (no structure.json). The document was never brought through uploads/ → library/.`;
    case "no-such-section":
      return `cites ${f.path}, which does not exist. Every KG reference to a source resolves THROUGH library/.`;
  }
}
