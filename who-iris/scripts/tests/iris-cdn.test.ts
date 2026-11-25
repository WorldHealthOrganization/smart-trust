import { describe, expect, test } from "bun:test";
import { diffManifests, isEmptyDiff, parsePayloadManifest, payloadManifest, sha256Hex, tagFiles, type PayloadEntry } from "../iris-cdn/bag.ts";
import { didDocument, didWebUrl, generateKeyPair, signDetached, verifyDetached, type PublicJwk } from "../iris-cdn/signing.ts";
import { mkdtempSync, readFileSync as readFile } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";
import { createPrivateKey, webcrypto } from "node:crypto";
import { allItemIds, changedSince, itemBitstreams, withdrawnOrHidden, type Fetcher } from "../iris-cdn/rest-feed.ts";
import { catalogueSubset, displayTitle, keyOfHandle, nodeOf, OWN_NOTE_PREFIX, parseHandles, queryPicks, sampleIndices, type ItemResource } from "../iris-cdn/run.ts";
import { mkdirSync as mkdirS, readdirSync as readdirS, writeFileSync as writeFileS } from "node:fs";

const e = (path: string, body: string): PayloadEntry => ({ path, sha256: sha256Hex(body), bytes: Buffer.byteLength(body) });

describe("BagIt manifests (RFC 8493) — no churn", () => {
  const a = [e("graph/spine.nq", "s"), e("records/10665/1.json", "one"), e("bitstreams/ab.pdf", "pdf")];

  test("discoveryOrderKeepsBytes", () => {
    expect(tagFiles(a)).toEqual(tagFiles([...a].reverse()));
  });

  test("refusesBaggingDate", () => {
    expect(tagFiles(a)["bag-info.txt"]).not.toMatch(/Date/);
    expect(() => tagFiles(a, { "Bagging-Date": "2026-10-30" })).toThrow(/date/);
  });

  test("payloadOxumIsOctetsCount", () => {
    expect(tagFiles(a)["bag-info.txt"]).toContain("Payload-Oxum: 7.3\n");
  });

  test("manifestRoundTripsAndDiffs", () => {
    const prev = parsePayloadManifest(payloadManifest(a));
    const next = parsePayloadManifest(payloadManifest([e("graph/spine.nq", "s2"), e("records/10665/1.json", "one"), e("records/10665/2.json", "two")]));
    const d = diffManifests(prev, next);
    expect(d).toEqual({ added: ["records/10665/2.json"], changed: ["graph/spine.nq"], removed: ["bitstreams/ab.pdf"], unchanged: 1 });
    expect(isEmptyDiff(diffManifests(prev, prev))).toBe(true);
  });

  test("refusesUnsafeAndDuplicatePaths", () => {
    expect(() => payloadManifest([e("../x", "x")])).toThrow(/unsafe/);
    expect(() => payloadManifest([e("x", "1"), e("x", "2")])).toThrow(/duplicate/);
  });
});

describe("did:web + detached JWS (RFC 7515 App. F, ES256 / EdDSA)", () => {
  test("resolvesDidWebUrl", () => {
    expect(didWebUrl("did:web:litlfred.github.io:who-iris-cdn")).toBe("https://litlfred.github.io/who-iris-cdn/did.json");
    expect(didWebUrl("did:web:example.org")).toBe("https://example.org/.well-known/did.json");
    expect(didWebUrl("did:web:localhost%3A8443:a")).toBe("https://localhost:8443/a/did.json");
  });

  test("signsVerifiesAndFails", async () => {
    const did = "did:web:litlfred.github.io:who-iris-cdn";
    const { privateKey, publicJwk } = await generateKeyPair();
    const other = await generateKeyPair();
    const doc = didDocument(did, [{ fragment: "release-2026", jwk: publicJwk, active: true }, { fragment: "old", jwk: other.publicJwk, active: false }]);
    const payload = tagFiles([e("a", "a")])["tagmanifest-sha256.txt"];
    const jws = await signDetached(payload, privateKey, `${did}#release-2026`);
    expect(jws.split(".")[1]).toBe("");

    expect(JSON.parse(Buffer.from(jws.split(".")[0], "base64url").toString()).alg).toBe("ES256");
    expect(await verifyDetached(payload, jws, doc)).toEqual({ state: "verified", kid: `${did}#release-2026`, chain: "absent" });
    expect((await verifyDetached(payload + "x", jws, doc)).state).toBe("failed");
    expect((await verifyDetached(payload, jws, null)).state).toBe("unknown");

    const byRetired = await signDetached(payload, other.privateKey, `${did}#old`);
    expect(await verifyDetached(payload, byRetired, doc)).toMatchObject({ state: "failed", reason: expect.stringContaining("assertionMethod") });
  });

  test("didDocumentIsByteStable", async () => {
    const k1 = await generateKeyPair();
    const k2 = await generateKeyPair();
    const did = "did:web:example.org";
    const x = didDocument(did, [{ fragment: "b", jwk: k2.publicJwk, active: true }, { fragment: "a", jwk: k1.publicJwk, active: true }]);
    const y = didDocument(did, [{ fragment: "a", jwk: k1.publicJwk, active: true }, { fragment: "b", jwk: k2.publicJwk, active: true }]);
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
    expect(x.verificationMethod[0].type).toBe("JsonWebKey");
  });
});

