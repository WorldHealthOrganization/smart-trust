/**
 * The subgraph index package (bean `mo75` G2b): one pin's index files, packed
 * and fetched back — against fixture packages served over `file://`, so the
 * real download (curl), verification and unpacking run with no network.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BinaryReleaseSchema } from "../../schemas/sdlc/binary-release.ts";
import { SubgraphIndexManifestSchema, subgraphIndexPackage } from "../../schemas/kg/subgraph-manifest.ts";
import { createServer } from "node:net";
import { download, downloadArgs, DOWNLOAD_LIMITS, fetchPackage } from "../mount-from-lock.ts";
import { fetchSubgraphIndex, packSubgraphIndex, type PackageUrlFor } from "../subgraph-index-package.ts";

const PIN = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "89abcdef0123456789abcdef0123456789abcdef";
const BASE = "https://example.org";

let base: string;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "subgraph-index-package-test-"));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
function write(root: string, files: Record<string, string | object>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }
}

/** A layer `h` that has BUILT its subgraph files, as `subgraph:jsonld` leaves them. */
function builtInstance(extra: Record<string, string | object> = {}): string {
  const root = join(base, `inst-${++n}`);
  write(root, {
    "h.json": { name: "h", directories: [{ id: "tools", path: "tools/", graphTypologies: ["tools"] }, { id: "docs", path: "docs/", graphTypologies: ["docs"] }] },
    "docs/subgraph/h/index.jsonld": { "@context": `${BASE}/ns/subgraph/v1.jsonld`, "@id": `${BASE}/subgraph/h/` },
    "docs/subgraph/h/tools/index.jsonld": { "@context": `${BASE}/ns/subgraph/v1.jsonld`, "@id": `${BASE}/subgraph/h/tools/` },
    "docs/subgraph/h/tools/index.hydrated.jsonld": { "@context": `${BASE}/ns/subgraph/v1.jsonld`, "@id": `${BASE}/subgraph/h/tools/` },
    "docs/subgraph/other/x/index.hydrated.jsonld": "{}",
    "docs/readme.md": "# not packed\n",
    ...extra,
  });
  return root;
}

/** Serve one release's assets: the canonical URL's file name, under `dir`. */
const serve = (dir: string): PackageUrlFor => (url) => `file://${join(dir, url.split("/").pop()!)}`;

describe("pack", () => {
  test("P1. packs only <docs>/subgraph/<harness>/ index files, at their published paths, with a manifest and a release record", () => {
    const out = join(base, `out-${++n}`);
    const r = packSubgraphIndex({ root: builtInstance(), repository: "o/r", ref: PIN, outDir: out, builtIn: { repository: "o/index", ref: "main" } });
    const pkg = subgraphIndexPackage("o/r", PIN, "h");
    expect(r.tarball).toBe(join(out, pkg.tarball));
    expect(r.manifest.files.map((f) => [f.path, f.subgraph, f.file])).toEqual([
      ["docs/subgraph/h/index.jsonld", "", "index.jsonld"],
      ["docs/subgraph/h/tools/index.hydrated.jsonld", "tools", "index.hydrated.jsonld"],
      ["docs/subgraph/h/tools/index.jsonld", "tools", "index.jsonld"],
    ]);
    const record = BinaryReleaseSchema.parse(JSON.parse(readFileSync(r.release, "utf-8")));
    expect(record.release.tag).toBe(pkg.tag);
    expect(record.release.url).toBe(`https://github.com/o/r/releases/tag/${pkg.tag}`);
    expect(record.assets[0]).toMatchObject({ name: pkg.tarball, fetchedFrom: pkg.tarballUrl, bytes: r.bytes, digest: { digest: r.sha256 } });
    expect(createHash("sha256").update(readFileSync(r.tarball)).digest("hex")).toBe(r.sha256);

    const x = join(base, `x-${++n}`);
    mkdirSync(x);
    expect(spawnSync("tar", ["-xzf", r.tarball, "-C", x]).status).toBe(0);
    expect(existsSync(join(x, "package/docs/subgraph/h/tools/index.hydrated.jsonld"))).toBe(true);
    expect(existsSync(join(x, "package/docs/subgraph/other"))).toBe(false);
    expect(existsSync(join(x, "package/docs/readme.md"))).toBe(false);
    expect(SubgraphIndexManifestSchema.parse(JSON.parse(readFileSync(join(x, "package/subgraph-index.json"), "utf-8"))).builtIn).toEqual({ repository: "o/index", ref: "main" });
  });

  test("P2. nothing built is a refusal, never an empty package; a branch is not a pin", () => {
    const bare = join(base, `bare-${++n}`);
    write(bare, { "h.json": { name: "h", directories: [{ id: "docs", path: "docs/", graphTypologies: ["docs"] }] } });
    expect(() => packSubgraphIndex({ root: bare, repository: "o/r", ref: PIN, outDir: join(base, `o-${n}`) })).toThrow(/subgraph:jsonld/);
    const nodocs = join(base, `nodocs-${++n}`);
    write(nodocs, { "h.json": { name: "h", directories: [] } });
    expect(() => packSubgraphIndex({ root: nodocs, repository: "o/r", ref: PIN, outDir: join(base, `o-${n}`) })).toThrow(/docs/);
    expect(() => packSubgraphIndex({ root: builtInstance(), repository: "o/r", ref: "main", outDir: join(base, `o-${n}`) })).toThrow(/pin/);
  });
});

