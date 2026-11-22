/**
 * Cross-folio dependency schema for folio-assistant instances.
 *
 * A folio-assistant instance can depend on other instances for content,
 * skills, and translation resolution. Dependencies are declared in
 * `harness.config.json` under `dependencies.folioAssistant` and walked
 * depth-first in listed order, overlaying content and skills on the root —
 * later overlays earlier, as in FHIR/SUSHI.
 *
 * ## The pin differs from SUSHI
 *
 * SUSHI names a dependency as `packageId: version`;
 * {@link FolioAssistantDependencySchema} names a git `ref` that DEFAULTS TO THE
 * DEFAULT BRANCH, which can change silently. A SHA may stage, only a
 * published semver version may publish:
 * [`directory-conventions`](../skills/kg/kg-core/directory-conventions.md)
 * §"Pinning a reference — a SHA may stage, only a version may publish",
 * enforced by `bun run cat check:published-refs`. The full scheme
 * is `cat-harness/docs/proposals/instance-versioning.md`.
 *
 * ## What gets resolved across dependencies
 *
 * | Resource | Resolved? | How |
 * |---|---|---|
 * | PO translations | ✅ | `translations/<locale>/`, fallback chain step 4 — the only path with a live consumer (`pipeline/po-resolve.ts`) |
 * | Kind headings | ✅ | `kindHeading` in `schemas/content/translation.ts`: English on each block-kind node, other locales in its owner's `translations/<lang>/block-kinds.po` |
 * | Skills | ✅ | {@link resolveSkillDirs} reads each instance's DECLARATION, and `LOCAL_PACKAGES` in `src/tools/skill-fetch.ts` is built from it, so a dependency's packages are served. Two nearby call sites stay root-only on purpose — see its docs |
 * | Declared directories | ✅ | {@link declarationChain} + `resolveDirectories`, materialised by {@link materialiseDeclaredDirectories} |
 * | Block kinds | ✅ | {@link loadContributions} → `schemas/content/contributions.ts` |
 * | Adapters | ✅ | {@link loadContributions}, as a module specifier |
 * | MCP tools | ✅ | {@link loadContributions}, as registrar callbacks |
 * | Content blocks | ❌ | no resolver |
 * | QA criteria | ❌ | criterion definitions are root-only |
 *
 * @module schemas/folio-config
 * @graphNode schema
 */

import { z } from "zod";
import {
  SubgraphSourceOverridesSchema,
  resolveSubgraphSource,
  type ResolvedSubgraphSource,
  type SubgraphSourceOverrides,
} from "./subgraph-source";

// ── Dependency types ────────────────────────────────────────────

/**
 * A single folio-assistant dependency.
 *
 * Dependencies can be specified by local path (for development or
 * when using git submodules) or by git URL (for CI and remote
 * resolution).
 */
export interface FolioAssistantDependency {
  /** Display name of the dependency (e.g. "qou-platform"). */
  name: string;

  /** Reverse-DNS package identity, stable forever. See the schema. */
  id?: string;

  /** WHAT is depended on — an exact version. See the schema; ranges are refused. */
  version?: string;

  /**
   * Was this dependency DERIVED from the declaration's `needs` rather than
   * authored in the config?
   *
   * Set by {@link dependenciesFromNeeds} and never written to a file. It is
   * here so a consumer can tell a stated dependency from an inferred one —
   * `check:needs-dependencies` reports on the difference, and a caller that
   * could not tell them apart would report a derived edge as a declaration.
   */
  derivedFromNeeds?: boolean;

  /**
   * Local filesystem path to the dependency root. May be absolute or
   * relative to the folio root. Checked first — if present and the
   * directory exists, the git URL is not consulted.
   */
  path?: string;

  /**
   * Git clone URL for the dependency. Used when `path` is absent or
   * the directory does not exist. Not cloned into `.deps/` (owner,
   * 2026-10-06): a remote dependency is a REMOTE MOUNT — `remoteMounts` on
   * the declaration, laid down by `bun run cat mount:remote` (bean `0mpw`).
   */
  git?: string;

  /**
   * Git ref to checkout after cloning (branch, tag, or commit SHA).
   * Defaults to the repository's default branch.
   */
  ref?: string;

  /**
   * What this dependency provides. Controls which resolution chains
   * consult it. Defaults to all three when absent.
   */
  provides?: Array<"skills" | "content" | "translations">;
}

/**
 * The `dependencies` section of `harness.config.json`.
 */
export interface HarnessConfigDependencies {
  /**
   * Other folio-assistant instances this folio depends on. Walked
   * depth-first in listed order, overlaying content and skills.
   */
  folioAssistant?: FolioAssistantDependency[];
}

/**
 * Translation configuration in `harness.config.json`.
 */
export interface TranslationConfig {
  /** Source language of the folio's content (BCP 47). Default: "en". */
  defaultLocale?: string;
  /** Target languages. Default: six UN languages. */
  supportedLocales?: string[];
  /** Directory for .pot/.po files. Default: "translations". */
  translationDir?: string;
  /** When true, only signed-off translations are rendered. Default: false. */
  officialOnly?: boolean;
}

/**
 * The full `harness.config.json` shape.
 *
 * Not all fields are covered here — only the ones that have TypeScript
 * consumers. The JSON file may carry additional fields (e.g. `adapter`,
 * `adapterModule`, `viewer`, `simulators`) that are consumed by other
 * parts of the system.
 */
export interface HarnessConfig {
  /** Content type — "document" or "paper". */
  contentType?: string;
  /**
   * Static, interactive, or undetermined — the FOURTH axis (issue #764, O1).
   *
   * A plain string for the same reason `contentType` and `adapter` above are
   * plain strings — see the schema field.
   */
  interactivity?: string;
  /** Adapter name — "document", "paper", or "dak". */
  adapter?: string;
  /** Path to the adapter module. */
  adapterModule?: string;


  /** Translation pipeline configuration. */
  translation?: TranslationConfig;

  /** Cross-folio dependencies. */
  dependencies?: HarnessConfigDependencies;

  /**
   * What this instance asks of the published SITE — today only whether it is
   * the landing page (issue #1904). See {@link HarnessSiteSchema}.
   */
  site?: HarnessSite;
  /** Where a declared subgraph's content comes from in THIS instantiation, by directory id. See {@link HarnessConfigSchema}. */
  subgraphSources?: SubgraphSourceOverrides;
}

// ── Zod schemas ─────────────────────────────────────────────────

export const FolioAssistantDependencySchema = z.object({
  name: z.string().min(1),
  /**
   * The package identity — reverse-DNS, stable forever, never reused.
   *
   * SEPARATE FROM `name`, which is a display handle. An id is what an external
   * consumer resolves; `instance-versioning.md` §3.2. Optional, because §3.1
   * settles that most instances are NOT publishable and minting an id for one
   * nothing outside resolves is ceremony with no reader.
   */
  id: z.string().min(1).optional(),
  /**
   * WHAT IS DEPENDED ON — the exact version, for computing the overlay.
   *
   * The owner, 2026-09-22, on consolidating the stack onto dependencies:
   * *"i want to adopt the sushi/fhir IG(/npm?) versioning dependencies for
   * computing overlays. SHAs are for provenance, digital signing, staging. we
   * need both, different needs."*
   *
   * So this field and `ref`/`git` below are NOT two spellings of one thing and
   * must not be collapsed into one: this says WHAT, they say HOW TO FETCH and
   * WHICH BYTES. A dependency may carry both, and they answer different
   * questions about it.
   */
  version: ExactVersionSchema.optional(),
  path: z.string().optional(),
  git: z.string().url().optional(),
  /**
   * HOW TO FETCH WHILE branches/, and the provenance of the bytes — not what is
   * depended on.
   *
   * A SHA is a perfectly good pin and a **useless published reference**: it
   * names a commit in a repository a downstream consumer may not have, may not
   * be able to fetch, and that FHIR's `dependsOn` has no field for. A published
   * artefact carrying one is not a stricter pin, it is an unresolvable one —
   * `instance-versioning.md` §3.3, enforced by `check:published-refs`.
   *
   * It DEFAULTS TO THE DEFAULT BRANCH when absent, which makes an unpinned
   * dependency a different dependency on Tuesday with nothing saying so (bean
   * `dhvf`). That is why `version` exists rather than this field being made
   * stricter.
   */
  ref: z.string().optional(),
  provides: z
    .array(z.enum(["skills", "content", "translations"]))
    .optional(),
}).refine(
  (dep) => dep.path !== undefined || dep.git !== undefined,
  { message: "Dependency must have at least one of 'path' or 'git'" },
);

export const HarnessConfigDependenciesSchema = z.object({
  folioAssistant: z.array(FolioAssistantDependencySchema).optional(),
});

export const TranslationConfigSchema = z.object({
  defaultLocale: z.string().default("en"),
  supportedLocales: z
    .array(z.string())
    .default(["ar", "zh", "en", "fr", "ru", "es"]),
  translationDir: z.string().default("translations"),
  officialOnly: z.boolean().default(false),
});

/**
 * Harness paths that are NOT part of the bean graph.
 *
 * ## What used to be here, and why it left
 *
 * This schema carried `workPlan` and `workflowState` — the bean store and the
 * workflow-instance store. They are gone. `beans/beans.json` declares them now
 * (see {@link file://../schemas/bean-graph.ts}), because it is the thing they
 * are nodes OF.
 *
 * That is a removal, not a relocation of the problem. The previous design had
 * the same path written in two places that could disagree — here and
 * `.beans.yml` — and `check:harness-dirs` existed to catch the drift. Declaring
 * the layout in the graph leaves ONE fewer place, not one more.
 *
 * `.beans.yml` still carries the defs path and still needs that check: the
 * `beans` binary is third-party and will never read our schema, so its config
 * must say where its store is. That duplication is unavoidable; leaving it
 * unchecked would not be.
 *
 * ## What stays
 *
 * `interaction` — the per-user preference file the session-start sweep reads
 * first. It is not bean content and is not a node of any graph: it describes
 * how to talk to the person at this machine, not what is being worked on.
 */
export const HarnessDirsSchema = z.object({
  /** Per-user interaction preferences, read at session start. */
  // declared-path-literal: a DEFAULT for a config key, which is read before
  // — and without — any declaration. Resolving it through `harness.json`
  // would make the fallback depend on the thing it is the fallback for. The
  // declaration and this default name the same place on purpose; the
  // `interaction` directory entry carries the other half of that pairing.
  interaction: z.string().default("cat-harness/memory/interaction.json"),
});

export type HarnessDirs = z.infer<typeof HarnessDirsSchema>;

/**
 * `site` in `<name>.config.json` — what an instantiated harness asks of the
 * published site (issue #1904).
 *
 * `landing: true` makes this harness the site's landing page. The owner's
 * ruling, 2026-10-02, verbatim:
 *
 * > "Flag it, with a default (recommended). The chosen instance's own
 * > `<name>.config.json` carries `"site": { "landing": true }`. If exactly one
 * > harness is instantiated, it is the landing page and no flag is needed.
 * > That covers [the single-IG repository]. If there are several and none is flagged, a gate
 * > fails. If more than one is flagged, then neutral hub with listing of
 * > harnesses, todos,"
 *
 * On the CONFIG rather than the declaration because the question is about
 * INSTANTIATION — which harnesses this checkout instantiates, and which of
 * them it puts at `/` — and the config is the file that records it. The
 * declaration travels with the harness into every checkout that uses it; a
 * landing flag there would follow it into checkouts where it is not the
 * landing. {@link resolveLandingInstance} is the only reader.
 */
/** A package script name, never a command: the Tool contract admits no input that can carry a shell payload. */
const PackageScriptName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/, "a package script name, not a command");

/**
 * `site.build` — the steps that build this instance's site, as the
 * instance's own package script names. Read by `build-instance-site.ts` when
 * it is given no step flags, and by `stage-local.ts`, which hands a repository
 * that declares it to `build-instance-site` (owner, 2026-10-10: "i want one
 * consolidated worfklow"). Before this the recipe existed only as prose in a
 * folio's AGENTS.md and in a Routine's prompt, so every runner re-typed it.
 *
 * - `pre`: the instance's own gates, run in the checkout before anything is built.
 * - `sourceSteps`: run as `bun run <name> <site source>`, before Jekyll.
 * - `siteSteps`: run as `bun run <name> <built site>`, after Jekyll: generators
 *   that write finished pages, which Jekyll would otherwise drop.
 * - `home`: the page that becomes the site's `index.md`.
 * - `rootIndex`: publish every layer's graph document and the root index,
 *   `index.jsonld` (`publish-root-index.ts`). Off unless declared.
 * - `extends`: the shared site preset the steps build on, a
 *   `templates/site-presets/<name>.json` of a mounted layer
 *   (`scripts/lib/site-presets.ts`, cat-harness-tools#2345): its steps run
 *   first, so no content site can drop a step every other site runs.
 */
