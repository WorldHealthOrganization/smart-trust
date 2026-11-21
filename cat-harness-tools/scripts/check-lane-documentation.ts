#!/usr/bin/env bun
/**
 * A task's containing swimlane must DEFINE itself — `name` is not a definition.
 *
 * @module scripts/check-lane-documentation
 * @covers processes, scenarios
 *
 * A BPMN lane's `name` and `<bpmn:documentation>` together are what the
 * glossary reads as a term's label and definition. The subject is every lane
 * that contains a task (a lane nothing happens in is a drawing decision).
 * An activity in no lane cannot be answered and is reported in its own
 * family, never as a pass.
 *
 * Axes, each its own family:
 *
 * | axis | who can fix it |
 * |---|---|
 * | `name` — the term's LABEL | an author |
 * | `documentation` — its DEFINITION | an author |
 * | extracted for translation (names reach every `.pot`) | the platform |
 *
 * ## A lane may be defined BY REFERENCE (owner, 2026-11-15, Q-LANE-2 A)
 *
 * A lane whose standard BPMN `partitionElementRef` names a content block (a
 * persona such as `pers:registration-officer`) whose prose is non-empty is
 * documented: that block IS the definition, and the lane only points at it.
 * Copying the sentence into `<bpmn:documentation>` would be a second source of
 * truth that drifts the day the persona is reworded, so the check resolves the
 * reference instead of asking for a copy. The block's text is translated with
 * the block, so the extraction axis below asks only about a lane's OWN
 * strings. A reference that resolves to nothing is still undocumented.
 *
 * The translation axis checks EXTRACTION, not that a translation exists:
 * catalogues ship with empty `msgstr` awaiting a person. `extractBpmn`
 * already handles `<documentation>`, so a definition written here reaches
 * every locale's catalogue on the next extract.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-lane-documentation.ts
 *   bun run cat-harness-tools/scripts/check-lane-documentation.ts --json
 *   bun run cat check:lane-documentation:check   # JUDGE: compute and judge, write nothing (the gate)
 *
 * Exit (writer): 0 clean, 1 any finding or zero diagrams. Judge mode
 * (`--check`): 0 clean · 1 any of the four families · 2 zero diagrams, an
 * unknown flag, or a run that threw. An activity in no lane is a FINDING in
 * both modes.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO = resolve(INSTANCE_ROOT, "..");

/**
 * `decodeLabel` and the extractor's own filter, DUPLICATED on purpose.
 *
 * The originals are `pipeline/bpmn-translate.ts`, which is
 * `folio-assist-core`; this module is `agentic-harness`, and
 * `check:partition` refuses the edge because core depends on the harness
 * rather than the other way round. That refusal is right — the alternative
 * to a duplicate here is a cycle between two layers.
 *
 * **An unchecked duplicate would be the worse bug**, because the question this
 * check asks is precisely "would the REAL extractor see this string": a copy
 * that drifts answers a question nobody asked and reports green while a
 * translator sees nothing. So `lane-extraction-parity.test.ts` asserts these
 * two produce the same msgid set as `extractBpmn` over every diagram in the
 * corpus, and fails the day either side moves.
 *
 * `AGENTS.md`: an unavoidable duplicate is fine while an unchecked one is not.
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

/** The extractor's own guard: empty is not a string, and a bare id is not prose. */
function isExtractable(msgid: string): boolean {
  if (!msgid) return false;
  return !(/^[A-Za-z_][A-Za-z0-9_]*$/.test(msgid) && /_/.test(msgid));
}

/** Activity elements whose containing lane a reader must be able to read. */
const ACTIVITY =
  "task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess";

export interface LaneFinding {
  /** Repo-relative diagram. */
  readonly file: string;
  /** The lane's id — stable across a rename, which is what a fix is tracked by. */
  readonly lane: string;
  /** The lane's `name`, which is the HALF that exists. */
  readonly name: string | null;
  /** How many activities sit in it — a lane with more is worth documenting first. */
  readonly activities: number;
}

