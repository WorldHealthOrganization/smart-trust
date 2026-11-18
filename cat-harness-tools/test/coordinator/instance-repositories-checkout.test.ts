/**
 * `instance-repositories` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/instance-repositories.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads every layer this
 * checkout stages and the repository each declares, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { instanceRepositories, locationMismatch, repositoryNamespaces, resolveInstance } from "../../schemas/kg/instance-repositories.ts";
import { ownNamespace } from "../../schemas/kg/namespaces.ts";
import { contentLayerInstance } from "../../schemas/kg/graph-typology-registry.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const CHECKOUT = resolve(ORIGIN_DIR, "../..");

describe("instance repositories — this checkout (bean 6rmv)", () => {
  const map = instanceRepositories(CHECKOUT);

  test("every instance declares the repository it is", () => {
    expect(map.undeclared).toEqual([]);
    expect(map.entries.length).toBeGreaterThan(1);
  });

  test("livesAt matches where each instance actually sits", () => {
    expect(map.entries.map((e) => locationMismatch(e, CHECKOUT)).filter(Boolean)).toEqual([]);
  });

  test("every livesAt names the instance's OWN repository as its home", () => {
    // This compared each `livesAt` with the repository of the layer AT the
    // checkout root -- the host every staged layer lived in. Both premises
    // are gone: the owner removed the root declaration (3d4caf6, 2026-10-08),
    // and since cat-harness#15 a mounted layer's `livesAt` names its HOME,
    // where it lives in its own repository, not the checkout that mounts it.
    // RESTATED to that rule: no layer at the root, and every `livesAt`
    // names the declaring layer's own repository. A `livesAt` pointing at
    // another repository is a staged layer claiming a home it does not
    // have, and fails here as a mismatch against the root layer did.
    expect(map.entries.some((e) => resolve(e.root) === CHECKOUT)).toBe(false);
    const withHome = map.entries.filter((e) => e.livesAt !== undefined);
    expect(withHome.length).toBeGreaterThan(0);
    expect(withHome.filter((e) => e.livesAt!.repository !== e.repository).map((e) => `${e.name} -> ${e.livesAt!.repository}`)).toEqual([]);
  });

  test("a reference resolves by owner/repo and, transitionally, by name", () => {
    const e = map.byName.get("cat-harness")!;
    expect(resolveInstance(map, e.repository)?.root).toBe(e.root);
    expect(resolveInstance(map, "cat-harness")?.repository).toBe(e.repository);
    expect(resolveInstance(map, "nobody/nothing")).toBeUndefined();
  });
});

describe("the owner/repo → namespace map is derived and agrees with the list (bean 6rmv, phase 3)", () => {
  const ns = repositoryNamespaces(CHECKOUT);

  test("every declared instance has a namespace", () => {
    expect(ns.size).toBe(instanceRepositories(CHECKOUT).entries.length);
  });

  // The code list still NAMES each vocabulary namespace, because code reads
  // them by code; what it may no longer do is SPELL one differently from the
  // declaration it belongs to. Code → the repository whose namespace it is.
  // The content layer's row left the list in folio-assistant#2598: that layer
  // derives its own, and the registry's answer must be its declaration's.
  const LISTED: Array<[code: string, repository: string]> = [
    ["cat-bootstrap", "litlfred/bootstrap"],
    ["cat-harness", "litlfred/cat-harness"],
  ];
  test.each(LISTED)("own-namespaces %s is what %s's declaration derives", (code, repository) => {
    expect(ns.get(repository)).toBe(ownNamespace(code));
  });

  test("the content layer's namespace is what its own declaration derives", () => {
    const content = contentLayerInstance();
    expect(content).toBeDefined();
    const entry = instanceRepositories(CHECKOUT).byName.get(content!.name)!;
    expect(ns.get(entry.repository)).toBe(content!.namespace);
  });
});
