/**
 * Tests for materialization lastReadAt tracking and eviction candidate ranking (bean folio-assistant-7wgs).
 *
 * @module folio-assistant-core/scripts/tests/materialization-last-read.test
 */
import { describe, expect, test } from "bun:test";

import {
  MaterializationSchema,
  recordMaterializationRead,
  touchMaterializedRead,
  type Materialization,
} from "../../schemas/materialization.js";
import { cacheRows, evictionCandidates, type CacheRow } from "../cache-index.js";
import type { MaterializedRecord } from "../check-materialized-fixity.js";

const baseWorkingRecord: Materialization = {
  state: "materialized",
  provenance: {
    upstream: "https://example.com/data.bin",
  },
  localPath: "data.bin",
  purpose: "working",
  bytes: 1024,
  gates: {
    size: { verdict: "permitted", basis: "1 KB within budget" },
    restrictions: { verdict: "permitted", basis: "public" },
    retention: { verdict: "permitted", basis: "cacheable" },
    sourceLoss: { verdict: "unknown", basis: "working derivation" },
    copyright: { verdict: "permitted", basis: "CC-BY" },
  },
};

describe("MaterializationSchema with and without lastReadAt", () => {
  test("validatesWithoutLastRead", () => {
    const parsed = MaterializationSchema.safeParse(baseWorkingRecord);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lastReadAt).toBeUndefined();
    }
  });

  test("validatesWithLastRead", () => {
    const withRead: Materialization = {
      ...baseWorkingRecord,
      lastReadAt: "2026-10-09T18:00:00.000Z",
    };
    const parsed = MaterializationSchema.safeParse(withRead);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lastReadAt).toBe("2026-10-09T18:00:00.000Z");
    }
  });

  test("rejectsEmptyLastRead", () => {
    const invalid = {
      ...baseWorkingRecord,
      lastReadAt: "",
    };
    const parsed = MaterializationSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});

describe("touchMaterializedRead and recordMaterializationRead", () => {
  test("touchSetsIsoNow", () => {
    const before = new Date().toISOString();
    const updated = touchMaterializedRead(baseWorkingRecord);
    const after = new Date().toISOString();

    expect(updated.lastReadAt).toBeDefined();
    expect(typeof updated.lastReadAt).toBe("string");
    // Must be valid ISO string
    expect(new Date(updated.lastReadAt!).toISOString()).toBe(updated.lastReadAt!);
    expect(updated.lastReadAt! >= before).toBe(true);
    expect(updated.lastReadAt! <= after).toBe(true);
    // Preserves other fields
    expect(updated.state).toBe(baseWorkingRecord.state);
    expect(updated.localPath).toBe(baseWorkingRecord.localPath);
    expect(updated.bytes).toBe(baseWorkingRecord.bytes);
  });

  test("recordAcceptsDate", () => {
    const targetDate = new Date("2026-05-15T10:30:00.000Z");
    const updated = recordMaterializationRead(baseWorkingRecord, targetDate);

    expect(updated.lastReadAt).toBe("2026-05-15T10:30:00.000Z");
  });

  test("touchAndRecordAliases", () => {
    expect(touchMaterializedRead).toBe(recordMaterializationRead);
  });
});

describe("cacheRows() populates lastReadAt", () => {
  test("cacheRowsReadLastRead", () => {
    const mockRecords: MaterializedRecord[] = [
      {
        source: "item-with-read.json",
        id: "item1",
        localPath: "item1.bin",
        record: {
          ...baseWorkingRecord,
          lastReadAt: "2026-09-01T12:00:00.000Z",
        },
      },
      {
        source: "item-without-read.json",
        id: "item2",
        localPath: "item2.bin",
        record: {
          ...baseWorkingRecord,
        },
      },
    ];

    const rows = cacheRows(mockRecords);
    expect(rows.length).toBe(2);

    const r1 = rows.find((r) => r.id === "item1");
    expect(r1).toBeDefined();
    expect(r1?.lastReadAt).toBe("2026-09-01T12:00:00.000Z");

    const r2 = rows.find((r) => r.id === "item2");
    expect(r2).toBeDefined();
    expect(r2?.lastReadAt).toBeUndefined();
  });
});

describe("eviction candidate ranking accounts for lastReadAt", () => {
  test("leastRecentlyReadFirst", () => {
    const olderRead: CacheRow = {
      source: "a.json",
      id: "older",
      localPath: "older.bin",
      purpose: "working",
      bytes: 100, // Smaller bytes
      sizeBasis: "recorded",
      lastReadAt: "2026-01-01T00:00:00.000Z", // Older read (least recently read)
      freshness: "no-expiry",
    };

    const newerRead: CacheRow = {
      source: "b.json",
      id: "newer",
      localPath: "newer.bin",
      purpose: "working",
      bytes: 5000, // Larger bytes
      sizeBasis: "recorded",
      lastReadAt: "2026-10-01T00:00:00.000Z", // More recent read
      freshness: "no-expiry",
    };

    const candidates = evictionCandidates([newerRead, olderRead]);
    expect(candidates.map((c) => c.row.id)).toEqual(["older", "newer"]);
  });

  test("recordedBeforeMissing", () => {
    const recordedRead: CacheRow = {
      source: "a.json",
      id: "recorded",
      localPath: "recorded.bin",
      purpose: "working",
      bytes: 100,
      sizeBasis: "recorded",
      lastReadAt: "2026-01-01T00:00:00.000Z",
      freshness: "no-expiry",
    };

    const unrecorded: CacheRow = {
      source: "b.json",
      id: "unrecorded",
      localPath: "unrecorded.bin",
      purpose: "working",
      bytes: 5000,
      sizeBasis: "recorded",
      // lastReadAt undefined
      freshness: "no-expiry",
    };

    const candidates = evictionCandidates([unrecorded, recordedRead]);
    expect(candidates.map((c) => c.row.id)).toEqual(["recorded", "unrecorded"]);
  });

  test("expiredFirstRegardless", () => {
    const expiredRecentRead: CacheRow = {
      source: "exp.json",
      id: "expired",
      localPath: "expired.bin",
      purpose: "working",
      bytes: 50,
      sizeBasis: "recorded",
      lastReadAt: "2026-10-09T00:00:00.000Z", // Read today
      freshness: "expired",
    };

    const noExpiryOldRead: CacheRow = {
      source: "noexp.json",
      id: "no-expiry",
      localPath: "noexp.bin",
      purpose: "working",
      bytes: 5000,
      sizeBasis: "recorded",
      lastReadAt: "2020-01-01T00:00:00.000Z", // Read years ago
      freshness: "no-expiry",
    };

    const candidates = evictionCandidates([noExpiryOldRead, expiredRecentRead]);
    // Expired must still come first
    expect(candidates[0].row.id).toBe("expired");
    expect(candidates[1].row.id).toBe("no-expiry");
  });

  test("tiedReadLargerFirst", () => {
    const small: CacheRow = {
      source: "s.json",
      id: "small",
      localPath: "small.bin",
      bytes: 100,
      sizeBasis: "recorded",
      lastReadAt: "2026-05-01T00:00:00.000Z",
      freshness: "no-expiry",
    };

    const large: CacheRow = {
      source: "l.json",
      id: "large",
      localPath: "large.bin",
      bytes: 2000,
      sizeBasis: "recorded",
      lastReadAt: "2026-05-01T00:00:00.000Z",
      freshness: "no-expiry",
    };

    const candidates = evictionCandidates([small, large]);
    expect(candidates.map((c) => c.row.id)).toEqual(["large", "small"]);
  });
});
