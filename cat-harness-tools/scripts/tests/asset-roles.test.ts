/**
 * The asset LAYER and the delivery path — bean `folio-assistant-7syd`.
 *
 * `instance-readme` and `agent-instructions` are declared on every layer
 * and, until this, said nothing about which layer they hold. The owner's word
 * on why that matters:
 *
 * > its static content at process runtime and treated as an asset like
 * > memories
 *
 * That is `context` word for word. Declaring it is what makes a step writing
 * one a DEFECT rather than an update, and these are the assertions that make
 * the declaration bite.
 *
 * @module scripts/tests/asset-roles
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AGENT_INSTRUCTIONS_ROLE, ASSET_ROLES, INSTANCE_README_ROLE, REQUIRED_ASSET_ROLES, ROLE_OWNED_ASSET_KEYS, assetRoleDelivery, assetRoleLayer, assetRolePurpose, declaredAssetPath, graphLayer, layerIsWritable, processMayWrite, processMayWriteAsset, strayAssetRoleKeys } from "../../schemas/kg/cat-harness.js";
import { collect, formatReport, isClean } from "../check-asset-roles.js";
import { layerRootsIn } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * The harness's injection budget, restated here as the number the delivery
 * rule is ABOUT rather than imported — `agent-memory.ts` owns it for memory
 * entries, and borrowing that constant would make this test pass by
 * construction if the budget ever moved for a reason unrelated to assets.
 */
const INJECTION_BUDGET_LINES = 200;

describe("the layer both required roles hold", () => {
  test("`instance-readme` and `agent-instructions` declare `context`", () => {
    // Named individually rather than looped, so a failure says WHICH moved.
    expect({
      [INSTANCE_README_ROLE]: assetRoleLayer(INSTANCE_README_ROLE),
      [AGENT_INSTRUCTIONS_ROLE]: assetRoleLayer(AGENT_INSTRUCTIONS_ROLE),
    }).toEqual({
      [INSTANCE_README_ROLE]: "context",
      [AGENT_INSTRUCTIONS_ROLE]: "context",
    });
  });

  test("so no running process may write either", () => {
    for (const role of REQUIRED_ASSET_ROLES) {
      expect([role, processMayWriteAsset(role)]).toEqual([role, false]);
    }
  });

  test("an ungoverned role is `undefined`, not `false` — the third state", () => {
    // `bootstrap-initialization` is bootstrap's role, and a layer
    // invented for it here would be this layer speaking for one it does not
    // own. A caller must be able to tell "not ours" from "ours, and read-only":
    // the first sends them to another layer, the second is an answer.
    expect(assetRoleLayer("bootstrap-initialization")).toBeUndefined();
    expect(processMayWriteAsset("bootstrap-initialization")).toBeUndefined();
    expect(assetRolePurpose("bootstrap-initialization")).toBeUndefined();
  });

  test("assets and graphs share ONE rule about what `context` permits", () => {
    // The property `layerIsWritable` was extracted for. If these ever diverge,
    // a `context` directory and a `context` asset mean different things and
    // the word has stopped carrying a rule.
    expect(layerIsWritable("context")).toBe(false);
    expect(layerIsWritable("state")).toBe(true);
    expect(processMayWrite("memory")).toBe(layerIsWritable(graphLayer("memory")!));
    for (const role of REQUIRED_ASSET_ROLES) {
      expect([role, processMayWriteAsset(role)]).toEqual([
        role,
        layerIsWritable(assetRoleLayer(role)!),
      ]);
    }
  });

  test("both required roles hold the same layer agent memory does", () => {
    // *"treated as an asset like memories"* — the owner's own comparison, and
    // this is the assertion that makes it one fact rather than two that happen
    // to agree today.
    for (const role of REQUIRED_ASSET_ROLES) {
      expect([role, assetRoleLayer(role)]).toEqual([role, graphLayer("memory")]);
    }
  });
});

