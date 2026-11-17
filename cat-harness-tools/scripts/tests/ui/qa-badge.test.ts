/**
 * The per-block QA badge summarises a sidecar into one of FOUR states.
 *
 * Three are obvious. The fourth — `unswept` — is the one worth testing,
 * because it is the difference between an icon that informs and one that
 * reassures. A block with no sidecar has not been checked; a block whose every
 * criterion came back `n/a` was checked and nothing applied. Rendering either
 * as "clean" is the false pass this repository keeps paying for: a sweep
 * reporting a healthy corpus it never looked at is indistinguishable
 * downstream from one that found nothing wrong.
 *
 * Measured when this landed, across every generated page: **1 fail, 13 pass,
 * 99 unswept**. The 99 are blocks on pages the sweep has never run over, and
 * they now say so rather than silently carrying no icon at all.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readQaSummary } from "../../gen-docs-pages.ts";

function withSidecar(body: unknown, run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "qa-badge-"));
  try {
    writeFileSync(join(dir, "b.qa.json"), typeof body === "string" ? body : JSON.stringify(body));
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("readQaSummary — four states, and `unswept` is never `pass`", () => {
  test("a missing sidecar is undefined, so the caller says 'not swept'", () => {
    const dir = mkdtempSync(join(tmpdir(), "qa-badge-"));
    try {
      expect(readQaSummary(dir, "absent")).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a sidecar that will not parse is undefined, not a crash", () => {
    // One malformed file must not take down the docs build, and "could not
    // read this" is honestly the same answer to a reader as "nobody checked".
    withSidecar("{ not json", (d) => expect(readQaSummary(d, "b")).toBeUndefined());
  });

  test("one fail outranks any number of passes", () => {
    withSidecar(
      { criteria: { a: [{ result: "pass" }], b: [{ result: "pass" }], c: [{ result: "fail" }] } },
      (d) => {
        const s = readQaSummary(d, "b")!;
        expect(s.state).toBe("fail");
        expect(s.fail).toBe(1);
        expect(s.pass).toBe(2);
      },
    );
  });

  test("warn outranks pass, and loses to fail", () => {
    withSidecar({ criteria: { a: [{ result: "warn" }], b: [{ result: "pass" }] } }, (d) =>
      expect(readQaSummary(d, "b")!.state).toBe("warn"),
    );
    withSidecar({ criteria: { a: [{ result: "warn" }], b: [{ result: "fail" }] } }, (d) =>
      expect(readQaSummary(d, "b")!.state).toBe("fail"),
    );
  });

  test("ALL n/a is `unswept`, not `pass` — the whole point", () => {
    // A sidecar in which nothing applied has checked nothing about this block.
    // Reporting it as clean is the false pass.
    withSidecar({ criteria: { a: [{ result: "n/a" }], b: [{ result: "n/a" }] } }, (d) => {
      const s = readQaSummary(d, "b")!;
      expect(s.state).toBe("unswept");
      expect(s.na).toBe(2);
      expect(s.pass).toBe(0);
    });
  });

  test("only the FIRST entry per criterion counts", () => {
    // Later entries are superseded reviews. Counting them all double-reports a
    // verdict that was revised — and would show a fixed block as still failing.
    withSidecar(
      { criteria: { a: [{ result: "pass" }, { result: "fail" }] } },
      (d) => {
        const s = readQaSummary(d, "b")!;
        expect(s.state).toBe("pass");
        expect(s.fail).toBe(0);
      },
    );
  });

  test("an empty criteria map is `unswept`", () => {
    withSidecar({ criteria: {} }, (d) => expect(readQaSummary(d, "b")!.state).toBe("unswept"));
  });
});
