/**
 * `localPath` is an edge like any other, and it must resolve — bean `yl5w`.
 *
 * @module folio-assistant-core/scripts/local-path.test
 *
 * Both halves are asserted, and they must be able to disagree: the DECISION
 * against a planted directory, and the real corpus's own claims. A single
 * test over both would pass while one of them was wrong.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { checkLocalPath } from "./lib/local-path.ts";

/** The worked example: the one catalogue layer in this checkout, read as DATA (same as `source-liveness.test.ts`). */
const INSTANCE = resolve(import.meta.dir, "..", "..", "who-iris");

describe("checkLocalPath", () => {
  test("presentFileOk", () => {
    const d = mkdtempSync(join(tmpdir(), "lp-"));
    mkdirSync(join(d, "uploads"));
    writeFileSync(join(d, "uploads", "a.pdf"), "%PDF-1.4\n");
    expect(checkLocalPath(d, "uploads/a.pdf")).toEqual({ state: "ok", detail: "" });
  });

  test("absentPathMissing", () => {
    const d = mkdtempSync(join(tmpdir(), "lp-"));
    expect(checkLocalPath(d, "uploads/gone.pdf")).toEqual({ state: "missing", detail: "" });
  });

  test("directoryIsMissing", () => {
    const d = mkdtempSync(join(tmpdir(), "lp-"));
    mkdirSync(join(d, "uploads", "a.pdf"), { recursive: true });
    const v = checkLocalPath(d, "uploads/a.pdf");
    expect(v.state).toBe("missing");
    expect(v.detail).toContain("directory");
  });

  test("unreadableIsUnknown", () => {
    // The third state, planted rather than argued: a path under a directory
    // with no execute bit cannot be stat'd, and EACCES is not ENOENT. Running
    // as root defeats the permission, so the assertion is conditional on the
    // plant having worked — a test that silently passes because it could not
    // set up its own case is the failure this file exists to prevent.
    const d = mkdtempSync(join(tmpdir(), "lp-"));
    mkdirSync(join(d, "locked"));
    writeFileSync(join(d, "locked", "a.pdf"), "%PDF-1.4\n");
    chmodSync(join(d, "locked"), 0o000);
    const v = checkLocalPath(d, "locked/a.pdf");
    chmodSync(join(d, "locked"), 0o755);
    if (v.state === "ok") {
      // root, or a filesystem that ignores the mode. Say so rather than pass quietly.
      console.log("  n/a: the permission plant did not take (running as root?) — third state unexercised here");
      return;
    }
    expect(v.state).toBe("unknown");
    expect(v.detail.length).toBeGreaterThan(0);
  });

  test("resolvesAgainstInstance", () => {
    // `yl5w`'s three claims name bytes that DO exist one layer over. A
    // resolver that searched the repository would call them present and make
    // the schema's "layer-relative" contract unenforceable.
    const d = mkdtempSync(join(tmpdir(), "lp-"));
    mkdirSync(join(d, "sibling", "uploads"), { recursive: true });
    writeFileSync(join(d, "sibling", "uploads", "a.pdf"), "%PDF-1.4\n");
    mkdirSync(join(d, "instance"));
    expect(checkLocalPath(join(d, "instance"), "uploads/a.pdf").state).toBe("missing");
  });
});

describe("the who-iris catalogue's own localPath claims", () => {
  const nodes = readdirSync(join(INSTANCE, "catalogue", "nodes"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(INSTANCE, "catalogue", "nodes", f), "utf-8")));

  test("catalogueClaimsResolve", () => {
    const bad: string[] = [];
    for (const n of nodes) {
      for (const b of n.bitstreams ?? []) {
        const lp = b.materialization?.localPath;
        if (!lp) continue;
        const v = checkLocalPath(INSTANCE, lp);
        if (v.state !== "ok") bad.push(`${n.id} ${b.bundle} ${lp} — ${v.state}${v.detail ? `: ${v.detail}` : ""}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("materializedHasLocalPath", () => {
    // The schema already refuses the other direction; this is the corpus half,
    // so a node that slipped in unvalidated still fails here.
    for (const n of nodes) {
      for (const b of n.bitstreams ?? []) {
        if (b.materialization?.state === "materialized") {
          expect(typeof b.materialization.localPath).toBe("string");
        }
      }
    }
  });
});
