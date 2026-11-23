/**
 * `kg:subscribe` (issue #1719, epic bean `fnx4`, slice 4): judge a substrate
 * from its root declaration at a pin, and record the subscription. Every test
 * runs against fixtures through the injectable fetcher — no network.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { BOOTSTRAP_GRAPH_TYPOLOGIES } from "@litlfred/bootstrap-tools/schemas/graph.ts";
import { CatHarnessDeclarationSchema } from "../../../schemas/kg/cat-harness.ts";
import { SubstrateSnapshotSchema } from "../../../schemas/kg/substrate-snapshot.ts";
import {
  HARNESS_GRAPH_TYPOLOGIES,
  type RootFetcher,
  checkSubscriptions,
  gitDeclarationFetcher,
  judgeSubstrate,
  parseTarget,
  setTopLevelKey,
  subscribe,
} from "../../kg-subscribe.ts";
import { git } from "../../sync-remote-skills.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SHA2 = "89abcdef0123456789abcdef0123456789abcdef";
const TARGET = `litlfred/ihris-kb@${SHA}`;

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

const SUBSTRATE = {
  name: "ihris-kb",
  title: "iHRIS Knowledge Base",
  version: "1.2.0",
  directories: [
    { id: "kb", path: "kb/", graphTypologies: ["folio"] },
    { id: "kb-skills", path: "skills/", graphTypologies: ["skills"] },
  ],
  stickies: [{ id: "an-extension-bootstrap-ignores" }],
};

/** A fetcher that serves `files` as the substrate's root, and counts its calls. */
function fixture(files: Record<string, unknown>): RootFetcher & { calls: number } {
  const serve = (): string => {
    f.calls++;
    const d = mkdtempSync(join(tmpdir(), "kg-sub-root-"));
    for (const [n, v] of Object.entries(files)) {
      mkdirSync(dirname(join(d, n)), { recursive: true });
      writeFileSync(join(d, n), typeof v === "string" ? v : `${JSON.stringify(v, null, 2)}\n`);
    }
    return d;
  };
  const f: RootFetcher & { calls: number } = Object.assign(serve, { calls: 0 });
  return f;
}
const failing: RootFetcher = () => {
  throw new Error("fatal: unable to access 'https://github.com/litlfred/ihris-kb.git/': 403");
};

/** A subscriber layer with a `substrate-snapshot` directory, formatted the way this repo's are. */
function subscriber(opts: { snapshotDir?: boolean; extra?: string } = {}): { dir: string; file: string } {
  const dir = tmp("kg-sub-inst-");
  const file = join(dir, "example.json");
  const dirs = opts.snapshotDir === false ? "[]" : `[
    {
      "id": "subscriptions",
      "path": "subscriptions/",
      "dependents": "skip",
      "graphTypologies": ["substrate-snapshot"]
    }
  ]`;
  writeFileSync(
    file,
    `{
  "name": "example",
  "livesAt": { "repository": "litlfred/example", "path": "." },
  "directories": ${dirs}${opts.extra ?? ""}
}
`,
  );
  return { dir, file };
}

describe("the harness rule is bootstrap's", () => {
  test("each harness kind is one bootstrap defines as holding Skills, Roles or Processes", () => {
    const sentences = HARNESS_GRAPH_TYPOLOGIES.map((k) => BOOTSTRAP_GRAPH_TYPOLOGIES[k as keyof typeof BOOTSTRAP_GRAPH_TYPOLOGIES]);
    expect(sentences.every((s) => typeof s === "string")).toBe(true);
    expect(sentences.join(" ")).toMatch(/Skills/);
    expect(sentences.join(" ")).toMatch(/Roles/);
    expect(sentences.join(" ")).toMatch(/Processes/);
  });
});

