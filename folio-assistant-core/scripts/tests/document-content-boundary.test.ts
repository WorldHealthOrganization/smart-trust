/**
 * The content half of the document adapter imports nothing that moves to
 * `cat-harness-tools` (bean `w2gr`, step 2).
 *
 * Ruling C1 (2026-10-01, later the same day) put `cat-harness-tools` BELOW core,
 * so the rule this test keeps is now "core must not depend on the MCP server".
 * It was first written against the earlier ruling, that `folio-assistant-core`
 * does not depend on
 * `cat-harness-tools`, where the MCP server, the HTTP routes and RBAC are
 * moving. So the document adapter was cut in two: `content.ts` is what a
 * document folio IS, and `index.ts` is the server wrapper step 3 moves out.
 * This test is what keeps the cut honest — a content file that reaches for
 * `Request`, a tool registrar or the RBAC module fails here, before step 3
 * turns that reach into a dependency the ruling forbids.
 *
 * The moving set is the w2gr classification: the server entry points, the
 * tool and route modules, RBAC and GitHub auth, the auth gateway, the MCP
 * project, and the MCP server adapter. `core/{git,feedback,cache,logging,
 * anthropic}` STAY — they import nothing from the server.
 *
 * @module folio-assistant-core/scripts/tests/document-content-boundary.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(import.meta.dir, "..", "..", "adapters", "document");
const CONTENT_FILES = ["content.ts", "resolver.ts", "intake-records.ts", "paths.ts"];

const MOVING = [
  /cat-harness\/src\/(index|server|route-groups|tool-groups|types)\.js$/,
  /cat-harness\/src\/tools\//,
  /cat-harness\/src\/routes\//,
  /cat-harness\/src\/core\/(rbac|github-auth)\.js$/,
  /cat-harness\/src\/auth\//,
  /cat-harness\/src\/mcp\//,
  /cat-harness\/adapters\/mcp-server\//,
  /^@modelcontextprotocol\//,
];

function importsOf(file: string): string[] {
  const src = readFileSync(join(DIR, file), "utf-8");
  return [...src.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)";/gms)].map((m) => m[1]!);
}

describe("the document adapter's content half", () => {
  for (const file of CONTENT_FILES) {
    test(`importsNothingMoving[${file}]`, () => {
      const imports = importsOf(file);
      // Anti-vacuity: a regex that stopped matching would pass every file.
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.filter((i) => MOVING.some((rx) => rx.test(i)))).toEqual([]);
    });
  }

  test("contentDeclaresClass", () => {
    const src = readFileSync(join(DIR, "content.ts"), "utf-8");
    expect(src).toContain("export class DocumentContent implements ContentSource");
    const server = readFileSync(join(DIR, "index.ts"), "utf-8");
    expect(server).toContain("export class DocumentContentAdapter extends DocumentContent implements ContentAdapter");
  });

  test("guardHasTeeth", () => {
    // If index.ts stopped matching, the pattern list would be wrong, and the
    // assertions above would prove nothing.
    expect(importsOf("index.ts").filter((i) => MOVING.some((rx) => rx.test(i))).length).toBeGreaterThan(0);
  });
});
