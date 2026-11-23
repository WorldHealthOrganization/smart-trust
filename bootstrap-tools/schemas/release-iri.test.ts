/**
 * A layer's release addresses, and the sync that keeps literal copies of
 * them at the declared major (owner, 2026-10-23, option "B. Major in
 * address": every address carries the major only; the pin fixes the release).
 */
import { describe, expect, test } from "bun:test";

import { bootstrapRelease, releaseIri, releaseIris, tagCompatible } from "./release-iri";
import { rewrite } from "../scripts/iri-sync";

const R = releaseIris({ iriBase: "https://example.org/kg/", version: "2.3.4" })!;

describe("releaseIris", () => {
  test("iriCarriesMajorOnly", () => {
    expect(R.agent).toBe("https://example.org/kg/v2/");
    expect(R.human).toBe("https://example.org/kg/v2/");
    expect(R.version).toBe("2.3.4");
    expect(releaseIri(R, "schemas/x.schema.json", "agent")).toBe("https://example.org/kg/v2/schemas/x.schema.json");
    expect(releaseIri(R, "/guide.html", "human")).toBe("https://example.org/kg/v2/guide.html");
  });

  test("refusesMissingIriBaseOrVersion", () => {
    expect(releaseIris({ version: "1.0.0" })).toBeUndefined();
    expect(() => releaseIris({ iriBase: "https://example.org/kg/", version: "v1" })).toThrow();
    expect(() => releaseIris({ iriBase: "https://example.org/kg/" })).toThrow();
  });

  test("bootstrapReleaseIriOwnRepo", () => {
    const b = bootstrapRelease();
    expect(b.iriBase).toBe("https://litlfred.github.io/bootstrap/");
    expect(b.agent).toBe(`${b.iriBase}v${b.major}/`);
    expect(b.agent).not.toContain(b.version);
  });
});

describe("tagCompatible — semver within one major", () => {
  test("sameMajorCompatibleOnly", () => {
    expect(tagCompatible("model-registry/1.9.0", "model-registry", 1)).toBe(true);
    expect(tagCompatible("model-registry/2.0.0", "model-registry", 1)).toBe(false);
    expect(tagCompatible("model-registry/v1", "model-registry", 1)).toBe(false);
    expect(tagCompatible("other/1.0.0", "model-registry", 1)).toBe(false);
  });
});

describe("iri-sync rewrite", () => {
  test("rewritesVersionsToDeclaredMajor", () => {
    const text = [
      'xmlns:a="https://example.org/kg/2.3.3/ns#"',
      'href="https://example.org/kg/v1/guide.html"',
      'declared="https://example.org/kg/2.3.4/ns#"',
      'current="https://example.org/kg/v2/schemas/x.schema.json"',
    ].join("\n");
    const r = rewrite(text, R);
    expect(r.changes).toBe(3);
    expect(r.text).toBe(
      [
        'xmlns:a="https://example.org/kg/v2/ns#"',
        'href="https://example.org/kg/v2/guide.html"',
        'declared="https://example.org/kg/v2/ns#"',
        'current="https://example.org/kg/v2/schemas/x.schema.json"',
      ].join("\n"),
    );
  });

  test("leavesMajorTreeAlone", () => {
    const text = 'a="https://example.org/kg/v2/ns#" b="https://example.org/kg/v2/"';
    expect(rewrite(text, R)).toEqual({ text, changes: 0 });
  });

  test("fromMovesOldBaseOnly", () => {
    const r = rewrite('a="https://old.example/b/processes/ns#x" b="https://old.example/b/"', R, "https://old.example/b/");
    expect(r.text).toBe('a="https://example.org/kg/v2/processes/ns#x" b="https://old.example/b/"');
    expect(r.changes).toBe(1);
  });

  test("neverTouchesOtherBase", () => {
    const text = 'x="https://example.org/other/1.0.0/ns#"';
    expect(rewrite(text, R)).toEqual({ text, changes: 0 });
  });
});


describe("a toolset supports content by major version", () => {
  test("supportsListedMajorsOnly", async () => {
    const { supportsContent } = await import("./declaration.ts");
    const tools = { supports: { bootstrap: [0, 2] } };
    expect(supportsContent(tools, "bootstrap", "0.9.1")).toBe(true);
    expect(supportsContent(tools, "bootstrap", "2.0.0")).toBe(true);
    expect(supportsContent(tools, "bootstrap", "1.0.0")).toBe(false);
    expect(supportsContent(tools, "other", "0.1.0")).toBe(false);
    expect(supportsContent({}, "bootstrap", "0.1.0")).toBe(false);
  });
});
