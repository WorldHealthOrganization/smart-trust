#!/usr/bin/env bun
/**
 * Build a bean drain's queue — the `drain-queue` Tool (cat-harness
 * `tools/drain-queue/`), skill `bean-drain` step 1.
 *
 * Reads every copy, merges them (newest `updated_at` wins, disagreements
 * listed), leaves out goals, epics, blocked, closed, drafts and owner-held
 * beans with a reason each, marks beans another agent touched inside the
 * window as skip, and groups the rest by owner.
 *
 * ## How a bean gets an owner
 *
 * A bean listed in `--holdings` goes to its holder. Otherwise it goes to the
 * owner holding a bean with the same parent. Otherwise it is spare. This is a
 * proposal: the queue keeper moves beans by editing the holdings file and
 * re-running.
 *
 * It never claims. Every bean taken from the queue goes through
 * `bean-claim-check`.
 *
 * @module scripts/drain-queue
 */
import { readFileSync } from "node:fs";

import {
  type Agent,
  agentOf,
  argList,
  argOne,
  type BeanFile,
  type Copy,
  DEFAULT_AGENTS,
  DEFS_DIR,
  exclusionOf,
  type Exclusion,
  fetchCopy,
  headSha,
  heldOnBranch,
  type Me,
  readBeansAt,
  recentCommits,
  windowMs,
} from "./lib/bean-drain.ts";

export interface QueueEntry {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  lastTouch?: { author: string; at: string; agent: string };
  skip?: string;
}

export interface Queue {
  refreshedAt: string;
  sources: Array<{ repo: string; ref: string; sha: string }>;
  byOwner: Array<{ owner: string; beans: QueueEntry[] }>;
  spare: QueueEntry[];
  excluded: Array<{ id: string; reason: Exclusion; detail?: string }>;
  disagreements: Array<{ id: string; byCopy: Record<string, string>; used: string }>;
}

const PRIORITY = ["critical", "high", "normal", "low", "deferred"];
const rank = (p: string) => (PRIORITY.indexOf(p) < 0 ? 2 : PRIORITY.indexOf(p));

/** Merge copies: the newest `updated_at` wins. Pure. */
export function mergeCopies(per: Array<{ repo: string; beans: BeanFile[] }>): { beans: Map<string, BeanFile & { from: string }>; disagreements: Queue["disagreements"] } {
  const beans = new Map<string, BeanFile & { from: string }>();
  const statuses = new Map<string, Record<string, string>>();
  for (const { repo, beans: list } of per) {
    for (const b of list) {
      const s = statuses.get(b.id) ?? {};
      s[repo] = b.status;
      statuses.set(b.id, s);
      const cur = beans.get(b.id);
      if (cur === undefined || b.updatedAt > cur.updatedAt) beans.set(b.id, { ...b, from: repo });
    }
  }
  const disagreements: Queue["disagreements"] = [];
  for (const [id, s] of statuses) {
    for (const { repo } of per) s[repo] ??= "absent";
    if (new Set(Object.values(s)).size > 1) disagreements.push({ id, byCopy: s, used: beans.get(id)!.from });
  }
  return { beans, disagreements };
}

/** Group drainable beans by owner. Pure. */
export function group(entries: Array<QueueEntry & { parent?: string }>, holdings: Record<string, string[]>, parents: Map<string, string | undefined>): { byOwner: Queue["byOwner"]; spare: QueueEntry[] } {
  const ownerOf = new Map<string, string>();
  for (const [owner, ids] of Object.entries(holdings)) for (const id of ids) ownerOf.set(id, owner);
  const areaOwner = new Map<string, string>();
  for (const [id, owner] of ownerOf) {
    const p = parents.get(id);
    if (p !== undefined && !areaOwner.has(p)) areaOwner.set(p, owner);
  }
  const by = new Map<string, QueueEntry[]>();
  const spare: QueueEntry[] = [];
  for (const e of entries) {
    const { parent, ...entry } = e;
    const owner = ownerOf.get(e.id) ?? (parent !== undefined ? areaOwner.get(parent) : undefined);
    if (owner === undefined) spare.push(entry);
    else by.set(owner, [...(by.get(owner) ?? []), entry]);
  }
  const order = (l: QueueEntry[]) => l.sort((a, b) => rank(a.priority) - rank(b.priority) || a.id.localeCompare(b.id));
  return { byOwner: [...by].map(([owner, beans]) => ({ owner, beans: order(beans) })).sort((a, b) => a.owner.localeCompare(b.owner)), spare: order(spare) };
}