export const HarnessSiteBuildSchema = z.object({
  home: z.string().optional(),
  extends: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  pre: z.array(PackageScriptName).default([]),
  sourceSteps: z.array(PackageScriptName).default([]),
  siteSteps: z.array(PackageScriptName).default([]),
  rootIndex: z.boolean().optional(),
});

export type HarnessSiteBuild = z.infer<typeof HarnessSiteBuildSchema>;

export const HarnessSiteSchema = z.object({
  landing: z.boolean().optional(),
  build: HarnessSiteBuildSchema.optional(),
});

export type HarnessSite = z.infer<typeof HarnessSiteSchema>;

export const HarnessConfigSchema = z.object({
  contentType: z.string().optional(),
  /**
   * Is this folio's content static, or does it carry interfaces?
   *
   * The interactivity axis — issue #764, O1, settled by the owner
   * 2026-09-22. Vocabulary and the full argument: `CONTENT_INTERACTIVITY`.
   *
   * Here rather than beside `graphTypologies` because it is a fact about the
   * CONTENT, which is what `contentType` and `adapter` next to it are also
   * about. The visualiser axis went the other way, onto the directory, and
   * the two placements are the axes' own difference rather than an
   * inconsistency: interactivity describes what the content IS, a visualiser
   * describes how a graph is SHOWN.
   *
   * ABSENT means nobody has said. The VALUE `"undetermined"` means somebody
   * looked and could not decide — the owner ruled the boundary is
   * *"not a 'pure' distinction. judgement"*, so that answer has to be
   * expressible rather than collapsed into silence or into `static`.
   *
   * ## A STRING, not the enum, and the partition gate is why
   *
   * `check:partition` refuses `schemas/kg/harness-config.ts` [agentic-harness]
   * importing `schemas/content/block-kinds.ts` [folio-assist-core]: the harness may
   * not depend on the content vocabulary. That is not an obstacle to route
   * around — it is the same reason `contentType` and `adapter` directly
   * above are `z.string()` rather than enums of `CONTENT_PROFILES` and
   * `CONTENT_ADAPTERS`, which they name and do not import.
   *
   * So the vocabulary lives with the other content axes and the FOLIO layer
   * is where a value is checked against it. Validating here would put the
   * content's vocabulary in the harness, which is the boundary this
   * repository is split along.
   */
  interactivity: z.string().optional(),
  adapter: z.string().optional(),
  adapterModule: z.string().optional(),
  harness: HarnessDirsSchema.optional(),
  translation: TranslationConfigSchema.optional(),
  dependencies: HarnessConfigDependenciesSchema.optional(),
  site: HarnessSiteSchema.optional(),
  /**
   * Per-instantiation override of where a declared subgraph gets its content,
   * keyed by the directory's `id` (never its path). The owner, 2026-10-03:
   * *"That same information can be overwritten by the harness instance
   * config."* Applied by `resolveSubgraphSource` and nowhere else
   * (`schemas/kg/subgraph-source.ts`, bean `l4ay`).
   */
  subgraphSources: SubgraphSourceOverridesSchema.optional(),
});

// ── Dependency resolution ───────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { flattenDependencies as flattenSteps } from "./dependency-order";
import { mountScopeFor, mountedInstanceRoots } from "./remote-mount";
import { BlockKindNodeSchema, builderOf } from "./block-kind-node";
import { ContentAdapterNodeSchema } from "./content-adapter-node";
import { PipelinePluginNodeSchema, QaCheckerNodeSchema, splitOwnCodeRef } from "./contribution-nodes";
import {
  describeRepository,
  type ContentTypeDisagreement,
  type ContentTypeMembership,
  type ContentTypeRegistry,
} from "../content/content-type";
import { INDEX_CONFIG_FILENAME, LEGACY_HARNESS_CONFIG, rootConfigStems } from "./instance-roots";
import { enabledSubgraphs as enabledSubgraphs_, type EnabledSubgraphs } from "./opt-in-subgraphs";
import {
  HUB_LANDING,
  importedConfigFilename,
  indexHarnessNames,
  inlineOverrides,
  readIndexConfig,
  type IndexConfig,
  type IndexLayer,
} from "./index-config";
import {
  directoriesForGraph,
  ExactVersionSchema,
  instanceConfigFilename,
  layerConfigFilename,
  findInstanceRoot,
  isKgOnlyDirectory,
  materialiseDirectories,
  ownDirectories,
  instanceDirectories,
  layerRootsIn,
  readDeclaration,
  siblingScopeFor,
  checkoutRootFor as checkoutRootForInstance,
  resolveDirectories,
  type MaterialisedDirectory,
  type ResolvedDirectory,
} from "./cat-harness";
/**
 * Re-exported, not redefined.
 *
 * The rule it carries — exact versions, never ranges — binds BOTH a
 * declaration's own `version` and a dependency's `version`, and those live in
 * two modules. It is defined in the lower one ({@link ExactVersionSchema} in
 * `cat-harness.ts`, which this module already imports) so the two cannot drift
 * into two spellings of one constraint. This line keeps the name importable
 * from here, where every existing caller looks for it.
 */
export { ExactVersionSchema };
// The `folio` graph typology is registered by CORE. This module is a LIBRARY, so it
// does NOT import that registration: a library's edge is inherited by every
// module that imports it, and the harness may not depend on core. The
// COMMAND that runs carries it — and since #840 every caller does, because
// the trigger sits at the foot of `cat-harness.ts` and a reader lives in that
// module, so loading it is a precondition of calling one.
//
// THIS COMMENT NAMED `check:composition-roots` AS THE GUARANTEE UNTIL
// 2026-09-22, in SEVEN files, AND THAT SCRIPT DOES NOT EXIST. `bun run
// check:composition-roots` exits "Script not found". The safety argument for
// a library omitting the registration rested on a gate nobody built, and no
// gate failed to say so — the same silence this repository keeps paying for.
// It is moot now rather than fixed: #840 made the registration automatic, so
// there is no longer a command that can forget it (bean `z9ax`).

/**
 * Resolved dependency — a dependency that has been located on disk.
 */
export interface ResolvedDependency {
  /** The original dependency declaration. */
  dependency: FolioAssistantDependency;
  /** Absolute path to the dependency root. */
  rootPath: string;
  /** The dependency's own harness config (if present). */
  config: HarnessConfig | null;
  /**
   * Absolute roots of this dependency's OWN dependencies. Edges, not a
   * subtree: a diamond's shared node is one object reached twice, and a
   * nested copy of it under each branch was how the old walk lost it.
   */
  needs: string[];
}

/**
 * The names this file has had, and why it is now one PER INSTANCE.
 *
 * `folio.config.json` (to 2026-09-18) described the wrong thing: the file
 * configures the HARNESS — adapter selection, the skills directory, the
 * viewer, simulators, translation, the two work-plan stores — not the folio's
 * content. `harness.config.json` (to 2026-09-20) fixed the noun and kept a
 * flaw the split exposed: **one global filename in a checkout that holds
 * several instances.**
 *
 * The owner's ruling, 2026-09-20:
 *
 * > "mv to root at `cat-harness.config.json` as will all instantiated
 * > instances (not just materialized KGs). `root/` is where instantiation is
 * > tracked."
 *
 * So the file stays at the INSTANTIATION ROOT — the checkout, where instances
 * are tracked — and takes the instance's own name. This checkout already
 * holds `cat-harness` and `bootstrap`, with `folio-assist-core` arriving; one
 * filename between them could only ever configure one.
 *
 * ## Two roots, and they were never the same question (bean `zkgs`)
 *
 * | question | root |
 * |---|---|
 * | where is the folio's CONTENT | nearest declared folio directory — `findContentRepoRoot()` |
 * | where is this instance INSTANTIATED | the checkout root, holding `<name>.config.json` |
 *
 * `zkgs` is what happens when one walk answers both: `findContentRepoRoot()`
 * stopped at `cat-harness/` while the config sat one level up, so nothing
 * read it. `readDeclaredFolioProfile()` returned the THIRD state on a
 * repository that had declared `document`, which the config's own comment
 * says "runs every criterion, and the paper adapter's LaTeX-shaped axes fire
 * `critical` on prose that never reaches pdflatex" — and the sidecars proved
 * it was happening.
 */
// MOVED to `schemas/kg/cat-harness.ts` on 2026-09-21 and re-exported here, so
// every existing importer keeps working. It had to move: that module now uses
// this filename for DISCOVERY — `<name>.config.json` is the declaration too
// since `harness.json` was excised — and this module imports THAT one, so the
// dependency only runs one way. The alternative was two functions spelling one
// filename, which is how a config and its declaration drift apart at the first
// rename.
export { instanceConfigFilename, layerConfigFilename };

/**
 * The retired global name. Kept as a constant so `check:instance-config` can
 * FIND it, never so a reader can fall back to it.
 *
 * The hard break is the owner's instruction from the previous rename (bean
 * `6nfy`, "no longer read at all"), and `9ici` is why it is paired with a
 * gate this time rather than left to be discovered: a silent break left one
 * reader still honouring the dead name, which gave an old-name instance a
 * DETERMINED answer for one setting while fifteen others vanished. A break
 * nothing announces is the expensive kind.
 */
// Defined in the leaf `instance-roots.ts` (so the one root scan,
// `rootConfigStems`, can exclude it) and re-exported here, where every
// existing importer looks for it.
export { LEGACY_HARNESS_CONFIG };

/**
 * The instance owning `dir`, and the config filename it would use.
 *
 * `undefined` when nothing declares — a THIRD state, not "no config": a
 * directory that declares no instance has no name to compose one from, and
 * guessing would put the old global filename back under a new spelling.
 */
export function instanceConfigFor(dir: string): { root: string; name: string } | undefined {
  const root = findInstanceRoot(dir);
  if (root === undefined) return undefined;
  let name: string | undefined;
  try {
    name = readDeclaration(root)?.name;
  } catch {
    // UNREADABLE is the same third state as UNDECLARED for this question, and
    // it only became reachable here when `harness.json` was excised: the
    // declaration and the config used to be two files, so a malformed config
    // could not make `readDeclaration` throw. They are one file now, and a
    // caller asking "which instance owns this directory" cannot answer from a
    // file that will not parse. `readDeclaration` still throws for the callers
    // that need the declaration itself — this one needs a name.
    return undefined;
  }
  return name === undefined ? undefined : { root, name };
}

/**
 * Find the harness config in `dir`.
 *
 * **Every reader goes through this.** The path was previously built
 * independently at eleven sites — `src/index.ts`, four `pipeline`
 * modules, three scripts, the document adapter, `folio_init` and `qa-sweep`.
 * Eleven hardcoded literals is eleven places to miss when the name changes,
 * and the one that is missed is the one where a folio silently stops being
 * configured.
 *
 * Returns `undefined` when the file is absent — a legitimate state, not an
 * error: the platform itself has no harness config, and a bare repo has none
 * until `folio_init` writes one.
 *
 * ## `folio.config.json` is not read
 *
 * That was this file's name before 2026-09-18. It is **not** a fallback: a
 * folio still carrying the old name is not configured, rather than quietly
 * half-configured by a path nothing else agrees about. Rename the file.
 */
export function resolveHarnessConfigPath(dir: string): { path: string } | undefined {
  const inst = instanceConfigFor(dir);
  if (inst === undefined) return undefined;
  const file = layerConfigFilename(inst.name);

  // From the instance root OUTWARD. The instance's own directory is tried
  // first so a standalone instance — a folio, where the instance root and the
  // checkout root are the same directory — needs no special case; then each
  // ancestor, because a checkout holding several instances tracks them at its
  // own root, which is the whole point of naming the file after the instance.
  //
  // BOUNDED at 12. An unbounded walk ends at `/`, where a stray
  // `cat-harness.config.json` in somebody's home directory would configure
  // this repository. The same bound `findContentRepoRoot` uses.
  let d = resolve(inst.root);
  for (let i = 0; i < 12; i++) {
    const p = join(d, file);
    if (existsSync(p)) return { path: p };
    const up = resolve(d, "..");
    if (up === d) break;
    d = up;
  }
  return undefined;
}

