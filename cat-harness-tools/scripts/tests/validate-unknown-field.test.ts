import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { validateObjects } from "../../pipeline/validate";

/**
 * The Zod block schemas are non-strict, so a key nothing declares is stripped
 * without an error and the data it carried never reaches the graph. Two proof
 * blocks in a real paper declare their parent as `proofOf` where the canonical
 * field is `of` — the parent link is simply absent from the dependency graph,
 * and nothing said so.
 */
function chapter(body: string, name = "alpha"): string {
  const root = mkdtempSync(join(tmpdir(), "unknown-field-"));
  writeFileSync(join(root, `${name}.ts`), body);
  writeFileSync(join(root, `${name}.md`), `Body of ${name}.\n`);
  return root;
}

const unknownIssues = (issues: Array<{ message: string }>) =>
  issues.filter((i) => i.message.includes("Unknown field"));

describe("unknown manifest fields", () => {
  test("a key no schema declares is reported", async () => {
    const dir = chapter(
      `export default { kind: "prose", label: "rem:alpha", title: "T", proofOf: "prop:x" };\n`,
    );
    const { issues } = await validateObjects(dir);
    const found = unknownIssues(issues);
    expect(found.length).toBe(1);
    expect(found[0].message).toContain("proofOf");
    rmSync(dir, { recursive: true, force: true });
  });

  test("it is a warning, not an error", async () => {
    // The field is inert, not malformed — the block is still valid content, so
    // failing the build over it would be disproportionate. Saying nothing is
    // what let two of these sit in a real paper.
    const dir = chapter(
      `export default { kind: "prose", label: "rem:alpha", title: "T", is_mathematics: true };\n`,
    );
    const { issues } = await validateObjects(dir);
    expect(unknownIssues(issues)[0]).toMatchObject({ level: "warning" });
    rmSync(dir, { recursive: true, force: true });
  });

  test("every unknown key is reported, not just the first", async () => {
    const dir = chapter(
      `export default { kind: "prose", label: "rem:alpha", title: "T", probe: 1, consumers: [] };\n`,
    );
    const { issues } = await validateObjects(dir);
    expect(unknownIssues(issues).length).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a clean block reports nothing", async () => {
    const dir = chapter(
      `export default { kind: "prose", label: "rem:alpha", title: "T", tags: ["a"] };\n`,
    );
    const { issues } = await validateObjects(dir);
    expect(unknownIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  test("the canonical spelling of a stripped field is not reported", async () => {
    // `of` is the real field `proofOf` was reaching for; it must stay silent.
    const dir = chapter(
      `export default { kind: "proof", label: "prf:alpha", title: "T", of: "prop:x" };\n`,
    );
    const { issues } = await validateObjects(dir);
    expect(unknownIssues(issues).length).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
