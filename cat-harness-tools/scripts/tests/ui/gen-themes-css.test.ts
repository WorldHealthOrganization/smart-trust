/**
 * `gen-themes-css.ts` emits INSTANCE-declared sticky themes, generically.
 *
 * Bean `v8n5`. `themeByRef` could resolve who-iris's own sticky theme for a
 * card while this generator emitted CSS for the platform's themes only, so the
 * card named a theme and rendered on the default — a fallback that looks like
 * a working page. These tests pin the three things that close it:
 *
 *   - a layer sticky theme passed in IS emitted, labelled with its owner;
 *   - the COMMITTED stylesheet carries every layer sticky theme this
 *     repository declares, so a card citing one cannot silently fall back;
 *   - the generator's source names no layer and holds no colour value —
 *     the values arrive from the layer's `themes.ts` at build time.
 *
 * The tests of this file that read the whole checkout (reads every layer's
 * sticky themes) live in `test/gen-themes-css-checkout.test.ts` (bean `7zz1`):
 * standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ResolvedThemeSchema, type ResolvedTheme } from "../../../schemas/ui/theme.js";
import { THEMES } from "../../../schemas/ui/themes.js";
import { renderThemesCss } from "../../gen-themes-css.js";
import { TOOLS_ROOT } from "../../lib/roots.ts";

const L = { minWidth: "13rem", padding: "1rem", fontScale: 1 };
const note = ResolvedThemeSchema.parse({
  $schema: "folio-theme/v1",
  kind: "sticky",
  id: "acme-note",
  name: "Acme note",
  palette: { surface: "#fefefe", ink: "#101010", edge: "#cccccc", accent: "#aa0000" },
  layouts: { laptop: L, mobile: L, card: L },
}) as Extract<ResolvedTheme, { kind: "sticky" }>;

describe("an instance sticky theme passed in is emitted", () => {
  test("its selector, its palette roles and its owner", () => {
    const css = renderThemesCss([{ instance: "acme", theme: note }]);
    expect(css).toContain(`[data-fa-sticky-theme="acme-note"] {`);
    expect(css).toContain("--fa-sticky-accent: #aa0000;");
    expect(css).toContain("[declared by instance acme]");
    expect(css).toContain(`[data-fa-sticky-theme="acme-note"][data-fa-sticky-layout="card"]`);
  });

  test("with none passed, the output is the platform's alone — nothing else changed", () => {
    const css = renderThemesCss();
    for (const t of THEMES.filter((x) => x.kind === "sticky")) {
      expect(css).toContain(`[data-fa-sticky-theme="${t.id}"] {`);
    }
    expect(css).not.toContain("declared by instance");
  });
});

describe("the generator holds no instance's name or colour", () => {
  test("no instance literal and no hex value in the source", () => {
    const src = readFileSync(join(TOOLS_ROOT, "scripts", "gen-themes-css.ts"), "utf8");
    expect(src).not.toMatch(/who-iris|iris-sticky|iris-web/);
    expect(src).not.toMatch(/#[0-9a-f]{6}\b/i);
  });
});
