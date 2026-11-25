import { describe, expect, test } from "bun:test";
import { RENAMES_2026_10_05, retag } from "../retag-schemas.ts";

/** Issue #2195: only the `$schema` VALUE changes; prose naming an old tag is history. */
describe("retag", () => {
  test("a JSON node's top-level $schema", () => {
    const out = retag('{\n  "$schema": "folio-public-comment-changeset/v1",\n  "id": "CS-001"\n}\n', "a.json", RENAMES_2026_10_05);
    expect(out).toBe('{\n  "$schema": "changeset/1.0.0",\n  "id": "CS-001"\n}\n');
  });

  test("a Markdown todo's front matter, and not its prose", () => {
    const md = "---\n$schema: folio-todo/v1\nstatus: open\n---\nWas `folio-todo/v1` before 2026-10-05.\n";
    expect(retag(md, "t.md", RENAMES_2026_10_05)).toBe("---\n$schema: todo/1.0.0\nstatus: open\n---\nWas `folio-todo/v1` before 2026-10-05.\n");
  });

  test("an unrelated tag, or a file already renamed, is left alone", () => {
    expect(retag('{"$schema": "kg-qa/v1"}', "q.json", RENAMES_2026_10_05)).toBeUndefined();
    expect(retag('{"$schema": "todo/1.0.0"}', "q.json", RENAMES_2026_10_05)).toBeUndefined();
  });
});
