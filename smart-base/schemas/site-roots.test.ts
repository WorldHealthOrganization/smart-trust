/**
 * The publishing roots come from the shared profile, and the owner is derived
 * (WHO migration plan T3, smart-base#421).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import profile from "./publishing.json" with { type: "json" };
import { IRI_ROOT, PUBLISHED_ROOT, SMART_OWNER, STAGING_ROOT, iriSite, smartRepository, stagingSite } from "./site-roots.ts";

describe("site roots", () => {
  test("the IRI and published roots are the profile's, fixed for every owner", () => {
    expect(IRI_ROOT).toBe(profile.iriRoot);
    expect(IRI_ROOT).toBe("https://worldhealthorganization.github.io");
    expect(PUBLISHED_ROOT).toBe("https://smart.who.int");
    expect(iriSite("smart-base")).toBe("https://worldhealthorganization.github.io/smart-base/");
  });

  test("the staging root and repositories follow the derived owner", () => {
    expect(STAGING_ROOT).toBe(`https://${SMART_OWNER.toLowerCase()}.github.io`);
    expect(stagingSite("smart-ra")).toBe(`${STAGING_ROOT}/smart-ra/`);
    expect(smartRepository("smart-base")).toBe(`${SMART_OWNER}/smart-base`);
  });

  test("CAT_REPO_OWNER, then GITHUB_REPOSITORY_OWNER, name the owner", () => {
    const at = (env: Record<string, string>) =>
      spawnSync(process.execPath, ["-e", `import("${join(import.meta.dir, "site-roots.ts")}").then((m) => console.log(m.SMART_OWNER, m.STAGING_ROOT))`], {
        encoding: "utf-8",
        env: { PATH: process.env.PATH ?? "", ...env },
      }).stdout.trim();
    expect(at({ GITHUB_REPOSITORY_OWNER: "WorldHealthOrganization" })).toBe("WorldHealthOrganization https://worldhealthorganization.github.io");
    expect(at({ GITHUB_REPOSITORY_OWNER: "WorldHealthOrganization", CAT_REPO_OWNER: "litlfred" })).toBe("litlfred https://litlfred.github.io");
    expect(at({})).toBe("litlfred https://litlfred.github.io");
  });
});
