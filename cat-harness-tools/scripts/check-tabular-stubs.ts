#!/usr/bin/env bun
/**
 * QA that catches ABSENCE: a tool declared as a stub (`tabular-csv`,
 * `tabular-xlsx`) must not read as one that runs.
 *
 * Refused:
 *
 * 1. **A stub reported as a result.** A stubbed table is `not-derivable`
 *    naming the tool, never `met`.
 * 2. **A HALF-STUB** — `fac:stub` alongside real columns. The schema refuses
 *    it too, but only when somebody validates; a thin-but-present extraction
 *    reads as a working one.
 * 3. **AN EXPIRED STUB** — the tool now exists and `fac:stub` is still there.
 *
 * Whether a tool exists is read from the TOOL's own declaration
 * (`install: { none: true }` and no invoke path), never restated here.
 *
 * Exit 0 clean · 1 a finding · 2 could not determine, which is never a pass.
 *
 * @covers qa
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { libraryEntryDirs } from "./lib/library-entry-graphs.ts";
import { noteAbsent, splitDeclared } from "./lib/declared-presence.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { tools } from "../schemas/tools/harness-tools.ts";
import { TABULAR_CSVW_FILENAME, TabularCsvwSchema } from "../schemas/library/tabular-csvw.ts";
import { gateDirectoriesForGraph, nothingOwnLine } from "./lib/gate-own.ts";

const ROOT = HARNESS_ROOT;

export interface StubFinding {
  severity: "stub" | "half-stub" | "expired" | "unreadable";
  entry: string;
  detail: string;
}

/**
 * Tools that are declared but have no way to run — read, never restated.
 *
 * Nothing to install AND nothing to invoke but a person. `install: { none: true }`
 * alone cannot mean "stub": a working tool with no install step carries it
 * too (`dublin-core-render`, declared by the content core), and would read as an
 * unbuilt tool the moment its declarations join this set (bean `cat-tools-1wre`).
 */
export function stubbedTools(tools: readonly { id: string; install?: unknown; invoke?: unknown }[]): Set<string> {
  return new Set(
    tools
      .filter((t) => {
        const i = t.install as { none?: boolean } | undefined;
        const v = t.invoke as { manual?: boolean } | undefined;
        return i?.none === true && v?.manual === true;
      })
      .map((t) => t.id),
  );
}

/**
 * Findings across every tabular record under a library.
 *
 * **Never empty-by-accident**: a record that will not parse is `unreadable`
 * rather than skipped, and the caller asserts that something was read.
 */
export function stubFindings(
  entries: readonly string[],
  read: (dir: string) => string | undefined,
  toolIsStubbed: (id: string) => boolean,
): StubFinding[] {
  const out: StubFinding[] = [];
  for (const dir of entries) {
    const text = read(dir);
    if (text === undefined) continue; // no tabular record here at all
    const parsed = TabularCsvwSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      out.push({
        severity: "unreadable",
        entry: dir,
        detail: `tabular record will not validate: ${parsed.error.issues[0]?.message ?? "invalid"}`,
      });
      continue;
    }
    for (const t of parsed.data.tables) {
      const stub = t["fac:stub"];
      if (!stub) continue;
      if (t.tableSchema.columns.length > 0) {
        out.push({
          severity: "half-stub",
          entry: dir,
          detail: `${t.url}: carries \`fac:stub\` AND ${t.tableSchema.columns.length} column(s) — a thin extraction reads as a working one`,
        });
        continue;
      }
      out.push(
        toolIsStubbed(stub.tool)
          ? {
              severity: "stub",
              entry: dir,
              detail: `${t.url}: awaiting \`${stub.tool}\` — ${stub.reason} (since ${stub.since})`,
            }
          : {
              severity: "expired",
              entry: dir,
              detail: `${t.url}: \`${stub.tool}\` now has an implementation, so \`fac:stub\` must go (recorded ${stub.since})`,
            },
      );
    }
  }
  return out;
}

