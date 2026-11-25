---
name: web-apps
description: >
  Interactive web apps as knowledge-graph content: a layer holds an app's
  source in a directory of kind `web-app` (one `web-app.json`), its UI
  strings go through the harness's translation process like any template,
  and the harness's `apps` visualiser (Tool `web-app-build`) builds it at
  publish and writes it to its own route with no site chrome, loaded only
  when a reader opens it. Read before adding an app to any layer, before
  writing a publish script for one (do not), and when an app's build or
  translations fail.
graph-typologies: [web-app]
---

# Web apps — an app is content, the harness publishes it

> Skill id: `web-apps` · Package: `ui-core` · Kind: `web-app` · Tool:
> `web-app-build` (`bun run cat web-apps:build`) · Process:
> [`web-app-publish`](../../../processes/ui/web-app-publish.bpmn)

## The rule

**A layer that carries an app declares it; it does not publish it.** Owner,
2026-11-11 (cards Q-GAME-5 A and Q-GAME-7 A): a content layer with an app
(a WHO onboarding game was the first) must not become a harness to ship
it, and the one-off route VaxLink used (`web/` + its own `publish.sh` +
`site.build.keep`) is retired. The kind and its visualiser are the harness's,
so every layer that mounts cat-harness gets them.

Before writing an app at all, ask whether it is a journey: a walkthrough of
people and steps is a `user-scenario` and a `workshop` drawn by the
[`journeys-viewer`](journey-maps.md), not an app. An app is for what a page
cannot be: a game, a simulation, a 3D world.

## Declaring one

1. Put the app's source in a directory of the layer, with its `package.json`
   and a lockfile (`package-lock.json` for npm, `bun.lock` for bun): the build
   installs exact versions only.
2. Declare the directory in the layer's `<name>.json` with
   `"graphTypologies": ["web-app"]`.
3. Put a `web-app.json` (`web-app/0.1.0`, the schema the Tool
   `web-app-build` reads) at its root:

```json
{
  "$schema": "web-app/0.1.0",
  "id": "onboarding-game",
  "title": "Join the Network",
  "description": "A country onboards to the GDHCN, one choice at a time.",
  "build": { "installer": "npm", "script": "build", "outDir": "dist" },
  "locales": ["en", "ar", "es", "fr", "ru", "zh"],
  "i18n": { "catalog": "src/i18n/en.json", "out": "public/i18n" },
  "contentFrom": ["business-processes", "glossary"],
  "sizeBudgetMB": 45,
  "license": "Apache-2.0",
  "source": { "repository": "https://github.com/carlsbox/gdhcn-onboarding-game", "commit": "bd4c34c" }
}
```

| field | rule |
|---|---|
| `id` | lower-case kebab; the route segment. Two layers claiming one id is a declaration error naming both. |
| `build` | defaults `npm` / `build` / `dist`. The app must build with relative asset paths (Vite `base: './'`), since its route is computed, not chosen. |
| `chrome` | always `none` (the default): the app draws its own frame. |
| `locales` | the first is the source language. A WHO layer ships the six UN languages: ar, en, es, fr, ru, zh. Arabic is right to left: the app sets `dir="rtl"` for it. |
| `contentFrom` | the layer's own directory ids the app reads at build time. An app reads the layer's content (its BPMN, glossary, actors, instances) at build time rather than copying it into code, so it cannot drift. |
| `sizeBudgetMB` | the index flags an app over it; the site size review reads it. |
| `license`, `source` | for a copied app: keep its LICENSE and a NOTICE naming the source commit. |

## Where it is published, and why it loads only when opened

| route | what |
|---|---|
| `<locale>/<harness>/apps/` | the index, in the site's chrome: one entry per app, its languages and size |
| `<locale>/<harness>/apps/<id>/` | the app's build, every page marked `<meta name="folio-navbar" content="none">` and `rendered-by: web-app-build` |

The route is computed by `visualiserRoute`, as for every visualiser
([`harness-tiles`](harness-tiles.md)). No other page embeds an app or loads
its scripts: a tile, an IG page or a journey **links** to it. So a reader
downloads an app only by opening its route. Inside the app, put heavy parts
(a 3D engine, films) behind a dynamic `import()` or `preload="none"` so the
first screen paints first.

### Lazy on screen, complete in print

Defer what a reader may never reach (owner, 2026-11-14: *"do lazy load
content and libs"*): images with `loading="lazy"` and `decoding="async"`,
libraries behind a dynamic `import()` on first use, a hidden panel or a
closed `<details>` drawn on its first open, a popout built when it is opened.

**Every deferral has a print path** (owner, 2026-11-14: *"make sure printing
loads all of the content before it renders the PDF on the browser"*). On
`beforeprint`, and in a Print button that waits before it calls
`window.print()`: switch lazy images to eager and wait for them, build and
open what is built on toggle, and write out text that only a popout shows.
`afterprint` closes again what the preparation opened. The library entry
page (`cat-harness-tools/scripts/lib/library-document.ts`, `docPrintPrep`) is
the worked example.

## Translating an app — the harness's process, not a second one

An app's UI strings are one more template to the translation process
([`translation-manager`](../../../library/skills/library-core/translation-manager.md),
[`translation-refresh`](../../../library/skills/library-core/translation-refresh.md),
`multi-locale-translation.bpmn`):

1. **Source catalog.** `i18n.catalog` is a flat JSON object `{ key: text }`
   in the source locale. Placeholders are `{name}`. Nothing else is
   translatable: no strings hard-coded in components.
2. **Templates.** `bun run cat web-apps:build --extract` writes
   `translations/<locale>/apps/<id>.pot` in the declaring layer, one
   `ui-string` entry per key with the key as `msgctxt`. Name this command in
   the layer's AGENTS.md §Translations as the app's "refresh the templates"
   step, so the watcher runs it.
3. **Translation.** Translators fill `translations/<locale>/apps/<id>.po`
   exactly as for pages and diagrams: one PR per locale, the fixed terms, the
   untainted round trip, officiality as the layer declares it.
4. **Injection is the build.** Before building, the Tool writes each locale's
   translated strings to `<i18n.out>/<locale>.json`. The app loads its
   locale's file and falls back to the source text per string.
5. **Gates.** `web-apps:build --check` fails on a stale template, a
   translation that drops or adds a `{placeholder}`, or a translation for a
   key the catalog no longer has. Untranslated strings are reported, never
   failed.

Media that speaks (narration, films) is not a string: list each clip per
locale in the app's own data, and say in the app when a locale has captions
only.

## Not this skill

Journeys and workshops: [`journey-maps`](journey-maps.md). Where a
visualiser's URL comes from: [`harness-tiles`](harness-tiles.md). The
site's size review: the `site:size` Tool.
