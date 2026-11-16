/**
 * The block kinds, as a runtime value — in a leaf module so anything can
 * read it.
 *
 * It must not live in `types.ts`: `types.ts` imports schemas from
 * `constraints.ts` at module scope, so `constraints.ts` could not import back
 * without a runtime cycle. This module imports only leaves (the filesystem
 * scan, the node schema, and `types.ts` for a TYPE, which is erased). No list
 * of kinds is written out anywhere: the kinds are DISCOVERED from the
 * `block-kinds/` graphs their owning harnesses declare.
 *
 * `types.ts` re-exports `BLOCK_KINDS` and `BlockKind`. `BlockKind` IS
 * `Block["kind"]`, and the runtime check (every typed kind discovered, every
 * discovered kind typed) is `block-kind-nodes.test.ts`.
 *
 * @module schemas/block-kinds
 * @graphNode schema
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BlockKindNodeSchema, builderOf, type BlockKindNode } from "../kg/block-kind-node";
import { ContentAdapterNodeSchema, type ContentAdapterNode } from "../kg/content-adapter-node";
import { declaredNodeFiles } from "../kg/declared-nodes";
import type { Block } from "../types";

/**
 * Every block kind, as a RUNTIME value — DISCOVERED, not listed.
 *
 * Owner, 2026-10-04: *"kinds need to be discoverable … not centrally
 * managed"* (bean riit, step 2; sod4 finding #1). Each kind is a
 * `folio-block-kind/v1` node in a `block-kinds/` graph its OWNING harness
 * declares — document kinds in the content core, the math kinds in
 * the science layer — and this module scans every layer's declaration
 * for them. Adding a kind is adding a node; nothing here changes.
 *
 * Why a runtime list matters at all: `Block` is a type and is erased, so
 * anything that recognises a block by reading its source needs a list it can
 * iterate. Seven such lists existed, hand-maintained and independent, and
 * every one was short — on the qou corpus 461 blocks (445 `table`, 16
 * `algorithm`) were never yielded, swept or audited, excluded by a stale
 * regex rather than by any decision. Seven tables kept in step by hand were
 * the same defect in a wider form, which is what one node per kind removes.
 *
 * Sorted by kind, so the order is a property of the set and not of which
 * layer was scanned first.
 */
export function discoverBlockKinds(repoRoot: string = PLATFORM_ROOT): BlockKindNode[] {
  const byKind = new Map<string, { file: string; node: BlockKindNode }>();
  for (const { file, raw } of declaredNodeFiles(repoRoot, "block-kinds")) {
    const parsed = BlockKindNodeSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`${file} is not a folio-block-kind/v1 node: ${parsed.error.message}`);
    const prior = byKind.get(parsed.data.kind);
    if (prior) throw new Error(`block kind "${parsed.data.kind}" is declared twice: ${prior.file} and ${file}`);
    byKind.set(parsed.data.kind, { file, node: parsed.data });
  }
  // NONE is legitimate for the harness alone, as for content adapters below.
  return [...byKind.values()].map((v) => v.node).sort((a, b) => a.kind.localeCompare(b.kind));
}

/** The platform checkout this module sits in — where its layers are scanned from. */
const PLATFORM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Every content-adapter VOCABULARY node in the platform checkout, sorted by
 * name: one `folio-content-adapter/v1` node per vocabulary, in the
 * `content-adapters/` graph of the harness that owns it (bean riit, step 5;
 * owner 2026-10-05, option 1). Two nodes naming one vocabulary throw; finding
 * none does not, since the harness alone owns no vocabulary.
 */
export function discoverContentAdapters(repoRoot: string = PLATFORM_ROOT): ContentAdapterNode[] {
  return discoverContentAdapterFiles(repoRoot).map((v) => v.node);
}

/**
 * {@link discoverContentAdapters} with the file each node was read from, which
 * a vocabulary's `vocabulary` module is resolved against
 * (`vocabulary-modules.ts`).
 */
