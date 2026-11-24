/**
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/docs-site.yml`) live in
 * `test/publish-instance-files-workflows.test.ts`
 * (bean `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { spawnSync } from "node:child_process";

import { collisions, publishInstanceFiles, rewriteMdLinks, titleOf } from "../../publish-instance-files.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO_ROOT = join(dirname(HARNESS_ROOT));

describe("publish-instance-files (bean iwtn, ruling 3)", () => {
  test("a link to a .md file points at its .html rendering, anchor kept; others untouched", () => {
    const html = '<a href="skills/a.md">a</a> <a href="b.md#x">b</a> <a href="s.json#/$defs/Role">r</a> <a href="https://x.org/c.md">c</a>';
    expect(rewriteMdLinks(html)).toBe('<a href="skills/a.html">a</a> <a href="b.html#x">b</a> <a href="s.json#/$defs/Role">r</a> <a href="https://x.org/c.md">c</a>');
  });

  test("the title is the first heading", () => {
    expect(titleOf("intro\n# The Title\n## sub", "f.md")).toBe("The Title");
    expect(titleOf("no heading", "f.md")).toBe("f.md");
  });

  test("files are copied as they sit, .md rendered beside them, README also as index, nothing overwritten", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "publish-instance-"));
    try {
      const inst = join(tmp, "inst");
      const out = join(tmp, "out");
      mkdirSync(join(inst, "skills"), { recursive: true });
      writeFileSync(join(inst, "README.md"), "# Inst\n\nSee [a](skills/a.md).\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
      writeFileSync(join(inst, "skills", "a.md"), "---\nname: a\n---\n# A\n");
      writeFileSync(join(inst, "inst.json"), '{"name":"inst"}');
      mkdirSync(out);
      writeFileSync(join(out, "inst.json"), "already here");

      const { written, skipped } = await publishInstanceFiles(inst, out);
      expect(skipped).toEqual(["inst.json"]);
      expect(readFileSync(join(out, "inst.json"), "utf-8")).toBe("already here");
      expect(written.sort()).toEqual(["README.html", "README.md", "index.html", "skills/a.html", "skills/a.md"]);
      const readme = readFileSync(join(out, "README.html"), "utf-8");
      expect(readme).toContain("<title>Inst</title>");
      expect(readme).toContain('href="skills/a.html"');
      expect(readme).toContain("<td>1</td>");
      // Front matter is not rendered as content.
      expect(readFileSync(join(out, "skills", "a.html"), "utf-8")).not.toContain("name: a");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("bootstrap's declared reachableAt is one of its own files", () => {
    const decl = JSON.parse(readFileSync(join(REPO_ROOT, "bootstrap", "bootstrap.json"), "utf-8"));
    const at = decl.renderExemption.reachableAt as string;
    expect(at.startsWith("..") || at.startsWith("/")).toBe(false);
    expect(existsSync(join(REPO_ROOT, "bootstrap", at))).toBe(true);
  });
});

describe("served-name collisions are chosen, never won by step order (Phase 4, bean xsqm)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pif-collide-"));
  const inst = join(tmp, "inst");
  mkdirSync(inst, { recursive: true });
  writeFileSync(join(inst, "bootstrap.json"), '{"name":"bootstrap"}\n');
  writeFileSync(join(inst, "ns.jsonld"), '{"@id":"x"}\n');
  const site = () => {
    const out = mkdtempSync(join(tmp, "site-"));
    writeFileSync(join(out, "bootstrap.json"), '{"graph":true}\n'); // a DIFFERENT file
    writeFileSync(join(out, "ns.jsonld"), '{"@id":"x"}\n'); // the SAME bytes
    return out;
  };
  const script = join(REPO_ROOT, "cat-harness-tools", "scripts", "publish-instance-files.ts");

  test("a byte-identical file is not a collision; a different one is", async () => {
    const out = site();
    const { skipped } = await publishInstanceFiles(inst, out);
    expect(skipped.sort()).toEqual(["bootstrap.json", "ns.jsonld"]);
    expect(collisions(inst, out, skipped)).toEqual(["bootstrap.json"]);
  });

  test("the step FAILS on a collision nobody named, and passes when it is named", () => {
    const run = (...extra: string[]) =>
      spawnSync("bun", ["run", script, "--instance", inst, "--out", site(), ...extra], { encoding: "utf-8" }).status;
    expect(run()).toBe(1);
    expect(run("--allow-collision", "bootstrap.json")).toBe(0);
  });
});
