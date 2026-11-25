/**
 * The render log — append-only, path-safe, and reason-bearing.
 *
 * @module scripts/tests/render-log.test
 *
 * Three groups, and the middle one is the point. The first is the schema's
 * own contract. The second pins the two properties the design turns on:
 * a removal never erases what preceded it, and a path is checked by VALUE
 * rather than trusted because of where it came from. The third is the reader,
 * whose skipped-line report is what stops a short count passing for complete.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  RENDER_LOG_SCHEMA_ID,
  isSafeRenderPath,
  readRenderLog,
  readRenderLogEntry,
  renderLogPath,
  serializeRenderLogEntry,
} from "../../../schemas/ui/render-log.ts";
import { appendEntry, buildEntry } from "../../render-log.ts";

const AT = "2026-09-20T07:30:00.000Z";
const base = {
  kind: "staging-preview",
  path: "STAGING/claude-x",
  slug: "claude-x",
  at: AT,
  id: "e1",
};
const dir = () => mkdtempSync(join(tmpdir(), "render-log-"));

describe("buildEntry", () => {
  test("a rendered entry needs no reason", () => {
    const e = buildEntry({ ...base, event: "rendered", summary: "published" });
    expect(e.event).toBe("rendered");
    expect(e.$schema).toBe(RENDER_LOG_SCHEMA_ID);
  });

  test("a removal REFUSES without a reason", () => {
    expect(() => buildEntry({ ...base, event: "removed", summary: "gone" })).toThrow(/--reason is required/);
  });

  test("a retained entry refuses too — why it is still here is the whole content", () => {
    expect(() => buildEntry({ ...base, event: "retained", summary: "kept" })).toThrow(/--reason is required/);
  });

  test("capture is `on`: the log IS the capture, unlike the activity log", () => {
    expect(buildEntry({ ...base, event: "rendered", summary: "s" }).capture).toBe("on");
  });
});

describe("a path is checked by VALUE, not trusted by provenance", () => {
  // Bean `fuzm`: the slug sanitiser can emit `..`, and is safe only because
  // git rejects refs containing it. `cleanup-dispatch` takes a slug as a
  // DISPATCH INPUT, where that invariant does not hold.

  test("the escape the sanitiser can actually emit is refused", () => {
    expect(isSafeRenderPath("STAGING/..")).toBe(false);
    expect(() => buildEntry({ ...base, path: "STAGING/..", event: "rendered", summary: "s" })).toThrow(
      /not a safe path/,
    );
  });

  // input-site: inert #03ba8569 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
  test.each([["/etc/passwd"], ["a\\b"], ["a//b"], [".."], ["./x"], ["a/./b"]])(
    "refuses %s",
    (p) => {
      expect(isSafeRenderPath(p)).toBe(false);
    },
  );

  test.each([["STAGING/claude-x"], ["/"], ["a/b/c"], ["a.b-c_d"]])("accepts %s", (p) => {
    expect(isSafeRenderPath(p)).toBe(true);
  });
});

describe("APPEND-ONLY — a removal never erases what came before", () => {
  test("rendered then removed leaves BOTH entries", () => {
    const d = dir();
    appendEntry(d, buildEntry({ ...base, event: "rendered", summary: "published" }));
    appendEntry(d, buildEntry({ ...base, id: "e2", event: "removed", summary: "taken down", reason: "PR closed" }));

    const { entries } = readRenderLog(readFileSync(join(d, renderLogPath(AT)), "utf8"));
    expect(entries.map((e) => e.event)).toEqual(["rendered", "removed"]);
  });

  test("the pair IS the history — the rendered entry still says what it was for", () => {
    const d = dir();
    appendEntry(d, buildEntry({ ...base, event: "rendered", summary: "published", branch: "claude/x", commit: "abc" }));
    appendEntry(d, buildEntry({ ...base, id: "e2", event: "removed", summary: "gone", reason: "PR #1 closed" }));

    const { entries } = readRenderLog(readFileSync(join(d, renderLogPath(AT)), "utf8"));
    expect(entries[0].branch).toBe("claude/x");
    expect(entries[1].reason).toBe("PR #1 closed");
  });

  test("re-rendering the same path appends rather than replacing", () => {
    const d = dir();
    for (const id of ["a", "b", "c"]) {
      appendEntry(d, buildEntry({ ...base, id, event: "rendered", summary: `build ${id}` }));
    }
    const { entries } = readRenderLog(readFileSync(join(d, renderLogPath(AT)), "utf8"));
    expect(entries).toHaveLength(3);
  });

  test("one file per UTC day, so concurrent writers append rather than rewrite", () => {
    expect(renderLogPath("2026-09-20T23:59:59.000Z")).toBe("_render-log/2026-09-20.jsonl");
    expect(renderLogPath("2026-09-21T00:00:00.000Z")).toBe("_render-log/2026-09-21.jsonl");
  });

  test("the store is OUTSIDE STAGING/, so `rm -rf STAGING/$SLUG` cannot reach it", () => {
    // Structural rather than guarded: a branch named to collide with a
    // directory under branches/ slugifies to exactly that name, and git
    // permits the ref. A store outside branches/ is unreachable whatever the
    // slug says.
    expect(renderLogPath(AT).startsWith("STAGING/")).toBe(false);
  });
});

describe("readRenderLogEntry", () => {
  test("another schema is refused, naming what it declares", () => {
    const r = readRenderLogEntry({ $schema: "folio-log/v1", id: "x" });
    if (r.entry !== undefined) throw new Error("expected a refusal");
    expect(r.reason).toContain("folio-log/v1");
  });

  test("a reasonless removal is a DEFECT, not a clean skip", () => {
    const r = readRenderLogEntry({
      $schema: RENDER_LOG_SCHEMA_ID,
      id: "x",
      at: AT,
      event: "removed",
      subject: { kind: "staging-preview", path: "STAGING/x" },
      summary: "gone",
      capture: "on",
    });
    if (r.entry !== undefined) throw new Error("expected a refusal");
    expect(r.reason).toContain("no reason");
  });

  test("an unsafe path is refused even if the schema is satisfied", () => {
    const r = readRenderLogEntry({
      $schema: RENDER_LOG_SCHEMA_ID,
      id: "x",
      at: AT,
      event: "rendered",
      subject: { kind: "staging-preview", path: "STAGING/.." },
      summary: "s",
      capture: "on",
    });
    if (r.entry !== undefined) throw new Error("expected a refusal");
    expect(r.reason).toContain("not a safe path");
  });
});

describe("readRenderLog — a short count must be visible as short", () => {
  test("a malformed line does not stop the read, and IS reported", () => {
    const good = serializeRenderLogEntry(buildEntry({ ...base, event: "rendered", summary: "ok" }));
    const { entries, skipped } = readRenderLog(`${good}not json\n${good}`);
    expect(entries).toHaveLength(2);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].line).toBe(2);
  });

  test("blank lines are not entries and are not defects", () => {
    const good = serializeRenderLogEntry(buildEntry({ ...base, event: "rendered", summary: "ok" }));
    const { entries, skipped } = readRenderLog(`\n${good}\n\n`);
    expect(entries).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  test("an entry of another schema on one line is reported, not silently dropped", () => {
    const good = serializeRenderLogEntry(buildEntry({ ...base, event: "rendered", summary: "ok" }));
    const { entries, skipped } = readRenderLog(`${good}{"$schema":"folio-log/v1"}\n`);
    expect(entries).toHaveLength(1);
    expect(skipped[0].reason).toContain("folio-log/v1");
  });
});
