/**
 * Emptying the activity log, and the guard that keeps the never-delete
 * exception narrow.
 *
 * Owner, 2026-09-19: *"Log is a mechanical role, it can be emptied by an
 * actor all at once or individually. can be periodically emptied."*
 *
 * Bean `folio-assistant-7uff`.
 *
 * @module scripts/tests/log-sweep.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logDirs } from "../../schemas/sdlc/log-entry.ts";
import { writeLogEntry } from "../../src/logging/log-writer.ts";
import { describeSweep, emptyLog, type LogSelector } from "../../src/logging/log-sweep.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

function instance(): string {
  const root = mkdtempSync(join(tmpdir(), "log-sweep-"));
  mkdirSync(join(repoRootFor(root), "fsh-guts"), { recursive: true });
  writeDeclaration(root, JSON.stringify({
      name: "t",
      stub: "t",
      directories: [{ id: "fsh-guts", path: "fsh-guts/", description: "trashcan", graphTypologies: ["fsh-guts"] }],
    }));
  return root;
}

/** The log directory, created if the writer has not made it yet. */
function dir(root: string): string {
  const d = logDirs(root)[0];
  mkdirSync(d, { recursive: true });
  return d;
}

function count(root: string): number {
  const d = dir(root);
  return existsSync(d) ? readdirSync(d).length : 0;
}

/** Write an entry and hand back its id. */
function log(root: string, over: { summary?: string; session?: string; at?: Date } = {}): string {
  const r = writeLogEntry(
    root,
    { event: "message", summary: over.summary ?? "x", session: over.session },
    "on",
    over.at,
  );
  expect(r.written).toBe(true);
  return r.entry!.id;
}

describe("the three operations the owner named", () => {
  test("one entry, individually", () => {
    const root = instance();
    const keep = log(root, { summary: "keep" });
    const drop = log(root, { summary: "drop" });
    const r = emptyLog(root, { id: drop });
    expect(r.removed).toHaveLength(1);
    expect(count(root)).toBe(1);
    // The right one survived — not merely "one of them".
    expect(readdirSync(dir(root))[0]).toContain(keep);
  });

  test("a whole run at once, by session", () => {
    // `session` is on the entry precisely so one run's entries can go
    // together; this is what that field is for.
    const root = instance();
    log(root, { session: "run-a" });
    log(root, { session: "run-a" });
    log(root, { session: "run-b" });
    const r = emptyLog(root, { session: "run-a" });
    expect(r.removed).toHaveLength(2);
    expect(count(root)).toBe(1);
  });

  test("periodically — everything older than a cutoff", () => {
    const root = instance();
    log(root, { at: new Date("2026-01-01T00:00:00.000Z") });
    log(root, { at: new Date("2026-06-01T00:00:00.000Z") });
    log(root, { at: new Date("2026-09-19T00:00:00.000Z") });
    const r = emptyLog(root, { before: new Date("2026-07-01T00:00:00.000Z") });
    expect(r.removed).toHaveLength(2);
    expect(count(root)).toBe(1);
  });

  test("all of it, and `all` has to be asked for by name", () => {
    // There is no default selector. An operation with no undo that empties
    // everything when the caller passed nothing is the wrong way round.
    const root = instance();
    log(root);
    log(root);
    expect(emptyLog(root, { all: true }).removed).toHaveLength(2);
    expect(count(root)).toBe(0);
  });
});

