/**
 * THIS layer's partition data — the five-repo target of issue #223, the
 * layering it permits, and the ~190 path entries that say which module is
 * whose.
 *
 * ## It is a module rather than a JSON document, on purpose
 *
 * 65% of the rules below is comment. Those comments are not decoration: each
 * one records how its entry was arrived at, usually by measurement ("measured
 * by putting these in the harness list at the bottom first and watching the
 * two edges survive"; "omitting it cost 3 wrong-direction edges the day #468
 * merged"). A JSON table cannot hold a note positioned beside the entry it
 * explains, and a `why` field per rule would flatten per-ENTRY notes into
 * per-RULE ones. So the split keeps the mechanism generic and leaves the data
 * here, which is `detangler-topic-coherence`'s repair with the host chosen to
 * fit what the data actually is.
 *
 * ## What another layer does
 *
 * Writes its own file like this one and hands it to
 * `scripts/partition/engine.ts`. Nothing in the engine names a repo, a
 * directory or a layer.
 *
 * ## The declared-path literals live here now
 *
 * 36 of the 96 entries in `declared-path-baseline.json` were keyed on
 * `scripts/repo-partition.ts`; they are keyed on this file after the move.
 * That is not churn to be minimised — the literals genuinely moved, and the
 * baseline is keyed by the file that holds them so that a literal appearing
 * in a NEW file is visible as new.
 *
 * @module scripts/partition/instance-rules
 */

import { resolve } from "path";

import type { PartitionSpec, PermittedEdge, Rule } from "./engine.js";
import { TOOLS_ROOT } from "../lib/roots.ts";

// ── The proposed repositories ───────────────────────────────────

/**
 * The five target repositories from issue #223, plus `test`.
 *
 * `test` is NOT a sixth repo in the proposal — it is the Test-repo material
 * the taxonomy describes and Phase III builds. It is tracked separately here
 * because a test module is permitted to import across every boundary, so
 * counting its edges as violations would bury the 33 that matter.
 */
export type Repo = "harness" | "core" | "sci" | "kg" | "base" | "test";

/**
 * Target repository names, in dependency order (most depended-upon first).
 *
 * ## `name` is the TARGET REPO; `instance` is where it is staged today
 *
 * These are two different facts and were one string until 2026-09-26, which
 * is how they drifted. `name` is what the repository will be called when
 * #223 cuts it. `instance` is the directory staging it in this pre-split
 * checkout, and it must equal that directory's own declared `name` — the
 * declaration is the source of truth, so `instance` is a POINTER to it, not
 * a second copy. `partition-names.test.ts` holds them equal.
 *
 * `kg` carries no `instance` ON PURPOSE. `smart-kg` is a Phase III target
 * for WHO L1 document and KG schemas that this checkout does not hold, so it
 * has 0 modules. That is a target not yet staged, NOT a `dh4f`
 * declared-but-absent defect, and the two must not be conflated: the first is
 * a plan, the second is a consumer scanning nothing and reporting a clean run.
 * `undefined` says "no instance yet"; it never means "the instance is missing".
 *
 * ## Why three of these were renamed
 *
 * `folio-assist-core` and `folio-asst-sci` were ABBREVIATIONS of the declared
 * names — no decision behind "asst", just terser — and `agentic-harness`
 * predates the owner's rename of the harness to `cat-harness`, which the
 * declaration, the directory and `AGENTS.md` all already carry. Only the
 * architecture docs and this table still said the old thing.
 *
 * The docs page `/concepts/agentic-harness.html` is NOT this name and was not touched:
 * it documents the agent-user interaction model, which is a concept rather
 * than a repository, and its slug is a published URL.
 */
export const REPOS: Array<{ id: Repo; name: string; instance?: string }> = [
  { id: "harness", name: "cat-harness", instance: "cat-harness" },
  { id: "core", name: "folio-assistant-core", instance: "folio-assistant-core" },
  { id: "sci", name: "folio-assistant-sci", instance: "folio-assistant-sci" },
  { id: "kg", name: "smart-kg" },
  { id: "base", name: "smart-base", instance: "smart-base" },
  { id: "test", name: "(test material)" },
];

/**
 * What each repo is permitted to import from — itself plus its ancestors in
 * the dependency DAG. An edge to anything else is a wrong-direction edge.
 *
 * Mirrors the diagram in `docs/concepts/architecture/future-state.md`:
 *   core -> harness;  sci -> core;  kg -> core;  base -> kg
 */
export const ALLOWED: Record<Repo, Repo[]> = {
  harness: ["harness"],
  core: ["core", "harness"],
  sci: ["sci", "core", "harness"],
  kg: ["kg", "core", "harness"],
  base: ["base", "kg", "core", "harness"],
  // A test may reach anywhere it needs to; that is what a test is for.
  test: ["test", "base", "kg", "sci", "core", "harness"],
};

// ── Assignment rules, in priority order ───────────────────

/**
 * Ordered. First match wins, so explicit path rules must precede keyword
 * rules — otherwise `src/tools/workflow.ts` is claimed by the BPMN keyword
 * before the harness rule can claim it.
 */
