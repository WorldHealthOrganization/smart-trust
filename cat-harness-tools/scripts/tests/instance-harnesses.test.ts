/**
 * A layer's OWN site lists the layer and what it is built on — never
 * the platform's other harnesses (bean `mftp`, owner 2026-10-05: "harnesses
 * in bottom LHS navbar link back to folio-assist, not smart-immz").
 */
import { describe, expect, test } from "bun:test";
import { dirname, join, resolve } from "node:path";
import { readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { instanceHarnesses } from "../mount-instance-docs.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone } from "../../test/support/checkout.js";

const REPO = resolve(dirname(HARNESS_ROOT));

/** The subject is smart-immunizations' own site and the smart-base layer it stands on; only a composed checkout holds them. */
const NO_SMART_INSTANCES = notApplicableAlone(
  "smart-immunizations and the smart-base layer it is built on, whose declarations these rows are drawn from",
);

describe.skipIf(NO_SMART_INSTANCES)("instanceHarnesses", () => {
  const rows = instanceHarnesses("cat-harness", "smart-immunizations", "https://example.org/fa", ".")!;
  test("the instance comes first and links to its own site's root", () => {
    // Labelled as every row is (label, else title, else name): the restored
    // declaration (2026-10-15) carries a title, so that is its label.
    const decl = readDeclaration(join(REPO, "smart-immunizations"));
    expect(rows[0]!.label).toBe(decl?.title ?? "smart-immunizations");
    expect(rows[0]!.href).toBe(".");
  });
  test("it lists the harnesses the instance is built on, re-based on the platform", () => {
    const smartBase = rows.find((r) => r.label === "SMART Base");
    expect(smartBase?.href).toBe("https://example.org/fa/smart-base/");
  });
  test("it lists nothing the instance is not built on", () => {
    // WHO IRIS is not on this list: smart-base `needs` who-iris, so it is a
    // layer smart-immunizations is built on, and the next test expects it.
    const labels = rows.map((r) => r.label);
    for (const other of ["smart-trust", "WHO SMART Trust", "Folio Assistant", "folio-assistant-sci"]) expect(labels).not.toContain(other);
  });
  test("it lists a layer reached only through another layer's `needs`", () => {
    expect(rows.map((r) => r.label)).toContain("WHO IRIS");
  });
});