/** An activity in no lane at all: the question cannot be asked about it. */
export interface OrphanActivity {
  readonly file: string;
  readonly activity: string;
}

export interface LaneReport {
  readonly diagrams: number;
  readonly activities: number;
  /** Lanes containing at least one activity — the subject set. */
  readonly lanes: number;
  /** ...of those, carrying `<bpmn:documentation>`. */
  readonly documented: number;
  /** ...of those documented, how many by a resolved `partitionElementRef` rather than their own text. */
  readonly documentedByReference: number;
  /** ...of those, not. The finding. */
  readonly undocumented: LaneFinding[];
  /** ...of those, carrying no usable `name`. A term with no label. */
  readonly unnamed: LaneFinding[];
  /**
   * Lane strings absent from their diagram's translation template.
   *
   * EXTRACTION, not translation — see the header. A string nobody extracted
   * cannot be translated by anybody, which is a platform defect; an extracted
   * string with an empty `msgstr` is a person's outstanding work.
   */
  readonly unextracted: { file: string; lane: string; text: string; kind: "name" | "documentation" }[];
  /** Activities outside any lane. UNDETERMINED, never a pass. */
  readonly orphans: OrphanActivity[];
}

/**
 * Every `.bpmn` diagram git accounts for, outside dot directories.
 *
 * `xd1g`. Measured at the conversion: **74 before, 74 after**.
 */
function bpmnFiles(root: string): string[] {
  return gitFiles(root, (rel) => rel.endsWith(".bpmn") && !rel.split("/").some((s) => s.startsWith("."))).files;
}

/**
 * Content-block labels whose prose is non-empty: the definitions a lane's
 * `partitionElementRef` may resolve to.
 *
 * A block is a `.ts` manifest declaring `label: "<label>"` beside a `.md` of
 * the same stem; the `.md` is its text. Regex rather than an import, as
 * `parseBlockManifest` reads manifests, so this layer names no content kind.
 */
export function definedBlockLabels(root: string): Set<string> {
  const out = new Set<string>();
  const manifests = gitFiles(root, (rel) => rel.endsWith(".ts") && !rel.split("/").some((s) => s.startsWith("."))).files;
  for (const f of manifests) {
    const md = f.replace(/\.ts$/, ".md");
    if (!existsSync(md)) continue;
    const label = /\blabel:\s*["']([^"']+)["']/.exec(readFileSync(f, "utf-8"))?.[1];
    if (label === undefined) continue;
    // Same guard as an empty `<documentation/>`: whitespace is not a definition.
    if (/\S/.test(readFileSync(md, "utf-8"))) out.add(label);
  }
  return out;
}

/**
 * Read every diagram and answer the lane question for each activity.
 *
 * Regex rather than an XML parse, matching `check-workflow-refs` and
 * `translate-bpmn` beside it: the corpus is this repository's own diagrams,
 * written by one generator and one set of agents, and adding a parser
 * dependency for three element names is a cost with no finding behind it.
 */
