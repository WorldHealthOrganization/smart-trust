#!/usr/bin/env bun
/**
 * Write the workshop pages `workshop-answers.e2e.ts` serves: a journey of two
 * steps and a workshop whose lab shows module M5's questions in two of its
 * steps ("Who decides" and "Map"), as a content layer's policy track
 * may, with a summary step and a drawn sheet (the Table sheets panel), and a canvas sheet whose field J4.0a's question is. Drawn by the REAL journeys viewer (`renderJourneyPages`), so the
 * browser runs the shipped `present.js` against the shipped markup.
 *
 *   bun run cat-harness-tools/test/workshop-answers-fixture.build.ts <out-dir>
 *
 * The site lands in `<out-dir>/site`; `<out-dir>/site/paths.json` names the
 * walkthrough step and the Discussion view, site-relative.
 *
 * @module test/workshop-answers-fixture.build
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

import { readJourneyCorpus } from "../scripts/journeys/read.ts";
import { renderJourneyPages, type SiteLinks } from "../scripts/journeys/render.ts";
import { clearDeclaredVisualisers } from "../scripts/viewer-declarations.ts";

const out = process.argv[2];
if (!out) {
  console.error("usage: workshop-answers-fixture.build.ts <out-dir>");
  process.exit(2);
}
const repo = join(out, "repo");
const site = join(out, "site");
const put = (root: string, rel: string, body: string | object | Uint8Array): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body, null, 2));
};

const step = (id: string) => ({ id, title: `Step ${id}`, lead: "ana", experiences: [{ actor: "ana", doing: `does ${id}`, emotion: 1 }] });

put(repo, "demo/demo.json", {
  name: "demo",
  title: "Demo",
  directories: [
    { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
    { id: "user-scenarios", path: "scenarios/user-scenarios/", graphTypologies: ["user-scenario"] },
    { id: "workshops", path: "workshops/", graphTypologies: ["workshop"] },
  ],
  visualisers: [{ id: "journeys", renderedBy: "journeys-viewer", coversKinds: ["user-scenario", "workshop"], subgraphs: "instance" }],
});
put(repo, "demo/scenarios/actors/ana.json", { id: "ana", title: "Ana (pilgrim)", kind: "person", meta: { persona: { name: "Ana", role: "Pilgrim" } } });
put(repo, "demo/scenarios/user-scenarios/j4.json", {
  $schema: "user-scenario/0.2.0",
  id: "j4-home",
  title: "J4 — Home",
  description: "Ana's record is held at home.",
  personas: ["ana"],
  steps: [step("J4.0a"), step("J4.0b")],
});
put(repo, "demo/workshops/track.json", {
  $schema: "workshop/0.1.0",
  id: "track",
  title: "Policy track",
  description: "Taught from Ana's journey.",
  scenarios: ["j4-home"],
  modules: [
    { id: "M1", title: "Capabilities", sheet: "s1" },
    { id: "M5", title: "Governance, decision rights and the legal basis" },
  ],
  steps: [
    { scenario: "j4-home", step: "J4.0a", questions: [{ module: "M5", text: "Who may read it?", canvas: "rights:who" }] },
    {
      scenario: "j4-home",
      step: "J4.0b",
      questions: [
        { module: "M5", text: "What legal basis lets a record held at home be opened by a clinician abroad, on the family’s consent?" },
        { module: "M1", text: "What had to exist?" },
      ],
    },
  ],
  sheets: [{ id: "s1", label: "Sheet 1", title: "Our journey", size: "A3", modules: ["M1"] }],
  canvas: {
    title: "Country Canvas",
    sheets: [
      {
        id: "rights",
        label: "Sheet 5",
        title: "Who decides",
        sections: [
          {
            id: "main",
            fields: [
              { id: "who", type: "text", label: "Who may read the record", lines: 2 },
              { id: "stage", type: "choice", label: "Where we are", options: [{ id: "pilot", label: "Pilot" }, { id: "scale", label: "At scale" }] },
            ],
          },
        ],
      },
    ],
  },
  lab: {
    steps: [
      { id: "canvas", label: "Canvas", title: "Our canvas", canvas: ["rights"] },
      { id: "who-decides", label: "Who decides", title: "Who holds it?", modules: ["M5"] },
      { id: "map", label: "Map", title: "Where it meets", modules: ["M1", "M5"] },
      { id: "summary", label: "Summary", title: "Our summary", summary: true },
    ],
  },
});
clearDeclaredVisualisers();

const links: SiteLinks = {
  route: "en/demo/journeys",
  title: "Demo",
  stepPage: (instance, bpmn, process, task) => `kg/${instance}/${bpmn.replace(/\.bpmn$/, "")}/${process}/node/${task}/`,
  processPanel: (_instance, bpmn) => `en/kg/processes/${posix.basename(bpmn, ".bpmn")}.tasks.json`,
};
const files = renderJourneyPages(readJourneyCorpus(join(repo, "demo")), links, "demo");
for (const f of files) put(site, f.path, f.content);
const find = (suffix: string): string => {
  const f = files.find((x) => x.path.endsWith(suffix));
  if (!f) throw new Error(`no page ending ${suffix}; have ${files.map((x) => x.path).join(", ")}`);
  return f.path.replace(/index\.html$/, "");
};
put(site, "paths.json", { walkthroughA: find("/workshops/track/walkthrough/J4.0a/index.html"), walkthrough: find("/workshops/track/walkthrough/J4.0b/index.html"), discuss: find("/workshops/track/discuss/index.html"), sheets: find("/workshops/track/sheets/index.html"), map: find("/workshops/track/map/index.html") });
