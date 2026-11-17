import { describe, expect, test } from "bun:test";

import {
  ASSET_DISPOSITIONS,
  BINARY_RELEASE_SCHEMA_TAG,
  BinaryReleaseSchema,
  DECIDED_DISPOSITIONS,
  binaryReleaseVerdict,
  purgedAssets,
  releaseBytes,
  type BinaryRelease,
} from "./binary-release";
import { defaultGraphTypologies, graphTypologyIri, graphLayer, isDerivedGraph, isRenderable, processMayWrite } from "../kg/cat-harness";

const SHA = "a".repeat(64);

/**
 * One release, in the shape a GitHub release of an IG actually takes.
 *
 * Built by a helper rather than inlined per test, so a test asserting ONE rule
 * cannot pass because of a second violation elsewhere in its fixture.
 */
function release(over: Partial<BinaryRelease> = {}): unknown {
  const base = {
    $schema: BINARY_RELEASE_SCHEMA_TAG,
    release: { id: "1234", version: "1.8.0", tag: "v1.8.0" },
    origin: { kind: "github-release", repository: "example/smart-example" },
    assets: [
      {
        name: "package.tgz",
        bytes: 4_194_304,
        digest: { algorithm: "sha256", digest: SHA },
        fetchedFrom: "https://example.test/releases/v1.8.0/package.tgz",
        disposition: "published",
      },
    ],
  };
  return { ...base, ...over };
}

describe("never the bytes", () => {
  test("the baseline release parses", () => {
    expect(BinaryReleaseSchema.safeParse(release()).success).toBe(true);
  });

  test("a payload key is REFUSED — the shape is strict throughout", () => {
    const withBytes = {
      ...(release() as object),
      assets: [{ ...(release() as { assets: unknown[] }).assets[0] as object, content: "SGVsbG8=" }],
    };
    expect(BinaryReleaseSchema.safeParse(withBytes).success).toBe(false);
  });

  test("an unknown top-level key is REFUSED too", () => {
    expect(BinaryReleaseSchema.safeParse({ ...(release() as object), blob: "…" }).success).toBe(false);
  });

  test("an asset with no `fetchedFrom` is REFUSED — a size and a hash with no referent", () => {
    const a = { name: "package.tgz", bytes: 1, disposition: "published" };
    expect(BinaryReleaseSchema.safeParse(release({ assets: [a] } as never)).success).toBe(false);
  });
});

describe("the deploy purge — the case the kind exists for", () => {
  const purged = {
    name: "output.zip",
    bytes: 157_286_400,
    digest: { algorithm: "sha256", digest: SHA },
    fetchedFrom: "https://example.test/releases/v1.8.0/output.zip",
    disposition: "deleted-before-deploy",
    dispositionReason: "over the 100 MB deploy limit; removed by the WHO deploy phase before publication",
  };

  test("a purged asset is recorded, with where to get it back", () => {
    const r = BinaryReleaseSchema.parse(release({ assets: [purged] } as never));
    expect(purgedAssets(r)).toHaveLength(1);
    expect(purgedAssets(r)[0]?.fetchedFrom).toContain("output.zip");
  });

  test("a purged asset must still say where it is fetched from", () => {
    const { fetchedFrom: _drop, ...rest } = purged;
    expect(BinaryReleaseSchema.safeParse(release({ assets: [rest] } as never)).success).toBe(false);
  });

  test("a DECIDED disposition with no reason is REFUSED — deleted cannot be told from lost", () => {
    const { dispositionReason: _drop, ...rest } = purged;
    expect(BinaryReleaseSchema.safeParse(release({ assets: [rest] } as never)).success).toBe(false);
  });

  test("every decided disposition is one the schema knows", () => {
    for (const d of DECIDED_DISPOSITIONS) expect(ASSET_DISPOSITIONS).toContain(d);
  });

  test("`expired` is NOT a decision, so a reason on it is REFUSED", () => {
    // A retention window closing is nobody's decision. Allowing a reason there
    // would attribute one, which is the distinction the rule exists to keep.
    const a = { ...purged, disposition: "expired" };
    expect(BinaryReleaseSchema.safeParse(release({ assets: [a] } as never)).success).toBe(false);
  });

  test("`published` with no reason is fine", () => {
    const a = { ...purged, disposition: "published", dispositionReason: undefined };
    delete (a as Record<string, unknown>).dispositionReason;
    expect(BinaryReleaseSchema.safeParse(release({ assets: [a] } as never)).success).toBe(true);
  });
});

