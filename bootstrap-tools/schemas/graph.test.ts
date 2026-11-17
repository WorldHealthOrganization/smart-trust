/**
 * bootstrap defines its own terms, and nothing in it points above it
 * (owner, 2026-09-23: "bootstrap = self definitional. no semantic leakage, no
 * graph leakage").
 */
import { TOOLS_REPOSITORY } from "../scripts/generated-by.ts";
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  BOOTSTRAP_GRAPH_TYPOLOGIES,
  BOOTSTRAP_TERM_DEFINED_BY,
  BOOTSTRAP_TERM_USES,
  BOOTSTRAP_TERMS,
  BOOTSTRAP_TERMS_SUBJECT,
  KnowledgeGraphDeclarationSchema,
} from "./graph.ts";
import { checkDeclaredOrder } from "./declared-order.ts";
import { pluralised, unlinkedTerms } from "../scripts/term-links.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const BOOTSTRAP = join(REPO_ROOT, "bootstrap");
/** A standalone clone's own index (bootstrap 7d7d754): checkout metadata, like `.git`. */
const INDEX_CONFIG = join(BOOTSTRAP, "index.config.json");
/** Names of things above bootstrap, and outside standards named by acronym alone. */
const LEAKS = [/\bWHO\b/, /\bDAK\b/, /\bSMART\b/i, /cat-harness/, /folio/i, /smart-base/, /\bL[123]\b/];


describe("bootstrap's terms are its own", () => {
  test("noDefinitionNamesAbove", () => {
    const leaking = Object.entries(BOOTSTRAP_TERMS).filter(([, d]) => LEAKS.some((re) => re.test(d)));
    expect(leaking).toEqual([]);
  });


  test("schemaCarriesEveryTerm", () => {
    const schema = JSON.parse(readFileSync(join(BOOTSTRAP, "schemas", "graph.schema.json"), "utf-8"));
    expect(Object.keys(schema.$defs).sort()).toEqual(Object.keys(BOOTSTRAP_TERMS).sort());
    for (const [name, def] of Object.entries(BOOTSTRAP_TERMS)) expect(schema.$defs[name].description).toBe(def);
  });
});