describe("the exception is for log ENTRIES, not for the directory", () => {
  test("a file that does not declare itself an entry is never removed", () => {
    // The whole design of the module. `fsh-guts`'s never-delete rule was
    // relaxed for a kind of file; a directory-level rm would relax it for a
    // path, which is not what was granted.
    const root = instance();
    log(root);
    const stray = join(dir(root), "a-proposal-somebody-dropped-here.md");
    writeFileSync(stray, "---\n$schema: folio-fsh-guts/v1\n---\n# not a log\n");
    const r = emptyLog(root, { all: true });
    expect(r.removed).toHaveLength(1);
    expect(existsSync(stray)).toBe(true);
    // The PROPERTY, not one refusal's wording: a `.md` fails at the JSON
    // step and a non-log JSON file fails at the schema step, and both are
    // refusals that name the contract. Asserting one phrasing made this pass
    // or fail on which branch happened to fire, which is not the point.
    expect(r.kept.find((k) => k.path === stray)!.reason).toContain("folio-log/v1");
  });

  test("valid JSON that is not a log entry is kept too", () => {
    const root = instance();
    const other = join(dir(root), "workflow-instance.json");
    writeFileSync(other, JSON.stringify({ $schema: "folio-workflow-instance/v1", tokens: [] }));
    expect(emptyLog(root, { all: true }).removed).toHaveLength(0);
    expect(existsSync(other)).toBe(true);
  });

  test("unreadable JSON is kept, and the reason says so", () => {
    // A file this module cannot parse is a file it cannot establish is a
    // log. "Could not tell" resolves to keep, never to delete.
    const root = instance();
    const broken = join(dir(root), "truncated.json");
    writeFileSync(broken, "{ not json");
    const r = emptyLog(root, { all: true });
    expect(existsSync(broken)).toBe(true);
    expect(r.kept.find((k) => k.path === broken)!.reason).toContain("not readable as JSON");
  });

  test("a subdirectory is not walked into and not removed", () => {
    const root = instance();
    log(root);
    mkdirSync(join(dir(root), "archive"));
    const r = emptyLog(root, { all: true });
    expect(existsSync(join(dir(root), "archive"))).toBe(true);
    expect(r.kept.map((k) => k.reason).join(" ")).toContain("removes files only");
  });

  test("a symlink pointing out of the log directory is refused", () => {
    // `resolve` is string arithmetic and would not catch this. The module
    // DELETES, so getting containment wrong is a loss, not a leak.
    const root = instance();
    const outside = join(root, "precious.json");
    writeFileSync(outside, JSON.stringify({ $schema: "folio-log/v1" }));
    symlinkSync(outside, join(dir(root), "sneaky.json"));
    const r = emptyLog(root, { all: true });
    expect(existsSync(outside)).toBe(true);
    expect(r.kept.map((k) => k.reason).join(" ")).toContain("outside the log directory");
  });
});

describe("what it did NOT do is reported, not inferred", () => {
  test("`kept` separates a selector miss from a refusal", () => {
    // "Nothing to delete" and "nine files I would not touch" must not read
    // the same — the second is the one somebody needs to know about.
    const root = instance();
    log(root, { session: "run-a" });
    writeFileSync(join(dir(root), "stray.md"), "not a log");
    const r = emptyLog(root, { session: "nothing-matches-this" });
    expect(r.removed).toHaveLength(0);
    expect(r.kept.filter((k) => k.reason.startsWith("does not match"))).toHaveLength(1);
    expect(r.kept.filter((k) => !k.reason.startsWith("does not match"))).toHaveLength(1);
  });

  test("the one-liner names the refusals and a clean sweep does not", () => {
    const root = instance();
    log(root);
    const clean: LogSelector = { all: true };
    expect(describeSweep(clean, emptyLog(root, clean))).not.toContain("left alone");

    writeFileSync(join(dir(root), "stray.md"), "not a log");
    expect(describeSweep(clean, emptyLog(root, clean))).toContain("left alone");
  });

  test("`scanned` is the vacuity guard on every count above", () => {
    // Without it, a sweep over an empty or missing directory reports
    // `removed: []` and reads as success.
    const root = instance();
    expect(emptyLog(root, { all: true }).scanned).toBe(0);
    log(root);
    expect(emptyLog(root, { all: true }).scanned).toBe(1);
  });

  test("an instance with no declared trashcan says so rather than reporting a clean sweep", () => {
    const root = mkdtempSync(join(tmpdir(), "log-sweep-none-"));
    writeDeclaration(root, JSON.stringify({ name: "t", stub: "t", directories: [] }));
    const r = emptyLog(root, { all: true });
    expect(r.directories).toEqual([]);
    expect(describeSweep({ all: true }, r)).toContain("nothing to sweep");
  });
});
