/**
 * The layer output resolver (bean `cat-tools-sm8r`, item 4, plan step 1):
 * a mounted layer's computed files go to `build/layers/<instance>/`, a local
 * layer's stay inside it, and a reader sees the computed file over the
 * pinned bytes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  LAYER_OUTPUT_ROOT,
  checkoutRoot,
  clearMountedCache,
  mountedInstances,
  outputPathFor,
  outputTwinOf,
  overlayDirs,
  overlayPath,
  readPathAt,
  readPathFor,
  writePathAt,
  writePathOf,
} from "../lib/layer-output.js";
import { movedInventory } from "../qa-verify-moved.js";
import { overlayEntries } from "../qa-store.js";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function checkout(lock?: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "layer-output-"));
  dirs.push(root);
  if (lock !== undefined) writeFileSync(join(root, "index.lock.json"), typeof lock === "string" ? lock : JSON.stringify(lock));
  return root;
}

const LOCK = {
  instances: [
    { instance: "upper-ig", path: "upper-ig", sha: "a".repeat(40) },
    { instance: "lower", path: "lower", sha: "b".repeat(40) },
  ],
};

describe("mountedInstances", () => {
  test("reads the lock's instances and their mount paths", () => {
    expect([...mountedInstances(checkout(LOCK))]).toEqual([
      ["upper-ig", "upper-ig"],
      ["lower", "lower"],
    ]);
  });

  test("no lock: nothing is mounted", () => {
    expect(mountedInstances(checkout()).size).toBe(0);
  });

  test("a lock that does not parse throws rather than reading as 'nothing mounted'", () => {
    expect(() => mountedInstances(checkout("{ not json"))).toThrow(/cannot be determined/);
  });
});

describe("outputPathFor", () => {
  test("a mounted instance writes under build/layers/<instance>/", () => {
    const root = checkout(LOCK);
    expect(outputPathFor(root, { instance: "upper-ig", path: "upper-ig" }, "fhir-artifact-index/index.json")).toBe(
      join(root, LAYER_OUTPUT_ROOT, "upper-ig", "fhir-artifact-index/index.json"),
    );
  });

  test("a local instance writes inside itself, as before", () => {
    const root = checkout(LOCK);
    expect(outputPathFor(root, { instance: "own", path: "own" }, "glossary/generated/x.json")).toBe(join(root, "own", "glossary/generated/x.json"));
    expect(outputPathFor(root, { instance: "root-instance", path: "" }, "test/results/a.json")).toBe(join(root, "test/results/a.json"));
  });
});

describe("readPathFor", () => {
  test("the computed file wins over the pinned bytes", () => {
    const root = checkout(LOCK);
    mkdirSync(join(root, "upper-ig/fhir-artifact-index"), { recursive: true });
    writeFileSync(join(root, "upper-ig/fhir-artifact-index/index.json"), "pinned");
    const out = join(root, LAYER_OUTPUT_ROOT, "upper-ig/fhir-artifact-index");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "index.json"), "computed");
    expect(readPathFor(root, { instance: "upper-ig", path: "upper-ig" }, "fhir-artifact-index/index.json")).toBe(join(out, "index.json"));
  });

  test("with nothing computed, the reader falls back to the mount", () => {
    const root = checkout(LOCK);
    expect(readPathFor(root, { instance: "lower", path: "lower" }, "a.json")).toBe(join(root, "lower", "a.json"));
  });
});

describe("outputTwinOf / readPathAt — a reader holding an absolute path", () => {
  test("a path in a mounted layer has a twin under the output root; a local or outside path has none", () => {
    const root = checkout(LOCK);
    expect(outputTwinOf(root, join(root, "upper-ig", "fhir-artifact-index"))).toBe(join(root, LAYER_OUTPUT_ROOT, "upper-ig", "fhir-artifact-index"));
    expect(outputTwinOf(root, join(root, "upper-ig"))).toBe(join(root, LAYER_OUTPUT_ROOT, "upper-ig"));
    expect(outputTwinOf(root, join(root, "upper-ig-other", "x"))).toBeUndefined();
    expect(outputTwinOf(root, join(root, "own", "x"))).toBeUndefined();
    expect(outputTwinOf(root, "/elsewhere/x")).toBeUndefined();
  });

  test("the twin when it exists, else the path itself — no writer at the output root changes nothing", () => {
    const root = checkout(LOCK);
    const abs = join(root, "upper-ig", "fhir-artifact-index", "index.json");
    expect(readPathAt(root, abs)).toBe(abs);
    const twin = join(root, LAYER_OUTPUT_ROOT, "upper-ig", "fhir-artifact-index");
    mkdirSync(twin, { recursive: true });
    writeFileSync(join(twin, "index.json"), "{}");
    expect(readPathAt(root, abs)).toBe(join(twin, "index.json"));
    expect(readPathAt(root, join(root, "upper-ig", "fhir-artifact-index"))).toBe(twin);
    expect(readPathAt(root, join(root, "own", "a.json"))).toBe(join(root, "own", "a.json"));
  });
});

describe("writePathAt — a writer holding an absolute path", () => {
  test("a path in a mounted layer is written at its twin; a local or outside path where it is", () => {
    const root = checkout(LOCK);
    expect(writePathAt(root, join(root, "upper-ig", "docs", "_data", "x.json"))).toBe(join(root, LAYER_OUTPUT_ROOT, "upper-ig", "docs", "_data", "x.json"));
    expect(writePathAt(root, join(root, "own", "docs", "x.json"))).toBe(join(root, "own", "docs", "x.json"));
    expect(writePathAt(root, "/elsewhere/x")).toBe("/elsewhere/x");
  });

  test("what a writer wrote is what readPathAt reads back", () => {
    const root = checkout(LOCK);
    const abs = join(root, "lower", "docs", "page.html");
    const at = writePathAt(root, abs);
    mkdirSync(join(at, ".."), { recursive: true });
    writeFileSync(at, "computed");
    expect(readPathAt(root, abs)).toBe(at);
  });

  test("the root is always the first argument, and a given mounted map is used without reading the lock", () => {
    const root = checkout();
    const mounted = new Map([["lower", "lower"]]);
    expect(writePathAt(root, join(root, "lower", "docs", "page.html"), mounted)).toBe(join(root, LAYER_OUTPUT_ROOT, "lower", "docs", "page.html"));
    expect(writePathAt(root, join(root, "lower", "docs", "page.html"))).toBe(join(root, "lower", "docs", "page.html"));
    expect(writePathAt(root, "/elsewhere/x", mounted)).toBe("/elsewhere/x");
  });
});

describe("derive-at-publish built() — an artefact of a mounted layer built at its output root", () => {
  test("a declared artefact counts as built when only its output-root twin holds it", async () => {
    const { built } = await import("../derive-at-publish.ts");
    const root = checkout(LOCK);
    const file = { abs: join(root, "lower", "docs", "_data", "x.json"), path: "docs/_data/x.json" };
    const dir = { abs: join(root, "lower", "docs", "pages"), path: "docs/pages/" };
    expect(built(file, root)).toBe(false);
    expect(built(dir, root)).toBe(false);
    for (const [at, body] of [[writePathAt(root, file.abs), "{}"], [join(writePathAt(root, dir.abs), "a", "index.html"), "<p>"]] as const) {
      mkdirSync(join(at, ".."), { recursive: true });
      writeFileSync(at, body);
    }
    expect(built(file, root)).toBe(true);
    expect(built(dir, root)).toBe(true);
  });
});

describe("overlayPath (step 5: the QA readers)", () => {
  test("the checkout is the nearest directory holding .git, not a mount carrying its own lock", () => {
    const root = checkout(LOCK);
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "lower", "test"), { recursive: true });
    writeFileSync(join(root, "lower", "index.lock.json"), "{}");
    expect(checkoutRoot(join(root, "lower", "test"))).toBe(root);
  });

  test("outside a checkout the path is unchanged", () => {
    expect(overlayPath("/x/lower/test/results/a.json", undefined)).toBe("/x/lower/test/results/a.json");
  });

  test("reads the computed twin over the pinned bytes, and the mount when there is none", () => {
    clearMountedCache();
    const root = checkout(LOCK);
    const pinned = join(root, "lower", "test", "results", "a.qa-results.json");
    expect(overlayPath(pinned, root)).toBe(pinned);
    const twin = join(root, LAYER_OUTPUT_ROOT, "lower", "test", "results", "a.qa-results.json");
    mkdirSync(join(twin, ".."), { recursive: true });
    writeFileSync(twin, "{}");
    expect(overlayPath(pinned, root)).toBe(twin);
  });

  test("an unparseable lock: a reader falls back to the pinned path", () => {
    clearMountedCache();
    const root = checkout("{ not json");
    const p = join(root, "lower", "x.json");
    expect(overlayPath(p, root)).toBe(p);
  });
});

describe("the QA inventory and publish see the overlay (step 5)", () => {
  function composed(): string {
    clearMountedCache();
    const root = checkout(LOCK);
    const res = join(root, "lower", "test", "results");
    mkdirSync(res, { recursive: true });
    writeFileSync(join(res, "pinned.json"), "1");
    writeFileSync(join(res, "both.json"), "old");
    const out = join(root, LAYER_OUTPUT_ROOT, "lower", "test", "results", "sub");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "computed.json"), "22");
    writeFileSync(join(out, "..", "both.json"), "newer");
    return root;
  }

  test("movedInventory is the union, keyed by the layer's own path, the output root winning", () => {
    const root = composed();
    const inv = movedInventory(root, ["lower/test/results"]);
    expect(inv.directories[0]!.files).toEqual([
      { path: "lower/test/results/both.json", bytes: 5, at: `${LAYER_OUTPUT_ROOT}/lower/test/results/both.json` },
      { path: "lower/test/results/pinned.json", bytes: 1 },
      { path: "lower/test/results/sub/computed.json", bytes: 2, at: `${LAYER_OUTPUT_ROOT}/lower/test/results/sub/computed.json` },
    ]);
    expect(inv.files).toBe(3);
  });

  test("overlayEntries names each computed file at its logical path", () => {
    const root = composed();
    expect(overlayEntries(root, ["lower/test/results"])).toEqual([
      { path: "lower/test/results/both.json", at: `${LAYER_OUTPUT_ROOT}/lower/test/results/both.json` },
      { path: "lower/test/results/sub/computed.json", at: `${LAYER_OUTPUT_ROOT}/lower/test/results/sub/computed.json` },
    ]);
  });

  test("with nothing mounted, both are what they were", () => {
    clearMountedCache();
    const root = checkout();
    mkdirSync(join(root, "own", "test", "results"), { recursive: true });
    writeFileSync(join(root, "own", "test", "results", "a.json"), "x");
    expect(movedInventory(root, ["own/test/results"]).directories[0]!.files).toEqual([{ path: "own/test/results/a.json", bytes: 1 }]);
    expect(overlayEntries(root, ["own/test/results"])).toEqual([]);
  });
});

describe("writePathOf and overlayDirs (step 5: the QA writers)", () => {
  test("a mounted layer's path is written under build/layers/<instance>/", () => {
    clearMountedCache();
    const root = checkout(LOCK);
    expect(writePathOf(join(root, "lower", "test", "results", "a.json"), root)).toBe(
      join(root, LAYER_OUTPUT_ROOT, "lower", "test", "results", "a.json"),
    );
  });

  test("a local layer's path, and one outside the checkout, are written where they are", () => {
    clearMountedCache();
    const root = checkout(LOCK);
    expect(writePathOf(join(root, "own", "test", "results", "a.json"), root)).toBe(join(root, "own", "test", "results", "a.json"));
    expect(writePathOf("/elsewhere/x.json", root)).toBe("/elsewhere/x.json");
    expect(writePathOf("/elsewhere/x.json", undefined)).toBe("/elsewhere/x.json");
  });

  test("a writer refuses an unparseable lock rather than writing into the mounts", () => {
    clearMountedCache();
    const root = checkout("{ not json");
    expect(() => writePathOf(join(root, "lower", "x.json"), root)).toThrow(/cannot be determined/);
  });

  test("overlayDirs lists the output root first, then the layer's own directory, each only if it exists", () => {
    clearMountedCache();
    const root = checkout(LOCK);
    const own = join(root, "lower", "test", "results");
    const twin = join(root, LAYER_OUTPUT_ROOT, "lower", "test", "results");
    expect(overlayDirs(own, root)).toEqual([]);
    mkdirSync(own, { recursive: true });
    expect(overlayDirs(own, root)).toEqual([own]);
    mkdirSync(twin, { recursive: true });
    expect(overlayDirs(own, root)).toEqual([twin, own]);
  });

  test("a file written via writePathOf is read back via overlayPath over the pinned copy", () => {
    clearMountedCache();
    const root = checkout(LOCK);
    const pinned = join(root, "lower", "test", "results", "r.json");
    mkdirSync(join(root, "lower", "test", "results"), { recursive: true });
    writeFileSync(pinned, "pinned");
    const dest = writePathOf(pinned, root);
    mkdirSync(join(root, LAYER_OUTPUT_ROOT, "lower", "test", "results"), { recursive: true });
    writeFileSync(dest, "computed");
    expect(overlayPath(pinned, root)).toBe(dest);
  });
});

describe("checkNavNames — reads a mounted layer's docs surfaces from its output-root twin", () => {
  test("reads _data/harness.json, navbar-footer.html, railed html pages, and rail data from build/layers/<instance>/", async () => {
    const { checkNavNames } = await import("../check-nav-names.ts");
    const root = checkout({
      instances: [{ instance: "cat-harness", path: "cat-harness", sha: "c".repeat(40) }],
    });
    writeFileSync(
      join(root, "index.config.json"),
      JSON.stringify({
        instances: {
          "cat-harness": { path: "cat-harness", declaration: "cat-harness.json" },
        },
      }),
    );
    mkdirSync(join(root, "cat-harness", "docs"), { recursive: true });
    writeFileSync(
      join(root, "cat-harness", "cat-harness.json"),
      JSON.stringify({
        instance: "cat-harness",
        title: "C@T Harness",
        version: "0.1.0",
        graphs: {
          docs: { path: "docs", publish: true },
          skills: { path: "skills", publish: true },
        },
      }),
    );

    const outDocs = join(root, LAYER_OUTPUT_ROOT, "cat-harness", "docs");
    mkdirSync(join(outDocs, "_data"), { recursive: true });
    mkdirSync(join(outDocs, "_includes", "generated"), { recursive: true });
    mkdirSync(join(outDocs, "assets", "rail-data"), { recursive: true });
    mkdirSync(join(outDocs, "skills"), { recursive: true });

    writeFileSync(
      join(outDocs, "_data", "harness.json"),
      JSON.stringify({
        graphs: {
          docs: { title: "Docs", nav_label: "Docs", icon: "📖" },
          skills: { title: "Skills", nav_label: "Skills", icon: "🧭" },
        },
      }),
    );
    writeFileSync(
      join(outDocs, "_data", "stickies.json"),
      JSON.stringify({ items: [{ scope: "skills", label: "Skills", icon: "🧭" }] }),
    );
    writeFileSync(
      join(outDocs, "_includes", "generated", "navbar-footer.html"),
      `<button data-rail-toggle="skills"><span class="rail-toggle-icon">🧭</span><span class="rail-toggle-label">Skills</span></button>`,
    );
    writeFileSync(
      join(outDocs, "skills", "index.html"),
      `---
title: Skills
rail_scope: skills
rail_title: Skills
rail_icon: "🧭"
---
<p>Skills</p>
`,
    );
    writeFileSync(
      join(outDocs, "assets", "rail-data", "skills.js"),
      `window.CAT_RAIL_DATA["skills"] = {"title":"Skills","icon":"🧭"};\n`,
    );

    const res = checkNavNames(root, join(root, "cat-harness", "docs"));
    expect(res.undetermined).toBeUndefined();
    expect(res.conflicts).toEqual([]);
    expect(res.templates).toEqual([]);
  });
});