export const RULES: Rule[] = [
  // ── Test material. FIRST, so that `scripts/tests/lean-witness.test.ts` is
  //    classified by what it IS (a test) rather than by what it exercises.
  //
  //    `"test/"` since 2026-09-19 (bean `auap`): the two test trees were
  //    consolidated onto `test/`. Leaving this as `"tests/"` would NOT have
  //    errored — the 10 `*.e2e.ts` specs, their two `support/` fixtures and
  //    the health sweep's three non-`.test.ts` modules would simply have
  //    fallen past this rule to keyword matching, since the rule below keys
  //    on `.test.ts`/`.spec.ts` and an `.e2e.ts` matches neither. Fifteen
  //    modules quietly reclassified, and a partition report that still
  //    printed a total.
  {
    repo: "test",
    // declared-path-literal: the TARGET layout of the five-repo split, which no
    // declaration in THIS repo describes — that is the whole point of the plan.
    prefixes: ["test/", "scripts/tests/"],
  },
  {
    repo: "test",
    keyword: /\.(test|spec)\.ts$/i,
  },

  // ── Hand-triaged platform meta-scripts (2026-09-18).
  //
  //    These 27 were reported `unassigned` by the structural rules: they are
  //    `gen-*`, `check-*`, `render-*` scripts that operate on the platform's
  //    own docs, schemas, skills and workflows. Each was read and assigned by
  //    the bean `dh4f` question — does it read or write PLATFORM or CONTENT?
  //    Kept as an explicit list rather than a prefix rule because the answer
  //    genuinely differs per file: `gen-skill-docs` is harness (Skills are a
  //    harness concept) while `gen-schema-docs` is core (the content-object
  //    model is core's), and no path pattern separates them.
  {
    repo: "harness",
    triaged: true,
    exact: [
      // HARNESS: the review page is rendered surface, which the harness owns
      // (bean txut; 7ofc's ruling for the folio visualiser). It imports
      // only harness modules (the diff renderers and their registry, bean
      // d903); build-document-site (core) calls it, core -> harness.
      // HARNESS, by the same test as `check-ci-health.ts` above: its subject is
      // this checkout's own ENVIRONMENT — whether a nested `node_modules` or a
      // symlinked root makes a tool answer a question about the repository from
      // something the repository does not contain (bean `3vc1`). It reads no
      // folio material and no content schema; it imports `node:fs` and
      // `node:path` and nothing else, so it cannot drag a folio in. `gates.ts`
      // is its only caller and is itself harness, so the edge runs
      // harness -> harness.
      // The IMPORT half of that arrow, over every declared layer (bean
      // `p11x`). Harness for the same reason: it reads declarations and module
      // specifiers, consumes the same `layer-direction.ts`, and no folio content.
      // The PROCESS-BINDING half of that arrow (owner, 2026-10-03): which
      // layer a BPMN's `<skill ref>` reaches. Harness for the same reason —
      // it reads declarations, BPMN extension elements and skill file names,
      // consumes the same `layer-direction.ts`, and no folio content.
      // HARNESS, for the same reason: it judges directory declarations'
      // `derivedFrom` edges with the same reach, and reads no folio content.
      // HARNESS, beside it (bean `0b8c`): runs the writers of the artefacts
      // check:derived-from names as built at publish; reads declarations only.
      // HARNESS: the staging cone (bean `4j86`) computes over declarations and
      // module specifiers, and reads no folio content.
      // HARNESS on the same argument: its subjects are this repository's own
      // generated navigation (`_data/harness.json`, the navbar include, the
      // rail written into viewer pages) and its landing templates. It opens
      // no folio content (bean `ob3m` finding 6).
      // HARNESS: the one orphan-page selector (bean `s8nu`), extracted as a
      // LEAF so `state-visualizer.ts` can be a call site without importing
      // `gen-schema-viz.ts` -- a 1200-line page generator whose body is one
      // template literal. Same move #840 made for the graph-typology registry.
      // It imports `node:fs` and `node:path` and nothing else, so it cannot
      // drag a layer in behind it; its subject is which pages a generator in
      // this repository wrote, not any folio's content.
      // HARNESS with the gate above, which imports it: it runs `kg-export`
      // once per declared layer for this repository's deploy, and reads
      // only the declarations (bean `4ak5`).
      // HARNESS beside `root-index.ts`, by the same `dh4f` question: it writes
      // an INDEX checkout's root `AGENTS.md`/`README.md` from
      // `index.config.json` and the layers' declared assets (owner
      // 2026-10-09, `index:render`) — the platform's entry files, no folio's
      // content. Its one core import, `readme-sections` (the marker splice),
      // is not a wrong-direction edge: it is a command (shebang), so a
      // composition root, and `isCompositionRoot` exempts it by rule.
      // The two halves this tool was split into, 2026-09-20. Both HARNESS,
      // and the target-before-importer test says why: `engine.ts` imports
      // nothing but `fs` and `path`, and this file imports one TYPE from
      // it. Neither reaches for a folio, so neither can drag one in.
      //
      // They are listed rather than covered by a `scripts/partition/`
      // prefix ON PURPOSE: a prefix would claim whatever lands in that
      // directory next, and a rule that classifies by location will keep
      // reclaiming. The gate caught both of these as unassigned the first
      // time it ran after the split, which is the behaviour worth keeping.
      // HARNESS, and the reasoning is the same as `check-ci-health` above:
      // it reasons about LAYERS and their declarations — which harness
      // instantiated which directory, and where that mounts on the published
      // site. It never opens a content object. The owner's addressing rule
      // (`<base-url>/<path-to-kind-or-node>`) is a statement about harnesses,
      // not about what a folio holds.
      // Its reader of `withheld.json` (bean `mkao`): what a layer must not
      // publish. Same layer — it is a question about what a harness puts on
      // the site, answered from a list the layer declares — and shared with
      // the library viewer so the two publishing channels read ONE answer.
      // The harness navigation it injects into those pages. Same layer by the
      // same argument: the rail is the HARNESS's chrome, and it exists because
      // a mounted page gets no Jekyll layout. Putting it in a folio's
      // generator would give every layer its own copy of the platform's
      // navbar, which is the boundary AGENTS.md opens with.
      // The renderer that rail became an adapter over (bean `sjic`). HARNESS
      // by the same argument and more strongly: it is now the ONE navbar, for
      // a mounted page and for a Jekyll page alike, so a folio owning it would
      // mean a folio owning the platform's chrome for every other layer
      // too. It renders a model and reads no content object -- the model's
      // regions are composed by the caller from declarations.
      // The ONE conversion from a harness row's resolved mark to that
      // navbar's fields (bean `2vpn`). HARNESS beside `navbar.ts`: every
      // surface that draws a harness's mark calls it, so a folio owning it
      // would let one layer decide how every other layer's mark is read.
      // What that chrome's data says on a FOLIO's own site (#2263): its tiles,
      // icon row and rail scopes scoped to the folio, the platform's graphs
      // re-based onto the platform. HARNESS beside `harness-rail.ts`: it is the
      // platform deciding how its own chrome reads elsewhere, and a folio
      // owning it would let one layer decide what every other shows.
      // How a GRAPH-TYPOLOGY row in that navbar is marked and named (bean `yag0`):
      // the kind's avatar glyph and hue, and the head of its registered
      // summary as the accessible name. HARNESS beside `navbar.ts` for the
      // same reason — it is the platform's chrome, read from the platform's
      // kind and avatar registries, and both navbar callers share it.
      // The light/dark half of that chrome (issue #2208): dark rules that
      // follow the navbar's switch, and the saved-scheme first-paint snippet.
      // HARNESS beside `navbar.ts` -- the switch is the platform's, and every
      // page carrying it, a folio's included, has to agree on what it means.
      // The locale half of that chrome (issue #2219): the docs pages'
      // `fa-translation-meta` block, written onto a MOUNTED page so it draws
      // the same band globe. HARNESS beside `scheme-css.ts` -- it is
      // `head_custom.html`'s block, and a folio owning it would let one
      // layer decide what every other mounted page declares.
      // The migration a renamed or major-bumped NODE KIND ships with (issue
      // #2195): rewrites `$schema` values only. HARNESS, beside the node-kind
      // machinery in `schemas/kg/node-kind.ts` it serves.
      // The generic node-kind pages (issue #2195): one per kind, harness and
      // node. HARNESS for the reason the viewer pages are: it is the
      // platform's view of any harness's nodes, and its reader beside it.
      // The geometry that navbar became a reader of, and the generator that
      // renders it to CSS (bean `sjic`). HARNESS for the same reason as
      // `navbar.ts` and one step more plainly: the numbers are the width of
      // the PLATFORM's chrome on every layer's pages at once, so a folio
      // owning them would set the navbar's width for every other folio. The
      // generator writes into the site's own asset directory, deriving the
      // path from `siteDirFor` rather than naming it, so it does not know
      // which layer it is writing for either.
      // The rail's shared assets (bean `lnoy`): `navbar.css` from `navbarCss()`
      // and `navbar.js` bundled from `navbar-client.ts`, the browser half of
      // `renderRailRegions`. HARNESS for the same reason as `navbar.ts`: the
      // platform's chrome on every layer's pages, written into the site's
      // own asset directory through `siteDirFor`.
      // Its sibling: same question, same answer. `compose-docs.ts` reads the
      // `docs` declarations, works out which is the base and which the
      // overlay from `scope`, and lays them down in order. Every decision it
      // makes is about LAYERS and where their directories resolve; it
      // opens the files only to copy bytes, and never asks what a page says.
      // Where the built layer's docs pages publish (`docs/<name>`, bean
      // `kc7k`), and Jekyll's permalink rule that puts them there, read once
      // for every generator that links to a page by its source path. Both
      // are about the SITE's addressing, the platform's concern, and neither
      // reads what a page says.
      // Whether a swimlane DEFINES itself — `name`, `<documentation>`, and
      // both reaching the translation templates. Harness by subject for the
      // same reason as its neighbour above: a lane is a ROLE boundary, which
      // is a platform concept, and the diagrams it reads are the platform's
      // own processes. A folio that draws none still inherits the rule.
      // ...and the signals themselves, lifted out of it by bean `xfoh` so the
      // patterns could be checked against the skill prose they transcribe.
      // Same side as its runner, and harness by subject too: whether a request
      // is a PLATFORM capability change is a question about the platform, and a
      // folio that never asks for one still needs the answer to be "no".

      // Reported `unassigned` on 2026-09-18 and read one at a time, same
      // question as the rest of this list: does it act on PLATFORM or on
      // CONTENT? All six act on harness-level graphs — Tools, the knowledge
      // graph, the layer declaration, the CI workflows — so none of them
      // needs a folio to have anything to do.
      // Reported `unassigned` on 2026-10-09: the npm packaging of a graph and
      // the query engine over its N-Quads. Harness by subject — they package,
      // fetch and query a layer's KNOWLEDGE GRAPH, whatever it holds, and
      // a folio could not make any of them act differently.
      // Harness by subject: the slice is the platform's own work plan, and the
      // per-slice SQLite contract is a kg-export one (bean `q8ar`).
      // Third question about the same built tree, and harness-level for the same
      // reason: it asks whether the markdown converter refused a block of HTML
      // and escaped it, which is a property of the RENDER PIPELINE, not of any
      // folio's subject matter. It imports nothing but `node:fs` — a folio could
      // not make it answer differently.
      // Its merge-time sibling, and harness-level for the same reason: it
      // resolves conflicts in the `qa` graph by re-running whichever writer
      // the sidecars name. It reads the DECLARATION, `package.json` and git's
      // index, and nothing in it is about any folio's subject matter — a folio
      // could not make it resolve differently, only give it more files.
      // Where the `qa` graph is KEPT once it leaves main (bean `16ei`): the
      // read/write API over the `qa-reports` branch. Harness-level for the
      // same reason as its two neighbours — it reads the declaration and git,
      // and no folio's subject matter could make it answer differently.
      // Its generalisation (bean `2h76`): the same branch-kept store for ANY
      // directory declaring `storage.keyedBy: "tip"`. Harness-level for the
      // same reason as `qa-store` — it reads the declaration and git, and no
      // folio's subject matter could make it answer differently.
      // Its session-start step (bean `2h76` part 4): fetches the declared state
      // branch and checks it out as a read surface. Harness-level for the same
      // reason as the three above.
      // The seeds' own freshness check (bean `9ofm`): it reads each special
      // branch's `manifest.json`, resolves the ref that manifest names, and
      // compares the two TREES. Harness-level for the same reason as its
      // neighbours, and one more: the branches it reads are the ones the
      // layers' declarations name (special-branches.json is gone, owner
      // 2026-10-05) — a folio's subject matter cannot change what a tree
      // comparison concludes.
      // What every reader of a moved graph needs, written once (bean `9ofm`
      // row D): given a declared directory id, which directory to actually
      // read — the checkout, the mount, or a refusal. Harness-level for the
      // same reason as its neighbours: it reads the declaration, git and the
      // mount marker, and no folio's subject matter could make it resolve
      // differently — only give it more directories to resolve.
      // Its clean-merge counterpart, and harness-level for the same reason: it
      // loads the GATE SET from the workflow and re-runs whichever writers
      // their checks report stale. It knows nothing about any folio's subject
      // matter — a folio could not make it repair differently, only give it
      // more gates.
      // The merge step that calls it, and harness-level for the same reason:
      // it classifies conflicted PATHS against declared patterns and proves
      // the result through `regen`. A folio could not make it resolve
      // differently, only give it more generated files (bean `d33q`).
      // The queue's STORE and its command (bean `najo`), harness-level for the
      // same reason as the two above: they read and write the `merge-queue`
      // graph of THIS repository's declaration, through the generic branch
      // store, and a folio could not make either answer differently — only
      // record more decisions. The store is the reader (four states, and a
      // throw rather than an empty queue for the one that cannot be reached);
      // the CLI is `merge:queue:read` and `merge:queue:record`.
      // Its tile half, and harness-level for the same reason: it reads every
      // LAYER's declaration and the published viewer tree, and asks which
      // harnesses exist and what each one has to look at. Nothing in it is
      // about any folio's subject matter — a folio could not make it answer
      // differently, only add a row.
      // The tile half of a KG subscription (issue #1719): which chosen harnesses
      // are instantiated at the root, read from their snapshots. HARNESS so the
      // tile above may import it; `kg-instantiate.ts` (core) imports it too.
      // Its site half (bean `g8jp`): each subgraph a subscription chose,
      // resolved to the tree held for it. HARNESS for the same reason — the
      // tile above and `mount-instance-docs.ts` / `compose-docs.ts` (all
      // harness) import it, and it reads declarations, never folio content.
      // The part LAYOUT both halves share, moved out of `kg-subscribe.ts`
      // (core) so the reader above may import it (bean `g8jp`).
      // Beside its sibling, and HARNESS rather than core — the opposite
      // classification to `gen-default-boards.ts`, for the reason that entry
      // records: what settles it is what a module is ABOUT. That one produces
      // folio content (a board); this one reads layer DECLARATIONS and
      // answers a question about the machinery — which directories a layer
      // says it renders. Its only import is `schemas/kg/cat-harness.ts`, which is
      // harness, so the direction is flat rather than upward.
      //
      // Classified core first, on the reasoning that a tile is something a
      // reader sees. `check:partition` answered with a wrong-direction edge
      // from `sync-docs-harness.ts`, which is harness and calls it — the
      // import was right and the classification was wrong.
      // Same question, same answer: it projects the PLATFORM's own term
      // vocabulary — every class and property hanging off `FOLIO_NS` — and
      // needs no folio to have anything to do.

      // `schemas/` is claimed wholesale by a core prefix rule, but the
      // directory holds schemas from all three layers. These four are the
      // harness's own, and classifying them core produced NINE
      // wrong-direction edges out of the harness — the harness importing
      // definitions it owns. Same defect as `lean-packages.ts`, at scale, and
      // the reason a `<graph>/<stub>/` layout would carry the answer in the
      // path instead of in this list.
      "schemas/tools/tool.ts",                     // what a Tool IS — `tools` is a harness graph typology
      "schemas/tools/tool-run.ts",                 // a downstream Tool's run record (bean `fq5u`)
      "schemas/content/withheld.ts",                 // what a layer must not publish — read by the harness mount (bean `mkao`)
      "schemas/tools/tool-types.ts",               // the Tool I/O type vocabulary
      "schemas/tools/store-tool-results.ts",       // typed results of the data store tools, part of the Tool I/O vocabulary (#1259)
      "schemas/tools/workflow-tool-results.ts",    // typed results of the workflow engine tools, Tool I/O types (#1259)
      "schemas/sdlc/harness-state.ts",            // a harness's published state, the HarnessStates Tool I/O type (#1259)
      "schemas/sdlc/gates-report.ts",             // the gates and check:merged reports, Tool I/O types (#1259)
      "schemas/tools/tool-id.ts",                  // a Tool's id — imported by `tool.ts` and `remote-mount.ts` (cat-harness#581)
      "schemas/kg/repo-full-name.ts",           // `owner/name` — a Tool type AND the declaration's repository (bean `6rmv`)
      "schemas/kg/instance-repositories.ts",    // the derived owner/repo ↔ layer map (bean `6rmv`)
      "schemas/kg/skill-definitions-dir.ts",    // where the JSON skill definitions and conventions live (bean `rqao`)
      "schemas/kg/kg-node.ts",                  // the labels every KG node carries
      "schemas/harness-root.ts",                // declared-path-literal: a partition plan names modules by path. Where the harness is, for code that moved out of it (bean `8lcl`)
      "schemas/kg/harness-config.ts",           // cross-instance dependency resolution
      "schemas/kg/subgraph-source.ts",          // where a declared subgraph gets its content (bean `l4ay`) — read by the declaration schema itself
      "schemas/kg/opt-in-subgraphs.ts",         // declared-path-literal: a partition plan names modules by path. Opt-in named sub-graphs (cat-harness#991 step 23.1) — read by the directory resolvers themselves
      "scripts/lib/harness-layout.ts",         // declared-path-literal: a partition plan names modules by path. TRANSITIONAL: which layout the harness checkout has, legacy or the sdlc/work-plan sub-graphs (cat-harness#991 step 23; remove after cat-harness#1014 merges)
      "schemas/kg/remote-mount.ts",             // declared-path-literal: a partition plan names modules by path. Remote mounts (bean `0mpw`): mountDefaults, remoteMounts, the lock
      "schemas/kg/mount-trust.ts",              // declared-path-literal: a partition plan names modules by path. What a remote mount needs to be trusted (bean `ieum`, H8) — read by remote-mount.ts
      "schemas/kg/index-config.ts",             // declared-path-literal: a partition plan names modules by path. The root index.config.json (bean `ymvt`): instantiated harnesses, their sources, the landing — read by harness-config.ts
      "schemas/kg/repo-owner.ts",               // declared-path-literal: a partition plan names modules by path. Same-owner repository names and the derived checkout owner (cat-harness-tools#2337) — read by remote-mount.ts and index-config.ts
      "schemas/kg/built-at-publish.ts",         // what a layer serves and never commits — read by the declaration schema itself (B1)
      // What one run ran on (bean `3sbm`), cited by digest from the harness's
      // own run records — tool-run, test-report, health-report and kg-qa — so
      // harness, with the release shapes it states its releases in. Left to
      // the `schemas/` prefix rule they were core, and each citation was a
      // wrong-direction edge.
      "schemas/sdlc/run-context.ts",              // declared-path-literal: a partition plan names modules by path. The run context every harness run record cites
      "schemas/tools/tool-release.ts",             // declared-path-literal: a partition plan names modules by path. A Tool release, resolved
      "schemas/sdlc/binary-release.ts",           // declared-path-literal: a partition plan names modules by path. The digest of a release
      "schemas/library/outside-software.ts",         // declared-path-literal: a partition plan names modules by path. What a release is OF, with its licence
      "schemas/library/spdx-license-expression.ts",  // declared-path-literal: a partition plan names modules by path. The licence check outside-software runs
      "schemas/content/pinned-terminology.ts",       // declared-path-literal: a partition plan names modules by path. The pinned list shape the licence check reads (bean `7wou`)
      "schemas/sdlc/read-projections.ts",         // declared-path-literal: a partition plan names modules by path. Projected reads (#1291): layer discovery and the declaration walks report how they use a file

      "schemas/kg/property-skills.ts",          // declaration key → its edit skills (issue #1146)
      "schemas/kg/dependency-order.ts",         // the ONE resolve-then-walk: flatten, ancestors, conflicts (bean `a1lq`)
      "schemas/kg/layer-direction.ts",          // the ONE wrong-direction verdict, shared with kg-detangle (bean `j79e`)
      // "what files does this REPOSITORY contain", asked of git rather than of
      // the disk (beans `rsi6`, `xd1g`). Harness by its subject: the corpus it
      // reports is a checkout's, and its whole point is that a folio's material
      // and a machine's untracked residue are not the same set.
      //
      // It sat under `scripts/` until 2026-09-26 and moved here on the owner's
      // ruling that a SKILL must not know about a script, and that a script
      // belongs to `tools`. `kg-detangle.ts` is a skill-directory node and
      // needs this rule, so leaving it in `scripts/` would have minted the
      // first `skills/` -> `scripts/` edge in the repository (measured: zero
      // such edges). Its neighbour above is the precedent rather than an
      // analogy -- the same shape, shared by the same two callers.
      "schemas/sdlc/git-corpus.ts",
      "schemas/kg/detangle.ts",                 // the detangle criterion — folded in from its own layer (bean `byql`)
      "schemas/kg/detangle-sidecar.ts",         // what a detangle measurement pins (bean `byql`)
      "schemas/kg/node-kind.ts",                // node kinds declare their parents; composed by that walk (bean `a1lq`)
      "schemas/kg/memory-record.ts",            // the memory record a bean extends (cat-harness#991 Q17) — read by bean-graph.ts
      "schemas/ui/diff-renderers.ts",           // the review page's diff renderers, declared as data (bean `d903`)
      // What a graph TILE shows. Same argument as `scripts/graph-tiles.ts`
      // twenty lines up, and it arrived the same way: classified core first
      // because a badge is something a reader sees, and `check:partition`
      // answered with a wrong-direction edge from `sync-docs-harness.ts`,
      // which is harness and reads it. A tile is harness machinery whatever
      // it looks like on the page.
      "schemas/ui/tile-count.ts",               // a projection's declared headline number
      // The skill-framework vocabulary — actors, capabilities, skills,
      // requirements, the package registry. It was the top 240 lines of
      // `constraints.ts` and 32 aliases in `types.ts`, which put it under the
      // core `schemas/` prefix and made four harness modules read as depending
      // on the content layer. None of it describes a folio's content.
      "schemas/kg/skill-package.ts",
      // `skills.json`'s shape (bean `9umr`); read by `scripts/skill-topics.ts`.
      "schemas/kg/skill-topics.ts",
      // The other grouping kinds' from-within group declaration (placement
      // PR0c, bean `ejye`); imports only zod. Concern groups are how the
      // harness's own subgraphs are laid out, not content.
      "schemas/kg/concern-groups.ts",
      // Roles, actors and capabilities extended by id from a dependent's
      // `scenarios/` (placement PR0b). The role model is harness vocabulary
      // (`role-graph.ts` below), and this reads it and `harness-config.ts`.
      "schemas/process/scenario-overlay.ts",
      // What happened when a Tool ran, and under whose authority. Tools are
      // the HARNESS's vocabulary — the `tools` graph is declared by
      // `agentic-harness`, not by any folio — and this file imports only
      // `zod`, so it carries nothing of the content model with it. Its one
      // production consumer, `src/mcp/project.ts`, is the harness's too.
      "schemas/tools/tool-invocation.ts",
      // A standing rule an actor holds while performing a task, bound to a
      // process, a lane or an activity. That is the HARNESS's vocabulary —
      // conventions are carried on BPMN nodes and resolved by
      // `src/workflow/process-model.ts`; no folio's content model mentions
      // them. Omitting it cost 3 wrong-direction edges out of the harness the
      // day `folio-assistant#468` merged, and the gate did not catch it
      // because `check:partition` reports without `--strict` and exits 0.
      "schemas/process/convention.ts",
      // The composition root's own inventory of which content adapters this
      // layer ships. `src/` is claimed by subdirectory, so a new file at
      // its top level falls through — reported `unassigned`, which is the
      // tool working: it declined to guess rather than defaulting.
      // Materialises the directories this layer DECLARES, from
      // `harness-config.ts`. It acts on the declaration and needs no folio to
      // have anything to do — arrived from `main` and fell through every
      // prefix, which the tool reported as `unassigned` rather than guessing.
      // The `@graphNode` declarations under `schemas/` and the gate over them.
      // Harness because the `schemas` GRAPH TYPOLOGY is the harness's vocabulary —
      // `harness.json` declares it — even though the directory holds
      // content-model schemas too. These read the declarations; they define no
      // part of the content model.
      // RACI over the BPMN corpus and the role registry. Harness for the
      // same reason as the rest of this block: it reads the declaration
      // for where diagrams and roles live, and needs no folio to have
      // anything to do.
      // Subgraph containment and entanglement (bean `x4v4`). Harness for the
      // same reason as the block above, and more plainly than most: it reads
      // `harness.json` for the directories, DERIVES the nesting from their
      // declared paths, and has nothing to say about any folio's content.
      // How many scripts enumerate the filesystem, and how many ask git what
      // the corpus is (bean `xd1g`). Harness for `check-subgraphs.ts`' reason
      // and more plainly still: its whole subject is this repository's own
      // `scripts/` directory read through `gitCorpus`, and it cannot express
      // an opinion about a folio because it never looks at one.
      // Does a generator's COMMITTED OUTPUT change when gitignored content is
      // present (bean `qrlc`)? Harness by the same route as the census above:
      // its subjects are derived from this repository's own `package.json`
      // scripts, it compares them with `git status`, and it never opens a
      // folio's content — it only asks whether running a writer produced
      // different bytes.
      // Whether every workflow installs the Bun that `.bun-version` names
      // (bean `3ozg`). Harness for the same reason as the line above: its
      // subject is `.github/workflows/` plus one repo-root pin file, and it
      // reads no folio content.
      // The shared "a gate that examined nothing must refuse" decision (bean
      // `iym1`). Harness because it is a helper for the harness's own gates and
      // reads nothing at all: it is handed a list of what a caller looked at and
      // returns a message. It has no corpus of its own, which is why it can be
      // tested over a CONSTRUCTED empty one while the gates it serves cannot.
      // Whether each methodology's cited `origin` resolves to an ingested
      // source. Harness for the same reason as the two above: it reads the
      // declaration for the `methodology` and `library` graphs and fans out
      // over every declared library, and it has nothing to say about any
      // folio's content — the methodologies it reads are the harness's own
      // judgement methods; WHO guideline method (GRADE) is a skill, not a node here.
      // Snapshots the SPDX License List ids that check validates against (bean
      // `sd5v`): the same subject — every declared library's licences — and
      // no folio's content.
      // The knowledge-graph viewer's generator — KG tooling, arrived from
      // `main` and fell through every prefix.

    ],
    // declared-path-literal: the TARGET layout of the five-repo split, which no
    // declaration in THIS repo describes — that is the whole point of the plan.
    prefixes: ["src/impact/"],               // who a change affects: skills, roles, BPMN lanes
  },
  {
    repo: "sci",
    triaged: true,
    exact: [
      // 🟧 OWNER RULING 2026-09-27, verbatim: "field sits on shared kinds
      //    (remark, example, algorithm, simulator), so the grammar genuinely
      //    is vocabulary that goes tp f-a-sci" — reversing the inference the
      //    core triage block below applied FIVE times (see its header, now
      //    corrected). A `lean` field on a shared kind does not make the
      //    grammar core; it makes that field on those kinds part of the
      //    science vocabulary.
      //
      //    These two move FREE: MEASURED, reassigning them adds ZERO
      //    wrong-direction edges. The other two the ruling reaches
      //    (`schemas/lean-packages.ts`, `pipeline/lean-signature.ts`)
      //    cost SIX core -> sci edges and are held pending the owner's call on
      //    how core is to carry a formal reference it does not own. qou bean
      //    `qou-7ko6`.
    ],
  },
  {
    repo: "core",
    triaged: true,
    exact: [
      // `schemas/dak-blocks.ts` was listed here as CORE until bean `1335`,
      // because core's `schemas/content/block-kinds.ts` then declared
      // `CONTENT_ADAPTERS = ["paper", "dak"]` and `DAK_BLOCK_KINDS`, and the
      // module defining their schemas could not sit in a different repository
      // from the union naming them. That premise was removed rather than the
      // classification argued again: smart-base now CONTRIBUTES the `dak`
      // adapter and its kinds (nodes in its own graphs since bean riit), core's built-in
      // vocabulary is `paper` only, and `dak-blocks.ts`, `qa-checkers-dak.ts`
      // and `gen-dak-components-figure.ts` moved to `smart-base/`, outside this
      // tool's scope. Nothing under `cat-harness/` imports them.
      // CORE, not harness beside gen-uml-overview: it needs a folio to have
      // anything to do, and its input is the core content model
      // (`pipeline/content-graph.ts`). The shared PlantUML machinery it
      // imports (`scripts/plantuml-render.ts`) stays harness, so the edge runs
      // core → harness, the allowed direction.
      // Re-triaged 2026-09-19, bean `zlmp`. Listed as harness until then, on
      // "editing-process authorisation gate". But AGENTS.md says it runs IN a
      // FOLIO repo, from that repo's pre-commit hook or CI, and the triage
      // question is whether a script reads PLATFORM or CONTENT: this one reads
      // changed content blocks. Enforcing a harness-defined process does not
      // make the enforcer harness, any more than a linter belongs to the
      // language it checks. With `labelFor` inverted out of corpus-gate.ts,
      // this classification is what actually removes the two edges — the
      // inversion alone just relocated them here, measured.
      // CORE, not harness, and the test is the one this table uses elsewhere:
      // does it need a folio to have anything to do? This one CREATES the
      // folio graph and writes content nodes into it — the landing stickies —
      // so it does not merely need a folio, it is where one comes from. It also
      // imports `schemas/content/landing-sticky.ts` (a content node) and
      // `schemas/kg/folio-graph-typology.ts`, which is core's by the argument written
      // on that module: a layer that cannot render must not own the renderable
      // kind. Classifying it harness would put core's own kind registration
      // behind a harness module.
      // CORE, and my first classification of it was WRONG. I filed it with
      // the harness because it reads the TOOL declarations, and `--edges`
      // immediately reported the consequence: a harness module importing
      // `schemas/library/tabular-csvw.ts`, which is core's. The table's own test
      // settles it — does it need a folio to have anything to do? It scans
      // `library/` for tabular records, so yes. Reading the tool graph is
      // core importing harness, which is the allowed direction.
      // Same repo and the same reason: it reads the folio graph's sticky nodes
      // and writes the data file the landing page renders from. It was part of
      // `sync-docs-harness.ts` (agentic-harness) until `--edges` reported that
      // as two wrong-direction edges — the harness reaching up into core.
      // The same shape as the entry above, arrived at independently: its
      // subject is the avatar crop boxes (harness — site presentation), and
      // its classification is decided by the import, because it reads THIS
      // LAYER'S declaration and so must register core's `folio` kind.
      // The theming subgraph's VISUALISER, and core for the same reason as the
      // two above: it reads this layer's declaration to resolve each
      // theme's backdrop, so it must register core's `folio` kind.
      // The reverse of `check-declared-assets` (declared -> disk): this walks
      // disk -> declared. Same reason it is core rather than harness — it reads
      // a layer's declaration, and this layer declares a `folio` graph,
      // so it imports core's kind registration.
      // The schema and library visualisers, and the two readers behind them.
      //
      // CORE rather than harness for the reason every entry above shares: each
      // reads THIS LAYER'S declaration, and this layer declares a `folio`
      // graph, so each must import `schemas/kg/folio-graph-typology.ts` for the kind
      // to be registered — and that module is core's by the argument written on
      // it ("a layer that cannot render must not own the renderable kind").
      //
      // The generators are core on a second count as well, and it is the
      // stronger one: they WRITE INTO THE RENDERED SITE. `cat-harness-minimum`
      // carries "if it produces something a human looks at, it is not the
      // harness", and a page under `docs/` is exactly that.
      // The viewer page's COMMON FIXTURE and its audit (bean `edx7`). Core
      // beside `check-viewer-backticks.ts` and for the same two reasons: they
      // guard what every viewer generator writes, and they write into the
      // rendered site. The navbar MODEL is composed here from the
      // declarations; the component itself is `lib/navbar.ts`, so this adds a
      // caller and not a second answer to what the navigation looks like.
      // The rail over the FINISHED site (bean `oi1y`). Core beside
      // `mount-instance-docs.ts`, whose pipeline it asks for the mount routes
      // rather than guessing them, and which it deliberately runs after.
      // The Jekyll sidebar's navbar, rendered by the shared module rather
      // than composed in Liquid (bean `sjic`). Core beside `lib/navbar.ts`,
      // which it calls: a generator that lived elsewhere would be a second
      // place deciding what a harness row contains, which is the defect.
      // gen-bootstrap-schemas and bootstrap-schema-page moved to the sibling
      // layer `bootstrap-tools/` (bean `xsqm`), outside this partition.
      // A README per declared directory, from the declaration. Core beside
      // `readme-sections`, whose file description and 'used by' it reuses.
      // Its sibling for a library ITEM (bean `qgjh`): the same markers and
      // `splice`, the words from the item's own manifest. Core beside it.
      // The methodology graph → projection + viewer. CORE by the same two
      // counts as its siblings, and by a third: it renders the graph across
      // EVERY layer that declares one, so it is the harness answering
      // "what has this repository adopted", not one layer answering for
      // itself. Its node list and its evidence join both come from
      // `check-methodology-evidence.ts` rather than a second walk.
      // The external-schema registry → projection + viewer, plus the one join
      // nothing else makes: whether each record's `usedBy` path still exists.
      // CORE beside `external-schemas.ts` itself, which is already here.
      // Its shared answer to "does this skill have a page" (bean `qgjh`): the
      // tools and processes visualisers link a skill only where one is, so the
      // module sits beside the two viewers that read it.
      // The raw-block wrapper both of those visualisers emit authored text through
      // (bean `kjbb`): a closing tag inside the text must not end the block early.
      // The themed-page shape every viewer generator now writes through (#2418):
      // front matter, then the body inside that raw block. Beside its one import.
      // Its library twin (bean `qgjh`): where a library reference links — the
      // viewer, the item README, the upstream record — read, never composed.
      // The three materialisation modules that stood here — `check-materialized-fixity.ts`
      // (materialized bytes vs their recorded digest, the read-only rule enforced),
      // `backfill-materialized-fixity.ts` (records the baseline digest that check reads)
      // and `cache-index.ts` (what is materialized, how big, how old, what could go —
      // bean `54rk`) — are GONE FROM THIS LIST because they are gone from this
      // layer. Bean `yj6r` moved them to `folio-assistant-core/scripts/`, where
      // `schemas/materialization.ts` already lived. The classification did not change;
      // the DIRECTORY caught up with it, so the fact is now carried by location rather
      // than by a rule, and an `exact` entry naming a path this scan can no longer see
      // would be a rule that fires on nothing while reading as an adjudication.
    ],
  },


  {
    repo: "harness",
    exact: [
      // HARNESS. The content model and the content half of an adapter, split
      // out of `src/types.ts` (bean `w2gr`, step 1, owner ruling 2026-10-01):
      // the server half moves to `cat-harness-tools`, and core must not depend
      // on that, so the vocabulary both sides use stays here.
      // HARNESS, both re-triaged 2026-09-19 while draining the last edges.
      //
      // `schemas/content/contributions.ts` is what a DEPENDENCY may add to the root
      // layer — its own header calls it Phase 0.1 of the separation. It is
      // the composition mechanism of the harness, not a thing a folio
      // contains, so `harness-config.ts` importing it was never the wrong
      // direction; the target was on the wrong side. Its other importer,
      // `pipeline/render-discovery.ts`, is core, and core may import
      // harness.
      //
      // `pipeline/repo-root.ts` resolves WHERE the content repo is by
      // walking up for `computations/` and `content/`. Those directory names
      // are markers it matches on, not a model it defines — and the cut is
      // processes versus tooling. Measured: twelve importers, every one under
      // `scripts/`. A module used only by tooling, doing path resolution, is
      // tooling.
      // Ten scripts left unjudged, classified 2026-09-19. Every one is
      // TOOLING under the process-versus-tooling cut — four checkers, two
      // generators, two staging helpers, a bean-claim CLI and a front-matter
      // parser — and none reads content. Left unassigned they produced 21
      // edges the tool "declined to judge", which its own message says must
      // NOT be read as clean: an unjudged edge is not a passing one.
      //
      // Several arrived from sibling sessions within the hour, which is the
      // normal way this list goes stale rather than a lapse.
      // HARNESS, exposed once the ten above stopped hiding their edges.
      //
      // `schemas/ui/theme.ts` / `themes.ts` are the STICKY-NOTE themes — colour
      // roles and layouts for the docs site, generated into CSS by
      // `gen-themes-css.ts`. Site presentation belongs to the platform that
      // publishes the site, not to a folio's content model, and their own
      // headers say so: "named colour roles plus the three layouts".
      //
      // `test/health/checks.ts` and `probes.ts` are a LIBRARY, not test
      // material: "the registry, and the pure verdict logic", imported by
      // `staging-cleanup-preflight.ts`, which is a real workflow step. A
      // module under `test/` that production code imports is shared tooling
      // that happens to live there; the blanket `test/` rule is right for
      // everything else in that tree and wrong for these two.
      "schemas/ui/theme.ts",
      "schemas/content/document-kind.ts",            // the document-kind graph typology's schema, beside theme.ts (stage D5, #1767)
      "schemas/ui/themes.ts",
      // Resolves a ThemeRef against its owner's declared themes (bean `v8n5`):
      // the same sticky-note theme layer as the two above, reached through a
      // declaration rather than an import, so it holds no folio's values.
      "schemas/ui/theme-by-ref.ts",
      // Exposed by moving `test/health/` here — the same reveal-on-move
      // pattern, third time in this pass. Both are harness by their own
      // headers: "Repository health reports — what the daily sweep under
      // `test/health/` wrote" is about the REPOSITORY, not a folio's content;
      // and the todo graph is the human half of the work plan, a sibling of
      // `beans/`, which is harness-level workflow rather than anything a
      // folio contains.
      "schemas/sdlc/health-report.ts",
      "schemas/sdlc/todo-graph.ts",
      // Imports `schemas/kg/cat-harness.js` and nothing else, so unlike its
      // neighbour `check-agent-entry-links.ts` it inherits no wrong-direction
      // edge from the generic link auditor (bean `cp3l`). Harness by subject
      // as well as by dependency: it reads THIS repository's `AGENTS.md`
      // against THIS repository's source, and a folio has neither as content.
      // Reads GitHub's view of THIS repository's commits, and imports only
      // `src/core/git-refs.ts` and `schemas/kg/cat-harness.ts` — both harness.
      // Harness by subject too: whether a commit got a CI run is a fact about
      // the forge and the pipeline, and a folio has neither as content.
      // Bean `6ptx`. Harness by subject: a survey is of THIS repository's own
      // commit history and work plan, which no folio has as content.
      // Its sibling, bean `hrv2`: prose claiming which file declares a graph,
      // checked against the declarations. Harness by subject as well as by
      // dependency -- which file declares which graph is a fact about
      // layers, and a folio declares none.
      // Who else is working THIS repository — a fact about the forge and this
      // checkout, not about any folio's material.
      // Its sibling: which sessions are WAITING on a person. Harness by
      // subject and by dependency -- a session is a fact about this checkout
      // and the forge, and a folio has no sessions. Bean `rq8s`.
      // The bean reader — HARNESS by subject as well as by dependency. It
      // reads the agent work plan, which `AGENTS.md` places in the
      // agent-actor half of its 2x2 and a folio has no content stake in. Its
      // consumers are `check-bean-parents.ts` here and `gen-docs-pages.ts` in
      // core, and core reading harness is downward.
      // The work plan's own readers. Harness by subject and by dependency:
      // `beans/` is the AGENT's work plan, declared by the harness, and a
      // folio's content has no bean store. `bean-store-read.ts` is the shared
      // file reader the three import; `check-waivers.ts` reads the `waiver`
      // graph, which is the harness's confirmation model and nothing a folio
      // authors.
      // Harness for the same reason, plus one of its own: its `--github`
      // half asks the forge which PRs are open, and a PR is a fact about
      // this checkout and the forge, not about any folio's material.
      // The milestone closure, HARNESS for the same reason as its neighbours
      // and not for the one that suggests itself. It is a pure function with
      // no forge call and no path literal, so "generic" is tempting — but the
      // block above settles it by SUBJECT: `beans/` is the agent work plan the
      // harness declares, and a folio's content has no bean store to roll up.
      // Genericity is about whether swapping the content changes the answer;
      // this reads a graph a folio does not have.
      // The external-specification registry — which edition of BPMN, DD or
      // DCMI Terms this repository conforms to, reconciled against the
      // namespaces its own diagrams and records actually bind. Harness by
      // its subject: the things it reconciles are this repository's
      // knowledge graph and CI processes, not a folio's material.
      // Their two shared modules, classified with them rather than beside
      // the generic path helpers: `merge-pipeline-paths` reads path classes
      // out of this repository's `PATTERNS` declaration, and
      // `merge-pipeline-git` resolves member specs against this repository's
      // refs. Both are about this queue, not about paths or git in general.
      // The `# bpmn:` / `# bpmn-node:` lines a workflow names its diagram with
      // (bean `61ca`). Same subject as the coverage check that reads them.
      // Which docs page sections present which process, read from the pages
      // (bean `xl55`). Harness: it indexes the platform's own docs manifests.
      // Both read the DECLARATION and write a string; neither needs a folio to
      // have anything to do, which is the same test `sync-docs-harness.ts` and
      // `harness-schema-export.ts` pass above.
      //
      // `upload-url.ts` sits here rather than with content tooling for a reason
      // worth keeping: it is the acquisition QUEUE's address, and the address is
      // a fact about the layer's layout — an instance-scoped declared path
      // resolved against the REPOSITORY root. What eventually lands in that
      // queue is content; where the queue IS, is not.
      // The staging-preview record and the script that writes it — bean `6pfo`,
      // arrived from `main` (#466) AFTER this pass began and was caught by the
      // unassigned gate added in the same change, on its first real encounter.
      // Before that gate it would have joined the 19 silently.
      //
      // Its two siblings `restore-staging.ts` and `staging-cleanup-preflight.ts`
      // were already harness; the schema moves WITH the script for the reason
      // the four shared targets above did, or classifying the script alone
      // mints the edge it was meant to retire. `staging-preview.ts` imports
      // only zod and `fsh-guts.ts` (harness), so it carries no content model.
      "schemas/sdlc/staging-preview.ts",
      // Where a preview is published (`branches/`, owner 2026-11-05). Same
      // family: `staging-preview.ts` above imports it, and its only import is
      // nothing, so it carries no content model.
      "schemas/sdlc/preview-prefix.ts",
      // The render log — same family, same argument, and the schema moves WITH
      // the script for the reason stated just above. It describes what is on
      // the PUBLISH BRANCH, which is a property of the repository rather than
      // of any folio's content, and its only imports are zod and
      // `schemas/sdlc/log-entry.ts` (harness). Caught by the unassigned gate added
      // in #469 on its first encounter, which is the gate working.
      //
      // Classifying the script alone minted exactly the two edges that comment
      // warns about — measured with `--edges`: `scripts/render-log.ts` and
      // `scripts/restore-staging.ts` both reaching into `folio-assist-core`,
      // taking the wrong-direction count from 1 to 3. With the schema here it
      // is back to 1, the `src/types.ts` residue this file already analyses.
      "schemas/ui/render-log.ts",
      // The preview cap (issue #1868) — same family as its imports above
      // (`restore-staging`, `render-log`, `staging-record`,
      // `staging-cleanup-preflight`, `staging-preview`), all harness.
      // The staging rate limit (issue #1956) — same family, harness.
      // A preview built in the agent's checkout (issue #2410): the same family,
      // and its only import is the gate above. The core builders it runs are
      // processes it spawns, not modules it imports, so no edge reaches up.
      // The adapter for a layer that holds no content (bean `zmdo`): the
      // server's fallback when no content adapter is installed above the
      // harness. Harness by definition — it exists for the harness alone.
      "schemas/conduct/assistant-package.ts",
      "schemas/conduct/assistant-types.ts",
      "schemas/process/assistant-workflow.ts",
      // The CatHarness root declaration is harness-layer by concept even
      // though it sits in schemas/. It declares its own HARNESS_NS rather than
      // importing the content vocabulary, so classifying it here adds no
      // wrong-direction edge — see schemas/kg/cat-harness.ts.
      "schemas/kg/cat-harness.ts",
      // The graph-typology registry, split out of the line above so core could
      // import it without a cycle (bean `q2wn`). HARNESS on the same terms:
      // it holds `BASE_GRAPH_TYPOLOGIES` — the harness's OWN three kinds — plus
      // the registry mechanism, and imports only `namespaces.ts`. Core does
      // not own it; core CONTRIBUTES `folio` to it, which is the whole
      // distinction `folio-graph-typology.ts` argues. Left to triage it landed
      // in core on a keyword, which had the ownership exactly backwards.
      "schemas/kg/graph-typology-registry.ts",
      // declared-path-literal: a partition plan names modules by path, the
      // same base case as the TARGET layouts above. dmx1's and riit's leaves,
      // imported by the registry and the declaration schema: layer discovery
      // (moved verbatim out of cat-harness.ts), the graph-typology, validator,
      // block-kind and contribution node schemas, and the declared-node scan.
      // Harness for the same reason as their importers.
      "schemas/kg/instance-roots.ts",
      "schemas/kg/visualiser-route.ts",        // the ONE route every declared visualiser is published at (owner, 2026-10-09): imported by the declaration reader and the tiles
      "schemas/sdlc/script-table.ts",            // the checkout's script table, by layer (bean `ar1s` P4): read from the declared layers, as instance-roots finds them
      "schemas/kg/graph-typology-node.ts",
      "schemas/kg/declared-nodes.ts",
      "schemas/kg/validator-node.ts",
      "schemas/kg/block-kind-node.ts",
      "schemas/kg/content-adapter-node.ts",
      "schemas/kg/contribution-nodes.ts",

      // Roles, actors and the KG audit sidecar are harness-layer for the same
      // reason and on the same terms: `role-graph.ts` imports only
      // `namespaces.ts`, `kg-qa.ts` imports zod and `portable-path.ts` below.
      // Neither touches the content vocabulary, so classifying them here adds
      // no wrong-direction edge — and leaving them unclassified would have made
      // `src/workflow/` and `src/tools/workflow.ts` read as harness → core.
      "schemas/process/role-graph.ts",
      "schemas/content/odrl.ts",                     // W3C ODRL 2.2 policies: what an Actor may do (issue #1180)
      "schemas/content/prov.ts",                     // W3C PROV-O task-run record (issue #1180)
      "schemas/sdlc/kg-qa.ts",
      // Whether a path can be CHECKED OUT. It imports nothing at all, so it
      // sits at or below every consumer by construction — but it is harness by
      // subject too: its subject is this repository's own tree, and a folio has
      // no stake in whether a sidecar filename is legal on NTFS. Classifying it
      // in core is what the keyword pass guessed, and that read as
      // `schemas/sdlc/kg-qa.ts [harness] -> [core]`, a wrong-direction edge for a
      // leaf with no dependencies of its own.
      "schemas/kg/portable-path.ts",
      // The bean graph declares the harness's own work-plan store and imports
      // only zod. It was already harness-layer by concept; classifying the
      // scripts below is what made the edge to it visible, and the edge was
      // never core's to own.
      "schemas/sdlc/bean-graph.ts",
      // The scripts that read those graphs. All four were `unassigned`, which
      // the tool's own report says not to read as clean: they are the work
      // plan's fallback writer, the `.beans.yml` cross-check, the KG audit and
      // the skill registry the audit and `check-workflow-refs` share. Every one
      // is harness machinery, and none imports the content vocabulary.
      // Bean `95ir`: declared-but-absent is reported by a scanner, never
      // dropped. Harness machinery over declarations; imports only node:fs.
      // The same audit over every declared layer rather than the root alone
      // (bean `bjzs`). Harness layer for exactly the reason `kg-audit.ts` is —
      // it spawns that audit and imports only `layerRootsIn`, so its subject
      // is the layer declarations, never the content vocabulary. Assigned
      // here in the same change that added it: `unassigned` is what the tool's
      // own report says not to read as clean, and four scripts sat that way
      // until somebody looked.
      // WHICH audits reach which kind of node (bean `xutg`). Harness machinery
      // for the same reason `kg-audit.ts` is: its subject is the graph-typology
      // registry and the gate set, not the content vocabulary. Beside the audit
      // it complements rather than duplicates — that one judges the nodes it
      // covers, this one measures what is covered at all.
      // WHICH declared executable artefacts can be reached at all (bean `dxqm`).
      // Harness machinery for the same reason as the coverage report beside it:
      // its subjects are the declared `.bpmn`/`.dmn` corpus, the engine's own
      // resolver and the module graph — never a folio's vocabulary. A folio
      // could not make it reach a different verdict, only give it more
      // artefacts to ask about. Assigned in the same change that added the
      // script, because `unassigned` is exactly what the partition's own report
      // says must not be read as clean.
      // LSI over the declared prose graphs, and the epic-filing proposal it
      // drives (bean `ansc`). Harness for the same reason as the audit: its
      // subjects are the declarations and the work plan, and the engine it
      // imports (`pipeline/lsi.ts`) is linear algebra over any text.
      // The PROV-O QA/QC report (#1180 step 5): workflow history → PROV-O,
      // re-checked with `authorizeTask`. Harness on the same terms as the
      // audit: it reads the harness's own work-plan store, role graph and
      // policies, and imports nothing from the content vocabulary.
      // Its one cross-run criterion — declared prose ↔ code pairs and their
      // attestations (bean `cuxx`). Same side as the auditor that calls it.
      // ...and stage A, what that prose SAYS about the code (bean `ca4a`).
      // Which skill packages this checkout serves — moved here from the
      // `skill_fetch` Tool (bean `9umr`) so the harness callers, `kg-audit`
      // and the workflow engine, stop importing from a Tool. Harness beside
      // `known-skills.ts`, which it builds on.
      // The user-invocable skill list, moved out of the `skill-prompts` Tool
      // (bean `w2gr`) so `gen-skill-commands` stops importing from a Tool.
      // ...and the topic level it walks through (bean `9umr`): which
      // subdirectories of a skills directory are topics, from `skills.json`.
      // ...which now delegates to the ONE grouped walk every grouping kind
      // shares (placement PR0c, bean `ejye`), and that walk's gate.
      // The checkout-portability gate, beside the module it runs. Harness by
      // subject: it reads `git ls-files` over THIS repository and grades the
      // tree's own filenames, which is a fact about the checkout and not about
      // any folio's material.
      // The platform namespace leaf. It must sit at or below the harness:
      // core may import the harness, the harness may not import core, so a
      // constant BOTH need cannot live in core without reintroducing the edge
      // it was extracted to remove.
      "schemas/kg/namespaces.ts",
      // What the terms in that namespace MEAN, and therefore the same
      // argument one step along: a core placement made `ns-export.ts` — which
      // is harness — import its definitions from core, the wrong-direction
      // edge `namespaces.ts` was extracted to remove. Measured on first run:
      // the prefix rule claimed it for core and the edge appeared immediately.
      "schemas/content/vocabulary.ts",
      // The external vocabularies a layer's JSON-LD speaks, as DECLARED
      // data (bean folio-assistant-63q4, owner 2026-10-14). Harness by the
      // same argument as `namespaces.ts`: `cat-harness.ts` reads the
      // declaration's `jsonldPrefixes` field through its schema, so a core
      // placement — which the `schemas/` prefix rule gave it — was a
      // wrong-direction edge the moment the module landed.
      "schemas/kg/jsonld-prefixes.ts", // declared-path-literal: a partition plan names modules by path.

      // bootstrap's own Zod (graph, discussion, requirement, and since
      // 2026-09-30 the graph document's) lives in `bootstrap-tools/` (bean
      // `xsqm`), outside this partition.
      // Code lists (owner, 2026-09-23): the shape the ENGINE checks an
      // adjudication's codes against, and the loader `namespaces.ts` sits
      // beside. Needed to RUN a process, so harness — the same test as the
      // tooling below; a core placement made `process-model.ts` import down.
      "schemas/library/code-list.ts",
      // Tool releases (issue #2481, bean `3sbm`): the gate over the
      // `tool-release` graph that T1 puts in cat-harness for every layer to
      // inherit. Harness, beside `code-lists.ts`, for the same reason: the
      // resolver that reads these is needed to RUN a render.
      // The pre-deploy verifier set (bean `vigi`): needed to RUN the publish
      // process, so harness, beside the gates it sits among.
      // The per-scope search split (bean `m7mn`): the publish process runs it
      // after the build, and publish-verify imports its shapes, so it sits
      // beside the verifier rather than below it.
      // The downstream-tool criterion family (bean `fq5u`): kg:audit's reader
      // of Tool run records, harness for the same reason as the audit itself.
      // ── Tooling that the `schemas/` and `pipeline/` PREFIXES had
      //    claimed for core, on the content-versus-platform reading this list
      //    predates. The owner's cut, 2026-09-19, is different and sharper:
      //    "f-a-core has high level processes only, no tooling. f-a has all
      //    tooling KG." The test that follows from it — needed to RUN a
      //    process is tooling; DESCRIBES one is core — puts these six here.
      //
      //    Measured, because the prefix rules are load-bearing and a
      //    re-bucket that felt right could easily be worse: assigning the
      //    seven unassigned modules alone took wrong-direction edges from 5
      //    to 15, since each reached into one of these. Moving these first
      //    and the seven after gives 4 edges and 0 unassigned, against a
      //    baseline of 5 edges, 7 unassigned and 23 edges the tool had
      //    declined to judge. Better on every axis, and one baseline edge
      //    (`check-workflow-refs` → `translation-tools`) cleared outright.
      //
      //    Agent memory and carried notes are the unambiguous pair: an
      //    agent's memory has nothing to do with a folio, and `carried-note`
      //    is what an ACTOR carries across knowledge-graph nodes. Neither
      //    survives the "describes a process" test.
      "schemas/conduct/memory.ts",
      "schemas/kg/carried-note.ts",
      // The BPMN process element id (#1168 B8): a leaf `carried-note`'s
      // TaskRef and the log / invocation records all reference.
      "schemas/process/process-element-id.ts",
      // Same argument as `memory.ts`, one step along: a waiver is a permission
      // a PERSON gives an AGENT about a gate in this repository's process. It
      // is declared over the same directory as agent memory and it fails the
      // "describes a folio's material" test just as plainly. Keyword triage
      // put it in core on the word "confirmation"; the import direction is
      // what settles it — `scripts/check-waivers.ts` is harness and may not
      // reach into core.
      "schemas/conduct/waiver.ts",
      // How a DECISION is handed to a person. Harness by the same test again:
      // it is about the agent-human interaction this platform defines, and a
      // folio authors no decision requests.
      "schemas/process/decision-request.ts",
      // Translation is cat-harness's, stated directly: "ui stuff like
      // translations (skills, tooling) are not in bootstrap, it is in
      // cat-harness/". These three are the gettext machinery and the registry
      // that binds a content type to its extractors — the tools that DO the
      // translating, not the translated content.
      "schemas/library/translation-tools.ts",
      // A README generator, not a README. It was the shared target of two
      // wrong-direction edges — `sync-docs-harness` and `site-links` both
      // reach it — so one re-bucket cleared both.
      // ── The modules that fell through every rule and were reported
      //    `unassigned`. All are scripts or `src/` machinery, and with the
      //    six above moved, none of them reaches into core any more.
      // ── The SHARED TARGETS those scripts reach, moved FIRST and for the
      //    reason the seven-module batch above records: classifying the
      //    scripts alone took wrong-direction edges from 5 to 12, because
      //    each reached into one of these four and the `schemas/` prefix had
      //    claimed all four for core. The classification was wrong, not the
      //    tool — the falsifier this batch was measured against.
      //
      //    Every one is harness vocabulary by the owner's test, and every one
      //    imports only zod, node builtins or `cat-harness.ts` (already
      //    harness), so none carries the content model with it. Same argument
      //    as `role-graph.ts` and `kg-qa.ts` above, at four more sites.
      // Four more of the same shape, found by draining the batch above and
      // re-reading what each remaining edge actually reached. Each imports
      // only zod or node builtins, and each one's consumers are harness.
      //
      // `fsh-guts.ts` is the notable one: it is the TRASHCAN — "a node of the
      // trashcan, what `fsh-guts/` holds" — and it was `smart-base` because
      // the keyword rule `/(dak|fhir|fsh|ocl|l2|l3|smart|who|ig)/` matched
      // `fsh` in a name that has nothing to do with FHIR Shorthand. A keyword
      // rule cannot tell a homograph from a hit, which is why every keyword
      // assignment in this file is provisional against a read of the module.
      // It was the single `folio-assist-core -> smart-base` edge.
      "schemas/kg/front-matter.ts",    // "this repository's self-declaring files"
      "schemas/sdlc/test-run.ts",        // what was measured, with what; only eval-crdm-detect reads it
      "schemas/sdlc/input-trace.ts",     // ...and the traced input sites a run reached, which test-run records (moved from scripts/ in 70lx)
      // The TEST PROCESS's other two schemas (beans `ygzh`, `3o5b`), by the
      // same test as `test-run.ts` beside them: a plan and a report describe
      // how a SYSTEM UNDER TEST is judged, not a folio's content, and their
      // reader is `kg-audit` (harness) through `scripts/test-plan-audit.ts`.
      // Left `core` by the `schemas/` rule they made `kg-audit` import core,
      // and the system-under-test facet on `skill-package.ts` (harness) import
      // `test-plan.ts` for `SUT_KINDS` — two wrong-direction edges.
      "schemas/sdlc/test-plan.ts",
      "schemas/sdlc/test-report.ts",
      // ...which forces `attribution.ts` too: both import `ATTRIBUTION_KINDS`
      // from it. It is the reviewer-identity vocabulary of every QA verdict
      // (`script` / `agent` / `human`), it imports only `tool-types.ts`
      // (harness) and bootstrap's model registry, and its core consumers
      // (`apply-image-verdicts.ts`, the narrative and image schemas) may import
      // the harness — so the move adds no wrong-direction edge. Bean `3o5b`.
      "schemas/content/attribution.ts",
      "schemas/ui/note-anchor.ts",     // read only by `carried-note.ts`, already harness
      // Declaration vocabulary, by the same test as the four above: it imports
      // only zod, and it carries no part of the content model. The direction is
      // what forces it — `CatHarnessDeclarationSchema` (harness) holds the
      // `stickies` field, so defining the shape in `landing-sticky.ts` (core)
      // would make the harness import core. That wrong-direction edge was the
      // falsifier the contribution design was measured against, and this is
      // where it is answered rather than absorbed.
      "schemas/content/sticky-contribution.ts",
      "schemas/kg/fsh-guts.ts",        // the trashcan, not FHIR Shorthand
      "schemas/sdlc/python-deps.ts",     // the repository's own Python toolchain
      "schemas/content/avatars.ts",         // declared-path-literal: a partition plan names modules by path. An avatar for every declared kind
      "schemas/ui/blank-avatar.ts",    // declared-path-literal: a partition plan names modules by path. Its blank mark, node-free for the navbar bundle
      "schemas/kg/substrate-snapshot.ts", // the node schema of `substrate-snapshot`, a kind the harness registers (issue #1719)
      "schemas/kg/kind-validator.ts",  // a graph typology's validator
      "schemas/library/library-nodes.ts",   // the node schemas of `library`, a kind the harness registers; kind-validator routes by its class (cat-harness#402)
      "schemas/process/actor-reach.ts",     // which actors a declaration can reach
      // WHAT A REPOSITORY IS — the markers it carries. The word "content" in
      // the filename is what sends it to core by keyword, and it is a false
      // signal: this is not a content MODEL, it is machinery for recognising
      // marker files, and `harness-config.ts` composes it into
      // `describeRepositoryClosure`. The harness importing core was the edge
      // this gate caught the moment closure was wired.
      "schemas/content/content-type.ts",
      // The two markers the harness itself owns: `harness.json` says "an
      // instance", `harness.config.json` says "authors folio content". Both
      // are harness files even though one of them is what makes something a
      // FOLIO — a folio is recognised BY the harness, which is why
      // `cat-harness/` carries the first and not the second.
      "schemas/content/content-types-base.ts",

      // ── The 19 modules still reported `unassigned` on 2026-09-20, at
      //    `5b8277ea9b`. `scripts/` is in no prefix rule, so a top-level
      //    script falls through to `unassigned` — which the tool's own report
      //    refuses to call clean ("edges this tool declined to judge").
      //
      //    Sixteen of them are harness machinery by the owner's test — needed
      //    to RUN a process is tooling, DESCRIBES one is core. Each reads a
      //    declaration, a role, a graph typology or the gate set; none reads a
      //    folio's content model.
      // HARNESS, although what it reads is core's glossary — the test is the
      // module's imports, not the data's home. It reaches only
      // `schemas/content/term-mapping.ts` and `scripts/qa-results.ts`, both harness,
      // so classifying it core would buy two wrong-direction edges for the
      // tidiness of filing it beside the glossary it inspects. Same reasoning
      // the content-side block below states in the other direction.
      // HARNESS on the same test, and it is worth stating because the
      // instinct pulls the other way: what this reads is `uploads/` and
      // `library/`, a folio's own material, and its three nearest
      // neighbours by SUBJECT — `check-l1-complete`, `ingest-document`,
      // `l1-blocks` — are all in the content-side block below. It imports
      // `schemas/kg/cat-harness.ts` and nothing else. The declaration resolver
      // is harness, so filing this core would buy a wrong-direction edge for
      // the tidiness of sitting beside the pipeline it audits. The three
      // below are core because THEY reach `schemas/content/narrative.ts` and its
      // siblings; this one reaches no core schema at all, which is what
      // makes it a different answer rather than an inconsistent one.
      // `scripts/gen-python-deps.ts` STOOD HERE and moved to
      // `cat-harness-tools/scripts/` on 2026-10-06 with the requirements files
      // it writes (bean `ar1s`, phase 3), so it is classified by location now.
      // The activity log's vocabulary: "what an agent did, when, and in which
      // process". Its only consumers are the two modules above and
      // `schemas/kg/cat-harness.ts`, which is already harness. Left to the
      // `schemas/` prefix it lands in core, and classifying the pair above
      // would then MINT two wrong-direction edges rather than retire two —
      // which is why it moves in the same change and not after.
      "schemas/sdlc/log-entry.ts",
    ],
    // declared-path-literal: the TARGET layout of the five-repo split, which no
    // declaration in THIS repo describes — that is the whole point of the plan.
    prefixes: ["src/core/", "src/workflow/", "src/routes/", "src/auth/", "src/skills/", "src/issue-watch/", "skills/framework/", "skills/remote-packages/"],
  },

  // ── Mechanism that carries a domain keyword. Hand-triaged, and placed
  //    BEFORE the domain rules because first match wins: the `lean` keyword
  //    would otherwise claim a module the generic content model depends on.
  //
  //    The test applied WAS not "does the name mention Lean" but "would core
  //    compile and function without the science layer installed". For
  //    `lean-packages.ts` it would not: `BlockBase` carries an optional `lean`
  //    field in `schemas/types.ts`, `schemas/constraints.ts` validates its
  //    `ref` against `LEAN_REF_PATTERN`, and the field is on shared block
  //    kinds by design — the document profile forbids its USE rather than its
  //    existence. So the grammar belongs wherever the field does. Only the
  //    package list is a property of a folio, and that is injected.
  //
  //    🟧 THAT TEST IS OVERRULED (owner, 2026-09-27), and it is the premise
  //    rather than the reasoning that was rejected. Verbatim: "field sits on
  //    shared kinds (remark, example, algorithm, simulator), so the grammar
  //    genuinely is vocabulary that goes tp f-a-sci", following
  //    "f-a-sci __should__ have scehams for math/science papers". A `lean`
  //    field appearing on a shared kind does NOT make the grammar core; it
  //    makes that field on those kinds part of the science vocabulary.
  //
  //    The test was applied FIVE times in this block ("Same test again",
  //    "Same test a third time"), so the ruling reached four entries, not one.
  //    Two moved to the sci block above and cost NOTHING. The other two --
  //    `schemas/lean-packages.ts` and `pipeline/lean-signature.ts` --
  //    cost SIX core -> sci edges, measured twice (at `.folio-assistant-pin`
  //    and on current `main`, so not a pin artifact):
  //      schemas/constraints.ts          -> lean-packages
  //      adapters/mcp-server/server.ts   -> lean-packages
  //      adapters/document/resolver.ts   -> lean-packages
  //      adapters/manifest-entries.ts    -> lean-packages
  //      pipeline/qa-utils.ts    -> lean-packages
  //      pipeline/qa-utils.ts    -> lean-signature
  //
  //    🟩 PAID. All six are gone and both modules are now `sci` (they fall
  //    there on the `lean` keyword rule below, so they need no entry at all).
  //    `schemas/formal-ref.ts` is the injection point core reaches instead --
  //    the third instance of the `references-registry-di` / `value-registry-di`
  //    pattern -- and `pipeline/lean-formal-ref.ts` is the sci-side
  //    implementation, which is where the resolution bodies moved verbatim from
  //    `qa-utils.ts`. `BlockBase` is UNCHANGED: core still carries a field
  //    named `lean`, it simply no longer knows the grammar of its `ref`. The
  //    earlier note here said the ruling "changes `BlockBase`, so it is the
  //    owner's call" -- that was wrong, and the whole cost was five call sites,
  //    one of which dissolved by deleting a helper. qou bean `qou-7ko6`.
  //
  //    NOTE: NINE core modules import `lean-packages`, not six. The other
  //    three -- `export-json.ts`, `conjectural-propagation-audit.ts`,
  //    `conditional-class-banner-audit.ts` -- are composition roots
  //    (`import.meta.main`), and `engine.ts` exempts a composition root from
  //    the direction rule while still counting its edge in `totalEdges`. So a
  //    reader who greps importers finds nine; re-measure with `--edges`, and
  //    do not read six as an undercount.
  {
    repo: "core",
    triaged: true,
    exact: [
      // The simulator-asset validator (bean `023p`). It falls to `sci` on the
      // keyword rule further down, which matches the WORD `simulator` — and
      // that is the CLASSIFICATION being wrong rather than the import, as
      // `schemas/dak-blocks.ts`'s was in the `smart-base` block before bean
      // `1335` moved that module to smart-base outright.
      //
      // MEASURED: `simulator` is in core's own `DOCUMENT_BLOCK_KINDS` and NOT
      // in `MATH_BLOCK_KINDS`. A simulator block is part of the generic
      // document model, so a check on its declared asset path belongs to the
      // layer that declares the kind. The module carries no Lean, no TeX and
      // no science — it asks whether a declared file is on disk.
      //
      // It sits in THIS rule rather than the core block below because first
      // match wins and the sci keyword rule comes first: an `exact` after it
      // never runs. The keyword rule itself stays — `simulators/` as CONTENT
      // is subject matter, which is what its own comment says. This is one
      // module whose NAME collides with it.
      // The QA sidecar PROJECTION — the families (`block`, `translation`,
      // `script`, `kg`), their states and freshness, read by `gen-docs-pages`
      // to publish one file per (subject, family). Nothing in it is science:
      // it imports only `block-qa`, `kg-qa` and `script-qa`, all core. It is
      // here because the sci keyword rule matches `witness` in its NAME, which
      // is the second file that has caught — a reminder that the keyword rule
      // is a heuristic and the triage list is where its misses are corrected.
    ],
  },

  // ── The MCP server's paper-only tools. Triaged, and BEFORE the core
  //    prefix that claims the rest of `adapters/mcp-server/`: these three
  //    need a TeX installation or a Lean toolchain, which is the line
  //    `adapters/paper/index.ts` already draws for the paper adapter.
  {
    repo: "sci",
    triaged: true,
    exact: [
      // The refactoring-strategy DATABASE loader: version-gated candidate
      // rewrites for `proof-simplifier`, keyed by Lean version. Its schema is
      // already `sci` (`schemas/refactor-strategy.ts`) and the two were split
      // across the boundary by directory alone. Nothing in the pipeline
      // imports it; its only other consumer is its own test.
    ],
  },


  // ── folio-asst-sci: Lean, LaTeX, proofs
  {
    repo: "sci",
    // declared-path-literal: the TARGET layout of the five-repo split, which no
    // declaration in THIS repo describes — that is the whole point of the plan.
    // `simulators/` was here until they moved to the folio that owns them: a
    // simulator is subject matter, so no platform package is its target.
    //
    // `adapters/paper/` was here until 2026-09-30, and its removal is the rule
    // SUCCEEDING rather than being withdrawn. It named `PaperContentAdapter`
    // as sci-layer code, and bean `y5si` moved the directory to
    // `folio-assistant-sci/` on that adjudication plus the matching
    // `layer: "sci"` in `src/builtin-adapters.ts`. This scan is rooted at
    // `cat-harness/`, so the prefix now matches nothing — and a rule that
    // fires on nothing while reading as a live adjudication is worse than no
    // rule, because the next reader takes it as evidence the file is still
    // here. The reasoning is kept; the dead prefix is not. The same went for
    // `skills/authoring/{authoring-math,folio-paper-adapter}/` on 2026-10-01:
    // placement PR1 (bean `ybwt`) moved both packages to
    // `folio-assistant-sci/skills/content/`.
    // `schemas/precision-scalar.ts` and `schemas/refactor-strategy.ts` moved to
    // `folio-assistant-sci/schemas/` in bean `f8wp` (the second after `saqd`
    // #875 moved its loader), so neither is named here any more.
    prefixes: ["computations/", "latex/", "scripts/render-tex/", "scripts/docker-latex-build/", "scripts/knot-plots/"],
    exact: ["schemas/formalization-types.ts"],
  },
  {
    repo: "sci",
    keyword: /(^|[/-])(lean|latex|tex|proof|witness|simulator|sage|formaliz|knot)([/.-]|$)/i,
  },

  // ── smart-base: WHO L2-L3, DAK, FHIR, OCL
  // `skills/authoring/authoring-who-smart-guidelines/` was the one prefix of a
  // smart-base rule here until placement PR1 (bean `ybwt`, 2026-10-01) moved
  // the package to `smart-base/skills/content/` and its four generic FHIR IG
  // skills to `fhir-harness/skills/content/fhir-ig-authoring/`. Its note stays:
  // `schemas/dak-blocks.ts` was here, then re-triaged CORE because core's
  // `block-kinds.ts` declared `CONTENT_ADAPTERS = ["paper", "dak"]` and
  // `DAK_BLOCK_KINDS`. Bean `1335` removed that premise instead: the `dak`
  // adapter and its kinds are a smart-base CONTRIBUTION now, and the module —
  // with `qa-checkers-dak.ts` and `gen-dak-components-figure.ts` — lives in
  // `smart-base/`, which this tool does not scan.
  {
    repo: "base",
    exact: [
      // `measure-logic-layer-edges.ts` (bean `f4gj`) stood here. It left this
      // layer with the FSH cone it measures, on the owner's ruling of 2026-10-14
      // (Q3: FHIR Shorthand belongs to the FHIR IG layer), so no rule in this
      // file adjudicates either any more.
    ],
  },
  {
    repo: "base",
    keyword: /(^|[/-])(dak|fhir|fsh|ocl|l2|l3|smart|who|ig)([/.-]|$)/i,
  },

  // ── folio-assist-core: the generic document model and its pipeline
  //
  // The `pipeline/` prefix below classifies that whole directory as
  // core, which is why `check:partition` has always read 0 for it. Bean `yj6r`
  // acted on that classification for the GLOSSARY cluster: `build-glossary.ts`,
  // `codemod-refterm.ts` and their three tests now live in
  // `folio-assistant-core/scripts/`. Nothing was removed from the prefix — a
  // prefix stops matching a path that is no longer under it — but the fact is
  // recorded here because the next reader will count `pipeline/` and
  // find two files missing from a directory this rule claims in full.
  //
  // What the move BOUGHT is not a change of classification: it was already
  // core. It removed the three imports reaching UP out of `cat-harness/` into
  // `folio-assistant-core/schemas/glossary.ts` and `scripts/glossary-page.ts`,
  // which this scan cannot see at all (its root is `cat-harness/`, so an edge
  // leaving it is not resolved and not counted). That blindness is the whole
  // subject of `yj6r`, and it is why a green `check:partition` was never
  // evidence about this cluster either way.
  {
    repo: "core",
    // declared-path-literal: the TARGET layout of the five-repo split, which no
    // declaration in THIS repo describes — that is the whole point of the plan.
    prefixes: ["adapters/mcp-server/", "adapters/document/", "src/blocks/", "scripts/translation/", "skills/folio-core/", "skills/authoring-document/", "skills/authoring/content-lifecycle/", "pipeline/", "schemas/", "ui/", "viewer/", "translations/"],
    // `blueprint/` STOOD in the prefixes above until 2026-09-30 (bean `vov0`):
    // it held a hand-written QOU blueprint, folio content in the platform, and
    // is removed now that `blueprint-layout.ts` generates a paper's
    // `blueprint/src` from its manifest (#1598).
    exact: [
      // `scripts/build-document-site.ts` STOOD HERE and is GONE as of bean
      // `yj6r`, 2026-09-30: it now lives in `folio-assistant-core/scripts/`
      // beside the `schemas/changeset.ts` its test reads, so the classification
      // is carried by location. Reasoning kept: it renders a DOCUMENT folio to
      // a site through the document pipeline's own `buildDocumentMarkdown`
      // (pipeline, core), and its subject is a folio's content, not the
      // harness (bean `fyu2`). The `gen-review-page.ts` entry above still names
      // it as a core caller reaching DOWN into the harness, which is now true
      // by location as well as by rule.
      // Validates every committed `fhir-artifact-index` graph against
      // `schemas/fhir-artifact-index.ts` — core by the `schemas/` prefix. CORE
      // rather than harness for the reason the two entries above it give: a
      // script is not automatically tooling-side, and this one's SUBJECT is
      // content — an IG's artefacts, which is a `content`-layer graph. Calling
      // it harness would buy a wrong-direction edge into `schemas/` for
      // nothing. Its sibling `scripts/ingest-ig-artifacts.ts` writes the same
      // graph from the same schema and is core on the same reasoning.
      //
      // Both are GONE FROM THIS LIST as of bean `yj6r`, for the reason given on the
      // materialisation trio above: they now live in `folio-assistant-core/scripts/`
      // beside the schema they read, so the classification is carried by location.
      // The reasoning is kept here rather than only in the commit because the next
      // reader of this rule set will ask why an IG tool is not adjudicated, and
      // "it is, by where it sits" is the answer.
      // Reads `schemas/sdlc/todo.ts` and `schemas/sdlc/todo-graph.ts` and nothing else.
      // A script is not automatically tooling-side: this one operates
      // exclusively on core data, and calling it harness bought two
      // wrong-direction edges for nothing.
      //
      // This note said "its ONLY consumer is `scripts/gen-docs-pages.ts`"
      // until 2026-09-20. That premise is gone — `state-visualizer.ts` is a
      // second consumer — and the conclusion survives it because BOTH callers
      // are core. A reason left standing on a fact that has changed is a
      // reason nobody can re-check, which is why this says so rather than
      // quietly keeping the old sentence.
      // The default boards, and CORE rather than harness — which is the
      // checker's finding, not a preference. It was classified harness first,
      // on the reasoning that it asks which INSTANCES are instantiated and
      // which are above the floor. `check:partition` answered with two
      // wrong-direction edges: it imports `schemas/ui/board.ts` and
      // `scripts/todos.ts`, both core, and the harness layer may not depend on
      // core. The imports were right and the classification was wrong — what
      // it PRODUCES is folio content, a board, whose type core owns. The
      // layer questions are how it decides WHICH folios, not what it makes.
      // The linear floor's renderer, and CORE for the reason
      // `state-visualizer.ts` records two entries down: it is a RENDERER, and
      // rendering is core's. Its only import is `schemas/sdlc/todo-index.ts`, its
      // subject is a folio's own notes, and what it produces is the artefact a
      // reader gets when JavaScript never runs. `gen-docs-pages.ts` calling it
      // is core calling core; nothing about it is layer machinery.
      // Issue #1908: the todo graph's JSON-LD builder, a todo's thin page, the
      // ONE seam that says where published todos are read from, and the
      // generic thin-page shell they render with. CORE for the reason
      // `todo-listing.ts` gives: renderers of a folio's own notes, called by
      // `gen-docs-pages.ts` (core). They import `schemas/kg/jsonld.ts`,
      // `schemas/sdlc/todo-index.ts`, `scripts/todos.ts` and `viewer-page.ts`, all
      // core, so harness here would be four wrong-direction edges.
      // The state visualiser, and it is core for the reason `gen-landing-data.ts`
      // records about itself: it is a RENDERER, and rendering is core's.
      //
      // Its subject is mixed — it reads layer declarations and the bean
      // store, both harness — and that is exactly why the direction settles
      // it. Core reading harness is downward and costs nothing; harness
      // reading `scripts/todos.ts` is upward, and `adapter-layering.test.ts`
      // reported that edge on the first draft, where this sat beside
      // `beans.ts` in the harness block. The fix is not an exemption, it is
      // the right owner — the same sentence `gen-landing-data.ts` opens with.
      // The translation status page, and CORE by the same test read the same
      // way: it is a RENDERER. It reads the layer declaration to find the
      // `translation-sources` directory — harness, and downward, which costs
      // nothing — and its subject is the gettext corpus a folio is translated
      // from. What it PRODUCES is a page.
      //
      // Deliberately NOT beside `state-visualizer.ts` as a variant of it:
      // that generator draws only STATE graphs, and `translation-sources` is
      // not state. They are two renderers of two different things that happen
      // to share a shape, and folding one into the other would make the
      // state generator answer for a graph it correctly skips.
      // Three of the 19 unassigned that are CONTENT-side, by the same test
      // read the other way: each operates on a folio's own material, not on
      // the machinery that runs a process. Classifying them harness alongside
      // their sixteen siblings would have reached into `schemas/content/narrative.ts`,
      // `schemas/content/attribution.ts`, `schemas/library/archive-contents.ts` and
      // `schemas/library/tabular-records.ts` — all core — and bought four
      // wrong-direction edges for the tidiness of one homogeneous list.
      // `scripts/extract-assets.ts` STOOD HERE and is GONE as of bean `yj6r`,
      // 2026-09-30, for the reason the materialisation trio above gives: it
      // moved to `folio-assistant-core/scripts/` beside the
      // `schemas/content/extraction.ts` it reads, so the classification was carried by
      // location. SUPERSEDED 2026-10-02 by owner ruling 2 of the placement
      // proposal (bean `tlat`, PR5): the pair is the tool behind the harness's
      // own `asset-extraction` skill, so the schema moved DOWN to
      // `cat-harness/schemas/content/extraction.ts` and the script to
      // `cat-harness-tools/scripts/extract-assets.ts`. Neither is in this
      // core list again; the reasoning below is kept as the record of why it
      // was ever classified core. Its reasoning is kept rather than deleted with the entry,
      // because the next reader will ask why a container-extraction tool is not
      // adjudicated and "it is, by where it sits" is the answer: same test as
      // the three above — it reads a CONTAINER a folio was given (a zip, a PDF,
      // a saved page) and writes a `folio-extraction/v1` record beside it. Core
      // material, and its schema is core too. A rule naming a path its own scan
      // can no longer see fires on nothing while reading as an adjudication.
      // Same test, same answer: it reads `library/<bib-slug>/blocks/` and
      // writes `summaries.json` beside them, a folio's own material, through
      // `schemas/content/block-summary.ts` and `schemas/content/narrative.ts` — both core.
      // Same test, same answer: it reads `library/<bib-slug>/images.json`,
      // which is a folio's own material, and imports `schemas/content/attribution.ts`
      // and `schemas/content/document-image.ts` — the latter reaching `narrative.ts`
      // in turn. Every one of those is core, so classifying it harness would
      // buy three wrong-direction edges for the tidiness of one list.
    ],
  },
];

