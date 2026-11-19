#!/usr/bin/env bun
/**
 * Which uncovered skills warrant a Tool — triaged by evidence, not by grep.
 *
 * `check:tools` reports that N skills have no Tool and deliberately does not
 * fail on it, because many skills are pure judgement. This answers the
 * question it cannot: **which of the uncovered ones still have their
 * mechanism inlined in their prose?**
 *
 * ## Why a grep is the wrong instrument
 *
 * Searching bodies for backticks or `gh `/`bun run` over-reports badly: a
 * skill may legitimately QUOTE a command as an example while stating its
 * capability generically.
 *
 * ## The discriminator the corpus already carries
 *
 * BPMN task **type**. A process step is a `serviceTask` (automated) or a
 * `userTask` (performed by a person), and the diagrams already say which.
 * One skill can be named by both (e.g. `interaction-modality`:
 * `Task_DetectModality` reads a preferences file, `Task_AskIntent` frames a
 * question). **So the question is "which PART of it is a Tool"**: the
 * mechanical half should move to a Tool and the judgement half never will.
 *
 * ## The tiers
 *
 * - **A** — a `serviceTask` names it, or it has an I/O contract under
 *   `schemas/skills/`. Somebody modelled it as a thing that runs. A Tool is
 *   warranted; this is the list to act on.
 * - **B** — a `userTask` only. Judgement exercised inside a process.
 * - **C** — a shell block **or a declared `package.json` script**, and no
 *   process edge. **This is where a human read goes** — the evidence is
 *   genuinely ambiguous.
 * - **D** — nothing. Almost certainly judgement.
 *
 * C is the only tier needing a read.
 *
 * ## A declared script is evidence too
 *
 * A skill that states its rules without ever SHOWING its command in a fence
 * would otherwise land in D. So a declared script counts, matched strictly —
 * a colon segment of the script's key equals the skill name, or the command
 * runs a file literally called `<skill>.ts`. Loose substring matching is not
 * used: a short skill name matches unrelated keys.
 *
 * @module scripts/tool-coverage
 */
import { skillContracts } from "./skill-contracts.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { tools } from "../tools/discover.js";
import { isGlobalTasksFile, loadProcessModel } from "../src/workflow/process-model.js";
import { isSkillMd, kgRoots, corpusScopeFor } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = join(HARNESS_ROOT);

/**
 * Every `scripts` key declared by this layer, from whichever `package.json`
 * carries them.
 *
 * Both are read and merged rather than one being hardcoded: after the
 * `cat-harness/` inversion the scripts live in the ROOT manifest while this
 * file sits one level down, and a single hardcoded path is what breaks silently
 * the next time the tree moves — yielding an empty index, which reads as "no
 * skill has a command" rather than as a failure to look.
 */
export function declaredScripts(): [string, string][] {
  // Every manifest the checkout's script table reads (bean `ar1s` phase 4:
  // the scripts left the root for the layers that run them).
  try {
    return Object.entries(scriptsOf(join(ROOT, "..")));
  } catch (e) {
    // A table that will not build is another gate's problem; skipping it must
    // not be silent, because a shrunken index reads as a clean triage.
    console.warn(`  ⚠ could not read the script table (${(e as Error).message}); scripts are missing from this triage`);
    return [];
  }
}

/**
 * The script that runs a skill, if one is declared.
 *
 * STRICT on purpose — see the module docstring. A colon segment of the key, or a
 * command naming `<skill>.ts`. Never a substring of the key.
 */
export function scriptFor(skill: string, scripts: [string, string][]): string | undefined {
  return scripts.find(([k, v]) => k.split(":").includes(skill) || v.includes(`/${skill}.ts`))?.[0];
}

