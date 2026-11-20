/**
 * A subject page draws a literal's Markdown code spans as `<code>`, so a
 * placeholder written in one (`<doc-id>.<section>.<n>`) is displayed markup,
 * not a block tag leaked as text that `check:escaped-markup` refuses.
 */
import { describe, expect, test } from "bun:test";

import { escapedTagsIn } from "../check-escaped-markup.ts";
import { literalHtml } from "../kg-export.ts";

describe("literalHtml", () => {
  const description = "keyed `<doc-id>.<section>.<n>`, `provenance: extracted`, and <b>not</b> a tag";

  test("a code span is drawn as <code>, with its content escaped", () => {
    expect(literalHtml(description)).toBe(
      "keyed <code>&lt;doc-id&gt;.&lt;section&gt;.&lt;n&gt;</code>, <code>provenance: extracted</code>, and &lt;b&gt;not&lt;/b&gt; a tag",
    );
  });

  test("the page it yields carries no escaped block tag", () => {
    expect(escapedTagsIn("p.html", `<td>${literalHtml(description)}</td>`)).toEqual([]);
    // The same text without the code span is still found: the check is not blinded.
    expect(escapedTagsIn("p.html", `<td>${literalHtml("keyed <section>")}</td>`).length).toBe(1);
  });

  test("an unpaired backtick stays text", () => {
    expect(literalHtml("a ` b")).toBe("a ` b");
  });
});
