/** A directory declared `builtAtPublish` is not "declared but absent" at a pin (smart-base `docs/`). */
import { describe, expect, it } from "bun:test";

import { builtAtPublishDirectories } from "../scripts/remote-mount.ts";

describe("builtAtPublishDirectories", () => {
  it("names a directory by its entry's `directory` or by its path", () => {
    const decl = JSON.stringify({
      directories: [
        { id: "x-docs", path: "docs/" },
        { id: "x-site", path: "site" },
        { id: "x-skills", path: "skills/" },
      ],
      builtAtPublish: [
        { path: "ns/context/v1.jsonld" },
        { path: "docs/", directory: "x-docs" },
        { path: "./site/" },
      ],
    });
    expect([...builtAtPublishDirectories(decl)].sort()).toEqual(["x-docs", "x-site"]);
  });

  it("names nothing for an old declaration, or text that is not JSON", () => {
    expect(builtAtPublishDirectories(JSON.stringify({ directories: [{ id: "a", path: "a/" }] })).size).toBe(0);
    expect(builtAtPublishDirectories("not json").size).toBe(0);
  });
});
