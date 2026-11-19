import { describe, expect, test } from "bun:test";

import { stripInlineCode, withInlineCode } from "./inline-code.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("backtick spans become <code> — bean `mylx`", () => {
  test("a span is wrapped, and the text around it is escaped", () => {
    expect(withInlineCode("run `bun <x>` & go", esc)).toBe("run <code>bun &lt;x&gt;</code> &amp; go");
  });
  test("several spans on one line", () => {
    expect(withInlineCode("`a` and `b`", esc)).toBe("<code>a</code> and <code>b</code>");
  });
  test("the caller's escaper reaches the code span too", () => {
    const braces = (s: string) => esc(s).replace(/{/g, "&#123;");
    expect(withInlineCode("`{{ x }}`", braces)).toBe("<code>&#123;&#123; x }}</code>");
  });
  test("an unpaired backtick is left as written, not guessed at", () => {
    expect(withInlineCode("it's a ` stray", esc)).toBe("it's a ` stray");
  });
  test("an empty pair is not a span", () => {
    expect(withInlineCode("`` two", esc)).toBe("`` two");
  });
  test("strip removes only the markers", () => {
    expect(stripInlineCode("`MathlibExt` Curator")).toBe("MathlibExt Curator");
  });
});
