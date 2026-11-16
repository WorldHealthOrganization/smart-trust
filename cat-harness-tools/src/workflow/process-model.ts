/**
 * Read a `.bpmn` file into a graph the interpreter can walk.
 *
 * The workflow diagrams under `processes/` are already the normative
 * picture of how a change reaches the corpus, and every activity already names
 * the skill that implements it (`<bootstrap.processes:skill ref="…"/>`) and whether it
 * touches the work plan (`<cat-harness.processes:bean/>`). Until now nothing read them at
 * runtime: they were documentation an agent was trusted to have absorbed.
 *
 * This turns the same file into a model. `bpmn-moddle` — the parser bpmn.io
 * uses — does the XML, so the extension elements survive parsing and the
 * diagram interchange is ignored rather than reimplemented.
 *
 * ## What it supports, and why refusing the rest matters
 *
 * Nine element types: start and end events, the four activity kinds, exclusive
 * and parallel gateways, sequence flows. That is everything the six diagrams
 * in this repo use, and it is deliberately the whole list.
 *
 * Anything else — an inclusive gateway, a boundary event, an embedded
 * sub-process, a timer — throws at parse time and names what it found. The
 * alternative is to skip the element and keep walking, which produces a
 * process that runs, reports progress, and silently is not the process on the
 * diagram. This repo has that failure recorded twice over: a hand-written kind
 * list that omitted `algorithm` and `table` hid ~13% of a corpus from every QA
 * tool, and a walk that quietly dropped unlabelled blocks hid 27,390 words. A
 * gate that passes by not looking is worse than no gate.
 *
 * @module folio-assistant/workflow/process-model
 *
 * @conformsTo omg-bpmn-2.0
 */

import { BpmnModdle } from "bpmn-moddle";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";
import { loadDecisionTable, possibleOutcomes, type DecisionTable } from "./decision-table.js";
import { ACTOR_KINDS, laneRoleRef, type ActorKind } from "../../schemas/process/role-graph.js";
import { CONVENTION_EXT, conventionsInForce, type ConventionScope } from "../../schemas/process/convention.js";
import { WORK_PLAN_OPS, type WorkPlanOp } from "./bean-link.js";
import { activeCodes, codeListDirs, loadCodeLists, type CodeList } from "../../schemas/library/code-list.js";
import { directoriesForGraph, findInstanceRoot } from "../../schemas/kg/cat-harness.js";
import { orderedDependencies } from "../../schemas/kg/harness-config.js";
import { CANONICAL_EXTENSION_PREFIX, isOwnExtensionNamespace } from "../../schemas/kg/namespaces.js";

/** Element types the interpreter can walk faithfully. */
const ACTIVITY_TYPES = [
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  // A send or receive task is a performed step whose work is a message: the
  // walk is exactly a Task's (one token in, one out). Who may fulfil it is not
  // constrained, as for `bpmn:Task` (`fulfilmentKindsForBpmnType`). A DAK's
  // business processes use both (a downstream DAK's onboarding, 2026-11-01).
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:CallActivity",
] as const;

const SUPPORTED = new Set<string>([
  "bpmn:StartEvent",
  "bpmn:EndEvent",
  "bpmn:ExclusiveGateway",
  "bpmn:ParallelGateway",
  "bpmn:SequenceFlow",
  ...ACTIVITY_TYPES,
]);

/**
 * Whether the interpreter runs this element. A boundary event runs only when
 * it is non-interrupting (`cancelActivity="false"`): an optional side path
 * that starts while its activity holds a token and never takes that token
 * away. An interrupting one would cancel the activity, which the engine does
 * not do, so it is refused (or, on a view load, listed as not run).
 */
function runs(e: { $type: string; cancelActivity?: boolean }): boolean {
  return SUPPORTED.has(e.$type) || (e.$type === "bpmn:BoundaryEvent" && e.cancelActivity === false);
}

/** The type as a refusal names it: an interrupting boundary event says so. */
function refusedType(e: { $type: string; cancelActivity?: boolean }): string {
  return e.$type === "bpmn:BoundaryEvent" ? `${e.$type} (interrupting)` : e.$type;
}

/**
 * Elements that hold data rather than being steps: a store (`dataStoreReference`,
 * pointing at a `bpmn:dataStore`) and a document passed between steps
 * (`dataObjectReference` and its `dataObject`).
 *
 * Read, not refused, and never walked. A store is not a lane (owner,
 * 2026-11-01, Q-BR-3 A): the work plan, a corpus or an activity log is a
 * `dataStoreReference`, and the steps that read or write it say so with data
 * associations. Leaving one out of the walk omits no step, because it is not
 * one; what it says is kept on {@link ProcessModel.dataStores} and on each
 * step's {@link ProcessNode.reads} and {@link ProcessNode.writes}.
 */
/**
 * The store id of the work plan (beans), as declared in a layer's shared
 * stores file (`<bpmn:dataStore id="work-plan"/>`). A step that writes to it
 * works the bean ({@link ProcessNode.worksBean}).
 */
export const BEAN_STORE = "work-plan";

/**
 * The store id of the memory store (cat-harness#991 §4.14, Q14): drawn only
 * where a process needs memory — a checkpoint before an agent stops, a space
 * a swarm shares, a hand-over between lanes. Which Tool keeps it is the
 * deployment's choice; beans are one.
 */
export const MEMORY_STORE = "memory";

const DATA_TYPES = new Set<string>(["bpmn:DataStoreReference", "bpmn:DataObjectReference", "bpmn:DataObject"]);

/**
 * One store or data object drawn in a process.
 *
 * `store` is the id of the `bpmn:dataStore` the reference points at, which is
 * the store's Role id (`work-plan`, `corpus`, `log`, `session-record`, …), the
 * same id a lane's `partitionElementRef` uses. It may be declared in the same
 * file or in a layer's shared stores file; when it is declared nowhere in
 * this file, moddle leaves the reference unset and the id comes from the
 * tolerated warning, exactly as for a lane (`partitionTolerated`).
 */
export interface DataStoreUse {
  /** The reference's own id in this diagram. */
  id: string;
  /** `bpmn:DataStoreReference` or `bpmn:DataObjectReference`. */
  type: string;
  name?: string;
  /** The store id (a data store reference's `dataStoreRef`); absent for a data object. */
  store?: string;
  /** False when the store is not declared as a `bpmn:dataStore` in this file. */
  storeDeclared?: boolean;
}

export type NodeKind = "start" | "end" | "activity" | "exclusive" | "parallel" | "boundary";

/**
 * The three RACI letters a diagram can declare. `responsible` is absent
 * deliberately — the lane already carries it. See {@link ProcessNode.raci}.
 */
/**
 * Whitespace normalisation for a `<bpmn:documentation>` body — and it PRESERVES
 * the paragraph break, which the previous `/\s+/g -> " "` destroyed.
 *
 * ## Why this is not a cosmetic change
 *
 * Collapsing every run of whitespace, newlines included, meant an author had NO
 * WAY to put a paragraph break in documentation. A literal blank line was eaten;
 * `&#10;` was eaten too, because the XML parser decodes it to a newline BEFORE
 * this code sees it. The only spelling that survived was `&amp;#10;`, which
 * decodes to the five NON-whitespace characters `&#10;` — so it passed the
 * collapse and the published page showed them as literal text:
 *
 *     Dependency advisories&#10;&#10;THIS DIAGRAM IS DELIBERATELY SMALL
 *
 * Measured 2026-09-26 (bean `li5y`): **90** such instances across 8 process
 * files, surfacing in 50 `.pot` msgids across five locales, so translators were
 * handed the escape sequence inside the string to translate. Every one of them
 * is an author defeating this normaliser the only way that worked. Treating them
 * as 90 authoring mistakes and sweeping them would have left the cause in place
 * for the next author to rediscover.
 *
 * ## What it still collapses, and why that half was right
 *
 * Indentation. A `.bpmn` is pretty-printed, so a documentation body arrives with
 * every line indented to its element's depth; without collapsing that, the page
 * would carry the XML's layout.
 *
 * One run of whitespace, one decision, which is what makes the indentation
 * problem disappear rather than need a second pass: a run CONTAINING a newline
 * becomes newlines alone — so `"\n    "` yields `"\n"` and the indentation is
 * absorbed by the same match that produced the break — and a run containing no
 * newline becomes a single space. Three or more newlines are clamped to two,
 * since a paragraph break is the largest gap that means anything.
 */
const DOC_WS: [RegExp, (m: string) => string] = [
  /\s+/g,
  (m: string): string => (m.includes("\n") ? "\n".repeat(Math.min((m.match(/\n/g) ?? []).length, 2)) : " "),
];

export const RACI_INVOLVEMENTS = ["accountable", "consulted", "informed"] as const;

/**
 * RASCI — RACI plus **S**upportive: a role that does work on the activity
 * without owning the deliverable.
 *
 * ## Why `supportive` is declarable when `responsible` is not
 *
 * The obvious objection, and it was the first answer given to the owner: in a
 * lane-derived model S and R collapse, because a party that does work on the
 * activity is a lane participant. **That is wrong, and the reason is
 * structural.** A BPMN activity sits in EXACTLY ONE lane, so the lane is a
 * discriminator rather than a description: R is the owning lane, S is a
 * declared role that is not it. There is no case where both could apply.
 *
 * Checked against the corpus before this was added (2026-09-23): no activity
 * anywhere declares `involvement="responsible"`, and all declared
 * involvements used the three legal values. So the premise R-is-the-lane holds
 * corpus-wide and `supportive` inherits no ambiguity from it.
 *
 * It also buys expressiveness rather than a letter for its own sake: BPMN
 * **cannot place one activity in two lanes**, so before this there was no way
 * to say "this role also does the work here".
 */
export const RASCI_INVOLVEMENTS = [...RACI_INVOLVEMENTS, "supportive"] as const;

/**
 * The involvement vocabularies a process may declare, by name.
 *
 * **Parallel, not cumulative**, and the distinction is the whole reason this
 * is a choice rather than a superset always in force. `methodology-adoption`:
 * *"Two or more methodologies may answer the same question. Do not blend
 * them… pick one per decision, name it, and follow it."* A process that has
 * chosen four letters has chosen them, and a fifth appearing in it is a defect
 * to report — not a convenience to absorb.
 *
 * The same shape bean `5vo9` needs for adjudication: a declared enum that a
 * step's value is validated against. One mechanism, two users.
 */
export const INVOLVEMENT_VOCABULARIES = {
  raci: RACI_INVOLVEMENTS,
  rasci: RASCI_INVOLVEMENTS,
} as const satisfies Record<string, readonly string[]>;

export type InvolvementVocabulary = keyof typeof INVOLVEMENT_VOCABULARIES;

/** Every letter any vocabulary admits — the union, for typing only. */
export type RaciInvolvement = (typeof RASCI_INVOLVEMENTS)[number];

