/**
 * The three URL-space cases and the `enabled` default (bean `nbal`).
 *
 * @module schemas/url-space.test
 */
import { describe, expect, test } from "bun:test";

import { isPublished, publishedPath, type PublishedLocation } from "./url-space.ts";
import { visualiserRoute } from "./visualiser-route.ts";

describe("publishedPath: the three cases", () => {
  test("the root has no segment", () => {
    expect(publishedPath({ case: "root" })).toBe("/");
    expect(publishedPath({ case: "root", path: "guides/agent-onboarding.html" })).toBe("/guides/agent-onboarding.html");
  });

  test("an instance is addressed by its name", () => {
    expect(publishedPath({ case: "instance", instance: "who-iris" })).toBe("/who-iris/");
    expect(publishedPath({ case: "instance", instance: "who-iris", path: "catalogue/" })).toBe("/who-iris/catalogue/");
  });

  test("a viewer is owner, then graph, then subject", () => {
    expect(publishedPath({ case: "viewer", owner: "cat-harness", graph: "docs", subject: "who-iris" })).toBe(
      "/cat-harness/docs/who-iris/",
    );
    expect(publishedPath({ case: "viewer", owner: "cat-harness", graph: "library" })).toBe("/cat-harness/library/");
  });

  test("a locale leads a viewer page, and only a viewer page (owner, 2026-10-20)", () => {
    expect(publishedPath({ case: "viewer", locale: "en", owner: "cat-harness", graph: "todos" })).toBe(
      "/en/cat-harness/todos/",
    );
    expect(() => publishedPath({ case: "viewer", locale: "", owner: "a", graph: "b" })).toThrow(/not a path segment/);
    // The root and a layer as itself take no locale: the type refuses one
    // (checked by tsc), and one smuggled past it never reaches the path.
    // @ts-expect-error — `locale` is not a field of the root case
    const root: PublishedLocation = { case: "root", locale: "en" };
    // @ts-expect-error — `locale` is not a field of the layer case
    const instance: PublishedLocation = { case: "instance", instance: "bootstrap", path: "bootstrap.jsonld", locale: "en" };
    expect(publishedPath(root)).toBe("/");
    expect(publishedPath(instance)).toBe("/bootstrap/bootstrap.jsonld");
  });

  test("with a locale, the viewer case is visualiserRoute's route: two resolvers, one answer", () => {
    const cases = [
      { locale: "en", harness: "cat-harness", visualiser: "library" },
      { locale: "en", harness: "cat-harness", visualiser: "library", subgraph: "who-iris" },
      { locale: "fr", harness: "smart-base", visualiser: "dak", subgraph: "smart-immunizations", asset: "data.json" },
    ];
    for (const c of cases) {
      expect(
        publishedPath({ case: "viewer", locale: c.locale, owner: c.harness, graph: c.visualiser, subject: c.subgraph, path: c.asset }),
      ).toBe(`/${visualiserRoute(c)}`);
    }
  });

  test("two renderable graphs of one instance do not collide", () => {
    const a = publishedPath({ case: "viewer", owner: "cat-harness", graph: "docs", path: "index.html" });
    const b = publishedPath({ case: "viewer", owner: "cat-harness", graph: "folio", path: "index.html" });
    expect(a).not.toBe(b);
  });

  test("a base prefixes every case, with or without its trailing slash", () => {
    const base = "https://litlfred.github.io/folio-assistant/";
    expect(publishedPath({ case: "root" }, base)).toBe("https://litlfred.github.io/folio-assistant/");
    expect(publishedPath({ case: "instance", instance: "bootstrap", path: "bootstrap.jsonld" }, base.slice(0, -1))).toBe(
      "https://litlfred.github.io/folio-assistant/bootstrap/bootstrap.jsonld",
    );
    for (const b of [base, base.slice(0, -1)]) {
      expect(publishedPath({ case: "viewer", locale: "en", owner: "cat-harness", graph: "todos", path: "index.html" }, b)).toBe(
        "https://litlfred.github.io/folio-assistant/en/cat-harness/todos/index.html",
      );
    }
  });

  test("a segment or path that steps outside is refused, not normalised", () => {
    expect(() => publishedPath({ case: "instance", instance: "" })).toThrow(/not a path segment/);
    expect(() => publishedPath({ case: "instance", instance: "../x" })).toThrow(/not a path segment/);
    expect(() => publishedPath({ case: "viewer", owner: "a", graph: "b/../c" })).toThrow(/not a path segment/);
    expect(() => publishedPath({ case: "root", path: "../secret" })).toThrow(/steps outside/);
  });
});

describe("isPublished: enabled is a declaration, defaulting to enabled", () => {
  test("absent is enabled; only an explicit false disables", () => {
    expect(isPublished({})).toBe(true);
    expect(isPublished({ enabled: true })).toBe(true);
    expect(isPublished({ enabled: false })).toBe(false);
  });
});