/**
 * Why a tier-A skill is uncovered HERE and that is not a gap to close.
 *
 * Tier A is the list an agent works from: *"a serviceTask names it, so a Tool
 * is warranted."* For most of it that is true. For a few it is permanently
 * false, and until 2026-09-25 nothing said so — so each one cost a session the
 * same re-derivation. Bean `w5h0` is the worked example: three possibilities
 * proposed, two refuted by measurement, and the residue was *"this group has no
 * entry point in this repository at all."* Owner's call, 2026-09-25: **record it
 * nodeless and note what a folio owes.**
 *
 * Two states, not one, because they have different remedies and lumping them
 * would hide that:
 *
 * | state | what is true | who closes it |
 * |---|---|---|
 * | `folio-mechanism` | a mechanism EXISTS and is a folio's; the diagram here invokes it | nobody — it is already satisfied, downstream |
 * | `contract-unsatisfied` | no mechanism ANYWHERE accepts the contract | whoever writes one |
 *
 * The second is populated by nothing yet, deliberately: `latex-authoring` and
 * `proof-verification` are its candidates and bean `jh2j` records the pattern —
 * *"an authoring skill's contract names the artefact being created; the corpus
 * has checking mechanisms"* — but the owner ruled on the first state only, and a
 * declaration is not the place to settle a second question quietly.
 *
 * Every entry must match a skill that is currently **uncovered and tier A**, or
 * the run fails. Same shape and same reason as `FOLIO_PATHS` in
 * `check-workflow-paths.ts`: an annotation for a skill that has since gained a
 * Tool is a claim about the present that stopped being true, and it would read
 * as "do not bother" over work that is now real.
 */
export interface UncoveredByDesign {
  skill: string;
  state: "folio-mechanism" | "contract-unsatisfied";
  reason: string;
}

export const UNCOVERED_BY_DESIGN: UncoveredByDesign[] = [
  {
    skill: "content-author",
    state: "folio-mechanism",
    reason:
      "bean `w5h0`. Its group is 14 files: 13 are LIBRARIES (`block-module` alone " +
      "is imported by `schemas/kg/jsonld.ts`, `gen-block-jsonld`, `qa-utils`, " +
      "`graph-index`, `verify-block-walk` and two audits) and the 14th, " +
      "`check-voices.ts`, was a categoriser bug since re-filed. A Tool node needs " +
      "an `invoke`, and the command that authors a block is in a folio's " +
      "`package.json`, which this repository cannot read. `Task_AuthorBlocks` " +
      "being a `serviceTask` is NOT a drafting error: `content-author` is named by " +
      "five activities in three element types — `serviceTask` here and in " +
      "`editing-hci-validation`, `userTask` at `evidence-retrieval`'s " +
      "`Task_FramePico`, and `callActivity` in `content-lifecycle` and " +
      "`draft-to-publication` — so the corpus already says it is agent-performed " +
      "in some lanes and person-performed in others",
  },
  {
    skill: "document-authoring",
    state: "folio-mechanism",
    reason:
      "the document half of the same group, for the same reason: `satisfies` " +
      "being an array is what would let one Tool name both, and there is no " +
      "command here for either to name",
  },
  {
    skill: "content-publish",
    state: "folio-mechanism",
    reason:
      "bean `v7bg`. Its required `versionIncrement` is supplied by a PERSON at " +
      "`draft-to-publication.bpmn`'s `Task_AuthorizeRelease` (a `userTask`, line " +
      "176), one step upstream of `Task_PublishRelease` — *\"Version bump, release " +
      "notes, tag, build the final artifacts, deploy to the publication " +
      "platform.\"* So the contract describes the flow its own diagram draws, and " +
      "the mechanism is a folio's. NOT to be confused with `package-release`, " +
      "which versions CODE and does have Tool nodes here",
  },
];

/** The annotation for a skill, if it is uncovered by design. */
export function uncoveredByDesign(skill: string): UncoveredByDesign | undefined {
  return UNCOVERED_BY_DESIGN.find((u) => u.skill === skill);
}

/**
 * Entries matching no uncovered tier-A skill — each a stale claim.
 *
 * Returns the entry and why it no longer holds, rather than a bare list, so the
 * reader is not left to work out which of the two failures they are looking at.
 */
export function staleAnnotations(rows: SkillTriage[]): { entry: UncoveredByDesign; why: string }[] {
  return UNCOVERED_BY_DESIGN.flatMap((entry) => {
    const row = rows.find((r) => r.skill === entry.skill);
    if (!row) return [{ entry, why: "no longer in the uncovered set — it has a Tool now" }];
    if (row.tier !== "A") return [{ entry, why: `now tier ${row.tier}, not A` }];
    return [];
  });
}

export type Tier = "A" | "B" | "C" | "D";

export interface SkillTriage {
  skill: string;
  tier: Tier;
  evidence: string[];
}

