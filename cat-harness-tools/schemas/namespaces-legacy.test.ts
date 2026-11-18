/**
 * The reader's TRANSITION tolerance for legacy exact-semver extension
 * addresses (bootstrap-tools#39, owner ruling 2026-10-23 option B). Remove
 * with the tolerance in `namespaces.ts`.
 */
import { describe, expect, test } from "bun:test";

import { CAT_HARNESS_PROCESSES_NS, OWN_BPMN_EXTENSION_NAMESPACES, isOwnExtensionNamespace, ownExtensionPrefixes } from "./kg/namespaces";

/** `ns` with its `v<major>/` segment respelt as `version/`. */
const respelt = (ns: string, version: string): string => ns.replace(/\/v\d+\//, `/${version}/`);
const majorOf = (ns: string): number => Number(/\/v(\d+)\//.exec(ns)![1]);

describe("own extension namespaces during the v<major> transition", () => {
  test("every own namespace is a v<major> address, so the tolerance covers each", () => {
    for (const ns of OWN_BPMN_EXTENSION_NAMESPACES) expect(ns).toMatch(/\/v\d+\//);
  });

  test("the canonical v<major> address is ours", () => {
    for (const ns of OWN_BPMN_EXTENSION_NAMESPACES) expect(isOwnExtensionNamespace(ns)).toBe(true);
  });

  test("the legacy exact-semver spelling of the SAME major is ours", () => {
    for (const ns of OWN_BPMN_EXTENSION_NAMESPACES) {
      const m = majorOf(ns);
      expect(isOwnExtensionNamespace(respelt(ns, `${m}.1.0`))).toBe(true);
      expect(isOwnExtensionNamespace(respelt(ns, `${m}.0.0`))).toBe(true);
    }
  });

  test("another major, a partial version, or another path is still foreign", () => {
    for (const ns of OWN_BPMN_EXTENSION_NAMESPACES) {
      const m = majorOf(ns);
      expect(isOwnExtensionNamespace(respelt(ns, `${m + 1}.0.0`))).toBe(false);
      expect(isOwnExtensionNamespace(respelt(ns, `${m}.1`))).toBe(false);
      expect(isOwnExtensionNamespace(respelt(ns, `${m}.1.0`).replace(/ns\/$/, "other/"))).toBe(false);
    }
    expect(isOwnExtensionNamespace(undefined)).toBe(false);
  });

  test("a diagram binding the legacy spelling has its prefix read as ours", () => {
    const legacy = respelt(CAT_HARNESS_PROCESSES_NS, `${majorOf(CAT_HARNESS_PROCESSES_NS)}.1.0`);
    const xml = `<bpmn:definitions xmlns:cat-harness.processes="${legacy}" xmlns:x="https://example.org/ns#"/>`;
    expect(ownExtensionPrefixes(xml)).toEqual(["cat-harness.processes"]);
  });
});
