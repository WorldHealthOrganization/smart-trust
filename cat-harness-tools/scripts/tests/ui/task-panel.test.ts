/**
 * The ⓘ task panel on process pages (implementation spec §6).
 *
 * @module scripts/tests/task-panel.test
 *
 * Owner, 2026-10-16: *"an info icon on each task (bpmn-js overlay) opens a
 * small UML object view: task → skill → methodology, and lane Role → skills.
 * Every skill, methodology and role in the panel is a link to its own page.
 * It loads only when opened."* Pinned here: markers land on the shapes the
 * SVG draws, the page carries markers and no panel data, the sidecar carries
 * the object view, and every name with a page is a link while a name without
 * one stays text.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  autoDocsRowId,
  diagramBlock,
  diagramBounds,
  markersFor,
  expandMarkerBox,
  methodologyPageDir,
  PANEL_CLIENT,
  panelFile,
  PANEL_SCRIPT,
  panelLinksReport,
  svgViewBox,
  taskSkillsDeclared,
  unlinkedPanelRefs,
} from "../../lib/task-panel.ts";
import { instanceRoots, panelContext, processPage, processRows, taskPanelData, type PanelContext, type ProcessRow } from "../../gen-processes-viz.ts";
import { skillLinksOf, skillTarget, sourceSkillPage } from "../../lib/skill-pages.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

// A real-corpus sweep: about five seconds on a loaded runner, past bun's 5s default.
const CORPUS_TIMEOUT = 60_000;

const BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="D" targetNamespace="x">
  <bpmn:process id="P"><bpmn:task id="T1" name="One"/><bpmn:task id="T2" name="Two"/></bpmn:process>
  <bpmndi:BPMNDiagram id="Di"><bpmndi:BPMNPlane id="Pl" bpmnElement="P">
    <bpmndi:BPMNShape id="S1" bpmnElement="T1"><dc:Bounds x="200" y="100" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

describe("marker placement", () => {
  test("the viewBox is read off the SVG root", () => {
    expect(svgViewBox(`<svg xmlns="x" width="100%" viewBox="155 55 830 530" version="1.1">`)).toEqual({ x: 155, y: 55, width: 830, height: 530 });
    expect(svgViewBox("<svg>")).toBeUndefined();
  });

  test("a marker sits on the shape's top-right corner, in percent; a task with no shape gets none", async () => {
    const bounds = await diagramBounds(BPMN);
    expect(bounds.get("T1")).toEqual({ x: 200, y: 100, width: 100, height: 80 });
    const m = markersFor([{ id: "T1", name: "One" }, { id: "T2", name: "Two" }], bounds, { x: 100, y: 50, width: 400, height: 200 });
    // The click box is the [+] marker's 24 × 24 hit area, never the whole shape (cat-harness#991).
    expect(m).toEqual([{ id: "T1", name: "One", left: 50, top: 25, box: { left: 34.38, top: 52.5, width: 6, height: 12 } }]);
  });

  test("the [+] hit area is centred on bpmn-js's marker, 24 square", () => {
    // bpmn-js: marker box at (width/2 - 7.5, height - 20), 14 × 14.
    expect(expandMarkerBox({ x: 0, y: 0, width: 120, height: 120 })).toEqual({ x: 47.5, y: 95, width: 24, height: 24 });
  });
});

describe("the page block", () => {
  test("markers and an empty panel, and the data is NOT inlined", () => {
    const html = diagramBlock({ img: "a.svg", alt: "BPMN diagram: P", markers: [{ id: "T1", name: "One <b>", left: 50, top: 25 }], panelHref: "p.tasks.json" }).join("\n");
    expect(html).toContain('data-panel="p.tasks.json"');
    expect(html).toContain('data-task="T1"');
    expect(html).toContain("left:50%;top:25%");
    expect(html).toContain("One &lt;b&gt;");
    expect(html).toContain("hidden></div>");
    // Fetched on open, not before.
    expect(PANEL_SCRIPT).toContain("fetch(");
    expect(PANEL_SCRIPT.indexOf("fetch(")).toBeGreaterThan(PANEL_SCRIPT.indexOf("function load"));
    // Liquid would eat a double brace in the page.
    expect(PANEL_SCRIPT).not.toMatch(/\{\{|\{%/);
    // Values go in as text, never as markup.
    expect(PANEL_SCRIPT).not.toContain("innerHTML");
  });

  test("a call activity's shape links to the called process; a plain task's does not", () => {
    const box = { left: 10, top: 20, width: 15, height: 12 };
    const html = diagramBlock({
      img: "a.svg",
      alt: "x",
      markers: [
        { id: "C1", name: "Call", left: 25, top: 20, box, href: "sub.html" },
        { id: "T1", name: "Task", left: 50, top: 25, box },
      ],
      panelHref: "p.tasks.json",
    }).join("\n");
    expect(html).toContain('<a class="pt-go" href="sub.html" style="left:10%;top:20%;width:15%;height:12%"');
    expect(html.match(/class="pt-go"/g)?.length).toBe(1);
    // Markers and links sit in the layer the client lays over the drawing.
    expect(html.indexOf('<div class="pt-layer">')).toBeLessThan(html.indexOf('class="pt-go"'));
    expect(html.indexOf('class="pt-mark"')).toBeLessThan(html.indexOf('class="pt-panel"'));
    // The ⓘ is still there for both, so the details stay one click away.
    expect(html).toContain('data-task="C1"');
    expect(html).toContain('data-task="T1"');
  });

  test("no markers → the plain image it always was", () => {
    expect(diagramBlock({ img: "a.svg", alt: "x", markers: [], panelHref: "p" })).toEqual(['<img src="a.svg" alt="x" style="max-width:100%">']);
  });
});

describe("link spellings", () => {
  test("a methodology page is <instance>/<name>/, as #422 spells it", () => {
    expect(methodologyPageDir("cat-harness", "raci")).toBe("cat-harness/raci/");
  });
  test("a role link lands on gen-auto-docs' row id", () => {
    expect(autoDocsRowId("cat-harness/scenarios/roles.json#reviewer")).toBe("a-cat-harness-scenarios-roles-json-reviewer");
  });
});

describe("the object view", () => {
  const row = {
    id: "P",
    file: "procs/p.bpmn",
    stem: "p",
    name: "P",
    steps: [
      { id: "T1", name: "Review", lane: "Reviewers", type: "bpmn:UserTask", skills: ["review", "unpaged"] },
      { id: "T2", name: "Anyone", lane: "Actor", type: "bpmn:Task", skills: [] },
      { id: "C1", name: "Go deeper", lane: "Reviewers", type: "bpmn:CallActivity", skills: [], calledElement: "Q" },
      { id: "C2", name: "Go elsewhere", lane: "Reviewers", type: "bpmn:CallActivity", skills: [], calledElement: "R" },
    ],
    laneDetails: [
      {
        id: "L1",
        name: "Reviewers",
        roleRef: "lead",
        binding: "bound",
        roleId: "lead",
        roleSkills: [
          { skill: "review", via: "reviewer", depth: 1 },
          { skill: "sign-off", via: "lead", depth: 0 },
        ],
        activitySkills: ["review"],
      },
      { id: "L2", name: "Actor", binding: "variable", roleSkills: [], activitySkills: [] },
    ],
  } as unknown as ProcessRow;
  const ctx: PanelContext = {
    skillHref: (s) => (s === "unpaged" ? undefined : `../../../reference/skill-instructions/${s}.html`),
    methodologyHref: (m) => (m === "raci" ? "../../../en/cat-harness/methodologies/cat-harness/raci/" : undefined),
    roleHref: (r) => `../../../cat-harness/auto-docs/index/roles/index.html#a-${r}`,
    roleTitle: (r) => (r === "lead" ? "Lead reviewer" : undefined),
    usesMethodology: (s) => (s === "review" ? ["raci", "unknown-method"] : undefined),
    // Only `procs/` publishes subject pages here; `boot/` stands for a
    // layer whose graph still mints fragments (bootstrap, until #603's phase 2).
    subjectHref: (file, kind, id) => (file.startsWith("procs/") ? `https://e.org/i/${kind}/${id}` : undefined),
  };
  const called = { id: "Q", file: "procs/q.bpmn", stem: "q", name: "Q", steps: [], laneDetails: [] } as unknown as ProcessRow;
  const elsewhere = { id: "R", file: "boot/r.bpmn", stem: "r", name: "R", steps: [], laneDetails: [] } as unknown as ProcessRow;
  const data = taskPanelData(row, [row, called, elsewhere], ctx);

  test("the step, its lane and its process link to their own pages — subject IRIs, not fragments (#603)", () => {
    expect(data.processHref).toBe("https://e.org/i/process/P");
    const t = data.tasks["T1"]!;
    expect(t.href).toBe("https://e.org/i/process/P/node/T1");
    expect(t.laneHref).toBe("https://e.org/i/process/P/lane/L1");
    for (const href of [data.processHref, t.href, t.laneHref]) expect(href).not.toContain("#");
  });

  test("a call goes to the called process's page, keeping its diagram one step away", () => {
    expect(data.tasks["C1"]!.calls).toEqual({ name: "Q", href: "https://e.org/i/process/Q", diagram: "q.html" });
    // No published page for it → the diagram, as before.
    expect(data.tasks["C2"]!.calls).toEqual({ name: "R", href: "r.html", diagram: "r.html" });
  });

  test("task → skills → methodologies, each a link where a page exists", () => {
    const t = data.tasks["T1"]!;
    expect(t.skills[0]).toEqual({
      name: "review",
      href: "../../../reference/skill-instructions/review.html",
      methodologies: [
        { name: "raci", href: "../../../en/cat-harness/methodologies/cat-harness/raci/" },
        { name: "unknown-method" },
      ],
    });
    // No page → no href, and no `uses-methodology` → no methodologies key at all.
    expect(t.skills[1]).toEqual({ name: "unpaged" });
  });

  test("lane Role → its skills, inherited ones naming where they came from", () => {
    const r = data.tasks["T1"]!.role!;
    expect(r.name).toBe("lead");
    expect(r.href).toContain("#a-lead");
    expect(r.title).toBe("Lead reviewer");
    expect(r.skills).toEqual([
      { name: "review", href: "../../../reference/skill-instructions/review.html", via: "reviewer" },
      { name: "sign-off", href: "../../../reference/skill-instructions/sign-off.html" },
    ]);
  });

  test("a lane naming no role says why, rather than showing nothing", () => {
    expect(data.tasks["T2"]!.role).toBeUndefined();
    expect(data.tasks["T2"]!.binding).toBe("variable");
  });
  test("skills are shown unless the site switches them off, and the data says which", () => {
    expect(data.skills).toBeUndefined();
    const off = taskPanelData(row, [row, called, elsewhere], ctx, { skills: false });
    expect(off.skills).toBe(false);
    expect(off.tasks["T1"]!.skills).toEqual([]);
    expect(off.tasks["T1"]!.role!.skills).toEqual([]);
    // Everything else the graph knows about the task is still there.
    expect(off.tasks["T1"]!.href).toBe(data.tasks["T1"]!.href);
    expect(off.tasks["T1"]!.role!.name).toBe("lead");
    expect(off.tasks["C1"]!.calls).toEqual(data.tasks["C1"]!.calls);
  });

  test("the title opens the step's description on its process page; the subject page stays on the id", () => {
    // Owner, 2026-11-08: "title of task should skip to description thats below".
    expect(data.tasks["T1"]!.stepHref).toBe("p.html#step-T1");
    expect(data.tasks["T1"]!.href).toBe("https://e.org/i/process/P/node/T1");
    expect(processPage({ ...row, decisions: [] } as ProcessRow, [row, called, elsewhere], new Set())).toContain('<a id="step-T1"></a>');
  });

  test("with no subject pages, the lane lands on its row and the process on its page", () => {
    const boot = { ...row, file: "boot/p.bpmn" } as ProcessRow;
    const d = taskPanelData(boot, [boot], ctx);
    expect(d.processHref).toBe("p.html");
    expect(d.tasks["T1"]!.href).toBeUndefined();
    expect(d.tasks["T1"]!.laneHref).toBe("p.html#lane-L1");
    expect(processPage({ ...boot, decisions: [] } as ProcessRow, [boot], new Set())).toContain('<a id="lane-L1"></a>');
  });

  test("the QA report names every panel name that links nowhere, once per kind", () => {
    const refs = unlinkedPanelRefs(data);
    expect(refs).toContainEqual({ kind: "skill", name: "unpaged", task: "T1" });
    expect(refs).toContainEqual({ kind: "methodology", name: "unknown-method", task: "T1" });
    // Linked names are not reported.
    expect(refs.some((x) => x.name === "review" || x.name === "lead")).toBe(false);
    const page = panelLinksReport(new Map([["p", { title: "P", refs }]]), "generated: x");
    expect(page).toContain("## skill");
    expect(page).toContain("[P](p.html#step-T1)");
    expect(panelLinksReport(new Map([["p", { title: "P", refs: [] }]]), "generated: x")).toContain("Every name in every panel links");
    // Skills switched off: none are shown, so none are reported.
    expect(unlinkedPanelRefs(taskPanelData(row, [row, called, elsewhere], ctx, { skills: false })).some((x) => x.kind === "skill")).toBe(false);
  });

  test("the markers travel with the data, so another page can draw them", () => {
    const m = [{ id: "T1", name: "Review", left: 10, top: 20 }];
    expect(taskPanelData({ ...row, markers: m } as ProcessRow, [row], ctx).markers).toEqual(m);
    expect(data.markers).toBeUndefined();
  });
});

describe("the site's switch (index.config.json site.taskSkills)", () => {
  const at = (site: unknown): string => {
    const d = mkdtempSync(join(tmpdir(), "task-skills-"));
    writeFileSync(join(d, "index.config.json"), JSON.stringify({ $schema: "folio-index-config/v1", instances: [], ...(site ? { site } : {}) }));
    return d;
  };
  test("absent → on, as every knowledge-graph site has it", () => {
    expect(taskSkillsDeclared(at(undefined))).toBe(true);
    expect(taskSkillsDeclared(mkdtempSync(join(tmpdir(), "no-index-")))).toBe(true);
  });
  test("declared → as declared", () => {
    expect(taskSkillsDeclared(at({ taskSkills: false }))).toBe(false);
    expect(taskSkillsDeclared(at({ taskSkills: true }))).toBe(true);
  });
});

describe("the client, for a page other than the process page", () => {
  test("hrefs resolve against the sidecar, not the page that loads it", () => {
    expect(PANEL_SCRIPT).toContain('var sidecar = root.getAttribute("data-panel");');
    expect(PANEL_SCRIPT).toContain('new URL(sidecar || "", location.href)');
    expect(PANEL_SCRIPT).toContain("e.href = abs(l.href)");
  });
  test("with no server-drawn layer, the markers come from the data", () => {
    expect(PANEL_SCRIPT).toContain("j.markers || []");
  });
  test("skills switched off: no skill box, no role skill list, no 'names no skill'", () => {
    expect(PANEL_SCRIPT).toContain("data.skills === false");
    expect(PANEL_SCRIPT).toMatch(/if \(sk_on && !t\.skills\.length/);
  });
  test("it parses, and a page can pick out steps (data-pt-highlight), as a journey's step does", () => {
    // input-site: inert #097c83cd — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    expect(() => new Function(PANEL_SCRIPT)).not.toThrow();
    expect(PANEL_SCRIPT).toContain('getAttribute("data-pt-highlight")');
    expect(PANEL_SCRIPT).toContain(".split(/\\s+/)");
  });
  test("the client and styles are published as files under fixed names", () => {
    expect(PANEL_CLIENT).toEqual({ script: "task-panel.js", style: "task-panel.css" });
    expect(panelFile("care")).toBe("care.tasks.json");
  });
  test("an inline drawing's viewBox is split on its spaces, so the markers keep its aspect", () => {
    // In the template literal a lone backslash-s was an "s": "0 0 500 400" never split.
    expect(PANEL_SCRIPT).toContain(".split(/[\\s,]+/).map(Number)");
  });
  test("a drawing with no sidecar is highlighted and fetches nothing", () => {
    expect(PANEL_SCRIPT).toContain('var sidecar = root.getAttribute("data-panel");');
    expect(PANEL_SCRIPT).toContain("if (!drawn && sidecar) load()");
  });
});

describe("a skill's link", () => {
  test("its instruction page, else its source file, else nothing", () => {
    const pages = Object.assign(new Set(["paged"]), { sources: new Map([["sourced", "https://github.com/o/r/blob/main/skills/sourced.md"]]) });
    expect(skillTarget("paged", "../../", pages)).toBe("../../reference/skill-instructions/paged.html");
    expect(skillTarget("sourced", "../../", pages)).toBe("https://github.com/o/r/blob/main/skills/sourced.md");
    expect(skillTarget("nowhere", "../../", pages)).toBeUndefined();
    expect(skillTarget("sourced", "../../", new Set())).toBeUndefined();
  });

  test("a page rendered on this site wins over the source link", () => {
    const pages = Object.assign(new Set<string>(), {
      sources: new Map([["s", "https://github.com/o/r/blob/main/skills/s.md"]]),
      local: new Map([["s", "en/h/processes/skills/s.html"]]),
    });
    expect(skillTarget("s", "../../", pages)).toBe("../../en/h/processes/skills/s.html");
  });

  test("a skill rendered from its source keeps its body, and its relative links resolve", () => {
    const text = "---\nname: s\ndescription: >\n  Does a\n  thing.\n---\n\n# S\n\nSee [t](t.md#x), [u](u.md), [schema](../schemas/a.json), [web](https://e.org/) and [here](#y).\n";
    const p = sourceSkillPage("s", text, "https://github.com/o/r/blob/main/skills/s.md", new Set(["t"]));
    expect(p.description).toBe("Does a thing.");
    expect(p.body).not.toContain("description:");
    expect(p.body).toContain("[t](t.html#x)");
    expect(p.body).toContain("[u](https://github.com/o/r/blob/main/skills/u.md)");
    expect(p.body).toContain("[schema](https://github.com/o/r/blob/main/schemas/a.json)");
    expect(p.body).toContain("[web](https://e.org/)");
    expect(p.body).toContain("[here](#y)");
  });
});

// The real corpus, read once at module load so a test whose precondition this
// checkout lacks is reported SKIPPED rather than passing having checked nothing.
const REPO = resolve(dirname(HARNESS_ROOT));
const CORPUS_ROWS = await processRows(REPO);
const RENDERED = CORPUS_ROWS.filter((r) => r.svg !== undefined && r.loadError === undefined);
/** The checkout has rendered process art on disk. */
const HAS_RENDERED_ART = RENDERED.length > 0 && existsSync(join(REPO, RENDERED[0]!.svg!));
const CORPUS_LINKS = skillLinksOf(REPO, instanceRoots(REPO));
const corpusLinkable = (s: string): boolean => CORPUS_LINKS.has(s) || (CORPUS_LINKS.sources?.has(s) ?? false);
/** Process_Discussion loads and its confirm-harness skill is linkable from this checkout. */
const HAS_CONFIRM_HARNESS = CORPUS_ROWS.some((r) => r.id === "Process_Discussion" && r.loadError === undefined) && corpusLinkable("confirm-harness");