/**
 * Where the config IS, or where it would go.
 *
 * Every caller that wanted a path rather than a hit wrote
 * `resolveHarnessConfigPath(root)?.path ?? join(root, HARNESS_CONFIG)` —
 * seven of them. That tail is the eleventh hardcoded literal growing back,
 * in the callers of the function written to retire the first ten, and with
 * a per-instance filename it would now compose a name no instance uses.
 *
 * `undefined` when nothing declares, which is the same third state
 * {@link instanceConfigFor} reports and for the same reason: a directory with
 * no instance has no name to compose a filename from, and the honest answer
 * to "where would it go" is that nobody can say.
 *
 * The intended location is the INSTANCE ROOT rather than the checkout root.
 * A config that does not exist yet belongs to one instance and nothing else,
 * and writing it beside the declaration that names it is the placement a
 * reader can follow; the outward walk in {@link resolveHarnessConfigPath}
 * then finds it wherever a multi-instance checkout has chosen to keep it.
 */
export function expectedInstanceConfigPath(dir: string): string | undefined {
  const found = resolveHarnessConfigPath(dir);
  if (found) return found.path;
  const inst = instanceConfigFor(dir);
  return inst === undefined ? undefined : join(inst.root, layerConfigFilename(inst.name));
}

/**
 * What a reader of an instance's config gets: the config as written, where it
 * came from, or one of the two ways of not having one.
 *
 * `via: "index"` is an instance an `index.config.json` lists — its config is
 * the entry's import overlaid by the entry's own fields
 * ({@link effectiveLayerConfig}), exactly as {@link readHarnessConfig}
 * reads it. `via: "file"` is `<name>.config.json`.
 */
export type EffectiveConfigRead =
  | { state: "ok"; via: "index" | "file"; from: string; config: Record<string, unknown> }
  /** `from` absent: nothing declares an instance here, so there is no file to be absent. */
  | { state: "absent"; via?: "index" | "file"; from?: string }
  | { state: "unreadable"; via: "index" | "file"; from: string; why: string };

/**
 * The ONE raw read of an instance's config, index first.
 *
 * Nine readers opened `<name>.config.json` themselves (profile, voices,
 * README sections and TOC, publish targets, Pages URL, QA axes, translations,
 * Drive folder). In the index checkout no instance has that file — the index
 * entry IS its config — so every one of them reported "no config" for an
 * instance whose entry said `contentType: "document"` (measured 2026-10-09,
 * `repo-config-agreement`, `voice-gate-checkout`). Raw rather than parsed:
 * the readers read keys `HarnessConfigSchema` does not name.
 */
export function readEffectiveConfig(dir: string): EffectiveConfigRead {
  let indexed: ReturnType<typeof indexedLayerFor>;
  try {
    indexed = indexedLayerFor(dir);
  } catch (e) {
    return { state: "unreadable", via: "index", from: INDEX_CONFIG_FILENAME, why: (e as Error).message };
  }
  if (indexed !== undefined) {
    const from = `${INDEX_CONFIG_FILENAME} entry "${indexed.name}"`;
    try {
      const config = effectiveLayerConfig(indexed.root, indexed.name);
      return config === null ? { state: "absent", via: "index", from } : { state: "ok", via: "index", from, config: config as Record<string, unknown> };
    } catch (e) {
      return { state: "unreadable", via: "index", from, why: (e as Error).message };
    }
  }
  const p = expectedInstanceConfigPath(dir);
  if (p === undefined) return { state: "absent" };
  const from = basename(p);
  if (!existsSync(p)) return { state: "absent", via: "file", from };
  try {
    return { state: "ok", via: "file", from, config: JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown> };
  } catch (e) {
    return { state: "unreadable", via: "file", from, why: (e as Error).message };
  }
}

/**
 * Read and parse the harness config from a directory.
 */
export function readHarnessConfig(dir: string): HarnessConfig | null {
  // An instance LISTED in an `index.config.json` on the way out from its root
  // is configured by that index: its import overlaid by the entry's inline
  // fields. One unlisted there is read exactly as before.
  // An UNREADABLE config is `null` here on both branches. The file branch
  // below has always returned `null` for a file that will not parse; the
  // index branch threw instead, so once `init-folio` wrote an index every
  // reader crashed where it used to report "undetermined" (`qa-sweep`,
  // `profile-scoping`, 2026-10-09). A caller that must tell unreadable from
  // absent asks `readEffectiveConfig`, which keeps them apart.
  let indexed: ReturnType<typeof indexedLayerFor>;
  try {
    indexed = indexedLayerFor(dir);
  } catch {
    return null;
  }
  if (indexed !== undefined) {
    try {
      return effectiveLayerConfig(indexed.root, indexed.name);
    } catch {
      return null;
    }
  }
  const found = resolveHarnessConfigPath(dir);
  if (!found) return null;
  const configPath = found.path;
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    // Strip _comment fields before parsing
    const cleaned = JSON.parse(
      JSON.stringify(raw, (key, value) =>
        key === "_comment" ? undefined : value
      ),
    );
    return HarnessConfigSchema.parse(cleaned);
  } catch {
    // If parsing fails, return the raw JSON as a partial config
    try {
      return JSON.parse(readFileSync(configPath, "utf-8")) as HarnessConfig;
    } catch {
      return null;
    }
  }
}

// ── index.config.json: the effective config of an indexed instance ─────────

/**
 * The nearest `index.config.json` — from `dir`'s instance root outward, with
 * the same bound {@link resolveHarnessConfigPath} walks — that LISTS the
 * instance owning `dir`. `undefined` when none does (no index, or an index
 * that does not instantiate it), which leaves the caller on today's path.
 *
 * Stops at the first directory holding EITHER that index or the instance's
 * own `<name>.config.json`, so a nested checkout is never configured by an
 * index above it (a worktree under `.claude/worktrees/` holds both files of
 * its own). An unreadable index THROWS: it was written to override exactly
 * the fallback that silence would select.
 */
export function indexedLayerFor(dir: string): { root: string; name: string; entry: IndexLayer } | undefined {
  const inst = instanceConfigFor(dir);
  if (inst === undefined) return undefined;
  const own = layerConfigFilename(inst.name);
  // A MOUNTED instance is configured by the index that mounted it, so the
  // walk starts at the mount's scope. Starting at the instance root found the
  // instance's OWN `index.config.json` first — the file it uses standing
  // alone, carried into the mount with the rest of its tree — and read
  // cat-harness's config from that instead of from the checkout composing it
  // (measured 2026-10-09: `contentType` lost, `repo-config-agreement`).
  let d = resolve(mountScopeFor(inst.root) ?? inst.root);
  for (let i = 0; i < 12; i++) {
    const idx = readIndexConfig(d);
    if (idx.state === "unreadable") throw new Error(`${idx.file} is ${idx.why}`);
    if (idx.state === "ok") {
      const entry = idx.config.instances.find((e) => e.name === inst.name);
      return entry === undefined ? undefined : { root: d, name: inst.name, entry };
    }
    if (existsSync(join(d, own))) return undefined;
    const up = resolve(d, "..");
    if (up === d) break;
    d = up;
  }
  return undefined;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Inline over imported: objects merge key by key, anything else (arrays included) is replaced. */
function overlay(base: Record<string, unknown>, top: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(top)) out[k] = isPlainObject(v) && isPlainObject(out[k]) ? overlay(out[k] as Record<string, unknown>, v) : v;
  return out;
}

/** The raw JSON of `root/<file>` with `_comment` keys stripped, or `undefined` when absent. Throws when unreadable. */
function readRawConfig(file: string): Record<string, unknown> | undefined {
  if (!existsSync(file)) return undefined;
  const raw = JSON.parse(readFileSync(file, "utf-8"), (k, v) => (k === "_comment" ? undefined : v)) as unknown;
  if (!isPlainObject(raw)) throw new Error(`${file} is not a JSON object`);
  return raw;
}

/**
 * The EFFECTIVE config of instance `name` as `root/index.config.json` lists it:
 * the imported `<name>.config.json` (its `import`, when it names another
 * file), when it exists, overlaid by the entry's inline fields. Parsed through
 * {@link HarnessConfigSchema} like {@link readHarnessConfig}, and like it
 * falling back to the merged raw object when that parse fails, because config
 * files carry fields the schema does not list.
 *
 * `null` when the index is absent or does not list `name`.
 */
export function effectiveLayerConfig(root: string, name: string): HarnessConfig | null {
  const idx = readIndexConfig(root);
  if (idx.state === "unreadable") throw new Error(`${idx.file} is ${idx.why}`);
  if (idx.state === "absent") return null;
  const entry = idx.config.instances.find((e) => e.name === name);
  if (entry === undefined) return null;
  const imported = readRawConfig(join(root, importedConfigFilename(entry))) ?? {};
  const merged = overlay(imported, inlineOverrides(entry));
  const p = HarnessConfigSchema.safeParse(merged);
  return p.success ? { ...(merged as HarnessConfig), ...p.data } : (merged as HarnessConfig);
}

// ── The site's landing instance (issue #1904) ───────────────────

/**
 * Which harness the published site puts at `/`.
 *
 * | state | when |
 * |---|---|
 * | `instance` | exactly one harness is instantiated (`by: "sole"`, no flag needed), or several are and exactly one is flagged (`by: "flag"`) |
 * | `hub` | several are instantiated and two or more are flagged: a neutral hub listing the harnesses and the todos |
 * | `ambiguous` | several are instantiated and none is flagged (`reason: "none-flagged"`), or a config whose flag decides the answer cannot be read (`reason: "unreadable"`). `check:landing-instance` fails on it |
 * | `none` | nothing is instantiated here: no `<name>.config.json` at this root. Not a default guessed at: there is no harness to land on, and saying so is the answer |
 * | `invalid` | `index.config.json` is present and cannot decide: it does not parse, or its `site.landing` names an instance it does not list. NEVER a silent fallback to the flags — the index was written to override them |
 *
 * `by: "index"` is an index's own `site.landing`. `names` is always EVERY
 * instantiated harness, sorted, so a hub and an error message list the same set.
 */
export type LandingInstance =
  | { kind: "instance"; name: string; by: "sole" | "flag" | "index"; names: string[] }
  | { kind: "hub"; names: string[]; flagged: string[] }
  | { kind: "ambiguous"; names: string[]; reason: "none-flagged" | "unreadable"; unreadable: string[] }
  | { kind: "none"; names: [] }
  | { kind: "invalid"; names: string[]; file: string; reason: string };

/**
 * Every instantiated harness at `repoRoot`, sorted.
 *
 * - `index.config.json` present: its `harnesses[].name`, or in the old form
 *   (no `harnesses`) every `instances[].name` — AUTHORITATIVE, and
 *   an unreadable index THROWS rather than falling back to the file scan it
 *   was written to replace.
 * - absent: the stem of each root `<name>.config.json` (`rootConfigStems`),
 *   exactly as before.
 *
 * Instantiation is the CONFIG (or the index entry), not the declaration: a
 * subscribed harness (issue #1719) has a config at the root and no local
 * declaration, and is instantiated all the same. The retired global
 * `harness.config.json` is not an instance called `harness`, and the reserved
 * `index.config.json` is not one called `index`.
 */
export function instantiatedHarnessNames(repoRoot: string): string[] {
  const idx = readIndexConfig(repoRoot);
  if (idx.state === "unreadable") throw new Error(`${idx.file} is ${idx.why}`);
  if (idx.state === "ok") return indexHarnessNames(idx.config);
  return rootConfigStems(repoRoot);
}

/** How the root `*.config.json` files and `index.config.json` disagree, when an index exists. */
export interface IndexAgreement {
  /** A root `<name>.config.json` no index entry imports — instantiated by the old rule, not by the index. */
  unlisted: string[];
  /** An index entry whose `import` names a file that does not exist. */
  missingImport: Array<{ name: string; file: string }>;
  /** An index entry with no config file to import — a legitimate state, reported so it is seen. */
  withoutConfig: string[];
}

/**
 * Compare `index.config.json` with the root `*.config.json` set. `undefined`
 * when there is no index (nothing to agree with). `unlisted` and
 * `missingImport` are disagreements; `withoutConfig` is information.
 */
export function indexAgreement(repoRoot: string, config?: IndexConfig): IndexAgreement | undefined {
  let c = config;
  if (c === undefined) {
    const idx = readIndexConfig(repoRoot);
    if (idx.state === "unreadable") throw new Error(`${idx.file} is ${idx.why}`);
    if (idx.state === "absent") return undefined;
    c = idx.config;
  }
  const imported = new Set(c.instances.map(importedConfigFilename));
  const unlisted = rootConfigStems(repoRoot).filter((s) => !imported.has(layerConfigFilename(s)));
  const missingImport: IndexAgreement["missingImport"] = [];
  const withoutConfig: string[] = [];
  for (const e of c.instances) {
    const f = importedConfigFilename(e);
    if (existsSync(join(repoRoot, f))) continue;
    if (e.import !== undefined) missingImport.push({ name: e.name, file: f });
    else withoutConfig.push(e.name);
  }
  return { unlisted, missingImport, withoutConfig };
}

