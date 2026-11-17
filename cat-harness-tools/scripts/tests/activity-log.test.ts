/**
 * The agent activity log: its schema, its off-by-default persistence, and
 * the guarantee that it never reaches a published graph.
 *
 * Bean `folio-assistant-7uff`.
 *
 * @module scripts/tests/activity-log.test
 *
 * The tests here that read the aggregate repository's own root (the
 * `.gitignore` and the root-declared `fsh-guts` trashcan) live in
 * `test/activity-log-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";

import {
  LOG_CAPTURE,
  LOG_DIR,
  LOG_ENTRY_SCHEMA_ID,
  LOG_EVENTS,
  LogEntrySchema,
  resolveCapture,
  shouldPersist,
} from "../../schemas/sdlc/log-entry.ts";
import { buildExport } from "../kg-export.js";

/**
 * The whole KG export, built ONCE at module scope.
 *
 * Bean `sff8`. This was `await buildExport()` inside the test body, and measured
 * 2026-09-27 it is **3638.8 ms of a 3.98 s file** — 73 % of bun's 5000 ms default
 * budget with the machine IDLE. So the test did not fail because contention
 * inflated something small; it was always nearly over budget, and any load at all
 * tipped it. It timed out at **5211 ms** in a loaded full-suite run.
 *
 * That is the same shape as `profile-scoping.test.ts` — the test's own work, not
 * contention — and the same remedy: module scope belongs to NO test's timeout, so
 * the cost is paid once and budgeted against nothing. `vxho` established the
 * pattern.
 *
 * Two things this deliberately does NOT do. It is not a raised timeout, which
 * `sff8` rules out because a bigger number decays as the corpus grows. And it does
 * not swallow a failure: a throw here fails the FILE rather than one test, which
 * is better signal than a timeout that says only "5000 ms elapsed" — the same
 * reasoning as `sweepOnce` throwing rather than calling `expect` at module scope.
 */
const EXPORTED = await buildExport();

function entry(over: Record<string, unknown> = {}) {
  return {
    $schema: LOG_ENTRY_SCHEMA_ID,
    id: "log-1",
    at: "2026-09-19T12:00:00.000Z",
    event: "task-start",
    summary: "claimed folio-assistant-7uff",
    capture: "off",
    ...over,
  };
}

describe("the log entry schema", () => {
  test("a minimal entry parses, and declares itself", () => {
    const parsed = LogEntrySchema.parse(entry());
    expect(parsed.$schema).toBe("folio-log/v1");
  });

  test("the four events the owner named are the four that exist", () => {
    expect([...LOG_EVENTS]).toEqual(["task-start", "task-end", "message", "error"]);
  });

  test("process, role and task are optional — an agent logs outside any process", () => {
    // Requiring them would force a fake lane onto every ad-hoc line, which
    // is the failure `activity-names-skill` exists to prevent.
    expect(() => LogEntrySchema.parse(entry())).not.toThrow();
    expect(() =>
      LogEntrySchema.parse(entry({ role: "log", process: "content-lifecycle", task: "T_Commit" })),
    ).not.toThrow();
  });

  test("an entry without `capture` is refused", () => {
    // The state must be recorded on every entry. An entry that does not say
    // whether it persists is the ambiguity this field exists to remove.
    const { capture: _omitted, ...withoutCapture } = entry();
    expect(() => LogEntrySchema.parse(withoutCapture)).toThrow();
  });

  test("an unknown event is refused", () => {
    expect(() => LogEntrySchema.parse(entry({ event: "pondered" }))).toThrow();
  });
});

describe("capture is off by default and `unknown` is a real answer", () => {
  test("the three states exist and are distinct", () => {
    expect([...LOG_CAPTURE]).toEqual(["off", "on", "unknown"]);
  });

  test.each([[true], ["on"]])("%p resolves to on", (v) => {
    expect(resolveCapture(v)).toBe("on");
  });

  test.each([[false], ["off"]])("%p resolves to off", (v) => {
    expect(resolveCapture(v)).toBe("off");
  });

  test.each([[undefined], [null], [""], ["maybe"], [0]])(
    "%p resolves to unknown, NOT off",
    (v) => {
      // The distinction the field exists for: `off` says somebody decided,
      // `unknown` says nobody could tell. Collapsing them makes a
      // misconfigured layer look like a deliberately quiet one.
      expect(resolveCapture(v)).toBe("unknown");
      expect(resolveCapture(v)).not.toBe("off");
    },
  );

  test("only an explicit `on` persists", () => {
    expect(shouldPersist("on")).toBe(true);
    expect(shouldPersist("off")).toBe(false);
    // Committing an audit trail nobody asked for is the worse of the two
    // failures, so an undetermined setting does not persist.
    expect(shouldPersist("unknown")).toBe(false);
  });
});

describe("logs never reach a published graph", () => {
  test("no node mentions the log directory", () => {
    // Asserted for logs SPECIFICALLY rather than trusting that the parent
    // fsh-guts strip reaches them. The parent rule is why this holds; this
    // test is why we know it does.
    const doc = EXPORTED;
    const nodes = (doc as unknown as { "@graph"?: unknown[] })["@graph"] ?? [];
    expect(nodes.length).toBeGreaterThan(100);
    expect(JSON.stringify(doc)).not.toContain(LOG_DIR);
  });
});
