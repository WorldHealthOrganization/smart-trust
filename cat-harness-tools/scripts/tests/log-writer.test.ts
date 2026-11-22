/**
 * The activity-log producer, and the rich reference schema the owner asked
 * for on 2026-09-19: *"log should be rich schema including references to
 * discussion/chats, cmn execution logs, etc."*
 *
 * Bean `folio-assistant-7uff`.
 *
 * Which shipped processes declare capture is pinned beside the diagrams, in
 * folio-assistant-core's and folio-assistant-sci's
 * `scripts/tests/log-writer.test.ts` (bean `ho66`).
 *
 * @module scripts/tests/log-writer.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LOG_REF_KINDS,
  LogEntrySchema,
  LogExecutionSchema,
  LogReferenceSchema,
  logDirs,
} from "../../schemas/sdlc/log-entry.ts";
import { describeCapture, writeLogEntry } from "../../src/logging/log-writer.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/** A layer whose declaration names a trashcan, so there is somewhere to log. */
function instance(declareFshGuts = true): string {
  const root = mkdtempSync(join(tmpdir(), "log-writer-"));
  const directories = declareFshGuts
    ? [{ id: "fsh-guts", path: "fsh-guts/", description: "trashcan", graphTypologies: ["fsh-guts"] }]
    : [{ id: "schemas", path: "schemas/", description: "schemas", graphTypologies: ["schemas"] }];
  for (const d of directories) mkdirSync(join(root, d.path), { recursive: true });
  writeDeclaration(root, JSON.stringify({ name: "t", stub: "t", directories }, null, 2));
  return root;
}

function entries(root: string): Record<string, unknown>[] {
  return logDirs(root).flatMap((d) =>
    existsSync(d)
      ? readdirSync(d)
          .filter((f) => f.endsWith(".json"))
          .map((f) => JSON.parse(readFileSync(join(d, f), "utf-8")) as Record<string, unknown>)
      : [],
  );
}

describe("the log directory is composed from the declaration, not spelled", () => {
  test("it follows the declared fsh-guts path wherever that is", () => {
    const root = instance();
    // `root` is the FIXTURE's own repository root — `logDirs` resolves
    // `fsh-guts/logs` inside it, not in the fixture's parent (`/tmp`).
    expect(logDirs(root)).toEqual([join(root, "fsh-guts", "logs")]);
  });

  test("an instance that declares no trashcan has nowhere to log", () => {
    // A determined empty, not a guess at the conventional path. Writing to
    // `fsh-guts/logs` regardless would create a second trashcan beside the
    // one the layer actually declared — the `dh4f` defect one level down.
    expect(logDirs(instance(false))).toEqual([]);
  });

  test("and that is reported, not swallowed", () => {
    const r = writeLogEntry(instance(false), { event: "message", summary: "hi" }, "on");
    expect(r.written).toBe(false);
    expect(r.reason).toContain("no fsh-guts directory");
    expect(describeCapture(r)).toContain("nothing written");
  });
});

describe("writing an entry", () => {
  test("a task-start lands on disk and validates", () => {
    const root = instance();
    const r = writeLogEntry(root, { event: "task-start", summary: "claimed 7uff" }, "on");
    expect(r.written).toBe(true);
    const found = entries(root);
    expect(found).toHaveLength(1);
    expect(() => LogEntrySchema.parse(found[0])).not.toThrow();
    expect(found[0].event).toBe("task-start");
  });

  test("the filename sorts chronologically without opening anything", () => {
    const root = instance();
    const early = new Date("2026-09-19T01:00:00.000Z");
    const late = new Date("2026-09-19T23:00:00.000Z");
    writeLogEntry(root, { event: "message", summary: "late" }, "on", late);
    writeLogEntry(root, { event: "message", summary: "early" }, "on", early);
    const names = readdirSync(logDirs(root)[0]).sort();
    expect(names[0]).toStartWith("2026-09-19T01");
    expect(names[1]).toStartWith("2026-09-19T23");
  });

  test("two entries in the same millisecond do not collide", () => {
    // Ordinary for an agent logging a task's start and its first message
    // together. A timestamp-only id would silently overwrite one of them.
    const root = instance();
    const at = new Date("2026-09-19T12:00:00.000Z");
    writeLogEntry(root, { event: "task-start", summary: "a" }, "on", at);
    writeLogEntry(root, { event: "message", summary: "b" }, "on", at);
    expect(entries(root)).toHaveLength(2);
  });

  test("a malformed draft is reported, never thrown", () => {
    // A log is instrumentation: an agent whose task dies because logging the
    // task died has been made worse off by the thing meant to help it.
    const root = instance();
    const r = writeLogEntry(root, { event: "message", summary: "" }, "on");
    expect(r.written).toBe(false);
    expect(r.reason).toContain("folio-log/v1");
    expect(entries(root)).toHaveLength(0);
  });
});

