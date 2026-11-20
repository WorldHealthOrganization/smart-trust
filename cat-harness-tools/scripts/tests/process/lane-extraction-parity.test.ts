/**
 * `check-lane-documentation`'s copy of the extractor agrees with the extractor.
 *
 * @module scripts/tests/lane-extraction-parity.test
 *
 * `check-lane-documentation.ts` answers "would a translator ever see this
 * lane's text" and must answer it the way the REAL extractor would. It cannot
 * ask `extractBpmn` directly: that lives in `pipeline/`, which is
 * `folio-assist-core`, while the check is `agentic-harness`, and
 * `check:partition` refuses the edge because core depends on the harness.
 * So `decodeLabel` and the extractor's filter are duplicated there.
 *
 * **This is what makes that duplicate legitimate.** `AGENTS.md`: an
 * unavoidable duplicate is fine while an unchecked one is not. A copy that
 * drifts would report a string as extractable that no `.pot` will ever carry
 * — green on a gate whose entire purpose is to catch that.
 *
 * The comparison runs over the repository's OWN diagrams rather than a
 * fixture, because a fixture proves the two agree on the cases somebody
 * thought to write down, and the corpus is where the disagreement would
 * actually appear: 61 diagrams carrying quotation marks, `&#10;`, em-dashes,
 * backticks and prose long enough for gettext to wrap.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { extractBpmn } from "../../../pipeline/bpmn-translate.js";
import { checkLanes } from "../../check-lane-documentation.js";
import { BpmnModdle } from "bpmn-moddle";

/** A moddle element, as far as counting lanes needs one. */
type El = { $type: string; laneSets?: El[]; lanes?: El[]; childLaneSet?: El; rootElements?: El[] };

/**
 * Every lane bpmn-moddle parses, in EVERY process of the diagram.
 *
 * Not `loadProcessModel(f).lanes`: that is the model of the diagram's FIRST
 * `bpmn:process`, which is what the engine runs, while the check reads every
 * lane in the file. The two agreed while every diagram held one process;
 * smart-base's `SGAuthoring.DAKLifecycle.bpmn` (a collaboration of eight
 * pools, one lane each) is the first that does not, and comparing against the
 * first process alone reported 1 lane against the check's 8.
 */
async function moddleLaneCount(xml: string): Promise<number | null> {
  let defs: El;
  try {
    defs = (await new BpmnModdle().fromXML(xml)).rootElement as unknown as El;
  } catch {
    return null;
  }
  let n = 0;
  const walkSet = (set: El | undefined): void => {
    for (const lane of set?.lanes ?? []) {
      n++;
      walkSet(lane.childLaneSet);
    }
  };
  for (const e of defs.rootElements ?? []) {
    if (e.$type !== "bpmn:Process") continue;
    for (const set of e.laneSets ?? []) walkSet(set);
  }
  return n;
}

const REPO = resolve(import.meta.dir, "..", "..", "..", "..");

function bpmnFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".bpmn")) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * The check's duplicated pair, re-stated here so the test compares two
 * implementations rather than one against itself.
 *
 * Kept verbatim with `check-lane-documentation.ts`: if you change it there,
 * this test fails until you change it here too, and THAT is the point — the
 * failure names the drift instead of hiding it.
 */
