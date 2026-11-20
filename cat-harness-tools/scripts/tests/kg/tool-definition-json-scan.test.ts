/**
 * A Tool declared as data (`<id>/<id>.json`, bean `y9r6`) is scanned for
 * declared-path literals like a `.ts` one: its `$comment` list is prose and
 * not scanned, and a `declared-path-literal:` comment covers the value at
 * its JSON pointer.
 */
import { describe, expect, test } from "bun:test";
import { toolDefinitionText } from "../../check-declared-paths.ts";

const file = JSON.stringify(
  {
    $schema: "tool-definition/v1",
    tool: { id: "x", maintains: [{ source: "schemas/a.ts", artefact: "ns/a.jsonld" }] },
    $comment: [
      { at: "/maintains/0/artefact", comment: "declared-path-literal: this node IS the declaration\nof the artefact." },
      { at: "", comment: "Prose naming schemas/b.ts is not a reference." },
    ],
  },
  null,
  2,
);

describe("toolDefinitionText", () => {
  test("other JSON is not a Tool definition", () => {
    expect(toolDefinitionText('{"$schema":"block-manifest/v1"}')).toBeUndefined();
    expect(toolDefinitionText("{ not json")).toBeUndefined();
  });

  test("the $comment list is blanked; line numbers survive", () => {
    const { code } = toolDefinitionText(file)!;
    expect(code.split("\n").length).toBe(file.split("\n").length);
    expect(code).toContain('"schemas/a.ts"');
    expect(code).not.toContain("schemas/b.ts");
  });

  test("a marker covers the line of the value at its pointer, and only that", () => {
    const { cover } = toolDefinitionText(file)!;
    const lines = file.split("\n");
    const covered = [...cover.keys()].map((n) => lines[n]!.trim());
    expect(covered).toEqual(['"artefact": "ns/a.jsonld"']);
    expect([...cover.values()][0]).toBe("this node IS the declaration of the artefact.");
  });
});
