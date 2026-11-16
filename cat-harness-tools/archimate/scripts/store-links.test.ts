/**
 * ArchiMate store links (owner, 2026-11-01, Q-DS-8 A): `store`, `api`,
 * `schema` and `actorDefinition` properties, checked by `check-archimate`.
 *
 * @module cat-harness/archimate/scripts/store-links.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";

import { storeLinkProblems } from "./check-archimate.ts";

type El = { id: string; type: string; name: string; properties: { key: string; value: string }[] };
type Rel = { id: string; type: string; source: string; target: string };
const el = (id: string, type: string, props: Record<string, string> = {}): El => ({
  id,
  type,
  name: id,
  properties: Object.entries(props).map(([key, value]) => ({ key, value })),
});
const model = (elements: El[], relationships: Rel[] = []) =>
  ({ elements, relationships }) as unknown as Parameters<typeof storeLinkProblems>[1];

describe("store links", () => {
  test("a model that marks no store passes", () => {
    expect(storeLinkProblems("m", model([el("HWR", "ApplicationComponent")]))).toEqual([]);
  });

  test("a store with an api on itself passes", () => {
    const m = model([el("HWR", "ApplicationComponent", { store: "HealthWorkerRegistry", api: "https://example.org/CapabilityStatement/hwr" })]);
    expect(storeLinkProblems("m", m)).toEqual([]);
  });

  test("a store with an api on a composed interface passes", () => {
    const m = model(
      [el("HWR", "ApplicationComponent", { store: "HealthWorkerRegistry" }), el("HWR_API", "ApplicationInterface", { api: "openapi.json" })],
      [{ id: "r1", type: "Composition", source: "HWR", target: "HWR_API" }],
    );
    expect(storeLinkProblems("m", m)).toEqual([]);
  });

  test("a store nobody can reach is reported", () => {
    const m = model([el("HWR", "ApplicationComponent", { store: "HealthWorkerRegistry" })]);
    expect(storeLinkProblems("m", m)).toEqual(['m: store "HWR" has no api property, on itself or on an application interface composed into it']);
  });

  test("a data object marked as a store is reported", () => {
    const m = model([el("Worker", "DataObject", { store: "x", api: "y" })]);
    expect(storeLinkProblems("m", m)[0]).toMatch(/is a DataObject marked as a store/);
  });

  test("an empty link says nothing, and is reported", () => {
    const m = model([el("Worker", "DataObject", { schema: " " })]);
    expect(storeLinkProblems("m", m)).toEqual(['m: "Worker" has an empty schema property']);
  });
});
