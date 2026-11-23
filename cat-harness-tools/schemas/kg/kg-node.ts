/**
 * The two labels every knowledge-graph node may carry.
 *
 * A node here is anything the graph names: a declared directory, a role, an
 * actor, a bean-graph node, a skill, a process. **`title` is what a reader
 * sees, `description` is the sentence under it** — one spelling for every
 * node type. Both optional in general; a node type may require either, and
 * `kg-audit` reports a role with no narrative.
 *
 * ## `title` is not `id`, and not `name`
 *
 * `id` is the handle other nodes reference. `name` — where a node still has one
 * — is the layer's own identifier, the thing `harness.json` calls
 * `folio-assistant` and publishes artefacts under. `title` is display text,
 * may contain punctuation an identifier could not, and is **translatable**.
 * `C@T Harness` is a title; `cat-harness` is a name.
 *
 * **The default is no title.** {@link displayTitle} falls back to `name`, so
 * a layer whose display text should match its repository omits `title`
 * rather than repeating `name`.
 *
 * ## Translatable means extractable
 *
 * {@link KG_NODE_LABEL_FIELDS} is the list a translation extractor reads.
 * Nothing else in a KG declaration is offered for translation: an id, a path
 * or a graph typology is structure, and translating structure is how a
 * reference goes dangling — the same rule `bpmn-translate.ts` follows.
 *
 * @module schemas/kg-node
 * @graphNode schema
 */

import { z } from "zod";
import { RepoFullNameSchema } from "./repo-full-name.js";

/** The fields a translation pass may offer, in the order a reader meets them. */
export const KG_NODE_LABEL_FIELDS = ["title", "description"] as const;
export type KgNodeLabelField = (typeof KG_NODE_LABEL_FIELDS)[number];

/** What a reader sees, and the sentence under it. */
export interface KgNodeLabels {
  /** Display text. Translatable. Falls back to the node's `name`, then its `id`. */
  title?: string;
  /** One or two sentences. Translatable. */
  description?: string;
}

/**
 * The label fields, as a Zod shape to spread into a node's own object.
 *
 * Spread rather than `.merge()`d so a node type can override either — a role
 * requires both, and saying so should not mean restating the field.
 */
export const kgNodeLabelShape = {
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
};

/**
 * What to print for a node: its title, else its name, else its id.
 *
 * Never returns an empty string for a node that has an id, because a blank
 * label in a sidebar or a table reads as a bug in the renderer rather than as a
 * missing field in the data.
 */
export function displayTitle(node: { id?: string; name?: string; title?: string }): string {
  return node.title || node.name || node.id || "";
}

// ── Images ──────────────────────────────────────────────────────

/**
 * An image the graph names.
 *
 * A mark is not decoration bolted onto a config file — it is a node, with an
 * id other nodes reference and a translatable {@link KgNodeLabels.title}. The
 * docs site, the README and the browser tab all want the same picture, and a
 * node is what stops three consumers each hardcoding a different path to it.
 *
 * **`description` is not alt text**, and wiring it into an `alt` attribute is
 * a mistake this module made and shipped. Alt text is a property of the
 * PLACEMENT, not of the image: the same mark is decorative beside a heading
 * that already names the site, and load-bearing on its own in a README. So
 * `description` describes the node — what the picture is, what it is for, why
 * it looks the way it does — and each consumer decides what to announce.
 * The sidebar announced a paragraph about sub-pixel whiskers until this was
 * fixed; see `docs/_includes/title.html`.
 */
