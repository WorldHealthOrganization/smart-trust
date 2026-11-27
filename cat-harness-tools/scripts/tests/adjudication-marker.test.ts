/**
 * `<cat-harness.processes:adjudication codes="…"/>` — the harness half of bean `5vo9`.
 *
 * @module scripts/tests/adjudication-marker
 * @graphNode none — a test
 *
 * The document contract lives in `folio-assistant-core/schemas/adjudication.ts`
 * and is tested there. This covers what the DIAGRAM declares, and every case
 * below is a refusal, because a marker that only added a word to a diagram
 * would check nothing.
 *
 * The one worth reading is §"a mechanical actor may not adjudicate": the constraint
 * existed on `adjudication.bpmn`'s adjudicator step as a `folio:fulfilment` and
 * nothing tied it to the judgement, so a NEW adjudication step could omit it
 * and no gate would notice.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { loadProcessModel } from "../../src/workflow/process-model.js";
import { workflowFile, workflowFiles } from "../known-skills.ts";
import { processDiagrams } from "../../src/workflow/process-model.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** One activity carrying whatever extension XML the case needs. */
function fixture(activityExt: string, type = "task"): string {
  const dir = mkdtempSync(join(tmpdir(), "adjudication-"));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:startEvent id="Start_T" name="Start"/>
    <bpmn:${type} id="A_T" name="Judge it">
      <bpmn:extensionElements>${activityExt}</bpmn:extensionElements>
    </bpmn:${type}>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

const JUDGE = '<cat-harness.processes:fulfilment kinds="person agent" reason="a judgement, never a program"/>';
const THREE = '<cat-harness.processes:adjudication codes="stands scope dispensation"/>';

describe("a mechanical actor may not adjudicate", () => {
  test("REFUSES an adjudication whose step a `system` actor could perform", async () => {
    // The owner: "ONLY agentic human actor". `system` is this repository's
    // mechanical kind. If a program can decide it, it is computable and
    // belongs in a DMN table behind <cat-harness.processes:decision/>.
    await expect(
      loadProcessModel(
        fixture(
          `${THREE}<cat-harness.processes:fulfilment kinds="person agent system" reason="whoever is free"/>`,
        ),
      ),
    ).rejects.toThrow(/Only `person` and `agent` may adjudicate/);
  });

  test("REFUSES `external` too — outside the instance is not an adjudicator here", async () => {
    await expect(
      loadProcessModel(
        fixture(`${THREE}<cat-harness.processes:fulfilment kinds="person external" reason="anyone"/>`),
      ),
    ).rejects.toThrow(/Only `person` and `agent` may adjudicate/);
  });

  test("REFUSES an adjudication with NO fulfilment, rather than defaulting one", async () => {
    // The case the marker exists for. A step that has not said who may adjudicate
    // has not restricted anybody, and defaulting to person+agent would let
    // silence read as a deliberate restriction.
    await expect(loadProcessModel(fixture(THREE))).rejects.toThrow(/no <cat-harness\.processes:fulfilment/);
  });

  test("accepts `person agent` — what adjudication.bpmn's judge step declares", async () => {
    const m = await loadProcessModel(fixture(`${THREE}${JUDGE}`));
    expect(m.nodes.get("A_T")!.adjudication).toEqual({
      codes: ["stands", "scope", "dispensation"],
    });
  });
});

describe("the codes are an enum, so a degenerate one is refused", () => {
  test("REFUSES a single permitted answer — assent is not judgement", async () => {
    await expect(
      loadProcessModel(fixture(`<cat-harness.processes:adjudication codes="approved"/>${JUDGE}`)),
    ).rejects.toThrow(/at least two permitted answers/);
  });

  test("REFUSES no codes at all", async () => {
    await expect(
      loadProcessModel(fixture(`<cat-harness.processes:adjudication codes=""/>${JUDGE}`)),
    ).rejects.toThrow(/at least two permitted answers/);
  });

  test("REFUSES a repeated code — the outcome could not say which was chosen", async () => {
    await expect(
      loadProcessModel(fixture(`<cat-harness.processes:adjudication codes="a b a"/>${JUDGE}`)),
    ).rejects.toThrow(/repeats a code/);
  });

  test("splits on any whitespace, so a newline-formatted list works", async () => {
    const m = await loadProcessModel(
      fixture(`<cat-harness.processes:adjudication codes="  stands\n   scope  "/>${JUDGE}`),
    );
    expect(m.nodes.get("A_T")!.adjudication!.codes).toEqual(["stands", "scope"]);
  });
});

describe("it belongs on an activity", () => {
  test("REFUSES the marker on a gateway — nobody performs a gateway", async () => {
    const dir = mkdtempSync(join(tmpdir(), "adjudication-gw-"));
    const p = join(dir, "p.bpmn");
    writeFileSync(
      p,
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:startEvent id="Start_T" name="Start"/>
    <bpmn:exclusiveGateway id="GW_T" name="which?">
      <bpmn:extensionElements>${THREE}</bpmn:extensionElements>
    </bpmn:exclusiveGateway>
  </bpmn:process>
</bpmn:definitions>
`,
    );
    // `folio:judgement` is the gateway marker; this one says who PERFORMS a
    // judgement, and a gateway is not performed. Keeping them apart is what
    // stops the two becoming one vague annotation.
    await expect(loadProcessModel(p)).rejects.toThrow(/only meaningful on an activity/);
  });

  test("works on a userTask as well as a task", async () => {
    const m = await loadProcessModel(fixture(`${THREE}${JUDGE}`, "userTask"));
    expect(m.nodes.get("A_T")!.adjudication!.codes).toHaveLength(3);
  });
});

/** A judge feeding a gateway, with whatever codes each side declares. */
function branched(declared: string, branchCodes: (string | null)[]): string {
  const dir = mkdtempSync(join(tmpdir(), "adjudication-br-"));
  const p = join(dir, "p.bpmn");
  const flows = branchCodes
    .map((c, i) =>
      c === null
        ? `<bpmn:sequenceFlow id="F_b${i}" sourceRef="GW_T" targetRef="End_T"/>`
        : `<bpmn:sequenceFlow id="F_b${i}" sourceRef="GW_T" targetRef="End_T">` +
          `<bpmn:extensionElements><cat-harness.processes:adjudication code="${c}"/></bpmn:extensionElements>` +
          `</bpmn:sequenceFlow>`,
    )
    .join("\n    ");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:startEvent id="Start_T" name="Start"/>
    <bpmn:task id="A_T" name="Judge it">
      <bpmn:extensionElements><cat-harness.processes:adjudication codes="${declared}"/>${JUDGE}</bpmn:extensionElements>
    </bpmn:task>
    <bpmn:exclusiveGateway id="GW_T" name="which?"/>
    <bpmn:endEvent id="End_T" name="done"/>
    <bpmn:sequenceFlow id="F_s" sourceRef="Start_T" targetRef="A_T"/>
    <bpmn:sequenceFlow id="F_j" sourceRef="A_T" targetRef="GW_T"/>
    ${flows}
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

describe("the declared codes and the gateway's branches are ONE fact", () => {
  test("accepts the matching case", async () => {
    const m = await loadProcessModel(branched("a b", ["a", "b"]));
    expect(m.nodes.get("A_T")!.adjudication!.codes).toEqual(["a", "b"]);
  });

  test("REFUSES a branch naming a code the judge does not permit", async () => {
    // Otherwise a recorded outcome could name an answer the process cannot
    // take, and nothing would have said so.
    await expect(loadProcessModel(branched("a b", ["a", "c"]))).rejects.toThrow(
      /must be the same set/,
    );
  });

  test("REFUSES a declared code no branch acts on", async () => {
    await expect(loadProcessModel(branched("a b c", ["a", "b"]))).rejects.toThrow(
      /must be the same set/,
    );
  });

  test("REFUSES a PARTLY coded gateway — it reads as complete", async () => {
    // The dangerous shape: two branches coded, one not. The set comparison
    // alone would pass if the coded ones happened to match.
    await expect(loadProcessModel(branched("a b", ["a", "b", null]))).rejects.toThrow(
      /partly-coded gateway/,
    );
  });

  test("a gateway that codes NOTHING opts out rather than failing", async () => {
    // Inertness. Every gateway in the corpus predates the element, so an
    // all-uncoded gateway must stay legal or the marker could not be adopted
    // one diagram at a time.
    const m = await loadProcessModel(branched("a b", [null, null]));
    expect(m.nodes.get("A_T")!.adjudication!.codes).toEqual(["a", "b"]);
  });

  test("ORDER does not matter — a set, not a sequence", async () => {
    const m = await loadProcessModel(branched("b a", ["a", "b"]));
    expect(m.nodes.get("A_T")!.adjudication).toBeDefined();
  });
});

describe("absence stays absence", () => {
  test("an activity with no marker has no adjudication, and still loads", async () => {
    // Most activities are not judgements. The marker must be opt-in, or every
    // existing diagram would need editing.
    const m = await loadProcessModel(fixture('<bootstrap.processes:skill ref="content-feedback"/>'));
    expect(m.nodes.get("A_T")!.adjudication).toBeUndefined();
  });

  test("the real corpus still loads, adjudication.bpmn included", async () => {
    // adjudication.bpmn now DOES declare the marker — this is what proves the
    // contract expresses the diagram that motivated it, rather than only the
    // fixtures above.
    const { loadProcessModel: load } = await import("../../src/workflow/process-model.js");
    const diagram = (n: string): string => workflowFile(join(HARNESS_ROOT), n);
    const files = processDiagrams(workflowFiles(join(HARNESS_ROOT))).map((x) => basename(x));
    expect(files.length, "no diagrams found — this assertion would be vacuous").toBeGreaterThan(5);
    for (const f of files) await load(diagram(f));
    // Loads every diagram of the real corpus, which took 5.1 s on a CI runner
    // (run 38696377785, shard 1) against bun's 5 s default: the corpus grows,
    // so the limit is stated rather than inherited.
  }, 30_000);
});

/**
 * A caller and the judge it calls — bean `bvuk`.
 *
 * Two files, because a `callActivity` resolves `calledElement` against the
 * SIBLING diagrams in its own directory, which is the mechanism these check.
 */
function caller(callerExt: string, judgeCodes = "a b"): string {
  const dir = mkdtempSync(join(tmpdir(), "adjudication-call-"));
  writeFileSync(
    join(dir, "child.bpmn"),
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_Child" name="Child" isExecutable="false">
    <bpmn:startEvent id="Start_C" name="Start"/>
    ${
      judgeCodes === ""
        ? '<bpmn:task id="A_C" name="Not a judgement"/>'
        : `<bpmn:task id="A_C" name="Judge"><bpmn:extensionElements>` +
          `<cat-harness.processes:adjudication codes="${judgeCodes}"/>${JUDGE}</bpmn:extensionElements></bpmn:task>`
    }
  </bpmn:process>
</bpmn:definitions>
`,
  );
  const p = join(dir, "parent.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_Parent" name="Parent" isExecutable="false">
    <bpmn:startEvent id="Start_P" name="Start"/>
    <bpmn:callActivity id="Call_P" name="Ask" calledElement="Process_Child">
      <bpmn:extensionElements>${callerExt}</bpmn:extensionElements>
    </bpmn:callActivity>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

describe("a caller says what it can act on, and it is checked", () => {
  test("accepts the matching case, and the list is on the node", async () => {
    const m = await loadProcessModel(caller('<cat-harness.processes:adjudication accepts="a b"/>'));
    expect(m.nodes.get("Call_P")!.adjudicationAccepts).toEqual(["a", "b"]);
  });

  test("ORDER does not matter — a set, as on the judge side", async () => {
    const m = await loadProcessModel(caller('<cat-harness.processes:adjudication accepts="b a"/>'));
    expect(m.nodes.get("Call_P")!.adjudicationAccepts).toEqual(["b", "a"]);
  });

  test("REFUSES a caller accepting an answer the judge cannot give", async () => {
    await expect(
      loadProcessModel(caller('<cat-harness.processes:adjudication accepts="a c"/>')),
    ).rejects.toThrow(/accepts \(a, c\) but Process_Child's A_C may answer \(a, b\)/);
  });

  test("REFUSES a strict SUBSET — the unaccepted answers still arrive", async () => {
    // Not a subset check by oversight: a caller that handles two of three
    // answers receives the third and does something undefined with it.
    await expect(
      loadProcessModel(caller('<cat-harness.processes:adjudication accepts="a b"/>', "a b c")),
    ).rejects.toThrow(/may answer \(a, b, c\)/);
  });

  test("REFUSES `accepts` on a call into a process that adjudicates nothing", async () => {
    await expect(
      loadProcessModel(caller('<cat-harness.processes:adjudication accepts="a b"/>', "")),
    ).rejects.toThrow(/contains no judgement/);
  });

  test("REFUSES `accepts` anywhere but a call activity", async () => {
    // It states what a CALLER can act on; a plain task calls nothing.
    await expect(
      loadProcessModel(fixture('<cat-harness.processes:adjudication accepts="a b"/>')),
    ).rejects.toThrow(/only meaningful on a call activity/);
  });

  test("REFUSES declaring both `codes` and `accepts` — it cannot be both", async () => {
    await expect(
      loadProcessModel(caller(`<cat-harness.processes:adjudication codes="a b" accepts="a b"/>`)),
    ).rejects.toThrow(/declares both/);
  });

  test("REFUSES a single accepted answer", async () => {
    await expect(
      loadProcessModel(caller('<cat-harness.processes:adjudication accepts="a"/>')),
    ).rejects.toThrow(/names 1 code/);
  });

  test("a caller declaring NOTHING loads — absence is reported, not refused", async () => {
    // Four of the six real callers are in this state and what each should
    // accept is undecided. Refusing here would force a guess that looks
    // checked; `check:workflow-refs` prints them instead.
    const m = await loadProcessModel(caller("<bootstrap.processes:skill ref=\"adjudication\"/>"));
    expect(m.nodes.get("Call_P")!.adjudicationAccepts).toBeUndefined();
    expect(m.children.get("Call_P")).toBeDefined();
  });
});

describe("a misspelled attribute is refused, not ignored", () => {
  test("REFUSES an attribute the engine does not read", async () => {
    // The `folio:bean action="create"` failure, one element over: every one of
    // this element's three attributes has a MEANINGFUL absence, so a typo
    // parses as a deliberate abstention.
    await expect(
      loadProcessModel(caller('<cat-harness.processes:adjudication accept="a b"/>')),
    ).rejects.toThrow(/carries "accept", which the engine does not read/);
  });

  test("REFUSES a judge whose codes are misspelled into nothing", async () => {
    await expect(loadProcessModel(fixture(`<cat-harness.processes:adjudication code="a b"/>${JUDGE}`)))
      .rejects.toThrow(/carries "code"/);
  });
});

describe("the two real callers that fit", () => {
  test("review-narrative and voice-review declare the three, and they match", async () => {
    // The diagram's own claim, now checked: "The three outcomes are the ones
    // `review-narrative` and `voice-review` already use". It was prose in a
    // documentation element and nothing compared it to anything.
    const diagram = (n: string): string => workflowFile(join(HARNESS_ROOT), n);
    for (const [f, id] of [
      ["review-narrative.bpmn", "Task_AdjudicateVoice"],
      ["voice-review.bpmn", "Task_Adjudicate"],
    ] as const) {
      const m = await loadProcessModel(diagram(f));
      expect(m.nodes.get(id)!.adjudicationAccepts, `${f} lost its accepts`).toEqual([
        "stands",
        "scope",
        "dispensation",
      ]);
    }
  });

  test("sample-import and subscribe-kg declare the four for refresh-materialized", async () => {
    const diagram = (n: string): string => workflowFile(join(HARNESS_ROOT), n);
    for (const f of ["sample-import.bpmn", "subscribe-kg.bpmn"] as const) {
      const m = await loadProcessModel(diagram(f));
      expect(m.nodes.get("Call_Refresh")!.adjudicationAccepts, `${f} lost its accepts`).toEqual([
        "remote",
        "local",
        "merge",
        "defer",
      ]);
    }
  });
});

/** A parent calling a child whose adjudicator DEFERS its enum. */
function deferring(callerExt: string): string {
  const dir = mkdtempSync(join(tmpdir(), "adjudication-defer-"));
  writeFileSync(
    join(dir, "child.bpmn"),
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_Child" name="Child" isExecutable="false">
    <bpmn:startEvent id="Start_C" name="Start"/>
    <bpmn:task id="A_C" name="Adjudicate">
      <bpmn:extensionElements><cat-harness.processes:adjudication defers="caller"/>${JUDGE}</bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  const p = join(dir, "parent.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_Parent" name="Parent" isExecutable="false">
    <bpmn:startEvent id="Start_P" name="Start"/>
    <bpmn:callActivity id="Call_P" name="Ask" calledElement="Process_Child">
      <bpmn:extensionElements>${callerExt}</bpmn:extensionElements>
    </bpmn:callActivity>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

describe("`defers=\"caller\"` — an adjudication whose enum the caller owns", () => {
  test("the deferral is DECLARED, so it cannot be confused with a lost marker", async () => {
    // The whole reason it is an attribute rather than an absent `codes`:
    // `A_Adjudicate` dropping its enum by accident and deferring on purpose
    // would otherwise parse identically.
    const m = await loadProcessModel(deferring('<bootstrap.processes:skill ref="adjudication"/>'));
    const child = m.children.get("Call_P")!;
    expect(child.nodes.get("A_C")!.adjudicationDefers).toBe(true);
    expect(child.nodes.get("A_C")!.adjudication).toBeUndefined();
  });

  test("it still carries the actor restriction — a `system` actor may not", async () => {
    // The factored `requireAdjudicatorKinds`. Deferring the ENUM does not
    // defer who may adjudicate; that is the one thing the shared process
    // exists to hold.
    await expect(
      loadProcessModel(
        fixture('<cat-harness.processes:adjudication defers="caller"/><cat-harness.processes:fulfilment kinds="person system" reason="x"/>'),
      ),
    ).rejects.toThrow(/Only `person` and `agent` may adjudicate/);
  });

  test("REFUSES a deferral with no fulfilment at all", async () => {
    await expect(
      loadProcessModel(fixture('<cat-harness.processes:adjudication defers="caller"/>')),
    ).rejects.toThrow(/no <cat-harness\.processes:fulfilment/);
  });

  test("REFUSES any value but `caller` — there is nowhere else an enum comes from", async () => {
    await expect(
      loadProcessModel(fixture(`<cat-harness.processes:adjudication defers="somewhere"/>${JUDGE}`)),
    ).rejects.toThrow(/The only value is `caller`/);
  });

  test("REFUSES `accepts` against a deferring adjudicator, and says to use `codes`", async () => {
    // The fix is the opposite of the usual one: there is no enum to have read.
    await expect(
      loadProcessModel(deferring('<cat-harness.processes:adjudication accepts="a b"/>')),
    ).rejects.toThrow(/defers its enum to the caller[\s\S]*declare <cat-harness\.processes:adjudication codes/);
  });

  test("a caller declaring nothing still loads — the four real ones do", async () => {
    const m = await loadProcessModel(deferring('<bootstrap.processes:skill ref="adjudication"/>'));
    expect(m.nodes.get("Call_P")!.adjudication).toBeUndefined();
    expect(m.nodes.get("Call_P")!.adjudicationAccepts).toBeUndefined();
  });
});

describe("the split — bean `bvuk`, the owner's shape", () => {
  const diagram = (n: string): string => workflowFile(join(HARNESS_ROOT), n);

  test("Process_Adjudication ends AT the judgement and names no outcomes", async () => {
    // What the split is. The three outcome tasks ran for every caller; four of
    // six had no criterion to scope and no dispensation to grant.
    const m = await loadProcessModel(diagram("adjudication.bpmn"));
    expect(m.nodes.get("A_Adjudicate")!.adjudicationDefers).toBe(true);
    for (const gone of ["GW_Outcome", "A_ScopeCriterion", "A_Dispensation", "A_RecordEntry"]) {
      expect(m.nodes.get(gone), `${gone} is the caller's now`).toBeUndefined();
    }
  });

  test("what must NOT vary stayed: entry condition, dispatch, actor kinds", async () => {
    // The objection to separating per question kind was that
    // `adjudicator_sees` and the actor restriction would be restated N times.
    // They are not restated; they did not move.
    const m = await loadProcessModel(diagram("adjudication.bpmn"));
    expect(m.nodes.get("GW_Adjudicable")).toBeDefined();
    expect(m.nodes.get("A_Dispatch")!.skills).toContain("untainted-verification");
    expect(m.nodes.get("A_Adjudicate")!.fulfilment!.kinds.sort()).toEqual(["agent", "person"]);
  });

  test("criterion-adjudication owns the three outcomes and declares the enum", async () => {
    const m = await loadProcessModel(diagram("criterion-adjudication.bpmn"));
    expect(m.nodes.get("Call_Adjudicate")!.adjudication!.codes.sort()).toEqual([
      "dispensation",
      "scope",
      "stands",
    ]);
    // Not relaxable, and it moved WITH the outcome rather than being dropped.
    expect(m.nodes.get("A_RecordEntry")!.relaxable).toBe(false);
    expect(m.nodes.get("A_Dispensation")!.relaxable).toBe(false);
  });

  // The four callers of the SHARED half include two of folio-assistant-core's
  // diagrams, so that test lives in folio-assistant-core/scripts/tests/
  // adjudication-marker.test.ts (bean `ho66`).

  test("the criterion callers call the specialisation, not the shared half", async () => {
    // `wireframe-design-review` joined 2026-09-23: reviewers disagreeing on ONE
    // criterion is a criterion disagreement, and its own documentation already
    // spoke of "the checker's entry" and "the dispensation".
    //
    // It joined as a CORRECTION, which is worth keeping because the PR that
    // made the split said the opposite. #1074 reported that all four remaining
    // callers "no longer reach A_ScopeCriterion or A_Dispensation" and framed
    // that as the intended effect. True for the three below; here it removed
    // the two steps the diagram documents, so for this one caller it was a
    // regression rather than a fix.
    for (const [f, id] of [
      ["review-narrative.bpmn", "Task_AdjudicateVoice"],
      ["voice-review.bpmn", "Task_Adjudicate"],
      ["wireframe-design-review.bpmn", "Call_Adjudicate"],
    ] as const) {
      const m = await loadProcessModel(diagram(f));
      expect(m.nodes.get(id)!.calledElement, f).toBe("Process_CriterionAdjudication");
    }
  });

});
