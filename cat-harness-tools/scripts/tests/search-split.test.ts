/**
 * search-split — the site index cut into one index per scope (bean `m7mn`,
 * issue #1972 step A).
 *
 * What must hold for a reader's search to stay correct when it loads a scope
 * instead of the whole: every entry lands in exactly ONE scope (the scopes
 * partition the source), the scope rule reads only declared facts, and the
 * output is the same bytes for the same index.
 *
 * The tests of this file that read the whole checkout (reads the layers the
 * checkout's site mounts) live in `test/search-split-checkout.test.ts` (bean
 * `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createHash } from "node:crypto";

import {
  MANIFEST_SCHEMA,
  STABLE_KEY_HEX,
  stableKeys,
  PLATFORM,
  SCOPES_DIR,
  SOURCE_PATH,
  ID_LOOKUP_DIR,
  PREBUILT_TOKEN_BUDGET,
  SECTION_BUDGET_BYTES,
  TOKENIZER_SEPARATOR,
  buildIndex,
  publishedLookups,
  harnessRootIn,
  render,
  scopeOf,
  splitSite,
  sectionOfPath,
  split,
  tokenCount,
  type SearchManifest,
} from "../search-split.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCES = new Set(["smart-trust", "who-iris"]);
const LOCALES = new Set(["fr", "ar"]);

describe("scopeOf", () => {
  test("an instance route is that instance's scope", () => {
    expect(scopeOf("/smart-trust/artifacts.html#x", INSTANCES, LOCALES)).toEqual({ id: "smart-trust", kind: "instance" });
  });
  test("a kind route (/<kind>/<instance>/…) is the instance's scope too", () => {
    expect(scopeOf("/library/who-iris/item.html", INSTANCES, LOCALES)).toEqual({ id: "who-iris", kind: "instance" });
  });
  test("a target-locale prefix is that locale's scope", () => {
    expect(scopeOf("/fr/getting-started.html", INSTANCES, LOCALES)).toEqual({ id: "locale-fr", kind: "locale" });
  });
  test("anything else is the platform's", () => {
    for (const u of ["/", "/reference/x.html", "/es/page.html", ""]) {
      expect(scopeOf(u, INSTANCES, LOCALES)).toEqual({ id: PLATFORM, kind: "platform" });
    }
  });
  test("the first segment wins over the second", () => {
    // `/fr/smart-trust/` is a French page that mentions the layer in its path.
    expect(scopeOf("/fr/smart-trust/x.html", INSTANCES, LOCALES).id).toBe("locale-fr");
  });
});

const INDEX = {
  "0": { title: "Home", relUrl: "/" },
  "1": { title: "Trust", relUrl: "/smart-trust/index.html" },
  "2": { title: "Trust 2", relUrl: "/smart-trust/a.html#b" },
  "3": { title: "Accueil", relUrl: "/fr/index.html" },
  "4": { title: "IRIS", relUrl: "/library/who-iris/" },
  "5": { title: "No url" },
};

describe("split", () => {
  test("partitions: every entry in exactly one scope, keys kept", () => {
    const parts = split(INDEX, INSTANCES, LOCALES);
    const keys = [...parts.values()].flatMap((p) => Object.keys(p.entries)).sort();
    expect(keys).toEqual(Object.keys(INDEX).sort());
    expect(Object.keys(parts.get("smart-trust")!.entries)).toEqual(["1", "2"]);
    expect(Object.keys(parts.get(PLATFORM)!.entries)).toEqual(["0", "5"]);
  });
});

describe("render", () => {
  const text = JSON.stringify(INDEX);
  const files = render(text, INSTANCES, LOCALES);
  const manifest = JSON.parse(files.get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;

  test("the manifest names every scope file and partitions the source", () => {
    expect(manifest.$schema).toBe(MANIFEST_SCHEMA);
    expect(manifest.source.path).toBe(SOURCE_PATH);
    expect(manifest.source.entries).toBe(6);
    expect(manifest.scopes.reduce((n, s) => n + s.entries, 0)).toBe(6);
    for (const s of manifest.scopes) {
      const body = files.get(s.path)!;
      expect(Object.keys(JSON.parse(body)).length).toBe(s.entries);
      expect(Buffer.byteLength(body)).toBe(s.bytes);
    }
    expect(manifest.scopes.map((s) => s.id)).toEqual(["_platform", "locale-fr", "smart-trust", "who-iris"]);
  });

  test("deterministic: the same index gives the same bytes", () => {
    const again = render(text, INSTANCES, LOCALES);
    expect([...again.entries()]).toEqual([...files.entries()]);
  });

  test("scope files key entries by URL hash, unique across scopes", () => {
    const keys = manifest.scopes.flatMap((s) => Object.keys(JSON.parse(files.get(s.path)!)));
    expect(new Set(keys).size).toBe(6);
    for (const k of keys) expect(k).toMatch(new RegExp(`^[0-9a-f]{${STABLE_KEY_HEX}}(-\\d+)?$`));
    expect(stableKeys(INDEX).get("1")).toBe(createHash("sha256").update("/smart-trust/index.html").digest("hex").slice(0, STABLE_KEY_HEX));
  });

  test("the same URL twice gets distinct keys, first in source order keeps the bare hash", () => {
    const k = stableKeys({ a: { relUrl: "/x" }, b: { relUrl: "/x" }, c: { relUrl: "/x" } });
    const base = k.get("a")!;
    expect([k.get("b"), k.get("c")]).toEqual([`${base}-2`, `${base}-3`]);
  });

  test("a page added to one scope leaves every other scope's files byte for byte", () => {
    // The theme numbers entries in order: a new platform page at the front shifts every key after it.
    const shifted: Record<string, unknown> = { "0": { title: "New", relUrl: "/new.html" } };
    Object.values(INDEX).forEach((e, i) => (shifted[String(i + 1)] = e));
    const after = render(JSON.stringify(shifted), INSTANCES, LOCALES);
    const changed = [...after.keys()].filter((p) => after.get(p) !== files.get(p)).sort();
    expect(changed).toEqual([`${SCOPES_DIR}/_platform.json`, `${SCOPES_DIR}/manifest.json`]);
  });

  test("the source hash changes with the source", () => {
    const other = render(JSON.stringify({ ...INDEX, "6": { relUrl: "/x" } }), INSTANCES, LOCALES);
    const m2 = JSON.parse(other.get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
    expect(m2.source.sha256).not.toBe(manifest.source.sha256);
  });
});

describe("the CLI", () => {
  const script = resolve(import.meta.dir, "..", "search-split.ts");
  test("writes, then --check is current; a changed scope file is stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-split-"));
    try {
      mkdirSync(join(dir, "assets/js"), { recursive: true });
      writeFileSync(join(dir, SOURCE_PATH), JSON.stringify(INDEX));
      const run = (...a: string[]) => Bun.spawnSync(["bun", "run", script, "--dir", dir, ...a]);
      expect(run().exitCode).toBe(0);
      expect(run("--check").exitCode).toBe(0);
      const m = JSON.parse(readFileSync(join(dir, SCOPES_DIR, "manifest.json"), "utf-8")) as SearchManifest;
      writeFileSync(join(dir, m.scopes[0]!.path), "{}");
      expect(run("--check").exitCode).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a tree with no index is refused, not split into nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-split-empty-"));
    try {
      expect(Bun.spawnSync(["bun", "run", script, "--dir", dir]).exitCode).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("platform sections over the budget — bean mm2n", () => {
  test("sectionOfPath: below a section, or its index; never a page at the root", () => {
    expect(sectionOfPath("/reference/skills.html")).toBe("reference");
    expect(sectionOfPath("/reference/")).toBe("reference");
    expect(sectionOfPath("/reference/a/b.html")).toBe("reference");
    expect(sectionOfPath("/getting-started.html")).toBeUndefined();
    expect(sectionOfPath("/")).toBeUndefined();
  });

  const big = "x".repeat(400);
  const idx = {
    0: { relUrl: "/", content: "home" },
    1: { relUrl: "/reference/", content: big },
    2: { relUrl: "/reference/a.html", content: big },
    3: { relUrl: "/guides/g.html", content: "small" },
    4: { relUrl: "/smart-trust/t.html", content: big },
    5: { relUrl: "/getting-started.html", content: big },
  };
  // A budget the reference section (two ~430-byte entries) crosses and the
  // others do not — the real 512 KiB is tested by what it is, not by size.
  const parts = split(idx, INSTANCES, LOCALES, 600);

  test("a section over the budget becomes its own scope, index page included", () => {
    expect(parts.get("section-reference")?.scope).toEqual({ id: "section-reference", kind: "section" });
    expect(Object.keys(parts.get("section-reference")!.entries)).toEqual(["1", "2"]);
  });

  test("a section under it, and pages at the root, stay in the platform", () => {
    expect(Object.keys(parts.get(PLATFORM)!.entries)).toEqual(["0", "3", "5"]);
    expect(parts.has("section-guides")).toBe(false);
  });

  test("instances are never cut into sections, and the partition stays exact", () => {
    expect(Object.keys(parts.get("smart-trust")!.entries)).toEqual(["4"]);
    const all = [...parts.values()].flatMap((p) => Object.keys(p.entries)).sort();
    expect(all).toEqual(Object.keys(idx).sort());
  });

  test("the default budget is 512 KiB, and render threads a given one through to the manifest", () => {
    expect(SECTION_BUDGET_BYTES).toBe(512 * 1024);
    const m = JSON.parse(render(JSON.stringify(idx), INSTANCES, LOCALES, 600).get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
    expect(m.scopes.filter((s) => s.kind === "section").map((s) => s.id)).toEqual(["section-reference"]);
    const none = JSON.parse(render(JSON.stringify(idx), INSTANCES, LOCALES).get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
    expect(none.scopes.some((s) => s.kind === "section")).toBe(false);
  });
});

describe("remote identifier lookups — bean 1br0", () => {
  const tree = (pageToo: boolean, indexes: Record<string, unknown>) => {
    const site = mkdtempSync(join(tmpdir(), "search-split-remote-"));
    mkdirSync(join(site, ID_LOOKUP_DIR), { recursive: true });
    if (pageToo) writeFileSync(join(site, ID_LOOKUP_DIR, "index.html"), "<p>lookup</p>");
    for (const [name, manifest] of Object.entries(indexes)) {
      mkdirSync(join(site, ID_LOOKUP_DIR, name), { recursive: true });
      writeFileSync(join(site, ID_LOOKUP_DIR, name, "manifest.json"), typeof manifest === "string" ? manifest : JSON.stringify(manifest));
    }
    return site;
  };

  test("every published index is named, with its entry count and a link that opens it", () => {
    const site = tree(true, { "who-iris": { entryCount: 10 }, "b-other": { entryCount: 3 } });
    try {
      expect(publishedLookups(site)).toEqual([
        { id: "b-other", kind: "id-lookup", href: "id-lookup/?index=b-other/", entries: 3 },
        { id: "who-iris", kind: "id-lookup", href: "id-lookup/?index=who-iris/", entries: 10 },
      ]);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });

  test("no lookup page, or an unreadable index, is nothing to link to", () => {
    const noPage = tree(false, { "who-iris": { entryCount: 10 } });
    const bad = tree(true, { "who-iris": "not json" });
    try {
      expect(publishedLookups(noPage)).toEqual([]);
      expect(publishedLookups(bad)).toEqual([]);
    } finally {
      rmSync(noPage, { recursive: true, force: true });
      rmSync(bad, { recursive: true, force: true });
    }
  });

  test("render puts them in the manifest, and leaves the key out when there are none", () => {
    const r = [{ id: "who-iris", kind: "id-lookup" as const, href: "id-lookup/?index=who-iris/", entries: 10 }];
    const withRemote = JSON.parse(render(JSON.stringify(INDEX), INSTANCES, LOCALES, SECTION_BUDGET_BYTES, r).get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
    expect(withRemote.remote).toEqual(r);
    const without = JSON.parse(render(JSON.stringify(INDEX), INSTANCES, LOCALES).get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;
    expect("remote" in without).toBe(false);
  });
});

describe("prebuilt indexes for scopes over the token budget — bean lrzn", () => {
  const DOCS = {
    0: { title: "Gates", content: "Every gate CI runs.", relUrl: "/gates/" },
    1: { title: "Trust lists", content: "Trust lists of the network, a long page about trust.", relUrl: "/smart-trust/lists.html" },
    2: { title: "Trust", content: "x", relUrl: "/smart-trust/x.html" },
  };
  const text = JSON.stringify(DOCS);
  const manifestOf = (files: Map<string, string>) => JSON.parse(files.get(`${SCOPES_DIR}/manifest.json`)!) as SearchManifest;

  test("the default budget is 128 Ki tokens, and tokens are counted over the theme's three fields", () => {
    expect(PREBUILT_TOKEN_BUDGET).toBe(128 * 1024);
    // "Gates" + "Every gate CI runs." + "/gates/" → gates | every gate ci runs. | gates
    expect(tokenCount({ 0: DOCS[0] })).toBe(1 + 4 + 1);
  });

  test("only a scope OVER the budget is prebuilt, and the manifest names its index", () => {
    const st = tokenCount({ 1: DOCS[1], 2: DOCS[2] });
    const pl = tokenCount({ 0: DOCS[0] });
    expect(st).toBeGreaterThan(pl);
    const files = render(text, INSTANCES, LOCALES, SECTION_BUDGET_BYTES, [], pl); // platform AT the budget: not over
    const m = manifestOf(files);
    const byId = Object.fromEntries(m.scopes.map((s) => [s.id, s]));
    expect(byId[PLATFORM]!.index).toBeUndefined();
    expect(byId["smart-trust"]!.index).toEqual({ path: `${SCOPES_DIR}/smart-trust.idx.json`, bytes: Buffer.byteLength(files.get(`${SCOPES_DIR}/smart-trust.idx.json`)!) });
    expect(files.has(`${SCOPES_DIR}/${PLATFORM}.idx.json`)).toBe(false);
  });

  test("the default budget prebuilds nothing small, and the output is the same bytes every time", () => {
    expect(manifestOf(render(text, INSTANCES, LOCALES)).scopes.some((s) => s.index)).toBe(false);
    const a = render(text, INSTANCES, LOCALES, SECTION_BUDGET_BYTES, [], 0);
    const b = render(text, INSTANCES, LOCALES, SECTION_BUDGET_BYTES, [], 0);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test("the index is the one the theme's own buildSearchIndex builds, and loads to the same answers", async () => {
    // Render the site's theme override as Jekyll would, and run its builder.
    const { Liquid } = await import("liquidjs");
    const root = resolve(HARNESS_ROOT);
    const src = readFileSync(join(root, siteFileFor(root, "assets/js/just-the-docs.js")), "utf8").replace(/^---[\s\S]*?---\n/, "");
    const liquid = new Liquid({ dynamicPartials: false, templates: { "lunr/custom-index.js": "", "js/custom.js": "" } });
    liquid.registerFilter("relative_url", (p: string) => p);
    // As Jekyll renders the theme's default (liquidjs drops its backslashes).
    const js = await liquid.parseAndRender(src, { site: { search_enabled: true, search: { tokenizer_separator: TOKENIZER_SEPARATOR.toString() } } });
    expect(src).toContain(`default: "${TOKENIZER_SEPARATOR.toString()}"`); // our separator IS the theme's default
    const body = js.slice(js.indexOf("function setSearchSeparator()"), js.indexOf("// 2tfy: the reader focused"));
    // @ts-expect-error -- lunr ships no types (see search-split.ts).
    const lunr = (await import("lunr")).default;
    // input-site: inert #ac6c3af7 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
    const theme = new Function("lunr", `${body}; return { build: buildSearchIndex, load: loadSearchIndex };`)(lunr) as {
      build(d: unknown): { toJSON(): unknown; search(q: string): { ref: string }[] };
      load(s: unknown): { search(q: string): { ref: string }[] };
    };
    const built = theme.build(DOCS);
    expect(JSON.stringify(buildIndex(DOCS))).toBe(JSON.stringify(built.toJSON()));
    const loaded = theme.load(JSON.parse(JSON.stringify(buildIndex(DOCS))));
    for (const q of ["trust", "gate", "lists network", "smart"]) expect(loaded.search(q)).toEqual(built.search(q));
  });
});

describe("splitSite — scoped by the checkout the site was built from (who-iris search, 2026-11-13)", () => {
  // A folio checkout: its own layer at the root, the layers it mounts one level down.
  const checkout = () => {
    const repo = mkdtempSync(join(tmpdir(), "search-split-repo-"));
    writeFileSync(join(repo, "who-iris.json"), JSON.stringify({ name: "who-iris" }));
    for (const layer of ["cat-harness", "smart-base"]) {
      mkdirSync(join(repo, layer), { recursive: true });
      writeFileSync(join(repo, layer, `${layer}.json`), JSON.stringify({ name: layer }));
    }
    return repo;
  };
  const site = (index: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), "search-split-site-"));
    mkdirSync(join(dir, "assets/js"), { recursive: true });
    writeFileSync(join(dir, SOURCE_PATH), JSON.stringify(index));
    return dir;
  };
  const idx = {
    0: { relUrl: "/", title: "home" },
    1: { relUrl: "/catalogue/", title: "catalogue" },
    2: { relUrl: "/smart-base/p.html", title: "mounted layer" },
    3: { relUrl: "/library/cat-harness/x.html", title: "kind route" },
  };

  test("writes the manifest and one file per scope, the mounted layers each a scope of their own", () => {
    const repo = checkout();
    const dir = site(idx);
    try {
      const out = splitSite(dir, repo, { harnessRoot: HARNESS_ROOT })!;
      const m = JSON.parse(readFileSync(join(dir, SCOPES_DIR, "manifest.json"), "utf-8")) as SearchManifest;
      expect(m).toEqual(out.manifest);
      const got = new Map(m.scopes.map((s): [string, (string | number)[]] => [s.id, [s.kind, s.entries]]));
      expect(got).toEqual(
        new Map<string, (string | number)[]>([
          [PLATFORM, ["platform", 2]],
          ["cat-harness", ["instance", 1]],
          ["smart-base", ["instance", 1]],
        ]),
      );
      // The checkout's own layer is the site's root: never a scope of its own.
      expect(m.scopes.some((s) => s.id === "who-iris")).toBe(false);
      for (const s of m.scopes) expect(readFileSync(join(dir, s.path), "utf-8").length).toBe(s.bytes);
      expect(splitSite(dir, repo, { harnessRoot: HARNESS_ROOT, check: true })!.stale).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a site with no theme index is nothing to split, and nothing is written", () => {
    const repo = checkout();
    const dir = mkdtempSync(join(tmpdir(), "search-split-none-"));
    try {
      expect(splitSite(dir, repo, { harnessRoot: HARNESS_ROOT })).toBeUndefined();
      expect(existsSync(join(dir, SCOPES_DIR))).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the harness is the checkout's declared cat-harness layer; with none, the resolved harness", () => {
    const repo = checkout();
    const bare = mkdtempSync(join(tmpdir(), "search-split-bare-"));
    try {
      expect(harnessRootIn(repo)).toBe(join(repo, "cat-harness"));
      expect(harnessRootIn(bare)).toBe(resolve(HARNESS_ROOT));
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
