/**
 * Contribution registry — what a folio-assistant *dependency* may add to the
 * root layer: block kinds, adapters and MCP tools, not only translations.
 *
 * ## Shape: load-time registration
 *
 * A dependency names a module in its `harness.config.json`:
 *
 * ```jsonc
 * { "contributes": "./contributions.ts" }
 * ```
 *
 * That module's default export is called as the root walks the dependency
 * tree, and returns what it adds. Load ORDER is therefore significant.
 *
 * **Collisions do not resolve by order.** A kind claimed by two contributors
 * throws, naming both, so `adapterForKind` stays unambiguous (as
 * `schemas/content/block-kinds.ts` requires).
 *
 * **The diamond is not a collision.** A depth-first walk can reach the same
 * dependency twice; registering the same contribution twice from the same
 * contributor is a no-op.
 *
 * The module lives in `schemas/` because it is about the content model;
 * under `src/` it would add a wrong-direction edge to
 * `bun run cat check:partition`.
 * MCP tool contributions are opaque registrar callbacks, so this module never
 * imports the MCP SDK.
 *
 * @module schemas/contributions
 * @graphNode schema
 */

import type { CheckerPaths, CheckerResult, CompanionRole } from "../sdlc/block-qa";
import {
  ADAPTER_BLOCK_KINDS,
  CONTENT_ADAPTERS,
  isBuiltInBuilder,
  type ContentAdapter,
} from "./block-kinds";

// ── What a dependency may contribute ────────────────────────────

/**
 * A block kind a dependency adds, and the adapter namespace that owns it.
 *
 * ## What a contributed kind carries, and why
 *
 * Until bean `1335` this was `kind` and `adapter` only, which was enough while
 * nothing contributed a kind. The first contributor — the WHO DAK layer, with the
 * `dak` adapter's 21 kinds — moved kinds that core used to declare itself, and
 * core's readers had been reading three more facts about each one out of core
 * tables. A contributed kind has to carry what a built-in one carries, or
 * moving it silently drops what the readers knew:
 *
 * | field | built-in source | read by |
 * |---|---|---|
 * | `builder` | `BUILDER_TO_KIND` in `block-kinds.ts` | manifest discovery (`readBlockManifest`) |
 * | `labelPrefix` | `KNOWN_LABEL_PREFIXES` / `KIND_PREFIXES` | prefix lists |
 * | `folioType`, `docoType` | `BLOCK_KIND_TO_FOLIO_TYPE` / `_DOCO_TYPE` | `typesForKind` (JSON-LD) |
 *
 * All optional, and only as far as a moved reader needs: a kind that omits
 * `builder` is built by a function of its own name, one that omits `docoType`
 * has no DoCO counterpart — which is a statement, the same one an absent
 * `BLOCK_KIND_TO_DOCO_TYPE` entry makes.
 */
export interface BlockKindContribution {
  /** The kind string as it appears in a block manifest, e.g. `"theorem"`. */
  kind: string;
  /** The adapter namespace claiming it. May be a new namespace. */
  adapter: string;
  /**
   * The builder function a manifest calls — `export default <builder>(…)`.
   * Absent means the kind's own name. A kebab-case kind needs one: a hyphen
   * is not a valid identifier.
   */
  builder?: string;
  /** The label prefix, without its colon — `"dt"` for `dt:anc-danger-signs`. */
  labelPrefix?: string;
  /** The folio class (`BLOCK_KIND_TO_FOLIO_TYPE`'s vocabulary) for a block of this kind, if any. */
  folioType?: string;
  /** The DoCO co-type, if the kind has one. Absent means it has none. */
  docoType?: string;
}

/** A content adapter a dependency provides. */
export interface AdapterContribution {
  /** Adapter name, e.g. `"paper"`. Must be unique across contributors. */
  name: string;
  /** Module specifier, resolved relative to the contributing folio's root. */
  module: string;
  /**
   * Which companion roles this adapter's blocks can have — the contributed
   * half of `ADAPTER_COMPANION_ROLES` in `schemas/sdlc/block-qa.ts`, which lists the
   * built-in adapters only. Read by `incompatibleCompanions`, so a criterion
   * scoped to a contributed adapter is checked against what that adapter's
   * blocks can actually carry. Absent means none are declared, and a
   * criterion depending on any companion then reports it as incompatible.
   */
  companionRoles?: CompanionRole[];
}

