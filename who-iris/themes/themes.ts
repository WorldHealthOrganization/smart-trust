/**
 * The WHO themes — two measured (bean `j66n`), one derived from them (bean `v8n5`).
 *
 * @module who-iris/themes/themes
 * @graphNode themes
 *
 * ## Why these live in `who-iris/` and not in `cat-harness/schemas/themes.ts`
 *
 * The platform ships twelve themes and they are the platform's own furniture.
 * These two are **WHO's**, derived from WHO's artefacts, and the root
 * `AGENTS.md` states the line they would cross: *"If you are about to write
 * subject matter here, you are either in the wrong repo or writing something
 * that belongs in the folio as data."* A palette read off a WHO style guide is
 * subject matter.
 *
 * They still go through the platform's `resolveTheme` with
 * `instance: "who-iris"` rather than a shortcut, which is what
 * `themes.ts` already anticipated in prose — *"They go through the same
 * function a who-iris theme will"*. That sentence is now true.
 *
 * ## Two sources, one artefact — which is what makes this the worked example
 *
 * `wpr-rdo-2020-003-eng` is both:
 *
 *   - the **item whose IRIS page** carries a DSpace deployment's theme, and
 *   - the **document whose contents** are the WHO publication rules.
 *
 * So `iris-web` is measured from the captured page assets and
 * `who-wpro-publication` from the ingested document's own text. Neither is
 * read off a screenshot and neither is inferred from the other.
 *
 * ## Every value below is measured, and the tests read the SOURCES
 *
 * `themes.test.ts` does not compare these constants against a copy of
 * themselves. It re-reads `client-theme.css` out of the committed capture zip
 * and the style guide's ingested page text, and asserts the values here match
 * what those files say. If the capture is ever re-taken and IRIS has
 * re-skinned, the tests fail rather than the theme quietly describing a site
 * that no longer looks like this.
 *
 * ## Two contradictions IN THE SOURCE, recorded rather than resolved
 *
 * Neither is a transcription error on our side; both are what the document
 * says, and `RECORDED_CONTRADICTIONS` below is asserted by a test so a later
 * tidy-up cannot quietly drop them.
 */
import {
  THEME_SCHEMA_TAG,
  ThemeSchema,
  explainThemeFailure,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
  DEFAULT_THEME_ID,
  themeById,
} from "../platform.ts";

/** The instance these themes belong to. `themeKey` keys on it; ids are not unique across instances. */
export const THEME_INSTANCE = "who-iris";

/** The same instance as a REFERENCE names it — its planned `owner/repo` (bean `6rmv`). */
export const THEME_REPOSITORY = "litlfred/who-iris";

/**
 * Contradictions in the WHO style guide, kept as data.
 *
 * The `deletion-requires-confirmation` reasoning applied to a *fact*: a
 * contradiction silently resolved is indistinguishable from one nobody
 * noticed. A later reader comparing our theme against the PDF has to be able
 * to find out that we saw it.
 */
export const RECORDED_CONTRADICTIONS = [
  {
    id: "black-logo-k100-vs-rgb-100",
    where: "page 6, 'The WHO WPRO logo'",
    says: "C: 0 M: 0 Y: 0 K: 100  /  R: 100 G: 100 B: 100",
    problem:
      "K:100 is process black (#000000); R:100 G:100 B:100 is a mid grey (#646464). " +
      "One swatch cannot be both, and the two differ by far more than a rendering-intent gap.",
    weTook:
      "K:100, i.e. #000000, for `ink` — because this is a PRINT theme and CMYK is the " +
      "print specification. Stated as a choice between two source readings, not as a " +
      "correction of the source. R:100 G:100 B:100 is most likely a slip for 0/0/0, but " +
      "'most likely' is not something a theme gets to assert.",
  },
  {
    id: "logo-blue-c95-vs-c90",
    where: "page 6 against page 12",
    says: "page 6 gives the logo blue as C: 95 M: 25 Y: 0 K: 0; page 12 gives the same RGB value as C: 90 M: 25 Y: 0 K: 0",
    problem:
      "Both pages print R: 0 G: 147 B: 213 beside their CMYK, so the two CMYK builds " +
      "disagree about the same colour by 5% cyan.",
    weTook:
      "The RGB value #0093D5, which BOTH pages agree on. The disagreement is only in the " +
      "CMYK build, and a screen theme does not carry one.",
  },
] as const;

