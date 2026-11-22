#!/usr/bin/env bun
/**
 * The KG subscriptions page: the known substrates, and what each layer has
 * subscribed to and chosen to hold. The design is
 * `docs/proposals/kg-subscriptions.md` §"Known substrates" and §"The visualizer".
 *
 * ```sh
 * bun run cat subscriptions:viz          # write the subscriptions page under this instance's site directory
 * bun run cat subscriptions:viz:check    # fail when it is stale
 * ```
 *
 * ## Known substrates are DERIVED where a fact exists
 *
 * Four sources, merged by `name`, the later overriding the earlier:
 *
 * 1. every layer in the checkout that declares a planned `repository` other
 *    than the one it lives in today, which is `planned`;
 * 2. every `associatedHarnesses` entry, which is `exists` (it has a site);
 * 3. every `subscriptions` entry, which is `exists` (it is pinned to a commit
 *    of a repository that was read) — needed because a subscription may not
 *    also be an associated harness;
 * 4. every `knownSubstrates` hand row, for what no declaration can say.
 *
 * So a staged layer appears the moment it declares its planned home, and
 * nobody keeps a second list of it.
 *
 * ## Nothing here needs the network
 *
 * A subscription's STATE is read from the checkout only: a chosen part with no
 * materialisation record is drawn as not yet held, never as held, and never as
 * missing. A part WITH a record (`kg:materialize`) is drawn from that record:
 * ⬇ held, and its bytes still hash to it; ⚠ held at another pin, or bytes
 * that no longer match; ✗ a gate refused; ? a gate unanswered or a record
 * unreadable — could-not-determine is drawn, never hidden. What upstream looks
 * like right now is `refresh-materialized`'s question, not this page's.
 *
 * @module cat-harness/scripts/subscriptions-viz
 * @covers cat-harness, docs — the subscriptions and known substrates every declaration states
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  findDeclarationFile,
  layerRootsIn,
  readDeclaration,
  siteDirFor,
  type KnownSubstrate,
  type Subscription,
} from "../schemas/kg/cat-harness.ts";
import { instantiatedHarnessNames } from "../schemas/kg/harness-config.ts";
import { instanceRepositories } from "../schemas/kg/instance-repositories.ts";
import { partRecordsIn, snapshotDirOf, type PartView } from "./kg-subscribe.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { SNAPSHOT_SUFFIX } from "../schemas/kg/substrate-snapshot.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const INSTANCE = resolve(HARNESS_ROOT);
// declared-path-literal: the page's route under the site directory, not the `subscriptions/` snapshot directory of the same name
export const OUT = join(INSTANCE, siteDirFor(INSTANCE), "subscriptions", "index.md");

export type SubstrateSource = "staged instance" | "associated harness" | "subscription" | "hand-entered";

export interface SubstrateRow extends KnownSubstrate {
  /** Where the row came from, so a reader can tell a derived fact from a hand-kept one. */
  source: SubstrateSource;
}

/** `https://github.com/owner/repo` → `owner/repo`; anything else → undefined. */
export function repoFromUrl(url: string | undefined): string | undefined {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/.#?]+)\/?$/.exec(url ?? "");
  return m?.[1];
}

/** The substrate's title as its cached snapshot records it; undefined when there is none or it cannot be read. */
function snapshotTitle(snapshotDir: string | undefined, id: string): string | undefined {
  if (!snapshotDir) return undefined;
  try {
    const j = JSON.parse(readFileSync(join(snapshotDir, `${id}${SNAPSHOT_SUFFIX}`), "utf-8")) as { summary?: { title?: unknown } };
    return typeof j.summary?.title === "string" ? j.summary.title : undefined;
  } catch {
    return undefined;
  }
}