export function buildQueue(o: { copies: string[]; holdings: Record<string, string[]>; agents: Agent[]; me: Me; windowMs: number; now?: Date }): Queue | { error: string } {
  const now = o.now ?? new Date();
  const copies: Copy[] = [];
  for (const p of o.copies) {
    const c = fetchCopy(p);
    if ("error" in c) return c;
    copies.push(c);
  }
  const per: Array<{ repo: string; beans: BeanFile[] }> = [];
  for (const c of copies) {
    const r = readBeansAt(c.path, c.ref);
    if ("error" in r) return { error: `${c.repo}: ${r.error}` };
    per.push({ repo: c.repo, beans: r });
  }
  const { beans, disagreements } = mergeCopies(per);
  const open = new Set([...beans.values()].filter((b) => b.status !== "completed" && b.status !== "scrapped").map((b) => b.id));
  const excluded: Queue["excluded"] = [];
  const entries: Array<QueueEntry & { parent?: string }> = [];
  const parents = new Map<string, string | undefined>();
  for (const b of beans.values()) {
    const parent = b.parent;
    parents.set(b.id, parent);
    const ex = exclusionOf(b, open);
    if (ex) {
      // Closed beans are the bulk of the store; listing each would bury the rest.
      if (ex.reason !== "completed" && ex.reason !== "scrapped") excluded.push({ id: b.id, ...ex });
      continue;
    }
    // Newest commit across every copy that holds the bean.
    const commits = copies.flatMap((c) => recentCommits(c.path, c.ref, `${DEFS_DIR}/${b.id}--*`, 3)).sort((x, y) => y.at.localeCompare(x.at));
    const held = heldOnBranch(b, commits, o.agents, o.me, now.getTime(), o.windowMs);
    const newest = commits[0];
    entries.push({
      id: b.id,
      title: b.title,
      status: b.status,
      type: b.type,
      priority: b.priority,
      ...(newest ? { lastTouch: { author: newest.author, at: newest.at, agent: agentOf(newest.author, o.agents)?.name ?? "other" } } : {}),
      ...(held ? { skip: held.reason } : {}),
      ...(parent !== undefined ? { parent } : {}),
    });
  }
  const { byOwner, spare } = group(entries, o.holdings, parents);
  return {
    refreshedAt: now.toISOString(),
    sources: copies.map((c) => ({ repo: c.repo, ref: c.branch, sha: headSha(c) })),
    byOwner,
    spare,
    excluded: excluded.sort((a, b) => a.reason.localeCompare(b.reason) || a.id.localeCompare(b.id)),
    disagreements,
  };
}

function line(e: QueueEntry): string {
  return `- ${e.id} (${e.priority}, ${e.status}) ${e.title}${e.skip ? ` — **skip**: ${e.skip}` : ""}`;
}

export function render(q: Queue): string {
  const out = [`# Drain queue (refreshed ${q.refreshedAt})`, "", `Sources: ${q.sources.map((s) => `${s.repo} ${s.ref} @ ${s.sha.slice(0, 7)}`).join(", ")}.`, ""];
  for (const g of q.byOwner) out.push(`## ${g.owner}`, "", ...g.beans.map(line), "");
  out.push("## Spare pool", "", ...(q.spare.length ? q.spare.map(line) : ["None."]), "");
  out.push("## Left out", "", ...q.excluded.map((x) => `- ${x.id}: ${x.reason}${x.detail ? ` (${x.detail})` : ""}`), "");
  if (q.disagreements.length) out.push("## Copies disagree (newest updated_at used)", "", ...q.disagreements.map((d) => `- ${d.id}: ${Object.entries(d.byCopy).map(([r, s]) => `${r} ${s}`).join(", ")}; used ${d.used}`), "");
  return out.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const w = windowMs(argOne(argv, "--window") ?? "24h");
  if (w === undefined) { console.error("--window is a count and a unit: 90m, 24h, 2d, 1w"); process.exit(2); }
  const h = argOne(argv, "--holdings");
  const a = argOne(argv, "--agents");
  const q = buildQueue({
    copies: argList(argv, "--copy").length > 0 ? argList(argv, "--copy") : [process.cwd()],
    holdings: h ? (JSON.parse(readFileSync(h, "utf8")) as Record<string, string[]>) : {},
    agents: a ? (JSON.parse(readFileSync(a, "utf8")) as Agent[]) : DEFAULT_AGENTS,
    me: { agent: argOne(argv, "--as") ?? "cloud", session: argOne(argv, "--session") ?? process.env.CLAUDE_SESSION_URL },
    windowMs: w,
  });
  if ("error" in q) { console.error(q.error); process.exit(2); }
  console.log(argv.includes("--json") ? JSON.stringify(q, null, 2) : render(q));
}
