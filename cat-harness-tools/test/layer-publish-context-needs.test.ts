/**
 * `layer-publish-context.yml` takes the caller's dependency harness at main,
 * reading each layer's `needs` from its declaration AT MAIN (bean
 * folio-assistant-63q4). The walk is tested with a fake `take` that writes the
 * "main" declaration, so no test clones anything.
 *
 * @module test/layer-publish-context-needs.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { lockedInstances, needsOf, takeClosure } from "../.github/scripts/layer-publish-context/needs-at-main.ts";

const root = mkdtempSync(join(tmpdir(), "needs-at-main-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const decl = (name: string, needs: string[]) => {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name, needs }));
};

describe("needs-at-main", () => {
  test("the closure follows needs as declared at main, takes the always-layers, and never the caller", () => {
    decl("caller", ["mid"]);
    // The LOCKED mid needs nothing; at main it needs low. Main must win.
    decl("mid", []);
    const main: Record<string, string[]> = { mid: ["low"], low: [], tools: ["low", "caller"] };
    const taken = takeClosure(root, "caller", ["tools"], (name) => decl(name, main[name] ?? []));
    expect(taken).toEqual(["mid", "tools", "low"]);
    expect(taken).not.toContain("caller");
  });

  test("needsOf reads nothing for an absent or unreadable declaration", () => {
    expect(needsOf(root, "absent")).toEqual([]);
    mkdirSync(join(root, "broken"), { recursive: true });
    writeFileSync(join(root, "broken", "broken.json"), "{ nope");
    expect(needsOf(root, "broken")).toEqual([]);
  });

  test("the lock says where a layer lives, including a sub-directory instance", () => {
    writeFileSync(
      join(root, "index.lock.json"),
      JSON.stringify({ instances: [{ instance: "smart-base", repository: "litlfred/smart-base", upstreamRoot: "smart-base" }, { instance: "cat-harness", repository: "litlfred/cat-harness", upstreamRoot: "" }] }),
    );
    const l = lockedInstances(root);
    expect(l.get("smart-base")).toEqual({ repository: "litlfred/smart-base", upstreamRoot: "smart-base" });
    expect(l.get("cat-harness")?.upstreamRoot).toBe("");
  });

  test("the current lock's mounts carry the owner, so a layer moved to another owner is fetched from there", () => {
    writeFileSync(
      join(root, "index.lock.json"),
      JSON.stringify({ mounts: [{ harness: "smart-base", repository: "WorldHealthOrganization/smart-base", ref: "a".repeat(40) }, { harness: "dpi-h-ra", repository: "WorldHealthOrganization/smart-ra", ref: "b".repeat(40) }] }),
    );
    const l = lockedInstances(root);
    expect(l.get("smart-base")?.repository).toBe("WorldHealthOrganization/smart-base");
    expect(l.get("dpi-h-ra")?.repository).toBe("WorldHealthOrganization/smart-ra");
  });
});