describe("the real corpus", () => {
  test.skipIf(!HAS_RENDERED_ART)("a rendered diagram gets markers, and its page carries the panel", () => {
    const rows = RENDERED;
    const withMarkers = rows.filter((r) => (r.markers ?? []).length > 0);
    expect(withMarkers.length).toBeGreaterThan(0);
    const r = withMarkers[0]!;
    expect(r.markers!.every((m) => m.left >= 0 && m.left <= 100 && m.top >= 0 && m.top <= 100)).toBe(true);
    expect(processPage(r, rows, new Set())).toContain(`data-panel="${r.stem}.tasks.json"`);
  }, CORPUS_TIMEOUT);

  test("the host's process, step and lane link to their subject IRIs (#603)", async () => {
    const rows = (await processRows(REPO)).filter((r) => r.loadError === undefined);
    const host = rows.find((r) => r.file.startsWith("cat-harness/") && r.steps.length > 0 && r.laneDetails.length > 0);
    expect(host).toBeDefined();
    const d = taskPanelData(host!, rows, panelContext(REPO));
    expect(d.processHref).toMatch(new RegExp(`^https?://[^#]+/process/${host!.id}$`));
    const st = host!.steps[0]!;
    expect(d.tasks[st.id]!.href).toBe(`${d.processHref}/node/${st.id}`);
  }, CORPUS_TIMEOUT);

  test.skipIf(!HAS_CONFIRM_HARNESS)("every skill a panel names links somewhere — bootstrap's confirm-harness to its source (owner, 2026-11-08)", () => {
    const rows = CORPUS_ROWS.filter((r) => r.loadError === undefined);
    const ctx = panelContext(REPO);
    // What this checkout can link: a page, or a source file the forge can
    // place. Standing alone (no index lock, no origin) the forge places
    // nothing, and a skill whose layer is not here has no file at all; the
    // QA page reports those, and this guards the rest.
    const linkable = corpusLinkable;
    const discussion = rows.find((r) => r.id === "Process_Discussion")!;
    const s = taskPanelData(discussion, rows, ctx).tasks["A_ListHarnesses"]!.skills.find((x) => x.name === "confirm-harness");
    expect(s?.href).toMatch(/confirm-harness\.(html|md)$/);
    const unlinked = rows.flatMap((r) =>
      unlinkedPanelRefs(taskPanelData(r, rows, ctx))
        .filter((x) => (x.kind === "skill" || x.kind === "role-skill") && linkable(x.name))
        .map((x) => `${r.file}: ${x.kind} ${x.name} at ${x.task}`),
    );
    expect(unlinked).toEqual([]);
  }, CORPUS_TIMEOUT);

  test("every linkable skill a panel names has a link, whichever layers this checkout holds", () => {
    // The sweep above, run unconditionally: it needs no particular process or
    // skill to be present, so its guard is never lost to a skip.
    const rows = CORPUS_ROWS.filter((r) => r.loadError === undefined);
    const ctx = panelContext(REPO);
    const unlinked = rows.flatMap((r) =>
      unlinkedPanelRefs(taskPanelData(r, rows, ctx))
        .filter((x) => (x.kind === "skill" || x.kind === "role-skill") && corpusLinkable(x.name))
        .map((x) => `${r.file}: ${x.kind} ${x.name} at ${x.task}`),
    );
    expect(unlinked).toEqual([]);
  }, CORPUS_TIMEOUT);
});
