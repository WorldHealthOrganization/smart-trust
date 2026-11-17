/**
 * User scenarios: a DAK user scenario told as a journey map, and the
 * building-block catalogue its steps say they use.
 *
 * @graphNode schema
 * @module schemas/user-scenario
 *
 * ## What a user scenario is
 *
 * The DAK logical model `UserScenario` has `id`, `title`,
 * `description[x]` and `personas`. This kind keeps those fields as they are
 * and adds the ordered **steps** a journey map is made of: for each step, who
 * does what and how they feel (one experience per actor present), what goes
 * wrong without it and what makes it work, how far the record can be trusted
 * once it is done, and what passes on. Each step points at the user stories
 * it satisfies (`scenarios/stories.json`, `user-story.ts`), the BPMN tasks
 * that carry it out, the `req:` requirements it exercises, the FHIR examples
 * it produces, and the building blocks it uses, each in the role it plays
 * there.
 *
 * The user stories stay role-level (caregiver); a scenario's steps are
 * persona-level (one fictional caregiver). The step's `stories` edge joins
 * the two.
 *
 * ## A journey IS a DAK user scenario
 *
 * The kind specialises the DAK user scenario (the `user-scenario` block kind
 * of the DAK vocabulary; the registry says so in `specialises`). It keeps the
 * DAK fields and adds the journey metadata, all of it optional from 0.4.0: a
 * file with only `id`, `title`, `description` and `personas` is a plain DAK
 * user scenario, listed by the viewer with no journey map.
 *
 * The two `personas` are one list read two ways. Here an entry is an actor
 * (one fictional person) or a role; the DAK's personas are ROLES (the BPMN
 * swimlanes), so a DAK reader gets them DERIVED: each actor's `roles`, and a
 * role as it is (`dakUserScenario`, `scripts/journeys/derive.ts`). Nothing
 * says the roles twice.
 *
 * ## Composition: a journey lists its parts
 *
 * Journeys are narrative, so their composition is AUTHORED, never inferred
 * from the BPMN: a process with sub-processes gets no journey unless somebody
 * writes one. One direction is authored (0.4.0):
 *
 * - `parts` on the PARENT, in story order: each a journey, `optional` when
 *   the story may skip it, `repeats` when it may happen more than once. A
 *   journey may be a part of more than one parent. Within a parent, which
 *   part a part follows is derived from the order, as is whose part it is.
 * - `includes` on a STEP: the step IS that journey, as a BPMN call activity
 *   is a process. When the step's `realisedBy` names a call activity,
 *   `check:journey-refs` checks that it calls a process the included journey
 *   is realised by.
 * - `follows` still chains journeys that no parent lists (J1, J2, J3, J4).
 *
 * `partOf` (0.2.0) said the same as `parts` from the child's side, one
 * parent only. It is read in an older file and refused in a 0.4.0 one, so a
 * 0.4.0 checkout has one way to group. A journey a parent lists carries no
 * `follows` (`check:journey-refs`: the parent's order says it).
 *
 * ## Four families, one shape
 *
 * `user-scenario/0.1.0` is the draft smart-trust-demo wrote and checked
 * (`docs/proposals/user-scenario/`, frozen 2026-11-05); every 0.1.0 file is
 * read unchanged. `user-scenario/0.2.0` adds what the harness needed to make
 * the viewer generic: `partOf`, `views` (ArchiMate views of the journey),
 * `references`, `illustrationStyle` and, on a step, `gaps` (what the
 * specification does not yet cover), `references`, `illustration` and
 * `fhirChanges` (the FHIR resources it creates or changes, told for a room),
 * and on a journey its `scene` (a few glyphs that picture it).
 * `user-scenario/0.3.0` adds a step's `dak`: the DAK assets the step uses, each
 * an artefact-index key and what it is to the step (the data set it records,
 * the decision table that decides it, the indicator that measures it).
 * `user-scenario/0.4.0` adds `parts` and a step's `includes`, refuses
 * `partOf`, and makes what can be derived optional: `personas` (from the
 * parts', for a journey that only groups), `steps`, and a step's `lead` and
 * `experiences` (by default, the actors who play the lanes of its
 * `realisedBy` tasks). Its `personas` may name roles as well as actors.
 * Nothing of an earlier minor changes meaning, and the kind accepts a 0.1.0,
 * 0.2.0 or 0.3.0 file as it is, by that file's own rules.
 *
 * ## What is NOT here, on purpose
 *
 * - Composition inferred from BPMN: a call activity or a sub-process is not
 *   a journey until somebody writes one.
 * - The workshop layer (questions a room is asked of a step, modules,
 *   decision rights, job aids): the `workshop` kind (`workshop.ts`), which
 *   points at step ids, so a scenario does not depend on any one workshop.
 * - Presentation (a persona's colours, a device screen): the persona's actor
 *   (`meta.persona`, {@link JourneyPersonaSchema}) or the app that shows it.
 */
