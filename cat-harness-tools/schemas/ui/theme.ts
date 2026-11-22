/**
 * A sticky theme — named colour roles plus the three layouts, as a graph node.
 *
 * @module schemas/theme
 * @graphNode schema
 *
 * ## A node, not a stylesheet
 *
 * A theme declares **named roles**: a rule says `var(--fa-sticky-surface)`
 * and what that resolves to is the theme's business, so changing a theme is
 * not a find-and-replace of hex colours that misses a hover or dark-scheme
 * variant.
 *
 * The **type and the themes** are harness-layer nodes, while the todos that
 * reference them stay in the `todos` graph.
 *
 * ## All three layouts, or the theme is invalid
 *
 * The three are `laptop`, `mobile` and `card` — the set `harness.json`'s
 * `images[].layout` already uses, each with its own `textRegion` because the
 * crop differs. **Missing a layout is invalid, never degraded**: there is no
 * fallback to another layout's geometry, because a theme that renders wrong
 * on a phone ships while one that refuses to load is noticed.
 *
 * ## Each harness has its own theme, by convention
 *
 * | | |
 * |---|---|
 * | **refused** | deriving a theme from a ROLE, process, skill or graph typology — a note's appearance would depend on which lane happened to be reading it |
 * | **this** | a HARNESS picking one theme and keeping it, written in that harness's own declaration |
 *
 * **Nothing computes it**: `harness.json` names an id, and no code maps a
 * harness to a theme.
 *
 * **A THEME IS REQUIRED; ART IS NOT.** `backdrop` is optional, so a
 * palette-only theme is COMPLETE. That is a different state from a theme
 * whose backdrop is declared but whose crops are missing, which
 * `resolveThemeBackdrop` refuses wholesale.
 *
 * Today: `grumpy-cyborg-agents` (the sage hoodie on a sled pulled by robot cats) is
 * cat-harness's, `grumpy-cat` (the plain sage hoodie) is folio-assist-core's,
 * `bootstrap` (the cowboy in the desert) is bootstrap's, and `engineer` is
 * reserved for testing surfaces.
 *
 * ## Choosing a theme is an AUTHORING judgement — there is no mapping
 *
 * A theme is picked by whoever writes the note, and **nothing derives one**
 * from a role, a process, a skill or a graph typology. `ThemedTodoFields.theme` and
 * the landing sticky's required `theme` are the whole selection surface: an
 * id, set by an author. This is a rule, not a gap: a role is a swimlane, not a
 * property of a thing (`role-model.md`), so a role→theme table would make a
 * note's look depend on which process reads it and put presentation into the
 * role graph.
 *
 * The optional `theme` on {@link ThemedTodoFieldsSchema} encodes this: absent
 * means *nobody has chosen*.
 *
 * ## What the palette may NOT carry
 *
 * The priority stripe is a WIDTH as well as a colour, so colour alone never
 * carries the signal (WCAG SC 1.4.1). A theme sets the stripe's **hue**; it
 * never sets its width to zero, and {@link ThemeSchema} has no field with
 * which to try.
 */
import { z } from "zod";
import { RepoFullNameSchema } from "../kg/repo-full-name.js";

import { nodeKind } from "../kg/node-kind.js";

/**
 * The three layouts a theme must define.
 *
 * Not invented here — `harness.json`'s `images[].layout` already uses exactly
 * these, and reusing the vocabulary is the difference between one concept and
 * two spellings of one concept.
 */
export const THEME_LAYOUTS = ["laptop", "mobile", "card"] as const;
export type ThemeLayout = (typeof THEME_LAYOUTS)[number];

/**
 * What KIND of surface a theme dresses.
 *
 * ## One node, not three, and the reason is the palette
 *
 * `schemas/ui/theme.ts` exists because 106 hardcoded hex colours were replaced by
 * 22 named custom properties. Three separate theme node types would reintroduce
 * exactly that, one level up: three spellings of "accent colour", free to
 * disagree about what an accent IS. So the palette vocabulary is shared across
 * every kind and only the GEOMETRY varies — bean `j66n`, and the owner's
 * "one node with a kind discriminator rather than three node kinds".
 *
 * ## The geometry has to vary, and that was MEASURED rather than assumed
 *
 * A sticky theme's three layouts are `laptop | mobile | card`. The WHO
 * publication style guide (`wpr-rdo-2020-003-eng`, page 18, "Frequently used
 * formats and specs") states three PRINT formats instead — A4 21×29.7 cm, A5
 * 14.8×21 cm, A5 landscape 21×14.8 cm — and states **no** column widths and no
 * page margins anywhere in its 66 sections.
 *
 * So a publication theme cannot honestly fill `minWidth` ("before the grid
 * reflows"), and calling an A4 page a `laptop` would be a name that lies. The
 * requirement is untouched — three layouts, or invalid — and only their names
 * and fields follow the medium. Owner's ruling, 2026-09-20: *"Layouts vary by
 * kind; palette stays shared."*
 *
 * `webpage` shares the sticky geometry deliberately: both are screens, and
 * inventing a third viewport vocabulary for the same three breakpoints is the
 * duplication this file was written to end.
 */
