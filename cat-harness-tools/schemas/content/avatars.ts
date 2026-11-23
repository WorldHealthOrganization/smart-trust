/**
 * An avatar for every declared kind — in and out of the trash, in both
 * schemes.
 *
 * ## The glyph is a MASK, not an image or an inline `<svg>`
 *
 * Each avatar is one path, served through `mask-image`, so the colour comes
 * from `background-color` and a scheme swap is a CSS custom property, not a
 * second set of assets. `docs-ui.js` sets `data-fa-kind` and the stylesheet
 * does the rest, so it works with no script.
 *
 * ## The trash state is DERIVED
 *
 * An item in the trash is the same glyph, muted, under the crumple overlay
 * that marks a discard — never a second drawing that could drift. So trash
 * coverage is automatic: the QA axis checks only that every kind has a glyph,
 * and asserts the derivation exists.
 *
 * ## `kind` is open, so there is a fallback and it is reported
 *
 * `BASE_GRAPH_TYPOLOGIES` is an open registry and `fsh-guts` node kinds are open
 * by design. An unknown kind gets {@link GENERIC} and shows up as a QA
 * finding — never as a blank.
 *
 * @module schemas/avatars
 * @graphNode schema
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BLANK_AVATAR } from "../ui/blank-avatar";
import { defaultGraphTypologies } from "../kg/graph-typology-registry";
import { findDeclarationFile, layerRootsIn } from "../kg/instance-roots";

export { BLANK_AVATAR };

/** The platform checkout this module sits in — where layers are scanned from. */
const PLATFORM_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * One avatar.
 *
 * `tone` is a HUE ANGLE, not a colour. The stylesheet builds both schemes
 * from it — a light surface and a dark one — so a kind cannot be legible in
 * one mode and invisible in the other, which is the `y8cm` / `rptk` failure
 * this repo already carries twice.
 */
export interface Avatar {
  /** SVG path data, drawn in a 24×24 box. */
  glyph: string;
  /** Hue angle in degrees, 0–359. */
  tone: number;
  /** Why this mark, for the next person deciding whether to change it. */
  reads: string;
}

