/**
 * The journeys viewer over a fixture checkout of two layers: `lower`, a
 * layer holding journeys of its own, and `top`, which needs it, holds a
 * journey group, a workshop, and declares the visualiser.
 *
 * What is asserted is what the owner asked the viewer to show (2026-11-05):
 * every journey in the checkout, each journey alone, journeys in sub-graphs
 * (per layer, and by `partOf` within one), and the didactic layer on top.
 */
import { WorkshopSchema } from "../../schemas/process/workshop.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";

import { readJourneyCorpus, unescapeXml } from "../journeys/read.ts";
import { checkJourneyRefs } from "../journeys/check.ts";
import { bpmnFigure, orderByFollows, panelHead, renderJourneyPages, stepAnchor, type PageFile, type SiteLinks } from "../journeys/render.ts";
import { PANEL_CSS, PANEL_SCRIPT } from "../lib/task-panel.ts";
import { BARE_VHL, checkDakLinks, DAK_ATTR, pascal, personaArtifact } from "../journeys/dak-links.ts";
import { architecturePanel, journeyFiles, journeysRoute } from "../gen-journeys-viz.ts";
import type { ArchimateModel } from "../../archimate/schemas/archimate.ts";
import {
  chapterRoots,
  countryTones,
  countWord,
  fillPattern,
  fromSite,
  highlightJson,
  kramdownSlug,
  personaText,
  presentationOf,
  questionId,
  rangeLabel,
  rungOf,
  screenHref,
  screensFor,
  shortTitle,
  castOrder,
  mentioned,
  mentionedChips,
  siteRootFrom,
  viewBoxWidth,
} from "../journeys/present.ts";
import { blockUsage, feelingPoints, stepByRef } from "../journeys/present-views.ts";
import { NAVBAR_LINKED } from "../lib/harness-rail.ts";
import { imageSizeOf } from "../journeys/image-size.ts";
import { LANGS_MARK } from "../journeys/locales.ts";
import { NAVBAR_OPT_OUT } from "../viewer-page.ts";
import { clearDeclaredVisualisers, renderedByOf } from "../viewer-declarations.ts";

const REPO = mkdtempSync(join(tmpdir(), "journeys-viz-"));
afterAll(() => rmSync(REPO, { recursive: true, force: true }));