import { z } from "zod";

import { acceptsSchemaTag, nodeKind, parseSchemaTag } from "../kg/node-kind.ts";

/** The family tags this module validates. */
export const USER_SCENARIO_V01 = "user-scenario/0.1.0";
export const USER_SCENARIO_V02 = "user-scenario/0.2.0";
export const USER_SCENARIO_V03 = "user-scenario/0.3.0";
export const USER_SCENARIO_V04 = "user-scenario/0.4.0";
export const BUILDING_BLOCKS_V01 = "building-blocks/0.1.0";

/**
 * The small line glyphs the journeys viewer draws: a journey's `scene`, a
 * persona's `icon`. A closed list, so a name the viewer cannot draw is refused
 * here rather than drawn as nothing.
 */
export const JOURNEY_GLYPHS = [
  "baby", "person", "family", "clinician", "health-worker", "hospital", "clinic", "home", "phone", "tablet",
  "qr", "paper", "wifi-off", "wifi", "shield-check", "calendar-check", "stethoscope", "link", "transfer",
  "globe", "key", "lock", "database", "tent", "bus", "plane", "scale", "coins", "shuffle",
] as const;
export const JourneyGlyphSchema = z.enum(JOURNEY_GLYPHS);
export type JourneyGlyph = z.infer<typeof JourneyGlyphSchema>;

/** A lower-case kebab id: a scenario, an actor, a story, a block. */
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an id is lower-case kebab");
const Text = z.string().min(1);

/** A labelled link. `href` is a URL or a repository-relative path. */
export const ReferenceSchema = z
  .object({
    label: Text,
    /**
     * A URL (`https:`, `mailto:` …), an absolute path or a `#fragment` as it
     * is; anything else is a path from the SITE'S ROOT (`vaxlink/`,
     * `journeys.html#j1`), resolved the same way on the journey page and the
     * workshop pages (`fromSite`, `scripts/journeys/read.ts`).
     */
    href: Text,
    /** What the link is to the step or journey: `specifies`, `illustrates`, `reading`. Free text. */
    rel: Text.optional(),
  })
  .strict();
export type Reference = z.infer<typeof ReferenceSchema>;

/** One actor's experience of a step. */
export const ExperienceSchema = z
  .object({
    actor: Id,
    doing: Text,
    /** In their own words. */
    feeling: Text.optional(),
    /** -2 distressed, -1 worried, 0 neutral, 1 reassured, 2 delighted. */
    emotion: z.number().int().min(-2).max(2).optional(),
  })
  .strict();
export type Experience = z.infer<typeof ExperienceSchema>;

const PreconditionSchema = z
  .object({
    title: Text,
    /** Markdown. */
    description: Text,
    requirements: z.array(Text).optional(),
  })
  .strict();

const RecordSchema = z
  .object({
    /** A code of the scenario's `trustLadder` code list. */
    state: Text,
    description: Text,
    heldWhere: Text,
  })
  .strict();

const HandoffSchema = z
  .object({
    summary: Text,
    /** Who or what it leaves: an actor id (drawn with the persona's name), or a place or system in words ("Thai hospital"). */
    from: Text.optional(),
    /** Who or what it reaches, as `from`. */
    to: Text.optional(),
    offline: z.boolean().optional(),
    /** How it travels: a camera scan, a sync through a gateway, a QR on a phone. */
    carrier: Text.optional(),
    /** What travels, in the data's own terms. */
    payload: Text.optional(),
  })
  .strict();

