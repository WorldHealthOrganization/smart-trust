/**
 * The ONE function every generator and reader computes a visualiser's URL
 * with (owner, 2026-10-09): `<base>/<harness>/<visualizer>[/<sub-graph>[/<asset>]]`.
 */
import { describe, expect, test } from "bun:test";

import { aliasRoute, routeCollisions, routeOf, siteRootFrom, subgraphSegment, visualiserRoute, visualiserUrl } from "./visualiser-route.js";

describe("visualiserRoute", () => {
  test("a sub-graph id with capitals routes lower-cased (smart-base's layer subgraphs)", () => {
    expect(subgraphSegment("smart-base-L4-skills")).toBe("smart-base-l4-skills");
    expect(visualiserRoute({ harness: "smart-base", visualiser: "skills", subgraph: "smart-base-L4-skills" })).toBe("smart-base/skills/smart-base-l4-skills/");
    expect(visualiserRoute({ harness: "h", visualiser: "v", subgraph: "index/L2-bpmn" })).toBe("h/v/index/l2-bpmn/");
    // Only case is forgiven: anything else that is not a segment is still refused.
    expect(() => visualiserRoute({ harness: "h", visualiser: "v", subgraph: "L4 skills" })).toThrow(/not a URL segment/);
  });

  test("the full KG, a sub-graph, and an asset of either", () => {
    expect(visualiserRoute({ harness: "cat-harness", visualiser: "library" })).toBe("cat-harness/library/");
    expect(visualiserRoute({ harness: "cat-harness", visualiser: "library", subgraph: "who-iris" })).toBe("cat-harness/library/who-iris/");
    expect(visualiserRoute({ harness: "cat-harness", visualiser: "library", subgraph: "who-iris", asset: "x/index.html" })).toBe(
      "cat-harness/library/who-iris/x/index.html",
    );
    expect(visualiserRoute({ harness: "cat-harness", visualiser: "processes", asset: "intake.html" })).toBe("cat-harness/processes/intake.html");
  });

  test("a nested sub-graph path is a path of segments", () => {
    expect(visualiserRoute({ harness: "cat-harness", visualiser: "auto-docs", subgraph: "index/skills/core-skills" })).toBe(
      "cat-harness/auto-docs/index/skills/core-skills/",
    );
  });

  test("a segment that is not a URL segment is refused, never encoded", () => {
    expect(() => visualiserRoute({ harness: "Cat Harness", visualiser: "x" })).toThrow(/not a URL segment/);
    expect(() => visualiserRoute({ harness: "h", visualiser: "x", subgraph: "../up" })).toThrow();
    expect(() => visualiserRoute({ harness: "h", visualiser: "x", asset: "../escape.html" })).toThrow(/escapes/);
  });

  test("an absolute URL under a base, with or without its trailing slash", () => {
    expect(visualiserUrl("https://e.org/site", { harness: "h", visualiser: "v" })).toBe("https://e.org/site/h/v/");
    expect(visualiserUrl("/", { harness: "h", visualiser: "v", subgraph: "s" })).toBe("/h/v/s/");
  });

  test("the way back to the site root is the route's depth", () => {
    expect(siteRootFrom({ harness: "h", visualiser: "v" })).toBe("../../");
    expect(siteRootFrom({ harness: "h", visualiser: "v", subgraph: "a/b" })).toBe("../../../../");
  });

  test("routeOf finds the declared route a site path lies under", () => {
    const d = [{ harness: "h", visualiser: "v" }];
    expect(routeOf("h/v/s/index.html", d)).toEqual({ harness: "h", visualiser: "v", rest: "s/index.html" });
    expect(routeOf("h/vv/index.html", d)).toBeUndefined();
  });

  test("a locale is the route's first segment, above the harness", () => {
    expect(visualiserRoute({ locale: "en", harness: "h", visualiser: "v" })).toBe("en/h/v/");
    expect(visualiserRoute({ locale: "en", harness: "h", visualiser: "v", subgraph: "s", asset: "d.json" })).toBe("en/h/v/s/d.json");
    expect(siteRootFrom({ locale: "en", harness: "h", visualiser: "v" })).toBe("../../../");
    expect(() => visualiserRoute({ locale: "EN", harness: "h", visualiser: "v" })).toThrow();
  });

  test("routeOf tells a localised route from the unlocalised one", () => {
    const d = [{ locale: "en", harness: "h", visualiser: "v" }];
    expect(routeOf("en/h/v/s/", d)).toEqual({ harness: "h", visualiser: "v", rest: "s/" });
    expect(routeOf("h/v/s/", d)).toBeUndefined();
  });

  test("an alias is one segment at the site's top level", () => {
    expect(aliasRoute("todos")).toBe("todos/");
    expect(() => aliasRoute("a/b")).toThrow();
  });
});

describe("routeCollisions", () => {
  test("one route claimed twice, and a claim inside another's subtree", () => {
    const c = routeCollisions([
      { route: "h/v/", by: "a" },
      { route: "h/v", by: "b" },
      { route: "h/v/s/", by: "c" },
      { route: "h/w/", by: "d" },
    ]);
    expect(c.map((x) => `${x.kind}:${x.route}:${x.claimants.join("+")}`)).toEqual([
      "same:h/v/:a+b",
      "nested:h/v/s/:a+b+c",
    ]);
  });

  test("siblings do not collide", () => {
    expect(routeCollisions([{ route: "h/v/", by: "a" }, { route: "h/vv/", by: "b" }])).toEqual([]);
  });
});
