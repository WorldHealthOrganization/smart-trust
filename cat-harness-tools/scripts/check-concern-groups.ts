#!/usr/bin/env bun
/**
 * Concern groups are declared from within, drawn from one code list, declared
 * once, and inherited as members.
 *
 * @module scripts/check-concern-groups
 * @covers cat-harness
 *
 * For every grouping kind ({@link groupingKinds}: skills, processes, schemas,
 * library, uml, code) and every directory of it in the checkout:
 *
 * 1. **The declaration file parses and every group it names exists** — a
 *    declared-but-absent group would be scanned as an empty, clean group.
 * 2. **Every group is a code of `code-lists/concern-group.json`.** The eight
 *    groups are one vocabulary across every layer and every kind; a code
 *    invented in one declaration is a ninth group nobody ruled on.
 *    Pre-existing exceptions (the harness's skills topic `authoring`) are
 *    BASELINED in `KNOWN_NON_CODES`. The baseline only shrinks — an entry
 *    that no longer occurs is a finding.
 * 3. **A group is declared once.** A higher layer whose same-named
 *    directory REDECLARES a group the harness declared is adding a group of
 *    its own; its directory is already a member.
 *
 * Prints each group with its members, so "core's `skills/library/` is a
 * member of the harness's `library` group" is a line a reviewer can read.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { directoriesForGraph, repoRootFor } from "../schemas/kg/cat-harness.ts";
import { checkoutDirectories } from "../schemas/kg/harness-config.ts";
import { gateOwnInstances, nothingOwnLine } from "./lib/gate-own.ts";
import { CONCERN_GROUP_LIST, declaredGroupsIn, groupingKinds, resolveGroups, type ResolvedGroup } from "./concern-groups.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE = HARNESS_ROOT;

/**
 * Groups that predate the code list, each with the PR that retires it.
 * Keyed `<kind>:<within>/<code>`.
 */
export const KNOWN_NON_CODES: Readonly<Record<string, string>> = {
  "skills:skills/authoring":
    "the harness's content-authoring topic from bean 9umr step 1; placement PR2 regroups it as `content` (owner ruling 2026-09-30, the eight groups)",
};

export interface ConcernGroupReport {
  codes: string[];
  groups: ResolvedGroup[];
  problems: string[];
  examined: number;
}

/** The concern-group codes, read from the platform's declared code list. */
export function concernGroupCodes(instance: string = INSTANCE): string[] | undefined {
  for (const dir of directoriesForGraph(instance, "code-list")) {
    const p = join(dir, `${CONCERN_GROUP_LIST}.json`);
    if (!existsSync(p)) continue;
    const list = JSON.parse(readFileSync(p, "utf-8")) as { codes?: Array<{ code?: string }> };
    return (list.codes ?? []).map((c) => String(c.code));
  }
  return undefined;
}

/**
 * `own`, when given, judges only what those layers commit (owner ruling
 * 2026-11-05, "Move the checks"; `lib/gate-own.ts`): their directories, the
 * groups they declare, and their redeclarations of a lower layer's group.
 * The baseline lives in this layer's own source, so its staleness is judged
 * only unscoped.
 */
export function collect(repo: string = repoRootFor(INSTANCE), instance: string = INSTANCE, own?: ReadonlySet<string>): ConcernGroupReport {
  const mine = (name: string) => own === undefined || own.has(name);
  const problems: string[] = [];
  const codes = concernGroupCodes(instance);
  if (codes === undefined) {
    return { codes: [], groups: [], problems: [`no \`${CONCERN_GROUP_LIST}\` code list in any declared code-list directory of ${relative(repo, instance)}`], examined: 0 };
  }
  let examined = 0;
  const groups: ResolvedGroup[] = [];
  const seenBaseline = new Set<string>();
  for (const kind of groupingKinds()) {
    // Rule 1, per directory, so one malformed file names itself and does not
    // hide every other directory's answer.
    for (const d of checkoutDirectories(repo).filter((x) => x.graphTypologies.includes(kind as never) && mine(x.member ?? x.declaredBy))) {
      examined += 1;
      try {
        declaredGroupsIn(d.absPath, kind);
      } catch (e) {
        problems.push(`${relative(repo, d.absPath)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    let resolved: ResolvedGroup[];
    try {
      resolved = resolveGroups(kind, repo);
    } catch {
      continue; // already reported per directory above
    }
    for (const g of resolved) {
      groups.push(g);
      const key = `${kind}:${g.within}/${g.code}`;
      if (!codes.includes(g.code) && mine(g.declaredBy)) {
        if (KNOWN_NON_CODES[key] !== undefined) seenBaseline.add(key);
        else {
          problems.push(
            `${g.declaredBy} ${g.within}/${g.code}/: "${g.code}" is not a code of code-lists/${CONCERN_GROUP_LIST}.json ` +
              `(${codes.join(", ")}). A group is one of the eight; add a code only by ruling.`,
          );
        }
      }
      if (g.redeclaredBy.some(mine)) {
        problems.push(
          `${g.within}/${g.code}/ is declared by ${g.declaredBy} and AGAIN by ${g.redeclaredBy.join(", ")}. ` +
            `A higher instance adds no group: its same-named directory is already a member (option A).`,
        );
      }
    }
  }
  for (const key of own === undefined ? Object.keys(KNOWN_NON_CODES) : []) {
    if (!seenBaseline.has(key)) problems.push(`baseline entry ${key} no longer occurs — remove it (the baseline only shrinks)`);
  }
  return { codes, groups, problems, examined };
}

if (import.meta.main) {
  const own = gateOwnInstances();
  const r = collect(undefined, undefined, own);
  if (own && r.examined === 0 && r.problems.length === 0) {
    console.log(nothingOwnLine("check:concern-groups", "grouping directory", own));
    process.exit(0);
  }
  if (r.examined === 0 && r.problems.length === 0) {
    console.error("NOTHING WAS EXAMINED — no grouping directory was found. That is not a pass.");
    process.exit(1);
  }
  const repo = repoRootFor(INSTANCE);
  for (const g of r.groups) {
    const members = g.members.map((m) => `${m.member}${m.member === g.declaredBy ? "" : ` (${relative(repo, m.absPath)})`}`);
    console.log(`  ${g.kind.padEnd(8)} ${`${g.within}/${g.code}`.padEnd(24)} declared by ${g.declaredBy}; members: ${members.join(", ")}`);
  }
  if (r.problems.length > 0) {
    console.error(`\n✗ ${r.problems.length} concern-group problem(s):`);
    for (const p of r.problems) console.error(`    ${p}`);
    process.exit(1);
  }
  console.log(
    `\n✓ ${r.examined} grouping director${r.examined === 1 ? "y" : "ies"} across ${groupingKinds().length} kinds: ` +
      `${r.groups.length} group(s), each a code of ${CONCERN_GROUP_LIST} (${r.codes.length} codes) or baselined, each declared once`,
  );
}
