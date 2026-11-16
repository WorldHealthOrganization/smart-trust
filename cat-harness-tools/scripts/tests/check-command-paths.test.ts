/**
 * The command-path check, tested on the cases that made it wrong.
 *
 * Bean `b963`. Every test here is a false positive the first draft produced
 * over this repository's own corpus, or the defect the check exists to catch.
 * They are kept as tests rather than as comments because the tokenizer is the
 * part that will be edited next, and each of these is one edit away.
 *
 * @module folio-assistant/scripts/tests/check-command-paths
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  aboutThisTree,
  checkCommandPaths,
  FOLIO_OWNED,
  instanceRoots,
  sourceFiles,
  shellBlocks,
  shellWords,
  skipCommand,
  skipReason,
} from "../check-command-paths.ts";

function fixture(files: Record<string, string>, dirs: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "cmdpaths-"));
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("a word is judged WHOLE, never as a path-shaped run inside one", () => {
  // Each of these yielded a token that never appears in the text, reported as
  // a missing file, on the first run over this repository.
  test.each([
    ["curl -fsSL https://bun.sh/install | bash", "bun.sh/install"],
    ['export PATH="$HOME/.local/bin:$PATH"', "HOME/.local/bin"],
    ["bun run x.ts --repo /path/to/your/content-repo", "path/to/your/content-repo"],
    ["python3 x.py bpmn2fsh <file.bpmn|dir> -o OUTDIR", "file.bpmn"],
  ])("%s does not yield %s", (cmd, ghost) => {
    expect(shellWords(cmd)).not.toContain(ghost);
  });

  test("an assignment is not a path", () => {
    expect(skipReason("SMART_BASE_HOME=/path/to/smart-base")).toBe("an assignment");
  });

  test("an upper-case segment is a stand-in", () => {
    expect(skipReason("uploads/FILE.pdf")).toBe("an upper-case stand-in");
    expect(skipReason("beans/defs")).toBeUndefined();
  });
});

describe("whole commands the check declines", () => {
  test("a `cd` moves the base, so the rest is not root-relative", () => {
    expect(skipCommand("cd content && bun run pipeline/bib-qa.ts")).toMatch(/changes directory/);
  });

  test("a git ref is path-shaped and is not a path", () => {
    expect(skipCommand("git show origin/main:beans/defs/x.md")).toMatch(/git command/);
  });

  test("an ordinary command is not declined", () => {
    expect(skipCommand("bun run cat-harness/scripts/install-beans.sh")).toBeUndefined();
  });
});

describe("the skill corpus judges only what claims to be about this tree", () => {
  const root = fixture({ "keep.md": "" }, ["cat-harness", "beans"]);

  test("a path under an existing root directory is judged", () => {
    expect(aboutThisTree(root, "cat-harness/scripts/x.ts")).toBe(true);
  });

  test("a folio's path is not — the platform carries no folio", () => {
    expect(aboutThisTree(root, "content/pipeline/qa-sweep.ts")).toBe(false);
    expect(aboutThisTree(root, "./scripts/tests/run-tests.sh")).toBe(false);
  });

  test("a bare MARKDOWN name is judged — the `z9eb` case", () => {
    expect(aboutThisTree(root, "STATUS.md")).toBe(true);
  });

  test("a bare non-markdown name is a folio artefact, not judged", () => {
    expect(aboutThisTree(root, "harness.config.json")).toBe(false);
    expect(aboutThisTree(root, "proof-objects.json")).toBe(false);
  });
});

describe("a FOLIO-OWNED head is declined even when that directory exists HERE", () => {
  // The test above — "a folio's path is not" — passes for the wrong reason:
  // `content/` is absent from its fixture, so ANY implementation that checks
  // only for existence agrees with it. This one puts the directory there.
  //
  // It is not hypothetical. The repository root gained a `docs/` on 2026-09-21
  // (bean `n0nf`, the owner's compose ruling), and `docs/audits/…` in a
  // paper-adapter skill immediately became "about this tree" and was reported
  // missing — 7 findings with the directory present, 0 without. The skill was
  // never wrong: that path is a FOLIO's audit output.
  const root = fixture({ "keep.md": "" }, ["cat-harness", "docs", "content", "uploads"]);

  test("`docs/`, `content/` and `uploads/` are declined although present", () => {
    for (const tok of ["docs/audits/x.json", "content/pipeline/qa-sweep.ts", "uploads/a.pdf"]) {
      expect({ tok, judged: aboutThisTree(root, tok) }).toEqual({ tok, judged: false });
    }
  });

  test("...and a head that is NOT folio-owned is still judged, which is the contrast", () => {
    // Without this, declining everything would satisfy the test above.
    expect(aboutThisTree(root, "cat-harness/scripts/x.ts")).toBe(true);
  });

  test("the PLATFORM's own docs keep their instance prefix, and stay judged", () => {
    // `cat-harness/docs/…` is the platform's documentation and is spelled with
    // the layer that owns it, so nothing about this loosens the check for
    // the pages that actually live in this repository.
    expect(aboutThisTree(root, "cat-harness/docs/guides/agent-onboarding.md")).toBe(true);
  });
});

describe("the exemption carries a reason and is counted", () => {
  test("a marked block is exempt; an unmarked one is not", () => {
    const md = [
      "<!-- command-path-ok: a probe -->",
      "```sh",
      "ls content/",
      "```",
      "",
      "```sh",
      "ls other/",
      "```",
      "",
    ].join("\n");
    const blocks = shellBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.exempt).toBe(true);
    expect(blocks[1]!.exempt).toBe(false);
  });

  test("a marker with no reason does not exempt — silencing costs more than fixing", () => {
    const md = ["<!-- command-path-ok: -->", "```sh", "ls content/", "```", ""].join("\n");
    expect(shellBlocks(md)[0]!.exempt).toBe(false);
  });
});

describe("the defect it was written for", () => {
  test("a moved script in an entry document fails", () => {
    const root = fixture(
      {
        "AGENTS.md": "```sh\nscripts/install-beans.sh\n```\n",
        "cat-harness/scripts/install-beans.sh": "",
      },
      ["cat-harness/scripts"],
    );
    const r = checkCommandPaths(root);
    expect(r.dead.map((d) => d.token)).toEqual(["scripts/install-beans.sh"]);
  });

  test("...and passes once repointed", () => {
    const root = fixture(
      {
        "AGENTS.md": "```sh\ncat-harness/scripts/install-beans.sh\n```\n",
        "cat-harness/scripts/install-beans.sh": "",
      },
      ["cat-harness/scripts"],
    );
    expect(checkCommandPaths(root).dead).toEqual([]);
  });

  test("a moved MCP server script in `.mcp.json` fails — the 2026-09-30 case", () => {
    const root = fixture({
      ".mcp.json": JSON.stringify({ mcpServers: { sage: { command: "scripts/sage-mcp.sh", args: [] } } }),
      "cat-harness/scripts/sage-mcp.sh": "",
    });
    const r = checkCommandPaths(root);
    expect(r.dead.map((d) => [d.file, d.token])).toEqual([[".mcp.json", "scripts/sage-mcp.sh"]]);
  });

  test("...an `args` path is judged too, and both pass once repointed", () => {
    const dead = fixture({
      ".mcp.json": JSON.stringify({ mcpServers: { fa: { command: "bun", args: ["run", "src/index.ts", "--stdio"] } } }),
      "cat-harness/src/index.ts": "",
    });
    expect(checkCommandPaths(dead).dead.map((d) => d.token)).toEqual(["src/index.ts"]);
    const live = fixture({
      ".mcp.json": JSON.stringify({
        mcpServers: {
          sage: { command: "cat-harness/scripts/sage-mcp.sh", args: [] },
          fa: { command: "bun", args: ["run", "cat-harness/src/index.ts", "--stdio"] },
        },
      }),
      "cat-harness/scripts/sage-mcp.sh": "",
      "cat-harness/src/index.ts": "",
    });
    expect(checkCommandPaths(live).dead).toEqual([]);
  });

  test("EXAMINED NOTHING is not a pass", () => {
    const root = fixture({});
    expect(checkCommandPaths(root).filesRead).toBe(0);
  });
});

describe("the printed-command reader — bean `b963`'s third class", () => {
  test("a runner verb before a path that resolves only under an instance is FOUND, with its fix", () => {
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "cat-harness/scripts/lean-audit.ts": "/** Usage: bun run scripts/lean-audit.ts */\n",
      },
      ["cat-harness/scripts"],
    );
    const r = checkCommandPaths(root);
    // Was asserted as `held` when the verdict was still open. The owner settled
    // it 2026-09-20 — fail on scripts/, count content/ — so a command naming
    // this repository's own tooling is now a failure, and the token carries
    // the repointing rather than merely reporting the miss.
    expect(r.dead.map((h) => h.token)).toEqual(["scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts"]);
    expect(r.held).toEqual([]);
  });

  test("a cross-reference with NO runner verb is not a finding", () => {
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "cat-harness/scripts/a.ts": "// see `scripts/known-skills.ts` for what decides\n",
        "cat-harness/scripts/known-skills.ts": "",
      },
      ["cat-harness/scripts"],
    );
    expect(checkCommandPaths(root).held).toEqual([]);
  });

  test("`node` is not a runner verb here — it is an ordinary word in this codebase", () => {
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "cat-harness/scripts/a.ts": "// a node resolves to its `.md`. A node with no path.\n",
      },
      ["cat-harness/scripts"],
    );
    // Measured: including `node` produced four findings over the real corpus,
    // all four false. A verb that is also English is not a signal.
    expect(checkCommandPaths(root).held).toEqual([]);
  });

  test("a path that resolves nowhere is a folio's — counted, never held", () => {
    const root = fixture(
      { "cat-harness/cat-harness.json": '{"name":"cat-harness"}', "cat-harness/scripts/a.ts": "// bun run content/pipeline/x.ts\n" },
      ["cat-harness/scripts"],
    );
    const r = checkCommandPaths(root);
    expect(r.held).toEqual([]);
    expect(r.folioRelative).toBeGreaterThan(0);
  });

  test("a command in a code span ends at the span: later prose on the line is not read as its arguments", () => {
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "cat-harness/schemas/x.ts": "",
        "cat-harness/scripts/a.ts":
          "// run `bun run cat some:baseline`, which shortens it. Most entries are `schemas/`, which moves.\n",
      },
      ["cat-harness/scripts", "cat-harness/schemas"],
    );
    expect(checkCommandPaths(root).dead).toEqual([]);
  });

  test("...while a path INSIDE the span is still judged", () => {
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "cat-harness/scripts/lean-audit.ts": "",
        "cat-harness/scripts/a.ts": "// run `bun run scripts/lean-audit.ts` and then read `schemas/`.\n",
      },
      ["cat-harness/scripts"],
    );
    expect(checkCommandPaths(root).dead.map((h) => h.token)).toEqual([
      "scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts",
    ]);
  });

  test("instance roots are DISCOVERED, so a split cannot silently blind the check", () => {
    const root = fixture({ "cat-harness/cat-harness.json": '{"name":"cat-harness"}', "other/other.json": '{"name":"other"}' }, ["cat-harness", "other"]);
    expect(instanceRoots(root)).toEqual(["cat-harness", "other"]);
  });
});

