/**
 * Bean `g8jp`, GAP 1: the site build mounts a layer's directories from a
 * SUBSCRIPTION's materialised tree, not only from an in-tree layer. Every
 * test builds a fixture repository with one subscriber and a substrate served
 * through `subscribe`'s injectable fetcher — no network.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { KG_PART_RECORD_SCHEMA } from "../../schemas/kg/substrate-snapshot.ts";
import { type RootFetcher, setTopLevelKey, subscribe, treeDigest } from "../kg-subscribe.ts";
import { composedInstances } from "../compose-docs.ts";
import { mountable, referencedAssets, subscribedMountEntries, withRoutes } from "../mount-instance-docs.ts";
import { subscribedHarnesses, subscribedTile } from "../subscribed-harnesses.ts";
import { subscribedTrees } from "../subscribed-trees.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "89abcdef0123456789abcdef0123456789abcdef";

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

/** The substrate: a themed site at its root, plain docs, and a library the site embeds from. */
const SUBSTRATE = {
  name: "iris-like",
  title: "IRIS-like",
  avatar: { glyph: "M4 6h16", tone: 199, reads: "a line, in WHO blue" },
  directories: [
    { id: "iris-site", path: "site/", graphTypologies: ["docs"], instanceRoot: true },
    { id: "iris-docs", path: "docs/", graphTypologies: ["docs"] },
    { id: "library", path: "library/", graphTypologies: ["library"] },
    { id: "iris-skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "iris-notes", path: "notes/", graphTypologies: ["docs"], composed: true },
  ],
};

const fetchRoot: RootFetcher = () => {
  const d = tmp("subscribed-trees-root-");
  writeFileSync(join(d, "iris-like.json"), `${JSON.stringify(SUBSTRATE, null, 2)}\n`);
  return d;
};

/** A repository with one subscriber layer, `host/`, subscribed to the substrate at {@link SHA}. */
async function repoWith(subgraphs: string[]): Promise<{ repo: string; host: string; snapshotDir: string }> {
  const repo = tmp("subscribed-trees-repo-");
  const host = join(repo, "host");
  mkdirSync(host);
  writeFileSync(
    join(host, "host.json"),
    `${JSON.stringify(
      {
        name: "host",
        livesAt: { repository: "litlfred/host", path: "host" },
        directories: [{ id: "subscriptions", path: "subscriptions/", dependents: "skip", graphTypologies: ["substrate-snapshot"] }],
      },
      null,
      2,
    )}\n`,
  );
  const r = await subscribe({ target: `litlfred/iris-like@${SHA}`, instance: host, fetch: fetchRoot });
  expect(r.ok).toBe(true);
  const file = join(host, "host.json");
  const cur = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], subgraphs }]));
  return { repo, host, snapshotDir: join(host, "subscriptions") };
}

/** Write a materialised part the way `kg:materialize` lays it out. */
function materialise(snapshotDir: string, id: string, path: string, files: Record<string, string>, opts: { ref?: string; state?: "materialized" | "referenced"; corrupt?: boolean } = {}): void {
  const dir = join(snapshotDir, "iris-like", "subgraphs", id);
  const tree = join(dir, "tree");
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(tree, f, ".."), { recursive: true });
    writeFileSync(join(tree, f), body);
  }
  const digest = treeDigest(tree);
  const state = opts.state ?? "materialized";
  writeFileSync(
    join(dir, "materialization.json"),
    JSON.stringify({
      $schema: KG_PART_RECORD_SCHEMA,
      part: { kind: "subgraph", id, path },
      ref: opts.ref ?? SHA,
      materialization: { state, purpose: "fixture", ...(state === "materialized" ? { fixity: { digest } } : {}) },
      ...(state === "referenced" ? { refusal: { gates: { copyright: { verdict: "refused" } } } } : {}),
    }),
  );
  if (opts.corrupt) writeFileSync(join(tree, Object.keys(files)[0]!), "edited in place");
}

const SITE = { "index.html": '<html><body><img src="../library/cover.png"></body></html>' };

