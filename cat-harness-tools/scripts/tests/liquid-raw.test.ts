/**
 * `wrapRaw` renders back to exactly its input, whatever the input holds —
 * above all the raw block's own closing tag, which ended a generated skill
 * page's raw block early and broke the staging build (bean `kjbb`).
 *
 * Two oracles. `render` below models only what `wrapRaw` emits — raw blocks
 * and `{{ "…" }}` string output — and fails loudly on any other Liquid, so it
 * runs everywhere. When Ruby with the `liquid` gem is present the same cases
 * also go through the real parser in strict mode; CI installs neither, which
 * is why the model exists (see `liquid-includes.test.ts` for the same trade).
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { escapeForRaw, wrapRaw } from "../lib/liquid-raw.ts";

const OPEN = "{%";
const CLOSE_TAG = `${OPEN} endraw %}`;

const CASES: Record<string, string> = {
  "plain prose": "No Liquid here at all.",
  "expression and tag syntax": "Math {{ x }} and a {% if %} with no expression.",
  "the closing tag in a code span": `Write \`${OPEN} raw %}…${CLOSE_TAG}\` around it.`,
  "whitespace-control and spacing variants": `${OPEN}- endraw -%} ${OPEN}endraw%} ${OPEN}   endraw   %}`,
  "the closing tag alone": CLOSE_TAG,
  "the closing tag then a tag that would not parse": `${CLOSE_TAG}\n${OPEN} if %}`,
  "a word that merely starts with endraw": `${OPEN} endrawn %}`,
};

/** Render the subset of Liquid that `wrapRaw` emits; throw on anything else. */
function render(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const raw = /^\{%-?\s*raw\s*-?%\}/.exec(src.slice(i));
    if (raw) {
      i += raw[0].length;
      const end = /\{%-?\s*endraw\s*-?%\}/.exec(src.slice(i));
      if (!end) throw new Error("raw block never closed");
      out += src.slice(i, i + end.index);
      i += end.index + end[0].length;
      continue;
    }
    const str = /^\{\{\s*"([^"]*)"\s*\}\}/.exec(src.slice(i));
    if (str) {
      out += str[1];
      i += str[0].length;
      continue;
    }
    if (src.startsWith("{%", i) || src.startsWith("{{", i)) {
      throw new Error(`Liquid outside a raw block at ${i}: ${src.slice(i, i + 30)}`);
    }
    out += src[i];
    i += 1;
  }
  return out;
}

const rubyLiquid = spawnSync("ruby", ["-e", 'require "liquid"'], { encoding: "utf-8" }).status === 0;

describe("wrapRaw", () => {
  it.each(Object.entries(CASES))("round-trips %s", (_name, text) => {
    expect(render(wrapRaw(text).join(""))).toBe(text);
  });

  it("leaves text without a closing tag untouched", () => {
    expect(escapeForRaw(CASES["expression and tag syntax"])).toBe(CASES["expression and tag syntax"]);
  });

  it("is what the unescaped form gets wrong", () => {
    // Guards the oracle: without the escape, the same input must fail.
    expect(() => render(["{% raw %}", CASES["the closing tag then a tag that would not parse"], "{% endraw %}"].join(""))).toThrow();
  });

  it.skipIf(!rubyLiquid)("round-trips every case through Ruby Liquid (strict)", () => {
    const script =
      'require "liquid"; require "json"; ' +
      "JSON.parse(STDIN.read.force_encoding('UTF-8')).each { |s| print JSON.generate(Liquid::Template.parse(s, error_mode: :strict).render), \"\\n\" }";
    const inputs = Object.values(CASES).map((t) => wrapRaw(t).join(""));
    const res = spawnSync("ruby", ["-e", script], { input: JSON.stringify(inputs), encoding: "utf-8" });
    expect(res.stderr).toBe("");
    const rendered = res.stdout.trim().split("\n").map((l) => JSON.parse(l) as string);
    expect(rendered).toEqual(Object.values(CASES));
  });
});
