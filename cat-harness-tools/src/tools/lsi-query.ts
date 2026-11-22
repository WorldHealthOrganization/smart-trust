/**
 * `lsi_query` — Latent Semantic Indexing over one declared prose graph, for an
 * agent that has run the lexical search and wants the case it cannot reach:
 * related text worded differently. Method `methodologies/lsi.md`; skill
 * `lsi-indexing`.
 *
 * Generic rather than adapter-scoped: every folio has a library, skills and
 * beans, and none of it depends on a block kind.
 *
 * Every hit is labelled `lexical+latent` or `latent only`, and the text says
 * the score is a cosine in the latent space — never a relevance rank, and
 * never merged with a lexical result (method refusal 1).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildLsi, query, tokenize } from "../../pipeline/lsi.js";
import { proseGraphs, unitsOf } from "../../scripts/lsi.js";

export function lsiQueryText(text: string, opts: { instance?: string; graph?: string; top?: number } = {}): string {
  const targets = proseGraphs().filter((t) => (!opts.instance || t.instance === opts.instance) && (!opts.graph || t.id === opts.graph));
  if (!targets.length) {
    const known = proseGraphs().map((t) => `${t.instance}/${t.id}`).join(", ");
    return `No declared prose graph matches instance=${opts.instance ?? "*"} graph=${opts.graph ?? "*"}. Known: ${known}`;
  }
  const words = tokenize(text);
  const out: string[] = [];
  for (const t of targets) {
    const units = unitsOf(t.absPath, t.graphTypologies);
    if (units.length < 3) {
      out.push(`# ${t.instance}/${t.id}: ${units.length} unit(s) — too few to index; not searched`);
      continue;
    }
    const ix = buildLsi(units, { k: 100, seed: 1990 });
    const bodies = new Map(units.map((u) => [u.id, u.text.toLowerCase()]));
    out.push(`# ${t.instance}/${t.id} — ${units.length} units, k=${ix.k}. Cosine in the latent space; NOT a lexical match or a relevance rank.`);
    for (const h of query(ix, text, opts.top ?? 10)) {
      const lexical = words.some((w) => bodies.get(h.id)!.includes(w));
      out.push(`  ${h.cosine.toFixed(3)}  ${lexical ? "lexical+latent" : "latent only   "}  ${h.id}`);
    }
  }
  return out.join("\n");
}

export function registerLsiQueryTools(server: McpServer): void {
  server.tool(
    "lsi_query",
    "Latent Semantic Indexing over a declared prose graph (a library, the skills, the beans, docs): " +
      "find units that discuss the query in OTHER words. Run the lexical search first; this is " +
      "the supplement for the vocabulary gap. Each hit is marked `lexical+latent` or `latent only`. " +
      "The score is a cosine in the latent space, not a relevance rank, and it is a proposal — " +
      "it never establishes that a unit is relevant, correct, or a dependency.",
    {
      text: z.string().min(1).describe("The query, in any words."),
      instance: z.string().optional().describe("Instance declaring the graph, e.g. `cat-harness`. Omit for all."),
      graph: z.string().optional().describe("Graph id within the instance, e.g. `library`, `skills`. Omit for all."),
      top: z.number().int().min(1).max(50).default(10).describe("Hits per graph."),
    },
    async ({ text, instance, graph, top }) => {
      try {
        return { content: [{ type: "text" as const, text: lsiQueryText(text, { instance, graph, top }) }] };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `lsi_query failed: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    },
  );
}