describe("the terms are ordered: each definition uses only terms above it", () => {
  // Owner, 2026-09-29: "logically tight, non self-referential definitions".
  // A term is USED when its spaced name appears in a definition, singular or
  // plural, as a whole word; longer names are matched first, so "Node Kind"
  // is not also read as "Node".
  const names = Object.keys(BOOTSTRAP_TERMS).map((k) => ({ key: k, label: k.replace(/([a-z])([A-Z])/g, "$1 $2") }));
  const byLength = [...names].sort((a, b) => b.label.length - a.label.length);
  const uses = (text: string): string[] => {
    let rest = text;
    const found: string[] = [];
    for (const { key, label } of byLength) {
      const re = new RegExp(`\\b${pluralised(label)}\\b`, "g");
      if (re.test(rest)) {
        found.push(key);
        rest = rest.replace(re, " ");
      }
    }
    return found;
  };
  const order = names.map((n) => n.key);
  for (const [i, key] of order.entries()) {
    test(`termUsesNoLaterTerm[${key}]`, () => {
      const later = uses(BOOTSTRAP_TERMS[key as keyof typeof BOOTSTRAP_TERMS]).filter((u) => order.indexOf(u) >= i);
      expect(later).toEqual([]);
    });
  }

  // The AUTHORED relation is the source; the matcher above is its guard.
  test("authoredUsesKeepOrder", () => {
    const steps = order.map((id) => ({ id, needs: BOOTSTRAP_TERM_USES[id as keyof typeof BOOTSTRAP_TERM_USES] }));
    expect(checkDeclaredOrder(steps)).toEqual([]);
  });

  test("usesListMatchesDefinitionText", () => {
    const disagree = order.flatMap((key) => {
      const k = key as keyof typeof BOOTSTRAP_TERMS;
      const said = new Set(uses(BOOTSTRAP_TERMS[k]));
      const authored = new Set(BOOTSTRAP_TERM_USES[k]);
      const onlySaid = [...said].filter((u) => !authored.has(u as never));
      const onlyAuthored = [...authored].filter((u) => !said.has(u));
      return onlySaid.length || onlyAuthored.length ? [`${key}: text ${[...said]} vs authored ${[...authored]}`] : [];
    });
    expect(disagree).toEqual([]);
  });

  test("checkOrderNamesForwardSelfMissing", () => {
    expect(
      checkDeclaredOrder([
        { id: "a", needs: ["b"] },
        { id: "b", needs: ["b", "z"] },
      ]),
    ).toEqual([
      { id: "a", uses: "b", kind: "forward" },
      { id: "b", uses: "b", kind: "self" },
      { id: "b", uses: "z", kind: "missing" },
    ]);
  });

  test("everyTermNamesItsSchema", () => {
    for (const key of order) {
      const by = BOOTSTRAP_TERM_DEFINED_BY[key as keyof typeof BOOTSTRAP_TERM_DEFINED_BY];
      expect(by, key).toMatch(/^(#|https?:\/\/)/);
    }
  });
});

describe("bootstrap/README.md is self-definitional", () => {
  const readme = readFileSync(join(BOOTSTRAP, "README.md"), "utf-8");
  const links = [...readme.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]!);

  test("readmeLinksStayInside", () => {
    // The one name bootstrap may carry from outside itself, and only as the
    // answer to "what wrote this?" (generated-by.ts; owner 2026-09-30, and
    // 2026-10-01: the notice links bootstrap-tools).
    const tools = (l: string) => l === TOOLS_REPOSITORY || l.startsWith(`${TOOLS_REPOSITORY}/blob/main/scripts/`);
    expect(links.filter((l) => !tools(l) && (l.startsWith("../") || l.startsWith("/") || /^[a-z]+:/.test(l)))).toEqual([]);
  });

  test("readmeRelativeLinksResolve", () => {
    // What a reader of the README actually hits: the diagram pictures and the
    // file list are generated (kg:processes, kg:files), so a generator that
    // wrote a path to nothing would pass its own currency check. This is the
    // consumer-side check `artefact-verification.json` names for them.
    const broken = links
      .filter((l) => !/^[a-z]+:/.test(l) && !l.startsWith("#"))
      .map((l) => l.split("#")[0]!)
      .filter((p) => p !== "" && !existsSync(join(BOOTSTRAP, p)));
    expect(broken).toEqual([]);
  });

  test("readmeNamesNothingAbove", () => {
    expect(LEAKS.filter((re) => re.test(readme)).map(String)).toEqual([]);
  });

  test("termLinkedOnceAtFirstUse", () => {
    // No Tool: "no tools in bootstrap" (owner, 2026-09-29); a Harness defines it.
    for (const term of ["KnowledgeGraph", "Subgraph", "Harness", "Actor", "Role", "Process", "Skill"]) {
      const target = `schemas/graph.schema.json#/$defs/${term}`;
      expect(`${term}: ${links.filter((l) => l === target).length}`).toBe(`${term}: 1`);
    }
  });

  test("everyProseTermIsLink", () => {
    // Hand-written prose only: the generated regions (`<!-- kg:… -->`) are
    // linked by their generator.
    const text = readme.slice(0, readme.indexOf("<!-- kg:") >= 0 ? readme.indexOf("<!-- kg:") : undefined);
    const targets = Object.keys(BOOTSTRAP_TERMS).map((key) => ({ key, href: "x" }));
    expect(unlinkedTerms(text, targets)).toEqual([]);
  });

  test("termLinksDrawingWithHeading", () => {
    // The `[src]` link above opens JSON; a person reads the drawn page. Both
    // are asserted, because a link to a heading that was renamed lands at the
    // top of the page with nothing to say it missed.
    // A target is a heading OR an explicit `<a id>`. The Terms table uses the
    // second: the staging site's kramdown gave headings no ids, so a deep link
    // to a heading there landed at the top of the page.
    const page = readFileSync(join(BOOTSTRAP, "schemas", "README.md"), "utf-8");
    const targets = new Set([
      ...[...page.matchAll(/^#{1,6} (.+)$/gm)].map((m) =>
        m[1]!.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-"),
      ),
      ...[...page.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]!),
    ]);
    const drawn = links.filter((l) => l.startsWith("schemas/README.md#"));
    expect(drawn.length).toBeGreaterThanOrEqual(7);
    expect(drawn.map((l) => l.split("#")[1]!).filter((a) => !targets.has(a))).toEqual([]);
    // Every term in the table carries its own anchor, so every term can be linked.
    for (const key of Object.keys(BOOTSTRAP_TERMS)) {
      const id = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/ /g, "-");
      expect(targets.has(id), key).toBe(true);
    }
  });
});