export interface ProcessNode {
  id: string;
  /** The `name` on the diagram, with the `[skill]` line stripped. */
  name: string;
  kind: NodeKind;
  /**
   * For a non-interrupting boundary event (`kind: "boundary"`): the activity
   * it sits on. It may be completed whenever that activity holds a token, any
   * number of times, and the activity keeps its token.
   */
  attachedTo?: string;
  /** BPMN type, kept so a caller can tell a userTask from a serviceTask. */
  type: string;
  /** Name of the lane this node sits in — i.e. the role that performs it. */
  lane?: string;
  /** Id of that lane, so a finding can name the element rather than a string. */
  laneId?: string;
  /**
   * The Role the node's lane names — its `partitionElementRef`, or the
   * legacy `<bootstrap.processes:role ref="…"/>` when that is absent
   * ({@link LaneDef.roleRef}).
   *
   * A lane NAME is free text and sixty of them spell two dozen positions
   * (`schemas/process/role-graph.ts`); an explicit ref is the join that does not
   * depend on spelling, and it wins over name matching when present.
   */
  roleRef?: string;
  /** `<bootstrap.processes:skill ref="…"/>`, possibly several. */
  skills: string[];
  /**
   * `<cat-harness.processes:narrative href="X.md#heading"/>`: where a reader
   * finds this task's narrative text, relative to the diagram (owner,
   * 2026-11-01, Q-OB-17 A). Descriptive only; the engine never reads it.
   */
  narrative?: string;
  /**
   * `<cat-harness.processes:raci ref="<role>" involvement="accountable|consulted|informed"/>`.
   *
   * **R is NOT here, and that is the point.** A BPMN lane already says who
   * performs an activity — that IS Responsible — so declaring it again
   * would be one fact in two places with nothing asserting they agree, the
   * shape bean `85e8` removed `fallbackRole` for. Read `roleRef` for R.
   *
   * The other three letters have no home in BPMN and are what this adds:
   * *Accountable* (one per activity, the neck on the block), *Consulted*
   * (two-way, before) and *Informed* (one-way, after). Bean `7o7i`.
   *
   * Every value names a **role**, not an actor, for all three letters.
   * `role-model.md`'s rule is that nothing IS a reviewer — somebody acts as
   * one for the duration of a lane — and naming a concrete actor would bind
   * a process to one participant.
   */
  raci: { role: string; involvement: RaciInvolvement }[];
  /**
   * Declared `folio:raci` entries whose `involvement` is NOT in the process's
   * vocabulary — a typo, or a `supportive` in a four-letter process.
   *
   * **These used to be dropped with no trace, and the comment at the filter
   * said `check:raci` reported them. It did not.** The filter runs inside
   * `loadProcessModel`, so by the time `raci-chart.ts` sees a node the
   * rejected entries are gone; there was nothing left to report and nothing
   * ever had. Measured 2026-09-23 — `process-model.ts` is the only reader of
   * the raw element, so no other consumer could have caught them either.
   *
   * They are still **not coerced**, which was the right half of the original
   * decision: a typo read as `informed` would put somebody on a notification
   * list who was meant to be consulted. Not-coerced and not-recorded are
   * different things, and only the first was ever intended.
   */
  raciUnknown: { role: string; involvement: string }[];
  /**
   * The conventions in force HERE — process ∪ lane ∪ activity, in that order.
   *
   * `<cat-harness.processes:convention ref="…"/>`, mirroring `folio:skill` rather than
   * inventing a second binding syntax. Bean `3190`: a convention is context
   * attached to a process, so an agent implementing under CRDM has them and
   * one adjudicating a translation does not.
   *
   * **EMPTY WHEN NOTHING BINDS, and that is the rule.** A default of "all
   * conventions" would be the unconditional prose this replaces, wearing a
   * schema. The scope is carried per entry so a reader can tell a
   * process-wide rule from one attached to this step alone.
   */
  conventions: Array<{ ref: string; scope: ConventionScope }>;
  /**
   * `<cat-harness.processes:no-skill reason="…"/>` — this activity names no skill ON PURPOSE,
   * and this is why.
   *
   * A person describing the change they want, in their own words, is not an
   * unimplemented step: there is nothing for an instruction body to say. But
   * "no skill because none could exist" and "no skill because nobody wrote
   * one yet" are indistinguishable from the outside, which is why
   * `activity-names-skill` could only ever be advisory — it had legitimate
   * instances it could not tell from real gaps.
   *
   * The reason is REQUIRED and a declaration without one does not load, the
   * same rule `workflow-policy.json` relaxations follow: an exemption whose
   * justification is "" is an exemption nobody can review, and it would make
   * silencing the criterion cheaper than satisfying it.
   */
  noSkillReason?: string;
  /**
   * `<cat-harness.processes:no-call reason="…"/>` — this step names a skill that owns a
   * same-named process, and is deliberately NOT a call activity of it.
   *
   * A call activity runs the called process from its first start event to its
   * end. A step that uses a skill's know-how for one slice of that process —
   * one check out of a review, one deploy out of a three-entry lifecycle, a
   * loop over many previews — would be misdrawn as a call. Same rule as
   * {@link noSkillReason}: the reason is required at load time, so silencing
   * `activity-calls-skill-process` costs a sentence somebody can review.
   */
  noCallReason?: string;
  /**
   * `<cat-harness.processes:judgement reason="…"/>` — this gateway's branch is a JUDGEMENT
   * call, on purpose, and this is why.
   *
   * ## The third state the vocabulary was missing
   *
   * An exclusive gateway either carries `folio:decision` and is computed, or
   * it does not and the caller supplies the outcome. But "no table because
   * this is somebody's call" and "no table because nobody has written one
   * yet" were **indistinguishable from the outside** — exactly the gap
   * {@link noSkillReason} closed for activities, one element type along.
   *
   * It is not hypothetical. Issue #200 §6 classifies all ten of this
   * repository's decision points: four mechanical, six judgement, with
   * reasons. That classification lives in an ISSUE, where nothing reads it
   * and nothing checks it — a claim in prose, which is the failure this
   * repository keeps writing down.
   *
   * ## Why it matters more than the activity case
   *
   * A step with no skill is a documentation gap. A gateway with no table is a
   * point where an LLM decides the branch, and **how many of those there are,
   * and which**, is the question the deterministic-vs-agentic spectrum is
   * about (bean `q0tc`). A mechanism that cannot enumerate its own judgement
   * points cannot answer it.
   *
   * The reason is REQUIRED, the same rule `no-skill` follows: an exemption
   * whose justification is "" is one somebody adds to get to green.
   */
  judgementReason?: string;
  /**
   * `<cat-harness.processes:fulfilment kinds="person agent" reason="…"/>` — which actor kinds
   * may perform this activity, said explicitly.
   *
   * Almost no activity needs one. The BPMN type already answers the question
   * for a `userTask` and a `serviceTask`, and `fulfilmentKindsForBpmnType` in
   * `schemas/process/role-graph.ts` reads that answer, so this exists for the step
   * where the derived answer is wrong — an abstract `bpmn:Task` that genuinely
   * admits only one kind, or a `serviceTask` a person really does drive.
   *
   * The reason is REQUIRED and a declaration without one does not load, on the
   * same rule as {@link ProcessNode.noSkillReason}: this declaration can
   * SILENCE a finding, and an exemption nobody can review is one somebody adds
   * to get to green. Widening `kinds` to every kind is the cheapest way to make
   * `activity-fulfilment-kind` pass, so it has to cost a sentence somebody will
   * read in the diff.
   */
  fulfilment?: { kinds: ActorKind[]; reason: string };
  /**
   * `<cat-harness.processes:adjudication codes="…"/>` — the activity is a judgement, and these
   * are the answers it may give.
   *
   * The declared enum a recorded outcome is validated against. Its document
   * contract is the content core's `schemas/adjudication.ts`; see
   * {@link adjudicationOf} for why the two are not one import.
   */
  adjudication?: { codes: string[]; list?: string };
  /**
   * `<cat-harness.processes:adjudication accepts="…"/>` — on a CALL ACTIVITY: the answers this
   * caller can act on, checked against the adjudicator inside the process it calls.
   *
   * A different claim from {@link adjudication}, on a different element, which
   * is why it is a different attribute rather than the same one reused. A
   * adjudicator SAYS what may be answered; a caller says what it can HEAR. Bean
   * `bvuk`: six diagrams call `Process_Adjudication` and each asks it a
   * different question, and nothing compared any of them to its three
   * outcomes.
   */
  adjudicationAccepts?: string[];
  /**
   * `<cat-harness.processes:adjudication defers="caller"/>` — this step IS an adjudication and
   * its permitted answers are the CALLER's to declare.
   *
   * Declared rather than inferred from a missing `codes`, because in this
   * corpus an absence is never allowed to read as a decision. `A_Adjudicate`
   * in `adjudication.bpmn` could have simply dropped its enum when bean `bvuk`
   * split the outcome half out; then a step that had lost its marker by
   * accident and one that deferred on purpose would parse identically, and
   * `check:workflow-refs` could not report the callers that still owe an enum.
   */
  adjudicationDefers?: boolean;
  /** True when `<cat-harness.processes:bean/>` marks this step as touching the work plan. */
  touchesWorkPlan: boolean;
  /**
   * What this step reads, from its `dataInputAssociation`s whose source is a
   * data store or data object: the store id for a store, the reference id for
   * a data object. Empty when it reads nothing drawn.
   */
  reads: string[];
  /** What this step writes, from its `dataOutputAssociation`s, named as in {@link reads}. */
  writes: string[];
  /**
   * `op` on `<cat-harness.processes:bean/>`: what this step does to the bean — `claim`, `note`
   * or `resolve`. Absent means the step touches the plan in some way the tools
   * do not perform automatically.
   */
  workPlanOp?: WorkPlanOp;
  /**
   * True when the step has a data output association to the Beans store
   * ({@link BEAN_STORE}). Such a step works the bean where it stands: its
   * op is `note` unless the extension names another, and completing it
   * claims a bean that is not yet started (owner, 2026-11-02, Q-BR-8 F: an
   * agent can take up any task whose skill it has a tool for).
   */
  worksBean?: boolean;
  /**
   * Bean references associated with this activity (via `<cat-harness.processes:bean ref="…"/>` or `id` or `bean`).
   */
  beanRef?: string;
  beans?: string[];
  /**
   * `<cat-harness.processes:policy relaxable="false"/>` — a content package may not declare a
   * relaxation for this step. These are the gate itself; if they were
   * negotiable, "strict base" would mean nothing.
   */
  relaxable: boolean;
  /**
   * `<cat-harness.processes:decision ref="decisions/x.dmn#Decision_Id"/>` on an exclusive
   * gateway: its outcome is **computed** from a DMN table rather than chosen.
   * Relative to the directory holding the `.bpmn`.
   */
  decisionRef?: string;
  /** `<bpmn:documentation>`, if the diagram carries one. */
  documentation?: string;
  /** For a call activity: the process it expands into. */
  calledElement?: string;
  /**
   * For a call activity that calls a GLOBAL TASK rather than a process: the
   * step the layer shares, which this node runs as.
   *
   * BPMN 2.0's reusable task (`globalTask`, `globalUserTask`,
   * `globalScriptTask`, `globalManualTask`, `globalBusinessRuleTask`) is a
   * root element outside every process, held in the layer's one shared
   * `.bpmn` that holds no process, and named by bare id in `calledElement`
   * exactly as a process is (owner, 2026-10-20, "a1 b1 c1"). The node is
   * then an ordinary step: `type` is the task type the global kind runs as
   * ({@link GLOBAL_TASK_TYPES}), `name`, `documentation` and every extension
   * (the Skill above all) come from the global task unless the call states
   * its own, the lane stays the call's, and `calledElement` is NOT set — a
   * global task expands into nothing, so every reader that treats
   * `calledElement` as "a sub-process implements this" would otherwise
   * skip the one place the step's Skill is named.
   */
  globalTask?: GlobalTaskRef;
  /**
   * The values a call gives a global task's declared inputs, by input name
   * (owner, 2026-10-20, "c1": a global task may take parameters, such as
   * the label a tracking issue carries). Standard BPMN: the global task's
   * `ioSpecification` declares each `dataInput`; the call activity's own
   * `ioSpecification` repeats it, as BPMN requires a call's inputs to match
   * the callable element's, and a `dataInputAssociation` with an
   * `assignment` gives it its value. Absent when the step takes none.
   */
  inputs?: Record<string, string>;
  incoming: string[];
  outgoing: string[];
}

/** Where a call activity's global task is, and what kind of task it is. */
export interface GlobalTaskRef {
  /** The global task's id, as the call names it. */
  id: string;
  /** Its BPMN type as bpmn-moddle names it, e.g. `bpmn:GlobalUserTask`. */
  type: string;
  /** The file that defines it. */
  source: string;
  /** Its own name, before any name the call gives the step. */
  name: string;
}

/**
 * BPMN 2.0's global task types, as bpmn-moddle names them, and the task type
 * a call to each runs as. There is no global service, send or receive task in
 * the standard. A script or business-rule task is performed without a person,
 * as a service task is; a manual task is performed by a person, as a user
 * task is — so `fulfilmentKindsForBpmnType` reads the same answer for a shared
 * step as for the task it replaced.
 */
export const GLOBAL_TASK_TYPES: Readonly<Record<string, string>> = {
  "bpmn:GlobalTask": "bpmn:Task",
  "bpmn:GlobalUserTask": "bpmn:UserTask",
  "bpmn:GlobalManualTask": "bpmn:UserTask",
  "bpmn:GlobalScriptTask": "bpmn:ServiceTask",
  "bpmn:GlobalBusinessRuleTask": "bpmn:ServiceTask",
};

/** A global task's element name in the XML, any prefix: `globalTask`, `globalUserTask`, … */
export const GLOBAL_TASK_ELEMENT = /<(?:[\w.-]+:)?global(?:User|Script|Manual|BusinessRule)?Task\b[^>]*?\sid="([^"]+)"/g;

/** Whether a `.bpmn` source holds a `<bpmn:process>`. */
export function holdsProcess(xml: string): boolean {
  return /<(?:[\w.-]+:)?process\b[^>]*?\sid="/.test(xml);
}

/**
 * Whether a `.bpmn` source is a layer's shared global-tasks file: global
 * tasks and no process. Every tool that reads a `.bpmn` as a process asks
 * this first and passes such a file by — it holds the steps several
 * processes share, and each is read through the calls to it (owner,
 * 2026-10-20, "a1").
 */
export function isGlobalTasksFile(xml: string): boolean {
  return !holdsProcess(xml) && (new RegExp(GLOBAL_TASK_ELEMENT.source).test(xml) || DATA_STORE_ELEMENT.test(xml));
}

/**
 * A global `bpmn:dataStore`: a store declared once for a layer, which
 * processes point at with a `dataStoreReference` (owner, 2026-11-01, Q-DS-3 A).
 * A file of them and no process is shared like a global-tasks file, and may be
 * the same file.
 */
export const DATA_STORE_ELEMENT = /<(?:[\w.-]+:)?dataStore\b[^>]*?\sid="([^"]+)"/;

/**
 * The `.bpmn` files among `files` that hold a process: every one but a
 * layer's shared global-tasks file, which a tool that loads diagrams as
 * processes passes by ({@link isGlobalTasksFile}).
 */
export function processDiagrams(files: readonly string[]): string[] {
  return files.filter((f) => f.endsWith(".bpmn") && !isGlobalTasksFile(readFileSync(f, "utf-8")));
}

export interface ProcessFlow {
  id: string;
  /** The flow's label. On a gateway this is the outcome that selects it. */
  name?: string;
  from: string;
  to: string;
  /**
   * `<cat-harness.processes:adjudication code="…"/>` — on a branch out of an adjudicated
   * judgement's gateway, WHICH declared answer selects this branch.
   *
   * The flow's `name` is prose for a reader ("the finding stands"); this is
   * the token the recorded outcome carries. They are deliberately not the
   * same field: a label is free to be rewritten for clarity, and a code that
   * moved with it would silently invalidate every record judged under the old
   * one.
   */
  adjudicationCode?: string;
}

/**
 * One swimlane, which names one **role** — a lane is a partition that names
 * the Role its tasks are performed in, not the Role itself (owner, 2026-10-16).
 *
 * Kept as a first-class part of the model rather than only as a string on each
 * node, because the questions worth asking are about the lane: does it bind a
 * declared role, does that role carry the skills its activities name, is there
 * an actor who can take it on. A `lane?: string` per node cannot answer any of
 * those — it cannot even report a lane that holds no activities.
 */
export interface LaneDef {
  id: string;
  name?: string;
  /** `<bpmn:documentation>` on the lane — what the role does IN this diagram. */
  documentation?: string;
  /**
   * The id of the Role this lane NAMES, from whichever binding it carries.
   *
   * Owner, 2026-10-16 (thread "BPMN lane, role and skill modelling"): *"Lane
   * names Role, not Actor"* — a lane is a partition that names a Role, it is
   * not itself one. The standard way BPMN says that is `partitionElementRef`
   * on `<bpmn:lane>`, pointing at a top-level `<bpmn:resource>` whose `id` is
   * the Role's id in `roles.json`, verbatim. That is read FIRST.
   *
   * `<bootstrap.processes:role ref="…"/>` is the legacy spelling, deprecated
   * the same day and accepted for one release: it is read only when
   * `partitionElementRef` is absent, and {@link LaneDef.roleBinding} says
   * which one answered so a consumer can warn. One field for both, so the
   * dozen consumers of `roleRef` (`laneBinding`, `kg-export`'s `bindsRole`,
   * the workflow engine) are right before and after the diagrams migrate.
   *
   * The precedence is not decided here: it is cat-harness's `laneRoleRef`
   * (`schemas/process/role-graph.ts`), the one reader every layer asks.
   */
  roleRef?: string;
  /**
   * WHICH binding produced {@link roleRef}: `partitionElementRef` (the
   * standard one), or `legacy-role-ref` — the deprecated
   * `<bootstrap.processes:role ref>`, which `kg:audit` reports as
   * `lane-role-legacy-binding`. `laneRoleRef`'s `source`; absent when the
   * lane names no Role.
   */
  roleBinding?: "partitionElementRef" | "legacy-role-ref";
  /**
   * `laneRoleRef`'s warning: the lane uses the deprecated binding, or carries
   * a `partitionElementRef` and a legacy ref that disagree (the standard one
   * wins). Readers accept the legacy form for one release AS A WARNING, and
   * this is the warning, carried to whoever reports it.
   */
  roleBindingWarning?: string;
  /**
   * `false` when `partitionElementRef` names an id that no top-level
   * `<bpmn:resource>` in the file declares. The Role id is still the value
   * written — the resource's id IS the role id, so nothing is lost — but the
   * diagram is not well-formed BPMN until the resource is declared, and a
   * reader is told so rather than having the load refused. Absent otherwise.
   */
  roleResourceDeclared?: boolean;
  /**
   * `<bootstrap.processes:role variable="true"/>` — this lane's PERFORMER VARIES, declared.
   *
   * Bean `ug4r`. A lane binding no role is normally a defect, and
   * `lane-binds-role` says so at severity `major`. But `log-message.bpmn`'s
   * `Actor` lane binds none ON PURPOSE: the point of that sub-process is that
   * whoever is doing the thing being logged is the actor, which is why
   * `log-message` takes `actor` as a required input and why the `logger` role
   * says the skill belongs to whoever is DOING it. A role binding `Actor`
   * would assert the opposite.
   *
   * Before this flag, that decision lived in a prose `_comment` inside
   * `bootstrap/scenarios/roles.json` — which no tool reads, so
   * "deliberately unbound" and "nobody got round to it" were the same thing
   * to every consumer. A declared answer and an absent one are different
   * facts, exactly as an empty `roles` list differs from a missing one.
   *
   * Mutually exclusive with `roleRef`: a lane that names a role has not got a
   * varying performer, and `check-workflow-policy` refuses both together.
   */
  performerVaries?: boolean;
  /** Ids of the flow nodes in this lane. */
  nodes: string[];
}

/**
 * How a declared precondition can be answered — bean `lv3j`.
 *
 * The split is the whole point, and the bean's own wording contains the trap:
 * it offers *"this file was read"* as the checkable example. **It is not.**
 * The engine can check that a file EXISTS; whether an actor READ it is not
 * observable from here, and a check that claims otherwise is a green tick over
 * something nobody verified — which is the failure this element exists to
 * stop, not one it may commit on the way.
 *
 * So the line is drawn between a claim about the WORLD and a claim about the
 * ACTOR, because that is the line observability actually falls on.
 */
export type PreconditionKind =
  /** A claim about the world, which {@link evaluatePrecondition} can answer. */
  | "checkable"
  /** A claim about the actor. Nothing here can observe it; it is RECORDED. */
  | "stated";