/**
 * Every directory holding skills — the declared graph, plus the one place a
 * declaration cannot reach.
 *
 * The declared part comes from {@link kgRoots} rather than from `"skills"`,
 * because a layer may put its knowledge graph anywhere and this repository
 * declares TWO such directories since `src/skills/` was declared (bean `osbo`).
 * A package is a subdirectory holding skills; a kg directory may also hold them
 * DIRECTLY, which is what `src/skills/` does.
 */
function skillDirs(): string[] {
  const d: string[] = [];
  for (const abs of kgRoots(ROOT, corpusScopeFor(ROOT))) {
    const rel = relative(ROOT, abs);
    if (holdsSkillMd(abs)) d.push(rel);
    // One level, or two inside a topic `skills.json` declares (bean `9umr`).
    // This walk was one level only, so from #1618 on it silently lost every
    // skill moved into a topic — found when three "uncovered by design"
    // annotations read as stale after the authoring move.
    for (const p of packageDirsIn(abs)) {
      if (holdsSkillMd(p.dir)) d.push(`${rel}/${p.rel}`);
    }
  }
  // declared-path-literal: `.claude/skills/local/` is the agent harness's own
  // directory and is NOT a `cat-harness` graph in any layer's declaration,
  // so no declaration answers it. It is named here rather than discovered.
  const local = ".claude/skills/local";
  if (existsSync(join(ROOT, local))) d.push(local);
  return d;
}

/** Does this directory hold at least one skill `.md` directly? */
function holdsSkillMd(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".md") && isSkillMd(join(dir, f)));
  } catch {
    return false;
  }
}

function bpmnDirs(rel = ".", depth = 0): string[] {
  if (depth > 4) return [];
  const out: string[] = [];
  let es;
  try {
    es = readdirSync(join(ROOT, rel), { withFileTypes: true });
  } catch {
    return [];
  }
  if (es.some((e) => e.isFile() && e.name.endsWith(".bpmn"))) out.push(rel);
  for (const e of es) {
    // input-site: inert #ad3f44f1 — names the directories the walk skips; none of them is read
    if (e.isDirectory() && !["node_modules", ".git", "_site", "_kg"].includes(e.name) && !e.name.startsWith(".")) {
      out.push(...bpmnDirs(rel === "." ? e.name : `${rel}/${e.name}`, depth + 1));
    }
  }
  return out;
}

