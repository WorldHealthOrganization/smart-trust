/**
 * Tests for path containment (bean `6bhf`).
 *
 * The falsifier this file is built around is the one that matters for a
 * containment check: **a value that escapes must be refused, and a value that
 * is merely unusual must not be.** A test suite that only asserted refusals
 * would pass against `() => undefined`, which refuses everything and breaks
 * every real caller — so every refusal here has an acceptance beside it.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

import { safeSegment, joinSegments, resolveWithin, realPathWithin, writableWithin } from "../safe-path";

describe("safeSegment refuses what a path segment must not be", () => {
  it("accepts an ordinary identifier", () => {
    expect(safeSegment("arxiv-2501-01234")).toBe("arxiv-2501-01234");
  });

  it("accepts a leading dot — `.github` and `.beans.yml` are real names here", () => {
    // The falsifier for a blanket dot ban: it would refuse names this
    // repository actually uses while catching nothing `..` does not.
    expect(safeSegment(".github")).toBe(".github");
    expect(safeSegment(".beans.yml")).toBe(".beans.yml");
  });

  it("refuses the empty string, because join(base, '') is base itself", () => {
    // This is `plj1` one layer down: an empty slug made
    // `rm -rf "pages/branches/$SLUG"` delete every preview. An empty id turns a
    // per-item operation into a whole-store one.
    expect(safeSegment("")).toBeUndefined();
  });

  it("refuses `.` and `..`", () => {
    expect(safeSegment(".")).toBeUndefined();
    expect(safeSegment("..")).toBeUndefined();
  });

  it("refuses a traversal sequence", () => {
    expect(safeSegment("../../../etc")).toBeUndefined();
  });

  it("refuses a nested path even though it is CONTAINED", () => {
    // The distinction between the two functions in this module: `a/b` resolves
    // to a perfectly contained nested path, so `resolveWithin` would accept it.
    // It is still not one segment, and a caller that meant one directory gets
    // two. Collapsing the two checks is what this pins.
    expect(safeSegment("a/b")).toBeUndefined();
  });

  it("refuses a backslash regardless of host, since Windows treats it as a separator", () => {
    expect(safeSegment("a\\b")).toBeUndefined();
  });

  it("refuses a NUL byte, which truncates the path for some syscalls", () => {
    expect(safeSegment("ok\0../../etc")).toBeUndefined();
  });

  it("refuses a non-string, so an absent query parameter cannot become a path", () => {
    // `url.searchParams.get()` returns `null`, which is exactly how the three
    // defective call sites received a missing value.
    expect(safeSegment(null)).toBeUndefined();
    expect(safeSegment(undefined)).toBeUndefined();
  });

  it("never REPAIRS a value — a refusal is not a sanitised string", () => {
    // `fuzm`: the staging slug pipeline replaces disallowed characters, so
    // input `..` survived as output `..` and `---` collapsed to empty. A repair
    // silently changes which artefact is named.
    expect(safeSegment("a/b")).not.toBe("ab");
    expect(safeSegment("a/b")).not.toBe("a-b");
  });
});

describe("joinSegments checks EVERY segment, not the first", () => {
  it("joins when all are safe", () => {
    expect(joinSegments("/root", "a", "b")).toBe(join("/root", "a", "b"));
  });

  it("refuses when a LATER segment is unsafe — the `feedbackPath` defect", () => {
    // `feedbackPath(paperId, rootName)` took two external values and validated
    // neither; a check on only the first would have left half the hole.
    expect(joinSegments("/root", "ok", "../../etc")).toBeUndefined();
    expect(joinSegments("/root", "ok", "")).toBeUndefined();
  });
});

describe("resolveWithin — lexical containment for a URL path", () => {
  it("resolves a normal path inside the root", () => {
    // input-site: inert #47db5173 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(resolveWithin("/root", "/a/b.html")).toBe(resolve("/root/a/b.html"));
  });

  it("absorbs traversal against the root rather than escaping", () => {
    // input-site: inert #88a518d0 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(resolveWithin("/root", "/../../etc/passwd")).toBe(resolve("/root/etc/passwd"));
  });

  it("decodes percent-escapes BEFORE normalising", () => {
    // input-site: inert #cc61c8e9 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(resolveWithin("/root", "/%2e%2e/%2e%2e/etc")).toBe(resolve("/root/etc"));
  });

  it("refuses a malformed escape and a NUL", () => {
    expect(resolveWithin("/root", "/%ZZ")).toBeUndefined();
    expect(resolveWithin("/root", "/a\0b")).toBeUndefined();
  });

  it("accepts the root itself", () => {
    expect(resolveWithin("/root", "/")).toBe(resolve("/root"));
  });

  it("does NOT accept a sibling whose name merely starts with the root's", () => {
    // The `startsWith(base)` bug this module's check avoids by comparing
    // against `base + sep`: `/rootevil` starts with `/root`.
    // input-site: inert #854f9524 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(resolveWithin("/root", "/../rootevil/x")).toBe(resolve("/root/rootevil/x"));
  });
});

describe("realPathWithin — the half an escape actually needs", () => {
  it("a symlink pointing OUT of the root is refused, though the string looks clean", () => {
    // Recorded in `serve-rendering.ts`: the first version of its resolver
    // returned 200 for exactly this, because `resolve` is string arithmetic and
    // the escape happens entirely in the filesystem.
    const base = mkdtempSync(join(tmpdir(), "sp-"));
    const root = join(base, "root");
    const outside = join(base, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.txt"), "s");
    symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));

    const lexical = resolveWithin(root, "/link.txt");
    expect(lexical).toBeDefined();               // the lexical check is happy
    expect(realPathWithin(root, lexical!)).toBeUndefined(); // ...and this is not
    rmSync(base, { recursive: true, force: true });
  });

  it("a real file inside the root resolves", () => {
    const base = mkdtempSync(join(tmpdir(), "sp-ok-"));
    writeFileSync(join(base, "f.txt"), "x");
    expect(realPathWithin(base, join(base, "f.txt"))).toContain("f.txt");
    rmSync(base, { recursive: true, force: true });
  });

  it("something absent is undefined, not an escape", () => {
    const base = mkdtempSync(join(tmpdir(), "sp-gone-"));
    expect(realPathWithin(base, join(base, "nope"))).toBeUndefined();
    rmSync(base, { recursive: true, force: true });
  });
});

describe("writableWithin — for a target that does not exist yet", () => {
  it("accepts a path under the root whose parents are absent", () => {
    const base = mkdtempSync(join(tmpdir(), "sp-w-"));
    expect(writableWithin(base, join(base, "new", "deep", "file.json"))).toBe(true);
    rmSync(base, { recursive: true, force: true });
  });

  it("refuses a path whose nearest existing ancestor is a symlink OUT of the root", () => {
    // The case `realPathWithin` cannot answer, because the target is not there
    // to have a realpath: the link is in the ancestry, not at the leaf.
    const base = mkdtempSync(join(tmpdir(), "sp-wl-"));
    const root = join(base, "root");
    const outside = join(base, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    symlinkSync(outside, join(root, "escape"));
    expect(writableWithin(root, join(root, "escape", "written.json"))).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });

  it("refuses a lexically outside path outright", () => {
    const base = mkdtempSync(join(tmpdir(), "sp-wo-"));
    expect(writableWithin(base, resolve(base, "..", "elsewhere", "x"))).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });

  it("does not accept a sibling directory sharing the root's prefix", () => {
    const base = mkdtempSync(join(tmpdir(), "sp-pre-"));
    const root = join(base, "root");
    mkdirSync(root);
    mkdirSync(join(base, "rootevil"));
    expect(writableWithin(root, join(base, "rootevil", "x"))).toBe(false);
    expect(root + sep).not.toBe(join(base, "rootevil"));
    rmSync(base, { recursive: true, force: true });
  });
});
