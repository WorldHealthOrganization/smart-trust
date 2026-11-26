#!/usr/bin/env bun
/**
 * The archive is a DECLARED view, and everything in it is terminal.
 *
 * Archiving is a **view**, not a terminal state: an archived bean keeps its
 * status and is still part of the store. Two rules follow.
 *
 * ## 1. The archive directory is declared
 *
 * `beans/defs/archive/` must be declared in `beans/beans.json`.
 * `check:declared-dirs` and `check:harness-dirs` compare declarations
 * against disk, so a present directory missing from the declaration is
 * invisible to them by construction.
 *
 * ## 2. Every archived bean is terminal
 *
 * Archiving is a file move, not a status change, and the counts this
 * repository quotes read the active store only. An archived bean still
 * `todo` or `in-progress` is work nobody can see, set aside without a
 * recorded reason.
 *
 * ## What it does NOT do
 *
 * It does not hold archived beans to `check:bean-parents`, `bean-rollup` or
 * `bean-blocks`: those are about work in front of somebody, and historical
 * beans were never held to today's conventions. Terminality is the one
 * property the view requires.
 *
 * Exit: 0 declared and all terminal, 1 undeclared or a non-terminal bean,
 * 2 COULD NOT DETERMINE (declared and absent).
 *
 * @module folio-assistant/scripts/check-bean-archive
 * @covers bean-defs, beans
 */
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import { readArchivedBeans, resolveBeanArchive, resolveBeanDefs, type BeanNode } from "./beans.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

export const ROOT = resolve(import.meta.dir, "..", "..");

/**
 * Statuses that mean the work is over.
 *
 * `beans` stores five (`in-progress`, `todo`, `draft`, `completed`,
 * `scrapped`) and there is no sixth it can hold — which is why the owner chose
 * VIEW over a new terminal state, and is the same ceiling that made
 * `status: blocked` a rule with 0 % compliance until #951 replaced it.
 */
export const TERMINAL = new Set(["completed", "scrapped"]);

export interface ArchiveFinding {
  readonly bean: string;
  readonly file: string;
  readonly status: string;
}

/** Archived beans whose status is not terminal. */
export function nonTerminal(beans: readonly BeanNode[]): ArchiveFinding[] {
  return beans
    .filter((b) => !TERMINAL.has(b.status ?? ""))
    .map((b) => ({ bean: b.id, file: b.file, status: b.status ?? "(none)" }));
}

function main(): number {
  // An instance with no bean store has no archive to check (smart-ips-pilgrimage#13).
  const where = resolveBeanDefs(ROOT);
  if (where.absent) exitNotApplicable("check:bean-archive", `this checkout has no bean store (${where.unreachable})`);
  const { dir, declared } = resolveBeanArchive(ROOT);

  if (!declared || dir === null) {
    console.error(
      "::error::check:bean-archive: `beans/beans.json` declares no `archive` node.\n" +
        "Bean `e8m3`: 631 bean-defs sat in an undeclared `beans/defs/archive/` and no\n" +
        "directory check could see it, because they compare declarations against disk\n" +
        "and not the reverse. Declare it, with `graphTypologies: [\"bean-defs\"]`.",
    );
    return 1;
  }

  if (!existsSync(dir)) {
    console.error(
      `::error::check:bean-archive: the graph declares \`archive\` at ` +
        `${relative(ROOT, dir)} and it is not there — COULD NOT DETERMINE, not empty.\n` +
        "That is `dh4f`: a consumer scans nothing and reports a clean run over it.",
    );
    return 2;
  }

  const beans = readArchivedBeans(ROOT);
  if (beans === null) {
    console.error("::error::check:bean-archive: could not read the archive — COULD NOT DETERMINE.");
    return 2;
  }

  const bad = nonTerminal(beans);
  const byStatus = new Map<string, number>();
  for (const b of beans) byStatus.set(b.status ?? "(none)", (byStatus.get(b.status ?? "(none)") ?? 0) + 1);
  const spread = [...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(" · ");

  // A determined empty is a real answer and is said as one, so nobody reads it
  // as the could-not-determine above.
  console.log(
    `check:bean-archive: ${beans.length} bean(s) in the declared archive view` +
      (beans.length === 0 ? " — a determined empty." : `  (${spread})`),
  );

  if (bad.length === 0) {
    console.log("  ✓ every archived bean is terminal, so no open work is hidden from the counts.");
    return 0;
  }

  console.error(`\n✗ ${bad.length} archived bean(s) are NOT terminal:\n`);
  for (const f of bad) console.error(`  ${f.status.padEnd(12)} ${f.bean}  ${f.file}`);
  console.error(
    "\nThe owner ruled archiving is a VIEW, so these keep their status and are still\n" +
      "open work — but every count this repository quotes reads the active store only,\n" +
      "so none of them can see it. Either give each a terminal status WITH ITS REASON\n" +
      "(`scrapped` exists for exactly this, per `bean-coordination`), or move it back\n" +
      "into the active store. Bean `e8m3` measured 35 in one five-day window.\n",
  );
  return 1;
}

if (import.meta.main) process.exit(main());