/** The checks the engine implements. Adding one is adding a case below. */
export type PreconditionCheck =
  /**
   * `ref` names a path, relative to the LAYER that owns the diagram, that
   * must exist. Not the repository root: a layer can be a subdirectory
   * today and a repository of its own tomorrow, and a ref written against the
   * repository root means a different file in each (bean `r3gy`, group C).
   */
  | "file-exists";

/** One `<bootstrap.processes:precondition>` on a process. */
export interface Precondition {
  /** Stable id, so a report names WHICH one could not be determined. */
  id: string;
  /** The statement, in the author's words. */
  text: string;
  kind: PreconditionKind;
  /**
   * Present exactly when `kind` is `checkable` — the parser enforces both ways.
   *
   * `base` is the absolute root of the layer that owns the diagram, found
   * when it is parsed. It is carried on the check rather than passed to the
   * evaluator, so no caller can resolve `ref` against a different directory.
   */
  check?: { kind: PreconditionCheck; ref: string; base: string };
}

/**
 * The three states, and the third is the reason this exists.
 *
 * `could-not-determine` is NOT a soft `unsatisfied`. It says the question was
 * asked and has no observable answer, which a reader must be able to tell from
 * a claim that was checked and failed — the same distinction `logCapture`
 * draws for `unknown` twenty lines up, and `ci-health` draws for "could not
 * check".
 */
export type PreconditionVerdict = "satisfied" | "unsatisfied" | "could-not-determine";

/**
 * An element a VIEW load read past: a BPMN type the interpreter does not
 * run, kept so a viewer names it rather than dropping it silently.
 */
export interface NotRunElement {
  id: string;
  type: string;
  name?: string;
  /** For a boundary event, the activity it sits on. */
  attachedTo?: string;
}

/**
 * How {@link loadProcessModel} reads a diagram. `view: true` is for a viewer
 * that DRAWS a process and runs nothing (`gen-processes-viz.ts`): an element
 * type the interpreter does not run is listed on {@link ProcessModel.notRun},
 * with the sequence flows that touch it, instead of refusing the file. The
 * engine never loads in view mode, so it still refuses to run such a diagram.
 */
export interface LoadOptions {
  view?: boolean;
}

export interface ProcessModel {
  /** `bpmn:process/@id`, e.g. `Process_Editing`. */
  id: string;
  /**
   * Present only on a view load ({@link LoadOptions}) that met elements the
   * interpreter does not run: what the diagram shows that a run would not do.
   */
  notRun?: NotRunElement[];
  name: string;
  /** File this was read from, for error messages and provenance. */
  source: string;
  /** Directory holding `source`, so a `folio:decision` ref resolves. */
  dir: string;
  nodes: Map<string, ProcessNode>;
  flows: Map<string, ProcessFlow>;
  /**
   * `<cat-harness.processes:policy enforcement="…"/>` on the process.
   *
   * `strict` — the content-agnostic base. A capability tool guarded by this
   * process refuses when the step is not enabled.
   * `advisory` — the per-content-type processes, where a package's own
   * judgement about its domain applies.
   */
  enforcement: "strict" | "advisory";
  /**
   * `<cat-harness.processes:involvement vocabulary="…"/>` — which involvement methodology's
   * letters this diagram is written in. Absent in the diagram means `raci`.
   *
   * Exposed so a consumer can say WHICH vocabulary a finding is against:
   * `supportive` is a defect in a four-letter process and correct in a
   * five-letter one, and a report that could not name the vocabulary would be
   * asserting the same value is both.
   */
  involvementVocabulary: InvolvementVocabulary;
  /**
   * `<bootstrap.processes:precondition>` elements on the process — what must hold BEFORE the
   * start event, bean `lv3j`.
   *
   * Empty for every diagram that declares none, which is most of them: a
   * process running inside a harness has already had its actor established.
   * `initialize-harness` is the case that motivated this — it runs BEFORE a
   * harness exists, so nothing established who the Bootstrapping Agent is or what it
   * knows, and the claim lived in documentation prose an engine cannot read.
   */
  preconditions: Precondition[];
  /**
   * `<cat-harness.processes:log capture="on|off"/>` on the process — whether running THIS
   * workflow writes activity-log entries to the data store.
   *
   * Three-valued, and the third value is the point: `undefined` means the
   * process did not say, which `resolveCapture` reads as `unknown` rather
   * than as `off`. `off` is somebody's decision; `unknown` is nobody having
   * made one, and an agent that cannot tell whether its audit trail is being
   * kept must say so. The owner's ask was explicit opt-in — *"need explicit
   * like (capture log when agent runs this workflow)"* — so an unmarked
   * process does not reach the store either way; what differs is whether the
   * agent can report a decision or only a default.
   */
  logCapture?: "on" | "off";
  /**
   * Whether the process declares that it starts from a work plan (bean `rwhr`).
   *
   * Optional on the diagram; small processes need none. When `true` and
   * `workflow_start` is called with no `plan` (and no `bean`), the instance
   * starts without refusing and says so in its output.
   */
  startsFromWorkPlan?: boolean;
  /**
   * `<bpmn:documentation>` on the process element itself — what the diagram
   * is FOR. The node-level `documentation` says what one step does; this is
   * the paragraph a reader meets before any step, and `process-documented`
   * in `schemas/sdlc/kg-qa.ts` is what notices when it is missing.
   */
  documentation?: string;
  /**
   * The process's lanes, in document order. A lane NAMES the Role its tasks
   * are performed in; it is not itself a Role (owner, 2026-10-16).
   */
  lanes: LaneDef[];
  /**
   * The stores and data objects drawn in the process, in document order. A
   * store is drawn, not given a lane (owner, 2026-11-01, Q-BR-3 A).
   */
  dataStores: DataStoreUse[];
  /** Every start event, in document order. */
  startNodes: string[];
  /**
   * Decision tables backing gateways that carry `folio:decision`, keyed by
   * gateway id. Loaded with the process, so a missing table or one that cannot
   * route is a *load* error rather than a surprise at the moment of decision.
   */
  decisions: Map<string, DecisionTable>;
  /**
   * The process each call activity expands into, keyed by the call activity's
   * node id.
   *
   * Resolved at LOAD time rather than when a token arrives, for the same reason
   * `decisions` is: a `calledElement` naming a process no file defines is a
   * defect in the diagram, and discovering it at the moment the subprocess is
   * entered is discovering it at the worst possible time. A call activity whose
   * target is absent is simply not in this map — it stays an opaque single step,
   * which is what it was before subprocess descent existed.
   */
  children: Map<string, ProcessModel>;
  /**
   * The inputs this process declares, by name: `<bpmn:ioSpecification>` on
   * the process itself (owner, 2026-11-01, Q-BR-5 A). A shared process that
   * several callers run with their own values — the tracking watch, run by
   * each watch with its own label — declares them here, and each call gives
   * every one a value, as a call to a global task does. Inside the process a
   * step passes one on with a `dataInputAssociation` whose `sourceRef` is the
   * process's input; that step's `inputs` read `{name}` until a call binds it.
   * Absent when the process takes none.
   */
  inputs?: string[];
}

export class UnsupportedBpmn extends Error {}

/**
 * The label on a diagram carries the implementing skill on its own line
 * (`Draft the block edit\n[content-author]`) so a reader of the SVG can see it.
 * The model gets the skill from the extension element instead, so the name is
 * trimmed back to the activity itself — otherwise every tool output repeats it.
 */
function cleanName(raw: string | undefined): string {
  return (raw ?? "").replace(/\s*\[[a-z0-9-]+\]\s*$/i, "").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * An `op` this build does not implement is refused rather than ignored: a step
 * that says it resolves a bean and quietly does nothing is the two-records
 * divergence this extension exists to close.
 */
function readWorkPlanOp(
  nodeId: string,
  ext: { $type: string; op?: string }[],
): WorkPlanOp | undefined {
  const bean = ext.find((v) => v.$type === "folio:bean");
  if (bean === undefined) return undefined;

  // AN UNKNOWN ATTRIBUTE IS REFUSED, not ignored — and this is a different
  // check from the one below, which refuses an unknown op VALUE.
  //
  // The gap between them has a measured cost recorded in
  // `sdlc/processes/bean-lifecycle.bpmn`: a diagram carried
  // `<cat-harness.processes:bean action="create"/>`, the engine reads `op` and never looked at
  // `action`, and "the step silently did nothing for weeks". Nothing could
  // have caught it, because an absent `op` is DOCUMENTED as meaningful —
  // {@link ProcessNode.workPlanOp} says it means the step "touches the plan in
  // some way the tools do not perform automatically". So a misspelling and a
  // deliberate abstention produced the identical parse, and the abstention
  // reading is the one a reader would reach for.
  //
  // Both readings stay available; what is removed is the ambiguity between
  // them. A bare `<cat-harness.processes:bean/>` is still legal and still means abstention.
  //
  // moddle carries an unregistered attribute through as an own enumerable
  // string property beside `$type` — the same behaviour `folio:role variable`
  // relies on — so the check is over own keys, with moddle's own `$`-prefixed
  // internals excluded.
  const unknown = Object.keys(bean).filter(
    (k) => !k.startsWith("$") && k !== "op" && k !== "ref" && k !== "id" && k !== "bean",
  );
  if (unknown.length > 0) {
    throw new UnsupportedBpmn(
      `${nodeId}: cat-harness.processes:bean carries ${unknown.map((k) => `"${k}"`).join(", ")}, ` +
        `which the engine does not read. The attribute is \`op\` — and an absent op ` +
        `MEANS something ("touches the plan in some way the tools do not perform ` +
        `automatically"), so a misspelling here is indistinguishable from a deliberate ` +
        `abstention. Use op="${[...WORK_PLAN_OPS].join('" | op="')}", or drop the ` +
        `attribute entirely if abstention is what you meant.`,
    );
  }

  const op = bean.op;
  if (op === undefined) return undefined;
  if (!WORK_PLAN_OPS.has(op)) {
    throw new UnsupportedBpmn(
      `${nodeId}: cat-harness.processes:bean op="${op}" is not implemented. ` +
        `Supported: ${[...WORK_PLAN_OPS].join(", ")}.`,
    );
  }
  return op as WorkPlanOp;
}

/**
 * `<cat-harness.processes:no-skill reason="…"/>`, with the reason enforced at LOAD time.
 *
 * Throwing here rather than recording a finding is deliberate: a declaration
 * that silences a check is exactly the thing that must not be able to arrive
 * half-formed. A reasonless exemption that merely warns is one somebody adds
 * to get to green and nobody ever reads.
 */
function noSkillReasonOf(
  ext: { $type: string; reason?: string }[],
  id: string,
): string | undefined {
  const decl = ext.find((v) => v.$type === "folio:no-skill");
  if (!decl) return undefined;
  const reason = decl.reason?.trim();
  if (!reason) {
    throw new Error(
      `${id}: <cat-harness.processes:no-skill/> carries no reason. An exemption with no stated ` +
        `justification cannot be reviewed — say why this step has no implementing skill.`,
    );
  }
  return reason;
}

/** `<cat-harness.processes:no-call reason="…"/>` — same load-time rule as {@link noSkillReasonOf}. */
function noCallReasonOf(ext: { $type: string; reason?: string }[], id: string): string | undefined {
  const decl = ext.find((v) => v.$type === "folio:no-call");
  if (!decl) return undefined;
  const reason = decl.reason?.trim();
  if (!reason) {
    throw new Error(
      `${id}: <cat-harness.processes:no-call/> carries no reason. Say why this step uses the skill's know-how ` +
        `rather than calling its process.`,
    );
  }
  return reason;
}

/**
 * `<cat-harness.processes:judgement reason="…"/>`, with the reason enforced at LOAD time.
 *
 * Refused at load rather than recorded as a finding, for the reason
 * {@link noSkillReasonOf} gives: a declaration that silences a question must
 * not be able to arrive half-formed.
 *
 * **Refused on anything but an exclusive gateway**, and refused ALONGSIDE
 * `folio:decision`. A judgement marker on a computed gateway is a node
 * claiming both that a table decides it and that a person does, and a reader
 * has no way to tell which the author meant — so it is a conflict rather than
 * a preference.
 */
/**
 * `<cat-harness.processes:adjudication codes="a b c"/>` — this activity IS a judgement, and
 * these are the answers it may give.
 *
 * Bean `5vo9`, the owner's *"formalized adjudication process so there is 'use
 * judgement'"*. The contract for the request and outcome DOCUMENTS lives in
 * the content core's `schemas/adjudication.ts`; this is the harness half,
 * and the two meet at the data rather than by import — core `needs`
 * cat-harness, so an import from here would run up the layer stack.
 *
 * ## The two refusals, and why the second is the point
 *
 * A bare marker would add a word to a diagram and check nothing. What makes
 * this worth a parser is that it **binds the judgement to who may make it**:
 *
 *  1. Fewer than two codes is not a judgement. One permitted answer is a step
 *     that records assent, and calling it adjudication would let a rubber
 *     stamp inherit a decision's authority.
 *  2. **A mechanical or external actor may not adjudicate.** The owner: *"ONLY
 *     agentic human actor."* `adjudication.bpmn`'s adjudicator step already declares
 *     `<cat-harness.processes:fulfilment kinds="person agent"/>` and says why — *"a mechanical
 *     system may NOT take this step, which is the whole reason the process
 *     exists"* — but nothing tied the two together, so a NEW adjudication step
 *     could omit the fulfilment entirely and no gate would notice. This makes
 *     the marker carry its own precondition.
 *
 * A judgement a `system` actor could perform is a rule, and a rule belongs in
 * a DMN table behind `folio:decision`, which this engine already refuses to
 * let a caller hand-answer.
 */
/**
 * The three attributes `<cat-harness.processes:adjudication/>` carries, by where it sits.
 *
 * `codes` on the adjudicating activity, `code` on a branch out of its gateway,
 * `accepts` on a call activity. They are deliberately three names rather than
 * one overloaded one: an adjudicator declaring its enum, a branch naming the answer
 * that selects it, and a caller stating what it can act on are three different
 * assertions, and a single attribute would let a reader believe any of them.
 */
const ADJUDICATION_ATTRS = {
  /**
   * On a node: an adjudicator's enum, a caller's list of answers it can act
   * on, or `defers="caller"` — an adjudication whose enum belongs to whoever
   * asked.
   */
  node: ["codes", "accepts", "defers", "list"],
  /** On a sequence flow: the one answer that selects this branch. */
  flow: ["code"],
} as const;

/**
 * Read `<cat-harness.processes:adjudication/>` off an element, REFUSING an attribute the
 * engine does not read.
 *
 * The same guard `folio:bean` carries, and for the same measured reason: that
 * element gained a second attribute, a diagram spelled one of them wrong, and
 * "the step silently did nothing for weeks" because an absent attribute was
 * itself meaningful. This element now has three attributes whose absences are
 * all meaningful — an activity with no `codes` is not a judgement, a branch
 * with no `code` opts out, a caller with no `accepts` has not checked — so a
 * misspelling is again indistinguishable from an abstention.
 *
 * Written when `accepts` was added rather than before it, which is the point:
 * one attribute could not be misspelled into another's meaning.
 */
function adjudicationDeclOf(
  ext: { $type: string }[],
  elId: string,
  where: keyof typeof ADJUDICATION_ATTRS = "node",
): { codes?: string; code?: string; accepts?: string; defers?: string; list?: string } | undefined {
  const decl = ext.find((v) => v.$type === "folio:adjudication") as
    | (Record<string, unknown> & {
        codes?: string;
        code?: string;
        accepts?: string;
        defers?: string;
        list?: string;
      })
    | undefined;
  if (!decl) return undefined;
  // Checked PER POSITION, not against the union. `code` is a real attribute
  // on a flow and meaningless on an activity, so a union guard would let
  // `<cat-harness.processes:adjudication code="a b"/>` sit on an adjudicator and be ignored — which
  // is precisely the shape the guard exists to refuse, one element over.
  const allowed = ADJUDICATION_ATTRS[where] as readonly string[];
  const unknown = Object.keys(decl).filter((k) => !k.startsWith("$") && !allowed.includes(k));
  if (unknown.length > 0) {
    throw new UnsupportedBpmn(
      `${elId}: <cat-harness.processes:adjudication/> carries ${unknown.map((k) => `"${k}"`).join(", ")}, ` +
        `which the engine does not read on a ${where}. Here the attribute(s) are ` +
        `${allowed.map((a) => `\`${a}\``).join(", ")} — and each one's ABSENCE ` +
        `means something, so a misspelling reads as a deliberate abstention.`,
    );
  }
  if (decl.list !== undefined && decl.codes === undefined) {
    // `list` names where the codes are DEFINED; it is only meaningful beside
    // the codes it defines. On `accepts` the callee's list already governs.
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication list="${decl.list}"/> without \`codes\`. A code list ` +
        `defines the answers a judgement declares; with no \`codes\` there is nothing it defines.`,
    );
  }
  if (decl.codes !== undefined && decl.accepts !== undefined) {
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication/> declares both \`codes\` and \`accepts\`. ` +
        `A step either MAKES a judgement or CALLS one; declaring both says it is ` +
        `its own caller, and nothing could check that against anything.`,
    );
  }
  return decl;
}

