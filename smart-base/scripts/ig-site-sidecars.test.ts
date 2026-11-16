import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DAK_API_LABEL, descriptorFor, HUB_MARKER, IG_API_DESCRIPTOR, IG_API_SITE, IG_API_WORK, igSiteSidecars } from "./ig-site-sidecars";

describe("ig-site:sidecars, smart-base's step in an IG repository's site", () => {
  test("dakLabelsSidecarsDakApi", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-dak-"));
    writeFileSync(join(ig, "index.config.json"), JSON.stringify({ contentTypes: { dak: {} } }));
    expect(descriptorFor(ig)).toEqual({ label: DAK_API_LABEL, placeholder: HUB_MARKER });
  });

  test("legacyDakJsonStillLabelled", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-dak-"));
    writeFileSync(join(ig, "dak.json"), "{}");
    expect(descriptorFor(ig)).toEqual({ label: DAK_API_LABEL, placeholder: HUB_MARKER });
  });

  test("noDakGetsNoLabel", () => {
    expect(descriptorFor(mkdtempSync(join(tmpdir(), "ig-plain-")))).toEqual({ placeholder: HUB_MARKER });
  });

  test("noAstRefusedNamingRestoreStep", () => {
    const ig = mkdtempSync(join(tmpdir(), "ig-noast-"));
    expect(() => igSiteSidecars({ ig, work: mkdtempSync(join(tmpdir(), "work-")), log: () => {} })).toThrow(/no AST[\s\S]*ig-site:ast/);
  });

  // fhir-harness beside this layer, as a checkout mounts them; skipped (and said) where it is not mounted.
  const fhirHarness = join(import.meta.dir, "..", "..", "fhir-harness", "scripts", "ig-repo-site.ts");
  test.skipIf(!existsSync(fhirHarness))("handshakeNamesMatchFhirHarness", () => {
    // Read, not imported: the test pins the two copies of the handshake's names
    // together without running fhir-harness's code.
    const src = readFileSync(fhirHarness, "utf-8");
    expect(src).toContain(`IG_API_WORK = "${IG_API_WORK}"`);
    expect(src).toContain(`IG_API_DESCRIPTOR = "${IG_API_DESCRIPTOR}"`);
    expect(src).toContain(`IG_API_SITE = "${IG_API_SITE}"`);
  });

});

describe("the hub is fhir-harness's (bean h7ap)", () => {
  test("descriptorNamesHubMarker", () => {
    expect(descriptorFor(mkdtempSync(join(tmpdir(), "ig-")))).toEqual({ placeholder: HUB_MARKER });
  });
});
