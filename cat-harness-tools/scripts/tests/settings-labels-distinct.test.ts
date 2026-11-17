import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = join(HARNESS_ROOT);
const JS = readFileSync(join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js")), "utf8");

/**
 * Bean `ob3m` finding 12 — two unrelated panels both called "Settings".
 *
 * The ▦ Actions launcher's sets the PAGE (scheme, reading preferences, the
 * Discarded fish, Declared kinds). The glass's sets the GLASS (theme, avatars,
 * opacity, blur). Neither pointed at the other, so a reader looking for the
 * Discarded items in the glass one found nothing there and nothing saying
 * where else to look.
 *
 * Owner, 2026-10-01, option 2 of 4: *"Rename: 'Glass settings' and 'Page
 * settings', each with a link to the other."*
 *
 * This is the SOURCE half: the names are declared once and differ, both
 * panels use them, and each panel's builder draws a link to the other. The
 * RENDERED half — that each link is visible, first, keyboard-reachable and
 * actually opens the other panel at desktop and phone widths — is
 * `test/settings-crosslinks.e2e.ts`, because a link that opens nothing looks
 * exactly like one that works from here.
 */
describe("ob3m finding 12 — two settings panels, two names, each points to the other", () => {
  const names = /var SETTINGS_NAMES = \{\s*page:\s*"([^"]+)",\s*glass:\s*"([^"]+)"\s*\}/.exec(JS);

  /** The source of one named function, from its declaration to the next at the same indent. */
  function fnBody(name: string): string {
    const start = JS.search(new RegExp(`\\n(\\s*)function ${name}\\(`));
    expect(start, `function ${name} is still findable`).toBeGreaterThan(-1);
    const indent = /\n(\s*)function/.exec(JS.slice(start))![1]!;
    const rest = JS.slice(start + 1);
    const end = rest.search(new RegExp(`\\n${indent}\\}`));
    return rest.slice(0, end);
  }

  it("the names are declared once, and differ", () => {
    // A regex that matches nothing is not a passing assertion (`dh4f`).
    expect(names, "var SETTINGS_NAMES = { page: …, glass: … }").not.toBeNull();
    const [, page, glass] = names!;
    expect(page).not.toBe(glass);
    // Neither is the bare word that collided.
    expect(page).not.toBe("Settings");
    expect(glass).not.toBe("Settings");
    // The owner's spellings.
    expect(page).toBe("Page settings");
    expect(glass).toBe("Glass settings");
  });

  it("both panels take their label from the declaration, not a literal", () => {
    expect(/tileButton\(GEAR_GLYPH,\s*SETTINGS_NAMES\.page,\s*"settings"\)/.test(JS), '/tileButton\\(GEAR_GLYPH,\\s*SETTINGS_NAMES\\.page,\\s*"settings"\\)/').toBe(true);
    expect(/chromeTile\("glass-settings",\s*SETTINGS_NAMES\.glass,/.test(JS), '/chromeTile\\("glass-settings",\\s*SETTINGS_NAMES\\.glass,/').toBe(true);
    // No surviving literal "Settings" caption on either control.
    expect(/tileButton\(GEAR_GLYPH,\s*"[^"]*"/.test(JS), '/tileButton\\(GEAR_GLYPH,\\s*"[^"]*"/').toBe(false);
    expect(/chromeTile\("glass-settings",\s*"[^"]*"/.test(JS), '/chromeTile\\("glass-settings",\\s*"[^"]*"/').toBe(false);
  });

  it("the glass panel's HEADING leads with its name — the title is the heading", () => {
    // `openPanel` writes the chrome tile's title as the panel's <h2>, so a
    // title that did not start with the name was a third name for the panel.
    expect(/chromeTile\("glass-settings",\s*SETTINGS_NAMES\.glass,\s*"[^"]*",\s*SETTINGS_NAMES\.glass \+/.test(JS), '/chromeTile\\("glass-settings",\\s*SETTINGS_NAMES\\.glass,\\s*"[^"]*",\\s*SETTINGS_NAMES\\.glass \\+/').toBe(true);
  });

  it("Page settings draws a link to Glass settings, and Glass settings one to Page settings", () => {
    expect(/settingsCrossLink\("glass"/.test(fnBody("buildViews")), "Page settings (buildViews) links to Glass settings").toBe(true);
    expect(/settingsCrossLink\("page"/.test(fnBody("buildSettings")), "Glass settings (buildSettings) links to Page settings").toBe(true);
  });

  it("both openers are registered, so neither link is drawn pointing at nothing", () => {
    expect(/settingsOpeners\.page = function/.test(JS), '/settingsOpeners\\.page = function/').toBe(true);
    expect(/settingsOpeners\.glass = function/.test(JS), '/settingsOpeners\\.glass = function/').toBe(true);
  });

  it("the glass id is untouched — it is the contract the tests and STRIP_DEFAULT key on", () => {
    expect(JS.includes('chromeTile("glass-settings"'), "the glass-settings chrome tile").toBe(true);
    expect(JS.includes('"glass-settings"'), "the glass-settings id").toBe(true);
  });
});
