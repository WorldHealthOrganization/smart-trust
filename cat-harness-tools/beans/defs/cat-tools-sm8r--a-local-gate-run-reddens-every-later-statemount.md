---
# cat-tools-sm8r
$schema: bean/1.0.0
title: 'A local gate run reddens every later state:mount: its own steps write into the mounted layers'
status: completed
type: bug
priority: normal
tags:
    - ci-speed
    - pp9g
created_at: 2026-11-06T05:00:00Z
updated_at: 2026-11-15T17:30:00Z
parent: folio-assistant-1xhc
---

Found re-timing the pre-push hook (`pp9g`) on a cold, freshly mounted
folio-assistant agent checkout (4 CPUs), tools at main after #1532, 2026-11-06.
Asked for by the CI-speed coordinator: "find out why it exits 1 in this
container, and whether #1489's skip should apply".

## Measured

- Before the gate run, `state:mount` exits 0: 62 s the first time, 17 s again.
- Inside it, all 8 `state:mount` steps (one per CI job) exit **1**, at
  41.7, 35.9, 36.8, 39.3, 41.0, 38.2, 39.0 and 32.9 s: **305 s**, about 5 min
  of a 1396 s gate run.
- Each reports 8 remote instances `missing`: *"left untouched: <dir> no longer
  hash to the lock — edits there are somebody's work"*. The fetch it makes
  first changes nothing.

## Cause

A local `gates` run runs every job's steps one after another in **one**
checkout. In CI each job starts from a fresh mount, so its `state:mount`
comes first and sees an intact mount. Here, steps of earlier jobs have
already written into the mounted layers, and the lock check (rightly) refuses
to call an edited mount current:

1. **Generated output inside a mount.** `ig-index:build` writes
   `smart-trust/fhir-artifact-index/{index.json,menu.json,package.tgz,contexts,sidecars}`
   and the same under `smart-trust-phw/`. The QA working copy and docs steps
   write `cat-harness/docs/_data/{provenance,todo_listing.json}`,
   `docs/_includes/generated`, `docs/assets/{auto-docs,beans}`.
2. **Committed generated files rewritten.** The glossary writers regenerate
   `cat-harness/docs/assets/glossary/*.skos.jsonld`,
   `who-iris/glossary/generated/**/*.glossary.json` and
   `folio-assistant-core/glossary/generated/**/*.glossary.json`, and the
   content differs: definitions changed in the other layers' sources at their
   pins. **The glossaries committed in those three layers are stale against
   the pins.** That is a finding in its own right, which CI does not see
   because each job mounts fresh.

Reproduced in a fresh worktree mounted from the same lock:
`mount-from-lock.sh --check` says `current`. **One** extra file in
`smart-trust/fhir-artifact-index/` makes smart-trust `missing`, and **one**
appended byte in a committed `who-iris/glossary/generated/*.json` makes
who-iris `missing`.

## Whether #1489's skip should apply

**No.** It skips the fetch only when every instance is current per the lock,
and these are not: the mounts really differ. What is wasted is the fetch
after that verdict. Every non-current instance is one the fetch will leave
untouched, so it cannot change the outcome.

## Fixes, smallest first (not built; owner or coordinator to pick)

1. **`remote-mount.ts`: skip the fetch when it cannot help.** When every
   non-current instance is "edited, would be left untouched", report that
   without fetching. Each of the 8 steps then takes about 1–2 s and stays
   red, honestly. Saves about 290 s per cold local run. It changes nothing in
   CI.
2. **`gates.ts`: a local run sets up once.** Run each distinct setup command
   (`state:mount`, `ig-index:build`, `bun install`) once per run, not once
   per job. That saves the same 290 s plus about 60 s of repeated
   `ig-index:build`, and removes the false reds. The risk is a job whose
   setup really depends on an earlier job's writes; none is known.
3. **Root: nothing a CI step writes goes inside a mounted layer.** Either
   `ig-index:build` and the glossary writers write outside the mounts, or the
   lock digest excludes outputs the layer declares as built. Separately, the
   three stale committed glossaries need regenerating in their own layers.

