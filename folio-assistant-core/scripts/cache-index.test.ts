/**
 * The cache index keeps its three states apart, and eviction never acts — bean `54rk`.
 *
 * @module folio-assistant-core/scripts/cache-index.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cacheRows, evictionCandidates, summarise } from "./cache-index.js";
import type { MaterializedRecord } from "./check-materialized-fixity.js";

function fixtures(): MaterializedRecord[] {
  const dir = mkdtempSync(join(tmpdir(), "cache-index-"));
  mkdirSync(join(dir, "item"));
  writeFileSync(join(dir, "measured.bin"), "12345"); // 5 bytes
  writeFileSync(join(dir, "old.bin"), "1234567890"); // 10 bytes
  const base = { source: "fixture.json" };
  return [
    { ...base, id: "rec", localPath: "recorded.bin", abs: join(dir, "nope"), record: { state: "materialized", purpose: "working", bytes: 999, materializedAt: "2026-01-01T00:00:00Z" } },
    { ...base, id: "meas", localPath: "measured.bin", abs: join(dir, "measured.bin"), record: { state: "materialized", purpose: "working" } },
    { ...base, id: "dir", localPath: "item", abs: join(dir, "item"), record: { state: "materialized", purpose: "working" } },
    { ...base, id: "gone", record: { state: "materialized", purpose: "working" } },
    { ...base, id: "arch", localPath: "old.bin", abs: join(dir, "old.bin"), record: { state: "materialized", purpose: "archival" } },
    { ...base, id: "exp", localPath: "old.bin", abs: join(dir, "old.bin"), record: { state: "materialized", purpose: "working", expiresAt: "2000-01-01T00:00:00Z" } },
    { ...base, id: "fresh", localPath: "old.bin", abs: join(dir, "old.bin"), record: { state: "materialized", purpose: "working", expiresAt: "2999-01-01T00:00:00Z" } },
    { ...base, id: "olean", localPath: "old.bin", abs: join(dir, "old.bin"), record: { state: "materialized", purpose: "compiled", inputs: { toolchain: "lean4:v4.24.0", sourceRevision: "abc" } } },
  ];
}

describe("size: recorded, measured, directory, absent", () => {
  const rows = cacheRows(fixtures());
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));

  test("recordedSizeWins", () => {
    expect(by.rec.bytes).toBe(999);
    expect(by.rec.sizeBasis).toBe("recorded");
  });
  test("unrecordedSizeMeasured", () => {
    expect(by.meas.bytes).toBe(5);
    expect(by.meas.sizeBasis).toBe("measured");
  });
  test("directoryHasNoSize", () => {
    expect(by.dir.bytes).toBeUndefined();
    expect(by.dir.sizeBasis).toBe("directory");
  });
  test("noPathAbsent", () => {
    expect(by.gone.bytes).toBeUndefined();
    expect(by.gone.sizeBasis).toBe("absent");
  });
  test("totalCountsKnownOnly", () => {
    const s = summarise(rows);
    expect(s.knownBytes).toBe(999 + 5 + 10 + 10 + 10 + 10);
    expect(s.bySizeBasis).toEqual({ recorded: 1, measured: 5, directory: 1, absent: 1 });
  });
});

describe("dates: recorded or not, never invented", () => {
  const rows = cacheRows(fixtures());
  test("fetchedAtOnlyWhereRecorded", () => {
    expect(rows.filter((r) => r.fetchedAt).map((r) => r.id)).toEqual(["rec"]);
  });
  test("lastReadNeverRecorded", () => {
    expect(rows.every((r) => r.lastReadAt === undefined)).toBe(true);
  });
});

describe("eviction reports, and never names what must stay", () => {
  const evict = evictionCandidates(cacheRows(fixtures()));
  const ids = evict.map((e) => e.row.id);
  test("expiredFirstThenNoLifetime", () => {
    expect(ids[0]).toBe("exp");
    expect(ids.slice(1)).toEqual(["rec", "meas", "dir", "gone"]);
  });
  test("archivalNeverCandidate", () => {
    expect(ids).not.toContain("arch");
  });
  test("freshNeverCandidate", () => {
    expect(ids).not.toContain("fresh");
  });
  test("compiledNotNoExpiryCandidate", () => {
    expect(ids).not.toContain("olean");
  });
  test("everyCandidateHasReason", () => {
    expect(evict.every((e) => e.reason.length > 0)).toBe(true);
  });
});

describe("the real corpus", () => {
  test("realCorpusHasCopies", () => {
    expect(cacheRows().length).toBeGreaterThan(0);
  });
});