/** Drawn in a 24×24 viewBox. Kept simple: these render at 20–28px. */
export const AVATARS: Readonly<Record<string, Avatar>> = {
  // ── The layer identities the owner named ───────────────────────────
  //
  // Owner: *"bootstrap has avatar, so does cat-harness, folio-asst"*.
  //
  // THIS TABLE SERVES TWO KEY SPACES, and the entries below are the second
  // one. `kind-fan` and `gen-avatars-css` key by GRAPH TYPOLOGY; `harness-tiles`
  // calls `avatarFor(decl.name)` — a LAYER's declared name. Most entries
  // are kinds; these three are layers, which is why `check-avatar-coverage`
  // reports them as "an avatar for a kind this instance does not declare" and
  // will go on doing so. That finding is correct about the kind axis and says
  // nothing about the instance axis, which nothing currently checks. Bean
  // `4kj4` is where layer coverage belongs; it is not this table's to
  // assert.
  //
  // THE COMMENT HERE WAS STALE AND COST THE LAYER ITS FACE. It read: *"the
  // split (#223) has not happened, so `bootstrap` and `folio-assist-core`
  // exist as layers in the namespace and as nothing in `harness.json`"*. Both
  // halves were false by 2026-09-21 — `bootstrap/harness.json` and
  // the content core's `harness.json` both exist and both declare a `name`
  // — and the second is not even the name that was adopted. Measured on
  // 2026-09-21: `avatarFor(<the content core's name>)` returned GENERIC, the
  // question mark that means "no avatar is declared for this", while the leaf
  // of paper below sat in the table under a spelling nothing carries. A key
  // nobody can reach is worse than a missing one: the coverage check counted
  // it as declared. Bean `hso8`, whose rename this completes.
  "bootstrap": {
    // A seed with a shoot: the graph an agent reads before it knows anything.
    glyph: "M12 21c0-5 0-7 0-9m0 0c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5z",
    tone: 96,
    reads: "a seed germinating — the first thing, before anything else is known",
  },
  "cat-harness": {
    // Cat ears over a frame. The harness, and the repo's own joke.
    glyph: "M4 9V6l3 2h10l3-2v3m0 0v9H4V9zM8 13h.01M16 13h.01M10 17h4",
    tone: 268,
    reads: "a framed face with ears — the harness the instance is held in",
  },
  "bootstrap-tools": {
    // A trowel — the tool that plants bootstrap's seed.
    glyph: "M12 3v9M8 12h8l-1 5a3 3 0 01-6 0z",
    tone: 96,
    reads: "a trowel, in bootstrap's colour — the code that implements bootstrap's tools",
  },
  // ── The three kinds split out of `cat-harness`, 2026-09-21 ──────────────
  //
  // TONES NEAR THE PARENT'S 268 ON PURPOSE. These are the parts of one graph,
  // and a reader scanning a legend should see them as a family rather than as
  // three unrelated kinds that happen to sit together. Far enough apart to
  // tell the three from each other; close enough that none reads as belonging
  // somewhere else.
  skills: {
    // An open book. A Skill is an instruction body, and nothing else here is.
    glyph: "M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4zm16 0h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z",
    tone: 256,
    reads: "an open book — the instruction an Actor performs a Task from",
  },
  processes: {
    // Two nodes and a gateway between them: the smallest honest BPMN.
    glyph: "M4 12h4m4 0h4m4 0h.01M6 12a2 2 0 11-4 0 2 2 0 014 0zm14 0a2 2 0 11-4 0 2 2 0 014 0zM12 9l3 3-3 3-3-3z",
    tone: 280,
    reads: "two nodes either side of a diamond — a process and the decision in it",
  },
  "business-processes": {
    // A page with a gateway on it: a process written down to be read, not run.
    glyph: "M6 3h9l3 3v15H6zM12 10l3 3-3 3-3-3z",
    tone: 268,
    reads: "a page holding a diamond — a process described as content, never run",
  },
  scenarios: {
    // Two figures. A Role is a part somebody plays, so the glyph is people
    // rather than a document.
    glyph: "M9 11a3 3 0 100-6 3 3 0 000 6zm0 0c-2.5 0-4 1.5-4 4v4h8v-4c0-2.5-1.5-4-4-4zm8-6a2.5 2.5 0 110 5M17 12c2 0 3 1.5 3 3v4h-3",
    tone: 292,
    reads: "two figures — the Actors and the Roles they take on",
  },
  // ── Journeys, 2026-11-05 (owner, option A) ──────────────────────────────
  //
  // Listed in `BASE_GRAPH_TYPOLOGIES`, so their marks are here. A journey sits
  // between a process (280) and the Actors who walk it (292); a workshop is
  // taught from journeys but is its own thing, so it takes a free hue; a
  // building-block catalogue is read beside the ArchiMate model it deploys
  // into, so it is a near neighbour of `archimate` (196).
  "user-scenario": {
    // A winding path from a start point to an arrowhead: a journey, step by step.
    glyph: "M5 19a2 2 0 100-4 2 2 0 000 4zm2-2h5a3 3 0 000-6H9a3 3 0 010-6h8m0 0l-2-2m2 2l-2 2",
    tone: 286,
    reads: "a winding path from a start to an arrow — a journey, told step by step, between the process and the people who walk it",
  },
  workshop: {
    // A board on an easel with lines on it: a room taught from a sheet.
    glyph: "M4 4h16v10H4zM12 14v3M8 21l4-4 4 4M8 8h8M8 11h5",
    tone: 236,
    reads: "a board on an easel — a workshop, its questions for the room written up beside the journey",
  },
  "building-blocks": {
    // Two blocks with a third laid across them: things a journey is built from.
    glyph: "M4 14h7v6H4zM13 14h7v6h-7zM8.5 6h7v6h-7z",
    tone: 192,
    reads: "blocks stacked on blocks, beside ArchiMate's blue — the tools, systems and standards a journey step uses",
  },
  "device-screen": {
    // A phone with a line of text and a tick on its screen: what one person sees.
    glyph: "M7 2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2zM9 7h6M9.5 13l2 2 3.5-3.5M11 19h2",
    tone: 212,
    reads: "a phone with a tick on its screen — what one person sees on their device at a step of the journey",
  },
  policies: {
    // A shield with a tick: what is permitted, and to whom. ODRL policies,
    // issue #1180.
    glyph: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3zm-3.5 9l2.5 2.5 4.5-4.5",
    tone: 304,
    reads: "a shield with a tick — what each Actor is permitted to do",
  },

  // THE ONE RENDERABLE KIND, and the one this whole platform exists for.
  //
  // Registered by `schemas/kg/folio-graph-typology.ts` ON IMPORT rather than sitting
  // in `BASE_GRAPH_TYPOLOGIES`, which is why it was missing from the first draft
  // of this registry and why `check-avatar-coverage` now seeds from the base
  // table explicitly: a check that reads only the live registry reports a
  // clean run whenever the module that registers a kind was not imported.
  folio: {
    glyph: "M4 5h7v14H4zM13 5h7v14h-7zM11 5v14M7 9h1M16 9h1",
    tone: 224,
    reads: "an open folio, two leaves — the authored content itself",
  },

  // ── Stores and graphs ──────────────────────────────────────────────
  beans: {
    glyph: "M9 5c4 0 7 3 7 7s-3 7-7 7c2-3 3-4 3-7s-1-4-3-7z",
    tone: 28,
    reads: "a single bean, kidney-shaped — one item of the work plan",
  },
  "bean-defs": {
    glyph: "M9 5c4 0 7 3 7 7s-3 7-7 7c2-3 3-4 3-7s-1-4-3-7zM4 9h2M4 15h2",
    tone: 28,
    reads: "a bean with margin rules — the definitions rather than the store",
  },
  "workflow-state": {
    glyph: "M5 7h5v5H5zM14 12h5v5h-5zM10 9h4v6",
    tone: 188,
    reads: "two boxes and a flow between them, with a token part-way",
  },
  // THE QUEUE FEEDING A TRAIN. Three queued items on the left converging into
  // one line that carries on right — the queue's whole shape in one glyph: the
  // decisions are per pull request, the train they feed is one. Deliberately
  // NOT a list: a list would read as the store, and what this kind records is
  // an ORDER somebody decided (bean `hfag`).
  // The published site (bean lehh): a globe over a stack of pages. The basic
  // tier is the bare globe; the CDN tier adds an arrow round it, for the
  // redirects and headers a real CDN can apply and Pages cannot.
  "basic-cdn-site": {
    glyph: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3q-4 9 0 18M12 3q4 9 0 18",
    tone: 196,
    reads: "a globe with its meridians: pages served by path to anyone, and nothing more",
  },
  "cdn-site": {
    glyph: "M11 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M3 12h16M11 4q-4 8 0 16M11 4q4 8 0 16M19 4l2 2-2 2M21 6h-4",
    tone: 184,
    reads: "a globe with an arrow at its rim: served by path, and redirected and re-headed on the way",
  },
  // An app a layer carries (web-app kind, owner 2026-11-11, Q-GAME-5): a
  // window of its own with a play mark, since it draws its own frame and
  // runs rather than reads.
  "web-app": {
    glyph: "M3 5h18v14H3zM3 9h18M10 12v5l4.5-2.5z",
    tone: 262,
    reads: "a window of its own with a play mark: an app that draws its own frame and runs when opened",
  },
  "merge-queue": {
    glyph: "M5 7h5M5 12h5M5 17h5M10 7q4 0 4 5M10 17q4 0 4-5M10 12h9",
    tone: 205,
    reads: "three queued items converging into one line — a queue feeding a train",
  },
  // A NOTE pinned to a bean: the bean's outline with a slip beside it, because
  // a note is an addendum to a bean and never a bean of its own (bean `m61r`).
  "bean-notes": {
    glyph: "M8 5c4 0 6 3 6 7s-2 7-6 7c2-3 2-4 2-7s0-4-2-7zM16 8h4v8h-4zM17 11h2M17 13h2",
    tone: 40,
    reads: "a bean with a slip of paper beside it — an addendum, not a second item",
  },
  // NOTES: a folio's derivation notes and scoping docs — declared context an
  // agent reads, never rendered content. A ruled page with a margin line,
  // because a note is something written down to be read again, not a task
  // (`todos`) and not a published page (`docs`).
  notes: {
    glyph: "M6 4h12v16H6zM9 4v16M11 8h5M11 12h5M11 16h3",
    tone: 95,
    reads: "a ruled page with a margin line — context written down to be read again",
  },
  // A SURVEY of a commit window. Two endpoint marks with a span between them,
  // because the two edge commits ARE the artefact: a survey whose window
  // cannot be pinned tells a reader nothing about today (bean `6ptx`).
  "session-survey": {
    glyph: "M5 12h14M5 9v6M19 9v6M9 5h6",
    tone: 168,
    reads: "a span between two marked endpoints — the window a survey covers",
  },
  "sweep-marks": {
    // a clock face with a tick beside it — when a check was last run
    glyph: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4l3 2",
    tone: 48,
    reads: "a clock face — the time a sweep step was last run",
  },
  // THE BOARD AND ITS LAYOUT. Two glyphs because they are two kinds, and the
  // pair says the split: a frame with cards ON it, and the same frame with the
  // cards' POSITIONS marked. A reader who sees them side by side should be
  // able to guess which is the semantic model and which is the interchange.
  boards: {
    // a frame with two cards on it — a diagram OF a folio
    glyph: "M3 5h18v14H3zM7 9h4v6H7zM14 9h3v3h-3z",
    tone: 205,
    reads: "a framed board carrying two cards — a diagram of a folio",
  },
  "board-positions": {
    // the same frame, with crosshairs where the cards go — where, not what
    glyph: "M3 5h18v14H3zM9 12h.01M15 10h.01M9 9v6M15 7v6M6 12h6M12 10h6",
    tone: 205,
    reads: "a board marked with positions — where each note was drawn",
  },
  todos: {
    glyph: "M5 4h11l3 3v13H5zM16 4v3h3M8 12l2 2 4-4",
    tone: 48,
    reads: "a sticky with a tick",
  },
  "todo-items": {
    glyph: "M5 4h11l3 3v13H5zM16 4v3h3M8 11h7M8 15h4",
    tone: 48,
    reads: "a sticky with lines — the items rather than the board",
  },
  "todo-feedback": {
    glyph: "M4 6h16v9H9l-4 4v-4H4zM9 10h6",
    tone: 320,
    reads: "a speech bubble — a remark about the work, not the work",
  },
  attestations: {
    glyph: "M6 3h12v18H6zM9 8h6M9 12h6M10 17l2 2 3-4",
    tone: 28,
    reads: "a signed sheet — a judgement somebody recorded, kept apart from what a script derives",
  },

  "qa-checkers": {
    // A magnifier over a tick: code that judges content against a criterion.
    // Bean riit, step 3b.
    glyph: "M10 4a6 6 0 1 1 0 12a6 6 0 0 1 0-12zM14.5 14.5L20 20M7.5 10l2 2 3.5-3.5",
    tone: 96,
    reads: "a magnifier over a tick — a QA checker, declared by the harness whose code it is",
  },
  "pipeline-plugins": {
    // A plug entering a socket: an implementation filling a generic slot.
    // Bean riit, step 3b.
    glyph: "M4 12h6M10 8h4v8h-4zM14 10h3M14 14h3M17 7v10h3",
    tone: 300,
    reads: "a plug in a socket — a pipeline slot filled by the harness that owns the code",
  },
  "block-kinds": {
    // Three stacked blocks with a tag on the top one: each kind a node,
    // labelled by its prefix. Bean riit, step 2.
    glyph: "M5 15h14v4H5zM5 10h14v4H5zM5 5h9v4H5zM16 5l3 2-3 2",
    tone: 32,
    reads: "stacked blocks, the top one tagged — block kinds, each declared by the harness that owns it",
  },
  "content-adapters": {
    // A book with a bookmark: a vocabulary, the words its blocks are made of.
    // Bean riit, step 5.
    glyph: "M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10M13 4v6l2-1.5 2 1.5V4",
    tone: 44,
    reads: "a book with a bookmark — a content adapter's block vocabulary, declared by the harness that owns it",
  },
  validators: {
    // A check mark inside a shield: code that judges a node, declared as a node.
    // Bean riit.
    glyph: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM8.5 12.5l2.5 2.5 4.5-5M12 3v2",
    tone: 132,
    reads: "a shield with a tick — a validator, declared by the harness whose code it is",
  },
  typologies: {
    // A stack of three cards, the top one tagged: a graph whose nodes are the
    // KINDS of the other graphs. Bean dmx1.
    glyph: "M5 8h12v11H5zM7 5h12v11M9 2h12v11M8 12h6M8 15h4",
    tone: 300,
    reads: "a stack of type cards — the graph typologies a harness declares it owns",
  },
  tools: {
    glyph: "M14 4a4 4 0 00-5 5l-5 5 2 2 5-5a4 4 0 005-5l-2 2-2-2 2-2z",
    tone: 250,
    reads: "a spanner — a Tool definition, the thing that does the work",
  },
  schemas: {
    glyph: "M12 3l8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4",
    tone: 156,
    reads: "stacked layers — a shape things conform to",
  },
  qa: {
    glyph: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6zM9 12l2 2 4-4",
    tone: 140,
    reads: "a shield with a tick — a verdict about an artefact",
  },
  // A fork in a path: two ways onward, one taken. Methodologies are PARALLEL
  // tracks selected by context, so the glyph shows the choice rather than a
  // procedure — a flowchart or a checklist would draw the wrong idea.
  methodology: {
    glyph: "M12 20V12m0 0L6 6m6 6l6-6M4 4h4m8 0h4",
    tone: 268,
    reads: "a fork in a path — parallel ways to a judgement, one chosen by context",
  },
  // A CHIP, because the subject is the machine rather than what it says. The
  // tempting glyph — a speech bubble, a globe — draws LANGUAGE, and this
  // graph is not about language: it is about which languages somebody has
  // checked a given model is good at. A globe here would read as the
  // translation pipeline, which is a different kind two rows down.
  models: {
    glyph: "M8 8h8v8H8zM4 10h4M4 14h4M16 10h4M16 14h4M10 4v4M14 4v4M10 16v4M14 16v4",
    tone: 300,
    reads: "a chip with its pins — the machine an agent is running on, not what it says",
  },
  "external-schema": {
    glyph: "M4 6h7v12H4zM13 6h7v12h-7zM11 9h2M11 12h2M11 15h2",
    tone: 208,
    reads: "two bound volumes with the ties between them — somebody else's specification, pinned to an edition, beside what we do with it",
  },
  // A SEALED ENVELOPE with a pin through its corner: somebody else's
  // declaration, received and kept unopened at the commit it was pinned to.
  // Not `external-schema`'s two volumes — that is a specification we read and
  // apply; this is a snapshot we hold and never edit. `tone: 216` is unused and
  // sits between `external-schema`'s 208 and `uml`'s 220, all three being
  // about the shape of something defined elsewhere.
  "substrate-snapshot": {
    glyph: "M3 7h14v11H3zM3 7l7 6 7-6M17 4l4 4M19 6l-3 3",
    tone: 216,
    reads: "a sealed envelope, pinned — another Knowledge Graph's declaration, kept byte for byte at the commit it was subscribed at",
  },
  // The other half of `subscriptions/` (owner, 2026-10-30, bean `w1gy` finding
  // 1, option C): the subscriber's OWN working state, one home per subscribed
  // harness. A house with an open door, because each harness gets a home here
  // and its processes write into it. `tone: 214` sits beside the snapshot's 216,
  // since the two directories were one before the split.
  "subscribed-harnesses": {
    glyph: "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6",
    tone: 214,
    reads: "a house with its door open — the home each subscribed harness writes its state into",
  },
  // A LIST OF ENTRIES, each a short code tag beside a longer line: a code and
  // what it means, which is the whole of a code list. Deliberately not the
  // glossary's book — a book is looked up; a code list is CHOSEN from, closed,
  // and every entry carries its definition. `tone: 180` is unused and sits
  // between the reference tones and `external-schema`'s 208.
  "code-list": {
    glyph: "M4 6h3v2H4zM9 7h11M4 11h3v2H4zM9 12h11M4 16h3v2H4zM9 17h11",
    tone: 180,
    reads: "a closed list of codes, each beside its meaning — values chosen from, never free text",
  },
  // A CROSSWALK — a column of source rows, lines crossing to a column of
  // target rows. Bean `k74z`: one value carried into several vocabularies.
  // `tone: 120` was unused, and is far from `code-list`'s 180 so the two
  // "tables of codes" kinds are not confused at a glance.
  "vocab-mapping": {
    glyph: "M3 6h4M3 12h4M3 18h4M8 6l8 6M8 12l8-6M8 18h8M17 6h4M17 12h4M17 18h4",
    tone: 120,
    reads: "a crosswalk — source rows on the left, lines crossing to target rows on the right — one value carried into another vocabulary",
  },
  // A CLASS BOX — a title compartment over an attribute compartment, with an
  // association line leaving it. The one glyph that says "a diagram of shapes"
  // rather than any shape in particular. `tone: 220` was unused, and sits beside
  // `external-schema`'s 208 because both are about the shape of things.
  uml: {
    glyph: "M3 4h9v12H3zM3 8h9M12 10h4M16 7h5v6h-5z",
    tone: 220,
    reads: "a class box with an association leaving it — a diagram of what the nodes are, derived and never drawn by hand",
  },
  // The harness's swimlane-role ledger, renamed from `glossary` on 2026-09-23:
  // three lanes with a tag on one, the terms a process's swimlanes define.
  "swimlane-glossary": {
    glyph: "M3 6h18M3 12h18M3 18h18M15 9h5v6h-5z",
    tone: 92,
    reads: "three swimlanes with a tag — the roles a process's lanes define",
  },
  health: {
    glyph: "M3 13h4l2-5 3 10 2-6 2 3h5",
    tone: 4,
    reads: "a trace — the repository's own vital signs, over time",
  },
  // A clipboard with a tick and a cross: a run REPORTING on itself, carrying
  // both outcomes. Deliberately not the `qa` mark and not `health`'s trace —
  // the three are different subjects (an artefact, a repository, an execution)
  // and an avatar that borrowed either would say they are the same question.
  // Angle brackets around a caret: source, as the thing that is written rather
  // than the thing that runs. Deliberately not a terminal prompt or a gear --
  // both read as EXECUTION, and this kind is about code as authored content,
  // which is exactly the distinction `holds: "content"` records.
  code: {
    glyph: "M8 7l-5 5 5 5m8-10l5 5-5 5M13 5l-2 14",
    tone: 268,
    reads: "angle brackets around a slash — source as something written, not something running",
  },
  "qa-report": {
    glyph: "M9 4h6v3H9zM7 6h2m6 0h2a1 1 0 011 1v12a1 1 0 01-1 1H7a1 1 0 01-1-1V7a1 1 0 011-1zm1.5 7l1.5 1.5L13 11m1 5l3 3m0-3l-3 3",
    tone: 168,
    reads: "a clipboard carrying a tick and a cross — one run's own account of what it did, both outcomes on the same sheet",
  },

  "binary-release": {
    // A sealed carton with its strap. Deliberately NOT the `uploads` arrow —
    // that is something arriving, and a release is something that WENT, under
    // a version, whether or not a byte of it was ever fetched here. The mark
    // stands for the record of the carton rather than the carton: the kind
    // holds a digest and a size and never the bytes.
    glyph: "M4 9l8-4 8 4v7l-8 4-8-4zM4 9l8 4m8-4l-8 4m0 0v7M8 7l8 4",
    tone: 24,
    reads: "a sealed carton with its strap — what shipped under a version, recorded by digest and size, never by its bytes",
  },
  "tool-release": {
    // A wrench with a tag tied to it: one tool, labelled with the version and
    // digest it is pinned at. Deliberately NOT `binary-release`'s carton —
    // that is something this repository SHIPPED; this is something it RUNS.
    glyph: "M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4 16.4 7.6 20l6.3-6.3A4.5 4.5 0 0 0 20 9.5l-2.7 2.7-2.8-.7-.7-2.8L16.5 6A4.5 4.5 0 0 0 14.5 4zM4 4h4v4H4zM6 8v3",
    tone: 60,
    reads: "a wrench with a tag tied on — a tool pinned at one version and digest, with the runtime it needs",
  },
  "test-plan": {
    // A checklist of empty boxes: what must be shown, before anybody has run
    // it. Deliberately empty — a plan carries no verdicts, and a ticked box
    // would say it did.
    glyph: "M6 4h12v16H6zM8 8h2v2H8zM12 9h4M8 12h2v2H8zM12 13h4M8 16h2v2H8zM12 17h4",
    tone: 140,
    reads: "a checklist with its boxes empty — what a system must show, before any run",
  },
  "test-report": {
    // The same checklist with its boxes filled in, one ticked and one crossed:
    // the plan's form, completed by a run. Quotes `test-plan`'s glyph on
    // purpose, as `ig-metadata-index` quotes its sibling's.
    glyph: "M6 4h12v16H6zM8 8l1 1 2-2M12 9h4M8 12l2 2m0-2l-2 2M12 13h4M8 16l1 1 2-2M12 17h4",
    tone: 110,
    reads: "the plan's checklist filled in — one run's verdicts against one plan, never a tally across plans",
  },
  "test-data-fixed": {
    // A pinned specimen card with a seal: curated records committed to the
    // repo and reviewed as audit evidence, distinct from `test-data-generated`'s
    // die-and-template recipe.
    glyph: "M5 5h14v14H5zM8 9h8M8 12h5M15 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 3v3",
    tone: 152,
    reads: "a pinned specimen card with a seal — curated, committed fixed test data usable as evidence once reviewed",
  },
  "test-data-generated": {
    // A die beside a template frame: a deterministic recipe (template + params +
    // seed) that synthesises test records at run time and is never stored materialised.
    glyph: "M4 5h9v9H4zM6.5 7.5h.01M10.5 7.5h.01M8.5 9.5h.01M6.5 11.5h.01M10.5 11.5h.01M15 9h5v10h-5zM17 12h1M17 15h1",
    tone: 172,
    reads: "a five-pip die beside a template — a deterministic recipe that synthesises test inputs from template, params and seed",
  },
  "sme-case-verdict": {
    // A clipboard with a stethoscope/magnifying loop and a signed checkmark:
    // an attributable human SME's case or cohort judgement.
    glyph: "M6 4h12v16H6zM9 4V2h6v2M9 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0zM13.5 12l2.5 2.5M9 17l1.5 1.5 3-3",
    tone: 128,
    reads: "a clipboard with a lens and a signed tick — an attributable human SME's verdict on a worked case or indicator cohort",
  },
  library: {
    glyph: "M5 4h4v16H5zM11 4h3v16h-3zM16 5l3 15-2 .4L14 5.4z",
    tone: 36,
    reads: "books on a shelf — what was read, not what was written",
  },
  voices: {
    glyph: "M12 4a3 3 0 013 3v4a3 3 0 01-6 0V7a3 3 0 013-3zM7 11a5 5 0 0010 0M12 16v4",
    tone: 292,
    reads: "a microphone — an editorial voice",
  },
  "voice-vendors": {
    // The `voices` microphone with a small tag hung on it: the same voice,
    // specialised for one vendor. A sub-graph of `voices` (bean rkqp), so it
    // keeps the parent's outline and a nearby tone, as `proposals` does
    // under `docs`.
    glyph: "M10 4a3 3 0 013 3v4a3 3 0 01-6 0V7a3 3 0 013-3zM5 11a5 5 0 0010 0M10 16v4M16 6h5v5h-5zM18.5 8.5h.01",
    tone: 312,
    reads: "a microphone with a tag — an editorial voice specialised for one vendor",
  },
  "document-kinds": {
    // A page outline with ruled sections: a document kind is a STRUCTURE to
    // fill — the headings are fixed, the content is not. Distinct from
    // `docs`, which is written pages; this is the shape a page must take.
    glyph: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4",
    tone: 268,
    reads: "a page outline with its sections ruled in — a structure to fill, not a page written",
  },
  themes: {
    // A paint swatch with a corner turned: a theme is a palette APPLIED to a
    // surface, not a palette on its own. Distinct from `voices`, which is also
    // a derived rule set — a voice governs what is SAID, a theme what it is
    // said ON.
    glyph: "M12 3a9 9 0 000 18h2a2 2 0 002-2 2 2 0 012-2h1a4 4 0 004-4 9 9 0 00-11-10zM8 9h.01M7 13h.01M11 7h.01",
    tone: 204,
    reads: "a paint palette — a surface dressed, not the words on it",
  },
  "translation-sources": {
    glyph: "M4 6h7M7 6v2c0 3-1 5-3 6M6 10c1 3 3 4 5 5M13 19l4-10 4 10M15 16h5",
    tone: 176,
    reads: "a glyph and an A — one language against another",
  },
  docs: {
    // The one renderable kind the harness owns. Distinct from `folio`, which is
    // core's: the difference is the SUBJECT, not the format, so the glyph is a
    // page WITH a magnifier over it — documentation ABOUT something — rather
    // than a plain page, which would read as "any content".
    glyph: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4",
    tone: 212,
    reads: "a page with a folded corner — documentation about the graph itself",
  },
  "auto-docs": {
    // A page of BULLETED ENTRIES, not a page of prose. A sub-graph of `docs`
    // (bean `xsrv`), so it keeps that kind's folded-corner outline — the family
    // resemblance is the point, since these pages ARE docs pages — and then
    // says the one thing that distinguishes it: every line has a marker before
    // it, because an index is a list of other things rather than an argument.
    //
    // Deliberately NOT a gear or a refresh arrow, the obvious glyphs for
    // "generated". Those say how the page was made; the reader of a tile wants
    // to know what it IS. `docs` does not depict a writer either.
    glyph: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h.01M11.5 12h5M9 15h.01M11.5 15h5M9 18h.01M11.5 18h3",
    // 340, and the first choice of 164 was WRONG — found by rendering it beside
    // its siblings rather than by reading the table. 164 is green, and so is
    // `requirements` at 148, with 156 and 168 also taken: two page-shaped
    // glyphs in near-identical greens, told apart only by bullets against
    // ticks, which is not a distinction that survives tile size.
    //
    // 340 is the largest clearance left in the table — 20° from both 320 and
    // 0, where every other gap is 16° or less. Measured over the 45 distinct
    // tones in use, not estimated.
    tone: 340,
    reads: "a page of bulleted entries — an index of what another graph holds",
  },
  proposals: {
    // A lightbulb over a page — an idea argued on paper, not yet agreed.
    // A sub-graph of `docs` (issue #1164), so it shares the page's outline.
    glyph: "M12 3a5 5 0 00-3 9v2h6v-2a5 5 0 00-3-9zM10 17h4M10.5 20h3",
    tone: 38,
    reads: "a lightbulb — an idea being argued, not yet a promise",
  },
  "doc-group": {
    // A folder holding lined pages — one named group of the docs graph's own
    // pages (bean `xka5`). The docs family's tone: its pages ARE docs pages.
    glyph: "M3 6h6l2 2h10v11H3zM7 12h10M7 15h7",
    tone: 212,
    reads: "a folder of pages — one named group of the documentation",
  },
  requirements: {
    // A page with two ticked lines — what was agreed, each line checkable.
    // A proposal is MOVED here when its feature ships (issue #1164).
    glyph: "M6 3h12v18H6zM9 8l1.5 1.5L13 7M9 14l1.5 1.5L13 13M15 8h1M15 14h1",
    tone: 148,
    reads: "a page of ticked lines — what the harness promises, each checkable",
  },
  interaction: {
    // A speech bubble with a tick inside — a preference that has been STATED,
    // so nobody has to ask again. The tick is the point: this file exists so
    // that re-asking is a defect (WCAG 2.2 SC 3.3.7, Redundant Entry), not a
    // courtesy skipped.
    glyph: "M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4a2 2 0 01-1-2zM8.5 10l2 2 4-4",
    tone: 224,
    reads: "a spoken preference, already recorded — do not ask again",
  },
  "merge-reviews": {
    // A magnifier over a check mark: something was READ closely and judged,
    // and the judgement is what the file holds. Not a shield (that would claim
    // the change is safe) and not a gavel (an override is a separate decision
    // by a person with standing, recorded on the finding).
    glyph: "M10 4a6 6 0 104.24 10.24L20 20M7.5 10l2 2 3.5-3.5",
    tone: 4,
    reads: "a close reading of one change, with its verdict",
  },
  "issue-marks": {
    // A bookmark at a place in a list — how far this agent has read, and
    // nothing about what it read. Deliberately not a speech bubble: these
    // files hold an id and two timestamps, never a comment body, and a
    // comment glyph would promise a reader something the store does not have.
    glyph: "M7 4h10v16l-5-4-5 4zM4 8h2M4 12h2",
    tone: 28,
    reads: "a bookmark beside a list — how far an agent has read",
  },
  "session-state": {
    // A marker on a line, with the line continuing past it — where one actor
    // is RIGHT NOW, and still moving. Deliberately not a clock: a session is
    // a position, not a duration. Distinct from `memory`'s knot, which is
    // tied and does not move, and from `workflow-state`, which is one token
    // in one diagram rather than an actor across several.
    glyph: "M3 12h18M14 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0M18 9l3 3-3 3",
    tone: 64,
    reads: "a marker on a continuing line — where an actor is now",
  },
  memory: {
    // A knot tied in a thread — the oldest mnemonic there is, and the right
    // read for a kind that is fixed rather than accumulating: the knot is
    // already tied. Deliberately NOT a brain, which would say "the agent" and
    // this kind is what the agent CARRIES, not the agent.
    glyph: "M4 12h4m8 0h4M9.5 9.5a3 3 0 000 5M14.5 9.5a3 3 0 010 5M9.5 9.5c2 1 3 1 5 0M9.5 14.5c2-1 3-1 5 0",
    tone: 108,
    reads: "a knot in a thread — a fact tied down, read and not rewritten",
  },
  waiver: {
    // A key handed over, not a key held: the bow is drawn toward the reader.
    // Deliberately NOT a lock or a shield, which say "this is guarded" — a
    // waiver is the opposite act, a gate's owner giving the gate away. The
    // short tail says it opens ONE thing: the gate class it names, never
    // everything. Hue sits beside `memory`, because it is declared over the
    // same directory and a reader should see the kinship before the
    // difference.
    glyph: "M14 10a3 3 0 11-6 0 3 3 0 016 0M14 10h7M18 10v3M21 10v2",
    tone: 132,
    reads: "a key passed across — a confirmation given before it was asked for",
  },
  "fsh-guts": {
    // The trashcan itself is a kind. Distinct from the trash STATE below.
    glyph: "M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M11 11v6M14 11v6",
    tone: 16,
    reads: "a bin — the trashcan that is kept, as a kind in its own right",
  },
};