const WhatIfSchema = z.object({ scenario: Text, outcome: Text }).strict();

/** The BPMN that carries a step out: a process file and, optionally, which of its flow nodes. */
export const RealisedBySchema = z
  .object({
    /** The BPMN file, relative to the layer root. */
    process: Text,
    /** Flow-node ids in that process. Omitted: the whole process. */
    tasks: z.array(Text).min(1).optional(),
  })
  .strict();
export type RealisedBy = z.infer<typeof RealisedBySchema>;

/** A step's use of a building block, in the role it plays there. */
export const UsesSchema = z
  .object({
    /** A block id in a `building-blocks` catalogue. */
    block: Id,
    /** What the block does in THIS step, in one line. */
    role: Text,
    /** Which ArchiMate component plays it here, when the block names more than one. */
    component: Text.optional(),
  })
  .strict();

const StepV01 = {
  /** The step's code in the story (J1, J2a, J4.0b, P3). */
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/),
  title: Text,
  /** One sentence that tells the step. */
  headline: Text.optional(),
  when: Text.optional(),
  where: Text.optional(),
  /** What the people touch: a paper card, an app, a QR. */
  touchpoint: Text.optional(),
  preconditions: z.array(PreconditionSchema).optional(),
  /** The step told in full, Markdown. */
  narrative: Text.optional(),
  /** The actor the step is told through. */
  lead: Id,
  experiences: z.array(ExperienceSchema).min(1),
  painPoint: Text.optional(),
  enabler: Text.optional(),
  /** The policy point the step makes, in one sentence. */
  policy: Text.optional(),
  record: RecordSchema.optional(),
  handoff: HandoffSchema.optional(),
  whatIf: z.array(WhatIfSchema).optional(),
  /** User story ids (`scenarios/stories.json`) the step satisfies, in whole or in part. */
  stories: z.array(Id).optional(),
  realisedBy: z.array(RealisedBySchema).optional(),
  /** The step's technical so-what, in one or two sentences. */
  technicalSummary: Text.optional(),
  uses: z.array(UsesSchema).optional(),
  /** Requirement ids (`req:` nodes) the step exercises. */
  requirements: z.array(Text).optional(),
  /** FHIR examples the step produces, `Type/id`. */
  examples: z.array(z.string().regex(/^[A-Z][A-Za-z]+\/[A-Za-z0-9.-]+$/)).optional(),
};

/**
 * A step's picture: the image when there is one, and the brief for drawing it
 * when there is not. `src` is relative to the layer root, as
 * `realisedBy[].process` is, and `check:journey-refs` fails when it names no
 * file. `prompt` is the step's own image-generation prompt; the scenario's
 * {@link IllustrationStyleSchema} is the style and cast every step shares.
 *
 * **A picture carries no text** (owner, 2026-11-05). The step's title and any
 * caption are translatable page text, rendered by the viewer from the step's
 * `title` and this `alt`, never baked into the image; a prompt asks for no
 * readable text, signs or logos.
 */
export const IllustrationSchema = z
  .object({
    /** The image, instance-relative (`docs/images/p3-mina.png`), with no text in it. Absent: not drawn yet. */
    src: Text.optional().describe("The image, relative to the instance root. It carries NO text: the step title and any caption are translatable page text, rendered from the step's `title` and `alt`."),
    /** What the picture shows, for a reader who cannot see it; translatable page text, the caption the picture itself never carries. */
    alt: Text.describe("What the picture shows: translatable page text, rendered beside the image as its caption, never baked into it."),
    /** The scene, as a prompt for an image generator: what to draw when `src` is absent. It asks for no readable text. */
    prompt: Text.optional().describe("The scene, as a prompt for an image generator, for when no picture exists yet. It asks for no readable text, signs or logos."),
  })
  .strict()
  .describe("A step's picture, or the brief for drawing it. A picture carries no text; the title and caption are page text.");
export type Illustration = z.infer<typeof IllustrationSchema>;