/** Split a whitespace-separated code list, refusing a degenerate enum. */
function codeList(raw: string | undefined, elId: string, attr: string, why: string): string[] {
  const codes = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (codes.length < 2) {
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication ${attr}="…"/> names ${codes.length} code(s). ${why}`,
    );
  }
  if (new Set(codes).size !== codes.length) {
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication ${attr}="…"/> repeats a code. ` +
        `The outcome could not say which was chosen.`,
    );
  }
  return codes;
}

/**
 * One `BpmnModdle` for every load. Building one compiles the BPMN package's
 * type registry, which was about a fifth of a corpus pass when it was done per
 * diagram (bean `sff8`, measured 2026-10-24). It holds TYPES, never a parse:
 * each `fromXML` builds a fresh tree, so nothing a load mutates
 * (`normaliseOwnExtensions`) is seen by the next one.
 */
const sharedModdle = new BpmnModdle();

/** The task's `<cat-harness.processes:narrative href>`, when it carries one. */
function narrativeOf(ext: ReadonlyArray<{ $type: string }>): { narrative?: string } {
  const el = ext.find((v) => v.$type === "folio:narrative") as { href?: unknown } | undefined;
  return typeof el?.href === "string" && el.href.trim() !== "" ? { narrative: el.href.trim() } : {};
}

/** Code lists by layer root — loaded once, since every diagram of a layer shares them. */
const codeListCache = new Map<string, Promise<Map<string, CodeList>>>();

async function checkCodeLists(nodes: Map<string, ProcessNode>, bpmnPath: string): Promise<void> {
  const named = [...nodes.values()].filter((n) => n.adjudication?.list !== undefined);
  if (named.length === 0) return;
  const root = findInstanceRoot(dirname(bpmnPath));
  if (root === undefined) {
    throw new Error(`${basename(bpmnPath)}: names a code list, but no instance declaration owns this diagram`);
  }
  let pending = codeListCache.get(root);
  if (!pending) {
    pending = codeListDirs(root).then(loadCodeLists);
    codeListCache.set(root, pending);
  }
  const lists = await pending;
  for (const n of named) {
    const { list: id, codes } = n.adjudication!;
    const list = lists.get(id!);
    if (!list) {
      throw new Error(
        `${basename(bpmnPath)}: ${n.id} names code list "${id}", which no declared code-list ` +
          `directory of this instance or its dependencies defines (have: ${[...lists.keys()].sort().join(", ") || "none"}).`,
      );
    }
    const defined = [...activeCodes(list)].sort();
    const declared = [...codes].sort();
    if (defined.join("\u0000") !== declared.join("\u0000")) {
      throw new Error(
        `${basename(bpmnPath)}: ${n.id} declares codes (${declared.join(", ")}) but code list ` +
          `"${id}" defines (${defined.join(", ")}). The list is where each answer is defined and ` +
          `sourced; the diagram may not add one the list does not define, or drop one it does.`,
      );
    }
  }
}

/**
 * `<cat-harness.processes:adjudication accepts="a b c"/>` on a call activity — the answers
 * this caller can act on.
 *
 * Bean `bvuk`, and the measurement that produced it is worth carrying here
 * because it is the reason this is a declaration rather than an inference.
 * Six diagrams call `Process_Adjudication`; **not one of them branches on the
 * outcome** — every call activity has exactly one outgoing flow, and the
 * called process has exactly one settled end event, so no caller could branch
 * even if it wanted to. The three codes are therefore internal work selectors,
 * not a value the caller reads.
 *
 * So the mismatch could not be found by looking at the caller's own flows:
 * a caller asking "which side wins" and one asking "does this finding stand"
 * have IDENTICAL shapes. Somebody has to state what the caller can act on,
 * and then a machine can compare it.
 *
 * The check itself is in {@link loadProcessModel}'s descent, because it needs
 * the called process — see there for what it refuses and what it leaves alone.
 */
/**
 * `<cat-harness.processes:adjudication defers="caller"/>` — an adjudication whose enum the
 * caller declares. Bean `bvuk`.
 *
 * Carries the same actor restriction as a `codes` adjudication, because it is
 * one: the step is performed, a person or an agent performs it, and a
 * mechanical actor may not. What it does not carry is the enum.
 */
function adjudicationDefersOf(
  el: { id: string; $type: string },
  decl: { defers?: string } | undefined,
  fulfilment: { kinds: ActorKind[]; reason: string } | undefined,
): boolean {
  if (!decl || decl.defers === undefined) return false;
  if (decl.defers !== "caller") {
    throw new Error(
      `${el.id}: <cat-harness.processes:adjudication defers="${decl.defers}"/>. The only value is ` +
        `\`caller\` — an enum can be deferred to whoever asked, and there is nowhere ` +
        `else for it to come from.`,
    );
  }
  if (!(ACTIVITY_TYPES as readonly string[]).includes(el.$type)) {
    throw new Error(
      `${el.id}: <cat-harness.processes:adjudication defers="caller"/> is only meaningful on an activity — ` +
        `somebody performs an adjudication, and ${el.$type} is not performed.`,
    );
  }
  requireAdjudicatorKinds(el.id, fulfilment);
  return true;
}

function adjudicationAcceptsOf(
  ext: { $type: string }[],
  el: { id: string; $type: string },
  decl: { codes?: string; accepts?: string } | undefined,
): string[] | undefined {
  if (!decl || decl.accepts === undefined) return undefined;
  if (el.$type !== "bpmn:CallActivity") {
    throw new Error(
      `${el.id}: <cat-harness.processes:adjudication accepts="…"/> is only meaningful on a call activity — ` +
        `it states what a CALLER can act on, and ${el.$type} calls nothing. ` +
        `A step that makes the judgement itself declares \`codes\`.`,
    );
  }
  return codeList(
    decl.accepts,
    el.id,
    "accepts",
    `A caller that can act on one answer is not consuming a judgement, and the ` +
      `called adjudicator must offer at least two.`,
  );
}

function adjudicationOf(
  ext: { $type: string; codes?: string }[],
  el: { id: string; $type: string },
  fulfilment: { kinds: ActorKind[]; reason: string } | undefined,
  decl: { codes?: string; accepts?: string; list?: string } | undefined,
): { codes: string[]; list?: string } | undefined {
  if (!decl || decl.codes === undefined) return undefined;
  if (!(ACTIVITY_TYPES as readonly string[]).includes(el.$type)) {
    throw new Error(
      `${el.id}: <cat-harness.processes:adjudication/> is only meaningful on an activity — ` +
        `somebody performs a judgement, and ${el.$type} is not performed.`,
    );
  }
  const codes = codeList(
    decl.codes,
    el.id,
    "codes",
    `A judgement needs at least two permitted answers — one is assent, and naming ` +
      `it a judgement would give a rubber stamp a decision's authority.`,
  );
  requireAdjudicatorKinds(el.id, fulfilment);
  return { codes, ...(decl.list !== undefined ? { list: decl.list.trim() } : {}) };
}

/**
 * Refusal 2, shared by every adjudication marker naming a PERFORMED step.
 *
 * Absent fulfilment is REFUSED rather than defaulted: a step that has not said
 * who may adjudicate has not restricted anyone, and the restriction is the
 * whole reason this process kind exists. Factored out when `defers` arrived,
 * so a third marker cannot be added that quietly skips it.
 */
function requireAdjudicatorKinds(
  elId: string,
  fulfilment: { kinds: ActorKind[]; reason: string } | undefined,
): void {
  if (fulfilment === undefined) {
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication/> with no <cat-harness.processes:fulfilment kinds="…"/>. ` +
        `Say who may adjudicate — an adjudication open to a mechanical actor is a rule, ` +
        `and a rule belongs in a DMN table behind <cat-harness.processes:decision/>.`,
    );
  }
  const forbidden = fulfilment.kinds.filter((k) => k !== "person" && k !== "agent");
  if (forbidden.length > 0) {
    throw new Error(
      `${elId}: <cat-harness.processes:adjudication/> on a step fulfillable by ${forbidden.join(", ")}. ` +
        `Only \`person\` and \`agent\` may adjudicate. If a mechanical actor can decide it, ` +
        `it is computable — use <cat-harness.processes:decision/> and a DMN table.`,
    );
  }
}

function judgementReasonOf(
  ext: { $type: string; reason?: string }[],
  el: { id: string; $type: string },
): string | undefined {
  const decl = ext.find((v) => v.$type === "folio:judgement");
  if (!decl) return undefined;
  if (el.$type !== "bpmn:ExclusiveGateway") {
    throw new Error(
      `${el.id}: <cat-harness.processes:judgement/> is only meaningful on an exclusive gateway — ` +
        `it says who chooses the branch, and ${el.$type} has no branch to choose.`,
    );
  }
  if (ext.some((v) => v.$type === "folio:decision")) {
    throw new Error(
      `${el.id}: carries both <cat-harness.processes:decision/> and <cat-harness.processes:judgement/>. A gateway ` +
        `is computed or it is somebody's call; declaring both leaves a reader ` +
        `unable to tell which the author meant.`,
    );
  }
  const reason = decl.reason?.trim();
  if (!reason) {
    throw new Error(
      `${el.id}: <cat-harness.processes:judgement/> carries no reason. Say WHOSE call this is and ` +
        `why no table can make it — an exemption nobody can review is one ` +
        `somebody added to get to green.`,
    );
  }
  return reason;
}

/**
 * `<cat-harness.processes:fulfilment kinds="…" reason="…"/>`, validated at LOAD time.
 *
 * Three ways to get it wrong, all refused here rather than recorded as a
 * finding, because each produces a declaration that reads as an answer and is
 * not one: no `kinds`, a kind outside {@link ACTOR_KINDS}, and no `reason`.
 * The `kinds` list is whitespace-separated — a BPMN attribute is a string, and
 * a one-element list must look like the same thing as a two-element one.
 */
function fulfilmentOf(
  ext: { $type: string; kinds?: string; reason?: string }[],
  id: string,
): { kinds: ActorKind[]; reason: string } | undefined {
  const decl = ext.find((v) => v.$type === "folio:fulfilment");
  if (!decl) return undefined;
  const kinds = (decl.kinds ?? "").trim().split(/\s+/).filter(Boolean);
  if (kinds.length === 0) {
    throw new Error(
      `${id}: <cat-harness.processes:fulfilment/> names no kinds. Say which of ` +
        `${ACTOR_KINDS.join(", ")} may perform this step.`,
    );
  }
  const unknown = kinds.filter((k) => !(ACTOR_KINDS as readonly string[]).includes(k));
  if (unknown.length) {
    throw new Error(
      `${id}: <cat-harness.processes:fulfilment/> names unknown actor kind(s) ${unknown.join(", ")}. ` +
        `One or more of: ${ACTOR_KINDS.join(", ")}.`,
    );
  }
  const reason = decl.reason?.trim();
  if (!reason) {
    throw new Error(
      `${id}: <cat-harness.processes:fulfilment/> carries no reason. It overrides what the BPMN task ` +
        `type already says about this step, so say why the derived answer is wrong.`,
    );
  }
  return { kinds: kinds as ActorKind[], reason };
}

function kindOf(type: string): NodeKind {
  if (type === "bpmn:StartEvent") return "start";
  if (type === "bpmn:EndEvent") return "end";
  if (type === "bpmn:ExclusiveGateway") return "exclusive";
  if (type === "bpmn:ParallelGateway") return "parallel";
  if (type === "bpmn:BoundaryEvent") return "boundary";
  return "activity";
}

// bpmn-moddle returns loosely-typed element trees; these shapes are the parts
// this module reads.
interface ModdleElement {
  $type: string;
  id: string;
  name?: string;
  /** A boundary event's activity. */
  attachedToRef?: { id?: string };
  /** A boundary event: false when it is non-interrupting. moddle's default is true. */
  cancelActivity?: boolean;
  documentation?: { text?: string }[];
  extensionElements?: {
    values?: {
      $type: string;
      ref?: string;
      op?: string;
      bean?: string;
      enforcement?: string;
      capture?: string;
      involvement?: string;
      /** `<cat-harness.processes:involvement vocabulary="…"/>` on the process. */
      vocabulary?: string;
      /** `<cat-harness.processes:adjudication codes="…"/>` on an activity. */
      codes?: string;
      /** `<cat-harness.processes:adjudication code="…"/>` on a branch out of its gateway. */
      code?: string;
      /** `<cat-harness.processes:adjudication accepts="…"/>` on a call activity. */
      accepts?: string;
      /** `<cat-harness.processes:adjudication defers="caller"/>` on an adjudicating activity. */
      defers?: string;
      relaxable?: string;
      /** `<bootstrap.processes:precondition>` — bean `lv3j`. */
      id?: string;
      kind?: string;
      text?: string;
      check?: string;
      /** bpmn-moddle puts an element's text content here when it has no `text`. */
      $body?: string;
      reason?: string;
      kinds?: string;
    }[];
  };
  calledElement?: string;
  /** BPMN's `ioSpecification`: a global task's declared inputs, and a call's matching ones. */
  ioSpecification?: { dataInputs?: { id: string; name?: string }[] };
  /** A call's `dataInputAssociation`s: an `assignment` gives a declared input its value. */
  dataInputAssociations?: {
    /**
     * A process input this association passes on (in a process that declares
     * inputs), or a data store or data object it reads rather than assigning a value.
     */
    sourceRef?: { id?: string }[];
    targetRef?: { id?: string };
    assignment?: { from?: { body?: string }; to?: { body?: string } }[];
  }[];
  /** A step's `dataOutputAssociation`s: each writes to the data store or data object it targets. */
  dataOutputAssociations?: { id?: string; targetRef?: { id?: string } }[];
  /** A data store reference's `dataStoreRef`, resolved by moddle when the file declares the store. */
  dataStoreRef?: { id?: string };
  sourceRef?: { id: string };
  targetRef?: { id: string };
  flowElements?: ModdleElement[];
  laneSets?: {
    lanes?: {
      id?: string;
      name?: string;
      flowNodeRef?: { id: string }[];
      extensionElements?: { values?: { $type: string; ref?: string }[] };
      /** BPMN's own `partitionElementRef`, resolved by moddle to the element it names. */
      partitionElementRef?: { id?: string; $type?: string };
    }[];
  }[];
  rootElements?: ModdleElement[];
}

/**
 * Find the process that declares `nodeId`, descending through call activities.
 *
 * Model-only, so it answers for a phase no instance has entered yet. That is the
 * difference between "there is no such step" and "that step is in a phase you
 * have not reached", and a gate that cannot tell them apart sends its reader to
 * look for a typo that is not there.
 */
