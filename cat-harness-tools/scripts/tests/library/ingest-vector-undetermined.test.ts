/**
 * A vector arm's "undetermined" is an answer; a helper that cannot run is not
 * — bean `turh`. Before this, every scanned document stopped at the labels arm
 * (it cannot read captions off a scan, says so in its sidecar, and exits 2),
 * so no scan could be re-ingested.
 *
 * @module scripts/tests/ingest-vector-undetermined.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordedUndetermined } from "../../ingest-document.ts";

describe("recordedUndetermined", () => {
  test("exit 2 with a sidecar written by THIS step is a recorded answer", () => {
    const root = mkdtempSync(join(tmpdir(), "vec-"));
    try {
      const started = Date.now();
      mkdirSync(join(root, "doc"));
      writeFileSync(join(root, "doc", "vector-labels.json"), "{}");
      const step = ["python3", "/x/pdf-vector-labels.py", "-o", root, "a.pdf"];
      expect(recordedUndetermined(step, 2, started)).toBe(join(root, "doc", "vector-labels.json"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("exit 2 with no fresh sidecar — a helper that never ran — still stops", () => {
    const root = mkdtempSync(join(tmpdir(), "vec-"));
    try {
      mkdirSync(join(root, "doc"));
      const f = join(root, "doc", "vector-labels.json");
      writeFileSync(f, "{}");
      const old = new Date(Date.now() - 3_600_000);
      utimesSync(f, old, old); // a sidecar from an earlier run is not this step's answer
      const step = ["python3", "/x/pdf-vector-labels.py", "-o", root, "a.pdf"];
      expect(recordedUndetermined(step, 2, Date.now())).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("another exit code, or another step, is never excused", () => {
    const root = mkdtempSync(join(tmpdir(), "vec-"));
    try {
      const started = Date.now();
      mkdirSync(join(root, "doc"));
      writeFileSync(join(root, "doc", "vector-labels.json"), "{}");
      expect(recordedUndetermined(["python3", "/x/pdf-vector-labels.py", "-o", root], 1, started)).toBeUndefined();
      expect(recordedUndetermined(["python3", "/x/pdf-images.py", "-o", root], 2, started)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
