/**
 * The graph-typology registry — **a leaf, and that is its whole job**.
 *
 * A graph typology says what a declared directory holds: whether it `renderable`,
 * and which layer it `holds`. The kinds themselves, the registry they live in,
 * and the shared layer every reader consults are all here.
 *
 * ## Why this is its own module
 *
 * `folio-graph-typology.ts` — core's registration of the only renderable
 * kind — imports only this file (core importing the harness, the allowed
 * direction), and `cat-harness.ts` triggers the registration itself. So the
 * kind is registered before anything can call a declaration reader, and
 * whether a declaration is accepted never depends on the process's import
 * order.
 *
 * Core still OWNS `folio`: the definition and its `renderable: true` stay in
 * `schemas/kg/folio-graph-typology.ts`, and a bare harness registry does not
 * know the kind (`cat-harness.test.ts` asserts it). `folio` must not be added
 * to `BASE_GRAPH_TYPOLOGIES`: *"a layer that cannot render must not own the
 * renderable kind."*
 *
 * @module schemas/graph-typology-registry
 * @graphNode schema
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HARNESS_SUBGRAPH_DECLARATION_FILE, declaredNodeFiles, type InstanceFilter } from "./declared-nodes";
import { GraphTypologyNodeSchema, kindDefOf } from "./graph-typology-node";
import { ValidatorNodeSchema, type ValidatorNode } from "./validator-node";
import { instanceNamespaceOf, namespaceForLayer, NS_PREFIXES, OWN_NAMESPACE_VALUES } from "./namespaces";
import type { NewInstanceSource } from "./subgraph-source";
import { BOOTSTRAP_GRAPH_TYPOLOGIES } from "@litlfred/bootstrap-tools/schemas/graph.ts";
import { findDeclarationFile, layerRootsIn } from "./instance-roots";
import { readFileSync } from "node:fs";


// ── Graph typologies ─────────────────────────────────────────────────

/**
 * The kinds of graph a declared directory can hold.
 *
 * `renderable` is the only behavioural distinction in this table, and it is
 * what makes `folio` special: a folio graph is expected to come out the
 * just-the-docs rendering pipeline as a website. The others are graphs that
 * tools read. Nothing stops a consumer treating them all uniformly — that is
 * the point of making them all graphs — but only a renderable one is wired to
 * the site build.
 */
/**
 * What a running process does with a graph of this kind.
 *
 * **One question settles it: does a running process WRITE it, READ it, or is it
 * the SUBJECT?**
 *
 * - `content` — the subject. A process may PRODUCE it, and that is usually the
 *   point of the process.
 * - `context` — **static state.** A record about content that a process reads
 *   and never writes. Fixed for the duration of a layer. It changes only
 *   when a human directs an authoring act, outside any process.
 * - `state` — **live state.** A record the process itself writes as it runs. A
 *   bean's status changes because a step completed.
 * - `derived` — produced FROM a source, and regenerated rather than
 *   re-authored. It stands on its own the way `content` does, but a finding
 *   against it is a finding against its GENERATOR.
 *
 * Four values, and **no "could not determine"** — which is a departure from
 * this repo's usual three-state rule for a reason worth stating: a third state is right when a CHECK looked and could not tell, and
 * wrong when an AUTHOR is registering a kind they are defining. Whoever adds a
 * kind knows what a process does with it; letting them decline to say would put
 * the burden on every consumer instead, which is the position the axis exists
 * to end.
 *
 * ## Two of the four arrived by being needed, not by being symmetrical
 *
 * This axis shipped with TWO values and has twice been widened by a case that
 * neither side described. That is the pattern to expect when adding a kind:
 * the value you need may not exist yet, and inventing a fifth is legitimate —
 * but only after the existing four have each been ruled out by a RULE rather
 * than by taste. `derived` was ruled in exactly that way (see
 * `isDerivedGraph`): `context` was refused because a declared process writes
 * `library/` and `context` makes that a defect; `content` was refused because
 * the QA sweep runs *"only on active/working content"*.
 *
 * The axis shipped with two values and the owner refined it the same day,
 * settling bean `mhh9`: *"put memory under state/context as static, during a
 * process. it does not change. agents dont work on it (except when an authoring
 * agent is directed by human). todos, beans are not static."*
 *
 * That is not a subdivision for tidiness. `content` and `state` alone forced
 * two unlike things together: a bean, which a step rewrites, and a memory
 * entry, which no step may touch. A consumer told only "this is state" cannot
 * tell whether writing to it is normal or a bug.
 *
 * See `skills/kg/kg-core/content-context-and-state-graphs.md`.
 */
export type GraphLayer = "content" | "context" | "state" | "derived";

/** What a declared directory's graph typology means. */
/**
 * Where ONE `$schema` family of a graph typology is defined. Bean `rdkm`.
 *
 * Three forms, because the corpus has all three and collapsing them would
 * make two of them lie:
 *
 * | form | means | example |
 * |---|---|---|
 * | `validator` | a Zod schema, `module#Export` — runnable | `kg-qa/v1` → `KgQaReportSchema` |
 * | `shape` | a TypeScript type, `module#Name` — readable, NOT runnable | `qa-witness/v1` → `QaWitness` |
 * | `external` | a specification nobody here types; the node conforms to it | a JSON Schema document, `https://json-schema.org/draft/2020-12/schema` |
 *
 * `external` is not a gap — the shape is somebody else's, and it is named
 * rather than restated.
 *
 * There was a fourth, `writtenBy`: no type at all, just the module that wrote
 * the family. It recorded the gap as data, and it was also this registry — a
 * `@general` node — naming its dependent. #1168 B6b typed all nine families
 * that used it (beans `dv8v`, `d4lb`) and removed the form, so an untyped
 * family can no longer be registered: it is either typed or it is not listed.
 */
export type NodeSchemaRef = (
  | { validator: string; shape?: never; external?: never }
  | { shape: string; validator?: never; external?: never }
  | { external: string; validator?: never; shape?: never }
  // A family LISTED with no code of its own: its validator is a
  // `folio-validator/v1` node that names it (bean riit, owner 2026-10-04: the
  // validator names the family). The registry fills `validator` in from it.
  | { validator?: never; shape?: never; external?: never }
) & {
  /**
   * Files of this family are GENERATOR OUTPUT — a script writes every one, so
   * nothing in them is authored and a reader must not judge them as prose.
   *
   * It says THAT a generator writes the family, never WHICH one: naming the
   * writer is what the removed `writtenBy` form did, and it made this registry
   * (a `@general` node) name its dependents (#1168 B6b). A boolean carries the
   * fact a consumer needs without the edge. Absent means authored or unknown —
   * never assume generated. `folio-intake/v1` is the case that shows why the
   * two differ: `writtenBy` named its CONSUMER, and its files are authored.
   *
   * Read by `check-reference-direction` to skip generated files (bean `zhg2`).
   */
  generated?: true;
  /**
   * NO FILE carries this family: it is the shape the kind's own source files
   * are READ into, in memory (the `archimate` kind's `archimate-model/v1`, what
   * `readArchimate` makes of an `.archimate` file). So it is drawn whether or
   * not a node on disk carries its tag (`gen-uml-overview`), and never looked
   * for on disk. Owner, 2026-10-31: UML "rather derived" (smart-ra#166 D2).
   */
  derived?: true;
};

/**
 * @general — a node others depend on: it points only at other general nodes,
 * never at its dependents (data-modelling step 8; checked by `arrow-direction`).
 */
export interface GraphTypologyDef {
  /**
   * Whose namespace the kind is named in, when it is not the harness's:
   * `core` for a kind the content layer above the harness declares as a node
   * in its own `typologies/` graph, named in THAT layer's namespace
   * ({@link graphTypologyIri}, {@link DECLARED_BY}). The harness registers no
   * `core` kind in code since folio-assistant#2598 (owner, 2026-10-16, "1a"):
   * the ones it uses itself (`todos`, `library`, `uploads`, `voices`, `folio`,
   * …) are its own.
   * A kind bootstrap defines is bootstrap's whatever this says
   * (`BOOTSTRAP_GRAPH_TYPOLOGIES`). The kind IS its individual,
   * `<ns>graphTypology/<name>` ({@link graphTypologyIri}); there is no class per kind.
   * Owner, 2026-09-30 (bean `3r47`): "Drop per-kind classes" — bootstrap names
   * a kind as one `GraphTypology` individual, and the harness now does the same.
   */
  layer?: "core";
  /**
   * Does every layer have ITS OWN graph of this kind — so a layer that
   * inherits a directory of this kind gets its own copy created?
   *
   * The per-entry `dependents: "reproduce" | "skip"` answered this until
   * 2026-09-30, when the owner retired it (option A: "make dependents:
   * reproduce automatic behaviour so [we] don't need it"). It is a fact about
   * the KIND: a folio has its own `uploads/`, `library/`, `docs/`, `qa`
   * results and work plan; it does not have its own empty `schemas/`,
   * `tools/` or `code`. Stated once here, it cannot disagree between two
   * declarations of the same kind — which the per-entry field did, e.g.
   * `docs` was `reproduce` once and `skip` four times.
   *
   * Absent means no: an inherited directory of the kind is a MEMBER of the
   * subgraph exactly where it already exists, and is never created empty
   * (the `dh4f` rule). {@link materialiseDirectories} reads it.
   */
  perInstance?: true;
  /**
   * Where a NEW layer's own graph of this kind lives, when `folio_init`
   * scaffolds it — `perInstance`'s companion: that field says a dependent HAS
   * its own; this one says where the new one is kept. Bean `hp54`.
   *
   * Read by `folio_init` ONCE, never by the resolver: the scaffolder writes a
   * complete `source: { kind: "branch", branch: "cat/<instance>/<id>",
   * keyedBy }` into the new instance's own declaration, and from then on that
   * declaration is the one answer. So an existing layer whose entry
   * declares no source (this repository's own `beans/` and `todos/`, still
   * awaiting their cutover) is not moved by it. The rule and the branch-name
   * convention are in the `directory-conventions` skill, §"Where a NEW
   * instance's state lives".
   *
   * Absent means a new layer's graph of this kind is written into its
   * checkout, as before.
   */
  newInstanceSource?: NewInstanceSource;
  /**
   * Is a graph of this kind expected to render as a website?
   *
   * The only behavioural distinction in the vocabulary — and the reason
   * `folio` is not declared here. The harness **cannot render**: the
   * just-the-docs pipeline and the webpage content type belong to
   * `folio-assist-core`. A layer that cannot render must not own the
   * renderable kind, so `folio` is REGISTERED by core rather than declared
   * here. See `schemas/kg/folio-graph-typology.ts`.
   */
  renderable: boolean;
  /**
   * Is a graph of this kind's markdown SHOWN ON a published page, though the
   * kind is not renderable itself?
   *
   * An IG annex (the FHIR layer's `ig-annex`) is the case that asked: a `.md`
   * annex is appended to its host page `input/pagecontent/<page>` as written,
   * so `business-processes.html#…` in `annexes/` names the page the IG
   * renders, and resolving it from `annexes/` reports a correct link as
   * broken (owner 2026-10-26, option A, on an IG's annex PR:
   * https://github.com/litlfred/smart-immunizations/pull/81). Neither
   * `renderable` (it is no site of its own) nor `within` (a sub-graph of a
   * kind, which the navbar folds) says this. `check:subgraphs` routes such a
   * kind's unresolved links to `siteResolved`, as it does a renderable
   * graph's, and the kind's owner judges them from the page that shows them
   * (an IG harness's annex-links check). Absent means no.
   */
  shownOnPublishedPages?: true;
  /**
   * Is a directory of this kind SOURCE that a build Tool turns into pages at
   * publish, so the directory itself is never copied to the site?
   *
   * A `web-app` directory holds an `index.html` that is the bundler's input,
   * not a page, and after the build a `node_modules/` beside it. The mount
   * pass copies any declared directory with an `index.html` to
   * `/<kind>/<instance>/`, so without this it published the app's source and
   * its installed dependencies' READMEs, whose dead links stopped the publish
   * (smart-trust's staging preview, 2026-11-12). The build Tool's own route
   * is the only place such a kind is published. Absent means no.
   */
  publishedByBuild?: true;
  /**
   * Does a graph of this kind record WORK — something somebody is partway
   * through, that an arriving agent could pick up?
   *
   * The question the owner asked for, 2026-09-20:
   *
   * > tell them to determine if active KG (beans/tods) or static (point to
   * > process on determining context)
   *
   * **Narrower than `holds: "state"`, and the difference was measured rather
   * than assumed.** The first attempt read "declares any state graph", which
   * made the repository root and the IRIS replica ACTIVE on `uploads` alone — an
   * ingestion queue is live state and is not work anybody is partway through.
   * An agent told "this KG is active" on that basis arrives, looks for
   * something to prioritise, and finds a directory of unprocessed files.
   *
   * Only meaningful for `holds: "state"` kinds: content and context record no
   * position by definition. Optional in the type and REQUIRED by
   * `check:graph-typology-work` for every state kind, which is how a new kind
   * cannot ship undecided without the type gaining a field that is nonsense
   * for the other three layers.
   *
   * Note what this does NOT collapse. `beans` is the agent work plan and
   * `todos` is a PERSON's outstanding work — the vocabulary keeps them apart
   * deliberately and `AGENTS.md` forbids a second work plan. Both record
   * work, so both answer this question `true`; that is the point of asking
   * "records work" rather than "is the work plan".
   */
  recordsWork?: boolean;
  /**
   * Does a graph of this kind say what the layer **IS**, or where something
   * **GOT TO**?
   *
   * The second axis in this table, and the one the vocabulary was missing.
   * `renderable` answers "does this become a website"; this answers "is this
   * the subject matter, or a record about it". A consumer that needs one and
   * is handed the other has no way to tell today.
   *
   * - **`content`** — authored nodes a reader or a tool consumes as the
   *   subject matter. It is what the layer IS. It stands on its own: you
   *   can read a skill, a schema or a library section without knowing what
   *   anybody did with it.
   * - **`context`** — STATIC state. A record about content that a running
   *   process READS and never writes, fixed for the duration of a layer.
   *   It changes only when a human directs an authoring act, outside any
   *   process. A step that writes to a `context` graph is a defect.
   * - **`state`** — LIVE state. A record the process itself WRITES as it
   *   runs: a bean's status changes because a step completed, a workflow
   *   instance's token moves. It REFERENCES content and is meaningless
   *   without it.
   * - **`derived`** — produced FROM a source and REGENERATED rather than
   *   re-authored. It stands on its own the way `content` does — a `library/`
   *   section still reads — but a QA finding against it is a finding against
   *   the ingestion that made it, which is why the sweep skips it. Added
   *   2026-09-20 (bean `hqku`); see `isDerivedGraph` for why neither
   *   `content` nor `context` fitted.
   *
   * **REQUIRED, so a kind cannot go unclassified.** That is the
   * `DOCUMENT_BLOCK_KINDS` discipline — derived as the complement of
   * `MATH_BLOCK_KINDS` precisely so a new block kind cannot slip through
   * unassigned. Here the same guarantee comes from the type being required
   * rather than optional: `tsc` refuses a new kind that does not say, at the
   * keyboard rather than at CI, and an optional field would have made "did
   * not say" indistinguishable from "content".
   *
   * **The discipline is in the skill, not here** —
   * `skills/kg/kg-core/content-context-and-state-graphs.md` carries the definition,
   * the classification of every kind with its reason, the two questions that
   * settle a hard case, and what a consumer may assume about each side. The
   * classification of `fsh-guts`, `qa`, `health` and `uploads` is the part
   * worth reading before adding a kind: none of the four is obvious from its
   * name, and each is decided by the same two questions rather than by taste.
   *
   * SETTLED, and DONE: agent memory is `context` — bean `mhh9`, decided by
   * the owner 2026-09-20 — and the 36 nodes moved to the declared `memory/`
   * graph the same day, as their own change (bean `07xs`), because relocating
   * a directory as a SIDE EFFECT of adding a classification is the shape #395
   * refused and bean `auap` did separately.
   *
   * The case is worth keeping because it proves the rule above: for the hours
   * between, `cat-harness` was correctly `content` while something inside it
   * was `context`, and both statements were true. Classifying the CONTAINING
   * kind is not a ruling on its contents.
   */
  holds: GraphLayer;
  /**
   * Whether a directory of this kind owes json, jsonld and schema.json at its URL (check:subgraph-coverage). Absent: owed unless `holds` is `state`. `false` for kinds whose files are not graph nodes: code, built pages, fixtures. Owner Q-SER-1 C / Q-SER-2 A, 2026-11-12: not all directories need to be harnessed.
   */
  serialised?: boolean;
  summary: string;
  /**
   * What every navigation surface CALLS a destination of this kind: the
   * viewer rail, the Jekyll sidebar, FOLDERS, the landing's viewer list, the
   * glass tiles and the Stickies row.
   *
   * Owner, 2026-10-01, bean `ob3m` finding 6, option 1 of 4, "One name
   * everywhere": each destination gets ONE label, used the same way on every
   * surface, and where the harness matters the surface APPENDS it as a
   * qualifier ("Skills · C@T Harness") rather than changing the base name.
   * Measured before: 7 destinations carried two names, among them `docs` vs
   * "Docs — cat-harness" and `methodology` vs "Methodologies".
   *
   * The plural display name for a count noun ("Skills", "Methodologies"),
   * and the collective noun otherwise ("Library", "Health"). Optional: a kind
   * that declares none is shown by {@link kindTitle}'s fallback. The single
   * reader is `scripts/lib/nav-label.ts`. A surface that composes its own
   * string is the defect this field exists to remove, and `check:nav-names`
   * fails it.
   */
  title?: string;
  // No `skill` (#1168, B3). A kind named the skill that says how to read it —
  // the general node naming its dependent, and read by nothing. The skill
  // now names the kinds it reads, in its front matter (`graph-typologies:`), and
  // `kg:audit` resolves each against this registry (`skill-graph-typologies-resolve`).
  /**
   * Where the shape of a node in this graph is defined — a repo-relative
   * module path, or a `$schema` tag the files themselves carry.
   *
   * Optional because not every kind has one answer: `cat-harness` holds node
   * kinds typed in different places — skills, workflows, roles, actors — and a
   * single pointer there would be a lie of precision rather than a fact.
   *
   * **It is NOT a validator**, and {@link GraphTypologyDef.validator} is why.
   */
  schema?: string;
  /**
   * What RUNTIME-VALIDATES a node of this kind — `module#Export`, naming a
   * Zod schema.
   *
   * ## Why this is not {@link GraphTypologyDef.schema}
   *
   * The two look like one fact and are not, and the corpus is what settles
   * it. `schema` answers *where is the shape written down*, and its own doc
   * allows a `$schema` tag the files carry. `validator` answers *what can I
   * run*. They diverge today, in the first case anyone looked at:
   *
   * | kind | `schema` | `validator` |
   * |---|---|---|
   * | `qa` | `schemas/kg/qa-record-shapes.ts` | **none** — that module exports TypeScript INTERFACES; no Zod schema for `qa-witness/v1` exists anywhere |
   *
   * So overloading `schema` would have made its one substantial use a lie:
   * a consumer that imported it expecting something parseable would get a
   * module with nothing to call. Two fields, because a case where they
   * differ is already committed.
   *
   * ## `module#Export`, not a bare module
   *
   * A module path names a file, and a file may export thirty schemas —
   * `schemas/sdlc/health-report.ts` exports five. The `#` form is the convention
   * `<cat-harness.processes:decision ref="file.dmn#Decision_Id"/>` already uses in every BPMN
   * gateway here, so this reuses a spelling rather than minting one.
   *
   * **Resolved relative to the LAYER root**, not the repository root. That
   * distinction was invisible until `#437` moved the layer under
   * `cat-harness/`: the three `schema` paths kept working as instance-relative
   * strings while their own doc called them repo-relative, and nothing
   * noticed because nothing read them. `bun run cat check:kind-validators` is
   * what notices now.
   *
   * Absent means ABSENT — a kind with no runtime schema. A consumer must
   * report that as *could not determine*, never as valid; 13 of the 16 base
   * kinds are in that state and one of them, `qa`, is the largest generated
   * graph here.
   */
  validator?: string;
  /**
   * WHY a runtime validator does not apply to this kind — a reason, not a flag.
   *
   * ## The defect this exists to remove
   *
   * `check:kind-validators` reported *"7 kind(s) declare no validator"* and
   * carried `--require-all` "for the day the gap is meant to be closed".
   * Measured 2026-09-24 (bean `rj0n`): **that day could not come.** Every one of
   * the seven was either not JSON at all, or had no nodes:
   *
   * | kind | what it holds | why Zod cannot apply |
   * |---|---|---|
   * | `processes` | 77 `.bpmn`, 9 `.dmn` | XML |
   * | `uml` | 103 `.puml`, 101 `.mmd` | PlantUML / Mermaid, and `derived` |
   * | `methodology` | 12 `.md` | markdown |
   * | `code` | 1793 `.ts` | TypeScript |
   * | `cat-harness` | mixed `.ts` and `.json` | several node types; {@link GraphTypologyDef.schema} calls one pointer here "a lie of precision" |
   * | `bean-defs`, `session-state` | nothing | nested, or absent from this repository |
   *
   * So the count read as a seven-item backlog over a real backlog of **zero** —
   * `dh4f` INVERTED. That bean is could-not-determine rendered as clean; this is
   * **not-applicable rendered as a gap**, and it is the more expensive direction,
   * because a flag that can never pass is one somebody eventually deletes. The
   * rule is `check-harness-state`'s, one file over: *a check that cannot pass is
   * indistinguishable from a corpus that cannot be fixed.*
   *
   * ## It is a REASON, and the reason must name a fact
   *
   * A boolean would let a kind opt out by asserting it. The reason has to name
   * the file format or the absent subject — something a reader can check — so
   * this cannot become the polite way to launder a real gap. "We decided not to"
   * is not a reason; ".bpmn is XML" is.
   *
   * Absent means **has not said**, which is the finding `--require-all` fails on.
   * That keeps silence and a decision apart, which is the whole point: a kind
   * added tomorrow without deciding still shows up.
   *
   * **Mutually exclusive with {@link GraphTypologyDef.validator} and
   * {@link GraphTypologyDef.nodeSchemas}** — a kind cannot both have a runnable
   * schema and declare that one cannot exist. `check:kind-validators` reports
   * that contradiction rather than picking a winner.
   */
  validatorNotApplicable?: string;
  /**
   * One entry per `$schema` family a node of this kind may carry, keyed by
   * the tag. Bean `rdkm`.
   *
   * ## Why `validator` was not enough
   *
   * `validator` names ONE schema, and `qa` is the case that broke it: its
   * directory holds seven families — `kg-qa/v1`, `qa-witness/v1`,
   * `block-qa/v1`, `qa-results/v1`, `folio-qa-index/v1`, `translation-qa/v1`,
   * `folio-test-run/v1`, counted 2026-09-23 — and a single pointer would have
   * named one of them and said nothing true about the other six. A file
   * already says which family it is (the `$schema` tag), so the tag is the key.
   *
   * ## A kind that declares this claims to be COMPLETE
   *
   * `check:kind-validators` reads every JSON node in the kind's declared
   * directories and fails on a tag with no entry here. Declaring the map is
   * the claim that it names every family; a family that appears later is a
   * finding, not something to skip.
   *
   * When both are set, `nodeSchemas` wins for a node whose tag it names, and
   * `validator` stays the answer for the kind as a whole.
   */
  nodeSchemas?: Readonly<Record<string, NodeSchemaRef>>;
  /**
   * The NESTED DECLARATION a directory of this kind carries, by filename.
   *
   * A graph directory may declare its own inner structure one level down:
   * `beans/beans.json` says the `beans` graph holds `bean-defs` and
   * `workflow-state`, so the root `harness.json` does not restate them. One
   * fact, one place, at each level.
   *
   * ## Why the KIND names the file, and not the directory
   *
   * `declaredKinds` computed it as `${basename(path)}.json` — a filename
   * derived from wherever the directory happened to sit. `bean-graph.ts`
   * states the opposite rule, and states it as a design property: *moving
   * `beans/` to `work/` requires editing nothing inside it.* Both were true
   * of today's layout and they disagree the moment anybody relocates:
   * the walker looks for `work/work.json`, the file is still `work/beans.json`,
   * and the nested kinds vanish from `declared` with nothing said. A silent
   * under-count, which manufactures an `undeclared` finding somewhere else.
   *
   * The owner settled the general rule on 2026-09-20 — **each type declares
   * its own filename** — and this is that rule at the graph-typology level. The
   * kind knows what its declaration is called; a directory name is a
   * filesystem accident.
   *
   * Absent means the kind has no nested declaration, and `declaredKinds`
   * falls back to the directory-name convention plus `graph.json` so an
   * unmigrated graph keeps working.
   */
  declarationFile?: string;
  /**
   * Is a directory of this kind GROUPED BY CONCERN — `<dir>/<group>/`, with
   * the groups named from within by {@link declarationFile} and drawn from
   * the `concern-group` code list (bean `9umr`; placement PR0c, bean `ejye`)?
   *
   * Owner, 2026-09-29: *"declared sub-graphs of cat-harness based on semantic
   * concern … dont need a separate facet. built into location."* — and the
   * split list of 2026-09-30: *schemas, skills, uml, processes, library,
   * tests*. A fact about the KIND, so a kind that groups cannot disagree with
   * itself between two declarations, the reason `perInstance` lives here.
   *
   * A group is declared ONCE, by the layer that declares the subgraph
   * (the harness), and inherited: each higher layer's same-named
   * `<dir>/<group>/` is a named MEMBER of it (option A, bean `1g4s`). So a
   * higher layer adds no group of its own. `scripts/concern-groups.ts`
   * resolves groups and members; `check:concern-groups` holds the rules.
   * Requires {@link declarationFile}, since that is where groups are named.
   */
  concernGroups?: true;
  /**
   * The kind this one is a SUB-GRAPH of, when it is one.
   *
   * Owner, 2026-09-23 (issue #1164): proposals live in *"a docs/proposals/
   * sub-graph declared sub-sub-graph (which starts closed in navbar, general
   * behavior)"*. GENERAL is the operative word: this is not a special case for
   * proposals, it is a relation any kind may declare, and every surface that
   * lists kinds draws a kind with `within` INSIDE its parent's row, folded
   * shut until the reader opens it. `check:graph-typology-within` holds the
   * relation to a registered kind and forbids a cycle.
   *
   * A relation between KINDS, not directories: the navbar lists graphs by
   * kind, and a directory nested on disk is not thereby a sub-graph (the
   * `beans/workflow/` history above is exactly that confusion).
   */
  within?: string;
  /**
   * The BLOCK KIND (a `folio-block-kind/v1` node's `kind`, in whichever layer
   * declares it) that a node of this kind IS, read through the kind module's
   * view of it: a journey is a DAK user scenario.
   *
   * There was no way to say one kind specialises another across layers.
   * `nodeKind()` parents compose FIELDS by import, so a parent must be in
   * this layer or below, and the general kind may be in a layer above (the
   * DAK vocabulary is): naming it by its `kind` string keeps the reference
   * direction. The specialising kind's module exports the view that yields
   * the general kind's fields, DERIVED where they mean something else here
   * (a journey's personas are actors; the DAK's are roles), and its gate
   * reads this field and holds every node to what the view must yield
   * (`check:journey-refs` for `user-scenario`).
   */
  specialises?: string;
  /**
   * The kind's mark, when the kind is DECLARED as a node (bean dmx1) rather
   * than listed here: it travels with the kind, so `schemas/content/avatars.ts` does
   * not have to be a second central table. A kind listed here keeps its entry
   * in `AVATARS`.
   */
  avatar?: { glyph: string; tone: number; reads: string };
  /** The navbar tile icon (a name in `TILE_GLYPHS`); on cat-harness's own kinds too since sod4 #5, so `graph-tiles.ts` keeps no table. */
  tileIcon?: string;
  /**
   * `false` keeps the kind out of every PUBLISHED graph: not one edge of a
   * published artefact may lead to it (`isPublishedGraphTypology`). Absent means
   * published. Was `UNPUBLISHED_GRAPH_TYPOLOGIES` in cat-harness.ts (sod4 #5).
   */
  published?: false;
  /**
   * The kind's directory may be scanned for SKILL BODIES (`*.md` with a
   * `name:` front matter). Was `SKILL_BEARING_GRAPH_TYPOLOGIES` (sod4 #5).
   */
  skillBearing?: true;
  /**
   * The kind IS harness knowledge-graph content — the `cat-harness` umbrella
   * and the kinds split out of it. Was `KG_CONTENT_GRAPH_TYPOLOGIES` (sod4 #5).
   */
  kgContent?: true;
  /**
   * What a directory of this kind HOLDS, as the kind table states it: the
   * editorial prose that used to be hand-written in that table's `contents`
   * column (owner, 2026-10-04: the prose moves onto the kind, and the table is
   * generated from it). Longer and more careful than `summary`, which stays
   * the one line a tile or a tooltip shows.
   */
  description?: string;
  /** A remark the table's `renderable` column carries beside yes/no ("the plain just-the-docs pipeline"). */
  renderableNote?: string;
  /** A directory of this kind may be declared by ANY layer, not only the kind's owner (the table's "and any layer"). */
  anyLayer?: true;
}

