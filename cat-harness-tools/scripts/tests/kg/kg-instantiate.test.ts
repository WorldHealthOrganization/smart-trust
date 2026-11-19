/**
 * `kg:instantiate` (issue #1719, epic bean `fnx4`, slice 7): instantiate a
 * harness a subscription chose, from the snapshot `kg:subscribe` cached. Every
 * test builds a checkout in a temporary directory and subscribes through the
 * injectable fetcher — no network.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sweep } from "../../check-instance-config.ts";
import { harnessTiles } from "../../harness-tiles.ts";
import { harnessHome, instantiate, stateDirectoriesOf, unsafePathReason } from "../../kg-instantiate.ts";
import { subscribedHarnesses, subscribedTile } from "../../subscribed-harnesses.ts";
import { checkSubscriptions, partRecordsIn, type RootFetcher, setTopLevelKey, subscribe } from "../../kg-subscribe.ts";
import { render, subscriptionCards } from "../../subscriptions-viz.ts";
import { readDeclaration } from "../../../schemas/kg/cat-harness.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

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
  description: "Skills and processes for health workforce information.",
  directories: [
    { id: "kb-skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "work", path: "beans/workflows/", graphTypologies: ["workflow-state"] },
    { id: "plan", path: "beans/defs/", graphTypologies: ["bean-defs"] },
  ],
};

function serve(decl: Record<string, unknown>): RootFetcher {
  return () => {
    const d = mkdtempSync(join(tmpdir(), "kg-inst-root-"));
    writeFileSync(join(d, `${decl["name"]}.json`), `${JSON.stringify(decl, null, 2)}\n`);
    return d;
  };
}

/**
 * A checkout: `<repo>/host/host.json` is the subscriber, with a snapshot
 * directory; `extraInstances` adds further local layers by name.
 */
function checkout(extraInstances: string[] = []): { repo: string; host: string; file: string } {
  const repo = tmp("kg-inst-repo-");
  const host = join(repo, "host");
  mkdirSync(host);
  const file = join(host, "host.json");
  writeFileSync(
    file,
    `{
  "name": "host",
  "livesAt": { "repository": "litlfred/host", "path": "host" },
  "directories": [
    {
      "id": "subscriptions",
      "path": "subscriptions/",
      "dependents": "skip",
      "graphTypologies": ["substrate-snapshot"]
    },
    {
      "id": "subscribed-harnesses",
      "path": "subscribed-harnesses/",
      "dependents": "skip",
      "graphTypologies": ["subscribed-harnesses"]
    }
  ]
}
`,
  );
  for (const n of extraInstances) {
    mkdirSync(join(repo, n));
    writeFileSync(join(repo, n, `${n}.json`), `${JSON.stringify({ name: n, livesAt: { repository: `litlfred/${n}`, path: n }, directories: [] }, null, 2)}\n`);
  }
  return { repo, host, file };
}

/** Where `kg:instantiate` puts a subscribed harness's state: the subscriber's `subscribed-harnesses` directory (bean `w1gy` finding 1). */
function home(c: { host: string }, subscription = "ihris-kb", harness = "ihris-kb"): string {
  return harnessHome(join(c.host, "subscribed-harnesses"), subscription, harness);
}

/** Subscribe `host` to `decl` at SHA, then record `harnesses` as chosen. */
async function subscribed(
  c: { host: string; file: string },
  decl: Record<string, unknown> = SUBSTRATE,
  harnesses: string[] = [String(decl["name"])],
  id?: string,
): Promise<void> {
  const r = await subscribe({ target: `litlfred/${decl["name"]}@${SHA}`, instance: c.host, fetch: serve(decl), ...(id ? { id } : {}) });
  if (!r.ok) throw new Error(r.reason);
  const raw = JSON.parse(readFileSync(c.file, "utf8")) as { subscriptions: { id: string; harnesses?: string[] }[] };
  const subs = raw.subscriptions.map((s) => (s.id === (id ?? decl["name"]) ? { ...s, harnesses } : s));
  writeFileSync(c.file, setTopLevelKey(readFileSync(c.file, "utf8"), "subscriptions", subs));
}

