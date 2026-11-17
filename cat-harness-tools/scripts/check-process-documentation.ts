#!/usr/bin/env bun
/**
 * A process must DEFINE itself — its name is not what it is for.
 *
 * @module scripts/check-process-documentation
 * @covers processes
 *
 * The sibling of `check-lane-documentation`, one level up: each `<process>`
 * must carry its own direct-child `<documentation>`. A lane's documentation is
 * never taken as the process's summary.
 *
 * Exit 0 on a finding by default; `--strict` exits 1 and is what CI runs once
 * the count is zero. An empty corpus is exit 2, never a pass.
 *
 * Every element is matched with an optional `bpmn:` prefix, since a diagram
 * may declare BPMN as the default namespace.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-process-documentation.ts
 *   bun run cat-harness-tools/scripts/check-process-documentation.ts --strict
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO = resolve(INSTANCE_ROOT, "..");

const ACTIVITY =
  "task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess";

export interface ProcessFinding {
  readonly file: string;
  readonly id: string;
  readonly name: string | null;
  /** Activities in it — a bigger process is worth defining first. */
  readonly activities: number;
  /**
   * What the index WOULD have shown before the extractor was scoped.
   *
   * Carried so a reader can see the borrowed answer that used to stand in for
   * the missing one, rather than taking the claim on trust.
   */
  readonly borrowedFrom: string | null;
}

export interface ProcessReport {
  readonly diagrams: number;
  readonly processes: number;
  readonly documented: number;
  readonly undocumented: ProcessFinding[];
  /** Processes carrying no `name` either — a thing with neither label nor definition. */
  readonly unnamed: ProcessFinding[];
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
 * The documentation a process carries ITSELF, and what it would have borrowed.
 *
 * "Itself" means a DIRECT child: only whitespace and XML comments may sit
 * between the `<process>` open tag and it. Anything else means the
 * documentation belongs to a lane, a task or a gateway — which is exactly the
 * confusion this check exists to end.
 */
export function ownDocumentation(xml: string): {
  own: string | null;
  borrowedFrom: string | null;
} {
  const open = /<(?:bpmn:)?process\b[^>]*>/.exec(xml);
  if (open === null) return { own: null, borrowedFrom: null };
  const after = xml.slice(open.index + open[0].length);
  const d = /<(?:bpmn:)?documentation>([\s\S]*?)<\/(?:bpmn:)?documentation>/.exec(after);
  if (d === null) return { own: null, borrowedFrom: null };
  const between = after.slice(0, d.index).replace(/<!--[\s\S]*?-->/g, "").trim();
  if (between === "") {
    // An EMPTY `<documentation/>` is not documentation — the same guard
    // `check-lane-documentation` applies, and for the same reason: a check
    // satisfiable by a keystroke stops meaning anything.
    return { own: d[1]!.trim() === "" ? null : d[1]!, borrowedFrom: null };
  }
  const owners = [...between.matchAll(/<(?:bpmn:)?([a-zA-Z]+)\b/g)].map((m) => m[1]!);
  return { own: null, borrowedFrom: owners.length > 0 ? owners[owners.length - 1]! : null };
}

export function checkProcesses(root = REPO): ProcessReport {
  const files = bpmnFiles(root);
  let processes = 0;
  let documented = 0;
  const undocumented: ProcessFinding[] = [];
  const unnamed: ProcessFinding[] = [];

  for (const f of files) {
    const rel = relative(root, f);
    const xml = readFileSync(f, "utf-8");
    const open = /<(?:bpmn:)?process\b([^>]*)>/.exec(xml);
    if (open === null) continue;
    processes += 1;
    const attrs = open[1] ?? "";
    const id = /id="([^"]+)"/.exec(attrs)?.[1] ?? rel;
    const name = /name="([^"]+)"/.exec(attrs)?.[1] ?? null;
    const activities = [
      ...xml.matchAll(new RegExp(`<(?:bpmn:)?(?:${ACTIVITY})\\b`, "g")),
    ].length;

    const { own, borrowedFrom } = ownDocumentation(xml);
    const finding: ProcessFinding = { file: rel, id, name, activities, borrowedFrom };
    if (own === null) undocumented.push(finding);
    else documented += 1;
    // A process with no `name` is a thing with neither label nor definition,
    // reported separately so a fix for one is not read as a fix for the other.
    if (name === null) unnamed.push(finding);
  }

  undocumented.sort((a, b) => b.activities - a.activities);
  return { diagrams: files.length, processes, documented, undocumented, unnamed };
}

if (import.meta.main) {
  const strict = process.argv.includes("--strict");
  const r = checkProcesses();

  console.log(`\nProcess documentation — ${r.diagrams} diagram(s), ${r.processes} process(es)\n`);
  console.log(`  documented                 ${String(r.documented).padStart(4)}`);
  console.log(`  UNDOCUMENTED               ${String(r.undocumented.length).padStart(4)}`);
  if (r.unnamed.length > 0) console.log(`  UNNAMED                    ${String(r.unnamed.length).padStart(4)}`);

  if (r.processes === 0) {
    console.error(`\nNo processes found under ${REPO} — refusing to call that clean.`);
    process.exit(2);
  }

  for (const u of r.undocumented) {
    const borrowed = u.borrowedFrom === null ? "" : `  (the index used to borrow its <${u.borrowedFrom}>'s)`;
    console.log(`  ✗ ${u.file}#${u.id}  ${u.name ?? "(unnamed)"}  — ${u.activities} activit(ies)${borrowed}`);
  }

  if (r.undocumented.length === 0) {
    console.log(`\n✓ every process says what it is for, not only what it is called`);
    process.exit(0);
  }
  console.log(
    `\n  A process's own documentation answers "what is this whole thing FOR, and when\n` +
      `  would I be in it" — the question a reader of the auto-docs index actually has.\n` +
      `  A lane's answers something else, and the index quoted one until 2026-09-22.\n` +
      `\n  Reported, not gated: a gate landing red on known blanks is one somebody\n` +
      `  switches off. \`--strict\` is what CI runs once this reaches zero (bean 7rna).`,
  );
  process.exit(strict ? 1 : 0);
}
