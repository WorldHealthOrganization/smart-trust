/**
 * Every reference a journey or a workshop names resolves: the gate behind
 * `check:journey-refs`.
 *
 * @module scripts/journeys/check
 * @covers user-scenario, workshop, building-blocks, device-screen
 *
 * ## One resolver, two readers
 *
 * The journeys viewer draws a reference that resolves to nothing as
 * unresolved, so a reader sees it; this check fails on it, so a pull request
 * does. Both read the checkout through {@link readJourneyCorpus} and resolve
 * an edge with the same functions (`lookup`, `blockFor`, `journeyById`,
 * `requirementFor`, `processElementIds`, `instanceFile`, and the viewer's
 * `siteLinks` for an ArchiMate view), so what the page draws as resolved is
 * exactly what passes here. There is no second resolver to drift.
 *
 * ## What is checked
 *
 * | a journey names | it must resolve to |
 * |---|---|
 * | `personas` | an actor, or (from 0.4.0) a role (`roles.json` of a `scenarios` directory) |
 * | a step's `lead`, `experiences[].actor`, `illustrationStyle.cast[].actor`, and `handoff.from`/`to` when spelled as an id (lower-case kebab; words such as "Thai hospital" are a place or a system, not checked) | an actor (`scenarios` directory, `actors/<id>.json`), the journey's own layer first |
 * | `stories` | a user story (`stories.json` of a `scenarios` directory) |
 * | `realisedBy[].process` | a BPMN file, relative to the layer root |
 * | `realisedBy[].tasks` | an element id in that file |
 * | `uses[].block` | a block of a catalogue in a directory declaring `building-blocks` |
 * | `requirements`, `preconditions[].requirements` | a `req:` node |
 * | `examples`, `fhirChanges[].examples`, `dak[].key` | an entry of a `fhir-artifact-index` (could-not-determine while the index is built at publish) |
 * | `illustration.src` | a file, relative to the layer root |
 * | `follows`, `partOf`, `parts[].scenario`, a step's `includes` | a journey; parts and includes form no cycle |
 *
 * ## A journey is a DAK user scenario, and says nothing twice
 *
 * The kind `specialises` the DAK user scenario (the registry), so every
 * journey must yield one (`dakUserScenario`, `derive.ts`): its DAK personas,
 * the ROLES its persona actors play, are not empty and each is a role of
 * the checkout. And what `derive.ts` derives is not also written:
 *
 * | written | finding |
 * |---|---|
 * | `follows` on a journey a parent lists in `parts` | redundant: the parent's order says it |
 * | `partOf` naming a parent whose `parts` lists the journey | redundant |
 * | `personas` that are exactly its parts' | redundant: derived from the parts |
 * | a step's `lead`, with no `experiences`, that is the first lane actor | redundant: derived from the lanes |
 * | a step with no `experiences` whose lanes no persona plays | nothing to draw: write them |
 * | an actor a step names who is no persona (0.4.0; the schema checks earlier files) | as before |
 * | `includes` on a step whose `realisedBy` names a call activity of another process | the two disagree (could-not-determine when the call names no process, or the included journey has no BPMN) |
 * | `trustLadder`, `record.state` | a code list in a `code-list` directory, and a code of it |
 * | `views` | a view of a model the layer's ArchiMate config names |
 *
 * | a workshop names | it must resolve to |
 * |---|---|
 * | `scenarios` | a journey |
 * | `steps[]` `{scenario, step}` | that journey, and a step of it |
 * | `discussion[].steps`, `resources[].steps` (`<scenario>#<step>`) | the same |
 * | `presentation.recordOf` | an actor |
 * | `presentation.views` | a view of a model the layer's ArchiMate config names |
 * | `presentation.deviceDemo.screens[].steps` | a step of a journey the workshop teaches (or of a sub-journey of one) |
 * | `sheetsSource` `docx`, `pdf`, `previews` | a URL, or a file of the workshop's layer, relative to the workshop file |
 *
 * | a device screen names | it must resolve to |
 * |---|---|
 * | `owner`, a `personCard` block's `actor` | an actor, the screen's own layer first |
 * | `steps[]` `{scenario, step}` | that journey, and a step of it |
 * | a `qr` or `recordList` block's `example` | an entry of a `fhir-artifact-index` (could-not-determine while the index is built at publish) |
 *
 * | an actor's persona names | it must resolve to |
 * |---|---|
 * | `avatar` | a file, relative to the actor's layer root |
 *
 * A file of any of these kinds that does not parse is a finding too: the viewer
 * reports it and draws nothing of it, so nothing of it was checked.
 *
 * Exit 0 every reference resolves (or the checkout declares no journey and no
 * workshop, which is said); 1 a reference does not; 2 the checkout's
 * declarations could not be read, which is not a pass.
 */
