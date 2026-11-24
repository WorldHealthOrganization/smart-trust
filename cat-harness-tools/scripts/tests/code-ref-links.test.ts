/**
 * The code-span auto-linker (`scripts/lib/code-ref-links.ts`), owner card
 * "Auto-link + Skills hub", 2026-11-17: which spans are offered to which
 * registry, that only one exact target links, that an ambiguity and a
 * kind-shaped miss are REPORTED rather than guessed, and a fixture page
 * rewritten end to end.
 *
 * @module scripts/tests/code-ref-links
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  linkInlineCode,
  probesFor,
  resolveCodeRef,
  type CodeRefFinding,
  type CodeRefResolver,
  type CodeRefTarget,
} from "../lib/code-ref-links.ts";

const FIXTURE = join(import.meta.dir, "fixtures", "code-ref-links");
const BLOB = "https://example.test/blob/main/scripts/example-gate.ts";

/** A resolver over a handful of known nodes — what `gen-skill-docs` builds from the graph. */
const resolver: CodeRefResolver = {
  skill: (n) => ({ "merge-conflict-patterns": "merge-conflict-patterns.html", "merge-queue": "merge-queue.html" })[n],
  bean: (id) => ({ "0qjq": "https://example.test/beans/0qjq.md", tdmg: "https://example.test/beans/tdmg.md" })[id],
  command: (k) => ({ "merge:guard": BLOB })[k],
  path: (p): CodeRefTarget[] => {
    const table: Record<string, CodeRefTarget[]> = {
      // declared-path-literal: test vector — the owner card's own example span, used as a resolver KEY; nothing reads the file.
      "sdlc/processes/merge-train.bpmn": [{ kind: "process", href: "../../en/cat-harness/processes/merge-train.html" }],
      "schemas/skills/merge-queue.json": [{ kind: "schema", href: "../skills/merge-queue.html" }],
      "scripts/example-gate.ts": [{ kind: "file", href: BLOB }],
      "twice.md": [
        { kind: "file", href: "https://example.test/blob/main/a/twice.md" },
        { kind: "file", href: "https://example.test/blob/main/b/twice.md" },
      ],
    };
    return table[p] ?? [];
  },
};

describe("probesFor — which registry a span's shape offers it to", () => {
  test("a cat command, written either way", () => {
    expect(probesFor("bun run cat merge:guard")).toEqual([{ kind: "command", key: "merge:guard", shaped: true }]);
    expect(probesFor("bun run cat skills:docs --check")).toEqual([{ kind: "command", key: "skills:docs", shaped: true }]);
    expect(probesFor("merge:guard")).toEqual([{ kind: "command", key: "merge:guard", shaped: true }]);
  });

  test("a bean: explicit, digit-shaped, and a letters-only token that is offered but not claimed", () => {
    expect(probesFor("bean 0qjq")).toEqual([{ kind: "bean", key: "0qjq", shaped: true }]);
    expect(probesFor("cat-tools-sm8r")).toContainEqual({ kind: "bean", key: "cat-tools-sm8r", shaped: true });
    expect(probesFor("tdmg")).toContainEqual({ kind: "bean", key: "tdmg", shaped: false });
  });

  test("paths by extension: process, schema, file", () => {
    expect(probesFor("example/processes/train.bpmn")[0]?.kind).toBe("process");
    expect(probesFor("schemas/kg/example.ts")[0]?.kind).toBe("schema");
    expect(probesFor("scripts/example.ts")[0]?.kind).toBe("file");
    expect(probesFor("example/dir/")[0]?.kind).toBe("file");
  });

  test("dates, URLs, branch names and prose are offered to nobody that would report them", () => {
    expect(probesFor("2026-11-17")).toEqual([]);
    expect(probesFor("https://example.test/x.md")).toEqual([]);
    expect(probesFor("cat/cat-harness/beans")).toEqual([]);
    expect(probesFor("not a reference")).toEqual([]);
    expect(probesFor("true").every((p) => !p.shaped)).toBe(true);
  });
});

describe("resolveCodeRef", () => {
  test("one target links", () => {
    expect(resolveCodeRef("merge:guard", resolver)).toEqual({ state: "linked", target: { kind: "command", href: BLOB } });
    expect(resolveCodeRef("tdmg", resolver)).toEqual({ state: "linked", target: { kind: "bean", href: "https://example.test/beans/tdmg.md" } });
  });

  test("two different targets are an ambiguity, never the first", () => {
    const r = resolveCodeRef("twice.md", resolver);
    expect(r.state).toBe("ambiguous");
  });

  test("a skill and a bean of one name are ambiguous", () => {
    const clash: CodeRefResolver = { ...resolver, skill: (n) => (n === "tdmg" ? "tdmg.html" : undefined) };
    expect(resolveCodeRef("tdmg", clash).state).toBe("ambiguous");
  });

  test("a kind-shaped miss is unresolved; a plain miss is plain", () => {
    expect(resolveCodeRef("nope:missing", resolver)).toEqual({ state: "unresolved", kinds: ["command"] });
    expect(resolveCodeRef("bean zz99", resolver)).toEqual({ state: "unresolved", kinds: ["bean"] });
    expect(resolveCodeRef("docs/missing.md", resolver)).toEqual({ state: "unresolved", kinds: ["file"] });
    expect(resolveCodeRef("true", resolver)).toEqual({ state: "plain" });
    expect(resolveCodeRef("some-unknown-word", resolver)).toEqual({ state: "plain" });
  });
});

describe("linkInlineCode — the fixture page", () => {
  const findings: CodeRefFinding[] = [];
  const out = linkInlineCode(readFileSync(join(FIXTURE, "page.txt"), "utf-8"), resolver, {
    self: new Set(["merge-queue.html"]),
    onFinding: (f) => findings.push(f),
  });

  test("is rewritten exactly as expected", () => {
    expect(out).toBe(readFileSync(join(FIXTURE, "expected.txt"), "utf-8"));
  });

  test("reports the shaped misses and the ambiguity, and nothing else", () => {
    expect(findings.map((f) => [f.code, f.state])).toEqual([
      ["nope:missing", "unresolved"],
      ["bean zz99", "unresolved"],
      ["docs/missing.md", "unresolved"],
      ["twice.md", "ambiguous"],
    ]);
    expect(findings.find((f) => f.code === "twice.md")?.targets).toHaveLength(2);
  });

  test("leaves headings, fences, existing links and the page itself alone", () => {
    expect(out).toContain("# Merge queue — `merge-queue`");
    expect(out).toContain("# `merge:guard` inside a fence is not touched");
    expect(out).toContain("[`merge-conflict-patterns`](merge-conflict-patterns.html).\n");
    expect(out).not.toContain("[`merge-queue`]");
  });

  test("is idempotent: a second pass links nothing more", () => {
    expect(linkInlineCode(out, resolver, { self: new Set(["merge-queue.html"]) })).toBe(out);
  });

  test("an href with a space or parenthesis stays inside its link", () => {
    const odd: CodeRefResolver = { ...resolver, command: () => "https://example.test/a b(c).md" };
    expect(linkInlineCode("`x:y`", odd)).toBe("[`x:y`](https://example.test/a%20b%28c%29.md)");
  });
});
