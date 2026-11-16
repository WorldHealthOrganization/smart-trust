/**
 * Sweep marks — bean `rq8s` (owner ruling 2026-10-10: "timestamp").
 *
 * A mark is written for a run that read its input and read back by the sweep.
 * Every answer but a mark must say what it is: a store with no marks node, an
 * unparsable mark and a missing one are three different things, and none of
 * them is "checked".
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SweepMarkSchema } from "../../schemas/sdlc/sweep-mark.ts";

import { describeMark, judgeSweepMarks, readSweepMark, sessionId, writeSweepMark } from "../sweep-mark.ts";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A checkout whose bean graph declares the given nodes. */
function store(withMarks: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "sweep-mark-"));
  roots.push(root);
  mkdirSync(join(root, "beans"), { recursive: true });
  const directories = [
    { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
    ...(withMarks ? [{ id: "marks", path: "marks", graphTypologies: ["sweep-marks"] }] : []),
  ];
  writeFileSync(join(root, "beans", "beans.json"), JSON.stringify({ name: "t", directories }));
  return root;
}

const T0 = new Date("2026-10-12T09:00:00Z");

describe("sweep marks", () => {
  test("a written mark reads back with its age, and is a valid folio-sweep-mark/v1", () => {
    const root = store(true);
    const w = writeSweepMark(root, { check: "session-staleness", read: 50, findings: 4, by: "session_x" }, T0);
    expect(w.state).toBe("written");
    if (w.state !== "written") return;
    expect(SweepMarkSchema.safeParse(JSON.parse(readFileSync(w.path, "utf8"))).success).toBe(true);

    const m = readSweepMark(root, "session-staleness", new Date("2026-10-12T15:00:00Z"));
    expect(m).toMatchObject({ state: "marked", ageHours: 6, mark: { read: 50, findings: 4, by: "session_x" } });
    expect(describeMark("session-staleness", m)).toContain("6.0 h ago");
  });

  test("a later run replaces the mark — one file per check", () => {
    const root = store(true);
    writeSweepMark(root, { check: "session-staleness", read: 3, findings: 0 }, T0);
    writeSweepMark(root, { check: "session-staleness", read: 7, findings: 1 }, new Date("2026-10-13T09:00:00Z"));
    const m = readSweepMark(root, "session-staleness", new Date("2026-10-13T09:00:00Z"));
    expect(m).toMatchObject({ state: "marked", ageHours: 0, mark: { read: 7 } });
  });

  test("no mark yet is NONE, and says it is not 'none waiting'", () => {
    const root = store(true);
    const m = readSweepMark(root, "session-staleness");
    expect(m.state).toBe("none");
    expect(describeMark("session-staleness", m)).toContain('Not "none waiting"');
  });

  test("a store with no marks node is UNDECLARED, and the writer says so instead of inventing a path", () => {
    const root = store(false);
    expect(readSweepMark(root, "session-staleness").state).toBe("undeclared");
    expect(writeSweepMark(root, { check: "session-staleness", read: 1, findings: 0 }).state).toBe("not-written");
    expect(describeMark("session-staleness", { state: "undeclared" })).toStartWith("Could not determine");
  });

  test("an unparsable or mismatched mark is CORRUPT, never a mark", () => {
    const root = store(true);
    const dir = join(root, "beans", "marks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session-staleness.json"), "{ nope");
    expect(readSweepMark(root, "session-staleness").state).toBe("corrupt");
    writeFileSync(
      join(dir, "session-staleness.json"),
      JSON.stringify({ $schema: "folio-sweep-mark/v1", check: "other", checkedAt: T0.toISOString(), read: 1, findings: 0 }),
    );
    expect(readSweepMark(root, "session-staleness").state).toBe("corrupt");
  });

  test("the session id comes from the environment when it names one", () => {
    expect(sessionId({ CLAUDE_CODE_REMOTE_SESSION_ID: "session_a" })).toBe("session_a");
    expect(sessionId({})).toBeUndefined();
  });
});

describe("sweep:mark:check — the gate that judges the kind (rq8s, 2026-10-20)", () => {
  test("an empty store, and a store of valid marks, have nothing wrong", () => {
    const root = store(true);
    expect(judgeSweepMarks(root, T0)).toMatchObject({ state: "judged", read: 0, findings: [] });
    writeSweepMark(root, { check: "session-staleness", read: 5, findings: 1 }, T0);
    expect(judgeSweepMarks(root, T0)).toMatchObject({ state: "judged", read: 1, findings: [] });
  });

  test("CORRUPTED: an unparsable mark, a mark filed under another check's name, and a future date are each a finding", () => {
    const root = store(true);
    const dir = join(root, "beans", "marks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "a.json"), "{ nope");
    writeSweepMark(root, { check: "b", read: 1, findings: 0 }, T0);
    writeFileSync(join(dir, "c.json"), readFileSync(join(dir, "b.json"), "utf8"));
    writeSweepMark(root, { check: "d", read: 1, findings: 0 }, new Date("2026-10-13T09:00:00Z"));
    const v = judgeSweepMarks(root, T0);
    expect(v.state).toBe("judged");
    if (v.state !== "judged") return;
    expect(v.read).toBe(4);
    expect(v.findings.map((f) => f.path.split("/").pop()).sort()).toEqual(["a.json", "c.json", "d.json"]);
  });

  test("a date within a few minutes of now is clock skew, not a finding", () => {
    const root = store(true);
    writeSweepMark(root, { check: "session-staleness", read: 1, findings: 0 }, new Date(T0.getTime() + 60_000));
    expect(judgeSweepMarks(root, T0)).toMatchObject({ findings: [] });
  });

  test("a store with no marks node is UNDECLARED, not an empty pass of a store that exists", () => {
    expect(judgeSweepMarks(store(false), T0).state).toBe("undeclared");
  });
});
