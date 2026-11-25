/**
 * `check:source-licence:check` compares the committed sidecar and writes
 * NOTHING — bean `i2kp`.
 *
 * Before it existed the gate WAS the writer: CI ran `check:source-licence`, it
 * rewrote `test/results/source-licence.qa-results.json`, and the committed
 * record could be arbitrarily stale while no gate failed. These tests assert
 * both directions of the remedy, and above all that `--check` leaves the
 * file's bytes alone, because a check that repairs is the defect.
 */
import { HARNESS_ROOT } from "../lib/roots.ts";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkMode, sourceLicenceDoc, CHECK_EXIT, type LicenceReport } from "../check-source-licence.ts";
import { qaResultPath } from "../qa-results.ts";

const INSTANCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tmps: string[] = [];
afterEach(() => {
  for (const t of tmps.splice(0)) rmSync(t, { recursive: true, force: true });
});

function instance(): string {
  const t = mkdtempSync(join(tmpdir(), "source-licence-"));
  tmps.push(t);
  return t;
}

function report(over: Partial<LicenceReport> = {}): LicenceReport {
  return {
    entries: 2,
    stated: [{ entry: "library/a", id: "CC-BY-4.0", basis: "arXiv abstract page" }],
    unknown: [],
    notRecorded: [{ entry: "library/b" }],
    malformed: [],
    deprecatedIds: [],
    recased: [],
    ...over,
  };
}

function commit(root: string, body: string): string {
  const p = qaResultPath(root, "source-licence");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

describe("--check decides each freshness state where it is decided", () => {
  it("a CURRENT sidecar passes and its bytes are untouched", () => {
    const root = instance();
    const r = report();
    const doc = sourceLicenceDoc(r);
    const body = JSON.stringify(doc, null, 2) + "\n";
    const p = commit(root, body);
    const out = checkMode(root, r, doc);
    expect(out.state).toBe("current");
    expect(out.exit).toBe(0);
    expect(readFileSync(p, "utf-8")).toBe(body);
  });

  it("a hand-staled sidecar FAILS and is NOT repaired", () => {
    const root = instance();
    const r = report();
    const stale = sourceLicenceDoc(report({ notRecorded: [] }));
    const body = JSON.stringify(stale, null, 2) + "\n";
    const p = commit(root, body);
    const out = checkMode(root, r, sourceLicenceDoc(r));
    expect(out.state).toBe("stale");
    expect(out.exit).toBe(1);
    expect(readFileSync(p, "utf-8")).toBe(body);
  });

  it("an ABSENT sidecar fails rather than passing vacuously, and is not created", () => {
    const root = instance();
    const r = report();
    const out = checkMode(root, r, sourceLicenceDoc(r));
    expect(out.state).toBe("absent");
    expect(out.exit).toBe(1);
    expect(existsSync(qaResultPath(root, "source-licence"))).toBe(false);
  });

  it("an UNREADABLE sidecar exits 2 — the question could not be asked", () => {
    const root = instance();
    const r = report();
    const p = commit(root, "{ not json");
    const out = checkMode(root, r, sourceLicenceDoc(r));
    expect(out.state).toBe("unreadable");
    expect(out.exit).toBe(2);
    expect(readFileSync(p, "utf-8")).toBe("{ not json");
  });

  it("a MALFORMED record still fails on content when the sidecar is current", () => {
    const root = instance();
    const r = report({ malformed: [{ entry: "library/c", problem: "stated with no basis" }] });
    const doc = sourceLicenceDoc(r);
    commit(root, JSON.stringify(doc, null, 2) + "\n");
    const out = checkMode(root, r, doc);
    expect(out.state).toBe("current");
    expect(out.exit).toBe(1);
  });

  it("the exit table is the one the docblock states", () => {
    expect(CHECK_EXIT).toEqual({ current: 0, stale: 1, absent: 1, unreadable: 2, unknown: 2 });
  });
});

describe("the real gate, run as CI runs it", () => {
  it("`--check` on this repository writes nothing", () => {
    const p = qaResultPath(HARNESS_ROOT, "source-licence");
    const before = existsSync(p) ? readFileSync(p) : undefined;
    const proc = Bun.spawnSync(["bun", "run", join(INSTANCE_ROOT, "scripts", "check-source-licence.ts"), "--check"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const after = existsSync(p) ? readFileSync(p) : undefined;
    expect(after?.equals(before ?? Buffer.alloc(0)) ?? before === undefined).toBe(true);
    // Whatever the tree's state, the exit is one of the declared codes.
    expect([0, 1, 2]).toContain(proc.exitCode);
  });
});
