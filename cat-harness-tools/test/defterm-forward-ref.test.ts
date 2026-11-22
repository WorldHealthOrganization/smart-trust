/**
 * `defterm-forward-ref` (bean qou-ommr): a term used in prose before the block
 * that defines it, in reading order. Warning only; glossary-chapter
 * definitions are exempt.
 */
import { describe, expect, test } from "bun:test";
import type { Block } from "../schemas/types.ts";
import { validateDefterms } from "../pipeline/validate-defterm";

function blk(defines: string[] = []): Block {
  return { kind: "remark", label: "rem:x", defines } as unknown as Block;
}

function run(
  entries: [string, string, string[], string][],
  readingOrder = true,
) {
  const m = new Map<string, { block: Block; md: string | undefined; dir?: string }>();
  for (const [name, dir, defines, md] of entries) m.set(name, { block: blk(defines), md, dir });
  return validateDefterms(m, { readingOrder }).filter((i) =>
    i.message.startsWith("defterm-forward-ref"),
  );
}

describe("defterm-forward-ref", () => {
  test("bare mention before the defining block warns", () => {
    const got = run([
      ["intro", "ch1", [], "The photon carries the interaction."],
      ["def-photon", "ch2", ["photon"], "A :defterm[photon] is a word."],
    ]);
    expect(got.map((i) => i.block)).toEqual(["intro"]);
    expect(got[0].level).toBe("warning");
  });

  test(":refterm pointing forward warns", () => {
    const got = run([
      ["intro", "ch1", [], "See :refterm[descent]."],
      ["def-descent", "ch2", ["descent"], "A :defterm[descent] datum."],
    ]);
    expect(got).toHaveLength(1);
    expect(got[0].message).toContain(":refterm[descent]");
  });

  test("mention after the definition does not warn", () => {
    const got = run([
      ["def-photon", "ch1", ["photon"], "A :defterm[photon] is a word."],
      ["later", "ch2", [], "The photon again."],
    ]);
    expect(got).toEqual([]);
  });

  test("glossary-chapter definitions are exempt", () => {
    const got = run([
      ["intro", "ch1", [], "The photon carries the interaction. :refterm[photon]"],
      ["gl-photon", "content/paper/glossary", ["photon"], "A :defterm[photon]."],
    ]);
    expect(got).toEqual([]);
  });

  test("math and code are not prose", () => {
    const got = run([
      ["intro", "ch1", [], "Inline $photon$ and `photon` only."],
      ["def-photon", "ch2", ["photon"], "A :defterm[photon] is a word."],
    ]);
    expect(got).toEqual([]);
  });

  test("whole-word match only", () => {
    const got = run([
      ["intro", "ch1", [], "Photonic and multi-photon effects."],
      ["def-photon", "ch2", ["photon"], "A :defterm[photon] is a word."],
    ]);
    expect(got).toEqual([]);
  });

  test("off unless the map is in reading order", () => {
    const got = run(
      [
        ["intro", "ch1", [], "The photon carries the interaction."],
        ["def-photon", "ch2", ["photon"], "A :defterm[photon] is a word."],
      ],
      false,
    );
    expect(got).toEqual([]);
  });
});
