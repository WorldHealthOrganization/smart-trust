---
name: harness-tiles
description: >
  A tile is a function of the harness watching a directory, not of nodes.
  Where the tile set comes from, what a tile opens, and the two gaps it reports
  rather than hides.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# A tile is the harness's, not the node's

A tile is a function of a harness watching a directory, not of nodes. If a
harness declares visualisers, each one gets a tile; a tile defaults to the
theme, and a harness can declare one or more visualisations, each with a
title.

**The tile set is not a new registry — it is the visualiser obligation made
reachable.** A harness declares its visualisers in its `<instance>.json`
`visualisers` (`HarnessVisualiserSchema`), and `kg:audit` reports which
directories owe one. A graph that owes a visualiser owes a tile, so the audit
needs no second list free to disagree with it.

## Where a tile goes — the declared route, and nothing else

Each visualiser is ONE declaration in the harness that owns it:

```json
"visualisers": [
  { "id": "library", "renderedBy": "library-viewer", "coversKinds": ["library"], "subgraphs": "instance" },
  { "id": "todos", "renderedBy": "state-viewer", "covers": ["todos"], "alias": "todos" },
  { "id": "fsh-guts", "renderedBy": "staging-graph-viewer", "covers": ["fsh-guts"], "publish": "staging-only", "writer": ["scripts/gen-fsh-guts-viz.ts"] }
]
```

- **`id`** is the URL segment; **`renderedBy`** names a Tool node (the
  implementation may live anywhere); **`covers`** names this harness's own
  directory ids, **`coversKinds`** graph typologies, over every declared
  directory of them in the checkout. A harness never names another layer's
  directory — that would be a lower layer naming a higher one.
- **The URL is computed, never chosen.** `visualiserRoute` in
  `schemas/kg/visualiser-route.ts` is the ONE function every generator and
  reader uses: `<harness>/<id>/` for the full KG, `<harness>/<id>/<sub-graph>/`
  for one sub-graph (`subgraphs: "instance"` — one per covered layer — or
  `"directory"`, nested under `subgraphUnder[kind]` where the visualiser
  declares one), and an asset path below either. Every page is written to that
  route under the site's docs layer, so the file and the URL cannot disagree. A
  tile opens the sub-graph view when it exists, else the full one.
- **A page claims nothing.** A page carries only `rendered-by: <Tool>`, as
  provenance; it carries no `renders:` or `<meta name="renders">`. A
  directory's `coverage.visualiser` is filled IN MEMORY by `withViewers` from
  the declarations, never from disk.
- **Collisions are declaration errors.** `bun run cat check:visualiser-routes`
  refuses two declarations resolving to one route (or one inside another's
  subtree), a page drawn by a Tool outside every route that Tool is declared
  to render, a page under a route that names a different Tool, a visualiser
  covering a kind its Tool does not `renders`, and any `renders:` or
  `coverage.visualiser` on disk.
- **The short URL is an opt-in alias.** `alias: "todos"` makes `<base>/todos/`
  a redirect to `<base>/cat-harness/todos/`, composed by `compose-docs.ts` for
  every page under the route. An alias that names another alias, a harness, or
  anything the site already carries at its top level is refused by the gate
  before a build and by the composer during one. A tile always links the
  canonical route.
- **`publish: "staging-only"`**: `compose-docs` withholds the route (and its
  alias) from a canonical deploy.

## Instantiated is a different fact from declared

Only the harnesses instantiated in the folio get tiles, not every dependency.
Which layers are instantiated **here** is answered by the root
`index.config.json` (`instances[]`), or without an index by each root
`<name>.config.json`. That rule is
[`index-config`](../../kg/kg-core/index-config.md)'s; the tiles only consume
it, because the navbar cannot be derived from the declarations alone and a
directory listing is not the question a reader is asking. Dependencies keep a
group of their own rather than disappearing, so a reader looking for one is
not answered with silence.