export const THEME_KINDS = ["sticky", "webpage", "publication"] as const;
export type ThemeKind = (typeof THEME_KINDS)[number];

/**
 * The three print formats, named as the source names them.
 *
 * `a5Landscape` rather than `a5-landscape` because these are object KEYS and
 * the sticky layouts are camel-free only by luck of being single words.
 */
export const PRINT_FORMATS = ["a4", "a5", "a5Landscape"] as const;
export type PrintFormat = (typeof PRINT_FORMATS)[number];

/**
 * Geometry for one print format.
 *
 * Deliberately NOT {@link ThemeGeometrySchema}. `minWidth` is documented as
 * "minimum column width before the grid reflows", which a fixed page does not
 * do; `padding` is card padding. Reusing the shape would have typechecked and
 * meant nothing — the values are trim size and margin, and a reader following
 * the field name would be told the wrong thing about a real publication.
 *
 * `width` and `height` are CSS lengths so the source's own units survive: the
 * guide says `21 cm x 29.7 cm`, and rewriting that as millimetres or points
 * would be a conversion nobody asked for and a chance to be wrong.
 */
export const PrintGeometrySchema = z
  .object({
    /** Trim width, as a CSS length — `21cm` for A4. */
    width: z.string().min(1),
    /** Trim height, as a CSS length — `29.7cm` for A4. */
    height: z.string().min(1),
    /**
     * Page margin, as a CSS length.
     *
     * The WHO guide states a 1 cm logo exclusion zone and a 3 cm minimum logo
     * size, and no page margin. A theme that carries one is stating a fact its
     * source did not — so where the source is silent this is the exclusion
     * zone, cited as such, and never a plausible-looking invention.
     */
    margin: z.string().min(1),
    /** Body scale relative to the format, as a unitless multiplier. */
    fontScale: z.number().positive(),
  })
  .strict();
export type PrintGeometry = z.infer<typeof PrintGeometrySchema>;

/**
 * Geometry for one layout.
 *
 * **Geometry, not colour.** The palette is shared across a theme's three
 * layouts because a sticky is the same sticky on a phone; what changes is how
 * much room it has. Splitting colour per layout would let a theme be legible on
 * a laptop and not on a phone while still passing every check — which is the
 * state this whole node exists to make impossible.
 */
export const ThemeGeometrySchema = z
  .object({
    /** Minimum column width before the grid reflows, as a CSS length. */
    minWidth: z.string().min(1),
    /** Card padding, as a CSS length. */
    padding: z.string().min(1),
    /** Body scale relative to the page, as a unitless multiplier. */
    fontScale: z.number().positive(),
  })
  .strict();
export type ThemeGeometry = z.infer<typeof ThemeGeometrySchema>;

/**
 * The named colour roles a theme supplies.
 *
 * **Every one is a ROLE, not a colour name.** `surface` rather than `pale-sage`,
 * so a rule reads as what it does. A palette keyed by colour name is a palette
 * that cannot be re-themed without renaming every use site, which is the
 * hardcoding this replaces wearing a variable's clothes.
 *
 * `gradientFrom` / `gradientTo` are the owner's *"couple of fading
 * gradations"*. They are **optional in the type and required in practice for a
 * gradated theme**: a theme declaring one without the other is refused, because
 * a gradient with one stop is a flat fill that claims to be a gradient.
 */
/**
 * The palette's fields, before the whole-palette refinement.
 *
 * Named so {@link ThemePartialPaletteSchema} can be derived from it. The
 * gradient rule below is a fact about a COMPLETE palette — a child overriding
 * `gradientFrom` and inheriting `gradientTo` is legal and the pair is still
 * whole after resolution, which is `data-modelling` step 7's "requiredness
 * holds after resolution, never before" applied to a refinement rather than a
 * field.
 */
const themePaletteShape = {
  /** The card's own background. */
  surface: z.string().min(1),
  /** Body text on `surface`. */
  ink: z.string().min(1),
  /** Border and rule colour. */
  edge: z.string().min(1),
  /** The priority stripe's hue. Width is NOT a theme's to set — see module docs. */
  accent: z.string().min(1),
  gradientFrom: z.string().min(1).optional(),
  gradientTo: z.string().min(1).optional(),
} as const;

export const ThemePaletteSchema = z
  .object(themePaletteShape)
  .strict()
  .refine((p) => (p.gradientFrom === undefined) === (p.gradientTo === undefined), {
    message: "a gradient needs both stops: declare gradientFrom and gradientTo, or neither",
  });
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;

