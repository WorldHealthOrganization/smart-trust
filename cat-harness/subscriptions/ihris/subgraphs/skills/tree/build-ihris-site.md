---
name: build-ihris-site
description: >
  Build and publish the iHRIS-themed harness site (litlfred.github.io/ihris/):
  derive the theme from the verified release's own stylesheets, generate the
  landing board and the data-model pages from committed data, check every link
  and both viewports, and let the Pages workflow deploy it.
input: src/schemas/skills/build-ihris-site/input.schema.json
output: src/schemas/skills/build-ihris-site/output.schema.json
---

# Build the ihris site

Owner, 2026-09-23: the site is published from this repository and styled like iHRIS (Classic Manage), with the iHRIS logo credited under the GPL. The data-model pages follow the accepted wireframe H2 (`docs/design/wireframes/data-model-site/acceptance.json`).

## 1. Theme (Tool `ihris-extract-theme`)

```sh
python3 src/tools/extract_theme.py          # needs uploads/ihris-suite-4.3.3/*.tar.bz2
```

- It reads `globalStyles.css`, then `themeStyles.css`, in cascade order, and writes `src/site/theme/ihris-classic.json` (`ihris-site-theme/v1`) and the logo.
- Every token records the selector and file it was measured from.
- **Never hand-edit a colour.** Where a measured colour fails WCAG AA in its role, the tool picks another colour *measured from the same stylesheets* and records the reason in `adjustments`.
- To change the look, change the rules in the tool.

**The dark scheme (Tool `ihris-derive-dark-theme`).** The release has no dark stylesheet, so a dark palette cannot be measured. What a person decides is kept small and written down in `src/site/theme/ihris-classic-dark.grounds.json` (`ihris-site-theme-dark-grounds/v1`): how dark the grounds are, each on the hue of a measured colour, the WCAG targets, and how the logo is shown. The owner chose it through `wireframe-design-review` (`docs/design/wireframes/dark-scheme/`, 2026-10-09). Every other colour is derived into `src/site/theme/ihris-classic-dark.json`: it keeps its light role's hue and saturation and takes the lowest lightness that reaches its target on every ground. A new palette is a new round of that review, never a hand-edited colour.

```sh
python3 src/tools/derive_dark_theme.py            # after the light theme or the grounds change
```

## 2. Site (Tool `ihris-build-site`)

The generator is `src/tools/build_site.py`, with the data-model pages and chrome. `src/tools/site_instances.py` holds every other instance's pages. Licence decides what a page shows (AGENTS.md §2.4):
- GPL sources, modules, data lists and wiki pages: in full, with attribution.
- The toolkit: its text is published because its declaration records the owner's permission (2026-09-23). Without that record, it falls back to structure only. Its reader comments are never published.
- `iHRIS/ihris-documentation` (no licence): path and heading only.

```sh
python3 src/tools/build_site.py --out .build/site --check-links
```

- Everything is generated:
  - the landing board, from `ihris.json` and each instance's `<name>.json`;
  - one page per package and per class, from `src/*/data-model/4.3.3`;
  - `glossary/`, from `glossary/*.glossary.json` (skill `build-skos-glossary`), with each scheme's SKOS JSON-LD under `assets/glossary/`;
  - `data-model/search.html`, which searches the data model AND the glossary, at the data model's URL.
- Links are relative, so the site works under `/ihris/` and from a file.
- `_site/` is git-ignored. Never commit the output.

## 3. Check both viewports

Every page is checked for horizontal overflow at web 1280×800 and mobile 390×844. A page that overflows on either is a defect in the generator's CSS, not in the page. `validate.py` builds the site and fails on any broken link.

## 4. The folio chrome (Tool `ihris-rail-site`)

Every page carries the platform's chrome: the harness rail, its icon row, the Folio glass and the light/dark switch, the same on every folio a reader browses. It is added AFTER the build, never by the site generator, and it is the platform's own mechanism for a folio's own pages site, so there is one chrome and no second copy to drift. The chrome's code loads from the platform's published site; only the rail's data is written beside the pages.

The rail is **scoped to this folio**: it lists ihris and the harnesses it needs, never the platform's whole list (owner, 2026-10-09: "does not need to depend on smart-base or smart-trust"). The platform's harness data is regenerated from this checkout first, which writes inside the mounted platform layer: harmless in a throwaway build, and a local checkout remounts afterwards.

Check it in a browser, with the platform's own chrome check. The staging-banner check applies to previews only.

**The work plan is a page of this site** (Tool `ihris-gen-beans-data`). The navbar's beans icon opens it and carries the number of open beans, both THIS folio's, never the platform's: the board is the platform's own work-plan board, drawn from this folio's bean store with the platform's own functions, so it reads as it does on every folio. Because ihris is the root of its checkout, the platform's rail keeps its own pages, the beans count and its mark on this site.

**The chrome's mark is the iHRIS logo** (ihris.json `icon`, `images`): the logo for a dark ground, because the rail is dark in both schemes, written with the dark theme. Its image declares `ground: none`, so the rail draws it with no tone square behind it.

**The light/dark switch decides the scheme** (Tool `ihris-scheme-css`). The dark colours are applied with the platform's own scheme functions, so the reader's choice wins and the OS decides only until they choose, and a page restores the reader's choice at first paint instead of flashing light first.

## 5. Publish (the `gh-pages` branch)

- The site is served from the **`gh-pages` branch**, which holds build output only.
- `.github/workflows/pages.yml` rebuilds it on every push to `main` and commits the result on top of `gh-pages`. When nothing changed, it makes no commit.
- One-time owner setting: **Settings → Pages → Source: Deploy from a branch → `gh-pages` / (root)**.
- Never edit `gh-pages` by hand. Change the generator and let the workflow publish.