/**
 * An MCP tool group a dependency registers.
 *
 * `register` is called with the server once the root has built it. It is typed
 * `unknown` here on purpose — see the module note on why the MCP SDK type does
 * not belong in the content model.
 */
export interface ToolContribution {
  /** Stable identifier, e.g. `"lean"`. Unique across contributors. */
  name: string;
  register: (server: unknown) => void;
}

/** Everything one dependency adds. Returned by its `contributes` module. */
/**
 * A QA checker a dependency adds, keyed by the criterion it answers.
 *
 * The reason this exists: `pipeline/qa-sweep.ts` dispatched with
 *
 * ```ts
 * const checker = AUTOMATED_CHECKERS[id] ?? DAK_AUTOMATED_CHECKERS[id];
 * ```
 *
 * — the generic sweep naming one adapter's checker table. That is a
 * wrong-direction dependency (core → the DAK layer) and it does not generalise:
 * a third adapter means a third `??`, and a folio that brings its own criteria
 * has nowhere to put them at all.
 */
export interface QaCheckerContribution {
  /** The criterion id this answers. Must be a criterion the sweep knows. */
  criterion: string;
  /** The checker itself. */
  check: (paths: CheckerPaths) => CheckerResult;
  /**
   * The file that DEFINES `check`, relative to the contributor's own root.
   *
   * ## Why a function is not enough, and why this is required
   *
   * The sweep does not re-run a criterion whose verdict is still fresh, and
   * freshness is `script_hash` — `computeCriterionScriptHashes` reads the
   * bytes at the criterion's resolved source file and hashes the checker's
   * closure within them. A checker handed over as a bare function has no
   * bytes to hash, so its hash is `""`, and
   * `qa-criteria-registry.ts` records exactly what that costs:
   *
   * > a criterion pointed at a file that does not contain its checker NEVER
   * > INVALIDATES. Its verdicts stay "fresh" forever, and editing the real
   * > checker changes nothing.
   *
   * Eleven criteria were measured in that state on 2026-09-18, found only
   * because a fix to a checker did not change its verdict. A wrong `pass` is
   * believed; a verdict that cannot go stale is worse, because nothing about
   * it ever looks wrong.
   *
   * So it is **required**, not optional. Optional would make "no source file"
   * a state a contributor can enter by omission — which is the same state,
   * reached more quietly.
   *
   * ## Why relative to the CONTRIBUTOR's root
   *
   * A contributed checker lives in another repository, and
   * `computeCriterionScriptHashes` resolves against a single `repoRoot`. The
   * registry pairs this with the contributor's root, pinned by
   * `loadContributions` from the dependency entry rather than taken from the
   * module — the same reason `name` is pinned there. A relative path also
   * keeps the recorded `source_file` label portable across checkouts, which
   * is why that field is relative in the first place.
   */
  sourceFile: string;
}

/**
 * A render target: how a block becomes typeset output, and how to tell
 * whether that output is well-formed.
 *
 * ## Why the validator needs this and could not have it
 *
 * `validate.ts` Phase 3 is "AST validation (render → parse)" and it read:
 *
 * ```ts
 * const latex = renderBlock(block, mdContent);
 * const astResult = validateLatexAst(latex);
 * ```
 *
 * — the GENERIC validator rendering every block to LaTeX. On a document folio
 * that is a category error twice over: the document render path goes through
 * pandoc and `pipeline/render-markdown.ts`, and deliberately never
 * falls back to `latexmk`, so a "LaTeX AST" error there is raised against
 * output the folio will never produce. It is also a wrong-direction dependency
 * (core → sci), since the LaTeX renderer is the science layer's.
 *
 * ## `validate` is separate from `render` on purpose
 *
 * A renderer that produces output and a validator that judges it are different
 * obligations, and a target may honestly have only the first. `validate`
 * returning `undefined` means **could not determine**, and the validator must
 * report that as such — never as a pass. A render target with no structural
 * check is a real state (an HTML target whose well-formedness the browser
 * decides), and silently counting it as valid is how a folio acquires a clean
 * validation record over output nobody checked.
 */
