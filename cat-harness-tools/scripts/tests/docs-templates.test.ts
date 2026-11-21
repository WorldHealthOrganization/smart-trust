/**
 * Bean `blv9`. The rule is decidable for a LITERAL and not for a variable,
 * and most of these pin the second half — a check that flagged every
 * unfiltered interpolation would report two working links as defects.
 *
 * @module cat-harness/scripts/tests/docs-templates
 */
import { describe, expect, test } from "bun:test";

import { checkDocsTemplates, judge, unresolved } from "../check-docs-templates.ts";

describe("a literal is judged", () => {
  test("a site-root-absolute literal without a filter FAILS", () => {
    expect(judge("{{ '/assets/js/docs-ui.js' }}")).toBe("unresolved-literal");
  });

  test("...and passes once filtered, by either filter", () => {
    expect(judge("{{ '/assets/js/docs-ui.js' | relative_url }}")).toBe("ok");
    expect(judge("{{ '/assets/js/docs-ui.js' | absolute_url }}")).toBe("ok");
  });

  test("a literal that is ALREADY relative needs no filter", () => {
    // `#anchor` and `mailto:` are not site-root paths; demanding a filter
    // here would be the check inventing work.
    expect(judge("{{ '#section' }}")).toBe("ok");
    expect(judge("{{ 'mailto:x@example.org' }}")).toBe("ok");
  });

  test("a trailing filter that does not resolve is still unresolved", () => {
    expect(judge("{{ '/assets/x.css' | escape }}")).toBe("unresolved-literal");
  });
});

describe("a variable is DECLINED, not flagged", () => {
  // The corpus reason, measured 2026-09-22: `viewHref`/`editHref` hold
  // `${repoUrl}/blob/${branch}/${path}`. Filtering them would 404 both.
  test("an absolute forge URL in a variable is not a finding", () => {
    expect(judge("{{ st.viewHref }}")).toBe("declined");
    expect(judge("{{ st.editHref }}")).toBe("declined");
  });

  test("a site-root variable is also declined — the template cannot see it", () => {
    expect(judge("{{ st.art.card.src }}")).toBe("declined");
  });

  test("a filtered variable is OK, because the filter is visible", () => {
    expect(judge("{{ st.art.card.src | relative_url }}")).toBe("ok");
  });

  test("declined never reaches the failing set", () => {
    const f = [
      { file: "a", line: 1, attr: "href", expr: "{{ st.viewHref }}", verdict: "declined" as const },
      { file: "b", line: 2, attr: "src", expr: "{{ '/x' }}", verdict: "unresolved-literal" as const },
    ];
    expect(unresolved(f).map((x) => x.file)).toEqual(["b"]);
  });
});

describe("this repository's own templates", () => {
  // One scan for both tests: it is pure and read-only, and both called it with
  // no argument, so the second call recomputed the same value (bean `6brk`).
  let scanned: ReturnType<typeof checkDocsTemplates> | undefined;
  const templates = () => (scanned ??= checkDocsTemplates());

  test("carry no unresolved site-root literal", () => {
    const { findings } = templates();
    expect(unresolved(findings).map((f) => `${f.file}:${f.line}`)).toEqual([]);
  });

  test("and were actually examined — an empty corpus is not a pass", () => {
    const { files, findings } = templates();
    expect(files).toBeGreaterThan(0);
    expect(findings.length).toBeGreaterThan(0);
  });
});