**A harness a KG subscription chose is instantiated by the same file**, with
no local declaration: its declaration is the substrate snapshot `kg:subscribe`
cached at the pin. `bun run cat kg:instantiate <subscription> <harness>` writes
the config and the harness's state directories (and, under an index, the
harness's `instances[]` entry), and refuses a harness that was not chosen, not
declared at the pin, or whose `needs` nothing here holds. The tile is drawn
from the snapshot (`scripts/subscribed-harnesses.ts`): it links nowhere,
because nothing of it is published here, and a snapshot that cannot be read is
a finding on the tile rather than an empty one.

## Which harness `/` is — the landing is `index-config`'s rule

The site's landing page is one of the **instantiated** harnesses. It is never
the layer the generator happens to live in, and never the repository's
name. Which one it is — `site.landing` in the root `index.config.json` (an
layer name or `"hub"`), or the per-config `site.landing` flag without an
index — is [`index-config`](../../kg/kg-core/index-config.md)'s rule.
`resolveLandingInstance` in `schemas/kg/harness-config.ts` reads both, and
`check:landing-instance` is the gate.

When the landing is the neutral hub, `/` is the harness listing
(`harness_details.html`, these tiles) and the todo panel — the landing sticky
panel, not a second board.

## "Harness" carries TWO senses, and only one of them is this rule

| sense | what it means | how you tell |
|---|---|---|
| **1 — instantiated here** | this checkout runs it | an entry in the root `index.config.json` `instances[]` — or, in a folio with no index, a root `<name>.config.json` ([`index-config`](../../kg/kg-core/index-config.md)). Read the file, not a number quoted here |
| **2 — a layer others instantiate** | a base a *downstream* repo stands up | nothing in this checkout. It is a statement about the layer's role in the stack |

The rules on this page are about **sense 1**. Sense 2 is correct usage too: a
layer can be declared, not instantiated, and declare no visualiser — so it
owes no tile — while being exactly what a downstream repository instantiates.
No count is given for either sense, because a count in prose is a claim
nothing checks; ask the filesystem.

**Do not write a checker for this.** A predicate on the word cannot separate
its two senses, so it is an **adjudication**, not a check
([`adjudication`](../../process/process-core/adjudication.md)). When the
word is load-bearing, say which sense — *"instantiated here"* or *"a layer
downstream repos instantiate"*.

## A tile opens the LAYER, not a kind handler's view of it

A viewer page is a RENDERING with its own IRI, separate from the asset it
shows; see `kg-viewer` §"The asset and its rendering are two resources with
two IRIs". `scripts/mount-instance-docs.ts` carries the two routes:

| route | handler | what it is |
|---|---|---|
| `/<kind>/<instance>/` | the kind's, cat-harness's | the default rendering any layer declaring that kind gets |
| `/<instance>/` | the layer itself | its own themed root |

The tile's target is the layer's **own themed root** when it has one, and a
handler's viewer only when it does not. The viewers stay reachable, listed
beneath.

A layer **has** that root when it has its own site directory, read from
its own declaration — never by probing the BUILT site, where a layer whose
pages are generated at build time has none until its generator runs.

## Order is the declared dependency stack, reversed

Bottom to top, computed from the declared `needs`, never written out as names:
a name list is a rule true only for the layers somebody remembered.
The spine's head keeps the top and its floor keeps the bottom.

**A layer whose layer nobody declared is undetermined** — placed below the
head, alphabetically, carrying a finding that says its place is not derived.
Absent is not `[]`: one is nobody having said, the other is a layer
asserting it sits on nothing.

**A broken graph does not blank the navbar.** `flattenDependencies` returns an
empty order on a cycle, which is right for a pipeline and wrong for a sidebar,
where showing nothing hides every layer over one typo. The problems are
reported and the list falls back to alphabetical.

## Two gaps, reported rather than hidden

Both are the third state, and they are DIFFERENT findings:

- **declared and not rendered** — a graph the layer declares with no
  published page. Not linked (a dead link reads as *"this site is broken"*),
  and reported.
- **rendered and not declared** — a page published under a kind the layer
  does not declare. Also not linked, because the declaration decides what a
  tile may claim to show — and reported, because staying silent would hide a
  working viewer behind a rule, and the remedy is one line in a declaration.

## An inert row SAYS why, and "no viewer" is four answers

A declared graph with no published viewer appears in the navbar as a row that
does not open. **Drawing it grey is not saying it:**

