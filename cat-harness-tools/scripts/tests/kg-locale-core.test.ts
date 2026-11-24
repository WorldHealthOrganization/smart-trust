/**
 * `kg-locale-export.ts --core`: the core document kg-export just wrote, read
 * instead of built again (bean fwtz, the KG step). A file that is not this
 * run's core must be refused, never translated as if it were.
 */
import { describe, expect, test } from "bun:test";

import { buildLocaleExports } from "../kg-locale-export.ts";

describe("--core", () => {
  test("a core document with another @id is refused before anything is translated", async () => {
    await expect(buildLocaleExports({ core: { "@id": "https://example.org/not-this.jsonld", "@graph": [] } })).rejects.toThrow(
      /not this run's core document/,
    );
  });
});