export function findInModel(
  model: ProcessModel,
  nodeId: string,
): { model: ProcessModel; phase: string[] } | undefined {
  if (model.nodes.has(nodeId)) return { model, phase: [] };
  for (const [call, child] of model.children) {
    const hit = findInModel(child, nodeId);
    if (hit) return { ...hit, phase: [model.nodes.get(call)!.name, ...hit.phase] };
  }
  return undefined;
}

/**
 * Map every `bpmn:process` id declared in a directory to the file declaring it.
 *
 * Read from disk on every load rather than cached. The corpus is twenty small
 * files, and a cache keyed by directory is exactly the thing that makes a test
 * which rewrites a fixture see the previous run's answer.
 */
function processIndex(dir: string): Map<string, string> {
  return idIndex(dir, /<(?:bpmn:)?process\b[^>]*?\sid="([^"]+)"/g);
}

/**
 * Every global task id declared under `dir`, recursively, mapped to its file
 * — the {@link processIndex} walk, for BPMN's reusable tasks.
 */
function globalTaskIndex(dir: string): Map<string, string> {
  return idIndex(dir, GLOBAL_TASK_ELEMENT);
}

/**
 * Where a called global task lives in the calling diagram's OWN layer:
 * its declared `processes` directories. Never a dependency's — a layer's
 * global tasks are shared within that layer only (owner, 2026-10-20, "c1").
 */
function ownInstanceGlobalTaskIndex(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of instanceLayout(dir).own) {
    if (!existsSync(d)) continue;
    for (const [id, home] of globalTaskIndex(d)) if (!out.has(id)) out.set(id, home);
  }
  return out;
}

/**
 * Where a layer's diagrams live: its own declared `processes`
 * directories, and each dependency's, nearest dependency first. LAYOUT only
 * — paths, never a parsed model (`normaliseOwnExtensions` mutates a model in
 * place, which is why `fallbackRolesBySkill` is a pass and not a cache).
 *
 * `own` is `[]` when no declaration owns the directory or its own
 * directories cannot be resolved; `deps` is `[]` when the dependencies
 * cannot be ordered, and leaves out a dependency whose directories cannot be
 * resolved — the answers the three index builders gave on their own.
 */
interface InstanceLayout {
  own: string[];
  deps: string[][];
}

/**
 * {@link InstanceLayout}s by layer root, each held with the signature it
 * was computed under.
 *
 * Bean `sff8`. Resolving the layout re-reads every declaration in the
 * checkout (`orderedDependencies` → `layerRootsIn` → `findDeclarationFile`),
 * and `ownInstanceProcessIndex`, `dependencyProcessIndex` and
 * `ownInstanceGlobalTaskIndex` each did it once per DIAGRAM. Measured
 * 2026-10-24 over 101 diagrams: one `loadProcessModel` pass ~7 s, 49 % of it
 * in that discovery and 28 % in XML parsing. Every diagram of a layer
 * shares one answer, so it is computed once per layer root.
 *
 * Keyed, like {@link readBpmnCached}, on what would change the answer: the
 * layer root's listing and each `*.json` in it (path, mtime, size — the
 * declaration among them), the listing of the directory above it (the
 * checkout a nested layer's siblings are discovered in), and the same
 * `*.json` signature of every dependency root. A fixture that adds a
 * layer root, or rewrites a declaration, is resolved again.
 */
const layouts = new Map<string, { sig: string; depSig: string; depRoots: string[]; layout: InstanceLayout }>();

/** A directory's entry names and the (mtime, size) of each `*.json` in it — cheap: a readdir and a stat per json. */
function dirSignature(dir: string, withJson: boolean): string {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return "\0unreadable";
  }
  if (!withJson) return names.join("\0");
  return names
    .map((n) => {
      if (!n.endsWith(".json")) return n;
      try {
        const st = statSync(join(dir, n));
        return `${n}@${st.mtimeMs}:${st.size}`;
      } catch {
        return `${n}@?`;
      }
    })
    .join("\0");
}

function instanceLayout(dir: string): InstanceLayout {
  let own: string | undefined;
  try {
    own = findInstanceRoot(dir);
  } catch {
    return { own: [], deps: [] };
  }
  if (own === undefined || own === null) return { own: [], deps: [] };
  const sig = `${dirSignature(own, true)}\n${dirSignature(dirname(own), false)}`;
  const hit = layouts.get(own);
  if (hit && hit.sig === sig && hit.depSig === hit.depRoots.map((r) => dirSignature(r, true)).join("\n")) {
    return hit.layout;
  }
  let ownDirs: string[] = [];
  try {
    ownDirs = directoriesForGraph(own, "processes");
  } catch {
    ownDirs = [];
  }
  let depRoots: string[] = [];
  try {
    depRoots = orderedDependencies(own).map((d) => d.rootPath).reverse();
  } catch {
    depRoots = [];
  }
  const deps: string[][] = [];
  for (const root of depRoots) {
    try {
      deps.push(directoriesForGraph(root, "processes"));
    } catch {
      continue;
    }
  }
  const layout = { own: ownDirs, deps };
  if (layouts.size > 256) layouts.clear();
  layouts.set(own, { sig, depSig: depRoots.map((r) => dirSignature(r, true)).join("\n"), depRoots, layout });
  return layout;
}

/**
 * A diagram's text, read once per (path, mtime, size).
 *
 * The id indexes above walk every `.bpmn` of a layer, and a corpus pass
 * loads each diagram once, so the same files were read once per diagram per
 * index. With the global-task index (owner, 2026-10-20, "a1 b1 c1") that was
 * twice per diagram, and the corpus convention test went over its 5 s budget.
 * Keyed on the file's mtime and size, so a fixture a test rewrites is read
 * again: the reason {@link processIndex} is not cached by directory still holds.
 */
const bpmnText = new Map<string, { mtimeMs: number; size: number; xml: string }>();
function readBpmnCached(path: string): string {
  const st = statSync(path);
  const hit = bpmnText.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.xml;
  const xml = readFileSync(path, "utf-8");
  if (bpmnText.size > 4096) bpmnText.clear();
  bpmnText.set(path, { mtimeMs: st.mtimeMs, size: st.size, xml });
  return xml;
}

function idIndex(dir: string, pattern: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  // RECURSIVE since placement PR3 (bean `63wl`): a declared `processes/`
  // directory groups its diagrams by concern (`processes/sdlc/`,
  // `processes/process/`, …), so a caller and its callee in one layer can
  // sit in sibling subdirectories. A flat read here turned every cross-group
  // call opaque — no descent, and no `checkAcceptedCodes` — exactly the
  // silent failure `dependencyProcessIndex` was written to stop one level out.
  // Files directly in `dir` are read first so they win a duplicate id.
  const walk = (d: string): void => {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const e of entries.filter((x) => x.isFile() && x.name.endsWith(".bpmn")).sort((a, b) => a.name.localeCompare(b.name))) {
      const xml = readBpmnCached(join(d, e.name));
      for (const m of xml.matchAll(new RegExp(pattern.source, "g"))) {
        if (!out.has(m[1]!)) out.set(m[1]!, join(d, e.name));
      }
    }
    for (const e of entries.filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      walk(join(d, e.name));
    }
  };
  walk(dir);
  return out;
}

/**
 * Where a called process lives in the calling diagram's OWN layer when no
 * file beside it defines it: that layer's declared `processes` directories,
 * walked recursively. Bean `63wl` — once diagrams are grouped by concern, the
 * sibling directory is one group, not the layer.
 *
 * Every process id at once, keyed by id, the directories merged in
 * declaration order with the first definition winning — the answer a per-id
 * walk gave, built once per load instead of once per call activity.
 */
function ownInstanceProcessIndex(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of instanceLayout(dir).own) {
    if (!existsSync(d)) continue;
    for (const [id, home] of processIndex(d)) if (!out.has(id)) out.set(id, home);
  }
  return out;
}

/**
 * Where a called process lives when no SIBLING file defines it: the declared
 * `processes` directories of the calling diagram's layer's DEPENDENCIES,
 * nearest dependency first, first definition wins.
 *
 * Bean `cjvs` (2026-09-30). The sibling index was the whole lookup while
 * every calling diagram and its callee shared one directory. Moving
 * `refresh-materialized.bpmn` into `large-datasets/processes/` made it the
 * first diagram whose callee (`Process_Adjudication`) is in ANOTHER
 * layer — one it is allowed to reach, since large-datasets needs
 * the content core, which needs cat-harness. Without this the call went
 * silently opaque: no descent, and `checkAcceptedCodes` never ran. (Bean
 * `j7ql`, 2026-10-01, dissolved large-datasets into cat-harness, so the
 * diagram is back in `cat-harness/processes/` beside its callee; the
 * dependency search stays, for every other cross-instance call.)
 *
 * Only DEPENDENCIES are searched, never dependents, so a lower layer's
 * diagram cannot descend into a process defined above it — the same arrow
 * `kg:detangle:direction` grades. Any failure to resolve the layer or its
 * dependencies yields no entry, which keeps the pre-existing behaviour (the
 * call stays an opaque single step) rather than inventing an answer. Built
 * once per load for every id, like {@link ownInstanceProcessIndex}.
 */
function dependencyProcessIndex(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const dirs of instanceLayout(dir).deps) {
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      for (const [id, home] of processIndex(d)) if (!out.has(id)) out.set(id, home);
    }
  }
  return out;
}

/**
 * Answer one precondition, or say that it cannot be answered.
 *
 * A `stated` precondition returns `could-not-determine` on the FIRST line,
 * before anything else is consulted. That ordering is deliberate: there is no
 * path through this function on which a claim about the actor comes back
 * `satisfied`, so the guarantee is structural rather than a rule somebody has
 * to keep remembering.
 *
 * A `file-exists` ref resolves against `check.base`, the owning layer's
 * root, and nothing else — which is why this takes no root argument.
 */
export function evaluatePrecondition(p: Precondition): PreconditionVerdict {
  if (p.kind === "stated") return "could-not-determine";
  // `check` is present exactly when kind is `checkable` — the parser refuses
  // both halves of the other case — but a model built by hand in a test could
  // still violate it, and guessing would be the defect this module is about.
  if (!p.check) return "could-not-determine";
  switch (p.check.kind) {
    case "file-exists":
      return existsSync(join(p.check.base, p.check.ref)) ? "satisfied" : "unsatisfied";
  }
}

/**
 * Every precondition of a process, answered.
 *
 * Returned as a list rather than a single verdict on purpose. "The process is
 * ready" is not a thing this can say when two of its three conditions are
 * unobservable, and collapsing them to one boolean is how the third state
 * gets lost — the reader needs to see WHICH held and which nobody could tell.
 */
export function evaluatePreconditions(
  model: Pick<ProcessModel, "preconditions">,
): Array<{ precondition: Precondition; verdict: PreconditionVerdict }> {
  return model.preconditions.map((precondition) => ({
    precondition,
    verdict: evaluatePrecondition(precondition),
  }));
}

/**
 * Rename every parsed extension element by the NAMESPACE it is in, not the
 * prefix the diagram wrote (bean `12s9`).
 *
 * `bpmn-moddle` is given no descriptor for our extensions, so it keeps each
 * one as a generic element whose `$type` is the prefix as written — and every
 * reader below matches `$type === "folio:…"`. Left alone, a diagram binding
 * `bootstrap.processes:` to our address would parse cleanly with all of its
 * extensions ignored, and one binding `folio:` to a FOREIGN address would have
 * its elements read as ours. The parser does record the resolved namespace on
 * each element (`$descriptor.ns.uri`), so both are fixed here, once:
 *
 * - in one of OUR namespaces → `folio:<local>`, whatever the prefix;
 * - spelt `folio:` but in someone else's → `<uri>#<local>`, which no reader
 *   matches.
 *
 * Mutates in place; typed BPMN elements are untouched, because their `$type`
 * never starts with the canonical prefix and their namespace is not ours.
 */
