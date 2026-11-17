/**
 * Test suite for mount path and visualiser route collisions (bean folio-assistant-t4xb).
 *
 * Verifies:
 * 1. Reserved root and route names declared in a single constant.
 * 2. Mount path collision rejection conditions:
 *    - Declared directory collision (downstream declared dir)
 *    - Reserved root / site route name collision
 *    - Sibling mount path collision
 *    - Setting `path` resolves the collision
 *    - Distinct, non-colliding paths pass
 * 3. Route rules:
 *    - Canonical `<base>/<harness>/<visualizer>/` format
 *    - Generated link defaults to canonical unless alias is declared
 *    - Opt-in alias exists only when declared
 *    - Refuses colliding aliases naming both claimants (alias vs alias, alias vs harness, alias vs reserved route)
 *
 * @module scripts/tests/mount-collisions.test
 */

import { describe, expect, it } from "bun:test";
import {
  RESERVED_ROOT_AND_ROUTE_NAMES,
  isReservedRootOrRouteName,
  effectiveMountPathOf,
  checkMountPathCollisions,
  canonicalVisualizerRoute,
  visualizerAliasRoute,
  visualizerUrl,
  checkVisualizerRouteCollisions,
} from "../../schemas/kg/remote-mount.js";
import { checkAllCollisions } from "../check-mount-collisions.js";

describe("RESERVED_ROOT_AND_ROUTE_NAMES", () => {
  it("declares the one authoritative list of reserved root and route names", () => {
    const expected = [
      "skills",
      "tools",
      "docs",
      "assets",
      "glossary",
      "api",
      "payload",
      "STAGING",
      "branches",
      "beans",
      "todos",
      "fsh-guts",
      "uploads",
      "test",
      "build",
      "_site",
      "_docs",
      "_kg",
    ];
    expect([...RESERVED_ROOT_AND_ROUTE_NAMES]).toEqual(expected);
  });

  it("identifies reserved names case-insensitively and with trailing slashes", () => {
    expect(isReservedRootOrRouteName("docs")).toBe(true);
    expect(isReservedRootOrRouteName("DOCS/")).toBe(true);
    expect(isReservedRootOrRouteName("staging")).toBe(true);
    expect(isReservedRootOrRouteName("STAGING")).toBe(true);
    expect(isReservedRootOrRouteName("tools/sub")).toBe(true);
    expect(isReservedRootOrRouteName("beans")).toBe(true);
    expect(isReservedRootOrRouteName("_site")).toBe(true);

    expect(isReservedRootOrRouteName("who-iris")).toBe(false);
    expect(isReservedRootOrRouteName("smart-base")).toBe(false);
    expect(isReservedRootOrRouteName("custom-harness")).toBe(false);
  });
});

describe("Mount path collision checks (bean folio-assistant-t4xb)", () => {
  const declaredDirs = ["library", "content/docs", "incoming"];

  it("effectiveMountPathOf defaults to harness name when path override is absent", () => {
    expect(effectiveMountPathOf({ harness: "who-iris" })).toBe("who-iris");
    expect(effectiveMountPathOf({ harness: "who-iris", path: "custom/path/" })).toBe("custom/path");
    expect(
      effectiveMountPathOf({
        harness: "who-iris",
        overrides: { "who-iris": { path: "overridden/iris/" } },
      }),
    ).toBe("overridden/iris");
  });

  it("rejects a mount whose effective path collides with a downstream declared directory", () => {
    const mounts = [
      { harness: "library" }, // defaults to "library", collides with declared "library"
    ];
    const findings = checkMountPathCollisions(mounts, { declaredDirs });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.kind).toBe("declared-directory");
    expect(findings[0]!.collidesWith).toBe("library");
    expect(findings[0]!.message).toContain("set `path`");
  });

  it("rejects a mount whose effective path overlaps with a downstream declared directory tree", () => {
    const mounts = [
      { harness: "custom", path: "incoming/data" }, // inside declared "incoming"
      { harness: "content", path: "content" },       // parent of declared "content/docs"
    ];
    const findings = checkMountPathCollisions(mounts, { declaredDirs });
    expect(findings).toHaveLength(2);
    for (const f of findings) {
      expect(f.kind).toBe("declared-directory");
      expect(f.message).toContain("set `path`");
    }
  });

  it("rejects a mount whose effective path collides with a reserved root or site route name", () => {
    const mounts = [
      { harness: "skills" },       // reserved route
      { harness: "docs" },         // reserved route
      { harness: "staging-view", path: "STAGING" }, // reserved root
      { harness: "api-client", path: "api" },       // reserved route
    ];
    const findings = checkMountPathCollisions(mounts, { declaredDirs: [] });
    expect(findings).toHaveLength(4);
    for (const f of findings) {
      expect(f.kind).toBe("reserved-name");
      expect(f.message).toContain("set `path`");
    }
  });

  it("rejects sibling mounts that collide on the same effective path", () => {
    const mounts = [
      { harness: "harness-a", path: "shared-dest" },
      { harness: "harness-b", path: "shared-dest" },
    ];
    const findings = checkMountPathCollisions(mounts, { declaredDirs: [] });
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.kind === "sibling-mount" && f.harness === "harness-a")).toBe(true);
    expect(findings.some((f) => f.kind === "sibling-mount" && f.harness === "harness-b")).toBe(true);
    for (const f of findings) {
      expect(f.message).toContain("set `path`");
    }
  });

  it("passes with 0 findings on valid distinct non-reserved non-colliding paths", () => {
    const mounts = [
      { harness: "who-iris" },
      { harness: "smart-trust" },
      { harness: "bootstrap", path: "bootstrap" },
      { harness: "bootstrap-tools", path: "bootstrap-tools" },
    ];
    const findings = checkMountPathCollisions(mounts, { declaredDirs });
    expect(findings).toEqual([]);
  });

  it("setting `path` resolves an otherwise colliding mount", () => {
    // Harness named "docs" (reserved) and "library" (declared dir)
    const colliding = [
      { harness: "docs" },
      { harness: "library" },
    ];
    expect(checkMountPathCollisions(colliding, { declaredDirs })).toHaveLength(2);

    // Setting `path` on both fixes the collisions!
    const fixed = [
      { harness: "docs", path: "remote-docs" },
      { harness: "library", path: "external-library" },
    ];
    const findings = checkMountPathCollisions(fixed, { declaredDirs });
    expect(findings).toEqual([]);
  });
});