function run(): number {
  // EVERY declared library, not the one.
  //
  // This read `directoryForGraph(ROOT, "library")`, which was right while the
  // platform held the corpus and refuses — loudly, by name — now that it does
  // not. Bean `frs5` moved the four entries into the IRIS replica and the
  // formal-math layer, and `wwi6`'s inheritance guarantee kept a third,
  // empty declaration here, so `library` has three homes.
  //
  // THE REFUSAL IS THE DESIGN WORKING. `a02m` migrated every
  // `directoriesForGraph(…)[0]` and added a test that fails on a new one, but
  // this site spells the assumption with main's accessor instead, so that test
  // never saw it. What caught it was the accessor itself, in CI, naming all
  // three candidates — which is exactly the difference between an assumption
  // that is visible and one that is checked.
  //
  // A scanner, so it fans out: this is an EXPIRY check over ingested
  // documents, and scanning one of three libraries would report every stub in
  // the other two as expired-nowhere — a clean run over the documents that
  // actually carry them.
  // Declared-but-absent is REPORTED, not dropped (bean `95ir`).
  // In a layer's PR checks, only the caller's own libraries (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`).
  const { dirs: declared, scoped } = gateDirectoriesForGraph(ROOT, "library");
  if (scoped && declared.length === 0) {
    console.log(nothingOwnLine("check:tabular-stubs", "library directory", scoped));
    return 0;
  }
  const { present: libs, absent } = splitDeclared(declared);
  noteAbsent(absent, "a library");
  if (libs.length === 0) {
    console.error("Could not resolve a `library` directory. This is NOT a pass.");
    return 2;
  }
  // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
  const entries = libs.flatMap((lib) => libraryEntryDirs(lib).map((e) => e.dir));

  // Read from the tool declarations rather than a literal here.
  let stubbed: Set<string>;
  try {
    stubbed = stubbedTools(tools());
  } catch (e) {
    console.error(`Could not read the tool declarations: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass — the expiry check has no basis without them.");
    return 2;
  }

  const findings = stubFindings(
    entries,
    (dir) => {
      const f = join(dir, TABULAR_CSVW_FILENAME);
      return existsSync(f) ? readFileSync(f, "utf-8") : undefined;
    },
    (id) => stubbed.has(id),
  );

  for (const f of findings) console.log(`  ${f.severity.padEnd(11)} ${f.detail}`);

  const blocking = findings.filter((f) => f.severity !== "stub");
  const withRecords = entries.filter((d) => existsSync(join(d, TABULAR_CSVW_FILENAME))).length;
  console.log();
  console.log(
    `  ${entries.length} entry/entries scanned, ${withRecords} with a tabular record, ` +
      `${findings.filter((f) => f.severity === "stub").length} outstanding stub(s), ` +
      `${blocking.length} blocking`,
  );

  // A corpus with NO tabular record at all is not a clean sweep — it is a
  // sweep with nothing to sweep, and saying "every stub is honest" over it
  // would be the vacuity this check exists to prevent, one level up. Said out
  // loud and exited 0, because the absence is expected today: no tabular
  // source has been ingested yet (bean `p67i`).
  if (withRecords === 0) {
    console.log("  · no entry carries a tabular record — nothing was checked, which is");
    console.log("    NOT the same as nothing being wrong. No tabular source is ingested yet.");
    return 0;
  }
  if (findings.some((f) => f.severity === "unreadable")) return 2;
  if (blocking.length) {
    console.error("\n✗ A stub has expired or is half-done. Remove `fac:stub` when the tool lands.");
    return 1;
  }
  // Outstanding stubs are REPORTED, never silent, and do not fail: they are
  // the honest state of an unbuilt tool. What fails is a stub that has stopped
  // being true.
  console.log("  ✓ every stub is outstanding and honestly recorded");
  return 0;
}

if (import.meta.main) process.exit(run());