export function normaliseOwnExtensions(root: unknown): void {
  const seen = new Set<object>();
  const walk = (v: unknown): void => {
    if (v === null || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    const el = v as { $type?: unknown; $descriptor?: { ns?: { uri?: string; localName?: string } } };
    const ns = el.$descriptor?.ns;
    if (typeof el.$type === "string" && ns?.localName !== undefined) {
      if (isOwnExtensionNamespace(ns.uri)) el.$type = `${CANONICAL_EXTENSION_PREFIX}:${ns.localName}`;
      else if (el.$type.startsWith(`${CANONICAL_EXTENSION_PREFIX}:`)) el.$type = `${ns.uri ?? "urn:unbound"}#${ns.localName}`;
    }
    for (const k of Object.keys(v)) if (!k.startsWith("$")) walk((v as Record<string, unknown>)[k]);
  };
  walk(root);
}

/**
 * `loadProcessModel` over a file that holds a layer's shared global tasks
 * and no process. A reader listing diagrams passes such a file by with
 * {@link isGlobalTasksFile} before loading; this class lets one that did not
 * tell the case apart from a broken diagram.
 */
export class GlobalTasksFile extends UnsupportedBpmn {}

/** Parsed global-tasks files, keyed by their text, so a fixture rewritten on disk is never answered from a stale parse. */
const globalTaskFiles = new Map<string, Promise<ModdleElement>>();

/** One global task as a reader lists it: what it is, the Skill it names, the inputs it declares. */
export interface GlobalTaskDef {
  id: string;
  /** The name on the element, with the `[skill]` line stripped. */
  name: string;
  /** BPMN type as bpmn-moddle names it, e.g. `bpmn:GlobalUserTask`. */
  type: string;
  /** The task type a call to it runs as ({@link GLOBAL_TASK_TYPES}). */
  runsAs: string;
  source: string;
  documentation?: string;
  skills: string[];
  /** The names of its declared `dataInput`s, which every call gives a value. */
  inputs: string[];
}

/**
 * Every global task `file` defines — the read a tool makes of a layer's
 * shared global-tasks file in place of {@link loadProcessModel}, which
 * refuses it ({@link GlobalTasksFile}).
 */
export async function loadGlobalTasks(file: string): Promise<GlobalTaskDef[]> {
  const defs = await parseGlobalTaskFile(file);
  return (defs.rootElements ?? [])
    .filter((e) => e.$type in GLOBAL_TASK_TYPES)
    .map((g) => ({
      id: g.id,
      name: cleanName(g.name) || g.id,
      type: g.$type,
      runsAs: GLOBAL_TASK_TYPES[g.$type]!,
      source: file,
      documentation: g.documentation?.[0]?.text?.replace(...DOC_WS).trim() || undefined,
      skills: (g.extensionElements?.values ?? []).filter((v) => v.$type === "folio:skill" && v.ref).map((v) => v.ref!),
      inputs: (g.ioSpecification?.dataInputs ?? []).map((d) => d.name ?? d.id),
    }));
}

/** The global task `id` defined in `file`, with our extensions normalised. */
async function readGlobalTask(file: string, id: string): Promise<ModdleElement> {
  const g = ((await parseGlobalTaskFile(file)).rootElements ?? []).find((e) => e.id === id && e.$type in GLOBAL_TASK_TYPES);
  if (!g) throw new UnsupportedBpmn(`${basename(file)}: ${id} is indexed as a global task and is not one`);
  return g;
}

function parseGlobalTaskFile(file: string): Promise<ModdleElement> {
  const xml = readFileSync(file, "utf-8");
  let parsed = globalTaskFiles.get(xml);
  if (!parsed) {
    if (globalTaskFiles.size > 64) globalTaskFiles.clear();
    parsed = (async () => {
      const out = await new BpmnModdle().fromXML(xml);
      const { warnings } = partitionTolerated(out.warnings);
      if (warnings.length > 0) {
        throw new UnsupportedBpmn(`${basename(file)}: ${warnings.length} parse warning(s) — ${warnings.map((w: unknown) => String(w)).join("; ")}`);
      }
      normaliseOwnExtensions(out.rootElement);
      return out.rootElement as unknown as ModdleElement;
    })();
    globalTaskFiles.set(xml, parsed);
  }
  return parsed;
}

/** The global task's documentation, then the call's own as a second paragraph. */
function sharedDocumentation(g: ModdleElement, call: ModdleElement): { text?: string }[] | undefined {
  const text = [g, call].map((e) => e.documentation?.[0]?.text?.trim()).filter((t): t is string => !!t);
  return text.length ? [{ text: text.join("\n\n") }] : undefined;
}

/**
 * The step a call to global task `g` runs as: the global task's type
 * ({@link GLOBAL_TASK_TYPES}), name, documentation and extensions, with the
 * call's own id, its own name when it gives one, its own documentation as a
 * paragraph after the global task's (what this use adds to the shared step),
 * and its own extensions added after the global task's. And the values the call gives
 * the global task's declared inputs — every one, and no other, or the
 * diagram does not load: a shared step run without its label is not the step
 * on the diagram.
 */
/**
 * The values a call gives the inputs its callee declares — a global task's or
 * a process's, read the same way. Each value is an `assignment`'s literal, or,
 * in a process that declares inputs, `{name}` for the process input the
 * association's `sourceRef` passes on (bound when a call to that process gives
 * it a value: {@link bindInputs}). Every declared input gets one, and no other,
 * or the diagram does not load.
 */
function callInputs(
  call: ModdleElement,
  declared: readonly string[],
  where: string,
  processInputs: ReadonlyMap<string, string> = new Map(),
): Record<string, string> {
  const nameOf = new Map((call.ioSpecification?.dataInputs ?? []).map((d) => [d.id, d.name ?? d.id]));
  const given: Record<string, string> = {};
  for (const a of call.dataInputAssociations ?? []) {
    const source = a.sourceRef?.[0]?.id;
    const target = a.targetRef?.id;
    if (a.sourceRef?.length && (source === undefined || !processInputs.has(source))) {
      // An input of the call that names a source which is no input of this process.
      if (processInputs.size && target !== undefined && nameOf.has(target) && !a.assignment?.length) {
        throw new UnsupportedBpmn(`${where}: input "${nameOf.get(target)}" passes on ${source ?? "nothing"}, which is not an input this process declares`);
      }
      // A read from a drawn store is not an input assignment (`dataOf` below).
      continue;
    }
    const name = target === undefined ? undefined : nameOf.get(target);
    if (name === undefined) throw new UnsupportedBpmn(`${where}: a dataInputAssociation targets ${target ?? "nothing"}, which is not one of the call's own dataInputs`);
    if (source !== undefined) {
      given[name] = `{${processInputs.get(source)!}}`;
      continue;
    }
    const value = a.assignment?.[0]?.from?.body;
    if (value === undefined) throw new UnsupportedBpmn(`${where}: input "${name}" is associated with no assignment value`);
    given[name] = value.trim();
  }
  const missing = declared.filter((n) => !(n in given));
  if (missing.length) throw new UnsupportedBpmn(`${where}, which declares input(s) ${missing.join(", ")}, and gives none of them a value`);
  const extra = Object.keys(given).filter((n) => !declared.includes(n));
  if (extra.length) throw new UnsupportedBpmn(`${where}, which declares no input(s) ${extra.join(", ")}`);
  return given;
}

/**
 * Give a called process's `{name}` placeholders the values its call gave.
 * The child model is loaded fresh for each call, so this rewrites its own copy.
 */
function bindInputs(child: ProcessModel, values: Readonly<Record<string, string>>): void {
  for (const node of child.nodes.values()) {
    if (!node.inputs) continue;
    for (const [k, v] of Object.entries(node.inputs)) {
      const m = /^\{([^{}]+)\}$/.exec(v);
      if (m && m[1]! in values) node.inputs[k] = values[m[1]!]!;
    }
  }
  // A call inside the child passed the child's own inputs on as `{name}` too.
  for (const grandchild of child.children.values()) bindInputs(grandchild, values);
}

function asSharedStep(
  call: ModdleElement,
  g: ModdleElement,
  bpmnPath: string,
  processInputs?: ReadonlyMap<string, string>,
): { el: ModdleElement; inputs?: Record<string, string> } {
  const where = `${basename(bpmnPath)}: ${call.id} calls global task ${g.id}`;
  const declared = (g.ioSpecification?.dataInputs ?? []).map((d) => d.name ?? d.id);
  const given = callInputs(call, declared, where, processInputs);
  return {
    el: {
      ...g,
      $type: GLOBAL_TASK_TYPES[g.$type]!,
      id: call.id,
      name: call.name || g.name,
      documentation: sharedDocumentation(g, call),
      extensionElements: { values: [...(g.extensionElements?.values ?? []), ...(call.extensionElements?.values ?? [])] },
      calledElement: undefined,
    },
    ...(declared.length ? { inputs: given } : {}),
  };
}

/**
 * The moddle warnings a diagram may raise BY DESIGN under the 2026-10-16
 * lane / role / skill model, separated from the ones that still refuse a load.
 *
 * `loadProcessModel` refuses a diagram with any parse warning, and that rule
 * stays. Two warnings are not defects in what the diagram says, though:
 *
 * - **`unresolved reference` on a lane's `partitionElementRef`.** The value is
 *   the Role's id verbatim, so the binding is fully known even when the file
 *   has not (yet) declared the `<bpmn:resource>` it points at. It is handed
 *   back, keyed by lane id, and recorded as `roleResourceDeclared: false` —
 *   reported, not refused, because refusing would make every diagram whose
 *   migration is half-done unloadable by the engine that runs it.
 * - **`unresolved reference` on `<bpmn:extension definition="…">`** naming one
 *   of OUR extension elements. The first draft of the spec declared extension
 *   use that way; bpmn-moddle resolves `definition` as an id reference and
 *   warns, which is why the spec moved to `<bpmn:import>` the same day. A file
 *   written to the first draft still means exactly what it says.
 */
export function partitionTolerated(raw: readonly unknown[]): {
  warnings: unknown[];
  unresolvedPartitions: Map<string, string>;
  /** Data store reference id → the store id it names but this file does not declare. */
  unresolvedDataStores: Map<string, string>;
} {
  const warnings: unknown[] = [];
  const unresolvedPartitions = new Map<string, string>();
  const unresolvedDataStores = new Map<string, string>();
  for (const w of raw) {
    const ww = w as { message?: string; property?: string; value?: unknown; element?: { $type?: string; id?: string } };
    const unresolved = typeof ww.message === "string" && ww.message.startsWith("unresolved reference");
    if (unresolved && ww.property === "bpmn:partitionElementRef" && ww.element?.$type === "bpmn:Lane" && typeof ww.value === "string") {
      if (ww.element.id) unresolvedPartitions.set(ww.element.id, ww.value);
      continue;
    }
    // A store declared once for the layer, not in this file: the same
    // tolerance a lane's role gets, for the same reason (owner, 2026-11-01).
    if (unresolved && ww.property === "bpmn:dataStoreRef" && ww.element?.$type === "bpmn:DataStoreReference" && typeof ww.value === "string") {
      if (ww.element.id) unresolvedDataStores.set(ww.element.id, ww.value);
      continue;
    }
    if (
      unresolved &&
      ww.property === "bpmn:definition" &&
      ww.element?.$type === "bpmn:Extension" &&
      typeof ww.value === "string" &&
      /^[\w.-]+\.processes:[\w-]+$/.test(ww.value)
    ) {
      continue;
    }
    warnings.push(w);
  }
  return { warnings, unresolvedPartitions, unresolvedDataStores };
}

export async function loadProcessModel(
  bpmnPath: string,
  /** Process ids already on the load path, so a call-activity cycle is refused. */
  seen: readonly string[] = [],
  /**
   * The fallback process indexes already built during THIS load, by the
   * calling diagram's directory, so a descent into the same layer does not
   * rebuild them. Created fresh by every top-level call: nothing outlives a
   * load, so a test that rewrites a fixture still sees its own disk.
   */
  homes: Map<string, { own?: Map<string, string>; dep?: Map<string, string>; globals?: Map<string, string> }> = new Map(),
  opts: LoadOptions = {},
): Promise<ProcessModel> {
  const parsed = await sharedModdle.fromXML(readFileSync(bpmnPath, "utf-8"));
  const { rootElement } = parsed;
  const { warnings, unresolvedPartitions, unresolvedDataStores } = partitionTolerated(parsed.warnings);
  normaliseOwnExtensions(rootElement);
  if (warnings.length > 0) {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: ${warnings.length} parse warning(s) — ` +
        `${warnings.map((w: unknown) => String(w)).join("; ")}`,
    );
  }

  const defs = rootElement as unknown as ModdleElement;
  const proc = (defs.rootElements ?? []).find((e) => e.$type === "bpmn:Process");
  if (!proc) {
    if ((defs.rootElements ?? []).some((e) => e.$type in GLOBAL_TASK_TYPES || e.$type === "bpmn:DataStore")) {
      throw new GlobalTasksFile(
        `${basename(bpmnPath)}: holds no bpmn:Process — it is a layer's shared global tasks, read through the ` +
          `call activities that call them (isGlobalTasksFile)`,
      );
    }
    throw new UnsupportedBpmn(`${basename(bpmnPath)}: no bpmn:Process`);
  }

  // An EVENT SUBPROCESS (`triggeredByEvent`) is a start-to-end path that can
  // begin at any point of the process, e.g. a commenter withdrawing a comment
  // at whatever step it is at (public-comment.bpmn, owner 2026-10-31). Its
  // steps are read as the process's own, the way a second top-level start
  // always was; the container is a drawing of "any time", not a step. Its
  // steps take the container's lane when their own lane does not list them.
  // Interrupting the main path is not modelled here: the engine has no token
  // to cancel until it does, and claiming it would be a guess.
  const eventSubOf = new Map<string, string>();
  const allElements = (proc.flowElements ?? []).flatMap((e) => {
    if (e.$type !== "bpmn:SubProcess" || !(e as { triggeredByEvent?: boolean }).triggeredByEvent) return [e];
    const inner = e.flowElements ?? [];
    for (const c of inner) eventSubOf.set(c.id, e.id);
    return inner;
  });
  // Stores and data objects are read here and never walked (DATA_TYPES).
  const walked = allElements.filter((e) => !DATA_TYPES.has(e.$type));
  // A VIEW load lists what the interpreter does not run, and the flows that
  // touch it, instead of refusing; a run load refuses below, as it always did.
  const notRunEls = opts.view ? walked.filter((e) => !runs(e)) : [];
  const notRunIds = new Set(notRunEls.map((e) => e.id));
  const elements = walked.filter(
    (e) =>
      !notRunIds.has(e.id) &&
      !(e.$type === "bpmn:SequenceFlow" && (notRunIds.has(e.sourceRef?.id ?? "") || notRunIds.has(e.targetRef?.id ?? ""))),
  );
  const notRun: NotRunElement[] = notRunEls.map((e) => {
    const on = (e as { attachedToRef?: { id?: string } }).attachedToRef?.id;
    return { id: e.id, type: e.$type, ...(cleanName(e.name) ? { name: cleanName(e.name) } : {}), ...(on ? { attachedTo: on } : {}) };
  });
  const dataStores: DataStoreUse[] = allElements
    .filter((e) => e.$type === "bpmn:DataStoreReference" || e.$type === "bpmn:DataObjectReference")
    .map((e) => {
      const unresolvedStore = unresolvedDataStores.get(e.id);
      const store = e.$type === "bpmn:DataStoreReference" ? (e.dataStoreRef?.id ?? unresolvedStore) : undefined;
      return {
        id: e.id,
        type: e.$type,
        ...(cleanName(e.name) ? { name: cleanName(e.name) } : {}),
        ...(store !== undefined ? { store, storeDeclared: e.dataStoreRef?.id !== undefined } : {}),
      };
    });
  const dataNameOf = new Map(dataStores.map((d) => [d.id, d.store ?? d.id]));
  // A reference with no dataStoreRef names no store: refused, because the
  // store is the one fact the drawing exists to say.
  const unnamed = dataStores.filter((d) => d.type === "bpmn:DataStoreReference" && d.store === undefined);
  if (unnamed.length) {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: data store reference(s) ${unnamed.map((d) => d.id).join(", ")} name no store. ` +
        `Give each a dataStoreRef: the store's Role id, e.g. dataStoreRef="work-plan".`,
    );
  }
  // A step that writes to the Beans store works the bean at that step
  // (owner, 2026-11-02, Q-BR-8 F): the drawn data association replaces the
  // hidden `<cat-harness.processes:bean op="note"/>`. An op the extension
  // names still wins, so OPEN and CLOSE may draw the store too.
  const worksBean = (el: ModdleElement): boolean => dataOf(el, "writes").includes(BEAN_STORE);
  const dataOf = (el: ModdleElement, dir: "reads" | "writes"): string[] => {
    const ends =
      dir === "reads"
        ? (el.dataInputAssociations ?? [])
            .flatMap((a) => (a.sourceRef ?? []).map((r) => r.id))
            // A process input passed on to a step is not a store read (callInputs).
            .filter((id) => id === undefined || !processInputs.has(id))
        : (el.dataOutputAssociations ?? []).map((a) => a.targetRef?.id);
    return ends.map((id) => {
      const name = id === undefined ? undefined : dataNameOf.get(id);
      if (name === undefined) {
        throw new UnsupportedBpmn(
          processInputs.size && dir === "reads"
            ? `${basename(bpmnPath)}: ${el.id} passes on ${id ?? "nothing"}, which is not an input this process declares, nor a data store or data object drawn in it`
            : `${basename(bpmnPath)}: ${el.id} ${dir} ${id ?? "nothing"}, which is not a data store or data object drawn in this process`,
        );
      }
      return name;
    });
  };

  // Refuse before building anything, so the error names every offender at once
  // rather than one per re-run.
  const unsupported = [...new Set(elements.filter((e) => !runs(e)).map(refusedType))];
  if (unsupported.length > 0) {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)} uses BPMN this interpreter does not implement: ` +
        `${unsupported.join(", ")}. Supported: ${[...SUPPORTED].join(", ")}, and a non-interrupting bpmn:BoundaryEvent. ` +
        `Extend the interpreter rather than letting the element be skipped — a ` +
        `process that silently omits a step is not the process on the diagram.`,
    );
  }

  // lane membership, so every node can report the role that performs it
  const laneOf = new Map<string, string>();
  const laneIdOf = new Map<string, string>();
  const roleRefOf = new Map<string, string>();
  const laneConventionsOf = new Map<string, string[]>();
  const lanes: LaneDef[] = [];
  for (const lane of proc.laneSets?.[0]?.lanes ?? []) {
    const laneId = lane.id ?? lane.name ?? `lane_${lanes.length}`;
    const laneExt = lane.extensionElements?.values ?? [];
    const roleEl = laneExt.find((v) => v.$type === "folio:role");
    // `partitionElementRef` arrives resolved to its `<bpmn:resource>`; when the
    // file declares no such resource, moddle leaves it unset and the id comes
    // from the tolerated warning instead (`partitionTolerated`).
    const unresolved = lane.id ? unresolvedPartitions.get(lane.id) : undefined;
    const binding = laneRoleRef({
      id: lane.id,
      partitionElementRef: lane.partitionElementRef?.id ?? unresolved,
      extensionElements: { values: roleEl ? [{ $type: "role", ref: roleEl.ref, variable: (roleEl as { variable?: string }).variable }] : [] },
    });
    const roleRef = binding.ref;
    // Moddle carries an unregistered attribute through as a string, which is
    // how `ref` already arrives — so `variable` needs no schema registration.
    // Only the exact string "true" counts: anything else is a typo, and
    // reading a typo as a declaration is how a defect becomes an exemption.
    const performerVaries = (roleEl as { variable?: string } | undefined)?.variable === "true";
    const laneConventions = laneExt
      .filter((v) => v.$type === CONVENTION_EXT && v.ref)
      .map((v) => v.ref!);
    const nodeIds = (lane.flowNodeRef ?? []).map((r) => r.id);
    const laneDoc = (lane as ModdleElement).documentation?.[0]?.text?.replace(...DOC_WS).trim() || undefined;
    lanes.push({
      id: laneId,
      name: lane.name,
      ...(laneDoc ? { documentation: laneDoc } : {}),
      roleRef,
      ...(binding.source !== "none" ? { roleBinding: binding.source } : {}),
      ...(binding.warning ? { roleBindingWarning: binding.warning } : {}),
      ...(unresolved !== undefined && lane.partitionElementRef?.id === undefined ? { roleResourceDeclared: false } : {}),
      performerVaries,
      nodes: nodeIds,
    });
    for (const id of nodeIds) {
      if (lane.name) laneOf.set(id, lane.name);
      laneIdOf.set(id, laneId);
      if (roleRef) roleRefOf.set(id, roleRef);
      if (laneConventions.length) laneConventionsOf.set(id, laneConventions);
    }
  }

  for (const [child, parent] of eventSubOf) {
    if (laneIdOf.has(child) || !laneIdOf.has(parent)) continue;
    const name = laneOf.get(parent);
    if (name) laneOf.set(child, name);
    laneIdOf.set(child, laneIdOf.get(parent)!);
    const role = roleRefOf.get(parent);
    if (role) roleRefOf.set(child, role);
    const conv = laneConventionsOf.get(parent);
    if (conv) laneConventionsOf.set(child, conv);
  }

  // PROCESS-LEVEL conventions: bound on the <bpmn:process> itself, so they
  // reach every step in the diagram without being restated on each one.
  const processConventions = (proc.extensionElements?.values ?? [])
    .filter((v) => v.$type === CONVENTION_EXT && v.ref)
    .map((v) => v.ref!);

  // `<cat-harness.processes:involvement vocabulary="raci|rasci"/>` on the process — which
  // methodology's letters this diagram is written in.
  //
  // THROWS on a name no vocabulary defines, the same way `folio:policy` and
  // `folio:bean op` do. A diagram asking for letters the engine does not have
  // must not load and quietly fall back to four, because the fallback would
  // be indistinguishable from having chosen four.
  //
  // Absent means `raci`, and that default is what makes this change inert for
  // every existing diagram: nothing already written changes meaning, and a
  // process opts in to the fifth letter deliberately.
  const declaredVocabulary = (proc.extensionElements?.values ?? []).find(
    (v) => v.$type === "folio:involvement",
  )?.vocabulary;
  if (declaredVocabulary !== undefined && !(declaredVocabulary in INVOLVEMENT_VOCABULARIES)) {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: cat-harness.processes:involvement vocabulary="${declaredVocabulary}" is not a ` +
        `declared vocabulary. Use one of: ${Object.keys(INVOLVEMENT_VOCABULARIES).join(", ")}.`,
    );
  }
  const involvementVocabulary = (declaredVocabulary ?? "raci") as InvolvementVocabulary;
  const vocabulary = INVOLVEMENT_VOCABULARIES[involvementVocabulary];

  const nodes = new Map<string, ProcessNode>();
  const flows = new Map<string, ProcessFlow>();

  // The indexes a call resolves against, built once for this load: a
  // process first (sibling files, then the layer, then its dependencies,
  // below), and failing a process in this layer, a global task of the
  // same layer (owner, 2026-10-20, "a1 b1 c1").
  const index = processIndex(dirname(bpmnPath));
  const here = homes.get(dirname(bpmnPath)) ?? {};
  homes.set(dirname(bpmnPath), here);
  const shared = new Map<string, { el: ModdleElement; ref: GlobalTaskRef; inputs?: Record<string, string> }>();
  // The inputs this process declares, by dataInput id → name (Q-BR-5 A).
  const processInputs = new Map(
    ((proc as ModdleElement).ioSpecification?.dataInputs ?? []).map((d) => [d.id, d.name ?? d.id] as const),
  );
  const callEls = new Map<string, ModdleElement>();
  for (const el of elements) {
    if (el.$type !== "bpmn:CallActivity" || !el.calledElement) continue;
    const id = el.calledElement;
    if (index.has(id) || (here.own ??= ownInstanceProcessIndex(dirname(bpmnPath))).has(id)) continue;
    const home = (here.globals ??= new Map([...ownInstanceGlobalTaskIndex(dirname(bpmnPath)), ...globalTaskIndex(dirname(bpmnPath))])).get(id);
    if (!home) continue;
    const g = await readGlobalTask(home, id);
    shared.set(el.id, { ...asSharedStep(el, g, bpmnPath, processInputs), ref: { id, type: g.$type, source: home, name: cleanName(g.name) || id } });
  }

  for (const raw of elements) {
    if (raw.$type === "bpmn:SequenceFlow") continue;
    if (raw.$type === "bpmn:CallActivity") callEls.set(raw.id, raw);
    const step = shared.get(raw.id);
    const el = step?.el ?? raw;
    const ext = el.extensionElements?.values ?? [];
    nodes.set(el.id, {
      id: el.id,
      name: cleanName(el.name) || el.id,
      kind: kindOf(el.$type),
      type: el.$type,
      lane: laneOf.get(el.id),
      laneId: laneIdOf.get(el.id),
      roleRef: roleRefOf.get(el.id),
      skills: ext.filter((v) => v.$type === "folio:skill" && v.ref).map((v) => v.ref!),
      ...narrativeOf(ext),
      // An unrecognised `involvement` is never COERCED — a typo silently read
      // as `informed` would put somebody on a notification list who was meant
      // to be consulted, and the difference between those two is the whole
      // point of the model. It is now also never dropped silently: the
      // rejects land in `raciUnknown` and `check:raci` fails on them.
      raci: ext
        .filter((v) => v.$type === "folio:raci" && v.ref)
        .filter((v) => (vocabulary as readonly string[]).includes(v.involvement ?? ""))
        .map((v) => ({ role: v.ref!, involvement: v.involvement as RaciInvolvement })),
      raciUnknown: ext
        .filter((v) => v.$type === "folio:raci" && v.ref)
        .filter((v) => !(vocabulary as readonly string[]).includes(v.involvement ?? ""))
        .map((v) => ({ role: v.ref!, involvement: v.involvement ?? "(absent)" })),
      conventions: conventionsInForce({
        process: processConventions,
        lane: laneConventionsOf.get(el.id),
        activity: ext.filter((v) => v.$type === CONVENTION_EXT && v.ref).map((v) => v.ref!),
      }),
      noSkillReason: noSkillReasonOf(ext, el.id),
      noCallReason: noCallReasonOf(ext, el.id),
      judgementReason: judgementReasonOf(ext, el),
      fulfilment: fulfilmentOf(ext, el.id),
      adjudication: adjudicationOf(ext, el, fulfilmentOf(ext, el.id), adjudicationDeclOf(ext, el.id)),
      adjudicationAccepts: adjudicationAcceptsOf(ext, el, adjudicationDeclOf(ext, el.id)),
      adjudicationDefers:
        adjudicationDefersOf(el, adjudicationDeclOf(ext, el.id), fulfilmentOf(ext, el.id)) ||
        undefined,
      touchesWorkPlan: ext.some((v) => v.$type === "folio:bean") || worksBean(raw),
      reads: dataOf(raw, "reads"),
      writes: dataOf(raw, "writes"),
      workPlanOp: readWorkPlanOp(el.id, ext) ?? (worksBean(raw) ? "note" : undefined),
      ...(worksBean(raw) ? { worksBean: true } : {}),
      beanRef: (ext.find((v) => v.$type === "folio:bean" && (v.ref || v.id || v.bean))?.ref ??
        ext.find((v) => v.$type === "folio:bean" && (v.ref || v.id || v.bean))?.id ??
        ext.find((v) => v.$type === "folio:bean" && (v.ref || v.id || v.bean))?.bean) as
        | string
        | undefined,
      beans: ext
        .filter((v) => v.$type === "folio:bean")
        .map((v) => (v.ref ?? v.id ?? v.bean) as string | undefined)
        .filter((b): b is string => !!b),
      relaxable: ext.find((v) => v.$type === "folio:policy")?.relaxable !== "false",
      decisionRef: ext.find((v) => v.$type === "folio:decision" && v.ref)?.ref,
      documentation: el.documentation?.[0]?.text?.replace(...DOC_WS).trim() || undefined,
      calledElement: el.calledElement,
      ...(raw.$type === "bpmn:BoundaryEvent" ? { attachedTo: raw.attachedToRef?.id } : {}),
      ...(step ? { globalTask: step.ref } : {}),
      ...(step?.inputs ? { inputs: step.inputs } : {}),
      incoming: [],
      outgoing: [],
    });
  }

  for (const el of elements) {
    if (el.$type !== "bpmn:SequenceFlow") continue;
    const from = el.sourceRef?.id;
    const to = el.targetRef?.id;
    if (!from || !to || !nodes.has(from) || !nodes.has(to)) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: sequence flow ${el.id} does not connect two known nodes`,
      );
    }
    flows.set(el.id, {
      id: el.id,
      name: el.name?.trim() || undefined,
      from,
      to,
      adjudicationCode:
        adjudicationDeclOf(el.extensionElements?.values ?? [], el.id ?? "(flow)", "flow")
          ?.code?.trim() || undefined,
    });
    nodes.get(from)!.outgoing.push(el.id);
    nodes.get(to)!.incoming.push(el.id);
  }

  // A boundary event runs only as a non-interrupting side path off an
  // activity: anything else would ask the engine to cancel a step or to route
  // a token into an event, which it does not do. Refused at load, never
  // walked wrongly.
  for (const el of elements) {
    if (el.$type !== "bpmn:BoundaryEvent") continue;
    const n = nodes.get(el.id)!;
    const host = n.attachedTo ? nodes.get(n.attachedTo) : undefined;
    const problem =
      !host || host.kind !== "activity"
          ? `is attached to ${n.attachedTo ?? "nothing"}, which is not an activity of this process`
          : n.incoming.length > 0
            ? `has an incoming sequence flow; a boundary event starts its path from the activity it sits on`
            : n.outgoing.length === 0
              ? `has no outgoing sequence flow, so it would start nothing`
              : undefined;
    if (problem) throw new UnsupportedBpmn(`${basename(bpmnPath)}: boundary event ${el.id} ${problem}.`);
  }

  const procExt = proc.extensionElements?.values ?? [];
  const declared = procExt.find((v) => v.$type === "folio:policy")?.enforcement;
  if (declared !== undefined && declared !== "strict" && declared !== "advisory") {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: cat-harness.processes:policy enforcement="${declared}" is not a policy. ` +
        `Use "strict" or "advisory".`,
    );
  }
  // Absent means strict. A process that forgot to say is governed, not exempt —
  // the failure mode of defaulting the other way is that forgetting silently
  // turns the gate off.
  const enforcement: "strict" | "advisory" = declared === "advisory" ? "advisory" : "strict";

  // `<cat-harness.processes:log capture="…"/>`, THROWING on a value that is not implemented,
  // exactly as `folio:bean op` does. A diagram that asks for a capture mode
  // the engine does not have must not load and quietly log nothing — that is
  // the two-records divergence in a different costume, and it is worse here
  // because the missing artefact is the record of what happened.
  //
  // `unknown` is deliberately NOT accepted as a declared value. It is what
  // the absence of a declaration resolves to; writing it down would be
  // asserting that nobody could tell, which is not something a diagram is in
  // a position to assert about itself.
  const captureDeclared = procExt.find((v) => v.$type === "folio:log")?.capture;
  if (captureDeclared !== undefined && captureDeclared !== "on" && captureDeclared !== "off") {
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: cat-harness.processes:log capture="${captureDeclared}" is not implemented. ` +
        `Use "on" or "off"; omit the element to leave it undetermined.`,
    );
  }
  const logCapture = captureDeclared as "on" | "off" | undefined;
  const startsFromWorkPlan = readStartsFromWorkPlan(proc, bpmnPath);

  // `<bootstrap.processes:precondition>` — what must hold BEFORE the start event (`lv3j`).
  //
  // Every refusal below exists because the alternative is a precondition that
  // READS as verified and is not. That is worse than the documentation prose
  // this replaces: prose is honestly unchecked, a wrong declaration is
  // dishonestly checked.
  const preconditions: Precondition[] = [];
  for (const v of procExt.filter((e) => e.$type === "folio:precondition")) {
    const id = (v.id as string | undefined)?.trim();
    const text = ((v.text as string | undefined) ?? (v.$body as string | undefined) ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const kind = v.kind as string | undefined;
    const check = v.check as string | undefined;
    const ref = (v.ref as string | undefined)?.trim();

    if (!id) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: a bootstrap.processes:precondition has no id. A report that cannot NAME ` +
          `which precondition it could not determine is not a report.`,
      );
    }
    if (!text) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} has no text. The statement is the ` +
          `part a person reads; an id alone says a condition exists and not what it is.`,
      );
    }
    // NO DEFAULT. Defaulting to `stated` would let an author who meant to
    // check something forget and get silence; defaulting to `checkable` is
    // worse. The author decides, every time.
    if (kind !== "checkable" && kind !== "stated") {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} has kind="${kind ?? ""}". ` +
          `Use "checkable" (a claim about the world this engine can evaluate) or "stated" ` +
          `(a claim about the actor, which nothing here can observe). There is no default.`,
      );
    }
    if (kind === "stated" && (check || ref)) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} is kind="stated" but carries a ` +
          `check. A stated precondition is one nothing can verify — attaching a check to it ` +
          `is either a mislabelled checkable one or a check that does not answer the claim.`,
      );
    }
    if (kind === "checkable") {
      if (check !== "file-exists") {
        throw new UnsupportedBpmn(
          `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} has check="${check ?? ""}", which ` +
            `is not implemented. Use "file-exists", or declare it kind="stated" and say so ` +
            `honestly. A checkable precondition with no check is the thing this refuses.`,
        );
      }
      if (!ref) {
        throw new UnsupportedBpmn(
          `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} has check="file-exists" and no ` +
            `ref. The check needs to know WHAT must exist.`,
        );
      }
      // Relative to the layer, and INSIDE it. An absolute path or a `..`
      // segment would name a file the layer does not own, which is the
      // repository-root dependence this resolution exists to remove.
      if (isAbsolute(ref) || ref.split(/[\\/]/).includes("..")) {
        throw new UnsupportedBpmn(
          `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} has ref="${ref}", which ` +
            `leaves the instance. A file-exists ref is relative to the instance that owns the ` +
            `diagram and must stay inside it.`,
        );
      }
    }
    const base = kind === "checkable" ? findInstanceRoot(dirname(bpmnPath)) : undefined;
    if (kind === "checkable" && base === undefined) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: bootstrap.processes:precondition ${id} checks a file, but no ` +
          `instance declaration owns this diagram, so there is no root to resolve "${ref}" ` +
          `against. Guessing the repository root is the dependence this refuses.`,
      );
    }
    preconditions.push({
      id,
      text,
      kind,
      ...(kind === "checkable" ? { check: { kind: "file-exists" as const, ref: ref!, base: base! } } : {}),
    });
  }
  const seenIds = new Set<string>();
  for (const p of preconditions) {
    if (seenIds.has(p.id)) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: two bootstrap.processes:precondition elements share id "${p.id}". ` +
          `A verdict that names an id must name exactly one condition.`,
      );
    }
    seenIds.add(p.id);
  }

  // An adjudication naming a CODE LIST must declare exactly that list's active
  // codes. Owner, 2026-09-23: the codes are a node with a definition and a
  // source each, not strings in an attribute — so the attribute is checked
  // against the node, and a code nobody defined, or a defined one the diagram
  // forgot, is refused here rather than discovered when an outcome is recorded.
  // Codes WITHOUT a list are still accepted (a folio may not have written one
  // yet); `check:workflow-refs` reports them.
  await checkCodeLists(nodes, bpmnPath);

  // An adjudicated activity's declared codes must match the branches out of the
  // gateway it feeds — bean `5vo9`.
  //
  // Without this the codes are decoration. The adjudicator step says the answers are
  // `stands scope dispensation` and the gateway draws three branches, and
  // nothing asserts they are the same three: two statements of one fact, free
  // to drift, which is the failure this repository keeps paying for.
  //
  // The comparison is against `<cat-harness.processes:adjudication code="…"/>` on each branch
  // rather than against the flow's NAME. A label is prose a reader may improve
  // ("the finding stands"); the code is the token a recorded outcome carries,
  // and a code that moved when somebody reworded a label would silently
  // invalidate every record judged under the old one.
  //
  // ONLY the direct case is checked: the activity's single outgoing flow
  // reaching an exclusive gateway. A judgement whose answer is recorded rather
  // than branched is legitimate — `A_RecordEntry` is where all three of
  // adjudication.bpmn's converge — so demanding a gateway everywhere would
  // report a false finding on the diagram that motivated this.
  for (const n of nodes.values()) {
    if (n.adjudication === undefined) continue;
    const out = n.outgoing.map((f) => flows.get(f)).filter((f) => f !== undefined);
    if (out.length !== 1) continue;
    const next = nodes.get(out[0]!.to);
    if (next?.kind !== "exclusive") continue;
    const branches = next.outgoing.map((f) => flows.get(f)?.adjudicationCode);
    if (branches.every((c) => c === undefined)) continue; // gateway opts out entirely
    const onBranches = [...new Set(branches.filter((c): c is string => c !== undefined))].sort();
    const declared = [...new Set(n.adjudication.codes)].sort();
    if (onBranches.join("\u0000") !== declared.join("\u0000")) {
      throw new Error(
        `${n.id}: declares codes (${declared.join(", ")}) but ${next.id}'s branches carry ` +
          `(${onBranches.join(", ") || "none"}). A judgement's permitted answers and the branches ` +
          `that act on them must be the same set, or a recorded outcome can name an answer the ` +
          `process cannot take.`,
      );
    }
    const unlabelled = next.outgoing.filter((f) => flows.get(f)?.adjudicationCode === undefined);
    if (unlabelled.length > 0) {
      throw new Error(
        `${next.id}: branch(es) ${unlabelled.join(", ")} carry no <cat-harness.processes:adjudication code="…"/> ` +
          `while their siblings do. A partly-coded gateway reads as complete — either every branch ` +
          `names the answer that selects it, or none does.`,
      );
    }
  }

  const startNodes = [...nodes.values()].filter((n) => n.kind === "start").map((n) => n.id);
  if (startNodes.length === 0) {
    throw new UnsupportedBpmn(`${basename(bpmnPath)}: no start event, so nothing can begin`);
  }

  const decisions = await loadDecisions(bpmnPath, nodes, flows);

  // Subprocess descent. A call activity naming a process defined in a sibling
  // file expands into it; one naming a process no file defines stays opaque,
  // because a folio may legitimately call out to a process it does not host.
  // A CYCLE is not legitimate and is refused here rather than at run time:
  // an interpreter that enters A → B → A settles forever.
  const children = new Map<string, ProcessModel>();
  const path = [...seen, proc.id];
  for (const node of nodes.values()) {
    if (!node.calledElement) continue;
    if (path.includes(node.calledElement)) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: ${node.id} calls ${node.calledElement}, which is already ` +
          `on the call path (${path.join(" → ")}). A process cannot contain itself.`,
      );
    }
    // The two fallback indexes are built at most ONCE per directory per
    // top-level load (`homes`), and only when a call misses the sibling index. Resolving the layer and its
    // dependencies per call activity re-read every declaration in the
    // checkout each time; in the index checkout, which composes eleven
    // layers, that put the corpus load past the 5 s test budget
    // (measured 2026-10-09: content-lifecycle.bpmn 700 ms a load).
    const home =
      index.get(node.calledElement) ??
      (here.own ??= ownInstanceProcessIndex(dirname(bpmnPath))).get(node.calledElement) ??
      (here.dep ??= dependencyProcessIndex(dirname(bpmnPath))).get(node.calledElement);
    if (!home) continue;
    const child = await loadProcessModel(home, path, homes, opts);
    const call = callEls.get(node.id);
    const declared = child.inputs ?? [];
    if (call && (declared.length || call.dataInputAssociations?.length)) {
      const given = callInputs(call, declared, `${basename(bpmnPath)}: ${node.id} calls process ${child.id}`, processInputs);
      if (Object.keys(given).length) {
        node.inputs = given;
        bindInputs(child, given);
      }
    }
    children.set(node.id, child);
    checkAcceptedCodes(node, child, bpmnPath);
  }

  return {
    id: proc.id,
    ...(notRun.length > 0 ? { notRun } : {}),
    name: cleanName(proc.name) || proc.id,
    source: bpmnPath,
    dir: dirname(bpmnPath),
    documentation: (proc as ModdleElement).documentation?.[0]?.text?.replace(...DOC_WS).trim() || undefined,
    enforcement,
    involvementVocabulary,
    logCapture,
    ...(startsFromWorkPlan !== undefined ? { startsFromWorkPlan } : {}),
    preconditions,
    nodes,
    flows,
    lanes,
    dataStores,
    startNodes,
    decisions,
    children,
    ...(processInputs.size ? { inputs: [...processInputs.values()] } : {}),
  };
}

/**
 * Whether `<bpmn:process>` declares that it starts from a work plan (bean `rwhr`).
 *
 * Accepts `<cat-harness.processes:work-plan/>` (or `starts="true|false"`),
 * `<cat-harness.processes:bean/>` on the process, `<cat-harness.processes:policy workPlan="true|false"/>`,
 * or `workPlan` / `startsFromWorkPlan` on `<bpmn:process>`. Small processes need
 * no declaration (`undefined`). Any attribute value other than `"true"` or `"false"`
 * is refused at load time so a typo cannot silently turn the declaration off.
 */
function readStartsFromWorkPlan(proc: ModdleElement, bpmnPath: string): boolean | undefined {
  const parseBool = (raw: unknown, where: string): boolean => {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new UnsupportedBpmn(
      `${basename(bpmnPath)}: ${where}="${String(raw)}" is not a boolean. Use "true" or "false".`,
    );
  };
  const procExt = proc.extensionElements?.values ?? [];
  const wpEl = procExt.find((v) => v.$type === "folio:work-plan" || v.$type === "folio:workPlan") as
    | Record<string, unknown>
    | undefined;
  if (wpEl) {
    const attrKey = ["starts", "required", "workPlan", "plan"].find((k) => wpEl[k] !== undefined);
    if (attrKey === undefined) return true;
    return parseBool(wpEl[attrKey], `cat-harness.processes:work-plan ${attrKey}`);
  }
  const beanEl = procExt.find((v) => v.$type === "folio:bean") as Record<string, unknown> | undefined;
  if (beanEl) {
    const attrKey = ["starts", "required", "workPlan", "plan"].find((k) => beanEl[k] !== undefined);
    if (attrKey === undefined) return true;
    return parseBool(beanEl[attrKey], `cat-harness.processes:bean ${attrKey}`);
  }
  const policyEl = procExt.find((v) => v.$type === "folio:policy") as Record<string, unknown> | undefined;
  if (policyEl) {
    const attrKey = ["workPlan", "startsFromWorkPlan", "plan"].find((k) => policyEl[k] !== undefined);
    if (attrKey !== undefined) {
      return parseBool(policyEl[attrKey], `cat-harness.processes:policy ${attrKey}`);
    }
  }
  const attrs = (proc as unknown as { $attrs?: Record<string, unknown> }).$attrs ?? {};
  for (const [k, v] of Object.entries(attrs)) {
    const local = k.includes(":") ? k.slice(k.lastIndexOf(":") + 1) : k;
    if (local === "workPlan" || local === "startsFromWorkPlan" || local === "work-plan") {
      return parseBool(v, `bpmn:process ${k}`);
    }
  }
  return undefined;
}

/**
 * A caller's `accepts` and the adjudicator's `codes` are ONE fact — bean `bvuk`.
 *
 * ## What it refuses, and what it deliberately does not
 *
 * **Refused:** a declared `accepts` that is not the called adjudicator's enum, and a
 * declared `accepts` on a call into a process that adjudicates nothing. Both are
 * claims a reader would act on that no longer hold.
 *
 * **Not refused — reported instead, by `check:workflow-refs`:** a caller that
 * declares NOTHING. Every one of the six callers in this corpus was in that
 * state when the attribute was added, so refusing absence would mean either
 * failing the corpus on day one or backfilling six declarations nobody had
 * grounds for. Four of the six ask `Process_Adjudication` a question its three
 * QA-criterion outcomes do not obviously answer, and guessing an `accepts` for
 * them would convert an open question into a checked-looking assertion — the
 * `dh4f` shape pointed the wrong way. An undeclared caller is "could not
 * determine", and that is never rendered as clean.
 *
 * **Not checked at all:** a call into a process no file here defines. A folio
 * may legitimately call out, the descent above already leaves those opaque,
 * and a refusal would be this checker reporting on something it cannot see.
 *
 * ## Why set equality rather than a subset
 *
 * A caller accepting a strict subset would be saying it can act on some of the
 * answers the adjudicator may give — which means the others reach it and it does
 * something undefined with them. There is no useful reading of a partial
 * accept, so it is the same defect as a wrong one.
 */
function checkAcceptedCodes(
  node: ProcessNode,
  child: ProcessModel,
  bpmnPath: string,
): void {
  if (node.adjudicationAccepts === undefined) return;
  const adjudicators = [...child.nodes.values()].filter((n) => n.adjudication !== undefined);
  if (adjudicators.length === 0) {
    // A DEFERRING adjudicator gets its own message, because the fix is the
    // opposite one. `accepts` says "I have read your enum"; there is no enum
    // to read, and the caller is the one who has to write it.
    const deferring = [...child.nodes.values()].filter((n) => n.adjudicationDefers);
    if (deferring.length > 0) {
      throw new Error(
        `${basename(bpmnPath)}: ${node.id} declares \`accepts\`, but ${child.id}'s ` +
          `${deferring.map((d) => d.id).join(", ")} defers its enum to the caller. ` +
          `There is nothing to accept — declare <cat-harness.processes:adjudication codes="…"/> here ` +
          `instead, and code the branches out of this step's gateway.`,
      );
    }
    throw new Error(
      `${basename(bpmnPath)}: ${node.id} declares <cat-harness.processes:adjudication accepts="…"/> but ` +
        `${child.id} contains no judgement. Either the called process lost its ` +
        `<cat-harness.processes:adjudication codes="…"/>, or this caller is not calling an adjudication.`,
    );
  }
  if (adjudicators.length > 1) {
    throw new Error(
      `${basename(bpmnPath)}: ${node.id} calls ${child.id}, which adjudicates more than once ` +
        `(${adjudicators.map((j) => j.id).join(", ")}). One \`accepts\` cannot say which of them ` +
        `it answers, so the caller would look checked while naming nothing in particular.`,
    );
  }
  const offered = [...new Set(adjudicators[0]!.adjudication!.codes)].sort();
  const accepted = [...new Set(node.adjudicationAccepts)].sort();
  if (offered.join("\u0000") !== accepted.join("\u0000")) {
    throw new Error(
      `${basename(bpmnPath)}: ${node.id} accepts (${accepted.join(", ")}) but ` +
        `${child.id}'s ${adjudicators[0]!.id} may answer (${offered.join(", ")}). ` +
        `An answer the caller cannot act on still reaches it — see bean \`bvuk\`, ` +
        `where six callers asked one three-outcome process six different questions.`,
    );
  }
}