/**
 * The graph typologies the **harness itself** defines.
 *
 * **The map below is the only answer to how many, and this sentence deliberately
 * does not give one.** It read "Four, and deliberately none of them renderable"
 * over a map of fourteen — and the version before that read "Five" over a map of
 * four, which bean `5o3a` records #269 correcting. A count in prose is a claim
 * that has to be maintained, it was maintained wrongly twice, and nothing checks
 * it. `Object.keys(BASE_GRAPH_TYPOLOGIES).length` is checkable and free.
 *
 * What IS stable and worth saying: **none of them is renderable.** Everything
 * here is a graph a tool reads — how work is done (`tools`), what an actor knows
 * and which process governs it (`cat-harness`), the shapes both are typed against
 * (`schemas`), the work plan with its running-process state (`beans`), and the
 * ingestion, voice and translation inputs. Rendering belongs to `folio`, which
 * the layer above registers.
 *
 * ## Why the work plan is the harness's and not core's
 *
 * `folio` is registered by `folio-assist-core` because only core can render.
 * The work plan has no such constraint in either direction: a layer has
 * work whether or not it has content, and `agentic-harness` itself carries a
 * `beans/` store for its own. A Tool repo and a Test repo have work plans too.
 * So it is declared here — the test for "does this belong to the harness" is
 * whether the harness has one, and it does.
 *
 * ## One `beans` kind, and where the distinction it carried went
 *
 * This map used to hold five kinds, splitting the work plan in two: `workplan`
 * at `beans/` and `process-state` at `beans/workflow/`. The reasoning was that
 * WHAT IS BEING WORKED ON is human- and agent-authored and carries judgement,
 * while WHERE A RUNNING PROCESS GOT TO is a token the interpreter owns and no
 * human is invited to edit — and that a consumer asking for the work plan must
 * not be handed BPMN instance state.
 *
 * That reasoning holds; the mechanism was wrong. The second directory sat
 * INSIDE the first, so a consumer scanning a declared directory could not
 * assume it owned what lay beneath it, and the two were distinguishable only by
 * file extension — which the declaring comment itself called "a coincidence of
 * the current layout, not a contract". Two sibling entries in a flat list
 * misrepresented a containment relation.
 *
 * `beans/` is now a graph with named nodes (`beans/beans.json`,
 * `schemas/sdlc/bean-graph.ts`), so the distinction lives INSIDE the graph that
 * declares it rather than out here where it had to be inferred. The harness
 * says which directories exist and what kind of graph each holds; the bean
 * graph says what its own nodes are. One fact, one place, at each level — and
 * the consumer that must not be handed instance state asks for a node by name.
 */