export interface RendererContribution {
  /**
   * The output format this renders to — `latex`, `markdown`, `html`. One
   * contributor per format; two renderers for `latex` is a collision, not a
   * fallback chain.
   */
  format: string;
  /** Which content adapters this target applies to. */
  adapters: string[];
  /** Render one block's manifest plus its Markdown body to the target format. */
  render: (block: unknown, markdown: string) => string;
  /**
   * Structural check on rendered output. `undefined` means this target has no
   * structural check — reported as "not checked", never as a pass.
   */
  validate?: (rendered: string) => { valid: boolean; errors: string[] };
}

/**
 * An implementation a dependency plugs into a named slot of the GENERIC
 * pipeline — the way generic code reaches a higher layer's code without
 * importing it.
 *
 * ## Why this exists (bean `squu`, owner ruling 2026-10-01 ~18:15)
 *
 * The sci-bound pipeline files go straight to the science layer, which sits
 * above every generic layer. Before that `git mv` can happen, generic code must
 * stop importing them: a static import from a lower layer into sci is exactly
 * what `check:import-direction` rejects. A slot inverts the edge — the generic
 * caller names a KIND, the science layer registers what fills it, and neither
 * names the other's files.
 *
 * ## Why `implementation` is `unknown` here
 *
 * The same reason {@link ToolContribution.register} takes `unknown`: what a
 * slot holds is a pipeline concern (a Lean lexer, a LaTeX preflight), and the
 * content model should not import the pipeline's shapes. The typed view is
 * `pipeline/pipeline-plugins.ts`, which owns the kind → interface map
 * and is the only module that reads these.
 */
export interface PipelinePluginContribution {
  /** The slot this fills, e.g. `"lean-lexer"`. One contributor per kind. */
  kind: string;
  /** What fills it. Shape is fixed per kind by `pipeline/pipeline-plugins.ts`. */
  implementation: unknown;
}

export interface FolioContribution {
  /** The contributing layer's name, as declared in the dependency entry. */
  name: string;
  /**
   * The contributing layer's root directory, absolute.
   *
   * Pinned by `loadContributions` from the dependency entry, for the same
   * reason `name` is: a contributor that could name its own root could point
   * the sweep at bytes it does not own. Absent when nothing the contributor
   * supplies needs a file resolved — a contribution carrying `qaCheckers`
   * without it is refused.
   */
  root?: string;
  blockKinds?: BlockKindContribution[];
  adapter?: AdapterContribution;
  tools?: ToolContribution[];
  qaCheckers?: QaCheckerContribution[];
  renderers?: RendererContribution[];
  pipelinePlugins?: PipelinePluginContribution[];
}

/** Thrown when two contributors claim the same kind, adapter or tool name. */
export class ContributionCollisionError extends Error {
  constructor(
    readonly what: "kind" | "adapter" | "tool" | "checker" | "renderer" | "pipeline-plugin",
    readonly id: string,
    readonly incumbent: string,
    readonly challenger: string,
  ) {
    super(
      `${what} "${id}" is claimed by both "${incumbent}" and "${challenger}". ` +
        `Contributions do not resolve by load order — rename one, or have the ` +
        `two instances share a dependency that declares it once.`,
    );
    this.name = "ContributionCollisionError";
  }
}

// ── The registry ────────────────────────────────────────────────

/**
 * A registered checker, resolved: the function, and where its bytes live.
 *
 * `root` + `sourceFile` is what `computeCriterionScriptHashes` needs to read
 * and hash; `label` is what goes into the sidecar's `source_file`, which is
 * kept repo-relative-and-prefixed so a recorded verdict names its checker the
 * same way on every checkout.
 */
export interface ContributedChecker {
  check: (paths: CheckerPaths) => CheckerResult;
  /** Relative to `root`. */
  sourceFile: string;
  /** The contributor's own root, absolute. */
  root: string;
  /** `<contributor>/<sourceFile>` — portable, and says whose checker it is. */
  label: string;
}

