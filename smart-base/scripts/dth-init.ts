#!/usr/bin/env bun
/**
 * dth init — set up the wiring of a DTH folio repository (bean cysv, stage 2).
 *
 *   bun run smart-base/scripts/dth-init.ts \
 *     --name dth-xx --title "Digital transformation handbook for …" --isbn 9789240000000 \
 *     --pins-from ../dth-sc/index.config.json [--l1 9789240000000-eng] \
 *     [--needs smart-base,dpi-h-ra] [--sheet <Google sheet id>] [--dir .] [--force] [--dry-run]
 *
 * Every DTH so far (dth-hrh, dth-sc, dth-pc, dth-phc, dth-sfp) copied this
 * wiring from dth-hrh by hand and then drifted. This writes it once:
 *
 * - `<name>.json`, the layer declaration (folio, glossary, uploads, and
 *   the beans and todos branches), with `needs`;
 * - `<name>.config.json`, the document adapter and site build;
 * - `index.config.json`, the mounts: who-iris, smart-base, the platform
 *   layers and dpi-h-ra (smart-ra), at the pins of `--pins-from`. Those pins
 *   keep their consent record as written there: dth init does not invent a
 *   consent, and a repin later records its own;
 * - `package.json` scripts that call core's shared checks
 *   (`folio-l1-coverage.ts`, `glossary-validate.ts`, review anchors), never a
 *   local copy. An existing `package.json` keeps its other scripts;
 * - `review/drafting/sheet-sync.json`, with `--sheet`;
 * - from `templates/dth/`: AGENTS.md (and the CLAUDE.md, GEMINI.md stubs),
 *   the session-start hook, the PR checks workflow, `.gitignore`,
 *   `bunfig.toml`, `.mcp.json`, `.beans.yml`.
 *
 * A file that exists is left alone unless `--force` (package.json is merged,
 * not replaced). `--dry-run` writes nothing and says what it would do.
 *
 * Not written: the folio itself (seeding is per handbook, stage 3), and
 * `folio/<name>/review-anchors.json`, which `bun run review:anchors` derives
 * from the seeded folio.
 *
 * It moved here from folio-assistant-core on 2026-11-01. It names smart-base,
 * who-iris and fhir-harness, and all three sit at or below this layer, while
 * they sit above core (`check:reference-direction`).
 *
 * @graphNode none — a scaffolding command, not a schema
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { iriSite } from "../schemas/site-roots.ts";

export const TEMPLATE_DIR = join(import.meta.dir, "..", "templates", "dth");

export interface DthInitOptions {
  name: string;
  title: string;
  isbn: string;
  l1?: string;
  needs?: string[];
  sheet?: string;
  /** The `instances` of an existing DTH's index.config.json. */
  pins: Array<{ name: string; source: Record<string, unknown> }>;
}

export type Planned = { path: string; content: string; merge?: boolean };

const fill = (s: string, v: Record<string, string>) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? m);

function templateFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? templateFiles(p) : [p];
  });
}

/** The package scripts every DTH runs, all calling the mounted layers. */
export function dthScripts(o: DthInitOptions): Record<string, string> {
  const l1 = o.l1 ?? `${o.isbn}-eng`;
  const anchors = `bun run folio-assistant-core/scripts/review-anchors-from-folio.ts --document ${o.name} --library ${l1} --source who-iris/uploads/${l1}/${l1}.pdf --source-label "the WHO handbook (ISBN ${o.isbn}) it was seeded from"`;
  return {
    cat: "bun cat-harness-tools/scripts/run-script.ts",
    "site:document": "bun run folio-assistant-core/scripts/build-document-site.ts --landing-layout default --document-layout default --link-terms --out",
    "site:library": "bun run folio-assistant-core/scripts/build-library-site.ts --out",
    "site:node-kinds": "bun run cat-harness-tools/scripts/gen-node-kind-pages.ts --root . --out",
    "site:glossary": `bun run folio-assistant-core/scripts/glossary-page.ts --instance ${o.name} --site`,
    "kg:blocks": `bun run cat-harness-tools/pipeline/gen-block-jsonld.ts --paper ${o.name}`,
    "check:kg-blocks": `bun run cat-harness-tools/pipeline/gen-block-jsonld.ts --paper ${o.name} --check`,
    "check:library-kg": "bun run cat-harness-tools/pipeline/gen-library-jsonld.ts --check",
    "check:dth-glossary": `bun run folio-assistant-core/scripts/glossary-validate.ts --instance ${o.name} --capitalized`,
    "l1:coverage:write": `bun run folio-assistant-core/scripts/folio-l1-coverage.ts --document ${o.name} --l1 who-iris/library/${l1}`,
    "check:l1-coverage": `bun run folio-assistant-core/scripts/folio-l1-coverage.ts --document ${o.name} --l1 who-iris/library/${l1} --check`,
    "review:anchors": anchors,
    "check:review-anchors": `${anchors} --check`,
  };
}