export const BASE_GRAPH_TYPOLOGIES: Readonly<Record<string, GraphTypologyDef>> = {
  // The META-KIND (bean dmx1): a directory of graph typology `typologies` holds the
  // harness's own graph typologies, one `folio-graph-typology/v1` node per file. Owner,
  // 2026-10-04: no central registry for subgraph types; a `typologies/` graph
  // (option 1 of 3). The base layer declares this one kind in code because a
  // reader needs it to find all the others.
  typologies: {
    description:
      "the graph typologies a harness declares it OWNS, one `folio-graph-typology/v1` node per file (`schemas/kg/graph-typology-node.ts`), loaded by the registry on first use across every instance; a name two files declare is refused. Owner, 2026-10-04: *\"there should not be a central registry for declaring mount tools and subgraph types\"*, and a `typologies/` graph rather than a contributions hook or a field in `<instance>.json` (option 1 of 3). The base layer lists only this one kind in code, because a reader needs it to find the rest. Bean `dmx1`.",
    title: "Graph typologies",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-graph-typology/v1": {},
    },
    summary:
      "The graph typologies a harness declares it owns, one node per kind, so no central registry " +
      "names another harness's subgraph types. Loaded across the instances on first use.",
  },
  // The second META-KIND (bean riit): a directory of graph typology `validators`
  // holds the validators a harness's code provides, one `folio-validator/v1`
  // node each, naming the kind and family it validates. The registry joins them
  // onto the kinds. Owner, 2026-10-04: validators are KG nodes, and the
  // validator names the family.
  validators: {
    description:
      "the validators a harness's code provides, one `folio-validator/v1` node each (`schemas/kg/validator-node.ts`), naming the graph typology and `$schema` family it checks and the Zod export that checks it; the registry joins each onto its kind on first use, and refuses a second answer for one family. Owner, 2026-10-04: validators are KG nodes, and the validator names the family (option 1 of 2). Bean `riit`.",
    title: "Validators",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-validator/v1": {},
    },
    summary:
      "The validators a harness's code provides, one node each naming the graph typology and $schema " +
      "family it checks and the Zod export that checks it, joined onto the kinds on first use.",
  },
  // The fourth and fifth META-KINDS (bean riit, step 3b): a harness's QA
  // checkers and pipeline-plugin implementations, one node each, registered
  // for a folio through its dependency tree. Owner, 2026-10-04: every
  // contribution is a node, one graph per contribution type.
  "qa-checkers": {
    description:
      "the QA checkers a harness's code provides, one `folio-qa-checker/v1` node each (`schemas/kg/contribution-nodes.ts`): the criterion it answers, and the dispatch table (`path#Export`, keyed by the criterion) that holds the code. `loadContributions` registers them for every folio whose dependency tree includes the harness. Owner, 2026-10-04: every contribution is a node, one graph per type (option 1 of 2), scoped by the dependency tree (option 1 of 3). Bean `riit`, step 3b.",
    title: "QA checkers",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-qa-checker/v1": {},
    },
    summary:
      "The QA checkers a harness provides, one node per criterion naming the table that holds the code; " +
      "registered for a folio through its dependency tree.",
  },
  "pipeline-plugins": {
    description:
      "the generic pipeline's slots a harness fills, one `folio-pipeline-plugin/v1` node each (`schemas/kg/contribution-nodes.ts`): the slot (`pipeline/pipeline-plugins.ts`), and the table of implementations (`path#Export`, keyed by slot, typed against the slots' contract). `loadContributions` registers them for every folio whose dependency tree includes the harness. Bean `riit`, step 3b; the slots themselves are bean `squu`'s.",
    title: "Pipeline plugins",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-pipeline-plugin/v1": {},
    },
    summary:
      "The generic pipeline slots a harness fills, one node per slot naming the table of implementations; " +
      "registered for a folio through its dependency tree.",
  },
  // The third META-KIND (bean riit, step 2): a directory of graph typology
  // `block-kinds` holds the block kinds a harness's adapter owns, one
  // `folio-block-kind/v1` node each. `block-kinds.ts` DISCOVERS them across
  // every layer; no module lists them.
  "block-kinds": {
    description:
      "the block kinds a harness's content adapter owns, one `folio-block-kind/v1` node each (`schemas/kg/block-kind-node.ts`): the kind string, its adapter and narrowest profile, label prefix, RDF types, builder and English heading. `schemas/content/block-kinds.ts` discovers them across every instance's declared graph, so no module lists the kinds. Owner, 2026-10-04: *\"kinds need to be discoverable … not centrally managed\"*; document kinds live in the content core and the math kinds in the science layer (option 2 of 3). Bean `riit`, step 2; sod4 finding #1.",
    title: "Block kinds",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-block-kind/v1": {},
    },
    summary:
      "The block kinds a harness's adapter owns, one node per kind carrying its label prefix, " +
      "RDF types, profile and builder. Discovered across the instances; no module lists them.",
  },
  // A content adapter's block VOCABULARY (bean riit, step 5): one
  // `folio-content-adapter/v1` node per vocabulary. `block-kinds.ts` derives
  // CONTENT_ADAPTERS from the typed ones; no module lists the vocabularies.
  "content-adapters": {
    description:
      "the block VOCABULARIES a harness owns, one `folio-content-adapter/v1` node each (`schemas/kg/content-adapter-node.ts`): the name every block-kind node's `adapter` names, the companion roles its blocks can have, whether cat-harness's code types it, and for an untyped one its vocabulary module. `schemas/content/block-kinds.ts` derives `CONTENT_ADAPTERS` from the typed nodes and `schemas/sdlc/block-qa.ts` derives `ADAPTER_COMPANION_ROLES`; an untyped vocabulary reaches a folio through its dependency tree. Owner, 2026-10-05, option 1 of 3: the vocabulary is a node and the server adapter CLASS is not, since the two do not line up (`document` has a class and no vocabulary, `dak` a vocabulary and no class). Bean `riit`, step 5.",
    title: "Content adapters",
    renderable: false,
    holds: "content",
    nodeSchemas: {
      "folio-content-adapter/v1": {},
    },
    summary:
      "The block vocabularies a harness owns, one node per vocabulary carrying its companion roles " +
      "and whether the platform's code types it. Discovered across the instances; no module lists them.",
  },
  tools: {
    tileIcon: "tools",
    description:
      "Tool definitions, themselves nodes in the KG",
    title: "Tools",
    renderable: false,
    // A Tool node is an authored definition of a mechanism. It says what this
    // layer CAN DO, not what anybody did.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    summary: "Tool definitions — themselves nodes in the KG, per the repo taxonomy.",
  },
  // Named for the LAYER that defines it, like every other harness concept.
  //
  // It was `kg`, which named what the graph HOLDS rather than who owns it —
  // the odd one out in a vocabulary where `harness.json`, `CatHarness`
  // and the `cat-harness` layer are all named for the harness. The owner,
  // 2026-09-19: "kg -> cat-harness for naming conventions, no? skills/
  // schemas beans all in cat-harness, voices, uploads library in
  // folio-asst-core."
  //
  // `kg` remains readable as a deprecated alias — see GRAPH_TYPOLOGY_ALIASES.
  "cat-harness": {
    kgContent: true,
    skillBearing: true,
    description:
      "the harness layer's own knowledge graph, where a directory holds MORE THAN ONE of its parts — in practice the `[\"schemas\", \"cat-harness\"]` entries, where it means \"a schema IS a knowledge-graph node\". Renamed from `kg` on 2026-09-19; `kg` still reads, deprecated. **Not itself deprecated** by the 2026-09-21 split: an alias maps one name to one name, and this would have to become three. A downstream declaration still saying `[\"cat-harness\"]` keeps parsing and keeps being scanned for skills; what it loses is the finer query, which it never had.",
    title: "Harness graph",
    // A NAMED SUBGRAPH of the harness — `openapi/`, owner 2026-10-07: *"put
    // cat-openapi under cat-harness as named subgraph \"openapi\", not separate
    // repo"* — names the graphs inside it from within (#980), `subgraph: true`
    // entries in this file. The constant lives in the leaf `declared-nodes.ts`
    // because the typology and validator scans read it before this registry exists.
    declarationFile: HARNESS_SUBGRAPH_DECLARATION_FILE,
    // Its identity is its individual, `…/cat-harness/v0/ns/graphTypology/cat-harness`
    // (`graphTypologyIri`). It was also a class, `KGraph`, from 2026-09-21 until
    // the per-kind classes went (bean `3r47`, 2026-09-30); the concept that
    // name stood for is bootstrap's Knowledge Graph. `kg` and `cat-harness`
    // remain two spellings of this one kind (GRAPH_TYPOLOGY_ALIASES).
    renderable: false,
    // Skills, workflows, roles, requirements — the authored instruction bodies
    // and the diagrams they are named from. See the note on `holds`:
    // classifying the container was never a ruling on its contents — for a
    // few hours on 2026-09-20 it held `memory` nodes, which are `context`
    // (beans `mhh9`, `07xs`).
    holds: "content",
    validatorNotApplicable:
      "it holds several node kinds typed in different places — skills, workflows, roles, actors. `schema` above " +
      "already says why one pointer here would be a lie of precision, and that applies to a validator with more " +
      "force: a runnable one would silently grade 51 JSON files against whichever single shape it named. Each " +
      "family is validated where it is declared.",
    summary: "A Subgraph holding a Harness's own parts, such as Skills, Processes and Roles, where one directory holds more than one of them.",
  },
  // ── THE THREE KINDS SPLIT OUT OF `cat-harness`, 2026-09-21 ─────────────
  //
  // One kind was declared by 22 directories and held FOUR branches of the
  // taxonomy at once — Skills, Workflows, Scenarios and methodologies — so a
  // consumer filtering on kind could not tell them apart. "Give me the
  // Workflows" was not a query anybody could write; it could only be
  // approximated by matching a path, which is exactly the fragility the graph
  // exists to remove. Owner's decision, 2026-09-21, after the census was put
  // to them.
  //
  // ## `cat-harness` SURVIVES, and is not deprecated
  //
  // An alias cannot express a split: `GRAPH_TYPOLOGY_ALIASES` maps one name to one
  // name, and `cat-harness` would have to become four. It also had a FIFTH job
  // the split does not name — on a directory declaring `["schemas",
  // "cat-harness"]` it means "a schema IS a knowledge-graph node", which is
  // why `isKgOnlyDirectory` tests for the kind EXACTLY rather than for its
  // presence. That job is still real, so the umbrella stays and now means what
  // it always meant on those entries: harness knowledge-graph content whose
  // directory holds more than one part of it.
  //
  // A downstream declaration still saying `["cat-harness"]` therefore keeps
  // parsing. What it loses is the finer query, which is the thing it never had.
  skills: {
    tileIcon: "skills",
    kgContent: true,
    skillBearing: true,
    anyLayer: true,
    description:
      "Skill packages — the authored instruction bodies an Actor performs a Task from. A Skill is a **Capability with defined inputs and outputs**, stated generically so it is portable across forges, binaries and machines. Split out of `cat-harness` on 2026-09-21.",
    title: "Skills",
    // THE FROM-WITHIN NODE for a skills directory (bean cmsl, owner
    // 2026-09-30, round 4): `skills/skills.json` names the layer
    // directories declared inside `skills/` — `voices/`, and `lean/` in
    // the science layer — so the nesting is declared where the #980 ruling
    // says it must be, never by a root declaration reaching down.
    declarationFile: "skills.json",
    // Its `topics` ARE its concern groups (bean 9umr) — the first kind that
    // grouped, and the shape every other grouping kind now follows.
    concernGroups: true,
    renderable: false,
    // A Skill is a Capability with defined inputs and outputs — an authored
    // instruction body. It states what can be done, never what was done.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-voice/v1": {},
      "folio-voice-skill/v1": {},
      // A synced remote skill's pinned, per-file fixity record (issue #556).
      "folio-remote-skill/v1": {},
      // `skills.json`, the node that names a skills directory's TOPICS (bean `9umr`).
      "skill-topics/v1": {},
    },
    // bootstrap's own sentence, read rather than restated (bean r3gy, D1).
    summary: BOOTSTRAP_GRAPH_TYPOLOGIES["skills"],
  },
  processes: {
    tileIcon: "processes",
    kgContent: true,
    anyLayer: true,
    description:
      "Executable BPMN processes and the DMN tables their gateways compute from. The diagrams are the source of truth rather than illustrations of one. **Where a running instance GOT TO is not here** — that is `workflow-state`, which is `state` rather than `content`. Two questions, two graphs. Split out of `cat-harness` on 2026-09-21.",
    title: "Processes",
    // Grouped by concern from within: `processes/processes.json` names the
    // groups, `processes/<group>/` holds them, a DMN under
    // `processes/<group>/decisions/` (placement proposal §1.2, PR0c).
    declarationFile: "processes.json",
    concernGroups: true,
    // No `nodeSchemas` entry for its `concern-groups/v1` file: this kind
    // states `validatorNotApplicable`, and the two are exclusive. That one
    // file is graded by `check:concern-groups`, which parses it with
    // `ConcernGroupsSchema`.
    renderable: false,
    // The BPMN and DMN are the source of truth and are READ to run a process;
    // where a running instance GOT TO is `workflow-state`, which is `state`.
    // Two questions, two graphs — see the `workflow-state` skill for why one
    // answer rather than two is the whole point.
    holds: "content",
    // BPMN's shape is an XSD, not a Zod schema, so there is no validator;
    // the pinned edition and its operative terms are the external-schema record.
    schema: "external-schemas/omg-bpmn-2.0.json",
    validatorNotApplicable:
      "its nodes are `.bpmn` and `.dmn` — XML, counted 2026-09-24 as 77 and 9. A Zod schema parses JSON, so one " +
      "here would be a category error; `check:workflows`, `xml-comment-check` and `check-process-documentation` " +
      "grade them instead.",
    // bootstrap's own sentence, read rather than restated (bean r3gy, D1).
    summary: BOOTSTRAP_GRAPH_TYPOLOGIES["processes"],
  },
  // ── BPMN that describes work, rather than running it (owner, 2026-11-01,
  // Q-SUBG-3) ─────────────────────────────────────────────────────────────
  "business-processes": {
    // A sub-graph of `processes` for display only (Q-SUBG-6 A): the navbar
    // folds it under Processes. `within` carries no inheritance, so the
    // engine's reading of `processes` does not reach it.
    within: "processes",
    tileIcon: "processes",
    // NOT `kgContent`: that would make every layer declaring one a HARNESS
    // (`kg-subscribe`'s rule: a harness kind holds Skills, Roles or
    // Processes the engine runs), and the engine's corpus walk would reach it.
    // A DAK's diagrams are content about work, like `folio`.
    anyLayer: true,
    description:
      "BPMN diagrams that DESCRIBE how people and organisations work, as content: a guideline's or an " +
      "implementation guide's business processes (a DAK's, for example). The processes viewer draws them " +
      "beside the `processes` kind, and nothing runs them: the engine and its gates read `processes` only, " +
      "so a diagram here keeps its source's own ids and may use BPMN the interpreter does not implement " +
      "(message events, timers, multi-instance calls).",
    title: "Business processes",
    renderable: false,
    holds: "content",
    schema: "external-schemas/omg-bpmn-2.0.json",
    validatorNotApplicable:
      "its nodes are `.bpmn` files — XML, which a Zod schema cannot parse; `xml-comment-check` grades them, " +
      "and the processes viewer reports any that will not load.",
    summary: "BPMN that describes work as content (a guideline's business processes), drawn by the processes viewer and never run.",
  },
  scenarios: {
    kgContent: true,
    anyLayer: true,
    description:
      "Actors, the Roles they take on, and the User Stories those Roles serve. `roles.json` and `stories.json`; a User Story points at its Role (#1168), where it was once free text on the role. Split out of `cat-harness` on 2026-09-21.",
    title: "Scenarios",
    renderable: false,
    // Actors, the Roles they take, and the User Stories those Roles serve.
    //
    // `roles.json` and `stories.json`. A User Story points at its Role
    // (#1168); it was `Role.useCases`, free text on the role, until then —
    // the gap this kind was named ahead of, so that fixing it needed no rename.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    // bootstrap's own sentence, read rather than restated (bean r3gy, D1).
    summary: BOOTSTRAP_GRAPH_TYPOLOGIES["scenarios"],
  },
  // ── Journeys: user scenarios told as journey maps ──────────────────────
  //
  // Owner, 2026-11-05 (option A): "a specialized viewer of a journey. should
  // be able to see all journeys in repo, each individual journey and journeys
  // in subgraphs", with smart-trust-demo and smart-ips-pilgrimage as content
  // layers. Promoted from smart-trust-demo's draft (bean
  // smart-trust-demo-kg01, gaps 1 and 2). `content`: a journey is authored and
  // true whether or not anything reads it. Its own kind rather than a family
  // of bootstrap's `scenarios`, because it has its own viewer
  // (`journeys-viewer`) and a directory of it is what that viewer covers.
  "user-scenario": {
    anyLayer: true,
    // A journey IS a DAK user scenario (owner, 2026-11-06, option A): its
    // personas are actors, the DAK's roles, derived (`dakUserScenario`).
    specialises: "user-scenario",
    description:
      "user scenarios told as journey maps (`scenarios/user-scenarios/`, by convention): one `user-scenario/0.4.0` file per journey (`0.1.0` to `0.3.0` files are read unchanged). A journey IS a DAK user scenario (`specialises`): it keeps the DAK `UserScenario` fields (`id`, `title`, `description`, `personas`), its personas being actors (or roles) from which the DAK's roles are derived, and a file with only those is a plain DAK user scenario. It adds the ordered steps: per actor what they do and feel (emotion -2..2), the pain point and enabler, the policy point, how far the record can be trusted (a code of the scenario's `trustLadder` code list), the hand-off, what-ifs and gaps, and edges to user stories, BPMN tasks (`realisedBy`), `req:` requirements, FHIR examples, the building blocks it `uses`, each in its role, and the DAK assets it uses (`dak`: its data sets, decision tables and indicators, by artefact-index key). A parent lists its `parts` in story order (each may be `optional` or `repeats`, and a journey may be a part of several); a step that IS another journey says `includes`, checked against the call activity its `realisedBy` names. `follows` chains journeys no parent lists; `partOf` is read in older files. A step's `lead` and `experiences` default to the actors who play the lanes of its `realisedBy` tasks. A step may carry an `illustration` (an image, or the prompt to draw it), with the style and cast the scenario's `illustrationStyle` shares. The catalogue those `uses` edges point into is the `building-blocks` kind; a trust ladder is a code list, kept in a `code-list` directory. Every reference a step names must resolve (`check:journey-refs`). Drawn by the journeys viewer. Shapes in `schemas/process/user-scenario.ts`.",
    title: "User scenarios",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `tool-release`.
    schema: "schemas/process/user-scenario.ts",
    // Every family listed: declaring `nodeSchemas` claims the map is complete.
    // The validators are this layer's `validators/user-scenario*.json`, each naming a node
    // kind. A trust ladder is a code list, so it lives in a `code-list`
    // directory; a building-block catalogue is the `building-blocks` kind.
    nodeSchemas: {
      "user-scenario/0.1.0": {},
      "user-scenario/0.2.0": {},
      "user-scenario/0.3.0": {},
      "user-scenario/0.4.0": {},
    },
    summary:
      "User scenarios as journey maps -- one file per journey: ordered steps, per actor what " +
      "they do and feel, pain points, enablers, the record's trust state, and edges to user " +
      "stories, BPMN tasks, requirements, FHIR examples, the building blocks each step uses and its DAK assets; " +
      "a DAK user scenario, composed of other journeys in order.",
  },
  // The building blocks a journey step `uses`. Owner, 2026-11-05: the
  // catalogue lives in a layer's `archimate/` directory, read by its
  // ArchiMate overlay. A family of `user-scenario` could only be read from a
  // journeys directory, so it is a kind of its own, and a directory DECLARES
  // it: `archimate/building-blocks/`, declared inside the `archimate`
  // directory. Not `["archimate", "building-blocks"]` on `archimate/` itself:
  // every kind of a directory claims every typed node in it, so
  // `check:kind-validators` would call each kind's node unmapped under the
  // other. Readers ask for the kind, never the folder. `content`, as
  // `user-scenario`.
  "building-blocks": {
    anyLayer: true,
    description:
      "building-block catalogues: one `building-blocks/0.1.0` file per catalogue, its layers (each with the question it answers) and its blocks (a tool, a deployed system, a standard or a trust network, with its jurisdiction, owner, what it is and why it matters, the ArchiMate element keys that deploy it, and links). The target of a `user-scenario` step's `uses` edges, resolved by block id. Usually kept beside the instance's ArchiMate model, in a directory declared inside its `archimate` one (`archimate/building-blocks/`). Shape in `schemas/process/user-scenario.ts`.",
    title: "Building blocks",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `tool-release`.
    schema: "schemas/process/user-scenario.ts",
    nodeSchemas: {
      "building-blocks/0.1.0": {},
    },
    summary:
      "Building-block catalogues -- layers and blocks (tools, systems, standards, trust networks) " +
      "with their jurisdiction and what each is, the targets of a journey step's `uses` edges.",
  },
  // A workshop teaches from journeys and points at their step ids, so a
  // journey does not change when a workshop does (bean smart-trust-demo-kg01,
  // gap 3). `content`, as `user-scenario`.
  workshop: {
    anyLayer: true,
    description:
      "workshops over journeys (`workshops/`, by convention): one `workshop/0.1.0` file per workshop, holding its modules (the question each carries, learning objectives, the sheet it fills), reference tables a room fills or reads (decision rights, legal bases, substitution patterns, cost drivers: generic rows, named by each workshop), per journey step the questions for the room by module, the facilitator cue, the capabilities the step needs and which table rows it touches, the scales a capability is rated on, closing discussion questions, printable A3/A4 sheets, and job aids, handouts and readings. It points at `user-scenario` step ids, never the reverse. Drawn by the journeys viewer. Shape in `schemas/process/workshop.ts`.",
    title: "Workshops",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `tool-release`.
    schema: "schemas/process/workshop.ts",
    nodeSchemas: {
      "workshop/0.1.0": {},
    },
    summary:
      "Workshops over journeys -- modules, learning objectives, questions for the room per " +
      "journey step, reference tables, printable sheets, job aids and readings.",
  },
  // What one person sees on one device at a journey step (owner, 2026-11-06,
  // option A): a node of its own, so any journey can have screens without an
  // app of its own. It points at `user-scenario` step ids, never the reverse.
  // `content`, as `user-scenario`.
  "device-screen": {
    anyLayer: true,
    description:
      "device screens (`device-screens/`, by convention): one `device-screen/0.1.0` file per screen — what one person sees on one device (phone, tablet, scanner, desktop, kiosk) at one or more `user-scenario` steps. Its owner is an actor; its content is a list of typed, data-only blocks (header, person card, QR code, passcode, status badge, record list, fields, consent, alert, actions, note) with icons from a closed glyph list and no free HTML; a QR code or a record list may name the FHIR example it carries. Drawn by the journeys viewer as a static device mock, linked both ways with the walkthrough steps it shows. Shape in `schemas/process/device-screen.ts`.",
    title: "Device screens",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `tool-release`.
    schema: "schemas/process/device-screen.ts",
    nodeSchemas: {
      "device-screen/0.1.0": {},
    },
    summary:
      "Device screens -- what one person sees on one device at a journey step, as typed " +
      "data-only blocks (QR code, passcode, verdict, record list, consent), drawn as a device mock.",
  },
  // ── What an Actor may do: W3C ODRL 2.2 policies — issue #1180 ──────────
  //
  // Owner, 2026-09-23: permissions are *"W3C ODRL 2.2"*, and policies are
  // their own graph typology rather than a file inside `scenarios`. A policy is
  // authored, and is true whether or not anything reads it, so it `holds`
  // content like the role graph beside it: it owes no viewer.
  policies: {
    anyLayer: true,
    description:
      "What an Actor may DO: W3C ODRL 2.2 policies (issue #1180). One rule per (assignee, action), scoped by `cat-harness:process`, `cat-harness:task` and `cat-harness:role` constraints when it needs to be; actions are the profile in `skills/permissions/permissions.json`, inheriting through `includedIn`. A downstream instance inherits these with ODRL's `inheritFrom` instead of copying them. No login is ever written here: identity is the data store's.",
    title: "Policies",
    renderable: false,
    holds: "content",
    schema: "schemas/content/odrl.ts",
    // declared-path-literal: this table IS the declaration, as on `health`.
    summary:
      "W3C ODRL 2.2 policies: which Actor may do which action, scoped by Process, Task and Role " +
      "constraints. Actions are the folio profile in skills/permissions/permissions.json.",
  },
  // ── Judgement methodologies, one sub-graph each ───────────────────────
  //
  // A methodology is a NAMED, EXTERNAL way of reaching a judgement — Kepner-Tregoe
  // for a decision, MADR for its record, DMN for the computable case, GRADE for
  // certainty of evidence. They are **parallel, not composable**: which one applies
  // is contextual, and blending them produces a house method that cites nobody.
  //
  // ## Why its own kind rather than skills
  //
  // Three properties a skill does not have:
  //
  // 1. **Extractable.** A methodology is somebody else's work, adopted. If the
  //    field moves on, or a layer needs a different one, the directory lifts
  //    out and its declaration goes with it. A skill that had inlined the method
  //    could not be lifted — it would have to be rewritten.
  // 2. **Referenced, never inlined.** A skill names the methodology it follows;
  //    the method's own text lives here once. Two skills quoting the same method
  //    is two copies free to drift, which is the duplicate `directory-conventions`
  //    calls unchecked.
  // 3. **Not subject to skill criteria.** `skill-is-brief` caps a skill near 280
  //    lines because a skill is an instruction. A methodology is a FAITHFUL
  //    RENDERING of an external standard, and truncating it to fit a house limit
  //    would misrepresent the standard.
  //
  // Any layer may declare a directory of this kind: the harness carries the
  // domain-neutral ones, the DAK layer carries DIIG and core carries
  // Doc-Researcher. GRADE is not a methodology node: since 2026-09-24 (bean
  // `wg7r`) it is the `grade` skill with its vocabularies as code lists.
  methodology: {
    anyLayer: true,
    description:
      "judgement methodologies, one sub-graph each — a NAMED, EXTERNAL way of reaching a judgement, adopted whole. `kepner-tregoe` for a decision, `madr` for its record, `dmn` for the computable case, `grade` for certainty of evidence. They are **parallel rather than composable**: which applies is contextual, and blending them gives a house method that cites nobody. A separate kind from `cat-harness` for three properties a skill lacks — extractable (adopted work lifts out with its declaration when the field moves on), referenced rather than inlined (two skills quoting one method is two copies free to drift), and exempt from `skill-is-brief`, since a faithful rendering of an external standard must not be truncated to a house limit. Any layer may declare one: the harness carries the domain-neutral methods, `smart-kg` carries GRADE. Governed by [`methodology-adoption`](../../process/process-core/methodology-adoption.md).",
    title: "Methodologies",
    renderable: false,
    // `context`, by the axis's own criterion and not by resemblance: read
    // during a process, never written by one. A methodology here is somebody
    // else's standard ADOPTED — Kepner-Tregoe, MADR, DMN, GRADE — so a step
    // that decided to amend one would be rewriting the standard rather than
    // recording anything, and the ingestion that brings a new one in is a
    // human-directed act (`methodology-adoption`), exactly as relocating
    // something into `fsh-guts` is.
    //
    // NOT `content`, though the files are prose a reader can follow: what
    // makes `content` is being the folio's SUBJECT MATTER, and a methodology is
    // how a decision about the subject gets made. `renderable: false` above
    // follows from the same fact — nothing here is published as a page.
    holds: "context",
    validatorNotApplicable:
      "its nodes are markdown — 12 files, counted 2026-09-24. `check-methodology-evidence` grades what matters " +
      "about them, which is whether each cited source actually exists in a library.",
    summary:
      "Judgement methodologies, adopted whole and kept independent — parallel ways to reach a decision, selected by context.",
  },
  // THE ONE RENDERABLE KIND THE HARNESS OWNS, added 2026-09-20.
  //
  // This table carried no renderable kind until now, on the reasoning in
  // `folio-graph-typology.ts`: "a layer that cannot render must not own the
  // renderable kind." The owner's instruction changed the premise, not the
  // principle — cat-harness now ships a renderer:
  //
  //   "docs/ is about documentation about the KG itself ... docs/ in
  //    cat-harness ... only the most basic tooling and process ... builds off
  //    generic process and single justthedocs tool. no extensions. no fancy.
  //    no js (if possible)."
  //
  // So the rule reads, in its true form: A LAYER OWNS THE KINDS IT CAN RENDER.
  // The harness can render plain documentation about itself, and does. `folio`
  // stays core's because the harness cannot serve it — block viewers, LaTeX,
  // QA badges, translation overlays — and that is the same rule, not an
  // exception to it.
  //
  // A first attempt registered this on import, mirroring `folio`, so the
  // assertion "the harness's own vocabulary contains no renderable kind" could
  // stay literally true. That preserved a sentence at the cost of the design:
  // `folio` pays the side-effect-import price because it is CONTRIBUTED by a
  // dependency and may legitimately be absent, whereas `docs` ships with the
  // harness and can never be absent. Twenty consumers would have needed an
  // import for a kind that is always there. The test was updated instead,
  // which is what it means for a premise to have changed.
  //
  // THE BOUNDARY THIS MUST NOT CROSS: the subject, not the feature list. The
  // moment a `docs` page needs a block viewer, a LaTeX pass, a QA badge or a
  // translation overlay, it is describing authored CONTENT and is a `folio`.
  docs: {
    description:
      "documentation **about** the knowledge graph — how the harness works, what its directories hold, how a process runs. Distinct from `folio` by its SUBJECT, not its format. Added 2026-09-20: this table carried no renderable harness kind until the harness gained a plain just-the-docs renderer, and the rule reads in its true form — a layer owns the kinds it CAN render.",
    renderableNote: "the plain just-the-docs pipeline, no extensions",
    title: "Docs",
    perInstance: true,
    renderable: true,
    // THE FROM-WITHIN NODE (issue #1164; the owner's #980 ruling: nesting is
    // allowed when "a (Sub?)KGraph node within the first subdir labels all the
    // other ones that exist within it"). `docs/docs.json` names the sub-graphs
    // `docs/` holds — `proposals/`, `requirements/` — the way `beans/beans.json`
    // names `defs/` and `workflows/`. A root declaration reaching down into
    // `docs/proposals/` is the forbidden shape `check:layout-norms` refuses.
    declarationFile: "docs.json",
    // `content`, by the one question: a running process PRODUCES documentation,
    // and it is the subject rather than something read or written in passing.
    // Both supporting questions agree — detach a docs page and it still
    // explains, and you would RE-AUTHOR it rather than arrive at it by
    // re-running anything. Same layer as `cat-harness`, `schemas` and `voices`.
    holds: "content",
    serialised: false,
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-todo-index/v1": {},
      "folio-semantic-zoom/v1": {},
      "folio-qa-graph/v1": { shape: "cat-harness-tools:pipeline/qa-graph-index.ts#QaGraphIndex" },
      // A block or page manifest written as data rather than a `.ts` module
      // (bean `y9r6`): `{ builder, data }`, evaluated by calling the named
      // cat-harness builder, so the builder's own schema validates the data.
      "block-manifest/v1": { shape: "cat-harness-tools:pipeline/json-manifest.ts#JsonManifest" },
      // GENERATOR OUTPUT: the `translation:index` command writes the one file
      // of this family whole, `<site>/_data/translations.json`.
      "folio-translation-index/v1": { shape: "cat-harness-tools:pipeline/translation-index.ts#TranslationIndex", generated: true },
      // The site slices `gen-slice-sqlite.ts` (cat-harness-tools) writes under
      // docs/assets/slices/: one manifest per slice, and the index of slices.
      // Both are validated through their validator nodes
      // (`validators/slice-sqlite.json`, `validators/slice-index.json`).
      "folio-slice-sqlite/v1": { generated: true },
      "folio-slice-index/v1": { generated: true },
      "folio-bean-index/v1": { generated: true },
      "node-kind-index/1.1.0": { generated: true },
      "folio-translation-status/v1": { generated: true },
      "folio-schema-graph/v1": { generated: true },
      // GENERATOR OUTPUT: `processes:viz` writes one task-panel document per
      // process page, `docs/en/<instance>/processes/<stem>.tasks.json`, which
      // the page's task drawer fetches. Published since the processes pages
      // became built at publish, and unmapped here until now.
      "process-task-panel/v1": { shape: "cat-harness-tools:scripts/lib/task-panel.ts#PanelData", generated: true },
      "folio-library-index/v1": { generated: true },
      // The per-entry block graph, one file per library entry (bean `7nvr`).
      // Same writer as the index and deliberately a SEPARATE family: the index
      // answers "what entries are there" and this answers "what is in one",
      // and the corpus holds 1715 blocks over ~1 MB against a 44 KB index, so
      // they are fetched at different times by different questions.
      "folio-library-entry/v1": { generated: true },
      // The per-entry DOCUMENT view (issue #2302): TOC, pages, figures,
      // sections with summaries and keywords, checks — read from the
      // ingestion schema by lib/library-document.ts. Same writer again, and a
      // separate family for the same reason as the entry graph: fetched only
      // when one entry is opened.
      "folio-library-document/v1": { generated: true },
      "folio-voices-index/v1": { generated: true },
      "folio-graph-projection/v1": { generated: true },
      // The media-type sidecar beside each content-addressed payload under
      // docs/payload/sha256/ (bean `f233`), written by gen-subgraph-jsonld.
      // Its validator is the node `validators/payload-sidecar.json`.
      "cat-harness-payload/v1": { generated: true },
      // GENERATOR OUTPUT: the dynamic-state document `<site>/<harness>/state.jsonld`,
      // written whole by `writeDynamicState` (render stage 3 and the state
      // visualiser). It names the bean stores it read, so it is not prose.
      // Its validator is the node `cat-harness-tools/validators/dynamic-state.json`.
      "cat-harness-dynamic-state/v1": { generated: true },
    },
    summary:
      "Documentation ABOUT the knowledge graph — how the harness works, what its " +
      "directories hold, how a process runs. Rendered by the plain just-the-docs " +
      "pipeline. Distinct from `folio`, which is content an author CREATES using " +
      "the graph; the difference is the SUBJECT, not the format. An L1 library's " +
      "catalogue is `library/`; a note about it is a `folio`; the page explaining " +
      "how ingestion works is `docs`.",
  },

  // ── SUB-GRAPHS OF `docs` — issue #1164 ──────────────────────────────────
  //
  // A harness feature's documents move through two places, and the move is the
  // point: a PROPOSAL (initial analysis, MVP, options) is argued in
  // `docs/proposals/`, and when the feature ships it is FILED as its
  // requirements in `docs/requirements/`, checked against the bootstrap
  // `Requirement` schema. Two kinds rather than one `docs` with a status,
  // because a reader asking "what does the harness promise" must not be
  // handed arguments that were never agreed — the same reason `beans` does
  // not mix the work plan with instance state.
  proposals: {
    description:
      "proposals for the harness's own features — initial analysis, MVP, options — argued before they are agreed. A **sub-graph of `docs`** (`within: \"docs\"`), declared from within by `docs/docs.json`; the navbar folds it under Docs. Issue #1164.",
    renderableNote: "its pages are built by `docs`",
    title: "Proposals",
    // NOT a site of its own: its pages are built by `docs`, which it is
    // `within`. The harness still owns exactly one renderable kind.
    renderable: false,
    within: "docs",
    // `content`: authored argument, re-authored rather than regenerated.
    holds: "content",
    validatorNotApplicable:
      "its nodes are markdown pages of argument with no fixed shape; a proposal is judged by the owner, " +
      "not parsed. What IS checked mechanically is the move out of it: `check:requirements` refuses a slug " +
      "that sits in both proposals and requirements.",
    summary:
      "Proposals for the harness's own features — initial analysis, MVP, " +
      "options — argued before anything is agreed. A sub-graph of `docs`. When " +
      "the feature ships, its proposal is MOVED to `requirements` and filed " +
      "against the `Requirement` schema.",
  },
  requirements: {
    description:
      "what the harness promises, one page per shipped feature: a proposal MOVED here on ship, its front matter a `Requirement` (`bootstrap/schemas/requirement.schema.json`), checked by `check:requirements`. A **sub-graph of `docs`**, declared from within. Issue #1164.",
    renderableNote: "its pages are built by `docs`",
    title: "Requirements",
    // NOT a site of its own: its pages are built by `docs`, which it is
    // `within`. The harness still owns exactly one renderable kind.
    renderable: false,
    within: "docs",
    holds: "content",
    schema: "../bootstrap/schemas/requirement.schema.json",
    validatorNotApplicable:
      "its nodes are markdown pages whose FRONT MATTER is a `Requirement`. A registry validator parses a " +
      "JSON node, so one here would be a category error. `check:requirements` extracts the front matter " +
      "and parses it against the Requirement schema instead, and requires the id to match the file name.",
    summary:
      "What the harness promises, one document per shipped feature, each carrying " +
      "a `Requirement` in its front matter. A sub-graph of `docs`. Test runs point " +
      "at these statements by `req:<slug>#<key>`.",
  },
  // THE DOCS GRAPH'S NAMED GROUPS — owner, 2026-10-05 (bean `xka5`): *"group
  // cat-harness docs semantically and make named doc subgraphs"*. ONE kind for
  // every group, on the argument `docs/docs.json` already makes for its two
  // `auto-docs` entries: a sub-graph's identity is its DIRECTORY id, and a
  // kind per group would be a registry entry restating one sentence. Which
  // pages a group holds is its folder, so nobody keeps a list.
  "doc-group": {
    description:
      "a named group of the docs graph's own pages — Start here, Concepts, Authoring guides, Process & methodology, FHIR — one folder each, declared from within by `docs/docs.json`. A **sub-graph of `docs`** (`within: \"docs\"`): its pages are `docs` pages, grouped by where they live. The Pages list nests a group's pages under it through `_config.yml` `defaults` (one `parent` per folder). Bean `xka5`.",
    renderableNote: "its pages are built by `docs`",
    title: "Doc group",
    // NOT a site of its own: its pages are built by `docs`, which it is
    // `within` — the same reason `proposals` and `requirements` are false.
    renderable: false,
    within: "docs",
    // `content`: authored or generated pages of the docs site, grouped.
    holds: "content",
    validatorNotApplicable:
      "its nodes are the docs site's markdown pages, judged as `docs` pages are; a group adds a folder, not a shape.",
    summary:
      "A named group of the documentation's own pages — one folder, one heading in the Pages list. A sub-graph of `docs`.",
  },
  "auto-docs": {
    description:
      "derived indexes over the other graphs — one page per auto-doc TYPE crossed with each SUB-GRAPH that type reaches, written by `scripts/gen-auto-docs.ts` and never by hand. A **sub-graph of `docs`** (`within: \"docs\"`), declared from within by `docs/docs.json`; its own sub-sub-graphs are named one level further down by `auto-docs.json`, which is GENERATED from that script's `TYPES` because they carry `collect()` functions that cannot live in JSON. `derived`, and the question that settles it against its parent is the same one everywhere: a `docs` page is RE-AUTHORED, an index is REGENERATED. Bean `xsrv`, owner 2026-10-03.",
    renderableNote: "its pages are built by `docs`",
    // NOT a site of its own: its pages are built by `docs`, which it is
    // `within`. The harness still owns exactly one renderable kind — the same
    // reason `proposals` and `requirements` are false above.
    renderable: false,
    within: "docs",
    // THE FROM-WITHIN NODE, one level further down. `docs/docs.json` names
    // this kind as a sub-graph of `docs`; this file names ITS sub-sub-graphs,
    // one per auto-doc TYPE. The owner, 2026-10-03: *"auto-docs is one
    // declared subgraph, with declared sub-sub-graphs per writer."* Bean
    // `xsrv`.
    //
    // It is GENERATED, and that is load-bearing rather than incidental:
    // `gen-auto-docs.ts` already holds the types in `TYPES`, whose `collect()`
    // functions cannot live in JSON. A hand-kept copy would be a second answer
    // to "what auto-doc types exist", free to disagree the moment either
    // moves.
    declarationFile: "auto-docs.json",
    // `derived`, by the three questions `content-context-and-state-graphs`
    // asks. Does a process write it? YES — `gen-auto-docs.ts`, every build.
    // Does it stand on its own? NO — every page is an index OF another graph,
    // and detached from that graph it lists nothing. Regenerate or re-author?
    // REGENERATE, purely: there is no authored byte in any of these pages, and
    // deleting one costs a command rather than a decision.
    //
    // That last answer is what separates it from its parent. `docs` is
    // `content` because you would RE-AUTHOR a docs page; you would never
    // re-author an index, and an index somebody hand-edited is a defect rather
    // than a contribution — which is why the subject check refuses a generated
    // page (`check:docs-populated`) and why this arc keys the family by
    // `route` rather than by `tip`.
    holds: "derived",
    serialised: false,
    validatorNotApplicable:
      "its nodes are generated index PAGES — HTML and markdown with no fixed JSON shape — so a registry " +
      "validator would be a category error, as on `proposals`. What is checked mechanically is the " +
      "derivation instead: `auto:docs:check` fails on a stale page, and refuses outright when a type " +
      "collects nothing while its graph's directories hold files, which is a moved source rather than an " +
      "empty graph (bean `06e3`).",
    summary:
      "Derived indexes over the other graphs — one page per auto-doc TYPE crossed with each SUB-GRAPH " +
      "that type reaches. A sub-graph of `docs`, written by `scripts/gen-auto-docs.ts` and never by hand. " +
      "Distinct from `docs` itself by the one question that settles the layer: a docs page is re-authored, " +
      "an index is regenerated.",
  },
  notes: {
    description:
      "a folio's derivation notes, cheat sheets, scoping docs and recorded refutations — declared context read by agents and never written by a process, not rendered content. Distinct from `docs` by not being renderable, and from `todos` by holding context rather than outstanding work. Downstream math and derivation notes from qou (migration S-REST-1, qou-pjfi).",
    title: "Notes",
    perInstance: true,
    renderable: false,
    holds: "context",
    validatorNotApplicable:
      "its nodes are markdown and LaTeX derivation notes, scoping docs, cheat sheets and ledgers with no fixed JSON schema; read as context by agents and never written by a process.",
    summary:
      "A folio's derivation notes, scoping docs and ledgers as declared context, not rendered content.",
  },
  "external-schema": {
    description:
      "the specifications this instance depends on (`external-schemas/`) — one record per specification, pinning the EDITION in use, with the operative terms DERIVED from the corpus rather than hand-listed. `content`, and the call goes against the obvious reading: a process DOES write these files (`external-schemas.ts --write` refreshes `terms[]`), which sounds like `state`, but the axis asks what the graph IS and the subject matter here is a DECISION — which specifications we depend on, at which edition, and what each term operatively means. `derived` would be destructive: it says \"regenerate it\", and regenerating a deleted record recovers neither the authored edition, nor the `usedBy` blast radius, nor a line of the `operative` prose. UNDECLARED until 2026-09-22, which is `dh4f` inverted — a held directory nothing declares, so every consumer fanning out over declared directories skipped a registry pinning four external namespaces. Governed by [`vocabulary-authority`](../kg-core/vocabulary-authority.md) and [`schema-management`](../kg-core/schema-management.md).",
    title: "External schemas",
    perInstance: true,
    renderable: false,
    // `content`, and the call is against the obvious reading. A process DOES
    // write these files — `external-schemas.ts --write` refreshes each
    // record's `terms[]` from the corpus — which sounds like `state`. It is
    // not, because the axis asks what the graph IS, and the subject matter
    // here is a DECISION: which specifications this layer depends on, at
    // which edition, and what each term operatively means. A person makes
    // that; the deriver only keeps one field of it honest.
    //
    // `derived` would be worse than wrong, it would be destructive: it says
    // "regenerate it", and regenerating a deleted record cannot recover the
    // authored edition, the `usedBy` blast radius, or a line of the
    // `operative` prose. The writer preserves those precisely because they
    // are not derivable (`prior.get(term)` in the `--write` path).
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    // A SECOND family in the same directory — bean `7wou`. A record pins an
    // edition; this is that edition's CONTENT, snapshotted so
    // `check:term-mapping`'s fhir half can assert "this code is in the
    // published IG at version X" offline. The directory is a place to look
    // and the file declares what it is, which is why `loadSpecs` now reads
    // `$schema` instead of parsing every `*.json` as a record.
    // BOTH families are listed. Declaring `nodeSchemas` at all makes this the
    // complete account of the directory, so the record's own family has to
    // appear beside the new one — `check:kind-validators` reports an unlisted
    // family as unmapped, which is the right answer and the reason the
    // kind-level `validator` above is not a fallback.
    nodeSchemas: {
      "folio-external-schema/v1": {},
      "folio-pinned-terminology/v1": {},
    },
    summary:
      "The specifications this instance depends on — one record per specification, pinning the " +
      "EDITION in use, with the operative terms derived from the corpus rather than hand-listed; " +
      "and, beside a record, the pinned edition's own codes where something resolves against them.",
  },
  // Code lists — a closed set of codes, each with a label, a definition and a
  // source, published as a SKOS concept scheme (schemas/library/code-list.ts). Owner,
  // 2026-09-23: "list of codes and corresponding narrative desc and source
  // should be part of a node/asset". `content`, by the same argument
  // `external-schema` makes: the subject matter is a DECISION — which answers
  // an adjudication may give, which namespaces are ours — and a person makes
  // it. Diagrams and `schemas/kg/namespaces.ts` READ these; nothing writes them.
  "code-list": {
    description:
      "closed sets of codes (`code-lists/`) — one `folio-code-list/v1` file per list, each code with a label, a definition, a source and, where it stands for one, a value; published as SKOS concept schemes. `content`, by the same argument as `external-schema`: the subject matter is a DECISION — which answers an adjudication may give, which namespaces are ours — and a person makes it. Diagrams (`<cat-harness.processes:adjudication list>`) and `schemas/kg/namespaces.ts` READ these. Owner, 2026-09-23. Governed by [`code-lists`](../../library/library-core/code-lists.md).",
    title: "Code lists",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    summary:
      "Closed sets of codes — adjudication answers, the namespaces this project mints — one file " +
      "per list, every code carrying its definition and source, published as SKOS.",
  },
  // Vocabulary mappings — one value carried into several target vocabularies,
  // declared as data rather than as a line in a generator
  // (schemas/content/vocab-mapping.ts). Bean `k74z`, owner 2026-10-02: option 1 of
  // `docs/proposals/vocabulary-mappings-2026-10-02.md`. `content`, by the
  // `code-list` argument: which predicate a field becomes, and which of two
  // is authoritative, is a DECISION somebody makes. Generators read these
  // through the `vocab-map` Tool; nothing writes them.
  "vocab-mapping": {
    description:
      "vocabulary mapping tables (`vocab-mappings/`) — one `folio-vocab-mapping/v1` table per source content type and target node, saying which source field becomes which target predicate and with what relationship. Shaped like a FHIR ConceptMap: an existing ConceptMap is representable here, and a table can be produced as one with every loss reported (the FHIR IG layer's `schemas/vocab-mapping-fhir.ts`). `content`, by the `code-list` argument: which predicate a field becomes, and which of two is authoritative, is a DECISION. Generators READ these through the `vocab-map` Tool; nothing writes them. Owner, 2026-10-02 (bean `k74z`). Governed by [`vocabulary-authority`](../kg-core/vocabulary-authority.md).",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    summary:
      "Vocabulary mappings — which source field becomes which target predicate, with its stated " +
      "relationship, one ConceptMap-shaped table per source and target; representable from and " +
      "producible as a FHIR ConceptMap.",
  },
  schemas: {
    tileIcon: "schemas",
    description:
      "schema definitions, self-declared in the WHO SMART Base manner",
    title: "Schemas",
    // Grouped by concern from within (`schemas/schemas.json`), PR0c.
    declarationFile: "schemas.json",
    concernGroups: true,
    renderable: false,
    // A shape is the subject matter of the schema graph. It is true before
    // anything is validated against it.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      // The FROM-WITHIN node naming this directory's concern groups
      // (placement PR0c): `concern-groups/v1`.
      "concern-groups/v1": {},
      "http://json-schema.org/draft-07/schema#": { external: "JSON Schema draft-07" },
      "https://json-schema.org/draft/2020-12/schema": { external: "JSON Schema 2020-12" },
      "folio-source-descriptor/v1": {},
      // ArchiMate's relationship table, `archimate/schemas/archimate-relationships.json`
      // (cat-harness-tools#1064): data the metamodel check reads, held beside its schema.
      "archimate-relationship-table/v1": {},
    },
    // bootstrap's own sentence, read rather than restated (bean r3gy, D1).
    summary: BOOTSTRAP_GRAPH_TYPOLOGIES["schemas"],
  },
  // UML renderings of the declared sub-graphs — one `.puml` and one `.mmd`
  // per named sub-graph and per layer, both written from one model by
  // `scripts/gen-uml-overview.ts`. `derived`: regenerated, never authored, so
  // a finding against one is a finding against the generator or its inputs.
  uml: {
    description:
      "UML class diagrams of every named sub-graph a harness declares (`uml/overview/<instance>/<sub-graph>.puml` and `.mmd`), written from one model by `scripts/gen-uml-overview.ts` and rendered on `docs/uml/overview/`. The groupings are the declaration entries; the classes are read from each graph typology's registered `validator`, so a kind with none is drawn as *could not determine*. `derived`: regenerated, never authored.",
    title: "UML",
    // Grouped by concern from within (`uml/uml.json`), PR0c — one generated
    // pair per declared sub-subgraph, so the grouping is the generator's input.
    declarationFile: "uml.json",
    concernGroups: true,
    // No `nodeSchemas` entry for its `concern-groups/v1` file: this kind
    // states `validatorNotApplicable`, and the two are exclusive. That one
    // file is graded by `check:concern-groups`, which parses it with
    // `ConcernGroupsSchema`.
    renderable: false,
    holds: "derived",
    // declared-path-literal: this table IS the declaration, as on `health`.
    // Generated: the generator is where the shape of a diagram is written down.
    schema: "scripts/gen-uml-overview.ts",
    validatorNotApplicable:
      "its nodes are `.puml` and `.mmd` — PlantUML and Mermaid source, counted 2026-09-24 as 103 and 101. Not " +
      "JSON, and `derived` besides, so a finding against one is a finding against the generator; " +
      "`uml:overview:check` grades their currency.",
    summary:
      "UML class diagrams of each named sub-graph a harness declares, derived from the node schemas " +
      "its graph typologies register — PlantUML and Mermaid from one model.",
  },
  // The PUBLISHED PROJECTION of QA verdicts, not the verdicts themselves.
  //
  // Declared as its own kind rather than folded into `kg` because the two are
  // different artefacts with different owners: a verdict lives beside its
  // subject and is what a checker wrote, while a witness is that verdict
  // flattened for the web and is what the docs panel fetches. One is edited by
  // fixing a checker; the other is never edited at all.
  //
  // Undeclared until 2026-09-19 — 134 committed files that no layer
  // declaration mentioned, so a consumer scanning the declared directories saw
  // none of them and reported a clean run over the lot.
  qa: {
    description:
      "QA verdicts and their projections under `test/results/` — **seven `$schema` families**, each named in the kind's `nodeSchemas` (see §\"Node schemas, one per `$schema` family\"): `kg-qa/v1`, `block-qa/v1` and `folio-test-run/v1` are Zod-validated, `qa-witness/v1`, `qa-results/v1` and `translation-qa/v1` are TypeScript shapes, and `folio-qa-index/v1` has no declared type at all. This row said \"one `qa-witness/v1` document per subject\" until 2026-09-23, when 591 of the 728 nodes were other families. Generated, never hand-edited. **The checkout holds the WORKING COPY; the record is on the orphan `qa-reports` branch**, keyed `main/<sha>/` or `pr/<n>/<sha>/`, written by the CI job `qa-publish` through `scripts/qa-store.ts` (arc `3fva`) — see §\"`storage` — a directory kept on a branch\". Judgements are not here: they are the `attestations` kind. Read witnesses with the [`qa-witness`](../../../sdlc/skills/sdlc-core/qa-witness.md) skill.",
    title: "QA",
    perInstance: true,
    renderable: false,
    // A verdict is where a REVIEW got to on a subject that lives elsewhere.
    // Detached from the artefact it judges it says nothing — which is the
    // state test, and it is why the sidecar tree MIRRORS each subject's path.
    holds: "state",
    recordsWork: false, // live state, but nothing anybody is partway through
    summary:
      "QA verdicts and their projections — kg-qa audits, block and translation QA, " +
      "qa-witness documents for the docs site, the viewer-navbar audit, result roll-ups " +
      "and test runs; every `$schema` family is named in `nodeSchemas`, which is the list " +
      "— a count here would be a second one, and it was already wrong by one before " +
      "`viewer-nav-qa/v1` was added. Generated; never hand-edited.",
    schema: "schemas/kg/qa-record-shapes.ts",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "kg-qa/v1": {},
      // The auditor's identity for the `kg-qa/v1` files beside it — one per
      // layer, not one per sidecar, for the reason `KG_QA_MANIFEST_SCHEMA`
      // gives. Registered under `skills` until 2026-09-27, because the file
      // lived in `skills/`; it moved to `test/results/` when auditing every
      // layer made the old home CREATE a skills directory holding no skills,
      // and this registration had to move with it. A kind claiming a `$schema`
      // whose files live in another kind's directory is a validator aimed at
      // nothing.
      "kg-qa-manifest/v1": {},
      "block-qa/v1": {},
      "folio-test-run/v1": {},
      "qa-witness/v1": { shape: "schemas/kg/qa-record-shapes.ts#QaWitness" },
      "qa-results/v1": { shape: "schemas/kg/qa-record-shapes.ts#QaResult" },
      // Per-checker freshness sidecars (`<criterion>.script.json`), written by the
      // QA sweep; validated by `validators/qa-script.json` (the block-qa schema package's Zod).
      "qa-script/v1": { generated: true },
      "translation-qa/v1": { shape: "schemas/kg/qa-record-shapes.ts#TranslationBlockQaReport" },
      // Written inline by two call sites and typed by neither — recorded,
      // not invented. `qa-graph-index.ts` names the tag only to say it is
      // NOT its own (`NOT_TO_BE_CONFUSED_WITH`).
      "folio-qa-index/v1": { generated: true },
      // Which authored pages have a translation projection (bean `4l4d`) —
      // the list `head_custom.html` once read from `_data/`, now an asset.
      "folio-qa-translation-pages/v1": { generated: true },
      // The detangle sidecars, in cat-harness
      // qa directory. `detangle` was its own layer until 2026-09-23 and is
      // now a directory of this harness (bean `byql`), so the shape is an
      // ordinary instance-relative path under `schemas/` and needs no `detangle:` qualifier.
      "folio-detangle-sidecar/v1": { shape: "schemas/kg/detangle-sidecar.ts#DetangleSidecar" },
      // The per-graph LSI index sidecar (bean `ansc`): fingerprint, pole terms,
      // neighbours and findings — never the vectors.
      "folio-lsi-index/v1": { shape: "schemas/kg/qa-record-shapes.ts#LsiSidecar" },
      // A downstream tool's run record (bean `fq5u`): outcome and input
      // fingerprint, read by kg:audit's `tool-downstream-fresh`.
      "folio-tool-run/v1": {},
      // The viewer-navbar audit (bean `edx7`). A VERDICT PER PAGE rather than
      // a count, because the owner's rule has two clauses -- present unless
      // EXPLICITLY removed -- and a count cannot tell a deliberate removal
      // from a generator nobody wired.
      "viewer-nav-qa/v1": {},
    },
    // No `validator`, and that is a finding rather than an omission: the
    // module above exports TypeScript interfaces only. The largest generated
    // graph in this layer has no runtime schema, so `kg_validate` reports
    // "could not determine" for it — which is the point of saying so here.
  },
  // Repository health reports — what the daily sweep under `test/health/`
  // wrote. A SEPARATE kind from `qa`, and the distinction is the same one that
  // separates `qa` from `cat-harness`: a QA verdict judges an ARTEFACT this
  // repository produced, against criteria that artefact is supposed to meet. A
  // health report judges the REPOSITORY ITSELF — how big it has grown, how
  // much of the publish branch the review previews occupy, whether the work
  // plan has duplicates in it. Nothing it reports is a defect in a file, and
  // no criterion it applies belongs to a subject. Folding it into `qa` would
  // put "the .git directory is 354 MB" beside "this lane binds no role" and
  // leave a consumer asking for verdicts about its content holding a fact
  // about its clone.
  //
  // No `skill`, deliberately: none of the skills in this layer says how to
  // READ a health report, and naming one that does not exist is the
  // fake-reference failure `activity-names-skill` is written to prevent. The
  // field is optional and absent means absent.
  health: {
    description:
      "repository health reports — one `\"$schema\": \"health-report/v1\"` document per sweep, carrying each check's three-state verdict, the thresholds it applied and the **basis** each threshold was chosen on. A separate kind from `qa` because the SUBJECT differs, not the producer: a QA verdict judges an artefact this instance produced, a health report judges the instance itself — its size, its publish branch, its work plan. Generated by `test/health/run.ts`; never hand-edited. Shape in `schemas/sdlc/health-report.ts`.",
    title: "Health",
    renderable: false,
    // The same shape one level out: where the REPOSITORY got to, measured
    // against thresholds. A report is evidence about a layer, never part
    // of it.
    holds: "state",
    recordsWork: false, // live state, but nothing anybody is partway through
    summary:
      "Repository health reports — one `health-report/v1` document per sweep, carrying every check's " +
      "three-state verdict, the thresholds it applied and the basis each threshold was chosen on. " +
      "Generated by `test/health/run.ts`; never hand-edited.",
    schema: "schemas/sdlc/health-report.ts",
    // declared-path-literal: this table IS the declaration. `validator` is the
    // vocabulary entry that other code resolves THROUGH; reading it from a
    // declaration would be reading it from here. `check:kind-validators`
    // is what proves the path still resolves.
  },
  // QA ATTESTATIONS — the judgement half of a QA verdict (bean `2gst`, arc
  // `3fva`). Split out of the `qa` kind by owner ruling D2 (a), 2026-10-01:
  // derived script verdicts move to the `qa-reports` branch, and every
  // non-script verdict stays on main. A `kg-qa/v1` sidecar used to carry its
  // `pair_attestations` and `voice_reviews` beside script verdicts, so moving
  // the file would have taken the judgements with it — and every reader read
  // an absent sidecar as "never attested" and re-baselined (defect C4 of the
  // reader audit). A SEPARATE kind, not a `nodeSchemas` row under `qa`,
  // because the two answer different questions about deletion: a `qa` file can
  // be regenerated from the tree, an attestation cannot.
  //
  // `state` by the one question, the same answer `review-verdicts` gives: a
  // running audit WRITES it (a first-sight baseline, an attestation that moves
  // with the prose), and detached from the subject it judges it asserts
  // nothing. `recordsWork: false` — a judgement is finished, not in flight.
  //
  // ONE layout for every family — bean `8wj1` (block-qa, translation-qa) is a
  // member of the same `QaAttestationsSchema` union, not a second store:
  // `<attestations dir>/<family>/<mirrored subject path>.attestations.json`.
  attestations: {
    description:
      "the JUDGEMENT half of a QA verdict, kept apart from the derived half: one `qa-attestations/v1` file per subject at `test/attestations/<family>/<mirrored subject path>.attestations.json`, where `<family>` is the derived family it sits beside (`kg-qa`, bean `2gst`; `block-qa` and `translation-qa`, bean `8wj1` — whose derived reports keep a projection composed from the store; `bib-verification` and `bib-human-review`, the folio's two bibliography judgement ledgers, one file per reference, read and written only through `schemas/library/bib-attestations.ts`). Split out of `qa` by owner ruling D2 (a), 2026-10-01 (bean `2gst`): derived verdicts move to the `qa-reports` branch, and judgements stay on main, where a `git rm` of derived results cannot reach them. A separate kind because the two answer the deletion question differently: a `qa` file can be regenerated, an attestation cannot. Every entry pins the hash it attested, so a stale one is detectable. `state`, like `review-verdicts`. Reads answer hit / miss / absent / corrupt / unknown. On a miss or an absent store a WRITER moves the judgements a prior derived file still carries into the store as it saves (owner ruling 2, 2026-10-01); a corrupt or unreadable store is `unknown` and refused. Shape in `schemas/sdlc/qa-attestations.ts`.",
    renderable: false,
    holds: "state",
    recordsWork: false,
    summary:
      "QA attestations — the judgements a QA family carries across runs (pair attestations, voice " +
      "reviews, agent and human verdicts, bibliography verifications and human reviews), one `qa-attestations/v1` file per subject, mirroring the " +
      "derived family's tree. Kept on main where deleting derived results cannot reach them; each " +
      "entry pins the hash it attested, so a stale one is detectable.",
    schema: "schemas/sdlc/qa-attestations.ts",
    // Every family's file is one `qa-attestations/v1` node (`QaAttestationsKind`,
    // named by cat-harness's `validators/qa-attestations.json`), so each has
    // an IRI, a JSON-LD document and a page (owner, 2026-11-13, node-kind audit).
    nodeSchemas: {
      "qa-attestations/v1": {},
    },
    // declared-path-literal: this table IS the declaration, as on `health`.
  },
  // Source code. Registered 2026-09-22 (bean `ylj7`) after a measurement the
  // owner asked for: of roughly 1,216 `.ts` files in this repository, about
  // 180 sat inside a DECLARED directory. Roughly 85% of the code was in no
  // declared directory at all -- `scripts/`, `content/`, `src/`, `test/` and
  // `adapters/` among them.
  //
  // That is the `v8gh` property, which everything else here already relies on:
  // AN UNDECLARED FILE IS ONE NO CHECKER HAS A REASON TO LOOK AT. A QA axis
  // asking "is this code claimed by a Tool node?" was being asked over 15% of
  // the code while reporting a clean run over the rest, which is `dh4f` in its
  // most expensive form.
  //
  // THE OWNER'S FIRST PROPOSAL WAS A SINGLE `<stub>/src`, and the measurement
  // is what argued against it as a DESTINATION while confirming it as a
  // MECHANISM. Three of the four sources resist a move for different reasons:
  // `schemas/` is already a declared graph (a schema IS a knowledge-graph
  // node), `content/pipeline/` is core's subject so moving it under
  // cat-harness crosses the boundary `repo-partition.ts` enforces, and
  // `scripts/` are entry points named BY PATH in package.json and the CI
  // workflows -- which `check:ci-invocations` and `check:command-paths` guard.
  // So: declare them where they are, and keep `<stub>/src` as the convention
  // for NEW layers.
  //
  // `content` by the one question: somebody authors it, with an intention, and
  // you would re-author rather than regenerate it. It stands on its own -- a
  // module still computes when detached from everything that calls it.
  //
  // NOT renderable, and that is the interesting call. Code is legible and this
  // repository does publish views of it, but `renderable` asks whether the
  // graph is wired to the SITE BUILD as pages, and it is not: the generated
  // references are built from schemas and skills, not from the code graph.
  // Saying `true` here would promise a page for every module.
  //
  // It does NOT answer "is this code claimed". That is a second, separate
  // question -- declared but bound to no Tool node -- and beans `d308` and
  // `ce65` own it. Reporting the two as one number is how the cheap one never
  // gets done.
  code: {
    anyLayer: true,
    description:
      "Source code — the modules, scripts and entry points an instance holds. Registered 2026-09-22 (bean `ylj7`) after a measurement: most of this repository's `.ts` files sat in no declared directory — **re-derive it with `bun run cat check:code-accounting` rather than reading a number here, because it moves every round** — " +
      "so the one property every checker here depends on — *an undeclared file is one no checker has a reason to look at* (`v8gh`) — did not hold for most of the code. The owner's first proposal was to move everything under `<stub>/src`; the measurement confirmed the **mechanism** and argued against the **destination**, because `schemas/` is already a declared graph, `content/pipeline/` is core's subject, and `scripts/` are entry points named **by path** in `package.json` and CI. So they are declared where they are, and `<stub>/src` is the convention for new instances. `content`: authored with an intention, re-authored rather than regenerated, and it stands on its own. **Not renderable** — `renderable` asks whether the graph is wired to the site build as pages, and the generated references are built from schemas and skills, not from this. Being declared says nothing about whether a Tool node **claims** the code; that is a second axis, and beans `d308` and `ce65` own it. `check:code-accounting` reports both and refuses to average them.",
    title: "Code",
    // Grouped by concern from within (`<dir>/code.json`), PR0c — for the TEST
    // directories first: unit tests in `scripts/tests/<group>/`, e2e in
    // `test/<group>/` (owner ruling 5, 2026-09-30: "split along same semantic
    // lines as skills"). `code` rather than a new `tests` kind: a test file is
    // code, and the grouping is a fact about location, not a new kind.
    declarationFile: "code.json",
    concernGroups: true,
    // No `nodeSchemas` entry for its `concern-groups/v1` file: this kind
    // states `validatorNotApplicable`, and the two are exclusive. That one
    // file is graded by `check:concern-groups`, which parses it with
    // `ConcernGroupsSchema`.
    renderable: false,
    holds: "content",
    serialised: false,
    validatorNotApplicable:
      "its nodes are TypeScript — 1793 files, counted 2026-09-24. `tsc` is the validator for code, and " +
      "`check:partition` plus `check-code-accounting` grade the graph over it.",
    summary:
      "Source code -- the modules, scripts and entry points an instance holds. Declared so that " +
      "code is scannable at all: an undeclared file is one no checker has a reason to look at. " +
      "Being declared here says nothing about whether a Tool node claims it, which is a separate " +
      "question and a separate axis.",
  },
  // QA reports -- what a pipeline TOOL recorded about its own run. The FIFTH
  // QA-shaped family here, and a separate kind for the same reason `health` is
  // separate from `qa`, one step further out: a `qa` witness judges an
  // ARTEFACT, a `health` report judges the REPOSITORY, and a `qa-report`
  // records an EXECUTION. Folding it into `qa` would put "this script
  // processed 198 files and expected 199" beside "this lane binds no role",
  // and hand a consumer asking for verdicts about content a fact about a
  // subprocess.
  //
  // Registered on the owner's ruling, 2026-09-22, and on evidence rather than
  // design: every DAK pre/post script already writes exactly this document and
  // the Publisher already writes `qa.json`, and NOTHING DOWNSTREAM READS
  // EITHER. The shape is what they emit, down to upstream's snake_case field
  // names -- `schemas/sdlc/qa-report.ts` says why renaming them would be a place
  // for producer and consumer to drift silently.
  //
  // `state` by the one question: a running process WRITES it. It is the same
  // shape as `health` one level in -- where a RUN got to, rather than where
  // the repository got to -- and `derived` was considered and rejected: a
  // derived graph is regenerated from a source that still exists, while
  // re-running a tool produces a DIFFERENT report rather than the same one
  // again.
  //
  // `recordsWork: false` -- live state, but nothing anybody is partway
  // through. A half-written report is not work in progress; it is a run that
  // died, which `qaReportVerdict` reports as `unknown` rather than as clean.
  "qa-report": {
    description:
      "QA reports — one `qa-report/v1` document per TOOL RUN, carrying that run's own successes, warnings and errors, the files it processed, the files it **expected** and the ones that were missing, plus the provenance and toolchain versions upstream records nowhere. A third subject beside its two neighbours, and that is the whole reason it is a separate kind: a `qa` witness judges an **artefact**, a `health` report judges the **repository**, a `qa-report` records an **execution**. Registered 2026-09-22 on evidence rather than design — every DAK pre/post script already writes exactly this document and the IG Publisher already writes `qa.json`, and nothing downstream read either. Upstream's snake_case field names are kept deliberately, so an upstream report validates byte for byte and a change upstream fails instead of being quietly re-mapped. `state`: a running process writes it. Three rules are structural rather than left to a checker — a summary may not disagree with the details it counts, `files_missing` must be a subset of `files_expected`, and `running` is never a pass. Shape in `schemas/sdlc/qa-report.ts`.",
    title: "QA reports",
    renderable: false,
    holds: "state",
    recordsWork: false,
    summary:
      "QA reports -- one `qa-report/v1` document per tool run, carrying the tool's own " +
      "successes, warnings and errors, the files it processed, the files it EXPECTED and " +
      "the ones that were missing, plus the provenance and toolchain versions upstream " +
      "records nowhere. Generated by the run; never hand-edited.",
    schema: "schemas/sdlc/qa-report.ts",
    // declared-path-literal: this table IS the declaration, as for `health`.
  },
  // Test plans -- what a SYSTEM UNDER TEST must do, case by case, and the DMN
  // rule that decides whether it did. Strawperson, bean `ygzh` (arc `3fva`,
  // proposal §3.2), shaped after the held FHIR R5 TestPlan source.
  //
  // `content` by the one question: a running process READS a plan and never
  // writes it -- the tester resolves it, the certifier applies its
  // `exitCriteria` -- and somebody authors it with an intention. It also
  // passes both supporting questions: detached from every run it still says
  // what is required, and you would re-author it rather than regenerate it.
  // NOT `context`, the near miss: `context` is a record ABOUT content, read
  // at session start; a plan is the subject matter of a certification, as a
  // skill is of an agent's work. That is also why the run points at the plan
  // and never the reverse -- a plan listing its runs would be rewritten by
  // every execution, which is content turned into state.
  //
  // NOT renderable: `renderable` asks whether the graph is wired to the SITE
  // BUILD, and nothing in the docs build reads a plan. Saying `true` would
  // promise a page per plan that no generator makes.
  //
  // Declared, no directory: nothing authors a plan yet. Plan #1 is
  // `crdm-detect` (§3.3), and no fixture was manufactured to make a count
  // non-zero -- the row `qa-report` and `binary-release` also carry.
  "test-plan": {
    description:
      "test plans — one `test-plan/v1` document per plan, shaped after the held FHIR R5 TestPlan source: the system-under-test kind and version range, the `req:` requirements it is evidence for, test cases whose assertion ids are criterion ids, test data that is either FIXED (committed, and evidence once reviewed) or GENERATED (template + params + seed, never stored materialised — bean `vm6m`), and the certification rule as a DMN reference. Strawperson, bean `ygzh`. `content`: a process reads a plan and never writes it, and it still says what is required when detached from every run. The run points at the plan and never the reverse, because a plan listing its runs would be rewritten by every execution. Declared, no directory. Shape in `schemas/sdlc/test-plan.ts`.",
    renderable: false,
    holds: "content",
    summary:
      "Test plans -- one `test-plan/v1` document per plan, in the FHIR R5 TestPlan shape: the " +
      "system-under-test kind and version range, the `req:` requirements it is evidence for, " +
      "test cases whose assertions are criterion ids, fixed (reviewed) or generated " +
      "(template + params + seed) test data, and the certification rule as a DMN reference.",
    schema: "schemas/sdlc/test-plan.ts",
    // declared-path-literal: this table IS the declaration, as for `health`.
  },
  // Test reports -- the verdicts ONE run of ONE plan reached against ONE
  // system under test, with a per-plan rollup. Strawperson, bean `ygzh`.
  //
  // `state` by the one question: the tester's run WRITES it, and it fails the
  // stand-alone test the way `qa` and `qa-report` do -- detached from the plan
  // and the system it judges, a list of case ids marked `pass` asserts
  // nothing. NOT `derived`: re-running a plan against a system produces a NEW
  // report under a new run id rather than the same one again, which is the
  // line `qa-report` and `binary-release` already draw.
  //
  // A separate kind from `qa-report`, and the difference is the subject: that
  // records what a TOOL said about its own run; this records what a TESTER
  // found about SOMEBODY ELSE -- the system under test, which the schema
  // forbids from writing its own verdict. Folding them would hand a certifier
  // a script's self-report as if it were a test result.
  //
  // `recordsWork: false` -- live state, but nothing anybody is partway
  // through. A running report is a run in flight, not a work item, and
  // `testReportVerdict` reports it as `unknown` rather than as clean.
  //
  // NOT renderable, for the reason `health` and `qa-report` give: the site
  // build does not read it. The owner's `py74` ruling -- separate family
  // panels, never one total -- governs any dashboard later built over it,
  // and the schema already refuses a total.
  //
  // Declared, no directory: proposal §3.2 writes these to the `qa-reports`
  // branch under `tests/<plan-id>/<sut>/<run-id>/`, which does not exist yet
  // (beans `ygzh` and the branch work in arc `3fva`).
  "test-report": {
    description:
      "test reports — one `test-report/v1` document per run of a plan against a system under test, per-case verdicts in the block-qa entry shape, and a rollup for that ONE plan. **Never a total across plans** — the owner's `py74` ruling, enforced by a strict top level that has no field for a second plan or a total. Strawperson, bean `ygzh`. `state`: the run writes it, and re-running produces a new report rather than the same one. A separate kind from `qa-report` because the subject differs — that is a tool's account of its OWN run, this is a tester's finding about SOMEBODY ELSE, which is why the system under test may not write its own verdict. The rollup may not disagree with the cases, and `running` is never a pass. Written to the `qa-reports` branch under `tests/<plan-id>/<sut>/<run-id>/`; declared, no directory. Shape in `schemas/sdlc/test-report.ts`.",
    renderable: false,
    holds: "state",
    recordsWork: false,
    summary:
      "Test reports -- one `test-report/v1` document per run of a plan against a system under " +
      "test: per-case verdicts in the block-qa entry shape, a rollup for that ONE plan that may " +
      "not disagree with its cases, and never a total across plans. `running` is never a pass, " +
      "and the system under test never writes its own verdict. Generated by the run.",
    schema: "schemas/sdlc/test-report.ts",
    // declared-path-literal: this table IS the declaration, as for `health`.
  },
  // Fixed test data sets (`test-data-fixed/1.0.0`, bean `vm6m`) — small, curated
  // or hand-authored records committed to the repository, cited to a source or
  // guideline where applicable, and reviewed by an SME when they exercise
  // domain logic (`bean vljz`). Declared as its own graph typology separate
  // from `test-data-generated` so fixed sets never share a declared directory
  // with synthetic recipes, while every file carries `$schema: "test-data-fixed/1.0.0"`
  // and `kind: "fixed"` so a consumer tells which it is reading from the file
  // content, never from the directory path.
  "test-data-fixed": {
    description:
      "fixed test data sets — one `test-data-fixed/1.0.0` document per curated set (`kind: \"fixed\"`, committed records, citations, and optional SME review sign-off). Separate graph typology from `test-data-generated` (bean `vm6m`) so fixed sets live in their own declared directory, and self-identifying from the file content (`$schema` and `kind`) rather than from the path. `content`: a test run reads a fixed set and never overwrites it, and once SME-reviewed it stands as certification evidence. Shape in `schemas/sdlc/test-data.ts`; curated via `sdlc/processes/test-data-curation.bpmn`.",
    title: "Fixed test data sets",
    renderable: false,
    holds: "content",
    serialised: false,
    summary:
      "Fixed test data sets — one `test-data-fixed/1.0.0` document per curated set (`kind: \"fixed\"`), " +
      "living in its own declared directory separate from `test-data-generated` and self-identifying from " +
      "the file content rather than the path (bean `vm6m`).",
    schema: "schemas/sdlc/test-data.ts",
    // declared-path-literal: this table IS the declaration, as for `test-plan`.
  },
  // Generated test data set recipes (`test-data-generated/1.0.0`, bean `vm6m`) —
  // `contentType`, `specialisation`, `template`, `params`, `seed`, and the
  // canonical `sha256` digest of that recipe. Never stored materialised: the
  // test run synthesises the records from the recipe at execution time via the
  // content-type specialisation subprocess (`sdlc/processes/test-data-curation.bpmn`).
  // FHIR templating (`specialisation: "fhir-templating"`) is one named
  // specialisation, not the platform design.
  "test-data-generated": {
    description:
      "generated test data set recipes — one `test-data-generated/1.0.0` document per recipe (`kind: \"generated\"`, `contentType`, `specialisation`, `template`, `params`, `seed`, and canonical `sha256`), never stored materialised. Separate graph typology from `test-data-fixed` (bean `vm6m`) so synthetic recipes live in their own declared directory, and self-identifying from the file content (`$schema` and `kind`) rather than from the path. FHIR templating (`specialisation: \"fhir-templating\"`) is one named content-type specialisation, not the design. `content`: a test run reads the recipe to synthesise inputs and records the digest on `folio-test-run/v1`. Shape in `schemas/sdlc/test-data.ts`; curated via `sdlc/processes/test-data-curation.bpmn`.",
    title: "Generated test data recipes",
    renderable: false,
    holds: "content",
    serialised: false,
    summary:
      "Generated test data recipes — one `test-data-generated/1.0.0` document per recipe (`kind: \"generated\"`, " +
      "`template`, `params`, `seed`, `specialisation`, `sha256`), never stored materialised, living in a " +
      "declared directory separate from `test-data-fixed` (bean `vm6m`).",
    schema: "schemas/sdlc/test-data.ts",
    // declared-path-literal: this table IS the declaration, as for `test-plan`.
  },
  // SME case/cohort review verdicts (`sme-case-verdict/1.0.0`, bean `vljz`) —
  // attributable human SME judgements on decision-support worked cases
  // (`subjectKind: "decision-support"`) and indicator-definition cohorts
  // (`subjectKind: "indicator-definition"`).
  "sme-case-verdict": {
    description:
      "SME review case/verdict pairs for decision support (worked `case`) and indicator definitions (`cohort` plus `expectedValue`) — one `sme-case-verdict/1.0.0` document per reviewed unit, recording the attributable human SME identity (`reviewer`) and review date (`reviewedAt`) alongside `verdict` and `rationale` (bean `vljz`). `content`: authored by a person in the `judgementOnly` SME lane of `sdlc/processes/sme-test-data-review.bpmn` so a fixed test data set can stand as audited evidence. Shape in `schemas/sdlc/test-data.ts`.",
    title: "SME case/verdict pairs",
    renderable: false,
    holds: "content",
    summary:
      "SME review case/verdict pairs — one `sme-case-verdict/1.0.0` document per reviewed decision-support " +
      "worked case or indicator-definition cohort, recording attributable human SME identity and review date " +
      "(bean `vljz`).",
    schema: "schemas/sdlc/test-data.ts",
    // declared-path-literal: this table IS the declaration, as for `test-plan`.
  },
  // ONE kind for the whole work plan, not one per store. It replaced `workplan`
  // + `process-state` in #266; the rationale is in this map's doc comment above,
  // and the #263 version it supersedes is preserved there too. PR #266 changed
  // the map and left that comment describing the old five-kind design.
  // RENAMED from `glossary` on 2026-09-23 (owner: "Rename harness one"). The
  // name `glossary` now belongs to the content core's kind: local SKOS
  // terms plus references to external SKOS schemes, rendered on every
  // layer's glossary/ page. This is the harness's swimlane-role ledger, one
  // source that page reads.
  "swimlane-glossary": {
    description:
      "(renamed from `glossary` on 2026-09-23, owner: \"Rename harness one\") the swimlane glossary's retirement ledger (`glossary/`) — every concept this instance has ever minted, with the date it was first seen and the date it stopped being derivable. `state` but **not** work (`recordsWork: false`): a bean is something somebody is partway through, this is a record that a term exists. Only the ledger is stored — the glossary DOCUMENT is derived from the corpus each run, which is exactly why the ledger has to exist: a derived document has no memory, so without it a retired term and one that never existed look the same. Written by `scripts/glossary-export.ts`; read with the [`swimlane-glossary`](../../process/process-core/swimlane-glossary.md) skill.",
    title: "Swimlane glossary",
    renderable: false,
    // `state`, and NOT `derived` — the interesting call now that `derived`
    // exists. The glossary DOCUMENT is derived and lives in `_kg/`; what is
    // committed here is the LEDGER, whose one fact is the thing regeneration
    // cannot produce: that a term was once minted. A `derived` ledger would
    // say "regenerate it", and regenerating it erases every retirement. So a
    // process writes it as it runs, which is `state` by the axis's own
    // question.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "glossary-ledger/1.0.0": {},
    },
    // NOT work. A bean is something somebody is partway through; this is a
    // record that a term exists, true whether or not anybody is doing
    // anything. `check:graph-typology-work` refuses a `state` kind that has not
    // decided, and it was right to: "state" alone does not say whether a
    // reader is looking at a queue or at a fact.
    recordsWork: false,
    // cat-harness's own kind since 2026-09-30 (owner, bean `xsqm`): the
    // ledger is harness state, hosted here for every layer it exports,
    // so the kind moved up from bootstrap with it. Written by
    // scripts/glossary-export.ts; the glossary document itself is derived and
    // not stored here — only the ledger, the one fact that cannot be re-derived.
    summary:
      "A Subgraph recording every term a Knowledge Graph's Processes have ever named, and when each stopped being used, so a retired term is never silently reused.",
  },
  models: {
    description:
      "which languages a model is good at, and whether a human checked (`models/models.json`). `context`: READ when a session opens, never written by a process — a person grants a validation, an agent never does, because a model's own claim about its languages is precisely what the validation state exists to distrust. In BOOTSTRAP because an agent reaching for the language it should communicate in has not yet loaded the harness that would otherwise answer. One INPUT to the [`communication-language`](../../conduct/conduct-core/communication-language.md) determination, never the answer.",
    title: "Models",
    renderable: false,
    // `context`: READ when a session opens, never written by a process. That
    // is the whole point of the kind — a person grants a validation, an agent
    // never does, because a model's own claim about which languages it
    // handles well is precisely what the validation state exists to distrust.
    // A `state` kind would say a process may write it, and the first process
    // that did would be manufacturing its own evidence.
    holds: "context",
    // declared-path-literal: this table IS the declaration, as on `health`.
    validator: "bootstrap-tools:schemas/model-registry.ts#ModelRegistrySchema",
    // bootstrap's own sentence, read rather than restated (bean r3gy, D1).
    // The harness's detail, formerly in the summary: read when a session opens
    // as ONE input to the communication-language determination and never as
    // the answer; declared in bootstrap because an agent reaching for it has
    // not yet loaded the harness.
    summary: BOOTSTRAP_GRAPH_TYPOLOGIES["models"],
  },
  beans: {
    tileIcon: "beans",
    // A NEW layer keeps its own on `cat/<instance>/beans`, branch-mounted
    // (owner, 2026-10-06, bean `hp54`). folio_init only — see the field.
    newInstanceSource: { kind: "branch", keyedBy: "tip" },
    description:
      "the work plans and the work items they hold (`beans/`); its inner nodes are declared by `beans/beans.json`",
    // "Plans and work", not "Beans" (work item folio-assistant-dkqd) and no
    // longer "Work plan": a work plan is now one epic or milestone (work item
    // folio-assistant-exrp), so the store holds plans AND work. See `bean-defs`.
    title: "Plans and work",
    perInstance: true,
    renderable: false,
    // The work plan. Its own declaration already splits WHAT IS BEING WORKED
    // ON from WHERE IT GOT TO — both are records about content, neither is
    // content.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    // EVERY nested kind's `$schema` family belongs here, not only on the child.
    // `check:kind-validators` routes a node by the family map of the kind whose
    // DIRECTORY contains it, and the directory is `beans/` — so a family
    // declared solely on the child is unmapped the moment a node of it exists.
    // `folio-workflow-instance/v1` is `workflow-state`'s family and was already
    // here for exactly this reason; `folio-session-survey/v1` is
    // `session-survey`'s and was not, because until 2026-09-27 no survey had
    // ever been published and a map with no nodes cannot be caught failing to
    // route one (`1xhc`).
    nodeSchemas: {
      "folio-workflow-instance/v1": { shape: "cat-harness-tools:src/workflow/instance.ts#InstanceState" },
      // Runnable, unlike its neighbour: `SessionSurveySchema` is a Zod schema,
      // so a published survey is PARSED rather than merely typed.
      "folio-session-survey/v1": {},
      // `merge-queue`'s family, missing for the same reason as the survey's:
      // no queue entry existed until the steward's first ACKs on 2026-10-04,
      // and the first one made `check:kind-validators:require-all` red. The
      // SAME validator the child declares, so the two cannot disagree.
      "folio-merge-queue-entry/v1": {},
      // `sweep-marks`' family, added with the kind (bean `rq8s`) so the first
      // mark routes rather than reddening `require-all` as the queue's did.
      "folio-sweep-mark/v1": {},
    },
    recordsWork: true, // beans (agent), todos (person), workflow-state (a process mid-flight)
    summary:
      "The work plan — what is being worked on, and where each running BPMN instance got to. " +
      "Its inner directories are declared by `beans/beans.json`.",
    // Named here rather than derived from the directory: `bean-graph.ts` holds
    // that moving `beans/` to `work/` must rename nothing inside it, and a
    // computed `${dirName}.json` would contradict that on the first relocation.
    declarationFile: "beans.json",
  },
  // The two parts of the bean graph. They are BASE kinds rather than
  // something `bean-graph.ts` registers separately, because a directory and
  // what it holds is one concept and this is where it lives — `bean-graph.ts`
  // had grown a parallel closed vocabulary (`BEAN_NODE_KINDS`) saying the same
  // thing in different words.
  "bean-defs": {
    description:
      "work items — one Markdown file each, in the layout the `beans` CLI reads, `$schema: bean/1.0.0` in its front matter. Authored by people and agents.",
    // "Work items", not "Bean definitions" (work item folio-assistant-dkqd):
    // the kind word, the CLI and its files keep their names; the words a
    // reader sees do not. The old title stays findable as the glossary's
    // hidden label, from the ledger's `formerLabels`. One node is a "Work
    // item": that is the node kind `bean`'s term, not this kind's.
    title: "Work items",
    renderable: false,
    // What is being worked on. A bean names a change to something; it is not
    // the something.
    holds: "state",
    recordsWork: true, // beans (agent), todos (person), workflow-state (a process mid-flight)
    // Its validator is the `bean/1.0.0` node kind (`validators/bean-node.json`,
    // bean `ujiv`, issue #88). It was `validatorNotApplicable` until then: a
    // bean carried no tag, so nothing could say which schema it was written
    // against. The tag is restored by `bun run beans:retag`, because `beans
    // update` drops every front-matter key it does not know.
    summary:
      "Work items — one Markdown file each, in the layout the `beans` CLI reads, carrying " +
      "`$schema: bean/1.0.0` in its front matter. Authored and edited by people and agents.",
  },
  // Bean `m61r`, issue #1853: one pull request's addendum to a bean, in a file
  // of its own, so sibling pull requests stop conflicting on one bean they all
  // append to (`ob3m` cost five hand-merges in one afternoon, 2026-10-02).
  "bean-notes": {
    description:
      "one pull request's addendum to a bean — one Markdown file per branch per bean, `$schema: folio-bean-note/v1` in its front matter, named `<bean>--<date>--<branch>.md` so two pull requests never write one path; `README.md` beside them is the generated index. Bean `m61r`: `ob3m` cost five hand-merges in one afternoon while every finding was appended to the bean. `state`, and `recordsWork: false` because a note is a record about a bean, whose work is counted on the bean. Convention: [`bean-coordination`](../../../work-plan/skills/work-plan/bean-coordination.md) §\"Adding to a bean — a note, not an append\".",
    renderable: false,
    // Written by a session as it works, like the beans it adds to. Not
    // `context`: a process writes it.
    holds: "state",
    // A note is a RECORD about a bean, not a second work item. The work it
    // describes is the bean's, and is counted there; an agent told this graph
    // is active would look for work to pick up and find a log.
    recordsWork: false,
    schema: "schemas/sdlc/bean-note.ts",
    validatorNotApplicable:
      "no instance declares a directory of this kind — it is nested inside `beans/`, declared by " +
      "`beans/beans.json`, and its nodes are Markdown with YAML front matter. `beans:notes:check` " +
      "parses each against `BeanNoteFrontMatterSchema` and re-derives its file name.",
    summary:
      "Bean notes — one Markdown file per pull request per bean, `$schema: folio-bean-note/v1` in " +
      "its front matter, named `<bean>--<date>--<branch>.md` so two pull requests never write one " +
      "path. Indexed by a generated README.",
  },
  "session-survey": {
    description:
      "published surveys of a commit window — one JSON each, `\"$schema\": \"folio-session-survey/v1\"`. Bean `6ptx`: eight sessions surveyed the same ~2435-commit window in one minute and that day produced ONE authored commit. Each records the window's **two edge commits**, so a later session computes the uncovered delta (`bun run cat survey:owed`) instead of re-deriving the range — staleness decidable rather than guessed, and an unreachable upper edge reads as *unusable*, never as covered. `state` because a running session writes it; `recordsWork: false` because a survey is a READING of work, not work anybody is partway through.",
    title: "Session surveys",
    renderable: false,
    // Written BY a running session, for other sessions to read. That makes it
    // state rather than context: `interaction/` is context because no process
    // writes it, and this one exists only because a process did.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      // A RUNNABLE validator rather than a `shape`: this is a zod schema, so the
      // nodes can actually be parsed instead of merely typed. `workflow-state`
      // next door can only offer a TypeScript shape, which `check:kind-validators`
      // reports as "not runnable — could not determine".
      "folio-session-survey/v1": {},
    },
    schema: "schemas/sdlc/session-survey.ts",
    // A survey is a READING of work, not work anybody is partway through. An
    // agent told this graph is active would arrive looking for something to
    // pick up and find a finished report — the distinction `recordsWork`'s own
    // docblock draws against `uploads`.
    recordsWork: false,
    summary:
      "Published surveys of a commit window — one JSON file each, carrying " +
      "`\"$schema\": \"folio-session-survey/v1\"` and the window's two edge commits, " +
      "so a later session can compute what it is NOT covered for instead of re-deriving " +
      "the whole range (bean `6ptx`).",
  },
  "sweep-marks": {
    description:
      "when a session-start sweep step last ran — one JSON per check, `\"$schema\": \"folio-sweep-mark/v1\"`, replaced on each run that read its input. Bean `rq8s`: the sweep asks an agent to run `check:session-staleness` and cannot run it itself, so a skipped step left no trace; the owner ruled 2026-10-10 that the check writes a last-checked timestamp to the state branch. Only a DETERMINED run writes a mark, so \"could not determine\" never reads as \"checked\". `state` because a running session writes it; `recordsWork: false` because a mark is a reading, not work anybody is partway through.",
    title: "Sweep marks",
    renderable: false,
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-sweep-mark/v1": {},
    },
    schema: "schemas/sdlc/sweep-mark.ts",
    recordsWork: false,
    summary:
      "When a sweep step last ran — one JSON per check, carrying `\"$schema\": \"folio-sweep-mark/v1\"`, " +
      "so a skipped `check:session-staleness` is visible after the terminal scrolls (bean `rq8s`).",
  },
  "workflow-state": {
    description:
      "running BPMN instances — one JSON each, `\"$schema\": \"folio-workflow-instance/v1\"`. Owned by the interpreter, never hand-edited.",
    title: "Workflow state",
    renderable: false,
    // The clearest case in the table: a token's position in a process drawn in
    // the `cat-harness` graph. It cannot be read at all without the diagram it
    // references.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-workflow-instance/v1": { shape: "cat-harness-tools:src/workflow/instance.ts#InstanceState" },
    },
    schema: "cat-harness-tools:src/workflow/instance.ts",
    recordsWork: true, // beans (agent), todos (person), workflow-state (a process mid-flight)
    // The kind's own reader, wired 2026-09-20. `skill` is a property of the
    // KIND rather than of a directory because a `workflow-state` graph is read
    // the same way wherever it sits — and it was absent while the skill it
    // names did not exist. A consumer arriving at this kind had the shape and
    // no account of what a token position MEANS, which stores sit beside it,
    // or why a step may write here and not to `memory`.
    summary:
      "Running BPMN instances — one JSON file each, carrying " +
      "`\"$schema\": \"folio-workflow-instance/v1\"`. Owned by the interpreter, never hand-edited.",
  },

  // The merge queue — what the merge STEWARD decided about an open pull
  // request. Bean `hfag`'s last open box, and the one that made the schema
  // homeless: `schemas/sdlc/merge-queue.ts` has existed since the epic's first
  // commit, `MergeQueueEntrySchema` validates an entry, and nothing declared
  // anywhere an entry could LIVE. A schema with no declared graph is reachable
  // only by the module that imports it, which is `dh4f` pointed the other way
  // — not a declared directory nothing holds, but a held shape nothing
  // declares.
  //
  // `state` by the one question `content-context-and-state-graphs` asks: a
  // running process WRITES it. A steward records a placement, a hold or an
  // ejection as the train proceeds; nothing authors a queue entry outside a
  // run, and re-running is how you arrive at the next one.
  //
  // It sits in `beans/` beside `workflow-state` ON PURPOSE, and the pairing is
  // the point: the queue holds the DECISIONS, a finished train run holds the
  // EVIDENCE of what those decisions met (`TrainMemberEvidenceSchema`). Two
  // kinds, one store, because a reader asking "why did #1899 go in that train"
  // needs both and should look in one place.
  //
  // `recordsWork: true` — an entry is a pull request someone is partway
  // through placing, which is exactly what that flag is for (beans, todos,
  // workflow-state). A held entry with an unexpired hold is open work.
  "merge-queue": {
    description:
      "a merge steward's DECISIONS about an open pull request — one JSON each, `\"$schema\": \"folio-merge-queue-entry/v1\"`: priority class, rank or override with its reason, a hold with its expiry, the train it joined, an ejection with its evidence. **Never a fact GitHub owns** — CI, mergeability, labels and the head SHA are read live at decision time and refused BY NAME by the schema, because a stored copy is a second answer that goes stale on the next push. The one exception is an evidence snapshot on a FINISHED train run, which is history rather than a claim about now. Declared at `beans/queue/`, beside `workflow-state`: this holds the decisions, a finished run next door holds the evidence they met. `state` because a steward writes it as the train proceeds; `recordsWork: true` because a held entry is open work. Shape in `schemas/sdlc/merge-queue.ts`; read with [`merge-queue`](../../../sdlc/skills/sdlc-core/merge-queue.md). Bean `hfag`.",
    renderable: false,
    holds: "state",
    recordsWork: true,
    schema: "schemas/sdlc/merge-queue.ts",
    // declared-path-literal: this table IS the declaration, as on `health` and
    // `workflow-state`. The validator is the SAME export the steward's tooling
    // imports, so the kind and the writer cannot drift into two answers.
    nodeSchemas: {
      "folio-merge-queue-entry/v1": {},
    },
    summary:
      "A merge steward's DECISIONS about an open pull request — priority, rank or override with its reason, " +
      "a hold with its expiry, the train it joined, an ejection with its evidence. " +
      "Never a fact GitHub owns: CI, mergeability, labels and the head SHA are read live and refused by name here.",
  },
  // The todo graph. NOT a second work plan: `beans` is the agent work plan and
  // `AGENTS.md` forbids standing up another. This is the thing that document
  // already carves out beside it — "the content-review feedback workflow … a
  // separate domain feature, not the agent work-plan" — and it is CONTENT,
  // owned by the folio. A todo records a PERSON's outstanding work, tagged by
  // the four coordinates of the role model: who, as which role, in which
  // process, on which task.
  todos: {
    description:
      "human actors' outstanding work as a whole (`todos/`); its inner nodes are declared by `todos/todos.json`",
    title: "Todos",
    perInstance: true,
    // A NEW layer keeps its own on `cat/<instance>/todos`, branch-mounted
    // (owner, 2026-10-06, bean `hp54`). folio_init only — see the field.
    newInstanceSource: { kind: "branch", keyedBy: "tip" },
    renderable: false,
    // A person's outstanding items. Outstanding is the word that settles it —
    // an item records a position, not a fact.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-board/v1": {},
    },
    recordsWork: true, // beans (agent), todos (person), workflow-state (a process mid-flight)
    summary:
      "Human actors' outstanding work — content, owned by the folio, tagged by role, " +
      "process, task and identity. Its inner directories are declared by `todos/todos.json`.",
    declarationFile: "todos.json",
  },
  // THE BOARD AND ITS LAYOUT, declared as TWO kinds, and the split is the
  // whole design rather than a filing convenience.
  //
  // The owner, 2026-09-20: *"treat it like OMG specs and BPMN layout.
  // relationship first, visualiztion alter."* BPMN separates the semantic
  // model (`bpmn:process`) from **Diagram Interchange** — `BPMNDiagram`,
  // `BPMNShape`, `BPMNEdge` — and the layout document points AT the semantic
  // one, never the other way. So:
  //
  //   boards            what a board IS, and what it shows        content
  //   board-positions   where each note was drawn on it           state
  //
  // A board is a DIAGRAM OF a folio, not a container of one: a folio is
  // complete with no board, and deleting every board loses layout and no
  // content. That is also why `board-positions` is `state` while `boards` is
  // `content` — one is authored and the other is written by a running process
  // as people move things, and `content-context-and-state-graphs` refuses a
  // content node that carries state. It is the same reason a note may not
  // hold `x` and `y`, which `schemas/ui/board-positions.ts` asserts against the
  // source of four schemas.
  boards: {
    description:
      "boards — one file each, `\"$schema\": \"folio-board/v1\"`. A board is a **diagram OF** a folio, not a container of one: it declares what it shows, and a folio with no board is complete. The semantic half of the OMG split the owner named — *\"treat it like OMG specs and BPMN layout. relationship first, visualiztion alter.\"*",
    title: "Boards",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    // NOT work. A board is a way of LOOKING at work, and `check:graph-typology-work`
    // asks the question because the two are easy to conflate: `beans`, `todos`
    // and `workflow-state` each record something somebody is partway through,
    // and a board records none of it. Deleting every board loses no position
    // in any process.
    recordsWork: false,
    summary:
      "Boards — one JSON file each, carrying `\"$schema\": \"folio-board/v1\"`. " +
      "A board is a diagram OF a folio: it declares what it shows, and a folio with " +
      "no board is complete. Schema: `schemas/ui/board.ts`.",
  },
  "board-positions": {
    description:
      "where each note sits on each board — `board-positions.json`, keyed by board then by note id, in board units. The **Diagram Interchange** half: it points at notes and is never pointed back at, which is why a note carries no `x`, `y`, `board` or `position`. `state` rather than `content`, because a running process writes it every time somebody moves a note.",
    title: "Board positions",
    renderable: false,
    // Written by a running process every time somebody moves a note. It is
    // Diagram Interchange: where things were drawn, not what is true.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    // NOT work either, and this is the sharper of the two. It IS `state` —
    // written by a running process — which is exactly what makes the question
    // worth asking: state that records a POSITION IN A PROCESS is work, and
    // state that records a position ON A CANVAS is not. Losing this file loses
    // where things were drawn and nothing about what is outstanding.
    recordsWork: false,
    summary:
      "Where each note sits on each board — `board-positions.json`, keyed by board " +
      "then by note id, in board units. The layout layer, which points at notes and " +
      "is never pointed back at. Schema: `schemas/ui/board-positions.ts`.",
  },
  "todo-items": {
    description:
      "todo nodes — one file each, `\"$schema\": \"todo/1.0.0\"`. Authored by people, and by agents on their behalf.",
    title: "Todo items",
    renderable: false,
    // As `todos`.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    recordsWork: true, // beans (agent), todos (person), workflow-state (a process mid-flight)
    summary:
      "Todo nodes — one file each, carrying `\"$schema\": \"todo/1.0.0\"`. " +
      "Authored by people and by agents on their behalf.",
  },

  // BACK IN THE BASE LAYER, 2026-10-04 (bean riit). dmx1 moved this kind to
  // the content core's typologies/ graph the same day; that broke the invariant
  // DEFAULT_DIRECTORIES states ("the harness cannot default a directory to a
  // kind it does not know"), because the harness defaults `uploads/` beside
  // `library/` — and the two are ONE pipeline, so they belong in one place.
  // The two stages of the document-ingestion pipeline. They are declared as
  // SEPARATE kinds rather than one `sources` kind because the whole point
  // of the pair is that they are not interchangeable: the corpus-grep
  // checklist searches `library/` and not `uploads/`, so a source still in
  // `uploads/` makes a clean grep read as "nobody has done this" while the
  // file sits on disk. Collapsing them into one kind would erase exactly
  // the distinction `docs/source/guides-document-ingestion/uploads-and-library-
  // are-two-stages-of-one-pipeline.md` exists to state. A QUEUE, and a
  // queue is a position in a pipeline. The declaration already says these
  // files are NOT L1 and read as absent to every corpus consumer: the file
  // is on disk and the content does not exist yet. Local since bean `tlat`
  // moved the extraction contract down (placement PR5). The document
  // adapter writes an upload's description beside its intake (bean `d4lb`),
  // in the same family the IRIS catalogue records use. A queued source may
  // itself BE a JSON Schema: the SPDX 3.1-RC1 schema held in
  // uploads/spdx-3-1-rc1-machine-readable/ (bean `sd5v`) declares the meta-
  // schema as its `$schema`. It conforms to a specification nobody here
  // types, so it is `external`, as on `schemas` and `docs`.
  uploads: {
    description: "the incoming queue — raw files as dropped, before ingestion. NOT L1, and not greppable as corpus.",
    title: "Uploads",
    perInstance: true,
    renderable: false,
    holds: "state",
    nodeSchemas: {"folio-extraction/v1": {}, "folio-intake/v1": {}, "folio-dublin-core/v1": {}, "https://json-schema.org/draft/2020-12/schema": {"external": "JSON Schema 2020-12"}},
    recordsWork: false,
    summary: "The incoming queue — raw files as dropped, before ingestion. NOT L1, and not greppable as corpus: a document here reads as absent to every consumer.",
    avatar: {"glyph": "M12 17V5m0 0l-4 4m4-4l4 4M5 19h14", "tone": 200, "reads": "an arrow onto a line — something arriving"},
    tileIcon: "uploads",
  },
  library: {
    tileIcon: "library",
    description:
      "L1 source content — one `<bib-slug>/` per ingested document, holding `sections/*.md`, `structure.json` and, where scanned, `ocr/page-NNN.txt`.",
    title: "Library",
    perInstance: true,
    // Grouped by concern from within (`library/library.json`), PR0c — and
    // ruled 2026-09-30 (issue 3, option A): the physical split is
    // `library/<group>/<slug>/`; a new upload lands UNFILED at
    // `library/<slug>/`, and filing is a core cataloguing refinement. The
    // declaration is what lets a walker tell a group from a source.
    declarationFile: "library.json",
    concernGroups: true,
    renderable: false,
    // DERIVED, not content — bean `hqku`, and the owner's ruling of
    // 2026-09-20: *"library is static (only if we materialize assets or
    // not)"*, *"can duplicate asset into a folio and work there"*.
    //
    // It still stands on its own — a library section reads without anything
    // else, which is why this was `content` until now and why the skill used
    // it as the example. What changed is the OTHER question: a section is
    // produced from an ingested source and regenerated, never re-authored in
    // place, so a QA finding against one is a finding against the ingestion
    // that made it. `qa-sweep` skips it for exactly that reason.
    //
    // NOT `context`, and that was ruled out by a rule rather than by taste:
    // `context` means a step writing to it is a defect, and
    // `document-ingestion.bpmn` writes `library/`.
    holds: "derived",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      // The FROM-WITHIN node naming this directory's concern groups
      // (placement PR0c): `concern-groups/v1`.
      "concern-groups/v1": {},
      // Each ingested source's `structure.json`, one family per format it was
      // read as. These three tag themselves `_schema`, not `$schema` (the
      // format predates the convention), so routing reads either:
      // `nodeFamilyTag` in kind-validator.ts.
      "pdf-structure/v1": {},
      "notebook-structure/v1": {},
      "text-structure/v1": {},
      // The entry's JSON-LD nodes: its manifest, its sections and sheets, and
      // its blocks. They carry no `$schema`, so each family is the class the
      // node instantiates (`schemas/library/library-nodes.ts` says how one is told).
      "cat-harness:SourceDocument": {},
      "doco:Section": {},
      "cat-harness:Block": {},
      "folio-document-images/v1": {},
      "folio-image-verdicts/v1": { shape: "cat-harness-tools:scripts/apply-image-verdicts.ts#VerdictFile" },
      // The section analogue of image verdicts (bean `fnqn`): which sections are
      // mostly SAMPLE text. Read by summaries and the LSI units.
      "folio-section-verdicts/v1": {},
      // The OTHER layer of the same page — bean `a8wy`. `folio-document-images`
      // holds what the PDF PLACES; this holds the positioned text of a figure
      // the PDF DRAWS, for which there is no image object to place. Two
      // families rather than one because a vector figure has no rectangle to
      // measure coverage on, no `xref` to dedupe by and no pixel to inspect,
      // so `role` and `basis` would each mean two things.
      "folio-vector-labels/v1": {},
      // The vector figures ASSEMBLED and RENDERED — bean `ay3x`. Every entry
      // carries a basis naming who or what looked; the extractor's assigns no
      // role, and the role arrives by inspection through `image-verdicts.json`.
      "folio-vector-figures/v1": {},
      // The JUDGEMENT half of the vector arm — bean `a8wy`. Stands to
      // `folio-vector-labels` as `folio-image-verdicts` stands to
      // `folio-document-images`: the measurement says where every text line
      // sits, this says what somebody reading them concluded, and its
      // required `basis` records whether they rendered the page. A
      // labels-only reading gets the nouns right and the relations wrong, so
      // a reader has to be able to tell the two apart.
      "folio-figure-descriptions/v1": {},
      // A figure transcribed as data on its entry's `figure-data/` (owner,
      // 2026-10-31, option B: in the library entry): the DIIG phases chart and the SMART
      // Guidelines approach chart, one file per published version. Their
      // shapes are with the generators that draw them, in a layer above this
      // one, so they are routed here and validated there.
      "diig-phases-figure/v1": {},
      "smart-guidelines-approach-figure/v1": {},
      // Agent summaries of prose blocks, beside the blocks rather than in
      // them — the blocks stay verbatim and `ingested` (owner, 2026-09-24).
      // The semantic half of its QA is `block-summaries` in check-l1-complete.
      "folio-block-summaries/v1": {},
      // An entry's LSI keywords, per section and per document (issue #2302).
      // Derived from the whole library's term weights by library-keywords.ts.
      "folio-keywords/v1": { generated: true },
      // Stage B's proposals for an entry (`extract-candidates.py`): typed
      // candidates gen-library-jsonld turns into blocks, among them the
      // requirements, indicators and normative statements of a DAK or DTH
      // source (cat-harness-tools#1356, owner 2026-11-01).
      "ingest-candidates/v1": {},
      // What the site mount must not publish from this directory (bean `cw35`).
      // Written by the layer's generator from its licence gates; the mount
      // validates it with this schema and refuses to mount if it cannot.
      "folio-withheld/v1": {},
      // A slide deck's accessibility report, per check (bean `scfh`).
      "folio-slides-accessibility/v1": {},
      // A source recorded and not held, its text withheld by licence (bean `scfh`).
      "folio-referenced-source/v1": {},
      // What the PDF arm writes beside `structure.json` for an ingested or
      // referenced source (IRIS extraction, issue #1925): its footnotes and
      // marks (`footnotes.json`, schemas/content/document-footnotes.ts), the
      // errata recorded against the source's own errors (`errata.json`,
      // schemas/content/document-errata.ts), the OCR run's context
      // (`ocr/run-context.json`, schemas/sdlc/run-context.ts) and a table read
      // as CSVW (`*.csvw.json`, schemas/library/tabular-csvw.ts). Unlisted,
      // check:kind-validators reports each as an unmapped family. Each is a
      // node kind, joined here by its `validators/library-*.json` node, so
      // check:node-kinds holds none of them as a new unkinded family.
      "folio-document-footnotes/v1": {},
      "folio-document-errata/v1": {},
      "folio-run-context/v1": {},
      "folio-tabular-csvw/v1": {},
      // Which extractor read the entry and what each extraction step wrote
      // (`extraction.json`, schemas/library/entry-extraction.ts), written by
      // every re-derive since the reingest record (issue #2186).
      "folio-library-extraction/v1": {},
      // A recorded meeting or talk, and one transcript per language
      // (bean `folio-assistant-1r0p`, `schemas/library/recording.ts`).
      "folio-recording/v1": {},
      "folio-transcript/v1": {},
    },
    summary:
      "L1 source content — one `<bib-slug>/` per ingested document, holding `sections/*.md`, " +
      "`structure.json` and, where the source was scanned, `ocr/page-NNN.txt`. Every " +
      "knowledge-graph reference to a source resolves through here, never to a loose path " +
      "or a bare URL.",
  },
  // `computation-witness` was registered here until folio-assistant#2598
  // (owner, 2026-10-16, "1a"): a `core` kind, so it is now a
  // `folio-graph-typology/v1` node in the content layer's `typologies/`
  // graph and is named in that layer's namespace. Its envelope schema
  // (`schemas/computation-witness.ts`) and validator node stay here, where the
  // witness tools below the content layer read them.
  // Binary releases — WHAT WAS PUBLISHED, under what version, with what
  // digest. Never the bytes.
  //
  // Registered on the owner's ruling, 2026-09-30 — OPTION A of bean `rjug`:
  // *"a `binary-release` kind, `holds: "state"`, one node per release,
  // recording id, version, digest, size and where it is fetched from, never
  // the bytes."*
  //
  // OPTION B WAS REUSING `materialization`, and the bean asked for the
  // reservation to be decided rather than assumed: *"a release is an EVENT
  // with a version and a digest, not a materialisation state."* Bean `gpdo`
  // has since landed (owner's pick 2026-09-23, "Third purpose"; issue #1194,
  // still open) and it SHARPENS that mismatch rather than softening it.
  // `MATERIALIZATION_PURPOSES` is now `working | archival | both | compiled`,
  // and every one of the four is a purpose of A COPY THIS LAYER HOLDS —
  // may I re-fetch it, are these the stored bytes, both, or was it built from
  // the inputs we have now. A release's subject is a publication UPSTREAM: it
  // happened whether or not a byte was ever fetched here, and it stays true
  // after every local copy is gone. `gpdo` added a third question to
  // materialization and a release answers that one no better than the other
  // two — it has no inputs, it has a version.
  //
  // So the two COMPOSE rather than substitute. A release node says "v1.8.0
  // published package.tgz, this many bytes, this sha256, at this URL"; a
  // materialization record says "and a copy is here, taken for this purpose".
  // Asking a materialization node what was released returns an answer about
  // what was FETCHED — the `catalogue`-vs-`library` confusion one corpus
  // over.
  //
  // `state` by the one question: the release pipeline WRITES it as it runs,
  // and it fails the stand-alone test the way `qa` and `health` do — detached
  // from the thing released, a digest asserts nothing. NOT `derived`, which is
  // the call worth stating now that `derived` exists and the entry above takes
  // it: a derived graph is regenerated from a source that still exists, while
  // re-running a release pipeline produces a DIFFERENT release with a new
  // version and a new digest. Same distinction `qa-report` draws.
  //
  // `recordsWork: false` -- live state, but nothing anybody is partway
  // through. A published release is a completed fact; an arriving agent
  // cannot pick one up.
  //
  // NOT renderable. A release ledger is a provenance record consulted when
  // somebody asks where a file went, not a page anybody reads: it is the same
  // answer `health` and `qa-report` give, and for the same reason — the site
  // build does not read it, and `renderable` asks about the site build rather
  // than about legibility. Note what saying `true` would actually promise: a
  // published page per release, listing every asset's fetch URL, including
  // the ones a deploy phase deleted on purpose. The kind exists to make that
  // history ASKABLE, not to republish it.
  //
  // The case it exists for is the deploy purge. `rjug` names the >100 MB files
  // the WHO deploy phase DELETES before deployment; after the purge nothing
  // anywhere records that they existed -- not the deployed site, not the
  // repository, and not a materialization record, because no copy was kept.
  // Hence `deleted-before-deploy` as a disposition, hence `fetchedFrom`
  // required even on a purged asset, and hence the rule that a DECIDED
  // disposition must say why: a removal with no recorded reason cannot be told
  // from an accident, which is `deletion-requires-confirmation` written into a
  // shape.
  "binary-release": {
    description:
      "published binary releases — one `folio-binary-release/v1` document per release, carrying its id, version and origin, and for each asset the size, the sha256 where one is known, where it is fetched from, and what became of it. **Never the bytes**: the schema is strict throughout. Registered 2026-09-30 on the owner's ruling (bean `rjug`, Option A); Option B was reusing `materialization`, and bean `gpdo`'s `compiled` purpose landing since has sharpened that mismatch rather than softening it — all four materialization purposes are purposes of A COPY THIS INSTANCE HOLDS, while a release is a publication UPSTREAM that stays true after every local copy is gone. The two compose rather than substitute. `state`: the release pipeline writes it, and re-running produces a DIFFERENT release rather than the same one again, which is why this is not `derived` although `ig-metadata-index` above is. `recordsWork: false` — a published release is a completed fact, not something anybody is partway through. The case it exists for is the deploy purge: after the WHO deploy phase deletes its >100 MB files, nothing else anywhere records that they existed, so a purged asset must still say where to fetch it and why it went — a removal with no recorded reason cannot be told from an accident. Shape in `schemas/sdlc/binary-release.ts`.",
    title: "Binary releases",
    renderable: false,
    holds: "state",
    recordsWork: false,
    // declared-path-literal: this table IS the declaration, as on `health`.
    schema: "schemas/sdlc/binary-release.ts",
    summary:
      "Published binary releases -- one `folio-binary-release/v1` document per release, " +
      "carrying its id, version and origin, and for each asset the size, the sha256 where " +
      "one is known, where it is fetched from, and what became of it. Never the bytes: the " +
      "schema is strict throughout, and a file a deploy phase deleted must still say where " +
      "to get it back and why it went.",
  },
  // CI caches (cache-first CI, rule 6; owner 2026-11-05, "caches are KG nodes
  // and get a VIEWER"). One node per cache a layer DECLARES: its key recipe,
  // where its entries live, producer, consumers, trust class and budget --
  // never the entries, and never the stored key, size or hit rate, which are
  // facts about the cache service that the viewer joins from the daily cache
  // report, so staleness is computed rather than claimed. Two families of one
  // kind, on `tool-release`'s precedent: `cache/1.0.0` (a declaration) and
  // `cache-inventory/1.0.0` (a dated snapshot of the caches found across the
  // harness repositories, before each declares its own). `content`: which
  // recipe a cache uses and which trust class it is given are decisions.
  // NOT renderable: the viewer (`gen-caches-viz.ts`) reads it.
  cache: {
    description:
      "CI caches (`caches/`) — one `cache/1.0.0` node per cache a layer declares, carrying its kind (actions-cache, artifact-reuse, ghcr-image, git-ref, branch-store, on-disk, setup-action-cache), its trust class under cache-first CI (a: verified against a reference derived from this tree; a-provenance: a carried manifest plus a source rule; b: a verdict, reported SKIPPED and re-verified later; c: saved from main only; unclassified), its location, its key recipe (`cache:key`, `cache:key --base`, `hashFiles` over a lock, or a mount-free script; `hand-listed` and `per-run` only to RECORD a key found that way, as a finding), its derived inputs, producer, consumers, save policy, verify, budget, owner and uses. Never the entries, and never the stored key, size, age or hit rate: the viewer joins those from the daily cache report, so a cache's staleness — the key today's pins imply against the key the service holds — is computed, never claimed (rule 6, owner 2026-11-05). A second family, `cache-inventory/1.0.0`, is a dated snapshot of the caches found across the harness repositories, which is never read as a declaration: each harness declares its own (rule 7). Shape in `schemas/sdlc/cache.ts`; viewer `scripts/gen-caches-viz.ts`.",
    title: "CI caches",
    renderable: false,
    holds: "content",
    serialised: false,
    // declared-path-literal: this table IS the declaration, as on `binary-release`.
    schema: "schemas/sdlc/cache.ts",
    nodeSchemas: {
      "cache/1.0.0": {},
      "cache-inventory/1.0.0": {},
    },
    summary:
      "CI caches -- one `cache/1.0.0` node per cache a layer declares: key recipe, trust class, location, producer, " +
      "consumers, save policy, verify and budget. Never the entries; the stored key, size and hit rate come from the " +
      "daily cache report, so staleness is computed, never claimed.",
    avatar: {
      glyph: "M5 6c0-1.66 3.13-3 7-3s7 1.34 7 3v12c0 1.66-3.13 3-7 3s-7-1.34-7-3V6zm0 0c0 1.66 3.13 3 7 3s7-1.34 7-3M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3M16.5 16.5l2 2 3.5-4",
      tone: 172,
      reads: "a stack of stored results with a tick — an output kept under its key and reused once verified",
    },
  },
  // Tool releases and tool profiles -- the external tools this platform RUNS,
  // each at one version with the sha256 of its bytes and the runtime THAT
  // release needs, and the named sets a run selects. Never the bytes.
  //
  // Step 1 of `docs/proposals/tool-releases-2026-10-07.md` (issue #2481, bean
  // `3sbm`), signed off by the owner 2026-10-07. T1 = (a): *"cat-harness, as a
  // declared graph that every layer inherits"* -- so the directory is
  // declared here, and a dependent reads it through the dependency overlay
  // rather than declaring its own (not `perInstance`). The case it exists
  // for: a render in PR #2454 produced no PlantUML SVGs because the container
  // had no `java`, said "rendered 0", and nothing noticed.
  //
  // ONE kind for TWO families, on `external-schema`'s precedent: a release
  // and a profile are read by the same resolver for the same purpose, live in
  // one directory, and each file says which it is by its `$schema` tag.
  //
  // A SIBLING of `binary-release`, not a reuse of it. That kind records
  // releases this repository PUBLISHES -- an event upstream, written by the
  // release pipeline, hence `state`. This records releases it CONSUMES, and
  // the subject is a DECISION: which upstream version, at which digest, on
  // which runtime. The two share the one claim that is the same -- a sha256
  // over an artefact's bytes -- so `ReleaseDigestSchema` is imported, not
  // restated.
  //
  // `content`, by `external-schema`'s argument: pinning an edition of
  // something upstream is a decision a person makes, and a process READS it
  // (the resolver, step 2) and never writes it. Both supporting questions
  // agree -- detached from every run, "plantuml 1.2024.7 is these bytes and
  // runs on this JRE" still says something; and you would re-author a pin,
  // not regenerate it. NOT `context`: that is a record ABOUT content read at
  // session start, and a pin is itself the subject matter of a provisioning.
  // NOT `state`: what a run actually resolved is a different record, the
  // `folio-run-context/v1` that cites these by `name@version`
  // (`schemas/sdlc/run-context.ts`), produced per run and kept with the run.
  //
  // NOT renderable: the site build does not read it, which is what
  // `renderable` asks.
  "tool-release": {
    description:
      "external tool releases and the profiles that select them (`tool-releases/`) — one `folio-tool-release/v1` document per tool at one version, carrying its sha256 (reusing `binary-release`'s `ReleaseDigestSchema`), where it is fetched from (an OCI image only by digest, never by tag), its SPDX licence expression, what kind of artefact it is, how to run it, and the runtimes THIS release needs, each injected as `JAVA_HOME` or `PATH` rather than inherited from the host; and one `folio-tool-profile/v1` document per named set of releases a run selects. A profile never names a runtime: runtimes come in through the release that needs them, because different tools need different JREs. Signed off 2026-10-07 (issue #2481, bean `3sbm`, T1 = a: in cat-harness, inherited by every layer). `content`, by `external-schema`'s argument: which upstream version to run, at which digest, is a decision, and the resolver reads it and never writes it. A sibling of `binary-release` rather than a reuse: that records what this repository PUBLISHES, this what it CONSUMES. What a run actually resolved is a `folio-run-context/v1`, produced per run. Shapes in `schemas/tools/tool-release.ts` and `schemas/tools/tool-profile.ts`.",
    title: "Tool releases",
    renderable: false,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `binary-release`.
    schema: "schemas/tools/tool-release.ts",
    // Both families listed: declaring `nodeSchemas` claims the map is
    // complete, and `check:kind-validators` routes each file by its tag. The
    // validators are `validators/tool-release.json` and
    // `validators/tool-profile.json` (bean riit: no authored kind carries
    // validator code).
    nodeSchemas: {
      "folio-tool-release/v1": {},
      "folio-tool-profile/v1": {},
    },
    summary:
      "External tool releases -- one `folio-tool-release/v1` document per tool at one version, " +
      "with its sha256, its source (an OCI image only by digest), its SPDX licence, how to run " +
      "it, and the runtimes that release needs, injected rather than inherited -- and the named " +
      "`folio-tool-profile/v1` sets a run selects. A profile never names a runtime.",
  },
  // Software libraries -- the outside libraries a layer's code IMPORTS, one
  // node per library per layer, at the version that layer's lockfile pins.
  //
  // Option D of bean `jbvi` (owner, 2026-10-24 08:25Z, "D. Shared core"):
  // `tool-release` and this kind both extend `schemas/library/outside-software.ts`'s
  // core (name, version, digest, source, SPDX licence), and each adds what
  // only it has. A tool release is RUN and keeps its entry and its sha256; a
  // library is IMPORTED, has no entry, and carries the sha512 `bun.lock`
  // records. Folding the two into one kind (option A) would have bent two of
  // `tool-release`'s four rules, so they stay two kinds on one core.
  //
  // cat-harness OWNS the kind; each NODE lives in the layer that imports the
  // library, under that layer's own `libraries/`, declared in that layer's
  // `<name>.json`. A library several layers share has one node in each,
  // because each layer pins its own version.
  //
  // `derived`, by `library`'s argument: a node is produced from the layer's
  // `package.json`, `bun.lock` and the installed package, and regenerated
  // (`libraries:derive`) rather than re-authored, so a finding against one is
  // a finding against its writer -- or against the lockfile it read. NOT
  // `content` as `tool-release` is: a tool pin is a decision a person makes;
  // a library node restates a decision already made in `package.json`.
  //
  // NOT `perInstance`: no layer gets an empty `libraries/` made for it. A
  // layer that imports nothing has nothing to declare, and a layer that does
  // declares its own directory in its own declaration.
  //
  // NOT renderable: the site build does not read it.
  "software-library": {
    description:
      "the outside libraries a layer's code imports (`libraries/`) — one `software-library/1.0.0` node per library, in the layer whose `package.json` declares it, carrying the outside-software core it shares with `tool-release` (name, the version `bun.lock` pins, the digest `bun.lock` records — sha512 — the registry tarball it came from, and the SPDX licence read from the installed package's own `package.json`) plus the `range` the layer asks for, whether it is a dev dependency, `usedBy` (the layer's files that import it) and `shim` (the `types/*.d.ts` that types it, when one exists). A bundle the layer keeps rather than installs (`vendor/<name>/<version>/`) is a node too, `software-library/1.1.0` with `vendored: { path }` and no `range` or `dev`, its name, version, tarball and digest read from the bundle's manifest and its licence from the bundle's own files (owner, 2026-10-26: \"A. Record as vendored\"); a node a layer cannot hold itself, because it sits below this kind (bootstrap-tools), is held by the writer's layer under `libraries/held/<layer>/` and says which layer it describes in `layer`, `software-library/1.2.0` (owner, 2026-10-30, bootstrap-tools#44: \"A. Holder records, keyed by layer\"); every other node is still stamped 1.0.0, the oldest version with every field it uses. Option D of bean `jbvi` (owner, 2026-10-24): one shared core, two kinds. A library several layers share has one node per layer, because each layer pins its own version. `derived`: written by `libraries:derive` from the layer's `package.json`, `bun.lock` and installed packages, and gated by `libraries:check`, which fails on a stale node, an import no node names, and a shim no node names. Shapes in `schemas/library/software-library.ts` (a node kind whose parent is the `outside-software` mixin) and `schemas/library/outside-software.ts`.",
    title: "Software libraries",
    renderable: false,
    holds: "derived",
    // declared-path-literal: this table IS the declaration, as on `tool-release`.
    schema: "schemas/library/software-library.ts",
    // The validator is `validators/software-library.json` (bean riit: no
    // authored kind carries validator code). Every node is written by
    // `libraries:derive`, hence `generated`.
    // Three families of one kind: 1.0.0 for a node of a `package.json`
    // dependency, 1.1.0 for a vendored bundle, 1.2.0 for a node held for a
    // layer below the kind (`librarySchemaTag`), each with its own validator
    // node, all on `SoftwareLibraryKind`.
    nodeSchemas: {
      "software-library/1.0.0": { generated: true },
      "software-library/1.1.0": { generated: true },
      "software-library/1.2.0": { generated: true },
    },
    summary:
      "Outside libraries a layer imports or vendors -- one generated `software-library` node per library per layer, " +
      "with the version and sha512 its `bun.lock` pins, its SPDX licence, its range, whether it is a dev " +
      "dependency, the files that import it and the shim that types it. Shares its core with `tool-release`.",
    // A cube on a hook: a package pulled in by an import. Tool-release's tone,
    // because the two kinds are one family on one core.
    avatar: {
      glyph: "M12 7l7 4v7l-7 4-7-4v-7l7-4zm0 0v15m-7-11l7 4 7-4M12 7V5a2 2 0 1 1 2 2",
      tone: 60,
      reads: "a package on a hook — a library pulled in by an import, at the version its lockfile pins",
    },
  },
  // A web app a layer holds as source and publishes as its own chrome-less
  // page (owner, 2026-11-11, cards Q-GAME-5 A and Q-GAME-7 A): so a content
  // layer carrying an app (the GDHCN onboarding game) need not be a harness,
  // and no layer keeps a one-off publish script for it. Authored, so
  // `content`; drawn by the harness's `apps` visualiser (`web-app-build`).
  "web-app": {
    anyLayer: true,
    description:
      "a web app the layer holds as source (`package.json`, a lockfile, the app's code and media) and publishes as a page of its own: one `web-app/0.1.0` file, `web-app.json`, at the directory's root names its id, title, how it builds, the languages it ships and the layer directories it reads at build time. The harness's `apps` visualiser, rendered by the `web-app-build` Tool, builds it at publish and writes the build to `<locale>/<harness>/apps/<id>/`, with no site chrome; nothing else loads it, so a reader downloads it only by opening its route. Shape in `schemas/ui/web-app.ts`.",
    title: "Web apps",
    renderable: false,
    publishedByBuild: true,
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `device-screen`.
    schema: "schemas/ui/web-app.ts",
    nodeSchemas: {
      "web-app/0.1.0": {},
    },
    summary:
      "A web app held as source and published as its own chrome-less page, built at publish by " +
      "the web-app-build Tool and loaded only when a reader opens its route.",
  },
  // A published static site, as a graph (bean `lehh`, owner 2026-10-05). Two
  // capability tiers, both declared now so a real CDN has a kind to land in:
  // `basic-cdn-site` serves files by path and nothing more (GitHub Pages);
  // `cdn-site` adds media types, redirects and headers (the IRIS replica's CDN, beans
  // l9v6 and xies). A site is an archive with routes: its files reuse
  // ArchiveEntrySchema, and the kind adds the route layout.
  "basic-cdn-site": {
    description:
      "a published static site on a CDN that serves files by path only: no media-type mapping, no redirects, no headers. One `basic-cdn-site/1.0.0` document describes it: its root URL, its routes (the release root, the staging-preview template `STAGING/<slug>/`, the per-instance sub-sites), the commit it was built from, and its files as archive entries. `derived`: built from the renderable graphs its directory's `derivedFrom` names, by a build Tool, and put on the CDN by the Tool its `storage.tool` names. GitHub Pages is one such CDN.",
    title: "Basic CDN site",
    renderable: false,
    holds: "derived",
    serialised: false,
    // declared-path-literal: this table IS the declaration, as on `binary-release`.
    schema: "schemas/kg/site.ts",
    nodeSchemas: {
      "basic-cdn-site/1.0.0": {},
    },
    summary:
      "A published static site on a CDN that serves files by path only (GitHub Pages): its routes, " +
      "the commit it was built from, and its files as archive entries. Built from the renderable graphs " +
      "its directory names, and deployed by the Tool its storage names.",
  },
  "cdn-site": {
    description:
      "a published site on a CDN that also controls media types, redirects and response headers. One `cdn-site/1.0.0` document: everything a `basic-cdn-site` carries, plus `mimeTypes`, `redirects` and `headers`. Declared ahead of its first instance so a CDN deployment (the IRIS replica, beans l9v6 and xies) lands in a kind rather than widening `basic-cdn-site`, whose point is what it cannot do.",
    title: "CDN site",
    renderable: false,
    holds: "derived",
    serialised: false,
    // declared-path-literal: this table IS the declaration.
    schema: "schemas/kg/site.ts",
    nodeSchemas: {
      "cdn-site/1.0.0": {},
    },
    summary:
      "A published site on a CDN that also controls media types, redirects and headers: " +
      "a `basic-cdn-site` plus those three. No instance declares one yet.",
  },
  // Named editorial voice profiles, overlaid on the base house voice. A
  // separate kind from `kg` because a voice is OPT-IN per folio while a skill is
  // simply available: the activation list in `harness.config.json` is what makes
  // a voice apply, and a graph typology that conflated the two would have no place
  // to record that this layer ships four voices and activates none.
  voices: {
    description:
      "editorial voice profiles — one JSON each, `\"$schema\": \"folio-voice/v1\"`. Every rule cites its source. **Opt-in**: shipping a voice does not apply it.",
    title: "Voices",
    perInstance: true,
    renderable: false,
    // THE FROM-WITHIN NODE, as on `docs` (owner 2026-09-30, bean `rkqp`:
    // "vendors/<id>/ should be declared subgraphs along with vendors/").
    // `skills/voices/voices.json` names the sub-graphs a voices directory
    // holds; only those are read as part of it. Absent means none.
    declarationFile: "voices.json",
    // An authored rule set. A voice is true whether or not any prose has been
    // written against it.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    summary:
      "Editorial voice profiles — one JSON each, carrying `\"$schema\": \"folio-voice/v1\"`. " +
      "Every rule cites the ingested source or KG node it was derived from. Opt-in per folio.",
  },
  // ── SUB-GRAPH OF `voices` — bean `rkqp`, owner 2026-09-30 ──────────────
  //
  // A vendor voice specialises a base voice for one agent vendor (Claude,
  // Gemini CLI, ...). ONE kind serves both levels: `vendors/` and each
  // `vendors/<id>/` hold the same thing, vendor voice profiles, and a kind
  // says what is held rather than how deep. `vendors/vendors.json` declares
  // each `<id>/`; the chain stops where a directory carries no declaration.
  "voice-vendors": {
    description:
      "a base voice specialised for one agent vendor — `folio-voice/v1` with `extends` naming the base. A **sub-graph of `voices`** (`within: \"voices\"`), declared from within: `voices/voices.json` names `vendors/`, and `vendors/vendors.json` names each `<id>/`. `loadVoices` descends only where a declaration says to and **refuses** an undeclared voice directory rather than skipping it. Bean `rkqp`, owner 2026-09-30.",
    title: "Voice vendors",
    renderable: false,
    within: "voices",
    declarationFile: "vendors.json",
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `voices`.
    summary:
      "Vendor voice profiles — a base voice specialised for one agent vendor, " +
      "`folio-voice/v1` with `extends` naming the base. A sub-graph of `voices`, " +
      "declared from within by `voices.json`, each vendor declared by `vendors.json`.",
  },
  // Themes a layer DERIVED from a source it holds — a served stylesheet or
  // a style guide's stated rules. A separate kind from `folio` because a theme
  // is not read: it dresses what is. Separate from `kg` for the reason `voices`
  // is, one step further along — a voice is opt-in per folio, and a theme is
  // opt-in per SURFACE, so neither belongs in the graph of things simply
  // available.
  //
  // The platform's own twelve themes are NOT this graph. They are furniture in
  // `cat-harness/schemas/ui/themes.ts`, and the root AGENTS.md draws the line they
  // would cross: a palette read off a WHO style guide is subject matter, and
  // subject matter does not live in the platform. This kind is what gives it
  // somewhere else to live that a declaration-driven consumer can still find.
  themes: {
    description:
      "themes an instance DERIVED from a source it holds — a served stylesheet, or a style guide's stated rules. One Theme node each, carrying `kind: sticky \\| webpage \\| publication`; the palette vocabulary is shared across every kind and only the geometry varies. Every value cites where it was measured. NOT the platform's own twelve themes, which are furniture in `cat-harness/schemas/ui/themes.ts` — a palette read off a WHO style guide is subject matter.",
    title: "Themes",
    renderable: false,
    // Authored-from-a-source, like `voices` and for the same reason: a theme is
    // true whether or not anything has been rendered with it. The DERIVATION
    // does not make it state — `catalogue` settles that argument two entries
    // up, and the same answer holds here.
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    summary:
      "Themes derived from an instance's own sources — one Theme node each, carrying " +
      "`kind: sticky | webpage | publication`. The palette vocabulary is shared across " +
      "every kind and only the geometry varies; every value cites where it was measured.",
  },
  "document-kinds": {
    description:
      "DOCUMENT KINDS a harness contributes — named structures of sections a document authored with it follows, `fixed` (exactly these sections) or `semi-fixed` (these required, others allowed). One `document-kind/1.0.0` JSON each; every kind and section names its sources, and `computedFrom` names the declared graphs a section derives from. Not a content profile: a profile constrains which BLOCK KINDS a folio may contain and is a compile-time union in core; a kind is a structure, contributed as data. Stage D5 of the smart-* separation, #1767.",
    renderable: false,
    // Authored-from-a-source, like `themes`: a document kind is true whether
    // or not any document has been written in it yet. Core knows that kinds
    // exist and never which — a harness contributes its own as data (stage
    // D5 of the smart-* separation, #1767, bean `qvxh`).
    holds: "content",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "document-kind/1.0.0": {},
      // How one subject realises a kind, computed by the kind's owner — a
      // second family in this directory because it is DERIVED from another
      // graph (an IG's artefact index), where the kind is authored.
      "document-kind-coverage/1.0.0": {},
    },
    summary:
      "Document kinds — named structures of sections (fixed or semi-fixed) that a document " +
      "authored with a harness follows, one `document-kind/1.0.0` JSON each, plus computed " +
      "`document-kind-coverage/1.0.0` reports of how a subject realises one. Every kind and " +
      "section names its sources; `computedFrom` names the declared graphs a section derives from.",
  },
  "todo-feedback": {
    description:
      "feedback items — todos raised against a specific block, carrying the submitter's identity. Read by `todo-review`.",
    title: "Todo feedback",
    renderable: false,
    // As `todos`, plus a submitter's identity — which makes it more obviously
    // a record OF something rather than the something.
    holds: "state",
    // declared-path-literal: this table IS the declaration, as on `health`.
    recordsWork: false, // live state, but nothing anybody is partway through
    summary:
      "Feedback items — todos raised against a specific block, carrying the submitter's " +
      "identity. Read by the `todo-review` skill.",
  },

  // ── The one kind that is not-rendered ON PURPOSE ──────────────────────
  //
  // Every other kind above is `renderable: false` because it is a graph a
  // TOOL reads and there was never a page to make of it. `fsh-guts` is
  // different in kind: its contents COULD be rendered and deliberately are
  // not. It exists so that something can be KEPT without being PUBLISHED.
  //
  // Owner, 2026-09-19: "do not pollute the KG with SDLC churn … it is the
  // trashcan that does not get rendered but … where deprecated, throwaway
  // stuff goes … do not delete unless explicit confirm."
  //
  // **This is what makes the never-delete rule enforceable beyond beans.**
  // `AGENTS.md` already forbids deleting a bean, and gives a reason that was
  // always general: a scrapped item records that something was considered
  // and rejected, which stops the next agent re-entering the dead end, while
  // a deleted one leaves a sibling unable to tell abandonment from accident.
  // An agent removing a page, a diagram or a script had only `rm` and so the
  // rule could not apply to them. Now delete means relocate, and relocate is
  // reversible.
  //
  // On the name: `.fsh` is FHIR Shorthand in this codebase (the DAK layer's `schemas/dak.ts`,
  // `jsonld.ts`, `translation-tools.ts`, `block-qa.ts`) and throughout the
  // WHO SMART folios this platform targets. The collision was raised and the
  // owner confirmed the spelling; it is recorded here so the overlap is met
  // as a known fact rather than rediscovered as a defect.
  // Agent memory — durable facts an agent carries between sessions.
  //
  // `context`, and it is the kind the third value was added FOR. The owner,
  // settling bean `mhh9` on 2026-09-20: "put memory under state/context as
  // static, during a process. it does not change. agents dont work on it
  // (except when an authoring agent is directed by human). todos, beans are
  // not static."
  //
  // Every clause of that is the `context` definition. A running process READS
  // memory and no step writes it; a step that did would be a defect rather
  // than an update. It changes when a human directs an authoring agent to
  // change it, which is an act OUTSIDE any layer.
  //
  // That is also what separates it from `todos`, its mirror in the 2x2
  // `todos/todos.json` states. Both were called "memory" there — human and
  // agent — and the axis cuts ACROSS that: a todo is an OUTSTANDING ITEM a
  // process closes, so it is live `state`, while a memory entry is an
  // ESTABLISHED FACT nothing mid-process revises. Same quadrant row, opposite
  // sides of this line.
  //
  // DECLARED at `memory/`, repository-scoped, since bean `07xs` — the same
  // day this kind was registered. It was registered ahead of its directory for
  // a few hours, which is the `folio` situation rather than the `dh4f` one:
  // `dh4f` is a DIRECTORY declared and absent, where a consumer scans nothing
  // and reports clean, and nothing scans a kind.
  // A SESSION's context — who is acting, which layers are open, what it
  // waits on. `state`: the session writes it as it goes.
  //
  // Distinct from `workflow-state`, and the line is not a nicety.
  // `workflow-state` is where ONE INSTANCE got to; a session SPANS processes —
  // it starts before any layer, may open several, and outlives each. A
  // session with nothing open is the commonest state there is, and would be
  // unrepresentable as a field on a layer.
  //
  // REGISTERED AHEAD OF A DIRECTORY, like `memory` and like `folio`: nothing
  // writes a session record yet (bean `3nfv` is the state machine that will),
  // and declaring a directory before it exists is the `dh4f` defect, where a
  // consumer scans nothing and reports a clean run. Nothing scans a kind.
  "session-state": {
    // declared-path-literal: the description is the kind table's prose
    // (generated by kind:table, bean dmx1) and names the shape module for a
    // reader; `schema` below is the declaration.
    description:
      "a SESSION's context — the acting actor, the instances it has open, the beans it claimed and what it waits on. Distinct from `workflow-state`, which is where ONE instance got to: a session spans processes, and a session with nothing open is the commonest state there is. `actor` is required because nothing else can supply it. **Registered ahead of a directory**: nothing writes one yet, and the state machine that will is bean `3nfv`. Shape in `schemas/sdlc/session-context.ts`; read with [`session-context`](../../process/workflow/session-context.md).",
    title: "Session state",
    renderable: false,
    holds: "state",
    recordsWork: false, // live state, but nothing anybody is partway through
    schema: "schemas/sdlc/session-context.ts",
    validatorNotApplicable:
      "no instance declares a directory of this kind in this repository, so it has no nodes to validate. If one " +
      "appears this reason stops being true, and the declaration should go with it.",
    summary: "A session's context — the acting actor, the instances it has open, and what it waits on.",
  },

  // Interaction preferences — how a PERSON wants to be asked.
  //
  // `context`, by the same test as `memory`: an agent READS it at session
  // start and no step writes it; it changes when a person states a
  // preference, which is a human-directed act outside any layer. The two
  // are the same shape at different subjects — what the agent knows, and what
  // the person needs.
  //
  // It lived in `.harness/` until 2026-09-20, undeclared, which was not a
  // choice anyone could have defended: this repository's own dot-prefix guard
  // REJECTS a dot-prefixed segment, so the file was in the one place the
  // conventions forbid while being read at the start of every session.
  interaction: {
    description:
      "how a PERSON wants to be asked — committed, read at session start by every agent. `context`: read during a process, never written by one; it changes when a person states a preference. Also `harness.config.json`'s `interaction` key, which defaults here, so the declaration and the config name one place.",
    title: "Interaction",
    renderable: false,
    holds: "context",
    // `schema` pointed at `harness-config.ts` until 2026-09-24, and that was
    // wrong in a way worth naming rather than quietly correcting: that module
    // holds the PATH to the node (`interaction: z.string().default(...)`), not
    // its shape. A pointer to where a fact is NOT written is worse than none,
    // because a reader who follows it concludes the shape is undeclared on
    // purpose. Bean `3oqj`; `audit-coverage` is what surfaced it.
    schema: "schemas/conduct/interaction.ts",
    // declared-path-literal: this table IS the declaration, as on `health`.
    nodeSchemas: {
      "folio-interaction/v1": {},
    },
    summary: "How a person wants to be asked — read at session start, never written by a process.",
  },
  // The marks an agent leaves on an issue it has read.
  //
  // `state`: a running process writes one each time it checks an issue. NOT
  // the comments — the files carry `lastCommentId`, `lastUpdatedAt` and
  // `checkedAt`, and one of the two in this repository says so in its own
  // note: "the mark records only that the newest was seen". A kind named for
  // the comments would promise a reader the bodies.
  //
  // Two marks rather than one, because a comment EDITED after being read
  // keeps its id: the id alone would call it seen, and an edited requirement
  // is a changed requirement (`issue-working`).
  // The adversarial review verdict on a pull request's head (bean `w8jq`).
  //
  // `state`: a reviewing session writes one per PR head it reviews, and the
  // merge gate (`check:adversarial-review`) reads it. On its OWN branch, by
  // the owner's ruling of 2026-10-20 ("State branch"): a verdict committed
  // INTO the pull request moves the head it names, so it was stale the moment
  // it landed and no pull request could reach `clean`. Keyed by head sha, so a
  // push after the review leaves the old verdict naming a commit that is no
  // longer the head, which is exactly what `stale` should mean.
  "merge-reviews": {
    description:
      "the adversarial review verdict on a pull request's HEAD — one `merge-review/v1` file per head, `<head sha>.json`, naming `base_sha`, `head_sha` and the reviews with their RED FLAG findings. Written by a reviewing session that is not the author, read by `check:adversarial-review`. On its own branch so that recording a verdict never moves the head it is bound to. Method: [`adversarial-code-review`](../../../sdlc/skills/sdlc-core/adversarial-code-review.md); shape in `schemas/sdlc/red-flag.ts`.",
    title: "Merge reviews",
    renderable: false,
    holds: "state",
    recordsWork: false, // a verdict, not work anybody is partway through
    schema: "cat-harness:schemas/sdlc/red-flag.ts",
    // declared-path-literal: this table IS the declaration, as on `issue-marks`.
    nodeSchemas: {
      "merge-review/v1": {},
    },
    summary: "The adversarial review verdict on a pull request's head, one file per head sha.",
  },

  "issue-marks": {
    description:
      "how far an agent has read an issue — `lastCommentId`, `lastUpdatedAt`, `checkedAt`, one file per issue. **Not the comments**: an id and two timestamps, never a body. Two marks because a comment EDITED after being read keeps its id. Read with [`issue-working`](../../../sdlc/skills/sdlc-core/issue-working.md); shape in `src/issue-watch/seen-comments.ts`.",
    title: "Issue marks",
    renderable: false,
    holds: "state",
    recordsWork: false, // live state, but nothing anybody is partway through
    schema: "cat-harness-tools:src/issue-watch/seen-comments.ts",
    // declared-path-literal: this table IS the declaration, as on `health`. The
    // shape was a TypeScript interface until 2026-09-24 — the `schema` /
    // `validator` divergence this field's own doc uses `qa` to illustrate — so
    // `check:kind-validators` reported the kind as could-not-determine and
    // `audit-coverage` as reached by nothing. `SeenState` is now derived from
    // the Zod schema, so the two cannot drift. Bean `3oqj`.
    nodeSchemas: {
      "folio-issue-mark/v1": {},
    },
    summary: "How far an agent has read an issue — the comment id and the edit time it accounted for.",
  },

  memory: {
    description:
      "agent memory — durable facts an agent carries between sessions, one `\"$schema\": \"folio-memory/v1\"` node each. Read during a process and never written by one; it changes when a human directs an authoring agent. Declared at `memory/`, **repository-scoped** — these are facts about the repository carried by the agents working in it, and `.claude/agents/` sits at the repository root too. They were in `skills/memory/` until 2026-09-20 (bean `07xs`), where the containing kind was `content` and the contents were `context`.",
    title: "Memory",
    renderable: false,
    holds: "context",
    // declared-path-literal: this table IS the declaration, as on `health` — a validator is a
    // module#Export resolved by resolveKindValidator. Read by gen-uml-overview.ts to draw the nodes.
    summary: "Durable facts an agent carries between sessions. Read during a process, never written by one.",
  },

  // A confirmation the owner gave IN ADVANCE — `skills/conduct/conduct-core/confirmation-waiver.md`.
  //
  // Owner, 2026-09-20: "human can waive confirmation rights (e.g. for session,
  // for process run)", and "context dependent, should be in memories".
  //
  // `context` by exactly the test that settled `memory` above — a running
  // process READS a waiver before a gate fires and no step writes one; it
  // changes when a person grants or withdraws permission, which is an act
  // OUTSIDE any layer. That is why it is declared over the SAME directory:
  // `memory/` holds both, and the two are told apart by the `$schema` tag
  // inside each file rather than by where it sits. A directory is a place to
  // look and may hold more than one part of a graph.
  //
  // A kind of its own rather than a fourth memory label, and the reason is
  // structural: `MemoryNodeSchema` carries NO status by design — "a TRAP is
  // not open, and marking one done would assert that the failure it records
  // has stopped being possible". A waiver's whole content is that it EXPIRES.
  // Labelling one `stable` would assert the opposite of what the node says.
  waiver: {
    description:
      "confirmations a person granted **in advance** — one `\"$schema\": \"folio-waiver/v1\"` node each, naming one gate class, scoped to a session or a process run, and carrying an expiry. Declared over the **same directory as `memory`**, `memory/`, and told apart from it by that tag rather than by a subdirectory: a directory is a place to look and may hold more than one part of a graph. `context` by the same test as `memory` — a process reads a waiver before a gate fires and no step writes one. Skill: [`confirmation-waiver`](../../conduct/conduct-core/confirmation-waiver.md).",
    title: "Waivers",
    renderable: false,
    holds: "context",
    schema: "schemas/conduct/waiver.ts",
    // declared-path-literal: as on `health` and `translation-sources` — this
    // table IS the declaration, so resolving `validator` through one would be
    // reading it from here. `check:kind-validators` proves it still loads.
    summary:
      "Confirmations a person granted in advance — each naming one gate, scoped to a session or a process run, each expiring.",
  },

  "fsh-guts": {
    // A NEW layer keeps its trashcan on `cat/<instance>/fsh-guts`, the way
    // `beans` and `todos` are kept (owner, 2026-10-06: "cutover dirs should go
    // to fsh-guts"; `state:seed --cutover` refuses without one). A STORAGE
    // fact, and independent of `holds` below: the cutover's deposit is a
    // write the owner confirms, not one a running step makes on its own, so
    // the kind stays `context`. folio_init only — see the field.
    newInstanceSource: { kind: "branch", keyedBy: "tip" },
    published: false,
    description:
      "Deprecated and throwaway structured content — kept, addressable and exported, and deliberately absent from the site. The destination for anything that would otherwise be deleted. **THAT IS TRUE AGAIN AS OF 2026-09-23, AND WAS NOT FOR SOME TIME.** The kind also held `proposals/` — the LIVE design corpus, cited as the governing scheme by seven skills and four code modules — so an agent that read this row, learned the kind was throwaway and skipped it had skipped the schemes it needed. That is exactly what happened (bean `5kn6`): a session proposed three options for a question `instance-versioning.md` §3.3 and an owner ruling of 2026-09-20 had already settled. **The owner's fix was to move them, not to re-describe the kind** — *\"proposals not in fsh-guts but docs/ for needed &lt;stub&gt;\"* — so proposals now live in the `docs/` of the instance whose stub they concern, published rather than hidden. What remains here is `retired/` and one-off migration `scripts/`, which are what the label always described. **The lesson survives the fix**: a kind whose name tells an agent to skip it must not hold anything an agent needs.",
    renderableNote: "on purpose",
    title: "FSH guts",
    renderable: false,
    // The one that reads like content, and the one `context` moved. What is
    // in here is deprecated or superseded, so the fact it carries is WHERE
    // SOMETHING GOT TO — which is why it is deliberately absent from the
    // rendered site while being renderable in principle. But no running step
    // writes it: relocating something here is a HUMAN-DIRECTED act, and
    // `deletion-requires-confirmation` is the skill that says so in as many
    // words. Read, never written by a process — which is `context`, and it
    // was `state` for the few hours between the axis landing and `mhh9`
    // being settled. Classified state by the owner 2026-09-20; the refinement
    // the same day moved it, by the same criterion that moved memory.
    holds: "context",
    // declared-path-literal: this table IS the declaration, as on `health`.
    summary:
      "Deprecated and throwaway structured content — kept, addressable and exported, and " +
      "deliberately absent from the rendered site. The destination for anything that would " +
      "otherwise be deleted, and for SDLC churn that must not reach the folio's readers.",
  },
  // The gettext side of translation: `.pot` templates, `.po` catalogues and
  // the `TranslationNode` manifests that make each pair addressable.
  //
  // THE INPUT TO INJECTION, NEVER THE OUTPUT — and there is deliberately no
  // matching kind for the output. A rendered translation is the SAME KIND OF
  // THING as the page it translates: renderable content, differing by a
  // field. `docs/fr/index.md` declares `lang: fr` and `translation_source:
  // index.md` in its own front matter, exactly as a bean declares its status
  // and a workflow instance declares its `$schema`, so the file answers what
  // it is and the directory does not have to be enumerated.
  //
  // An earlier cut of this (PR #351, first draft) added a `translated-content`
  // kind and a `locale` field, with one declaration per locale subtree — ten
  // entries for five locales across two subtrees, growing as
  // O(locales x subtrees). It restated in `cat-harness.json` what all ten
  // files already said in their own front matter, which is one fact in two
  // places and free to drift. The owner's framing is what settles it:
  // "narrative/audio/visual content with text should be translatable. its not
  // so much the node schema itself but its content (e.g. markdown, bpmn)
  // should be translatable" — translatability is a property of a FORMAT
  // within a content type, which `schemas/library/translation-tools.ts` already
  // declares, not a property of a directory.
  //
  // `.po` catalogues are different: they are not content in any language, and
  // `translations/` was undeclared entirely until 2026-09-19 — the `dh4f`
  // defect in reverse, five committed directories that no declaration
  // mentioned. That is what this kind is for.
  // The root declaration of a SUBSCRIBED substrate, cached at its pin by
  // `kg:subscribe` (issue #1719, slice 4). DERIVED, by the test the other
  // derived kinds pass: it is produced from a source — the substrate's bytes
  // at a commit — and regenerated by re-running the command, never edited.
  // Not `content`: nobody here authors it, and a finding against it is a
  // finding against the substrate or the fetch. Not `context`: `kg:subscribe`
  // writes it, and a process writing a `context` graph is a defect.
  "substrate-snapshot": {
    description:
      "the declaration of each Knowledge Graph this instance SUBSCRIBES to (`subscriptions/`) — at the substrate's root, or in the one directory the entry's `upstreamPath` names (a fork that keeps its instance one level down, bean `437w`) — one `folio-substrate-snapshot/v1` file per `subscriptions` entry: the upstream bytes at the pinned commit, their sha256, and the harnesses and subgraphs the substrate offers. **Two kinds, never folded together** (owner, 2026-10-06): a **substrate** declares at least one harness (bootstrap's definition, unchanged); a **content** Knowledge Graph declares Subgraphs and no harness — a FHIR IG — and is recorded as `kind: \"content\"` on both the entry and the snapshot, chooses no harness, is refused by `kg:instantiate`, and contributes no skills, processes or roles to any overlay. A declaration with neither is refused. `derived`: written by `bun run cat kg:subscribe` from somebody else's bytes and regenerated, never edited; `kg:subscribe:check` re-hashes and re-judges each one offline. It WRAPS the upstream `<name>.json` rather than copying it, because a bare copy carries `name` equal to its stem and would read as an instance declaration to every scanner. Issue #1719.",
    title: "Substrate snapshots",
    renderable: false,
    holds: "derived",
    serialised: false,
    // declared-path-literal: this table IS the declaration, as on `health`.
    // ONE family, so `validator` rather than `nodeSchemas`: a `nodeSchemas`
    // map claims nodes exist to route, and `check:kind-validators` fails one
    // that examined none — the right rule, and false here until the first real
    // subscription, which this tree deliberately does not carry. Every node is
    // tagged `folio-substrate-snapshot/v1` regardless, so moving to
    // `nodeSchemas` then is a one-line change.
    //
    // A SECOND family now lives here too, and the validator does not cover it:
    // the `folio-kg-materialization/v1` part records `kg:materialize` writes
    // (slices 5-6). Their schema embeds core's `MaterializationSchema`, so it
    // is core's (its `schemas/kg-materialization.ts`) and
    // this registry cannot name it without pointing up the arrow. They are
    // JUDGED by `kg:materialize:check` instead; `kg:validate` on one reports
    // it against the snapshot schema, which is a known gap, not a verdict.
    summary:
      "The root declaration of each Knowledge Graph this instance subscribes to, cached byte for byte at " +
      "the pinned commit with its fixity, and what the substrate judgement found in it; and each chosen " +
      "subgraph or asset materialised from it, with its fixity, provenance and gate answers.",
  },
  // The other half of `subscriptions/`, split off by the owner on 2026-10-30
  // (bean `w1gy` finding 1, option C, "split the directory"). The snapshot
  // directory holds upstream's bytes and is declared `readOnly`; what
  // `kg:instantiate` writes is the subscriber's own working state, so it gets
  // a directory of its own whose layer says so. Before the split the state
  // sat at `<snapshot dir>/<subscription>/harnesses/<harness>/` (gap G11),
  // and one directory could not answer `readOnly` for both.
  "subscribed-harnesses": {
    description:
      "the STATE directories of each harness this instance instantiated from a KG subscription (`kg:instantiate`): `<subscription>/<harness>/<state path>/`, one home per chosen harness, keyed by subscription first so two subscriptions never share one, each state directory the harness declares created with a `.gitkeep`. The harness's processes write here. Apart from `substrate-snapshot` on purpose: that directory is somebody else's bytes, read-only, and this one is the subscriber's own working state (owner, 2026-10-30, bean `w1gy` finding 1, option C). Issue #1719.",
    title: "Subscribed harness state",
    renderable: false,
    holds: "state",
    recordsWork: false, // the homes are made here; what a harness's processes then write is typed by that harness's own kinds
    // declared-path-literal: this table IS the declaration, as on `health`.
    validatorNotApplicable:
      "a home holds the subscribed harness's own state directories, whose nodes are typed by THAT harness's " +
      "graph typologies (its snapshot names them), not by this one; `kg:instantiate` writes only directories " +
      "and `.gitkeep` files, which have no shape to parse.",
    summary:
      "The state directories of each harness instantiated from a KG subscription, one home per subscription " +
      "and harness, kept apart from the read-only snapshots.",
  },
  "translation-sources": {
    description:
      "the gettext side of translation — `.pot` templates, `.po` catalogues and their `TranslationNode` manifests, one directory per target locale. The INPUT to injection; there is deliberately **no kind for the rendered output**. Read with the [`translation-manager`](../../library/library-core/translation-manager.md) skill; shape in `schemas/content/translation.ts`.",
    title: "Translation sources",
    perInstance: true,
    renderable: false,
    // A `.po` catalogue and its manifest are authored content in another
    // language, not a record of a translation having happened.
    holds: "content",
    summary:
      "POT templates, PO catalogues and their `TranslationNode` manifests, one directory " +
      "per target locale. The INPUT to injection; the rendered output is ordinary content " +
      "that declares its own `lang`.",
    schema: "schemas/content/translation.ts",
    // `TranslationConfigSchema`, not `TranslationNodeSchema`: this graph's
    // directory holds the CONFIG that declares the sources, and a node is
    // reached through it. Naming the node schema would validate the wrong
    // file and pass.
    // declared-path-literal: as above — the vocabulary cannot resolve itself
    // through the vocabulary. `check:kind-validators` proves it resolves.
  },
};

