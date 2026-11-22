/**
 * Default-deny on URL schemes, and the evasions it has to survive.
 *
 * @module schemas/safe-url.test
 */
import { describe, expect, test } from "bun:test";

import { ALLOWED_URL_SCHEMES, checkHref, safeHref } from "./safe-url.js";
import { TodoRelationSchema } from "../sdlc/todo-index.js";

describe("the allowed schemes pass", () => {
  test("http, https, mailto, tel", () => {
    for (const u of [
      "https://example.invalid/x",
      "http://example.invalid/x",
      "mailto:someone@example.invalid",
      "tel:+15551234",
    ]) {
      expect(safeHref(u), u).toBe(u);
    }
  });

  test("the list is what decides — nothing is special-cased past it", () => {
    for (const s of ALLOWED_URL_SCHEMES) {
      expect(safeHref(`${s}//example.invalid`)).toBeDefined();
    }
    // And the other way: a scheme passes exactly when it is on the list. None
    // of these, common and harmless-looking ones included, is let through.
    const others = ["ftp:", "file:", "data:", "javascript:", "vbscript:", "blob:", "ws:", "wss:", "sms:", "about:", "chrome:", "git:", "ssh:", "irc:", "x-custom:"];
    for (const s of [...ALLOWED_URL_SCHEMES, ...others]) {
      expect({ s, passes: safeHref(`${s}//example.invalid`) !== undefined }).toEqual({
        s,
        passes: ALLOWED_URL_SCHEMES.includes(s),
      });
    }
    expect(others.filter((s) => ALLOWED_URL_SCHEMES.includes(s))).toEqual([]);
  });
});

describe("relative references pass, because they cannot introduce a scheme", () => {
  test("paths, fragments and queries", () => {
    for (const u of ["/beans/", "./x.html", "x.html", "#frag", "?q=1"]) {
      expect(safeHref(u), u).toBe(u);
    }
  });

  test("but a PROTOCOL-RELATIVE url does not", () => {
    // `//host/path` looks like a path and is absolute: a folio published over
    // http would fetch it over http, and a reader who checked the page's own
    // scheme would be wrong about where the link goes.
    expect(safeHref("//evil.invalid/x")).toBeUndefined();
  });
});

describe("default-deny — the point of a list rather than a blocklist", () => {
  test("javascript: is refused", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
  });

  test("and so is every scheme nobody has thought about", () => {
    // A blocklist is wrong the day a browser ships a new scheme. An allow-list
    // is wrong only about things it refuses, and a refusal is visible.
    for (const u of [
      "vbscript:msgbox(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "chrome://settings",
      "intent://x#Intent;scheme=http;end",
      "blob:https://example.invalid/uuid",
      "javascript:alert(1)",
    ]) {
      expect(safeHref(u), u).toBeUndefined();
    }
  });

  test("`data:` is refused even for an image — assets are ADDRESSABLE", () => {
    // R17: "assume assets in KG accessible". Allowing the scheme for images
    // would mean parsing the media type to decide — a parser in the middle of
    // a security boundary.
    expect(safeHref("data:image/png;base64,iVBORw0KGgo=")).toBeUndefined();
  });
});

describe("the evasions a naive `startsWith` misses", () => {
  test("case does not change the scheme", () => {
    for (const u of ["JavaScript:alert(1)", "JAVASCRIPT:alert(1)", "jAvAsCrIpT:x"]) {
      expect(safeHref(u), u).toBeUndefined();
    }
  });

  test("leading control characters and whitespace are stripped BEFORE deciding", () => {
    // Every browser strips these from an attribute before parsing it, so
    // `"\tjavascript:x"` is a working `javascript:` URL and is not one to a
    // naive prefix test.
    for (const u of [
      "\tjavascript:alert(1)",
      "\njavascript:alert(1)",
      "\rjavascript:alert(1)",
      " javascript:alert(1)",
      "\u0000javascript:alert(1)",
      "\u000Bjavascript:alert(1)",
    ]) {
      expect(safeHref(u), JSON.stringify(u)).toBeUndefined();
    }
  });

  test("and the same stripping does not break a legitimate url", () => {
    expect(safeHref("  https://example.invalid/x  ")).toBe("https://example.invalid/x");
  });

  test("an empty or whitespace-only url is refused, not passed through", () => {
    // An empty `href` is a link to the current page, which is a link to
    // somewhere wrong rather than to nowhere.
    expect(safeHref("")).toBeUndefined();
    expect(safeHref("   ")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });

  test("a tab, newline or CR INSIDE the scheme is the classic bypass", () => {
    // The URL parser removes exactly these three characters before parsing,
    // so `java\tscript:alert(1)` is `javascript:alert(1)` to a browser and a
    // relative path to a naive scheme test. The first version of `safeHref`
    // shipped this: its leading-whitespace trim left the inner tab alone and
    // the URL passed. This is the spec that caught it.
    for (const u of [
      "java\tscript:alert(1)",
      "java\nscript:alert(1)",
      "java\rscript:alert(1)",
      "j\ta\tv\ta\ts\tc\tr\ti\tp\tt:alert(1)",
    ]) {
      expect(safeHref(u), JSON.stringify(u)).toBeUndefined();
    }
  });

  test("and a legitimate url is normalised the same way a browser would", () => {
    // Not a special case for the safe path: the same removal runs on every
    // input, so what this function judges is what the browser will resolve.
    expect(safeHref("https://example.invalid/a\tb")).toBe("https://example.invalid/ab");
  });
});

describe("checkHref reports the refusal rather than dropping it silently", () => {
  test("a refusal names the url and the allowed schemes", () => {
    const { href, refusal } = checkHref("javascript:alert(1)");
    expect(href).toBeUndefined();
    expect(refusal?.url).toBe("javascript:alert(1)");
    for (const s of ALLOWED_URL_SCHEMES) expect(refusal?.because).toContain(s);
  });

  test("an allowed url carries no refusal", () => {
    expect(checkHref("https://example.invalid/")).toEqual({ href: "https://example.invalid/" });
  });

  test("absent is neither an href nor a refusal", () => {
    // Nothing was asked for, so nothing was refused. A refusal here would
    // report a gap that does not exist.
    expect(checkHref(undefined)).toEqual({});
  });
});

describe("this check is NOT vacuous — the schema permits what the renderer refuses", () => {
  test("`TodoRelationSchema` accepts a javascript: href today", () => {
    // The whole reason this module exists. The property was EMERGENT — every
    // URL that reaches an `href` happens to be composed rather than taken —
    // and an edit that passed an authored one straight through would open the
    // hole and look like a simplification.
    const parsed = TodoRelationSchema.parse({
      axis: "bean",
      label: "x",
      href: "javascript:alert(1)",
    });
    expect(parsed.href).toBe("javascript:alert(1)");
    expect(safeHref(parsed.href)).toBeUndefined();
  });
});