describe("the owner's verdict on the 237 — fail on scripts/, count content/", () => {
  /**
   * The target must EXIST under the layer, or there is nothing to find.
   * The rule is "resolves under an instance but not from the root" — a path
   * that resolves nowhere is a folio's and is counted, which is what the first
   * draft of these fixtures accidentally exercised.
   */
  const fixtureWith = (comment: string, target: string) =>
    fixture(
      { "cat-harness/cat-harness.json": '{"name":"cat-harness"}', "cat-harness/scripts/a.ts": comment, [`cat-harness/${target}`]: "" },
      ["cat-harness/scripts"],
    );

  test("a command naming this repository's tooling FAILS, and the finding carries its fix", () => {
    const r = checkCommandPaths(fixtureWith("// bun run scripts/lean-audit.ts\n", "scripts/lean-audit.ts"));
    expect(r.dead).toHaveLength(1);
    expect(r.dead[0]!.token).toBe("scripts/lean-audit.ts  →  cat-harness/scripts/lean-audit.ts");
    expect(r.held).toEqual([]);
  });

  test("a command addressed to a FOLIO is counted, never failed", () => {
    const r = checkCommandPaths(fixtureWith("// bun run content/pipeline/qa-sweep.ts\n", "content/pipeline/qa-sweep.ts"));
    expect(r.dead).toEqual([]);
    expect(r.held).toHaveLength(1);
  });

  test.each([...FOLIO_OWNED])("`%s/` is a folio's, so it is counted", (seg) => {
    const r = checkCommandPaths(fixtureWith(`// bun run ${seg}/x.ts\n`, `${seg}/x.ts`));
    expect(r.dead).toEqual([]);
  });

  test.each(["scripts", "src", "docs"])("`%s/` is this repository's, so it fails", (seg) => {
    const r = checkCommandPaths(fixtureWith(`// bun run ${seg}/x.ts\n`, `${seg}/x.ts`));
    expect(r.dead).toHaveLength(1);
  });

  test("FOLIO_OWNED is a LAYOUT and not a declaration — the weakness is on the constant", () => {
    // Guards the disclosure itself: the set was chosen by the owner over a
    // layout, no harness.json separates `scripts/` from `content/`, and bean
    // `b963` carries an open Done-when to tighten it. A later session that
    // silently derives this from somewhere should update that note too.
    expect(FOLIO_OWNED.has("content")).toBe(true);
    expect(FOLIO_OWNED.has("scripts")).toBe(false);
  });
});