/** A graph typology name. Open, not a closed union — downstream layers add kinds. */
export type GraphTypology = string;

/** Thrown when a kind is registered twice with different meanings. */
export class GraphTypologyConflictError extends Error {
  constructor(name: string, detail?: string) {
    super(
      `graph typology "${name}" is already registered with a different definition` +
        (detail ? ` (${detail})` : "") +
        `. Kinds are a shared vocabulary — rename, or register once.`,
    );
    this.name = "GraphTypologyConflictError";
  }
}

/**
 * The graph-typology vocabulary, extensible by the layers above the harness.
 *
 * A layer registry rather than a bare module constant, so that a test — or
 * a process resolving more than one layer — cannot leak registrations into
 * the next. `defaultGraphTypologies` is the convenience shared layer; every read
 * accepts an explicit one.
 *
 * Registration is **idempotent for an identical definition** and throws on a
 * conflicting one, the same rule `schemas/content/contributions.ts` uses: a diamond
 * dependency graph reaches core twice and must not fail for it, while two
 * different layers claiming one name is a real collision.
 */
/**
 * Graph typologies that were renamed, mapped to what they are now.
 *
 * ## Why an alias and not a sweep
 *
 * `AGENTS.md` is explicit that **overrides match on the entry's `id`, not its
 * `path`** — "matching on path makes two knowledge graphs out of one
 * relocation, and every consumer then scans a directory that is not there".
 * The same property that makes ids worth having makes renaming one a
 * CROSS-INSTANCE BREAKING CHANGE: a downstream layer overriding `kg` is
 * overriding nothing the moment the kind is called something else, and the
 * failure is silent — it scans, finds nothing, and reports a clean run over
 * it. That is the `dh4f` shape, delivered to somebody else's repository.
 *
 * So the old name keeps working, and says so. Reading a declaration that uses
 * it succeeds and records a deprecation; writing one is never done by this
 * repository's own tooling. The alias is removed only after a release in
 * which it warned.
 *
 * Aliases are resolved ONCE, at the registry boundary, rather than at each
 * call site — a second place that knows the old name is a second place that
 * can forget it.
 */