- **A `title` on a non-focusable element is a label for a pointer and for
  nothing else** — no keyboard path, and not reliably announced.
- **Dimming alone is state carried by contrast**, and can pass the contrast
  ratio while saying nothing.

The reason is **content**: real text in the row. It is in the accessibility
tree, survives a stylesheet that does not load, and cannot disagree with a
second signal. Do not use `aria-disabled` — nothing is a control, and marking a
`<span>` disabled announces a widget that does not exist.

"No viewer" is four states, told apart by `inertNote` (`harness-tiles.ts`):

| state | the row says | is it a gap? |
|---|---|---|
| declared `publish: "staging-only"` | staging only | **no** — withheld on purpose |
| layer declares `renderExemption.of: ["visualiser"]` | no viewer by design | **no** |
| a viewer exists off the conventional path | viewer not published | yes, and a different one |
| nothing declares a viewer | no viewer yet | yes |

One wording for all four would label an intended state a gap, which is as
wrong as hiding a real gap.

**Neither navbar picks the words.** They render what the generator gave them,
which keeps them one navbar rather than two that agree by maintenance.
A kind the generator said nothing about renders with no claim about why.

## A tile, or an avatar? WHO DECLARED IT

> **A tile is what the HARNESS declares. An avatar is what the FOLIO holds.**

