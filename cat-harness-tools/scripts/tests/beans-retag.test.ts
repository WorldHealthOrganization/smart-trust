/**
 * Bean `ujiv` (cat-harness#88): beans and harness declarations carry their
 * node-kind tag, and the retag scripts put it back.
 *
 * @module scripts/tests/beans-retag.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BEAN_SCHEMA_TAG } from "../../schemas/sdlc/bean-graph.ts";
import { CAT_HARNESS_DECLARATION_SCHEMA_TAG } from "../../schemas/kg/cat-harness.ts";

import { RETAG_COMMAND, retagBeanText, retagDir } from "../beans-retag.ts";
import { needsOfRoots, retagDeclarations, retagDeclarationText } from "../declarations-retag.ts";
import { retagBeansBeforePush } from "../state-push.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), "beans-retag-"));
  dirs.push(d);
  return d;
}

const BEAN = "---\n# x-1abc\ntitle: A bean\nstatus: todo\ntype: task\n---\n\nBody with `$schema: other/1.0.0` in prose.\n";

describe("retagBeanText", () => {
  test("adds the tag straight after the CLI's `# <id>` line, and nothing else moves", () => {
    const r = retagBeanText(BEAN);
    expect(r.outcome).toBe("added");
    expect(r.text).toBe(BEAN.replace("# x-1abc\n", `# x-1abc\n$schema: ${BEAN_SCHEMA_TAG}\n`));
  });

  test("is idempotent", () => {
    const once = retagBeanText(BEAN).text;
    expect(retagBeanText(once)).toEqual({ outcome: "tagged", text: once });
  });

  test("front matter with no id comment gets the tag on its first line", () => {
    expect(retagBeanText("---\ntitle: t\n---\nb\n").text).toBe(`---\n$schema: ${BEAN_SCHEMA_TAG}\ntitle: t\n---\nb\n`);
  });

  test("a quoted accepted tag counts as tagged", () => {
    expect(retagBeanText(`---\n$schema: "${BEAN_SCHEMA_TAG}"\ntitle: t\n---\n`).outcome).toBe("tagged");
  });

  test("a foreign tag is reported, never overwritten", () => {
    const text = "---\n# x\n$schema: bean/2.0.0\ntitle: t\n---\n";
    expect(retagBeanText(text)).toEqual({ outcome: "foreign", text, tag: "bean/2.0.0" });
  });

  test("a tag in the BODY is not the bean's tag", () => {
    expect(retagBeanText(BEAN).outcome).toBe("added");
  });

  test("a file with no fence is left alone", () => {
    expect(retagBeanText("no front matter\n")).toEqual({ outcome: "unfenced", text: "no front matter\n" });
  });

  test("front matter closed at end of file keeps its shape", () => {
    expect(retagBeanText("---\n# x\ntitle: t\n---").text).toBe(`---\n# x\n$schema: ${BEAN_SCHEMA_TAG}\ntitle: t\n---`);
  });
});

describe("retagDir", () => {
  function store(): string {
    const dir = join(scratch(), "defs");
    mkdirSync(join(dir, "archive"), { recursive: true });
    writeFileSync(join(dir, "x-1abc--a.md"), BEAN);
    writeFileSync(join(dir, "x-2def--b.md"), retagBeanText(BEAN).text);
    writeFileSync(join(dir, "archive", "x-3ghi--c.md"), BEAN);
    writeFileSync(join(dir, "README.md"), "# defs\n");
    return dir;
  }

  test("without write it counts and changes nothing", () => {
    const dir = store();
    const r = retagDir(dir, { write: false });
    expect(r.files).toBe(3);
    expect(r.tagged).toBe(1);
    expect(r.added).toEqual(["x-1abc--a.md", "archive/x-3ghi--c.md"]);
    expect(readFileSync(join(dir, "x-1abc--a.md"), "utf-8")).toBe(BEAN);
  });

  test("with write it tags the archive too, and a second pass finds nothing", () => {
    const dir = store();
    retagDir(dir, { write: true });
    expect(readFileSync(join(dir, "archive", "x-3ghi--c.md"), "utf-8")).toContain(`$schema: ${BEAN_SCHEMA_TAG}`);
    expect(readFileSync(join(dir, "README.md"), "utf-8")).toBe("# defs\n");
    expect(retagDir(dir, { write: false }).added).toEqual([]);
  });

  test("the gate's remedy is the command, spelled through the runner", () => {
    expect(RETAG_COMMAND).toBe("bun run cat beans:retag");
  });
});

describe("retagDeclarationText", () => {
  const DECL = '{\n  "name": "demo",\n  "title": "Demo"\n}\n';

  test("puts the tag first, indented like the next key", () => {
    const r = retagDeclarationText(DECL);
    expect(r.outcome).toBe("added");
    expect(r.text).toBe(`{\n  "$schema": "${CAT_HARNESS_DECLARATION_SCHEMA_TAG}",\n  "name": "demo",\n  "title": "Demo"\n}\n`);
    expect(Object.keys(JSON.parse(r.text))[0]).toBe("$schema");
  });

  test("is idempotent, and a foreign tag is reported", () => {
    const once = retagDeclarationText(DECL).text;
    expect(retagDeclarationText(once).outcome).toBe("tagged");
    expect(retagDeclarationText('{"$schema": "other/1.0.0", "name": "x"}').outcome).toBe("foreign");
  });

  test("a one-line declaration is rewritten in two-space form", () => {
    const r = retagDeclarationText('{"name":"demo"}');
    expect(r.text).toBe(`{\n  "$schema": "${CAT_HARNESS_DECLARATION_SCHEMA_TAG}",\n  "name": "demo"\n}\n`);
  });

  test("text that is not a JSON object is not touched", () => {
    expect(retagDeclarationText("[1]").outcome).toBe("unparseable");
    expect(retagDeclarationText("{").outcome).toBe("unparseable");
  });

  test("retagDeclarations finds the declaration by its name", () => {
    const root = scratch();
    const inst = join(root, "demo");
    mkdirSync(inst);
    // Above the harness (it needs it), so it is one this script tags.
    writeFileSync(join(inst, "demo.json"), '{\n  "name": "demo",\n  "needs": ["cat-harness"]\n}\n');
    writeFileSync(join(inst, "demo.config.json"), '{\n  "site": {}\n}\n');
    const r = retagDeclarations([inst], root, { write: true });
    expect(r.added).toEqual(["demo/demo.json"]);
    expect(readFileSync(join(inst, "demo.config.json"), "utf-8")).toBe('{\n  "site": {}\n}\n');
  });

  test("instances below the harness — those that do not reach cat-harness through `needs` — are left untagged", () => {
    const root = scratch();
    const decl = (name: string, needs: string[]) => {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, `${name}.json`), `{\n  "name": "${name}",\n  "needs": ${JSON.stringify(needs)}\n}\n`);
      return join(root, name);
    };
    const roots = [decl("boot", []), decl("boot-tools", ["boot"]), decl("cat-harness", ["boot-tools"]), decl("above", ["cat-harness"])];
    const r = retagDeclarations(roots, root, { write: true });
    expect(r.below.sort()).toEqual(["boot-tools/boot-tools.json", "boot/boot.json"]);
    expect(r.added.sort()).toEqual(["above/above.json", "cat-harness/cat-harness.json"]);
    expect(readFileSync(join(root, "boot", "boot.json"), "utf-8")).not.toContain("$schema");
  });

  test("bootstrap-tools stays below the harness when cat-harness no longer needs it (cat-harness#787, bean w1gy)", () => {
    const root = scratch();
    const decl = (name: string, needs: string[]) => {
      mkdirSync(join(root, name));
      writeFileSync(join(root, name, `${name}.json`), `{\n  "name": "${name}",\n  "needs": ${JSON.stringify(needs)}\n}\n`);
      return join(root, name);
    };
    // The real shape since cat-harness#787: the harness needs bootstrap only, and
    // the tools layer above it is what still names bootstrap-tools.
    const roots = [
      decl("bootstrap", []),
      decl("bootstrap-tools", ["bootstrap"]),
      decl("cat-harness", ["bootstrap"]),
      decl("cat-harness-tools", ["cat-harness", "bootstrap-tools"]),
    ];
    const r = retagDeclarations(roots, root, { write: false });
    expect(r.below.sort()).toEqual(["bootstrap-tools/bootstrap-tools.json", "bootstrap/bootstrap.json"]);
    expect(r.added.sort()).toEqual(["cat-harness-tools/cat-harness-tools.json", "cat-harness/cat-harness.json"]);

    // One layer at a time (`--instance`), judged by the checkout's graph.
    const one = retagDeclarations([roots[1]!], root, { write: false, needs: needsOfRoots(roots) });
    expect(one.below).toEqual(["bootstrap-tools/bootstrap-tools.json"]);
    expect(one.files).toBe(0);
  });
});

describe("state:push retags the beans it is about to splice", () => {
  function repo(): string {
    const root = scratch();
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(join(root, "beans", "defs", "x-1abc--a.md"), BEAN);
    return root;
  }

  test("a location holding the store is retagged", () => {
    const root = repo();
    const step = retagBeansBeforePush(root, [{ id: "beans", path: "beans/", branch: "b", keyedBy: "tip" }]);
    expect(step).toEqual({ dir: join(root, "beans", "defs"), added: 1, foreign: [] });
    expect(readFileSync(join(root, "beans", "defs", "x-1abc--a.md"), "utf-8")).toContain(`$schema: ${BEAN_SCHEMA_TAG}`);
  });

  test("a push of some other graph leaves the beans alone", () => {
    const root = repo();
    expect(retagBeansBeforePush(root, [{ id: "todos", path: "todos/", branch: "b", keyedBy: "tip" }])).toBeUndefined();
    expect(readFileSync(join(root, "beans", "defs", "x-1abc--a.md"), "utf-8")).toBe(BEAN);
  });
});
