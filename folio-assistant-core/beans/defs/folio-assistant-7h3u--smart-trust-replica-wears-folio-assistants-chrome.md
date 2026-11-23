---
# folio-assistant-7h3u
$schema: bean/1.0.0
title: smart-trust replica wears folio-assistant's chrome, not the WHO IG's branding
status: completed
type: task
priority: normal
created_at: 2026-09-30T20:04:11Z
updated_at: 2026-10-07T17:37:00Z
parent: folio-assistant-o3xy
---

**Owner, 2026-09-30:** *"does not make css/branding/style of
worldhealthorganization.github.io/smart-trust from
github.com/worldhealthorganization/smart-trust"*

Observed at <https://litlfred.github.io/folio-assistant/smart-trust/>: dark
background, folio-assistant's left rail and its purple **▾ Folio** handle. The
published WHO IG it replicates uses the HL7 IG-publisher template with WHO
branding. Screenshot supplied by the owner.

## QUEUED, not started

Per the owner's standing instruction — *"in chats if I discuss a new task I
want you to queue/run in parallel, do not pivot unless explicitly told so"* —
nothing here is implemented. What follows is the cheap diagnosis only.

## The declaration already predicted this

`smart-trust/smart-trust.json`, the `smart-trust-docs` entry, sets
`"composed": true`, and its own `_comment_composed` says why that matters:

> Rendered THROUGH just-the-docs, not mounted after it. Owner, 2026-09-21:
> *"i want the input/page(s)/ content to be rendered viajustthedocs pipeline"*.
> These pages … compose into the Jekyll source at `_docs/smart-trust/` and come
> out as **ordinary folio pages** — sidebar, search, language bar.
> **`who-iris` does NOT set this and must not: it is a replica of IRIS, and
> just-the-docs' layout would replace IRIS's chrome with folio-assistant's.**

So the mechanism is understood and written down. `who-iris` is a replica and
mounts finished HTML; `smart-trust` is composed and therefore inherits
folio-assistant's chrome **by construction**. What is reported here is that
consequence arriving, not a surprise.

## The tension to settle — and it is the owner's, not an agent's

Two owner statements, nine days apart, that may or may not conflict:

| | asked for |
|---|---|
| 2026-09-21 | the pages rendered **via the just-the-docs pipeline** |
| 2026-09-30 | the **css / branding / style** of the published WHO IG |

They conflict only if "pipeline" was meant to include "chrome". They do **not**
conflict if the ask is just-the-docs' *machinery* — sidebar, search, language
bar, composition — wearing WHO's *skin*. That reading is available and is
probably the intended one, but it is a reading, and an agent choosing between
them silently is how one of these two instructions gets quietly dropped.

## Three shapes a fix could take — NOT chosen

1. **Theme it.** Keep `composed: true`; give the instance a WHO-branded theme.
   `who-iris/themes/` already exists, and `smart-trust` currently declares
   `theme: { themeId: "operations" }` — folio-assistant's own. Smallest change;
   keeps sidebar, search and language bar.
2. **Mount it like `who-iris`.** Drop `composed`, generate finished HTML with
   the IG-publisher template. Highest fidelity to the published IG, and loses
   exactly what `composed` was set for.
3. **Neither is right** — the ask is narrower than either, e.g. only the
   colours and the logo.

## Not established