describe("DSpace REST change feed", () => {
  const items = [
    { uuid: "u5", handle: "10665/5", lastModified: "2026-10-30T01:00:00Z" },
    { uuid: "u4", handle: "10665/4", lastModified: "2026-10-29T23:00:00Z" },
    { uuid: "u3", handle: "10665/3", lastModified: "2026-10-29T00:00:00Z" },
    { uuid: "u2", handle: "10665/2", lastModified: "2026-10-28T00:00:00Z" },
    { uuid: "u1", handle: "10665/1", lastModified: "2026-10-01T00:00:00Z", withdrawn: true },
  ];
  const fake = (size: number): { fetcher: Fetcher; calls: string[] } => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      const slice = items.slice(page * size, page * size + size);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          _embedded: {
            searchResult: {
              _embedded: { objects: slice.map((it) => ({ _embedded: { indexableObject: { type: "item", ...it } } })) },
              page: { number: page, totalPages: Math.ceil(items.length / size) },
            },
          },
        }),
      };
    };
    return { fetcher, calls };
  };

  test("pagesNewestFirstToCursor", async () => {
    const { fetcher, calls } = fake(2);
    const got = await changedSince(fetcher, "2026-10-29T00:00:00+00:00", { api: "https://x/api" });
    expect(got.map((i) => i.uuid)).toEqual(["u3", "u4", "u5"]);
    expect(calls.length).toBe(2);
    expect(calls[0]).toContain("sort=dc.date.accessioned,DESC");
    expect(calls[0]).toContain(encodeURIComponent("lastModified:[2026-10-29T00:00:00.000Z TO *]"));
  });

  test("weeklyReconciliationListsAll", async () => {
    const { fetcher } = fake(2);
    expect([...(await allItemIds(fetcher, { api: "https://x/api" }))].sort()).toEqual(["u1", "u2", "u3", "u4", "u5"]);
  });

  test("shortListingIsNotMassWithdrawal", () => {
    expect(withdrawnOrHidden(["a", "b"], new Set(["a"]), 0.5)).toEqual(["b"]);
    expect(() => withdrawnOrHidden(["a", "b", "c"], new Set(["a"]), 0.5)).toThrow(/faulty/);
  });

  test("bitstreamsFromEmbeddedBundles", async () => {
    const fetcher: Fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          bundles: {
            _embedded: {
              bundles: [
                { name: "THUMBNAIL", _embedded: { bitstreams: { _embedded: { bitstreams: [{ uuid: "t", name: "c.jpg", sizeBytes: 9, checkSum: { checkSumAlgorithm: "MD5", value: "x" } }] } } } },
                { name: "ORIGINAL", _embedded: { bitstreams: { _embedded: { bitstreams: [{ uuid: "o", name: "c.pdf", sizeBytes: 99, checkSum: { checkSumAlgorithm: "MD5", value: "y" } }] } } } },
              ],
            },
          },
        },
      }),
    });
    expect((await itemBitstreams(fetcher, "u1", "https://x/api")).map((b) => `${b.bundle}/${b.name}`)).toEqual(["ORIGINAL/c.pdf", "THUMBNAIL/c.jpg"]);
  });
});

describe("canonical records — no churn", () => {
  test("recordBytesIgnoreKeyOrderAndLinks", async () => {
    const { canonicalJson, recordOf } = await import("../iris-cdn/run.ts");
    const a = recordOf({ uuid: "u", handle: "10665/1", metadata: { "dc.title": [{ value: "T" }], "dc.date": [] }, _links: { self: { href: "https://x/1" } } });
    const b = recordOf({ _links: { self: { href: "https://y/1" } }, metadata: { "dc.date": [], "dc.title": [{ value: "T" }] }, handle: "10665/1", uuid: "u" });
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a).endsWith("}\n")).toBe(true);
  });
});

describe("metadata can change while the PDF does not", () => {
  test("metadataShaIgnoresKeyOrder", async () => {
    const { metadataSha } = await import("../iris-cdn/rest-feed.ts");
    const a = metadataSha({ "dc.title": [{ value: "T", language: "en" }], "dc.date.issued": [{ value: "2020" }] });
    const b = metadataSha({ "dc.date.issued": [{ value: "2020" }], "dc.title": [{ language: "en", value: "T" }] });
    const c = metadataSha({ "dc.date.issued": [{ value: "2021" }], "dc.title": [{ language: "en", value: "T" }] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  test("weeklyListingCarriesMetadataHash", async () => {
    const { allItems, metadataSha } = await import("../iris-cdn/rest-feed.ts");
    const md = { "dc.title": [{ value: "X" }] };
    const fetcher: Fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: { searchResult: { _embedded: { objects: [{ _embedded: { indexableObject: { uuid: "u", lastModified: "2026-10-30T00:00:00Z", metadata: md } } }] }, page: { number: 0, totalPages: 1 } } },
      }),
    });
    expect((await allItems(fetcher, { api: "https://x/api" })).get("u")).toBe(metadataSha(md));
  });

  test("containersPagedInFull", async () => {
    const { allContainers } = await import("../iris-cdn/rest-feed.ts");
    const all = Array.from({ length: 5 }, (_, i) => ({ uuid: `c${i}`, handle: `10665/c${i}`, name: `C${i}` }));
    const fetcher: Fetcher = async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return { ok: true, status: 200, json: async () => ({ _embedded: { collections: all.slice(page * 2, page * 2 + 2) }, page: { number: page, totalPages: 3 } }) };
    };
    expect((await allContainers(fetcher, "collections", { api: "https://x/api", size: 2 })).map((c) => c.uuid)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });
});

