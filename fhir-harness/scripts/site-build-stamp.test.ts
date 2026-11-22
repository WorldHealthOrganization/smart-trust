import { describe, expect, it } from "bun:test";
import { compare, driftReport, parseBuild, parseRepo, siteBuild, WORKFLOW } from "./site-build-stamp";
import { existsSync } from "node:fs";
import { join } from "node:path";

const self = siteBuild("my-ig", "aaaaaaaaaaaa", { GITHUB_REPOSITORY: "o/my-ig", GITHUB_REF_NAME: "main", GITHUB_SHA: "s1" }, new Date("2026-10-09T00:00:00Z"));
const other = (commit: string) => ({ ...self, instance: "other", platform: { commit } });

describe("site-build-stamp", () => {
  it("rebuildWorkflowInstalled", () => {
    expect(WORKFLOW).toBe("site-publish.yml");
    expect(existsSync(join(import.meta.dir, "..", "templates", "ig-repo-site", WORKFLOW))).toBe(true);
  });
  it("stampsPlatformAndSource", () => {
    expect(self.platform.commit).toBe("aaaaaaaaaaaa");
    expect(self.source).toEqual({ repo: "o/my-ig", ref: "main", commit: "s1" });
    expect(parseBuild(JSON.stringify(self))).toEqual(self);
  });

  it("refusesNonStamp", () => {
    expect(parseBuild("<html>")).toContain("not JSON");
    expect(parseBuild("{}")).toContain("not a folio-site-build/v1");
  });

  it("driftAndNotChecked", () => {
    const sibs = [
      compare(self, "https://x/a", other("aaaaaaaaaaaa")),
      compare(self, "https://x/b", other("bbbbbbbbbbbb")),
      compare(self, "https://x/c", "no folio-build.json"),
    ];
    expect(sibs.map((s) => s.state)).toEqual(["same", "different", "not-checked"]);
    const r = driftReport(self, sibs);
    expect(r).toContain("**different**");
    expect(r).toContain("**not checked**: no folio-build.json");
    expect(r).toContain("1 site(s) were built with a different platform");
    expect(r).toContain("1 site(s) could not be checked");
    expect(r).not.toContain("Every sibling");
  });

  it("noSiblingSaysSo", () => {
    expect(driftReport(self, [])).toContain("nothing was compared");
  });

  it("parsesRepoWithRef", () => {
    expect(parseRepo("acme/base-ig@claude/seed")).toEqual({ repo: "acme/base-ig", ref: "claude/seed" });
    expect(parseRepo("o/r")).toEqual({ repo: "o/r", ref: "main" });
    expect(parseRepo("nonsense")).toBeUndefined();
  });
});