- **Whether the WHO IG's CSS may be copied at all**, and under what attribution.
  The standing constraint is *"leave who/smart-* alone for now, just work on
  litlfred/*"* — reading upstream is fine, modifying it is not, so this is a
  licensing/attribution question about VENDORING, not a repo-access one.
- **How much of the difference is theme vs layout.** The screenshot shows
  colours and the nav rail; nobody has diffed the two pages' structure. A theme
  swap fixes the first and not the second, so the split decides whether (1) is
  even sufficient.

## Done when

- [ ] the owner says which of the three shapes is wanted — nothing is built
      before that
- [ ] whichever is chosen, the 2026-09-21 *"via justthedocs pipeline"*
      instruction is either satisfied or explicitly superseded IN WRITING, so
      the next agent does not read the change as a regression
- [ ] the `_comment_composed` in `smart-trust.json` is updated to match what is
      actually true afterwards — it is currently correct and would become the
      stale-guidance defect the moment this changes


## Owner ruling, 2026-09-30 — refined twice

1. *"theme it, keep the justthedocs machinery"* — **option 1**.
2. *"reuse all existing justthedocs infra (see sibling work on variable
   substitution) but keep styling of smart-trust (except navbar on LHS not
   top)"*

So: just-the-docs machinery and composition unchanged, WHO's **visual** style,
and the nav stays on the **left** rather than moving to the IG's top bar. The
LHS carve-out is what stops this being a pure replica and is the owner's, not
an inference.

## Both "not established" items above are now MEASURED

### The styling is not in `smart-trust` at all

`WorldHealthOrganization/smart-trust` @ `26635f7b05b` carries **no branding
CSS** — the only `.css` under it is vendored swagger
(`input/images/openapi/`). `local-template/` holds Liquid layouts for actor and
requirements pages and no styling.

`ig.ini` selects `template = #local-template`, and
`local-template/package/package.json` says where the look actually comes from:

```json
{ "name": "local.template", "license": "CC0-1.0",
  "base": "who.template.root",
  "dependencies": { "who.template.root": "current" } }
```

`who.template.root` is **`WorldHealthOrganization/smart-ig-template`**
@ `82603d0795379c829c12c0e9cb15f022afa5c29e`, whose own `package.json` reads:

```json
{ "name": "who.template.root", "version": "0.5.0",
  "license": "CC0-1.0", "author": "World Health Organization",
  "base": "fhir.base.template" }
```

The branding is `content/assets/css/who.css`, 705 lines.

### Licence: `CC0-1.0`

Public-domain dedication, stated by the template package itself. **Vendoring is
unambiguously permitted**; CC0 requires no attribution, though naming the
source is right anyway and the provenance shas above are the record. This
closes the licensing question raised earlier, and closes it with the
package's own declaration rather than an assumption about WHO material in
general.

### The palette is already expressed as NAMED ROLES

`who.css` does not scatter hex values — it declares custom properties, which is
the same discipline `cat-harness/schemas/theme.ts` exists to enforce (*"try to
use named css assets in KG rather than hardcoded colors"*). Measured:

```
--navbar-bg-color            #00477d     (WHO blue; the most frequent colour, 4×)
--footer-container-bg-color  #00477d
--ig-status-text-color       #00376d
--btn-hover-color            #0070A1
--btn-active-color           #0078d4
--footer-bg-color            #505050
--ig-header-color            #f6f7f9
--toc-box-bg-color           #f6f7f9
--toc-box-border             navy
```

That mapping is the reason option 1 is viable: WHO's roles line up with the
theme schema's roles, so this is a palette translation rather than a stylesheet
transplant.

## The falsifier I set, and how it came out

The brief said: *if the gap is layout rather than colour, a theme cannot close
it and option 1 is the wrong ruling.* Partly relevant, and the owner's own
carve-out resolves it — `who.css`'s layout rules are overwhelmingly `.navbar*`
(the top bar), and the owner has asked for the nav to stay on the LEFT. So the
layout half is deliberately NOT being reproduced, and what remains is colour
and type, which a theme does express.

**Not established:** how much of `who.css` beyond `--navbar-*` is structural
rather than palette. 705 lines have not been classified line by line, and the
count matters for whether a theme alone reaches "looks like the IG".

## Reuse target — sibling work, per the owner's pointer

Bean `kott` (**completed**): harness-namespaced values, one dotted key
`<instance>.<directory-id>.<entry>`, Liquid `{{ … }}` everywhere, and
critically *"fhir-harness declares `site.data` as PASS-THROUGH: Jekyll and the
IG Publisher resolve it, exactly as today"*. That is the infra to build on
rather than beside.

## Where a WHO theme BELONGS

`who-iris/themes/themes.ts` settles it by precedent: WHO palettes live in the
WHO instance, not in `cat-harness/schemas/themes.ts`, because *"a palette read
off a WHO style guide is subject matter"*. They still resolve through the
platform's `resolveTheme`. A smart-trust theme follows that pattern.

It also sets the testing bar: `themes.test.ts` **re-reads the source artefact**
rather than comparing constants to a copy of themselves. Here the source is a
git repo at a pinned sha, which is a better provenance than who-iris's capture
zip.


## Built 2026-09-30 — the theme is MEASURED and TESTED, and NOT YET APPLIED

`smart-trust/themes/themes.ts` + `themes.test.ts`, with `who.css` vendored
under `themes/upstream/` and the directory declared.

### The palette, role by role

| role | value | read from |
|---|---|---|
| `surface` | `#f6f7f9` | `who.css` `body{background-color:var(--toc-box-bg-color)}` |
| `ink` | `#000000` | `who.css` `.container{color:#000 !important}` |
| `edge` | `#eeeeee` | `bootstrap-fhir.css` `hr{border-top:1px solid #eeeeee}` |
| `accent` | `#00477d` | `who.css` `--navbar-bg-color` |

### Three values NOT taken, each recorded with its reason

The `who-iris` rule — *"`--blue` is NOT the accent … `--primary` is the ROLE"* —
applied three more times, because each refused candidate is the prettier or
more frequent one:

- **`#333333` is not `ink`.** All four `#333` declarations in `who.css` are
  `.dropdown-menu>li>a`. The base sets `body{color:#333333}`, but `who.css`
  overrides page content with `.container{color:#000}`. So the two files
  agreeing on `#333` is a **coincidence of value across two roles**, and a test
  now fails if a future upstream puts `#333` on anything body-like.
- **`navy` is not `edge`.** `--toc-box-border: navy` is the only border colour
  the WHO layer names, and it is scoped to one component; `edge` is documented
  as the generic rule.
- **`#000000` is not `surface`**, though the base declares
  `body{background-color:#000000}` — `who.css` overrides it.

### Falsified, not merely green

14 tests pass. With `--navbar-bg-color` hand-staled to `#deadbe` in the vendored
source, the accent test **fails** — so the guard fires when upstream re-skins,
which is the risk `who.template.root#current` creates.

One test failed on its first run and the failure was the test's, not the
theme's: it asserted `navbar` appeared nowhere in `JSON.stringify(THEMES)` and
tripped on the theme's own DESCRIPTION, which says the navbar is not
reproduced. Narrowed to palette + layouts, with the mistake recorded in the
test — a test that reads its subject's prose as if it were its data.

### The stale-guidance trap, closed rather than created

`smart-trust.json`'s top comment said the whole instance *"AUTHORS NOTHING"* and
is entirely re-derived by `ingest:ig`. `themes/` makes that false. **Narrowed to
the two directories it is still exactly right for**, with the date and reason,
rather than deleted — this is the third `Done when` box, met in the same change
that would otherwise have broken it.

### NOT APPLIED — and this is the headline, not a footnote

`gen-themes-css.ts` emits instance-declared **sticky** themes
(`instanceStickyThemes`) and nothing else. A `webpage`-kind instance theme has
**no consumer in the build today**. `who-iris` escapes this only because its own
page generator writes literal colours into finished HTML — a path unavailable
here on purpose, since `composed: true` is the just-the-docs machinery the owner
asked to keep.

**So the page does not look different yet.** Measured and stated in the module
docblock rather than left for someone to find by loading the page. Two ways to
wire it:

1. `gen-themes-css` emits instance WEBPAGE themes, scoped to the instance's page
   prefix — platform code, serves every future ingested IG.
2. `gen-smart-trust-pages.ts` emits `themeCssVars` into a per-instance
   stylesheet the composed pages include — local, serves one.

That is a **boundary decision** (platform vs instance), which is the owner's,
not an agent's. Recorded unanswered.

## Done when

- [x] the owner says which shape is wanted — option 1, theming, ruled 2026-09-30
- [x] the 2026-09-21 *"via justthedocs pipeline"* instruction is satisfied:
      `composed: true` is untouched and the machinery is unchanged
- [x] `_comment_composed` / the instance comment match what is now true
- [ ] the theme is APPLIED — needs the platform-vs-instance ruling above
- [ ] classify how much of `who.css` beyond `--navbar-*` is structural, which
      decides whether colour+geometry alone reaches "looks like the IG"

## Completed on landed evidence
Landed on main in PR #1683 (Queue the smart-trust branding question and alignment with replica styling).