/**
 * THE ONE ANSWER to "which harness is the site's landing page" (issue #1904).
 *
 * The owner's ruling, 2026-10-02, verbatim: *"Flag it, with a default
 * (recommended). The chosen instance's own `<name>.config.json` carries
 * `"site": { "landing": true }`. If exactly one harness is instantiated, it is
 * the landing page and no flag is needed. That covers a single-IG repository. If there
 * are several and none is flagged, a gate fails. If more than one is flagged,
 * then neutral hub with listing of harnesses, todos,"*
 *
 * It replaces two answers that were each a guess: the docs generator took the
 * instance it happened to live in, and two graph generators fell back to the
 * clone's folder name. Neither the repository's name nor a generator's
 * location is consulted here.
 *
 * Reads each config's `site` raw rather than through {@link readHarnessConfig},
 * which walks OUTWARD from an instance root and could read a parent's file;
 * this question is about the files at THIS root and nothing above it.
 */
export function resolveLandingInstance(repoRoot: string): LandingInstance {
  // `index.config.json` FIRST, and an index that cannot decide is `invalid` —
  // never a quiet fall-through to the per-config flags it overrides.
  const idx = readIndexConfig(repoRoot);
  if (idx.state === "unreadable") return { kind: "invalid", names: [], file: idx.file, reason: idx.why };
  const index = idx.state === "ok" ? idx.config : undefined;
  const names = index ? indexHarnessNames(index) : instantiatedHarnessNames(repoRoot);
  const landing = index?.site?.landing;
  if (landing !== undefined) {
    if (landing === HUB_LANDING) return { kind: "hub", names, flagged: [] };
    if (!names.includes(landing)) {
      return { kind: "invalid", names, file: idx.file, reason: `site.landing names \`${landing}\`, which ${idx.file} does not list as ${index?.harnesses ? "a harness" : "an instance"} (${names.join(", ") || "none"})` };
    }
    return { kind: "instance", name: landing, by: "index", names };
  }
  if (names.length === 0) return { kind: "none", names: [] };
  if (names.length === 1) return { kind: "instance", name: names[0]!, by: "sole", names };

  const flagged: string[] = [];
  const unreadable: string[] = [];
  for (const name of names) {
    let raw: unknown;
    try {
      // Indexed: the EFFECTIVE config (import overlaid by inline fields), so an
      // inline `site` counts. Not indexed: the file at this root, as before.
      raw = index ? effectiveLayerConfig(repoRoot, name) ?? {} : JSON.parse(readFileSync(join(repoRoot, layerConfigFilename(name)), "utf-8"));
    } catch {
      unreadable.push(name);
      continue;
    }
    const site = HarnessSiteSchema.safeParse((raw as { site?: unknown } | null)?.site ?? {});
    if (!site.success) unreadable.push(name);
    else if (site.data.landing === true) flagged.push(name);
  }
  // UNREADABLE outranks a finding: a config that cannot be read might carry a
  // flag, so neither "exactly one" nor "none" is determined. One readable
  // flag beside an unreadable file could be a hub, and answering "instance"
  // would be a guess.
  if (unreadable.length > 0) return { kind: "ambiguous", names, reason: "unreadable", unreadable };
  if (flagged.length === 1) return { kind: "instance", name: flagged[0]!, by: "flag", names };
  if (flagged.length >= 2) return { kind: "hub", names, flagged };
  return { kind: "ambiguous", names, reason: "none-flagged", unreadable: [] };
}

/**
 * The instance a path directly at `repoRoot` belongs to: the root's DECLARED
 * name, else the landing instance when that is one harness, else `undefined`.
 *
 * Never the clone's folder name (bean `t5dm`, issue #1904): a worktree's
 * basename is wherever it was cloned, and a repository that instantiates only
 * a DAK layer is not an instance named after the repository.
 */
export function rootInstanceName(repoRoot: string): string | undefined {
  let declared: string | undefined;
  try {
    declared = readDeclaration(repoRoot)?.name;
  } catch {
    declared = undefined;
  }
  if (declared !== undefined) return declared;
  const landing = resolveLandingInstance(repoRoot);
  return landing.kind === "instance" ? landing.name : undefined;
}

/**
 * Resolve a single dependency to an absolute path.
 *
 * Tries `path` first (relative to folioRoot), then a REMOTE MOUNT of that
 * name recorded in the checkout's mount lock (bean `0mpw`). Does NOT fetch —
 * `bun run cat mount:remote` does, and `mount:remote:check` says when it has not.
 *
 * This fell back to `.deps/<name>/` until 2026-10-06, a directory nothing
 * created and the owner ruled out: a dot directory collides with GitHub's
 * conventions and with this repository's own dot-prefix guard. The lock is
 * the declared answer to "where did that layer land", so it is the one read.
 */
export function resolveDependencyPath(
  folioRoot: string,
  dep: FolioAssistantDependency,
): string | null {
  // Try explicit path
  if (dep.path) {
    const abs = dep.path.startsWith("/")
      ? dep.path
      : resolve(folioRoot, dep.path);
    if (existsSync(abs)) return abs;
  }

  // Try a remote mount of that name
  const abs = resolve(folioRoot);
  return mountedInstanceRoots(mountScopeFor(abs) ?? abs).get(dep.name) ?? null;
}

/**
 * The dependencies implied by an instance's declared `needs`, for edges whose
 * target is an instance in this same checkout.
 *
 * ## Why this exists
 *
 * The owner, 2026-09-22: *"can we consolidate needs etc -> dependencies?"*,
 * then *"i want to adopt the sushi/fhir IG(/npm?) versioning dependencies for
 * computing overlays. SHAs are for provenance, digital signing, staging. we
 * need both, different needs."*
 *
 * Before this, `needs` and `dependencies` were two relations that nothing
 * reconciled: `needs` drove `dependency-order`'s sort and `harness-tiles`'
 * navbar spine, while the skill and content overlay read config
 * `dependencies` — and **exactly one instance in the repository declared
 * one**. So the whole `smart-*` stack had a correct navbar spine, a correct
 * topological order, green gates, and **not one skill crossing a layer
 * boundary**. An IG instance could not reach `ig-build-pipeline`, the skill
 * governing how its own IG is built. Bean `5kn6`.
 *
 * That was invisible precisely because `needs` being right LOOKS like the
 * stack being wired.
 *
 * ## The two tiers, and why a derived edge carries no version
 *
 * `instance-versioning.md` §3.3: a SHA may stage, only a version publishes.
 * An edge between two instances in ONE checkout is a staging-tier reference —
 * the consumer has the repository, so a path resolves it, and a version would
 * be asserting a published identity that §3.1 says most instances should not
 * have. So a derived dependency carries `path` and **no `version`**, and that
 * is a statement rather than an omission: it is not publishable, and
 * `check:published-refs` is what stops one reaching an external consumer.
 *
 * An edge to something OUTSIDE the checkout cannot be derived — a name gives
 * no git URL and no version — so it stays authored in the config. That is the
 * division of labour: **`needs` states the stack, the config states what a
 * name cannot carry.**
 *
 * ## A name that resolves to nothing is REPORTED, never dropped
 *
 * It comes back in `unresolved`. Silently skipping it would make "this layer
 * is external" and "this layer is misspelled" the same observation, and only
 * one of them is fine.
 */
/**
 * Known folded or renamed instance aliases.
 *
 * When an instance is folded into another (e.g. `cat-openapi` folded into
 * `cat-harness` as a named subgraph `openapi`, PR #2496), external forks or
 * historical dependencies may still carry the old name in `needs`.
 */
export const FOLDED_INSTANCE_ALIASES: Record<string, string> = {
  "cat-openapi": "cat-harness",
};

export function dependenciesFromNeeds(instanceRoot: string): {
  dependencies: FolioAssistantDependency[];
  unresolved: string[];
} {
  const abs = resolve(instanceRoot);
  let needs: string[] = [];
  try {
    const decl = readDeclaration(abs);
    needs = decl?.needs ?? [];
    // THE INDEX CHECKOUT: a root that declares no instance of its own but
    // carries `index.config.json` composes every instance that file lists —
    // the file exists to say exactly that ("one root file declares the
    // instantiated harnesses"). Without this, a root with no declaration
    // needed nothing, the checkout graph held the root alone, and every
    // corpus-wide reader saw only the default directories: fsh-guts and the
    // rest of what the mounted instances declare went unseen (2026-10-09,
    // after folio-assistant.json was retired in favour of the index).
    if (decl === undefined) {
      const idx = readIndexConfig(abs);
      if (idx.state === "ok") needs = idx.config.instances.map((i) => i.name).filter((n) => n !== undefined);
    }
  } catch {
    // A declaration that cannot be read is not this function's to diagnose;
    // `readDeclaration`'s own callers throw on it. Here it means no derivation.
    return { dependencies: [], unresolved: [] };
  }
  if (needs.length === 0) return { dependencies: [], unresolved: [] };

  // `siblingScopeFor`, NOT `repoRootFor`: this is a lookup of SIBLINGS by
  // name, and `repoRootFor` is `dirname`, which climbs out of the checkout for
  // the one instance declared at the repository root. That made the root
  // instance's `needs` derive nothing while its authored edge still resolved —
  // an overlay that looked like it worked and held one entry.
  // A MOUNTED instance's siblings are where the mount that placed it put
  // them (bean `0mpw`) — which `siblingScopeFor` cannot see when an override
  // moved it below the one-level scan.
  const repoRoot = mountScopeFor(abs) ?? siblingScopeFor(abs);
  const byName = new Map<string, string>();
  for (const root of layerRootsIn(repoRoot)) {
    try {
      const n = readDeclaration(root)?.name;
      if (n !== undefined) byName.set(n, root);
    } catch {
      // An unreadable sibling cannot be matched against; it is not an error
      // here, and `check:declaration-filename` is what reports it.
    }
  }
  // A REMOTE MOUNT an override moved below the one-level scan is still a
  // sibling (bean `0mpw`): its lock says where it landed.
  for (const [n, root] of mountedInstanceRoots(repoRoot)) {
    if (!byName.has(n)) byName.set(n, root);
  }

  const dependencies: FolioAssistantDependency[] = [];
  const unresolved: string[] = [];
  for (const rawName of needs) {
    const name = FOLDED_INSTANCE_ALIASES[rawName] ?? rawName;
    const root = byName.get(name);
    if (root === undefined) {
      unresolved.push(rawName);
      continue;
    }
    dependencies.push({ name, path: root, derivedFromNeeds: true });
  }
  return { dependencies, unresolved };
}

/** Something wrong with an instance's dependency graph. */
export type InstanceGraphProblem =
  | { kind: "missing"; from: string; name: string; detail: string }
  | { kind: "cycle"; roots: string[]; detail: string };

export interface InstanceGraph {
  /**
   * Every dependency the root reaches, EACH ONCE, deepest first and the root's
   * direct dependencies last. The root itself is not in it.
   */
  order: ResolvedDependency[];
  problems: InstanceGraphProblem[];
}

/**
 * Resolve an instance's dependency graph COMPLETELY, then walk it.
 *
 * The owner, 2026-09-23 (bean `a1lq`): *"once depedencies of (orderd)
 * dependecy tree are full resolve, walk tree in order starting w/ deepest
 * depenencies (bootstreap/)"*. Two passes, and the second is the platform's
 * one flattener, `schemas/kg/dependency-order.ts`, the same one the render
 * pipeline and the harness tiles order with.
 *
 * ## What the single interleaved pass got wrong
 *
 * It recursed and built as it went, with one `seen` set shared across sibling
 * branches as its cycle guard. So:
 *
 * - **a diamond read as a cycle.** A needs B and C, both need D: D resolved
 *   under B and came back EMPTY under C, behind a comment saying `// cycle`;
 * - **a real cycle was dropped just as silently**;
 * - **a dependency that could not be found was skipped**, so "not in this
 *   checkout" and "misspelled" were the same observation.
 *
 * None of that had fired, because no instance here needs two others. It fires
 * on the first that does.
 *
 * ## Pass 1, resolve: every node once, keyed by absolute root
 *
 * A node is resolved the first time it is reached and reused after that,
 * which is what makes a diamond ONE node. The memo is not a cycle guard; the
 * flattener finds cycles, and names every instance in one.
 *
 * ## Pass 2, order: foundation first
 *
 * Ties break on the order dependencies were declared, depth-first — which for
 * a chain (every instance here today) is exactly the order the old walk gave.
 */
