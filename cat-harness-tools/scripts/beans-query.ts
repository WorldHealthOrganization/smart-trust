#!/usr/bin/env bun
/**
 * Oxigraph-Powered Fast Bean Query Engine & Knowledge Graph Interface.
 *
 * Provides instant in-memory SPARQL 1.1 queries, named graph analytics,
 * and N-Quads export for web/edge browser consumption.
 *
 * @module cat-harness/scripts/beans-query
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import oxigraph from "oxigraph";
import { readBeans, type BeanNode } from "./beans.ts";

export const BEAN_NS = "https://folio-assistant.org/vocab/bean#";
export const BEAN_PREFIX = "https://folio-assistant.org/bean/";

export interface QueryResultRow {
  [key: string]: string;
}

/** Pre-defined, audited high-value named queries. */
export const NAMED_QUERIES: Record<string, { description: string; sparql: string }> = {
  safe_drain_candidates: {
    description: "Leaf beans with >= 2 open siblings under their parent container (safe against check:bean-rollup)",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?id ?status ?parent (COUNT(?sibling) AS ?openSiblings) ?title
WHERE {
  ?b bean:status ?status ;
     bean:id ?id ;
     bean:title ?title ;
     bean:parent ?parent .
  FILTER(?status IN ("todo", "in-progress", "open"))

  # Leaf condition: no open child exists
  FILTER NOT EXISTS {
    ?child bean:parent ?b ; bean:status ?cStatus .
    FILTER(?cStatus IN ("todo", "in-progress", "open"))
  }

  # Rollup safety: count open siblings under the same container
  ?sibling bean:parent ?parent ; bean:status ?sStatus .
  FILTER(?sStatus IN ("todo", "in-progress", "open"))
}
GROUP BY ?id ?status ?parent ?title
HAVING (COUNT(?sibling) >= 2)
ORDER BY DESC(?openSiblings) ?id
`,
  },

  actionable_leaves: {
    description: "Open/todo leaf beans with zero open blockers, ready for an agent to claim immediately",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?id ?status ?priority ?type ?title
WHERE {
  ?b bean:status ?status ;
     bean:id ?id ;
     bean:title ?title ;
     bean:type ?type .
  OPTIONAL { ?b bean:priority ?priority }
  FILTER(?status IN ("todo", "open"))

  # Leaf condition: no open child exists
  FILTER NOT EXISTS {
    ?child bean:parent ?b ; bean:status ?cStatus .
    FILTER(?cStatus IN ("todo", "in-progress", "open"))
  }

  # No open blocker exists
  FILTER NOT EXISTS {
    ?b bean:blockedBy ?blocker .
    ?blocker bean:status ?bStatus .
    FILTER(?bStatus IN ("todo", "in-progress", "open"))
  }
}
ORDER BY ?priority ?type ?id
`,
  },

  critical_path_blockers: {
    description: "Blockers ranked by how many open beans they directly hold up",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?blockerId ?status (COUNT(?blocked) AS ?blockedCount) ?title
WHERE {
  ?blocker bean:id ?blockerId ;
           bean:title ?title ;
           bean:status ?status ;
           bean:blocks ?blocked .
  ?blocked bean:status ?blockedStatus .
  FILTER(?blockedStatus IN ("todo", "in-progress", "open"))
  FILTER(?status IN ("todo", "in-progress", "open"))
}
GROUP BY ?blockerId ?status ?title
ORDER BY DESC(?blockedCount) ?blockerId
`,
  },

  epic_burndown: {
    description: "Per-epic child status breakdown (total, open, completed, scrapped, and completion percentage)",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?epicId ?title (COUNT(?child) AS ?total)
       (SUM(IF(?cStatus = "completed", 1, 0)) AS ?completed)
       (SUM(IF(?cStatus = "in-progress", 1, 0)) AS ?inProgress)
       (SUM(IF(?cStatus = "todo" || ?cStatus = "open", 1, 0)) AS ?open)
       (SUM(IF(?cStatus = "scrapped", 1, 0)) AS ?scrapped)
WHERE {
  ?epic bean:id ?epicId ;
        bean:title ?title ;
        bean:type "epic" .
  ?child bean:parent ?epic ;
         bean:status ?cStatus .
}
GROUP BY ?epicId ?title
ORDER BY DESC(?open) ?epicId
`,
  },

  rollup_invariant_violations: {
    description: "Beans violating the rollup invariant (completed containers with open children, or in-progress containers with 0 open children)",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?id ?status ?title ("completed-container-with-open-children" AS ?violation)
WHERE {
  ?b bean:id ?id ;
     bean:status "completed" ;
     bean:title ?title .
  ?child bean:parent ?b ;
         bean:status ?cStatus .
  FILTER(?cStatus IN ("todo", "in-progress", "open"))
}
GROUP BY ?id ?status ?title
`,
  },

  stale_claims: {
    description: "In-progress beans whose updated_at timestamp is older than 7 days",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?id ?status ?updatedAt ?title
WHERE {
  ?b bean:id ?id ;
     bean:status "in-progress" ;
     bean:title ?title ;
     bean:updatedAt ?updatedAt .
  FILTER(STR(?updatedAt) < STR(NOW() - "P7D"^^<http://www.w3.org/2001/XMLSchema#duration>))
}
ORDER BY ?updatedAt
`,
  },

  unparented_open_tasks: {
    description: "Open non-epic beans that have no epic or milestone parent",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?id ?status ?type ?title
WHERE {
  ?b bean:id ?id ;
     bean:status ?status ;
     bean:type ?type ;
     bean:title ?title .
  FILTER(?status IN ("todo", "in-progress", "open"))
  FILTER(?type != "epic" && ?type != "milestone")
  FILTER NOT EXISTS {
    ?b bean:parent ?parent .
  }
}
ORDER BY ?type ?id
`,
  },

  circular_blockers: {
    description: "Circular blocking deadlocks where bean A blocks bean B and bean B blocks bean A",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?aId ?bId ?aTitle ?bTitle
WHERE {
  ?a bean:id ?aId ;
     bean:title ?aTitle ;
     bean:blocks ?b .
  ?b bean:id ?bId ;
     bean:title ?bTitle ;
     bean:blocks ?a .
  FILTER(STR(?aId) < STR(?bId))
}
ORDER BY ?aId
`,
  },

  high_fanout_epics: {
    description: "Epics with high fanout (>= 15 direct children) that may need decomposition",
    sparql: `
PREFIX bean: <https://folio-assistant.org/vocab/bean#>

SELECT ?epicId ?title (COUNT(?child) AS ?childCount)
WHERE {
  ?epic bean:id ?epicId ;
        bean:title ?title ;
        bean:type "epic" .
  ?child bean:parent ?epic .
}
GROUP BY ?epicId ?title
HAVING (COUNT(?child) >= 15)
ORDER BY DESC(?childCount) ?epicId
`,
  },
};