describe("fetch", () => {
  let out: string;
  beforeAll(() => {
    out = join(base, "published");
    packSubgraphIndex({ root: builtInstance(), repository: "o/r", ref: PIN, outDir: out });
  });

  test("F1. fetches, verifies and unpacks the pin's package; maps each hydrated file by subgraph", () => {
    const f = fetchSubgraphIndex({ repository: "o/r", ref: PIN, harness: "h", urlFor: serve(out) });
    if (f.state !== "ok") throw new Error(f.detail);
    try {
      expect([...f.hydrated.keys()]).toEqual(["tools"]);
      expect(JSON.parse(readFileSync(join(f.root, f.hydrated.get("tools")!.path), "utf-8"))["@id"]).toBe(`${BASE}/subgraph/h/tools/`);
      expect(f.sha256).toBe(createHash("sha256").update(readFileSync(join(out, f.pkg.tarball))).digest("hex"));
    } finally {
      f.close();
    }
    expect(existsSync(f.root)).toBe(false);
  });

  test("F2. no release for the pin is `absent` — not a failure, and not a package", () => {
    const f = fetchSubgraphIndex({ repository: "o/r", ref: OTHER, harness: "h", urlFor: serve(out) });
    expect(f.state).toBe("absent");
  });

  test("F3. a tarball that does not match its record is refused", () => {
    const bad = join(base, `tampered-${++n}`);
    packSubgraphIndex({ root: builtInstance(), repository: "o/r", ref: PIN, outDir: bad });
    const pkg = subgraphIndexPackage("o/r", PIN, "h");
    writeFileSync(join(bad, pkg.tarball), Buffer.concat([readFileSync(join(bad, pkg.tarball)), Buffer.from("x")]));
    const f = fetchSubgraphIndex({ repository: "o/r", ref: PIN, harness: "h", urlFor: serve(bad) });
    expect(f.state).toBe("refused");
  });

  test("F4. a package built for another pin is refused, even served under this pin's name", () => {
    const other = join(base, `other-${++n}`);
    const r = packSubgraphIndex({ root: builtInstance(), repository: "o/r", ref: OTHER, outDir: other });
    const want = subgraphIndexPackage("o/r", PIN, "h");
    // Serve the OTHER pin's bytes under this pin's names, record rewritten to match.
    const record = JSON.parse(readFileSync(r.release, "utf-8"));
    record.assets[0].name = want.tarball;
    writeFileSync(join(other, want.record), JSON.stringify(record));
    writeFileSync(join(other, want.tarball), readFileSync(r.tarball));
    const f = fetchSubgraphIndex({ repository: "o/r", ref: PIN, harness: "h", urlFor: serve(other) });
    expect(f.state).toBe("refused");
    if (f.state !== "ok") expect(f.detail).toContain("not this pin's");
  });

  test("F5. the replay's fetch refuses bytes that are not the lock's", () => {
    const pkg = subgraphIndexPackage("o/r", PIN, "h");
    const url = `file://${join(out, pkg.tarball)}`;
    const sha = createHash("sha256").update(readFileSync(join(out, pkg.tarball))).digest("hex");
    const ok = fetchPackage(url, sha);
    if (!ok.ok) throw new Error(ok.error);
    expect(existsSync(join(ok.root, "subgraph-index.json"))).toBe(true);
    rmSync(ok.dir, { recursive: true, force: true });
    const bad = fetchPackage(url, "0".repeat(64));
    expect(bad).toMatchObject({ ok: false, refused: true });
    expect(fetchPackage(`file://${join(out, "nope.tgz")}`, sha)).toMatchObject({ ok: false, absent: true });
  });
});

describe("download limits (cat-harness-tools#1712)", () => {
  test("D1. every download carries a connect timeout, a stall limit and a hard limit", () => {
    const args = downloadArgs("https://example.org/x", join(base, "x"));
    expect(args).toEqual(expect.arrayContaining(["--connect-timeout", String(DOWNLOAD_LIMITS.connectS), "--speed-time", String(DOWNLOAD_LIMITS.stallS), "--max-time", String(DOWNLOAD_LIMITS.maxS)]));
  });

  test("D2. a server that accepts and never answers is a failed fetch within the limit — never a hang, never an absence", async () => {
    // The kernel completes the handshake once the socket listens, so curl's
    // request is sent and nothing ever comes back.
    const server = createServer(() => {});
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as { port: number };
    try {
      // input-site: inert #23cfbd9b — a duration bound on the download, not a value the answer depends on
      const started = Date.now();
      const r = download(`http://127.0.0.1:${port}/never`, join(base, "silent", "x"), { connectS: 2, stallS: 1, minBytesPerS: 1, maxS: 1 });
      expect(r).toMatchObject({ ok: false, absent: false });
      if (!r.ok) expect(r.error).toContain("timed out");
      // three attempts (--retry 2) of at most 1 s each, plus curl's back-off
      // input-site: inert #6507a3f4 — a duration bound on the download, not a value the answer depends on
      expect(Date.now() - started).toBeLessThan(15_000);
    } finally {
      server.close();
    }
  }, 20_000);
});