const put = (rel: string, body: string | object): void => {
  mkdirSync(join(REPO, dirname(rel)), { recursive: true });
  writeFileSync(join(REPO, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
};

const step = (id: string, lead: string, extra: object = {}) => ({
  id,
  title: `Step ${id}`,
  lead,
  experiences: [{ actor: lead, doing: `does ${id}`, feeling: "“fine”", emotion: 1 }],
  ...extra,
});

// ── lower: a layer with two chained journeys, actors, stories, a catalogue, a BPMN drawing, a requirement ──
put("lower/lower.json", {
  name: "lower",
  title: "Lower layer",
  repository: "example/lower",
  directories: [
    { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
    { id: "user-scenarios", path: "scenarios/user-scenarios/", graphTypologies: ["user-scenario"] },
    { id: "processes", path: "processes/", graphTypologies: ["processes"] },
    { id: "skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "code-lists", path: "code-lists/", graphTypologies: ["code-list"] },
    // The catalogue beside the ArchiMate model, in a directory declared inside it.
    { id: "archimate", path: "archimate/", graphTypologies: ["archimate"] },
    { id: "building-blocks", path: "archimate/building-blocks/", graphTypologies: ["building-blocks"] },
    { id: "fhir-artifact-index", path: "fhir-artifact-index/", graphTypologies: ["fhir-artifact-index"] },
  ],
});
put("lower/scenarios/actors/ana.json", { id: "ana", title: "Ana (pilgrim)", kind: "person", roles: ["traveller", "pilgrim"], meta: { persona: { name: "Ana", role: "Pilgrim", color: "#123456", needs: ["Her summary abroad"], frustrations: ["Paper gets lost"] } } });
put("lower/scenarios/actors/cleo.json", { id: "cleo", title: "Cleo (baby)", kind: "person", meta: { persona: { name: "Cleo", role: "Baby", icon: "baby" } } });
put("lower/scenarios/actors/ben.json", { id: "ben", title: "Ben (nurse)", kind: "person" });
put("lower/scenarios/stories.json", { name: "lower", stories: [{ id: "pilgrim-1", role: { role: "pilgrim" }, want: "Show my summary abroad", soThat: "I am treated safely" }] });
// A catalogue in a journeys directory is NOT read: the kind is declared, not the folder.
put("lower/scenarios/user-scenarios/stray-blocks.json", {
  $schema: "building-blocks/0.1.0",
  layers: [{ id: "apps", label: "Tools & apps" }],
  blocks: [{ id: "stray", name: "Stray", kind: "tool", layer: "apps", jurisdiction: "International", what: "Not declared." }],
});
put("lower/archimate/building-blocks/blocks.json", {
  $schema: "building-blocks/0.1.0",
  layers: [{ id: "apps", label: "Tools & apps" }],
  blocks: [{ id: "wallet", name: "Health wallet", kind: "tool", layer: "apps", jurisdiction: "International", what: "Holds the summary.", soWhat: "She carries it.", links: [{ label: "Spec", url: "https://example.org/wallet" }] }],
  ideas: [{ id: "carry", title: "Carry it yourself", text: "The record travels with the person.", blocks: ["wallet"] }],
});
// An artifact index with a local copy of one example, as fhir-harness builds it at publish.
put("lower/fhir-artifact-index/index.json", {
  artifacts: [
    { key: "Bundle/ana-ips", title: "Ana's IPS", profiles: ["http://example.org/StructureDefinition/ips-bundle"], materialization: { localPath: "output-ast/Bundle-ana-ips.json" } },
    // The role Ana plays, as the IG defines it: her name links here.
    { key: "ActorDefinition/Demo.Role.Pilgrim", title: "Pilgrim" },
    // The DAK assets step P2 uses: a data set, a decision table, an indicator.
    { key: "StructureDefinition/DdTreatment", title: "DD.P2 Treatment abroad", description: "What the clinic records." },
    { key: "PlanDefinition/DT01", title: "DT.01 Is the summary genuine?" },
    { key: "Measure/IND02", title: "IND.02 Summaries read abroad" },
  ],
});
put("lower/output-ast/Bundle-ana-ips.json", { resourceType: "Bundle", id: "ana-ips", type: "document", total: 1, entry: null });
put("lower/code-lists/trust.json", {
  $schema: "folio-code-list/v1",
  id: "trust",
  title: "Trust",
  description: "How far the record can be trusted.",
  source: { note: "fixture" },
  codes: [
    { code: "paper", label: "On paper", definition: "d" },
    { code: "shared", label: "Shared", definition: "d" },
  ],
});
put("lower/scenarios/user-scenarios/p2.json", {
  $schema: "user-scenario/0.3.0",
  id: "p2-treated",
  title: "P2 — Treated",
  description: "Ana is treated.",
  personas: ["ana", "ben", "cleo"],
  follows: "p1-checked",
  views: [{ model: "ra", view: "v-p2", label: "P2 on the RA" }],
  trustLadder: "trust",
  scene: [{ icon: "hospital", label: "A clinic" }, { icon: "qr", label: "A QR" }],
  references: [{ label: "User scenario in the IG", href: "journeys.html#p2", rel: "scenario" }],
  steps: [
    step("P2", "ben", {
      experiences: [
        { actor: "ben", doing: "reads the summary", emotion: 2 },
        { actor: "ana", doing: "waits", feeling: "“worried”", emotion: -1 },
        { actor: "cleo", doing: "sleeps" },
      ],
      record: { state: "shared", description: "read abroad", heldWhere: "home" },
      stories: ["pilgrim-1", "ghost-story"],
      realisedBy: [{ process: "processes/care.bpmn", tasks: ["Task_Read"] }],
      requirements: ["LOW-REQ-001", "LOW-REQ-404"],
      examples: ["Bundle/ana-ips"],
      // Out of order, one with no rel (its type says decision logic), one the index does not list.
      dak: [{ key: "Measure/IND02", rel: "measures" }, { key: "StructureDefinition/DdTreatment", rel: "data" }, { key: "PlanDefinition/DT01" }, { key: "Measure/IND99", rel: "measures" }],
      uses: [
        { block: "wallet", role: "shows the QR" },
        { block: "nowhere", role: "unknown block" },
      ],
      gaps: ["No transaction for this yet."],
      references: [
        { label: "The walkthrough", href: "vaxlink/", rel: "illustrates" },
        { label: "The spec", href: "https://example.org/spec" },
        { label: "This step", href: "#p2" },
      ],
      handoff: { summary: "The summary goes home", from: "Clinic EMR", to: "ana", offline: false },
      fhirChanges: [{ resource: "Bundle", change: "Read, not stored", why: "It is hers.", profile: "ips-bundle", profileOf: "Intl", examples: ["Bundle/ana-ips"] }],
      illustration: { src: "docs/images/p2.png", alt: "Ben reads the summary on a tablet." },
    }),
  ],
});
put("lower/scenarios/user-scenarios/p1.json", {
  $schema: "user-scenario/0.1.0",
  id: "p1-checked",
  title: "P1 — Checked",
  description: "Ana's health check.",
  personas: ["ana"],
  steps: [step("P1", "ana")],
});
put("lower/processes/care.bpmn", '<definitions><bpmn:process id="P" name="Read the patient&#x27;s summary"><bpmn:task id="Task_Read" name="Read the summary"/><bpmn:task id="Task_Other" name="Other"/></bpmn:process></definitions>');
put("lower/docs/images/p2.png", "\x89PNG fixture");
put(
  "lower/processes/care.svg",
  '<?xml version="1.0"?><!DOCTYPE svg><!-- generated --><svg xmlns="http://www.w3.org/2000/svg"><g class="djs-element djs-shape" data-element-id="Task_Read"><g class="djs-visual"><rect/><text class="djs-label"><tspan>Read the summary</tspan></text></g></g><g class="djs-element djs-shape" data-element-id="Task_Other"><g class="djs-visual"><rect/><text class="djs-label"><tspan>Other</tspan></text></g></g></svg>',
);
put("lower/skills/requirements/low-req-001.json", { id: "req:low-req-001", title: "Read the summary", statements: [{ requirement: "The reader SHALL show the summary." }] });

// ── top: a journey group, a sub-journey, a workshop, and the visualiser ──
put("top/top.json", {
  name: "top",
  title: "Top demonstrator",
  needs: ["lower"],
  directories: [
    { id: "user-scenarios", path: "journeys/", graphTypologies: ["user-scenario"] },
    { id: "workshops", path: "workshops/", graphTypologies: ["workshop"] },
  ],
  visualisers: [{ id: "journeys", renderedBy: "journeys-viewer", coversKinds: ["user-scenario", "workshop"], subgraphs: "instance" }],
});
put("top/journeys/group.json", { $schema: "user-scenario/0.2.0", id: "t-group", title: "T — The whole trip", description: "Groups the trip.", personas: ["ana"], steps: [] });
put("top/journeys/t2.json", { $schema: "user-scenario/0.2.0", id: "t2-home", title: "T2 — Home", description: "Back home.", personas: ["ana"], partOf: "t-group", follows: "t1-away", steps: [step("T2", "ana")] });
// The pilgrimage's P3 brief, with a fictional cast (image prompts, owner via the parallel session, 2026-11-05).
put("top/journeys/t1.json", {
  $schema: "user-scenario/0.2.0",
  id: "t1-away",
  title: "T1 — Away",
  description: "Away.",
  personas: ["ana"],
  partOf: "t-group",
  illustrationStyle: {
    prompt: "Warm, flat digital illustration with soft shading and clean outlines. Wide banner, 11:4. No readable text, no logos. All people are fictional.",
    cast: [{ actor: "ana", description: "Pilgrim, 61, slim, short grey hair, white ihram." }],
    notes: ["Keep medical signs text-free."],
  },
  steps: [
    step("T1", "ana", {
      title: "Taken ill in Mina",
      illustration: {
        alt: "Ana, dizzy in the midday heat, is helped toward a health facility.",
        prompt: "The white tent city of Mina at midday; Ana, in white ihram, looks dizzy and is helped toward a plain white health facility with no text on its sign.",
      },
    }),
  ],
});
put("top/journeys/broken.json", { $schema: "user-scenario/0.2.0", id: "broken", title: "Broken", description: "d", personas: ["ana"], steps: [step("B1", "zed")] });
put("top/workshops/policy.json", {
  $schema: "workshop/0.1.0",
  id: "policy",
  title: "Policy track",
  description: "Taught from the pilgrim's journey.",
  scenarios: ["p1-checked", "p2-treated"],
  modules: [
    { id: "M1", title: "Capabilities", carries: "What had to exist?", sheet: "s1", objectives: ["Name the capabilities"] },
    { id: "M2", title: "Rights", tables: ["rights"] },
  ],
  tables: [{ id: "rights", title: "Decision rights", rows: [{ id: "anchor", label: "Trust anchor", question: "Who signs?" }] }],
  steps: [
    {
      scenario: "p2-treated",
      step: "P2",
      askTheRoom: "Should the family be told?",
      questions: [{ id: "trust", module: "M1", text: "What must be true for Ben to trust it?" }, { module: "M2", text: "Who decides?" }],
      capabilities: [{ id: "viewer", label: "A viewer" }],
      tags: [{ table: "rights", row: "anchor", why: "a signature crosses" }],
    },
    { scenario: "p1-checked", step: "P1", questions: [{ module: "M1", text: "Where does it break?" }] },
  ],
  assessment: { scales: [{ id: "status", label: "Where we stand", options: [{ id: "yes", label: "Exists" }, { id: "no", label: "Absent" }] }] },
  sheets: [{ id: "s1", label: "Sheet 1", title: "Our journey", modules: ["M1"], assessmentStrip: true }],
  resources: [{ id: "card", title: "Facilitator card", kind: "job-aid", body: "1. Ask.", steps: ["p2-treated#P2"], modules: ["M1"] }],
  presentation: {
    ig: { href: "", processes: "business-processes.html" },
    closingQuestion: "What must countries agree on?",
    notes: { map: "Read across, then down." },
    deviceDemo: { href: "app/", screens: [{ id: "S2", title: "The nurse's tablet", device: "tablet", steps: ["P2"], try: "Flip the toggle" }] },
    name: "PilgrimLink",
    badge: "Interactive Spec",
    occasion: "Fixture vignette",
    scope: "here ⇄ there",
    story: "Ana is checked at home and treated abroad.",
    recordOf: "ana",
    presenterNote: "Lead with people.",
    about: { title: "This walkthrough is the demo of an IG" },
    links: [
      { label: "The IG", href: "https://example.org/ig/", frame: "FHIR IG" },
      { label: "Journeys", href: "https://example.org/ig/journeys.html" },
    ],
  },
});
clearDeclaredVisualisers();

const TOP = join(REPO, "top");
const corpus = readJourneyCorpus(TOP);
/**
 * Where the site puts a step's page and an ArchiMate view, as the generator
 * would say (`siteLinks`): site-relative, so a link must climb from the
 * page's own depth to reach them.
 */
const LINKS: SiteLinks = {
  route: "en/top/journeys",
  title: "Top demonstrator",
  stepPage: (instance, bpmn, process, task) => `kg/${instance}/${bpmn.replace(/\.bpmn$/, "")}/${process}/node/${task}/`,
  archimateView: (instance, model, view) => ({
    svg: `archimate/${model}/views/${view}.svg`,
    page: `en/${instance}/archimate/${model}/views/${view}/`,
    name: "P2 view",
    elements: [{ name: "Wallet app", type: "Application Component", page: `en/${instance}/archimate/${model}/element/wallet-app/` }],
  }),
  archimateBlock: (instance, block) => (block === "wallet" ? [{ name: "Wallet app", type: "Application Component", page: `en/${instance}/archimate/ra/element/wallet-app/` }] : []),
  processPanel: (_instance, bpmn) => `en/kg/processes/${posix.basename(bpmn, ".bpmn")}.tasks.json`,
};
const files = renderJourneyPages(corpus, LINKS, "top");
const at = (path: string): string => {
  const f = files.find((x: PageFile) => x.path === path);
  if (!f) throw new Error(`no page ${path}; have ${files.map((x) => x.path).join(", ")}`);
  return String(f.content);
};

// The browser keys of the workshop's three questions: by journey, step and the question's id (or its text), never its position.
const Q_TRUST = "policy:q:p2-treated:P2:trust";
const Q_DECIDES = `policy:q:p2-treated:P2:${questionId({ text: "Who decides?" })}`;
const Q_BREAKS = `policy:q:p1-checked:P1:${questionId({ text: "Where does it break?" })}`;

describe("the reader finds every journey the checkout's declarations hold", () => {
  test("both instances' journeys and workshops, by kind, each parsed", () => {
    expect(corpus.journeys.map((j) => `${j.instance}:${j.scenario.id}`).sort()).toEqual(
      ["lower:p1-checked", "lower:p2-treated", "top:t-group", "top:t1-away", "top:t2-home"].sort(),
    );
    expect(corpus.workshops.map((w) => w.workshop.id)).toEqual(["policy"]);
  });

  test("a file that does not parse is a finding with its reason, not a silent skip", () => {
    expect(corpus.problems.map((p) => `${p.instance}:${p.file}`)).toEqual(["top:journeys/broken.json"]);
    expect(corpus.problems[0]!.message).toContain('"zed"');
  });

  test("the edges' targets: actors, stories, blocks, ladders, requirements", () => {
    expect(corpus.actors.get("lower")?.get("ana")?.persona?.name).toBe("Ana");
    expect(corpus.stories.get("lower")?.has("pilgrim-1")).toBe(true);
    expect(corpus.blocks.get("lower")?.blocks.has("wallet")).toBe(true);
    // Only a directory declaring `building-blocks` is read for a catalogue.
    expect(corpus.blocks.get("lower")?.blocks.has("stray")).toBe(false);
    expect(corpus.ladders.get("lower")?.get("trust")?.map((c) => c.code)).toEqual(["paper", "shared"]);
    expect(corpus.requirements.get("LOW-REQ-001")?.title).toBe("Read the summary");
  });
});

describe("the declared route", () => {
  test("is the instance's visualiser renderedBy journeys-viewer, under the locale", () => {
    expect(journeysRoute(TOP)).toBe("en/top/journeys");
    expect(journeysRoute(join(REPO, "lower"))).toBeUndefined();
    expect(journeyFiles(join(REPO, "lower"))).toBeUndefined();
    expect(journeyFiles(TOP)!.files.every((f) => f.path.startsWith("en/top/journeys/"))).toBe(true);
  });
});

describe("the index: all journeys, by instance, by partOf, along follows", () => {
  const index = at("index.html");
  test("names every instance's journeys, the declaring instance first", () => {
    expect(index.indexOf('id="top"')).toBeLessThan(index.indexOf('id="lower"'));
    for (const t of ["P1 — Checked", "P2 — Treated", "T — The whole trip", "T1 — Away", "T2 — Home"]) expect(index).toContain(t);
  });
  test("a sub-journey sits inside its parent, and siblings follow their chain", () => {
    const group = index.slice(index.indexOf("T — The whole trip"));
    expect(group).toContain('class="jv-tree jv-tree-sub"');
    expect(group.indexOf("T1 — Away")).toBeLessThan(group.indexOf("T2 — Home"));
    expect(index.indexOf("P1 — Checked")).toBeLessThan(index.indexOf("P2 — Treated"));
  });
  test("each instance is a sub-graph page", () => {
    expect(at("lower/index.html")).toContain("Lower layer");
    expect(at("top/index.html")).toContain("journeys/broken.json");
  });
  test("every page says which Tool drew it", () => {
    for (const f of files.filter((x) => x.path.endsWith(".html"))) expect(renderedByOf(String(f.content))).toBe("journeys-viewer");
  });
});

describe("a journey page", () => {
  const p2 = at("lower/p2-treated/index.html");
  test("a lane per person present, and the feeling curve", () => {
    expect(p2).toContain('class="jv-row jv-lane"');
    expect((p2.match(/class="jv-curve"/g) ?? []).length).toBe(2);
    expect(p2).toContain("--c:#123456");
  });
  test("each step: its anchor, its trust state from the ladder, gaps", () => {
    expect(p2).toContain(`id="${stepAnchor("P2")}"`);
    expect(p2).toContain("<b>Shared</b>");
    expect(p2).toContain("No transaction for this yet.");
  });
  test("the BPMN drawing, inlined in the common block, with the step's flow nodes named for the task panel to highlight", () => {
    expect(p2).toMatch(/<figure class="bpmn-figure pt-diagram jv-bpmn" id="jv-fig-\d+" data-panel="[^"]+" data-pt-highlight="Task_Read">/);
    expect(p2).not.toContain("data-jv-hl");
    expect(p2).not.toContain("<?xml");
    // The scroll box takes keyboard focus; the client and its styles are the common ones.
    expect(p2).toContain('<div class="jv-bpmn-scroll" tabindex="0" role="group"');
    expect(p2).toContain('<link rel="stylesheet" href="../../assets/task-panel.css">');
    expect(p2).toContain('<script src="../../assets/task-panel.js" defer></script>');
  });
  test("stories, requirements, examples and blocks resolve, and what does not is drawn as unresolved", () => {
    // A story reads "I want to <want>": the want is a verb phrase (user-story.ts).
    expect(p2).toContain("I want to show my summary abroad, so that I am treated safely.");
    expect(p2).toContain("https://github.com/example/lower/blob/HEAD/skills/requirements/low-req-001.json");
    expect(p2).toMatch(/jv-unresolved"><span class="jv-code">ghost-story/);
    expect(p2).toMatch(/LOW-REQ-404<\/span> no <code>req:<\/code> node/);
    expect(p2).toContain("Health wallet");
    expect(p2).toContain("not in a catalogue");
    // The example the artifact index lists resolves to its IG page, not a bare code.
    const examples = /<ul class="jv-examples">([\s\S]*?)<\/ul>/.exec(p2)?.[1];
    expect(examples).toBe('<li><a href="../../../../../Bundle-ana-ips.html" class="jv-code" data-jv-dak>Bundle/ana-ips</a></li>');
  });
  test("the workshop layer of another instance shows under the step it names", () => {
    expect(p2).toContain("Should the family be told?");
    expect(p2).toContain('href="../../top/workshops/policy/m1/"');
    expect(p2).toContain('data-jv-store');
    expect(p2).toContain("a signature crosses");
  });
  test("a reference's href resolves from the site's root, as the workshop pages resolve it", () => {
    // The journey page sits at <route>/<instance>/<id>/: two up to the route root, three more out of `en/top/journeys`.
    const toSite = "../../../../../";
    expect(p2).toContain(`href="${toSite}journeys.html#p2">User scenario in the IG</a>`);
    expect(p2).toContain(`href="${toSite}vaxlink/">The walkthrough</a>`);
    expect(p2).toContain('href="https://example.org/spec">The spec</a>');
    expect(p2).toContain('href="#p2">This step</a>');
    expect(p2).not.toContain('href="journeys.html#p2"');
    expect(p2).not.toContain('href="vaxlink/"');
  });
  test("the journey page and the workshop pages reach the same file for one relative href", () => {
    const fromJourney = posix.join("en/top/journeys/lower/p2-treated/", "../../../../../journeys.html");
    const ws = at("top/workshops/policy/walkthrough/P2/index.html");
    const href = /href="([^"]*journeys\.html)#p2"/.exec(ws)?.[1];
    expect(href).toBeDefined();
    expect(posix.join("en/top/journeys/top/workshops/policy/walkthrough/P2/", href!)).toBe(fromJourney);
  });
  test("follows and partOf are links", () => {
    expect(p2).toContain('href="../../lower/p1-checked/" rel="prev"');
    expect(at("top/t1-away/index.html")).toContain('href="../../top/t-group/" rel="up"');
  });
});

describe("illustrations: the picture carries no text, the page does", () => {
  test("a resolved src is copied beside the page, with the step title above and the alt below as page text", () => {
    const p2 = at("lower/p2-treated/index.html");
    const fig = p2.slice(p2.indexOf('<figure class="jv-illus">'));
    expect(fig).toContain(`<img src="img/${stepAnchor("P2")}.png" alt="Ben reads the summary on a tablet."`);
    expect(fig.indexOf("Step P2")).toBeLessThan(fig.indexOf("<img"));
    expect(fig.indexOf("<figcaption>")).toBeGreaterThan(fig.indexOf("<img"));
    const img = files.find((f) => f.path === `lower/p2-treated/img/${stepAnchor("P2")}.png`);
    expect(img && String(img.content)).toContain("PNG fixture");
  });
  test("without a picture, the journey page carries the brief: style, cast and the step's prompt", () => {
    const t1 = at("top/t1-away/index.html");
    expect(t1).toContain('<details class="jv-brief"><summary>Illustration brief');
    expect(t1).toContain("The white tent city of Mina at midday");
    expect(t1).toContain("Warm, flat digital illustration");
    expect(t1).toContain("Pilgrim, 61, slim");
    expect(t1).toContain("Keep medical signs text-free.");
    expect(t1).not.toContain('class="jv-illus"');
  });
});

describe("the workshop layer", () => {
  test("a module page lists its questions along the journey, linking each step", () => {
    const m1 = at("top/workshops/policy/m1/index.html");
    expect(m1.indexOf("Where does it break?")).toBeLessThan(m1.indexOf("What must be true for Ben to trust it?"));
    expect(m1).toContain(`href="../../../../lower/p2-treated/#${stepAnchor("P2")}"`);
    expect(m1).toContain("Name the capabilities");
    expect(m1).toContain("Facilitator card");
  });
  test("a module's tables are drawn on its page", () => {
    expect(at("top/workshops/policy/m2/index.html")).toContain("Trust anchor");
  });
  test("the Table sheets panel carries the cover and one sheet per declared sheet, with its assessment strip", () => {
    const sheets = at("top/workshops/policy/discuss/index.html");
    expect((sheets.match(/class="jv-sheet /g) ?? []).length).toBe(2);
    expect((sheets.match(/class="jv-sheet [^"]*jv-cover"/g) ?? []).length).toBe(1);
    expect(sheets).toContain('class="jv-strip"');
    expect(sheets).toContain("A viewer");
  });
});

describe("the presentation pages: a workshop told in a room, with no site chrome", () => {
  const base = "top/workshops/policy";
  const overview = at(`${base}/overview/index.html`);
  const p1 = at(`${base}/walkthrough/P1/index.html`);
  const p2 = at(`${base}/walkthrough/P2/index.html`);
  test("an overview and one page per step, in the workshop's teaching order", () => {
    expect(files.filter((f) => f.path.startsWith(`${base}/walkthrough/`)).map((f) => f.path)).toEqual([`${base}/walkthrough/P1/index.html`, `${base}/walkthrough/P2/index.html`]);
    expect(files.some((f) => f.path === "assets/present.css")).toBe(true);
    expect(files.some((f) => f.path === "assets/present.js")).toBe(true);
  });
  test("they decline the harness rail and draw their own frame from the workshop's presentation", () => {
    for (const page of [overview, p1, p2]) {
      expect(page).toContain(NAVBAR_OPT_OUT);
      expect(page).not.toContain(NAVBAR_LINKED);
      expect(page).toContain('<span class="jp-name">PilgrimLink</span>');
      expect(page).toContain("P1 → P2 (here ⇄ there)");
      expect(renderedByOf(page)).toBe("journeys-viewer");
    }
    expect(overview).toContain('href="https://example.org/ig/" target="_blank" rel="noopener noreferrer"><svg');
    expect(overview).toContain("<span>FHIR IG</span>");
  });
  test("the overview: the story, a card per chapter opening its first step, the cast, the ladder", () => {
    expect(overview).toContain("Ana is checked at home and treated abroad.");
    expect(overview).toContain("Two moments that matter");
    expect(overview).toContain('<a class="jp-card jp-moment" href="../walkthrough/P1/">');
    expect(overview).toContain('<span class="jp-moment-title">Checked</span>');
    expect(overview).toContain("Appears in 2 of 2 steps");
    expect(overview).toContain('<a href="../walkthrough/P2/">P2</a>');
    expect(overview).toContain("Lead with people.");
    // The ladder: one rung per code of the journey's trust ladder, in order,
    // and the step whose record reaches a rung links from it.
    const ladder = /<ol class="jp-rungs">([\s\S]*?)<\/ol>/.exec(overview)?.[1];
    expect(ladder).toBeDefined();
    expect([...ladder!.matchAll(/<b>([^<]+)<\/b>/g)].map((m) => m[1])).toEqual(["On paper", "Shared"]);
    expect(ladder).toMatch(/<b>Shared<\/b>[\s\S]*<a href="\.\.\/walkthrough\/P2\/">P2<\/a><\/li>$/);
  });
  test("a step: prev and next for the keys, the last one going on to the discussion", () => {
    expect(p1).toContain('<link rel="prev" href="../../overview/"><link rel="next" href="../P2/">');
    expect(p2).toContain('<link rel="prev" href="../P1/">');
    expect(p2).toContain("<span>Discuss</span>");
  });
  test("a step: its record on the ladder, whose record it is, and that it moved up", () => {
    expect(p2).toContain("Ana’s record");
    expect(p2).toContain('<div class="jp-state">Shared</div>');
    expect(p2).toContain("▲ Moved up");
  });
  test("a step: the room's question, the questions by module, the tables it touches, the gap strip", () => {
    expect(p2).toContain("Should the family be told?");
    expect(p2).toContain('<a class="jp-mod" href="../../m1/"');
    expect(p2).toContain("Trust anchor ★");
    expect(p2).toContain("— a signature crosses");
    expect(p2).toContain('name="policy:viewer:status"');
    // Owner, 2026-11-17: the room's question is the presenter's; the policy questions are full width, below the moment's two columns.
    expect(p2).toContain('<section class="jp-ask jp-presenter-only">');
    const lens = p2.indexOf('<div class="jp-lens jp-noprint"');
    const policyAt = p2.indexOf('<section class="jp-card jp-pad jp-tone-indigo jp-policy">');
    expect(lens).toBeGreaterThan(p2.indexOf('<div class="jp-walk-r">'));
    expect(p2.slice(p2.indexOf('<div class="jp-walk-r">'), lens)).toMatch(/<\/div>\n<\/div>\n$/);
    expect(policyAt).toBeGreaterThan(lens);
    expect(policyAt).toBeLessThan(p2.indexOf('id="hood"'));
  });
  test("a journey page leaves the language picker to the site's chrome; only the presentation frame, outside it, draws its own (owner, 2026-11-17)", () => {
    const journey = files.find((f) => f.path.endsWith("/p2-treated/index.html"))!;
    expect(String(journey.content)).not.toContain(LANGS_MARK);
    expect(String(journey.content)).toContain(NAVBAR_LINKED);
    for (const f of files.filter((x) => x.path.endsWith(".html") && !x.path.includes("/workshops/"))) expect(String(f.content)).not.toContain(LANGS_MARK);
    expect(p2).toContain(`<div class="jp-top-r">${LANGS_MARK}`);
    // It asks the site's chrome to leave out the guide's version banner ("This page is part of …").
    expect(String(journey.content)).toContain('<meta name="ig-version-banner" content="none">');
  });
  test("presenter mode is off until the presenter turns it on, and under the hood starts hidden (owner, 2026-11-17)", () => {
    expect(p2).toContain('<html lang="en" data-presenter="off">');
    expect(p2).toContain('if(localStorage.getItem("jp:presenter")==="on")');
    expect(p2).toContain('<section class="jp-hood" id="hood" role="tabpanel" aria-labelledby="lens-technical" data-jp-hood hidden>');
    expect(at("assets/present.js")).toContain('if (store("jp:hood") === "on") setHood(true);');
    // The journey page's under the hood is folded too.
    expect(files.some((f) => /<details class="jv-col jv-hood"><summary class="jv-hood-h">Under the hood<\/summary>/.test(String(f.content)))).toBe(true);
  });
  test("below the journey, a toggle between the policy view and the technical one; policy first (owner, 2026-11-17)", () => {
    expect(p2).toContain('<div class="jp-lens jp-noprint" role="tablist" aria-label="Below the journey">');
    expect(p2).toMatch(/<button type="button" role="tab" id="lens-policy" class="is-on" data-jp-lens="policy" aria-controls="policy" aria-selected="true">[\s\S]*?Policy view<\/span><\/button>/);
    expect(p2).toMatch(/<button type="button" role="tab" id="lens-technical" data-jp-lens="technical" aria-controls="hood" aria-selected="false">[\s\S]*?Technical view<\/span><\/button>/);
    // The policy pane is shown, the technical one hidden, until the toggle (or a browser's last choice) says otherwise.
    expect(p2).toMatch(/<div class="jp-lens-pane" id="policy" role="tabpanel" aria-labelledby="lens-policy" data-jp-policy><section class="jp-card jp-pad jp-tone-indigo jp-policy">/);
    expect(p2).not.toContain("data-jp-hood-toggle");
    const js = at("assets/present.js");
    expect(js).toContain('setHood(b.getAttribute("data-jp-lens") === "technical")');
    expect(js).toContain("if (policy) policy.hidden = show;");
    // The full-width questions keep their two columns inside the pane.
    expect(at("assets/present.css")).toContain(".jp-walk ~ .jp-lens-pane > .jp-policy .jp-qs");
  });
  test("a step: the people, each with the avatar in the card's header (never inside a sentence), and under the hood", () => {
    expect(p2).toContain('class="jp-who" style="--c:#123456"');
    expect(p2).toContain('<span class="jp-named">Ben (nurse)</span>: reads the summary');
    expect(p2).not.toMatch(/<span class="jp-named">[^<]*<span class="jp-av/);
    expect(p2).toContain('<b>Health wallet</b><span>shows the QR</span>');
    expect(p2).toContain('data-pt-highlight="Task_Read"');
    expect(p2).toContain('data-jp-hood');
  });
  test("the workshop page links to the presentation, and its discussion has an anchor", () => {
    expect(at(`${base}/index.html`)).toContain('href="overview/"');
    // The fixture's workshop declares no closing discussion, so the anchor is
    // asserted on the same workshop with one.
    const w0 = corpus.workshops[0]!;
    const ws = { ...w0.workshop, discussion: [{ id: "q1", theme: "Trust", question: "Where does trust begin?", steps: ["p2-treated#P2"] }] };
    const out = renderJourneyPages({ ...corpus, workshops: [{ ...w0, workshop: ws }] }, LINKS, "top");
    const page = String(out.find((f) => f.path === `${base}/index.html`)!.content);
    expect(page).toContain('href="overview/"');
    expect(page).toContain('<section id="discussion"><h2>Closing discussion</h2>');
    expect(page.slice(page.indexOf('id="discussion"'))).toContain("Where does trust begin?");
    expect(at(`${base}/index.html`)).not.toContain('id="discussion"');
  });
});

describe("the presentation views: map, persona lens, how it works, discussion, sheets, device demo", () => {
  const base = "top/workshops/policy";
  const how = at(`${base}/how/index.html`);
  const wallet = at(`${base}/how/wallet/index.html`);
  const discuss = at(`${base}/discuss/index.html`);
  const p2 = at(`${base}/walkthrough/P2/index.html`);
  test("every view has a page, in the frame, and the tabs link them", () => {
    for (const path of ["personas", "personas/ana", "personas/cleo", "how", "how/wallet", "discuss", "demo", "demo/S2"]) {
      const page = at(`${base}/${path}/index.html`);
      expect(page).toContain(NAVBAR_OPT_OUT);
      expect(page).toContain('<span class="jp-name">PilgrimLink</span>');
    }
    expect(p2).not.toContain('href="../../map/"');
    expect(p2).toContain('href="../../personas/"');
    expect(p2).toContain('href="../../how/"');
    expect(p2).toContain('href="../../discuss/"');
    expect(p2).not.toContain("jp-tab-off");
  });
  test("the journey map is folded into How it works: its tab is gone, map/ redirects, and its hand-offs are How it works' Data on the move (owner, 2026-11-17)", () => {
    for (const page of [p2, how, discuss, at(`${base}/overview/index.html`)]) {
      expect(page).not.toContain("<b>Journey map</b>");
      expect(page).not.toMatch(/href="(\.\.\/)*map\/"/);
    }
    expect(at(`${base}/overview/index.html`)).toContain('<a class="jp-cta jp-cta-2" href="../how/">See how it works');
    const old = at(`${base}/map/index.html`);
    expect(old).toContain('<meta http-equiv="refresh" content="0; url=../how/">');
    expect(old).toContain('location.replace("../how/" + location.search)');
    expect(old).not.toContain("data-jp-map");
    expect(renderedByOf(old)).toBe("journeys-viewer");
    expect(files.some((f) => f.path.startsWith(`${base}/map/bpmn/`))).toBe(false);
    // Data on the move: after the grid, before the processes; a hand-off end that is somebody of the cast wears their avatar.
    expect(how).toContain('<section class="jp-card jp-pad jp-move" id="data-on-the-move">');
    expect(how).toMatch(/<b>Clinic EMR → <span class="jp-av jp-av-sm"[^>]*>A<\/span>Ana<\/b>/);
    expect(how.indexOf('id="data-on-the-move"')).toBeGreaterThan(how.indexOf('id="jp-blocks"'));
    // No duplicate: the building blocks per moment are the grid's alone, and the processes the BPMN list's.
    expect(how).not.toContain("jp-mapgrid");
    expect((how.match(/Business processes \(BPMN\)/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  test("the persona lens: needs, frustrations, the curve's points linking to steps, the touchpoints; a glyph for an icon", () => {
    const ana = at(`${base}/personas/ana/index.html`);
    expect(ana).toContain("Her summary abroad");
    expect(ana).toContain("Paper gets lost");
    expect(ana).toContain('<a href="../../walkthrough/P2/"><title>P2 Step P2: Worried</title>');
    expect(ana).toContain("Ana’s touchpoints (2)");
    expect(at(`${base}/personas/index.html`)).toContain('href="ana/"');
    // JV-06: a persona with an icon wears it in every avatar, as VaxLink's baby does (owner's
    // review, 2026-11-11, superseding initials for everyone of 2026-11-06); the rest keep initials.
    expect(at(`${base}/personas/cleo/index.html`)).toMatch(/class="jp-av jp-av-lg jp-av-icon"[^>]*title="Cleo"[^>]*><svg/);
    expect(how).toMatch(/class="jp-av jp-av-sm"[^>]*title="Ana"[^>]*>A<\/span>/);
    // JV-12: the curve's axis is three faces, not characters.
    const curve = at(`${base}/personas/ana/index.html`);
    for (const f of ["happy", "neutral", "sad"]) expect(curve).toContain(`class="jp-cv-face" aria-label="${f}"`);
  });
  test("how it works: the big ideas, the grid, a block's detail with the moments that use it", () => {
    expect(how).toContain("Carry it yourself");
    expect(how).toContain('<a class="jp-bchip jp-layer-teal" href="wallet/#jp-blocks">Health wallet</a>');
    expect(how).toContain("Select a building block");
    expect(wallet).toContain("So what for the journey");
    expect(wallet).toContain('href="https://example.org/wallet"');
    expect(wallet).toContain("<small>shows the QR</small>");
    expect(wallet).toContain("Read the patient&#39;s summary");
  });
  test("the discussion: the closing question, the moments to revisit, the tables with what forces each row, the gap report", () => {
    expect(discuss).toContain("What must countries agree on?");
    // The gap report's model: the gap strip's own storage names, the moment's link, its first module.
    const model = JSON.parse(/<script type="application\/json" data-jp-gapreport-model>([\s\S]*?)<\/script>/.exec(discuss)![1]!);
    expect(model.items).toEqual([{ name: { status: "policy:viewer:status" }, capability: { id: "viewer", label: "A viewer" }, step: { id: "P2", title: "Step P2", href: "../walkthrough/P2/" }, module: "M1" }]);
    expect(model.status.options.map((o: { id: string }) => o.id)).toEqual(["yes", "no"]);
    expect(model.urgency).toBeUndefined();
    expect(discuss).toContain('<script src="../../../../assets/gap-report.js" defer></script>');
    expect(discuss).toContain("data-jp-report-print");
    expect(discuss).toContain("data-jp-report-csv");
    expect(files.some((f) => f.path === "assets/gap-report.js")).toBe(true);
    expect(discuss).toContain("Forced by:");
    expect(discuss).toContain('href="../walkthrough/P2/"');
  });
  test("a step: its screen, its FHIR change with Inspect JSON, the payload drawer, the IG's process and scenario pages", () => {
    expect(p2).toContain('href="../../demo/S2/"');
    expect(p2).toContain("<small>(screen S2)</small>");
    expect(p2).toContain('data-jp-inspect="Bundle/ana-ips"');
    // JV-18: an example's link reads as its title, the id its tooltip.
    expect(p2).toMatch(/<a class="jp-ext jp-exlabel" href="[^"]*Bundle-ana-ips\.html" data-jv-dak title="Bundle\/ana-ips"[^>]*>Ana&#39;s IPS</);
    expect(p2).toContain('<span class="jp-j-key">&quot;resourceType&quot;</span>');
    expect(p2).toContain("Read, not stored");
    expect(p2).toContain("Intl profile");
    expect(p2).toContain('href="../../../../../../../../business-processes.html#read-the-patients-summary"');
    expect(p2).toContain('href="../../../../../../../../journeys.html#p2"');
    expect(p2).toContain('class="jp-scene');
  });
  test("the device demo frames the app's screen and links back to its moments", () => {
    const s2 = at(`${base}/demo/S2/index.html`);
    expect(s2).toContain('<iframe class="jp-device jp-device-tablet" src="../../../../../../../../app/#/demo/S2"');
    expect(s2).toContain('href="../../walkthrough/P2/"');
    // The note names the stage and its title; what to try sits in the Moments card.
    expect(s2).toContain("Stage P2 (");
    expect(s2).toContain("Flip the toggle");
  });
  test("JV-01: each view lists its ArchiMate elements, and a block's page the elements that deploy it, each linked", () => {
    const pagesOf = (html: string, page: string) => hrefsOf(html, DAK_ATTR).map((h) => landsAt(sitePath(page), h));
    for (const page of [`${base}/how/index.html`, `${base}/how/wallet/index.html`]) {
      const html = at(page);
      expect(html).toContain("The 1 element in this view");
    }
    expect(pagesOf(at(`${base}/how/wallet/index.html`), `${base}/how/wallet/index.html`)).toContain("en/top/archimate/ra/element/wallet-app/");
    expect(wallet).toContain("In the architecture (ArchiMate)");
    expect(wallet).toContain("<small>Application Component</small>");
    // A block that no element deploys lists none.
    const other = files.find((f) => f.path.startsWith(`${base}/how/`) && f.path !== `${base}/how/wallet/index.html` && f.path !== `${base}/how/index.html`);
    if (other) expect(String(other.content)).not.toContain("In the architecture (ArchiMate)");
  });
  test("the Table sheets are a folded panel of the discussion; sheets/ redirects there and the tab is gone (owner, 2026-11-17)", () => {
    // A folded <details>, after the discussion's own content.
    expect(discuss).toMatch(/<details class="jp-card jp-sheets-panel" id="sheets" data-jp-sheets><summary class="jp-sheets-sum jp-noprint">/);
    expect(discuss).not.toMatch(/jp-sheets-panel"[^>]* open/);
    expect(discuss.indexOf('id="sheets"')).toBeGreaterThan(discuss.indexOf("jp-dhero"));
    expect(discuss).toContain('id="sheet-cover"');
    expect(discuss).toContain("assets/journeys.css");
    // No tab, on any page.
    for (const page of [p2, how, discuss]) {
      expect(page).not.toMatch(/<a class="jp-tab[^"]*" href="(\.\.\/)*sheets\/"/);
      expect(page).not.toContain('href="../sheets/"');
    }
    // The redirect says which Tool drew it, as every page does.
    expect(renderedByOf(at(`${base}/sheets/index.html`))).toBe("journeys-viewer");
    // The old address redirects, carrying its anchor, to the panel.
    const old = at(`${base}/sheets/index.html`);
    expect(old).toContain('<meta http-equiv="refresh" content="0; url=../discuss/#sheets">');
    expect(old).toContain('location.replace("../discuss/" + location.search + (location.hash || "#sheets"))');
    expect(old).not.toContain("jv-sheet");
    // A module's sheet link opens its sheet in the panel.
    expect(at(`${base}/m1/index.html`)).toContain('href="../discuss/#sheet-s1"');
    // The client opens the panel the address names, and prints the sheets alone.
    const js = at("assets/present.js");
    expect(js).toContain("function openTarget()");
    expect(js).toContain('root.classList.add("jp-print-sheets")');
    const css = at("assets/present.css");
    expect(css).toContain(".jp-print-sheets .jp-wrap > :not(.jp-lab):not(.jp-sheets-panel)");
  });
  test("JV-02: every view has the payload drawer; a view page loads each payload from one shared file, a step page carries it", () => {
    for (const path of ["overview", "personas", "personas/ana", "how", "how/wallet", "discuss", "demo", "demo/S2"]) {
      const page = at(`${base}/${path}/index.html`);
      expect(page).toContain("data-jp-drawer");
      expect(page).toContain('data-jp-tab="Bundle/ana-ips"');
      expect(page).toContain("data-jp-copy");
      const src = /<pre class="jp-json" data-jp-src="([^"]+)">/.exec(page)?.[1];
      expect(src).toBeDefined();
      expect(landsAt(sitePath(`${base}/${path}/index.html`), src!)).toBe(sitePath(`${base}/payload/Bundle-ana-ips.json`));
    }
    expect(JSON.parse(at(`${base}/payload/Bundle-ana-ips.json`))).toMatchObject({ resourceType: "Bundle", id: "ana-ips" });
    expect(files.filter((f) => f.path.endsWith("/payload/Bundle-ana-ips.json"))).toHaveLength(1);
    expect(at(`${base}/demo/S2/index.html`)).toContain("resource on this screen");
    // The step page keeps its JSON inline, so it needs no fetch.
    expect(p2).not.toContain("data-jp-src");
  });
  test("JV-08: the drawer's bar names the active stage, and the workshop's inspector title, key and hint", () => {
    expect(p2).toContain('<span class="jp-drawer-chip">Active Stage: P2</span>');
    expect(at(`${base}/how/index.html`)).toContain("Active Stage: How it works");
    expect(at(`${base}/demo/S2/index.html`)).toContain("Active Stage: S2 · P2");
    expect(p2).toContain("<b>FHIR payload inspector</b>");
    expect(p2).not.toContain("jp-drawer-key");
    const w0 = corpus.workshops[0]!;
    const w = { ...w0, workshop: { ...w0.workshop, presentation: { ...w0.workshop.presentation, inspector: { title: "FHIR R4 & WHO GDHCN payload inspector", key: "DEV Key: 916ffa (XXR)", hint: "Click to inspect raw FHIR / CBOR payload" } } } };
    const out = renderJourneyPages({ ...corpus, workshops: [w] }, LINKS, "top");
    for (const path of ["walkthrough/P2", "how", "demo/S2"]) {
      const page = String(out.find((f) => f.path === `${base}/${path}/index.html`)!.content);
      expect(page).toContain("<b>FHIR R4 &amp; WHO GDHCN payload inspector</b>");
      expect(page).toMatch(/<span class="jp-drawer-key"><svg[^>]*>[\s\S]*?<\/svg>DEV Key: 916ffa \(XXR\)<\/span>/);
      expect(page).toContain("Click to inspect raw FHIR / CBOR payload");
    }
  });
  test("the lab: the Discussion view as timed steps, the journey's questions answered under the walkthrough's keys, a summary", () => {
    // Without a lab the Discussion view keeps its closing-questions layout.
    expect(discuss).not.toContain("data-jp-lab=");
    // The walkthrough's questions each have a write-in, kept per workshop and question, and naming the key it was kept under before.
    expect(p2).toContain(`name="${Q_TRUST}" rows="2" data-jv-text data-jv-was="policy:q:P2:0"`);
    expect(p2).toContain(`name="${Q_DECIDES}" rows="2" data-jv-text data-jv-was="policy:q:P2:1"`);
    // The id is the question's, not its place: the same text hashes alike, whatever its case, spacing or punctuation.
    expect(questionId({ text: "Who decides?" })).toBe(questionId({ text: "  who DECIDES " }));
    expect(questionId({ text: "Who decides?" })).not.toBe(questionId({ text: "Who pays?" }));
    const w0 = corpus.workshops[0]!;
    const lab = {
      name: "The table's steps",
      credit: "Adapted from a lab, CC BY 4.0.",
      creditHref: "https://example.org/lab/",
      creditLabel: "The lab",
      useCases: [
        { id: "immz", label: "Immunisation", journey: true },
        { id: "ips", label: "Patient summary" },
      ],
      useCaseText: "A pilgrim checked at home should be treated abroad.",
      scale: { id: "ready", label: "Readiness", options: [{ id: "done", label: "Done" }, { id: "not-yet", label: "Not yet" }] },
      steps: [
        { id: "team", label: "Team", title: "Who is at the table?", minutes: 2, fields: [{ id: "members", label: "Team members", lines: 3 }], note: "No health data." },
        { id: "use-case", label: "Use case", title: "Which use cases?", minutes: 5, discuss: "Go round the table.", useCases: true, modules: ["M1"] },
        { id: "readiness", label: "Readiness", title: "Has your country done these?", rate: ["ready"] },
        { id: "decide", label: "Who decides", title: "Who holds it?", holders: ["rights"], modules: ["M2"], capabilities: true },
        { id: "summary", label: "Summary", title: "Our summary", discussion: true, summary: true },
      ],
    };
    const tables = [...(w0.workshop.tables ?? []), { id: "ready", title: "Readiness", rows: [{ id: "strategy", label: "Strategy", group: "Strategy & investment" }, { id: "twg", label: "TWG", group: "Governance" }] }];
    const ws = { ...w0.workshop, tables, discussion: [{ id: "q1", theme: "Trust", question: "Where does trust begin?", steps: ["p2-treated#P2"] }], lab };
    expect(WorkshopSchema.safeParse({ ...ws, $schema: "workshop/0.1.0" }).success).toBe(true);
    const out = renderJourneyPages({ ...corpus, workshops: [{ ...w0, workshop: ws }] }, LINKS, "top");
    const page = String(out.find((f) => f.path === `${base}/discuss/index.html`)!.content);
    // A tab per step, numbered from 0, each step with its timer and DISCUSS prompt.
    expect(page).toContain('data-jp-lab="policy"');
    expect(page.match(/data-jp-lab-tab="/g)).toHaveLength(5);
    expect(page).toContain('<a class="jp-lab-tab" href="#lab-team" data-jp-lab-tab="team"><span>0</span>Team</a>');
    expect(page).toContain('data-jp-timer="5"');
    expect(page).toContain("<b>Discuss</b><span>Go round the table.</span>");
    expect(page).toContain('<p class="jp-lab-note jp-presenter-only">No health data.</p>');
    // Owner, 2026-11-17: the timers, the DISCUSS prompts and the notes are the presenter's.
    expect(page).toContain('<button type="button" class="jp-lab-timer jp-noprint jp-presenter-only" data-jp-timer="5">');
    expect(page).toContain('<div class="jp-lab-discuss jp-presenter-only"><b>Discuss</b><span>Go round the table.</span>');
    // Use cases: any number ticked; the journeys' own come ticked; the statement starts from the journeys and can be reset to them.
    expect(page).toContain('<input type="checkbox" name="policy:uc:immz" data-jv-check checked>');
    expect(page).toContain('<input type="checkbox" name="policy:uc:ips" data-jv-check>');
    const statement = /data-jp-usecase>([^<]*)<\/textarea>/.exec(page)![1]!;
    expect(statement.startsWith("A pilgrim checked at home should be treated abroad.\n• ")).toBe(true);
    expect(page).toContain('data-jp-text-reset="policy:lab:use-case"');
    // The journey's questions: the same keys as the walkthrough's, so an answer written in either shows in both.
    expect(page).toContain(`name="${Q_TRUST}"`);
    expect(page).toContain(`name="${Q_BREAKS}"`);
    expect(page).toContain(`name="${Q_DECIDES}"`);
    // Readiness rows grouped and rated; decision rights with who holds them; the gap strip's own radios.
    // Each group keeps its heading; anchorHeadings (#1894) gives it an id like every view heading.
    expect(page).toContain('<h4 id="strategy-investment">Strategy &amp; investment</h4>');
    expect(page).toContain('name="policy:rate:ready:twg" value="not-yet"');
    expect(page).toContain('name="policy:hold:rights:anchor"');
    expect(page).toContain('name="policy:viewer:status" value="no"');
    // The summary: one model of every answer, the gap report, the closing questions with a write-in, and the credit.
    const model = JSON.parse(/<script type="application\/json" data-jp-lab-model>([\s\S]*?)<\/script>/.exec(page)![1]!);
    // The five steps, then the application components the room can mark "we have this" (the view shows the wallet app).
    expect(model.map((x: { id: string }) => x.id)).toEqual(["team", "use-case", "readiness", "decide", "summary", "systems"]);
    const names = model.flatMap((x: { items: { name: string }[] }) => x.items.map((i) => i.name));
    expect(names).toEqual(expect.arrayContaining(["policy:lab:team:members", "policy:uc:immz", "policy:lab:use-case", "policy:rate:ready:strategy", "policy:hold:rights:anchor", Q_DECIDES, "policy:viewer:status", "policy:dq:q1"]));
    expect(page).toContain("data-jp-gapreport");
    expect(page).toContain("data-jp-lab-csv");
    // The Table sheets fold into the summary step, after the summary and before the aside (owner, 2026-11-17).
    const sum = page.indexOf('id="lab-summary"');
    expect(page.indexOf('id="sheets"')).toBeGreaterThan(page.indexOf("data-jp-lab-summary", sum));
    expect(page.indexOf('id="sheets"')).toBeLessThan(page.indexOf('class="jp-card jp-lab-aside"'));
    expect(page.match(/data-jp-sheets>/g)).toHaveLength(1);
    expect(page).toContain('name="policy:dq:q1"');
    expect(page).toContain('href="https://example.org/lab/"');
    expect(page).toMatch(/Adapted from a lab, CC BY 4\.0\. <a class="jp-ext" href="https:\/\/example\.org\/lab\/"[^>]*>The lab/);
    // A lab naming a table it does not list is refused.
    const bad = WorkshopSchema.safeParse({ ...ws, $schema: "workshop/0.1.0", lab: { ...lab, steps: [{ id: "x", label: "X", title: "X", holders: ["nowhere"] }] } });
    expect(bad.success).toBe(false);
  });
  test("JV-05: the lab's module × journey matrix, ● from the steps' questions, the workshop's words on each cell, the overlaps; the summary lists an answer once", () => {
    const w0 = corpus.workshops[0]!;
    const matrix = {
      intro: "Where each module meets the journey.",
      cells: [
        { module: "M1", step: "P2", technical: "A viewer reads the record.", policy: "Who may trust it." },
        { module: "M2", step: "p1-checked#P1", kind: "draws" as const, technical: "The record is signed.", policy: "Who signs at home." },
      ],
      overlaps: { technical: [{ label: "Signing", modules: ["M1", "M2"], steps: ["P1", "P2"], text: "One key, two moments." }], policy: [{ label: "Trust anchor", modules: ["M2"], steps: ["P2"], text: "One decision." }] },
    };
    const lab = {
      steps: [
        { id: "use-case", label: "Use case", title: "Which use case?", modules: ["M1"] },
        { id: "map", label: "Modules × journey", title: "Where do the modules meet the journey?", matrix: true, modules: ["M1", "M2"] },
        { id: "summary", label: "Summary", title: "Our summary", summary: true },
      ],
    };
    const ws = { ...w0.workshop, matrix, lab };
    expect(WorkshopSchema.safeParse({ ...ws, $schema: "workshop/0.1.0" }).success).toBe(true);
    const out = renderJourneyPages({ ...corpus, workshops: [{ ...w0, workshop: ws }] }, LINKS, "top");
    const page = String(out.find((f) => f.path === `${base}/discuss/index.html`)!.content);
    const table = /<table class="jp-mx-tbl">([\s\S]*?)<\/table>/.exec(page)![1]!;
    // Steps across in the walkthrough's order, each heading linking to its step.
    expect(table).toMatch(/<thead><tr><th scope="col" class="jp-mx-corner">Module<\/th><th scope="col"><a href="\.\.\/walkthrough\/P1\/"[^>]*>P1<\/a><\/th><th scope="col"><a href="\.\.\/walkthrough\/P2\/"/);
    const rows = table.split("<tr>").slice(2);
    // M1 is asked at both steps; M2 is asked at P2 and draws on P1.
    expect(rows[0]!.match(/class="jp-mx-asked"/g)).toHaveLength(2);
    expect(rows[1]).toContain('<td class="jp-mx-draws"><a class="jp-mx-cell" href="../walkthrough/P1/" aria-label="M2 × P1: the module draws on this step"><span aria-hidden="true">○</span></a>');
    expect(rows[1]).toContain('<td class="jp-mx-asked"><a class="jp-mx-cell" href="../walkthrough/P2/"');
    // A cell's words pop up on hover or focus, and are listed under the matrix to expand.
    expect(table).toContain("<p><b>Technical.</b> A viewer reads the record.</p><p><b>Policy.</b> Who may trust it.</p>");
    expect(page).toContain("<summary>Every meeting point, technical and policy</summary>");
    expect(page).toContain("<p class=\"jp-small\">Where each module meets the journey.</p>");
    expect(page).toContain('<h4 id="technical-overlaps">Technical overlaps</h4>');
    expect(page).toMatch(/<b>Signing<\/b><p>One key, two moments\.<\/p>/);
    expect(page).toContain('<h4 id="policy-overlaps">Policy overlaps</h4>');
    expect(at("assets/present.css")).toContain(".jp-mx-tbl td:hover .jp-mx-pop, .jp-mx-tbl td:focus-within .jp-mx-pop { display: block; }");
    // M1's questions show in both steps, under one key each; the summary lists each once, under the first step.
    expect(page.split(`name="${Q_TRUST}"`)).toHaveLength(3);
    const model = JSON.parse(/<script type="application\/json" data-jp-lab-model>([\s\S]*?)<\/script>/.exec(page)![1]!);
    const names = model.flatMap((x: { items: { name: string }[] }) => x.items.map((i) => i.name));
    expect(names).toEqual([...new Set(names)]);
    expect(model.find((x: { id: string }) => x.id === "use-case").items.map((i: { name: string }) => i.name)).toEqual([Q_BREAKS, Q_TRUST]);
    expect(model.find((x: { id: string }) => x.id === "map").items.map((i: { name: string }) => i.name)).toEqual([Q_DECIDES]);
    // The schema holds the matrix to the workshop: a known module and step, kind as the questions say, some text, each cell once.
    const refuse = (m: object, re: RegExp) => {
      const r = WorkshopSchema.safeParse({ ...ws, $schema: "workshop/0.1.0", matrix: m });
      expect(r.success).toBe(false);
      expect(r.error!.issues.map((i) => i.message).join("; ")).toMatch(re);
    };
    refuse({ cells: [{ module: "M9", step: "P2", technical: "t" }] }, /module "M9"/);
    refuse({ cells: [{ module: "M1", step: "P9", technical: "t" }] }, /step "P9"/);
    refuse({ cells: [{ module: "M2", step: "P1", technical: "t" }] }, /M2 asks no question at P1; mark it "draws"/);
    refuse({ cells: [{ module: "M1", step: "P1", kind: "draws", technical: "t" }] }, /drop the kind/);
    refuse({ cells: [{ module: "M1", step: "P1" }] }, /has no text/);
    refuse({ cells: [{ module: "M1", step: "P1", technical: "t" }, { module: "M1", step: "p1-checked#P1", policy: "p" }] }, /appears twice/);
    refuse({ overlaps: { policy: [{ label: "x", modules: ["M1"], steps: ["P7"], text: "t" }] } }, /step "P7"/);
  });
  test("the canvas as data: an on-screen form keyed per field, a journey question naming a field shares its key, the annex, the PDF's model (owner, 2026-11-17)", () => {
    const w0 = corpus.workshops[0]!;
    const canvas = {
      title: "Country Canvas",
      size: "A3",
      sheets: [
        {
          id: "cover",
          label: "Cover",
          title: "Who we are",
          sections: [
            {
              id: "table",
              title: "The table",
              fields: [
                { id: "country", type: "text", label: "Country", lines: 1 },
                { id: "stage", type: "choice", label: "Where we are", options: [{ id: "pilot", label: "Pilot" }, { id: "scale", label: "At scale" }] },
                { id: "std", type: "ticks", label: "Standards in use", options: [{ id: "fhir", label: "FHIR" }, { id: "icao", label: "ICAO VDS" }] },
              ],
            },
          ],
        },
        {
          id: "s1",
          label: "Sheet 1",
          title: "Who decides",
          modules: ["M1"],
          sections: [
            {
              id: "rights",
              fields: [
                { id: "rights", type: "grid", label: "Decision rights", rows: [{ id: "anchor", label: "Trust anchor" }], columns: [{ id: "today", label: "Who holds it today" }, { id: "signed", label: "Signed?", cell: "tick" }] },
                { id: "gap", type: "gap", label: "Gap strip", rows: [{ id: "viewer", label: "A viewer" }] },
              ],
            },
          ],
        },
      ],
    };
    const steps = w0.workshop.steps!.map((st) => (st.step === "P2" ? { ...st, questions: st.questions!.map((q) => (q.id === "trust" ? { ...q, canvas: "s1:rights:anchor:today" } : q)) } : st));
    const lab = { steps: [{ id: "canvas", label: "Canvas", title: "Our canvas", canvas: ["cover", "s1"] }, { id: "summary", label: "Summary", title: "Our summary", summary: true }] };
    const ws = { ...w0.workshop, steps, canvas, lab };
    expect(WorkshopSchema.safeParse({ ...ws, $schema: "workshop/0.1.0" }).success).toBe(true);
    // A question may be a write-in of the canvas, nothing else; a lab step names sheets the canvas has.
    const refused = (w: object) => WorkshopSchema.safeParse({ ...w, $schema: "workshop/0.1.0" }).success;
    expect(refused({ ...ws, steps: steps.map((st) => ({ ...st, questions: st.questions?.map((q) => ({ ...q, canvas: "cover:std:fhir" })) })) })).toBe(false);
    expect(refused({ ...ws, lab: { steps: [{ id: "canvas", label: "C", title: "C", canvas: ["nowhere"] }] } })).toBe(false);
    expect(refused({ ...ws, canvas: { ...canvas, sheets: [canvas.sheets[0], canvas.sheets[0]] } })).toBe(false);
    // The schema checked it above; the literal's field kinds are plain strings to the compiler.
    const out = renderJourneyPages({ ...corpus, workshops: [{ ...w0, workshop: ws as unknown as typeof w0.workshop }] }, LINKS, "top");
    const page = (path: string) => String(out.find((f) => f.path === `${base}/${path}`)!.content);
    const discuss = page("discuss/index.html");
    // Every field, under <workshop>:cv:<sheet>:<field>[:<row>[:<col>]], in the same store as every answer.
    expect(discuss).toContain('<article class="jp-cv-sheet jp-cv-a3" id="canvas-cover" data-jp-cv-sheet="cover">');
    expect(discuss).toMatch(/<textarea class="jp-answer jp-cv-in" name="policy:cv:cover:country" rows="1" data-jv-text/);
    expect(discuss).toContain('<input type="radio" name="policy:cv:cover:stage" value="scale" data-jv-store>');
    expect(discuss).toContain('<input type="checkbox" name="policy:cv:cover:std:icao" data-jv-check>');
    expect(discuss).toContain('<input type="checkbox" name="policy:cv:s1:rights:anchor:signed" data-jv-check');
    expect(discuss).toContain('<input type="radio" name="policy:cv:s1:gap:viewer" value="no" data-jv-store');
    // The journey question that is a canvas cell keeps its answer there, on the walkthrough too, moving it from its own key and its older one.
    const was = `data-jv-was="${Q_TRUST} policy:q:P2:0"`;
    expect(discuss).toContain(`name="policy:cv:s1:rights:anchor:today" data-jv-text ${was}`);
    expect(page("walkthrough/P2/index.html")).toContain(`name="policy:cv:s1:rights:anchor:today" rows="2" data-jv-text ${was}`);
    expect(page("walkthrough/P2/index.html")).not.toContain(`name="${Q_TRUST}"`);
    // The sheet's annex: its modules' other journey questions, answered under their own keys.
    const s1 = discuss.slice(discuss.indexOf('id="canvas-s1"'));
    expect(s1).toContain("Annex: the journey’s questions for this sheet");
    expect(s1).toContain(`name="${Q_BREAKS}"`);
    expect(s1.slice(0, s1.indexOf("</article>"))).not.toContain(`aria-label="Our answer: What must be true for Ben to trust it?"`);
    // The PDF's model: the same keys, a radio per option of a choice, the annex; the writer is loaded.
    const model = JSON.parse(/<script type="application\/json" data-jp-canvas-model>([\s\S]*?)<\/script>/.exec(discuss)![1]!);
    expect(model.size).toBe("A3");
    expect(model.sheets.map((x: { id: string }) => x.id)).toEqual(["cover", "s1"]);
    expect(model.sheets[0].sections[0].fields[1].rows[0].cells).toEqual([
      { key: "policy:cv:cover:stage", label: "Pilot", kind: "tick", value: "pilot", radio: true },
      { key: "policy:cv:cover:stage", label: "At scale", kind: "tick", value: "scale", radio: true },
    ]);
    expect(model.sheets[1].annex).toEqual([{ step: "P1", label: "Where does it break?", key: Q_BREAKS }]);
    expect(discuss).toContain("data-jp-canvas-pdf");
    expect(discuss).toContain('<script src="../../../../assets/canvas-pdf.js" defer></script>');
    expect(out.some((f) => f.path === "assets/canvas-pdf.js")).toBe(true);
    // The lab's summary reads every canvas key back, once.
    const sum = JSON.parse(/<script type="application\/json" data-jp-lab-model>([\s\S]*?)<\/script>/.exec(discuss)![1]!);
    const names = sum.flatMap((x: { items: { name: string }[] }) => x.items.map((i) => i.name));
    expect(names).toEqual(expect.arrayContaining(["policy:cv:cover:country", "policy:cv:cover:stage", "policy:cv:cover:std:fhir", "policy:cv:s1:rights:anchor:today", "policy:cv:s1:gap:viewer", Q_BREAKS]));
    expect(new Set(names).size).toBe(names.length);
  });
  test("JV-07: every page's header has Reset Simulation, scoped to the workshop, returning to the overview", () => {
    for (const path of ["overview", "walkthrough/P2", "personas", "how", "demo/S2"]) {
      const page = at(`${base}/${path}/index.html`);
      const depth = path.split("/").length;
      expect(page).toContain(`data-jp-reset="policy" data-jp-reset-to="${"../".repeat(depth)}overview/"`);
      expect(page).toContain("<span>Reset Simulation</span>");
    }
    const js = at("assets/present.js");
    expect(js).toContain('each("[data-jp-reset]", reset)');
    // Owner, 2026-11-17: Reset Simulation, the keyboard hint and the what-if reveal are the presenter's; without the presenter the outcome shows.
    expect(at(`${base}/walkthrough/P2/index.html`)).toContain('class="jp-btn-link jp-reset jp-presenter-only"');
    expect(at(`${base}/walkthrough/P2/index.html`)).toContain('<span class="jp-keys jp-presenter-only">');
    expect(at("assets/present.css")).toContain('html[data-presenter="off"] .jp-wf-a { display: block; }');
  });
  test("a room marks an application component \"we have this\", with its own name for it, and renames the fictional countries (owner, 2026-11-17)", () => {
    const w0 = corpus.workshops[0]!;
    const spec = { model: "ra", root: "root", countries: [{ group: "c-a", label: "Taifafeki" }, { group: "c-b", label: "Onesa" }] };
    const comp = { name: "Wallet app", type: "Application Component", page: "en/top/archimate/ra/element/wallet-app/" };
    const grp = (name: string) => ({ name, type: "Grouping", page: `en/top/archimate/ra/element/${name}/` });
    const links: SiteLinks = {
      ...LINKS,
      archimateArchitecture: () => ({ countries: [grp("c-a"), grp("c-b")], rows: [{ layer: grp("pos"), cells: [[{ ...comp, block: grp("provider-systems"), bpmn: [] }], []], blocks: [] }] }),
    };
    const lab = { steps: [{ id: "summary", label: "Summary", title: "Our summary", summary: true }] };
    const ws = { ...w0.workshop, lab, presentation: { ...w0.workshop.presentation, architecture: spec } };
    const out = renderJourneyPages({ ...corpus, workshops: [{ ...w0, workshop: ws }] }, links, "top");
    const page = (path: string) => String(out.find((f) => f.path === `${base}/${path}`)!.content);
    const mark = '<span class="jp-have"><label><input type="checkbox" name="policy:am:wallet-app:have" data-jv-check> We have this</label><input type="text" class="jp-answer jp-have-name" name="policy:am:wallet-app:name" data-jv-text placeholder="Our name for it" aria-label="Our name for Wallet app"></span>';
    // On the architecture panel's box, in a view's element list and on the block's page: one key, wherever it is shown.
    const how = page("how/index.html");
    expect(how.slice(how.indexOf("jp-arch-grid"))).toContain(mark);
    expect(how.slice(how.indexOf("jp-amels"))).toContain(mark);
    expect(page("how/wallet/index.html")).toContain(`<small>Application Component</small>${mark}`);
    // Only an application component is marked.
    expect(how).not.toContain('name="policy:am:pos:have"');
    // The summary lists the marks.
    const sum = JSON.parse(/<script type="application\/json" data-jp-lab-model>([\s\S]*?)<\/script>/.exec(page("discuss/index.html"))![1]!);
    expect(sum.find((x: { id: string }) => x.id === "systems").items.map((i: { name: string }) => i.name)).toEqual(["policy:am:wallet-app:have", "policy:am:wallet-app:name"]);
    // The countries: a box each on the overview, and on every page the names present.js replaces.
    const overview = page("overview/index.html");
    expect(overview).toContain('<input type="text" class="jp-answer" name="policy:country:taifafeki" data-jv-text data-jp-country="Taifafeki" placeholder="Taifafeki" aria-label="Our name for Taifafeki">');
    expect(overview).toContain('name="policy:country:onesa"');
    for (const path of ["overview/index.html", "walkthrough/P2/index.html", "how/index.html", "discuss/index.html"]) {
      expect(page(path)).toContain('<script type="application/json" id="jp-countries">[{"name":"Taifafeki","key":"policy:country:taifafeki"},{"name":"Onesa","key":"policy:country:onesa"}]</script>');
    }
    expect(at("assets/present.js")).toContain("function renameCountries()");
    // Without fictional countries, no box and no block.
    expect(at(`${base}/overview/index.html`)).not.toContain("jp-countries");
  });
  test("JV-13: How it works opens with the architecture panel from the ArchiMate graph, then the views, then the big ideas", () => {
    const w0 = corpus.workshops[0]!;
    const spec = { model: "ra", root: "root", countries: [{ group: "c-a", label: "Country A (north)", code: "AA" }, { group: "c-b" }], shared: "shared", notes: ["Keys cross, data does not."] };
    const w = { ...w0, workshop: { ...w0.workshop, presentation: { ...w0.workshop.presentation, architecture: spec } } };
    const box = (name: string, block: string, bpmn: string[], ig?: string) => ({ name, type: "Application Component", page: `en/top/archimate/ra/element/${name.toLowerCase().replace(/ /g, "-")}/`, block: { name: block, type: "Application Component", page: `en/top/archimate/ra/element/${block}/` }, bpmn, ...(ig ? { ig } : {}) });
    const el = (name: string) => ({ name, type: "Grouping", page: `en/top/archimate/ra/element/${name}/` });
    const links: SiteLinks = {
      ...LINKS,
      archimateArchitecture: (_i, sp) =>
        sp.model === "ra"
          ? {
              countries: [el("Country A"), el("Country B")],
              rows: [
                { layer: el("Point of service"), cells: [[box("Wallet app", "provider-systems", ["processes/care.bpmn"], "https://ig.example/Wallet.html")], []], blocks: [] },
                { layer: el("Interop"), cells: [[], []], blocks: [el("Open standards")] },
              ],
              shared: { group: el("Shared"), members: [el("Trust network")] },
            }
          : undefined,
    };
    const out = renderJourneyPages({ ...corpus, workshops: [w] }, links, "top");
    const how = String(out.find((f) => f.path === `${base}/how/index.html`)!.content);
    expect(how).toContain('<span class="jp-arch-code">AA</span>');
    expect(how).toContain("Country A (north)");
    expect(how).toContain("Country B");
    expect(how).toContain("Wallet app");
    expect(how).toContain('href="https://ig.example/Wallet.html"');
    // Its moments: the steps whose BPMN the system serves, linked to the walkthrough.
    expect(how).toMatch(/jp-arch-ms">[^]*?P2/);
    expect(how).toContain("<i>Not needed in this journey</i>");
    expect(how).toContain("Open standards");
    expect(how).toContain("Trust network");
    expect(how).toContain("<li>Keys cross, data does not.</li>");
    const order = ["jp-arch-grid", "jp-am\"", "jp-ideas", 'id="jp-blocks"'].map((m) => how.indexOf(m.replace("\\", "")));
    expect(order.every((x) => x > 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    // A ref the model does not hold says so rather than drawing an empty panel.
    const bad = renderJourneyPages({ ...corpus, workshops: [{ ...w, workshop: { ...w.workshop, presentation: { ...w.workshop.presentation, architecture: { ...spec, model: "nowhere" } } } }] }, links, "top");
    expect(String(bad.find((f) => f.path === `${base}/how/index.html`)!.content)).toContain("is not in this layer's ArchiMate graph");
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0" }).success).toBe(true);
  });
  test("the drawer's script colours JSON exactly as the build does", () => {
    const js = at("assets/present.js");
    const src = /\n {2}function esc\(t\) \{[\s\S]*?\n {2}\}\n {2}function highlightJson\(json\) \{[\s\S]*?\n {2}\}\n/.exec(js)?.[0];
    expect(src).toBeDefined();
    const run = new Function(`${src}; return highlightJson;`)() as (j: string) => string;
    const json = JSON.stringify({ resourceType: "Bundle", total: -1.5e3, ok: true, none: null, note: 'a "<b>" & \'x\'', entry: [{}] }, null, 2);
    expect(run(json)).toBe(highlightJson(json));    // Opened from disk, the fetch is refused: the pane links the file instead.
    expect(js).toContain('location.protocol === "file:"');
    expect(js).toContain("jp-json-open");
  });
  test("no font is shipped: the slides use the system's own (owner, 2026-11-12)", () => {
    expect(files.some((f) => f.path.startsWith("assets/fonts/"))).toBe(false);
    const css = at("assets/present.css");
    expect(css).not.toContain("@font-face");
    expect(css).toContain("--sans: system-ui,");
    expect(css).toContain("--mono: ui-monospace,");
  });
});

describe("a workshop with none of the optional data still presents", () => {
  test("no device demo, no IG, no catalogue, no index: the views draw what there is", () => {
    const bare = renderJourneyPages(
      { ...corpus, blocks: new Map(), examples: new Map(), workshops: corpus.workshops.map((w) => ({ ...w, workshop: { ...w.workshop, presentation: undefined } })) } as never,
      { route: "en/top/journeys", title: "Top" },
      "top",
    );
    const page = (p: string) => String(bare.find((f) => f.path === `top/workshops/policy/${p}`)!.content);
    expect(page("walkthrough/P2/index.html")).not.toContain("jp-drawer");
    expect(page("walkthrough/P2/index.html")).toContain('aria-disabled="true" title="No device screen shows a step of this workshop"');
    expect(page("how/index.html")).toContain("No building-block catalogue is declared");
    expect(bare.some((f) => f.path.includes("/demo/"))).toBe(false);
  });
});

describe("architecturePanel: the How it works panel read from an ArchiMate model (JV-13)", () => {
  const E = (id: string, type: string, name: string, props: Record<string, string> = {}) => ({ id, type, name, layer: "", folder: "", properties: Object.entries(props).map(([key, value]) => ({ key, value })) });
  let n = 0;
  const R = (type: string, source: string, target: string) => ({ id: `r${n++}`, type, source, target, properties: [] });
  const model = {
    elements: [
      E("root", "Grouping", "RA"), E("l-pos", "Grouping", "Point of service"), E("l-dpif", "Grouping", "Foundational"), E("l-int", "Grouping", "Interop"), E("sub", "Grouping", "Clinical"),
      E("b-prov", "ApplicationComponent", "Provider Systems"), E("b-trust", "ApplicationComponent", "National Trust Services"), E("b-med", "ApplicationComponent", "Mediator"), E("b-apps", "ApplicationComponent", "Citizen Apps"), E("b-std", "ApplicationComponent", "Open standards"),
      E("c-a", "Grouping", "Country A"), E("c-b", "Grouping", "Country B"), E("shared", "Grouping", "Shared"), E("gdhcn", "ApplicationComponent", "Trust network"),
      E("a-hosp", "ApplicationComponent", "Hospital system"), E("a-ehr", "ApplicationComponent", "Birth EHR", { ig: "https://ig.example/Ehr.html" }), E("a-sign", "ApplicationComponent", "DVC signer"),
      E("a-prov", "ApplicationComponent", "Provider Systems (A)"), E("a-trust", "ApplicationComponent", "National Trust Services (A)"),
      E("b-phone", "Device", "Family phone"), E("b-wallet", "ApplicationComponent", "Family wallet"), E("b-appsi", "ApplicationComponent", "Citizen Apps (B)"), E("b-medi", "ApplicationComponent", "Mediator (B)"), E("b-gw", "ApplicationComponent", "Gateway"), E("b-portal", "ApplicationComponent", "Portal"),
      E("j1", "BusinessProcess", "J1 Issue", { bpmn: "processes/j1.bpmn" }), E("j4", "BusinessProcess", "J4 Share", { bpmn: "processes/j4.bpmn" }),
    ],
    relationships: [
      R("Aggregation", "root", "l-pos"), R("Aggregation", "root", "l-dpif"), R("Aggregation", "root", "l-int"),
      R("Aggregation", "l-pos", "b-prov"), R("Aggregation", "l-pos", "sub"), R("Aggregation", "sub", "b-apps"), R("Aggregation", "l-dpif", "b-trust"), R("Aggregation", "l-dpif", "b-med"), R("Aggregation", "l-int", "b-med"), R("Aggregation", "l-int", "b-std"),
      R("Aggregation", "c-a", "a-hosp"), R("Aggregation", "c-a", "a-prov"), R("Aggregation", "c-a", "a-trust"),
      R("Specialization", "a-prov", "b-prov"), R("Specialization", "a-trust", "b-trust"),
      R("Composition", "a-hosp", "a-ehr"), R("Composition", "a-hosp", "a-sign"), R("Realization", "a-ehr", "a-prov"), R("Realization", "a-sign", "a-trust"), R("Serving", "a-hosp", "j1"),
      R("Aggregation", "c-b", "b-phone"), R("Aggregation", "c-b", "b-portal"), R("Aggregation", "c-b", "b-appsi"), R("Aggregation", "c-b", "b-medi"),
      R("Specialization", "b-appsi", "b-apps"), R("Specialization", "b-medi", "b-med"),
      R("Realization", "b-phone", "b-wallet"), R("Realization", "b-wallet", "b-appsi"), R("Serving", "b-phone", "j4"),
      R("Composition", "b-portal", "b-gw"), R("Realization", "b-gw", "b-medi"), R("Serving", "b-portal", "j4"),
      R("Aggregation", "shared", "gdhcn"),
    ],
    views: [],
  } as unknown as ArchimateModel;
  const element = (id: string) => {
    const x = model.elements.find((y) => y.id === id);
    return x ? { name: x.name, type: x.type, page: `p/${id}/` } : undefined;
  };
  const panel = architecturePanel(model, element, { root: "root", countries: [{ group: "c-a" }, { group: "c-b" }], shared: "shared" })!;
  const row = (name: string) => panel.rows.find((r) => r.layer.name === name)!;
  test("rows are the root's groupings, columns the countries", () => {
    expect(panel.rows.map((r) => r.layer.name)).toEqual(["Point of service", "Foundational", "Interop"]);
    expect(panel.countries.map((c) => c.name)).toEqual(["Country A", "Country B"]);
  });
  test("a system's parts go in the row of the block their country's instance specializes, with the BPMN it serves", () => {
    expect(row("Point of service").cells[0]!.map((b) => [b.name, b.block.name, b.ig, b.bpmn])).toEqual([["Birth EHR", "Provider Systems", "https://ig.example/Ehr.html", ["processes/j1.bpmn"]]]);
    expect(row("Foundational").cells[0]!.map((b) => b.name)).toEqual(["DVC signer"]);
    // A device's app is its part; a block under a sub-grouping finds its layer.
    expect(row("Point of service").cells[1]!.map((b) => [b.name, b.block.name, b.bpmn])).toEqual([["Family wallet", "Citizen Apps", ["processes/j4.bpmn"]]]);
  });
  test("a block two layers hold sits in the first; a row no country uses lists its own blocks", () => {
    expect(row("Foundational").cells[1]!.map((b) => b.name)).toEqual(["Gateway"]);
    expect(row("Interop").cells.every((c) => c.length === 0)).toBe(true);
    expect(row("Interop").blocks.map((b) => b.name)).toEqual(["Mediator", "Open standards"]);
  });
  test("the shared grouping is the foundation; a ref the model lacks gives no panel", () => {
    expect(panel.shared?.members.map((m) => m.name)).toEqual(["Trust network"]);
    expect(architecturePanel(model, element, { root: "nowhere", countries: [{ group: "c-a" }] })).toBeUndefined();
  });
});

describe("presentation helpers", () => {
  test("shortTitle drops a step code and its dash, and nothing else", () => {
    expect(shortTitle("J1 — Born abroad")).toBe("Born abroad");
    expect(shortTitle("J4.0 — Crossing back: one family")).toBe("Crossing back: one family");
    expect(shortTitle("T — The whole trip")).toBe("The whole trip");
    expect(shortTitle("P0 · Before the season")).toBe("Before the season");
    expect(shortTitle("Born abroad")).toBe("Born abroad");
    expect(shortTitle("Ministry of Health — the track")).toBe("Ministry of Health — the track");
  });
  test("chapterRoots: one level below what every taught journey shares", () => {
    const j = (id: string) => corpus.journeys.find((x) => x.scenario.id === id)!;
    // Both part of t-group: each is its own chapter.
    expect(chapterRoots(corpus, [j("t1-away"), j("t2-home")]).map((x) => x.scenario.id)).toEqual(["t1-away", "t2-home"]);
    // With a journey outside the group, the group is the chapter.
    expect(chapterRoots(corpus, [j("p1-checked"), j("t1-away"), j("t2-home")]).map((x) => x.scenario.id)).toEqual(["p1-checked", "t-group", "t-group"]);
  });
  test("presentationOf: chapters, keys and the cast in order of first appearance", () => {
    const p = presentationOf(corpus, corpus.workshops[0]!);
    expect(p.chapters.map((c) => c.title)).toEqual(["Checked", "Treated"]);
    expect(p.steps.map((s) => `${s.key}@${s.chapter}`)).toEqual(["P1@0", "P2@1"]);
    expect(p.cast.map((c) => c.id)).toEqual(["ana", "ben", "cleo"]);
    expect(p.steps[1]!.ws?.askTheRoom).toBe("Should the family be told?");
  });
  test("an overview card: the picture first, the strip (labelled, VaxLink's size) and the people at its foot", () => {
    const ov = at("top/workshops/policy/overview/index.html");
    const card2 = [...ov.matchAll(/<a class="jp-card jp-moment"[\s\S]*?<\/a>/g)].map((m) => m[0]).find((c) => c.includes("jp-pic"))!;
    expect(card2.indexOf('class="jp-pic"')).toBeLessThan(card2.indexOf('class="jp-moment-title"'));
    expect(card2.indexOf('class="jp-moment-sum"')).toBeLessThan(card2.indexOf('class="jp-moment-foot"'));
    expect(card2).toContain('jp-scene jp-scene-md');
    expect(card2).toContain('<span class="jp-scene-l">A clinic</span>');
  });
  test("JV-09: presentation.tagRows groups a step's tags into the policy card's rows, with their glyphs, in its order", () => {
    const w0 = corpus.workshops[0]!;
    const w = { ...w0, workshop: { ...w0.workshop, presentation: { ...w0.workshop.presentation, tagRows: [{ label: "Cost driver", icon: "coins" as const, tables: ["nowhere"] }, { label: "Forces", icon: "scale" as const, tables: ["rights"] }] } } };
    const page = String(renderJourneyPages({ ...corpus, workshops: [w] }, LINKS, "top").find((f) => f.path === "top/workshops/policy/walkthrough/P2/index.html")!.content);
    const forces = /<dl class="jp-forces">([\s\S]*?)<\/dl>/.exec(page)![1]!;
    expect(forces).toMatch(/<dt><svg[^>]*>[\s\S]*?<\/svg>Forces<\/dt><dd><span class="jp-pill"[^>]*>Trust anchor ★<\/span>/);
    expect(forces).not.toContain("Decision rights");
    // A row none of the step's tags fall in is left out.
    expect(forces).not.toContain("Cost driver");
    // A row naming a table the workshop does not list is refused.
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0" }).success).toBe(false);
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0", presentation: { ...w.workshop.presentation, tagRows: [{ label: "Forces", icon: "scale", tables: ["rights"] }] } }).success).toBe(true);
  });
  test("JV-14: the sheets open with a cover, its own page: the blanks, the scope promise, the ways to start", () => {
    const sheets = at("top/workshops/policy/discuss/index.html");
    // The default cover: the four blanks, before Sheet 1, the size of the first sheet.
    expect(sheets).toContain('<article class="jv-sheet jv-sheet-a3 jv-cover" id="sheet-cover">');
    expect(sheets.indexOf('id="sheet-cover"')).toBeLessThan(sheets.indexOf('id="sheet-s1"'));
    for (const f of ["Country", "Delegation", "Table", "Facilitator"]) expect(sheets).toContain(`<span>${f}</span>`);
    expect(sheets).not.toContain("jv-ways");
    const w0 = corpus.workshops[0]!;
    const w = { ...w0, workshop: { ...w0.workshop, promise: "You will leave knowing where you stand.", presentation: { ...w0.workshop.presentation, cover: { fields: ["Country", "Table"], table: "rights" } } } };
    const out = renderJourneyPages({ ...corpus, workshops: [w] }, LINKS, "top");
    const page = String(out.find((f) => f.path === "top/workshops/policy/discuss/index.html")!.content);
    expect(page).toContain('<p class="jv-promise"><b>The scope promise.</b> You will leave knowing where you stand.</p>');
    expect(page).toContain('<section class="jv-ways" aria-label="Decision rights"><div class="jv-way"><b>Trust anchor</b>');
    expect(page).not.toContain("<span>Delegation</span>");
    expect(page).toContain("A cover and 1 sheet,");
    // Printed, every sheet (the cover too) breaks to its own page.
    expect(at("assets/journeys.css")).toContain(".jv-print-sheets .jv-sheet { break-after: page;");
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0" }).success).toBe(true);
    const bad = WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0", presentation: { ...w.workshop.presentation, cover: { table: "nowhere" } } });
    expect(bad.success).toBe(false);
  });
  test("JV-06: on screen a drawn sheet is as tall as its content; the A3 shape is print's alone", () => {
    const css = at("assets/journeys.css");
    const screen = css.slice(0, css.indexOf("@media print"));
    const sheetRule = /\n\.jv-sheet \{[^}]*\}/.exec(screen)![0];
    expect(sheetRule).not.toContain("aspect-ratio");
    expect(sheetRule).not.toContain("overflow: hidden");
    expect(screen).not.toMatch(/\.jv-sheet-a4 \{[^}]*aspect-ratio/);
    expect(css).toMatch(/\.jv-print-sheets \.jv-sheet \{[^}]*width: 400mm; height: 277mm; overflow: hidden;/);
  });
  test("JV-06: a workshop's own canvas (sheetsSource) is the Table sheets panel, its files copied beside the discussion; the drawn sheets are the fallback", () => {
    put("top/canvas/country-canvas.docx", "docx bytes");
    put("top/canvas/country-canvas.pdf", "%PDF-1.7");
    put("top/canvas/pages/page-1.png", "png 1");
    put("top/canvas/pages/page-2.png", "png 2");
    const w0 = corpus.workshops[0]!;
    const sheetsSource = {
      title: "Country Canvas",
      docx: "../canvas/country-canvas.docx",
      pdf: "https://example.org/canvas.pdf",
      previews: ["../canvas/pages/page-1.png", "../canvas/pages/page-2.png", "../canvas/pages/missing.png"],
    };
    const w = { ...w0, workshop: { ...w0.workshop, sheetsSource } };
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0" }).success).toBe(true);
    const out = renderJourneyPages({ ...corpus, workshops: [w] }, LINKS, "top");
    const file = (path: string) => out.find((f) => f.path === path);
    const page = String(file("top/workshops/policy/discuss/index.html")!.content);
    // The previews in place of the drawn sheets, a page each, with the downloads and a print button.
    expect(page).not.toContain('class="jv-sheet ');
    expect(page).toContain('<h2 id="country-canvas">Country Canvas</h2>');
    expect(page).toContain('<figure class="jv-canvas-page jv-canvas-a3" id="canvas-page-1"><img src="canvas/page-1.png" alt="Country Canvas, page 1 of 2"');
    expect(page).toContain('src="canvas/page-2.png"');
    expect(page).not.toContain("missing.png");
    expect(page).toMatch(/<a class="jp-btn-line" href="canvas\/country-canvas\.docx" download>[\s\S]*?Download Word \(\.docx\)<\/a>/);
    // A URL is linked as given, not copied.
    expect(page).toMatch(/<a class="jp-btn-line" href="https:\/\/example\.org\/canvas\.pdf">[\s\S]*?Download PDF<\/a>/);
    expect(page).toContain("data-jp-sheets-print");
    expect(page).toContain('<summary class="jp-sheets-sum jp-noprint">');
    expect(page).toContain("<b>Country Canvas</b>");
    // The layer's files are copied beside the page, byte for byte; the URL is not.
    expect(new TextDecoder().decode(file("top/workshops/policy/discuss/canvas/page-1.png")!.content as Uint8Array)).toBe("png 1");
    expect(file("top/workshops/policy/discuss/canvas/country-canvas.docx")).toBeDefined();
    expect(out.some((f) => f.path.startsWith("top/workshops/policy/sheets/canvas/"))).toBe(false);
    expect(out.some((f) => f.path.endsWith("canvas.pdf"))).toBe(false);
    // The workshop's page links the panel; printed, a page image fills its page.
    expect(String(file("top/workshops/policy/index.html")!.content)).toContain('href="discuss/#sheets">Country Canvas</a>');
    expect(at("assets/journeys.css")).toContain(".jv-print-sheets .jv-canvas-page { break-after: page;");
    // The check names the file that is not there, and only that one.
    const refs = checkJourneyRefs({ ...corpus, workshops: [w] });
    const canvasFindings = refs.findings.filter((f) => f.at === "sheetsSource");
    expect(canvasFindings.map((f) => f.message)).toEqual(['"../canvas/pages/missing.png" is no file of instance top (read from the workshop file\'s directory)']);
    // None of its files resolves: the drawn sheets again.
    const none = { ...w0, workshop: { ...w0.workshop, sheetsSource: { previews: ["../nowhere.png"] } } };
    const fallback = String(renderJourneyPages({ ...corpus, workshops: [none] }, LINKS, "top").find((f) => f.path === "top/workshops/policy/discuss/index.html")!.content);
    expect(fallback).toContain('id="sheet-s1"');
    // A path out of the layer is no file of it.
    const out2 = { ...w0, workshop: { ...w0.workshop, sheetsSource: { docx: "../../../etc/passwd" } } };
    expect(renderJourneyPages({ ...corpus, workshops: [out2] }, LINKS, "top").some((f) => f.path.includes("/canvas/"))).toBe(false);
    // A sheetsSource naming no file is refused.
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0", sheetsSource: { title: "Nothing" } }).success).toBe(false);
    expect(WorkshopSchema.safeParse({ ...w.workshop, $schema: "workshop/0.1.0", sheetsSource: { docx: "x.docx", extra: 1 } }).success).toBe(false);
  });
  test("a canvas preview is shown no wider than its pixels, and the check warns when it is too coarse for its paper (owner, 2026-11-17: \"blurry\")", () => {
    // A PNG header (signature + IHDR) is all the size reader needs.
    const png = (w: number, h: number): Uint8Array => {
      const b = new Uint8Array(33);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      new DataView(b.buffer).setUint32(16, w);
      new DataView(b.buffer).setUint32(20, h);
      return b;
    };
    mkdirSync(join(REPO, "top/canvas/sharp"), { recursive: true });
    writeFileSync(join(REPO, "top/canvas/sharp/coarse.png"), png(1191, 842));
    writeFileSync(join(REPO, "top/canvas/sharp/fine.png"), png(3572, 2526));
    const w0 = corpus.workshops[0]!;
    const w = { ...w0, workshop: { ...w0.workshop, sheetsSource: { title: "Country Canvas", previews: ["../canvas/sharp/coarse.png", "../canvas/sharp/fine.png"] } } };
    const page = String(renderJourneyPages({ ...corpus, workshops: [w] }, LINKS, "top").find((f) => f.path === "top/workshops/policy/discuss/index.html")!.content);
    expect(page).toContain('<img src="canvas/coarse.png" width="1191" height="842" style="max-width:1191px" alt="Country Canvas, page 1 of 2"');
    expect(page).toContain('<img src="canvas/fine.png" width="3572" height="2526" style="max-width:3572px"');
    // Printed, an image fills its sheet whatever its pixels.
    expect(at("assets/journeys.css")).toContain(".jv-print-sheets .jv-canvas-page img { width: 100%; height: 100%; max-width: none !important;");
    const warned = checkJourneyRefs({ ...corpus, workshops: [w] }).warnings.filter((x) => x.at === "sheetsSource.previews").map((x) => x.message);
    expect(warned).toEqual(['canvas-preview: "../canvas/sharp/coarse.png" is 1191×842 px, 72 dpi for an A3 page, and soft on screen; export it at 200 dpi or more (e.g. `pdftoppm -r 216 -png` from the PDF)']);
    // A JPEG's size is read from its first frame header, past the segments before it.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x03, 0x4a, 0x04, 0xa8, 3, 0, 0, 0]);
    expect(imageSizeOf(jpeg)).toEqual({ width: 1192, height: 842 });
    expect(imageSizeOf(new TextEncoder().encode("png 1"))).toBeUndefined();
  });
  test("presentation.cast orders the cast everywhere; presentation.chapterTitles names a chapter", () => {
    const w0 = corpus.workshops[0]!;
    const w = { ...w0, workshop: { ...w0.workshop, presentation: { ...w0.workshop.presentation, cast: ["cleo", "ghost", "ana"], chapterTitles: { "p2-treated": "Crossing back" } } } };
    const p = presentationOf(corpus, w);
    // Declared first (an id no step names is dropped), then the rest in order of first appearance.
    expect(p.cast.map((c) => c.id)).toEqual(["cleo", "ana", "ben"]);
    expect(p.chapters.map((c) => c.title)).toEqual(["Checked", "Crossing back"]);
    expect(castOrder(["a", "b", "c"], undefined)).toEqual(["a", "b", "c"]);
    expect(castOrder(["a", "b", "c"], ["c", "c", "x"])).toEqual(["c", "a", "b"]);
  });
  test("personaText marks whole-word names, longest first, puts no avatar in the sentence, and escapes the rest", () => {
    const people = [
      { id: "a", name: "Anan", initials: "AN", color: "#000000" },
      { id: "d", name: "Dr. Anan", initials: "DA", color: "#111111" },
    ];
    const out = personaText("Dr. Anan meets Ananda <b>", people);
    expect(out).toBe('<span class="jp-named">Dr. Anan</span> meets Ananda &lt;b&gt;');
  });
  test("mentioned: the people a sentence names, in the cast's order, without the card's own person; their chips go in the header", () => {
    const people = [
      { id: "s", name: "Somsack", initials: "SS", color: "#65a30d" },
      { id: "k", name: "Khamla", initials: "KS", color: "#f43f5e" },
      { id: "v", name: "Vilay", initials: "VI", color: "#14b8a6" },
    ];
    expect(mentioned("Tells Vilay about Somsack, then Vilay again", people).map((p) => p.id)).toEqual(["s", "v"]);
    expect(mentioned("Khamla brings Somsack", people, "k").map((p) => p.id)).toEqual(["s"]);
    expect(mentionedChips("waits", people)).toBe("");
    expect(mentionedChips("Tells Vilay", people)).toContain('<span class="jp-mentions" title="With Vilay"><span class="jp-av jp-av-sm" style="--c:#14b8a6" title="Vilay" aria-hidden="true">VI</span></span>');
  });
  test("links out: kramdown anchors, page patterns, the site's root, JSON colouring", () => {
    expect(kramdownSlug("J1 — Born abroad (Thailand, birth day)")).toBe("j1--born-abroad-thailand-birth-day");
    expect(kramdownSlug("J1 Issue the newborn's birth-dose DVCs in Country A")).toBe("j1-issue-the-newborns-birth-dose-dvcs-in-country-a");
    expect(fillPattern("artifact/{type}-{id}.html", { type: "Immunization", id: "X" })).toBe("artifact/Immunization-X.html");
    expect(fromSite("vaxlink/", "../../")).toBe("../../vaxlink/");
    expect(fromSite("https://x.org/", "../../")).toBe("https://x.org/");
    expect(fromSite("/abs/", "../../")).toBe("/abs/");
    expect(siteRootFrom("../../", { route: "en/h/journeys", title: "" })).toBe("../../../../../");
    expect(highlightJson('{"a": "b<", "n": -1.5e3, "t": true, "z": null}')).toBe(
      '<span class="jp-j-pun">{</span><span class="jp-j-key">&quot;a&quot;</span>: <span class="jp-j-str">&quot;b&lt;&quot;</span><span class="jp-j-pun">,</span> <span class="jp-j-key">&quot;n&quot;</span>: <span class="jp-j-num">-1.5e3</span><span class="jp-j-pun">,</span> <span class="jp-j-key">&quot;t&quot;</span>: <span class="jp-j-lit">true</span><span class="jp-j-pun">,</span> <span class="jp-j-key">&quot;z&quot;</span>: <span class="jp-j-lit">null</span><span class="jp-j-pun">}</span>',
    );
    // An escaped quote stays inside its string.
    expect(highlightJson(JSON.stringify({ q: 'say "hi"' }))).toContain('<span class="jp-j-str">&quot;say \\&quot;hi\\&quot;&quot;</span>');
  });
  test("unescapeXml resolves each entity once: an escaped ampersand is not unescaped again", () => {
    expect(unescapeXml("&amp;lt;")).toBe("&lt;");
    expect(unescapeXml("newborn&#x27;s &#39;dose&#39; &lt;b&gt; &quot;x&quot; &apos;y&apos; &amp;")).toBe(`newborn's 'dose' <b> "x" 'y' &`);
    expect(unescapeXml("&unknown; & alone")).toBe("&unknown; & alone");
  });
  test("the views' pure helpers: feeling points, block usage, step refs, screens", () => {
    const p = presentationOf(corpus, corpus.workshops[0]!);
    expect(feelingPoints(p, "ana")).toEqual([{ index: 0, emotion: 1 }, { index: 1, emotion: -1 }]);
    expect(feelingPoints(p, "cleo")).toEqual([]);
    expect(blockUsage(p, "wallet").map((u) => `${u.s.step.id}:${u.role}`)).toEqual(["P2:shows the QR"]);
    expect(stepByRef(corpus, p, "p2-treated#P2")?.key).toBe("P2");
    expect(stepByRef(corpus, p, "P1")?.key).toBe("P1");
    expect(stepByRef(corpus, p, "t1-away#T1")).toBeUndefined();
    // No device-screen node shows a step here, so the workshop's own app is framed.
    expect(p.demo).toBe("frame");
    expect(screensFor(p, stepByRef(corpus, p, "P2")!).map((x) => x.id)).toEqual(["S2"]);
    expect(screenHref(p.w.workshop.presentation!, "S2", "../")).toBe("../app/#/demo/S2");
  });
  test("small ones", () => {
    expect(countWord(4)).toBe("Four");
    expect(countWord(40)).toBe("40");
    expect(rangeLabel([{ step: { id: "J1" } }, { step: { id: "J4.1" } }], "A ⇄ B")).toBe("J1 → J4.1 (A ⇄ B)");
    expect(rangeLabel([{ step: { id: "J1" } }])).toBe("J1");
    expect([...countryTones(["Thailand", "Lao PDR", "Thailand", undefined, "Cross-Border"])]).toEqual([["Thailand", "amber"], ["Lao PDR", "sky"], ["Cross-Border", "indigo"]]);
    const ladder = [{ code: "a", label: "A" }, { code: "b", label: "B" }];
    expect(rungOf(ladder, { record: { state: "b" } } as never)).toBe(1);
    expect(rungOf(ladder, {} as never)).toBe(-1);
    expect(viewBoxWidth('<svg width="100%" viewBox="95 55 1580 690">')).toBe(1580);
    expect(viewBoxWidth('<svg width="640px">')).toBe(640);
    expect(viewBoxWidth("<g/>")).toBeUndefined();
  });
});

describe("helpers", () => {
  test("orderByFollows walks each chain from its start", () => {
    const j = (id: string, follows?: string) => ({ instance: "x", file: "", scenario: { id, follows } }) as never;
    expect(orderByFollows([j("c", "b"), j("a"), j("b", "a"), j("z", "elsewhere")]).map((x: { scenario: { id: string } }) => x.scenario.id)).toEqual(["a", "b", "c", "z"]);
  });
  test("bpmnFigure never assembles a comment opener from a drawing's pieces", () => {
    // A one-pass strip turned this into an unclosed `<!--` that hid the rest of the page.
    const svg = '<svg><!<!---->--<g data-element-id="A"></g></svg>';
    const out = bpmnFigure(svg, ["A"], "c");
    expect(out).toContain("<!<!---->--<g");
    expect(out).not.toMatch(/<!--(?!--)<g/);
    expect(out).toContain('data-pt-highlight="A"');
    expect(out).toContain("<figcaption>c</figcaption>");
  });
  test("bpmnFigure leaves a drawing alone: no task named, no highlight; no sidecar, no panel", () => {
    const out = bpmnFigure('<svg><g data-element-id="A"></g></svg>', undefined, "c");
    expect(out).toContain('<g data-element-id="A"></g>');
    expect(out).not.toContain("data-pt-highlight");
    expect(out).not.toContain("data-panel");
    expect(bpmnFigure("<svg></svg>", ["A", "B", "A"], "c", "../x.tasks.json")).toContain('data-panel="../x.tasks.json" data-pt-highlight="A B"');
  });
  test("the common task panel's client and styles are written with the assets, and only a page with a drawing loads them", () => {
    expect(at("assets/task-panel.js")).toBe(`${PANEL_SCRIPT}\n`);
    expect(at("assets/task-panel.css")).toBe(`${PANEL_CSS}\n`);
    expect(at("index.html")).not.toContain("task-panel");
    expect(panelHead("<p>no drawing</p>", "../")).toBe("");
  });
});

// ── DAK links: diagrams clickable as the KG site renders them, assets linked into the IG ──

/** Where `href`, written on the page at site path `page`, lands: a site path, or the absolute URL as it is. */
const landsAt = (page: string, href: string): string => (/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : posix.normalize(posix.join(posix.dirname(page), href.replace(/[?#].*$/, ""))));
const sitePath = (path: string): string => `${LINKS.route}/${path}`;
const hrefsOf = (html: string, marker: string): string[] => [...html.matchAll(/<(?:a|object)\b[^>]*>/g)].map((m) => m[0]).filter((t) => t.includes(marker)).map((t) => /\s(?:href|data)="([^"]*)"/.exec(t)![1]!.replace(/&amp;/g, "&"));

describe("the drawings are clickable the way the KG site renders them", () => {
  const journey = sitePath("lower/p2-treated/index.html");
  const walk = sitePath("top/workshops/policy/walkthrough/P2/index.html");
  test("a BPMN step's TITLE links to its page (linkSteps), from the journey page's depth and the walkthrough's", () => {
    for (const [page, html] of [[journey, at("lower/p2-treated/index.html")], [walk, at("top/workshops/policy/walkthrough/P2/index.html")]] as const) {
      const titles = hrefsOf(html, 'class="fa-task-link"');
      expect(titles.length).toBe(2);
      expect(titles.map((h) => landsAt(page, h))).toEqual(["kg/lower/processes/care/P/node/Task_Read/", "kg/lower/processes/care/P/node/Task_Other/"]);
      // On the title alone, with its accessible name, and the highlight kept.
      expect(html).toMatch(/<a class="fa-task-link" href="[^"]+" target="_top" aria-label="Open step: Read the summary"><title>Open step: Read the summary<\/title><text class="djs-label">/);
      expect(html).toContain('data-pt-highlight="Task_Read"');
      // The ⓘ panel's sidecar, from the page's own depth, where the processes viewer writes it.
      expect(landsAt(page, /data-panel="([^"]+)"/.exec(html)![1]!)).toBe("en/kg/processes/care.tasks.json");
    }
  });
  test("an absolute step page (a subject IRI) is linked as it is", () => {
    const abs = renderJourneyPages(corpus, { ...LINKS, stepPage: (_i, _b, p, t) => `https://example.org/kg/process/${p}/node/${t}` }, "top");
    const html = String(abs.find((f) => f.path === "lower/p2-treated/index.html")!.content);
    expect(hrefsOf(html, 'class="fa-task-link"')).toContain("https://example.org/kg/process/P/node/Task_Read");
  });
  test("where no step page is published (a downstream site), a title links the process's section in the IG instead", () => {
    const none = renderJourneyPages(corpus, { ...LINKS, stepPage: () => undefined }, "top");
    for (const [path, page] of [["lower/p2-treated/index.html", sitePath("lower/p2-treated/index.html")], ["top/workshops/policy/walkthrough/P2/index.html", sitePath("top/workshops/policy/walkthrough/P2/index.html")]] as const) {
      const html = String(none.find((f) => f.path === path)!.content);
      const titles = hrefsOf(html, 'class="fa-task-link"');
      expect(titles.length).toBe(2);
      // `landsAt` drops the anchor: the page, then the anchor itself.
      expect(new Set(titles.map((h) => landsAt(page, h)))).toEqual(new Set(["business-processes.html"]));
      expect(titles.every((h) => h.endsWith("business-processes.html#read-the-patients-summary"))).toBe(true);
    }
  });
  test("an ArchiMate view is an <object>, so the elements in it open their pages; its data and caption resolve from the page", () => {
    const html = at("lower/p2-treated/index.html");
    expect(html).not.toMatch(/<img[^>]*archimate/);
    const obj = /<object type="image\/svg\+xml" data="([^"]+)" aria-label="P2 on the RA">/.exec(html);
    expect(obj).not.toBeNull();
    expect(landsAt(journey, obj![1]!)).toBe("archimate/ra/views/v-p2.svg");
    expect(hrefsOf(html, DAK_ATTR).map((h) => landsAt(journey, h))).toContain("en/lower/archimate/ra/views/v-p2/");
  });
});

describe("personas and other DAK assets link to their pages in the IG", () => {
  test("a persona plays a role the IG defines: its name links to that ActorDefinition; one with none stays text", () => {
    expect(pascal("birth-clinic-vaccinator")).toBe("BirthClinicVaccinator");
    expect(personaArtifact(corpus, "lower", "ana")).toBe("ActorDefinition/Demo.Role.Pilgrim");
    expect(personaArtifact(corpus, "lower", "ben")).toBeUndefined();
    const walk = at("top/workshops/policy/walkthrough/P2/index.html");
    const pages = [sitePath("top/workshops/policy/walkthrough/P2/index.html"), sitePath("lower/p2-treated/index.html"), sitePath("top/workshops/policy/overview/index.html")];
    const htmls = [walk, at("lower/p2-treated/index.html"), at("top/workshops/policy/overview/index.html")];
    htmls.forEach((html, i) => expect(hrefsOf(html, DAK_ATTR).map((h) => landsAt(pages[i]!, h))).toContain("ActorDefinition-Demo.Role.Pilgrim.html"));
    expect(walk).toContain("<b>Ben (nurse)</b>");
    // A name inside the prose is marked, linked the same way when its persona has a page, with no avatar in the sentence.
    const people = [{ id: "ana", name: "Ana", initials: "A", color: "#123456", artifact: "ActorDefinition/Demo.Role.Pilgrim" }, { id: "ben", name: "Ben", initials: "B", color: "#654321" }];
    const chips = personaText("Ana waits; Ben reads.", people, (x) => (x.artifact ? `../${x.artifact.replace("/", "-")}.html` : undefined));
    expect(chips).toMatch(/^<a class="jp-named" href="\.\.\/ActorDefinition-Demo\.Role\.Pilgrim\.html" data-jv-dak>Ana<\/a>/);
    expect(chips).toContain('<span class="jp-named">Ben</span>');
    expect(chips).not.toContain("jp-av");
  });
  test("a FHIR example links to its IG page, in the hood and in the payload drawer; a profile the index does not list stays text", () => {
    const page = sitePath("top/workshops/policy/walkthrough/P2/index.html");
    const walk = at("top/workshops/policy/walkthrough/P2/index.html");
    expect(hrefsOf(walk, DAK_ATTR).map((h) => landsAt(page, h))).toContain("Bundle-ana-ips.html");
    expect(walk).toMatch(/<p class="jp-pane-link"><a class="jp-ext" href="[^"]*Bundle-ana-ips\.html" data-jv-dak/);
    expect(walk).toContain('<span class="jp-prof" title="ips-bundle">Intl profile</span>');
  });
});

describe("a step's DAK assets: one row, grouped by what each is to the step, linked into the IG", () => {
  const dakPages = ["StructureDefinition-DdTreatment.html", "PlanDefinition-DT01.html", "Measure-IND02.html"];
  test("the walkthrough's hood draws Data, Decision logic, Indicators in that order, each asset linked; one the index does not list stays text", () => {
    const page = sitePath("top/workshops/policy/walkthrough/P2/index.html");
    const walk = at("top/workshops/policy/walkthrough/P2/index.html");
    const row = /<div class="jp-dak" data-jp-dak>[\s\S]*?<\/span><\/div><\/div>/.exec(walk)?.[0] ?? "";
    expect([...row.matchAll(/data-jp-dak-rel="([a-z]+)"/g)].map((m) => m[1])).toEqual(["data", "decides", "measures"]);
    expect([...row.matchAll(/<span class="jp-dak-l">.*?<\/svg>([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(["Data", "Decision logic", "Indicators"]);
    expect(hrefsOf(row, DAK_ATTR).map((h) => landsAt(page, h))).toEqual(dakPages);
    expect(row).toContain('title="StructureDefinition/DdTreatment — What the clinic records.">DD.P2 Treatment abroad</a>');
    expect(row).toContain('<span class="jp-dak-a jp-dak-text" title="Measure/IND99">IND99</span>');
  });
  test("the journey page's step lists the same assets under DAK assets", () => {
    const page = sitePath("lower/p2-treated/index.html");
    const html = at("lower/p2-treated/index.html");
    const dl = /<h4>DAK assets<\/h4><dl class="jv-dl jv-dak">[\s\S]*?<\/dl>/.exec(html)?.[0] ?? "";
    expect([...dl.matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1])).toEqual(["Data", "Decision logic", "Indicators"]);
    expect(hrefsOf(dl, DAK_ATTR).map((h) => landsAt(page, h))).toEqual(dakPages);
    expect(dl).toContain('<span class="jv-code" title="Measure/IND99">IND99</span>');
  });
  test("a step that names none draws no row", () => {
    expect(at("top/workshops/policy/walkthrough/P1/index.html")).not.toContain("data-jp-dak");
  });
});

describe("the check over a staged site: every DAK link resolves to a file", () => {
  const site = mkdtempSync(join(tmpdir(), "journeys-site-"));
  afterAll(() => rmSync(site, { recursive: true, force: true }));
  const write = (rel: string, body: string | Uint8Array): void => {
    mkdirSync(join(site, dirname(rel)), { recursive: true });
    writeFileSync(join(site, rel), body);
  };
  for (const f of files) write(sitePath(f.path), f.content);
  // What the rest of the site publishes: the IG's pages, the step pages, the ArchiMate view and the element it links.
  // Each target page, with an element for every anchor a link names on it.
  const anchors = new Map<string, Set<string>>();
  for (const f of files) if (f.path.endsWith(".html")) for (const h of hrefsOf(String(f.content), DAK_ATTR).concat(hrefsOf(String(f.content), 'class="fa-task-link"'))) {
    const t = landsAt(sitePath(f.path), h);
    if (/^[a-z]+:/.test(t)) continue;
    const ids = anchors.get(t) ?? new Set<string>();
    const id = /#(.+)$/.exec(h)?.[1];
    if (id) ids.add(id);
    anchors.set(t, ids);
  }
  const targets = new Set(anchors.keys());
  for (const [t, ids] of anchors) if (!t.endsWith(".svg")) write(t.endsWith("/") ? `${t}index.html` : t, `<!doctype html>${[...ids].map((id) => `<h3 id="${id}">x</h3>`).join("")}`);
  write("archimate/ra/views/v-p2.svg", '<svg xmlns="http://www.w3.org/2000/svg"><a href="../../../en/lower/archimate/ra/elements/wallet/" target="_top"><rect/></a></svg>');
  write("en/lower/archimate/ra/elements/wallet/index.html", "<!doctype html>");
  test("every rendered DAK link names a page the IG and the KG publish", () => {
    expect([...targets]).toEqual(expect.arrayContaining(["ActorDefinition-Demo.Role.Pilgrim.html", "Bundle-ana-ips.html", "PlanDefinition-DT01.html", "Measure-IND02.html", "StructureDefinition-DdTreatment.html", "kg/lower/processes/care/P/node/Task_Read/"]));
    const r = checkDakLinks(site, LINKS.route);
    expect(r.findings).toEqual([]);
    expect(r.checked).toBeGreaterThan(10);
  });
  test("a page that is not there, an element link inside a drawing that is not there, and the bare IHE VHL root are findings", () => {
    rmSync(join(site, "ActorDefinition-Demo.Role.Pilgrim.html"));
    rmSync(join(site, "en/lower/archimate/ra/elements/wallet/index.html"));
    write(sitePath("vhl/index.html"), '<a href="https://profiles.ihe.net/ITI/VHL/">VHL</a> <a href="https://profiles.ihe.net/ITI/VHL/volume-1.html">VHL</a>');
    const why = checkDakLinks(site, LINKS.route).findings.map((f) => `${f.page} ${f.why}`);
    expect(why.some((w) => w.includes("no file at ActorDefinition-Demo.Role.Pilgrim.html"))).toBe(true);
    expect(why.some((w) => w.startsWith("archimate/ra/views/v-p2.svg no file at en/lower/archimate/ra/elements/wallet/index.html"))).toBe(true);
    expect(why.filter((w) => w.includes("bare IHE VHL root"))).toHaveLength(1);
    // A page that is there, with an anchor that is not.
    write(sitePath("anchor/index.html"), '<a data-jv-dak href="../../../../Bundle-ana-ips.html#nowhere">x</a>');
    expect(checkDakLinks(site, LINKS.route).findings.some((f) => f.why === 'no id "nowhere" in Bundle-ana-ips.html')).toBe(true);
    expect(BARE_VHL.test("https://profiles.ihe.net/ITI/VHL")).toBe(true);
    expect(BARE_VHL.test("https://profiles.ihe.net/ITI/VHL/volume-1.html")).toBe(false);
  });
});

describe("composition (user-scenario 0.4.0): a parent's parts, in its order, and a step that is a journey", () => {
  // A checkout of its own: one layer, every journey of it 0.4.0. The
  // layer sits one level down, as `lower` and `top` do: a layer at
  // the temporary directory's top would make the system temporary directory
  // its checkout, read with every other test's fixtures in it.
  const ROOT = mkdtempSync(join(tmpdir(), "journeys-compose-"));
  afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
  const putc = (rel: string, body: object): void => {
    mkdirSync(join(ROOT, dirname(rel)), { recursive: true });
    writeFileSync(join(ROOT, rel), JSON.stringify(body, null, 2));
  };
  putc("compose/compose.json", {
    name: "compose",
    directories: [
      { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
      { id: "user-scenarios", path: "journeys/", graphTypologies: ["user-scenario"] },
    ],
  });
  putc("compose/scenarios/actors/ana.json", { id: "ana", title: "Ana", roles: ["traveller"], meta: { persona: { name: "Ana" } } });
  putc("compose/scenarios/roles.json", { roles: [{ id: "traveller", title: "Traveller" }] });
  const v04 = (id: string, title: string, extra: object) => ({ $schema: "user-scenario/0.4.0", id, title, description: "d", ...extra });
  putc("compose/journeys/trip.json", v04("trip", "C — The trip", { parts: [{ scenario: "home" }, { scenario: "away", optional: true, repeats: true }] }));
  putc("compose/journeys/away.json", v04("away", "C2 — Away", { personas: ["ana"], steps: [step("C2", "ana")] }));
  putc("compose/journeys/home.json", v04("home", "C1 — Home", { personas: ["traveller"], steps: [step("C1", "ana", { includes: "away" })] }));
  clearDeclaredVisualisers();
  const c = readJourneyCorpus(join(ROOT, "compose"));
  const pages = renderJourneyPages(c, { ...LINKS, route: "en/compose/journeys" }, "compose");
  const page = (path: string) => String(pages.find((x) => x.path === path)!.content);

  test("the parent's page lists its parts in its order, marking an optional or repeating one", () => {
    const trip = page("compose/trip/index.html");
    const parts = trip.slice(trip.indexOf("Parts, in story order"));
    expect(parts.indexOf("C1 — Home")).toBeGreaterThan(0);
    expect(parts.indexOf("C1 — Home")).toBeLessThan(parts.indexOf("C2 — Away"));
    const away = parts.slice(parts.indexOf("C2 — Away"), parts.indexOf("</a>", parts.indexOf("C2 — Away")));
    expect(away).toContain('class="jv-part-mark" title="The story may skip it">optional</span>');
    expect(away).toContain(">repeats</span>");
    // Its people are its parts', derived.
    expect(c.journeys.find((j) => j.scenario.id === "trip")!.scenario.personas).toEqual(["ana"]);
  });
  test("the index nests the parts in that order; a part's neighbours are its parent's", () => {
    const index = page("index.html");
    const trip = index.slice(index.indexOf("C — The trip"));
    expect(trip).toContain("2 parts");
    expect(trip.indexOf("C1 — Home")).toBeLessThan(trip.indexOf("C2 — Away"));
    const home = page("compose/home/index.html");
    expect(home).toContain('href="../../compose/trip/" rel="up"');
    expect(home).toContain('href="../../compose/away/" rel="next"');
  });
  test("a step that includes a journey links to it", () => {
    expect(page("compose/home/index.html")).toContain('<p class="jv-includes">This step is the journey <a href="../../compose/away/"><b>C2 — Away</b></a>.</p>');
  });
});
