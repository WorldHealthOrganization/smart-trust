/**
 * Shared, layered site build steps (`site.build.extends`, `scripts/lib/site-presets.ts`) and the
 * link check that refuses the publish (cat-harness-tools#2345).
 *
 * smart-ra's site listed no glossary or bibliography step, so those pages were 404s, and the
 * link check that saw them only reported. These pin the two guards: a site that extends a
 * preset runs the preset's steps, and `links: refuse` counts every kind of unresolved link
 * except namespace IRIs.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isNamespaceIri, stepCommand, unresolvedCount } from "../build-instance-site.ts";
import { applyPreset, mergeSteps, parsePreset, PRESET_DIR, resolvePreset, skipReason, type RecipeSteps } from "../lib/site-presets.ts";

const put = (root: string, rel: string, value: unknown) => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), typeof value === "string" ? value : JSON.stringify(value));
};
const none = (): RecipeSteps => ({ pre: [], sourceSteps: [], siteSteps: [], finalSteps: [], scripts: {}, when: {} });

/** A checkout holding a base preset and one built on it, in two "layers" it mounts. */
function checkout(): string {
  const root = mkdtempSync(join(tmpdir(), "site-presets-"));
  put(root, `${PRESET_DIR}/test-base.json`, {
    links: "refuse",
    sourceSteps: ["site:context", "site:archimate"],
    scripts: { "site:context": "echo context", "site:archimate": "echo archimate" },
    when: { "site:archimate": "archimate/" },
  });
  put(root, `${PRESET_DIR}/test-document.json`, {
    extends: "test-base",
    pre: ["check:kg-blocks"],
    sourceSteps: ["site:document", "site:glossary", "site:bibliography"],
    scripts: { "site:glossary": "echo glossary $SITE_INSTANCE", "site:bibliography": "echo bibliography" },
  });
  put(root, `${PRESET_DIR}/test-loop-a.json`, { extends: "test-loop-b" });
  put(root, `${PRESET_DIR}/test-loop-b.json`, { extends: "test-loop-a" });
  return root;
}

describe("a site preset — shared, layered steps", () => {
  test("a preset that extends another runs the base's steps first, and merges scripts and when", () => {
    const { steps, chain } = resolvePreset(checkout(), "test-document");
    expect(chain.map((c) => c.split(" ")[0])).toEqual(["test-base", "test-document"]);
    expect(steps.pre).toEqual(["check:kg-blocks"]);
    expect(steps.sourceSteps).toEqual(["site:context", "site:archimate", "site:document", "site:glossary", "site:bibliography"]);
    expect(steps.links).toBe("refuse");
    expect(Object.keys(steps.scripts).sort()).toEqual(["site:archimate", "site:bibliography", "site:context", "site:glossary"]);
    expect(steps.when).toEqual({ "site:archimate": "archimate/" });
  });

  test("a site's own steps come after the preset's, a step named twice runs once, and its own links wins", () => {
    const own = { ...none(), sourceSteps: ["site:mapper", "site:context"], siteSteps: ["site:glossary"], links: "report" as const };
    const { steps } = applyPreset(checkout(), "test-document", own);
    // Named again in the same phase, a step takes the upper list's place.
    expect(steps.sourceSteps).toEqual(["site:archimate", "site:document", "site:glossary", "site:bibliography", "site:mapper", "site:context"]);
    // Named in two phases, it runs in the earlier one: the preset's.
    expect(steps.siteSteps).toEqual([]);
    expect(steps.links).toBe("report");
  });

  test("a site that leaves links undeclared gets the preset's refuse", () => {
    expect(applyPreset(checkout(), "test-document", none()).steps.links).toBe("refuse");
    expect(mergeSteps(none(), none()).links).toBeUndefined();
  });

  test("a missing preset, a preset declared twice and a loop are refused by name", () => {
    const root = checkout();
    expect(() => resolvePreset(root, "no-such-preset")).toThrow(/no-such-preset is declared by no layer/);
    expect(() => resolvePreset(root, "test-loop-a")).toThrow(/loop: test-loop-a → test-loop-b → test-loop-a/);
    expect(() => resolvePreset(root, "../x")).toThrow(/not a site preset name/);
    // A stray directory that declares no layer is not looked in.
    put(root, `stray/${PRESET_DIR}/test-base.json`, {});
    expect(resolvePreset(root, "test-base").chain).toHaveLength(1);
    // A mounted layer declaring the same name makes the choice depend on mount order: refused.
    put(root, `layer-x/${PRESET_DIR}/test-base.json`, {});
    put(root, "layer-x/layer-x.json", { name: "layer-x" });
    expect(() => resolvePreset(root, "test-base")).toThrow(/test-base is declared twice/);
  });

  test("a preset's fields are checked: step names, one-line commands, paths inside the checkout", () => {
    expect(() => parsePreset({ sourceSteps: ["rm -rf /"] }, "p")).toThrow(/sourceSteps/);
    expect(() => parsePreset({ scripts: { "site:x": "a\nb" } }, "p")).toThrow(/one-line command/);
    expect(() => parsePreset({ when: { "site:x": "../up" } }, "p")).toThrow(/inside the checkout/);
    expect(() => parsePreset({ links: "ignore" }, "p")).toThrow(/links/);
    expect(() => parsePreset({ extends: "Bad Name" }, "p")).toThrow(/extends/);
    expect(() => parsePreset([], "p")).toThrow(/JSON object/);
  });

  test("a step whose when path is absent is skipped with its reason; present, it runs", () => {
    const root = checkout();
    const when = { "site:archimate": "archimate/" };
    expect(skipReason(root, "site:archimate", when)).toBe("the checkout holds no archimate/");
    expect(skipReason(root, "site:glossary", when)).toBeUndefined();
    mkdirSync(join(root, "archimate"));
    expect(skipReason(root, "site:archimate", when)).toBeUndefined();
  });

  test("the checkout's own script wins over the preset's command; without either, run-script finds it", () => {
    const root = checkout();
    const scripts = { "site:glossary": "echo preset-glossary" };
    expect(stepCommand(root, "site:glossary", scripts)).toBe("echo preset-glossary");
    put(root, "package.json", { scripts: { "site:glossary": "echo own" } });
    expect(stepCommand(root, "site:glossary", scripts)).toBe("bun run site:glossary");
    expect(stepCommand(root, "site:other", scripts)).toContain("run-script.ts");
  });
});

describe("the link check — refuse counts every kind, never a namespace IRI", () => {
  test("namespace IRIs are not pages", () => {
    for (const u of ["/smart-ra/v0/ns", "https://worldhealthorganization.github.io/smart-ra/v0/ns#Term", "../v0/ns/graphTypology/x", "v1/ns/"]) expect(isNamespaceIri(u)).toBe(true);
    for (const u of ["/smart-ra/en/glossary/", "/smart-ra/en/v0nsx/", "/smart-ra/v0/nsx", "/smart-ra/ns/"]) expect(isNamespaceIri(u)).toBe(false);
  });

  test("refuse counts the platform's, the content's, self-address and diagram misses; report counts none", () => {
    const r = { misses: ["a"], upstreamMisses: ["b", "c"], selfMisses: ["d"], diagramMisses: ["e"] };
    expect(unresolvedCount(r, "refuse")).toBe(5);
    expect(unresolvedCount(r, "report")).toBe(0);
    expect(unresolvedCount(r)).toBe(0);
    expect(unresolvedCount({ misses: [], upstreamMisses: [], selfMisses: [], diagramMisses: [] }, "refuse")).toBe(0);
  });
});
