/**
 * `themeByRef` — a theme reference resolved against its OWNER (bean `v8n5`).
 *
 * @module cat-harness/schemas/theme-by-ref.test
 *
 * Synthetic layers in a temp "repository" for the mechanism, and one test
 * over this repository for the reference that motivated it.
 *
 * The tests of this file that read the whole checkout (resolves who-iris's own
 * themes) live in `test/theme-by-ref-checkout.test.ts` (bean `7zz1`): standing
 * alone, cat-harness has none of it.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { explainStickyThemeConflict, explainThemeRefMiss, instanceStickyThemes, themeByRef } from "./theme-by-ref.ts";
import { THEMES } from "./themes.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const THEME_TS = resolve(import.meta.dir, "theme.ts");

/** A repository holding one layer, optionally with a themes directory and module. */
function repo(opts: { themesDir?: boolean; module?: string }): string {
  const root = mkdtempSync(join(tmpdir(), "theme-by-ref-"));
  made.push(root);
  mkdirSync(join(root, ".git"));
  const inst = join(root, "acme");
  mkdirSync(inst, { recursive: true });
  const directories = opts.themesDir ? [{ id: "acme-themes", path: "themes/", graphTypologies: ["themes"] }] : [];
  writeFileSync(join(inst, "acme.json"), JSON.stringify({ name: "acme", version: "0.1.0", directories }, null, 2));
  if (opts.themesDir) mkdirSync(join(inst, "themes"), { recursive: true });
  if (opts.module !== undefined) writeFileSync(join(inst, "themes", "themes.ts"), opts.module);
  return root;
}

const ACME_THEME = `import { ResolvedThemeSchema } from ${JSON.stringify(THEME_TS)};
export const INSTANCE_THEMES = [ResolvedThemeSchema.parse({
  $schema: "folio-theme/v1", kind: "webpage", id: "acme-web", name: "Acme",
  palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "#aa0000" },
  layouts: {
    laptop: { minWidth: "1000px", padding: "1rem", fontScale: 1 },
    mobile: { minWidth: "100%", padding: "1rem", fontScale: 1 },
    card: { minWidth: "200px", padding: "1rem", fontScale: 1 },
  },
})];
`;

describe("the owner decides where a reference resolves", () => {
  test("{instance, themeId} resolves against that instance's declared themes", () => {
    const root = repo({ themesDir: true, module: ACME_THEME });
    const r = themeByRef({ instance: "acme", themeId: "acme-web" }, root);
    expect(r.ok && r.theme.palette.accent).toBe("#aa0000");
    expect(r.ok && r.owner).toBe("acme");
  });

  test("a bare id means the CITING instance's own", () => {
    const root = repo({ themesDir: true, module: ACME_THEME });
    const r = themeByRef({ themeId: "acme-web" }, root, "acme");
    expect(r.ok && r.theme.id).toBe("acme-web");
  });

  test("a bare platform id still resolves from an instance that owns none of that name — nothing read before B8 breaks", () => {
    const root = repo({ themesDir: true, module: ACME_THEME });
    const id = THEMES[0]!.id;
    const r = themeByRef({ themeId: id }, root, "acme");
    expect(r.ok && r.theme.id).toBe(id);
    expect(r.ok && r.owner).toBe("cat-harness");
  });

  test("no instance named, or the platform named, is the platform's table", () => {
    const root = repo({});
    const id = THEMES[0]!.id;
    expect(themeByRef({ themeId: id }, root).ok).toBe(true);
    expect(themeByRef({ instance: "cat-harness", themeId: id }, root).ok).toBe(true);
  });
});

describe("each miss is its own repair, and none is silently the platform's", () => {
  test("an explicit instance that does not own the theme does NOT fall back to the platform", () => {
    const root = repo({ themesDir: true, module: ACME_THEME });
    const r = themeByRef({ instance: "acme", themeId: THEMES[0]!.id }, root);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.miss.kind).toBe("no-such-theme");
  });

  test("an instance nobody declares", () => {
    const r = themeByRef({ instance: "nope", themeId: "x" }, repo({}));
    expect(!r.ok && r.miss.kind).toBe("no-such-instance");
  });

  test("an instance with no themes directory", () => {
    const r = themeByRef({ instance: "acme", themeId: "x" }, repo({}));
    expect(!r.ok && r.miss.kind).toBe("no-themes-directory");
  });

  test("a themes directory with no conventional module", () => {
    const r = themeByRef({ instance: "acme", themeId: "x" }, repo({ themesDir: true }));
    expect(!r.ok && r.miss.kind).toBe("no-themes-module");
    expect(!r.ok && explainThemeRefMiss(r.miss)).toContain("INSTANCE_THEMES");
  });
});

/** A module declaring one webpage theme and one sticky theme with the given id. */
const stickyModule = (id: string, accent: string): string => `import { ResolvedThemeSchema } from ${JSON.stringify(THEME_TS)};
const L = { minWidth: "13rem", padding: "1rem", fontScale: 1 };
export const INSTANCE_THEMES = [
  ResolvedThemeSchema.parse({
    $schema: "folio-theme/v1", kind: "webpage", id: "${id}-web", name: "Web",
    palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "${accent}" },
    layouts: { laptop: L, mobile: L, card: L },
  }),
  ResolvedThemeSchema.parse({
    $schema: "folio-theme/v1", kind: "sticky", id: "${id}", name: "Note",
    palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "${accent}" },
    layouts: { laptop: L, mobile: L, card: L },
  }),
];
`;

/** A repository with several layers, each declaring a themes directory with a sticky theme. */
function multiRepo(instances: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "theme-by-ref-multi-"));
  made.push(root);
  mkdirSync(join(root, ".git"));
  for (const [name, themeId] of Object.entries(instances)) {
    const inst = join(root, name);
    mkdirSync(join(inst, "themes"), { recursive: true });
    writeFileSync(
      join(inst, `${name}.json`),
      JSON.stringify({ name, version: "0.1.0", directories: [{ id: `${name}-themes`, path: "themes/", graphTypologies: ["themes"] }] }),
    );
    writeFileSync(join(inst, "themes", "themes.ts"), stickyModule(themeId, "#aa0000"));
  }
  return root;
}

describe("instanceStickyThemes — every instance's sticky themes, for the board stylesheet", () => {
  test("finds an instance's STICKY themes by declaration and leaves its other kinds out", () => {
    const root = multiRepo({ acme: "acme-note" });
    const { themes, conflicts } = instanceStickyThemes(root);
    expect(themes.map((t) => `${t.instance}:${t.theme.id}`)).toEqual(["acme:acme-note"]);
    expect(conflicts).toEqual([]);
  });

  test("an instance theme that shadows a platform id is REFUSED with a finding, not emitted", () => {
    const root = multiRepo({ acme: "pale-sage" });
    const { themes, conflicts } = instanceStickyThemes(root, "cat-harness", new Set(THEMES.map((t) => t.id)));
    expect(themes).toEqual([]);
    expect(conflicts).toEqual([{ kind: "shadows-platform", instance: "acme", themeId: "pale-sage" }]);
    expect(explainStickyThemeConflict(conflicts[0]!)).toContain("platform theme id");
  });

  test("two instances declaring one id are REFUSED together — neither wins by order", () => {
    const root = multiRepo({ acme: "shared-note", zeta: "shared-note" });
    const { themes, conflicts } = instanceStickyThemes(root);
    expect(themes).toEqual([]);
    expect(conflicts).toEqual([{ kind: "duplicate-across-instances", themeId: "shared-note", instances: ["acme", "zeta"] }]);
  });
});