export function discoverContentAdapterFiles(repoRoot: string = PLATFORM_ROOT): { file: string; node: ContentAdapterNode }[] {
  const byName = new Map<string, { file: string; node: ContentAdapterNode }>();
  for (const { file, raw } of declaredNodeFiles(repoRoot, "content-adapters")) {
    const parsed = ContentAdapterNodeSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`${file} is not a folio-content-adapter/v1 node: ${parsed.error.message}`);
    const prior = byName.get(parsed.data.adapter);
    if (prior) throw new Error(`content adapter "${parsed.data.adapter}" is declared twice: ${prior.file} and ${file}`);
    byName.set(parsed.data.adapter, { file, node: parsed.data });
  }
  // NONE is a legitimate answer: the harness on its own declares no
  // vocabulary, and it must still load (bean `zmdo`: generic tools only).
  // What would make "none" a lie is caught elsewhere — a malformed node throws
  // above, and a declared directory that is missing is check:declared-dirs'.
  return [...byName.values()].sort((a, b) => a.node.adapter.localeCompare(b.node.adapter));
}

/** Every discovered content-adapter node, typed or contributed. */
export const CONTENT_ADAPTER_NODES: readonly ContentAdapterNode[] = discoverContentAdapters();

/**
 * A typed content-adapter VOCABULARY's name, as its node declares it.
 *
 * A string, not a union of names (bean `bzwk`, owner 2026-10-12, option B):
 * the vocabularies are declared by the layers ABOVE this one — core's
 * `document`, sci's `mathpaper` — and a harness type that spelled their names
 * would be the lower layer naming the higher. What the code types is the
 * KINDS (`Block` in `types.ts` is a union over kind interfaces, whatever their
 * adapter); which adapter a kind belongs to is data, read off its node.
 */
export type ContentAdapter = string;

/**
 * The BUILT-IN content adapters: the vocabularies whose node says `typed`.
 * Derived here, ahead of block-kind discovery, because that is split by it:
 * see {@link BLOCK_KIND_NODES}. Its full rationale is on the adapter-scoping
 * section below.
 */
export const CONTENT_ADAPTERS = CONTENT_ADAPTER_NODES.filter((n) => n.typed).map((n) => n.adapter) as readonly ContentAdapter[];

/** Every discovered block-kind node in the platform checkout, built-in or contributed, sorted by kind. */
export const DISCOVERED_BLOCK_KIND_NODES: readonly BlockKindNode[] = discoverBlockKinds();

/**
 * The BUILT-IN kinds' nodes: those of an adapter the platform's code types
 * ({@link CONTENT_ADAPTERS}). A contributed adapter's kinds (the DAK layer's
 * `dak`) are discovered too, but reach a folio only through its dependency
 * tree — owner, 2026-10-04: a folio sees the nodes of the layers it depends
 * on (option 1 of 3) — so `loadContributions` registers them per folio, and
 * nothing read off THIS list names them.
 */
export const BLOCK_KIND_NODES: readonly BlockKindNode[] = DISCOVERED_BLOCK_KIND_NODES.filter((n) =>
  (CONTENT_ADAPTERS as readonly string[]).includes(n.adapter),
);

/**
 * A typed vocabulary's kinds nest into the two content profiles, so each must
 * say which side it is on and how it is headed. A CONTRIBUTED adapter's kind
 * (the DAK layer's `dak`) is in no profile and is headed by its title-cased name
 * unless its node says otherwise.
 *
 * Checked here, against the DISCOVERED typed adapters, rather than in the node
 * schema: the schema cannot know which adapters are typed, and it used to
 * stand in for that by naming one (`adapter !== "paper"`), which stopped being
 * true when the vocabulary split by layer (bean `bzwk`).
 */
for (const n of BLOCK_KIND_NODES) {
  for (const f of ["profile", "heading", "headingPlural"] as const) {
    if (n[f] === undefined) throw new Error(`block kind "${n.kind}" of typed adapter "${n.adapter}" must declare \`${f}\``);
  }
}

const NODE_OF: ReadonlyMap<string, BlockKindNode> = new Map(BLOCK_KIND_NODES.map((n) => [n.kind, n]));