/**
 * Where a known-but-unregistered kind is registered, for the error message.
 *
 * **The message named the DECLARATION ENTRY and not the caller**, so it
 * pointed at `cat-harness.json` — a file that is correct — while the mistake
 * was a missing import in whichever module happened to read it first. Telling
 * somebody a kind "must be registered" without naming the import leaves them
 * to grep for it.
 *
 * Measured 2026-09-21 before adding this: of the **31 real call sites** of
 * `directoryForGraph`/`directoriesForGraph`, **31 reach the registration**, so
 * nothing is broken today and this is a guard against regression rather than a
 * fix. It is worth having because the repository has already paid for this
 * once — `bunfig.toml` records the suite green locally (3198 pass) and red in
 * CI on the same commit, 2026-09-20, from exactly this load-order dependence,
 * with five files latently order-dependent and CI catching only the first.
 *
 * Deliberately a lookup rather than a field on `GraphTypologyDef`: a kind that is
 * not registered has no def to carry one, which is the whole situation here.
 */
// Exported because `readDeclaration` — which stayed in `cat-harness.ts` —
// names the module to import in its error text. Private to the block until
// the split; the split is what made the consumer external.
export const REGISTRATION_MODULE: Readonly<Record<string, string>> = {
  // declared-path-literal: NOT a declared path — this is the module SPECIFIER
  // a reader must import, quoted inside an error message so the remedy can be
  // pasted. It resolves through the module graph, not through the declaration,
  // so routing it through a directory resolver would be a category error.
  folio: "schemas/kg/folio-graph-typology.js",
};

