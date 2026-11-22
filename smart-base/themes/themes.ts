/**
 * The WHO SMART IG theme — measured from the template the IG actually builds with.
 *
 * @module smart-base/themes/themes
 * @graphNode themes
 *
 * Owner, 2026-09-30 (paraphrased): the site did not carry the CSS, branding
 * and style of the published WHO SMART Trust IG; then *"theme it, keep the
 * justthedocs machinery"*; then reuse all the existing just-the-docs
 * infrastructure but keep the styling of that published IG (except the
 * navbar, on the left rather than the top). Bean `7h3u`, issue #1682.
 *
 * ## Why this lives here and not in `cat-harness/schemas/themes.ts`
 *
 * `who-iris/themes/themes.ts` settled it: *"A palette read off a WHO style
 * guide is subject matter"*, and the root `AGENTS.md` draws that line. So a WHO
 * palette belongs to the WHO layer and still resolves through the platform's
 * `resolveTheme`. This file is that precedent applied a second time.
 *
 * **Which WHO layer:** smart-base, the harness every smart-* IG
 * instantiates. It was first written under the WHO SMART Trust IG's `themes/`, the IG it was
 * measured beside; stage D of the smart-* separation (#1767, bean `kg83`) moved
 * it here because the theme is the TEMPLATE's, and every IG wears it.
 *
 * ## The styling is NOT in the WHO SMART Trust IG's repository
 *
 * Measured 2026-09-30, and it is the finding that shaped this file. That
 * repository (@ `26635f7b05b`) carries **no branding CSS** — its only `.css` is
 * vendored swagger under `input/images/openapi/`. Its `ig.ini` selects
 * `template = #local-template`, and `local-template/package/package.json`
 * declares:
 *
 * ```json
 * { "base": "who.template.root", "dependencies": { "who.template.root": "current" } }
 * ```
 *
 * `who.template.root` is `WorldHealthOrganization/smart-ig-template`
 * (@ `82603d0795379c829c12c0e9cb15f022afa5c29e`), whose branding is
 * `content/assets/css/who.css` — vendored beside this file as
 * `upstream/who.css`, 705 lines. That package in turn declares
 * `base: fhir.base.template`, which is `HL7/ig-template-base`
 * (@ `849a8f5298f521a0af0a48256d4a0c5a83297664`).
 *
 * **Licence: `CC0-1.0`**, stated by `who.template.root`'s own `package.json`
 * (`"author": "World Health Organization"`). Vendoring is therefore
 * unambiguously permitted. CC0 requires no attribution; the shas above are the
 * record anyway, because provenance is what makes the table below checkable.
 *
 * ## The palette, role by role, with the declaration each came from
 *
 * | role | value | read from |
 * |---|---|---|
 * | `surface` | `#f6f7f9` | `who.css` `body{background-color:var(--toc-box-bg-color)}` → `--toc-box-bg-color` |
 * | `ink` | `#000000` | `who.css` `.container{color:#000 !important}` |
 * | `edge` | `#eeeeee` | `bootstrap-fhir.css` `hr{border-top:1px solid #eeeeee}` |
 * | `accent` | `#00477d` | `who.css` `--navbar-bg-color` |
 *
 * ### Three values that were NOT taken, and why
 *
 * This is the `who-iris` rule — *"`--blue` is NOT the accent … `--primary` is
 * the ROLE"* — applied three more times. Each of these is the prettier or more
 * frequent candidate, and each answers a different question from the role.
 *
 * **`#333333` is not `ink`, though it occurs more than any other dark value.**
 * Every one of `who.css`'s four `#333` declarations is `.dropdown-menu>li>a` —
 * dropdown link text. The base template *does* set `body{color:#333333}`, but
 * `who.css` overrides the page content with `.container{color:#000}`, and
 * `.container` wraps it. So the resolved ink is `#000000` and the `#333`
 * agreement between the two files is a **coincidence of value across two
 * roles**, which is exactly the trap worth naming rather than leaving for a
 * reader to re-derive.
 *
 * **`navy` is not `edge`.** `who.css` declares `--toc-box-border: navy`, the
 * only border colour the WHO layer names — but it is scoped to the TOC box.
 * `ThemePaletteSchema` documents `edge` as *"Border and rule colour"*, i.e. the
 * generic one, and the generic rule in the resolved cascade is the base's `hr`.
 * Taking `navy` would describe one component and paint every border with it.
 *
 * **`#000000` is not `surface`**, though the base declares
 * `body{background-color:#000000}`. `who.css` overrides it, and a theme
 * describing the site as it renders must take the override.
 *
 * ### No gradient
 *
 * Neither source declares one, and a theme may not invent one —
 * `ThemePaletteSchema` refuses a single-stop gradient in any case.
 *
 * ## Geometry: what the container declares, not a breakpoint
 *
 * Same category care as `who-iris`: `minWidth` is a **column width**, never a
 * viewport. `who.css` declares:
 *
 * ```css
 * .container { width: 100% !important; max-width: none !important; padding: 0 20px }
 * @media (min-width: 2200px) { .container { max-width: 1980px !important } }
 * ```
 *
 * So the container is **fluid by default** and caps at `1980px` only above a
 * 2200px viewport. `laptop` takes that cap — the one width the file declares —
 * and `mobile` and `card` take `100%`, which is the declared `width`, not a
 * guess at what a narrow column should be.
 *
 * `padding` is `20px` at every size because the file declares one value and no
 * per-breakpoint override.
 *
 * `fontScale` is `1` at every size, and that is a MEASUREMENT rather than a
 * placeholder: the base sets `body{font-size:14px}` and neither file declares a
 * per-breakpoint body scale. The platform's sticky themes use 1.05 / 0.95, and
 * copying those would describe a site this one is not.
 *
 * ## The one thing this theme deliberately does NOT reproduce
 *
 * **The top navbar.** The owner's carve-out: *"except navbar on LHS not top"*.
 * `who.css`'s layout rules are overwhelmingly `.navbar*` — `--navbar-bg-color`,
 * `.navbar-inverse`, `#segment-navbar .navbar .container` — and those are not
 * translated here. The nav stays where just-the-docs puts it, on the left, and
 * the WHO blue that dresses their top bar becomes this theme's `accent`.
 *
 * That is why a THEME is sufficient for what was asked. A theme carries colour
 * and geometry; the layout half of `who.css` is the half the owner asked not to
 * reproduce.
 *
 * ## THIS THEME IS DECLARED BUT NOT YET APPLIED — read this before believing the page changed
 *
 * Measured 2026-09-30, and stated here rather than discovered by someone
 * loading the page and seeing no difference.
 *
 * `cat-harness/scripts/gen-themes-css.ts` emits layer-declared **sticky**
 * themes (`instanceStickyThemes`, bean `v8n5`) and nothing else. A
 * `kind: "webpage"` theme declared by a layer has **no consumer** in the
 * build today. `who-iris` gets away with it because its own page GENERATOR
 * reads `iris-web` and writes literal colours into finished HTML — and that
 * path is unavailable here on purpose: `smart-trust-docs` is `composed: true`,
 * so its pages are markdown rendered through just-the-docs, which is exactly
 * the machinery the owner asked to keep.
 *
 * So what this file delivers is the **measurement** — which was the hard,
 * provenance-bearing half — and the two things it makes possible: a palette
 * that cannot drift from its source without a test failing, and a declaration
 * a consumer can find. **It does not change how the page looks.** Wiring it
 * needs one of:
 *
 *   1. `gen-themes-css` learning to emit layer WEBPAGE themes, scoped to
 *      that layer's page prefix, with the composed pages carrying the scope.
 *   2. `fhir-harness/scripts/gen-ig-pages.ts` (was `gen-smart-trust-pages.ts`) emitting the theme's `themeCssVars` into a
 *      per-layer stylesheet the composed pages include.
 *
 * (1) is platform code and would serve every future ingested IG; (2) is local
 * and serves one. That is a boundary decision rather than a coding one, so it
 * is left to the owner rather than taken here.
 *
 * ## Not established
 *
 * How much of `who.css` beyond `--navbar-*` is structural rather than palette.
 * Its 705 lines have not been classified line by line, so "this theme carries
 * everything a theme could carry from that file" is **not** a claim made here.
 */