/**
 * `iris-web` — the IRIS deployment's own theme.
 *
 * Source: `who-iris/uploads/wpr-rdo-2020-003-eng/iris-capture/Publication and
 * information products style guide_files.zip`, member `client-theme.css`
 * (570,732 bytes), the compiled theme DSpace served with the item page.
 *
 * ## The palette, role by role, with the declaration each came from
 *
 * | role | value | read from |
 * |---|---|---|
 * | `surface` | `#ffffff` | `body{…background-color:#fff}` |
 * | `ink` | `#212529` | `body{…color:#212529}` |
 * | `edge` | `#ced4da` | `--ds-header-navbar-border-bottom-color` |
 * | `accent` | `#008dc9` | `--primary` |
 *
 * **`--blue: #2B4E72` is NOT the accent**, though it is the most
 * brand-looking value in the file. Bootstrap's `--blue` is a *scale* entry;
 * `--primary` is the *role*, and DSpace sets them to different values here
 * precisely because they answer different questions. Taking the prettier one
 * would be the hardcoding `theme.ts` exists to end, one level up.
 *
 * **No gradient.** The source declares none, and a theme may not invent one —
 * `ThemePaletteSchema` refuses a single-stop gradient anyway.
 *
 * ## Geometry: column widths, not breakpoints
 *
 * `ThemeGeometry.minWidth` is documented as *"minimum column width before the
 * grid reflows"*. The obvious fill is `--breakpoint-lg: 992px`, and it is a
 * category error — a breakpoint is a viewport, not a column. The values below
 * are real column widths the stylesheet declares:
 *
 *   - `1140px` — the widest `.container{max-width:…}` in the file (540 / 720 /
 *     960 / 1140 all occur).
 *   - `100%` — `.container` carries no `max-width` outside those rules, so the
 *     narrow case is fluid.
 *   - `250px` — `--ds-sidebar-items-width`, the narrowest column DSpace names.
 *
 * `fontScale` is `1` at every size, and that is a MEASUREMENT rather than a
 * placeholder: `body{…font-size:1rem}` and the file declares no per-breakpoint
 * body scale. The platform's sticky themes use 1.05 / 0.95; copying those here
 * would have described a site this one is not.
 */
const IRIS_WEB = {
  $schema: THEME_SCHEMA_TAG,
  kind: "webpage",
  id: "iris-web",
  name: "IRIS",
  description: "The WHO IRIS repository's own web theme, read off the captured DSpace stylesheet.",
  palette: {
    surface: "#ffffff",
    ink: "#212529",
    edge: "#ced4da",
    accent: "#008dc9",
  },
  layouts: {
    laptop: { minWidth: "1140px", padding: "1.5rem", fontScale: 1 },
    mobile: { minWidth: "100%", padding: "1.5rem", fontScale: 1 },
    card: { minWidth: "250px", padding: "1.5rem", fontScale: 1 },
  },
} as const;