// ── Module discovery ───────────────────────────────

// ── Module discovery ────────────────────────────────────────────

/** Where the harness's code lives. Since bean `8lcl` that is cat-harness-tools: the
 * harness's modules moved to its `schemas/`, and cat-harness keeps data. */
// declared-path-literal: the base case — a module cannot resolve its own
// layer root through a declaration without first knowing where it is.
export const ROOT = resolve(TOOLS_ROOT);

/** Directories scanned for TypeScript modules. */
// `"test"`, not `"tests"`: the two test trees were consolidated onto `test/`
// on 2026-09-19 (bean `auap`). A scan root that names a directory which no
// longer exists is not an error here — `walkTs` returns early on a missing
// dir — so this would have gone on partitioning the repo while silently
// seeing none of the e2e specs or the health sweep.
// Since bean `8lcl` only `schemas/` holds the moved harness modules; the rest
// of cat-harness-tools is tools code, which this partition never judged.
export const SCAN_ROOTS = ["schemas"];

// input-site: inert #08aab37b — names a build-output directory only to leave it out of a walk
export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "beans", "docs"]);

/** This layer's spec, ready to hand to the engine. */
/**
 * The one edge permitted despite the direction rule.
 *
 * `cat-harness.ts` imports core's `folio-graph-typology.ts` for its side effect,
 * which is what makes the `folio` registration automatic instead of something
 * 110 commands had to remember. Bean `q2wn`, and the header of
 * `schemas/kg/graph-typology-registry.ts` for why the alternatives were worse.
 *
 * ONE entry, naming BOTH endpoints. That is the difference between this and
 * the blanket rule first tried here — "a bare side-effect import is exempt"
 * would have let any harness module reach any core module silently, which is
 * the blindness `q2wn` was opened about wearing a different hat. Any other
 * edge across this boundary still fails.
 *
 * It is a debt and is recorded as one: it exists because the two layers live
 * in one repository (#223). After the split, core is a dependency that
 * registers its own kinds on load and this line goes away.
 */
