/**
 * A Schema node's page reads as documentation: its module's description and a
 * fields table per public `*Schema` export (`scripts/lib/schema-page.ts`).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { namedJsonSchema } from "../../../schemas/kg/to-json-schema.ts";
import { docblockProse, fieldRows, proseHtml, schemaPageDetails, schemaSectionHtml, typeLabel } from "../../lib/schema-page.ts";

const MODULE = `/**
 * Qualified Dublin Core, as a graph node.
 *
 * ## Why
 *
 * Every field is \`element.qualifier\`, see {@link DcFieldSchema}.
 *
 * - repeated
 * - language-tagged
 *
 * @module schemas/dublin-core
 * @graphNode schema
 */
export const x = 1;
`;

const Value = z.object({ value: z.string().describe("The literal."), language: z.string().optional() });
const Record = z.object({ id: z.string(), fields: z.array(z.object({ element: z.string(), values: z.array(Value) })), kind: z.enum(["a", "b"]) });

describe("schema page", () => {
  test("the docblock's prose keeps everything but its tags", () => {
    const prose = docblockProse(MODULE);
    expect(prose.startsWith("Qualified Dublin Core, as a graph node.")).toBe(true);
    expect(prose).not.toContain("@module");
    expect(prose).not.toContain("@graphNode");
  });

  test("prose renders headings, lists, code and links, escaped", () => {
    const html = proseHtml(docblockProse(MODULE) + "\n\nA <script> tag.");
    expect(html).toContain("<h4>Why</h4>");
    expect(html).toContain("<ul><li>repeated</li><li>language-tagged</li></ul>");
    expect(html).toContain("<code>element.qualifier</code>");
    expect(html).toContain("<code>DcFieldSchema</code>");
    expect(html).toContain("A &lt;script&gt; tag.");
  });

  test("fields are flattened through arrays of objects, with required and descriptions", () => {
    const rows = fieldRows(namedJsonSchema(Record, "Record"));
    expect(rows.map((r) => [r.path, r.type, r.required])).toEqual([
      ["id", "string", true],
      ["fields", "array of object", true],
      ["fields[].element", "string", true],
      ["fields[].values", "array of object", true],
      ["fields[].values[].value", "string", true],
      ["fields[].values[].language", "string", false],
      ["kind", '"a" | "b"', true],
    ]);
    expect(rows.find((r) => r.path === "fields[].values[].value")?.description).toBe("The literal.");
  });

  test("a type label reads unions once", () => {
    expect(typeLabel({ anyOf: [{ type: "array" }, { type: "array" }] })).toBe("array");
    expect(typeLabel({ const: "folio-dublin-core/v1" })).toBe('= "folio-dublin-core/v1"');
  });

  test("details join a node's module prose and its exports' renderings, with a link only when given", () => {
    const root = mkdtempSync(join(tmpdir(), "schema-page-"));
    writeFileSync(join(root, "dc.ts"), MODULE);
    const details = schemaPageDetails(
      root,
      [{ "@id": "https://x/schema/dc", module: "dc.ts" }],
      [
        { module: "dc.ts", exportName: "RecordSchema", schema: namedJsonSchema(Record, "Record"), href: "zod/dc/RecordSchema.schema.json" },
        { module: "other.ts", exportName: "OtherSchema", schema: {} },
      ],
    );
    rmSync(root, { recursive: true, force: true });
    const d = details.get("https://x/schema/dc")!;
    expect(d.exports.map((e) => e.exportName)).toEqual(["RecordSchema"]);
    const html = schemaSectionHtml(d);
    expect(html).toContain("<h2>Description</h2>");
    expect(html).toContain('<a href="zod/dc/RecordSchema.schema.json">JSON Schema</a>');
    expect(html).toContain("<code>fields[].values[].value</code>");
  });

  test("a module with no exports shows its description and no schemas heading", () => {
    const html = schemaSectionHtml({ prose: "A mint rule.", exports: [] });
    expect(html).toContain("<p>A mint rule.</p>");
    expect(html).not.toContain("<h2>Schemas</h2>");
  });
});