/**
 * `who-wpro-publication` — the WHO Western Pacific publication theme.
 *
 * Source: the ingested style guide itself,
 * `who-iris/library/wpr-rdo-2020-003-eng/sections/`, which is the document
 * that *states* these rules rather than a site that happens to use them.
 *
 * ## The palette
 *
 * | role | value | read from |
 * |---|---|---|
 * | `surface` | `#ffffff` | the page. See below — this one is definitional, not measured. |
 * | `ink` | `#000000` | page 6, `K: 100`. One side of a recorded contradiction. |
 * | `edge` | `#74CEE2` | page 12, primary palette, lightest blue (`R: 116 G: 206 B: 226`) |
 * | `accent` | `#0093D5` | page 6 AND page 12, `R: 0 G: 147 B: 213` — the WPRO logo blue |
 *
 * **`edge` is the one value in this theme that is a CHOICE, and it is flagged
 * rather than dressed up.** The guide states no rule, border or divider colour
 * anywhere in its 33 pages — grepped, not assumed. So `edge` takes the
 * lightest blue of the palette the guide *does* state, instead of a
 * plausible-looking grey from nowhere. It is the field to overrule first, and
 * a test pins it to membership of the stated primary palette so a future edit
 * cannot drift it out of the brand while looking harmless.
 *
 * `surface` is white because that is the page. The guide states no paper tint
 * anywhere, and for a print theme an unstated substrate is not a gap the way
 * an unstated rule colour is.
 *
 * ## Geometry: the three PRINT formats, from page 18
 *
 * *"Frequently used formats and specs"* — A4 `21 cm x 29.7 cm`, A5
 * `14.8 cm x 21 cm`, A5 landscape `21 cm x 14.8 cm`. Kept in the source's own
 * units, as `PrintGeometrySchema` requires: rewriting `29.7cm` as millimetres
 * is a conversion nobody asked for and a chance to be wrong.
 *
 * `margin` is the **1 cm logo exclusion zone** from page 7 (*"at least 1cm
 * width distance"*), cited as such and not as a page margin — the guide states
 * no page margin, and `PrintGeometrySchema`'s own doc comment already fixed
 * this convention for exactly this document.
 *
 * `fontScale` is `1` on A4 and A5 alike. Page 14 gives the primary typefaces
 * at **10 pt** for all four — News Gothic MT, DIN OT, PT Sans, Calibri — with
 * no format-dependent size, so a scale that varied by format would be stating
 * a rule the guide does not have.
 */
const WHO_WPRO_PUBLICATION = {
  $schema: THEME_SCHEMA_TAG,
  kind: "publication",
  id: "who-wpro-publication",
  name: "WHO Western Pacific publications",
  description: "The WPRO publication style, read off the style guide's own pages 6, 7, 12, 14 and 18.",
  palette: {
    surface: "#ffffff",
    ink: "#000000",
    edge: "#74CEE2",
    accent: "#0093D5",
  },
  layouts: {
    a4: { width: "21cm", height: "29.7cm", margin: "1cm", fontScale: 1 },
    a5: { width: "14.8cm", height: "21cm", margin: "1cm", fontScale: 1 },
    a5Landscape: { width: "21cm", height: "14.8cm", margin: "1cm", fontScale: 1 },
  },
} as const;

/**
 * The style guide's primary colour palette, page 12, as twelve RGB values.
 *
 * Three columns (blue / green / warm) by four rows (dark to light), read in
 * the order the page's text layer gives them. Kept here because `edge`'s
 * membership of it is what makes that one choice checkable, and because a
 * later theme drawing on the same palette should not re-transcribe it.
 */
export const WPRO_PRIMARY_PALETTE = [
  "#0066CC", "#009F4F", "#C71F3A",
  "#0093D5", "#39B54A", "#F15A3A",
  "#00AEEF", "#8DC63F", "#FFC20E",
  "#74CEE2", "#CBDB2A", "#FFF200",
] as const;