/** The discovered node for `kind`, or `undefined` for a kind no layer declares. */
export function blockKindNode(kind: string): BlockKindNode | undefined {
  return NODE_OF.get(kind);
}

/**
 * The kinds the `Block` union types. A type, so it comes from the TYPED
 * interfaces in `types.ts` (a type-only import, erased at runtime, so no
 * cycle) rather than from a list; `block-kind-nodes.test.ts` asserts every
 * typed kind is discovered and every discovered kind is typed.
 */
export type BlockKind = Block["kind"];

/** Every discovered kind. Typed as a non-empty tuple so `z.enum` accepts it. */
export const BLOCK_KINDS = BLOCK_KIND_NODES.map((n) => n.kind) as unknown as readonly [BlockKind, ...BlockKind[]];

/**
 * `BLOCK_KINDS` as a regex alternation, for the several places that
 * identify a block by scanning its `.ts` source for the builder call.
 *
 * Those call sites need different surrounding patterns — anchored vs
 * not, `export default` required or optional, followed by `(` or by
 * `({` — so they build their own regex around this rather than sharing
 * one. What they must NOT do is spell out the alternation, which is how
 * five of them came to list 13 of the 15 kinds.
 */
export const BLOCK_KIND_ALT = BLOCK_KINDS.join("|");

// ── Adapter scoping ──────────────────────────────────────────────

/**
 * The content adapters a folio can hold.
 *
 * `harness.config.json` already carries `contentType` and `adapter`, and the
 * platform ships `adapters/paper/`. This names the dimension so that block
 * kinds and QA criteria can be scoped to it instead of living in one global
 * pool.
 *
 * These are the BUILT-IN adapters only. `dak` was listed here until bean
 * `1335`; it is the DAK layer's now, contributed through
 * `ContributionRegistry` like any adapter a harness adds, and
 * `register` refuses a contribution that names a built-in one — which is what
 * made narrowing this list safe rather than a collision waiting to happen.
 * Where a criterion or a reader needs to name a contributed adapter, it uses
 * a plain string (`QaCriterionDefinition.adapters`), because a content type is
 * data and not an import.
 */
// `CONTENT_ADAPTERS` is declared above, before discovery reads it.

// ── Content profiles ─────────────────────────────────────────────

/**
 * The **profiles** of the `paper` adapter's vocabulary.
 *
 * A profile is a *restriction* of one adapter's kind set, and is a different
 * axis from {@link CONTENT_ADAPTERS} — which is a disjoint partition of
 * namespaces. Getting those two confused is easy and costly, so the
 * distinction is worth stating plainly:
 *
 * | | adapter | profile |
 * |---|---|---|
 * | relation between members | disjoint | nested |
 * | a kind belongs to | exactly one | one or more |
 * | answers | "whose vocabulary is this word from?" | "may *this* folio use it?" |
 * | consumed by | QA criterion scoping ({@link adapterForKind}) | folio validation ({@link kindsOutsideProfile}) |
 *
 * `adapterForKind` therefore stays total and unambiguous: every kind below is
 * still a `paper` kind, and no QA criterion's scope changes because a profile
 * exists. A DAK kind is in no profile at all — it is a different adapter, not
 * a narrower paper.
 *
 * ## Why the split is where it is
 *
 * A *document* is the general case: policy guidance, a report, a standard, a
 * chapter of prose with tables and figures. A *paper* is that plus blocks
 * whose assertion is a formal mathematical claim, carried by a `.lean`
 * sibling. That is the whole difference — the tree of chapters and sections,
 * the `uses[]` editorial graph, QA sidecars, the HCI validation gate and the
 * publication pipeline are common to both, which is why they are one adapter
 * with two profiles rather than two adapters.
 *
 * The dividing line is machine-checkable at its sharpest point: `definition`
 * is the one kind whose `lean` field is **required** rather than optional
 * (`DefinitionBlock.lean: LeanRef` in `types.ts`), so a document folio cannot
 * contain one without failing schema validation. A test pins that, so the
 * partition cannot drift away from the type that motivates it.
 *
 * The theorem-like kinds join it for a reason that is editorial rather than
 * structural: their `lean` is optional, so a document *could* hold a
 * `theorem` with no formalization — but a theorem whose proof nothing checks
 * is the failure mode the paper profile exists to prevent, and offering the
 * kind in a folio with no Lean toolchain invites exactly that. `example`,
 * `remark`, `algorithm` and `proof`-free prose keep their optional `lean` and
 * stay in the document profile; a document folio simply never populates it,
 * which {@link DOCUMENT_FORBIDS_LEAN} states and validation enforces.
 */
