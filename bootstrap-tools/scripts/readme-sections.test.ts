import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inject } from "./readme-sections.ts";
import { bootstrapTermTargets } from "./term-links.ts";

const tmp = mkdtempSync(join(tmpdir(), "readme-sections-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("README sections, written standalone", () => {
  test("writesOnlyBetweenMarkers", () => {
    const readme = "intro\n<!-- kg:files:begin -->\nold\n<!-- kg:files:end -->\noutro\n";
    expect(inject(readme, "new body\n", "kg:files")).toBe("intro\n<!-- kg:files:begin -->\n\nnew body\n\n<!-- kg:files:end -->\noutro\n");
  });

  test("leavesUnoptedReadme", () => {
    expect(inject("no markers here\n", "x", "kg:files")).toBe("no markers here\n");
  });
});

describe("a term link outside bootstrap is the published page, whatever sits beside it; inside, a relative path", () => {
  const git = (cwd: string) => spawnSync("git", ["init", "-q"], { cwd });
  const PUBLISHED = "https://litlfred.github.io/bootstrap/schemas/#process";
  const mk = (base: string, layout: "split" | "mono" | "alone") => {
    const b = join(base, "bootstrap");
    if (layout !== "alone") {
      mkdirSync(join(b, "schemas"), { recursive: true });
      writeFileSync(join(b, "schemas", "README.md"), "# terms\n");
      writeFileSync(join(b, "bootstrap.json"), '{"name":"bootstrap","repository":"litlfred/bootstrap"}\n');
    }
    const t = join(base, "bootstrap-tools", "scripts");
    mkdirSync(t, { recursive: true });
    if (layout === "split") {
      git(b);
      git(join(base, "bootstrap-tools"));
    } else git(base);
    return { base, tools: t, bootstrap: b };
  };

  test("siblingClonesLinkPublished", () => {
    const { base, tools } = mk(join(tmp, "split"), "split");
    expect(bootstrapTermTargets(base, tools, ["Process"])[0]!.href).toBe(PUBLISHED);
  });

  test("oneRepoLinksPublished", () => {
    const { base, tools } = mk(join(tmp, "mono"), "mono");
    expect(bootstrapTermTargets(base, tools, ["Process"])[0]!.href).toBe(PUBLISHED);
  });

  test("toolsAloneLinkPublished", () => {
    const { base, tools } = mk(join(tmp, "alone"), "alone");
    expect(bootstrapTermTargets(base, tools, ["Process"])[0]!.href).toBe(PUBLISHED);
  });

  test("bootstrapLinksRelatively", () => {
    const { base, bootstrap } = mk(join(tmp, "own"), "split");
    expect(bootstrapTermTargets(base, bootstrap, ["Process"])[0]!.href).toBe("schemas/README.md#process");
    expect(bootstrapTermTargets(base, join(bootstrap, "schemas"), ["Process"])[0]!.href).toBe("README.md#process");
  });
});