describe("subscribedTrees: three states, never two", () => {
  test("a materialised, verified subgraph is held, at its tree", async () => {
    const { host, snapshotDir } = await repoWith(["iris-site"]);
    materialise(snapshotDir, "iris-site", "site", SITE);
    const decl = JSON.parse(readFileSync(join(host, "host.json"), "utf8"));
    const [t] = subscribedTrees([{ dir: host, decl }]);
    expect(t).toMatchObject({ instance: "iris-like", subgraph: "iris-site", state: "held" });
    expect(t!.tree).toBe(join(snapshotDir, "iris-like", "subgraphs", "iris-site", "tree"));
    expect(t!.entry?.instanceRoot).toBe(true); // every declared field kept, not only id/path/kinds
  });

  test("chosen but never materialised is could-not-determine, naming the command", async () => {
    const { host } = await repoWith(["iris-site"]);
    const decl = JSON.parse(readFileSync(join(host, "host.json"), "utf8"));
    const [t] = subscribedTrees([{ dir: host, decl }]);
    expect(t!.state).toBe("could-not-determine");
    expect(t!.reason).toContain("kg:materialize iris-like iris-site");
  });

  test("bytes edited in place, or held at another pin, are could-not-determine", async () => {
    const a = await repoWith(["iris-site"]);
    materialise(a.snapshotDir, "iris-site", "site", SITE, { corrupt: true });
    const da = JSON.parse(readFileSync(join(a.host, "host.json"), "utf8"));
    expect(subscribedTrees([{ dir: a.host, decl: da }])[0]!.reason).toContain("fixity mismatch");

    const b = await repoWith(["iris-site"]);
    materialise(b.snapshotDir, "iris-site", "site", SITE, { ref: OTHER });
    const db = JSON.parse(readFileSync(join(b.host, "host.json"), "utf8"));
    expect(subscribedTrees([{ dir: b.host, decl: db }])[0]!.reason).toContain("re-materialise");
  });

  test("a part its gates refused is referenced — a determined absence, not a problem", async () => {
    const { host, snapshotDir } = await repoWith(["iris-site"]);
    materialise(snapshotDir, "iris-site", "site", SITE, { state: "referenced" });
    const decl = JSON.parse(readFileSync(join(host, "host.json"), "utf8"));
    const [t] = subscribedTrees([{ dir: host, decl }]);
    expect(t!.state).toBe("referenced");
    expect(t!.reason).toContain("refused: copyright");
  });

  test("a chosen subgraph the substrate does not declare is could-not-determine", async () => {
    const { host } = await repoWith(["nope"]);
    const decl = JSON.parse(readFileSync(join(host, "host.json"), "utf8"));
    expect(subscribedTrees([{ dir: host, decl }])[0]).toMatchObject({ state: "could-not-determine", subgraph: "nope" });
  });
});

describe("mount-instance-docs reads a subscribed instance like an in-tree one", () => {
  test("held directories mount at the substrate's own routes, the declared root at /<instance>/", async () => {
    const { repo, snapshotDir } = await repoWith(["iris-site", "iris-docs"]);
    materialise(snapshotDir, "iris-site", "site", SITE);
    materialise(snapshotDir, "iris-docs", "docs", { "index.html": "<html><body>docs</body></html>" });
    const { entries, problems, shadowed } = subscribedMountEntries(repo);
    expect(problems).toEqual([]);
    expect(shadowed).toEqual([]);
    expect(entries.map((e) => e.name)).toEqual(["iris-like", "iris-like"]);
    // The layout links to the held tree; nothing is copied.
    expect(realpathSync(entries.find((e) => e.entry.path === "site/")!.abs)).toBe(realpathSync(join(snapshotDir, "iris-like", "subgraphs", "iris-site", "tree")));

    const routes = withRoutes(mountable(repo).filter((m) => m.name === "iris-like")).candidates.map((c) => c.route).sort();
    // site/ is the root and yields `docs/iris-like` to its same-kind sibling (bean `2b5s`).
    expect(routes).toEqual(["docs/iris-like", "iris-like"]);
  });

  test("a page embedding from another held directory resolves through the instance's layout", async () => {
    const { repo, snapshotDir } = await repoWith(["iris-site", "library"]);
    materialise(snapshotDir, "iris-site", "site", SITE);
    materialise(snapshotDir, "library", "library", { "cover.png": "png-bytes" });
    const site = subscribedMountEntries(repo).entries.find((e) => e.entry.path === "site/")!;
    const { assets, problems } = referencedAssets(site.abs, site.instanceDir);
    expect(problems).toEqual([]);
    expect(assets.map((a) => a.underInstance)).toEqual(["library/cover.png"]);
  });

  test("a chosen subgraph not held is reported, never an empty pass", async () => {
    const { repo } = await repoWith(["iris-site"]);
    const { entries, problems } = subscribedMountEntries(repo);
    expect(entries).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("host → iris-like/iris-site");
  });

  test("an instance both staged and subscribed publishes the staged copy, and says so", async () => {
    const { repo, snapshotDir } = await repoWith(["iris-site"]);
    materialise(snapshotDir, "iris-site", "site", SITE);
    mkdirSync(join(repo, "iris-like"));
    writeFileSync(join(repo, "iris-like", "iris-like.json"), JSON.stringify({ name: "iris-like", directories: [] }));
    const { entries, shadowed } = subscribedMountEntries(repo);
    expect(entries).toEqual([]);
    expect(shadowed[0]).toContain("also staged in this tree");
  });
});