export function checkLanes(root = REPO): LaneReport {
  const files = bpmnFiles(root);
  let activities = 0;
  const documented: string[] = [];
  const byReference = new Set<string>();
  let blockDefs: Set<string> | undefined;
  const resolves = (ref: string): boolean => (blockDefs ??= definedBlockLabels(root)).has(ref);
  const undocumented: LaneFinding[] = [];
  const unnamed: LaneFinding[] = [];
  const unextracted: LaneReport["unextracted"][number][] = [];
  const orphans: OrphanActivity[] = [];

  /**
   * The msgids the EXTRACTOR produces for a diagram — not the bytes of a
   * `.pot`.
   *
   * This asked `pot.includes(text)` until 2026-09-21, and it was wrong in the
   * way a check must never be wrong: it reported 13 correctly-extracted lanes
   * as missing. gettext wraps a long msgid across several quoted lines and
   * escapes every `"` as `\"`, so a substring search for prose of any length,
   * or prose containing a quotation mark, cannot match a template that
   * contains it. A false finding is worse than no check — it fails CI on
   * work that is right, and the next agent learns to disbelieve the report.
   *
   * Asking `extractBpmn` instead answers the question this family actually
   * poses: would a translator ever SEE this string. That is independent of
   * how a `.pot` is formatted, and it stays out of `translate-bpmn --check`'s
   * territory, which owns whether the template on disk is current.
   */
  const msgidsFor = (xml: string, rel: string): Set<string> => {
    void rel;
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
  };

  for (const f of files) {
    const rel = relative(root, f);
    const s = readFileSync(f, "utf-8");
    const msgids = msgidsFor(s, rel);

    // lane id -> { name, hasDoc, members }
    const lanes = new Map<
      string,
      { name: string | null; hasDoc: boolean; doc: string | null; ref: string | null; members: Set<string> }
    >();
    const laneRe = new RegExp(`<(?:bpmn:)?lane\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:bpmn:)?lane>)`, "g");
    for (let m = laneRe.exec(s); m !== null; m = laneRe.exec(s)) {
      const attrs = m[1] ?? "";
      const body = m[2] ?? "";
      const id = /id="([^"]+)"/.exec(attrs)?.[1];
      if (id === undefined) continue;
      const members = new Set<string>();
      const refRe = /<(?:bpmn:)?flowNodeRef>([^<]+)<\/(?:bpmn:)?flowNodeRef>/g;
      for (let r = refRe.exec(body); r !== null; r = refRe.exec(body)) members.add(r[1]!.trim());
      lanes.set(id, {
        name: /name="([^"]+)"/.exec(attrs)?.[1] ?? null,
        // A `<documentation/>` with no text is NOT documentation. An empty
        // element would otherwise let this check be satisfied by a keystroke,
        // which is the shape of every gate that stops meaning anything.
        hasDoc: /<(?:bpmn:)?documentation[^>]*>\s*\S[\s\S]*?<\/(?:bpmn:)?documentation>/.test(body),
        doc: /<(?:bpmn:)?documentation[^>]*>([\s\S]*?)<\/(?:bpmn:)?documentation>/.exec(body)?.[1]?.trim() ?? null,
        ref: /\bpartitionElementRef="([^"]+)"/.exec(attrs)?.[1] ?? null,
        members,
      });
    }

    const actRe = new RegExp(`<(?:bpmn:)?(?:${ACTIVITY})\\b[^>]*id="([^"]+)"`, "g");
    for (let a = actRe.exec(s); a !== null; a = actRe.exec(s)) {
      activities += 1;
      const id = a[1]!;
      const owner = [...lanes.entries()].find(([, l]) => l.members.has(id));
      if (owner === undefined) {
        orphans.push({ file: rel, activity: id });
        continue;
      }
      const [lid, lane] = owner;
      const key = `${rel}#${lid}`;
      if (lane.hasDoc) {
        if (!documented.includes(key)) documented.push(key);
      } else if (lane.ref !== null && resolves(lane.ref)) {
        if (!documented.includes(key)) documented.push(key);
        byReference.add(key);
      } else if (!undocumented.some((u) => u.file === rel && u.lane === lid)) {
        undocumented.push({ file: rel, lane: lid, name: lane.name, activities: 0 });
      }

      // A lane with no usable `name` is a term with no LABEL — a separate
      // failure from having no definition, and reported separately so a fix
      // for one is not read as a fix for the other.
      const named = typeof lane.name === "string" && lane.name.trim().length > 0;
      if (!named && !unnamed.some((u) => u.file === rel && u.lane === lid)) {
        unnamed.push({ file: rel, lane: lid, name: lane.name, activities: 0 });
      }

      // EXTRACTION, not translation. A template that does not exist is not a
      // finding about this lane — `translate-bpmn --check` owns "a diagram was
      // never extracted", and reporting it here too would make one defect
      // look like two.
      const tpl = msgids;
      if (named && !tpl.has(decodeLabel(lane.name!))) {
        if (!unextracted.some((u) => u.file === rel && u.lane === lid && u.kind === "name")) {
          unextracted.push({ file: rel, lane: lid, text: lane.name!, kind: "name" });
        }
      }
      if (lane.hasDoc && lane.doc !== null && !tpl.has(decodeLabel(lane.doc))) {
        if (!unextracted.some((u) => u.file === rel && u.lane === lid && u.kind === "documentation")) {
          unextracted.push({ file: rel, lane: lid, text: lane.doc.slice(0, 60), kind: "documentation" });
        }
      }
    }

    // Count members per finding, so the fix can be ordered by reach.
    for (const u of undocumented.filter((x) => x.file === rel)) {
      const lane = lanes.get(u.lane);
      if (lane === undefined) continue;
      let n = 0;
      const actRe2 = new RegExp(`<(?:bpmn:)?(?:${ACTIVITY})\\b[^>]*id="([^"]+)"`, "g");
      for (let a = actRe2.exec(s); a !== null; a = actRe2.exec(s)) {
        if (lane.members.has(a[1]!)) n += 1;
      }
      (u as { activities: number }).activities = n;
    }
  }

  return {
    diagrams: files.length,
    activities,
    lanes: documented.length + undocumented.length,
    documented: documented.length,
    documentedByReference: byReference.size,
    undocumented: undocumented.sort((a, b) => b.activities - a.activities || a.file.localeCompare(b.file)),
    unnamed: unnamed.sort((a, b) => a.file.localeCompare(b.file)),
    unextracted: unextracted.sort((a, b) => a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind)),
    orphans: orphans.sort((a, b) => a.file.localeCompare(b.file)),
  };
}