export function resolveInstanceGraph(folioRoot: string): InstanceGraph {
  const root = resolve(folioRoot);
  const nodes = new Map<string, ResolvedDependency>();
  const needsOf = new Map<string, string[]>();
  const declared: string[] = [];
  const problems: InstanceGraphProblem[] = [];

  const visit = (at: string): void => {
    if (needsOf.has(at)) return;
    const needs: string[] = [];
    needsOf.set(at, needs);

    const config = at === root ? readHarnessConfig(at) : nodes.get(at)!.config;
    const authored = config?.dependencies?.folioAssistant ?? [];
    // AUTHORED WINS ON NAME. A config entry can say what a derived one cannot —
    // a git URL, a version, a `provides` narrowing — so letting derivation
    // override it would silently widen a deliberately narrowed edge.
    const authoredNames = new Set(authored.map((d) => d.name));
    const fromNeeds = dependenciesFromNeeds(at);
    const derived = fromNeeds.dependencies.filter((d) => !authoredNames.has(d.name));

    // A `needs` NAME THAT RESOLVED TO NOTHING IS A PROBLEM, not an absence.
    //
    // `dependenciesFromNeeds` returns these in `unresolved` precisely so a
    // caller can report them — its docblock says *"A name that resolves to
    // nothing is REPORTED, never dropped"* — and this function used to throw
    // the array away. The cost was measured on `main` at `80c18ac`: the
    // repository root's `needs` on the content core resolved to nothing,
    // `problems` came back `[]`, and `check:instance-graph` printed *"19
    // instance(s): every dependency resolves, no cycle"*. A gate asserting the
    // opposite of the fact it was written to catch.
    //
    // Reported as `missing`, the same kind an unresolvable authored dependency
    // gets, because the consequence is identical: that layer is absent from
    // every overlay. An entry already named by `authored` is not reported —
    // the config supplies what the name could not, which is the division of
    // labour `dependenciesFromNeeds` documents.
    for (const name of fromNeeds.unresolved) {
      if (authoredNames.has(name)) continue;
      problems.push({
        kind: "missing",
        from: at,
        name,
        detail: `\`${name}\`, named in ${at}'s \`needs\`, matches no instance in this checkout — its layer is absent from every overlay`,
      });
    }

    for (const dep of [...derived, ...authored]) {
      const found = resolveDependencyPath(at, dep);
      if (!found) {
        problems.push({
          kind: "missing",
          from: at,
          name: dep.name,
          detail: `\`${dep.name}\`, a dependency of ${at}, is not in this checkout — its layer is absent from every overlay`,
        });
        continue;
      }
      const abs = resolve(found);
      needs.push(abs);
      if (abs !== root && !nodes.has(abs)) {
        nodes.set(abs, { dependency: dep, rootPath: found, config: readHarnessConfig(found), needs: [] });
      }
      visit(abs);
    }
    if (at !== root) nodes.get(at)!.needs = needs;
    declared.push(at);
  };
  visit(root);

  const { order, problems: orderProblems } = flattenSteps(
    declared.map((id) => ({ id, needs: needsOf.get(id), fatal: true })),
  );
  for (const p of orderProblems) {
    if (p.kind === "cycle") problems.push({ kind: "cycle", roots: p.ids, detail: p.detail });
  }
  return {
    order: order.filter((s) => s.id !== root).map((s) => nodes.get(s.id)!),
    problems,
  };
}

/**
 * The resolved dependencies, deepest first, for a caller that overlays them.
 *
 * The owner's ruling on a1lq, 2026-09-23: **a cycle throws, a missing
 * dependency warns and the run continues without that layer**. A missing
 * dependency is also what an uncloned git-URL dependency looks like in a
 * partial checkout, and throwing there would stop sessions that work. It is
 * not silent: the warning names it, and `check:instance-graph` fails on it, so
 * it cannot merge unnoticed.
 */
export function orderedDependencies(folioRoot: string): ResolvedDependency[] {
  const g = resolveInstanceGraph(folioRoot);
  const cycles = g.problems.filter((p) => p.kind === "cycle");
  if (cycles.length > 0) {
    throw new Error(`dependency cycle under ${resolve(folioRoot)}:\n` + cycles.map((c) => `  ${c.detail}`).join("\n"));
  }
  for (const p of g.problems) {
    const key = `${p.kind}:${p.detail}`;
    if (warned.has(key)) continue;
    warned.add(key);
    console.warn(`⚠ ${p.detail}`);
  }
  return g.order;
}
const warned = new Set<string>();

/**
 * The declaration chain for an instance: deepest dependency first, root last.
 *
 * This is the argument `resolveDirectories` in `schemas/kg/cat-harness.ts` asks
 * for and documents ("callers usually get this from
 * `orderedDependencies(root)` plus the root itself") and
 * which, until now, nothing built — `resolveDirectories` had no caller outside
 * its own tests, the same gap `resolveSkillDirs` carries and this file's own
 * status table records. A resolver with no caller is a declaration nobody
 * reads, which is how `uploads/` and `library/` came to be described in three
 * documents and declared in none.
 *
 * Root LAST so a root redeclaring an inherited id wins, matching the overlay
 * order `orderedDependencies` documents and `resolveDirectories` relies on.
 */
export function declarationChain(
  folioRoot: string,
): Array<{ name: string; root: string; own?: boolean }> {
  const flat = orderedDependencies(folioRoot);
  const chain: Array<{ name: string; root: string; own?: boolean }> = flat.map(
    (d) => ({ name: d.dependency.name ?? d.rootPath, root: d.rootPath }),
  );
  chain.push({ name: "(root)", root: resolve(folioRoot), own: true });
  return chain;
}

// ── The checkout aggregates (bean `cmsl` option A, step 3; placement PR0a) ──

/**
 * The checkout an instance is staged in: the directory whose own instance
 * AGGREGATES every instance beside it.
 *
 * {@link siblingScopeFor}, named for the question it answers here. For a
 * nested instance (`cat-harness/`) it is the repository root; for the
 * instance declared AT the repository root it is that root itself, not its
 * parent — the case `repoRootFor` gets wrong by construction.
 *
 * Delegates to `checkoutRootFor` in `schemas/kg/cat-harness.ts` (bean `g43f`),
 * which adds git's own marker to the container rule: a root instance that
 * holds its own `.git` is its checkout even when it aggregates nothing, where
 * the container rule alone returned its parent. One answer, two import paths.
 */
export function checkoutRootFor(start: string): string {
  return checkoutRootForInstance(start);
}

/**
 * Every directory the CHECKOUT holds: each staged instance's own directories,
 * resolved through that instance's own chain, so an inherited subgraph
 * contributes one member per instance whose same-named directory exists
 * (bean `1g4s`, option A).
 *
 * ## Why this exists — the arrow the mirrors had backwards
 *
 * Until placement PR0 (bean `ejye`), `cat-harness.json` carried 19
 * `scope: "repository"` entries naming its DEPENDENTS' directories —
 * the content core's `skills/`, the IRIS replica's `library/`, … — so that a
 * corpus-wide tool asking the platform for "every library" got every library.
 * Every one of those owners `needs` cat-harness, so the platform was naming
 * its users: the wrong-way arrow `cmsl` measured, and 5 of the 19 had already
 * drifted from the owner's own id. The owner's ruling (2026-09-30, round 3):
 * **the checkout aggregates.** The root instance `needs` every staged
 * instance and declares the checkout-level state it physically holds; a
 * corpus-wide tool resolves over the root's overlay; the platform names no
 * folio.
 *
 * ## Why per instance, and not one `resolveDirectories` over one long chain
 *
 * `resolveDirectories` overrides BY ID, which is right along one dependency
 * line and wrong across siblings: the DAK layer declares `processes` at
 * `methodologies/processes/`, and resolving it in the same chain as
 * cat-harness would REPLACE cat-harness's `processes` rather than add to it.
 * Each instance answers for itself through its own chain, keeping the entries
 * it owns (`own`, or a default seeded in its own tree); the union, de-duplicated
 * by absolute path, is the checkout. A diamond reaches an instance twice and
 * contributes it once.
 *
 * ## The falsifier it carries (cmsl)
 *
 * A checkout whose root instance does NOT stage an instance sees less — a
 * split checkout running against one folio sees that folio's dependencies
 * only. That is the intended behaviour: the tool sees what the checkout
 * contains, not what the platform remembers having been next to.
 *
 * @param start any instance root in the checkout, or the checkout root
 */
/** `readDeclaration`, with an unreadable declaration read as "declares something" so it is never mistaken for an index root. */
function safeDeclaration(root: string): unknown {
  try {
    return readDeclaration(root);
  } catch {
    return {};
  }
}

export function checkoutDirectories(
  start: string,
  /**
   * `enabledSubgraphs`: the opt-in sub-graphs switched on for EVERY instance
   * resolved — a folio's, when the question is what that folio is given.
   * Absent, each instance resolves with its own (`opt-in-subgraphs.ts`).
   */
  opts: { stackedOn?: string; enabledSubgraphs?: EnabledSubgraphs } = {},
): ResolvedDirectory[] {
  const root = checkoutRootFor(start);
  const base = opts.stackedOn === undefined ? undefined : resolve(opts.stackedOn);
  const en = opts.enabledSubgraphs;
  const key = `${root}\0${base ?? ""}${en === undefined ? "" : `\0${en === "all" ? "*" : [...en].sort().join(",")}`}`;
  const cached = checkoutCache.get(key);
  if (cached !== undefined) return cached.map((d) => ({ ...d }));
  const graph = checkoutGraph(root);
  let instances = [...graph.order];
  // `stackedOn`: only that instance and the ones stacked on it. What a tool
  // shipped BY an instance asks when it means "the corpus I serve": its
  // dependencies are its own overlay (`orderedDependencies`), already read by
  // every caller that resolves downward, and counting them again here would
  // re-attribute bootstrap's skills to the platform.
  // The index checkout's root declares no instance, so nothing is stacked on
  // it: it is the COMPOSITION, and the corpus it serves is every instance it
  // composes (`dependenciesFromNeeds` reads them from `index.config.json`).
  // Filtering to "stacked on the root" there kept the root alone.
  const indexRoot = base !== undefined && base === root && safeDeclaration(root) === undefined;
  if (base !== undefined && !indexRoot) {
    const above = new Set(checkoutDependentsOf(base).map((d) => d.root));
    instances = instances.filter((i) => i === base || above.has(i));
    if (!instances.includes(base)) instances.unshift(base);
  }
  const out: ResolvedDirectory[] = [];
  const seen = new Set<string>();
  for (const inst of instances) {
    let mine: ResolvedDirectory[];
    try {
      mine = resolveDirectories(chainIn(graph, inst), undefined, en === undefined ? {} : { enabledSubgraphs: en });
    } catch {
      continue; // an unreadable declaration is `check:harness-dirs`'s to report
    }
    for (const d of mine) {
      // OWN entries only: an inherited declaration's own location is reported
      // by the instance that declared it, which is also in this list.
      if (!d.own && d.declaredBy !== "(default)") continue;
      if (seen.has(d.absPath)) continue;
      seen.add(d.absPath);
      out.push(d);
    }
  }
  checkoutCache.set(key, out);
  return out.map((d) => ({ ...d }));
}

/**
 * Memoised per checkout root for the life of the process: resolving every
 * instance through its own chain costs ~0.9 s on this checkout, and a
 * corpus-wide script asks for several kinds. A caller that rewrites a
 * declaration mid-process (a test fixture) calls {@link clearCheckoutCache}.
 */
const checkoutCache = new Map<string, ResolvedDirectory[]>();

/** Forget every memoised {@link checkoutDirectories} / {@link checkoutDependentsOf} answer. */
export function clearCheckoutCache(): void {
  checkoutCache.clear();
  dependentsCache.clear();
  implementersCache.clear();
  graphCache.clear();
}

/** The checkout's dependency graph, walked ONCE: order, transitive closure, names. */
interface CheckoutGraph {
  /** Every instance the root reaches, deepest first, the root last. */
  order: string[];
  /** Each instance's transitive dependencies. */
  deps: Map<string, Set<string>>;
  /** Each instance's declared name, as `declarationChain` spells a link. */
  names: Map<string, string>;
}

const graphCache = new Map<string, CheckoutGraph>();

/**
 * One `orderedDependencies` walk of the checkout root, from which every
 * staged instance's own chain is DERIVED rather than re-walked. Walking each
 * instance separately cost ~25 ms apiece (each derivation rescans the
 * checkout for siblings), which made every corpus-wide CLI ten times slower
 * than before placement PR0 — measured 0.2 s → 2 s on `narratives confirm`.
 */