/**
 * Load every `folio:decision` table, and check each one can actually route.
 *
 * The check is the point. A table whose output is `"passed"` against a gateway
 * whose flows are `yes` and `no` parses fine, evaluates fine, and then hands
 * back an outcome that matches no branch — at the moment a decision is needed,
 * which is the worst time to discover it. Every output literal in every rule
 * must name one of the gateway's outgoing flows, verified when the process
 * loads.
 */
async function loadDecisions(
  bpmnPath: string,
  nodes: Map<string, ProcessNode>,
  flows: Map<string, ProcessFlow>,
): Promise<Map<string, DecisionTable>> {
  const out = new Map<string, DecisionTable>();
  for (const node of nodes.values()) {
    if (!node.decisionRef) continue;
    if (node.kind !== "exclusive") {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: ${node.id} carries cat-harness.processes:decision but is a ` +
          `${node.type}. Only an exclusive gateway routes on a decision.`,
      );
    }
    const [file, decisionId] = node.decisionRef.split("#");
    if (!file || !decisionId) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: ${node.id} has cat-harness.processes:decision ref="${node.decisionRef}", ` +
          `which is not \`path.dmn#DecisionId\``,
      );
    }
    const table = await loadDecisionTable(join(dirname(bpmnPath), file), decisionId);

    const branches = node.outgoing.map((f) => flows.get(f)!.name).filter(Boolean) as string[];
    const unroutable = possibleOutcomes(table).filter((o) => !branches.includes(o));
    if (unroutable.length > 0) {
      throw new UnsupportedBpmn(
        `${basename(bpmnPath)}: ${node.id} ("${node.name}") routes to ` +
          `[${branches.join(", ")}], but ${decisionId} can return ` +
          `[${unroutable.join(", ")}] — an outcome with no branch is a decision ` +
          `that cannot be acted on.`,
      );
    }
    out.set(node.id, table);
  }
  return out;
}