describe("capture is resolved and REPORTED on every write", () => {
  test.each([
    ["on", "on", true],
    ["off", "off", false],
    [undefined, "unknown", false],
    ["maybe", "unknown", false],
  ] as const)("declared %p → capture %p, eligible %p", (declared, capture, eligible) => {
    const r = writeLogEntry(instance(), { event: "message", summary: "x" }, declared);
    expect(r.capture).toBe(capture);
    expect(r.eligibleForStore).toBe(eligible);
  });

  test("an entry is written even when it will never reach the store", () => {
    // `off` means not committed, NOT not written. The agent can still read
    // back what it did this session, which is most of what a log is for.
    const root = instance();
    expect(writeLogEntry(root, { event: "message", summary: "x" }, "off").written).toBe(true);
    expect(entries(root)).toHaveLength(1);
  });

  test("the one-liner distinguishes all three states in words", () => {
    const root = instance();
    const said = (d: unknown) => describeCapture(writeLogEntry(root, { event: "message", summary: "x" }, d));
    expect(said("on")).toContain("kept in the data store");
    expect(said("off")).toContain("local only");
    expect(said(undefined)).toContain("undetermined");
    // The distinction the field exists for must survive into the prose: a
    // reader who cannot tell `off` from `unknown` has the ambiguity back.
    expect(said(undefined)).not.toBe(said("off"));
  });
});

describe("references — the rich half", () => {
  test("the known kinds cover what the owner named", () => {
    expect([...LOG_REF_KINDS]).toContain("discussion");
    expect([...LOG_REF_KINDS]).toContain("command");
  });

  test("a reference needs somewhere to point", () => {
    // A `kind` with no `ref` records that something of that sort was involved
    // and gives a reader no way to reach it.
    expect(() => LogReferenceSchema.parse({ kind: "issue" })).toThrow();
    expect(() => LogReferenceSchema.parse({ kind: "issue", ref: "#363" })).not.toThrow();
  });

  test("an entry carries several references of one kind", () => {
    // The reason this is a list and not `issue`/`pr`/`commitSha` fields: a
    // step answering three review threads has three comments to point at.
    const root = instance();
    const r = writeLogEntry(
      root,
      {
        event: "task-end",
        summary: "answered the review",
        references: [
          { kind: "comment", ref: "https://example.invalid/c/1" },
          { kind: "comment", ref: "https://example.invalid/c/2" },
          { kind: "discussion", ref: "session_01", title: "the chat this came from" },
        ],
      },
      "on",
    );
    expect(r.written).toBe(true);
    expect((entries(root)[0].references as unknown[]).length).toBe(3);
  });

  test("an UNKNOWN kind is accepted and flagged, not refused", () => {
    // Open by design — "etc." is the specification. But a silently open list
    // is how `issue`, `issues` and `gh-issue` end up in one store with
    // nothing able to query it, so an unknown kind is surfaced.
    const root = instance();
    const r = writeLogEntry(
      root,
      { event: "message", summary: "x", references: [{ kind: "case", ref: "CMMN-1" }] },
      "on",
    );
    expect(r.written).toBe(true);
    expect(r.unknownRefKinds).toEqual(["case"]);
    expect(describeCapture(r)).toContain("case");
  });

  test("a known kind raises no flag", () => {
    const r = writeLogEntry(
      instance(),
      { event: "message", summary: "x", references: [{ kind: "commit", ref: "deadbee" }] },
      "on",
    );
    expect(r.unknownRefKinds).toEqual([]);
    expect(describeCapture(r)).not.toContain("typo");
  });
});

describe("command execution", () => {
  test("exit code and duration are queryable fields, not prose", () => {
    const root = instance();
    writeLogEntry(
      root,
      {
        event: "task-end",
        summary: "ran the gates",
        execution: { command: "bun test", exitCode: 1, durationMs: 38_400, cwd: "." },
      },
      "on",
    );
    const e = entries(root)[0].execution as Record<string, unknown>;
    expect(e.exitCode).toBe(1);
    expect(e.durationMs).toBe(38_400);
  });

  test("a command that did not finish has NO exit code, which is not zero", () => {
    // `exitCode: 0` would assert it succeeded. Absent is the third state.
    const parsed = LogExecutionSchema.parse({ command: "sleep 100" });
    expect(parsed.exitCode).toBeUndefined();
  });

  test("there is no field to inline command output into", () => {
    // A safety property, not an omission: command output is the likeliest
    // place for a token to appear, and `capture: "on"` puts an entry in git
    // in a repository that may be public. `outputRef` points at where the
    // output went; an `output` field would invite the leak.
    const shape = LogExecutionSchema.parse({ command: "x", outputRef: "logs/out.txt" });
    expect(Object.keys(shape)).not.toContain("output");
    expect(
      LogExecutionSchema.parse({ command: "x", output: "secret=hunter2" } as never),
    ).not.toHaveProperty("output");
  });
});

/**
 * `<folio:log capture>` on a process, and the property the call-activity
 * route would have broken.
 */

