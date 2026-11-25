/**
 * Workshops: the didactic layer over a set of journeys.
 *
 * @graphNode schema
 * @module schemas/workshop
 *
 * ## What a workshop is
 *
 * A workshop teaches from journeys (`user-scenario.ts`). It is kept apart from
 * them because one journey can be taught by several workshops, to several
 * audiences, and a journey must not change when a workshop does. So a
 * workshop POINTS AT step ids and no scenario names a workshop.
 *
 * A workshop holds:
 *
 * | field | what |
 * |---|---|
 * | `modules` | the sessions, in order: a title, the one question the module carries, learning objectives, the printable sheet it fills, the resources it uses |
 * | `tables` | the reference tables a room fills or reads (decision rights, legal bases, substitution patterns, cost drivers): generic rows, so each workshop names its own |
 * | `steps` | per journey step: questions for the room (each tagged with its module), a facilitator cue, the capabilities the step needs, and which rows of which tables the step touches |
 * | `assessment` | the scales a capability is rated on at a table (exists / partial / absent; blocks us now / within 12 months / can wait), and the standing line read with them |
 * | `discussion` | closing questions, each in a module and tied to the steps it is about |
 * | `sheets` | the printable canvases (A3 or A4), each filled in one or more modules |
 * | `canvas` | the canvas as data: its sheets, sections and fields, drawn as the on-screen form and written out as an editable, pre-filled PDF |
 * | `sheetsSource` | the workshop's own canvas files (a Word file, a print PDF, page previews), shown by the Table sheets view in place of the drawn `sheets` |
 * | `matrix` | where each module meets each step, technical and policy, and the overlaps across modules: drawn by a lab step's `matrix` |
 * | `resources` | job aids, handouts, readings, slides and links, each tied to modules or steps |
 * | `presentation` | how the journeys viewer presents the workshop in a room: the app frame's words, the story in one sentence, whose record the trust ladder follows, the presenter's note, the outward links |
 * | `schedule` | the days as a calendar: tracks side by side, and the joint sessions, breaks and logistics across them, each slot linked to its module |
 * | `lab` | the Discussion view as a table's working steps (team, use case, readiness, who decides, components, mapping, pathway, summary), each with a timer and a DISCUSS prompt, after DPI-H Lab; what a table writes is kept in its browser and assembled into one summary |
 *
 * A question is a question: a module asks a room to NAME, not to decide.
 *
 * The workshop's steps name a scenario and a step id. A scenario id is looked
 * up first in the workshop's own layer and then in every layer the
 * checkout mounts, so a workshop may teach from journeys another layer
 * holds.
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.ts";
import { JourneyGlyphSchema } from "./user-scenario.ts";

export const WORKSHOP_V01 = "workshop/0.1.0";

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an id is lower-case kebab");
/** A module id: as the workshop numbers them (`M1`, `day-1-am`). */
const ModuleId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/);
const Text = z.string().min(1);

const ResourceKind = z.enum(["job-aid", "handout", "reading", "slides", "video", "tool", "template", "link"]);

export const WorkshopResourceSchema = z
  .object({
    id: Id,
    title: Text,
    kind: ResourceKind,
    description: Text.optional(),
    /** A URL, or a path relative to the workshop file. */
    href: Text.optional(),
    /** For a job aid: the short instructions themselves, Markdown, printed with it. */
    body: Text.optional(),
    modules: z.array(ModuleId).optional(),
    /** Step refs, `<scenario id>#<step id>`. */
    steps: z.array(Text).optional(),
  })
  .strict();
export type WorkshopResource = z.infer<typeof WorkshopResourceSchema>;