/** Everything dth init would write, as paths relative to the repository. */
export function plan(o: DthInitOptions): Planned[] {
  const l1 = o.l1 ?? `${o.isbn}-eng`;
  const vars = { name: o.name, title: o.title, isbn: o.isbn, l1 };
  const json = (x: unknown) => JSON.stringify(x, null, 2) + "\n";
  const out: Planned[] = [];

  out.push({
    path: `${o.name}.json`,
    content: json({
      $schema: "cat-harness-declaration/1.0.0",
      name: o.name,
      title: o.title,
      version: "0.1.0",
      iriBase: iriSite(o.name),
      // declared-path-literal: these ARE the new layer's declarations; no
      // declaration exists yet to read them from.
      directories: [
        {
          id: "folio",
          path: "folio/",
          graphTypologies: ["folio"],
          description: `The working document of the DTH: its document, chapters and blocks, seeded from the L1 entry who-iris/library/${l1}.`,
          coverage: {
            visualiser: [
              { ref: `en/${o.name}/index.html`, title: "Working document", writer: ["folio-assistant-core/scripts/build-document-site.ts"] },
            ],
          },
        },
        {
          id: "glossary",
          path: "glossary/",
          graphTypologies: ["glossary"],
          description: "The handbook's own terms as a folio-glossary/v1 SKOS scheme, linked to the smart-ra concepts they narrow or match.",
        },
        { id: "uploads", path: "uploads/", graphTypologies: ["uploads"], description: "Inbox for material not yet ingested." },
        {
          id: "beans",
          path: "beans/",
          graphTypologies: ["beans"],
          source: { kind: "branch", branch: `cat/${o.name}/beans`, keyedBy: "tip" },
          description: "This instance's work plan — one Markdown file per bean, managed with the `beans` CLI (`.beans.yml`).",
        },
        {
          id: "todos",
          path: "todos/",
          graphTypologies: ["todos"],
          source: { kind: "branch", branch: `cat/${o.name}/todos`, keyedBy: "tip" },
          description: "People's outstanding items and the feedback raised against blocks; its inner directories are declared by `todos/todos.json`.",
        },
      ],
      description: `WHO ${o.title} (ISBN ${o.isbn}), as an L2 DTH on smart-ra: the working document folio seeded from its L1 entry in who-iris, and its glossary linked to the smart-ra glossary and ArchiMate model.`,
      needs: o.needs ?? ["smart-base", "dpi-h-ra"],
    }),
  });

  out.push({
    path: `${o.name}.config.json`,
    content: json({
      contentType: "document",
      adapter: "document",
      adapterModule: "./folio-assistant-core/adapters/document/index.ts",
      dependencies: {
        folioAssistant: [
          { name: "folio-assistant-core", path: "folio-assistant-core" },
          { name: "smart-base", path: "smart-base" },
        ],
      },
      feedbackDir: ".folio-feedback",
      skills: ".claude/skills/local",
      viewer: { dir: "cat-harness-tools/viewer", port: 8080 },
      readme: { linkStyle: "blob", publishRef: "gh-pages" },
      site: {
        build: {
          sourceSteps: ["site:document", "site:library", "site:glossary"],
          siteSteps: ["site:node-kinds"],
          pre: ["check:dth-glossary", "check:l1-coverage", "check:library-kg"],
          keep: ["ns"],
        },
      },
    }),
  });

  // The mounts: every remote layer of the pins, none of their local ones.
  const remotes = o.pins.filter((i) => i.source?.remote);
  out.push({
    path: "index.config.json",
    content: json({
      $schema: "folio-index-config/v1",
      instances: [{ name: o.name, source: { local: { at: "." } } }, ...remotes],
      site: { landing: o.name },
    }),
  });

  out.push({
    path: "package.json",
    merge: true,
    content: json({
      name: o.name,
      private: true,
      scripts: dthScripts(o),
      workspaces: ["bootstrap-tools", "cat-harness", "cat-harness-tools", "folio-assistant-core", "fhir-harness"],
      dependencies: { zod: "^4.6.6" },
    }),
  });

  if (o.sheet) {
    out.push({
      path: "review/drafting/sheet-sync.json",
      content: json({ mode: "drafting", anchors: `folio/${o.name}/review-anchors.json`, sectionUrl: `en/${o.name}/#`, sheet: o.sheet }),
    });
  }

  for (const f of templateFiles(TEMPLATE_DIR)) {
    const rel = relative(TEMPLATE_DIR, f).replace(/^gitignore$/, ".gitignore");
    out.push({ path: rel, content: fill(readFileSync(f, "utf8"), vars) });
  }
  return out;
}