/**
 * Artwork behind a sticky's ink, named by the image ROLE it resolves from.
 *
 * The owner, 2026-09-19: *"a note can hold the image as part of its theme."* So
 * the image is the **theme's**, not the note body's — a note references a theme
 * by id and gains the art for free, which is why the 2026-09-20 ask for a
 * *"sticky note with grumpy cat background"* needs no new field on the note.
 *
 * ## A ROLE, never a path — and this is the load-bearing decision
 *
 * The obvious version declares `src: "docs/assets/img/harness/landing-laptop.webp"`
 * on the theme. It was written first, and it is wrong, because **this module is
 * platform code that a downstream folio inherits.** `landing.html` already
 * states the consequence it was guarding against:
 *
 * > a downstream folio should not inherit a grumpy cat it did not choose.
 *
 * A literal path would give every folio depending on this platform a theme
 * pointing at three `.webp`s that exist only here — a guaranteed 404 in any
 * layer that did not happen to copy them, and the *same* defect class as
 * bean `blv9` (link-shaped values nothing checks resolve).
 *
 * Naming a role instead inverts it. The theme says *"my backdrop is whatever
 * this instance declares as its `landing` art"*; `harness.json` says what that
 * is. A layer with its own art gets its own; a layer with none gets no
 * backdrop and renders palette-only, which is an already-tested state rather
 * than a broken one. `5oai` resolved exactly this before the field existed:
 * *"reuse `images[].role` rather than invent an avatar vocabulary … a new
 * parallel field would be two spellings of one concept."*
 *
 * ## `scrim` is REQUIRED, and it is the accessibility mechanism
 *
 * Ink on a flat `surface` has a contrast ratio anybody can compute. **Ink over
 * a photograph does not** — it varies pixel to pixel, so no theme carrying art
 * can state its contrast, and a check over the palette alone would pass a
 * sticky that is unreadable across half of its own background.
 *
 * A scrim is what makes the question answerable again: it sits between art and
 * ink, so the ink's effective ground is the scrim over the art's worst case
 * rather than the art. Requiring it means a themed backdrop **cannot** be
 * declared without the thing that makes it legible — not optional, precisely
 * because "we will add a scrim later" is how the unreadable version ships.
 *
 * Same shape as the constraint this module already records for the priority
 * stripe: a theme may set a hue; it may never remove a non-colour channel.
 */
export const ThemeBackdropSchema = z
  .object({
    /**
     * The declared image `role` this theme's art comes from — `landing` for the
     * three `landing-*` entries a layer declares.
     *
     * Resolved against the layer's own `images[]` at render time by
     * {@link resolveThemeBackdrop}, never composed into a path here.
     */
    imageRole: z.string().min(1),
    /**
     * The layer between art and ink, as a CSS colour — normally a translucent
     * form of `surface`. Required; see module docs.
     */
    scrim: z.string().min(1),
    /**
     * What the art is FOR, for an author reading the theme.
     *
     * **Not translatable, and not announced.** `landing.html` records the
     * reasoning and it carries over unchanged: the backdrop is decorative,
     * every word it carries is in the sticky's own markdown as real text, and
     * announcing a paragraph about composition to somebody who already has the
     * content is the mistake `title.html` shipped once. The rendered image is
     * `alt=""`; this is authoring metadata.
     */
    description: z.string().min(1).optional(),
  })
  .strict();
export type ThemeBackdrop = z.infer<typeof ThemeBackdropSchema>;

/** The tag every theme node declares, per the `$schema` convention. */
export const THEME_SCHEMA_TAG = "folio-theme/v1";

/**
 * A pointer to another theme, possibly in another layer.
 *
 * Same shape and same reasoning as `LibraryRef`: a layer NAME, not a path,
 * because the citing layer cannot know where a sibling's checkout sits. A
 * bare `themeId` resolves against the citing layer, which is the common
 * case and the one that must stay cheap to write.
 *
 * Owner, 2026-09-20, paraphrased: the IRIS replica inherits the WHO style-guide theme. The WHO house
 * style is the authority and the repository site is the deviation, so the
 * inheritance runs FROM the site TO the style guide and crosses a layer
 * boundary to do it.
 */
/** A palette fragment — what an inheriting theme states when it changes one colour. */
export const ThemePartialPaletteSchema = z.object(themePaletteShape).strict().partial();

export const ThemeRefSchema = z
  .object({
    /** The owning layer, as `owner/repo` (bean `6rmv`). Absent means the citing layer's own. */
    instance: RepoFullNameSchema.optional(),
    themeId: z.string().regex(/^[a-z][a-z0-9-]*$/, "a theme id is lowercase kebab-case"),
  })
  .strict();