export const CONTENT_PROFILES = ["document", "paper"] as const;
export type ContentProfile = (typeof CONTENT_PROFILES)[number];

// ── The third and fourth axes ────────────────────────────────────
//
// Issue #764 §1 tabulates THREE axes and warns that conflating any two is the
// defect; the owner then settled a fourth on 2026-09-22 (O1). All four are
// declared here, together, because the thing a reader most needs is to see
// that they ARE different questions:
//
//   adapter        whose vocabulary is this word from?      DISJOINT
//   profile        may THIS folio use that word?            NESTED
//   visualiser     how is it shown, and what can be done?   NOT HERE
//   interactivity  is the content static or interactive?    CROSS-CUTTING
//
// THREE OF THE FOUR LIVE HERE, and the fourth's absence is the point rather
// than an oversight. `VISUALISER_KINDS` is declared in `cat-harness.ts`,
// because the owner's sentence is *"folio is the only visualizer provided by
// CAT-HARNESS"* — a visualiser is something the HARNESS provides, while an
// adapter, a profile and an interactivity are facts about CONTENT.
//
// `check:partition` is what settled it: this module is folio-assist-core and
// `cat-harness.ts` is agentic-harness, so the harness may not import the
// content vocabulary. The first draft put all four here and the gate refused
// the edge. Reading the refusal as a classification error rather than an
// obstacle is what produced the better placement.
//
// `where-does-this-go` rows 6 and 7 exist because the middle two read as one
// question and are not. Splitting these four across four files would make
// that confusion cheaper rather than dearer.

/**
 * Is this content static, or does it carry interfaces?
 *
 * Owner, 2026-09-21: *"webpages not necc static contnet, content with
 * interfaces"*, and *"not a 'pure' distinction. judgement"*. Settled as a
 * FOURTH AXIS on 2026-09-22 (issue #764, O1).
 *
 * ## Why not a profile, which is what it looks like
 *
 * Profiles NEST and only ever narrow — `document` ⊃ `paper`, and
 * `profile-check.ts` rests on that. "A document plus interfaces" is a
 * WIDENING, so expressing it as a profile would mean breaking the invariant
 * every profile check is written against. It is not an adapter either:
 * adapters partition by VOCABULARY, and a webpage's words come from the same
 * vocabulary as a document's.
 *
 * ## `undetermined` is a VALUE, and that is the whole point
 *
 * The owner ruled in advance that the boundary is judgement. So the axis has
 * to be able to say **could not determine** — reported, never resolved to a
 * default — and a profile has nowhere to put that.
 *
 * It is a value rather than merely an absent field because ABSENT and
 * UNDETERMINED are different answers, the same distinction
 * {@link CatHarnessDeclaration.needs} already draws:
 *
 *   absent          nobody has said
 *   "undetermined"  somebody looked and could not decide
 *
 * Folding the second into the first loses exactly the fact the owner asked
 * to be kept. A consumer that treats either as `static` is reading a
 * could-not-determine as clean, which this repository forbids everywhere
 * else and forbids here for the same reason.
 */
export const CONTENT_INTERACTIVITY = ["static", "interactive", "undetermined"] as const;
export type ContentInteractivity = (typeof CONTENT_INTERACTIVITY)[number];


/**
 * The kinds whose assertion *is* a formal mathematical claim.
 *
 * The criterion ("the block asserts mathematics") is a judgement about
 * meaning that no field on the TYPE exposes, so it is a field on each NODE:
 * `profile: "paper"`, the narrowest profile admitting the kind. `profile` is a
 * required two-valued field, so this and {@link DOCUMENT_BLOCK_KINDS} can
 * never overlap or leave a kind unclassified.
 */
