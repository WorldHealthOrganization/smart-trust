/**
 * Tests for the pipeline plug-in slots (bean `squu`).
 *
 * Three properties the hook exists to have, plus the one that makes the
 * follow-up `git mv` safe:
 *
 * 1. A dependency REGISTERS an implementation and generic code reaches it by
 *    kind, through the same `contributes` walk as every other contribution.
 * 2. A kind claimed by two contributors THROWS (the `contributions.ts` rule).
 * 3. An unfilled kind is an error that names what is missing, never a default.
 * 4. Generic pipeline code names none of the files that fill the slots.
 *
 * The tests here whose subject is folio-assistant-sci's contribution (that
 * this layer fills every pipeline-plugin slot) live in
 * the checkout's `test/pipeline-plugins-sci-checkout.test.ts` (bean `ho66`):
 * standing alone, cat-harness has no such contribution to read.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ContributionCollisionError,
  ContributionRegistry,
  type FolioContribution,
} from "../schemas/content/contributions.ts";
import { loadContributionsSync } from "../schemas/kg/harness-config.ts";
import { writeDeclaration, writeInstanceConfig } from "../test/support/instance-fixture.js";
import {
  UnregisteredPipelinePluginError,
  optionalPipelinePlugin,
  pipelinePlugin,
  PIPELINE_PLUGIN_KINDS,
  extractTabularCsvw,
  slotDeclaredBy,
  stripLeanComments,
  usePipelinePluginRegistry,
} from "./pipeline-plugins";

// Under the system temp directory, not beside this file (bean `dlqu`): an
// in-tree scratch directory is visible to every test that enumerates the
// checkout, and under `bun test --parallel` those run at the same time.
const TMP = mkdtempSync(join(tmpdir(), "test_pipeline_plugins-"));

/** A fixture dependency declaring a pipeline-plugins node that fills `lean-lexer`. */
function writeDep(name: string): string {
  return writeDepIn(TMP, name);
}

/** {@link writeDep}, under `parent` rather than the suite's scratch directory. */
function writeDepIn(parent: string, name: string): string {
  const dir = join(parent, name);
  const pluginsDir = join(dir, "pipeline-plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(
    join(pluginsDir, "lexer.json"),
    JSON.stringify({
      $schema: "folio-pipeline-plugin/v1",
      slot: "lean-lexer",
      implementation: "plugins.ts#PLUGINS",
    }),
    "utf-8",
  );
  writeFileSync(
    join(dir, "plugins.ts"),
    `export const PLUGINS = {
  "lean-lexer": {
    stripLeanComments: (s: string) => "stripped:" + s,
    declarationStarts: () => [{ name: "fixture", at: 0 }],
  },
};
`,
    "utf-8",
  );
  writeDeclaration(dir, {
    name,
    directories: [
      { id: "pipeline-plugins", path: "pipeline-plugins/", graphTypologies: ["pipeline-plugins"] },
    ],
  });
  writeInstanceConfig(dir, JSON.stringify({}));
  return dir;
}

function writeRoot(name: string, deps: Array<{ name: string; path: string }>): string {
  const dir = join(TMP, name);
  mkdirSync(dir, { recursive: true });
  writeInstanceConfig(dir, JSON.stringify({ contentType: "document", dependencies: { folioAssistant: deps } }));
  return dir;
}

let lexerRoot: string;
let collidingRoot: string;

beforeAll(() => {
  const a = writeDep("dep-a");
  const b = writeDep("dep-b");
  lexerRoot = writeRoot("root-lexer", [{ name: "dep-a", path: a }]);
  collidingRoot = writeRoot("root-colliding", [
    { name: "dep-a", path: a },
    { name: "dep-b", path: b },
  ]);
});

afterEach(() => usePipelinePluginRegistry(undefined));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

const lexer = (contributor: string): FolioContribution => ({
  name: contributor,
  pipelinePlugins: [
    {
      kind: "lean-lexer",
      implementation: { stripLeanComments: (s: string) => `${contributor}:${s}`, declarationStarts: () => [] },
    },
  ],
});

describe("registration", () => {
  it("a registered implementation is what the slot returns, and the delegate calls it", () => {
    const reg = new ContributionRegistry();
    reg.register(lexer("dep-a"));
    usePipelinePluginRegistry(reg);
    expect(pipelinePlugin("lean-lexer").stripLeanComments("x")).toBe("dep-a:x");
    // The delegate under the implementing module's own name — what the
    // consumers import — reaches the same implementation.
    expect(stripLeanComments("y")).toBe("dep-a:y");
    expect(reg.contributedPipelinePlugins()).toEqual([{ kind: "lean-lexer", contributor: "dep-a" }]);
  });

  it("loads through the declared dependency walk, synchronously, with the entry's name pinned", () => {
    const reg = loadContributionsSync<FolioContribution, ContributionRegistry>(lexerRoot, new ContributionRegistry());
    usePipelinePluginRegistry(reg);
    expect(pipelinePlugin("lean-lexer").stripLeanComments("z")).toBe("stripped:z");
    // Pinned from dependency entry
    expect(reg.contributedPipelinePlugins()[0]?.contributor).toBe("dep-a");
  });

  it("a diamond — the same contributor twice — is not a collision", () => {
    const reg = new ContributionRegistry();
    reg.register(lexer("dep-a"));
    expect(() => reg.register(lexer("dep-a"))).not.toThrow();
  });
});