export type ThemeRef = z.infer<typeof ThemeRefSchema>;

/**
 * Why a theme states a value its parent already states.
 *
 * `data-modelling` step 7: *"an overridden value still cites why"* — otherwise
 * the model records what a value is and loses where it came from, which is the
 * failure `uses[]` exists to prevent elsewhere. An override without a reason
 * is indistinguishable from a copy somebody forgot to delete.
 */
export const ThemeOverrideNoteSchema = z
  .object({
    /** Dotted path into the theme, e.g. `palette.accent`. */
    field: z.string().min(1),
    /** Where the value came from — a CSS custom property, a voice rule, a page. */
    source: z.string().min(1),
    /** Why it differs from the inherited value. */
    reason: z.string().min(1),
  })
  .strict();
export type ThemeOverrideNote = z.infer<typeof ThemeOverrideNoteSchema>;

/** Fields every theme shares, whatever surface it dresses. */
const themeIdentityShape = {
  $schema: z.literal(THEME_SCHEMA_TAG),
  /** Stable id; what a `ThemedTodo` references and what the CSS class is built from. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, "a theme id is lowercase kebab-case"),
} as const;

/**
 * The DECLARED form of a theme — what an author writes.
 *
 * ## Everything is overridable, and everything but identity may be inherited
 *
 * Owner, 2026-09-20: *"WHO should be able to override all theme properties,
 * just defaults to inherited."* So every field below except `id`, `$schema`
 * and `kind` is OPTIONAL HERE and required in {@link ResolvedThemeSchema}. A
 * theme that inherits states only what it changes.
 *
 * **Requiredness holds after resolution, never before** — `data-modelling`
 * step 7, and the trap it names: checking the declaration instead is how
 * inheritance turns into optionality by accident. `ThemeSchema` is deliberately
 * the LAX one and is never what a renderer consumes.
 *
 * `kind` stays required on the declaration rather than inherited, because it
 * selects which `layouts` shape is legal and a reader cannot validate the rest
 * of the object without knowing it. A theme that changes kind is restating its
 * geometry by definition — that is what earns a kind in the first place.
 */
export const ThemeSchema = z
  .object({
    ...themeIdentityShape,
    // REQUIRED, with no default — which is what the comment above already
    // claimed ("`kind` stays required on the declaration rather than
    // inherited") while the code read `.default("sticky")`.
    //
    // The gap was not cosmetic. `resolveTheme` treats a kind change as
    // resetting the geometry ("there is nothing shared to carry"), so a
    // `publication` theme inheriting from a `publication` parent and omitting
    // `kind` was silently parsed as `sticky`, dropped the print geometry it
    // meant to inherit, and then failed with an error naming
    // `layouts.laptop` — a message about the wrong field entirely.
    //
    // All twelve shipped themes relied on the default and now say `sticky`
    // outright. That is the cost, and it is paid once: a default that is right
    // for eleven cases and silently wrong for the twelfth is not a default, it
    // is a trap with good odds.
    kind: z.enum(THEME_KINDS),
    /** The theme this one starts from. Absent means it starts from nothing. */
    inherits: ThemeRefSchema.optional(),
    /**
     * Display name.
     *
     * **Translatable, and the palette values are not.** The owner asked for
     * translatable themes; what a reader sees is the name, so that is the
     * string that goes through the `.pot` / `.po` pipeline. A colour is not
     * language-dependent, and running one through translation would invite a
     * locale to diverge on a value the CSS has to agree on.
     */
    name: z.string().min(1).optional(),
    /** One line for the theme picker. Translatable, same reasoning as `name`. */
    description: z.string().min(1).optional(),
    /**
     * Shared across every kind, deliberately.
     *
     * `theme.ts` exists because 106 hardcoded hex colours became 22 named
     * properties. A palette per kind would reintroduce that one level up —
     * three spellings of "accent colour", free to disagree about what an
     * accent IS. `data-modelling` step 7.
     *
     * `.partial()` so a child may override one colour and inherit the rest.
     */
    palette: ThemePartialPaletteSchema.optional(),
    /**
     * Artwork behind the ink, when the theme has any.
     *
     * **Optional, and absence is the common case rather than an omission.** Most
     * themes are a palette. A backdrop is what `grumpy-cat` has and what
     * `high-contrast-light` / `high-contrast-dark` must never be given — art
     * behind ink is the thing those two exist to remove, and a scrim strong
     * enough to make a photograph safe at their ratios would hide the
     * photograph anyway.
     */
    backdrop: ThemeBackdropSchema.optional(),
    /**
     * Geometry, by kind. All three after resolution, or invalid.
     *
     * NOT inherited across a kind change: a `publication`'s formats and a
     * `sticky`'s viewports share no field, so there is nothing to carry over.
     * Within a kind it inherits like anything else.
     */
    layouts: z
      .union([
        z
          .object({
            laptop: ThemeGeometrySchema.optional(),
            mobile: ThemeGeometrySchema.optional(),
            card: ThemeGeometrySchema.optional(),
          })
          .strict(),
        z
          .object({
            a4: PrintGeometrySchema.optional(),
            a5: PrintGeometrySchema.optional(),
            a5Landscape: PrintGeometrySchema.optional(),
          })
          .strict(),
      ])
      .optional(),
    /** Why each overridden value differs from the inherited one. */
    overrides: z.array(ThemeOverrideNoteSchema).optional(),
  })
  .strict();
export type Theme = z.infer<typeof ThemeSchema>;

/**
 * The RESOLVED form — what a renderer consumes, and where requiredness lives.
 *
 * Never stored. `data-modelling` step 5: *"a derived fact stored is a cache,
 * and an unvalidated cache is worse than no cache."* A resolved theme is
 * computed from the declaration chain by {@link resolveTheme} every time.
 */
export const ResolvedThemeSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        ...themeIdentityShape,
        kind: z.literal("sticky"),
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        palette: ThemePaletteSchema,
        backdrop: ThemeBackdropSchema.optional(),
        layouts: z
          .object({
            laptop: ThemeGeometrySchema,
            mobile: ThemeGeometrySchema,
            card: ThemeGeometrySchema,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...themeIdentityShape,
        kind: z.literal("webpage"),
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        palette: ThemePaletteSchema,
        backdrop: ThemeBackdropSchema.optional(),
        layouts: z
          .object({
            laptop: ThemeGeometrySchema,
            mobile: ThemeGeometrySchema,
            card: ThemeGeometrySchema,
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...themeIdentityShape,
        kind: z.literal("publication"),
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        palette: ThemePaletteSchema,
        backdrop: ThemeBackdropSchema.optional(),
        layouts: z
          .object({
            a4: PrintGeometrySchema,
            a5: PrintGeometrySchema,
            a5Landscape: PrintGeometrySchema,
          })
          .strict(),
      })
      .strict(),
  ]);
export type ResolvedTheme = z.infer<typeof ResolvedThemeSchema>;

/** How a theme is keyed once ids are no longer unique across layers. */
export function themeKey(instance: string, id: string): string {
  return `${instance}:${id}`;
}

/** What went wrong resolving a chain, kept apart because they send a reader elsewhere. */
export type ThemeResolveFailure =
  | { kind: "no-such-theme"; ref: ThemeRef; from: string }
  | { kind: "cycle"; chain: string[] }
  | { kind: "incomplete"; id: string; problems: string[] };

/**
 * Resolve a declared theme against its inheritance chain.
 *
 * ## What inherits, and what cannot
 *
 * `palette` merges field by field, so a child may override one colour and keep
 * twenty-one. `name`, `description` and `backdrop` are whole-value: half a
 * backdrop is the state `resolveThemeBackdrop` already refuses wholesale.
 *
 * `layouts` inherits ONLY within a kind. A `publication`'s formats and a
 * `sticky`'s viewports share no field, so a kind change carries nothing over —
 * which is the same fact that earns a kind in the first place
 * (`data-modelling` step 7). A `webpage` child of a `publication` parent
 * therefore inherits the PALETTE, which is the point of the shared vocabulary,
 * and must state its own three viewports.
 *
 * ## Cycles are a failure, not a depth limit
 *
 * A depth cap would turn a cycle into "too deep", which sends a reader looking
 * for a long chain that does not exist. The visited set names the loop.
 */
export function resolveTheme(
  start: { instance: string; theme: Theme },
  lookup: (ref: ThemeRef, citingInstance: string) => { instance: string; theme: Theme } | undefined,
): { ok: true; theme: ResolvedTheme } | { ok: false; failure: ThemeResolveFailure } {
  // Root-first, so each step overwrites what it inherited.
  const chain: Array<{ instance: string; theme: Theme }> = [];
  const seen = new Set<string>();
  let cur: { instance: string; theme: Theme } | undefined = start;
  while (cur) {
    const key = themeKey(cur.instance, cur.theme.id);
    if (seen.has(key)) {
      return { ok: false, failure: { kind: "cycle", chain: [...seen, key] } };
    }
    seen.add(key);
    chain.unshift(cur);
    const ref: ThemeRef | undefined = cur.theme.inherits;
    if (!ref) break;
    const parent = lookup(ref, cur.instance);
    if (!parent) {
      return { ok: false, failure: { kind: "no-such-theme", ref, from: key } };
    }
    cur = parent;
  }

  const merged: Record<string, unknown> = { $schema: THEME_SCHEMA_TAG, id: start.theme.id };
  let kind: ThemeKind = "sticky";
  let palette: Record<string, unknown> = {};
  let layouts: Record<string, unknown> = {};
  for (const link of chain) {
    const t = link.theme;
    // A kind change resets the geometry: there is nothing shared to carry.
    if (t.kind !== kind) layouts = {};
    kind = t.kind;
    if (t.name !== undefined) merged.name = t.name;
    if (t.description !== undefined) merged.description = t.description;
    if (t.backdrop !== undefined) merged.backdrop = t.backdrop;
    if (t.palette) palette = { ...palette, ...t.palette };
    if (t.layouts) {
      for (const [k, v] of Object.entries(t.layouts)) {
        if (v !== undefined) layouts[k] = v;
      }
    }
  }
  merged.kind = kind;
  merged.palette = palette;
  merged.layouts = layouts;

  const parsed = ResolvedThemeSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      failure: {
        kind: "incomplete",
        id: start.theme.id,
        // The FIELD PATHS, not zod's prose: "layouts.mobile: Required" tells a
        // person which layout to supply, which is the whole reason
        // `missingLayouts` exists beside the schema.
        problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      },
    };
  }
  return { ok: true, theme: parsed.data };
}

