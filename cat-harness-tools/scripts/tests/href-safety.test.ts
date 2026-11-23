/**
 * A renderer that ignores the scheme check fails HERE rather than shipping.
 *
 * Bean `folio-assistant-q2wm`, R17. The bean's second done-when asks for
 * exactly this: *"a renderer that ignores the hint fails a test rather than
 * shipping"*.
 *
 * ## Why this is a SOURCE check and not only a behavioural one
 *
 * A behavioural test proves the paths it exercises. This one has to cover the
 * paths nobody thought to exercise — the next `href` somebody adds — so it
 * reads the source and requires every one of them to go through `safeHref`.
 *
 * It is a blunt instrument and that is deliberate: a new `href:` that is safe
 * by composition still has to say so, by going through the check or by
 * carrying an exemption with a reason. The alternative is a rule that lives in
 * a comment, which is the consumer-burden failure this issue already found
 * twice.
 *
 * @module scripts/tests/href-safety.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.js";
import { ALLOWED_URL_SCHEMES, safeHref } from "../../schemas/ui/safe-url.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const CLIENT = join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"));
/** The harness icon row's drawing, loaded on pages without `docs-ui.js` (beans `lhvt`, `9rq1`). */
const ROW_CLIENT = join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js"));
const LISTING = join(TOOLS_ROOT, "scripts", "todo-listing.ts");

/** `href: <expr>` / `href="<expr>"` sites, with their line numbers. */
function hrefSites(source: string): Array<{ line: number; text: string }> {
  return source
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => /\bhref\s*[:=]/.test(text))
    .filter(({ text }) => !/^\s*(\*|\/\/)/.test(text));
}

/**
 * `// href-safe: <reason>` at the end of a line — the exemption with a reason.
 * For a URL the page mints itself (a `blob:` URL over its own bytes), which is
 * never data from a document and which `safeHref`'s allow-list would refuse.
 */
const EXEMPT = /\/\/\s*href-safe:\s*\S.{8,}$/;

describe("every href in the client goes through the check", () => {
  const source = readFileSync(CLIENT, "utf-8");

  test("there ARE href sites, so this is not vacuous", () => {
    // Without this, a refactor that renamed the attribute would empty the
    // check and it would pass — the `pzdv` shape.
    expect(hrefSites(source).length).toBeGreaterThan(3);
  });

  test("each one calls `safeHref`, or renders a value that came from it", () => {
    // Reachability, not line-locality: a site may bind the checked value to a
    // name first, and a test that demanded the call ON THE LINE would be
    // asserting a coding style rather than the property.
    const boundFromCheck = new Set(
      [...source.matchAll(/var\s+(\w+)\s*=\s*safeHref\(/g)].map((m) => m[1]!),
    );
    const offenders = hrefSites(source).filter(({ text }) => {
      if (text.includes("safeHref") || text.includes("ALLOWED_URL_SCHEMES")) return false;
      // The exemption the header promises, made real: a line that says WHY it
      // is safe by composition. A bare marker with no reason is not one.
      if (EXEMPT.test(text)) return false;
      const value = /\bhref\s*:\s*([A-Za-z_$][\w$]*)\b/.exec(text);
      return !(value && boundFromCheck.has(value[1]!));
    });
    expect(
      offenders.map((o) => `${o.line}: ${o.text.trim()}`),
      "a new href must go through `safeHref` — see `schemas/ui/safe-url.ts`",
    ).toEqual([]);
  });

  test("every exemption is listed here, so adding one is a visible change", () => {
    // An exemption is a claim a reviewer should read. Pinning the list makes
    // a new one fail this test until someone adds it on purpose.
    const exempt = hrefSites(source).filter(({ text }) => EXEMPT.test(text)).map(({ text }) => text.trim().split("//")[0]!.trim());
    expect(exempt).toEqual(['var a = el("a", { href: url, download: name });']);
  });

  test("the client's allow-list is the same list as the model's", () => {
    // Two implementations of one rule, and this is the join. A scheme added to
    // one and not the other is a disagreement about what may be rendered.
    const declared = source.match(/var ALLOWED_URL_SCHEMES = \[(.*?)\]/s);
    expect(declared, "the client declares its allow-list").not.toBeNull();
    const clientSchemes = [...declared![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(ALLOWED_URL_SCHEMES.length).toBeGreaterThan(0);
    expect(clientSchemes).toEqual([...ALLOWED_URL_SCHEMES]);
  });
});

describe("every href in the navbar row's own script goes through the check", () => {
  const source = readFileSync(ROW_CLIENT, "utf-8");

  test("there IS an href site", () => {
    expect(hrefSites(source).length).toBeGreaterThan(0);
  });

  test("each one renders a value `safeHref` returned, with no exemption", () => {
    const boundFromCheck = new Set([...source.matchAll(/var\s+(\w+)\s*=\s*safeHref\(/g)].map((m) => m[1]!));
    const offenders = hrefSites(source).filter(({ text }) => {
      if (text.includes("safeHref") || text.includes("ALLOWED_URL_SCHEMES")) return false;
      const value = /\bhref\s*:\s*([A-Za-z_$][\w$]*)\b/.exec(text);
      return !(value && boundFromCheck.has(value[1]!));
    });
    expect(offenders.map((o) => `${o.line}: ${o.text.trim()}`)).toEqual([]);
  });

  test("its allow-list is the client's, scheme for scheme", () => {
    const list = (src: string) =>
      [...(src.match(/var ALLOWED_URL_SCHEMES = \[(.*?)\]/s)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(list(source)).toEqual(list(readFileSync(CLIENT, "utf-8")));
    expect(list(source).length).toBeGreaterThan(0);
  });
});

describe("every href in the server-rendered listing goes through the check", () => {
  const source = readFileSync(LISTING, "utf-8");

  test("there ARE href sites", () => {
    expect(hrefSites(source).length).toBeGreaterThan(1);
  });

  test("each one renders a value `safeHref` returned", () => {
    // Checked by REACHABILITY rather than by the same line: the listing binds
    // the checked value to a name first, so a line-local test would be
    // asserting a coding style instead of the property.
    for (const { line, text } of hrefSites(source)) {
      const emits = /`<a href="\$\{escapeHtml\((\w+)\)\}"/.exec(text);
      if (!emits) continue;
      const bound = emits[1]!;
      expect(
        new RegExp(`(const|let)\\s+${bound}\\s*=\\s*safeHref\\(`).test(source),
        `line ${line}: \`${bound}\` must come from safeHref`,
      ).toBe(true);
    }
  });

  test("`escapeHtml` is never the only thing between input and an href", () => {
    // The trap this whole unit is about: an escaper closes tags and does
    // nothing about a scheme, so it is the wrong tool that looks like the
    // right one.
    expect(source).not.toMatch(/href="\$\{escapeHtml\((item|r)\.\w*[Hh]ref\)\}/);
  });
});

describe("the check refuses what the schemas permit", () => {
  test("a scheme no list allows never reaches a link", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,x", "\tjavascript:x", "//evil"]) {
      expect(safeHref(u), u).toBeUndefined();
    }
  });
});