function checkoutGraph(root: string): CheckoutGraph {
  const hit = graphCache.get(root);
  if (hit !== undefined) return hit;
  let flat: ResolvedDependency[] = [];
  try {
    flat = orderedDependencies(root);
  } catch {
    // A cycle is `check:instance-graph`'s finding; here the checkout falls
    // back to its root alone rather than taking every corpus-wide tool down.
    flat = [];
  }
  // Set when `flat` below is DISCOVERED rather than declared — see `direct`.
  let discovered = false;
  if (flat.length === 0 && readDeclaration(root) === undefined) {
    // Aggregate / coordinator checkout with no root declaration:
    // walk orderedDependencies from each instantiated/mounted instance so
    // that dependents and implementers across sibling instances resolve.
    discovered = true;
    const seen = new Set<string>();
    for (const inst of layerRootsIn(root)) {
      if (resolve(inst) === resolve(root)) continue;
      try {
        const deps = orderedDependencies(inst);
        for (const d of deps) {
          const key = resolve(d.rootPath);
          if (!seen.has(key)) {
            seen.add(key);
            flat.push(d);
          }
        }
        const instKey = resolve(inst);
        if (!seen.has(instKey)) {
          seen.add(instKey);
          let declName: string | undefined;
          try {
            declName = readDeclaration(inst)?.name;
          } catch {
            // unreadable
          }
          flat.push({
            dependency: { name: declName ?? inst },
            rootPath: inst,
            config: readHarnessConfig(inst),
            needs: deps.map((d) => d.rootPath),
          });
        }
      } catch {
        // cycle or problem reported elsewhere
      }
    }
  }
  const order = [...new Set([...flat.map((d) => resolve(d.rootPath)), root])];
  const direct = new Map(flat.map((d) => [resolve(d.rootPath), d.needs.map((n) => resolve(n))]));
  // The root needs what it DECLARES: every instance its own chain or its
  // index names. A discovered walk (above) relates the instances to EACH
  // OTHER; it is not a declaration by the root, which declares nothing. Made a
  // dependent of everything it merely contains, a bare aggregate became a
  // stacked-on member of every inherited subgraph: an instance declaring a
  // kg at `sibling` had `<aggregate>/sibling` attributed to it, so
  // `resolveSkillDirs` served a directory nobody declared (measured
  // 2026-10-09, folio-assistant#2518; `skill-overlay.test.ts`). An INDEX
  // root is unaffected: `index.config.json` names its instances, so its
  // `flat` is declared and it needs every one of them.
  direct.set(root, discovered ? [] : flat.map((d) => resolve(d.rootPath)));
  const deps = new Map<string, Set<string>>();
  const close = (a: string, path: Set<string>): Set<string> => {
    const known = deps.get(a);
    if (known !== undefined) return known;
    const out = new Set<string>();
    if (path.has(a)) return out; // a cycle: reported elsewhere, never looped on here
    path.add(a);
    for (const n of direct.get(a) ?? []) {
      out.add(n);
      for (const x of close(n, path)) out.add(x);
    }
    path.delete(a);
    deps.set(a, out);
    return out;
  };
  for (const a of order) close(a, new Set());
  const names = new Map(flat.map((d) => [resolve(d.rootPath), d.dependency.name ?? d.rootPath]));
  const graph = { order, deps, names };
  graphCache.set(root, graph);
  return graph;
}

/** `declarationChain(inst)`, derived from the checkout's one walk when it reaches `inst`. */
function chainIn(graph: CheckoutGraph, inst: string): Array<{ name: string; root: string; own?: boolean }> {
  const deps = graph.deps.get(inst);
  if (deps === undefined) return declarationChain(inst);
  return [
    ...graph.order.filter((x) => deps.has(x)).map((x) => ({ name: graph.names.get(x) ?? x, root: x })),
    { name: "(root)", root: inst, own: true },
  ];
}

const dependentsCache = new Map<string, Array<{ name: string; root: string }>>();

/**
 * The instances in this checkout that DEPEND on `instanceRoot` — directly or
 * through another — deepest first, so a later one overlays an earlier one.
 *
 * The reverse of {@link orderedDependencies}, and only answerable from the
 * checkout: an instance's own declaration names what it needs, never what
 * needs it (the arrow `cmsl` fixed). This is what a higher instance's
 * extension of a lower instance's node is found through (placement PR0b): the
 * lower instance resolves its roles, then asks the checkout which dependents
 * hold a pointer at them.
 */
export function checkoutDependentsOf(instanceRoot: string): Array<{ name: string; root: string }> {
  const target = resolve(instanceRoot);
  const cached = dependentsCache.get(target);
  if (cached !== undefined) return cached;
  const graph = checkoutGraph(checkoutRootFor(target));
  const out: Array<{ name: string; root: string }> = [];
  for (const inst of graph.order) {
    if (inst === target) continue;
    if (!(graph.deps.get(inst)?.has(target) ?? false)) continue;
    let name = inst;
    try {
      name = readDeclaration(inst)?.name ?? inst;
    } catch {
      // unreadable: named by path, `check:harness-dirs` reports it
    }
    out.push({ name, root: inst });
  }
  dependentsCache.set(target, out);
  return out;
}

const implementersCache = new Map<string, Array<{ name: string; root: string }>>();

/**
 * The instances that IMPLEMENT `declaringRoot`: those in the checkout whose own
 * `needs` names it directly.
 *
 * ## Why this exists
 *
 * Owner rulings T1 and T7 (2026-10-01, bean `70lx`). A harness DEFINITION names
 * its implementation by an instance-relative path — a Tool's
 * `invoke.inProcess.module` (`src/tools/x.ts`), a criterion's `source_file`
 * (`pipeline/x.ts`). The code those paths name is moving to the layer
 * above, and writing that layer's name into the harness
 * would be a lower layer naming a higher one, which `check:reference-direction`
 * grades. So the path stays as written, and is resolved against the instance
 * that implements the definition — found the way the arrow already runs, from
 * the implementer's `needs` to the definer, never the reverse.
 *
 * ## Direct, not transitive
 *
 * {@link checkoutDependentsOf} is transitive: every folio in the checkout
 * depends on the harness eventually, and any of them may hold a
 * `scripts/x.ts`. Only an instance that names the definer in its OWN `needs`
 * has taken it on directly, which is the relation "implements" can mean.
 *
 * The checkout's aggregate root is excluded even though it `needs`
 * everything: its directory CONTAINS the definer, so a relative path under it
 * would be a different path, not the same one somewhere else.
 */
export function implementingInstancesOf(declaringRoot: string): Array<{ name: string; root: string }> {
  const target = resolve(declaringRoot);
  const cached = implementersCache.get(target);
  if (cached !== undefined) return cached;
  let name: string | undefined;
  try {
    name = readDeclaration(target)?.name;
  } catch {
    // unreadable: it implements nothing we can name; `check:harness-dirs` reports it
  }
  const out: Array<{ name: string; root: string }> = [];
  if (name !== undefined) {
    for (const dep of checkoutDependentsOf(target)) {
      const root = resolve(dep.root);
      if (target.startsWith(`${root}${sep}`)) continue;
      let needs: readonly string[] = [];
      try {
        needs = readDeclaration(root)?.needs ?? [];
      } catch {
        continue;
      }
      if (needs.includes(name)) out.push({ name: dep.name, root });
    }
    // SEPARATED (bean `nn8e`, #2266): when the definer is its own checkout —
    // a clone of its own repository — its implementers are not inside it but
    // BESIDE it, as sibling clones (the layout `seed:ready --rehearse` and a
    // multi-repo workspace both use). Same rule, one directory up: a sibling
    // whose own `needs` names the definer implements it.
    if (out.length === 0 && resolve(checkoutRootFor(target)) === target) {
      const parent = dirname(target);
      let siblings: string[] = [];
      try {
        siblings = readdirSync(parent, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith("."))
          .map((e) => join(parent, e.name))
          .filter((d) => d !== target);
      } catch {
        siblings = [];
      }
      for (const root of siblings.sort()) {
        let decl: ReturnType<typeof readDeclaration> | undefined;
        try {
          decl = readDeclaration(root);
        } catch {
          continue;
        }
        if (decl?.needs?.includes(name)) out.push({ name: decl.name ?? root, root });
      }
    }
  }
  implementersCache.set(target, out);
  return out;
}

/** Where an instance-relative path declared by one instance actually is. */
export type ImplementingPath =
  /** `via: "own"` — the declaring instance holds it; `"needs"` — one implementer does. */
  | { state: "found"; root: string; instance: string; via: "own" | "needs" }
  /** Nobody holds it. `looked` is every root tried, declaring instance first. */
  | { state: "missing"; looked: string[] }
  /** More than one implementer holds it. Never resolved by order: both are named. */
  | { state: "ambiguous"; candidates: Array<{ name: string; root: string }> };

/**
 * Resolve `relPath`, written in `declaringRoot`'s definitions, to the instance
 * that holds it: the declaring instance itself first, then exactly one of
 * {@link implementingInstancesOf}.
 *
 * The declaring instance comes first so that a path that has not moved yet
 * keeps resolving where it always did; that is what lets the code move run in
 * batches without rewriting a single definition. Two implementers holding the
 * same path is `ambiguous`, never "the first": picking one by checkout order
 * is how a check comes to read another instance's file and report it current.
 */
export function resolveImplementingPath(declaringRoot: string, relPath: string): ImplementingPath {
  const own = resolve(declaringRoot);
  let ownName = own;
  try {
    ownName = readDeclaration(own)?.name ?? own;
  } catch {
    // named by path
  }
  if (existsSync(join(own, relPath))) return { state: "found", root: own, instance: ownName, via: "own" };
  const implementers = implementingInstancesOf(own);
  const holding = implementers.filter((i) => existsSync(join(i.root, relPath)));
  if (holding.length === 1) return { state: "found", root: holding[0]!.root, instance: holding[0]!.name, via: "needs" };
  if (holding.length > 1) return { state: "ambiguous", candidates: holding };
  return { state: "missing", looked: [own, ...implementers.map((i) => i.root)] };
}

/**
 * The root to read `relPath` against, for a caller that composes
 * `join(root, relPath)` and already reports a missing file in its own words.
 *
 * `missing` returns the declaring root, so such a caller's report is
 * unchanged. `ambiguous` THROWS: there is no root that would be honest.
 */
export function implementingRootFor(declaringRoot: string, relPath: string): string {
  const r = resolveImplementingPath(declaringRoot, relPath);
  if (r.state === "found") return r.root;
  if (r.state === "missing") return resolve(declaringRoot);
  throw new Error(
    `${relPath} (declared by ${declaringRoot}) is held by more than one implementing instance: ` +
      `${r.candidates.map((c) => c.name).join(", ")}. Each declared path must name one file.`,
  );
}

/**
 * Every directory in the checkout holding `kind`, as absolute paths — the
 * corpus-wide counterpart of `directoriesForGraph`, which answers for ONE
 * instance and, since PR0, sees nothing above it.
 */
export function checkoutDirectoriesForGraph(
  kind: string,
  start: string,
  opts: { stackedOn?: string } = {},
): string[] {
  return checkoutDirectories(start, opts)
    .filter((d) => d.graphTypologies.includes(kind as never))
    .map((d) => d.absPath);
}

/**
 * The corpus a tool shipped BY `instanceRoot` serves, for `kind`: that
 * instance's directories plus those of every instance the checkout stacks on
 * it. Same argument order as `directoriesForGraph`, so a corpus-wide call
 * site states its scope by its function name. This is what replaced asking
 * the platform's declaration for its dependents' directories (placement PR0a).
 */
export function corpusDirectoriesForGraph(instanceRoot: string, kind: string): string[] {
  return checkoutDirectoriesForGraph(kind, instanceRoot, { stackedOn: instanceRoot });
}

/**
 * The ONE corpus directory holding `kind`, or `undefined` — the corpus
 * counterpart of `directoryForGraph`, with its refusal: more than one is an
 * error, never "the first". For the checkout-level state graphs (`beans`,
 * `todos`, `memory`, `issue-marks`, `interaction`, `fsh-guts`) the root
 * instance declares since placement PR0a, which a platform tool still asks
 * for by kind.
 */
export function corpusDirectoryForGraph(instanceRoot: string, kind: string): string | undefined {
  const all = corpusDirectoriesForGraph(instanceRoot, kind);
  if (all.length > 1) {
    throw new Error(
      `graph "${kind}" is held by ${all.length} directories in this checkout, so there is no single ` +
        `directory for it: ${all.join(", ")}. Use \`corpusDirectoriesForGraph\` for all of them.`,
    );
  }
  return all[0];
}

// ── A declared subgraph, with its resolved content source (bean `l4ay`) ──