import {
  THEME_SCHEMA_TAG,
  explainThemeFailure,
  resolveTheme,
  type ResolvedTheme,
  type Theme,
} from "../platform/schema.js";
import { smartRepository } from "../schemas/site-roots.ts";

/** The layer these themes belong to. `themeKey` keys on it; ids are not unique across layers. */
export const THEME_INSTANCE = "smart-base";

/** The same layer as a REFERENCE names it — its planned `owner/repo` (bean `6rmv`). */
export const THEME_REPOSITORY = smartRepository("smart-base");

/**
 * The upstream sources, pinned — what `themes.test.ts` re-reads.
 *
 * A sha rather than "current" on purpose. `local-template` depends on
 * `who.template.root#current`, so upstream can re-skin under us; pinning is
 * what lets the test say WHICH version this theme describes, and fail loudly
 * rather than describing a site that no longer looks like this.
 */
export const UPSTREAM = {
  /**
   * The IG whose look this reproduces. Carries no branding CSS of its own.
   * Recorded as the published repository's ADDRESS: it is where the look was
   * observed, not a layer this one depends on.
   */
  ig: { url: "https://github.com/WorldHealthOrganization/smart-trust", sha: "26635f7b05b647bb4f15a526bac79d23cff57056" },
  /** `who.template.root` — where the branding actually lives. CC0-1.0. */
  template: {
    repo: "WorldHealthOrganization/smart-ig-template",
    sha: "82603d0795379c829c12c0e9cb15f022afa5c29e",
    css: "content/assets/css/who.css",
    licence: "CC0-1.0",
    /** Vendored beside this file, so the test reads a committed artefact rather than the network. */
    vendored: "upstream/who.css",
  },
  /** `fhir.base.template` — where `edge` comes from, since `who.css` names no generic rule colour. */
  base: {
    repo: "HL7/ig-template-base",
    sha: "849a8f5298f521a0af0a48256d4a0c5a83297664",
    css: "content/assets/css/bootstrap-fhir.css",
  },
} as const;

