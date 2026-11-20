/**
 * The WHO SMART Guidelines portfolio: the umbrella knowledge graph that links
 * the libraries of every SMART level, from the narrative L1 publications to
 * the L4 executable software, without copying them.
 *
 * A `portfolio` (cat-harness-tools) whose levels are the SMART levels. The
 * owner, 2026-11-10 (litlfred/smart-html-jtd#20, cards Q-UMB-1 A and
 * Q-UMB-2 A): smart-html-jtd is a `guideline-portfolio`, linking one or more
 * libraries of L1 documents (such as who-iris), the same for L2, L3 and so on.
 *
 * | level | what its members are |
 * |---|---|
 * | `L1` | narrative WHO guidelines and publications (who-iris items) |
 * | `L2` | operational guidance: DAKs and Digital Transformation Handbooks |
 * | `L3` | machine-readable FHIR implementation guides |
 * | `L4` | executable reference software and services |
 *
 * A portfolio names the levels it has members for, in that order; it need not
 * name all four.
 *
 * @graphNode schema
 * @module smart-base/schemas/guideline-portfolio
 */
import { nodeKind } from "../../cat-harness-tools/schemas/kg/node-kind.ts";
import { PortfolioKind } from "../../cat-harness-tools/schemas/kg/portfolio.ts";

export const GUIDELINE_PORTFOLIO_SCHEMA_ID = "guideline-portfolio/1.0.0";

/** The SMART Guidelines levels, in order. */
export const SMART_LEVELS = ["L1", "L2", "L3", "L4"] as const;

export const GuidelinePortfolioKind = nodeKind(GUIDELINE_PORTFOLIO_SCHEMA_ID, [PortfolioKind], {}, {
  strict: true,
  term: "Guideline portfolio",
  summary: "The umbrella knowledge graph of WHO SMART Guidelines: libraries linked under the SMART levels L1 to L4.",
  refine: (p, ctx) => {
    let last = -1;
    p.levels.forEach((l, i) => {
      const at = (SMART_LEVELS as readonly string[]).indexOf(l.id);
      if (at < 0) {
        ctx.addIssue({ code: "custom", path: ["levels", i, "id"], message: `\`${l.id}\` is not a SMART level (${SMART_LEVELS.join(", ")})` });
      } else if (at <= last) {
        ctx.addIssue({ code: "custom", path: ["levels", i, "id"], message: `level \`${l.id}\` is out of order: SMART levels run ${SMART_LEVELS.join(", ")}` });
      } else {
        last = at;
      }
    });
  },
});

export const GuidelinePortfolioSchema = GuidelinePortfolioKind.schema;