describe("x5c trust chain up to WHO's key", () => {
  const sh = (args: string[], cwd: string): void => {
    const r = Bun.spawnSync(["openssl", ...args], { cwd, stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(`openssl ${args.join(" ")}: ${r.stderr.toString()}`);
  };
  const der64 = (pem: string): string => pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const pubJwk = (pem: string): PublicJwk => {
    const j = createPrivateKey(pem).export({ format: "jwk" }) as { x: string; y: string };
    return { kty: "EC", crv: "P-256", x: j.x, y: j.y };
  };

  test("verifiesX5cChainToWhoAnchor", async () => {
    const d = mkdtempSync(pjoin(tmpdir(), "x5c-"));
    for (const n of ["who", "iris", "other"]) sh(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${n}.key`], d);
    sh(["req", "-x509", "-new", "-key", "who.key", "-subj", "/CN=WHO test root", "-days", "30", "-addext", "basicConstraints=critical,CA:TRUE", "-out", "who.crt"], d);
    sh(["req", "-new", "-key", "iris.key", "-subj", "/CN=IRIS CDN", "-out", "iris.csr"], d);
    sh(["x509", "-req", "-in", "iris.csr", "-CA", "who.crt", "-CAkey", "who.key", "-CAcreateserial", "-days", "30", "-out", "iris.crt"], d);
    const irisPem = readFile(pjoin(d, "iris.key"), "utf-8");
    const leaf = der64(readFile(pjoin(d, "iris.crt"), "utf-8"));
    const whoJwk = pubJwk(readFile(pjoin(d, "who.key"), "utf-8"));
    const otherJwk = pubJwk(readFile(pjoin(d, "other.key"), "utf-8"));
    const irisJwk = { ...pubJwk(irisPem), x5c: [leaf] } as PublicJwk;

    const pk8 = createPrivateKey(irisPem).export({ format: "der", type: "pkcs8" });
    const key = await webcrypto.subtle.importKey("pkcs8", pk8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const did = "did:web:example.org";
    const doc = didDocument(did, [{ fragment: "iris", jwk: irisJwk, active: true }]);
    const jws = await signDetached("payload", key, `${did}#iris`);

    expect(await verifyDetached("payload", jws, doc, { anchors: [whoJwk] })).toMatchObject({ state: "verified", chain: "verified" });
    expect(await verifyDetached("payload", jws, doc)).toMatchObject({ state: "verified", chain: "not-checked" });
    expect(await verifyDetached("payload", jws, doc, { anchors: [otherJwk] })).toMatchObject({ state: "failed", reason: expect.stringContaining("trust anchor") });
    expect(await verifyDetached("payload", jws, doc, { anchors: [whoJwk], at: new Date("2099-01-01") })).toMatchObject({ state: "failed", reason: expect.stringContaining("validity") });
  });
});

describe("verification refuses what the release cannot prove", () => {
  test("failsAnchoredKeyWithoutX5c", async () => {
    const anchor = await generateKeyPair();
    const k = await generateKeyPair();
    const did = "did:web:example.net";
    const doc = didDocument(did, [{ fragment: "k", jwk: k.publicJwk, active: true }]);
    const jws = await signDetached("payload", k.privateKey, `${did}#k`);
    expect(await verifyDetached("payload", jws, doc, { anchors: [anchor.publicJwk] })).toMatchObject({ state: "failed", reason: expect.stringContaining("no certificate chain") });
  });

  test("failsKidOutsideExpectedDid", async () => {
    const k = await generateKeyPair();
    const did = "did:web:example.net";
    const doc = didDocument(did, [{ fragment: "k", jwk: k.publicJwk, active: true }]);
    const jws = await signDetached("payload", k.privateKey, `${did}#k`);
    expect(await verifyDetached("payload", jws, doc, { expectDid: "did:web:example.org" })).toMatchObject({ state: "failed", reason: expect.stringContaining("expected DID") });
    expect(await verifyDetached("payload", jws, doc, { expectDid: did })).toMatchObject({ state: "verified" });
  });

  test("refusesNonPlainDidWeb", () => {
    expect(() => didWebUrl("did:web:a.org%2Fb")).toThrow(/host/);
    expect(() => didWebUrl("did:web:user%40a.org")).toThrow(/host/);
    expect(() => didWebUrl("did:web:a.org:..")).toThrow(/segment/);
    expect(() => didWebUrl("did:web:a.org:x%2Fy")).toThrow(/segment/);
  });
});

describe("IRIS values used as path segments are refused, never repaired", () => {
  test("refusesUnsafePathSegments", async () => {
    const { handleProblem, itemKey, segmentProblem, uuidProblem } = await import("../iris-cdn/run.ts");
    expect(handleProblem("10665/123")).toBeNull();
    for (const h of ["10665/1/x", "../1", "10665/1\n", "", 7]) expect(handleProblem(h)).not.toBeNull();
    expect(uuidProblem("0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b")).toBeNull();
    expect(uuidProblem("x/../y")).not.toBeNull();
    expect(segmentProblem("report.pdf")).toBeNull();
    for (const n of ["", ".", "..", "a/b", "a\\b", "a\nb", null]) expect(segmentProblem(n)).not.toBeNull();
    expect(itemKey(undefined, "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b")).toBe("uuid/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b");
    expect(() => itemKey("10665/1/../2", "u")).toThrow(/handle/);
  });
});

describe("per-item manifests (Q4 A)", () => {
  test("itemManifestHoldsOwnFilesStably", async () => {
    const { itemManifest, itemManifestPath } = await import("../iris-cdn/bag.ts");
    const all = [e("records/10665/1.json", "r1"), e("bitstreams/10665/1/ORIGINAL/a.pdf", "pdf"), e("records/10665/12.json", "r12"), e("bitstreams/10665/12/ORIGINAL/b.pdf", "x")];
    const m = itemManifest("10665/1", all);
    expect(m.split("\n").filter(Boolean).map((l) => l.split(" ")[1])).toEqual(["data/bitstreams/10665/1/ORIGINAL/a.pdf", "data/records/10665/1.json"]);
    expect(itemManifest("10665/1", [...all].reverse())).toBe(m);
    expect(itemManifestPath("10665/1")).toBe("items/10665/1/manifest-sha256.txt");
    expect(() => itemManifest("10665/9", all)).toThrow(/no record/);
  });

  test("metadataChangeMovesRecordOnly", async () => {
    const { itemManifest, parsePayloadManifest } = await import("../iris-cdn/bag.ts");
    const before = parsePayloadManifest(itemManifest("10665/1", [e("records/10665/1.json", "title A"), e("bitstreams/10665/1/ORIGINAL/a.pdf", "pdf")]));
    const after = parsePayloadManifest(itemManifest("10665/1", [e("records/10665/1.json", "title B"), e("bitstreams/10665/1/ORIGINAL/a.pdf", "pdf")]));
    expect(diffManifests(before, after)).toEqual({ added: [], changed: ["records/10665/1.json"], removed: [], unchanged: 1 });
  });
});

describe("live iris.who.int DSpace 7 REST shapes (#104)", () => {
  test("recordOfLiftsEmbeddedContainers", async () => {
    const { recordOf } = await import("../iris-cdn/run.ts");
    const liveItem = {
      id: "6e96b393-5419-4127-9818-a0ecdc174b70",
      uuid: "6e96b393-5419-4127-9818-a0ecdc174b70",
      name: "Guidance on health systems",
      handle: "10665/387974",
      lastModified: "2026-10-31T02:23:11.326+00:00",
      withdrawn: false,
      inArchive: true,
      discoverable: true,
      type: "item",
      metadata: { "dc.title": [{ value: "Guidance on health systems", language: null, authority: null, confidence: -1, place: 0 }] },
      _links: { self: { href: "https://iris.who.int/server/api/core/items/6e96b393-5419-4127-9818-a0ecdc174b70" } },
      _embedded: {
        owningCollection: {
          uuid: "43c3b8d5-432d-4e1b-a5bf-3cc6129d7266",
          handle: "10665/26723",
          name: "Technical Documents",
          _links: { self: { href: "https://iris.who.int/server/api/core/collections/43c3b8d5-432d-4e1b-a5bf-3cc6129d7266" } },
        },
      },
    };
    const rec = recordOf(liveItem);
    expect(rec._links).toBeUndefined();
    expect(rec._embedded).toBeUndefined();
    expect(rec.owningCollection).toEqual({
      uuid: "43c3b8d5-432d-4e1b-a5bf-3cc6129d7266",
      handle: "10665/26723",
      name: "Technical Documents",
    });
  });

  test("itemBitstreamsPagesBundles", async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(url);
      if (url.includes("/core/items/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            _embedded: {
              bundles: {
                _embedded: {
                  bundles: [
                    {
                      uuid: "658ec5ed-261d-498c-9594-21b03c5c29aa",
                      name: "ORIGINAL",
                      _embedded: {
                        bitstreams: {
                          _embedded: {
                            bitstreams: [
                              { uuid: "b2", name: "part2.pdf", sizeBytes: 20, checkSum: { checkSumAlgorithm: "MD5", value: "m2" } },
                            ],
                          },
                          page: { number: 0, size: 1, totalPages: 2, totalElements: 2 },
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          _embedded: {
            bitstreams: [
              { uuid: "b1", name: "part1.pdf", sizeBytes: 10, checkSum: { checkSumAlgorithm: "MD5", value: "m1" } },
            ],
          },
          page: { number: 1, size: 100, totalPages: 2 },
        }),
      };
    };
    const bs = await itemBitstreams(fetcher, "6e96b393-5419-4127-9818-a0ecdc174b70", "https://iris.who.int/server/api");
    expect(bs.map((x) => x.name)).toEqual(["part1.pdf", "part2.pdf"]);
    expect(calls.length).toBe(2);
    expect(calls[1]).toContain("/core/bundles/658ec5ed-261d-498c-9594-21b03c5c29aa/bitstreams?page=1&size=100");
  });
});

describe("initial-load runner: budget, batch plan, checkpoint and graph rebuild (#104)", () => {
  test("parseBudgetRequiresDenominators", async () => {
    const { parseBudget } = await import("../iris-cdn/run.ts");
    expect(() => parseBudget({})).toThrow(/totalItemsUpstream/);
    expect(() => parseBudget({ totalItemsUpstream: 274071, totalFilesUpstream: 1057223, totalBytesUpstream: 0, maxRequestsPerSecond: 2 })).toThrow(/totalBytesUpstream/);
    const ok = parseBudget(JSON.stringify({
      totalItemsUpstream: 274071,
      totalFilesUpstream: 1057223,
      totalBytesUpstream: 388211392512,
      maxRequestsPerSecond: 5000,
      maxBatchesPerRun: 1,
      pageSize: 1,
    }));
    expect(ok.totalItemsUpstream).toBe(274071);
    expect(ok.maxBatchesPerRun).toBe(1);
    expect(ok.pageSize).toBe(1);
  });

  test("initialLoadBatchesResumesBuildsGraph", async () => {
    const { parseBudget, resetSignerForTest, runInitialLoad } = await import("../iris-cdn/run.ts");
    const { createHash } = await import("node:crypto");
    const { existsSync, rmSync } = await import("node:fs");

    const privPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const privJwk = await webcrypto.subtle.exportKey("jwk", privPair.privateKey);
    process.env.IRIS_CDN_DID = "did:web:example.org";
    process.env.IRIS_CDN_KEY_ID = "release-1";
    process.env.IRIS_CDN_SIGNING_JWK = JSON.stringify(privJwk);
    resetSignerForTest();

    const releaseDir = mkdtempSync(pjoin(tmpdir(), "iris-init-load-"));
    const objects = new Map<string, Uint8Array>();
    const store = {
      has: async (d: string) => objects.has(d),
      put: async (d: string, bytes: Uint8Array) => { objects.set(d, bytes); },
      get: async (d: string) => {
        const b = objects.get(d);
        if (!b) throw new Error(`missing ${d}`);
        return b;
      },
    };

    const commUuid = "e1b206b7-fd4c-4b93-972a-be07850a1cdd";
    const collUuid = "a3d14b58-af81-489e-93be-c3b9e5325fc9";
    const item1Uuid = "6e96b393-5419-4127-9818-a0ecdc174b70";
    const item2Uuid = "d0b4c4be-0cb6-4f16-ba71-28deb47d4986";
    const bs1Uuid = "f9f3d78c-ca9d-42a3-ad0f-313a6f4f416b";
    const bs2Uuid = "c5af585f-732e-4514-b88e-a02721b07c41";
    const pdf1Bytes = new TextEncoder().encode("%PDF-1.4 item 1");
    const pdf2Bytes = new TextEncoder().encode("%PDF-1.4 item 2");
    const md5Hex = (b: Uint8Array) => createHash("md5").update(b).digest("hex");

    const itemPages = [
      [{ uuid: item1Uuid, handle: "10665/387974", lastModified: "2026-10-30T10:00:00+00:00", withdrawn: false, metadata: { "dc.title": [{ value: "First report" }] } }],
      [{ uuid: item2Uuid, handle: "10665/387973", lastModified: "2026-10-31T02:23:11.326+00:00", withdrawn: false, metadata: { "dc.title": [{ value: "Second report" }] } }],
    ];

    const fetcher: Fetcher = async (url) => {
      const u = new URL(url);
      if (u.pathname.endsWith("/core/communities")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            _embedded: { communities: [{ uuid: commUuid, handle: "10665/1637", name: "Western Pacific" }] },
            page: { number: 0, totalPages: 1 },
          }),
        };
      }
      if (u.pathname.endsWith("/core/collections")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            _embedded: {
              collections: [{
                uuid: collUuid,
                handle: "10665/382262",
                name: "WPRO Technical Documents",
                _embedded: { parentCommunity: { uuid: commUuid, handle: "10665/1637", name: "Western Pacific" } },
              }],
            },
            page: { number: 0, totalPages: 1 },
          }),
        };
      }
      if (u.pathname.endsWith("/discover/search/objects")) {
        const page = Number(u.searchParams.get("page") ?? "0");
        const slice = itemPages[page] ?? [];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            _embedded: {
              searchResult: {
                _embedded: { objects: slice.map((it) => ({ _embedded: { indexableObject: { type: "item", ...it } } })) },
                page: { number: page, totalPages: 2, totalElements: 2, size: 1 },
              },
            },
          }),
        };
      }
      if (u.pathname.includes(`/core/items/${item1Uuid}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: item1Uuid,
            handle: "10665/387974",
            lastModified: "2026-10-30T10:00:00+00:00",
            withdrawn: false,
            metadata: {
              "dc.title": [{ value: "First report", language: "en" }],
              "dc.contributor.author": [{ value: "WHO WPRO", language: "en" }],
              "dc.date.issued": [{ value: "2025-10-20" }],
            },
            _embedded: {
              owningCollection: { uuid: collUuid, handle: "10665/382262", name: "WPRO Technical Documents" },
              bundles: {
                _embedded: {
                  bundles: [{
                    uuid: "658ec5ed-261d-498c-9594-21b03c5c29aa",
                    name: "ORIGINAL",
                    _embedded: {
                      bitstreams: {
                        _embedded: {
                          bitstreams: [{ uuid: bs1Uuid, name: "report1.pdf", sizeBytes: pdf1Bytes.byteLength, checkSum: { checkSumAlgorithm: "MD5", value: md5Hex(pdf1Bytes) } }],
                        },
                        page: { number: 0, totalPages: 1 },
                      },
                    },
                  }],
                },
              },
            },
          }),
        };
      }
      if (u.pathname.includes(`/core/items/${item2Uuid}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            uuid: item2Uuid,
            handle: "10665/387973",
            lastModified: "2026-10-31T02:23:11.326+00:00",
            withdrawn: false,
            metadata: {
              "dc.title": [{ value: "Second report", language: "en" }],
              "dc.contributor.author": [{ value: "WHO WPRO", language: "en" }],
              "dc.date.issued": [{ value: "2025-10-25" }],
            },
            _embedded: {
              owningCollection: { uuid: collUuid, handle: "10665/382262", name: "WPRO Technical Documents" },
              bundles: {
                _embedded: {
                  bundles: [{
                    uuid: "658ec5ed-261d-498c-9594-21b03c5c29aa",
                    name: "ORIGINAL",
                    _embedded: {
                      bitstreams: {
                        _embedded: {
                          bitstreams: [{ uuid: bs2Uuid, name: "report2.pdf", sizeBytes: pdf2Bytes.byteLength, checkSum: { checkSumAlgorithm: "MD5", value: md5Hex(pdf2Bytes) } }],
                        },
                        page: { number: 0, totalPages: 1 },
                      },
                    },
                  }],
                },
              },
            },
          }),
        };
      }
      throw new Error(`unexpected URL: ${url}`);
    };

    const binaryFetcher = async (url: string) => {
      const bytes = url.includes(bs1Uuid) ? pdf1Bytes : pdf2Bytes;
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/pdf" },
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      };
    };

    try {
      const budget = parseBudget({
        totalItemsUpstream: 2,
        totalFilesUpstream: 2,
        totalBytesUpstream: pdf1Bytes.byteLength + pdf2Bytes.byteLength,
        maxRequestsPerSecond: 5000,
        maxBatchesPerRun: 1,
        pageSize: 1,
      });

      // Run 1: executes batch 0 only, writes checkpoint, leaves cursor.json absent until all batches complete
      const r1 = await runInitialLoad({ release: releaseDir, budget, fetcher, binaryFetcher, store, api: "https://x/api" });
      expect(r1.batchesCompleted).toBe(1);
      expect(r1.batchesRemaining).toBe(1);
      expect(existsSync(pjoin(releaseDir, "state", "initial-load.json"))).toBe(true);
      expect(existsSync(pjoin(releaseDir, "state", "cursor.json"))).toBe(false);

      // Run 2: resumes from state/initial-load.json, skips batch 0, runs batch 1, writes state/cursor.json and graph/*
      const r2 = await runInitialLoad({ release: releaseDir, budget, fetcher, binaryFetcher, store, api: "https://x/api" });
      expect(r2.batchesCompleted).toBe(1);
      expect(r2.batchesRemaining).toBe(0);
      expect(existsSync(pjoin(releaseDir, "state", "cursor.json"))).toBe(true);
      expect(JSON.parse(readFile(pjoin(releaseDir, "state", "cursor.json"), "utf-8")).cursor).toBe("2026-10-31T02:23:11.326+00:00");

      const manifestPaths = [...parsePayloadManifest(readFile(pjoin(releaseDir, "manifest-sha256.txt"), "utf-8")).keys()];
      expect(manifestPaths).toContain("records/10665/387974.json");
      expect(manifestPaths).toContain("records/10665/387973.json");
      expect(manifestPaths).toContain("graph/who-iris-spine.nq.gz");
      expect(manifestPaths).toContain("graph/subgraph-manifest.json");
    } finally {
      rmSync(releaseDir, { recursive: true, force: true });
    }
  });
});

