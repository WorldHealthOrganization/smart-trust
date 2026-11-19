/**
 * Themes are nodes (owner, 2026-11-13, node-kind audit: every listed node kind
 * has an IRI, a JSON-LD document, a row and a page, no waivers). Each entry of
 * a layer's `INSTANCE_THEMES` is minted `<doc dir>/theme/<id>` by the export
 * (`lib/theme-nodes.ts`); the themes viewer lists each one, links that IRI and
 * draws its page under its layer's.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { THEME_SUBJECT_KIND, themeNodes, type ThemeNode } from "../../lib/theme-nodes.ts";
import { SUBJECT_KINDS, subjectIri } from "../../lib/subject-iri.ts";
import { censusRuleFor } from "../../lib/node-view-coverage.ts";
import { themeLinks, themePageMd } from "../../render-theme-sheet.ts";
import { CLASS_GLOSSES } from "../../../schemas/content/vocabulary.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const THEME_TS = resolve(import.meta.dir, "../../../schemas/ui/theme.ts");

/** A repository holding one layer, `acme`, with a themes directory and its module. */
function layer(): string {
  const root = mkdtempSync(join(tmpdir(), "theme-nodes-"));
  made.push(root);
  mkdirSync(join(root, ".git"));
  const inst = join(root, "acme");
  mkdirSync(join(inst, "themes"), { recursive: true });
  writeFileSync(
    join(inst, "acme.json"),
    JSON.stringify({ name: "acme", version: "0.1.0", directories: [{ id: "acme-themes", path: "themes/", graphTypologies: ["themes"] }] }),
  );
  writeFileSync(
    join(inst, "themes", "themes.ts"),
    `import { ResolvedThemeSchema } from ${JSON.stringify(THEME_TS)};
export const INSTANCE_THEMES = [ResolvedThemeSchema.parse({
  $schema: "folio-theme/v1", kind: "webpage", id: "acme-web", name: "Acme", description: "Acme's site.",
  palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "#aa0000" },
  layouts: {
    laptop: { minWidth: "1000px", padding: "1rem", fontScale: 1 },
    mobile: { minWidth: "100%", padding: "1rem", fontScale: 1 },
    card: { minWidth: "200px", padding: "1rem", fontScale: 1 },
  },
})];
`,
  );
  return inst;
}

describe("a theme's IRI", () => {
  test("is a subject kind kg-export may mint, and its class is glossed", () => {
    expect(SUBJECT_KINDS).toContain(THEME_SUBJECT_KIND);
    expect(subjectIri("https://e.org/fa/acme/acme.jsonld", THEME_SUBJECT_KIND, "acme-web")).toBe("https://e.org/fa/acme/theme/acme-web");
    expect(CLASS_GLOSSES.Theme?.gloss).toBeTruthy();
  });

  test("the coverage report counts a themes directory by the themes the export names, not by its module", () => {
    expect(censusRuleFor("themes").exportFirst).toBe(true);
  });
});

describe("the themes a layer declares", () => {
  test("one node per INSTANCE_THEMES entry, read from its module", () => {
    const nodes = themeNodes(layer());
    expect(nodes.map((n) => [n.id, n.title, n.description, n.kind, n.sourcePath])).toEqual([
      ["acme-web", "Acme", "Acme's site.", "webpage", "themes/themes.ts"],
    ]);
  });

  test("a layer that declares no themes holds no theme nodes", () => {
    const root = mkdtempSync(join(tmpdir(), "theme-nodes-"));
    made.push(root);
    writeFileSync(join(root, "x.json"), JSON.stringify({ name: "x", version: "0.1.0", directories: [] }));
    expect(themeNodes(root)).toEqual([]);
  });
});

const NODE = { id: "acme-web", title: "Acme <web>", description: "Acme's site.", kind: "webpage", sourcePath: "themes/themes.ts" } as ThemeNode;

describe("each theme is a row and a page", () => {
  test("its layer's list links its page, its IRI and its JSON-LD", () => {
    const html = themeLinks([NODE], "acme/", () => "https://e.org/fa/acme/theme/acme-web");
    expect(html).toContain('<a href="acme/acme-web/">Acme &lt;web&gt;</a>');
    expect(html).toContain('<a href="https://e.org/fa/acme/theme/acme-web">IRI</a>');
    expect(html).toContain('href="https://e.org/fa/acme/theme/acme-web.jsonld"');
  });

  test("its page names its JSON-LD as the alternate and links its IRI", () => {
    const md = themePageMd("acme", NODE, { html: "<table></table>", css: "" }, "https://e.org/fa/acme/theme/acme-web");
    expect(md).toContain('alternate_jsonld: "https://e.org/fa/acme/theme/acme-web.jsonld"');
    expect(md).toContain('<a class="iri" href="https://e.org/fa/acme/theme/acme-web">');
    expect(md).toContain("rendered-by: theme-viewer");
  });

  test("a theme whose layer's export is not served has a page and no IRI", () => {
    const md = themePageMd("acme", NODE, { html: "", css: "" }, undefined);
    expect(md).not.toContain("alternate_jsonld");
    expect(md).not.toContain('class="iri"');
  });
});