export interface KgImage extends KgNodeLabels {
  /** Stable id, referenced by {@link KgNodeLabels} carriers such as `icon`. */
  id: string;
  /** Repo-relative path to the file. */
  src: string;
  /**
   * What this image is FOR.
   *
   * `browser-icon` is the one with a hard constraint — it has to survive
   * 16&nbsp;px — so it is named rather than left to a consumer to guess from
   * the filename. Open string: a layer may have marks this vocabulary has
   * not met.
   */
  role?: string;
  /**
   * Which viewport this variant is cut for.
   *
   * One logical image — the landing backdrop, say — is several files: a wide
   * one for a laptop, a tall one for a phone, a square-ish one for a card. All
   * share a `role`; `layout` is what tells them apart, so a consumer picks by
   * the pair rather than by parsing a filename.
   *
   * Open string, and **absent means layout-independent** — an SVG mark is the
   * same file everywhere and should not have to claim a viewport.
   */
  layout?: string;
  /** Intrinsic width in pixels, so a renderer can reserve space. */
  width?: number;
  /** Intrinsic height in pixels. */
  height?: number;
  /**
   * Where text may safely be drawn ON this image, as fractions of its size.
   *
   * **This is authored data, not a derived property**, and it has to be: it
   * says where the picture is *quiet*, which is a judgement about the
   * composition. The laptop backdrop here has a thought-cloud whose lower
   * interior is clear, an @ mark occupying its top third, and a cat's ear
   * rising into its lower left — a box that avoids all three was found by
   * rendering candidates and looking at them, and no amount of pixel analysis
   * substitutes for that.
   *
   * It differs per {@link layout} by necessity: the same cloud sits in a
   * different place in a portrait crop.
   *
   * **Absent means no region is declared**, which a renderer must treat as "do
   * not overlay text" rather than as "anywhere is fine". Text placed by
   * guesswork lands on the cat.
   */
  textRegion?: ImageRegion;
  /**
   * Where the SUBJECT of this image is, as fractions of its size — the box a
   * square avatar frame clips to.
   *
   * **Authored data, exactly like {@link textRegion}, and for a sharper
   * reason.** The navbar avatar is this image *clipped to the cat*, not the
   * card scaled down: scaling a whole 1:1 card into a 46px frame makes the cat
   * about four pixels tall and every theme reads as grey mush. The cat sits in
   * a different place in every composition, so **the box is per-image and
   * cannot be derived** — measured off a 10% grid overlay of each card.
   *
   * A literal in a stylesheet was the alternative and is worse in three ways
   * at once: no schema, no validation, and no way for a new theme to supply
   * its own — which is how the next avatar silently frames a patch of sky.
   * Two of the first seven boxes did land on scenery rather than on the cat,
   * and only a render caught it, so **whatever declares one should be looked
   * at rather than diffed**.
   *
   * ## It must be SQUARE IN PIXELS, and that is checked
   *
   * The frame is square and the clip scales width and height by `1/w` and
   * `1/h` independently, so a non-square box stretches the subject by `w/h`.
   * {@link KgImageSchema} refuses one, computing squareness from the declared
   * {@link width} and {@link height} rather than from the fractions — equal
   * fractions are square only on a square image, and believing that of a
   * portrait crop is the same silent stretch by another route.
   *
   * **An image that declares no dimensions may not declare one at all.** That
   * is a determined refusal rather than a gap: a box whose squareness cannot
   * be checked is exactly the case this field exists to stop, and accepting it
   * unchecked would put the one unverifiable box among six verified ones.
   *
   * **Absent means no avatar can be cut from this image** — a renderer must
   * skip it rather than fall back to the whole frame, for the same reason
   * `textRegion` absent means "do not overlay text" rather than "anywhere is
   * fine".
   */
  avatarRegion?: ImageRegion;
  /**
   * What the navbar draws BEHIND this image when it is an avatar: `tone` (the
   * default), the layer's hue square, which a card-art crop covers; or
   * `none`, the image on the rail itself, for a mark that is transparent
   * around its shape (issue #46, gap 5).
   */
  ground?: "tone" | "none";
}

/**
 * A rectangle on an image, in fractions of its width and height.
 *
 * Fractions rather than pixels so the declaration survives the image being
 * re-exported at another size — which is exactly what happens when a variant
 * is regenerated.
 */
export interface ImageRegion {
  /** Left edge, 0–1. */
  x: number;
  /** Top edge, 0–1. */
  y: number;
  /** Width, 0–1. */
  w: number;
  /** Height, 0–1. */
  h: number;
}

export const ImageRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0).max(1),
    h: z.number().gt(0).max(1),
  })
  // A region running off the edge is rejected rather than clamped: clamping
  // silently moves the text somewhere nobody chose, which is the failure this
  // field exists to prevent.
  .refine((r) => r.x + r.w <= 1 && r.y + r.h <= 1, {
    // FIELD-NEUTRAL since `avatarRegion` joined `textRegion` on this schema
    // (bean `603s`). A message naming one of two callers is a message that is
    // wrong half the time, and the half it is wrong about is the newer one —
    // which is the half whose author most needs it to be right.
    message: "region extends past the edge of the image",
  });