const PERMITTED_EDGES: readonly PermittedEdge[] = [
  {
    from: "schemas/kg/cat-harness.ts",
    to: "schemas/kg/folio-graph-typology.ts",
    reason:
      "The registration trigger. Core owns `folio`; this import is what makes it registered " +
      "by the time any reader can be called, because a reader lives in `cat-harness.ts` and " +
      "loading that module is therefore a precondition of calling one. Without it the kind is " +
      "registered only if the process happened to import core first — an import-order property " +
      "that threw `unknown graph typology \"folio\"` on a valid declaration, five times in PR #465.",
  },
  // Owner, 2026-10-10 (session_01UC1NuEuSy1MBNpEhnDuiGj), answering "record
  // both edges as known exceptions … so the placement is decided in that
  // audit": "ok". Both targets live in cat-harness/schemas/ and are imported
  // by harness schemas; the keyword rules classify them core. Where they
  // belong is the placement audit's question (bean `lthi`), not this one's.
  {
    from: "schemas/process/role-graph.ts",
    to: "schemas/conduct/model-capabilities.ts", // declared-path-literal: an import-direction exception names its endpoints by path
    reason:
      "Known exception pending the placement audit (bean lthi; owner 2026-10-10: \"ok\"). " +
      "role-graph.ts reads the model-capability schema; whether that schema is the harness's or core's is undecided.",
  },
  {
    from: "schemas/sdlc/kg-qa.ts",
    to: "schemas/sdlc/qa-review.ts", // declared-path-literal: an import-direction exception names its endpoints by path
    reason:
      "Known exception pending the placement audit (bean lthi; owner 2026-10-10: \"ok\"). " +
      "kg-qa.ts reads the review-verdict shape; whether qa-review.ts is the harness's or core's is undecided.",
  },
];

export const SPEC: PartitionSpec = {
  root: ROOT,
  repos: REPOS,
  allowed: ALLOWED,
  rules: RULES,
  scanRoots: SCAN_ROOTS,
  permittedEdges: PERMITTED_EDGES,
  skipDirs: SKIP_DIRS,
};
