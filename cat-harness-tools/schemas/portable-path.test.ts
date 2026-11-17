/**
 * The rules a checkout relies on — a filename that is legal here and illegal
 * where somebody else clones is invisible to every other gate in this
 * repository, which is how seven of them shipped.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { scriptSidecarPath } from "../pipeline/qa-utils.ts";
import { detailFileName, detailRelPath } from "../scripts/agent-memory.ts";
import { stickyFile } from "../scripts/ensure-landing-sticky.ts";
import { ForeignSubjectError, kgQaSidecarPath } from "./sdlc/kg-qa.ts";
import { portableSegment, unportablePath, unportableSegment } from "./kg/portable-path.ts";

describe("unportableSegment", () => {
  test("accepts the ordinary names this repository is full of", () => {
    for (const ok of ["agent-workflow.kg-qa.json", "README.md", "check-ci-health.ts", "_external"]) {
      expect(unportableSegment(ok)).toBeUndefined();
    }
  });

  test("rejects every character Windows reserves in a component", () => {
    for (const bad of ["<", ">", ":", '"', "/", "\\", "|", "?", "*", "\u0001"]) {
      expect(unportableSegment(`req${bad}x`)).toBe("reserved-character");
    }
  });

  test("rejects a device name even with an extension", () => {
    // `CON.txt` is as reserved as `CON`, which is why the check is on the part
    // before the FIRST dot rather than on the whole segment.
    for (const bad of ["con", "CON.txt", "aux.kg-qa.json", "com1", "LPT9.md", "nul"]) {
      expect(unportableSegment(bad)).toBe("reserved-device-name");
    }
    // ...and does not over-reach onto names that merely start with one.
    for (const ok of ["console.ts", "auxiliary.md", "com10", "connection.json"]) {
      expect(unportableSegment(ok)).toBeUndefined();
    }
  });

  test("rejects a trailing dot or space, which Windows would silently strip", () => {
    expect(unportableSegment("notes.")).toBe("trailing-dot-or-space");
    expect(unportableSegment("notes ")).toBe("trailing-dot-or-space");
  });
});

describe("unportablePath", () => {
  test("reports the offending SEGMENT, not the whole path", () => {
    const bad = unportablePath("cat-harness/test/results/kg-qa/req:x.kg-qa.json");
    expect(bad).toEqual({ segment: "req:x.kg-qa.json", reason: "reserved-character" });
  });

  test("finds one in the middle of a path, not only in the basename", () => {
    expect(unportablePath("a/b:c/d.json")?.segment).toBe("b:c");
  });

  test("passes a clean path", () => {
    expect(unportablePath("cat-harness/schemas/kg/portable-path.ts")).toBeUndefined();
  });
});

describe("portableSegment", () => {
  test("encodes the colon that made this repository unclonable", () => {
    expect(portableSegment("req:agent-workflow")).toBe("req%3Aagent-workflow");
  });

  test("leaves an already-portable name exactly as it is", () => {
    // Round-tripping an ordinary id through the encoder must not churn 200-odd
    // sidecars into new paths; only the names that cannot be checked out move.
    expect(portableSegment("agent-workflow")).toBe("agent-workflow");
  });

  test("is injective, so two ids cannot compose one sidecar", () => {
    // The whole reason this encodes rather than substituting `:` for `-`:
    // collision-freedom is the guarantee the mirrored results tree exists for.
    const ids = ["req:agent-workflow", "req-agent-workflow", "req%3Aagent-workflow", "req%agent-workflow"];
    expect(new Set(ids.map(portableSegment)).size).toBe(ids.length);
  });

  test("whatever it returns is portable", () => {
    for (const raw of ["req:x", 'a"b', "a|b", "a*b", "trailing.", "trailing ", "100%", "a\u0007b"]) {
      expect(unportableSegment(portableSegment(raw))).toBeUndefined();
    }
  });

  test("does not pretend to rescue a device name", () => {
    // Encoding cannot help: there is nothing in `aux` to encode. The gate still
    // reports it, and the subject needs a different id.
    expect(portableSegment("aux")).toBe("aux");
    expect(unportableSegment(portableSegment("aux"))).toBe("reserved-device-name");
  });
});

describe("the id-to-filename composers, as a class", () => {
  // litlfred on PR #683: "seems to be only fixing one issue, not the pattern."
  // Correct — `kgQaSidecarPath` was one of several places that build a filename
  // from an id, and an id is not constrained to be a legal filename. These
  // pin the class rather than the one instance that bit.

  test("every composer encodes, so no id can compose an uncheckable name", () => {
    const hostile = "req:x";
    expect(scriptSidecarPath(hostile, "/repo")).toBe(
      join("/repo", "test/results/script-sidecars", "req%3Ax.script.json"),
    );
    expect(stickyFile(hostile)).toBe("req%3Ax.json");
    expect(detailFileName(hostile)).toBe("req%3Ax.md");
    expect(detailRelPath(hostile)).toBe(join("detail", "req%3Ax.md"));
    for (const p of [scriptSidecarPath(hostile, "/repo"), stickyFile(hostile), detailFileName(hostile)]) {
      expect(unportablePath(p)).toBeUndefined();
    }
  });

  test("and every one is identity on the ids actually in use, so nothing moves", () => {
    // The safety property for the whole change: encoding a slug returns the
    // slug, so no committed sidecar, sticky or detail file changes path. If
    // this fails, the change is a silent mass rename rather than a guard.
    expect(scriptSidecarPath("lean-mirror-drift", "/repo")).toBe(
      join("/repo", "test/results/script-sidecars", "lean-mirror-drift.script.json"),
    );
    expect(stickyFile("getting-started")).toBe("getting-started.json");
    expect(detailFileName("kg-audit-baseline")).toBe("kg-audit-baseline.md");
  });

  test("detailRelPath and detailFileName cannot drift, because one calls the other", () => {
    // Not cosmetic: `writeDetail` prunes `detail/` against a keep-set built
    // from these names, so two spellings would delete the file just written.
    for (const id of ["plain", "req:x", "a b", "100%"]) {
      expect(detailRelPath(id)).toBe(join("detail", detailFileName(id)));
    }
  });
});

describe("kgQaSidecarPath", () => {
  const root = "/repo";

  test("composes a checkout-safe path from an id that is not a legal filename", () => {
    const p = kgQaSidecarPath(root, join(root, "skills", "requirements"), "req:agent-workflow");
    expect(p).toBe(join(root, "test", "results", "kg-qa", "skills", "requirements", "req%3Aagent-workflow.kg-qa.json"));
    expect(unportablePath(p)).toBeUndefined();
  });

  test("still mirrors the subject's directory untouched", () => {
    // The stem is composed and so is encoded; the directories mirror a path
    // already on disk and must keep matching it.
    const p = kgQaSidecarPath(root, join(root, "skills", "folio-core"), "todo-manager");
    expect(p).toBe(join(root, "test", "results", "kg-qa", "skills", "folio-core", "todo-manager.kg-qa.json"));
  });

  test("an outside subject is REFUSED — its owner audits it (Q-A PR 4)", () => {
    // It used to be re-rooted under `_external/`, which wrote a second copy of
    // a verdict its owner already holds. No path is composed at all now, so no
    // unportable one can be either.
    expect(() => kgQaSidecarPath(root, "/bootstrap/processes", "req:x")).toThrow(ForeignSubjectError);
  });
});