export const WorkshopModuleSchema = z
  .object({
    id: ModuleId,
    title: Text,
    /** Which day or session block it is in, when the workshop runs over several. */
    day: z.number().int().min(1).optional(),
    /** The question the module carries, in one line. */
    carries: Text.optional(),
    description: Text.optional(),
    /** What a participant can do after it. */
    objectives: z.array(Text).optional(),
    /** The sheet (`sheets[].id`) the module fills. */
    sheet: Id.optional(),
    /** Tables (`tables[].id`) the module works through. */
    tables: z.array(Id).optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .strict();
export type WorkshopModule = z.infer<typeof WorkshopModuleSchema>;

const TableRowSchema = z
  .object({
    id: Id,
    label: Text,
    /** The question the row asks a room. */
    question: Text.optional(),
    /** What the row means, in one sentence. */
    what: Text.optional(),
    /** A worked example from somewhere real. */
    example: Text.optional(),
    /** A heading the row is listed under, when a table groups its rows ("Governance"). */
    group: Text.optional(),
  })
  .strict();

export const WorkshopTableSchema = z
  .object({
    id: Id,
    title: Text,
    description: Text.optional(),
    /** The module that teaches it. */
    module: ModuleId.optional(),
    rows: z.array(TableRowSchema).min(1),
  })
  .strict();
export type WorkshopTable = z.infer<typeof WorkshopTableSchema>;

/**
 * A question for the room. Its answer is kept in the participant's browser
 * under the question's identity, not its position: `id` when given (so the
 * text can be reworded and the answers kept), else one derived from its step
 * and its text.
 */
const QuestionSchema = z
  .object({
    id: Id.optional(),
    module: ModuleId,
    text: Text,
    /**
     * The canvas field that asks the same thing, `<sheet>:<field>[:<row>[:<col>]]`
     * (`canvas.sheets`): the question then keeps its answer under that field's
     * key, so the walkthrough, the lab and the canvas show one answer.
     */
    canvas: z.string().regex(/^[a-z0-9][a-z0-9-]*(:[a-z0-9][a-z0-9-]*){1,3}$/).optional(),
  })
  .strict();

/** Which rows of one table a step touches; `why` when the reason is not obvious. */
const StepTagSchema = z.object({ table: Id, row: Id, why: Text.optional() }).strict();

export const WorkshopStepSchema = z
  .object({
    /** The scenario id (`user-scenario`), looked up in this layer first. */
    scenario: Id,
    /** The step id in that scenario. */
    step: Text,
    /** The one question for the whole room. */
    askTheRoom: Text.optional(),
    /** A note to the facilitator on how to run the step. */
    facilitatorCue: Text.optional(),
    questions: z.array(QuestionSchema).optional(),
    /** What had to exist for the step to work: the rows the assessment rates. */
    capabilities: z.array(z.object({ id: Id, label: Text }).strict()).optional(),
    tags: z.array(StepTagSchema).optional(),
  })
  .strict();
export type WorkshopStep = z.infer<typeof WorkshopStepSchema>;

export const WorkshopSheetSchema = z
  .object({
    id: Id,
    /** As the room calls it: "Sheet 4". */
    label: Text.optional(),
    title: Text,
    size: z.enum(["A3", "A4"]).default("A3"),
    /** The modules whose questions it carries, in order. */
    modules: z.array(ModuleId).min(1),
    /** Write-in fields the sheet has besides the module questions. */
    fields: z.array(z.object({ label: Text, lines: z.number().int().min(1).max(12).default(2) }).strict()).optional(),
    /** Print the assessment strip across its foot. */
    assessmentStrip: z.boolean().optional(),
  })
  .strict();
export type WorkshopSheet = z.infer<typeof WorkshopSheetSchema>;

/**
 * The workshop's own canvas (JV-06): the files a room prints, made outside
 * the viewer (an editable Word file, a print-ready PDF, and an image per
 * page). When present, the Table sheets view shows the previews with links
 * to download the files, in place of the sheets it draws from `sheets`;
 * those stay the fallback. Each href is a URL (`https://…`), a path from
 * the site's root (`/…`), or a path relative to the workshop file, which
 * must be a file of the workshop's layer: the viewer copies it beside the
 * page, so the canvas works wherever the viewer is published.
 */
export const WorkshopSheetsSourceSchema = z
  .object({
    /** What the canvas is called ("Country Canvas"); "Table canvas" when absent. */
    title: Text.optional(),
    /** One line under the title (what is in it, how to print it). */
    description: Text.optional(),
    /** The editable Word file. */
    docx: Text.optional(),
    /** The print-ready PDF. */
    pdf: Text.optional(),
    /** An image per page, in order (the cover first). */
    previews: z.array(Text).min(1).optional(),
    /** The paper the canvas is printed on, said beside the print button; A3 when absent. */
    size: z.enum(["A3", "A4"]).optional(),
  })
  .strict();
export type WorkshopSheetsSource = z.infer<typeof WorkshopSheetsSourceSchema>;

/**
 * One meeting point of a module and a step (JV-05): what is technical and
 * what is policy there. A cell without `kind` is where the workshop asks
 * that module's question at that step (`steps[].questions`); `draws` is
 * where the module reads the step without asking there.
 */
export const WorkshopMatrixCellSchema = z
  .object({
    module: ModuleId,
    /** A step of the workshop: its step id (`J2b`), or `<scenario>#<step>`. */
    step: Text,
    kind: z.enum(["draws"]).optional(),
    technical: Text.optional(),
    policy: Text.optional(),
  })
  .strict();
export type WorkshopMatrixCell = z.infer<typeof WorkshopMatrixCellSchema>;

/** What several modules share across steps: one system, or one decision, read at several points. */
const MatrixOverlapSchema = z
  .object({ label: Text, modules: z.array(ModuleId).min(1), steps: z.array(Text).min(1), text: Text })
  .strict();

/**
 * The module × journey matrix's words: per-cell text and the overlaps across
 * modules. The ● cells themselves are derived from `steps[].questions`; a
 * lab step with `matrix` draws them, with this text on each cell.
 */
export const WorkshopMatrixSchema = z
  .object({
    /** A line above the matrix. */
    intro: Text.optional(),
    cells: z.array(WorkshopMatrixCellSchema).optional(),
    overlaps: z.object({ technical: z.array(MatrixOverlapSchema).optional(), policy: z.array(MatrixOverlapSchema).optional() }).strict().optional(),
  })
  .strict();
export type WorkshopMatrix = z.infer<typeof WorkshopMatrixSchema>;

/** A write-in field of a lab step: kept in the browser, in the summary. */
const LabFieldSchema = z
  .object({ id: Id, label: Text, hint: Text.optional(), lines: z.number().int().min(1).max(12).default(2) })
  .strict();

/**
 * One step of the Discussion view's lab: a heading, a timer, a DISCUSS
 * prompt, and the parts the table works through, drawn in this order:
 * `fields`, `useCases`, `rate`, `holders`, `pick`, `capabilities` (the gap
 * strip of every moment, the same answers the walkthrough keeps), `matrix`
 * (modules × steps, from `steps[].questions` and `workshop.matrix`),
 * `modules` (the journey's questions of those modules, answerable here and
 * on the walkthrough alike), `discussion` (the closing questions), and
 * `summary` (everything above, on one page).
 */
export const WorkshopLabStepSchema = z
  .object({
    id: Id,
    /** On the step's tab ("Who decides"). */
    label: Text,
    /** The step's question ("Who is part of the working team?"). */
    title: Text,
    lede: Text.optional(),
    /** The timer's length; no timer when absent. */
    minutes: z.number().int().positive().max(240).optional(),
    /** The DISCUSS prompt read to the table. */
    discuss: Text.optional(),
    /** A caution under the step ("Don't enter personal health information."). */
    note: Text.optional(),
    fields: z.array(LabFieldSchema).optional(),
    /** The use-case cards (`lab.useCases`), any number ticked, and the table's own statement under them. */
    useCases: z.boolean().optional(),
    /** Tables whose rows the table rates on `lab.scale` (a readiness check). */
    rate: z.array(Id).optional(),
    /** Tables whose rows each get "who holds it today" (decision rights, legal bases). */
    holders: z.array(Id).optional(),
    /** Tables whose rows the table ticks (the patterns it would start with, the cost drivers that dominate). */
    pick: z.array(Id).optional(),
    capabilities: z.boolean().optional(),
    /** The module × journey matrix: modules down, the workshop's steps across, ● where a module's question is asked, each cell linking to its step. */
    matrix: z.boolean().optional(),
    modules: z.array(ModuleId).optional(),
    discussion: z.boolean().optional(),
    /** Canvas sheets (`canvas.sheets[].id`) the step shows as the on-screen form. */
    canvas: z.array(Id).optional(),
    summary: z.boolean().optional(),
    /** Resources (`resources[].id`) linked from the step. */
    resources: z.array(Id).optional(),
  })
  .strict();
export type WorkshopLabStep = z.infer<typeof WorkshopLabStepSchema>;

/**
 * The Discussion view as a lab (after DPI-H Lab, dpih.fhirlab.net): a tab per
 * step, each timed, and a summary assembled from them. Nothing leaves the
 * browser. `credit` is printed at the foot of the view, with `creditHref`.
 */
export const WorkshopLabSchema = z
  .object({
    name: Text.optional(),
    intro: Text.optional(),
    credit: Text.optional(),
    creditHref: Text.optional(),
    /** The credit link's words ("DPI-H Lab"); `name` when absent. */
    creditLabel: Text.optional(),
    /** The use cases a table may tick; `journey` ones come ticked, as the journeys teach them. */
    useCases: z.array(z.object({ id: Id, label: Text, description: Text.optional(), journey: z.boolean().optional() }).strict()).optional(),
    /** The table's use-case statement as the journeys fill it in; each taught journey's line is added under it. Editable. */
    useCaseText: Text.optional(),
    /** The scale `rate` tables are rated on (Done / In progress / Not yet), its first option "nothing missing". */
    scale: z.object({ id: Id, label: Text, options: z.array(z.object({ id: Id, label: Text }).strict()).min(2) }).strict().optional(),
    steps: z.array(WorkshopLabStepSchema).min(1),
  })
  .strict();
export type WorkshopLab = z.infer<typeof WorkshopLabSchema>;

/**
 * How the journeys viewer presents a workshop in a room (its overview and
 * walkthrough pages, which wear no site chrome): the words of the app frame,
 * the story in one sentence, and the links out. Every field is optional; the
 * viewer falls back to the workshop's own title and description.
 */
export const WorkshopPresentationSchema = z
  .object({
    /** The app's name in its frame ("VaxLink"); the workshop title when absent. */
    name: Text.optional(),
    /** A short badge beside the name ("Interactive Spec"). */
    badge: Text.optional(),
    /** One line under the name. */
    tagline: Text.optional(),
    /** The occasion, first on the frame's top bar ("Workshop vignette"). */
    occasion: Text.optional(),
    /** What the story is about, beside the occasion. */
    subject: Text.optional(),
    /** Where the story moves, after the step range ("Thailand ⇄ Lao PDR"). */
    scope: Text.optional(),
    /** A status line at the right of the top bar. */
    status: Text.optional(),
    /** The story in one sentence: the overview's headline. */
    story: Text.optional(),
    /** A line under it. */
    lede: Text.optional(),
    /** The actor whose record the trust ladder follows ("Somsack's record"). */
    recordOf: Id.optional(),
    /**
     * The order the cast is listed in, everywhere it is listed (the overview,
     * the journey map's lanes, the persona lens): actor ids. An actor a step
     * names and this list does not follows, in order of first appearance; an
     * id no step names is not drawn. Absent: order of first appearance.
     */
    cast: z.array(Id).optional(),
    /**
     * A chapter's title in the room, by the id of the journey the chapter is
     * (`"j4-family-records-abroad": "Crossing back"`). Absent: the journey's
     * title without its code in front.
     */
    chapterTitles: z.record(Id, Text).optional(),
    /**
     * How a walkthrough step's policy card groups the rows of the tables it
     * tags, in this order: each row a label, an optional glyph and the tables
     * it gathers (VaxLink: "Forces" = decision rights + legal basis, "Cost
     * driver", "If it is missing" = substitution patterns). Absent: one row
     * per table, titled by the table.
     */
    tagRows: z.array(z.object({ label: Text, icon: JourneyGlyphSchema.optional(), tables: z.array(Id).min(1) }).strict()).optional(),
    /**
     * The table sheets' cover (JV-14), printed before Sheet 1: the blanks a
     * table fills in (`fields`; absent: Country, Delegation, Table,
     * Facilitator), the workshop's `promise`, and the `table` whose rows
     * are the ways to start (VaxLink: the substitution patterns).
     */
    cover: z.object({ fields: z.array(Text).optional(), table: Id.optional() }).strict().optional(),
    /**
     * The payload drawer's bar in the workshop's words (VaxLink: "FHIR R4 &
     * WHO GDHCN payload inspector", the trust list's key "DEV Key: 916ffa…
     * (XXR)", "Click to inspect raw FHIR / CBOR payload"). Absent: "FHIR
     * payload inspector", no key, a plain hint.
     */
    inspector: z.object({ title: Text.optional(), key: Text.optional(), hint: Text.optional() }).strict().optional(),
    /** The presenter's note on the overview; a step's note is its `facilitatorCue`. */
    presenterNote: Text.optional(),
    /** A band on the overview naming what the walkthrough demonstrates, with `links`. */
    about: z.object({ title: Text, text: Text.optional() }).strict().optional(),
    /** Links out (the IG, its source, its journeys), drawn in the `about` band; one with `frame` is also on the app bar, under that label. */
    links: z.array(z.object({ label: Text, href: Text, frame: Text.optional() }).strict()).optional(),
    /** The presenter's note on each of the other views; a view without one shows none. */
    notes: z
      .object({ map: Text.optional(), personas: Text.optional(), how: Text.optional(), discuss: Text.optional(), sheets: Text.optional(), demo: Text.optional() })
      .strict()
      .optional(),
    /**
     * The ArchiMate views How it works shows first (the systems, the journeys
     * as use cases), before the views each taught journey names: a model id of
     * the layer's `cat-archimate.config.json` and a view id in it.
     */
    views: z.array(z.object({ model: Text, view: Text, label: Text.optional() }).strict()).optional(),
    /**
     * How it works opens with the architecture panel (JV-13): the countries
     * side by side, one row per layer of a reference architecture, each box a
     * system part, all read from the ArchiMate model `model` of the layer's
     * `cat-archimate.config.json`. Element refs are the model's ids.
     * `root` is the grouping whose child groupings are the rows; each of
     * `countries` a grouping that aggregates a country's systems; `shared` the
     * grouping drawn as the foundation band under both. A part's row and box
     * label come from the reference block its country's instance specializes;
     * its moments from the steps realised by the BPMN of the processes its
     * system serves.
     */
    architecture: z
      .object({
        model: Text,
        root: Text,
        countries: z.array(z.object({ group: Text, label: Text.optional(), code: Text.optional() }).strict()).min(1),
        shared: Text.optional(),
        title: Text.optional(),
        intro: Text.optional(),
        /** Sentences under the foundation band (how trust crosses the border). */
        notes: z.array(Text).optional(),
      })
      .strict()
      .optional(),
    /** The line the Discussion view opens with ("The technology works. What do countries need to agree on to make it real?"). */
    closingQuestion: Text.optional(),
    /**
     * Where the FHIR implementation guide the walkthrough demonstrates is
     * published, so a step's examples, profiles and processes link to their
     * pages. `href` is the IG's base: a URL, or a path from the site's root
     * (`""` when the IG is the site). `example` and `profile` are page
     * patterns under it, with `{type}` and `{id}` filled in (the IG
     * Publisher's own: `{type}-{id}.html`, `StructureDefinition-{id}.html`);
     * `processes` is the page listing the business processes, each under a
     * heading named for its BPMN process.
     */
    ig: z
      .object({ href: z.string(), example: Text.optional(), profile: Text.optional(), processes: Text.optional() })
      .strict()
      .optional(),
    /**
     * The layer's own device demo: an app that shows each moment's screen.
     * The viewer does not draw the screens; its Device Demo view frames the
     * app's own page for each (`href` + `#/demo/<id>` unless `route` says
     * otherwise) and links each screen and the steps it shows both ways.
     * `href` is a URL, or a path from the site's root (`vaxlink/`).
     */
    deviceDemo: z
      .object({
        href: Text,
        /** The app's address for one screen, `{id}` filled in; `#/demo/{id}` when absent. */
        route: Text.optional(),
        label: Text.optional(),
        screens: z
          .array(
            z
              .object({
                id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/),
                title: Text,
                device: z.enum(["phone", "tablet"]).optional(),
                /** The step ids it shows (`J3a`), in the workshop's steps. */
                steps: z.array(Text).min(1),
                /** What to try on it in the room ("Flip the tamper toggle"). */
                try: Text.optional(),
              })
              .strict(),
          )
          .min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type WorkshopPresentation = z.infer<typeof WorkshopPresentationSchema>;

/**
 * The workshop's canvas as data (owner, 2026-11-17): the Country Canvas (a
 * cover and its sheets) described field by field, so the viewer draws it as an
 * on-screen form and writes it back out as an editable, pre-filled PDF, both
 * from the answers kept in the browser. Every field has a stable id; its
 * answer is kept under `<workshop>:cv:<sheet>:<field>[:<row>[:<col>]]`, the
 * same store the journey questions use, and a journey question asking the same
 * thing names the field (`steps[].questions[].canvas`) and shares its key.
 *
 * | type | what it is | kept under |
 * |---|---|---|
 * | `text` | a write-in of `lines` lines (`inline`: its label and one line, side by side) | `…:<field>`, or the key of the field `same` names |
 * | `choice` | one of `options` | `…:<field>` = the option id |
 * | `ticks` | any of `options`; an option with `write` has a write-in beside it ("Other: ___") | `…:<field>:<option>` = "1", its write-in `…:<field>:<option>:text` |
 * | `grid` | `rows` × `columns`, each cell by its column's `cell` (below) | `…:<field>:<row>:<col>` |
 * | `gap` | the gap strip: each of `rows` rated on `options` (the workshop's first assessment scale when absent) | `…:<field>:<row>` = the option id |
 * | `blanks` | a sentence with blanks, each `___` of `text` a write-in ("A child vaccinated in ___ should be able to ___ in ___.") | `…:<field>:<n>`, n from 1, or the keys of the field `same` names |
 * | `note` | words printed on the sheet, no answer (a DISCUSS prompt, a rule, a reminder) | nothing |
 * | `table` | a table printed on the sheet, no answer (the cover's "How the canvas works") | nothing |
 * | `cards` | cards side by side (`columns`) or one per row (`rows`), each a badge, a title, its words and its own fields | each field as on a sheet, under `…:<field>:<card>:<its field>` |
 *
 * A grid column's `cell`: `text` a write-in; `tick` a check box; `label`
 * the row's printed words (`rows[].values`); `choice` one of the column's (or
 * the row's) `options`, kept under `…:<row>:<col>`; `ticks` any of them,
 * under `…:<row>:<col>:<option>`; `option` one radio button, the columns of
 * one `group` making one choice per row, kept under `…:<row>:<group>` = the
 * column id (the gap strip's Blocks us now / Needed in 12 months / Can wait).
 *
 * Words the sheet prints (`intro`, `note`, `table`, a card's) may carry
 * `**bold**` and `*italic*`; nothing else is read as markup.
 *
 * What the printed page shows around the fields is said by the sheet and its
 * sections, so the on-screen form looks like the page: a sheet's `kicker`
 * ("Day 1 · Module 1 · Sheet 1 of 6"), its `header` fields beside the title
 * (Country, Table) and its `footer`; a section's `number` badge, `minutes`,
 * `note` ("write, then circle one rating per touchpoint"), `discuss` and
 * `rules` lines, the `module` it is worked in, its `layout` and `tone`.
 */
const CanvasOptionSchema = z.object({ id: Id, label: Text, write: z.boolean().optional() }).strict();
const CanvasRowSchema = z
  .object({
    id: Id,
    label: Text,
    hint: Text.optional(),
    /** The row's printed words in each `label` column, by column id. */
    values: z.record(z.string(), Text).optional(),
    /** The heading rows printed above this one (a layer of the architecture map). */
    group: z.union([Text, z.array(Text).min(1)]).optional(),
    /** This row's options for a `choice` column, when they are not the column's. */
    options: z.array(CanvasOptionSchema).min(2).optional(),
  })
  .strict();
const CanvasColumnSchema = z
  .object({
    id: Id,
    label: Text,
    cell: z.enum(["text", "tick", "label", "choice", "ticks", "option"]).default("text"),
    /** A `choice` or `ticks` column's options; a `choice` row may give its own. */
    options: z.array(CanvasOptionSchema).min(1).optional(),
    /** The radio group an `option` column belongs to. */
    group: Id.optional(),
    /** How wide the column draws. */
    width: z.enum(["narrow", "wide"]).optional(),
  })
  .strict();
const CanvasFieldBase = { id: Id, label: Text.optional(), hint: Text.optional() };
const CanvasTone = z.enum(["plain", "box", "warm", "cool", "gap"]);
const canvasFieldTypes = [
  z.object({ ...CanvasFieldBase, type: z.literal("text"), lines: z.number().int().min(1).max(12).default(2), inline: z.boolean().optional(), same: Text.optional() }).strict(),
  z.object({ ...CanvasFieldBase, type: z.literal("choice"), options: z.array(CanvasOptionSchema).min(2) }).strict(),
  z.object({ ...CanvasFieldBase, type: z.literal("ticks"), options: z.array(CanvasOptionSchema).min(1) }).strict(),
  z
    .object({
      ...CanvasFieldBase,
      type: z.literal("grid"),
      rows: z.array(CanvasRowSchema).min(1),
      columns: z.array(CanvasColumnSchema).min(1),
      /** The head of the row labels' column ("Capability", "#"). */
      rowHead: Text.optional(),
      /** false: no row-label column (each row's label is only its name in the summary). */
      rowLabels: z.boolean().optional(),
      /** false: no head row (a short list of rows rated Y / P / N). */
      heads: z.boolean().optional(),
    })
    .strict(),
  z.object({ ...CanvasFieldBase, type: z.literal("gap"), rows: z.array(CanvasRowSchema).min(1), options: z.array(CanvasOptionSchema).min(2).optional() }).strict(),
  z.object({ id: Id, label: Text.optional(), hint: Text.optional(), type: z.literal("blanks"), text: Text.regex(/___/, "a blanks field has at least one ___"), same: Text.optional() }).strict(),
  z.object({ id: Id, label: Text.optional(), type: z.literal("note"), text: Text, tone: z.enum(["discuss", "rules", "muted", "plain", "strong"]).optional() }).strict(),
  z.object({ id: Id, label: Text.optional(), type: z.literal("table"), heads: z.array(Text).min(1), rows: z.array(z.array(Text).min(1)).min(1) }).strict(),
] as const;
const CanvasInnerFieldSchema = z.discriminatedUnion("type", [...canvasFieldTypes]);
export type WorkshopCanvasInnerField = z.infer<typeof CanvasInnerFieldSchema>;
const CanvasCardSchema = z
  .object({
    id: Id,
    /** The card's badge ("A", "1", "★"). */
    badge: Text.optional(),
    title: Text,
    text: Text.optional(),
    /** Under the words, in italics ("Must be true: …", "e.g. …"). */
    note: Text.optional(),
    /** A prompt above the card's fields ("DISCUSS: …", "FACILITATOR ASKS: …"), Markdown-light. */
    lead: Text.optional(),
    tone: CanvasTone.optional(),
    fields: z.array(CanvasInnerFieldSchema).optional(),
  })
  .strict();
export const WorkshopCanvasFieldSchema = z.discriminatedUnion("type", [
  ...canvasFieldTypes,
  z
    .object({
      id: Id,
      label: Text.optional(),
      hint: Text.optional(),
      type: z.literal("cards"),
      /** `columns`: side by side (the journey's touchpoints); `rows`: a table, one card per row (the propositions A to C). */
      layout: z.enum(["columns", "rows"]).default("columns"),
      /** An arrow between cards side by side (issuer → credential → verifier). */
      arrows: z.boolean().optional(),
      /** A `rows` table's column heads: badge, title, words, fields (those absent from every card are left out). */
      heads: z.array(Text).optional(),
      items: z.array(CanvasCardSchema).min(1),
    })
    .strict(),
]);
export type WorkshopCanvasField = z.infer<typeof WorkshopCanvasFieldSchema>;

export const WorkshopCanvasSectionSchema = z
  .object({
    id: Id,
    title: Text.optional(),
    /** The section's badge, as printed ("1", "★", "!"). */
    number: Text.optional(),
    minutes: z.number().int().positive().max(240).optional(),
    /** Printed after the minutes ("write, then circle one rating per touchpoint"). */
    note: Text.optional(),
    /** The DISCUSS line under the title, Markdown-light. */
    discuss: Text.optional(),
    /** The RULES line under the title. */
    rules: Text.optional(),
    /** The modules the section is worked in; the sheet's when absent. */
    module: z.array(ModuleId).optional(),
    /** `stack`: one field under another; `columns`: side by side; `aside`: the first field to the left of the rest; `row`: on one line, wrapping. */
    layout: z.enum(["stack", "columns", "aside", "row"]).optional(),
    /** With `columns`: how many fields each column holds, left to right (one field per column when absent). */
    split: z.array(z.number().int().min(1)).min(2).max(4).optional(),
    tone: CanvasTone.optional(),
    fields: z.array(WorkshopCanvasFieldSchema).min(1),
  })
  .strict();
export type WorkshopCanvasSection = z.infer<typeof WorkshopCanvasSectionSchema>;

export const WorkshopCanvasSheetSchema = z
  .object({
    id: Id,
    /** As the room calls it: "Cover", "Sheet 3". */
    label: Text.optional(),
    /** The band above the title, as printed ("Day 1 · Module 1 · Sheet 1 of 6"). */
    kicker: Text.optional(),
    title: Text,
    /** One line under the title: what the sheet is for. Markdown-light. */
    intro: Text.optional(),
    /** Write-ins beside the title (Country, Table); `same` shares one key across the sheets. */
    header: z.array(z.object({ id: Id, label: Text, same: Text.optional() }).strict()).optional(),
    /** The line at the foot of the page. */
    footer: Text.optional(),
    /** The modules the sheet is worked in; with `annex`, whose journey questions are its annex (those not already one of its fields). */
    modules: z.array(ModuleId).optional(),
    sections: z.array(WorkshopCanvasSectionSchema).min(1),
  })
  .strict();
export type WorkshopCanvasSheet = z.infer<typeof WorkshopCanvasSheetSchema>;

export const WorkshopCanvasSchema = z
  .object({
    /** What the canvas is called ("Country Canvas"). */
    title: Text,
    description: Text.optional(),
    /** The paper of the PDF it is written out to; A3 landscape when absent. */
    size: z.enum(["A3", "A4"]).default("A3"),
    /** The words at the top right of every sheet ("DPI-H for Health Workshop" over "Policy-maker track · Day 1 and Day 2"). */
    masthead: z.object({ title: Text, subtitle: Text.optional() }).strict().optional(),
    /** false: a sheet carries only its own fields, no annex of the journey's other questions. */
    annex: z.boolean().optional(),
    /** The cover first, then the sheets, in order. */
    sheets: z.array(WorkshopCanvasSheetSchema).min(1),
  })
  .strict();
export type WorkshopCanvas = z.infer<typeof WorkshopCanvasSchema>;

/** A clock time in a day, `HH:MM`, 24-hour. */
const Clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "a time is HH:MM, 24-hour");

/** A track of the schedule: a column of the calendar. `workshop` names the sibling workshop (same layer) whose modules the track's slots name; absent, this workshop. */
export const WorkshopScheduleTrackSchema = z.object({ id: Id, label: Text, workshop: Id.optional() }).strict();

/**
 * One slot of a day. A `session` sits in one `track`; a `joint` session, a
 * `break` and `logistics` span every track and name none.
 */
export const WorkshopScheduleSlotSchema = z
  .object({
    start: Clock,
    end: Clock,
    kind: z.enum(["session", "joint", "break", "logistics"]),
    track: Id.optional(),
    /** The module the slot teaches, in the track's workshop: the calendar links to its page. */
    module: ModuleId.optional(),
    title: Text,
    /** What sort of session ("Talk", "Lab"). */
    type: Text.optional(),
    /** Who leads it, or what to know (a role, never a name). */
    note: Text.optional(),
    /** The parts of a joint session, in order ("P1.1 Welcome"). */
    sessions: z.array(Text).optional(),
  })
  .strict();
export type WorkshopScheduleSlot = z.infer<typeof WorkshopScheduleSlotSchema>;

/**
 * The days as a calendar: time down the side, a column per track, and joint
 * sessions, breaks and logistics across them all. Data, not markup: the
 * journeys viewer draws it (`scripts/journeys/schedule.ts`). A workshop with
 * none shows the schedule of a sibling workshop that names it as a track's
 * `workshop`, so two tracks of one event share one schedule.
 */
export const WorkshopScheduleSchema = z
  .object({
    title: Text.optional(),
    /** One paragraph above the days, Markdown. */
    intro: Text.optional(),
    tracks: z.array(WorkshopScheduleTrackSchema).min(1),
    days: z
      .array(z.object({ day: z.number().int().min(1), title: Text.optional(), summary: Text.optional(), slots: z.array(WorkshopScheduleSlotSchema).min(1) }).strict())
      .min(1),
  })
  .strict();
export type WorkshopSchedule = z.infer<typeof WorkshopScheduleSchema>;

/** The blanks of a `blanks` field's text, in order. */
export function canvasBlanks(text: string): number {
  return text.split("___").length - 1;
}

/**
 * The keys a canvas field keeps its answer under, after `<workshop>:cv:`:
 * `<sheet>:<field>[:<row>[:<col>]]`. A field with `same` keeps none of its
 * own: it shows the keys of the field it names.
 */
export function canvasFieldRefs(sheet: string, f: WorkshopCanvasField): string[] {
  const at = `${sheet}:${f.id}`;
  switch (f.type) {
    case "text":
      return f.same ? [] : [at];
    case "choice":
      return [at];
    case "ticks":
      return f.options.flatMap((o) => (o.write ? [`${at}:${o.id}`, `${at}:${o.id}:text`] : [`${at}:${o.id}`]));
    case "grid":
      return f.rows.flatMap((r) => {
        const groups = new Set<string>();
        return f.columns.flatMap((c) => {
          if (c.cell === "label") return [];
          if (c.cell === "ticks") return (c.options ?? []).map((o) => `${at}:${r.id}:${c.id}:${o.id}`);
          if (c.cell === "option") {
            const g = c.group ?? c.id;
            if (groups.has(g)) return [];
            groups.add(g);
            return [`${at}:${r.id}:${g}`];
          }
          return [`${at}:${r.id}:${c.id}`];
        });
      });
    case "gap":
      return f.rows.map((r) => `${at}:${r.id}`);
    case "blanks":
      return f.same ? [] : Array.from({ length: canvasBlanks(f.text) }, (_, i) => `${at}:${i + 1}`);
    case "note":
    case "table":
      return [];
    case "cards":
      return f.items.flatMap((c) => (c.fields ?? []).flatMap((x) => canvasFieldRefs(`${at}:${c.id}`, x)));
  }
}

/** Every field of a sheet, a card's fields after its card. */
export function canvasSheetFields(s: WorkshopCanvasSheet): WorkshopCanvasField[] {
  return s.sections.flatMap((x) => x.fields);
}

/** `workshop/0.1.0`, as a node kind. */
export const WorkshopKind = nodeKind(
  WORKSHOP_V01,
  [],
  {
    id: Id,
    title: Text,
    description: Text,
    audience: Text.optional(),
    /** What a participant leaves with, and what they do not. */
    promise: Text.optional(),
    /** A sentence the room completes ("A child vaccinated in ___ should be able to ___ in ___."). */
    useCaseStatement: Text.optional(),
    /** The scenarios it teaches from, in teaching order. */
    scenarios: z.array(Id).min(1),
    modules: z.array(WorkshopModuleSchema).min(1),
    tables: z.array(WorkshopTableSchema).optional(),
    steps: z.array(WorkshopStepSchema).optional(),
    assessment: z
      .object({
        standingLine: Text.optional(),
        scales: z.array(z.object({ id: Id, label: Text, options: z.array(z.object({ id: Id, label: Text }).strict()).min(2) }).strict()).min(1),
      })
      .strict()
      .optional(),
    discussion: z
      .array(z.object({ id: Id, module: ModuleId.optional(), theme: Text, question: Text, steps: z.array(Text).optional() }).strict())
      .optional(),
    sheets: z.array(WorkshopSheetSchema).optional(),
    sheetsSource: WorkshopSheetsSourceSchema.optional(),
    canvas: WorkshopCanvasSchema.optional(),
    matrix: WorkshopMatrixSchema.optional(),
    resources: z.array(WorkshopResourceSchema).optional(),
    presentation: WorkshopPresentationSchema.optional(),
    lab: WorkshopLabSchema.optional(),
    schedule: WorkshopScheduleSchema.optional(),
  },
  { strict: true, refine: (w, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const modules = new Set(w.modules.map((m) => m.id));
    const tables = new Map((w.tables ?? []).map((t) => [t.id, new Set(t.rows.map((r) => r.id))]));
    const sheets = new Set((w.sheets ?? []).map((s) => s.id));
    const dup = (what: string, ids: readonly string[]) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) issue(`${what} id "${id}" appears twice`);
        seen.add(id);
      }
    };
    dup("module", w.modules.map((m) => m.id));
    dup("table", (w.tables ?? []).map((t) => t.id));
    dup("sheet", (w.sheets ?? []).map((s) => s.id));
    dup("resource", (w.resources ?? []).map((r) => r.id));
    dup("step", (w.steps ?? []).map((s) => `${s.scenario}#${s.step}`));
    const mod = (where: string, id: string | undefined) => {
      if (id !== undefined && !modules.has(id)) issue(`${where} names module "${id}", which the workshop does not list`);
    };
    for (const m of w.modules) {
      if (m.sheet !== undefined && !sheets.has(m.sheet)) issue(`module ${m.id} fills sheet "${m.sheet}", which the workshop does not list`);
      for (const t of m.tables ?? []) if (!tables.has(t)) issue(`module ${m.id} names table "${t}", which the workshop does not list`);
    }
    for (const t of w.tables ?? []) mod(`table ${t.id}`, t.module);
    for (const s of w.steps ?? []) {
      for (const q of s.questions ?? []) mod(`step ${s.step}`, q.module);
      for (const tag of s.tags ?? []) {
        const rows = tables.get(tag.table);
        if (rows === undefined) issue(`step ${s.step} tags table "${tag.table}", which the workshop does not list`);
        else if (!rows.has(tag.row)) issue(`step ${s.step} tags row "${tag.row}", which table ${tag.table} does not have`);
      }
    }
    for (const r of w.presentation?.tagRows ?? []) for (const t of r.tables) if (!tables.has(t)) issue(`presentation.tagRows "${r.label}" names table "${t}", which the workshop does not list`);
    const ct = w.presentation?.cover?.table;
    if (ct !== undefined && !tables.has(ct)) issue(`presentation.cover names table "${ct}", which the workshop does not list`);
    for (const d of w.discussion ?? []) mod(`discussion ${d.id}`, d.module);
    for (const s of w.sheets ?? []) for (const m of s.modules) mod(`sheet ${s.id}`, m);
    for (const r of w.resources ?? []) for (const m of r.modules ?? []) mod(`resource ${r.id}`, m);
    if (w.canvas) {
      dup("canvas sheet", w.canvas.sheets.map((s) => s.id));
      const refs = new Set<string>();
      for (const s of w.canvas.sheets) {
        dup(`canvas sheet ${s.id} section`, s.sections.map((x) => x.id));
        dup(`canvas sheet ${s.id} field`, [...(s.header ?? []).map((h) => h.id), ...s.sections.flatMap((x) => x.fields.map((f) => f.id))]);
        for (const m of s.modules ?? []) mod(`canvas sheet ${s.id}`, m);
        for (const x of s.sections) {
          for (const m of x.module ?? []) mod(`canvas sheet ${s.id} section ${x.id}`, m);
          if (x.split && x.split.reduce((n, k) => n + k, 0) !== x.fields.length) issue(`canvas sheet ${s.id} section ${x.id} splits ${x.split.reduce((n, k) => n + k, 0)} fields into columns, but has ${x.fields.length}`);
          if (x.split && x.layout !== "columns") issue(`canvas sheet ${s.id} section ${x.id} has a split, which only a columns layout reads`);
        }
        const check = (at: string, f: WorkshopCanvasField) => {
          if (f.type === "choice" || f.type === "ticks") dup(`canvas field ${at} option`, f.options.map((o) => o.id));
          if (f.type === "grid" || f.type === "gap") dup(`canvas field ${at} row`, f.rows.map((r) => r.id));
          if (f.type === "grid") {
            dup(`canvas field ${at} column`, f.columns.map((c) => c.id));
            for (const c of f.columns) {
              if ((c.cell === "ticks" || c.cell === "choice") && !c.options && !(c.cell === "choice" && f.rows.every((r) => r.options))) issue(`canvas field ${at} column ${c.id} is a ${c.cell} column with no options`);
              if (c.cell === "option" && f.columns.filter((x) => x.cell === "option" && (x.group ?? x.id) === (c.group ?? c.id)).length < 2) issue(`canvas field ${at} column ${c.id} is an option column alone in its group: give two or more the same group`);
            }
          }
          if (f.type === "cards") {
            dup(`canvas field ${at} card`, f.items.map((c) => c.id));
            for (const c of f.items) {
              dup(`canvas field ${at}:${c.id} field`, (c.fields ?? []).map((x) => x.id));
              for (const x of c.fields ?? []) check(`${at}:${c.id}:${x.id}`, x);
            }
          }
          if (f.type === "gap" && !f.options && !w.assessment?.scales.length) issue(`canvas field ${at} is a gap strip with no options, and the workshop has no assessment scale`);
          // A question's write-in may be a text field, or a write-in cell of a grid.
          if (f.type === "text" && !f.same) refs.add(at);
          if (f.type === "grid") for (const r of f.rows) for (const c of f.columns) if (c.cell === "text") refs.add(`${at}:${r.id}:${c.id}`);
        };
        for (const f of s.sections.flatMap((x) => x.fields)) check(`${s.id}:${f.id}`, f);
      }
      // A field that shows another's answer (`same`) names a field of the canvas with as many keys.
      const keyed = new Map<string, WorkshopCanvasField>();
      for (const s of w.canvas.sheets) for (const f of s.sections.flatMap((x) => x.fields)) keyed.set(`${s.id}:${f.id}`, f);
      for (const s of w.canvas.sheets) {
        for (const h of s.header ?? []) if (h.same) {
          const t = keyed.get(h.same);
          if (!t || t.type !== "text" || t.same) issue(`canvas sheet ${s.id} header ${h.id} shows "${h.same}", which is no text field of the canvas`);
        }
        for (const f of s.sections.flatMap((x) => x.fields)) {
          if ((f.type !== "text" && f.type !== "blanks") || !f.same) continue;
          const t = keyed.get(f.same);
          if (!t || t.type !== f.type || ("same" in t && t.same)) issue(`canvas field ${s.id}:${f.id} shows "${f.same}", which is no ${f.type} field of the canvas with keys of its own`);
          else if (f.type === "blanks" && t.type === "blanks" && canvasBlanks(t.text) !== canvasBlanks(f.text)) issue(`canvas field ${s.id}:${f.id} has ${canvasBlanks(f.text)} blanks, but "${f.same}" has ${canvasBlanks(t.text)}`);
        }
      }
      dup("canvas key", w.canvas.sheets.flatMap((s) => s.sections.flatMap((x) => x.fields.flatMap((f) => canvasFieldRefs(s.id, f)))));
      for (const st of w.steps ?? []) for (const q of st.questions ?? []) {
        if (q.canvas !== undefined && !refs.has(q.canvas)) issue(`step ${st.step} question names canvas field "${q.canvas}", which is no write-in of the canvas (a text field, or a grid's write-in cell)`);
      }
    } else {
      for (const st of w.steps ?? []) for (const q of st.questions ?? []) if (q.canvas !== undefined) issue(`step ${st.step} question names canvas field "${q.canvas}", but the workshop has no canvas`);
    }
    for (const s of w.lab?.steps ?? []) for (const c of s.canvas ?? []) if (!w.canvas?.sheets.some((x) => x.id === c)) issue(`lab step ${s.id} shows canvas sheet "${c}", which the workshop's canvas does not have`);
    const src = w.sheetsSource;
    if (src && !src.docx && !src.pdf && !src.previews?.length) issue("sheetsSource names no file: give docx, pdf or previews");
    // A matrix cell or overlap names a step of the workshop: its id, or `<scenario>#<step>`.
    const stepIds = new Set((w.steps ?? []).flatMap((s) => [s.step, `${s.scenario}#${s.step}`]));
    const stepOf = (ref: string) => (w.steps ?? []).find((s) => s.step === ref || `${s.scenario}#${s.step}` === ref);
    const stepRef = (where: string, ref: string) => {
      if (!stepIds.has(ref)) issue(`${where} names step "${ref}", which the workshop does not list`);
    };
    if (w.matrix) {
      const seen = new Set<string>();
      for (const c of w.matrix.cells ?? []) {
        const where = `matrix cell ${c.module} × ${c.step}`;
        mod(where, c.module);
        stepRef(where, c.step);
        const s = stepOf(c.step);
        const key = `${c.module} ${s ? `${s.scenario}#${s.step}` : c.step}`;
        if (seen.has(key)) issue(`${where} appears twice`);
        seen.add(key);
        if (!c.technical && !c.policy) issue(`${where} has no text: give technical or policy`);
        if (s) {
          const asked = (s.questions ?? []).some((q) => q.module === c.module);
          if (asked && c.kind === "draws") issue(`${where} is "draws", but ${c.module} asks a question at ${c.step}; drop the kind`);
          if (!asked && c.kind === undefined) issue(`${where} has no kind, but ${c.module} asks no question at ${c.step}; mark it "draws"`);
        }
      }
      for (const [side, list] of Object.entries(w.matrix.overlaps ?? {})) for (const o of list ?? []) {
        for (const m of o.modules) mod(`matrix overlap "${o.label}" (${side})`, m);
        for (const r of o.steps) stepRef(`matrix overlap "${o.label}" (${side})`, r);
      }
    }
    if (w.schedule) {
      const sc = w.schedule;
      dup("schedule track", sc.tracks.map((t) => t.id));
      dup("schedule day", sc.days.map((d) => String(d.day)));
      const tracks = new Map(sc.tracks.map((t) => [t.id, t]));
      for (const d of sc.days) {
        for (const x of d.slots) {
          const where = `schedule day ${d.day} ${x.start}–${x.end} "${x.title}"`;
          if (x.end <= x.start) issue(`${where} ends before it starts`);
          if (x.kind === "session") {
            const t = x.track === undefined ? undefined : tracks.get(x.track);
            if (x.track === undefined) issue(`${where} is a session in no track`);
            else if (!t) issue(`${where} names track "${x.track}", which the schedule does not list`);
            else if (t.workshop === undefined || t.workshop === w.id) mod(where, x.module);
          } else if (x.track !== undefined) issue(`${where} is a ${x.kind}, which spans every track: drop its track`);
        }
        for (const t of sc.tracks) {
          const own = d.slots.filter((x) => x.track === t.id || x.kind !== "session").sort((a, b) => a.start.localeCompare(b.start));
          for (let i = 1; i < own.length; i++)
            if (own[i]!.start < own[i - 1]!.end) issue(`schedule day ${d.day}: "${own[i]!.title}" (${own[i]!.start}) overlaps "${own[i - 1]!.title}" (until ${own[i - 1]!.end}) in track ${t.id}`);
        }
      }
    }
    if (w.lab) {
      const resources = new Set((w.resources ?? []).map((r) => r.id));
      dup("lab step", w.lab.steps.map((s) => s.id));
      dup("lab use case", (w.lab.useCases ?? []).map((u) => u.id));
      for (const s of w.lab.steps) {
        for (const m of s.modules ?? []) mod(`lab step ${s.id}`, m);
        for (const t of [...(s.rate ?? []), ...(s.holders ?? []), ...(s.pick ?? [])]) if (!tables.has(t)) issue(`lab step ${s.id} names table "${t}", which the workshop does not list`);
        for (const r of s.resources ?? []) if (!resources.has(r)) issue(`lab step ${s.id} names resource "${r}", which the workshop does not list`);
        if (s.rate?.length && !w.lab.scale) issue(`lab step ${s.id} rates tables, but the lab has no scale`);
        if (s.matrix && !(w.steps ?? []).some((x) => x.questions?.length)) issue(`lab step ${s.id} draws the matrix, but no step asks a question`);
        if (s.useCases && !w.lab.useCases?.length) issue(`lab step ${s.id} shows the use cases, but the lab lists none`);
        dup(`lab step ${s.id} field`, (s.fields ?? []).map((f) => f.id));
      }
    }
  } },
);
export const WorkshopSchema = WorkshopKind.schema;
export type Workshop = z.infer<typeof WorkshopSchema>;

/** Parse a workshop; throws with every issue. */
export function parseWorkshop(raw: unknown, where = "workshop"): Workshop {
  const r = WorkshopSchema.safeParse(raw);
  if (!r.success) throw new Error(`${where}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}
