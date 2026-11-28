#!/usr/bin/env bun
/**
 * Snapshot the SPDX License List's identifiers at the pinned version. The
 * platform uses the License List only as a VALUE VOCABULARY — the ids a
 * `licence.json` may name.
 *
 * The pin is `cat-harness/external-schemas/spdx-license-list.json`; the
 * snapshot is `spdx-license-list.terminology.json` beside it, in the existing
 * `folio-pinned-terminology/v1` shape (one concept per id, `system`
 * `spdx-license` or `spdx-exception`), as `who-smart-base` does for its IG.
 *
 * ## It reads a local copy and never fetches
 *
 * `--from <dir>` is a checkout or download of github.com/spdx/license-list-data
 * at tag `v<version>`, holding `json/licenses.json` and `json/exceptions.json`.
 * The snapshot is committed so the check runs offline.
 *
 * ## The version is the pin's, never this script's
 *
 * Refused unless BOTH files declare `licenseListVersion` equal to the pin's
 * `version`, so one edition's ids are never labelled with another's number.
 *
 * ## What is kept, and what is not
 *
 * The id, the name, and `isDeprecated…Id`. Not the licence texts, URLs or OSI
 * and FSF flags: validation needs only whether an id exists and whether it is
 * deprecated, and the list's own data repository states no licence for
 * itself, so the snapshot holds the identifiers and no more.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/pin-spdx-license-list.ts --from <license-list-data checkout>
 *
 * @module scripts/pin-spdx-license-list
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { PinnedTerminologySchema, PINNED_TERMINOLOGY_TAG, type PinnedConcept } from "../schemas/content/pinned-terminology.ts";
import { SPDX_LICENSE_LIST_PIN, SPDX_LICENSE_LIST_SNAPSHOT } from "../schemas/library/spdx-license-expression.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(dirname(HARNESS_ROOT));
const SOURCE = "https://github.com/spdx/license-list-data";

type Listed = { name: string; isDeprecatedLicenseId?: boolean };
type LicensesFile = { licenseListVersion: string; licenses: (Listed & { licenseId: string })[] };
type ExceptionsFile = { licenseListVersion: string; exceptions: (Listed & { licenseExceptionId: string })[] };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Build the snapshot body from the two list files. Pure, so a test can drive it. */
export function snapshotOf(pinVersion: string, licenses: LicensesFile, exceptions: ExceptionsFile) {
  for (const [what, v] of [["licenses.json", licenses.licenseListVersion], ["exceptions.json", exceptions.licenseListVersion]] as const) {
    if (v !== pinVersion) throw new Error(`${what} is License List ${v}, but the pin is ${pinVersion}: move the pin, or fetch tag v${pinVersion}`);
  }
  const concept = (system: string, code: string, l: Listed): PinnedConcept => ({
    system,
    code,
    display: l.name,
    ...(l.isDeprecatedLicenseId ? { deprecated: true } : {}),
  });
  const concepts = [
    ...licenses.licenses.map((l) => concept("spdx-license", l.licenseId, l)),
    ...exceptions.exceptions.map((e) => concept("spdx-exception", e.licenseExceptionId, e)),
  ].sort((a, b) => (a.system === b.system ? (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) : a.system < b.system ? -1 : 1));
  return PinnedTerminologySchema.parse({
    $schema: PINNED_TERMINOLOGY_TAG,
    _comment:
      "DERIVED from the version pinned in cat-harness/external-schemas/spdx-license-list.json. Never hand-edit: move the pin, fetch github.com/spdx/license-list-data at tag v<version>, and re-run cat-harness/scripts/pin-spdx-license-list.ts. Identifiers, names and the deprecated flag only — what check:source-licence needs to validate a licence expression offline (bean sd5v).",
    pin: SPDX_LICENSE_LIST_PIN,
    version: pinVersion,
    source: SOURCE,
    concepts,
  });
}

function main(): number {
  const from = arg("--from");
  if (!from) {
    console.error("usage: bun run cat-harness-tools/scripts/pin-spdx-license-list.ts --from <license-list-data checkout at the pinned tag>");
    return 2;
  }
  const pin = JSON.parse(readFileSync(join(ROOT, SPDX_LICENSE_LIST_PIN), "utf-8")) as { version: string };
  const licenses = JSON.parse(readFileSync(join(from, "json/licenses.json"), "utf-8")) as LicensesFile;
  const exceptions = JSON.parse(readFileSync(join(from, "json/exceptions.json"), "utf-8")) as ExceptionsFile;
  let body;
  try {
    body = snapshotOf(pin.version, licenses, exceptions);
  } catch (e) {
    console.error(`REFUSED: ${(e as Error).message}`);
    return 1;
  }
  writeFileSync(join(ROOT, SPDX_LICENSE_LIST_SNAPSHOT), JSON.stringify(body, null, 2) + "\n");
  const n = (s: string) => body.concepts.filter((c) => c.system === s).length;
  console.log(`✓ ${SPDX_LICENSE_LIST_SNAPSHOT}: License List ${pin.version}, ${n("spdx-license")} licences, ${n("spdx-exception")} exceptions`);
  return 0;
}

if (import.meta.main) process.exit(main());