/** The style and cast a scenario's illustrations share, so each step's prompt says only its scene. */
export const IllustrationStyleSchema = z
  .object({
    /** The style prefix every step's prompt is read with. */
    prompt: Text,
    /** How each person is drawn, kept the same across steps. Every person is fictional. */
    cast: z.array(z.object({ actor: Id, description: Text }).strict()).optional(),
    /** What to keep in mind: cultural notes, what never to draw. */
    notes: z.array(Text).optional(),
  })
  .strict();
export type IllustrationStyle = z.infer<typeof IllustrationStyleSchema>;

/** An example key, `Type/id`, as `examples` and an artifact index spell it. */
const ExampleKey = z.string().regex(/^[A-Z][A-Za-z]+\/[A-Za-z0-9.-]+$/);

/**
 * One FHIR resource a step creates or changes, told for a room: what changes,
 * why it is there at this moment, the profile it conforms to, and the
 * examples that show it. `examples` are `Type/id` keys, resolved like the
 * step's own `examples` (a layer's `fhir-artifact-index`); `profile` is a
 * StructureDefinition id; `spec` the base standard's page.
 */
export const FhirChangeSchema = z
  .object({
    /** As the room says it: "Immunization ×2", "Group (household)". */
    resource: Text,
    /** What happens to it: "Created as primarySource = false". */
    change: Text,
    why: Text.optional(),
    /** The StructureDefinition id the record conforms to. */
    profile: Text.optional(),
    /** Whose profile it is, as a chip beside it ("Lao PDR"). */
    profileOf: Text.optional(),
    examples: z.array(ExampleKey).optional(),
    /** The base standard's page. */
    spec: z.string().url().optional(),
  })
  .strict();
export type FhirChange = z.infer<typeof FhirChangeSchema>;

/**
 * What a DAK asset is to a step: `data` a data set it records or exchanges (a
 * logical model of the data dictionary), `decides` a decision table that
 * decides something in it, `measures` an indicator that counts what it does.
 */
export const DAK_RELS = ["data", "decides", "measures"] as const;
export const DakRelSchema = z.enum(DAK_RELS);
export type DakRel = z.infer<typeof DakRelSchema>;

/**
 * One DAK asset a step uses, by its key in the layer's
 * `fhir-artifact-index` (`StructureDefinition/<logical model>`,
 * `PlanDefinition/<decision table>`, `Measure/<indicator>`), resolved like the
 * step's `examples`. `rel` says what it is to the step; absent, a reader goes
 * by the key's resource type.
 */
export const DakLinkSchema = z
  .object({
    key: ExampleKey,
    rel: DakRelSchema.optional(),
  })
  .strict();
export type DakLink = z.infer<typeof DakLinkSchema>;

/** One part of a journey's small picture: a glyph and what it stands for. */
export const SceneSchema = z.object({ icon: JourneyGlyphSchema, label: Text }).strict();

const StepV02 = {
  ...StepV01,
  /** The FHIR resources the step creates or changes, told for a room; its `examples` stay the plain list. */
  fhirChanges: z.array(FhirChangeSchema).optional(),
  /** What the specification does not yet cover for this step: each a finding, not a failure. */
  gaps: z.array(Text).optional(),
  references: z.array(ReferenceSchema).optional(),
  /** The step's picture, or the brief for drawing it. */
  illustration: IllustrationSchema.optional(),
};

const StepV03 = {
  ...StepV02,
  /** The DAK assets the step uses: its data sets, the decision tables that decide it, the indicators that measure it. */
  dak: z.array(DakLinkSchema).optional(),
};

const StepV04 = {
  ...StepV03,
  /** Absent (0.4.0): the first actor the step's lanes derive. */
  lead: Id.optional(),
  /** Absent (0.4.0): one per actor who plays a lane of the step's `realisedBy` tasks, doing those tasks. Authored, they are the narrative. */
  experiences: z.array(ExperienceSchema).min(1).optional(),
  /** The journey this step IS, as a BPMN call activity is a process: drawn as a link to it. */
  includes: Id.optional(),
};