/** The sidecar document for a report. Pure, so the judge and the writer render ONE computation. */
export function laneDocumentationDocument(r: LaneReport): QaResult {
  return buildQaResult({
    script: "cat-harness-tools/scripts/check-lane-documentation.ts",
    scriptAbsPath: resolve(import.meta.dir, "check-lane-documentation.ts"),
    subject: { kind: "corpus", id: "bpmn-lanes" },
    families: {
      "undocumented-lane": {
        summary:
          "A lane containing at least one activity, carrying a `name` but no `<bpmn:documentation>`, and no " +
          "`partitionElementRef` to a content block with non-empty prose (a persona that defines it). " +
          "A reader meeting the task cannot learn what the lane is, and the glossary has a label with no definition.",
        entries: r.undocumented,
      },
      "lane-without-name": {
        summary:
          "A lane containing an activity, with no usable `name`. The glossary term has no LABEL — a " +
          "separate failure from having no definition, so a fix for one is not read as a fix for the other.",
        entries: r.unnamed,
      },
      "lane-string-not-extracted": {
        summary:
          "A lane `name` or `<documentation>` the extractor does not produce a msgid for — so no translator " +
          "could ever see it, in any locale. This asks about EXTRACTION, never about a translation existing: " +
          "catalogues here ship with an empty `msgstr` awaiting a person, and gating on that would be a gate " +
          "on somebody else's unfinished work. It asks `extractBpmn` rather than searching a `.pot`'s bytes, " +
          "because gettext wraps a long msgid across quoted lines and escapes every `\"` — a substring search " +
          "reported 13 correctly-extracted lanes as missing on 2026-09-21, and a false finding is worse than " +
          "no check. WHETHER A TEMPLATE ON DISK CARRIES IT is a different question, owned by " +
          "`translate-bpmn --check`; for the three `bootstrap/` diagrams that check does not scan, it is " +
          "bean `j28g` and awaits a ruling.",
        entries: r.unextracted,
      },
      "activity-outside-any-lane": {
        summary:
          "An activity in no lane. The containing-lane question cannot be asked about it, so it is reported " +
          "as UNDETERMINED rather than counted as passing.",
        entries: r.orphans,
      },
    },
  });
}

/**
 * Bean `bo44`'s four states over a report. Zero diagrams is `unknown`; any of
 * the four families — an activity in no lane included, as the writer has
 * always failed on it — is a finding.
 */