describe("a duplicate THROWS", () => {
  it("two contributors for one kind is a collision naming both", () => {
    const reg = new ContributionRegistry();
    reg.register(lexer("dep-a"));
    let err: unknown;
    try {
      reg.register(lexer("dep-b"));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ContributionCollisionError);
    const c = err as ContributionCollisionError;
    expect(c.what).toBe("pipeline-plugin");
    expect(c.id).toBe("lean-lexer");
    expect(c.message).toContain('"dep-a"');
    expect(c.message).toContain('"dep-b"');
  });

  it("and it throws through the loader too, whatever order the dependencies are listed in", () => {
    expect(() =>
      loadContributionsSync<FolioContribution, ContributionRegistry>(collidingRoot, new ContributionRegistry()),
    ).toThrow(ContributionCollisionError);
  });
});

describe("an unregistered kind", () => {
  it("throws an error naming the kind and what IS filled, never a default", () => {
    const reg = new ContributionRegistry();
    reg.register(lexer("dep-a"));
    usePipelinePluginRegistry(reg);
    let err: unknown;
    try {
      pipelinePlugin("latex-preflight");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnregisteredPipelinePluginError);
    const msg = (err as Error).message;
    expect(msg).toContain('"latex-preflight"');
    expect(msg).toContain("lean-lexer (dep-a)");
  });

  it("names the instances whose declarations fill the slot, read from the checkout", () => {
    // It used to say "(normally <the science layer, by name>)", a lower layer
    // naming a higher one (check:reference-direction). The candidates are now
    // whatever the checkout's declarations say fills the kind.
    const repo = mkdtempSync(join(tmpdir(), "test_pipeline_plugins_declared-"));
    try {
      writeDepIn(repo, "filler");
      expect(slotDeclaredBy(repo, "lean-lexer")).toEqual(["filler"]);
      expect(slotDeclaredBy(repo, "latex-preflight")).toEqual([]);
      const named = new UnregisteredPipelinePluginError("lean-lexer", repo, [], ["filler"]).message;
      expect(named).toContain("declared in this checkout by filler");
      const none = new UnregisteredPipelinePluginError("latex-preflight", repo, [], []).message;
      expect(none).toContain("no instance in this checkout declares it");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("says so when nothing at all is filled", () => {
    usePipelinePluginRegistry(new ContributionRegistry());
    expect(() => pipelinePlugin("lean-coverage")).toThrow(/No slot is filled at all/);
  });

  it("is undefined from the optional accessor, for callers with their own could-not-determine state", () => {
    usePipelinePluginRegistry(new ContributionRegistry());
    expect(optionalPipelinePlugin("lean-coverage")).toBeUndefined();
  });
});

describe("the tabular-csvw slot (bean urat)", () => {
  it("is a declared kind, and its delegate passes the source and options through", () => {
    expect(PIPELINE_PLUGIN_KINDS).toContain("tabular-csvw");
    const seen: unknown[] = [];
    const reg = new ContributionRegistry();
    reg.register({
      name: "dep-core",
      pipelinePlugins: [
        {
          kind: "tabular-csvw",
          implementation: {
            extract: (source: Buffer, opts: { url: string; docId: string; mimetype: string | null }) => {
              seen.push(source.toString("utf-8"), opts);
              return null;
            },
          },
        },
      ],
    });
    usePipelinePluginRegistry(reg);
    const opts = { url: "a.csv", docId: "a", mimetype: null };
    expect(extractTabularCsvw(Buffer.from("x,y"), opts)).toBeNull();
    expect(seen).toEqual(["x,y", opts]);
  });

  it("unfilled, it refuses with the slot error rather than falling back to v1", () => {
    usePipelinePluginRegistry(new ContributionRegistry());
    expect(() => extractTabularCsvw(Buffer.from("x,y"), { url: "a.csv", docId: "a", mimetype: null })).toThrow(
      UnregisteredPipelinePluginError,
    );
  });
});

describe("this repository", () => {

  it("generic pipeline code imports none of the modules that fill the slots", () => {
    // The point of the hook: after the move, any of these specifiers in a
    // generic module would be a lower → higher import. `check:import-direction`
    // catches that only once the files have moved; this catches it now.
    const filled = [
      "lean-lexer",
      "latex-preflight",
      "lean-coverage",
    ];
    // Sci-bound leaves that still sit here and import a slot filler directly.
    // That edge is sci → sci, so it is fine; they move together. The move PR
    // empties this list, because the files leave this directory.
    const sciBoundHere = new Set<string>([]);
    const offenders: string[] = [];
    for (const f of readdirSync(import.meta.dir)) {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
      if (filled.some((leaf) => f === `${leaf}.ts`) || sciBoundHere.has(f)) continue;
      const src = readFileSync(join(import.meta.dir, f), "utf-8");
      for (const leaf of filled) {
        const re = new RegExp(`from\\s+["'][^"']*/${leaf.replace(/\./g, "\\.")}(\\.js|\\.ts)?["']`);
        if (re.test(src)) offenders.push(`${f} → ${leaf}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