/**
 * What an unknown kind gets.
 *
 * A question mark rather than a blank or a generic dot, because the point is
 * that the viewer does NOT know what this is. A neutral shape would read as
 * a deliberate choice; this reads as a gap, which is what it is.
 */
export const GENERIC: Avatar = {
  glyph: "M9 9a3 3 0 114 3v2m0 3h.01",
  tone: 0,
  reads: "a question mark — no avatar is declared for this kind",
};

/**
 * Build a themed blank mark with the resolved theme tone (hue angle, 0–359).
 */
export function blankAvatar(tone: number = 0): Avatar {
  return {
    glyph: BLANK_AVATAR.glyph,
    tone,
    reads: BLANK_AVATAR.reads,
  };
}

/**
 * The avatar for a kind or a layer, falling back to a themed blank when
 * none is declared.
 */
export function avatarOrBlank(kind: string, themeTone: number = 0): Avatar {
  return hasAvatar(kind) ? avatarFor(kind) : blankAvatar(themeTone);
}

/**
 * A kind DECLARED as a node (bean dmx1) carries its own avatar, so this table
 * is not a second central registry for kinds it does not list.
 */
function declaredAvatar(kind: string): Avatar | undefined {
  return defaultGraphTypologies.get(kind)?.avatar;
}

/**
 * A LAYER that declares its own mark (bean sod4 #4): the `avatar` field of
 * its `<instance>.json`. Eleven layers' marks sat in AVATARS until
 * 2026-10-05; only the two submodules, `bootstrap` and `bootstrap-tools`,
 * remain there, because their declarations live in other repositories and a
 * mark for a layer BELOW this one is a reference in the allowed direction.
 *
 * Read RAW, for the reason `instanceSiteDir` gives: the full declaration
 * reader imports the registry, which imports this file.
 */