/** A declared subgraph: who declares it, its entry, and where its content comes from. */
export interface DeclaredSubgraph {
  id: string;
  /** The root of the instance whose OWN declaration carries the entry. */
  instanceRoot: string;
  /** That instance's declared `name`. */
  instanceName: string;
  /** The instance's declared `repository` (`owner/repo`), when it has one. */
  repository?: string;
  entry: ResolvedDirectory;
  source: ResolvedSubgraphSource;
}

/**
 * The instance-config overrides that apply to a subgraph declared by
 * `declarer`: the declarer's own config, then the CHECKOUT ROOT's on top —
 * the checkout root is the instantiation, so its word is last. Both matched on
 * directory id.
 */
export function subgraphSourceOverrides(declarer: string, start: string = declarer): SubgraphSourceOverrides {
  const checkout = checkoutRootFor(start);
  const out: SubgraphSourceOverrides = {};
  for (const root of [...new Set([resolve(declarer), checkout])]) {
    const cfg = readHarnessConfig(root)?.subgraphSources;
    if (cfg) Object.assign(out, SubgraphSourceOverridesSchema.parse(cfg));
  }
  return out;
}

/**
 * THE lookup a publisher, the KG export and a mount/push tool use: the
 * declared subgraph with this `id`, found from any instance in the checkout,
 * with its source resolved (config override → `source` → legacy `storage` →
 * `directory`).
 *
 * `start`'s own chain is asked first, so an instance redeclaring an inherited
 * id is answered with its own entry. Otherwise the checkout's instances are
 * searched for one whose OWN declaration carries the id. `undefined` when no
 * instance declares it; throws when several unrelated instances do, because
 * picking one would be a guess.
 */
export function declaredSubgraph(start: string, id: string): DeclaredSubgraph | undefined {
  const here = resolve(start);
  const graph = checkoutGraph(checkoutRootFor(here));
  const owners: string[] = [];
  const candidates = [here, ...graph.order.filter((r) => r !== here)];
  for (const root of candidates) {
    let decl: ReturnType<typeof readDeclaration>;
    try {
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    if (instanceDirectories(root, decl).some((d) => d.id === id)) owners.push(root);
    if (root === here && owners.length > 0) break;
  }
  if (owners.length === 0) return undefined;
  if (owners.length > 1 && owners[0] !== here) {
    throw new Error(`subgraph "${id}" is declared by ${owners.length} instances (${owners.join(", ")}) — ask from the one you mean`);
  }
  const instanceRoot = owners[0]!;
  const decl = readDeclaration(instanceRoot)!;
  const entry = resolveDirectories(chainIn(graph, instanceRoot)).find((d) => d.id === id && d.own)
    ?? resolveDirectories(declarationChain(instanceRoot)).find((d) => d.id === id)!;
  return {
    id,
    instanceRoot,
    instanceName: decl.name,
    ...(decl.repository ? { repository: decl.repository } : {}),
    entry,
    source: resolveSubgraphSource(entry, subgraphSourceOverrides(instanceRoot, here)),
  };
}

/**
 * Every `scope: "repository"` entry declared by an instance that is NOT the
 * checkout's root instance — a MIRROR, which the checkout-aggregates ruling
 * retired. Only the instance whose root IS the checkout may declare at the
 * checkout's scope: anything else naming a repository path is either another
 * instance's directory (the wrong-way arrow) or checkout-level state that
 * belongs to the root. Returned as `<instance>#<id>` so a finding names both.
 *
 * Checkout-level state a mounted platform instance declares for EVERY
 * checkout (cat-harness's `beans`, `todos`, ...) is not one: see the rooted
 * branch below (cat-harness-tools#1701).
 */
export function repositoryMirrors(start: string): string[] {
  const root = checkoutRootFor(start);
  const out: string[] = [];
  // THE INDEX CHECKOUT declares no instance of its own: it composes the ones
  // `index.config.json` lists, so THEY declare its checkout-level state —
  // cat-harness declares `beans/`, `fsh-guts/`, `todos/` and `issue-marks/`
  // since the state cutover (folio-assistant 8f55441e5). There a
  // repository-scoped entry is no mirror; two instances claiming the SAME
  // repository path is, and that is what is reported.
  if (safeDeclaration(root) === undefined) {
    const byPath = new Map<string, string[]>();
    for (const inst of layerRootsIn(root)) {
      let decl: ReturnType<typeof readDeclaration>;
      try {
        decl = readDeclaration(inst);
      } catch {
        continue;
      }
      for (const d of decl?.directories ?? []) {
        if (d.scope !== "repository") continue;
        const key = d.path.replace(/\/+$/, "");
        byPath.set(key, [...(byPath.get(key) ?? []), `${decl!.name}#${d.id}`]);
      }
    }
    for (const claims of byPath.values()) if (claims.length > 1) out.push(...claims);
    return out.sort();
  }
  // A ROOTED CHECKOUT (an IG repository that is its own index, e.g.
  // smart-ips-pilgrimage, cat-harness-tools#1701) mounts cat-harness too, and
  // gets the same checkout-level state the index does: cat-harness declares
  // `beans/`, `todos/`, `health`, ... "for every checkout", and `state:mount`
  // reads exactly those entries at this root (absent, or overridden by a root
  // declaration of the same id). Such an entry is no mirror. What still is:
  // a non-root entry whose path lies inside ANOTHER instance's directory (the
  // wrong-way arrow the ruling retired), or two non-root instances claiming
  // the same repository path. The root's own entries are its own and an
  // override, never a claim against these.
  const instances = layerRootsIn(root).map((r) => resolve(r));
  const others = instances.filter((r) => r !== root);
  const byPath = new Map<string, string[]>();
  for (const inst of others) {
    let decl: ReturnType<typeof readDeclaration>;
    try {
      decl = readDeclaration(inst);
    } catch {
      continue;
    }
    for (const d of decl?.directories ?? []) {
      if (d.scope !== "repository") continue;
      const claim = `${decl!.name}#${d.id}`;
      const abs = resolve(root, d.path);
      if (others.some((o) => abs === o || abs.startsWith(o + sep))) {
        out.push(claim);
        continue;
      }
      const key = d.path.replace(/\/+$/, "");
      byPath.set(key, [...(byPath.get(key) ?? []), claim]);
    }
  }
  for (const claims of byPath.values()) if (claims.length > 1) out.push(...claims);
  return out.sort();
}

/**
 * Create every directory this instance declares or inherits, if absent.
 *
 * THE ONE ANSWER for "which directories does an instance have", called by
 * every getting-started / instantiation path so there is not a second one
 * free to disagree. Discovery walks the dependency tree; creation happens in
 * `folioRoot` — an instance inherits the CONVENTION (an id and a relative
 * path), not a licence to write into a dependency's checkout.
 *
 * Returns what it did, so a caller can report it rather than guess. Idempotent.
 */
export function materialiseDeclaredDirectories(
  folioRoot: string,
  opts: { dryRun?: boolean } = {},
): MaterialisedDirectory[] {
  const dirs = resolveDirectories(declarationChain(folioRoot));
  return materialiseDirectories(dirs, folioRoot, opts);
}

/**
 * Every instance's knowledge-graph directories, in overlay order.
 *
 * Deepest dependency first, root last — so an agent loads them in order and a
 * later entry overrides an earlier one **for the same skill name**. The
 * directories themselves all stay: a dependency's skills and the root's are
 * both real.
 *
 * ## Read from the declaration, not from a literal
 *
 * This used to be `join(dep.rootPath, "skills")`. `AGENTS.md` is explicit that
 * *"hardcoding a path is how a skill goes missing the moment the layout
 * moves"*, and an instance may put its knowledge graph anywhere — in THIS
 * repository the declared id is `cat-harness` while the path is `skills/`,
 * which is exactly the id/path split the declaration exists to absorb.
 *
 * ## Why not `resolveDirectories`
 *
 * Because it answers a different question, and asking it this one silently
 * loses dependencies — it overrides **by id**, so a dependency and a root that
 * both declare `cat-harness` collapse to the root's entry alone. {@link
 * ownDirectories} resolves per instance instead, which is what an overlay
 * needs. That mismatch is the likeliest reason this function reached for a
 * literal in the first place, and why it sat with no caller.
 *
 * ## `provides` still opts a dependency out
 *
 * A dependency declaring `provides` without `"skills"` contributes none, and
 * that is kept deliberately: it is the only way an instance can depend on
 * another for content or translations without inheriting its skills.
 *
 * ## Its consumer, and the two call sites that are still wrong for the job
 *
 * `LOCAL_PACKAGES` in `src/tools/skill-fetch.ts` is built from this — so a
 * DEPENDENCY's skill packages are served, which is the overlay `AGENTS.md`
 * records as outstanding Phase 0.1 work.
 *
 * Two nearby call sites deliberately still do NOT use it, because each would
 * break in a specific way:
 *
 * 1. **`kgDirectories` in `scripts/known-skills.ts` composes IDS.** Its
 *    `path` field becomes a repo-relative skill id (`skillMdDirs`). Feeding a
 *    dependency's directory in would mint ids that look repo-relative but
 *    resolve into another checkout — wrong in a way that reads as correct.
 * 2. **`kgRoots(root)[0]` is taken as "the root's graph"** by
 *    `src/tools/workflow.ts` and `src/workflow/gate.ts`. Overlay order is
 *    deepest-dependency-FIRST, so making that function overlay-aware would
 *    hand those callers a dependency's role graph instead of the root's.
 */
export function resolveSkillDirs(folioRoot: string): string[] {
  const dirs: string[] = [];
  // OPT-IN SUB-GRAPHS (cat-harness#991 step 23.1): the FOLIO decides for every
  // instance it reads, so a dependency's switched-off `sdlc` adds no skills.
  const enabledSubgraphs = enabledSubgraphs_(folioRoot);
  const withOptIn = { enabledSubgraphs };
  /** The skill graphs an instance holds inside its switched-on opt-in sub-graphs — none while nothing is opt-in. */
  const optInSkills = (root: string): string[] =>
    resolveDirectories([{ name: "(local)", root, own: true }], undefined, withOptIn)
      .filter((d) => d.own && d.optInSubgraph !== undefined && isKgOnlyDirectory(d) && existsSync(d.absPath))
      .map((d) => d.absPath);

  for (const dep of orderedDependencies(folioRoot)) {
    if (dep.dependency.provides && !dep.dependency.provides.includes("skills")) {
      continue;
    }
    for (const d of ownDirectories({ name: dep.dependency.name, root: dep.rootPath }, undefined, withOptIn)) {
      if (isKgOnlyDirectory(d) && existsSync(d.absPath)) dirs.push(d.absPath);
    }
    dirs.push(...optInSkills(dep.rootPath));
  }

  // THE OTHER INSTANCES IN THIS CHECKOUT (bean `cmsl` step 3, issue #1694).
  // Until then `cat-harness.json` mirrored them with `scope: "repository"`, so
  // seven packages — the FHIR IG layer's two, core's, sci's `lean` and `data`,
  // large-datasets', the IRIS replica's — reached `skill_fetch` only through the
  // platform naming its dependents. The owner removed the mirrors; the
  // checkout answers instead. A folio in its own repository has no sibling
  // instances, so this adds nothing there.
  const own = new Set(
    ownDirectories({ name: "(root)", root: resolve(folioRoot), own: true }, undefined, withOptIn).map((d) => resolve(d.absPath)),
  );
  for (const d of checkoutDirectories(resolve(folioRoot), { stackedOn: resolve(folioRoot), enabledSubgraphs })) {
    if (own.has(resolve(d.absPath))) continue;
    if (isKgOnlyDirectory(d) && existsSync(d.absPath)) dirs.push(d.absPath);
  }

  // The root last, so its skills win on a name collision.
  for (const d of ownDirectories({ name: "(root)", root: resolve(folioRoot), own: true }, undefined, withOptIn)) {
    if (isKgOnlyDirectory(d) && existsSync(d.absPath)) dirs.push(d.absPath);
  }
  dirs.push(...optInSkills(resolve(folioRoot)));

  // De-duplicated: a diamond dependency reaches the same instance twice, and a
  // directory scanned twice reports every skill in it twice.
  return [...new Set(dirs)];
}

/**
 * Get the combined translation directories in overlay order.
 *
 * Returns absolute paths to translations/ directories, deepest
 * dependency first, root last.
 */
export function resolveTranslationDirs(folioRoot: string): string[] {
  const flat = orderedDependencies(folioRoot);
  const dirs: string[] = [];

  for (const dep of flat) {
    if (
      dep.dependency.provides &&
      !dep.dependency.provides.includes("translations")
    ) {
      continue;
    }
    const depConfig = dep.config;
    const transDir = depConfig?.translation?.translationDir ?? "translations";
    const abs = join(dep.rootPath, transDir);
    if (existsSync(abs)) dirs.push(abs);
  }

  // Root's translations last (highest priority)
  const rootConfig = readHarnessConfig(folioRoot);
  const rootTransDir = rootConfig?.translation?.translationDir ?? "translations";
  const rootAbs = join(folioRoot, rootTransDir);
  if (existsSync(rootAbs)) dirs.push(rootAbs);

  return dirs;
}

// ── Contribution loading (issue #223, Phase 0.1) ────────────────

/**
 * Walk the dependency tree and collect every dependency's contributions.
 *
 * Each dependency declares its block kinds, QA checkers, pipeline plugins and
 * content adapters as knowledge-graph nodes (bean riit), registered depth-first,
 * deepest dependency first — the same order {@link resolveSkillDirs} overlays
 * in, so a reader only has to learn one traversal.
 *
 * **Order is significant, and collisions still do not resolve by it.** That is
 * the deliberate shape of this mechanism: registration is cheap and familiar,
 * but a kind claimed twice throws rather than letting whoever loaded last
 * win. See `schemas/content/contributions.ts` for why last-writer-wins was refused.
 *
 * @param folioRoot - Absolute path to the ROOT folio.
 * @param registry - Optional existing registry to accumulate into.
 */
export interface ContributionSink<C extends { name: string }> {
  register(contribution: C): void;
  /**
   * Whether a DECLARED block-kind node of `adapter` is a contribution to this
   * sink (bean riit, step 3). `ContributionRegistry` answers no for a built-in
   * adapter, whose kinds the platform's code types and reads for every folio.
   * Asked here rather than decided by the loader, because the loader is
   * harness-layer and the built-in vocabulary is the content layer's.
   * Absent means every node is.
   */
  acceptsDeclaredKind?(adapter: string): boolean;
}

export async function loadContributions<C extends { name: string }, S extends ContributionSink<C>>(
  folioRoot: string,
  registry: S,
): Promise<S> {
  registerDeclaredContributions<C>(folioRoot, registry);
  return registry;
}

/**
 * {@link loadContributions}, synchronously.
 *
 * ## Why a second loader exists
 *
 * The generic pipeline reaches the science layer's code through slots that a
 * dependency fills (`pipeline/pipeline-plugins.ts`, bean `squu`), and
 * the callers of those slots are synchronous: a QA checker inside the sweep's
 * hot loop, a module-load side effect, a build step. Threading an awaited
 * registry through every one of them would change the checker signatures the
 * dispatch tables are keyed on. Bun's `require` loads a `.ts` module
 * synchronously — the same property `schemas/ui/theme-by-ref.ts` relies on.
 */
export function loadContributionsSync<C extends { name: string }, S extends ContributionSink<C>>(
  folioRoot: string,
  registry: S,
): S {
  registerDeclaredContributions<C>(folioRoot, registry);
  return registry;
}

/**
 * The CONTRIBUTED block kinds each dependency declares as `folio-block-kind/v1`
 * nodes in its `block-kinds/` graph (bean riit, step 3), registered as that
 * dependency's contribution. Owner, 2026-10-04: a folio sees the nodes of the
 * instances it depends on (option 1 of 3) — so this walks `orderedDependencies`,
 * and a kind reaches exactly the folios a `blockKinds` array returned from code
 * used to.
 *
 * A built-in adapter's nodes (the paper adapter's, in core and sci) are
 * skipped when the sink says so ({@link ContributionSink.acceptsDeclaredKind}):
 * the platform's code types them and `block-kinds.ts` reads them for every
 * folio, and registering them again would be refused as a redefinition.
 */
function registerDeclaredContributions<C extends { name: string }>(folioRoot: string, registry: ContributionSink<C>): void {
  for (const dep of orderedDependencies(folioRoot)) {
    const blockKinds: Record<string, unknown>[] = [];
    for (const { file, raw } of declaredNodesOf(dep.rootPath, "block-kinds")) {
      const parsed = BlockKindNodeSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`${file} is not a folio-block-kind/v1 node: ${parsed.error.message}`);
      const n = parsed.data;
      if (registry.acceptsDeclaredKind && !registry.acceptsDeclaredKind(n.adapter)) continue;
      blockKinds.push({
        kind: n.kind,
        adapter: n.adapter,
        builder: builderOf(n),
        labelPrefix: n.labelPrefix,
        folioType: n.folioType,
        ...(n.docoType ? { docoType: n.docoType } : {}),
      });
    }

    // QA checkers and pipeline plugins (bean riit, step 3b): the node names
    // the criterion or slot; its ref names the TABLE that holds the code,
    // relative to THIS dependency's root, keyed by that criterion or slot.
    const qaCheckers: Record<string, unknown>[] = [];
    for (const { file, raw } of declaredNodesOf(dep.rootPath, "qa-checkers")) {
      const parsed = QaCheckerNodeSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`${file} is not a folio-qa-checker/v1 node: ${parsed.error.message}`);
      const n = parsed.data;
      const { path } = splitOwnCodeRef(n.check);
      qaCheckers.push({ criterion: n.criterion, check: tableEntry(dep, file, n.check, n.criterion, "function"), sourceFile: path });
    }
    const pipelinePlugins: Record<string, unknown>[] = [];
    for (const { file, raw } of declaredNodesOf(dep.rootPath, "pipeline-plugins")) {
      const parsed = PipelinePluginNodeSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`${file} is not a folio-pipeline-plugin/v1 node: ${parsed.error.message}`);
      const n = parsed.data;
      pipelinePlugins.push({ kind: n.slot, implementation: tableEntry(dep, file, n.implementation, n.slot, "object") });
    }

    if (blockKinds.length + qaCheckers.length + pipelinePlugins.length > 0) {
      registry.register({
        name: dep.dependency.name,
        root: dep.rootPath,
        ...(blockKinds.length ? { blockKinds } : {}),
        ...(qaCheckers.length ? { qaCheckers } : {}),
        ...(pipelinePlugins.length ? { pipelinePlugins } : {}),
      } as unknown as C);
    }

    // Content-adapter vocabularies (bean riit, step 5). A TYPED one is the
    // platform's own and is read off the nodes at load, like a built-in
    // kind; an untyped one is what this dependency contributes, with its
    // companion roles and its vocabulary module. One registration each,
    // since a contribution carries one adapter.
    for (const { file, raw } of declaredNodesOf(dep.rootPath, "content-adapters")) {
      const parsed = ContentAdapterNodeSchema.safeParse(raw);
      if (!parsed.success) throw new Error(`${file} is not a folio-content-adapter/v1 node: ${parsed.error.message}`);
      const n = parsed.data;
      if (n.typed || (registry.acceptsDeclaredKind && !registry.acceptsDeclaredKind(n.adapter))) continue;
      registry.register({
        name: dep.dependency.name,
        root: dep.rootPath,
        adapter: { name: n.adapter, module: n.vocabulary ?? "", companionRoles: n.companionRoles },
      } as unknown as C);
    }
  }
}