describe("Visualiser route rules (bean folio-assistant-t4xb)", () => {
  it("canonical route format is <base>/<harness>/<visualizer>/", () => {
    expect(canonicalVisualizerRoute("cat-harness", "library")).toBe("cat-harness/library/");
    expect(canonicalVisualizerRoute("cat-harness", "todos", "https://example.com/docs")).toBe(
      "https://example.com/docs/cat-harness/todos/",
    );
    expect(canonicalVisualizerRoute("who-iris", "catalogue", "/site")).toBe("/site/who-iris/catalogue/");
  });

  it("visualizerAliasRoute returns alias only when opt-in is declared", () => {
    expect(visualizerAliasRoute("library")).toBeUndefined();
    expect(visualizerAliasRoute("library", false)).toBeUndefined();
    expect(visualizerAliasRoute("library", true)).toBe("library");
    expect(visualizerAliasRoute("library", "lib-alias")).toBe("lib-alias");
  });

  it("visualizerUrl uses canonical form unless an alias is declared", () => {
    // No alias -> canonical
    expect(visualizerUrl("cat-harness", "library")).toBe("cat-harness/library/");
    expect(visualizerUrl("cat-harness", "library", { base: "/site" })).toBe("/site/cat-harness/library/");

    // Opt-in alias -> alias form
    expect(visualizerUrl("cat-harness", "library", { alias: true })).toBe("library/");
    expect(visualizerUrl("cat-harness", "library", { alias: "custom-lib", base: "/site" })).toBe("/site/custom-lib/");
  });

  it("refuses an alias that collides with another visualiser's alias, naming both claimants", () => {
    const visualizers = [
      { harness: "harness-one", visualizer: "overview", alias: "summary" },
      { harness: "harness-two", visualizer: "dash", alias: "summary" },
    ];
    const findings = checkVisualizerRouteCollisions(visualizers);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.kind).toBe("alias-collision");
    expect(f.route).toBe("summary");
    expect(f.claimantA).toBe("harness-two/dash");
    expect(f.claimantB).toBe("harness-one/overview");
    expect(f.message).toContain("harness-two/dash");
    expect(f.message).toContain("harness-one/overview");
  });

  it("refuses an alias that collides with a harness route, naming both claimants", () => {
    const visualizers = [
      { harness: "cat-harness", visualizer: "iris-mirror", alias: "who-iris" },
    ];
    const findings = checkVisualizerRouteCollisions(visualizers, {
      harnessNames: ["cat-harness", "who-iris"],
    });
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.kind).toBe("harness-route");
    expect(f.route).toBe("who-iris");
    expect(f.claimantA).toBe("cat-harness/iris-mirror");
    expect(f.claimantB).toBe("harness:who-iris");
    expect(f.message).toContain("cat-harness/iris-mirror");
    expect(f.message).toContain("harness:who-iris");
  });

  it("refuses an alias that collides with a reserved site route, naming both claimants", () => {
    const visualizers = [
      { harness: "custom", visualizer: "tools-dash", alias: "tools" },
      { harness: "custom", visualizer: "docs-view", alias: "docs" },
    ];
    const findings = checkVisualizerRouteCollisions(visualizers);
    expect(findings).toHaveLength(2);
    for (const f of findings) {
      expect(f.kind).toBe("reserved-route");
      expect(f.message).toContain("reserved site route");
      expect(f.claimantA).toContain("custom/");
      expect(f.claimantB).toContain("reserved-route:");
    }
  });

  it("distinct non-colliding aliases pass with 0 findings", () => {
    const visualizers = [
      { harness: "harness-one", visualizer: "overview", alias: "custom-one" },
      { harness: "harness-two", visualizer: "dash", alias: "custom-two" },
      { harness: "harness-three", visualizer: "plain" }, // no alias
    ];
    const findings = checkVisualizerRouteCollisions(visualizers, {
      harnessNames: ["harness-one", "harness-two", "harness-three"],
    });
    expect(findings).toEqual([]);
  });
});

describe("checkAllCollisions integration", () => {
  it("runs cleanly on current repository root", () => {
    const res = checkAllCollisions(process.cwd());
    expect(res.mountCollisions).toEqual([]);
    expect(res.routeCollisions).toEqual([]);
  });
});
