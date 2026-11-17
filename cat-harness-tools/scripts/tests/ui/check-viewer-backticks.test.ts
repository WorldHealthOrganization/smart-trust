/**
 * The stray-backtick gate, falsified in both directions.
 *
 * @module scripts/tests/check-viewer-backticks
 * @graphNode none — a test
 *
 * The half that matters is the NEGATIVE one. A checker that answered "fine"
 * unconditionally would pass every real file in this repo, since every real
 * file is currently fine — so the real corpus alone proves nothing, and a
 * planted defect is the only evidence the gate works.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { strayBacktick, viewerSources } from "../../check-viewer-backticks.ts";

const ROOT = repoRootFor(join(import.meta.dir, "../../.."));

const ok = [
  "function viewerHtml() {",
  "  return `<!doctype html>",
  "<html><body>",
  "<!-- a comment with no backtick -->",
  "</body>",
  "</html>",
  "`;",
  "}",
].join("\n");

describe("strayBacktick", () => {
  test("a well-formed template is not a finding", () => {
    expect(strayBacktick(ok)).toBeNull();
  });

  test("a backtick in a COMMENT is found, and its line named", () => {
    // The actual failure, four times over: the author is writing prose, not
    // thinking about string syntax, and quotes an identifier the way they
    // would anywhere else.
    const bad = ok.replace(
      "<!-- a comment with no backtick -->",
      "<!-- see the `qttr` bean -->",
    );
    const hit = strayBacktick(bad);
    expect(hit).not.toBeNull();
    expect(hit?.line).toBe(4);
    expect(hit?.text).toContain("qttr");
  });

  test("a backtick BEFORE the template is fine and must stay fine", () => {
    // A doc comment above the function is the common case. A gate that
    // flagged it would be a gate people work around.
    expect(strayBacktick("/** see `foo` */\n" + ok)).toBeNull();
  });

  test("a file with no page template is not a finding", () => {
    expect(strayBacktick("export const x = 1;\n")).toBeNull();
  });

  test("an escaped backtick does not end the literal", () => {
    const esc = ok.replace("<!-- a comment with no backtick -->", "<!-- \\` -->");
    expect(strayBacktick(esc)).toBeNull();
  });
});

describe("an interpolation is CODE, not page text — bean `57n3`", () => {
  const page = (body: string) => `function f() {\n  return \`<!doctype html>\n${body}\n</html>\`;\n}\n`;

  test("a nested template inside ${…} does not end the page", () => {
    // The two false findings this bean was opened for, in miniature. Both
    // `gen-auto-docs.ts` and a PDF generator compile and were reported as
    // defects, because the old rule took the first unescaped backtick.
    expect(strayBacktick(page('<title>${scope ? `x ${esc(s)}` : ""}</title>'))).toBeNull();
  });

  test("a brace inside a STRING inside ${…} does not close the interpolation", () => {
    // `${who ? `…` : "}"}` — miscounting here would end the interpolation
    // early and hand the rest of the page back to the backtick rule.
    expect(strayBacktick(page('<p>${cond ? "}" : `y`}</p>'))).toBeNull();
  });

  test("nested braces inside ${…} are balanced", () => {
    expect(strayBacktick(page("<p>${fn({ a: { b: 1 } })}</p>"))).toBeNull();
  });

  test("but a backtick OUTSIDE an interpolation still ends it — the trap", () => {
    // What the gate is for. A backtick in a comment is ordinary page text to
    // the parser, and ending the literal there is the defect.
    const hit = strayBacktick(page("<!-- a `backtick` in a comment -->"));
    expect(hit).not.toBeNull();
    expect(hit!.text).toContain("backtick");
  });

  test("a template that never closes is not a finding", () => {
    // Could-not-determine: the file is broken for some other reason, and
    // pointing at a backtick would be a guess.
    expect(strayBacktick("function f() { return `<!doctype html>\n<p>no close")).toBeNull();
  });
});

describe("the file set is derived, not listed", () => {
  const sources = viewerSources(ROOT);

  test("it finds the generators, including the one outside cat-harness", () => {
    // `who-iris/scripts/gen-iris-pages.ts` was added to the old array by hand
    // on 2026-09-21, after the trap caught it for the third time in a session.
    // Nothing names it now; the walk finds it.
    expect(sources).toContain("who-iris/scripts/gen-iris-pages.ts");
    expect(sources).toContain("cat-harness-tools/scripts/kg-viewer.ts");
    // A generator whose pages moved onto the theme's layout (2026-10-07) no
    // longer builds a standalone page, so it correctly drops out of the set.
    for (const themed of [
      "cat-harness-tools/scripts/gen-schema-viz.ts",
      "cat-harness-tools/scripts/gen-voices-viz.ts",
      "cat-harness-tools/scripts/gen-uploads-viz.ts",
      "cat-harness-tools/scripts/gen-document-kinds-viz.ts",
      "cat-harness-tools/scripts/gen-translation-status.ts",
      "cat-harness-tools/scripts/gen-auto-docs.ts",
    ]) expect(sources).not.toContain(themed);
    expect(sources).not.toContain("cat-harness-tools/scripts/gen-auto-docs.ts");
  });

  test("it excludes tests, and THIS file is why", () => {
    // `check-viewer-backticks.test.ts` carries a planted stray as a fixture.
    // Scanning it would fail the gate on its own evidence.
    expect(sources.some((f) => f.endsWith(".test.ts"))).toBe(false);
    expect(sources.some((f) => f.endsWith(".e2e.ts"))).toBe(false);
  });

  test("every derived source exists and holds a page template", () => {
    // Without this the gate could pass over a file that moved, which is the
    // vacuous-green failure the check itself guards against.
    expect(sources.length).toBeGreaterThan(0);
    for (const rel of sources) {
      const src = readFileSync(join(ROOT, rel), "utf-8");
      expect(/return\s+`<!doctype html>/i.test(src)).toBe(true);
      expect(strayBacktick(src)).toBeNull();
    }
  });
});