describe("parseTarget: pinned, or refused before any fetch", () => {
  test("a full SHA parses", () => {
    expect(parseTarget(TARGET)).toEqual({ ok: true, repository: "litlfred/ihris-kb", ref: SHA });
  });
  test.each(["litlfred/ihris-kb@main", `litlfred/ihris-kb@${SHA.slice(0, 12)}`, "litlfred/ihris-kb", "ihris@" + SHA])(
    "%s is refused",
    (t) => expect(parseTarget(t).ok).toBe(false),
  );
  test("an unpinned ref is refused by subscribe, and the fetcher is never called", async () => {
    const { dir, file } = subscriber();
    const before = readFileSync(file, "utf8");
    const f = fixture({ "ihris-kb.json": SUBSTRATE });
    const r = await subscribe({ target: "litlfred/ihris-kb@main", instance: dir, fetch: f });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/not a full commit SHA/);
    expect(f.calls).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

describe("judgeSubstrate: three answers", () => {
  test("a valid substrate names its harness and subgraphs", async () => {
    const v = await judgeSubstrate("litlfred/ihris-kb", SHA, fixture({ "ihris-kb.json": SUBSTRATE, "package.json": { name: "x" } }));
    expect(v.state).toBe("substrate");
    if (v.state !== "substrate") return;
    expect(v.file).toBe("ihris-kb.json");
    expect(v.summary.harnesses).toEqual(["ihris-kb"]);
    expect(v.summary.subgraphs.map((s) => s.id)).toEqual(["kb", "kb-skills"]);
  });

  test("scenarios or processes alone also make a harness", async () => {
    for (const kind of ["scenarios", "processes"]) {
      const d = { name: "p", directories: [{ id: "x", path: "x/", graphTypologies: [kind] }] };
      expect((await judgeSubstrate("o/p", SHA, fixture({ "p.json": d }))).state).toBe("substrate");
    }
  });

  test("not bootstrap-conformant: refused with the failing field", async () => {
    const bad = { ...SUBSTRATE, version: "v1", directories: [{ id: "kb", path: "kb/" }] };
    const v = await judgeSubstrate("litlfred/ihris-kb", SHA, fixture({ "ihris-kb.json": bad }));
    expect(v.state).toBe("not-a-substrate");
    expect("reason" in v && v.reason).toMatch(/bootstrap's declaration schema/);
  });

  test("zero harnesses with Subgraphs: CONTENT, a separate kind and never a substrate (owner, 2026-10-06)", async () => {
    const noHarness = { name: "data", directories: [{ id: "d", path: "d/", graphTypologies: ["folio", "methodology"] }] };
    const v = await judgeSubstrate("o/data", SHA, fixture({ "data.json": noHarness }));
    expect(v.state).toBe("content");
    expect(v.state === "content" && v.summary.harnesses).toEqual([]);
  });

  test("zero harnesses and zero Subgraphs: still refused, and the reason names the kinds and the limit", async () => {
    const v = await judgeSubstrate("o/data", SHA, fixture({ "data.json": { name: "data", directories: [] } }));
    expect(v.state).toBe("not-a-substrate");
    expect(v.state === "not-a-substrate" && v.reason).toMatch(/declares no harness/);
    expect(v.state === "not-a-substrate" && v.reason).toMatch(/nested instances/);
  });

  test("no root declaration: refused, not could-not-determine — the root WAS read", async () => {
    const v = await judgeSubstrate("o/r", SHA, fixture({ "package.json": { name: "not-the-stem" } }));
    expect(v.state).toBe("not-a-substrate");
  });

  test("two root declarations: refused by bootstrap's one-graph-per-directory rule", async () => {
    const v = await judgeSubstrate("o/r", SHA, fixture({ "a.json": { name: "a" }, "b.json": { name: "b" } }));
    expect(v.state).toBe("not-a-substrate");
    expect("reason" in v && v.reason).toMatch(/2 declarations/);
  });

  test("a fetch failure is could-not-determine — never either verdict", async () => {
    const v = await judgeSubstrate("litlfred/ihris-kb", SHA, failing);
    expect(v.state).toBe("could-not-determine");
    expect("reason" in v && v.reason).toMatch(/403/);
  });
});

describe("subscribe: what it writes", () => {
  test("a valid substrate: entry with nothing chosen, and a snapshot with fixity", async () => {
    const { dir, file } = subscriber();
    const r = await subscribe({ target: TARGET, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry).toEqual({ id: "ihris-kb", repository: "litlfred/ihris-kb", ref: SHA });

    const text = readFileSync(file, "utf8");
    // The splice leaves every other line as it was.
    expect(text).toContain(`"livesAt": { "repository": "litlfred/example", "path": "." }`);
    const decl = CatHarnessDeclarationSchema.parse(JSON.parse(text));
    expect(decl.subscriptions).toEqual([{ id: "ihris-kb", repository: "litlfred/ihris-kb", ref: SHA }]);

    const snap = SubstrateSnapshotSchema.parse(JSON.parse(readFileSync(join(dir, "subscriptions", "ihris-kb.substrate.json"), "utf8")));
    expect(snap.fixity.digest).toBe(createHash("sha256").update(snap.raw).digest("hex"));
    expect(JSON.parse(snap.raw)).toEqual(SUBSTRATE);
    expect(snap.summary.harnesses).toEqual(["ihris-kb"]);
    // The snapshot is NOT itself a declaration: no `name` at its top level.
    expect((JSON.parse(readFileSync(r.snapshotFile, "utf8")) as { name?: string }).name).toBeUndefined();
  });

  test("--id names the subscription", async () => {
    const { dir } = subscriber();
    const r = await subscribe({ target: TARGET, instance: dir, id: "kb", fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(r.ok && r.entry.id).toBe("kb");
    expect(existsSync(join(dir, "subscriptions", "kb.substrate.json"))).toBe(true);
  });

  test("--dry-run writes nothing and reports what it would", async () => {
    const { dir, file } = subscriber();
    const before = readFileSync(file, "utf8");
    const r = await subscribe({ target: TARGET, instance: dir, dryRun: true, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(r.ok && r.changed.length).toBe(2);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(existsSync(join(dir, "subscriptions"))).toBe(false);
  });

  test.each([
    ["not-a-substrate", fixture({ "data.json": { name: "data" } })],
    ["could-not-determine", failing],
  ] as const)("%s writes nothing", async (state, f) => {
    const { dir, file } = subscriber();
    const before = readFileSync(file, "utf8");
    const r = await subscribe({ target: TARGET, instance: dir, fetch: f });
    expect(!r.ok && r.state).toBe(state);
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(existsSync(join(dir, "subscriptions"))).toBe(false);
  });

  test("an instance with no substrate-snapshot directory is refused before fetching", async () => {
    const { dir } = subscriber({ snapshotDir: false });
    const f = fixture({ "ihris-kb.json": SUBSTRATE });
    const r = await subscribe({ target: TARGET, instance: dir, fetch: f });
    expect(!r.ok && r.reason).toMatch(/substrate-snapshot/);
    expect(f.calls).toBe(0);
  });

  test("a subscription colliding with needs is refused by the declaration's own schema", async () => {
    const { dir, file } = subscriber({ extra: `,\n  "needs": ["ihris-kb"]` });
    const before = readFileSync(file, "utf8");
    const r = await subscribe({ target: TARGET, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(!r.ok && r.reason).toMatch(/needs/);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});

describe("subscribe: re-subscribing", () => {
  test("idempotent: the same pin twice changes no byte the second time", async () => {
    const { dir, file } = subscriber();
    const f = fixture({ "ihris-kb.json": SUBSTRATE });
    await subscribe({ target: TARGET, instance: dir, fetch: f });
    const decl1 = readFileSync(file, "utf8");
    const snap1 = readFileSync(join(dir, "subscriptions", "ihris-kb.substrate.json"), "utf8");
    const r = await subscribe({ target: TARGET, instance: dir, fetch: f });
    expect(r.ok && r.changed).toEqual([]);
    expect(readFileSync(file, "utf8")).toBe(decl1);
    expect(readFileSync(join(dir, "subscriptions", "ihris-kb.substrate.json"), "utf8")).toBe(snap1);
  });

  test("a re-subscribe keeps the subscriber's choices", async () => {
    const { dir, file } = subscriber();
    const f = fixture({ "ihris-kb.json": SUBSTRATE });
    await subscribe({ target: TARGET, instance: dir, fetch: f });
    const chosen = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...chosen.subscriptions[0], subgraphs: ["kb"] }]));
    const r = await subscribe({ target: TARGET, instance: dir, fetch: f });
    expect(r.ok && r.entry.subgraphs).toEqual(["kb"]);
  });

  test("moving the pin with nothing chosen updates it; with parts chosen it is refused as a refresh", async () => {
    const { dir, file } = subscriber();
    const f = fixture({ "ihris-kb.json": SUBSTRATE });
    await subscribe({ target: TARGET, instance: dir, fetch: f });
    const moved = await subscribe({ target: `litlfred/ihris-kb@${SHA2}`, instance: dir, fetch: f });
    expect(moved.ok && moved.entry.ref).toBe(SHA2);

    const cur = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], harnesses: ["ihris-kb"] }]));
    const r = await subscribe({ target: TARGET, instance: dir, fetch: f });
    expect(!r.ok && r.reason).toMatch(/refresh-materialized/);
  });

  test("an id already naming another repository is refused", async () => {
    const { dir } = subscriber();
    await subscribe({ target: TARGET, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    const r = await subscribe({ target: `someone/ihris-kb@${SHA}`, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(!r.ok && r.reason).toMatch(/--id/);
  });
});

describe("checkSubscriptions: the offline gate", () => {
  async function subscribed(): Promise<{ dir: string; file: string; snap: string }> {
    const s = subscriber();
    await subscribe({ target: TARGET, instance: s.dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    return { ...s, snap: join(s.dir, "subscriptions", "ihris-kb.substrate.json") };
  }

  test("clean after a subscribe, and clean with nothing subscribed", async () => {
    expect(checkSubscriptions((await subscribed()).dir)).toEqual([]);
    expect(checkSubscriptions(subscriber().dir)).toEqual([]);
  });

  test("a missing snapshot is a finding", async () => {
    const { dir, snap } = await subscribed();
    rmSync(snap);
    expect(checkSubscriptions(dir).join("\n")).toMatch(/no snapshot/);
  });

  test("bytes edited in place fail their digest", async () => {
    const { dir, snap } = await subscribed();
    const j = JSON.parse(readFileSync(snap, "utf8")) as { raw: string };
    j.raw = j.raw.replace("1.2.0", "9.9.9");
    writeFileSync(snap, JSON.stringify(j));
    expect(checkSubscriptions(dir).join("\n")).toMatch(/digest/);
  });

  test("a summary that disagrees with its bytes is a finding", async () => {
    const { dir, snap } = await subscribed();
    const j = JSON.parse(readFileSync(snap, "utf8")) as { summary: { harnesses: string[] } };
    j.summary.harnesses = ["something-else"];
    writeFileSync(snap, JSON.stringify(j));
    expect(checkSubscriptions(dir).join("\n")).toMatch(/summary/);
  });

  test("a moved pin, a chosen part the substrate lacks, and an orphan are each findings", async () => {
    const { dir, file } = await subscribed();
    const cur = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], ref: SHA2, subgraphs: ["nope"] }]));
    writeFileSync(join(dir, "subscriptions", "stray.substrate.json"), "{}");
    const found = checkSubscriptions(dir).join("\n");
    expect(found).toMatch(/re-subscribe/);
    expect(found).toMatch(/`nope`/);
    expect(found).toMatch(/orphaned/);
  });
});

// ── A declaration one level down (bean 437w) ──────────────────────────────────
//
// The shape of litlfred/trust-kg: nothing at the root, the layer one
// directory down in a directory NOT named for it.
const NESTED = {
  name: "trust-kg",
  directories: [
    { id: "trust-skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "trust-folio", path: "folio/", graphTypologies: ["folio"] },
  ],
};
const NESTED_TREE = { "shared/trust-kg.json": NESTED, "shared/package.json": { name: "not-the-stem" }, "package.json": { name: "x" } };
const NESTED_TARGET = `litlfred/trust-kg@${SHA}`;

/**
 * A BARE repository on disk holding `files`, served through the real git
 * fetcher: shallow, blobless, by SHA. Returns its URL and the commit.
 */
function bareRepo(files: Record<string, unknown>): { url: string; sha: string } {
  const work = tmp("kg-sub-work-");
  for (const [n, v] of Object.entries(files)) {
    mkdirSync(dirname(join(work, n)), { recursive: true });
    writeFileSync(join(work, n), typeof v === "string" ? v : `${JSON.stringify(v, null, 2)}\n`);
  }
  git(["init", "-q", work]);
  git(["add", "-A"], work);
  git(["-c", "user.email=t@example.org", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "fixture"], work);
  const sha = git(["rev-parse", "HEAD"], work).trim();
  const bare = join(tmp("kg-sub-bare-"), "r.git");
  git(["clone", "-q", "--bare", work, bare]);
  git(["config", "uploadpack.allowFilter", "true"], bare);
  git(["config", "uploadpack.allowAnySHA1InWant", "true"], bare);
  return { url: `file://${bare}`, sha };
}

describe("a declaration one level down (bean 437w): fixture bare repositories, real git fetch", () => {
  const SUBS = [
    ["root declaration", { "ihris-kb.json": SUBSTRATE, "kb/notes.json": { name: "notes" } }, "substrate", "ihris-kb.json"],
    ["nested, directory name differs from the instance name", NESTED_TREE, "substrate", "shared/trust-kg.json"],
    ["two candidates one level down", { "a/alpha.json": { ...NESTED, name: "alpha" }, "b/beta.json": { ...NESTED, name: "beta" } }, "ambiguous", undefined],
    ["no declaration anywhere", { "package.json": { name: "x" }, "src/index.json": { name: "not-index" } }, "not-a-substrate", undefined],
  ] as const;

  test.each(SUBS)("%s", async (_label, files, state, file) => {
    const { url, sha } = bareRepo(files);
    const v = await judgeSubstrate("o/r", sha, gitDeclarationFetcher(() => url));
    expect(v.state).toBe(state);
    if (v.state === "substrate") {
      const nestedIn = file?.includes("/") ? file.split("/")[0] : undefined;
      const got: { file: string; upstreamPath?: string } = { file: v.file, upstreamPath: v.upstreamPath };
      const want: { file: string; upstreamPath?: string } = { file: String(file), upstreamPath: nestedIn };
      expect(got).toEqual(want);
    }
    if (v.state === "ambiguous") {
      expect(v.candidates).toEqual(["a/alpha.json", "b/beta.json"]);
      expect(v.reason).toMatch(/Not guessing/);
      expect(v.reason).toMatch(/--upstream-path/);
    }
    if (v.state === "not-a-substrate") expect(v.reason).toMatch(/the root carries no Knowledge Graph declaration/);
  });

  test("the git fetcher reads only the named directory when given an upstreamPath, at any depth", async () => {
    const { url, sha } = bareRepo({ "deep/er/trust-kg.json": NESTED, "a/alpha.json": { ...NESTED, name: "alpha" } });
    const v = await judgeSubstrate("o/r", sha, gitDeclarationFetcher(() => url), { upstreamPath: "deep/er/" });
    expect(v.state === "substrate" && v.file).toBe("deep/er/trust-kg.json");
    // Two levels down is NOT found by the search — only by naming it — so
    // this tree's only discoverable candidate is `a/alpha.json`.
    const searched = await judgeSubstrate("o/r", sha, gitDeclarationFetcher(() => url));
    expect(searched.state === "substrate" && searched.file).toBe("a/alpha.json");
  });

  test("a SHA the remote does not hold is could-not-determine", async () => {
    const { url } = bareRepo(NESTED_TREE);
    const v = await judgeSubstrate("o/r", SHA, gitDeclarationFetcher(() => url));
    expect(v.state).toBe("could-not-determine");
  });
});

describe("a declaration one level down (bean 437w): the search", () => {
  test("nested with a different directory name: found, and its directory is the upstreamPath", async () => {
    const v = await judgeSubstrate("litlfred/trust-kg", SHA, fixture(NESTED_TREE));
    expect(v.state).toBe("substrate");
    if (v.state !== "substrate") return;
    expect(v.file).toBe("shared/trust-kg.json");
    expect(v.upstreamPath).toBe("shared");
    expect(v.summary.name).toBe("trust-kg");
  });

  test("the root still wins, so an existing subscription judges the same bytes", async () => {
    const v = await judgeSubstrate("o/r", SHA, fixture({ "ihris-kb.json": SUBSTRATE, ...NESTED_TREE }));
    expect(v.state === "substrate" && v.file).toBe("ihris-kb.json");
    expect(v.state === "substrate" && v.upstreamPath).toBeUndefined();
  });

  test("two candidates: refused with both named, never guessed", async () => {
    const two = { "a/alpha.json": { ...NESTED, name: "alpha" }, "b/beta.json": { ...NESTED, name: "beta" } };
    const v = await judgeSubstrate("o/r", SHA, fixture(two));
    expect(v.state).toBe("ambiguous");
    expect("reason" in v && v.reason).toMatch(/`a\/alpha\.json`, `b\/beta\.json`/);
  });

  test("--name picks one of two; a name nobody carries is not-a-substrate", async () => {
    const two = { "a/alpha.json": { ...NESTED, name: "alpha" }, "b/beta.json": { ...NESTED, name: "beta" } };
    const v = await judgeSubstrate("o/r", SHA, fixture(two), { name: "beta" });
    expect(v.state === "substrate" && v.file).toBe("b/beta.json");
    const none = await judgeSubstrate("o/r", SHA, fixture(two), { name: "gamma" });
    expect(none.state).toBe("not-a-substrate");
    expect("reason" in none && none.reason).toMatch(/named `gamma`/);
  });

  test("a file whose `name` disagrees with its stem is not a candidate", async () => {
    const v = await judgeSubstrate("o/r", SHA, fixture({ "shared/trust-kg.json": { ...NESTED, name: "shared" } }));
    expect(v.state).toBe("not-a-substrate");
  });

  test("--upstream-path reads that directory only, and refuses what is not there", async () => {
    const two = { "a/alpha.json": { ...NESTED, name: "alpha" }, "b/beta.json": { ...NESTED, name: "beta" } };
    const v = await judgeSubstrate("o/r", SHA, fixture(two), { upstreamPath: "a" });
    expect(v.state === "substrate" && v.file).toBe("a/alpha.json");
    const empty = await judgeSubstrate("o/r", SHA, fixture(two), { upstreamPath: "c/" });
    expect(empty.state).toBe("not-a-substrate");
    expect("reason" in empty && empty.reason).toMatch(/`c\/` carries no Knowledge Graph declaration/);
  });

  test.each(["../elsewhere", ".hidden", "/abs"])("an unsafe upstreamPath %s is refused before any fetch", async (p) => {
    const f = fixture(NESTED_TREE);
    const v = await judgeSubstrate("o/r", SHA, f, { upstreamPath: p });
    expect(v.state).toBe("not-a-substrate");
    expect(f.calls).toBe(0);
  });
});

describe("a declaration one level down (bean 437w): what subscribe records, and what --check holds", () => {
  test("the subscription records the upstreamPath and the snapshot the nested file; --check is clean", async () => {
    const { dir, file } = subscriber();
    const r = await subscribe({ target: NESTED_TARGET, instance: dir, fetch: fixture(NESTED_TREE) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry).toEqual({ id: "trust-kg", repository: "litlfred/trust-kg", ref: SHA, upstreamPath: "shared" });
    const decl = CatHarnessDeclarationSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    expect(decl.subscriptions?.[0]?.upstreamPath).toBe("shared");
    const snap = SubstrateSnapshotSchema.parse(JSON.parse(readFileSync(r.snapshotFile, "utf8")));
    expect(snap.file).toBe("shared/trust-kg.json");
    expect(checkSubscriptions(dir)).toEqual([]);
  });

  test("a re-subscribe reuses the recorded subtree and changes no byte", async () => {
    const { dir, file } = subscriber();
    await subscribe({ target: NESTED_TARGET, instance: dir, fetch: fixture(NESTED_TREE) });
    const before = readFileSync(file, "utf8");
    // The tree now ALSO has a second candidate: without the record this would be ambiguous.
    const grown = fixture({ ...NESTED_TREE, "other/other.json": { ...NESTED, name: "other" } });
    const r = await subscribe({ target: NESTED_TARGET, instance: dir, fetch: grown });
    expect(r.ok && r.changed).toEqual([]);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  test("an ambiguous tree is REFUSED by subscribe, and nothing is written", async () => {
    const { dir, file } = subscriber();
    const before = readFileSync(file, "utf8");
    const two = { "a/alpha.json": { ...NESTED, name: "alpha" }, "b/beta.json": { ...NESTED, name: "beta" } };
    const r = await subscribe({ target: NESTED_TARGET, instance: dir, fetch: fixture(two) });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/Not guessing/);
    expect(readFileSync(file, "utf8")).toBe(before);
    const picked = await subscribe({ target: NESTED_TARGET, instance: dir, upstreamPath: "b", fetch: fixture(two) });
    expect(picked.ok && picked.entry.upstreamPath).toBe("b");
  });

  test("--check: a snapshot read from another subtree than the subscription records is a finding", async () => {
    const { dir, file } = subscriber();
    await subscribe({ target: NESTED_TARGET, instance: dir, fetch: fixture(NESTED_TREE) });
    const cur = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], upstreamPath: "elsewhere" }]));
    expect(checkSubscriptions(dir).join("\n")).toMatch(/read from `shared\/`.*`elsewhere`/);
    const { upstreamPath: _gone, ...atRoot } = cur.subscriptions[0]!;
    void _gone;
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [atRoot]));
    expect(checkSubscriptions(dir).join("\n")).toMatch(/read from `shared\/`, the subscription records the root/);
  });

  test("moving the subtree of a subscription with chosen parts is refused", async () => {
    const { dir, file } = subscriber();
    const tree = { ...NESTED_TREE, "other/trust-kg.json": NESTED };
    await subscribe({ target: NESTED_TARGET, instance: dir, upstreamPath: "shared", fetch: fixture(tree) });
    const cur = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], subgraphs: ["trust-skills"] }]));
    const r = await subscribe({ target: NESTED_TARGET, instance: dir, upstreamPath: "other", fetch: fixture(tree) });
    expect(!r.ok && r.reason).toMatch(/different subscription/);
  });
});

