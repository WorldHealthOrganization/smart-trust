/**
 * The dependency-advisory gate, falsified — and the falsification that matters
 * is NOT "does it find advisories".
 *
 * This step is warn-only, so it exits 0 in every state. An exit code therefore
 * carries no information at all, and the ONLY thing standing between a
 * registry outage and a report that reads as clean is what the renderer
 * prints. That is what these tests pin.
 *
 * The workflow's own header records the precedent: the ruff step *"warned
 * about the missing paths and exited 0, so the step reported a clean baseline
 * it had never computed."* Same shape, one gate over.
 */

import { describe, expect, test } from "bun:test";

import { renderVerdict, sortAdvisories, verdictFromAuditJson } from "../check-dependency-advisories.ts";

const rendered = (json: string, scanned = 10) => renderVerdict(verdictFromAuditJson(json, scanned)).join("\n");

describe("the three states are kept apart", () => {
  test("`{}` is bun's clean shape, and IS an answer", () => {
    const v = verdictFromAuditJson("{}", 372);
    expect(v.state).toBe("clean");
    expect(v).toMatchObject({ scanned: 372 });
  });

  test("empty OUTPUT is not an answer — it is undetermined", () => {
    // The distinction the whole gate turns on: an empty OBJECT means the
    // audit ran and found nothing; empty TEXT means it did not speak.
    const v = verdictFromAuditJson("", 372);
    expect(v.state).toBe("undetermined");
  });

  test("unparseable output is undetermined, never clean", () => {
    expect(verdictFromAuditJson("<html>502 Bad Gateway</html>", 372).state).toBe("undetermined");
  });

  test("a JSON array or null is undetermined — shape is not enough", () => {
    expect(verdictFromAuditJson("[]", 1).state).toBe("undetermined");
    expect(verdictFromAuditJson("null", 1).state).toBe("undetermined");
  });

  test("packages reported but no readable advisory is undetermined", () => {
    // bun said something and we failed to understand it. Calling that clean
    // would be the `dh4f` shape: a clean run reported over what was never
    // examined.
    expect(verdictFromAuditJson('{"left-pad": []}', 1).state).toBe("undetermined");
  });

  test("every undetermined verdict carries a non-empty reason", () => {
    for (const bad of ["", "not json", "[]", "null", '{"x": []}']) {
      const v = verdictFromAuditJson(bad, 1);
      expect(v.state).toBe("undetermined");
      expect(v).toHaveProperty("reason");
      expect((v as { reason: string }).reason.length).toBeGreaterThan(0);
    }
  });
});

describe("undetermined is never RENDERED as clean — the property the exit code cannot carry", () => {
  const OUTAGE = ["", "<html>502</html>", "null"];

  test("no undetermined render contains a tick", () => {
    for (const bad of OUTAGE) expect(rendered(bad)).not.toContain("✓");
  });

  test("...and each says so in words a reader cannot mistake", () => {
    for (const bad of OUTAGE) {
      expect(rendered(bad)).toContain("UNDETERMINED");
      expect(rendered(bad)).toContain("This is not a clean run");
    }
  });

  test("...and raises a ::warning:: so it is visible without opening the log", () => {
    for (const bad of OUTAGE) expect(rendered(bad)).toContain("::warning::");
  });

  test("the clean render, by contrast, ticks and states WHAT was scanned", () => {
    const out = rendered("{}", 372);
    expect(out).toContain("✓");
    expect(out).toContain("372");
    // A count is the difference between "found nothing" and "looked at nothing".
    expect(out).not.toContain("UNDETERMINED");
  });
});

describe("advisories are reported in full", () => {
  const FOUND = JSON.stringify({
    "tar-fs": [{ severity: "high", title: "Path traversal", url: "https://example.invalid/a" }],
    "left-pad": [{ severity: "low", title: "Regex denial of service" }],
  });

  test("each advisory reaches the summary as a ::warning::", () => {
    const out = rendered(FOUND);
    expect(out).toContain("::warning::high — tar-fs: Path traversal");
    expect(out).toContain("::warning::low — left-pad: Regex denial of service");
  });

  test("worst-first, so the severe one is not buried", () => {
    const v = verdictFromAuditJson(FOUND, 1);
    expect(v.state).toBe("advisories");
    expect((v as { advisories: { package: string }[] }).advisories[0]!.package).toBe("tar-fs");
  });

  test("a missing severity is reported as unknown rather than dropped", () => {
    const v = verdictFromAuditJson('{"p": [{"title": "x"}]}', 1);
    expect((v as { advisories: { severity: string }[] }).advisories[0]!.severity).toBe("unknown");
  });

  test("an unknown severity sorts LAST, not first — it is not a silent critical", () => {
    const s = sortAdvisories([
      { package: "b", severity: "weird", title: "t" },
      { package: "a", severity: "critical", title: "t" },
    ]);
    expect(s.map((a) => a.package)).toEqual(["a", "b"]);
  });

  test("the advisory render says out loud that it is not blocking", () => {
    // Otherwise a reader sees warnings on a green PR and concludes the gate
    // is broken, which is how a warn-only step gets deleted.
    expect(rendered(FOUND)).toContain("not blocking");
  });
});