/** Every `*.json` in every directory ONE instance declares with `graphTypology`, files sorted. */
function declaredNodesOf(root: string, graphTypology: string): { file: string; raw: unknown }[] {
  const out: { file: string; raw: unknown }[] = [];
  for (const dir of directoriesForGraph(root, graphTypology)) {
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue; // a declared-but-absent directory is `check:declared-dirs`' finding
    }
    for (const f of files) out.push({ file: join(dir, f), raw: JSON.parse(readFileSync(join(dir, f), "utf-8")) });
  }
  return out;
}

/**
 * `table[key]` from the module `ref` names, under `dep`'s root — loaded with
 * `require`, which Bun runs synchronously for `.ts` (the property
 * {@link loadContributionsSync} relies on), so one resolver serves both
 * loaders. A missing module, export or entry throws naming the node: a node
 * that names code which is not there is a contribution that appears wired
 * and is not.
 */
function tableEntry(dep: ResolvedDependency, nodeFile: string, ref: string, key: string, want: "function" | "object"): unknown {
  const { path, exportName } = splitOwnCodeRef(ref);
  const abs = resolve(dep.rootPath, path);
  if (!existsSync(abs)) throw new Error(`${nodeFile}: ${ref} — ${abs} does not exist`);
  // input-site: declared plugin-tables #f17e81a6 — own-code refs of declared qa-checkers / pipeline-plugins nodes, resolved from them at fingerprint time (`scripts/declared-imports.ts`); input-sites.test.ts holds the two to each other
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const table = (require(abs) as Record<string, unknown>)[exportName];
  if (typeof table !== "object" || table === null) throw new Error(`${nodeFile}: ${ref} exports no table named ${exportName}`);
  const entry = (table as Record<string, unknown>)[key];
  if (want === "function" ? typeof entry !== "function" : typeof entry !== "object" || entry === null) {
    throw new Error(`${nodeFile}: ${exportName} in ${path} has no ${want} entry for "${key}"`);
  }
  return entry;
}


// ── What a repository IS, closed under the dependency tree ──────────

/**
 * One type asserted somewhere in the dependency closure, and by whom.
 *
 * `by` is the dependency NAME that carried the marker, or `"(root)"`. It is
 * the field that makes the closure honest: "this repository is a DAK" and
 * "something this repository depends on is a DAK" are different claims, and a
 * flattened set cannot tell them apart.
 */
export interface ClosedContentType extends ContentTypeMembership {
  by: string;
  /** `true` when the marker is on the root itself rather than a dependency. */
  own: boolean;
}

export interface ClosedRepositoryDescription {
  types: ClosedContentType[];
  /**
   * Disagreements WITHIN one instance, each tagged with the instance.
   *
   * Deliberately not computed ACROSS instances. Two repositories naming
   * different `canonicalUrl`s is not a disagreement — it is two repositories,
   * and reporting it as a conflict would make every dependency tree look
   * broken. See {@link describeRepositoryClosure}.
   */
  disagreements: Array<ContentTypeDisagreement & { instance: string }>;
}

/**
 * Ask a repository what it is, INCLUDING what its dependencies are.
 *
 * `79t3`: *"The set is closed under the dependency tree. Resolving
 * dependencies yields a set of overlaying instances: declaring
 * `folio-assistant` implies `cat-harness`, because folio-assistant depends on
 * it."*
 *
 * ## Why it lives here and not beside `describeRepository`
 *
 * `schemas/content/content-type.ts` reads a root and nothing else, on purpose: the
 * dependency resolver lives in THIS module, and importing it there would make
 * the type registry depend on the thing that should depend on it. So closure
 * is composed at the layer that already owns the walk — `resolveInstanceGraph`
 * is above it — rather than the walk being pushed down.
 *
 * ## Membership is ATTRIBUTED, never merged
 *
 * The result is a list rather than a set, and every entry says which instance
 * carried the marker. A union would answer "is this tree a DAK?" and lose "is
 * THIS repository a DAK?", and those differ in the case the bean cites: a
 * folio depending on a WHO adapter is not itself a DAK.
 *
 * A type asserted by both the root and a dependency appears TWICE, with
 * different `by`. That is not a duplicate to collapse — it is two repositories
 * each making the claim, which is what the tree actually says.
 *
 * ## Disagreements stay INSIDE an instance
 *
 * Cross-instance facts are not compared. Two repositories declaring different
 * `canonicalUrl`s are two repositories, not a conflict, and reporting it as
 * one would make every non-trivial dependency tree look broken — the false
 * positive that would get the check switched off within a week.
 */
export function describeRepositoryClosure(
  folioRoot: string,
  registry?: ContentTypeRegistry,
): ClosedRepositoryDescription {
  const types: ClosedContentType[] = [];
  const disagreements: ClosedRepositoryDescription["disagreements"] = [];

  const visit = (root: string, by: string, own: boolean): void => {
    const d = describeRepository(root, registry);
    for (const t of d.types) types.push({ ...t, by, own });
    for (const x of d.disagreements) disagreements.push({ ...x, instance: by });
  };

  // Dependencies first, root last — the same depth-first order
  // `resolveSkillDirs` uses, so a reader comparing the two sees one traversal
  // rather than two conventions.
  for (const dep of orderedDependencies(folioRoot)) {
    visit(dep.rootPath, dep.dependency.name, false);
  }
  visit(resolve(folioRoot), "(root)", true);

  return { types, disagreements };
}

// Old names, kept so callers in other layers keep working while they move to
// the layer names (cat-harness#1138 P4). Remove once no layer imports them.
/** @deprecated Use {@link effectiveLayerConfig}. */
export const effectiveInstanceConfig = effectiveLayerConfig;
/** @deprecated Use {@link indexedLayerFor}. */
export const indexedInstanceFor = indexedLayerFor;