/** Whether a node is work someone does, as opposed to routing. */
export function isActivity(node: ProcessNode): boolean {
  return node.kind === "activity";
}

/**
 * Whether a node is a DECISION: an exclusive gateway with more than one way
 * out. A converging exclusive gateway, a parallel fork and a parallel join
 * decide nothing — the BPMN symbol is their whole meaning — so the
 * documentation-completeness criteria (`gateway-documented`,
 * `gateway-branches-named`) ask nothing of them.
 */
export function isDecision(node: ProcessNode): boolean {
  return node.kind === "exclusive" && node.outgoing.length > 1;
}

/** One way out of a decision, as a reader sees it. */
export interface DecisionBranch {
  flowId: string;
  /** The flow's label — the answer that selects it — if it has one. */
  label?: string;
  /** Id of the node the branch leads to. */
  to: string;
}

/** The ways out of a node, in document order. */
export function branchesOf(model: Pick<ProcessModel, "flows">, node: ProcessNode): DecisionBranch[] {
  return node.outgoing.map((id) => {
    const f = model.flows.get(id);
    return { flowId: id, label: f?.name, to: f?.to ?? "" };
  });
}

/**
 * Branches of a decision a reader cannot tell apart: one with no label, or
 * one whose label (case- and whitespace-insensitively) repeats a sibling's.
 * Every branch in a repeated pair is reported, since neither one is the
 * "right" holder of the label. Empty for a node that is not a decision.
 */
export function indistinctBranches(
  model: Pick<ProcessModel, "flows">,
  node: ProcessNode,
): Array<DecisionBranch & { problem: "unnamed" | "duplicate" }> {
  if (!isDecision(node)) return [];
  const branches = branchesOf(model, node);
  const key = (l: string): string => l.replace(/\s+/g, " ").trim().toLowerCase();
  const seen = new Map<string, number>();
  for (const b of branches) if (b.label) seen.set(key(b.label), (seen.get(key(b.label)) ?? 0) + 1);
  const out: Array<DecisionBranch & { problem: "unnamed" | "duplicate" }> = [];
  for (const b of branches) {
    if (!b.label) out.push({ ...b, problem: "unnamed" });
    else if ((seen.get(key(b.label)) ?? 0) > 1) out.push({ ...b, problem: "duplicate" });
  }
  return out;
}
