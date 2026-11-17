/**
 * @module scripts/tests/playwright-chromium.test
 */
import { describe, expect, it } from "bun:test";
import { resolveChromium } from "../playwright-chromium";

const LS = (entries: string[]) => () => entries;
const NONE = () => {
  throw new Error("ENOENT");
};

describe("which Chromium Playwright launches", () => {
  it("an explicitly named binary wins over everything else", () => {
    const c = resolveChromium(
      // input-site: inert #ed10fbb4 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      { PLAYWRIGHT_CHROMIUM_PATH: "/tmp/mine/chrome", PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" },
      LS(["chromium-1194"]),
      () => true,
    );
    expect(c.kind).toBe("explicit");
    // input-site: inert #936c47ce — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(c.path).toBe("/tmp/mine/chrome");
  });

  it("without a pinned browsers directory it defers to Playwright", () => {
    const c = resolveChromium({}, LS([]), () => true);
    expect(c.kind).toBe("expected");
    expect(c.path).toBeUndefined();
  });

  it("uses the build the image actually ships, and says which", () => {
    const c = resolveChromium({ PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" }, LS(["ffmpeg-1011", "chromium-1194"]), () => true);
    expect(c.kind).toBe("fallback");
    expect(c.path).toBe("/opt/pw/chromium-1194/chrome-linux/chrome");
    expect(c.note).toContain("chromium-1194");
  });

  it("prefers the newest revision when an image carries several", () => {
    // Named, not counted: the assertion is which build was chosen, so adding
    // a third to the fixture cannot quietly change what this test proves.
    const c = resolveChromium(
      { PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" },
      LS(["chromium-1194", "chromium-1228"]),
      () => true,
    );
    expect(c.path).toBe("/opt/pw/chromium-1228/chrome-linux/chrome");
  });

  it("an unreadable browsers directory is UNKNOWN, never a guessed path", () => {
    const c = resolveChromium({ PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" }, NONE, () => true);
    expect(c.kind).toBe("unknown");
    expect(c.path).toBeUndefined();
  });

  it("a directory holding no Chromium is UNKNOWN, not a fabricated launch path", () => {
    // The trap this guards: returning a composed path that does not exist
    // turns Playwright's clear "Executable doesn't exist" into a confusing
    // failure naming a directory nobody configured.
    const c = resolveChromium({ PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" }, LS(["ffmpeg-1011"]), () => true);
    expect(c.kind).toBe("unknown");
  });

  it("a Chromium directory whose binary is absent does not get launched", () => {
    const c = resolveChromium({ PLAYWRIGHT_BROWSERS_PATH: "/opt/pw" }, LS(["chromium-1194"]), () => false);
    expect(c.kind).toBe("unknown");
    expect(c.path).toBeUndefined();
  });
});