/** One actionable line per failure, so a caller need not re-word four cases. */
export function explainThemeFailure(f: ThemeResolveFailure): string {
  switch (f.kind) {
    case "no-such-theme":
      return (
        `${f.from} inherits ${f.ref.instance ? `${f.ref.instance}:` : ""}${f.ref.themeId}, ` +
        `which no instance in this checkout declares. A theme names its parent by DECLARED ` +
        `INSTANCE NAME, never by path.`
      );
    case "cycle":
      return `theme inheritance forms a cycle: ${f.chain.join(" -> ")}. A theme cannot inherit from itself, transitively or otherwise.`;
    case "incomplete":
      return (
        `${f.id} is incomplete after inheritance — ${f.problems.join("; ")}. ` +
        `Requiredness holds AFTER resolution: state these, or inherit them from a parent that does.`
      );
  }
}

/**
 * Names the missing layouts, for an error a person can act on.
 *
 * `ThemeSchema` already refuses an incomplete theme; this exists so the refusal
 * can say *which* layout is missing rather than only that parsing failed. A
 * gate whose message is "invalid" teaches nobody what to fix.
 */
export function missingLayouts(value: unknown): ThemeLayout[] {
  const layouts = (value as { layouts?: Record<string, unknown> } | null)?.layouts;
  if (layouts === null || typeof layouts !== "object") return [...THEME_LAYOUTS];
  return THEME_LAYOUTS.filter((l) => !(l in layouts));
}

