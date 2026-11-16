/**
 * The data the Harnesses config panel draws: a glass panel grouped as
 * **Instantiated here**, **In this checkout** and **Associated ↗ remote**, a
 * property table per harness, the skills that edit each property, and ✎ to
 * the declaration (wireframes in `docs/wireframes/harness-config/`).
 *
 * It rides `docs/_data/harness.json` as `config`: one generated file, one
 * staleness gate (`docs:harness:check`).
 *
 * ## Associated is never local
 *
 * An `associatedHarnesses` entry naming a harness in THIS checkout is a
 * finding, and `associated-harness-config.test.ts` fails on one in the real
 * tree. The schema refuses the `needs` overlap; this is the half the schema
 * cannot see, because it parses one declaration at a time.
 *
 * ## Subscribed, and not instantiated here
 *
 * A harness a KG subscription reaches is listed under **Subscribed ↗ remote**
 * until it is instantiated, which is when it becomes a tile of its own
 * (`kg:instantiate`, `subscribed-harnesses.ts`). One row per harness the
 * cached snapshot declares at the pin, read offline; a snapshot that cannot be
 * read is still a row, plus a finding, never silence.
 *
 * @module scripts/harness-panel
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { findDeclarationFile, sourceLinks, type CatHarnessDeclaration } from "../schemas/kg/cat-harness.js";
import { instantiatedHarnessNames } from "../schemas/kg/harness-config.js";
import { PROPERTY_SKILLS, type DeclarationProperty } from "../schemas/kg/property-skills.js";
import { readSnapshot } from "./subscribed-harnesses.js";

export interface PanelSkill {
  name: string;
  /** Site-root-relative page, or absent when no page is published for it. */
  path?: string;
}

export interface PanelProperty {
  key: DeclarationProperty;
  skills: PanelSkill[];
  /** Why no skill edits this yet. Shown as a finding, never as a blank. */
  gap?: string;
}

export interface PanelHarness {
  name: string;
  title: string;
  group: "instantiated" | "checkout";
  /** Repository-relative path to the declaration file. */
  declaredIn: string;
  viewHref?: string;
  editHref?: string;
  /** The keys this harness declares, each with a one-line summary of its value. */
  declared: { key: DeclarationProperty; summary: string }[];
}

export interface PanelAssociated {
  name: string;
  title: string;
  url: string;
  repository?: string;
  /** ✎ goes to the associated harness's OWN repository, never this checkout's. */
  editHref?: string;
  relation?: string;
  note?: string;
  /** The local harnesses that declare it. */
  declaredBy: string[];
}

/** A harness a subscription reaches and this checkout has not instantiated (issue #1719). */
export interface PanelSubscribed {
  name: string;
  title: string;
  /** `owner/repo` of the substrate. */
  repository: string;
  /** The pinned commit. */
  ref: string;
  /** The substrate's tree at the pin. */
  url: string;
  /** ✎ goes to the substrate's OWN repository, never this checkout's. */
  editHref: string;
  /** The subscription's id in the declaring layer. */
  subscription: string;
  /** Whether the subscription CHOSE this harness for instantiation (it is still not instantiated here). */
  chosen: boolean;
  note?: string;
  /** The local harnesses whose subscriptions reach it. */
  declaredBy: string[];
}

export interface HarnessPanel {
  properties: PanelProperty[];
  harnesses: PanelHarness[];
  associated: PanelAssociated[];
  subscribed: PanelSubscribed[];
  findings: string[];
}

