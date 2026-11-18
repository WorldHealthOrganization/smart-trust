#!/usr/bin/env bun
/**
 * check-node-iris.ts — a published node's own identifier names the path its
 * file sits at.
 *
 * ## Why
 *
 * Publishing a Knowledge Graph means serving its files where they sit, under
 * its release address; an identifier that names another path can then never
 * be dereferenced.
 *
 * ## The rule
 *
 * For every Knowledge Graph in the checkout that declares an `iriBase`, and
 * every JSON or JSON-LD file under it whose own identifier — a top-level `$id`,
 * or a top-level `@id` — starts with its release address for agents
 * (`<iriBase>v<major>/`, see `release-iri.ts`):
 *
 *   the rest of the identifier, without its `#fragment`, must be the file's
 *   path relative to the Knowledge Graph's root — or that path without its
 *   extension (`processes/ns` for `processes/ns.jsonld`), or that with a
 *   trailing slash (`processes/ns/`, the address a slash vocabulary is
 *   served at, as its directory index).
 *
 * An identifier under the layer's `iriBase` but at ANOTHER version is also
 * a finding: a document names its own release. Identifiers outside the base
 * are not this gate's question.
 *
 * ```sh
 * bun run check:node-iris
 * ```
 *
 * @module bootstrap-tools/scripts/check-node-iris
 * @covers schemas
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { knowledgeGraphsIn } from "../schemas/declaration.ts";
import { releaseIris } from "../schemas/release-iri.ts";

export interface NodeIriFinding {
  file: string;
  iri: string;
  why: string;
}

function jsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...jsonFiles(p));
    else if (/\.(json|jsonld)$/.test(entry)) out.push(p);
  }
  return out;
}

/** The node identifier a JSON document states about itself, if any. */
export function ownIdentifier(doc: unknown): string | undefined {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return undefined;
  const d = doc as { $id?: unknown; "@id"?: unknown };
  const id = typeof d.$id === "string" ? d.$id : typeof d["@id"] === "string" ? d["@id"] : undefined;
  return id;
}

/** Findings for one Knowledge Graph root with its release. */
export function checkNodeIris(root: string, iriBase: string, agentBase: string): NodeIriFinding[] {
  const findings: NodeIriFinding[] = [];
  for (const file of jsonFiles(root)) {
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue; // not JSON a reader could take an identifier from; other gates own validity
    }
    const iri = ownIdentifier(doc);
    if (!iri || !iri.startsWith(iriBase)) continue;
    const rel = relative(root, file).split("\\").join("/");
    if (!iri.startsWith(agentBase)) {
      findings.push({ file: rel, iri, why: `names a release other than this one (${agentBase})` });
      continue;
    }
    const path = iri.slice(agentBase.length).split("#")[0]!;
    const bare = rel.replace(/\.(json|jsonld)$/, "");
    // A slash vocabulary (`processes/ns/`) is served as the directory index
    // beside it, so `processes/ns.jsonld` may name `processes/ns/` (#1378).
    if (path !== rel && path !== bare && path !== `${bare}/`) {
      findings.push({ file: rel, iri, why: `names \`${path}\`, but the file sits at \`${rel}\`` });
    }
  }
  return findings;
}

if (import.meta.main) {
  const repoAt = process.argv.indexOf("--repo");
  const repo = repoAt >= 0 && process.argv[repoAt + 1] ? process.argv[repoAt + 1]! : join(import.meta.dir, "..", "..");
  const graphs = knowledgeGraphsIn(repo).flatMap(({ root, decl }) => {
    const r = releaseIris(decl);
    return r ? [{ root, name: decl.name, r }] : [];
  });
  if (graphs.length === 0) {
    console.log("No Knowledge Graph declares an iriBase; no published identifiers to check.");
    process.exit(0);
  }
  let bad = 0;
  for (const { root, name, r } of graphs) {
    const findings = checkNodeIris(root, r.iriBase, r.agent);
    const checked = jsonFiles(root).length;
    if (findings.length === 0) {
      console.log(`✓ ${name}: every identifier under ${r.agent} is its file's path (${checked} JSON file(s) read).`);
      continue;
    }
    bad += findings.length;
    console.error(`✗ ${name}: ${findings.length} identifier(s) name a path their file does not sit at:`);
    for (const f of findings) console.error(`  · ${f.file}: ${f.iri} — ${f.why}`);
  }
  if (bad > 0) {
    console.error("Publishing files where they sit must serve every identifier: move the file, or change the identifier before it is published.");
    process.exit(1);
  }
}