/**
 * The HUE of a `#rgb` / `#rrggbb` colour, in whole degrees 0–359 — or
 * `undefined` when the value is not a hex colour or has no hue (a grey).
 *
 * Bean `v8n5`. A harness tile and its navbar entry are toned by a hue angle
 * (`--fa-tile-tone`), and a theme's palette is hex. This is the one bridge
 * between the two, so a tile can take its tone from its layer's own theme
 * accent rather than from a hue written down a second time. A grey has no hue
 * to take, which is a different answer from red (0°), hence `undefined`.
 */
export function hexHue(hex: string): number | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return undefined;
  const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((Math.round(raw * 60) % 360) + 360) % 360;
}

/** The CSS custom-property block a theme contributes, as `--fa-sticky-*` roles. */
export function themeCssVars(theme: ResolvedTheme): string {
  const p = theme.palette;
  const rows = [
    `--fa-sticky-surface: ${p.surface};`,
    `--fa-sticky-ink: ${p.ink};`,
    `--fa-sticky-edge: ${p.edge};`,
    `--fa-sticky-accent: ${p.accent};`,
  ];
  if (p.gradientFrom && p.gradientTo) {
    rows.push(`--fa-sticky-grad-from: ${p.gradientFrom};`, `--fa-sticky-grad-to: ${p.gradientTo};`);
  }
  // The scrim, and NOT the art. A custom property can carry a colour the
  // stylesheet composites; it cannot carry the per-layout `<picture>` swap,
  // which has to be markup because the breakpoint chooses the FILE. A single
  // `--fa-sticky-art: url(...)` would serve one crop to every viewport — the
  // bug `landing.html` records shipping once, where the mobile image loaded and
  // the laptop's geometry stayed.
  if (theme.backdrop) rows.push(`--fa-sticky-scrim: ${theme.backdrop.scrim};`);
  return rows.join("\n  ");
}