describe("compose-docs composes a subscribed instance's composed directories", () => {
  test("a held directory the substrate declares `composed` is composed under the substrate's name", async () => {
    const { repo, snapshotDir } = await repoWith(["iris-notes", "iris-docs"]);
    materialise(snapshotDir, "iris-notes", "notes", { "index.md": "# notes" });
    materialise(snapshotDir, "iris-docs", "docs", { "index.html": "<html><body>docs</body></html>" });
    const composed = composedInstances(repo);
    // iris-docs is not marked composed, so it is mount-instance-docs' and not this one's.
    expect(composed.map((c) => [c.instance, c.under, c.root])).toEqual([
      ["iris-like", "iris-like", "host/subscriptions/iris-like/subgraphs/iris-notes/tree"],
    ]);
  });

  test("an instance also staged in the tree is composed from the staged copy alone", async () => {
    const { repo, snapshotDir } = await repoWith(["iris-notes"]);
    materialise(snapshotDir, "iris-notes", "notes", { "index.md": "# notes" });
    mkdirSync(join(repo, "iris-like"));
    writeFileSync(join(repo, "iris-like", "iris-like.json"), JSON.stringify({ name: "iris-like", directories: [] }));
    expect(composedInstances(repo)).toEqual([]);
  });
});

describe("the navbar tile of a subscribed harness (GAP 2)", () => {
  async function tile(subgraphs: string[], held: Record<string, [string, Record<string, string>]>) {
    const { repo, host, snapshotDir } = await repoWith(subgraphs);
    for (const [id, [path, files]] of Object.entries(held)) materialise(snapshotDir, id, path, files);
    const file = join(host, "host.json");
    const cur = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", [{ ...cur.subscriptions[0], harnesses: ["iris-like"] }]));
    // What `kg:instantiate` writes: the config at the instantiation root.
    writeFileSync(join(repo, "iris-like.config.json"), "{}\n");
    const decl = JSON.parse(readFileSync(file, "utf8"));
    const [h] = subscribedHarnesses(repo, [{ dir: host, decl }]);
    return subscribedTile(h!);
  }

  test("a held themed root makes the tile a link to /<instance>/, and its own avatar is read at the pin", async () => {
    const t = await tile(["iris-site", "iris-docs"], { "iris-site": ["site", SITE], "iris-docs": ["docs", { "index.html": "<html><body>d</body></html>" }] });
    expect(t.instantiated).toBe(true);
    expect(t.href).toBe("/iris-like/");
    expect(t.hrefKind).toBe("folio");
    expect(t.genericAvatar).toBe(false);
    expect(t.tone).toBe(199);
    expect(t.findings).toEqual([]);
    expect(t.subgraphs.filter((g) => g.where === "remote" && g.materialised).map((g) => g.id).sort()).toEqual(["iris-docs", "iris-site"]);
    expect(t.visualisations.find((v) => v.kind === "docs")?.note).toContain("held here");
  });

  test("chosen but not held: no link, and a finding — never an empty tile that looks fine", async () => {
    const t = await tile(["iris-site"], {});
    expect(t.href).toBeUndefined();
    expect(t.findings.join("\n")).toContain("could not be determined");
    expect(t.subgraphs.some((g) => g.where === "remote" && g.materialised)).toBe(false);
  });
});