export const GRAPH_TYPOLOGY_ALIASES: Readonly<Record<string, string>> = {
  kg: "cat-harness",
  // `workflows` was this kind's name for a few hours on 2026-09-21, between
  // the `cat-harness` split and the owner settling the term.
  //
  // PROCESS won on evidence rather than preference. BPMN's own element is
  // `<bpmn:process>`, and WHO's DAK component list — which this platform
  // exists to author against — names "Business processes and decision logic"
  // and "Personas and scenarios". The earlier ruling on bean `rapm`
  // ("prefer workflows over processes") was made before either was checked
  // and is OVERTURNED, not forgotten: the owner, 2026-09-21, *"we have
  // BPMN... seems like process is best"*.
  //
  // An alias rather than a sweep because it is exactly 1:1, which is the one
  // shape this table can express — the `cat-harness` split could not use it
  // and had to keep its umbrella instead.
  workflows: "processes",
};

/** What a declared kind name means now, and whether it was a deprecated spelling. */
export function resolveGraphTypology(name: string): { kind: string; deprecated?: string } {
  const to = GRAPH_TYPOLOGY_ALIASES[name];
  return to ? { kind: to, deprecated: name } : { kind: name };
}

/**
 * Are two registrations of one name the SAME kind, or a conflict?
 *
 * Only the fields that change how a consumer behaves count. `type` is the
 * projected identity, `renderable` decides whether the site build takes it, and
 * `holds` decides whether a consumer asking for content may be handed this —
 * three behavioural facts, and two definitions disagreeing on any of them are
 * two different kinds wearing one name.
 *
 * `summary`, `skill` and `schema` are deliberately NOT compared. They are
 * descriptive: a dependency wording its summary differently is not a conflict,
 * and treating it as one would make a diamond fail on prose.
 *
 * **`holds` was the hole this function exists to close.** The comparison was
 * inline and named `type` and `renderable` only, so when the axis landed, two
 * layers registering one kind on opposite sides of the content/state line would
 * have passed the diamond check and the first would silently have won — the
 * exact "one name, two answers" failure the registry throws to prevent,
 * reintroduced by the field that was added to end it. Named and extracted so
 * the next field added to `GraphTypologyDef` has one place to be considered.
 */