/**
 * A WEBPAGE theme's roles, as the custom properties the docs site already reads.
 *
 * Bean `7h3u`, on the owner's 2026-09-30 ruling to wire layer webpage themes
 * at the PLATFORM layer so every ingested IG gets one, rather than in one
 * layer's page generator.
 *
 * ## Why this is not {@link themeCssVars} with a different prefix
 *
 * That function emits `--fa-sticky-*`, and `gen-themes-css.ts` says why in its
 * own words: *"A `webpage` theme shares the geometry but not this stylesheet:
 * its CSS is the site's, not the note board's. Adding it here would emit sticky
 * properties for a surface that has no stickies."* Renaming the prefix would
 * have produced `--fa-page-surface` and so on — correct-looking, and read by
 * NOTHING, because the site's stylesheet does not use those names.
 *
 * ## The names are chosen by MEASUREMENT, not by symmetry
 *
 * `docs-ui.css` carries 33 `var(--x, #literal)` sites, and its own header says
 * why they are all fallbacks today:
 *
 * > just-the-docs is Sass and defines NONE of `--sidebar-color`,
 * > `--border-color` or `--link-color`, so every one of those resolves to its
 * > literal fallback, always.
 *
 * So those three names are **already read and never defined** — declaring them
 * is the one intervention that changes what the page paints without touching a
 * rule. Measured 2026-09-30: `--link-color` 18 sites, `--sidebar-color` 9,
 * `--border-color` 2.
 *
 * | site variable | role | why |
 * |---|---|---|
 * | `--sidebar-color` | `accent` | The LHS nav is the surface the owner asked to KEEP on the left while taking WHO's styling, and in the source that chrome is `--navbar-bg-color`. |
 * | `--link-color` | `accent` | Links carry the brand hue on the IG too. |
 * | `--border-color` | `edge` | `edge` is documented as *"Border and rule colour"*; this is the site's name for the same thing. |
 *
 * `surface` and `ink` are deliberately **not** emitted. The site has no
 * undefined variable for page background or body text — those are just-the-docs'
 * compiled Sass — so declaring a name nothing reads would be the
 * correct-looking-and-inert failure this function exists to avoid. They stay in
 * the theme, where a later change that DOES make the site consume them can pick
 * them up.
 *
 * ## What this therefore does and does not do
 *
 * It rethemes the surfaces **this site owns**. It does not retheme
 * just-the-docs' own compiled chrome, and no amount of custom properties can
 * until that Sass is taught to read them — which is the *"106 hardcoded hex
 * colours against 22 custom properties"* problem this module's own header
 * records, and a separate job from this one.
 */
export function pageThemeCssVars(theme: ResolvedTheme): string {
  const p = theme.palette;
  return [
    `--sidebar-color: ${p.accent};`,
    `--link-color: ${p.accent};`,
    `--border-color: ${p.edge};`,
  ].join("\n  ");
}

/**
 * The minimal shape of a declared image this module needs.
 *
 * **Structural on purpose, rather than importing `KgImage`.** `theme.ts` imports
 * nothing but `zod`, and that is worth keeping: `kg-node.ts` is reached from
 * `cat-harness.ts`, which is the module a theme may end up being read *by*, and
 * this module's own sibling `block-kinds.ts` exists entirely because one
 * schema module importing another at module scope produced a runtime cycle
 * whose symptom was an `undefined` import during initialisation.
 *
 * `KgImage` satisfies this shape, so a caller passes `decl.images` unchanged
 * and the compiler checks the join.
 */
export interface DeclaredImage {
  role?: string | undefined;
  layout?: string | undefined;
  src: string;
  width?: number | undefined;
  height?: number | undefined;
  /**
   * The quiet interior a sticky's words sit in, in fractions of this image.
   *
   * Declared per LAYOUT, because the cloud is in a different place in each crop
   * — that is what the three regions on the `landing` role record, and why the
   * owner's instruction names *"the various clouds positions … across three
   * layouts"* rather than one.
   *
   * Structural here, like the rest of this interface, so `KgImage` satisfies it
   * without this module importing `kg-node.ts` and risking the cycle the doc
   * above describes.
   */
  textRegion?: { x: number; y: number; w: number; h: number } | undefined;
  /**
   * The part of this image that IS the avatar, in fractions of it — `603s`.
   *
   * Structural for the same reason as `textRegion`, and declared per IMAGE
   * rather than per role because the cat sits in a different place in every
   * composition: the seven measured boxes share no two values.
   *
   * A consumer wanting an avatar wants the CARD layout, because
   * `KgImageSchema` refuses a non-square box in PIXELS and only the square
   * crop can satisfy that. Equal fractions on a landscape image are a box
   * 1.78x wider than tall, and the clip scales width and height separately.
   */
  avatarRegion?: { x: number; y: number; w: number; h: number } | undefined;
}