/**
 * How far from square an {@link KgImage.avatarRegion} may be, in pixels.
 *
 * One pixel, not zero: the fractions are authored to two or three decimals
 * against a 1254px card, so `0.505` and `0.24` land on sub-pixel boundaries
 * that an exact comparison would reject for no visible reason. A pixel is
 * below what any avatar frame can show; a stretch worth catching is tens of
 * pixels, and the two boxes that were wrong on the first pass were wrong by
 * far more than that.
 */
export const AVATAR_SQUARENESS_TOLERANCE_PX = 1;

export const KgImageSchema = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1),
    role: z.string().min(1).optional(),
    layout: z.string().min(1).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    textRegion: ImageRegionSchema.optional(),
    avatarRegion: ImageRegionSchema.optional(),
    /** {@link KgImage.ground}. */
    ground: z.enum(["tone", "none"]).optional(),
    ...kgNodeLabelShape,
  })
  // THE AVATAR BOX IS SQUARE IN PIXELS, checked here rather than on
  // `ImageRegionSchema` because squareness needs `width` and `height`, which
  // are siblings of the region and invisible from inside it.
  //
  // `textRegion` is deliberately NOT subject to this: a quiet interior for a
  // sentence is a wide shallow box by nature, and every one declared today is.
  .superRefine((img, ctx) => {
    if (img.avatarRegion === undefined) return;
    if (img.width === undefined || img.height === undefined) {
      // COULD NOT DETERMINE, refused rather than passed. Accepting an
      // unverifiable box would leave exactly one unchecked among the checked
      // ones, which is the state that reads as verified and is not.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["avatarRegion"],
        message:
          "avatarRegion needs `width` and `height` on the same image — its squareness " +
          "cannot be checked from fractions alone, and an unchecked box silently " +
          "stretches the subject by w/h",
      });
      return;
    }
    const wPx = img.avatarRegion.w * img.width;
    const hPx = img.avatarRegion.h * img.height;
    if (Math.abs(wPx - hPx) > AVATAR_SQUARENESS_TOLERANCE_PX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["avatarRegion"],
        message:
          `avatarRegion is ${wPx.toFixed(1)}x${hPx.toFixed(1)}px, not square — ` +
          `a square frame scales w and h independently, so this stretches the ` +
          `subject by ${(wPx / hPx).toFixed(3)}`,
      });
    }
  });

/**
 * Where a declared asset was copied from, for the staleness question.
 *
 * **A copy with no source ref cannot be checked, and is believed anyway.** The
 * bootstrap proposal states it for the cache and it is no different here:
 * *"'It was copied at init' is not an answer. The cheapest honest version
 * records the source ref and compares against it, reporting could not
 * determine when the upstream is unreachable."*
 *
 * Absent is a **third state, not "unknown"**: an asset with no `source` was
 * authored in this layer and is its own origin, which is a different fact
 * from one whose upstream cannot be reached.
 */
export const AssetSourceSchema = z.object({
  /** The layer it came from, as a reference — `litlfred/cat-harness`. */
  instance: RepoFullNameSchema,
  /** Path within that layer. */
  path: z.string().min(1),
  /** The ref it was taken at, when known. Absent means "not recorded". */
  ref: z.string().min(1).optional(),
});
export type AssetSource = z.infer<typeof AssetSourceSchema>;

/**
 * A declared non-image artefact of a layer — `AGENTS.md` first among them.
 *
 * ## Why this is not {@link KgImageSchema} with a wider type
 *
 * An image carries `layout`, `width`, `height` and `textRegion` because a
 * renderer picks between crops. An `AGENTS.md` has no crops. Widening the
 * image schema would give every asset four fields that are meaningless for it
 * and optional for images, so nothing could tell a missing `width` from an
 * inapplicable one.
 *
 * The **vocabulary is shared on purpose**: `id`, `src`, `role`, and the label
 * shape, exactly as an image declares them. Two spellings of `role` is the
 * drift this repository keeps paying for.
 *
 * ## Why declare it at all
 *
 * Measured 2026-09-19: `AGENTS.md` is the only root artefact this layer
 * does not declare — `harness.json` carries `directories[]` and `images[]` and
 * it is in neither. Bean `v8gh` is what that costs: seven dead links in it,
 * five broken by a single directory move, including the one its own banner
 * calls the place to start, so a cold agent following the banner hit a 404.
 * Nothing caught them, because `readme:audit` checks `README.md` alone and
 * `check:agents-xref` checks citations INTO the file rather than links out.
 *
 * Declaring it is what makes a check follow rather than be special-cased.
 */