/**
 * `iris-sticky` — the IRIS palette on the NOTE BOARD. Bean `v8n5`, owner's
 * ruling 2026-09-30: *"Author iris-sticky"*.
 *
 * ## Why a third theme rather than citing `iris-web`
 *
 * The note board styles a card only from a `sticky`-kind theme
 * (`cat-harness-tools/scripts/gen-themes-css.ts`: a webpage theme *"shares the
 * geometry but not this stylesheet"*). `iris-web` is a `webpage` theme, so a
 * who-iris card, board tile or navbar entry could not cite it without changing
 * that platform rule. This theme is the sticky-kind face of the same palette.
 *
 * ## DERIVED, not measured — and the derivation is the mechanism, not a copy
 *
 * It `inherits` `iris-web`, so every palette role — `accent #008dc9`,
 * `surface #ffffff`, `ink #212529`, `edge #ced4da` — arrives through
 * `resolveTheme`'s field-by-field palette merge from the theme that was
 * MEASURED off the captured DSpace stylesheet (`client-theme.css`, see
 * {@link IRIS_WEB}). Not one colour is written here, so re-measuring
 * `iris-web` re-colours this theme with no edit, and `themes.test.ts` asserts
 * the resolved palette equals what the capture says — reading the zip, not
 * this file.
 *
 * ## Geometry: the note board's own, because IRIS has no sticky notes
 *
 * `resolveTheme` resets geometry on a kind change (*"there is nothing shared
 * to carry"*), so a sticky child must state its three viewports. IRIS declares
 * no card surface to measure them from, and `iris-web`'s `1140px` is a page
 * column: a note that wide would not be a note. So the layouts are READ from
 * the platform's default sticky theme — the board's own furniture — rather
 * than invented here or restated as literals.
 *
 * No `backdrop`: IRIS's own imagery is somebody else's artefact (`10s1`), and
 * a palette-only card is a state the board already renders.
 */
const platformSticky = themeById(DEFAULT_THEME_ID);
if (platformSticky?.kind !== "sticky") {
  throw new Error(`iris-sticky: the platform default theme "${DEFAULT_THEME_ID}" is not a sticky theme, so there is no board geometry to take`);
}
const IRIS_STICKY: Theme = {
  $schema: THEME_SCHEMA_TAG,
  kind: "sticky",
  id: "iris-sticky",
  inherits: { instance: THEME_REPOSITORY, themeId: IRIS_WEB.id },
  name: "IRIS note",
  description:
    "The IRIS palette on a sticky note — derived from iris-web, itself measured from the captured DSpace stylesheet.",
  layouts: platformSticky.layouts,
};

const RAW: readonly Theme[] = [IRIS_WEB, WHO_WPRO_PUBLICATION, IRIS_STICKY];

/**
 * Resolved, through the platform's own resolver.
 *
 * `iris-web` and `who-wpro-publication` inherit nothing, so for them
 * resolution is a parse; `iris-sticky` inherits `iris-web`, which is why this
 * goes through `resolveTheme` rather than `ResolvedThemeSchema.parse`.
 *
 * A missing layout throws here rather than degrading, which is `j66n`'s fourth
 * clause: *"Every layout still required; a missing layout stays INVALID, never
 * degraded."*
 */
const DECLARED: readonly Theme[] = RAW.map((t) => ThemeSchema.parse(t));

/** A parent within THIS instance — the only owner a who-iris theme inherits from today. */
function ownParent(ref: { instance?: string; themeId: string }): { instance: string; theme: Theme } | undefined {
  if (ref.instance !== undefined && ref.instance !== THEME_REPOSITORY && ref.instance !== THEME_INSTANCE) return undefined;
  const theme = DECLARED.find((t) => t.id === ref.themeId);
  return theme ? { instance: THEME_INSTANCE, theme } : undefined;
}

export const WHO_THEMES: readonly ResolvedTheme[] = DECLARED.map((declared) => {
  const r = resolveTheme({ instance: THEME_INSTANCE, theme: declared }, ownParent);
  if (!r.ok) throw new Error(`theme ${declared.id}: ${explainThemeFailure(r.failure)}`);
  return r.theme;
});

export function whoThemeById(id: string): ResolvedTheme | undefined {
  return WHO_THEMES.find((t) => t.id === id);
}

/**
 * The conventional export a harness reads to resolve `{instance: "who-iris",
 * themeId}` (bean `v8n5`, `cat-harness/schemas/theme-by-ref.ts`). The same
 * list as {@link WHO_THEMES}, under the name every instance's `themes.ts`
 * carries, so the platform can find an instance's themes by its declaration
 * without importing this file or holding any of its values.
 */
export const INSTANCE_THEMES: readonly ResolvedTheme[] = WHO_THEMES;