/** One part of a journey, in story order. */
export const PartSchema = z
  .object({
    /** The journey that is this part. */
    scenario: Id,
    /** The story may skip it. */
    optional: z.literal(true).optional(),
    /** It may happen more than once. */
    repeats: z.literal(true).optional(),
  })
  .strict();
export type Part = z.infer<typeof PartSchema>;

/** An ArchiMate view of a journey: a model id of the layer's `cat-archimate.config.json` and a view id in it. */
export const ViewRefSchema = z.object({ model: Text, view: Text, label: Text.optional() }).strict();

const ScenarioV01 = {
  /** DAK UserScenario.id. */
  id: Id,
  /** DAK UserScenario.title. */
  title: Text,
  /** DAK UserScenario.description[x]: Markdown. */
  description: Text,
  /** DAK UserScenario.personas: actor ids. Every actor a step names is listed here. From 0.4.0 also role ids; optional when the journey has parts. */
  personas: z.array(Id).min(1),
  /** The scenario this one continues, when one story is told as several. */
  follows: Id.optional(),
  when: Text.optional(),
  where: Text.optional(),
  country: Text.optional(),
  /** The id of the code list whose ordered codes are the record's trust states (`step.record.state`). */
  trustLadder: Text.optional(),
};

type RefinedScenario = {
  $schema?: string;
  personas?: readonly string[];
  partOf?: string;
  parts?: readonly { scenario: string }[];
  steps?: readonly { id: string; experiences?: readonly { actor: string }[]; lead?: string }[];
};

/** Is this a file of 0.4.0 or later, whose personas may be roles and whose derivable fields may be absent? */
export function derivesFields(tag: string | undefined): boolean {
  const t = tag === undefined ? undefined : parseSchemaTag(tag);
  return t !== undefined && (t.major > 0 || t.minor >= 4);
}

/**
 * The rules no field's own schema can say. A step id appears once. Before
 * 0.4.0 a file says everything itself: `personas`, a step's `lead` and
 * `experiences` are present, and every actor a step names is a persona. From
 * 0.4.0 those may be derived, so `check:journey-refs` holds them against the
 * derived values, and `partOf` is refused (the parent's `parts` says it).
 */
function uniqueSteps(s: RefinedScenario, ctx: z.RefinementCtx): void {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const derives = derivesFields(s.$schema);
  const seen = new Set<string>();
  const personas = new Set(s.personas ?? []);
  if (!derives && s.personas === undefined) issue(`personas is required before ${USER_SCENARIO_V04}`);
  if (derives && s.partOf !== undefined) issue(`partOf is refused in ${USER_SCENARIO_V04}: list this journey in its parent's \`parts\``);
  if (derives && s.personas === undefined && !(s.parts?.length)) issue("personas is required unless the journey has parts, whose personas it then has");
  const parts = new Set<string>();
  for (const p of s.parts ?? []) {
    if (parts.has(p.scenario)) issue(`part "${p.scenario}" appears twice`);
    parts.add(p.scenario);
  }
  for (const step of s.steps ?? []) {
    if (seen.has(step.id)) issue(`step id "${step.id}" appears twice`);
    seen.add(step.id);
    if (derives) continue;
    if (step.lead === undefined || step.experiences === undefined) {
      issue(`step ${step.id}: lead and experiences are required before ${USER_SCENARIO_V04}`);
      continue;
    }
    for (const a of new Set([step.lead, ...step.experiences.map((e) => e.actor)])) {
      if (!personas.has(a)) issue(`step ${step.id} names actor "${a}", who is not among the scenario's personas`);
    }
  }
}

/**
 * `user-scenario/0.4.0`, as a node kind: 0.1.0 plus grouping, views,
 * references, illustrations and per-step gaps (0.2.0), a step's DAK assets
 * (0.3.0), and parts, a step's `includes` and derivable fields left out
 * (0.4.0). A minor bump only adds, so the kind accepts a 0.1.0, 0.2.0 or
 * 0.3.0 file as it is (`acceptsSchemaTag`), each by its own rules
 * ({@link uniqueSteps}).
 */