interface KindEntry {
  adapter: string;
  contributor: string;
  builder: string;
  labelPrefix?: string;
  folioType?: string;
  docoType?: string;
}

/** What the registry knows about one contributed kind. */
export type ContributedKind = Readonly<Omit<KindEntry, "contributor">>;

/**
 * Accumulates contributions as the dependency tree is walked.
 *
 * Deliberately a layer rather than module-level state: tests, and a root
 * that resolves more than one folio in a process, must not leak registrations
 * into each other. Module-level mutable state is also how load order becomes
 * un-debuggable, which this shape is already paying enough for.
 */
export class ContributionRegistry {
  private kinds = new Map<string, KindEntry>();
  private adapters = new Map<
    string,
    { module: string; contributor: string; companionRoles?: readonly CompanionRole[] }
  >();
  private builders = new Map<string, string>();
  private toolGroups = new Map<string, { register: (server: unknown) => void; contributor: string }>();
  private checkers = new Map<string, ContributedChecker & { contributor: string }>();
  private renderers = new Map<string, { renderer: RendererContribution; contributor: string }>();
  private pipelinePlugins = new Map<string, { implementation: unknown; contributor: string }>();

  /**
   * Register one dependency's contribution.
   *
   * Idempotent per contributor: re-registering identical content from the same
   * contributor is a no-op, so a diamond dependency graph loads cleanly.
   * Registering the same identifier from a *different* contributor throws.
   */
  /** A declared node of a BUILT-IN adapter is the platform's own kind, not a contribution (bean riit, step 3). */
  acceptsDeclaredKind(adapter: string): boolean {
    return !(CONTENT_ADAPTERS as readonly string[]).includes(adapter);
  }

  register(contribution: FolioContribution): void {
    const who = contribution.name;

    for (const bk of contribution.blockKinds ?? []) {
      // A dependency may not redefine a kind the platform already owns.
      // Silently shadowing `theorem` would change what every existing folio
      // validates against, from a config file two repos away.
      const builtIn = CONTENT_ADAPTERS.find((a) => ADAPTER_BLOCK_KINDS[a].includes(bk.kind));
      if (builtIn) throw new ContributionCollisionError("kind", bk.kind, `platform (${builtIn})`, who);

      const existing = this.kinds.get(bk.kind);
      if (existing) {
        if (existing.contributor === who && existing.adapter === bk.adapter) continue; // diamond
        throw new ContributionCollisionError("kind", bk.kind, existing.contributor, who);
      }

      // The builder is what DISCOVERY matches on, so it is an identifier with
      // the same uniqueness obligation as the kind: a contributed builder equal
      // to a built-in one would make `export default <builder>(` mean two
      // kinds, and the one `kindForBuilder` returned would depend on which map
      // it asked first.
      const builder = bk.builder ?? bk.kind;
      if (isBuiltInBuilder(builder)) {
        throw new ContributionCollisionError("kind", `${bk.kind} (builder ${builder})`, "platform", who);
      }
      const builderOwner = this.builders.get(builder);
      if (builderOwner !== undefined) {
        const owner = this.kinds.get(builderOwner)?.contributor ?? "?";
        throw new ContributionCollisionError("kind", `${bk.kind} (builder ${builder})`, owner, who);
      }
      this.builders.set(builder, bk.kind);
      this.kinds.set(bk.kind, {
        adapter: bk.adapter,
        contributor: who,
        builder,
        labelPrefix: bk.labelPrefix,
        folioType: bk.folioType,
        docoType: bk.docoType,
      });
    }

    if (contribution.adapter) {
      const a = contribution.adapter;
      if (CONTENT_ADAPTERS.includes(a.name as ContentAdapter)) {
        throw new ContributionCollisionError("adapter", a.name, "platform", who);
      }
      const existing = this.adapters.get(a.name);
      if (existing && !(existing.contributor === who && existing.module === a.module)) {
        throw new ContributionCollisionError("adapter", a.name, existing.contributor, who);
      }
      this.adapters.set(a.name, {
        module: a.module,
        contributor: who,
        companionRoles: a.companionRoles,
      });
    }

    for (const t of contribution.tools ?? []) {
      const existing = this.toolGroups.get(t.name);
      if (existing) {
        if (existing.contributor === who) continue; // diamond
        throw new ContributionCollisionError("tool", t.name, existing.contributor, who);
      }
      this.toolGroups.set(t.name, { register: t.register, contributor: who });
    }

    for (const c of contribution.qaCheckers ?? []) {
      // A checker whose bytes cannot be located is a checker whose verdicts
      // can never go stale — see `QaCheckerContribution.sourceFile`. Refused
      // at registration, where the contributor is still named, rather than
      // discovered later as a criterion that simply stopped invalidating.
      if (!contribution.root) {
        throw new Error(
          `contributor "${who}" supplies qaCheckers but no root, so ` +
            `"${c.criterion}"'s source file cannot be resolved. A checker ` +
            `whose bytes cannot be read is freshness-hashed as "", and a ` +
            `verdict that can never go stale is worse than a wrong one.`,
        );
      }
      const existing = this.checkers.get(c.criterion);
      if (existing) {
        if (existing.contributor === who) continue; // diamond
        throw new ContributionCollisionError("checker", c.criterion, existing.contributor, who);
      }
      this.checkers.set(c.criterion, {
        check: c.check,
        sourceFile: c.sourceFile,
        root: contribution.root,
        contributor: who,
        label: `${who}/${c.sourceFile}`,
      });
    }

    for (const r of contribution.renderers ?? []) {
      const existing = this.renderers.get(r.format);
      if (existing) {
        if (existing.contributor === who) continue; // diamond
        throw new ContributionCollisionError("renderer", r.format, existing.contributor, who);
      }
      this.renderers.set(r.format, { renderer: r, contributor: who });
    }

    for (const p of contribution.pipelinePlugins ?? []) {
      // Same rule as every slot above: a second contributor for a kind is a
      // collision, never a fallback chain, so which Lean lexer the generic
      // pipeline runs cannot depend on the order dependencies are listed in.
      const existing = this.pipelinePlugins.get(p.kind);
      if (existing) {
        if (existing.contributor === who) continue; // diamond
        throw new ContributionCollisionError("pipeline-plugin", p.kind, existing.contributor, who);
      }
      this.pipelinePlugins.set(p.kind, { implementation: p.implementation, contributor: who });
    }
  }