function sameKind(a: GraphTypologyDef, b: GraphTypologyDef): boolean {
  return a.layer === b.layer && a.renderable === b.renderable && a.holds === b.holds;
}

/** The layer whose namespace names a kind: bootstrap's for a kind bootstrap defines. */
export function graphTypologyLayer(name: string, def?: Pick<GraphTypologyDef, "layer">): "bootstrap" | "core" | "harness" {
  if (Object.hasOwn(BOOTSTRAP_GRAPH_TYPOLOGIES, name)) return "bootstrap";
  return def?.layer ?? "harness";
}

/**
 * The layer that declared a kind loaded from a `typologies/` graph: its
 * name (the prefix its terms are written with), root and namespace. Carried on
 * the def under a symbol rather than as a `GraphTypologyDef` field, because it
 * is a fact about WHERE the node was read, which a node cannot declare about
 * itself; a symbol-keyed property survives the `{ ...def }` copies the
 * registry makes when it joins validators.
 */
export const DECLARED_BY: unique symbol = Symbol("graph-typology declared-by");

export interface DeclaringInstance {
  /** The declaration's `stub`, else its `name`: the prefix its terms are written with. */
  readonly prefix: string;
  readonly name: string;
  readonly root: string;
  /** `<iriBase>v<major>/ns/` — {@link instanceNamespaceOf}. */
  readonly namespace: string;
}

