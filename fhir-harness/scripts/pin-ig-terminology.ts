#!/usr/bin/env bun
/**
 * Snapshot the terminology of a PUBLISHED IG at a pinned version.
 *
 * Generic to any FHIR IG whose code systems are FSH under
 * `input/fsh/codesystems/`, so it lives in fhir-harness (#1767, stage B′). It
 * was `cat-harness/scripts/pin-smart-base-terminology.ts`, with the WHO pin
 * record, snapshot path and source repository hard-coded; those are now
 * `--pin`, `--out` and `--source`. The concept extraction is unchanged.
 * The first use is still WHO's: `cat-harness/external-schemas/who-smart-base.json`,
 * which `check:term-mapping` reads, so the pin and snapshot files stay there.
 *
 * Bean `7wou` / `ejug`. The owner ruled 2026-09-30 that the `fhir` half of
 * `check:term-mapping` asserts **a published IG at a version** — not a live
 * curated collection — so the resolver needs that version's codes, offline
 * and byte-stable, rather than a service call whose answer moves.
 *
 * ## Why a snapshot rather than a fetch at check time
 *
 * Three reasons, and the first is the ruling itself. "This code exists in
 * the WHO SMART Base IG v1.0.0" is a claim about a fixed artefact; resolving it against
 * whatever a host serves today would quietly turn it back into the live-
 * collection claim the owner did not choose.
 *
 * Second, neither host is reachable here — this environment's network policy
 * refuses `smart.who.int:443` and `api.openconceptlab.org:443` alike (the
 * proxy logs 403 on CONNECT). GitHub git reads ARE served, which is how the
 * pin is refreshed, but a gate that needs the network is a gate that fails
 * for the wrong reason.
 *
 * Third, it is small: 585 concepts, ~120 KB of FSH at v1.0.0, which is a
 * snapshot worth committing rather than a corpus worth caching.
 *
 * ## It is DERIVED from the pin, and says so
 *
 * The version comes from the pin record named by `--pin`, never from this
 * file. Moving the pin and re-running is the whole update procedure, and
 * a snapshot whose `version` disagrees with the record is a defect the check
 * reports rather than tolerates.
 *
 * Usage:
 *   bun run fhir-harness/scripts/pin-ig-terminology.ts --from <clone> \
 *     --pin <repo-relative pin record> --out <repo-relative snapshot> --source <repository URL>
 *
 * WHO SMART base, the first and today only use:
 *   --pin cat-harness/external-schemas/who-smart-base.json
 *   --out cat-harness/external-schemas/who-smart-base.terminology.json
 *   --source https://github.com/WorldHealthOrganization/smart-base
 *
 * The clone is made by hand, at the pinned tag, because cloning an external
 * repository is not something a gate should do.
 *
 * @module fhir-harness/scripts/pin-ig-terminology
 * @covers external-schemas
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
/** `--name value`, or undefined. */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface PinnedConcept {
  /** The code system's FSH id, which is its identity inside the IG. */
  system: string;
  code: string;
  display: string;
}

/**
 * Concepts from one `.fsh` code system.
 *
 * FSH concept lines are `* #<code> "<display>" ["<definition>"]`, and the
 * code may be quoted when it contains a space. Header lines also begin `* ^`,
 * which is why the caret form is excluded rather than the line merely
 * starting with `*`.
 */
export function conceptsIn(fsh: string, system: string): PinnedConcept[] {
  const out: PinnedConcept[] = [];
  for (const line of fsh.split("\n")) {
    const m = /^\*\s+#("([^"]+)"|\S+)\s+"([^"]*)"/.exec(line.trim());
    if (!m) continue;
    const code = m[2] ?? m[1]!;
    out.push({ system, code, display: m[3]! });
  }
  return out;
}

export function snapshotFrom(clone: string): PinnedConcept[] {
  const dir = join(clone, "input", "fsh", "codesystems");
  const out: PinnedConcept[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".fsh")).sort()) {
    out.push(...conceptsIn(readFileSync(join(dir, f), "utf-8"), f.replace(/\.fsh$/, "")));
  }
  // Sorted, so a re-run over the same tag produces the same bytes.
  return out.sort((a, b) => a.system.localeCompare(b.system) || a.code.localeCompare(b.code));
}

function main(): number {
  const from = arg("--from");
  const PIN_RECORD = arg("--pin");
  const SNAPSHOT = arg("--out");
  const source = arg("--source");
  if (!from || !PIN_RECORD || !SNAPSHOT || !source) {
    console.error(
      "usage: --from <IG clone at the pinned tag> --pin <pin record> --out <snapshot> --source <repository URL>",
    );
    return 1;
  }
  const clone = resolve(from);
  const pin = JSON.parse(readFileSync(join(ROOT, PIN_RECORD), "utf-8")) as { version?: string };
  if (!pin.version || pin.version === "unpinned") {
    console.error(`${PIN_RECORD} is unpinned — pin a version before snapshotting it`);
    return 1;
  }
  const sushi = readFileSync(join(clone, "sushi-config.yaml"), "utf-8");
  const declared = /^version:\s*(\S+)/m.exec(sushi)?.[1];
  // The clone must BE the pinned version. A snapshot taken from `main` and
  // labelled v1.0.0 is the one way this file could assert something false.
  if (declared !== pin.version.replace(/^v/, "")) {
    console.error(
      `the clone declares version ${declared}, the pin says ${pin.version} — check out the pinned tag`,
    );
    return 1;
  }
  const concepts = snapshotFrom(clone);
  const body = {
    $schema: "folio-pinned-terminology/v1",
    _comment:
      `DERIVED from the version pinned in ${PIN_RECORD}. Never hand-edit: ` +
      "move the pin, re-clone at that tag, and re-run fhir-harness/scripts/pin-ig-terminology.ts. It exists " +
      "because the owner ruled 2026-09-30 that check:term-mapping's `fhir` half asserts a " +
      "PUBLISHED IG AT A VERSION rather than a live collection — so the codes must be fixed and " +
      "offline, not whatever a host serves today. Both hosts are in fact unreachable from CI.",
    pin: PIN_RECORD,
    version: pin.version,
    source,
    concepts,
  };
  writeFileSync(join(ROOT, SNAPSHOT), JSON.stringify(body, null, 2) + "\n");
  const systems = new Set(concepts.map((c) => c.system));
  console.log(`  wrote ${SNAPSHOT} — ${concepts.length} concept(s) in ${systems.size} code system(s) at ${pin.version}`);
  return 0;
}

if (import.meta.main) process.exit(main());