/**
 * Which ROOT a declared path is relative to — the layer's, or the
 * repository's.
 *
 * ## Why this exists
 *
 * A layer root and a repository root were the **same directory** until the
 * move (bean `wggr`), so every declared path answered both questions at once
 * and nothing had to say which it meant. Afterwards four directories and both
 * assets resolved one level too deep, producing the `dh4f` shape from the
 * inside: `beans/` resolved to `cat-harness/beans/`, a consumer scanned
 * nothing, and 32 tests failed on a store that was sitting at the repository
 * root the whole time.
 *
 * ## Why a field rather than `"../beans/"`
 *
 * A traversal spells the *mechanism* and states no fact. It is also refused:
 * `check-harness-dirs.ts` rejects **every** dot-prefixed segment, and `..`
 * is one — the guard would have to be weakened to admit the escape it exists
 * to prevent. A declared `scope` says what the directory belongs to, leaves
 * `path` clean, and puts the one `repoRootFor` call in the resolver instead of
 * a `..` in each of six declarations.
 *
 * ## What `repository` implies beyond the path
 *
 * **It is not inherited.** A dependency's repository is not this one's, so a
 * repository-scoped entry reaching this layer through the dependency chain
 * would name somebody else's `beans/`. `resolveDirectories` skips those, which
 * is how the never-overlaid property of `beans/` and `todos/` stops being
 * something an agent has to remember.
 *
 * Absent means `instance`, which is what the overwhelming majority of entries
 * are: a default that has to be written down is a default that gets it wrong
 * somewhere.
 */
export const DeclarationScopeSchema = z.enum(["instance", "repository"]);
export type DeclarationScope = z.infer<typeof DeclarationScopeSchema>;

/** The shape both a directory entry and an asset entry share for scoping. */
export const scopeShape = {
  scope: DeclarationScopeSchema.optional(),
} as const;

export const KgAssetSchema = z.object({
  id: z.string().min(1),
  /**
   * Path relative to the root {@link DeclarationScopeSchema | `scope`} names —
   * this layer's by default, the repository's when `scope` says so.
   *
   * `AGENTS.md` and `README.md` are the repository's: a cold agent reads them
   * at the top of the checkout, and the repository has exactly one of each
   * however many layers it holds.
   */
  src: z.string().min(1),
  /** What this artefact is FOR — `agent-instructions`, `licence`, … */
  role: z.string().min(1).optional(),
  /** Where it was copied from; absent means authored here. */
  source: AssetSourceSchema.optional(),
  ...scopeShape,
  ...kgNodeLabelShape,
});
export type KgAsset = z.infer<typeof KgAssetSchema>;

/** The declared assets carrying a role, in declaration order. */
export function assetsForRole(
  assets: readonly KgAsset[] | undefined,
  role: string,
): KgAsset[] {
  return (assets ?? []).filter((a) => a.role === role);
}

/**
 * The variants of one role, by layout.
 *
 * Returns a map rather than a list so a caller asks for the layout it is
 * rendering. A layout with no variant is **absent from the map**, never
 * substituted — see {@link pickLayout} for the one place a fallback is
 * chosen, and said out loud.
 */
export function imagesForRole(
  images: readonly KgImage[] | undefined,
  role: string,
): Map<string, KgImage> {
  const out = new Map<string, KgImage>();
  for (const i of images ?? []) {
    if (i.role === role && i.layout !== undefined) out.set(i.layout, i);
  }
  return out;
}