/**
 * `who-smart-ig` — the WHO SMART IG template's web theme.
 *
 * Named for the TEMPLATE rather than for the WHO SMART Trust IG, because that is what it
 * was measured from and every WHO SMART IG builds with the same one. A second
 * ingested IG gets this theme rather than a copy of it.
 */
const WHO_SMART_IG = {
  $schema: THEME_SCHEMA_TAG,
  kind: "webpage",
  id: "who-smart-ig",
  name: "WHO SMART IG",
  description:
    "The WHO SMART implementation-guide template's web theme, read off who.template.root's own stylesheet. Colour and geometry only — the top navbar is deliberately not reproduced.",
  palette: {
    surface: "#f6f7f9",
    ink: "#000000",
    edge: "#eeeeee",
    accent: "#00477d",
  },
  layouts: {
    laptop: { minWidth: "1980px", padding: "20px", fontScale: 1 },
    mobile: { minWidth: "100%", padding: "20px", fontScale: 1 },
    card: { minWidth: "100%", padding: "20px", fontScale: 1 },
  },
} as const;

/** Every theme this layer declares. */
const DECLARED: readonly Theme[] = [WHO_SMART_IG];

function ownParent(ref: { instance?: string; themeId: string }): { instance: string; theme: Theme } | undefined {
  if (ref.instance !== undefined && ref.instance !== THEME_REPOSITORY && ref.instance !== THEME_INSTANCE) return undefined;
  const theme = DECLARED.find((t) => t.id === ref.themeId);
  return theme ? { instance: THEME_INSTANCE, theme } : undefined;
}

export const WHO_SMART_THEMES: readonly ResolvedTheme[] = DECLARED.map((declared) => {
  const r = resolveTheme({ instance: THEME_INSTANCE, theme: declared }, ownParent);
  if (!r.ok) throw new Error(`theme ${declared.id}: ${explainThemeFailure(r.failure)}`);
  return r.theme;
});

export function whoSmartThemeById(id: string): ResolvedTheme | undefined {
  return WHO_SMART_THEMES.find((t) => t.id === id);
}

/**
 * The conventional export the platform reads — the name, not a synonym.
 *
 * `theme-by-ref.ts` looks up `INSTANCE_THEMES_EXPORT`, which is the literal
 * string `"INSTANCE_THEMES"`. This file first exported `THEMES`, which reads
 * fine and is invisible to every consumer: `instanceThemes()` returned
 * `no-themes-module` for a module that was present, resolved and tested.
 *
 * The tests did not catch it because they import this file DIRECTLY, so they
 * exercised the theme and never the discovery. `themes.test.ts` now asserts
 * resolution through the platform's own path as well, which is the test that
 * would have caught it — a theme nothing can find is the `1xhc` shape: a
 * declaration that looks done and is reached by nobody.
 */
export const INSTANCE_THEMES: readonly ResolvedTheme[] = WHO_SMART_THEMES;