// ── A content Knowledge Graph: a second kind (owner, 2026-10-06) ──────────────
//
// The shape of litlfred/imm-kg: Subgraphs, no harness, nested.
const CONTENT = {
  name: "imm-kg",
  directories: [
    { id: "imm-index", path: "input/", graphTypologies: ["fhir-artifact-index"] },
    { id: "imm-docs", path: "docs/", graphTypologies: ["docs", "ig-pages"] },
  ],
};
const CONTENT_TREE = { "shared/imm-kg.json": CONTENT, "package.json": { name: "x" } };
const CONTENT_TARGET = `litlfred/imm-kg@${SHA}`;

describe("content Knowledge Graphs (owner, 2026-10-06): fixture bare repositories, real git fetch", () => {
  test.each([
    ["content-only, nested: accepted as CONTENT", CONTENT_TREE, "content"],
    ["harness-bearing, nested: still a SUBSTRATE", NESTED_TREE, "substrate"],
    ["harness-bearing at the root: still a SUBSTRATE", { "ihris-kb.json": SUBSTRATE }, "substrate"],
    ["a declaration with no Subgraph: still NOT-A-SUBSTRATE", { "empty.json": { name: "empty" } }, "not-a-substrate"],
    ["no declaration at all: still NOT-A-SUBSTRATE, with the old reason", { "package.json": { name: "x" } }, "not-a-substrate"],
  ] as const)("%s", async (_label, files, state) => {
    const { url, sha } = bareRepo(files);
    const v = await judgeSubstrate("o/r", sha, gitDeclarationFetcher(() => url));
    expect(v.state).toBe(state);
    if (v.state === "content") expect(v.summary.harnesses).toEqual([]);
    if (v.state === "substrate") expect(v.summary.harnesses.length).toBeGreaterThan(0);
    if (_label.startsWith("no declaration")) expect(v.state === "not-a-substrate" && v.reason).toMatch(/the root carries no Knowledge Graph declaration/);
  });
});