/** What {@link resolveThemeBackdrop} found, so a caller can REPORT a gap. */
export interface ResolvedBackdrop {
  /** The art per layout. Complete, or empty — never partial; see below. */
  art: Map<ThemeLayout, DeclaredImage>;
  /**
   * The layouts the layer does not supply for this theme's role.
   *
   * Non-empty means `art` is **empty**: an incomplete backdrop is refused
   * wholesale rather than served partially, because the failure of a partial
   * one is silent. A phone handed the laptop crop shows the art's quiet area in
   * the wrong place, and nothing reports it — which is exactly the substitution
   * `pickLayout` exists to make visible, and the reason this module's `layouts`
   * field has no fallback either.
   */
  missing: ThemeLayout[];
  /** `true` when the theme declares no backdrop at all — not a gap. */
  none: boolean;
}

/**
 * Resolve a theme's backdrop against a layer's declared images.
 *
 * Three outcomes, and the third is why this returns a record rather than a map:
 *
 * | | meaning |
 * |---|---|
 * | `none` | the theme declares no backdrop. Palette-only, and ordinary. |
 * | `missing` non-empty | the theme wants art this layer does not declare. |
 * | `art` complete | all three layouts resolved. |
 *
 * **`none` and `missing` are different facts and must not collapse.** A
 * palette-only theme is a choice; a theme whose role resolves to two of three
 * crops is a declaration bug in the *layer*. Returning a bare empty map for
 * both would make the second unreportable — the shape of the `targetLabel`
 * conflation `note-anchor.ts` was written to undo.
 */
export function resolveThemeBackdrop(
  theme: ResolvedTheme,
  images: readonly DeclaredImage[] | undefined,
): ResolvedBackdrop {
  if (!theme.backdrop) return { art: new Map(), missing: [], none: true };
  const role = theme.backdrop.imageRole;
  const byLayout = new Map<ThemeLayout, DeclaredImage>();
  for (const i of images ?? []) {
    if (i.role !== role || i.layout === undefined) continue;
    const l = THEME_LAYOUTS.find((t) => t === i.layout);
    // The FIRST entry for a layout wins, the same rule `imageForRole` uses for
    // a repeated role: deterministic, and left to the declaration's own
    // validation to complain about rather than silently preferring the last.
    if (l !== undefined && !byLayout.has(l)) byLayout.set(l, i);
  }
  const missing = THEME_LAYOUTS.filter((l) => !byLayout.has(l));
  return missing.length > 0
    ? { art: new Map(), missing, none: false }
    : { art: byLayout, missing: [], none: false };
}

/**
 * A todo that carries a theme.
 *
 * @see {@link ThemeSchema}
 *
 * **`ThemedTodo` extends `Todo`; it does not replace it.** The same relation
 * `paper` has to `document` and for the same reason: a themed todo IS a todo,
 * so everything that reads a todo keeps working and only the sticky renderer
 * needs to know about themes. Making it a separate kind would have forced every
 * consumer to handle two shapes for one thing.
 *
 * **`theme` is optional, and that is a third state rather than laziness.** A
 * todo with no theme is not a todo with the default theme — it is one nobody
 * has chosen for, which is exactly what the CSS's
 * `.fa-sticky-board:not([data-fa-sticky-theme])` rule renders. Defaulting the
 * field at rest would erase the difference between *unchosen* and *chose the
 * default*, and the day the default changes, every unchosen sticky would
 * silently keep the old one.
 *
 * The id is validated for SHAPE here and not for existence: whether a theme is
 * installed is a question about the layer's theme set, which a todo cannot
 * see. {@link themeById} answers it at render time, where a missing theme
 * degrades to the default rather than failing the page.
 */
export const ThemedTodoFieldsSchema = z
  .object({
    theme: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "a theme id is lowercase kebab-case")
      .optional(),
    /**
     * Which of the theme's three crops this sticky shows. ABSENT means the
     * square `card` crop, on every screen — owner, 2026-09-24: *"i want sticky
     * themes to by default use the square avatar layout but mostly faded, if
     * not specified."* Absent rather than defaulted, for the same reason as
     * `theme`: "the author chose card" and "nobody chose" stay distinguishable.
     */
    layout: z.enum(THEME_LAYOUTS).optional(),
  })
  .strict();
export type ThemedTodoFields = z.infer<typeof ThemedTodoFieldsSchema>;

/**
 * `themed` as a mixin node kind: a parent a kind declares to carry a `theme`.
 * No `$schema` of its own; it is a layer, not a file type (bean `a1lq`).
 */
export const ThemedKind = nodeKind("themed", [], ThemedTodoFieldsSchema.shape);

/**
 * Every user-facing string a theme contributes, for extraction.
 *
 * The owner asked for translatable themes. What a reader sees is the **name**
 * and the **description**; a palette value is not language-dependent, and
 * running one through translation would invite a locale to diverge on a value
 * the CSS has to agree on across every locale of the same page.
 */
export function themeTranslatableStrings(theme: ResolvedTheme): string[] {
  return theme.description ? [theme.name, theme.description] : [theme.name];
}