describe("the corpus is DISCOVERED, not listed", () => {
  test("a new instance's scripts/ is scanned without anyone editing this check", () => {
    // The first draft listed `cat-harness/{scripts,src,...}`. A merge from
    // `main` brought a `who-iris/` layer whose scripts/ the check then
    // walked straight past — a hardcoded list going stale INSIDE the check
    // whose whole subject is hardcoded paths going stale.
    const root = fixture(
      {
        "cat-harness/cat-harness.json": '{"name":"cat-harness"}',
        "who-iris/who-iris.json": '{"name":"who-iris"}',
        "who-iris/scripts/a.ts": "// bun run scripts/gen-iris-pages.ts\n",
        "who-iris/scripts/gen-iris-pages.ts": "",
      },
      ["cat-harness", "who-iris/scripts"],
    );
    const r = checkCommandPaths(root);
    expect(sourceFiles(root)).toContain("who-iris/scripts/a.ts");
    expect(r.dead.map((d) => d.token)).toEqual([
      "scripts/gen-iris-pages.ts  →  who-iris/scripts/gen-iris-pages.ts",
    ]);
  });
});

// folio-assistant-tsh9: a command naming a path a layer moved passes while
// the move is in its window, reported as moved (sdlc skill `two-phase-move`).
describe("a declared move", () => {
  const moved = (until: string): string =>
    fixture({
      "AGENTS.md": "```sh\nbun run cat-harness/old/x.ts\n```\n",
      ".mcp.json": JSON.stringify({ mcpServers: { s: { command: "cat-harness/old/x.ts", args: [] } } }),
      "cat-harness/cat-harness.json": JSON.stringify({ name: "cat-harness", directories: [], moves: [{ from: "old", to: "new", until }] }),
      "cat-harness/new/x.ts": "",
    });

  test("in the window the old path passes, and each use is reported as moved", () => {
    const r = checkCommandPaths(moved("2099-12-31"));
    expect(r.dead).toEqual([]);
    expect(r.moved.map((m) => [m.file, m.token, m.move])).toEqual([
      ["AGENTS.md", "cat-harness/old/x.ts", "cat-harness:old"],
      [".mcp.json", "cat-harness/old/x.ts", "cat-harness:old"],
    ]);
  });

  test("past `until` the move gives no relief", () => {
    const r = checkCommandPaths(moved("2020-01-01"));
    expect(r.moved).toEqual([]);
    expect(r.dead.map((d) => d.file).sort()).toEqual([".mcp.json", "AGENTS.md"]);
  });
});