describe("could-not-determine is never clean", () => {
  test("an undigested asset makes the release `unknown`, not `ok`", () => {
    const a = { name: "package.tgz", bytes: 1, fetchedFrom: "https://example.test/p.tgz", disposition: "published" };
    const r = BinaryReleaseSchema.parse(release({ assets: [a] } as never));
    expect(binaryReleaseVerdict(r)).toBe("unknown");
  });

  test("an `unknown` disposition makes the release `unknown` too", () => {
    const a = {
      name: "package.tgz",
      bytes: 1,
      digest: { algorithm: "sha256", digest: SHA },
      fetchedFrom: "https://example.test/p.tgz",
      disposition: "unknown",
    };
    const r = BinaryReleaseSchema.parse(release({ assets: [a] } as never));
    expect(binaryReleaseVerdict(r)).toBe("unknown");
  });

  test("a gone-but-established asset is a `finding` — a result, not an error", () => {
    const a = {
      name: "output.zip",
      bytes: 2,
      digest: { algorithm: "sha256", digest: SHA },
      fetchedFrom: "https://example.test/o.zip",
      disposition: "superseded",
      dispositionReason: "replaced under the same name by v1.9.0",
    };
    const r = BinaryReleaseSchema.parse(release({ assets: [a] } as never));
    expect(binaryReleaseVerdict(r)).toBe("finding");
  });

  test("everything digested and still published is `ok`", () => {
    expect(binaryReleaseVerdict(BinaryReleaseSchema.parse(release()))).toBe("ok");
  });

  test("a verification time cannot exist without a digest — it is nested inside one", () => {
    const a = {
      name: "package.tgz",
      bytes: 1,
      fetchedFrom: "https://example.test/p.tgz",
      disposition: "published",
      verifiedAt: "2026-09-30T00:00:00Z",
    };
    expect(BinaryReleaseSchema.safeParse(release({ assets: [a] } as never)).success).toBe(false);
  });

  test("a malformed digest is REFUSED", () => {
    const a = {
      name: "package.tgz",
      bytes: 1,
      digest: { algorithm: "sha256", digest: "NOTAHASH" },
      fetchedFrom: "https://example.test/p.tgz",
      disposition: "published",
    };
    expect(BinaryReleaseSchema.safeParse(release({ assets: [a] } as never)).success).toBe(false);
  });
});

describe("the file declares what it is", () => {
  test("a document with no `$schema` tag is REFUSED", () => {
    const { $schema: _drop, ...rest } = release() as Record<string, unknown>;
    expect(BinaryReleaseSchema.safeParse(rest).success).toBe(false);
  });

  test("a version is required — an id alone collides across re-publications", () => {
    expect(BinaryReleaseSchema.safeParse(release({ release: { id: "1" } } as never)).success).toBe(false);
  });

  test("two assets under one name are REFUSED", () => {
    const one = (release() as { assets: unknown[] }).assets[0];
    expect(BinaryReleaseSchema.safeParse(release({ assets: [one, one] } as never)).success).toBe(false);
  });

  test("an unknown origin is REFUSED", () => {
    expect(BinaryReleaseSchema.safeParse(release({ origin: { kind: "sneakernet", repository: "r" } } as never)).success).toBe(false);
  });

  test("`releaseBytes` totals what was published", () => {
    expect(releaseBytes(BinaryReleaseSchema.parse(release()))).toBe(4_194_304);
  });
});

describe("the graph typology it is held under", () => {
  test("registered, not renderable, `state`, and not work", () => {
    expect(defaultGraphTypologies.get("binary-release")).toBeDefined();
    expect(isRenderable("binary-release")).toBe(false);
    expect(graphLayer("binary-release")).toBe("state");
    expect(defaultGraphTypologies.get("binary-release")?.recordsWork).toBe(false);
  });

  test("a process MAY write it — the release pipeline appends a node", () => {
    expect(processMayWrite("binary-release")).toBe(true);
  });

  test("it is NOT `derived`, and its sibling `ig-metadata-index` is", () => {
    // The call worth pinning: re-harvesting an unchanged IG gives the same
    // metadata index back, while re-running a release pipeline produces a
    // DIFFERENT release. Same build, opposite answers.
    expect(isDerivedGraph("binary-release")).toBe(false);
    expect(isDerivedGraph("ig-metadata-index")).toBe(true);
  });

  test("it is a DIFFERENT kind from `catalogue`, which is where materialization lives", () => {
    // Option B was reusing `materialization`. A release is a publication
    // upstream; a materialization is a copy here. This test is what stops a
    // later tidy-up folding them without the argument being made again.
    const kinds = ["binary-release", "catalogue"].map((k) => (defaultGraphTypologies.has(k) ? graphTypologyIri(k, defaultGraphTypologies.get(k)) : undefined));
    expect(new Set(kinds).size).toBe(2);
  });
});
