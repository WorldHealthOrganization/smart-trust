import { describe, expect, it } from "bun:test";

import { publishedPath } from "../../schemas/kg/url-space.js";

import { sitePathOf } from "../print-published-path.ts";

describe("print-published-path — an instance's site path, by name (bean cat-tools-sthf)", () => {
  it("is publishedPath's instance case, without the leading slash", () => {
    expect(sitePathOf({ name: "bootstrap" })).toBe("bootstrap/");
    // declared-path-literal: an input to a pure path function, not a file this test reads; it only has to look like a path under a layer.
    expect(sitePathOf({ name: "bootstrap" }, "processes/ns.jsonld")).toBe(publishedPath({ case: "instance", instance: "bootstrap", path: "processes/ns.jsonld" }).slice(1));
  });

  it("uses the NAME, never a stub", () => {
    expect(sitePathOf({ name: "cat-harness", stub: "folio-assistant" } as { name: string })).toBe("cat-harness/");
  });

  it("answers nothing for an instance declared not published", () => {
    expect(sitePathOf({ name: "gamma", enabled: false })).toBeUndefined();
    expect(sitePathOf({ name: "gamma", enabled: true })).toBe("gamma/");
  });
});
