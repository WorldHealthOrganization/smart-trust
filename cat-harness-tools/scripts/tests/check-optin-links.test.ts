/**
 * The gate on always-on pages linking into an opt-in sub-graph (owner,
 * 2026-11-11, option B: report, never rewrite).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkOptInLinks, relativeLinks } from "../check-optin-links.ts";
import { FIXTURE_INSTANCE, writeDeclaration } from "../../test/support/instance-fixture.js";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A layer with an always-on `docs/` and two opt-in groups, `extra/` and `more/`. */
function layer(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "optin-links-"));
  dirs.push(root);
  writeDeclaration(root, {
    name: FIXTURE_INSTANCE,
    directories: [
      { id: "docs", path: "docs/", graphTypologies: ["docs"] },
      { id: "extra", path: "extra/", optIn: true, graphTypologies: ["docs"] },
      { id: "more", path: "more/", optIn: true, graphTypologies: ["docs"] },
    ],
  });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("which links are read", () => {
  test("relative targets only, outside fenced code", () => {
    const md = "[a](x.md) [b](https://e.org) [c](/abs) [d](#h) [e](<z.md> \"t\")\n```\n[f](no.md)\n```\n";
    expect(relativeLinks(md)).toEqual(["x.md", "z.md"]);
  });
});

describe("the gate", () => {
  test("an always-on page linking into a group is a finding; a link within the group is not", () => {
    const root = layer({
      "docs/a.md": "See [g](../extra/g.md#top) and [d](b.md).\n",
      "docs/b.md": "# b\n",
      "extra/g.md": "See [h](h.md) and [a](../docs/a.md).\n",
      "extra/h.md": "# h\n",
    });
    const r = checkOptInLinks(root);
    expect(r.findings).toEqual([{ file: "docs/a.md", target: "../extra/g.md#top", group: `${FIXTURE_INSTANCE}.extra` }]);
  });

  test("a link between two opt-in groups is a finding: each is switched on alone", () => {
    const root = layer({ "extra/g.md": "[m](../more/m.md)\n", "more/m.md": "# m\n" });
    expect(checkOptInLinks(root).findings.map((f) => f.group)).toEqual([`${FIXTURE_INSTANCE}.more`]);
  });

  test("a file that declares itself generated is not read", () => {
    const root = layer({
      "docs/gen.md": "---\ngenerated: readme:sync\n---\n\n[g](../extra/g.md)\n",
      "extra/g.md": "# g\n",
    });
    const r = checkOptInLinks(root);
    expect(r.layers).toBe(1);
    expect(r.findings).toEqual([]);
  });
});
