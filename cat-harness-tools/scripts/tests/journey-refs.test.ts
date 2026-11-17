/**
 * `check:journey-refs` over two fixture checkouts: one where every reference a
 * journey and a workshop name resolves, and the same checkout with one broken
 * reference of each sort. Every person in them is fictional.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { checkJourneyRefsAt } from "../journeys/check.ts";
import { clearDeclaredVisualisers } from "../viewer-declarations.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

type Files = Record<string, string | object>;

const step = (id: string, extra: object = {}) => ({
  id,
  title: `Step ${id}`,
  lead: "kamal",
  experiences: [{ actor: "kamal", doing: `does ${id}`, emotion: 0 }, { actor: "reem", doing: "helps" }],
  ...extra,
});

/** The process P4 is realised by: two lanes, one a role by reference and one by name, and a call into another process. */
const BPMN_CARE = `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs"><bpmn:process id="Process_Care">
<bpmn:laneSet id="LS"><bpmn:lane id="Lane_P" name="Pilgrim" partitionElementRef="pilgrim"><bpmn:flowNodeRef>Task_Show</bpmn:flowNodeRef></bpmn:lane>
<bpmn:lane id="Lane_N" name="Nurse"><bpmn:flowNodeRef>Task_Scan</bpmn:flowNodeRef><bpmn:flowNodeRef>Call_Triage</bpmn:flowNodeRef></bpmn:lane></bpmn:laneSet>
<bpmn:task id="Task_Show" name="Show the code"/><bpmn:task id="Task_Scan" name="Scan"/><bpmn:callActivity id="Call_Triage" name="Triage" calledElement="Process_Triage"/><bpmn:callActivity id="Call_Unnamed"/>
</bpmn:process></bpmn:definitions>`;
const BPMN_TRIAGE = '<?xml version="1.0"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs2"><bpmn:process id="Process_Triage"><bpmn:task id="Task_Triage" name="Triage"/></bpmn:process></bpmn:definitions>';