type WithDeclarer = { [DECLARED_BY]?: DeclaringInstance };

/** Who declared `def`, when it was read from a `typologies/` graph. */
export function declaringInstanceOf(def: object | undefined): DeclaringInstance | undefined {
  return (def as WithDeclarer | undefined)?.[DECLARED_BY];
}

/** The layer whose declaration holds the node file `file`: the nearest directory up with a declaration. */
function declaringInstanceFor(file: string): DeclaringInstance | undefined {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const decl = findDeclarationFile(dir);
    if (decl === undefined) continue;
    const raw = JSON.parse(readFileSync(resolve(dir, decl), "utf-8")) as { name?: string; stub?: string; iriBase?: string; version?: string };
    if (typeof raw.name !== "string") return undefined;
    const d = { name: raw.name, stub: raw.stub, iriBase: raw.iriBase, version: raw.version };
    return { prefix: d.stub ?? d.name, name: d.name, root: dir, namespace: instanceNamespaceOf(d) };
  }
  return undefined;
}

/**
 * A kind's identity: its `GraphTypology` individual, `<ns>graphTypology/<name>`.
 *
 * `<ns>` is the layer's namespace for a bootstrap or harness kind. A `core`
 * kind is named in the namespace of the layer that DECLARED it, read from
 * that layer's declaration (folio-assistant#2598, owner 2026-10-16): this
 * layer does not know the content layer's address, so a `core` def with no
 * declaring layer throws rather than inventing one.
 */
export function graphTypologyIri(name: string, def?: Pick<GraphTypologyDef, "layer">): string {
  const layer = graphTypologyLayer(name, def);
  if (layer === "core") {
    const by = declaringInstanceOf(def);
    if (by === undefined) {
      throw new Error(`graph typology "${name}" is a core kind with no declaring instance: declare it as a node in that instance's typologies/ graph`);
    }
    return `${by.namespace}graphTypology/${name}`;
  }
  return `${namespaceForLayer(layer)}graphTypology/${name}`;
}

/**
 * The layer that declares the `core` layer's kinds in this registry — the
 * content layer above the harness — or `undefined` when none is composed (the
 * harness standing alone). Read from where the kinds were declared, so no
 * layer below it has to spell its name. Throws when two layers both
 * declare `core` kinds: which one "the content layer" means would then be a
 * guess.
 */
export function contentLayerInstance(registry: GraphTypologyRegistry = defaultGraphTypologies): DeclaringInstance | undefined {
  const found = new Map<string, DeclaringInstance>();
  for (const name of registry.names()) {
    const def = registry.get(name);
    if (def === undefined || graphTypologyLayer(name, def) !== "core") continue;
    const by = declaringInstanceOf(def);
    if (by !== undefined) found.set(by.root, by);
  }
  const all = [...found.values()];
  if (all.length > 1) {
    // The same layer read twice (a checkout and the fixture copy of it) is one layer.
    const names = new Set(all.map((i) => i.name));
    if (names.size > 1) throw new Error(`contentLayerInstance: core kinds are declared by ${[...names].join(", ")}`);
  }
  return all[0];
}

/**
 * The own-prefix table a JSON-LD context binds: the harness's two
 * ({@link NS_PREFIXES}) and, when a content layer is composed, its prefix and
 * namespace as its declaration derives them ({@link contentLayerInstance}).
 * In a composed checkout this is the three-entry table `NS_PREFIXES` held
 * until folio-assistant#2598, key for key and in the same order, so a context
 * built from it is byte-identical; standing alone it is the harness's two.
 */
export function ownPrefixTable(registry: GraphTypologyRegistry = defaultGraphTypologies): Readonly<Record<string, string>> {
  const content = contentLayerInstance(registry);
  return content === undefined ? { ...NS_PREFIXES } : { ...NS_PREFIXES, [content.prefix]: content.namespace };
}

/**
 * Every IRI stem that is OURS: the harness's `own-namespaces` code list and,
 * when a content layer is composed, its namespace and everything minted under
 * `<namespace stem>/` (its DSpace fields, `…/ns/dspace#`). The content layer's
 * were rows of that code list until folio-assistant#2598; a reconciler asking
 * "is this namespace ours" gets the same answer from here as it did from them.
 */
export function ownNamespaceValues(registry: GraphTypologyRegistry = defaultGraphTypologies): readonly string[] {
  const content = contentLayerInstance(registry);
  // declared-path-literal: `ns/` here is a segment of a namespace IRI, not a directory.
  return content === undefined ? OWN_NAMESPACE_VALUES : [...OWN_NAMESPACE_VALUES, content.namespace];
}

export class GraphTypologyRegistry {
  private kinds = new Map<string, GraphTypologyDef>();
  /** Which file declared each kind loaded from a `typologies/` graph (bean dmx1). */
  private declaredIn = new Map<string, string>();
  /** Validator nodes, keyed `kind\u0000family`, kept so a kind registered LATER (core's `folio`) is joined too. */
  private validatorNodes = new Map<string, { file: string; node: ValidatorNode }>();
  private kindRoot = new Map<string, number>();
  private validatorRoot = new Map<string, number>();
  private scannedRoots: string[] = [];
  /** The layer roots each scanned checkout held when it was scanned, so a layer mounted since is noticed ({@link ensureCheckout}). */
  private scannedLayers = new Map<string, string>();
  private loaded = false;

  /** Kinds a LATER checkout also declares and an earlier one already answered — reported, never silently merged. */
  private shadowedKinds: Array<{ kind: string; kept: string; shadowed: string }> = [];
  /** The checkouts, in precedence order, whose `typologies/` graphs are loaded on first use. */
  private declaredUnder: readonly string[] | undefined;
  private readonly resolveDeclaredUnder: (() => readonly string[]) | undefined;
  /** Which instances of those checkouts are read; every one when omitted. */
  private readonly include: InstanceFilter | undefined;

  /**
   * @param seed the kinds this layer lists in code
   * @param declaredUnder a checkout — or several, in PRECEDENCE order, or a
   *   lazythunk returning them so module import touches no filesystem — whose
   *   layers' `typologies/` graphs are loaded on first use; omitted, the
   *   registry holds only `seed` and what is `register`ed (a test's private
   *   registry). Within one checkout a name two files declare is refused, as
   *   before; a later checkout declaring a kind an earlier one already answered
   *   is SHADOWED (see {@link shadowed}), because the earlier checkout is the
   *   one being read (`defaultGraphTypologies` puts the checkout under
   *   inspection first).
   * @param options.include which instances of those checkouts are read — a
   *   registry whose answers must not depend on what else is mounted (the
   *   harness's own kinds, for `kind:json-schemas`, bean `8lcl`) names them.
   *   Omitted, every layer is.
   */
  constructor(
    seed: Readonly<Record<string, GraphTypologyDef>> = BASE_GRAPH_TYPOLOGIES,
    declaredUnder?: string | readonly string[] | (() => readonly string[]),
    options: { include?: InstanceFilter } = {},
  ) {
    this.include = options.include;
    for (const [k, v] of Object.entries(seed)) this.kinds.set(k, v);
    if (typeof declaredUnder === "function") {
      this.resolveDeclaredUnder = declaredUnder;
    } else {
      const roots = declaredUnder === undefined ? [] : typeof declaredUnder === "string" ? [declaredUnder] : declaredUnder;
      this.declaredUnder = [...new Set(roots.map((r) => resolve(r)))];
    }
  }

  /** The checkouts this registry loads declared kinds from, in precedence order. */
  roots(): readonly string[] {
    if (this.declaredUnder === undefined) {
      const roots = this.resolveDeclaredUnder ? this.resolveDeclaredUnder() : [];
      this.declaredUnder = [...new Set(roots.map((r) => resolve(r)))];
    }
    return this.declaredUnder;
  }

  /** Kinds a lower-precedence checkout declared again, and which file was kept. */
  shadowed(): ReadonlyArray<{ kind: string; kept: string; shadowed: string }> {
    this.ensureDeclared();
    return this.shadowedKinds;
  }

  /**
   * Load every declared kind node under {@link declaredUnder}, once. Lazy, so
   * importing the registry touches no filesystem; on FIRST USE rather than at a
   * call site, so a reader that imports only this module still sees every
   * harness's kinds. A node that does not parse, or a name two files declare,
   * THROWS with the path: a kind silently missing reads as "not a known kind",
   * which is the dh4f shape.
   */
  private ensureDeclared(): void {
    const roots = this.roots();
    if (this.loaded || roots.length === 0) return;
    this.loaded = true;
    for (const root of roots) this.loadCheckoutRoot(root);
  }

  /**
   * Ensure declared `typologies/` and `validators/` from `repoRoot` are loaded
   * when this is an unfiltered checkout-backed registry (bean `cat-tools-g7ls`,
   * owner card 2026-10-31 "A. Fix the loader").
   *
   * When `readDeclaration` reads a layer from a checkout outside
   * {@link declaredUnder} — e.g. a host or sibling checkout reached from a
   * standalone run, or a multi-instance test fixture — every discovered
   * layer's `typologies/` in that checkout (such as a document layer's
   * `glossary` for an IG harness's declaration) is registered before any declaration in
   * it is validated. No-op on a bare or filtered registry.
   */
  ensureCheckout(repoRoot: string): void {
    if (this.roots().length === 0 || this.include !== undefined) return;
    const abs = resolve(repoRoot);
    const layers = layersSignature(abs);
    // A checkout scanned BEFORE its layers were mounted is scanned again once
    // they are on disk. The standing re-pin reads a site's declaration, then
    // mounts its layers in the same process, then reads it again for the
    // health step: the first scan, before the IG harness layer was mounted,
    // was cached, so the IG kind `ig-ast` stayed unknown and every IG's re-pin
    // reported "declares unknown graph typology" (2026-11-13).
    if (this.scannedRoots.includes(abs) && this.scannedLayers.get(abs) === layers) return;
    if (layers === "") return;
    this.ensureDeclared();
    this.loadCheckoutRoot(abs, true);
  }

  private loadCheckoutRoot(root: string, rescan = false): void {
    const abs = resolve(root);
    const seen = this.scannedRoots.indexOf(abs);
    if (seen >= 0 && !rescan) return;
    // A rescan keeps the checkout's original precedence; a kind it loaded the
    // first time is the same file now, and is skipped below.
    const at = seen >= 0 ? seen : this.scannedRoots.length;
    if (seen < 0) this.scannedRoots.push(abs);
    this.scannedLayers.set(abs, layersSignature(abs));
    for (const { file, node } of declaredKindNodes(abs, this.include)) {
      const prior = this.declaredIn.get(node.kind);
      if (prior === file) continue;
      const priorAt = this.kindRoot.get(node.kind);
      if (prior !== undefined && priorAt !== undefined && priorAt < at) {
        this.shadowedKinds.push({ kind: node.kind, kept: prior, shadowed: file });
        continue;
      }
      if (prior !== undefined || this.kinds.has(node.kind)) {
        throw new GraphTypologyConflictError(node.kind, `declared by ${prior ?? "the base layer's code"} and by ${file}`);
      }
      const def = kindDefOf(node) as GraphTypologyDef & WithDeclarer;
      const by = declaringInstanceFor(file);
      if (by !== undefined) def[DECLARED_BY] = by;
      this.kinds.set(node.kind, def);
      this.declaredIn.set(node.kind, file);
      this.kindRoot.set(node.kind, at);
    }
    for (const v of declaredValidatorNodes(abs, this.include)) {
      const key = `${v.node.validates.kind}\u0000${v.node.validates.family ?? ""}`;
      const prior = this.validatorNodes.get(key);
      const priorAt = this.validatorRoot.get(key);
      if (prior && priorAt !== undefined && priorAt < at && prior.file !== v.file) continue;
      if (prior && prior.file !== v.file) {
        throw new Error(`two validators for ${describeValidator(v.node)}: ${prior.file} and ${v.file}. One family, one validator.`);
      }
      this.validatorNodes.set(key, v);
      this.validatorRoot.set(key, at);
    }
    // A validator naming a kind not registered YET is joined by `register`
    // (core registers `folio` in code after load); one naming no kind at all
    // is `check:kind-validators`' finding.
    for (const name of [...this.kinds.keys()]) this.joinValidators(name);
  }

  /** Fill each listed family's (or the kind's own) validator in from the node that names it. */
  private joinValidators(name: string): void {
    const def = this.kinds.get(name);
    if (!def) return;
    let next: GraphTypologyDef | undefined;
    for (const { file, node } of this.validatorNodes.values()) {
      if (node.validates.kind !== name) continue;
      next ??= { ...def, ...(def.nodeSchemas ? { nodeSchemas: { ...def.nodeSchemas } } : {}) };
      const family = node.validates.family;
      if (family === undefined) {
        if (next.validator !== undefined && next.validator !== node.schema) {
          throw new Error(`${file}: kind "${name}" already names a validator in code (${next.validator}); two answers for one kind`);
        }
        next.validator = node.schema;
        continue;
      }
      const entry = next.nodeSchemas?.[family];
      if (entry === undefined) throw new Error(`${file}: validates family "${family}", which kind "${name}" does not list`);
      if ((entry.validator !== undefined && entry.validator !== node.schema) || entry.shape !== undefined || entry.external !== undefined) {
        throw new Error(`${file}: family "${family}" of kind "${name}" already has an answer in code; two answers for one family`);
      }
      (next.nodeSchemas as Record<string, NodeSchemaRef>)[family] = { ...entry, validator: node.schema } as NodeSchemaRef;
    }
    if (next) this.kinds.set(name, next);
  }

  /** The validator node joined onto `kind` (and `family`), when one is. */
  validatorNodeFor(kind: string, family?: string): { file: string; node: ValidatorNode } | undefined {
    this.ensureDeclared();
    return this.validatorNodes.get(`${resolveGraphTypology(kind).kind}\u0000${family ?? ""}`);
  }

  /** Every validator node loaded, for a check that a node names a kind that exists. */
  validatorNodeList(): { file: string; node: ValidatorNode }[] {
    this.ensureDeclared();
    return [...this.validatorNodes.values()];
  }

  /** The file that declared `name`, when it came from a `typologies/` graph. */
  declaredBy(name: string): string | undefined {
    this.ensureDeclared();
    return this.declaredIn.get(resolveGraphTypology(name).kind);
  }

  register(name: string, def: GraphTypologyDef): void {
    const existing = this.kinds.get(name);
    if (existing) {
      if (sameKind(existing, def)) return; // diamond
      throw new GraphTypologyConflictError(name);
    }
    this.kinds.set(name, def);
    this.joinValidators(name);
  }

  // `has` and `get` resolve a deprecated spelling, so a declaration written
  // against the old vocabulary still finds its kind. Resolution happens HERE
  // and nowhere else: a second place that knows the old name is a second place
  // that can forget it.
  has(name: string): boolean {
    this.ensureDeclared();
    return this.kinds.has(resolveGraphTypology(name).kind);
  }

  get(name: string): GraphTypologyDef | undefined {
    this.ensureDeclared();
    return this.kinds.get(resolveGraphTypology(name).kind);
  }

  names(): string[] {
    this.ensureDeclared();
    return [...this.kinds.keys()];
  }

  /** The kind a `GraphTypology` individual names, or `undefined`. */
  forIri(iri: string): string | undefined {
    this.ensureDeclared();
    for (const [k, v] of this.kinds) if (graphTypologyIri(k, v) === iri) return k;
    return undefined;
  }
}

/**
 * Every `folio-graph-typology/v1` node in every `typologies/` graph the layers under
 * `repoRoot` declare, files sorted for a stable order. Read RAW from each
 * declaration (only `directories[].graphTypologies`, `path` and `scope`), because
 * the declaration's Zod schema lives in `cat-harness.ts`, which imports this
 * module.
 */
export function declaredKindNodes(
  repoRoot: string,
  include?: InstanceFilter,
): { file: string; node: ReturnType<typeof GraphTypologyNodeSchema.parse> }[] {
  return declaredNodeFiles(repoRoot, "typologies", include).map(({ file, raw }) => {
    const parsed = GraphTypologyNodeSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`${file} is not a folio-graph-typology/v1 node: ${parsed.error.message}`);
    return { file, node: parsed.data };
  });
}

/** The layer roots a checkout holds now, as one comparable string; empty when it holds none. */
function layersSignature(root: string): string {
  return layerRootsIn(root).slice().sort().join("\n");
}

/** Every `folio-validator/v1` node in every declared `validators/` graph (bean riit). */
export function declaredValidatorNodes(repoRoot: string, include?: InstanceFilter): { file: string; node: ValidatorNode }[] {
  return declaredNodeFiles(repoRoot, "validators", include).map(({ file, raw }) => {
    const parsed = ValidatorNodeSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`${file} is not a folio-validator/v1 node: ${parsed.error.message}`);
    return { file, node: parsed.data };
  });
}

function describeValidator(n: ValidatorNode): string {
  return n.validates.family ? `kind "${n.validates.kind}", family "${n.validates.family}"` : `kind "${n.validates.kind}"`;
}

/**
 * The checkouts the shared registry reads declared kinds from, in precedence
 * order. Exported so a test can ask it without mutating the process.
 *
 * 1. `$REPO_ROOT`, when set — the caller said which checkout; it is the only one.
 * 2. The checkout under inspection: `cwd`, when it holds any layer. Every
 *    `check:*` script reads declarations from `process.cwd()`, so its kinds must
 *    come from there too.
 * 3. The checkout this module sits in, two levels up (or one).
 *
 * **Why 2 exists — the fixed-depth defect (kg-separation lesson 6).** Until
 * 2026-10-12 only 3 was read: the registry assumed the declarations it judges
 * live in the checkout the harness MODULE lives in. That holds in the monorepo
 * and inside a downstream that remote-mounts the harness, and is false the
 * moment the tools run standalone against another checkout — a sibling clone of
 * the tools layer checking a downstream folio: a layer's declaration there declares the
 * `fhir-artifact-index` kind that a layer mounted only in the downstream
 * (mounted in the folio, absent beside the standalone clone) contributes, so `readDeclaration` threw "unknown
 * graph typology" over a declaration that is correct. The mounted copy of the
 * same script passed. Two layouts, two answers about one file.
 */
export function defaultTypologyRoots(
  // input-site: env-unset REPO_ROOT #949cc29c — caller override naming a checkout outside the tree; unset in CI
  env: Readonly<Record<string, string | undefined>> = process.env,
  cwd: string = process.cwd(),
  moduleDir: string = dirname(fileURLToPath(import.meta.url)),
): string[] {
  if (env.REPO_ROOT) return [resolve(env.REPO_ROOT)];
  const up2 = resolve(moduleDir, "..", "..", "..");
  const up1 = resolve(moduleDir, "..", "..");
  const own = layerRootsIn(up2).length > 0 ? up2 : up1;
  const inspected = layerRootsIn(cwd).length > 0 ? resolve(cwd) : undefined;
  return inspected !== undefined && inspected !== own ? [inspected, own] : [own];
}

/**
 * The shared registry: the base layer's kinds above, plus every kind the
 * layers of the checkout under inspection — and then of the checkout this
 * module sits in — declare in their `typologies/` graphs (bean dmx1), loaded on
 * first use. Core registers `folio` into it at load. See {@link defaultTypologyRoots}.
 */
export const defaultGraphTypologies = new GraphTypologyRegistry(BASE_GRAPH_TYPOLOGIES, defaultTypologyRoots);

/**
 * The display name of a graph typology: its declared {@link GraphTypologyDef.title},
 * or, for a kind that declares none, the kind word with its first letter
 * capitalised and hyphens read as spaces (`code-list` → "Code list").
 *
 * Never the bare kind word. That is what the rail and the sidebar showed until
 * 2026-10-01, while the glass called the same page by its tile title, which is
 * how one destination came to carry two names (bean `ob3m`, finding 6).
 */
export function kindTitle(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): string {
  const declared = registry.get(kind)?.title;
  if (declared !== undefined && declared.trim() !== "") return declared.trim();
  const words = kind.replace(/-/g, " ").trim();
  return words === "" ? kind : words.charAt(0).toUpperCase() + words.slice(1);
}
