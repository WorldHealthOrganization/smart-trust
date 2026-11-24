/**
 * `resolveLandingInstance` and `check:landing-instance` (issue #1904).
 *
 * The owner's ruling, 2026-10-02: one instantiated harness lands with no flag;
 * several with exactly one flagged land on that one; several with none
 * flagged fail the gate; two or more flagged give a neutral hub.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { instantiatedHarnessNames, resolveLandingInstance, rootInstanceName } from "./kg/harness-config.ts";
import { formatLanding } from "../scripts/check-landing-instance";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A checkout root holding one `<name>.config.json` per entry. */
function rootWith(configs: Record<string, unknown>, folder = "smart-trust"): string {
  const parent = mkdtempSync(join(tmpdir(), "landing-"));
  made.push(parent);
  const root = join(parent, folder);
  mkdirSync(root);
  for (const [name, body] of Object.entries(configs)) {
    writeFileSync(join(root, `${name}.config.json`), typeof body === "string" ? body : JSON.stringify(body));
  }
  return root;
}

const flag = { contentType: "document", site: { landing: true } };
const plain = { contentType: "document" };

describe("resolveLandingInstance", () => {
  test("one instantiated harness is the landing, with no flag (the smart-trust case)", () => {
    const r = resolveLandingInstance(rootWith({ "smart-base": plain }));
    expect(r).toEqual({ kind: "instance", name: "smart-base", by: "sole", names: ["smart-base"] });
    expect(formatLanding(r).ok).toBe(true);
  });

  test("several, exactly one flagged: the flagged one", () => {
    const r = resolveLandingInstance(rootWith({ bootstrap: plain, "cat-harness": flag, "who-iris": plain }));
    expect(r.kind).toBe("instance");
    expect(r.kind === "instance" && r.name).toBe("cat-harness");
    expect(r.kind === "instance" && r.by).toBe("flag");
    expect(formatLanding(r).ok).toBe(true);
  });

  test("several, none flagged: ambiguous, and the gate fails", () => {
    const r = resolveLandingInstance(rootWith({ bootstrap: plain, "cat-harness": plain }));
    expect(r).toEqual({ kind: "ambiguous", names: ["bootstrap", "cat-harness"], reason: "none-flagged", unreadable: [] });
    expect(formatLanding(r).ok).toBe(false);
  });

  test("`landing: false` is not a flag", () => {
    const r = resolveLandingInstance(rootWith({ a: { site: { landing: false } }, b: plain }));
    expect(r.kind).toBe("ambiguous");
  });

  test("several, two or more flagged: the neutral hub, listing every harness", () => {
    const r = resolveLandingInstance(rootWith({ a: flag, b: flag, c: plain }));
    expect(r).toEqual({ kind: "hub", names: ["a", "b", "c"], flagged: ["a", "b"] });
    expect(formatLanding(r).ok).toBe(true);
  });

  test("nothing instantiated is its own state, not a default", () => {
    const r = resolveLandingInstance(rootWith({}));
    expect(r).toEqual({ kind: "none", names: [] });
    expect(formatLanding(r).ok).toBe(true);
  });

  test("an unreadable config among several cannot be decided", () => {
    const r = resolveLandingInstance(rootWith({ a: flag, b: "{ not json" }));
    expect(r.kind === "ambiguous" && r.reason).toBe("unreadable");
    expect(r.kind === "ambiguous" && r.unreadable).toEqual(["b"]);
    expect(formatLanding(r).ok).toBe(false);
  });

  test("a non-boolean flag is unreadable rather than truthy", () => {
    const r = resolveLandingInstance(rootWith({ a: { site: { landing: "yes" } }, b: plain }));
    expect(r.kind === "ambiguous" && r.reason).toBe("unreadable");
  });

  test("the retired global `harness.config.json` is not an instance", () => {
    expect(instantiatedHarnessNames(rootWith({ harness: plain, a: plain }))).toEqual(["a"]);
  });
});

describe("rootInstanceName — never the clone's folder name", () => {
  test("an undeclared root with one instantiated harness is that harness", () => {
    expect(rootInstanceName(rootWith({ "smart-base": plain }, "smart-trust"))).toBe("smart-base");
  });

  test("an undeclared root with nothing decided has no name", () => {
    expect(rootInstanceName(rootWith({}, "bare-folio"))).toBeUndefined();
    expect(rootInstanceName(rootWith({ a: plain, b: plain }, "bare-folio"))).toBeUndefined();
  });
});

describe("this repository", () => {
  test("lands on folio-assistant-core, named by index.config.json", () => {
    // Since 2026-10-07 the root `index.config.json` names the landing. It said
    // `cat-harness` until the owner's 3d4caf6 (2026-10-08: "remove root
    // toolchain and folio-assistant declaration"), which set
    // `site.landing: "folio-assistant-core"`; the per-instance
    // `cat-harness.config.json` that "still carried the flag" is gone with the
    // split. The property is unchanged: the INDEX decides, and says so.
    const r = resolveLandingInstance(join(import.meta.dir, "..", ".."));
    expect(r.kind === "instance" && r.name).toBe("folio-assistant-core");
    expect(r.kind === "instance" && r.by).toBe("index");
  });
});