export const MATH_BLOCK_KINDS: readonly string[] = BLOCK_KIND_NODES.filter((n) => n.profile === "paper").map((n) => n.kind);

/**
 * A math kind. A string, not a {@link BlockKind}: the math kinds are typed by
 * the science layer's vocabulary module, not by cat-harness's `Block`
 * (owner, 2026-10-22), so no type here names them.
 */
export type MathBlockKind = string;

/**
 * Everything a document folio may contain: the paper vocabulary minus
 * {@link MATH_BLOCK_KINDS}.
 *
 * Every node whose `profile` is `document`. A new kind's author must say which
 * (the field is required); `document` is the permissive answer, which is the opposite of the choice made for
 * QA criterion scoping — deliberately. A criterion misfiring on a kind it was
 * never written for reads as a real finding and wastes a reviewer; a new kind
 * being *offerable* in a document folio at worst offers something nobody
 * wants, and the profile test names every member so the classification is
 * reviewed rather than inherited silently.
 */
export const DOCUMENT_BLOCK_KINDS: readonly BlockKind[] = BLOCK_KIND_NODES.filter((n) => n.profile === "document").map(
  (n) => n.kind as BlockKind,
);

/** A document kind; see {@link MathBlockKind} for why it is not narrower. */
export type DocumentBlockKind = BlockKind;

/** Which kinds each profile admits. */
export const PROFILE_BLOCK_KINDS: Record<ContentProfile, readonly BlockKind[]> = {
  document: DOCUMENT_BLOCK_KINDS,
  paper: [...BLOCK_KINDS],
};

/**
 * Whether a document folio may carry a `lean` field on a block at all.
 *
 * `false`, and stated as a named constant rather than left implicit, because
 * the kinds a document keeps (`example`, `remark`, `algorithm`, `simulator`)
 * still *declare* an optional `lean` — the type permits what the profile
 * forbids. Validation reads this; without it the rule would live only in
 * whichever checker happened to implement it.
 */
export const DOCUMENT_FORBIDS_LEAN = true;

/** Does `profile` admit blocks of `kind`? Unknown kinds are never admitted. */
export function profileAcceptsKind(profile: ContentProfile, kind: string): boolean {
  return (PROFILE_BLOCK_KINDS[profile] as readonly string[]).includes(kind);
}

/**
 * The kinds in `kinds` that `profile` does not admit, de-duplicated and in
 * the profile-independent order of `BLOCK_KINDS`.
 *
 * Returns unknown kinds too: a folio holding a kind no adapter recognises is
 * a finding whichever profile it declares, and swallowing it here is how it
 * would reach a renderer instead of a validator.
 */
export function kindsOutsideProfile(
  profile: ContentProfile,
  kinds: readonly string[],
): string[] {
  const seen = new Set(kinds.filter((k) => !profileAcceptsKind(profile, k)));
  const known = (BLOCK_KINDS as readonly string[]).filter((k) => seen.has(k));
  const unknown = [...seen].filter((k) => !(BLOCK_KINDS as readonly string[]).includes(k)).sort();
  return [...known, ...unknown];
}

/**
 * The profile a folio declares, from its `harness.config.json` `contentType`.
 *
 * `paper` is the fallback for an unrecognised or absent value, which is the
 * safe direction here and only here: the paper profile is the *wider* set, so
 * a misconfigured folio is never told a block it legitimately contains is
 * forbidden. The narrower default would reject real content on a typo.
 */
export function profileForContentType(contentType: string | undefined): ContentProfile {
  return contentType === "document" ? "document" : "paper";
}

// ── Every kind: built in, and contributed ────────────────────────
//
// The `dak` adapter's 21 kinds, their builder names and label prefixes, and
// the WHO DAK component tables were declared HERE until bean `1335`. They live
// in the DAK layer's `schemas/dak-kinds.ts` now and reach core by registration:
// that layer declares the adapter and its kinds as nodes (bean riit, steps 3
// and 5), and `loadContributions` hands them to a `ContributionRegistry`.
//
// So everything below answers for the BUILT-IN vocabulary — what core owns —
// and a question about "every kind, including contributed ones" is a runtime
// question asked of a registry. A runtime contribution cannot feed a
// compile-time union, which is why `AnyBlockKind` and `DakBlockKind` are gone
// rather than widened: the compile-time types narrow to what core owns.