describe("content Knowledge Graphs (owner, 2026-10-06): recorded as their own kind", () => {
  test("subscribe records `kind: \"content\"` on the entry and the snapshot, and --check is clean", async () => {
    const { dir, file } = subscriber();
    const r = await subscribe({ target: CONTENT_TARGET, instance: dir, fetch: fixture(CONTENT_TREE) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.verdict.state).toBe("content");
    expect(r.entry).toEqual({ id: "imm-kg", repository: "litlfred/imm-kg", ref: SHA, upstreamPath: "shared", kind: "content" });
    expect(CatHarnessDeclarationSchema.parse(JSON.parse(readFileSync(file, "utf8"))).subscriptions?.[0]?.kind).toBe("content");
    const snap = SubstrateSnapshotSchema.parse(JSON.parse(readFileSync(r.snapshotFile, "utf8")));
    expect(snap.kind).toBe("content");
    expect(snap.summary.harnesses).toEqual([]);
    expect(checkSubscriptions(dir)).toEqual([]);
  });

  test("a substrate subscription records NO kind, so every existing record is unchanged", async () => {
    const { dir } = subscriber();
    const r = await subscribe({ target: TARGET, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    expect(r.ok && "kind" in r.entry).toBe(false);
    expect(r.ok && (JSON.parse(readFileSync(r.snapshotFile, "utf8")) as { kind?: string }).kind).toBeUndefined();
  });

  test("the schemas hold the kind and the harness list together", () => {
    const base = { id: "x", repository: "o/x", ref: SHA };
    expect(CatHarnessDeclarationSchema.safeParse({ name: "a", subscriptions: [{ ...base, kind: "content", harnesses: ["x"] }] }).success).toBe(false);
    expect(CatHarnessDeclarationSchema.safeParse({ name: "a", subscriptions: [{ ...base, kind: "content", subgraphs: ["d"] }] }).success).toBe(true);
    const snap = {
      $schema: "folio-substrate-snapshot/v1",
      subscription: "x",
      repository: "o/x",
      ref: SHA,
      file: "x.json",
      raw: "{}",
      fixity: { algorithm: "sha256", digest: "0".repeat(64) },
      summary: { name: "x", subgraphs: [], harnesses: [] as string[] },
    };
    expect(SubstrateSnapshotSchema.safeParse(snap).success).toBe(false); // a substrate (kind absent) with no harness
    expect(SubstrateSnapshotSchema.safeParse({ ...snap, kind: "content" }).success).toBe(true);
    expect(SubstrateSnapshotSchema.safeParse({ ...snap, kind: "content", summary: { ...snap.summary, harnesses: ["x"] } }).success).toBe(false);
  });

  test("--check: a content snapshot under a substrate entry is a finding", async () => {
    const { dir, file } = subscriber();
    await subscribe({ target: CONTENT_TARGET, instance: dir, fetch: fixture(CONTENT_TREE) });
    const cur = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
    const { kind: _k, ...asSubstrate } = cur.subscriptions[0]!;
    void _k;
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [asSubstrate]));
    expect(checkSubscriptions(dir).join("\n")).toMatch(/the subscription is `substrate`, its snapshot is `content`/);
  });

  test("--check: a snapshot whose kind its bytes do not bear out is a finding", async () => {
    const { dir } = subscriber();
    const r = await subscribe({ target: TARGET, instance: dir, fetch: fixture({ "ihris-kb.json": SUBSTRATE }) });
    if (!r.ok) throw new Error("fixture did not subscribe");
    const j = JSON.parse(readFileSync(r.snapshotFile, "utf8")) as Record<string, unknown> & { summary: { harnesses: string[] } };
    writeFileSync(r.snapshotFile, JSON.stringify({ ...j, kind: "content", summary: { ...j.summary, harnesses: [] } }));
    const found = checkSubscriptions(dir).join("\n");
    expect(found).toMatch(/its snapshot is `content`/);
    expect(found).toMatch(/its bytes judge as `substrate`/);
  });

  test("a content snapshot contributes no harness declaration, whatever is asked", async () => {
    const { harnessDeclarationIn } = await import("../../subscribed-harnesses.ts");
    const { dir } = subscriber();
    const r = await subscribe({ target: CONTENT_TARGET, instance: dir, fetch: fixture(CONTENT_TREE) });
    if (!r.ok) throw new Error("fixture did not subscribe");
    const snap = SubstrateSnapshotSchema.parse(JSON.parse(readFileSync(r.snapshotFile, "utf8")));
    expect(harnessDeclarationIn(snap, "imm-kg")).toBeUndefined();
  });
});

describe("setTopLevelKey", () => {
  test("replaces only the value's span, and appends an absent key", () => {
    const text = `{\n  "a": { "x": 1, "y": [1, 2] },\n  "b": "s,}]",\n  "c": [\n    1\n  ]\n}\n`;
    const replaced = setTopLevelKey(text, "b", ["q"]);
    expect(replaced).toBe(`{\n  "a": { "x": 1, "y": [1, 2] },\n  "b": [\n    "q"\n  ],\n  "c": [\n    1\n  ]\n}\n`);
    const last = setTopLevelKey(text, "c", 2);
    expect(JSON.parse(last)).toEqual({ a: { x: 1, y: [1, 2] }, b: "s,}]", c: 2 });
    const appended = setTopLevelKey(text, "d", { k: true });
    expect(JSON.parse(appended)).toEqual({ a: { x: 1, y: [1, 2] }, b: "s,}]", c: [1], d: { k: true } });
    expect(appended.startsWith(`{\n  "a": { "x": 1, "y": [1, 2] },`)).toBe(true);
  });
});
