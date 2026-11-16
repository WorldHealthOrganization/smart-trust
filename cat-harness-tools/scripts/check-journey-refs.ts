#!/usr/bin/env bun
/**
 * Every reference a journey (`user-scenario`) or a workshop names resolves.
 *
 * @module scripts/check-journey-refs
 * @covers user-scenario, workshop, building-blocks
 *
 * Usage:
 *   bun run cat check:journey-refs                 # the checkout the working directory is in
 *   bun run cat check:journey-refs --root <dir>    # another checkout
 *   bun run cat check:journey-refs --json          # the report as JSON
 *
 * What resolves, and against what, is `journeys/check.ts`; it resolves with
 * the journeys viewer's own reader, so the gate and the pages agree. Every
 * layer the checkout mounts is read through its declarations, so a
 * workshop in one layer that teaches from another's journeys is checked
 * whole.
 *
 * Exit 0 every reference resolves, or no layer declares a journey or a
 * workshop (said, with the count); 1 a reference does not resolve or a file
 * does not parse; 2 the declarations could not be read, or a reference could
 * be neither resolved nor called missing (a FHIR example while a declared
 * artifact index is built at publish and absent from this checkout).
 */
import { relative, resolve } from "node:path";

import { checkJourneyRefsAt } from "./journeys/check.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const root = resolve(arg("root") ?? process.cwd());
  const report = checkJourneyRefsAt(root);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const f of report.findings) console.error(`✗ ${f.instance}/${f.file} · ${f.at}: ${f.message}`);
    for (const f of report.couldNotDetermine) console.error(`? ${f.instance}/${f.file} · ${f.at}: ${f.message}`);
    for (const f of report.warnings) console.warn(`⚠ ${f.instance}/${f.file} · ${f.at}: ${f.message}`);
    if (report.undetermined !== undefined) {
      console.error(`? journey-refs: could not read the checkout's declarations (${report.undetermined}). Not a pass.`);
    } else if (report.findings.length === 0 && report.couldNotDetermine.length > 0) {
      console.error(`? journey-refs: ${report.couldNotDetermine.length} reference(s) could not be determined here. Not a pass.`);
    } else if (report.findings.length === 0) {
      console.log(
        report.journeys + report.workshops + report.screens === 0
          ? `✓ journey-refs: no instance in ${relative(process.cwd(), root) || "."} declares a user-scenario or workshop directory holding a node; 0 references to check`
          : `✓ journey-refs: ${report.references} reference(s) of ${report.journeys} journey(s), ${report.workshops} workshop(s) and ${report.screens} device screen(s) resolve`,
      );
    } else {
      console.error(`journey-refs: ${report.findings.length} finding(s) over ${report.references} reference(s) of ${report.journeys} journey(s), ${report.workshops} workshop(s) and ${report.screens} device screen(s)`);
    }
  }
  process.exit(report.findings.length > 0 ? 1 : report.undetermined !== undefined || report.couldNotDetermine.length > 0 ? 2 : 0);
}
