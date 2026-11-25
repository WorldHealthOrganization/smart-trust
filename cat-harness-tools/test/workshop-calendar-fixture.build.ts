#!/usr/bin/env bun
/**
 * Write the workshop pages `workshop-calendar.e2e.ts` serves: two tracks of
 * one event, a technical workshop holding the two-day schedule and a policy
 * workshop that holds none and shows the technical one's, both teaching from
 * a journey set in a fictional country. The technical workshop's description
 * is Markdown with headings and a table and it gives no story, the shape that
 * drew the whole description as one heading on the overview (owner,
 * 2026-11-18). Drawn by the REAL journeys viewer (`renderJourneyPages`).
 *
 *   bun run cat-harness-tools/test/workshop-calendar-fixture.build.ts <out-dir>
 *
 * The site lands in `<out-dir>/site`; `<out-dir>/site/paths.json` names the
 * pages, site-relative.
 *
 * @module test/workshop-calendar-fixture.build
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

import { readJourneyCorpus } from "../scripts/journeys/read.ts";
import { renderJourneyPages, type SiteLinks } from "../scripts/journeys/render.ts";
import { clearDeclaredVisualisers } from "../scripts/viewer-declarations.ts";

const out = process.argv[2];
if (!out) {
  console.error("usage: workshop-calendar-fixture.build.ts <out-dir>");
  process.exit(2);
}
const repo = join(out, "repo");
const site = join(out, "site");
const put = (root: string, rel: string, body: string | object): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
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
put(repo, "demo/scenarios/user-scenarios/j1.json", {
  $schema: "user-scenario/0.2.0",
  id: "j1-birth",
  title: "J1 — Birth",
  description: "Ana is born in Taifafeki.",
  country: "Taifafeki",
  personas: ["ana"],
  steps: [step("J1"), step("J2")],
});
put(repo, "demo/workshops/policy.json", {
  $schema: "workshop/0.1.0",
  id: "policy",
  title: "Policy track",
  description: "The policy track.",
  scenarios: ["j1-birth"],
  modules: [{ id: "M1", title: "From journey to capabilities", day: 1 }, { id: "M2", title: "The reference architecture", day: 1 }],
});
put(repo, "demo/workshops/technical.json", {
  $schema: "workshop/0.1.0",
  id: "technical",
  title: "Technical track",
  description:
    "The technical track of a general two-day workshop, taught from the journey of one family in Taifafeki. It runs beside the [policy track](../policy/).\n\n## The two days\n\n### Day 1\n\n| Time | Session |\n|---|---|\n| 08:30–09:00 | Registration |",
  scenarios: ["j1-birth"],
  modules: [{ id: "T1", title: "Building with FHIR", day: 1 }, { id: "T2", title: "Offline data capture", day: 1 }],
  schedule: {
    intro: "A suggested timetable: a host adapts the times.",
    tracks: [{ id: "policy", label: "Policy track", workshop: "policy" }, { id: "technical", label: "Technical track" }],
    days: [
      {
        day: 1,
        summary: "Concepts and the stack, with a country panel from Taifafeki.",
        slots: [
          { start: "08:30", end: "09:00", kind: "logistics", title: "Registration and login", note: "Support crew" },
          { start: "09:00", end: "10:30", kind: "joint", title: "The story we follow", note: "Workshop hosts", sessions: ["P1.1 Welcome", "P1.4 Country panel: Taifafeki"] },
          { start: "10:30", end: "11:00", kind: "break", title: "Coffee" },
          { start: "11:00", end: "12:30", kind: "session", track: "policy", module: "M1", title: "From journey to capabilities" },
          { start: "11:00", end: "11:40", kind: "session", track: "technical", module: "T1", title: "Talk 1: Building with FHIR", type: "Talk" },
          { start: "11:40", end: "12:30", kind: "session", track: "technical", module: "T2", title: "Lab 1: Offline data capture", type: "Lab" },
        ],
      },
      {
        day: 2,
        slots: [
          { start: "09:00", end: "10:30", kind: "joint", title: "Recap and today's plan" },
          { start: "10:30", end: "12:00", kind: "session", track: "policy", module: "M2", title: "The reference architecture" },
          { start: "10:30", end: "12:00", kind: "session", track: "technical", module: "T2", title: "Team build", type: "Lab" },
        ],
      },
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
put(site, "paths.json", {
  techOverview: find("/workshops/technical/overview/index.html"),
  policyOverview: find("/workshops/policy/overview/index.html"),
  techPage: find("/workshops/technical/index.html"),
  policyPage: find("/workshops/policy/index.html"),
});