## Owner ruling (2026-11-06, card "Mount fix")

"Build all four", in this order:

- [x] 1. `remote-mount` skips the fetch when it cannot help (above, fix 1) — merged in `litlfred/cat-harness-tools#1565` (`213a9495`);
- [x] 2. a local `gates` run does each setup command once (fix 2) — merged in `litlfred/cat-harness-tools#1578` (`64f0aa0b`);
- [x] 3. regenerate the stale committed glossaries in cat-harness, who-iris and
   folio-assistant-core against the pins, one PR per layer — measured as pin skew between locks and dropped per owner's ruling in `litlfred/cat-harness-tools#1554` (`a9374293`), replaced by pin alignment (`litlfred/smart-trust-phw#47` `b0d1ef8b`) and lock-consistency gate `litlfred/cat-harness-tools#1571` (`c73e95b2`);
- [x] 4. **no CI step writes inside a mount**: move the IG index, the QA copy, the
   docs and the glossary output out of the mounted layers. Done 2026-11-14 (steps 1–7 below); measured clean before step 7 went red. It touches many
   writers, so it is a written plan in this bean before any code.

Measure before and after for each.

Merged across the stack for this bean (11 PRs):

- `litlfred/cat-harness-tools#1554` (`a9374293`): bean `sm8r` measurements, owner ruling, item 3 pin-skew proof and item 4 plan.
- `litlfred/cat-harness-tools#1558` (`7e6976d3`): `builtAtPublish` applies to every pinned directory of an instance (was ignored for instances pinned as several directories: `smart-trust` ×7, `smart-trust-phw` ×4).
- `litlfred/cat-harness-tools#1559` (`ac56dc3b`): `check:published-packages` runs pytest without writing `__pycache__/` or `.pytest_cache/` into the mounted `cat-harness-tools` (fix 4 for that writer; untracks two tracked `.pyc` files).
- `litlfred/cat-harness-tools#1565` (`213a9495`): `remote-mount` skips the remote fetch when every off-lock mount is `edited` and would be left untouched (fix 1; 56.1 / 39.3 s down to 18.6 / 19.2 s).
- `litlfred/cat-harness-tools#1571` (`c73e95b2`): `check:lock-consistency` ensures every lock in a composition pins one commit of a shared layer (replacing item 3's per-layer glossary regen).
- `litlfred/cat-harness-tools#1578` (`64f0aa0b`): `gates: a local run performs each setup step once` (`RUN_ONCE_SETUP_STEPS` / `SetupOnce`; fix 2).
- `litlfred/cat-harness-tools#1602` (`b22a9cec`): `scripts/lib/layer-output.ts` (`outputPathFor` / `readPathFor` over `build/layers/<instance>/<rel>`; item 4, plan step 1).
- `litlfred/smart-base#310` (`f0f2d443`), `litlfred/smart-trust#142` (`a8061b23`), `litlfred/smart-trust-phw#33` (`307b6c40`): declare `fhir-artifact-index/sidecars/` and `contexts/` as built by `ig-index:build` (`builtAtPublish`), so `ig-index:build` outputs no longer dirty the mounted IG layers.
- `litlfred/smart-trust-phw#47` (`b0d1ef8b`): align pins to `smart-base` `60d9b47` (wave 4 pin alignment).

## Which step writes into which mount (measured 2026-11-06)

Fresh worktree mounted from the same lock, each QA working-copy step run
alone, `mount-from-lock.sh --check` after each:

| step | time | mounts it leaves `missing` |
|---|---|---|
| `kg-export --instance ./bootstrap` | 3 s | cat-harness |
| `qa:refresh` | 606 s | + fhir-harness, folio-assistant-core, folio-assistant-sci, smart-base, who-iris |
| `glossary:page` | 18 s | (no new layer) |

Files that differ from a fresh mount after a whole local run: 1604. Of
these, 1119 are `cat-harness/test/results/` (the QA tree), 396 are
`fhir-artifact-index/sidecars/`, and 16 are `glossary/generated/` files
rewritten with different content. The rest are cat-harness docs and
attestations rewritten in place.

## Item 3 (regenerate the stale glossaries): what "against the pins" finds (2026-11-06)

For each glossary file the index's writers rewrite, the regenerated bytes
were compared with the layer's own `main`:

- **who-iris:** `main` equals the regenerated bytes exactly
  (`kg-tools`, `kg-bpmn-activities`). Nothing is stale in who-iris; the
  index pins an older who-iris (35f23d3, main 90bb3f5). A re-pin fixes it.
- **cat-harness:** `main` differs, and so does the pin. cat-harness already
  regenerates against its own pins on every merge ("Post-merge regen check
  and repair", green on main at 2f203e16). The bytes differ because the
  index composes **different pins of the layers below**:
  bootstrap a83ae82d (cat-harness's lock) vs c90ef456 (folio-assistant's),
  bootstrap-tools f22b2490 vs aa25987a. `bootstrap--kg-*.skos.jsonld` is
  computed from bootstrap, so no single commit of cat-harness can match both.
- folio-assistant-core, fhir-harness, smart-base, folio-assistant-sci:
  `main` differs too. The writer is folio-assistant-core's `glossary:page`,
  which writes `generated/<instance>/` into **every** instance's glossary
  directory. smart-base cannot even run it on its own (no workspace), so the
  committed copies are written by an index and differ by the index's pins.

**So regenerating in the layers cannot make the index's mounts clean.**
Committed bytes computed from the layers below are checkout-dependent, which
is the `because: checkout` case of `built-at-publish.ts`. The fix is item 4
(no CI step writes inside a mount), or exact pin alignment, which no layer
controls.

## Item 4: the plan (no CI step writes inside a mount), written before code

Item 3 was dropped on the owner's card ("1. Drop it, plan item 3"; that is
this item, which the card calls item 3). Pins are being aligned in its
place (owner: "align pins"; drift check cat-harness-tools#1571).

### The rule
A mounted layer is **read-only** in a checkout that mounts it: its directory
holds the pinned bytes and nothing else. Everything a step computes FOR a
layer goes to one place outside the mounts:

    build/layers/<instance>/<the same instance-relative path>

That is one **output root** per layer, mirroring the layer's own layout, so
`smart-trust/fhir-artifact-index/index.json` becomes
`build/layers/smart-trust/fhir-artifact-index/index.json`. In the layer's
OWN repository (the instance is `source.local`, not mounted), the output root
is the layer itself, as today: nothing changes for a layer building itself.

### One resolver, read and write
`cat-harness-tools/scripts/lib/layer-output.ts` (new):
- `outputPathFor(root, instance, rel)` is where a writer writes:
  `build/layers/<instance>/<rel>` when the instance is a remote mount,
  else `<instance path>/<rel>`;
- `readPathFor(root, instance, rel)` is the output root when the file is
  there, else the mount. An overlay: computed output over pinned bytes.

Every writer and reader below moves onto these two calls. Nothing else may
join an instance path to a computed file; a check finds a writer that does,
by its write sites, in the same style as `check:input-sites`.

### The writers, by measured volume (2026-11-06)

| writer | writes today | files | readers to move |
|---|---|---|---|
| `qa:refresh` (QA working copy) | `<layer>/test/results/**` | 1159 | the gates that judge QA (JUDGE mode), `uml:overview`, `readme:subgraphs`, `qa:publish` |
| `ig-index:build` (fhir-harness) | `<ig>/fhir-artifact-index/{index,menu,releases}.json`, `package.tgz`, `sidecars/`, `contexts/` | 396 + 4 per IG | `ig-pages`, the JSON view pages, `ig-site:sidecars` |
| `glossary:page` (core) | `<layer>/glossary/generated/<instance>/*.glossary.json` | 16 | glossary pages, `check:term-mapping`, archimate-from-glossary |
| kg-export, docs writers | `cat-harness/docs/{_data,_includes/generated,assets/{auto-docs,beans,glossary}}` | ~45 | the docs site build (`compose-docs`) |
| prose rewrite (writer not yet identified) | `cat-harness/docs/{concepts,guides,process}/*.md`, `test/attestations/**` | 7 | to find first: it rewrites COMMITTED source, which no step may do |

### Order (one PR each, measured before and after)
- [x] 1. The resolver (`scripts/lib/layer-output.ts`, merged in `litlfred/cat-harness-tools#1602` `b22a9cec`) and its write-site check, warning only.
- [x] 2. `ig-index:build` and its readers (`builtAtPublish` multi-directory support merged in `litlfred/cat-harness-tools#1558` `7e6976d3`, plus `fhir-artifact-index/sidecars/` and `contexts/` declared built in `litlfred/smart-base#310` `f0f2d443`, `litlfred/smart-trust#142` `a8061b23`, and `litlfred/smart-trust-phw#33` `307b6c40`, with pin alignment in `litlfred/smart-trust-phw#47` `b0d1ef8b`; migration of `ig-index:build` onto `layer-output.ts` can follow as readers move).
- [x] 3. `glossary:page` (owner, 2026-11-13, card "Step 3": "own layers only"): it writes, deletes and `--check`s extracted schemes only outside the checkout's mounts; a mounted layer's stay as pinned. Merged in `litlfred/folio-assistant-core#785` (`ef03802d`). The tools readers of the IG index moved onto the overlay in `litlfred/cat-harness-tools#2057` (`51d9a779`).
- [x] 4. The docs writers: merged in `litlfred/cat-harness-tools#2102` (`03a32fbe`, the reader: `compose-docs` lays a mounted layer's output-root twin over its base) and `litlfred/cat-harness-tools#2106` (`cb8bf34a`, the writers: `docs:harness`, `navbar:include`, `themes:css`, `auto:docs`, `node-kind:pages` and `publish:check` write a mounted cat-harness's pages through `writePathAt`). Before them, the measurement below found the non-test docs writers wrote only declared `builtAtPublish` paths, which `mount-from-lock` leaves out of the digest (owner, 2026-11-13, card "Step 4": "Close as covered"); the move now keeps those writes out of the mount altogether.
- [x] 5. (sibling session_01VQDpPfbULqPnitwJLVe6b5) `qa:refresh`, the largest and most-read; the QA stamp work of CI speed
   14 lands on the same paths, so coordinate. Merged in `litlfred/cat-harness-tools#2110` (`03bcf884`), `#2121` (`8040f49c`) and `#2122` (`b31b1104`).
- [x] 6. (sibling session_01VQDpPd28pjkLtPQc3hFUEz) Find the prose rewriter, and stop it writing committed source. FOUND by the measurement below: it is the root `bun test` run, whose tests re-render committed pages, diagrams and translation templates in place. Merged in `litlfred/cat-harness-tools#2109` (`25557f6f`), with the stale pages regenerated in `litlfred/cat-harness#1321`, `litlfred/folio-assistant-core#792` and `litlfred/smart-base#395`.
- [x] 7. The write-site check goes from warning to red (owner, 2026-11-14, card "Step 7": "A. Measure, then red"). Merged in `litlfred/cat-harness-tools#2183` (`29f3876f`): each `layer-pr-checks` shard marks the root before its tests (`snapshot.py mark`) and after its gates names every file written, changed or removed under a mount path (`snapshot.py diff`), recorded as the gate `mounts:untouched (shard i/N)` and judged like any gate. `mount-from-lock --check` could not be the check: CI swaps the caller in and takes lower layers at main, so those mounts never hash to the lock on either side. The remaining writers and readers it needed first: `#2128` (`1b095fc4`, subgraph/payload), `#2142` (`1f38a5c8`, uml:overview), `#2152` (`df9a0b94`, skills:docs, lsi:viz), `#2163` (`0e83963c`, docs:pages), `litlfred/folio-assistant-core#793` (glossary pages), and the readers `#2168` (`7f6bba8e`, e2e), `#2172` (`e78cf98b`, gates), `#2173` (`2bf84dfd`, tests), `#2174` (`37877738`), `#2190` (`dccd8e20`, viewer pages, permalinks, subgraph links, translation index).

- [x] 8. The readers and writers left behind, found on `litlfred/folio-assistant#3124` once the writers had moved: `#2211` (`e0a82445`, `sync-docs-harness` tile counts), `#2213` (`4b7d139b`, state-visualizer projection and writes, `viewersOf`, `translation-drift`, `check-published-packages` built in a scratch copy, so `block-qa-schema/dist/` is no longer written into a mount), `#2223` (`2c59c685`, `check-subgraph-coverage`), `#2227` (`7a391ec3`, state-visualizer orphan passes scan the output root they write in), and the QA claim of `check:nav-names`: `#2217` registered it, `#2219` made it `external`, `#2220` exempted only `afterPublish` writers from "produced nothing". The test-side readers were session_01VQDpPekpt4uRRDkhFD45cc's (`#2209`, `#2214`, `#2226`, `litlfred/folio-assistant-core#804`).
- [x] 9. `derive:publish`'s UNDECLARED writes into mounts (owner, 2026-11-15, card "2b"). Merged across all owning layers: `litlfred/cat-harness-tools#2229` (`496c5e95`, `render:bpmn` and `library:viz` stop writing undeclared files into mounts), `litlfred/smart-immunizations#148` (`6d7d4447`), `#150` (`95e6177b`) & `#153` (`4faa72f6`, declare `fhir-artifact-index/` built at publish, order `ig-index:build` outputs before `jsonld:contexts`, and re-pin layers to `main`), `litlfred/cat-harness#1348` (`e2eeea34`) & `#1357` (`94df8957`, declare `fhir-harness`'s `ig-ast` pages and `smart-base`'s `l1-extraction` pages built at publish), `litlfred/smart-base#400` (`a7813861`), `#401` (`9ad819a5`) & `#410` (`f04123f5`, `document-kinds` reads each IG's artefact index through the layer output overlay, drop `ig-identity` re-export, and update `dak` profile), `litlfred/smart-trust#232` (`5bb38a6f`) & `#240` (`046103a2`), `litlfred/smart-trust-phw#75` (`c618c22c`) & `#84` (`83d494e9`), and `litlfred/folio-assistant-core#800` (`745c3541`, `glossary-mapping-block` test reads rendered glossary pages through the overlay). See the measurement below.

### Measurement for item 9 (2026-11-15)

A full `derive:publish` in a composed folio-assistant (tools at `#2213`'s head, core at main, every mount fresh) wrote 18,916 files inside mounts. 17,934 are declared `builtAtPublish`, so they are allowed. **982 were undeclared (all now resolved on `main`):**

| files | what | owner & resolution |
|---|---|---|
| 784 | `smart-immunizations/fhir-artifact-index/` (`ig-index:build`) | `smart-immunizations`: declared `builtAtPublish` in `litlfred/smart-immunizations#148` (`6d7d4447`) & `#153` (`4faa72f6`), re-pinned in `#150` (`95e6177b`) |
| 165 | beside-source BPMN drawings (`render:bpmn`): 152 byte-identical rewrites, 13 smart-trust-phw drawings whose committed copies are stale | this layer (`litlfred/cat-harness-tools#2229` `496c5e95`): never rewrite unchanged bytes; a changed one goes to the output root |
| 22 | `cat-harness/docs/docs/assets/img/…` (`library:viz`): an entry's figures named `../../../docs/assets/img/…` escaped `files/<id>/` | this layer (`litlfred/cat-harness-tools#2229` `496c5e95`): the published path stays inside `files/<id>/` |
| 9 | `cat-harness/docs/en/{fhir-harness/ig-ast,smart-base/l1-extraction}/…` | `cat-harness`: declared `builtAtPublish` in `litlfred/cat-harness#1348` (`e2eeea34`) & `#1357` (`94df8957`) |
| 2 | `smart-base/document-kinds/dak.json`, `smart-base/test/results/p2-refusals.qa-results.json` | `smart-base` (`#400` `a7813861`, `#401` `9ad819a5`, `#410` `f04123f5`), `smart-trust` (`#232` `5bb38a6f`, `#240` `046103a2`), `smart-trust-phw` (`#75` `c618c22c`, `#84` `83d494e9`), `folio-assistant-core` (`#800` `745c3541`) |

After this layer's fixes, measured on fresh mounts: `render:bpmn` writes nothing undeclared (its 165 mount writes are the declared site copies in `docs/assets/img/workflows/`, and the 13 changed drawings go to `build/layers/`), and `library:viz` writes 2,696 files in mounts, all declared.

### Measurement for step 7 (2026-11-14)

A composed folio-assistant 44e3a88, tools at main with the reader fixes, core at main, every mount fresh: each of the 359 gates `run-gates.py --list` gives, run alone with a marker before it; then the full `bun test` between `snapshot.py mark` and `snapshot.py diff`. **0 files written inside any of the 12 mounts**, by the gates or by the tests. `render:bpmn`'s site SVGs are written by `derive:publish` in the prepare job, before the mark, into declared `builtAtPublish` paths, so they are not counted. Still to watch: the first layer PR whose checks run the new gate on both sides.

### Measurement for steps 4 and 6 (2026-11-13)

A fresh clone of folio-assistant main, mounted from its `index.lock.json`;
each of the 286 fast gates run on its own; after each, the files newer than a
marker inside every mount. Then `mount-from-lock --check`, and each edited
mount compared file by file with its pinned tree by git blob hash.

- `mount-from-lock --check` after the run: 7 of 12 instances edited
  (cat-harness, cat-harness-tools, fhir-harness, folio-assistant-core,
  folio-assistant-sci, smart-base, smart-trust-phw).
- Committed files whose CONTENT changed: cat-harness 89, folio-assistant-core
  39, folio-assistant-sci 3, smart-base 2. cat-harness-tools' 29 are `.bat`
  files whose CRLF line endings differ from the blob (not edits).
- Every content change was written by the `bun test` gate:
  - pages re-rendered from `docs/source/` by `gen-docs-pages`, differing from
    the committed page: cat-harness `docs/guides/beans-and-todos.md` (loses
    its BPMN figure, and its edit link moves to `docs/source/…`),
    `docs/process/crdm-methodology.md`, `docs/en/cat-harness/fsh-guts/index.md`;
    core `docs/guides/document-ingestion.md`,
    `docs/process/publication-workflow.md`; smart-base
    `site-docs/{concepts,guides}/…`;
  - process diagrams: cat-harness `sdlc/processes/*.svg` (34), core and sci
    `processes/**/*.svg`, bootstrap `processes/*.svg`;
  - translation templates: cat-harness `translations/<locale>/*` (about 10 per
    locale), core `translations/<locale>/processes`.
- The non-test writers that write into mounts write only declared
  `builtAtPublish` paths, so the digest does not count them:
  `smart:pages` writes `smart-base/docs/` (declared, writer
  `smart-base:pages`) and `cat-harness/docs/smart-base/` (declared by
  cat-harness); `ig-index:build` writes the IGs' `fhir-artifact-index/`
  (declared; its move is `litlfred/fhir-harness#412`); `state:mount` writes
  only branch-kept state graphs.
- `qa:refresh` was not exercised: the fast set never builds the QA working
  copy. Step 5 measures it.
- The full `bun test` exceeded the 900 s per-gate bound, so step 6 has more
  to find than this run saw.

### Done when
In a fresh composed checkout, after a full local gate run,
`mount-from-lock.sh --check` reports every instance `current`, and no
`state:mount` exits 1 for an edited mount.

### Finding while measuring item 2 (2026-11-06)
In a freshly mounted composed checkout, `qa:working-copy` fails before any
gate runs: its writer `p2:refusals` needs
`smart-base/fhir-artifact-index/index.json`, which only `ig-index:build`
writes, and nothing orders one before the other. Earlier local runs passed
only because a previous gate had already left that file inside the mount,
which is the very write this item removes. Plan step 2 must therefore give
`qa:refresh` a declared dependency on `ig-index:build` (or have
`p2:refusals` read through `readPathFor`, and build the index on a miss).