describe("instantiate: writes the config and the state directories", () => {
  test("a chosen, declared harness is instantiated", async () => {
    const c = checkout();
    await subscribed(c);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("instantiated");
    const config = join(c.repo, "ihris-kb.config.json");
    expect(existsSync(config)).toBe(true);
    const body = JSON.parse(readFileSync(config, "utf8"));
    expect(body._subscription).toEqual({ subscriber: "host", id: "ihris-kb", repository: "litlfred/ihris-kb", ref: SHA });
    // The two state directories, and not the skills one.
    const h = home(c);
    expect(existsSync(join(h, "beans/workflows/.gitkeep"))).toBe(true);
    expect(existsSync(join(h, "beans/defs/.gitkeep"))).toBe(true);
    expect(existsSync(join(h, "skills"))).toBe(false);
    // G11: nothing at the repository root under the harness's name.
    expect(existsSync(join(c.repo, "ihris-kb"))).toBe(false);
    expect(r.ok && r.written.length).toBe(3);
  });

  test("with an index.config.json, the config goes INLINE in a new entry and no <name>.config.json is written (ymvt)", async () => {
    const c = checkout();
    await subscribed(c);
    writeFileSync(join(c.repo, "index.config.json"), JSON.stringify({ $schema: "folio-index-config/v1", instances: [{ name: "host", source: { local: { at: "host" } } }] }, null, 2));
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("instantiated");
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
    const idx = JSON.parse(readFileSync(join(c.repo, "index.config.json"), "utf8"));
    const entry = idx.instances.find((e: { name: string }) => e.name === "ihris-kb");
    expect(entry._subscription).toEqual({ subscriber: "host", id: "ihris-kb", repository: "litlfred/ihris-kb", ref: SHA });
    // Re-running reports the entry, and leaves it as it is.
    const again = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(again.ok && again.state).toBe("already-instantiated");
    // Subscriptions read instantiation index-first.
    expect(subscriptionCards(c.repo).flatMap((x) => x.instantiated ?? [])).toContain("ihris-kb");
  });

  test("a dry run writes nothing and says what it would", async () => {
    const c = checkout();
    await subscribed(c);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host, dryRun: true });
    expect(r.ok && r.state).toBe("instantiated");
    expect(r.ok && r.written.length).toBe(3);
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
    expect(existsSync(home(c))).toBe(false);
  });

  test("idempotent: an existing config is reported, never overwritten", async () => {
    const c = checkout();
    await subscribed(c);
    expect(instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host }).ok).toBe(true);
    const config = join(c.repo, "ihris-kb.config.json");
    writeFileSync(config, '{ "contentType": "document" }\n');
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("already-instantiated");
    expect(r.ok && r.written).toEqual([]);
    expect(readFileSync(config, "utf8")).toBe('{ "contentType": "document" }\n');
  });

  test("a re-run restores a state directory that went missing, and still leaves the config", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    const config = join(c.repo, "ihris-kb.config.json");
    const before = readFileSync(config, "utf8");
    rmSync(join(home(c), "beans/defs"), { recursive: true });
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("already-instantiated");
    expect(r.ok && r.written).toEqual([join(home(c), "beans/defs/")]);
    expect(readFileSync(config, "utf8")).toBe(before);
  });
});