/** Convert bean nodes into W3C N-Quads format. */
export function beansToNQuads(beans: BeanNode[]): string {
  const lines: string[] = [];

  for (const b of beans) {
    const normId = b.id.startsWith("folio-assistant-") ? b.id : `folio-assistant-${b.id}`;
    const subj = `<${BEAN_PREFIX}${normId}>`;

    lines.push(`${subj} <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${BEAN_NS}Bean> .`);
    lines.push(`${subj} <${BEAN_NS}id> "${b.id}" .`);
    lines.push(`${subj} <${BEAN_NS}file> "${b.file}" .`);

    if (b.title) {
      lines.push(`${subj} <${BEAN_NS}title> ${JSON.stringify(b.title)} .`);
    }
    if (b.status) {
      lines.push(`${subj} <${BEAN_NS}status> "${b.status}" .`);
    }
    if (b.type) {
      lines.push(`${subj} <${BEAN_NS}type> "${b.type}" .`);
    }
    if (b.priority) {
      lines.push(`${subj} <${BEAN_NS}priority> "${b.priority}" .`);
    }
    if (b.createdAt) {
      lines.push(`${subj} <${BEAN_NS}createdAt> "${b.createdAt}" .`);
    }
    if (b.updatedAt) {
      lines.push(`${subj} <${BEAN_NS}updatedAt> "${b.updatedAt}" .`);
    }

    if (b.parent) {
      const parentNorm = b.parent.startsWith("folio-assistant-") ? b.parent : `folio-assistant-${b.parent}`;
      lines.push(`${subj} <${BEAN_NS}parent> <${BEAN_PREFIX}${parentNorm}> .`);
    }

    for (const blk of b.blocking ?? []) {
      const blkNorm = blk.startsWith("folio-assistant-") ? blk : `folio-assistant-${blk}`;
      lines.push(`${subj} <${BEAN_NS}blocks> <${BEAN_PREFIX}${blkNorm}> .`);
      lines.push(`<${BEAN_PREFIX}${blkNorm}> <${BEAN_NS}blockedBy> ${subj} .`);
    }

    for (const blk of b.declaredBlockedBy ?? []) {
      const blkNorm = blk.startsWith("folio-assistant-") ? blk : `folio-assistant-${blk}`;
      lines.push(`${subj} <${BEAN_NS}blockedBy> <${BEAN_PREFIX}${blkNorm}> .`);
      lines.push(`<${BEAN_PREFIX}${blkNorm}> <${BEAN_NS}blocks> ${subj} .`);
    }

    for (const tag of b.tags ?? []) {
      lines.push(`${subj} <${BEAN_NS}tag> "${tag}" .`);
    }
  }

  return lines.join("\n") + "\n";
}