  /**
   * The adapter owning a contributed kind, or `undefined`.
   *
   * Mirrors `adapterForKind`'s contract deliberately: `undefined` is never
   * defaulted to a guess. Callers wanting the composed answer should consult
   * `adapterForKind` first and fall back to this — see {@link composedKindOwner}.
   */
  kindOwner(kind: string): string | undefined {
    return this.kinds.get(kind)?.adapter;
  }

  /** Every contributed kind, with its adapter and contributor. */
  contributedKinds(): Array<{ kind: string; adapter: string; contributor: string }> {
    return [...this.kinds].map(([kind, e]) => ({ kind, adapter: e.adapter, contributor: e.contributor }));
  }

  /**
   * Everything the registry holds about one contributed kind — its builder,
   * label prefix and JSON-LD types — or `undefined` for a kind nobody
   * contributed. A built-in kind is `undefined` here too: ask core's tables.
   */
  kindEntry(kind: string): ContributedKind | undefined {
    const e = this.kinds.get(kind);
    if (!e) return undefined;
    const { contributor: _who, ...rest } = e;
    return rest;
  }

  /**
   * Contributed builder name → kind, for manifest discovery. Pass it to
   * `kindForBuilder` / `blockBuilderAlt` in `block-kinds.ts`, or as
   * `walkBlocks`' `contributedBuilders`.
   */
  contributedBuilders(): ReadonlyMap<string, string> {
    return new Map(this.builders);
  }

  /** Every contributed kind's label prefix, without its colon. */
  contributedLabelPrefixes(): string[] {
    return [...this.kinds.values()].flatMap((e) => (e.labelPrefix ? [e.labelPrefix] : []));
  }

