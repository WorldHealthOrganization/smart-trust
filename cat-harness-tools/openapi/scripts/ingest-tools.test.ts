/**
 * The two ingest tools (bean `folio-assistant-7jkp`, owner ruling 2026-10-10):
 * `openapi-ingest-source` reads a repository at a ref; `openapi-ingest-rendered`
 * reads a published spec URL. Both land in the same `openapi` directory, and
 * `ingest-openapi.ts --check` verifies either kind offline.
 *
 * Driven against a copy of smart-trust's real declaration, so the directory a
 * document lands in is resolved the way every layer resolves it.
 *
 * @module cat-harness-tools/openapi/scripts/ingest-tools.test
 */
import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { checkCommitted, ingestFromSource } from "./ingest-openapi.ts";
import { ingestRendered, type Fetcher } from "./ingest-openapi-rendered.ts";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";

const ROOT = dirname(HARNESS_ROOT);
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const SPEC = (title: string) =>
  JSON.stringify({ openapi: "3.0.3", info: { title, version: "1.0.0" }, paths: { "/ping": { get: { operationId: "ping", responses: {} } } } }, null, 2);

/** A layer carrying smart-trust's declaration, an empty openapi directory, and `config`. */
function instance(config: Record<string, unknown>): { inst: string; dir: string } {
  const base = mkdtempSync(join(tmpdir(), "openapi-ingest-"));
  dirs.push(base);
  const inst = join(base, "smart-trust");
  mkdirSync(join(inst, "openapi"), { recursive: true });
  cpSync(join(ROOT, "smart-trust", "smart-trust.json"), join(inst, "smart-trust.json"));
  writeFileSync(join(inst, "cat-openapi.config.json"), JSON.stringify({ $schema: "cat-openapi-config/v1", directory: "smart-trust-openapi", ...config }));
  return { inst, dir: join(inst, "openapi") };
}

const URL_ = "https://example.org/gateway/openapi.json";
const serving =
  (body: string): Fetcher =>
  async () => ({ ok: true, bytes: Buffer.from(body) });

describe("openapi-ingest-rendered", () => {
  it("writes the document verbatim with url + fetchedAt, and --check accepts it", async () => {
    const { inst, dir } = instance({ rendered: [{ id: "published", rendered: { url: URL_ } }] });
    const out = await ingestRendered(inst, { fetcher: serving(SPEC("Gateway")), now: () => new Date("2026-10-11T06:00:00Z") });
    expect(out.map((o) => o.state)).toEqual(["ingested"]);
    expect(readFileSync(join(dir, "published.openapi.json"), "utf8")).toBe(SPEC("Gateway"));
    const prov = JSON.parse(readFileSync(join(dir, "published.source.json"), "utf8"));
    expect(prov.source).toEqual({ url: URL_, fetchedAt: "2026-10-11T06:00:00.000Z" });
    expect(prov.operations).toBe(1);
    expect(checkCommitted(inst)).toEqual([]);
  });

  it("an unreachable URL is FAILED and writes nothing", async () => {
    const { inst, dir } = instance({ rendered: [{ id: "published", rendered: { url: URL_ } }] });
    const out = await ingestRendered(inst, { fetcher: async () => ({ ok: false, reason: "HTTP 404" }) });
    expect(out).toEqual([{ id: "published", state: "failed", reason: `${URL_}: HTTP 404` }]);
    expect(existsSync(join(dir, "published.openapi.json"))).toBe(false);
  });

  it("bytes that are not OpenAPI 3 are FAILED and never replace a held copy", async () => {
    const { inst, dir } = instance({ rendered: [{ id: "published", rendered: { url: URL_ } }] });
    await ingestRendered(inst, { fetcher: serving(SPEC("Gateway")) });
    const out = await ingestRendered(inst, { fetcher: serving("<html>a docs page, not a spec</html>") });
    expect(out[0]!.state).toBe("failed");
    expect(readFileSync(join(dir, "published.openapi.json"), "utf8")).toBe(SPEC("Gateway"));
  });

  it("--check catches a hand edit to a rendered document", async () => {
    const { inst, dir } = instance({ rendered: [{ id: "published", rendered: { url: URL_ } }] });
    await ingestRendered(inst, { fetcher: serving(SPEC("Gateway")) });
    writeFileSync(join(dir, "published.openapi.json"), SPEC("Edited"));
    expect(checkCommitted(inst).join("\n")).toMatch(/published: the committed document does not match its provenance/);
  });
});

describe("openapi-ingest-source with --ref", () => {
  it("reads the document AT the ref, not the checkout's working tree, and records that commit", () => {
    const repo = mkdtempSync(join(tmpdir(), "openapi-src-"));
    dirs.push(repo);
    const git = (...a: string[]) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();
    git("init", "-q");
    git("config", "user.email", "t@example.org");
    git("config", "user.name", "t");
    writeFileSync(join(repo, "openapi.json"), SPEC("Old"));
    git("add", ".");
    git("commit", "-qm", "old");
    const oldCommit = git("rev-parse", "HEAD");
    writeFileSync(join(repo, "openapi.json"), SPEC("New"));
    git("commit", "-qam", "new");

    const { inst, dir } = instance({ documents: [{ id: "gateway", source: { repository: "o/r", path: "openapi.json", ref: "main" } }] });
    const [prov] = ingestFromSource(inst, repo, { ref: oldCommit });
    expect(prov!.source.commit).toBe(oldCommit);
    expect(prov!.title).toBe("Old");
    expect(readFileSync(join(dir, "gateway.openapi.json"), "utf8")).toBe(SPEC("Old"));
    expect(checkCommitted(inst)).toEqual([]);

    // Without --ref it is the checkout's HEAD, as before.
    expect(ingestFromSource(inst, repo)[0]!.title).toBe("New");
  });
});
