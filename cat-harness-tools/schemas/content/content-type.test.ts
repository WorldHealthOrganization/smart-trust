/**
 * The content-type registry's two marker forms: a file, and a section of the
 * root `index.config.json` (owner, 2026-10-24).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ContentTypeConflictError, ContentTypeRegistry, describeRepository } from "./content-type";
import { IndexConfigSchema, INDEX_CONFIG_SCHEMA } from "../kg/index-config";

function repo(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "content-type-"));
  try {
    for (const [f, body] of Object.entries(files)) writeFileSync(join(root, f), body);
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function registry(): ContentTypeRegistry {
  const r = new ContentTypeRegistry();
  r.register("widget", {
    filename: { indexSection: "widget" },
    type: "http://example.org/Widget",
    summary: "a test type declared as an index section",
    facts: (d) => ({ name: typeof (d as { name?: unknown }).name === "string" ? (d as { name: string }).name : undefined }),
  });
  r.register("gadget", {
    filename: "gadget.config.json",
    type: "http://example.org/Gadget",
    summary: "a test type declared as a file",
    facts: (d) => ({ name: typeof (d as { name?: unknown }).name === "string" ? (d as { name: string }).name : undefined }),
  });
  return r;
}

const index = (contentTypes?: unknown) =>
  JSON.stringify({ $schema: INDEX_CONFIG_SCHEMA, instances: [], ...(contentTypes === undefined ? {} : { contentTypes }) });

describe("a content type declared as an index section", () => {
  test("the section's presence is membership, and its contents are the facts", () => {
    repo({ "index.config.json": index({ widget: { name: "w" } }) }, (root) => {
      const d = describeRepository(root, registry());
      expect(d.types).toEqual([
        { id: "widget", type: "http://example.org/Widget", marker: "index.config.json#contentTypes.widget", parsed: true, facts: { name: "w" } },
      ]);
    });
  });

  test("an index without the section is not a member, like an absent file", () => {
    repo({ "index.config.json": index({ other: {} }) }, (root) => {
      expect(describeRepository(root, registry()).types).toEqual([]);
    });
    repo({ "index.config.json": index() }, (root) => {
      expect(describeRepository(root, registry()).types).toEqual([]);
    });
    repo({}, (root) => expect(describeRepository(root, registry()).types).toEqual([]));
  });

  test("an unreadable index reports the type unparsed rather than dropping it", () => {
    repo({ "index.config.json": "{ not json" }, (root) => {
      const [m] = describeRepository(root, registry()).types;
      expect(m).toMatchObject({ id: "widget", parsed: false, facts: {} });
    });
  });

  test("a section and a file stating one fact differently are reported, not resolved", () => {
    repo({ "index.config.json": index({ widget: { name: "a" } }), "gadget.config.json": '{"name":"b"}' }, (root) => {
      expect(describeRepository(root, registry()).disagreements).toEqual([{ fact: "name", claims: { widget: "a", gadget: "b" } }]);
    });
  });

  test("registering the same section twice is a diamond; a different section is a conflict", () => {
    const r = registry();
    const def = { filename: { indexSection: "widget" }, type: "http://example.org/Widget", summary: "again" };
    expect(() => r.register("widget", def)).not.toThrow();
    expect(() => r.register("widget", { ...def, filename: { indexSection: "other" } })).toThrow(ContentTypeConflictError);
  });
});

describe("index.config.json carries the sections without knowing what they hold", () => {
  test("any object under a well-formed id is accepted, and kept", () => {
    const c = IndexConfigSchema.parse(JSON.parse(index({ widget: { anything: [1], deep: { x: 1 } } })));
    expect(c.contentTypes).toEqual({ widget: { anything: [1], deep: { x: 1 } } });
  });

  test("a section that is not an object, or a malformed id, is refused", () => {
    expect(IndexConfigSchema.safeParse(JSON.parse(index({ widget: 5 }))).success).toBe(false);
    expect(IndexConfigSchema.safeParse(JSON.parse(index({ Widget: {} }))).success).toBe(false);
  });
});

describe("index.config.json is never itself a harness marker", () => {
  test("a repository carrying only an index is not a harness", async () => {
    const { registerBaseContentTypes } = await import("./content-types-base");
    const r = new ContentTypeRegistry();
    registerBaseContentTypes(r);
    // Whatever the index holds — a section, none, a section named for the
    // harness, the harness's own fields, or not JSON at all — it is not one.
    const indexes = [
      index({ widget: {} }),
      index(),
      index({ harness: { name: "h" } }),
      JSON.stringify({ name: "index", stub: "x" }),
      "not json",
    ];
    for (const body of indexes) {
      repo({ "index.config.json": body }, (root) => {
        expect({ body, types: describeRepository(root, r).types.map((t) => t.id) }).toEqual({ body, types: [] });
      });
    }
    // The check can fire: the same registry does find a harness by a
    // `.config.json` marker of any other name, beside the same index.
    repo({ "index.config.json": index({ widget: {} }), "acme.config.json": "{}" }, (root) => {
      const found = describeRepository(root, r).types;
      expect(found.map((t) => t.id)).toEqual(["harness"]);
      expect(found[0]!.marker).toBe("acme.config.json");
    });
  });
});