describe("instantiate: the state home is its own state directory, never the snapshot directory (G11, w1gy finding 1)", () => {
  test("the home is <state dir>/<subscription>/<harness>/", () => {
    expect(harnessHome("/x/host/subscribed-harnesses", "sub", "kb")).toBe(join("/x/host/subscribed-harnesses", "sub", "kb"));
  });

  test("nothing is written under the read-only snapshot directory", async () => {
    const c = checkout();
    await subscribed(c);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("instantiated");
    expect(r.ok && r.written.some((f) => f.startsWith(join(c.host, "subscriptions") + "/"))).toBe(false);
    expect(existsSync(join(c.host, "subscriptions", "ihris-kb"))).toBe(false);
  });

  test("a subscriber that declares no `subscribed-harnesses` directory is refused, and nothing is written", async () => {
    const c = checkout();
    await subscribed(c);
    const raw = JSON.parse(readFileSync(c.file, "utf8")) as { directories: { id: string }[] };
    writeFileSync(c.file, setTopLevelKey(readFileSync(c.file, "utf8"), "directories", raw.directories.filter((d) => d.id !== "subscribed-harnesses")));
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/declares no `subscribed-harnesses` directory/);
    expect(existsSync(join(c.host, "subscribed-harnesses"))).toBe(false);
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
  });

  test("a staged instance directory carrying the harness's name at the root is left untouched", async () => {
    const c = checkout();
    // A staged layer's directory: no declaration of its own, so it is not
    // a local layer and the name-taken refusal does not fire.
    mkdirSync(join(c.repo, "ihris-kb", "beans"), { recursive: true });
    writeFileSync(join(c.repo, "ihris-kb", "beans", "keep.md"), "staged\n");
    await subscribed(c);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(r.ok && r.state).toBe("instantiated");
    expect(r.ok && r.written.every((f) => !f.startsWith(join(c.repo, "ihris-kb") + "/"))).toBe(true);
    expect(existsSync(join(c.repo, "ihris-kb", "beans", "defs"))).toBe(false);
    expect(readFileSync(join(c.repo, "ihris-kb", "beans", "keep.md"), "utf8")).toBe("staged\n");
    expect(existsSync(join(home(c), "beans/defs/.gitkeep"))).toBe(true);
  });

  test("the config names where the state lives", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    const body = JSON.parse(readFileSync(join(c.repo, "ihris-kb.config.json"), "utf8"));
    expect(body._comment).toContain("`host/subscribed-harnesses/ihris-kb/ihris-kb/`");
  });

  test("an old-layout `harnesses/` under the snapshot directory is a stray to the part reader", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(partRecordsIn(join(c.host, "subscriptions"), "ihris-kb")).toEqual({ parts: [], strays: [], nodes: [] });
    mkdirSync(join(c.host, "subscriptions", "ihris-kb", "harnesses", "ihris-kb"), { recursive: true });
    expect(partRecordsIn(join(c.host, "subscriptions"), "ihris-kb").strays).toEqual(["ihris-kb/harnesses"]);
  });
});

describe("kg:subscribe:check judges the subscribed-harnesses directory (w1gy finding 1)", () => {
  test("an instantiated harness's home is clean", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(checkSubscriptions(c.host)).toEqual([]);
  });

  test("a home in the old snapshot-directory layout is a finding that says where to move it", async () => {
    const c = checkout();
    await subscribed(c);
    mkdirSync(join(c.host, "subscriptions", "ihris-kb", "harnesses", "ihris-kb"), { recursive: true });
    const f = checkSubscriptions(c.host);
    expect(f).toHaveLength(1);
    expect(f[0]).toContain("subscriptions/ihris-kb/harnesses/: instantiated-harness state in the read-only snapshot directory");
  });

  test("a home for an unchosen harness, an undeclared subscription, or a loose file is orphaned", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    mkdirSync(join(c.host, "subscribed-harnesses", "ihris-kb", "other"), { recursive: true });
    mkdirSync(join(c.host, "subscribed-harnesses", "gone", "x"), { recursive: true });
    writeFileSync(join(c.host, "subscribed-harnesses", "loose.txt"), "x");
    writeFileSync(join(c.host, "subscribed-harnesses", "README.md"), "generated\n");
    const f = checkSubscriptions(c.host).sort();
    expect(f).toHaveLength(3);
    expect(f.some((x) => x.includes("subscribed-harnesses/gone/: state for subscription `gone`"))).toBe(true);
    expect(f.some((x) => x.includes("subscribed-harnesses/ihris-kb/other/: state for harness `other`"))).toBe(true);
    expect(f.some((x) => x.includes("subscribed-harnesses/loose.txt: not a subscription's directory"))).toBe(true);
  });
});

