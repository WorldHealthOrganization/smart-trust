/**
 * repin-cone: the cone and its waves over a small fleet, the mounted-directory
 * filter, the possible-adaptation match, and the report, behind a STUBBED
 * GitHub API.
 */
import { describe, expect, test } from "bun:test";

import { impactOf, mountedPrefixes, planCone, possibleAdaptations, reportOf, type FleetApi, type FleetLock } from "../../repin-cone.ts";

const sha = (c: string) => c.repeat(40);
const lock = (mounts: Array<[string, string]>, instances: FleetLock["instances"] = []): FleetLock => ({
  mounts: mounts.map(([repository, ref]) => ({ harness: repository.split("/")[1]!, repository, ref })),
  instances,
});

// harness H; mid M takes H; top T takes H and M; other O takes nothing in the cone.
const locks = new Map<string, FleetLock | undefined>([
  ["o/mid", lock([["o/h", sha("1")]])],
  ["o/top", lock([["o/h", sha("1")], ["o/mid", sha("2")]], [{ instance: "mid", repository: "o/mid", sha: sha("2"), directories: [{ upstreamPath: "content" }] }])],
  ["o/other", lock([["o/x", sha("3")]])],
  ["o/bare", undefined],
]);

describe("planCone", () => {
  test("the cone of a harness, in waves", () => {
    const p = planCone(locks, "o/h");
    expect(p.sites.map((s) => [s.site, s.wave])).toEqual([["o/mid", 1], ["o/top", 2]]);
    expect(p.sites[1]!.moves.map((m) => [m.repository, m.waitsOn])).toEqual([["o/h", false], ["o/mid", true]]);
    expect(p.noLock).toEqual(["o/bare"]);
  });
  test("a site outside the cone is left out; --all keeps every site", () => {
    expect(planCone(locks, "o/x").sites.map((s) => s.site)).toEqual(["o/other"]);
    expect(planCone(locks).sites.map((s) => s.site).sort()).toEqual(["o/mid", "o/other", "o/top"]);
  });
  test("a cycle is refused", () => {
    const cyc = new Map<string, FleetLock | undefined>([["a/a", lock([["a/b", sha("1")]])], ["a/b", lock([["a/a", sha("1")]])]]);
    expect(() => planCone(cyc)).toThrow(/cycle/);
  });
});

describe("filters", () => {
  test("mounted prefixes: declared directories, or the whole tree", () => {
    expect(mountedPrefixes(locks.get("o/top")!, "o/mid")).toEqual(["content"]);
    expect(mountedPrefixes(locks.get("o/top")!, "o/h")).toEqual([""]);
  });
  test("possible adaptations by path or file name", () => {
    expect(possibleAdaptations("content/anc/contact.md", ["content/anc/contact.md", "input/contact.md"])).toEqual(["content/anc/contact.md"]);
    expect(possibleAdaptations("content/anc/contact.md", ["input/contact.md", "x.md"])).toEqual(["input/contact.md"]);
    expect(possibleAdaptations("content/anc/contact.md", ["a/contact.md", "b/contact.md"])).toEqual([]);
    expect(possibleAdaptations("lib/x/README.md", ["README.md"])).toEqual([]);
  });
});

describe("impactOf and the report", () => {
  const api: FleetApi = {
    async lockOf(r) {
      return locks.get(r);
    },
    async head(r) {
      return r === "o/h" ? sha("9") : sha("8");
    },
    async compare(r) {
      return r === "o/mid" ? { aheadBy: 4, files: ["content/a.md", "src/x.ts"] } : { aheadBy: 7, files: ["schemas/s.ts"] };
    },
    async paths(r) {
      return r === "o/top" ? ["local/a.md", "README.md"] : [];
    },
  };
  test("only mounted changes reach the site; adaptations are matched", async () => {
    const plan = planCone(locks, "o/h");
    const im = await impactOf(plan, locks, api, { impact: true });
    const mid = im.find((s) => s.site === "o/top")!.moves.find((m) => m.repository === "o/mid")!;
    expect(mid.reaching).toEqual(["content/a.md"]);
    expect(mid.outside).toBe(1);
    expect(mid.adaptations).toEqual([{ upstream: "content/a.md", own: ["local/a.md"] }]);
    const md = reportOf(plan, im);
    expect(md).toContain("wave 1 → wave 2");
    expect(im.map((s) => [s.site, s.ready])).toEqual([["o/mid", true], ["o/top", false]]);
    expect(md).toContain("Possible adaptations");
  });
});