  /**
   * The companion roles a contributed adapter's blocks can have, or
   * `undefined` when no contributor supplied that adapter.
   */
  adapterCompanionRoles(name: string): readonly CompanionRole[] | undefined {
    const a = this.adapters.get(name);
    return a ? (a.companionRoles ?? []) : undefined;
  }

  /** A contributed adapter's module specifier, or `undefined`. */
  adapterModule(name: string): string | undefined {
    return this.adapters.get(name)?.module;
  }

  /** Every contributed adapter name. */
  contributedAdapters(): string[] {
    return [...this.adapters.keys()];
  }

  /** Run every contributed tool registrar against the built server. */
  registerTools(server: unknown): void {
    for (const { register } of this.toolGroups.values()) register(server);
  }

  /**
   * The checker a dependency contributed for this criterion, or `undefined`.
   *
   * `undefined` is never defaulted to a pass: a criterion the sweep knows but
   * nobody implements is `needs-agent`, which is what the sweep already does
   * for its own unimplemented criteria.
   */
  qaChecker(criterion: string): ((paths: CheckerPaths) => CheckerResult) | undefined {
    return this.checkers.get(criterion)?.check;
  }

  /**
   * The same checker with everything freshness needs: where its bytes are, and
   * the portable label to record as `source_file`.
   *
   * Separate from {@link qaChecker} rather than replacing it, because a caller
   * that only RUNS a checker should not have to know where it came from —
   * and a caller that hashes one must not be able to forget.
   */
  qaCheckerEntry(criterion: string): ContributedChecker | undefined {
    const e = this.checkers.get(criterion);
    return e && { check: e.check, sourceFile: e.sourceFile, root: e.root, label: e.label };
  }

  /** Every contributed checker, with the criterion it answers and who added it. */
  contributedQaCheckers(): Array<{ criterion: string; contributor: string; label: string }> {
    return [...this.checkers].map(([criterion, e]) => ({
      criterion,
      contributor: e.contributor,
      label: e.label,
    }));
  }

  /** Every contributed tool group name. */
  contributedTools(): string[] {
    return [...this.toolGroups.keys()];
  }

  /**
   * The render targets that apply to one content adapter.
   *
   * An empty array is a determined empty — this adapter has no contributed
   * render target — and is not the same as the registry being absent. A caller
   * with no registry at all knows nothing; this caller knows there is nothing.
   */
  renderersFor(adapter: string): RendererContribution[] {
    return [...this.renderers.values()]
      .filter((e) => e.renderer.adapters.includes(adapter))
      .map((e) => e.renderer);
  }

  /** A contributed render target by format, or `undefined`. */
  renderer(format: string): RendererContribution | undefined {
    return this.renderers.get(format)?.renderer;
  }

  /**
   * What fills a pipeline slot, or `undefined` when no contributor did.
   *
   * Untyped on purpose — see {@link PipelinePluginContribution}. Read it
   * through `pipeline/pipeline-plugins.ts`, which types the kind and
   * turns `undefined` into an error that names what is missing.
   */
  pipelinePlugin(kind: string): unknown {
    return this.pipelinePlugins.get(kind)?.implementation;
  }

  /** Every filled pipeline slot, with who filled it. */
  contributedPipelinePlugins(): Array<{ kind: string; contributor: string }> {
    return [...this.pipelinePlugins].map(([kind, e]) => ({ kind, contributor: e.contributor }));
  }

  /** Every contributed render target, with its format and who added it. */
  contributedRenderers(): Array<{ format: string; adapters: string[]; contributor: string }> {
    return [...this.renderers].map(([format, e]) => ({
      format,
      adapters: e.renderer.adapters,
      contributor: e.contributor,
    }));
  }
}

/**
 * The adapter owning a kind, consulting the platform first and the registry
 * second.
 *
 * The order matters and is not arbitrary: a platform kind can never be
 * overridden (`register` refuses one outright), so checking the platform first
 * makes that guarantee visible at the read site as well as the write site.
 */
export function composedKindOwner(
  kind: string,
  registry: ContributionRegistry | undefined,
  builtIn: (k: string) => string | undefined,
): string | undefined {
  return builtIn(kind) ?? registry?.kindOwner(kind);
}