import { relative, resolve } from "node:path";
import { siteLinks } from "../gen-journeys-viz.ts";
import { BASE_GRAPH_TYPOLOGIES } from "../../schemas/kg/graph-typology-registry.ts";
import { dakUserScenario, derivedPersonas, includeConflict, isListedPart, laneExperiences, parentsOf, partsOf } from "./derive.ts";
import { screenActors, screenExamples } from "../../schemas/process/device-screen.ts";
import { derivesFields } from "../../schemas/process/user-scenario.ts";
import {
  avatarFile,
  blockFor,
  instanceFile,
  journeyById,
  lookup,
  processElementIds,
  readJourneyCorpus,
  requirementFor,
  type Journey,
  type JourneyCorpus,
} from "./read.ts";

/** One reference that does not resolve, or one file that would not parse. */
export interface RefFinding {
  instance: string;
  /** Instance-relative file. */
  file: string;
  /** Where in the file: `step P3`, `steps[2]`, `(root)`. */
  at: string;
  message: string;
}

export interface RefReport {
  journeys: number;
  workshops: number;
  screens: number;
  /** References examined, resolved or not. */
  references: number;
  findings: RefFinding[];
  /**
   * References that could be neither resolved nor called missing: a FHIR
   * example no index on disk holds while a declared artifact index is built at
   * publish and so absent here. Non-empty, the report is NOT a pass (exit 2).
   */
  couldNotDetermine: RefFinding[];
  /**
   * What a workshop's VaxLink overview (`overview/`) will be missing because
   * its journeys do not declare it: no `presentation.story`, a journey with no
   * `scene` or `trustLadder`, a step with no `illustration` or `record`, no
   * device screen. Each one is a part the viewer leaves out silently, so it is
   * reported (`overview-gap`); it never fails the check.
   */
  warnings: RefFinding[];
  /** Set when the checkout's declarations could not be read: the report is NOT a pass. */
  undetermined?: string;
}

/** The DAK kind a journey is: the block kind the registry says `user-scenario` specialises. */
const SPECIALISES = BASE_GRAPH_TYPOLOGIES["user-scenario"]?.specialises ?? "user-scenario";

/** A cycle through `j` along parts and includes, spelled `a → b → a`; undefined when there is none. */
export function composedCycle(corpus: JourneyCorpus, j: Journey): string | undefined {
  const next = (x: Journey): Journey[] =>
    [...partsOf(x.authored).map((p) => p.scenario), ...x.authored.steps.flatMap((s) => (s.includes ? [s.includes] : []))]
      .map((id) => journeyById(corpus, x.instance, id))
      .filter((y): y is Journey => y !== undefined);
  const walk = (x: Journey, path: Journey[]): Journey[] | undefined => {
    for (const y of next(x)) {
      if (y === j) return [...path, y];
      if (path.includes(y)) continue;
      const found = walk(y, [...path, y]);
      if (found) return found;
    }
    return undefined;
  };
  const c = walk(j, [j]);
  return c?.map((x) => x.scenario.id).join(" → ");
}