describe("instantiate: refusals, each with its reason", () => {
  test("a CONTENT subscription has nothing to instantiate (owner, 2026-10-06)", async () => {
    const c = checkout();
    const content = { name: "ig", directories: [{ id: "ig-docs", path: "docs/", graphTypologies: ["docs"] }] };
    const r0 = await subscribe({ target: `litlfred/ig@${SHA}`, instance: c.host, fetch: serve(content) });
    expect(r0.ok && r0.entry.kind).toBe("content");
    const r = instantiate({ subscription: "ig", harness: "ig", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/CONTENT Knowledge Graph/);
    expect(existsSync(join(c.repo, "ig.config.json"))).toBe(false);
  });

  test("no such subscription", async () => {
    const c = checkout();
    await subscribed(c);
    const r = instantiate({ subscription: "nope", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/no subscription `nope`.*`ihris-kb`/);
  });

  test("a harness the subscription did not choose", async () => {
    const c = checkout();
    await subscribed(c, SUBSTRATE, []);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/did not choose harness `ihris-kb`.*chose no harness/);
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
  });

  test("a chosen harness the substrate does not declare", async () => {
    const c = checkout();
    await subscribed(c, SUBSTRATE, ["ihris-kb", "ghost"]);
    const r = instantiate({ subscription: "ihris-kb", harness: "ghost", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/does not declare harness `ghost`; it declares `ihris-kb`/);
  });

  test("an unmet need is refused, naming every missing one", async () => {
    const c = checkout();
    await subscribed(c, { ...SUBSTRATE, needs: ["base-kb", "other-kb"] });
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/needs `base-kb`, `other-kb`/);
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
    expect(existsSync(home(c))).toBe(false);
  });

  test("a need is satisfied by a local instance", async () => {
    const c = checkout(["base-kb"]);
    await subscribed(c, { ...SUBSTRATE, needs: ["base-kb"] });
    expect(instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host }).ok).toBe(true);
  });

  test("a need is satisfied by another subscription", async () => {
    const c = checkout();
    await subscribed(c, { name: "base-kb", directories: [{ id: "s", path: "skills/", graphTypologies: ["skills"] }] }, []);
    await subscribed(c, { ...SUBSTRATE, needs: ["base-kb"] });
    expect(instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host }).ok).toBe(true);
  });

  test("a local instance already carrying the harness's name", async () => {
    const c = checkout(["ihris-kb"]);
    await subscribed(c);
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/already named `ihris-kb`/);
  });

  test("a snapshot edited in place is refused", async () => {
    const c = checkout();
    await subscribed(c);
    const snap = join(c.host, "subscriptions", "ihris-kb.substrate.json");
    const j = JSON.parse(readFileSync(snap, "utf8"));
    j.raw = j.raw.replace("iHRIS", "Edited");
    writeFileSync(snap, JSON.stringify(j));
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("refused");
    expect(!r.ok && r.reason).toMatch(/digest/);
  });

  test("a state path that climbs out is refused before anything is written", async () => {
    const c = checkout();
    const decl = { ...SUBSTRATE, directories: [{ id: "esc", path: "../outside/", graphTypologies: ["workflow-state"] }, SUBSTRATE.directories[0]] };
    // Two guards, in order. bootstrap's declaration schema refuses a `..` path
    // at subscribe (bootstrap-tools#59); a bootstrap-tools pinned before it
    // admits the declaration, and instantiate's own guard refuses it. Either
    // way it is refused, and nothing is written outside.
    const s = await subscribe({ target: `litlfred/${decl["name"]}@${SHA}`, instance: c.host, fetch: serve(decl) });
    if (!s.ok) {
      expect(s.reason).toMatch(/directories\.0\.path/);
    } else {
      const raw = JSON.parse(readFileSync(c.file, "utf8")) as { subscriptions: { id: string; harnesses?: string[] }[] };
      const subs = raw.subscriptions.map((x) => (x.id === decl["name"] ? { ...x, harnesses: [String(decl["name"])] } : x));
      writeFileSync(c.file, setTopLevelKey(readFileSync(c.file, "utf8"), "subscriptions", subs));
      const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
      expect(!r.ok && r.state).toBe("refused");
      expect(!r.ok && r.reason).toMatch(/climbs out/);
    }
    expect(existsSync(join(c.repo, "outside"))).toBe(false);
  });
});