export function judgeLaneDocumentation(r: LaneReport): Judgement {
  return judgementOf({
    failing: r.undocumented.length + r.unnamed.length + r.unextracted.length + r.orphans.length,
    undetermined: r.diagrams === 0,
  });
}

if (import.meta.main && judging()) {
  // Judge mode: compute, judge, write NOTHING (bean `bo44`).
  const GATE = "check:lane-documentation";
  const usage = judgeUsage(GATE, process.argv.slice(2), []);
  if (usage !== undefined) process.exit(usage);
  let jr: LaneReport;
  try {
    jr = checkLanes();
  } catch (e) {
    process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
  }
  for (const u of jr.undocumented.slice(0, 12)) {
    console.error(`  ✗ ${u.file}#${u.lane}  ${u.name ?? "(unnamed)"}  — undocumented`);
  }
  if (jr.undocumented.length > 12) console.error(`  … and ${jr.undocumented.length - 12} more undocumented`);
  for (const u of jr.unnamed) console.error(`  ✗ ${u.file}#${u.lane}  has no name`);
  for (const u of jr.unextracted) console.error(`  ✗ ${JSON.stringify(u)}  not extracted`);
  for (const o of jr.orphans) console.error(`  ✗ ${JSON.stringify(o)}  is in no lane`);
  process.exit(
    concludeJudgement({
      gate: GATE,
      judgement: judgeLaneDocumentation(jr),
      detail:
        jr.diagrams === 0
          ? "no .bpmn diagrams found — every count would be vacuous"
          : `${jr.diagrams} diagram(s), ${jr.lanes} lane(s): ${jr.undocumented.length} undocumented, ` +
            `${jr.unnamed.length} unnamed, ${jr.unextracted.length} not extracted, ${jr.orphans.length} activit(ies) in no lane`,
      ...(jr.diagrams === 0
        ? {}
        : {
            committed: {
              root: INSTANCE_ROOT,
              stem: "lane-documentation",
              fresh: laneDocumentationDocument(jr),
              writer: GATE,
            },
          }),
    }),
  );
}

if (import.meta.main) {
  const r = checkLanes();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(`\nLane documentation — ${r.diagrams} diagram(s), ${r.activities} activit(ies)\n`);
    console.log(`  lanes containing an activity   ${r.lanes}`);
    console.log(`    with a name                  ${r.lanes - r.unnamed.length}`);
    console.log(`    UNNAMED                      ${r.unnamed.length}`);
    console.log(`    documented                   ${r.documented}`);
    console.log(`      by persona reference       ${r.documentedByReference}`);
    console.log(`    UNDOCUMENTED                 ${r.undocumented.length}`);
    console.log(`    strings NOT extracted        ${r.unextracted.length}`);
    if (r.orphans.length > 0) console.log(`  activities in NO lane           ${r.orphans.length}  (undetermined)`);
  }

  // ZERO DIAGRAMS IS A FINDING. Every number above is a count over the corpus,
  // and a corpus of nothing makes each of them zero — which reads as a clean
  // run. `6tkl`, and the one failure this check must not have.
  if (r.diagrams === 0) {
    console.error("\n::error::check-lane-documentation: no .bpmn diagrams found — every count above is vacuous");
    process.exit(1);
  }

  writeQaResult(INSTANCE_ROOT, "lane-documentation", laneDocumentationDocument(r));

  if (!process.argv.includes("--json")) {
    for (const u of r.undocumented.slice(0, 12)) {
      console.log(`  ✗ ${u.file}#${u.lane}  ${u.name ?? "(unnamed)"}  — ${u.activities} activit(ies)`);
    }
    if (r.undocumented.length > 12) console.log(`  … and ${r.undocumented.length - 12} more (see the QA result)`);
  }

  if (r.undocumented.length > 0 || r.unnamed.length > 0 || r.unextracted.length > 0 || r.orphans.length > 0) {
    process.exit(1);
  }
  console.log("\n✓ every task-containing lane has a name, a definition, and both are extractable");
  console.log("  (whether a template on disk is CURRENT is `translate-bpmn --check`'s question, not this one's)");
}
