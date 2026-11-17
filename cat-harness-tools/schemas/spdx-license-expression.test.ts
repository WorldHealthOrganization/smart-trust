/**
 * Licence-id validation against the pinned SPDX License List — bean `sd5v`.
 *
 * Every case below is a rule of SPDX 3.0 Annex B as held in
 * `library/omg-2024-spdx-3-0` (`sec-327`…`sec-332`), or a value already in the
 * corpus that must stay valid.
 */
import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { judgeSourceLicence, type LicenceReport } from "../scripts/check-source-licence.ts";
import { snapshotOf } from "../scripts/pin-spdx-license-list.ts";
import { checkLicenceExpression, loadSpdxLicenseList, spdxLicenseListOf } from "./library/spdx-license-expression.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const LIST = spdxLicenseListOf("9.9.9", [
  { system: "spdx-license", code: "MIT" },
  { system: "spdx-license", code: "Apache-2.0" },
  { system: "spdx-license", code: "CC-BY-3.0" },
  { system: "spdx-license", code: "GPL-2.0", deprecated: true },
  { system: "spdx-license", code: "GPL-2.0-or-later" },
  { system: "spdx-exception", code: "Classpath-exception-2.0" },
]);

const ok = (e: string) => expect(checkLicenceExpression(e, LIST).problem).toBeUndefined();
const bad = (e: string, why: RegExp) => expect(checkLicenceExpression(e, LIST).problem ?? "").toMatch(why);

describe("valid expressions", () => {
  it("a listed id, a LicenseRef, and a DocumentRef-qualified LicenseRef", () => {
    ok("MIT");
    ok("LicenseRef-W3C-Document-License");
    ok("DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2");
  });
  it("AND, OR, WITH, `+`, parentheses — and lower-case operators", () => {
    ok("MIT AND Apache-2.0");
    ok("(MIT OR Apache-2.0) AND CC-BY-3.0");
    ok("GPL-2.0-or-later WITH Classpath-exception-2.0");
    ok("GPL-2.0-or-later WITH AdditionRef-my-exception");
    ok("GPL-2.0+");
    ok("mit and apache-2.0");
    ok("MIT AND(Apache-2.0 OR CC-BY-3.0)");
  });
  it("matches ids case-insensitively and reports the canonical spelling", () => {
    expect(checkLicenceExpression("apache-2.0", LIST)).toEqual({ deprecated: [], recased: [["apache-2.0", "Apache-2.0"]] });
  });
  it("reports a deprecated id without refusing it", () => {
    expect(checkLicenceExpression("GPL-2.0 OR MIT", LIST)).toEqual({ deprecated: ["GPL-2.0"], recased: [] });
  });
});

describe("invalid expressions", () => {
  it("an id that is not on the list — the typo this exists to catch", () => bad("CC-BY-3.O", /not a licence id/));
  it("an exception used as a licence, and a licence used as an exception", () => {
    bad("Classpath-exception-2.0", /not a licence id/);
    bad("MIT WITH Apache-2.0", /not an exception id/);
  });
  it("mixed-case operators (sec-328)", () => bad("MIT And Apache-2.0", /all upper or all lower/));
  it("two licences with no operator", () => bad("MIT Apache-2.0", /joined by AND, OR or WITH/));
  it("unbalanced parentheses", () => {
    bad("(MIT OR Apache-2.0", /not closed/);
    bad("MIT)", /no opening/);
  });
  it("WITH on a parenthesised expression (the grammar binds it to a simple-expression)", () =>
    bad("(MIT) WITH Classpath-exception-2.0", /single licence/));
  it("a malformed LicenseRef, a dangling operator, and the empty string", () => {
    bad("LicenseRef-", /well-formed/);
    bad("MIT AND", /ends where a licence was expected/);
    bad("WITH Classpath-exception-2.0", /where a licence was expected/);
    bad("  ", /empty/);
  });
});

describe("the pinned edition", () => {
  it("the committed snapshot loads and agrees with its pin", () => {
    const list = loadSpdxLicenseList(REPO_ROOT);
    expect(typeof list).not.toBe("string");
    if (typeof list === "string") return;
    expect(list.licenses.size).toBeGreaterThan(500);
    // Every id the corpus states today stays valid at this edition.
    for (const id of ["Apache-2.0 AND MIT", "CC-BY-NC-SA-3.0-IGO", "CC-BY-3.0-IGO", "W3C-20150513", "EUPL-1.2", "CC0-1.0", "Community-Spec-1.0 AND CC-BY-3.0", "CC-BY-SA-3.0"])
      expect(checkLicenceExpression(id, list).problem).toBeUndefined();
  });
  it("the pin script refuses data from another edition", () => {
    const l = { licenseListVersion: "3.28.0", licenses: [{ licenseId: "MIT", name: "MIT License" }] };
    const e = { licenseListVersion: "3.28.0", exceptions: [] };
    expect(() => snapshotOf("3.29.0", l, e)).toThrow(/pin is 3.29.0/);
    expect(snapshotOf("3.28.0", l, e).concepts).toEqual([{ system: "spdx-license", code: "MIT", display: "MIT License" }]);
  });
  it("an unloadable list is could-not-determine, never a pass", () => {
    const r: LicenceReport = { entries: 3, stated: [], unknown: [], notRecorded: [], malformed: [], deprecatedIds: [], recased: [], listProblem: "missing" };
    expect(judgeSourceLicence(r)).toBe("unknown");
  });
});