/** Check every journey and workshop of a corpus. */
/** How an actor id is spelled: a hand-off end spelled otherwise is words, not a reference. */
const ACTOR_ID = /^[a-z0-9][a-z0-9-]*$/;

export function checkJourneyRefs(corpus: JourneyCorpus): RefReport {
  const findings: RefFinding[] = corpus.problems.map((p) => ({ instance: p.instance, file: p.file, at: "(root)", message: `does not parse: ${p.message}` }));
  const couldNotDetermine: RefFinding[] = [];
  const warnings: RefFinding[] = [];
  let references = 0;
  const archimate = siteLinks(corpus, "journeys", "journeys").archimateView;
  /** An artefact-index key (a FHIR example, a DAK asset): found, missing, or — while an artifact index is built at publish — undetermined. */
  const example = (instance: string, file: string, at: string, k: string, what = "FHIR example") => {
    references++;
    if (corpus.examples.has(k)) return;
    if (corpus.examplesUnbuilt.length > 0) {
      couldNotDetermine.push({ instance, file, at, message: `${what} "${k}" is in no artifact index on disk, and ${corpus.examplesUnbuilt.join(", ")} is built at publish and absent here` });
    } else findings.push({ instance, file, at, message: `${what} "${k}" is in no declared fhir-artifact-index` });
  };

  for (const j of corpus.journeys) {
    const sc = j.scenario;
    const add = (at: string, message: string) => findings.push({ instance: j.instance, file: j.file, at, message });
    const ref = (ok: boolean, at: string, message: string) => {
      references++;
      if (!ok) add(at, message);
    };
    const actor = (id: string, at: string, field: string) =>
      ref(lookup(corpus.actors, j.instance, id) !== undefined, at, `${field} "${id}" is no actor (actors/${id}.json in a declared scenarios directory)`);

    const au = j.authored;
    for (const p of au.personas ?? []) {
      ref(lookup(corpus.actors, j.instance, p) !== undefined || lookup(corpus.roles, j.instance, p) !== undefined, "(root)", `persona "${p}" is no actor (actors/${p}.json) and no role (roles.json) in a declared scenarios directory`);
    }
    // The DAK user scenario the journey is: its personas are roles, derived from the actors.
    const dak = dakUserScenario(corpus, j);
    references++;
    if (dak.personas.length === 0) add("(root)", `as a DAK ${SPECIALISES} it has no personas: none of its persona actors plays a role (an actor's \`roles\`)`);
    for (const r of dak.personas) ref(lookup(corpus.roles, j.instance, r) !== undefined, "(root)", `as a DAK ${SPECIALISES} its persona "${r}" (a role of its actors) is no role in a declared scenarios directory`);
    if (sc.follows !== undefined) ref(journeyById(corpus, j.instance, sc.follows) !== undefined, "(root)", `follows "${sc.follows}", which is no journey in this checkout`);
    if (sc.partOf !== undefined) ref(journeyById(corpus, j.instance, sc.partOf) !== undefined, "(root)", `partOf "${sc.partOf}", which is no journey in this checkout`);
    for (const p of partsOf(au)) ref(journeyById(corpus, j.instance, p.scenario) !== undefined, "(root)", `part "${p.scenario}" is no journey in this checkout`);
    // Said by the parent's parts, so not again here.
    if (sc.follows !== undefined && isListedPart(corpus, j)) add("(root)", `redundant follows "${sc.follows}": a parent lists this journey in its parts, whose order says what it follows; remove it`);
    const listedBy = parentsOf(corpus, j).filter((p) => partsOf(p.authored).some((x) => journeyById(corpus, p.instance, x.scenario) === j));
    if (sc.partOf !== undefined && listedBy.some((p) => p.scenario.id === sc.partOf)) add("(root)", `redundant partOf "${sc.partOf}": that journey lists this one in its parts; remove it`);
    if (au.personas !== undefined && partsOf(au).length > 0) {
      const derived = derivedPersonas(corpus, j);
      if (derived.length === au.personas.length && derived.every((p) => au.personas!.includes(p))) add("(root)", "redundant personas: they are exactly its parts' personas, from which they are derived; remove them");
    }
    const cycle = composedCycle(corpus, j);
    if (cycle) add("(root)", `parts and includes form a cycle: ${cycle}`);
    const ladder = sc.trustLadder === undefined ? undefined : lookup(corpus.ladders, j.instance, sc.trustLadder);
    if (sc.trustLadder !== undefined) ref(ladder !== undefined, "(root)", `trustLadder "${sc.trustLadder}" is no code list in a declared code-list directory`);
    for (const v of sc.views ?? []) {
      ref(archimate?.(j.instance, v.model, v.view) !== undefined, "(root)", `view "${v.view}" of model "${v.model}" is not in the instance's ArchiMate config`);
    }
    for (const c of sc.illustrationStyle?.cast ?? []) actor(c.actor, "(root)", "illustrationStyle.cast actor");

    const derives = derivesFields(au.$schema);
    for (const [i, s] of sc.steps.entries()) {
      const at = `step ${s.id}`;
      const own = au.steps[i]!;
      if (own.experiences === undefined) {
        const lanes = laneExperiences(corpus, j.instance, sc.personas, own);
        if (lanes.length === 0) add(at, "has no experiences, and none derive: no persona plays a lane of its realisedBy tasks; write them");
        else if (own.lead !== undefined && own.lead === lanes[0]!.actor) add(at, `redundant lead "${own.lead}": it is the first actor its lanes derive; remove it`);
      }
      if (s.lead) actor(s.lead, at, "lead");
      for (const x of s.experiences) actor(x.actor, at, "experience actor");
      if (derives) {
        for (const a of new Set([s.lead, ...s.experiences.map((x) => x.actor)].filter(Boolean))) {
          if (!sc.personas.includes(a)) add(at, `names actor "${a}", who is not among the journey's personas (or the actors of its role personas)`);
        }
      }
      if (s.includes !== undefined) {
        ref(journeyById(corpus, j.instance, s.includes) !== undefined, at, `includes "${s.includes}", which is no journey in this checkout`);
        const c = includeConflict(corpus, j, s);
        if (c?.status === "mismatch") add(at, `includes "${s.includes}" disagrees with its realisedBy: ${c.detail}`);
        else if (c?.status === "unknown") couldNotDetermine.push({ instance: j.instance, file: j.file, at, message: `whether includes "${s.includes}" is the process its call activity calls: ${c.detail}` });
      }
      // A hand-off end spelled as an id names an actor; one in words names a place or a system.
      if (s.handoff?.from !== undefined && ACTOR_ID.test(s.handoff.from)) actor(s.handoff.from, at, "handoff.from");
      if (s.handoff?.to !== undefined && ACTOR_ID.test(s.handoff.to)) actor(s.handoff.to, at, "handoff.to");
      for (const id of s.stories ?? []) ref(lookup(corpus.stories, j.instance, id) !== undefined, at, `story "${id}" is in no stories.json of a declared scenarios directory`);
      for (const r of s.realisedBy ?? []) {
        const ids = processElementIds(corpus, j.instance, r.process);
        ref(ids !== undefined, at, `realisedBy process "${r.process}" is no file of instance ${j.instance}`);
        if (ids === undefined) continue;
        for (const t of r.tasks ?? []) ref(ids.has(t), at, `realisedBy task "${t}" is no element of ${r.process}`);
      }
      for (const u of s.uses ?? []) ref(blockFor(corpus, j.instance, u.block) !== undefined, at, `uses block "${u.block}", which no building-blocks catalogue in a declared directory holds`);
      for (const id of [...(s.requirements ?? []), ...(s.preconditions ?? []).flatMap((p) => p.requirements ?? [])]) {
        ref(requirementFor(corpus, id) !== undefined, at, `requirement "${id}" is no req: node in this checkout`);
      }
      for (const k of new Set([...(s.examples ?? []), ...(s.fhirChanges ?? []).flatMap((c) => c.examples ?? [])])) example(j.instance, j.file, at, k);
      for (const k of new Set((s.dak ?? []).map((d) => d.key))) example(j.instance, j.file, at, k, "DAK asset");
      if (s.record !== undefined && ladder !== undefined) {
        ref(ladder.some((c) => c.code === s.record!.state), at, `record.state "${s.record.state}" is no code of trust ladder ${sc.trustLadder}`);
      }
      const src = s.illustration?.src;
      if (src !== undefined) ref(instanceFile(corpus, j.instance, src) !== undefined, at, `illustration.src "${src}" is no file of instance ${j.instance}`);
    }
  }

  for (const w of corpus.workshops) {
    const ws = w.workshop;
    const add = (at: string, message: string) => findings.push({ instance: w.instance, file: w.file, at, message });
    const stepRef = (scenario: string, step: string, at: string) => {
      references++;
      const j = journeyById(corpus, w.instance, scenario);
      if (j === undefined) add(at, `scenario "${scenario}" is no journey in this checkout`);
      else if (!j.scenario.steps.some((x) => x.id === step)) add(at, `step "${step}" is no step of journey ${scenario} (${j.instance}/${j.file})`);
    };
    const hashRef = (r: string, at: string) => {
      const i = r.indexOf("#");
      if (i <= 0) {
        references++;
        add(at, `step ref "${r}" is not <scenario>#<step>`);
      } else stepRef(r.slice(0, i), r.slice(i + 1), at);
    };
    ws.scenarios.forEach((id, i) => {
      references++;
      if (journeyById(corpus, w.instance, id) === undefined) add(`scenarios[${i}]`, `scenario "${id}" is no journey in this checkout`);
    });
    (ws.steps ?? []).forEach((s, i) => stepRef(s.scenario, s.step, `steps[${i}]`));
    for (const d of ws.discussion ?? []) for (const r of d.steps ?? []) hashRef(r, `discussion ${d.id}`);
    for (const r of ws.resources ?? []) for (const x of r.steps ?? []) hashRef(x, `resource ${r.id}`);
    const pr = ws.presentation;
    if (pr?.recordOf !== undefined) {
      references++;
      if (lookup(corpus.actors, w.instance, pr.recordOf) === undefined) add("presentation", `recordOf "${pr.recordOf}" is no actor`);
    }
    for (const v of pr?.views ?? []) {
      references++;
      if (archimate?.(w.instance, v.model, v.view) === undefined) add("presentation", `view "${v.view}" of model "${v.model}" is not in the instance's ArchiMate config`);
    }
    // The canvas's files: a URL, or a file of the layer, read from the workshop file's directory.
    const src = ws.sheetsSource;
    if (src) {
      const named = [src.docx, src.pdf, ...(src.previews ?? [])].filter((h): h is string => h !== undefined);
      references += named.length;
      const root = corpus.instances.get(w.instance)?.root;
      for (const h of named) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith("/")) continue;
        if (root === undefined || instanceFile(corpus, w.instance, relative(root, resolve(w.dir, h))) === undefined) add("sheetsSource", `"${h}" is no file of instance ${w.instance} (read from the workshop file's directory)`);
      }
    }
    // A screen shows steps the workshop teaches: a step id of one of its scenarios.
    const taught = new Set(ws.scenarios.flatMap((id) => {
      const j = journeyById(corpus, w.instance, id);
      return j ? [j, ...corpus.journeys.filter((x) => parentsOf(corpus, x).includes(j))] : [];
    }).flatMap((j) => j.scenario.steps.map((x) => x.id)));
    for (const sc of pr?.deviceDemo?.screens ?? []) for (const id of sc.steps) {
      references++;
      if (!taught.has(id)) add(`presentation.deviceDemo ${sc.id}`, `step "${id}" is no step of a journey the workshop teaches`);
    }
  }

  for (const x of corpus.screens) {
    const sc = x.screen;
    const add = (at: string, message: string) => findings.push({ instance: x.instance, file: x.file, at, message });
    screenActors(sc).forEach((id, i) => {
      references++;
      if (lookup(corpus.actors, x.instance, id) === undefined) add(i === 0 ? "owner" : "personCard", `actor "${id}" is no actor (actors/${id}.json in a declared scenarios directory)`);
    });
    sc.steps.forEach((st, i) => {
      references++;
      const j = journeyById(corpus, x.instance, st.scenario);
      if (j === undefined) add(`steps[${i}]`, `scenario "${st.scenario}" is no journey in this checkout`);
      else if (!j.scenario.steps.some((y) => y.id === st.step)) add(`steps[${i}]`, `step "${st.step}" is no step of journey ${st.scenario} (${j.instance}/${j.file})`);
    });
    for (const k of new Set(screenExamples(sc))) example(x.instance, x.file, "blocks", k);
  }

  // What each workshop's overview will leave out (skill journey-maps, "The VaxLink overview").
  for (const w of corpus.workshops) {
    const warn = (at: string, message: string) => warnings.push({ instance: w.instance, file: w.file, at, message: `overview-gap: ${message}` });
    const pr = w.workshop.presentation;
    if (!pr?.story) warn("presentation.story", "no story in one sentence; the overview's hero shows the workshop description instead");
    const taught = w.workshop.scenarios.flatMap((id) => {
      const j = journeyById(corpus, w.instance, id);
      return j ? [j] : [];
    });
    const ids = (js: readonly Journey[]) => js.map((j) => j.scenario.id).join(", ");
    const noScene = taught.filter((j) => !j.scenario.scene?.length);
    if (noScene.length) warn("scenarios", `no scene (the icon strip under a moment) on ${ids(noScene)}`);
    const noLadder = taught.filter((j) => j.scenario.trustLadder === undefined);
    if (noLadder.length) warn("scenarios", `no trustLadder ("Follow the record") on ${ids(noLadder)}`);
    const steps = taught.flatMap((j) => j.scenario.steps.map((st) => ({ j, st })));
    const noRecord = steps.filter(({ j, st }) => j.scenario.trustLadder !== undefined && st.record === undefined);
    if (noRecord.length) warn("scenarios", `no record.state on step(s) ${noRecord.map(({ st }) => st.id).join(", ")}`);
    const noPicture = steps.filter(({ st }) => st.illustration === undefined);
    if (noPicture.length) warn("scenarios", `no illustration on step(s) ${noPicture.map(({ st }) => st.id).join(", ")}`);
    if (pr?.recordOf === undefined && noLadder.length < taught.length) warn("presentation.recordOf", "a trust ladder is declared but not whose record it follows");
    const shown = new Set(corpus.screens.filter((x) => x.instance === w.instance).flatMap((x) => x.screen.steps.map((st) => st.scenario)));
    if (!taught.some((j) => shown.has(j.scenario.id)) && pr?.deviceDemo === undefined) warn("scenarios", "no device screen shows any step it teaches (the Device Demo is empty)");
  }

  // A persona's avatar is a file of the actor's layer.
  for (const actors of corpus.actors.values()) {
    for (const a of actors.values()) {
      if (a.persona?.avatar === undefined) continue;
      references++;
      if (avatarFile(corpus, a) === undefined) findings.push({ instance: a.instance, file: a.file, at: "meta.persona.avatar", message: `avatar "${a.persona.avatar}" is no file of instance ${a.instance}` });
    }
  }

  return {
    journeys: corpus.journeys.length,
    workshops: corpus.workshops.length,
    screens: corpus.screens.length,
    references,
    findings,
    couldNotDetermine,
    warnings,
    ...(corpus.undetermined !== undefined ? { undetermined: corpus.undetermined } : {}),
  };
}

/** Check the checkout `start` is in. */
export function checkJourneyRefsAt(start: string): RefReport {
  return checkJourneyRefs(readJourneyCorpus(start));
}