function decodeLabel(raw: string): string {
  return raw
    .replace(/&#10;|&#xA;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isExtractable(msgid: string): boolean {
  if (!msgid) return false;
  return !(/^[A-Za-z_][A-Za-z0-9_]*$/.test(msgid) && /_/.test(msgid));
}

const NAMED_COPY = new RegExp(
  "<(?:bpmn:)?(?:process|lane|task|serviceTask|userTask|manualTask|scriptTask|" +
    "sendTask|receiveTask|businessRuleTask|callActivity|subProcess|" +
    // BPMN 2.0's global tasks, which the real extractor reads (owner,
    // 2026-10-20, "a1"): a copy without them reports a shared step's name as
    // not extracted while the translator sees it.
    "globalTask|globalUserTask|globalScriptTask|globalManualTask|globalBusinessRuleTask|" +
    "startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|" +
    "exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|" +
    "sequenceFlow|participant|collaboration|" +
    // Stores are drawn as data stores, not lanes (owner, 2026-11-01, Q-BR-3 A),
    // and the real extractor reads their names.
    "dataStore|dataStoreReference|dataObjectReference)\\b[^>]*?\\sname=\"([^\"]*)\"",
  "g",
);

const DOCUMENTATION_COPY = /<(?:bpmn:)?documentation>([\s\S]*?)<\/(?:bpmn:)?documentation>/g;

function localMsgids(xml: string): Set<string> {
  const out = new Set<string>();
  for (const m of xml.matchAll(DOCUMENTATION_COPY)) {
    const id = decodeLabel(m[1] ?? "");
    if (isExtractable(id)) out.add(id);
  }
  for (const m of xml.matchAll(NAMED_COPY)) {
    const id = decodeLabel(m[1] ?? "");
    if (isExtractable(id)) out.add(id);
  }
  return out;
}

describe("the lane check's extractor copy has not drifted", () => {
  const files = bpmnFiles(REPO);

  // A corpus of nothing would make every assertion below vacuously true —
  // `6tkl`, the same failure the check itself guards against.
  test("there are diagrams to compare", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test("every string the real extractor produces, the copy also produces", () => {
    const missing: string[] = [];
    for (const f of files) {
      const xml = readFileSync(f, "utf-8");
      const rel = relative(REPO, f);
      const mine = localMsgids(xml);
      for (const e of extractBpmn(xml, rel)) {
        if (!mine.has(e.msgid)) missing.push(`${rel}: ${e.msgid.slice(0, 70)}`);
      }
    }
    // A string the extractor emits and the copy does not would be reported as
    // NOT EXTRACTED while a translator can see it perfectly well — a false
    // finding, which fails CI on work that is right.
    expect(missing).toEqual([]);
  });

  test("the copy claims nothing the real extractor would not emit", () => {
    const extra: string[] = [];
    for (const f of files) {
      const xml = readFileSync(f, "utf-8");
      const rel = relative(REPO, f);
      const theirs = new Set(extractBpmn(xml, rel).map((e) => e.msgid));
      for (const id of localMsgids(xml)) {
        if (!theirs.has(id)) extra.push(`${rel}: ${id.slice(0, 70)}`);
      }
    }
    // The dangerous direction: the copy says "a translator will see this" for
    // a string the extractor drops, so the gate goes green over text that
    // reaches no catalogue in any locale.
    expect(extra).toEqual([]);
  });

  test("the regex reader sees every lane bpmn-moddle does", async () => {
    // THE BLIND SPOT, found 2026-09-22 while roasting bean `7pdi`.
    //
    // `translation-workflow.bpmn` writes `<lane>` and `<userTask>` with NO
    // `bpmn:` prefix — it declares BPMN as the default namespace, which is
    // valid and which every prefixed regex in this repository missed. The
    // real parser saw 3 lanes and 15 nodes there; `check-lane-documentation`
    // saw zero, and reported "157 of 157 documented, 0 undocumented" over a
    // corpus with 159 task-containing lanes, two of them undocumented.
    //
    // A clean run over a set it never scanned — `dh4f` — inside the gate
    // written to catch exactly that, and green for two days.
    //
    // Comparing against the parser rather than against a fixture is
    // what makes the shortcut legitimate: a fixture proves agreement on the
    // cases somebody thought to write down, and this one was not thought of.
    const drift: string[] = [];
    for (const f of files) {
      const rel = relative(REPO, f);
      const xml = readFileSync(f, "utf-8");
      const parsed = await moddleLaneCount(xml);
      if (parsed === null) continue;
      const seen = [...xml.matchAll(/<(?:bpmn:)?lane\b([^>]*?)(?:\/>|>)/g)].length;
      if (seen !== parsed) {
        drift.push(`${rel}: parser ${parsed} lane(s), regex ${seen}`);
      }
    }
    expect(drift).toEqual([]);
  });

  test("at least one diagram uses the UNPREFIXED form", () => {
    // Without this the test above passes vacuously the day that diagram is
    // deleted or reformatted, and the guard silently stops guarding — the
    // `6tkl` shape applied to a regression test.
    const unprefixed = files.filter((f) => /<lane\b/.test(readFileSync(f, "utf-8")));
    expect(unprefixed.length).toBeGreaterThan(0);
  });

  test("the corpus it is actually run against comes back clean", () => {
    const r = checkLanes(REPO);
    expect(r.unextracted).toEqual([]);
    expect(r.undocumented).toEqual([]);
    expect(r.unnamed).toEqual([]);
    expect(r.orphans).toEqual([]);
    expect(r.lanes).toBeGreaterThan(0);
  });
});
