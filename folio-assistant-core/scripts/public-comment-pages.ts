/**
 * The public-review kinds' own page sections — the first renderers of issue
 * #2195's *"Generic + override"*.
 *
 * @module folio-assistant-core/scripts/public-comment-pages
 * @graphNode none — page renderers named by the validator nodes' `pages`, not a schema
 *
 * The generic pages show a change-set's fields and a comment's fields, but not
 * the one thing a reviewer opens either page for: WHICH comments a change-set
 * answers, and WHICH change-sets a comment is in. Both are one join over the
 * change-set records, the single source (#2184); nothing here is stored.
 *
 * - a change-set's page lists its comments, each linked to its own page;
 * - the change-set dashboard says how many comments are in no open change-set;
 * - a comment's page lists the change-sets it is in.
 */
import type { KindNode } from "@litlfred/cat-harness-tools/schemas/kg/node-kind-nodes.ts";
import { CHANGING_DECISIONS, type DecisionCode } from "../schemas/public-comment.ts";
import { esc, type KindPages, type KindPagesContext, type PageSection } from "@litlfred/cat-harness-tools/scripts/gen-node-kind-pages.ts";

const CHANGE_SET = "changeset";
const COMMENT = "public-comment";

/** A comment's reference, `PC-0042`: what a change-set's `refs` name. */
const refOf = (n: KindNode): string | undefined => {
  const p = n.node.public as { ref?: unknown } | undefined;
  return typeof p?.ref === "string" ? p.ref : undefined;
};
const refsOf = (cs: KindNode): string[] => (Array.isArray(cs.node.refs) ? cs.node.refs.filter((r): r is string => typeof r === "string") : []);
/** A change-set that no longer carries its comments: merged into the document, or closed without. */
const settled = (cs: KindNode) => cs.node.status === "merged" || cs.node.status === "closed";

/**
 * A comment decided "noted", "not accepted" or "deferred" changes nothing, so
 * no change-set is owed it. Counting it as "in none" overstated the gap: on
 * smart-ra, PC-0051 was decided not-accepted and still showed as uncovered.
 */
const owesNoChange = (c: KindNode): boolean => {
  const code = (c.node.public as { decision?: { code?: unknown } } | undefined)?.decision?.code;
  return typeof code === "string" && !CHANGING_DECISIONS.includes(code as DecisionCode);
};

/** Comments by reference, within one harness: a change-set names comments of its own review only. */
function commentsIn(harness: string, ctx: KindPagesContext): Map<string, KindNode> {
  return new Map(ctx.nodesOf(COMMENT).filter((c) => c.harness === harness).flatMap((c) => (refOf(c) ? [[refOf(c)!, c] as const] : [])));
}

const link = (kind: string, n: KindNode, text: string, ctx: KindPagesContext) => {
  const to = ctx.linkTo(kind, n);
  return to ? `<a href="${esc(to)}">${esc(text)}</a>` : esc(text);
};

export const ChangeSetPages: KindPages = {
  node(cs, ctx): PageSection[] {
    const byRef = commentsIn(cs.harness, ctx);
    const rows = refsOf(cs).map((r) => {
      const c = byRef.get(r);
      return c
        ? `<tr><td class="s">${link(COMMENT, c, r, ctx)}</td><td class="s">${esc(c.node.status)}</td><td class="t">${esc(c.node.summary)}</td></tr>`
        : `<tr><td class="s">${esc(r)}</td><td class="s" colspan="2">not found in ${esc(cs.harness)}</td></tr>`;
    });
    return [
      {
        id: "comments",
        label: "Comments it answers",
        html: rows.length
          ? `<div class="clip"><table><thead><tr><th>Comment</th><th>Status</th><th>Summary</th></tr></thead><tbody>\n${rows.join("\n")}\n</tbody></table></div>`
          : "<p>None yet.</p>",
      },
    ];
  },

  dashboard(sets, ctx): PageSection[] {
    const harnesses = [...new Set(sets.map((s) => s.harness))];
    const all = ctx.nodesOf(COMMENT).filter((c) => harnesses.includes(c.harness));
    if (!all.length) return [];
    const decidedNoChange = all.filter(owesNoChange).length;
    const comments = all.filter((c) => !owesNoChange(c));
    const covered = new Set(sets.filter((s) => !settled(s)).flatMap((s) => refsOf(s).map((r) => `${s.harness}\u0000${r}`)));
    const outside = comments.filter((c) => !covered.has(`${c.harness}\u0000${refOf(c)}`));
    const list = outside.map((c) => link(COMMENT, c, refOf(c) ?? c.path, ctx)).join(", ");
    return [
      {
        id: "coverage",
        label: "Coverage",
        html: `<ul class="tiles"><li><b>${comments.length - outside.length}</b>in an open change-set</li><li><b>${outside.length}</b>in none</li>${
          decidedNoChange ? `<li><b>${decidedNoChange}</b>decided, no change needed</li>` : ""
        }</ul>${
          outside.length ? `<details><summary>The ${outside.length} comment(s) in none</summary><p>${list}</p></details>` : ""
        }`,
      },
    ];
  },
};

export const PublicCommentPages: KindPages = {
  node(c, ctx): PageSection[] {
    const ref = refOf(c);
    const sets = ctx.nodesOf(CHANGE_SET).filter((s) => s.harness === c.harness && ref !== undefined && refsOf(s).includes(ref));
    return [
      {
        id: "change-sets",
        label: "Change-sets",
        html: sets.length
          ? `<ul>${sets.map((s) => `<li>${link(CHANGE_SET, s, String(s.node.id ?? s.path), ctx)} — ${esc(s.node.title)} <span class="m">(${esc(s.node.status)})</span></li>`).join("")}</ul>`
          : "<p>In no change-set yet.</p>",
      },
    ];
  },
};