describe("the delivery path — read as a file, with no injection budget", () => {
  test("both required roles declare `file`", () => {
    for (const role of REQUIRED_ASSET_ROLES) {
      expect([role, assetRoleDelivery(role)]).toEqual([role, "file"]);
    }
  });

  /**
   * The longest file this checkout DECLARES in `role`, and its length.
   *
   * It measured the checkout root's own files until 2026-10-09. The root of
   * an index checkout declares no layer, and its AGENTS.md and README are
   * RENDERED indexes (owner, option a) — short, and no layer's asset — so
   * the rule's observable consequence is now carried by whichever declared
   * file is longest: the harness layer's own AGENTS.md, which took the root's
   * pointers, and bootstrap's README.
   */
  function longestDeclared(role: string): { path: string; lines: number } | undefined {
    let best: { path: string; lines: number } | undefined;
    for (const root of layerRootsIn(REPO)) {
      const path = declaredAssetPath(root, role);
      if (path === undefined || !existsSync(path)) continue;
      const lines = readFileSync(path, "utf8").split("\n").length;
      if (best === undefined || lines > best.lines) best = { path, lines };
    }
    return best;
  }

  test("this checkout's longest declared `AGENTS.md` is far past the injection budget", () => {
    // The assertion that makes `delivery: "file"` bite rather than restate
    // itself. A file is OPENED, so nothing truncates it; memory is SPLICED
    // into a prompt and pays the budget, with the overflow dropped silently.
    //
    // So the rule has an observable consequence right here: an `AGENTS.md`
    // this long is legal precisely because it is delivered as a file. Were
    // the role ever switched to `injected`, every line past the budget would
    // vanish without a word — and this test is what says so before a reader
    // finds out by losing half the file.
    const longest = longestDeclared(AGENT_INSTRUCTIONS_ROLE);
    expect(longest).toBeDefined();
    expect(longest!.lines).toBeGreaterThan(INJECTION_BUDGET_LINES);
    expect(assetRoleDelivery(AGENT_INSTRUCTIONS_ROLE)).toBe("file");
  });

  test("and so is the longest declared README", () => {
    const longest = longestDeclared(INSTANCE_README_ROLE);
    expect(longest).toBeDefined();
    expect(longest!.lines).toBeGreaterThan(INJECTION_BUDGET_LINES);
  });
});

describe("one table, and the keys an asset may not restate", () => {
  test("every governed role decides all three fields", () => {
    for (const [role, def] of Object.entries(ASSET_ROLES)) {
      expect([role, typeof def.purpose, def.layer, def.delivery]).toEqual([
        role,
        "string",
        def.layer,
        def.delivery,
      ]);
      expect(def.purpose.length).toBeGreaterThan(0);
      expect(["content", "context", "state", "derived"]).toContain(def.layer);
      expect(["file", "injected"]).toContain(def.delivery);
    }
  });

  test("the forbidden keys are exactly the role's own fields", () => {
    // Derived from `AssetRoleDef`, so adding a field cannot leave the list
    // behind — the drift this whole mechanism exists to catch, one level up.
    expect([...ROLE_OWNED_ASSET_KEYS].sort()).toEqual(
      Object.keys(ASSET_ROLES[INSTANCE_README_ROLE]!).sort() as typeof ROLE_OWNED_ASSET_KEYS[number][],
    );
  });

  test("a stray key on an asset is reported, with the instance and the asset", () => {
    const root = mkdtempSync(join(tmpdir(), "asset-roles-"));
    writeDeclaration(root, JSON.stringify({
        // `name`, not `id`: the filename stem must equal the declared name or
        // discovery does not see the file at all. Under `harness.json` this
        // fixture worked with neither, because the path was a constant.
        name: "probe",
        directories: [],
        assets: [
          { id: "readme", src: "README.md", role: INSTANCE_README_ROLE, layer: "state" },
          { id: "agents", src: "AGENTS.md", role: AGENT_INSTRUCTIONS_ROLE },
        ],
      }));
    expect(strayAssetRoleKeys(root)).toEqual([{ root, asset: "readme", key: "layer" }]);
  });

  test("the report names the asset, because 'some instance' is not actionable", () => {
    const text = formatReport({
      ungoverned: [],
      writable: [],
      stray: [{ root: "/x/who-iris", asset: "readme", key: "purpose" }],
      instances: 3,
    });
    expect(text).toContain("/x/who-iris");
    expect(text).toContain("readme");
    expect(text).toContain("purpose");
  });

  test("zero declarations read is NOT a pass", () => {
    const empty = { ungoverned: [], writable: [], stray: [], instances: 0 };
    expect(isClean(empty)).toBe(false);
    expect(formatReport(empty)).toContain("NOTHING WAS EXAMINED");
  });

  test("the counts print even when everything passes", () => {
    const text = formatReport({ ungoverned: [], writable: [], stray: [], instances: 12 });
    expect(text).toContain("12 declaration(s) read");
    expect(text).toContain("0 stray key(s)");
  });

  test("an unparseable declaration yields no stray finding and no crash", () => {
    // Reported loudly by `readDeclaration`, which throws; raising it a second
    // time here would send a reader to the wrong check.
    const root = mkdtempSync(join(tmpdir(), "asset-roles-bad-"));
    writeDeclaration(root, "{ not json", "broken");
    expect(strayAssetRoleKeys(root)).toEqual([]);
  });

  test("an instance with no declaration at all yields nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "asset-roles-none-"));
    mkdirSync(join(root, "sub"));
    expect(strayAssetRoleKeys(root)).toEqual([]);
  });
});

describe("this repository passes its own gate", () => {
  test("no ungoverned role, nothing writable, no stray key", () => {
    const report = collect(REPO);
    expect({
      ungoverned: report.ungoverned,
      writable: report.writable,
      stray: report.stray,
    }).toEqual({ ungoverned: [], writable: [], stray: [] });
    expect(report.instances).toBeGreaterThan(0);
    expect(isClean(report)).toBe(true);
  });
});