describe("could-not-determine is never clean", () => {
  test("a missing snapshot", async () => {
    const c = checkout();
    await subscribed(c);
    rmSync(join(c.host, "subscriptions", "ihris-kb.substrate.json"));
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("could-not-determine");
    expect(!r.ok && r.reason).toMatch(/kg:subscribe/);
  });

  test("a directory whose kinds nobody here registers", async () => {
    const c = checkout();
    await subscribed(c, { ...SUBSTRATE, directories: [...SUBSTRATE.directories, { id: "odd", path: "odd/", graphTypologies: ["not-a-kind-here"] }] });
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("could-not-determine");
    expect(!r.ok && r.reason).toMatch(/`odd` \(`not-a-kind-here`\)/);
    expect(existsSync(join(c.repo, "ihris-kb.config.json"))).toBe(false);
  });

  test("an unmet need while another snapshot cannot be read is undetermined, not refused", async () => {
    const c = checkout();
    await subscribed(c, { name: "base-kb", directories: [{ id: "s", path: "skills/", graphTypologies: ["skills"] }] }, []);
    await subscribed(c, { ...SUBSTRATE, needs: ["base-kb"] });
    rmSync(join(c.host, "subscriptions", "base-kb.substrate.json"));
    const r = instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(!r.ok && r.state).toBe("could-not-determine");
    expect(!r.ok && r.reason).toMatch(/could not be read/);
  });

  test("a state kind beside an unknown kind still counts as state", () => {
    const r = stateDirectoriesOf({ name: "x", directories: [{ id: "a", path: "a/", graphTypologies: ["workflow-state", "mystery"] }] });
    expect(r).toEqual({ state: "determined", dirs: [{ id: "a", path: "a/" }] });
  });
});

describe("unsafePathReason", () => {
  test.each([
    ["beans/defs/", undefined],
    ["/abs", "is absolute"],
    ["a/../../b", "climbs out of the harness's home"],
    [".hidden/x", "has the dot-prefixed segment `.hidden`"],
    ["./", "names the harness's root rather than a directory under it"],
  ])("%s", (p, why) => expect(unsafePathReason(p)).toBe(why));
});

describe("the navbar, the config sweep and the visualizer see it", () => {
  test("an instantiated subscribed harness gets an instantiated tile from its snapshot", async () => {
    const c = checkout();
    await subscribed(c);
    expect(harnessTiles(c.repo, c.host, ["host"]).map((t) => t.name)).toEqual(["host"]);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    const tile = harnessTiles(c.repo, c.host, ["host"]).find((t) => t.name === "ihris-kb");
    expect(tile?.instantiated).toBe(true);
    expect(tile?.title).toBe("iHRIS Knowledge Base");
    expect(tile?.href).toBeUndefined();
    expect(tile?.visualisations.map((v) => v.kind).sort()).toEqual(["bean-defs", "skills", "workflow-state"]);
    expect(tile?.visualisations.every((v) => v.path === undefined && v.note?.includes("not held here"))).toBe(true);
  });

  test("an unreadable snapshot is drawn as a finding, not an empty tile", async () => {
    const c = checkout();
    await subscribed(c);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    rmSync(join(c.host, "subscriptions", "ihris-kb.substrate.json"));
    const decl = readDeclaration(c.host)!;
    const [h] = subscribedHarnesses(c.repo, [{ dir: c.host, decl }]);
    const tile = subscribedTile(h!);
    expect(tile.instantiated).toBe(true);
    expect(tile.findings.join(" ")).toMatch(/could not read its declaration/);
  });

  test("check-instance-config claims a chosen harness's config rather than calling it orphaned", async () => {
    const c = checkout();
    writeFileSync(join(c.repo, "ihris-kb.config.json"), "{}\n");
    expect(sweep(c.repo).findings.map((f) => f.kind)).toEqual(["orphan"]);
    await subscribed(c);
    expect(sweep(c.repo).findings).toEqual([]);
  });

  test("the visualizer marks the harness instantiated once its config exists", async () => {
    const c = checkout();
    await subscribed(c);
    expect(render([], subscriptionCards(c.repo))).toMatch(/harness `ihris-kb` \| ✓ \| 🔗 chosen, not yet instantiated/);
    instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host });
    expect(render([], subscriptionCards(c.repo))).toMatch(/harness `ihris-kb` \| ✓ \| ⬆ instantiated/);
  });
});