let instanceAvatarCache: Map<string, Avatar> | undefined;
function instanceAvatars(): Map<string, Avatar> {
  if (instanceAvatarCache) return instanceAvatarCache;
  const out = new Map<string, Avatar>();
  for (const root of layerRootsIn(PLATFORM_ROOT)) {
    const file = findDeclarationFile(root);
    if (file === undefined) continue;
    try {
      const d = JSON.parse(readFileSync(join(root, file), "utf-8")) as { name?: string; avatar?: Avatar };
      if (d.name && d.avatar) out.set(d.name, d.avatar);
    } catch {
      // an unreadable declaration is `readDeclaration`'s finding, with its own message
    }
  }
  instanceAvatarCache = out;
  return out;
}

/** Has this kind, or this layer, got an avatar of its own? */
export function hasAvatar(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(AVATARS, kind) || declaredAvatar(kind) !== undefined || instanceAvatars().has(kind);
}

/** The avatar for a kind or a layer, falling back to {@link GENERIC}. */
export function avatarFor(kind: string): Avatar {
  return AVATARS[kind] ?? declaredAvatar(kind) ?? instanceAvatars().get(kind) ?? GENERIC;
}

/**
 * Every key that has one: this table's, in declaration order, then the
 * declared kinds', then the declared layers'.
 */
export function avatarKinds(): string[] {
  const listed = Object.keys(AVATARS);
  const kinds = defaultGraphTypologies.names().filter((k) => !listed.includes(k) && declaredAvatar(k) !== undefined);
  const insts = [...instanceAvatars().keys()].filter((k) => !listed.includes(k) && !kinds.includes(k));
  return [...listed, ...kinds, ...insts];
}

/** Every avatar, keyed as {@link avatarKinds} orders them — the table, then declared kinds and layers. */
export function allAvatars(): [string, Avatar][] {
  return avatarKinds().map((k) => [k, avatarFor(k)]);
}

/**
 * The crumple overlay for the trash state — `d1r6`'s discard mark.
 *
 * ONE overlay over every kind, rather than a second drawing per kind. See
 * the module header: a discarded proposal must read as a proposal that was
 * discarded, not as a different object.
 */
export const TRASH_OVERLAY =
  "M6 8l4 4-3 2 5 3M15 9l-2 3 4 1";
