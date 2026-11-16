/**
 * Translated labels for an IG's top bar (fhir-harness#417).
 *
 * The bar is built once from the IG's menu (`igTopBar`), so on a page in
 * French it read "Home", "Business Requirements" and "Deployment" above a
 * French page (owner, 2026-11-13). This module gives the menu what the pages
 * already have:
 *
 * - **a catalogue per locale**, `translations/<locale>/menu/menu.po`, made
 *   from the template `menu/menu.pot` this module writes from the menu's
 *   labels and the IG's title (`pot` below; `--check` fails on a stale one);
 * - **a localised menu** per locale: a label with no entry stays in the
 *   source language, and a link points at the locale's copy of a page when
 *   that page is translated into it;
 * - **a review verdict**, read from the catalogue's translation node
 *   `translations/<locale>/menu/menu.json` exactly as a page's is
 *   (`catalogueReview`): no record that a person reviewed it, a record naming
 *   nobody, or one signed against an earlier menu, is NOT reviewed. A locale
 *   whose menu has translated labels nobody reviewed makes every page in that
 *   locale "not reviewed", since those labels are on every page.
 *
 * The node's `sourceHash` is a prefix of the sha-256 of {@link menuSource},
 * the labels one per line: the menu has no file of its own to hash.
 *
 * Usage:
 *   bun fhir-harness/scripts/ig-menu-translations.ts pot <ig-root> [--check]
 *
 * @module scripts/ig-menu-translations
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parsePo } from "../../cat-harness-tools/pipeline/po-inject.ts";
import { catalogueReview, SOURCE_LOCALE } from "./ig-page-translations.ts";

/** The menu's catalogue, relative to `translations/<locale>/`, without extension. */
export const MENU_CATALOGUE = "menu/menu";

/** The shape of a menu this module reads: `IgMenu`'s groups. */
export interface MenuLike {
  groups: Array<{ label: string; href?: string; items?: Array<{ label: string; href: string }> }>;
}

/** Every label the bar shows, in order, each once: the title first, then each group and its items. */
export function menuLabels(menu: MenuLike, title?: string): string[] {
  const out: string[] = [];
  const add = (s: string | undefined) => {
    if (s && s.trim() && !out.includes(s)) out.push(s);
  };
  add(title);
  for (const g of menu.groups) {
    add(g.label);
    for (const it of g.items ?? []) add(it.label);
  }
  return out;
}

/** The text a menu sign-off is made against: the labels, one per line. */
export function menuSource(labels: readonly string[]): string {
  return labels.join("\n") + "\n";
}

const poString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

/** The menu's gettext template: one entry per label, with no translation. */
export function menuPot(labels: readonly string[]): string {
  const head = ['msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '"X-Source: sushi-config.yaml menu\\n"'].join("\n");
  return [head, ...labels.map((l) => `#: sushi-config.yaml:menu\nmsgid ${poString(l)}\nmsgstr ""`)].join("\n\n") + "\n";
}

/** One locale's menu catalogue and whether a person reviewed it. */
export interface MenuLocale {
  locale: string;
  /** Source label to its translation; only labels with a translation. */
  labels: Map<string, string>;
  /** True only on a record that a person reviewed this menu as it is now. */
  reviewed: boolean;
  why: string;
}

/**
 * Every locale under `translationsDir` whose menu catalogue translates at
 * least one of `labels`. A catalogue that translates none is left out, so a
 * locale never claims a menu it has no words in.
 */
export function menuLocales(translationsDir: string | undefined, labels: readonly string[]): Map<string, MenuLocale> {
  const out = new Map<string, MenuLocale>();
  if (!translationsDir || !existsSync(translationsDir)) return out;
  for (const locale of readdirSync(translationsDir).sort()) {
    if (locale === SOURCE_LOCALE || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale)) continue;
    const dir = join(translationsDir, locale);
    const po = join(dir, `${MENU_CATALOGUE}.po`);
    if (!statSync(dir).isDirectory() || !existsSync(po)) continue;
    const parsed = parsePo(readFileSync(po, "utf-8"));
    const mine = new Map<string, string>();
    for (const l of labels) {
      const t = parsed.get(l);
      if (t && t.trim()) mine.set(l, t);
    }
    if (!mine.size) continue;
    const r = catalogueReview(dir, MENU_CATALOGUE, menuSource(labels));
    out.set(locale, { locale, labels: mine, reviewed: r.reviewed, why: r.why });
  }
  return out;
}

/**
 * The menu in one locale: each label translated where the catalogue has it,
 * and each link to a page translated into the locale (`translatedHtml`, the
 * `.html` names) pointed at the locale's copy. Everything else as given.
 */
export function localiseMenu<M extends MenuLike>(menu: M, l: Pick<MenuLocale, "locale" | "labels">, translatedHtml: ReadonlySet<string>): M {
  const label = (s: string) => l.labels.get(s) ?? s;
  const href = (h: string) => (translatedHtml.has(h) ? `${l.locale}/${h}` : h);
  return {
    ...menu,
    groups: menu.groups.map((g) => ({
      ...g,
      label: label(g.label),
      ...(g.href !== undefined ? { href: href(g.href) } : {}),
      ...(g.items ? { items: g.items.map((it) => ({ ...it, label: label(it.label), href: href(it.href) })) } : {}),
    })),
  };
}

/** The IG's menu and title, read from its `sushi-config.yaml`. */
export function sushiMenu(igRoot: string, groups: (menu: unknown) => MenuLike["groups"]): { menu: MenuLike; title?: string } {
  const raw = parseYaml(readFileSync(join(igRoot, "sushi-config.yaml"), "utf-8")) as Record<string, unknown>;
  return { menu: { groups: groups(raw.menu) }, title: typeof raw.title === "string" ? raw.title : undefined };
}

/**
 * Write `menu/menu.pot` into every locale directory under
 * `<igRoot>/translations`, or with `check` report the ones that are stale.
 * Returns the paths written (or stale).
 */
export function writeMenuPots(igRoot: string, labels: readonly string[], check = false): string[] {
  const tr = join(igRoot, "translations");
  if (!existsSync(tr)) return [];
  const pot = menuPot(labels);
  const out: string[] = [];
  for (const locale of readdirSync(tr).sort()) {
    const dir = join(tr, locale);
    if (locale === SOURCE_LOCALE || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(locale) || !statSync(dir).isDirectory()) continue;
    const p = join(dir, `${MENU_CATALOGUE}.pot`);
    if (existsSync(p) && readFileSync(p, "utf-8") === pot) continue;
    out.push(p);
    if (!check) {
      mkdirSync(join(dir, "menu"), { recursive: true });
      writeFileSync(p, pot);
    }
  }
  return out;
}

if (import.meta.main) {
  const [cmd, root, ...rest] = process.argv.slice(2);
  if (cmd !== "pot" || !root) {
    console.error("usage: ig-menu-translations.ts pot <ig-root> [--check]");
    process.exit(2);
  }
  const { groupsFromSushiMenu } = await import("./ingest-ig-menu.ts");
  const { menu, title } = sushiMenu(root, groupsFromSushiMenu);
  const check = rest.includes("--check");
  const paths = writeMenuPots(root, menuLabels(menu, title), check);
  if (check && paths.length) {
    console.error(`menu templates stale (${paths.length}); run: bun fhir-harness/scripts/ig-menu-translations.ts pot ${root}`);
    for (const p of paths) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(check ? "menu templates current" : `wrote ${paths.length} menu template(s)`);
}