/** Merge the four sources by name; a later source overrides an earlier one field by field. */
export function knownSubstrates(repoRoot: string): SubstrateRow[] {
  const rows = new Map<string, SubstrateRow>();
  const put = (row: SubstrateRow) => rows.set(row.name, { ...(rows.get(row.name) ?? {}), ...row });

  for (const e of instanceRepositories(repoRoot).entries) {
    const staged = e.livesAt !== undefined && e.livesAt.repository !== e.repository;
    if (!staged) continue;
    put({ name: e.name, repository: e.repository, status: "planned", source: "staged instance" });
  }
  const decls = layerRootsIn(repoRoot)
    .map((r) => readDeclaration(r))
    .filter((d): d is NonNullable<typeof d> => d !== undefined);
  for (const d of decls) {
    for (const a of d.associatedHarnesses ?? []) {
      put({
        name: a.name,
        ...(a.title ? { title: a.title } : {}),
        ...(repoFromUrl(a.repository) ? { repository: repoFromUrl(a.repository) } : {}),
        status: "exists",
        source: "associated harness",
      });
    }
  }
  for (const r of layerRootsIn(repoRoot)) {
    const d = readDeclaration(r);
    if (!d?.subscriptions?.length) continue;
    const declName = findDeclarationFile(r);
    const raw = declName ? (JSON.parse(readFileSync(join(r, declName), "utf-8")) as Record<string, unknown>) : {};
    const snapshotDir = snapshotDirOf(r, raw);
    for (const s of d.subscriptions) {
      put({
        name: s.id,
        ...(snapshotTitle(snapshotDir, s.id) ? { title: snapshotTitle(snapshotDir, s.id) } : {}),
        repository: s.repository,
        status: "exists",
        source: "subscription",
      });
    }
  }
  for (const d of decls) for (const k of d.knownSubstrates ?? []) put({ ...k, source: "hand-entered" });
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface SubscriptionCard {
  /** The subscribing layer. */
  subscriber: string;
  subscription: Subscription;
  /** The materialisation records under the subscription's directory, read structurally. */
  parts?: readonly PartView[];
  /** Bytes in that directory with no record, relative to the snapshot directory. */
  strays?: readonly string[];
  /** Chosen harnesses the root instantiates — its index lists them, else a `<name>.config.json` (`kg:instantiate`, slice 7). */
  instantiated?: string[];
}

export function subscriptionCards(repoRoot: string): SubscriptionCard[] {
  const out: SubscriptionCard[] = [];
  // Index first (bean `ymvt`): what `index.config.json` lists, else the root
  // `<name>.config.json` stems. An unreadable index instantiates nothing here;
  // `check:landing-instance` is the gate that fails on it.
  let names: Set<string>;
  try {
    names = new Set(instantiatedHarnessNames(repoRoot));
  } catch {
    names = new Set();
  }
  for (const root of layerRootsIn(repoRoot)) {
    const d = readDeclaration(root);
    if (!d?.subscriptions?.length) continue;
    const declName = findDeclarationFile(root);
    const raw = declName ? (JSON.parse(readFileSync(join(root, declName), "utf-8")) as Record<string, unknown>) : {};
    const snapshotDir = snapshotDirOf(root, raw);
    for (const s of d.subscriptions) {
      const { parts, strays } = snapshotDir ? partRecordsIn(snapshotDir, s.id) : { parts: [], strays: [] };
      const instantiated = (s.harnesses ?? []).filter((h) => names.has(h));
      out.push({ subscriber: d.name, subscription: s, parts, strays, ...(instantiated.length ? { instantiated } : {}) });
    }
  }
  return out.sort((a, b) => `${a.subscriber}/${a.subscription.id}`.localeCompare(`${b.subscriber}/${b.subscription.id}`));
}

const STATUS_MARK: Record<KnownSubstrate["status"], string> = {
  proposed: "💡 proposed",
  planned: "🧱 planned",
  exists: "📦 exists",
  published: "🚀 published",
};

const fmtBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1024 ** 2).toFixed(1)} MiB`);
const code = (xs: readonly string[]): string => xs.map((g) => `\`${g}\``).join(", ");