export const UserScenarioKind = nodeKind(
  USER_SCENARIO_V04,
  [],
  {
    ...ScenarioV01,
    personas: z.array(Id).min(1).optional(),
    /** The journey this one is a sub-journey of (0.2.0–0.3.0; refused in 0.4.0, where the parent lists it in `parts`). */
    partOf: Id.optional(),
    /** The journeys this one is made of, in story order (0.4.0). */
    parts: z.array(PartSchema).min(1).optional(),
    /** ArchiMate views of the journey. */
    views: z.array(ViewRefSchema).optional(),
    references: z.array(ReferenceSchema).optional(),
    /** The style and cast the steps' illustrations share. */
    illustrationStyle: IllustrationStyleSchema.optional(),
    /** The journey's small picture, a few glyphs in order (VaxLink's moment icons): drawn on its chapter card and map column. */
    scene: z.array(SceneSchema).min(1).max(5).optional(),
    /** The steps in order. May be empty, or (0.4.0) absent, for a journey that only groups its parts or a plain DAK user scenario. */
    steps: z.array(z.object(StepV04).strict()).default([]),
  },
  { strict: true, refine: uniqueSteps },
);
export const UserScenarioSchema = UserScenarioKind.schema;

/** The draft family exactly as smart-trust-demo wrote and checked it: no 0.2.0 field, at least one step. */
export const UserScenarioV01Schema = z
  .object({
    $schema: z.literal(USER_SCENARIO_V01),
    ...ScenarioV01,
    steps: z.array(z.object(StepV01).strict()).min(1),
  })
  .strict()
  .superRefine(uniqueSteps);

/** A user scenario of any family, as its file says it. */
export type UserScenario = z.infer<typeof UserScenarioSchema>;
/** A step as its file says it: from 0.4.0 its `lead` and `experiences` may be left to derivation. */
export type AuthoredStep = UserScenario["steps"][number];
/** A step as a reader takes it: `lead` and `experiences` authored, or derived from its lanes. */
export type ScenarioStep = Omit<AuthoredStep, "lead" | "experiences"> & { lead: string; experiences: Experience[] };
/** A journey as a reader takes it: its personas (actors) and its steps' people, authored or derived (`scripts/journeys/derive.ts`). */
export type Scenario = Omit<UserScenario, "steps" | "personas"> & { personas: string[]; steps: ScenarioStep[] };

/**
 * The DAK `UserScenario` a journey is, as a DAK reader takes it: the logical
 * model's `id`, `title`, `description` and `personas`, the personas being
 * ROLES (the BPMN swimlanes), derived from the journey's actors.
 */
export interface DakUserScenario {
  id: string;
  title: string;
  description: string;
  /** Role ids, in the order the journey's personas first reach them. */
  personas: string[];
}

/** One block of a building-block catalogue. */
export const BuildingBlockSchema = z
  .object({
    id: Id,
    name: Text,
    /** A label for a crowded grid. */
    short: Text.optional(),
    /** `tool`: software anyone can deploy · `system`: a deployed system · `standard`: a specification · `network`: a trust network. */
    kind: z.enum(["tool", "system", "standard", "network"]),
    /** One of the catalogue's layers. */
    layer: Id,
    /** Whose block it is: a country for its deployed system, `International` for what anyone can adopt. */
    jurisdiction: Text,
    owner: Text.optional(),
    /** What it is, in one sentence. */
    what: Text,
    /** Why it matters for the journeys, in one sentence. */
    soWhat: Text.optional(),
    /** The ArchiMate element keys that deploy this block. */
    components: z.array(Text).optional(),
    links: z.array(z.object({ label: Text, url: z.string().url() }).strict()).optional(),
  })
  .strict();
export type BuildingBlock = z.infer<typeof BuildingBlockSchema>;

/**
 * `building-blocks/0.1.0`: the catalogue a step's `uses` edges point into.
 *
 * Its own kind, `building-blocks`, not a family of `user-scenario`: the
 * catalogue describes the architecture, and a layer keeps it beside its
 * ArchiMate model, where the overlay that draws those blocks reads it. So a
 * reader finds a catalogue in ANY directory that declares the kind, never by
 * folder name. The usual place is a directory declared inside the
 * `archimate` one (`archimate/building-blocks/`, `graphTypologies:
 * ["building-blocks"]`). Not the `archimate` directory itself with both kinds:
 * each kind of a directory claims every typed node in it, so
 * `check:kind-validators` would find the catalogue unmapped under `archimate`
 * and the ArchiMate config unmapped under `building-blocks`; a nested
 * declaration gives each node one kind.
 */