/**
 * The ONE image of a role that has no layout variants.
 *
 * A sibling of {@link imagesForRole}, not a replacement for it, because the two
 * answer different questions. A `landing` backdrop exists once per viewport and
 * is keyed by `layout`; a mark exists once, full stop. `imagesForRole` encodes
 * the first shape in its filter — `i.layout !== undefined` — so asking it for a
 * role whose images carry no layout returns an EMPTY MAP and says nothing about
 * why.
 *
 * That is not hypothetical. `harness.json` declares `mark-small` with
 * `role: "browser-icon"`, and until 2026-09-19 nothing consumed it: the site
 * emitted no favicon at all, and the one function that could have found the
 * image structurally could not, because neither mark declares a layout. A
 * declared role, an unreachable lookup, and nothing reporting either — the
 * same "declared, unread, unnoticed" failure `beans/defs/…blv9` records for
 * template asset paths.
 *
 * Returns the FIRST match. A role meant to be unique that has several entries
 * is a declaration bug, and picking the first is the same rule
 * `resolveDirectories` uses for a repeated id — deterministic, and left to the
 * declaration's own validation to complain about rather than guessed at here.
 */
export function imageForRole(
  images: readonly KgImage[] | undefined,
  role: string,
): KgImage | undefined {
  return (images ?? []).find((i) => i.role === role);
}

/** What {@link pickLayout} did, so a caller can report a substitution. */
export interface LayoutPick {
  image?: KgImage;
  /** The layout actually used, when it is not the one asked for. */
  substituted?: string;
}

/**
 * The variant for a layout, falling back along a declared order.
 *
 * The fallback is **reported**, not silent. A phone served the laptop crop is
 * a real degradation — the text region is wrong for it, so the overlay lands
 * somewhere nobody chose — and a renderer that cannot tell it happened will
 * ship that. `substituted` is what lets it say so, or decline to overlay.
 *
 * An empty result means no variant of this role exists at all, which is a
 * third state and not the same as a substitution.
 */
export function pickLayout(
  images: readonly KgImage[] | undefined,
  role: string,
  wanted: string,
  order: readonly string[] = ["laptop", "mobile", "card"],
): LayoutPick {
  const byLayout = imagesForRole(images, role);
  const exact = byLayout.get(wanted);
  if (exact) return { image: exact };
  for (const l of order) {
    const alt = byLayout.get(l);
    if (alt) return { image: alt, substituted: l };
  }
  return {};
}

/**
 * `.claude/skills/<group>/*.json` — the typed nodes beside the skills.
 *
 * ## Why this is a schema rather than a constant inside the exporter
 *
 * It was `REGISTRY_GROUPS` in `scripts/kg-export.ts`, private to it. That made
 * it a fact only the graph EXPORTER could see, and `scripts/ns-export.ts` —
 * the VOCABULARY exporter, whose job is to define every class the graph
 * projects — could not read it. So the two disagreed in the one way that
 * matters: kg-export minted `folio:Convention` onto two real nodes while
 * ns-export defined no such class, and the type on a published node did not
 * dereference. Bean `blv9`.
 *
 * The check that exists to catch exactly that reported **0 undefined**, because
 * `mintedTermsFromSource` scans for `termIri("Name")` LITERALS and a class
 * minted as `` `${FOLIO_NS}${type}` `` from this table is not a literal
 * anywhere. `ns-export.ts` documented the fix in a comment — *"the caller
 * unions this with the terms a real export emits"* — and no caller ever did.
 * A contract stated only in prose is a contract with no test: the same failure
 * this repository's own `AGENTS.md` banner describes, one level down.
 *
 * Keyed by DIRECTORY name, valued by CLASS name, because the directory is what
 * a scan finds and the class is what the vocabulary must define. Adding a row
 * here is what makes a new node kind both exportable and defined — and
 * `scripts/tests/registry-groups.test.ts` fails if the second half is skipped.
 */
export const REGISTRY_GROUPS: Readonly<Record<string, string>> = {
  actors: "Actor",
  capabilities: "Capability",
  roles: "Role",
  requirements: "Requirement",
  // Bean `3190`. A convention is context attached to a PROCESS, so it is a
  // node like the others rather than prose in AGENTS.md — which that file
  // itself calls a rule with no home.
  conventions: "Convention",
};

/**
 * Is this file a directory's README — documentation ABOUT the directory,
 * never a node IN it?
 *
 * Every declared directory carries one, generated by `subgraph-readmes`, so a
 * collector that enumerates a graph's files must skip it or count a README as
 * a todo item, a methodology, a skill or a detangle node. The one name-based
 * exception to "files declare what they are", and it earns it the way
 * `isSkillMd` says: a filesystem-wide convention, not this repository's layout.
 */
export function isDirectoryReadme(path: string): boolean {
  return /(^|[\\/])README\.md$/.test(path);
}