/** One part's state, drawn from its record. `ref` is the subscription's pin. */
export function partState(p: PartView, ref: string): string {
  if (p.state === "unreadable") return `? record unreadable: ${p.why ?? "no reason given"}`;
  if (p.state === "referenced") {
    if (p.refused.length) return `✗ gate refused: ${code(p.refused)}${p.unanswered.length ? `; unanswered: ${code(p.unanswered)}` : ""}`;
    if (p.unanswered.length) return `? gates unanswered: ${code(p.unanswered)}${p.purposeMissing ? "; no purpose stated" : ""}`;
    return p.purposeMissing ? "? no purpose stated" : "? stayed referenced, and the record does not say why";
  }
  if (p.ref !== ref) return `⚠ stale: held at \`${(p.ref ?? "?").slice(0, 12)}\`, pinned at \`${ref.slice(0, 12)}\``;
  if (p.fixity !== "verified") return `⚠ the bytes do not match the record (${p.fixity ?? "unchecked"})`;
  const size = p.bytes !== undefined ? `, ${fmtBytes(p.bytes)}` : "";
  return `⬇ materialised — ${p.fileCount ?? "?"} file(s)${size}, ${p.purpose ?? "no purpose"}`;
}

const cell = (s: string | undefined): string => (s ?? "—").replace(/[\\|]/g, "\\$&").replace(/\n/g, " ");
const repoLink = (r: string | undefined): string => (r ? `[\`${r}\`](https://github.com/${r})` : "—");