/**
 * Every BUILT-IN kind, of every typed adapter. Contributed kinds are not here
 * — ask the registry (`ContributionRegistry.contributedKinds()`).
 */
export const ALL_BLOCK_KINDS = [...BLOCK_KINDS] as const;

/**
 * Which kinds belong to which BUILT-IN adapter, read off the nodes. There is
 * more than one since bean `bzwk` (core's `document`, sci's `mathpaper`), and
 * a folio may hold kinds of several (owner, 2026-10-12).
 */
export const ADAPTER_BLOCK_KINDS: Record<ContentAdapter, readonly string[]> = Object.fromEntries(
  CONTENT_ADAPTERS.map((a) => [a, BLOCK_KIND_NODES.filter((n) => n.adapter === a).map((n) => n.kind)]),
);

const KIND_TO_ADAPTER: ReadonlyMap<string, ContentAdapter> = new Map(BLOCK_KIND_NODES.map((n) => [n.kind, n.adapter]));

/**
 * The BUILT-IN adapter a block kind belongs to, or `undefined` for a kind core
 * does not own.
 *
 * `undefined` is deliberately not defaulted to `"paper"`. A criterion that
 * silently treats an unrecognised kind as a paper block is how a math axis
 * would come to run against a ValueSet — the caller must decide what an
 * unknown kind means rather than inherit a guess.
 *
 * A CONTRIBUTED kind is also `undefined` here. A caller holding a registry
 * asks `composedKindOwner(kind, registry, adapterForKind)` in
 * `schemas/content/contributions.ts`, which consults this first and the registry
 * second.
 */
export function adapterForKind(kind: string): ContentAdapter | undefined {
  return KIND_TO_ADAPTER.get(kind);
}

/**
 * Builder name → kind, for the BUILT-IN kinds.
 *
 * Paper kinds are single lowercase words, so builder name and kind string are
 * the same token. A contributed kind may differ — a DAK kind is multi-word
 * (`decision-table`), a hyphen is not a valid identifier, so its builder is
 * `decisionTable` — which is why a contribution carries its builder name and
 * this map is never derived by string munging.
 */
const BUILDER_TO_KIND: ReadonlyMap<string, string> = new Map(
  BLOCK_KIND_NODES.map((n) => [builderOf(n), n.kind] as [string, string]),
);

/** Is `builder` the name of a BUILT-IN kind's builder? */
export function isBuiltInBuilder(builder: string): boolean {
  return BUILDER_TO_KIND.has(builder);
}

/**
 * The block kind a builder name introduces, or `undefined` if it is not one.
 *
 * `contributed` maps a CONTRIBUTED builder to its kind —
 * `ContributionRegistry.contributedBuilders()`. Built-ins are consulted first,
 * so a contributed builder can never shadow one; `register` refuses that
 * collision outright as well.
 */
export function kindForBuilder(
  builder: string,
  contributed?: ReadonlyMap<string, string>,
): string | undefined {
  return BUILDER_TO_KIND.get(builder) ?? contributed?.get(builder);
}

/**
 * Builder names as a regex alternation, for the places that recognise a block
 * manifest by scanning its source. Longest first, so a longer builder is not
 * shadowed by a shorter prefix of it.
 *
 * `contributed` adds a registry's builders (the keys of
 * `ContributionRegistry.contributedBuilders()`); without it the alternation is
 * the built-in builders only, which is {@link ALL_BLOCK_BUILDER_ALT}.
 */
export function blockBuilderAlt(contributed?: Iterable<string>): string {
  return [...new Set([...BUILDER_TO_KIND.keys(), ...(contributed ?? [])])]
    .sort((a, b) => b.length - a.length)
    .join("|");
}

/** {@link blockBuilderAlt} over the BUILT-IN builders. */
export const ALL_BLOCK_BUILDER_ALT = blockBuilderAlt();