| the thing | renders as | because |
|---|---|---|
| a declared visualiser (the harness's `visualisers`) — over a directory or sub-graph | **tile**, *functional* | the harness declares it; §"A tile is the harness's" above |
| a set of schema instances — `todos` | **tile**, *content* | the harness declares the set; the instances are the folio's |
| a note, a document, a materialised asset in the folio's `reproduce` directories (`library/`, `uploads/`) | **avatar** | the folio holds it; it is the reader's, not the harness's |

### A TILE IS ONE OF TWO KINDS, and they bind to different things

| | **functional** tile | **content** tile |
|---|---|---|
| subject | a directory or sub-graph | a set of schema instances |
| **bound to** | a **SKILL** | a **SCHEMA** |
| resolved when opened | a **tool** that implements the skill | the **instances** |
| what empty means | **a gap to report** — a skill nothing implements is unreachable | **a real state** — "nothing outstanding" is not "broken" |

**A functional tile names the SKILL, never the tool.**
`schemas/tools/tool-types.ts` makes tools that satisfy one skill
interchangeable, so a tile bound to a tool breaks the moment another tool is
chosen. Likewise `VisualiserDeclarationSchema` takes *"one path, or several
visualisations"*: a sub-graph may be rendered more than one way.

**Empty is asymmetric.** A content tile opening on zero instances is CORRECT
and must not be hidden — an empty board and a person with nothing outstanding
are opposite facts. A functional tile whose skill has no tool is a gap to
report.

**THEME IS NOT A THIRD KIND.** A theme is a palette and its art; a tile takes
the avatar's declared hue. Theme is **how either one looks**, never an
alternative to being a tile.

### Size does not decide it

A whole materialised knowledge graph (such as `cat-bootstrap` or
`cat-harness`) on the glass renders as an **avatar**. So these two tempting
rules are wrong:

- **"Many behind it → tile, one → avatar"** — a materialised graph is many
  things and is an avatar.
- **"Opens a viewer over a set → tile"** — opening that avatar opens a viewer
  over a set, and it is still an avatar.

Declaration ownership decides: a materialised asset is in the reader's folio
however big it is.

**The same subject can be both.** `todos` is a **content tile** in the strip
*and* an individual todo is an **avatar** on the glass: the tile is bound to
the SCHEMA and the avatar is one INSTANCE of it.

### What is checkable here, and what is not

**Tile-vs-avatar is not.** Nothing classifies a folio item; the rule governs
authoring, and the renderer reads the graph an item came from, so a gate would
be a declared property whose check cannot answer its own claim.

**"A functional tile names the skill, never the tool" IS**: a declared
visualisation naming a tool id where a skill name belongs is decidable against
`knownSkills()` and the Tool graph. No such tile exists yet, so nothing is
gated today.

## The navbar icon row is DECLARED, and three states is not two

`navbarIcons` on the layer declaration. A **closed** set — `close`,
`todos`, `beans`, `processes`, `kg`, `fsh-guts`, `qr`, `launcher` — because a
free string lets a layer name an icon nothing draws. Seven is the cap and
it is **refused, never truncated**: silently dropping an eighth entry would
overrule the layer's decision.

`fsh-guts` is a control, like `launcher`: a button that opens the
discarded-items list and carries its live count, not a link. It is also the
**way back** the discard confirmation names, so that dialog says "the fish in
the icon row" only when this icon is on the page, and points at Page settings
otherwise (`board-windows` §"Send to fsh-guts asks first").

| declared | means |
|---|---|
| absent | **inherit** — walk `needs`, site owner as the floor |
| `[]` | **show none** |
| a list | this layer's own answer |

Absent and `[]` must not collapse. The guard is `!== undefined`, never a
truthiness test: a truthiness test turns "nobody has said" into "nothing to
show", and makes a layer that has not declared the field indistinguishable
from one that wants a bare navbar. The distinction is kept at every layer: `resolveNavbarIcons`
returns `undefined` for undetermined, `harness-tiles.ts` **omits** the field
rather than writing `[]`, `sync-docs-harness.ts` emits `null`, and the client
draws no row and says so once.

**The walk is `needs`**, not a second traversal. Nearest declaration wins,
breadth-first toward the foundation — the direction `resolveSkillDirs` already
composes. A new walk would be a second answer to "what is this layer built
on", free to disagree with the first.

**Destinations are looked up, never written down.** They come from the
layer's own declared visualisations plus `siteLinks`, so an icon whose
graph this layer does not publish gets no href and renders as a
**non-link**. `close` and `launcher` carry no href on purpose: they drive
controls on the page, and an href would make them look like navigation.

## The theme avatar: the assignment is theme-mediated

The navbar's mark is the layer's **theme card art, clipped** — not its
`icon`. The chain:

> layer → its sticky contribution → the sticky's `theme` → the theme's
> `imageRole` → the layer's images carrying that role → the `card` layout →
> its `avatarRegion`

`resolveThemeBackdrop` is the join and returns the `DeclaredImage`, so the crop
comes with it. An indirection is not an absence: look through the theme before
concluding no assignment exists.

**Take the `card` layout, not laptop or mobile.** `KgImageSchema` refuses a
non-square `avatarRegion` in **pixels**, and only the square crop can satisfy
that: equal fractions on a landscape image give a box wider than tall, and the
clip scales width and height separately.

**A card with no declared crop is a finding, not an avatar**: the whole
composition squeezed into a small frame is unreadable. Report it and fall back
to the mark.

## Where a tile lives, and what it must not eat

Tiles render in the navbar **and** on the glass: one declaration, per-surface
visibility, never two registries.

**The sticky board carries NO tiles.**

- Removing a surface loses nothing only if the others still carry it. Every
  tile this repository declares names `navbar` and `glass`, so each stays
  reachable. A tile that named ONLY a surface that is not mounted would vanish
  silently — report it, do not re-route it on the author's behalf.
- **`board` stays a legal value in `TILE_SURFACES`, and nothing mounts it**, so
  existing declarations that name it stay valid (the "every field but `ref` is
  optional" rule in `schemas/kg/cat-harness.ts`). A declaration saying
  `["board"]` alone is valid and renders no tile; the graph-tiles e2e asserts
  both halves.

They are **collapsible**, with the count on the summary so a collapsed list
still says how much is behind it — a fixed-height sidebar of tiles must not
push the page nav off the top.

Theming comes from the avatar's **declared hue**: one hue, both schemes
derived, so no tile can be legible in one mode and invisible in the other. A
per-instance palette would be a second colour vocabulary beside `theme.ts`.

## On a folio's own site, a tile describes the FOLIO

**A page's tiles describe the layer whose site the page is on.** A folio's
own Pages site (an IG repository's `folio-site.yml`, a document folio's
`folio-staging.yml`) wears the platform's chrome, and the platform's
`_data/harness.json` comes with it: tiles, counts, icon row, rail scopes and
title, every path root-relative to the **platform's** site. Unscoped, the
folio's badges show the platform's counts and its links 404.

`cat-harness-tools/scripts/lib/foreign-site-scope.ts` applies the rule to the
data, once, for both passes (`compose-docs --shell --instance`, and
`rail-standalone-pages --foreign-site`):

| the link points at | on a folio's site it | count |
|---|---|---|
| the folio's own root (`/<instance>/…`) | resolves inside the folio's baseurl | kept |
| a page the folio's declaration publishes at its site's root (`/beans/`), when the folio IS the checkout's root (`rootOwnPages`) | stays root-relative, on the folio's own site | kept |
| another layer's **`state`** graph (work items, todos, QA, health, uploads …) | **is not linked**; the icon says why in words | **none** |
| a platform content, context or derived graph (skills, processes, tools, schemas, docs …) | is re-based, absolute, onto `DOCS_SITE_BASE`, with its qualifier shown | **none** |
| a kind nothing classifies | is treated as state | none |

**The state row is unlinked rather than shown at zero or re-based.** Per
`schemas/ui/tile-count.ts`, absent is a third state, never `0`: a folio that
declares no `beans` graph has said nothing about work items. Showing `0` would be a
claim, and showing the platform's number answers the folio's question with
somebody else's. The icon keeps its
place and its accessible name says, for example, *"<folio> declares no beans
graph"* (§"An inert row SAYS why").

**Ownership is decided by where the link points, never by a kind of the same
name.** A folio that declares a `qa` directory does not borrow the platform's
QA tile and its count; borrowing it because the word matched would put the
platform's number back on the folio's page.

**A count beside a borrowed link is dropped too**: the link is accurate, but
the number would still sit on the folio's page next to the folio's own. The
qualifier is shown instead, so the tile reads as the platform's.

**The host's count projections are not chrome.** `compose-docs --shell` leaves
out every `assets/**.json` that declares a headline `tile` count, as it does
`_includes/generated/`. A badge whose file 404s renders as ABSENT, with no
number.

**A figure that is not a tile follows the same rule:**

| figure | it came from | on a folio's site it | count |
|---|---|---|---|
| the translation sweep badge | `_data/translation-qa.json`, the platform's | the shell leaves the file out; the badge stays, inert, reading *"QA: not published"*, and says why: *"<folio> publishes no translation QA sweep on this site"* | **none**, and not *"not run"*, which would be a claim about the folio |
| the navbar's locale swap | `_data/translations.json`, the platform's index of its own pages | the shell leaves the file out; the index reads as `null`, *"could not determine"*, and the navbar stays as built | n/a |
| the fsh-guts fish | a button whose count is fetched from **this** site's `/fsh-guts.json` | the button is drawn only when the folio links its OWN fsh-guts; otherwise the fish is the row's re-based link, named *"the platform's: <folio> declares no fsh-guts graph"*, or an inert icon with the note | **none**, never *"?"*: `?` means the read failed |

A folio that publishes its own sweep or fsh-guts document gets its own figure
back with no further change: `foreignSite.absent` (written by
`scopeHarnessData`) only supplies the words for when the site carries nothing.
The two `_data/` files are named in `HOST_DATA_PROJECTIONS`, since neither
declares what it describes. `foreign-site-scope.test.ts` fails on a shell that
carries a `_data/` file nobody has classified as chrome or projection.

**A folio that IS the root of its own site** (for example one whose site is
generated rather than a Jekyll tree) needs four more things:

- **Its declared pages are its own.** Its visualisers under its own site
  directory publish at the site root, by the same `ownsSite || isRepoRoot`
  rule `siteDirMount` gives its icon (`harness-tiles.ts`), and the scope keeps
  them (`ForeignScope.ownPages`).
- **The icon row's own paths and counts resolve on the folio's site.** After
  scoping, every root-relative href left in the row is the folio's, and so is
  the `count.json` its badge fetches. `rail-standalone-pages --foreign-site`
  writes the row's `data-fa-root` as the page's own site root (`rowRoot`),
  while its script and style still load from the platform (`assetRoot`).
- **Its mark loads from its own site** (`ownsCheckout`).
- **An image mark can sit on the rail itself.** The rail draws the layer's
  tone square behind every avatar; a declared image with `ground: "none"`
  (`KgImageSchema`) is drawn with no tone.

**The pinned rail reserves its width.** Hover and focus open the bar over the
page, as a peek; pinning keeps it open, so `.main` moves over (`docs-ui.css`).

**The gate is `foreign-site-scope.test.ts`.** It runs both foreign-site passes
over a folio and asserts (a) no tile carries another layer's count or links
its state graph, (b) no href is left root-relative unless it is the folio's
own path, (c) the platform's translation sweep and index are not shipped and
the rendered `head_custom.html` hands the badge its words, and (d) the fish
fetches no count from a site that has no fsh-guts. The client halves are in
`translation-badges.e2e.ts` and `navbar-row.e2e.ts`. **A check of a page's
chrome has to run on a site that is not the platform's**, because on the
platform's own site the platform's tiles are right by construction.

## The glass strip — pinned first, and "+N more" counts the rest

**No tile may be silently off-screen**: a reader cannot tell a tile scrolled
out of view from a tile that does not exist.

- **The pinned set is DECLARED, never written into a surface.** `glassStrip`
  on the layer's declaration lists the pins in order: `{ "chrome": … }` for
  the glass's own controls (`todos`, `filter`, `settings`) and
  `{ "kind": … }` for a graph typology. It is inherited along `needs` like
  `navbarIcons`, so absent inherits and `[]` pins nothing.
  `sync-docs-harness.ts` resolves each kind to ONE tile (`resolveGlassStrip`):
  the directory named for the kind, else the first glass tile that holds it.
  A kind several harnesses publish gets one slot, and the others wait in More,
  where their qualifiers tell them apart. A pinned kind that no tile holds is
  reported in `glassStrip.unmatched` and never skipped silently.
- **Fit, not scroll.** The strip shows as many pins as fit at the current
  width, in declared order, and refits whenever its box changes. It never
  scrolls sideways (`scrollWidth <= clientWidth` is asserted at 1280×800 and
  390×844).
- **The last tile says "+N more", and N is exact.** N counts every tile not on
  screen: pins with no room at this width, plus everything the reader keeps in
  More. Shown + N is always the total. The tile is a button named "N more
  tiles"; it opens More and moves focus into it. Pins that did not fit come
  first in More, marked as pinned.
- **The reader may still arrange.** A strip the reader has arranged, by
  dragging or with the Strip and More buttons, overrides the declared default
  in that browser. The fit and the count apply to their arrangement too.
- **It starts HIDDEN.** With no stored choice, the folio opens with the strip
  slid away. Only its tab shows, reading "Show tiles (N)". The tab is the one
  control both ways ([`board-windows`](board-windows.md)) and carries
  `aria-expanded`. The reader's choice is remembered in this browser as `1`
  or `0`, and storage that cannot be read counts as no choice: hidden.

`glass-strip-fit.e2e.ts` holds the four fit assertions and
`glass-strip-default-hidden.e2e.ts` the default.

## `summary` and `alsoWritten` — what a reader sees, kept apart from why it was named

A harness section on the landing page shows the declaration's `summary`, a
one-line gloss, and lists `alsoWritten`, the other spellings of the name.
A `description` made to carry them shows the reader a naming rationale or
spellings that render as one line. Authoring notes belong in `description` or
a `_comment`. The reader-facing
line goes in `summary`, and alternative spellings go in `alsoWritten` as a
list, never inline.

**A harness's sticky shows the same text as the landing page.** A sticky
contribution declares `bodyFrom: "summary"`, and the card's words are
`readerText` in `schemas/content/sticky-contribution.ts`: the `summary` (else
the description), then the `alsoWritten` spellings after "Also written:". That
is the rule `docs/_includes/harness_details.html` applies, read from the same
two declaration fields, so there is no copy of the text to keep in step. `bodyFrom: "description"` still parses, because the
pinned `bootstrap/bootstrap.json` declares it. `bun run cat landing:sticky:check`
fails when a card built from its declaration does not open with that text. A
`bodyAppend` may follow the reader's text, and a card with a literal `body` is
not compared.