export function render(substrates: readonly SubstrateRow[], cards: readonly SubscriptionCard[]): string {
  const lines: string[] = [
    "---",
    "layout: default",
    "title: KG subscriptions",
    "nav_order: 92",
    "permalink: /subscriptions/",
    "---",
    "<!-- Generated by cat-harness/scripts/subscriptions-viz.ts. Do not hand-edit: `subscriptions:viz:check` fails on the difference. -->",
    "",
    "# KG subscriptions",
    "",
    "A **substrate** is an external Knowledge Graph: a repository whose root declaration meets " +
      "bootstrap's schema requirements and declares at least one harness. An instance **subscribes** " +
      "to one at a pinned commit, then chooses which of its subgraphs, assets and harnesses to hold. " +
      "Everything it does not choose stays **referenced**: known, and not copied. " +
      "Design: the [KG subscriptions proposal]({{ '/proposals/kg-subscriptions.html' | relative_url }}) (issue #1719).",
    "",
    "## Known substrates",
    "",
    "Derived from the declarations wherever a fact exists: a staged instance's planned repository, " +
      "an associated harness's site, and a subscription's pinned repository. Only what no declaration can say is hand-entered, in " +
      "`knownSubstrates`.",
    "",
  ];
  if (substrates.length === 0) {
    lines.push("_No substrate is known: no staged instance, associated harness, subscription or hand-entered row._", "");
  } else {
    lines.push("| substrate | repository | status | tools repository | source | note |", "|---|---|---|---|---|---|");
    for (const r of substrates) {
      lines.push(
        `| **${cell(r.title ?? r.name)}** \`${r.name}\` | ${repoLink(r.repository)} | ${STATUS_MARK[r.status]} | ` +
          `${repoLink(r.toolsRepository)} | ${r.source} | ${cell(r.note)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Subscriptions", "");
  if (cards.length === 0) {
    lines.push(
      "_No instance subscribes to a substrate yet._ The first planned subscription is `litlfred/ihris`, " +
        "which is already associated (epic bean `fnx4`).",
      "",
    );
  }
  for (const { subscriber, subscription: s, parts = [], strays = [], instantiated } of cards) {
    lines.push(`### \`${subscriber}\` → ${repoLink(s.repository)} as \`${s.id}\``, "");
    // The kind is drawn, never inferred from an empty harness list: a content
    // Knowledge Graph (owner, 2026-10-06) offers no harness to choose.
    const kind = s.kind === "content" ? " A **content** Knowledge Graph: Subgraphs and no harness, so it contributes no skills, processes or roles." : "";
    const from = s.upstreamPath ? ` Declaration under \`${s.upstreamPath}/\`.` : "";
    lines.push(`Pinned at \`${s.ref}\`.${from}${kind}${s.note ? ` ${s.note}` : ""}`, "");
    lines.push("| part | chosen | state here |", "|---|---|---|");
    // A chosen part's STATE is not in the subscription on purpose (see
    // `Subscription`); until a materialisation record exists it is chosen and
    // NOT YET HELD — never drawn as held, never as missing.
    // Matched on the SLOT — the part the layout says the directory holds — so
    // a record that cannot be read is still drawn on its part's row.
    const subgraphPart = (g: string): PartView | undefined => parts.find((p) => p.slot.kind === "subgraph" && p.slot.id === g);
    for (const g of s.subgraphs ?? []) {
      const p = subgraphPart(g);
      lines.push(`| subgraph \`${g}\` | ✓ | ${p ? cell(partState(p, s.ref)) : "🔗 chosen, not yet held"} |`);
    }
    for (const p of parts) {
      if (p.slot.kind !== "subgraph" || (s.subgraphs ?? []).includes(p.slot.id)) continue;
      lines.push(`| subgraph \`${p.slot.id}\` | — | ⚠ recorded, and no longer chosen: ${cell(partState(p, s.ref))} |`);
    }
    // A nested subgraph is chosen by its parent and held by path (owner, 2026-10-24, ruling 4).
    for (const p of parts) {
      if (p.slot.kind !== "nested") continue;
      const parent = p.part?.kind === "subgraph" ? p.part.id : undefined;
      const chosen = parent !== undefined && (s.subgraphs ?? []).includes(parent);
      lines.push(`| nested subgraph \`${p.slot.path}\` | ${chosen ? `✓ by \`${parent}\`` : "—"} | ${chosen ? cell(partState(p, s.ref)) : `⚠ recorded, and its parent is not chosen: ${cell(partState(p, s.ref))}`} |`);
    }
    lines.push(`| assets | policy \`${s.assets?.policy ?? "none"}\` | 🔗 each copy passes the materialisation gates |`);
    for (const p of parts) {
      if (p.slot.kind !== "asset") continue;
      lines.push(`| asset \`${p.slot.path}\` | on demand | ${cell(partState(p, s.ref))} |`);
    }
    for (const st of strays) lines.push(`| \`${st}\` | — | ⚠ bytes with no record |`);
    for (const h of s.harnesses ?? []) {
      lines.push(
        instantiated?.includes(h)
          ? `| harness \`${h}\` | ✓ | ⬆ instantiated: \`${h}.config.json\` at the root |`
          : `| harness \`${h}\` | ✓ | 🔗 chosen, not yet instantiated |`,
      );
    }
    lines.push(
      "| everything else the substrate offers | — | 🔗 referenced |",
      "",
    );
  }
  return lines.join("\n") + "\n";
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const substrates = knownSubstrates(REPO);
  const cards = subscriptionCards(REPO);
  const text = render(substrates, cards);
  const rel = relative(REPO, OUT);
  // BUILT AT PUBLISH (owner, 2026-10-14, "B1"; 2026-10-15). The page reads
  // every layer declaration in the checkout (planned repositories,
  // associated harnesses, subscriptions), so it moved with the index's pins.
  // The layer declares it `builtAtPublish` with this script as its writer,
  // and `derive:publish` runs it; under `--check` a declared page has no
  // committed bytes to compare, so it is skipped there (the `folio:viz` rule).
  const builtHere = isBuiltAtPublish(readDeclaration(INSTANCE)?.builtAtPublish ?? [], relative(INSTANCE, OUT).split("\\").join("/"));
  if (check && builtHere) {
    console.log(`✓ ${rel} is built at publish (builtAtPublish), not committed — nothing to compare; \`bun run cat subscriptions:viz\` writes it`);
  } else if (check) {
    const current = existsSync(OUT) ? readFileSync(OUT, "utf-8") : "";
    if (current !== text) {
      console.error(`✗ stale: ${rel}. Run \`bun run cat subscriptions:viz\` and commit the result.`);
      process.exit(1);
    }
    console.log(`✓ ${rel} current: ${substrates.length} known substrate(s), ${cards.length} subscription(s)`);
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, text);
    console.log(`wrote ${rel}: ${substrates.length} known substrate(s), ${cards.length} subscription(s)`);
  }
}