export const BuildingBlocksKind = nodeKind(
  BUILDING_BLOCKS_V01,
  [],
  {
    layers: z.array(z.object({ id: Id, label: Text, question: Text.optional() }).strict()).min(1),
    blocks: z.array(BuildingBlockSchema).min(1),
    /**
     * The big ideas the blocks add up to, in plain words ("Trust without
     * phoning home"): each names the blocks that carry it. The journeys
     * viewer's How it works leads with them.
     */
    ideas: z.array(z.object({ id: Id, title: Text, text: Text, blocks: z.array(Id).min(1) }).strict()).optional(),
  },
  {
    strict: true,
    refine: (c, ctx) => {
      const layers = new Set(c.layers.map((l) => l.id));
      const seen = new Set<string>();
      for (const b of c.blocks) {
        if (seen.has(b.id)) ctx.addIssue({ code: "custom", message: `block id "${b.id}" appears twice` });
        seen.add(b.id);
        if (!layers.has(b.layer)) ctx.addIssue({ code: "custom", message: `block ${b.id} is in layer "${b.layer}", which the catalogue does not list` });
      }
      for (const idea of c.ideas ?? []) {
        for (const id of idea.blocks) if (!seen.has(id)) ctx.addIssue({ code: "custom", message: `idea ${idea.id} names block "${id}", which the catalogue does not list` });
      }
    },
  },
);
export const BuildingBlocksSchema = BuildingBlocksKind.schema;
export type BuildingBlocks = z.infer<typeof BuildingBlocksSchema>;

/**
 * The persona an actor plays in a journey, kept on the actor
 * (`scenarios/actors/<id>.json`, `meta.persona`) so who a person is is said
 * once. Read, not owned, by this kind: an actor is bootstrap's `scenarios`
 * kind and its `meta` is open. Every persona is fictional.
 *
 * `initials`, `color` and `icon` are optional presentation fields (owner,
 * 2026-11-05): kept on the actor when a demonstrator wants a fixed avatar,
 * derived by the viewer when absent. `avatar` (owner, 2026-11-06) is a square
 * picture of the person, a path from the layer root
 * (`scenarios/avatars/<actor>.webp`): the viewer draws it wherever the
 * persona appears, and the initials (or the `icon`) on the colour stay the
 * fallback when there is none. `check:journey-refs` checks the path. Nothing
 * else in the harness reads them.
 */
export const JourneyPersonaSchema = z
  .object({
    name: Text,
    role: Text.optional(),
    country: Text.optional(),
    goal: Text.optional(),
    needs: z.array(Text).optional(),
    frustrations: z.array(Text).optional(),
    /** Two letters for an avatar; derived from `name` when absent. */
    initials: z.string().min(1).max(3).optional(),
    /** A CSS colour for the persona's lane and curve; assigned in order when absent. */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    /** A glyph drawn in the avatar instead of the initials (a baby, who has none). */
    icon: JourneyGlyphSchema.optional(),
    /** A square picture of the person, a path from the layer root; the initials are the fallback. */
    avatar: z.string().regex(/^[^/][^\\]*\.(?:webp|png|jpe?g|svg)$/i, "an avatar is an image path from the instance root").optional(),
  })
  .passthrough();
export type JourneyPersona = z.infer<typeof JourneyPersonaSchema>;

/** Parse a user scenario of any family; throws with every issue. */
export function parseUserScenario(raw: unknown, where = "user scenario"): UserScenario {
  const r = UserScenarioSchema.safeParse(raw);
  if (!r.success) throw new Error(`${where}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}

/** Is this parsed JSON a user scenario (any family the kind accepts)? */
export function isUserScenario(raw: unknown): boolean {
  const tag = (raw as { $schema?: unknown } | null)?.$schema;
  return typeof tag === "string" && acceptsSchemaTag(UserScenarioKind, tag);
}