/** package.json: the DTH scripts and workspaces win; everything else is kept. */
export function mergePackage(existing: string, planned: string): string {
  const a = JSON.parse(existing);
  const b = JSON.parse(planned);
  const merged = {
    ...a,
    name: a.name ?? b.name,
    private: true,
    scripts: { ...(a.scripts ?? {}), ...b.scripts },
    workspaces: [...new Set([...(a.workspaces ?? []), ...b.workspaces])],
    dependencies: { ...b.dependencies, ...(a.dependencies ?? {}) },
  };
  return JSON.stringify(merged, null, 2) + "\n";
}

export function apply(dir: string, files: Planned[], opts: { force?: boolean; dryRun?: boolean } = {}) {
  const report: Array<{ path: string; action: "write" | "merge" | "skip" | "same" }> = [];
  for (const f of files) {
    const p = join(dir, f.path);
    let content = f.content;
    let action: "write" | "merge" | "skip" | "same" = "write";
    if (existsSync(p)) {
      const cur = readFileSync(p, "utf8");
      if (f.merge) {
        content = mergePackage(cur, f.content);
        action = "merge";
      } else if (!opts.force) action = "skip";
      if (cur === content) action = "same";
    }
    report.push({ path: f.path, action });
    if (opts.dryRun || action === "skip" || action === "same") continue;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return report;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const name = at("--name");
  const title = at("--title");
  const isbn = at("--isbn");
  const dir = at("--dir") ?? ".";
  const pinsFrom = at("--pins-from") ?? (existsSync(join(dir, "index.config.json")) ? join(dir, "index.config.json") : undefined);
  if (!name || !title || !isbn || !pinsFrom) {
    console.error(
      "usage: dth-init.ts --name dth-xx --title <title> --isbn <isbn> --pins-from <an existing DTH's index.config.json> [--l1 <entry>] [--needs a,b] [--sheet <id>] [--dir .] [--force] [--dry-run]",
    );
    process.exit(2);
  }
  const pins = JSON.parse(readFileSync(pinsFrom, "utf8")).instances ?? [];
  const files = plan({ name, title, isbn, l1: at("--l1"), needs: at("--needs")?.split(","), sheet: at("--sheet"), pins });
  const report = apply(dir, files, { force: args.includes("--force"), dryRun: args.includes("--dry-run") });
  for (const r of report) console.log(`${r.action.padEnd(5)} ${r.path}`);
  console.log(
    [
      "",
      "Next:",
      "  1. bash .claude/hooks/session-start.sh   (mounts the layers at the pins)",
      `  2. seed folio/${name}/ from who-iris/library/${at("--l1") ?? `${isbn}-eng`}`,
      "  3. bun run review:anchors && bun run l1:coverage && bun run check:dth-glossary",
    ].join("\n"),
  );
}