describe("FR-7: bootstrap holds no program code", () => {
  test("noProgramFileInBootstrap", () => {
    const code: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(m?[jt]sx?|py|sh)$/.test(f)) code.push(p.slice(BOOTSTRAP.length + 1));
      }
    };
    walk(BOOTSTRAP);
    expect(code).toEqual([]);
  });
});

describe("nothing in bootstrap/ names anything above it (bean iwtn)", () => {
  /**
   * What is allowed, and why. Anything else that matches LEAKS fails.
   * - Nothing that names the repository bootstrap was staged in. Since
   *   bootstrap has its own repository (`litlfred/bootstrap`, 2026-09-30) its
   *   source and publication addresses are its own, and `livesAt` is gone.
   * - `bootstrap-tools` — the layer directly above — only as an ADDRESS
   *   (`TOOLS_REPOSITORY` and paths under it) or as the link text of a
   *   README's visible generated-by notice. Owner, 2026-09-30 (bean `xsqm`)
   *   let generated files name it as the answer to "what wrote this file?";
   *   owner, 2026-10-01 (folio-assistant#1770) narrowed that: README notices
   *   may keep the name, every other generated note says "the bootstrap
   *   toolset" and gives the address (`scripts/generated-by.ts`). Authored
   *   prose names no toolset, except by address.
   *
   * The `folio-*` schema identifiers are no longer allowed: bootstrap's own
   * files carry `model-registry/1.0.0`, resolving to a schema inside bootstrap
   * (bean r3gy, D2); `glossary-ledger/1.0.0` moved up to the hosting harness with the
   * hosted ledger (bean xsqm). The `folio:` diagram prefix
   * went earlier (bean 12s9, stage 2).
   */
  const ALLOW: RegExp[] = [
    new RegExp(TOOLS_REPOSITORY.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "[^\\s)\"`]*", "g"),
    /\[bootstrap-tools\]\(/g, // a README notice's link text (generatedBanner)
  ];
  const WORKFLOW_USES = /^[ \t]*(?:-[ \t]+)?uses:[ \t]*["']?[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[A-Za-z0-9_.\/-]+["']?[ \t]*(?:#.*)?$/gm;
  /** Above bootstrap: LEAKS, plus the toolset directly above it. */
  const ABOVE = [...LEAKS, /bootstrap-tools/];
  /** Structural, awaiting the owner's ruling (bean iwtn). Each entry is `file: the leaking text`. */
  const PENDING: string[] = [];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      // One skip, `.git` (below). `translations/` used to be excepted here because bootstrap held
      // 15 `.pot` extraction templates, which are tooling OUTPUT — nobody reads
      // a `.pot`, so they contradicted bootstrap's own promise of "a file you
      // read, not something you run" and have moved to
      // the hosting harness's own translations tree.
      //
      // The exception is gone rather than kept-and-unused, because while it
      // stood this test scanned 23 of 38 files under a name claiming all of
      // them. It now scans every file in `bootstrap/`, which is what it says.
      // `.git` is version-control metadata, not bootstrap's content — and a
      // standalone clone has one (found by `rehearse-standalone`, bean xsqm).
      if (f === ".git") continue;
      // The same holds for the root `index.config.json` (bootstrap 7d7d754): it
      // is what lets a standalone clone mount itself, read by the platform that
      // owns the filename, and not one of bootstrap's own files.
      if (p === INDEX_CONFIG) continue;
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(BOOTSTRAP);

  test("onlyListedStructuralNames", () => {
    const found: string[] = [];
    for (const p of files) {
      let text = readFileSync(p, "utf-8");
      for (const a of ALLOW) text = text.replace(a, "");
      // A workflow's `uses:` ADDRESS (owner, 2026-10-15, ruling 3a of the
      // folio-assistant#2529 reference-direction review): bootstrap's PR CI
      // calls the one reusable workflow a higher layer keeps, and the owner
      // ruled that line names where GitHub fetches the workflow from, not a
      // dependency. Narrow as the harness's `WORKFLOW_USES_ADDRESS` is: only in
      // `.github/workflows/*.yml`, only the `uses:` key, only a whole remote
      // `<owner>/<repo>[/<path>]@<ref>` value.
      if (/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(p)) text = text.replace(WORKFLOW_USES, "");
      for (const line of text.split("\n")) {
        if (ABOVE.some((re) => re.test(line))) found.push(`${p.slice(BOOTSTRAP.length + 1)}: ${line.trim()}`);
      }
    }
    expect(found.sort()).toEqual([...PENDING].sort());
  });
});

describe("bootstrap's graph typologies are its own (bean r3gy, D1)", () => {
  const decl = JSON.parse(readFileSync(join(BOOTSTRAP, "bootstrap.json"), "utf-8")) as {
    directories: { id: string; graphTypologies: string[] }[];
  };
  const own = Object.keys(BOOTSTRAP_GRAPH_TYPOLOGIES);

  test("everyUsedKindDefined", () => {
    const used = new Set(decl.directories.flatMap((d) => d.graphTypologies));
    expect([...used].filter((k) => !own.includes(k))).toEqual([]);
  });

  test("everyDefinedKindUsed", () => {
    const used = new Set(decl.directories.flatMap((d) => d.graphTypologies));
    expect(own.filter((k) => !used.has(k))).toEqual([]);
  });

});

describe("every $schema a bootstrap file carries is a Node Kind its declaration lists (r3gy D2; nodeSchemas, 2026-09-29)", () => {
  const decl = JSON.parse(readFileSync(join(BOOTSTRAP, "bootstrap.json"), "utf-8")) as {
    nodeSchemas?: Record<string, string>;
  };
  const kinds = decl.nodeSchemas ?? {};

  test("schemaTagDeclaredInNodeSchemas", () => {
    const undeclared: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (f === ".git" || p === INDEX_CONFIG) continue; // checkout metadata, not a node (see above)
        if (statSync(p).isDirectory()) walk(p);
        else if (f.endsWith(".json")) {
          const tag = (JSON.parse(readFileSync(p, "utf-8")) as { $schema?: unknown }).$schema;
          if (typeof tag === "string" && !(tag in kinds)) undeclared.push(`${p.slice(BOOTSTRAP.length + 1)}: ${tag}`);
        }
      }
    };
    walk(BOOTSTRAP);
    expect(undeclared).toEqual([]);
  });

  test("localNodeSchemaFixesTag", () => {
    const bad: string[] = [];
    for (const [tag, where] of Object.entries(kinds)) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(where)) continue; // a published standard
      const p = join(BOOTSTRAP, where);
      if (!p.startsWith(BOOTSTRAP) || !existsSync(p)) {
        bad.push(`${tag}: ${where} is not a file in bootstrap/`);
        continue;
      }
      const c = (JSON.parse(readFileSync(p, "utf-8")) as { properties?: { $schema?: { const?: string } } }).properties?.$schema?.const;
      if (c !== tag) bad.push(`${tag}: ${where} fixes ${JSON.stringify(c)}`);
    }
    expect(bad).toEqual([]);
  });

  test("registryTagOwnLedgerTagGone", () => {
    expect(kinds["model-registry/1.0.0"]).toBe("schemas/model-registry.schema.json");
    expect(kinds["glossary-ledger/1.0.0"]).toBeUndefined();
  });

  test("declarationShapeKnowsNodeSchemas", () => {
    expect(KnowledgeGraphDeclarationSchema.safeParse(decl).success).toBe(true);
  });
});

describe(`the terms' subject area (owner, 2026-11-07: "do it in the schema")`, () => {
  test("is a lowercase local id, so a layer can compare it", () => {
    expect(BOOTSTRAP_TERMS_SUBJECT).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
  });

  test("is published beside the terms in graph.schema.json when bootstrap is checked out beside these tools", () => {
    const file = join(import.meta.dir, "..", "..", "bootstrap", "schemas", "graph.schema.json");
    if (!existsSync(file)) return; // standalone: check-bootstrap.yml's --check covers the published file
    expect(JSON.parse(readFileSync(file, "utf-8")).subject).toBe(BOOTSTRAP_TERMS_SUBJECT);
  });
});