/** Build an in-memory Oxigraph Store from beans on disk. */
export function buildBeanStore(repoRoot: string): { store: oxigraph.Store; beans: BeanNode[]; quadsCount: number } {
  const beans = readBeans(repoRoot) ?? [];
  const store = new oxigraph.Store();
  const nquads = beansToNQuads(beans);
  store.load(nquads, { format: "application/n-quads" });
  return { store, beans, quadsCount: store.size };
}

/** Execute a SPARQL 1.1 SELECT query against the bean store. */
export function queryBeanStore(store: oxigraph.Store, sparql: string): QueryResultRow[] {
  const rawRows = store.query(sparql) as unknown as Iterable<Map<string, { value: string }>>;
  const results: QueryResultRow[] = [];

  for (const row of rawRows) {
    const res: QueryResultRow = {};
    for (const [k, v] of row.entries()) {
      let val = v.value;
      if (typeof val === "string" && val.startsWith(BEAN_PREFIX)) {
        val = val.slice(BEAN_PREFIX.length);
      }
      res[k] = val;
    }
    results.push(res);
  }

  return results;
}

/** Format rows as ASCII table. */
export function formatTable(rows: QueryResultRow[]): string {
  if (rows.length === 0) return "No results found.";
  const keys = Object.keys(rows[0]!);
  const colWidths = keys.map((k) =>
    Math.min(60, Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)))
  );

  const header = keys.map((k, i) => k.padEnd(colWidths[i]!)).join(" | ");
  const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");
  const dataLines = rows.map((r) =>
    keys
      .map((k, i) => {
        let val = String(r[k] ?? "");
        if (val.length > colWidths[i]!) val = val.slice(0, colWidths[i]! - 3) + "...";
        return val.padEnd(colWidths[i]!);
      })
      .join(" | ")
  );

  return [header, sep, ...dataLines].join("\n");
}

/** CLI entry point */
if (import.meta.main) {
  const args = process.argv.slice(2);
  const repoRoot = resolve(".");

  let named: string | null = null;
  let sparql: string | null = null;
  let format: "table" | "json" | "ids" = "table";
  let exportNq: string | null = null;
  let listNamed = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--named" && args[i + 1]) {
      named = args[++i]!;
    } else if (a === "--sparql" && args[i + 1]) {
      sparql = args[++i]!;
    } else if (a === "--format" && args[i + 1]) {
      const fmt = args[++i];
      if (fmt === "table" || fmt === "json" || fmt === "ids") {
        format = fmt;
      }
    } else if (a === "--export-nq" && args[i + 1]) {
      exportNq = args[++i]!;
    } else if (a === "--list") {
      listNamed = true;
    } else if (a === "--help" || a === "-h") {
      console.log(`
Usage: bun run beans:query [options]

Options:
  --named <name>      Execute a pre-defined named query:
                      ${Object.keys(NAMED_QUERIES).join(", ")}
  --sparql <query>    Execute an arbitrary SPARQL 1.1 SELECT query
  --format <fmt>      Output format: table (default), json, ids
  --export-nq <path>  Export the compiled RDF N-Quads dataset to a file
  --list              List all available named queries with descriptions
  --help, -h          Show this help message
`);
      process.exit(0);
    }
  }

  if (listNamed) {
    console.log("Available Named Queries:\n");
    for (const [k, q] of Object.entries(NAMED_QUERIES)) {
      console.log(`- ${k}: ${q.description}`);
    }
    process.exit(0);
  }

  const t0 = performance.now();
  const { store, beans, quadsCount } = buildBeanStore(repoRoot);
  const loadTime = (performance.now() - t0).toFixed(1);

  if (exportNq) {
    const nquads = beansToNQuads(beans);
    writeFileSync(exportNq, nquads, "utf8");
    console.log(`Exported ${quadsCount} quads to ${exportNq} in ${loadTime}ms.`);
    process.exit(0);
  }

  let queryText = sparql;
  if (named) {
    const nq = NAMED_QUERIES[named];
    if (!nq) {
      console.error(`Unknown named query: "${named}". Available queries: ${Object.keys(NAMED_QUERIES).join(", ")}`);
      process.exit(1);
    }
    queryText = nq.sparql;
  }

  if (!queryText) {
    // Default to safe_drain_candidates
    queryText = NAMED_QUERIES.safe_drain_candidates!.sparql;
    named = "safe_drain_candidates";
  }

  const t1 = performance.now();
  const results = queryBeanStore(store, queryText);
  const queryTime = (performance.now() - t1).toFixed(1);

  if (format === "json") {
    console.log(JSON.stringify(results, null, 2));
  } else if (format === "ids") {
    for (const r of results) {
      console.log(r.id ?? Object.values(r)[0]);
    }
  } else {
    if (named) {
      console.log(`Named Query: ${named} (${NAMED_QUERIES[named]?.description})`);
    }
    console.log(`Store: ${beans.length} beans (${quadsCount} quads) loaded in ${loadTime}ms. Query executed in ${queryTime}ms. Results: ${results.length}\n`);
    console.log(formatTable(results));
  }
}