/** One line a reader can scan: the value itself when short, else what it is. */
export function summarise(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 90 ? `${v.slice(0, 89)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[] (none)";
    if (v.every((x) => typeof x === "string")) return summarise((v as string[]).join(", "));
    const names = v.map((x) => (x && typeof x === "object" ? ((x as Record<string, unknown>).name ?? (x as Record<string, unknown>).id) : undefined));
    return names.every((n) => typeof n === "string")
      ? `${v.length}: ${summarise((names as string[]).join(", "))}`
      : `${v.length} entr${v.length === 1 ? "y" : "ies"}`;
  }
  if (typeof v === "object") return `{ ${Object.keys(v as object).join(", ")} }`;
  return String(v);
}

/**
 * Build the panel.
 *
 * `skillPage(name)` answers whether a skill's page is published; the caller
 * reads the site, so this stays testable against a fixture.
 */
export function harnessPanel(
  entries: readonly { dir: string; decl: CatHarnessDeclaration; instantiated: boolean }[],
  repoRoot: string,
  repoUrl: string | undefined,
  branch: string,
  skillPage: (name: string) => string | undefined,
): HarnessPanel {
  const findings: string[] = [];
  const properties: PanelProperty[] = (Object.keys(PROPERTY_SKILLS) as DeclarationProperty[]).map((key) => {
    const row = PROPERTY_SKILLS[key] as { skills: readonly string[]; gap?: string };
    if (row.gap) findings.push(`\`${key}\`: ${row.gap}`);
    return {
      key,
      skills: row.skills.map((name) => {
        const path = skillPage(name);
        return path ? { name, path } : { name };
      }),
      ...(row.gap ? { gap: row.gap } : {}),
    };
  });

  const local = new Set(entries.map((e) => e.decl.name));
  const harnesses: PanelHarness[] = entries.map(({ dir, decl, instantiated }) => {
    const file = findDeclarationFile(dir);
    const declaredIn = relative(repoRoot, join(dir, file ?? "")).split("\\").join("/");
    const raw = decl as unknown as Record<string, unknown>;
    // A key the declaration carries and the schema DROPS (the declaration is a
    // plain z.object) is invisible to every consumer, so it is a finding here.
    if (file) {
      const onDisk = JSON.parse(readFileSync(join(dir, file), "utf-8")) as Record<string, unknown>;
      for (const k of Object.keys(onDisk)) {
        if (k.startsWith("_") || k.startsWith("@") || k in PROPERTY_SKILLS) continue;
        findings.push(`${decl.name}: declares \`${k}\`, which the declaration schema does not have and silently drops.`);
      }
    }
    return {
      name: decl.name,
      title: decl.title ?? decl.name,
      group: instantiated ? "instantiated" : "checkout",
      declaredIn,
      ...(sourceLinks(repoUrl, declaredIn, branch) ?? {}),
      declared: (Object.keys(PROPERTY_SKILLS) as DeclarationProperty[])
        .filter((k) => raw[k] !== undefined && !(Array.isArray(raw[k]) && (raw[k] as unknown[]).length === 0 && k !== "navbarIcons"))
        .map((key) => ({ key, summary: summarise(raw[key]) })),
    };
  });

  const byName = new Map<string, PanelAssociated>();
  for (const { decl } of entries) {
    for (const a of decl.associatedHarnesses ?? []) {
      if (local.has(a.name)) {
        findings.push(
          `${decl.name}: associates \`${a.name}\`, which is a harness in this checkout. Local is not associated: use \`needs\`, or drop the entry.`,
        );
        continue;
      }
      const prev = byName.get(a.name);
      if (prev) {
        prev.declaredBy.push(decl.name);
        continue;
      }
      byName.set(a.name, {
        name: a.name,
        title: a.title ?? a.name,
        url: a.url,
        ...(a.repository ? { repository: a.repository } : {}),
        ...(a.repository ? { editHref: a.repository } : {}),
        ...(a.relation ? { relation: a.relation } : {}),
        ...(a.note ? { note: a.note } : {}),
        declaredBy: [decl.name],
      });
    }
  }
  const associated = [...byName.values()].sort((x, y) => x.name.localeCompare(y.name));

  // SUBSCRIBED: every harness a subscription's snapshot declares that is
  // neither a local harness nor instantiated here. An unreadable index
  // instantiates nothing for this purpose; `check:landing-instance` fails on it.
  let instantiated: Set<string>;
  try {
    instantiated = new Set(instantiatedHarnessNames(repoRoot));
  } catch {
    instantiated = new Set();
  }
  const subByName = new Map<string, PanelSubscribed>();
  for (const { dir, decl } of entries) {
    for (const s of decl.subscriptions ?? []) {
      if (s.kind === "content") continue; // a content KG declares no harness (owner, 2026-10-06)
      const read = readSnapshot(dir, decl, s);
      let offered: { name: string; title: string }[];
      if (read.state === "read") {
        const summary = read.snapshot.summary;
        offered = summary.harnesses.map((h) => ({ name: h, title: h === summary.name ? (summary.title ?? h) : h }));
      } else {
        findings.push(`${decl.name}: subscription \`${s.id}\` — ${read.reason}; its harnesses are drawn from the subscription alone.`);
        offered = [{ name: s.id, title: s.id }];
      }
      for (const h of offered) {
        if (local.has(h.name) || instantiated.has(h.name)) continue;
        const prev = subByName.get(h.name);
        if (prev) {
          if (!prev.declaredBy.includes(decl.name)) prev.declaredBy.push(decl.name);
          continue;
        }
        subByName.set(h.name, {
          name: h.name,
          title: h.title,
          repository: s.repository,
          ref: s.ref,
          url: `https://github.com/${s.repository}/tree/${s.ref}`,
          editHref: `https://github.com/${s.repository}`,
          subscription: s.id,
          chosen: (s.harnesses ?? []).includes(h.name),
          ...(s.note ? { note: s.note } : {}),
          declaredBy: [decl.name],
        });
      }
    }
  }
  const subscribed = [...subByName.values()].sort((x, y) => x.name.localeCompare(y.name));
  return { properties, harnesses, associated, subscribed, findings };
}

/** The published page of a skill, when `reference/skill-instructions/<name>.md` exists in the site. */
export function skillPageIn(siteDir: string): (name: string) => string | undefined {
  return (name) =>
    existsSync(join(siteDir, "reference/skill-instructions", `${name}.md`))
      ? `/reference/skill-instructions/${name}.html`
      : undefined;
}