describe("Task_Revert: automatic revert when post-publish verification fails (#104)", () => {
  test("revertRestoresPreviousRelease", async () => {
    const { checkRelease, revertRelease } = await import("../iris-cdn/run.ts");
    const { execFileSync } = await import("node:child_process");
    const { mkdirSync, rmSync, writeFileSync } = await import("node:fs");

    const repo = mkdtempSync(pjoin(tmpdir(), "iris-revert-"));
    const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
    try {
      git("init", "-q");
      git("config", "user.name", "test");
      git("config", "user.email", "test@example.org");

      // Commit 1: valid release tag files + cursor.json
      const tags1 = tagFiles([e("records/10665/1.json", "one")]);
      for (const [k, v] of Object.entries(tags1)) writeFileSync(pjoin(repo, k), v);
      writeFileSync(pjoin(repo, "tagmanifest-sha256.txt.jws"), "header..sig1\n");
      mkdirSync(pjoin(repo, "state"), { recursive: true });
      writeFileSync(pjoin(repo, "state", "cursor.json"), '{"cursor":"2026-10-30T00:00:00Z"}\n');
      git("add", "-A");
      git("commit", "-q", "-m", "Release 1");

      // Commit 2: corrupted release whose tag file does not match tagmanifest-sha256.txt
      const tags2 = tagFiles([e("records/10665/1.json", "one"), e("records/10665/2.json", "two")]);
      for (const [k, v] of Object.entries(tags2)) writeFileSync(pjoin(repo, k), v);
      writeFileSync(pjoin(repo, "manifest-sha256.txt"), "corrupted-manifest\n");
      writeFileSync(pjoin(repo, "tagmanifest-sha256.txt.jws"), "header..sig2\n");
      writeFileSync(pjoin(repo, "state", "cursor.json"), '{"cursor":"2026-10-31T00:00:00Z"}\n');
      git("add", "-A");
      git("commit", "-q", "-m", "Release 2 (broken)");

      const failedCheck = await checkRelease(repo);
      expect(failedCheck.state).toBe("failed");

      const rev = revertRelease(repo);
      expect(rev.revertedCommit).not.toBe(rev.headCommit);

      // Working tree is restored to Release 1, including state/cursor.json
      expect(readFile(pjoin(repo, "manifest-sha256.txt"), "utf-8")).toBe(tags1["manifest-sha256.txt"]);
      expect(readFile(pjoin(repo, "tagmanifest-sha256.txt.jws"), "utf-8")).toBe("header..sig1\n");
      expect(JSON.parse(readFile(pjoin(repo, "state", "cursor.json"), "utf-8")).cursor).toBe("2026-10-30T00:00:00Z");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

const SUBSET_API = "https://iris.example/server/api";
const SUBSET_UUID = "11111111-2222-4333-8444-555555555555";
const SUBSET_HELD = "99999999-2222-4333-8444-555555555555";

const subsetItem: ItemResource = {
  uuid: SUBSET_UUID,
  handle: "10665/360869",
  name: "Guidelines on long-acting injectable cabotegravir for HIV prevention",
  withdrawn: false,
  inArchive: true,
  discoverable: true,
  metadata: {
    "dc.title": [{ value: "Guidelines on long-acting injectable cabotegravir for HIV prevention", language: "en" }],
    "dc.subject.mesh": [{ value: "HIV Infections", language: "en" }, { value: "Pre-Exposure Prophylaxis", language: "en" }],
    "dc.identifier.uri": [{ value: "https://iris.who.int/handle/10665/360869" }],
  },
  _embedded: {
    owningCollection: { uuid: "c0c0c0c0-2222-4333-8444-555555555555", name: "Publications" },
    bundles: {
      _embedded: {
        bundles: [
          { name: "ORIGINAL", _embedded: { bitstreams: { _embedded: { bitstreams: [{ uuid: "b1b1b1b1-2222-4333-8444-555555555555", name: "9789240054097-eng.pdf", sizeBytes: 1234, checkSum: { checkSumAlgorithm: "MD5", value: "0123456789abcdef0123456789abcdef" } }] } } } },
          { name: "TEXT", _embedded: { bitstreams: { _embedded: { bitstreams: [{ uuid: "b2b2b2b2-2222-4333-8444-555555555555", name: "9789240054097-eng.pdf.txt", sizeBytes: 99, checkSum: { checkSumAlgorithm: "MD5", value: "f".repeat(32) } }] } } } },
        ],
      },
    },
  },
};

/** A fetcher over fixtures; counts requests and refuses anything that is not GET-able JSON here. */
function subsetFetcherFixture(routes: Record<string, unknown>, redirects: Record<string, string> = {}): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    for (const [prefix, loc] of Object.entries(redirects)) if (url.startsWith(prefix)) return { ok: false, status: 302, headers: { get: (n: string) => (n === "location" ? loc : null) }, json: async () => ({}) };
    for (const [prefix, body] of Object.entries(routes)) if (url.startsWith(prefix)) return { ok: true, status: 200, json: async () => body };
    return { ok: false, status: 404, json: async () => ({}) };
  }) as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

function subsetInstance(): string {
  const root = mkdtempSync(pjoin(tmpdir(), "iris-subset-"));
  mkdirS(pjoin(root, "catalogue", "nodes"), { recursive: true });
  writeFileS(
    pjoin(root, "catalogue", "nodes", "item-held.json"),
    JSON.stringify({ $schema: "folio-catalogue-node/v1", id: `item/${SUBSET_HELD}`, kind: "item", title: "Held by hand", handle: "10665/375230", materialization: { state: "referenced", provenance: { upstream: "x" } } }),
  );
  return root;
}

describe("IRIS subset — catalogue by reference", () => {
  test("handlesFileParses", () => {
    expect(parseHandles("# comment\n10665/1 cited by A  # title\n\n10665/1 again\n10665/2\n")).toEqual([
      { handle: "10665/1", reason: "cited by A" },
      { handle: "10665/2", reason: "listed" },
    ]);
    expect(() => parseHandles("not-a-handle\n")).toThrow(/not a Handle/);
    expect(keyOfHandle("10665/360869")).toBe("10665-360869");
  });

  test("sampleIsSeededAndDistinct", () => {
    const a = sampleIndices(17248, 100, 207);
    expect(a).toEqual(sampleIndices(17248, 100, 207));
    expect(new Set(a).size).toBe(100);
    expect(a.every((i) => i >= 0 && i < 17248)).toBe(true);
    expect(sampleIndices(3, 10, 1)).toEqual([0, 1, 2]);
  });

  test("nodeIsReferencedWithPdfLinkAndNoBytes", () => {
    const n = nodeOf(subsetItem, [{ uuid: "b1b1b1b1-2222-4333-8444-555555555555", name: "9789240054097-eng.pdf", bundle: "ORIGINAL", sizeBytes: 1234, checkSum: { checkSumAlgorithm: "MD5", value: "0123456789abcdef0123456789abcdef" } }], ["cited by the HIV DAK"], "10665-360869");
    expect(n.materialization.state).toBe("referenced");
    expect(n.handle).toBe("10665/360869");
    expect(n.parents).toEqual([]);
    expect(n.libraryId).toBeUndefined();
    expect(n.metadataRef).toBe("catalogue/records/10665-360869.dc.json");
    expect(n.bitstreams).toHaveLength(1);
    expect(n.bitstreams[0]!.materialization.provenance).toEqual({ upstream: "https://iris.who.int/bitstreams/b1b1b1b1-2222-4333-8444-555555555555/download" });
    expect(n.bitstreams[0]!.materialization.fixity).toBeUndefined();
    expect(n.materialization.note).toStartWith(OWN_NOTE_PREFIX);
    expect(n.materialization.note).toContain("cited by the HIV DAK");
  });

  test("writesRecordAndNodeSkipsHeldAndDoesNotChurn", async () => {
    const root = subsetInstance();
    const f = subsetFetcherFixture({ [`${SUBSET_API}/core/items/${SUBSET_UUID}`]: subsetItem }, { [`${SUBSET_API}/pid/find?id=${encodeURIComponent("hdl:10665/360869")}`]: `${SUBSET_API}/core/items/${SUBSET_UUID}` });
    const picks = [
      { handle: "10665/360869", reason: "cited by the HIV DAK" },
      { handle: "10665/375230", reason: "cited by the HIV DAK" },
      { handle: "10665/1", reason: "unknown" },
    ];
    const r = await catalogueSubset(f, root, picks, { api: SUBSET_API, now: new Date("2026-11-10T18:00:00Z") });
    expect(r.written).toEqual(["10665/360869"]);
    expect(r.skippedHeld).toEqual(["10665/375230"]);
    expect(r.unresolved).toEqual(["10665/1"]);
    const rec = JSON.parse(readFile(pjoin(root, "catalogue", "records", "10665-360869.dc.json"), "utf-8"));
    expect(rec.$schema).toBe("folio-dublin-core/v1");
    expect(rec.fields.find((x: { element: string; qualifier?: string }) => x.element === "subject" && x.qualifier === "mesh").values).toHaveLength(2);
    expect(f.calls.some((u) => u.includes("/content"))).toBe(false);

    // Re-run a day later with nothing changed upstream: nothing is rewritten.
    const before = readdirS(pjoin(root, "catalogue", "records")).map((x) => readFile(pjoin(root, "catalogue", "records", x), "utf-8"));
    const again = await catalogueSubset(f, root, picks.slice(0, 1), { api: SUBSET_API, now: new Date("2026-11-11T18:00:00Z") });
    expect(again.written).toEqual([]);
    expect(again.unchanged).toEqual(["10665/360869"]);
    expect(readdirS(pjoin(root, "catalogue", "records")).map((x) => readFile(pjoin(root, "catalogue", "records", x), "utf-8"))).toEqual(before);
  });

  test("refusesWithdrawnItems", async () => {
    const root = subsetInstance();
    const f = subsetFetcherFixture({ [`${SUBSET_API}/core/items/${SUBSET_UUID}`]: { ...subsetItem, withdrawn: true } });
    const r = await catalogueSubset(f, root, [{ uuid: SUBSET_UUID, reason: "q" }], { api: SUBSET_API });
    expect(r.written).toEqual([]);
    expect(r.refused[0]).toContain("withdrawn");
  });

  test("querySampleUsesOneRowPages", async () => {
    const page = (uuid: string) => ({ _embedded: { searchResult: { page: { totalElements: 5 }, _embedded: { objects: [{ _embedded: { indexableObject: { uuid, metadata: {} } } }] } } } });
    const f = subsetFetcherFixture({ [`${SUBSET_API}/discover/search/objects`]: page(SUBSET_UUID) });
    const picks = await queryPicks(f, "dc.title:HIV", { sample: 2, seed: 7, api: SUBSET_API });
    expect(picks).toHaveLength(2);
    expect(picks[0]!.reason).toContain("5 matches");
    expect(f.calls.every((u) => u.includes("query=dc.title%3AHIV"))).toBe(true);
  });
});

describe("display titles: the Excel escape `_x000D_` some IRIS records carry", () => {
  test("decodes `_xHHHH_` and folds a line break, with its spaces, into one space", () => {
    expect(displayTitle("YELLOW-FEVER VACCINATING CENTRES_x000D_FOR INTERNATIONAL TRAVEL")).toBe("YELLOW-FEVER VACCINATING CENTRES FOR INTERNATIONAL TRAVEL");
    expect(displayTitle("CENTRES _x000D_FOR")).toBe("CENTRES FOR");
    expect(displayTitle("EXIGÉS_x000D_ PAR LES DIVERS PAYS")).toBe("EXIGÉS PAR LES DIVERS PAYS");
    expect(displayTitle("A_x000D__x000A_B")).toBe("A B");
    expect(displayTitle("A\r\nB")).toBe("A B");
    expect(displayTitle("caf_x00E9_")).toBe("café");
    expect(displayTitle("Plain title")).toBe("Plain title");
  });
});