export async function triage(): Promise<SkillTriage[]> {
  const bodies = new Map<string, string>();
  for (const dir of skillDirs()) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (f.endsWith(".md")) bodies.set(f.slice(0, -3), readFileSync(join(ROOT, dir, f), "utf-8"));
    }
  }

  const scripts = declaredScripts();

  // The skills that NAME a contract (`input:`/`output:`, #1168 B3b) — not the
  // directories under `schemas/skills/`, which is the convention B3b retired.
  const io = new Set(skillContracts(ROOT).keys());

  const auto = new Set<string>();
  const human = new Set<string>();
  for (const d of bpmnDirs()) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (!f.endsWith(".bpmn")) continue;
      // A layer's global-tasks file holds no process: its tasks' skills reach
      // this triage through the call activities that name them.
      if (isGlobalTasksFile(readFileSync(join(ROOT, d, f), "utf-8"))) continue;
      try {
        const m = await loadProcessModel(join(ROOT, d, f));
        for (const n of m.nodes.values()) {
          for (const s of n.skills) {
            // `serviceTask`/`scriptTask` run without a person; `userTask`/
            // `manualTask` are performed by one. That is the discriminator.
            if (/service|script|send/i.test(n.type)) auto.add(s);
            if (/user|manual|receive/i.test(n.type)) human.add(s);
          }
        }
      } catch {
        // A diagram that will not load is check:workflow-refs' problem, not this
        // tool's — but it must not silently shrink the evidence either.
        console.warn(`  ⚠ could not load ${d}/${f}; its skill edges are missing from this triage`);
      }
    }
  }

  const covered = new Set(tools().flatMap((t) => t.satisfies));
  const out: SkillTriage[] = [];
  for (const [skill, body] of [...bodies].sort()) {
    if (covered.has(skill)) continue;
    const isAuto = auto.has(skill);
    const isHuman = human.has(skill);
    const hasIo = io.has(skill);
    const fenced = /```(sh|bash|console)\n/.test(body);
    const script = scriptFor(skill, scripts);
    const shell = fenced || script !== undefined;

    const evidence: string[] = [];
    if (isAuto) evidence.push("serviceTask");
    if (hasIo) evidence.push("io-contract");
    if (isHuman) evidence.push("userTask");
    if (fenced) evidence.push("shell-block");
    // Named, so the read that tier C asks for starts from the command rather
    // than from a hunt through 114 scripts.
    if (script) evidence.push(`script:${script}`);

    const tier: Tier = isAuto || hasIo ? "A" : isHuman ? "B" : shell ? "C" : "D";
    out.push({ skill, tier, evidence });
  }
  return out;
}

if (import.meta.main) {
  const rows = await triage();
  const by = (t: Tier): SkillTriage[] => rows.filter((r) => r.tier === t);

  const LABEL: Record<Tier, string> = {
    A: "A — a serviceTask names it, or it has an I/O contract. A Tool is warranted.",
    B: "B — a userTask only. Judgement exercised inside a process.",
    C: "C — a shell block or a declared script, no process edge. THE READ GOES HERE; evidence is ambiguous.",
    D: "D — no evidence. Almost certainly judgement.",
  };

  for (const t of ["A", "B", "C", "D"] as Tier[]) {
    const list = by(t);
    console.log(`\n${LABEL[t]}  (${list.length})`);
    // C IS PRINTED, and that is the fix rather than an inconsistency: this
    // report's own label for it is "THE READ GOES HERE" and its closing line
    // says "only tier C needs reading". Printing a bare count under both
    // sentences told the reader to go and read a list it declined to name, so
    // the read could only be done by re-running the triage by hand.
    //
    // D stays a count. Its label is "no evidence, almost certainly judgement",
    // so 80 names under a heading that says not to read them is noise that
    // pushes C off the screen. That is also why the D→C rule above matters more
    // than this printing change: a skill in D is not merely unprinted, it is
    // labelled as not worth reading.
    if (t !== "D")
      for (const r of list) {
        const u = uncoveredByDesign(r.skill);
        // The annotation goes on the ROW rather than into a separate section,
        // because the failure it fixes is an agent reading this list top to
        // bottom and treating every line as work. A footnote it has already
        // scrolled past does not reach it.
        const mark = u ? `  ← by design (${u.state})` : "";
        console.log(`  ${r.skill.padEnd(32)} ${r.evidence.join(", ")}${mark}`);
      }
  }

  // Printed after the tiers and before the totals, so the count that follows
  // can be read against it.
  const byDesign = by("A").filter((r) => uncoveredByDesign(r.skill));
  if (byDesign.length > 0) {
    console.log(
      `\n${byDesign.length} of the ${by("A").length} in A are uncovered BY DESIGN — not work:`,
    );
    for (const r of byDesign) {
      const u = uncoveredByDesign(r.skill)!;
      console.log(`  ${r.skill}  [${u.state}]`);
      console.log(`      ${u.reason.replace(/\s+/g, " ")}`);
    }
  }

  const stale = staleAnnotations(rows);
  for (const { entry, why } of stale) {
    console.error(`\n\u2717 UNCOVERED_BY_DESIGN names \`${entry.skill}\`, which is ${why}.`);
    console.error("  Remove the entry: it reads as \"do not bother\" over work that is now real.");
  }

  const both = by("A").filter((r) => r.evidence.includes("userTask"));
  console.log(
    `\n${rows.length} uncovered.  A=${by("A").length}  B=${by("B").length}  C=${by("C").length}  D=${by("D").length}`,
  );
  console.log(
    `\n${both.length} of the ${by("A").length} in A are ALSO a userTask — the same skill has a mechanical half\n` +
      `and a judgement half. For those the question is not "should this be a Tool" but\n` +
      `"which part of it is". Splitting the mechanism out is the work; the judgement stays.`,
  );
  console.log(`\nOnly tier C needs reading: ${by("C").length} files, not ${rows.length}.`);

  // A report, not a CI gate — `tools:coverage` is in no workflow. It still exits
  // non-zero on a stale annotation so a person running it sees the failure, and
  // `tool-coverage-uncovered-by-design.test.ts` is what makes CI enforce it.
  if (stale.length > 0) process.exit(1);
}