/** A checkout of two layers: `base` holds actors, a catalogue beside its ArchiMate, a requirement and an example index; `demo` holds the journeys, the BPMN they name (instance-relative) and a workshop. */
function clean(): Files {
  return {
    "base/base.json": {
      name: "base",
      directories: [
        { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
        { id: "processes", path: "processes/", graphTypologies: ["processes"] },
        { id: "skills", path: "skills/", graphTypologies: ["skills"] },
        { id: "code-lists", path: "code-lists/", graphTypologies: ["code-list"] },
        { id: "archimate", path: "archimate/", graphTypologies: ["archimate"] },
        { id: "building-blocks", path: "archimate/building-blocks/", graphTypologies: ["building-blocks"] },
        { id: "fhir", path: "fhir/", graphTypologies: ["fhir-artifact-index"] },
      ],
    },
    "base/scenarios/actors/kamal.json": { id: "kamal", title: "Kamal (pilgrim)", roles: ["pilgrim"], meta: { persona: { name: "Kamal", initials: "KM", color: "#0f766e" } } },
    "base/scenarios/actors/reem.json": { id: "reem", title: "Reem (nurse)", roles: ["host-health-worker"] },
    "base/scenarios/roles.json": { roles: [{ id: "pilgrim", title: "Pilgrim" }, { id: "host-health-worker", title: "Host health worker", otherNames: ["Nurse"] }] },
    "base/scenarios/stories.json": { stories: [{ id: "pilgrim-1", role: { role: "pilgrim" }, want: "Show my summary abroad" }] },
    "base/archimate/building-blocks/blocks.json": {
      $schema: "building-blocks/0.1.0",
      layers: [{ id: "apps", label: "Apps" }],
      blocks: [{ id: "wallet", name: "Wallet", kind: "tool", layer: "apps", jurisdiction: "International", what: "Holds the summary." }],
    },
    "base/code-lists/trust.json": { $schema: "folio-code-list/v1", id: "trust", title: "T", description: "d", source: { note: "f" }, codes: [{ code: "signed", label: "Signed", definition: "d" }] },
    "demo/processes/care.bpmn": BPMN_CARE,
    "base/skills/requirements/req-001.json": { id: "req:stt-ver-001", title: "Verify" },
    "base/fhir/index.json": { artifacts: [{ key: "Bundle/kamal-ips", title: "Kamal's summary" }] },
    "demo/demo.json": {
      name: "demo",
      needs: ["base"],
      directories: [
        { id: "user-scenarios", path: "journeys/", graphTypologies: ["user-scenario"] },
        { id: "workshops", path: "workshops/", graphTypologies: ["workshop"] },
      ],
    },
    "demo/docs/images/p4.png": "\x89PNG fixture",
    "demo/journeys/p-all.json": { $schema: "user-scenario/0.2.0", id: "p-all", title: "The pilgrimage", description: "d", personas: ["kamal"], steps: [] },
    "demo/journeys/p3.json": { $schema: "user-scenario/0.1.0", id: "p3-ill", title: "P3", description: "d", personas: ["kamal", "reem"], steps: [step("P3")] },
    "demo/journeys/p4.json": {
      $schema: "user-scenario/0.2.0",
      id: "p4-scanned",
      title: "P4",
      description: "d",
      personas: ["kamal", "reem"],
      partOf: "p-all",
      follows: "p3-ill",
      trustLadder: "trust",
      illustrationStyle: { prompt: "Flat illustration, no readable text.", cast: [{ actor: "reem", description: "Saudi nurse, 30s, navy scrubs." }] },
      steps: [
        step("P4", {
          stories: ["pilgrim-1"],
          realisedBy: [{ process: "processes/care.bpmn", tasks: ["Task_Scan"] }],
          uses: [{ block: "wallet", role: "shows the QR" }],
          requirements: ["STT-VER-001"],
          preconditions: [{ title: "Keys shared", description: "d", requirements: ["req:stt-ver-001"] }],
          examples: ["Bundle/kamal-ips"],
          record: { state: "signed", description: "d", heldWhere: "phone" },
          handoff: { summary: "QR", from: "kamal", to: "reem" },
          illustration: { src: "docs/images/p4.png", alt: "Reem scans the code on Kamal's phone." },
        }),
      ],
    },
    "demo/workshops/w.json": {
      $schema: "workshop/0.1.0",
      id: "w",
      title: "W",
      description: "d",
      scenarios: ["p3-ill", "p4-scanned"],
      modules: [{ id: "M1", title: "M1" }],
      steps: [{ scenario: "p4-scanned", step: "P4", questions: [{ module: "M1", text: "Who signs?" }] }],
      discussion: [{ id: "q1", module: "M1", theme: "t", question: "q", steps: ["p3-ill#P3"] }],
      resources: [{ id: "r1", title: "R", kind: "job-aid", steps: ["p4-scanned#P4"] }],
    },
  };
}

function checkout(files: Files) {
  const root = mkdtempSync(join(tmpdir(), "journey-refs-"));
  made.push(root);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, dirname(rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
  clearDeclaredVisualisers();
  return join(root, "demo");
}

/** Edit a JSON file of a fixture in place: a fixture is free-form JSON, typed loosely on purpose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function edit(files: Files, rel: string, f: (x: any) => void): void {
  const x = JSON.parse(JSON.stringify(files[rel]));
  f(x);
  files[rel] = x;
}

describe("a checkout whose every reference resolves", () => {
  const report = checkJourneyRefsAt(checkout(clean()));
  test("passes, having examined every sort of reference", () => {
    expect(report.findings).toEqual([]);
    expect(report.couldNotDetermine).toEqual([]);
    expect(report.undetermined).toBeUndefined();
    expect(report.journeys).toBe(3);
    expect(report.workshops).toBe(1);
    // personas 1+2+2, step actors, stories, process + task, block, two requirements,
    // example, record state, illustration, cast, handoff 2, follows, partOf, ladder, workshop refs.
    expect(report.references).toBeGreaterThanOrEqual(25);
  });
});

describe("the negative fixture: one broken reference of each sort", () => {
  const files = clean();
  edit(files, "demo/journeys/p4.json", (j) => {
    j.personas.push("ghost");
    j.follows = "p2-missing";
    j.partOf = "no-group";
    j.trustLadder = "trust";
    j.views = [{ model: "0.1.0", view: "no-such-view" }];
    j.illustrationStyle.cast.push({ actor: "nobody", description: "x" });
    const s = j.steps[0];
    s.experiences.push({ actor: "ghost", doing: "haunts" });
    s.stories.push("ghost-story");
    s.realisedBy.push({ process: "processes/care.bpmn", tasks: ["Task_Missing"] }, { process: "processes/absent.bpmn" });
    s.uses.push({ block: "nowhere", role: "r" });
    s.requirements.push("STT-VER-404");
    s.examples.push("Bundle/missing");
    s.record.state = "unknown-state";
    s.handoff.to = "stranger";
    // An end in words is a place or a system, not an actor reference.
    s.handoff.from = "Thai hospital";
    s.fhirChanges = [{ resource: "Bundle", change: "c", examples: ["Bundle/also-missing"] }];
    s.illustration.src = "docs/images/missing.png";
  });
  edit(files, "demo/workshops/w.json", (w) => {
    w.scenarios.push("no-journey");
    w.steps.push({ scenario: "p4-scanned", step: "P9" }, { scenario: "nope", step: "P1" });
    w.discussion[0].steps.push("p3-ill#P0", "not-a-ref");
    w.presentation = { recordOf: "nobody", deviceDemo: { href: "app/", screens: [{ id: "S9", title: "t", steps: ["P99"] }] } };
  });
  // A catalogue left in a journeys directory is not a catalogue: the block it holds does not resolve.
  files["demo/journeys/blocks.json"] = {
    $schema: "building-blocks/0.1.0",
    layers: [{ id: "apps", label: "Apps" }],
    blocks: [{ id: "nowhere", name: "N", kind: "tool", layer: "apps", jurisdiction: "International", what: "w" }],
  };
  files["demo/journeys/broken.json"] = { $schema: "user-scenario/0.2.0", id: "broken", title: "B", description: "d", personas: ["kamal"], steps: [step("B1")] };
  const report = checkJourneyRefsAt(checkout(files));
  const messages = report.findings.map((f) => `${f.file} · ${f.at}: ${f.message}`);
  const has = (re: RegExp) => expect(messages.some((m) => re.test(m)), `${re} in\n${messages.join("\n")}`).toBe(true);

  test("each broken reference is a finding naming its file and step", () => {
    has(/journeys\/p4\.json · \(root\): persona "ghost" is no actor/);
    has(/follows "p2-missing"/);
    has(/partOf "no-group"/);
    has(/illustrationStyle\.cast actor "nobody"/);
    has(/view "no-such-view" of model "0\.1\.0"/);
    has(/step P4: experience actor "ghost"/);
    has(/step P4: story "ghost-story"/);
    has(/step P4: realisedBy task "Task_Missing" is no element of processes\/care\.bpmn/);
    has(/step P4: realisedBy process "processes\/absent\.bpmn" is no file/);
    has(/step P4: uses block "nowhere"/);
    has(/step P4: requirement "STT-VER-404"/);
    has(/step P4: FHIR example "Bundle\/missing"/);
    has(/step P4: record\.state "unknown-state"/);
    has(/step P4: handoff\.to "stranger"/);
    has(/step P4: illustration\.src "docs\/images\/missing\.png"/);
  });
  test("a workshop's step refs must name a journey and a step of it", () => {
    has(/workshops\/w\.json · scenarios\[2\]: scenario "no-journey"/);
    has(/steps\[1\]: step "P9" is no step of journey p4-scanned/);
    has(/steps\[2\]: scenario "nope"/);
    has(/discussion q1: step "P0" is no step of journey p3-ill/);
    has(/discussion q1: step ref "not-a-ref" is not <scenario>#<step>/);
    has(/presentation: recordOf "nobody" is no actor/);
    has(/presentation\.deviceDemo S9: step "P99" is no step of a journey the workshop teaches/);
  });
  test("a FHIR change's examples resolve as the step's do; a hand-off end in words is not an actor", () => {
    has(/step P4: FHIR example "Bundle\/also-missing"/);
    expect(messages.some((m) => m.includes("Thai hospital"))).toBe(false);
  });
  test("a file that does not parse is a finding, not a skip", () => {
    has(/journeys\/broken\.json · \(root\): does not parse/);
  });
  test("nothing that resolves is reported", () => {
    expect(messages.some((m) => !m.includes("does not parse") && /"kamal"|"reem"|"wallet"|"Task_Scan"|"pilgrim-1"/.test(m))).toBe(false);
  });
});

describe("an artifact index built at publish", () => {
  test("absent from the checkout: an example it would hold is could-not-determine, never missing", () => {
    const files = clean();
    delete files["base/fhir/index.json"];
    const report = checkJourneyRefsAt(checkout(files));
    expect(report.findings).toEqual([]);
    expect(report.couldNotDetermine.map((f) => `${f.file} · ${f.at}`)).toEqual(["journeys/p4.json · step P4"]);
    expect(report.couldNotDetermine[0]!.message).toContain('"Bundle/kamal-ips"');
    expect(report.couldNotDetermine[0]!.message).toContain("built at publish");
  });

  test("present without the key: the example is missing, a finding", () => {
    const files = clean();
    edit(files, "demo/journeys/p4.json", (j) => {
      j.steps[0].examples = ["Bundle/missing"];
    });
    const report = checkJourneyRefsAt(checkout(files));
    expect(report.couldNotDetermine).toEqual([]);
    expect(report.findings.map((f) => f.message)).toEqual(['FHIR example "Bundle/missing" is in no declared fhir-artifact-index']);
  });

  test("a MOUNTED layer's index written to the layer output root is read there (bean cat-tools-sm8r item 4)", () => {
    const files = clean();
    const index = files["base/fhir/index.json"]!;
    delete files["base/fhir/index.json"];
    files["index.lock.json"] = { instances: [{ instance: "base", path: "base" }] };
    files["build/layers/base/fhir/index.json"] = index;
    const report = checkJourneyRefsAt(checkout(files));
    expect(report.couldNotDetermine).toEqual([]);
    expect(report.findings).toEqual([]);
  });
});

describe("a step's DAK assets (user-scenario 0.3.0)", () => {
  const withDak = (files: ReturnType<typeof clean>) => {
    files["base/fhir/index.json"] = { artifacts: [{ key: "Bundle/kamal-ips", title: "Kamal's summary" }, { key: "PlanDefinition/dt-01", title: "DT.01 Is the card genuine?" }] };
    edit(files, "demo/journeys/p4.json", (j) => {
      j.$schema = "user-scenario/0.3.0";
      j.steps[0].dak = [{ key: "PlanDefinition/dt-01", rel: "decides" }, { key: "Measure/ind-09" }];
    });
    return files;
  };
  test("each key resolves through the artifact index, as an example does; one it does not list is a finding", () => {
    const report = checkJourneyRefsAt(checkout(withDak(clean())));
    expect(report.couldNotDetermine).toEqual([]);
    expect(report.findings.map((f) => `${f.file} · ${f.at}: ${f.message}`)).toEqual(['journeys/p4.json · step P4: DAK asset "Measure/ind-09" is in no declared fhir-artifact-index']);
  });
  test("with the index built at publish and absent, each key is could-not-determine, never missing", () => {
    const files = withDak(clean());
    delete files["base/fhir/index.json"];
    const report = checkJourneyRefsAt(checkout(files));
    expect(report.findings).toEqual([]);
    const dak = report.couldNotDetermine.filter((f) => f.message.startsWith("DAK asset"));
    expect(dak.map((f) => f.message.split(" is ")[0])).toEqual(['DAK asset "PlanDefinition/dt-01"', 'DAK asset "Measure/ind-09"']);
  });
});

describe("a journey is a DAK user scenario (user-scenario specialises it)", () => {
  test("its DAK personas are the roles its actors play, derived, and a role persona is read as it is", async () => {
    const { readJourneyCorpus } = await import("../journeys/read.ts");
    const { dakUserScenario } = await import("../journeys/derive.ts");
    const corpus = readJourneyCorpus(checkout(clean()));
    const p4 = corpus.journeys.find((j) => j.scenario.id === "p4-scanned")!;
    expect(dakUserScenario(corpus, p4)).toEqual({ id: "p4-scanned", title: "P4", description: "d", personas: ["pilgrim", "host-health-worker"] });
  });
  test("a journey none of whose actors plays a role, or whose actor plays a role nobody declares, is a finding", () => {
    const files = clean();
    edit(files, "base/scenarios/actors/kamal.json", (a) => delete a.roles);
    edit(files, "base/scenarios/actors/reem.json", (a) => (a.roles = ["ghost-role"]));
    const messages = checkJourneyRefsAt(checkout(files)).findings.map((f) => `${f.file}: ${f.message}`);
    expect(messages).toContain("journeys/p-all.json: as a DAK user-scenario it has no personas: none of its persona actors plays a role (an actor's `roles`)");
    expect(messages).toContain('journeys/p4.json: as a DAK user-scenario its persona "ghost-role" (a role of its actors) is no role in a declared scenarios directory');
  });
  test("0.4.0: a plain DAK user scenario (personas are roles, no steps) passes, and its role lists the actors who play it", async () => {
    const files = clean();
    files["demo/journeys/plain.json"] = { $schema: "user-scenario/0.4.0", id: "plain", title: "Plain", description: "d", personas: ["pilgrim"] };
    const root = checkout(files);
    expect(checkJourneyRefsAt(root).findings).toEqual([]);
    const { readJourneyCorpus } = await import("../journeys/read.ts");
    expect(readJourneyCorpus(root).journeys.find((j) => j.scenario.id === "plain")!.scenario.personas).toEqual(["kamal"]);
  });
});

describe("composition (user-scenario 0.4.0): a parent lists its parts", () => {
  const composed = (files = clean()) => {
    edit(files, "demo/journeys/p-all.json", (j) => {
      j.$schema = "user-scenario/0.4.0";
      j.parts = [{ scenario: "p3-ill" }, { scenario: "p4-scanned", optional: true, repeats: true }];
      delete j.personas;
    });
    edit(files, "demo/journeys/p4.json", (j) => {
      delete j.partOf;
      delete j.follows;
    });
    return files;
  };
  const messagesOf = (files: Files) => checkJourneyRefsAt(checkout(files)).findings.map((f) => `${f.file} · ${f.at}: ${f.message}`);

  test("parts resolve, the parent's personas are derived from them, and nothing is said twice", async () => {
    const root = checkout(composed());
    expect(checkJourneyRefsAt(root).findings).toEqual([]);
    const { readJourneyCorpus } = await import("../journeys/read.ts");
    const corpus = readJourneyCorpus(root);
    expect(corpus.journeys.find((j) => j.scenario.id === "p-all")!.scenario.personas).toEqual(["kamal", "reem"]);
  });
  test("a part that names no journey, and a cycle of parts, are findings", () => {
    const files = composed();
    edit(files, "demo/journeys/p-all.json", (j) => j.parts.push({ scenario: "p9-nowhere" }));
    edit(files, "demo/journeys/p4.json", (j) => {
      j.$schema = "user-scenario/0.4.0";
      j.parts = [{ scenario: "p-all" }];
    });
    const m = messagesOf(files);
    expect(m).toContain('journeys/p-all.json · (root): part "p9-nowhere" is no journey in this checkout');
    expect(m.some((x) => x.includes("parts and includes form a cycle: p-all → p4-scanned → p-all"))).toBe(true);
  });
  test("what the parts say is not said again: follows and partOf on a listed part, personas that are exactly the parts'", () => {
    const files = composed();
    edit(files, "demo/journeys/p4.json", (j) => {
      j.follows = "p3-ill";
      j.partOf = "p-all";
    });
    edit(files, "demo/journeys/p-all.json", (j) => (j.personas = ["reem", "kamal"]));
    const m = messagesOf(files);
    expect(m).toContain('journeys/p4.json · (root): redundant follows "p3-ill": a parent lists this journey in its parts, whose order says what it follows; remove it');
    expect(m).toContain('journeys/p4.json · (root): redundant partOf "p-all": that journey lists this one in its parts; remove it');
    expect(m).toContain("journeys/p-all.json · (root): redundant personas: they are exactly its parts' personas, from which they are derived; remove them");
  });
});

describe("a step that includes a journey (user-scenario 0.4.0)", () => {
  const including = (called: string, files = clean()) => {
    files["demo/processes/triage.bpmn"] = BPMN_TRIAGE;
    files["demo/journeys/triage.json"] = {
      $schema: "user-scenario/0.4.0",
      id: "triage",
      title: "Triage",
      description: "d",
      personas: ["reem"],
      steps: [{ id: "T1", title: "Triage", lead: "reem", experiences: [{ actor: "reem", doing: "triages" }], realisedBy: [{ process: "processes/triage.bpmn" }] }],
    };
    edit(files, "demo/journeys/p4.json", (j) => {
      j.$schema = "user-scenario/0.4.0";
      j.steps.push({ id: "P4b", title: "Triaged", lead: "reem", experiences: [{ actor: "reem", doing: "triages" }], includes: "triage", realisedBy: [{ process: "processes/care.bpmn", tasks: [called] }] });
      delete j.partOf;
    });
    return files;
  };
  test("agrees with the call activity its realisedBy names", () => {
    const r = checkJourneyRefsAt(checkout(including("Call_Triage")));
    expect(r.findings).toEqual([]);
    expect(r.couldNotDetermine).toEqual([]);
  });
  test("a call activity of another process is a finding naming both; one naming no process is could-not-determine", () => {
    const files = including("Call_Triage");
    files["demo/processes/triage.bpmn"] = BPMN_TRIAGE.replace("Process_Triage", "Process_Other");
    const bad = checkJourneyRefsAt(checkout(files)).findings.map((f) => f.message);
    expect(bad).toEqual(['includes "triage" disagrees with its realisedBy: call activity Call_Triage calls Process_Triage, but journey triage is realised by Process_Other']);
    const unknown = checkJourneyRefsAt(checkout(including("Call_Unnamed")));
    expect(unknown.findings).toEqual([]);
    expect(unknown.couldNotDetermine.map((f) => f.message)).toEqual(['whether includes "triage" is the process its call activity calls: call activity Call_Unnamed names no calledElement']);
  });
  test("a call activity with no includes is silent, and an includes naming no journey is a finding", () => {
    const files = including("Call_Triage");
    edit(files, "demo/journeys/p4.json", (j) => (j.steps[1].includes = "nowhere"));
    expect(checkJourneyRefsAt(checkout(files)).findings.map((f) => f.message)).toEqual(['includes "nowhere", which is no journey in this checkout']);
    edit(files, "demo/journeys/p4.json", (j) => delete j.steps[1].includes);
    expect(checkJourneyRefsAt(checkout(files)).findings).toEqual([]);
  });
});

describe("a step's people default to its lanes (user-scenario 0.4.0)", () => {
  const laneOnly = (tasks: string[], lead?: string) => {
    const files = clean();
    edit(files, "demo/journeys/p4.json", (j) => {
      j.$schema = "user-scenario/0.4.0";
      delete j.partOf;
      delete j.steps[0].experiences;
      delete j.steps[0].lead;
      if (lead) j.steps[0].lead = lead;
      j.steps[0].realisedBy = [{ process: "processes/care.bpmn", tasks }];
    });
    return files;
  };
  test("with no experiences, the actors who play its tasks' lanes do them, the first leading", async () => {
    const root = checkout(laneOnly(["Task_Show", "Task_Scan"]));
    expect(checkJourneyRefsAt(root).findings).toEqual([]);
    const { readJourneyCorpus } = await import("../journeys/read.ts");
    const step = readJourneyCorpus(root).journeys.find((j) => j.scenario.id === "p4-scanned")!.scenario.steps[0]!;
    expect(step.lead).toBe("kamal");
    expect(step.experiences).toEqual([{ actor: "kamal", doing: "Show the code" }, { actor: "reem", doing: "Scan" }]);
  });
  test("a lead that repeats the derived one is redundant, and a step whose lanes no persona plays is a finding", () => {
    expect(checkJourneyRefsAt(checkout(laneOnly(["Task_Show"], "kamal")))
      .findings.map((f) => f.message)).toEqual(['redundant lead "kamal": it is the first actor its lanes derive; remove it']);
    const files = laneOnly(["Task_Scan"]);
    edit(files, "demo/journeys/p4.json", (j) => (j.personas = ["kamal"]));
    expect(checkJourneyRefsAt(checkout(files)).findings.map((f) => f.message)).toContain("has no experiences, and none derive: no persona plays a lane of its realisedBy tasks; write them");
  });
});

describe("the command", () => {
  test("exits 2, not 0 or 1, when the only open reference is in an index built at publish", () => {
    const files = clean();
    delete files["base/fhir/index.json"];
    const run = spawnSync("bun", [join(import.meta.dir, "..", "check-journey-refs.ts"), "--root", checkout(files)], { encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("could not be determined");
  });

  const SCRIPT = join(import.meta.dir, "..", "check-journey-refs.ts");
  test("exits 0 on the clean checkout and 1 on a broken one, naming the finding", () => {
    const ok = spawnSync("bun", [SCRIPT, "--root", checkout(clean())], { encoding: "utf8" });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("✓ journey-refs:");
    const files = clean();
    edit(files, "demo/journeys/p4.json", (j) => {
      j.steps[0].stories = ["ghost-story"];
    });
    const bad = spawnSync("bun", [SCRIPT, "--root", checkout(files)], { encoding: "utf8" });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('story "ghost-story"');
  });
});

describe("overview gaps: what a workshop's VaxLink overview would leave out", () => {
  const gaps = (files: Files) => checkJourneyRefsAt(checkout(files)).warnings.map((f) => `${f.at}: ${f.message}`);

  test("the clean fixture names each part its journeys do not declare, and never fails on it", () => {
    const r = checkJourneyRefsAt(checkout(clean()));
    expect(r.findings).toEqual([]);
    const w = r.warnings.map((f) => `${f.at}: ${f.message}`);
    expect(w).toContain("presentation.story: overview-gap: no story in one sentence; the overview's hero shows the workshop description instead");
    expect(w).toContain("scenarios: overview-gap: no scene (the icon strip under a moment) on p3-ill, p4-scanned");
    expect(w).toContain('scenarios: overview-gap: no trustLadder ("Follow the record") on p3-ill');
    expect(w).toContain("scenarios: overview-gap: no illustration on step(s) P3");
    expect(w).toContain("presentation.recordOf: overview-gap: a trust ladder is declared but not whose record it follows");
    expect(w).toContain("scenarios: overview-gap: no device screen shows any step it teaches (the Device Demo is empty)");
  });

  test("declaring the parts clears their warnings", () => {
    const files = clean();
    edit(files, "demo/workshops/w.json", (x) => {
      x.scenarios = ["p4-scanned"];
      x.steps = [];
      x.discussion = [];
      x.resources = [];
      x.presentation = { story: "Kamal is treated abroad.", recordOf: "kamal", deviceDemo: { href: "https://example.org/demo/" } };
    });
    edit(files, "demo/journeys/p4.json", (x) => {
      x.scene = [{ icon: "qr", label: "Shows his code" }];
    });
    expect(gaps(files)).toEqual([]);
  });
});
