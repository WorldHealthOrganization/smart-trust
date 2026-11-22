/**
 * The UML colours, read from `docs/assets/css/uml.css` — the one place they
 * are declared.
 *
 * The Mermaid pages take their colours from that stylesheet through a CSS
 * class per graph typology. PlantUML cannot: its SVG carries no class hooks,
 * and under ELK it drops a package's background colour too (a class's colour
 * survives). So the `.puml` files write a colour onto each class, and this
 * module is how they get the SAME colour the page would show, rather than a
 * second palette free to drift from the first.
 *
 * @module scripts/uml-palette
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readDeclaration, siteFileFor } from "../schemas/kg/cat-harness.js";

export interface UmlPalette {
  /** `schema` | `scenario` | `process` | `state` | `test` → hex. */
  family: Record<string, string>;
  /** Graph typology → hex, falling back to the neutral tint for an unplaced kind. */
  kind(kind: string): string;
  /** Formalization status (and `reviewed_human` / `reviewed_agentic`) → hex. */
  status: Record<string, string>;
}

/** Parse `uml.css`: the `--fa-uml-*` tokens, and which kinds each family rule names. */
export function readUmlPalette(harnessRoot: string): UmlPalette {
  const decl = readDeclaration(harnessRoot);
  if (!decl) throw new Error(`${harnessRoot} declares no instance`);
  const css = readFileSync(join(harnessRoot, siteFileFor(harnessRoot, "assets/css/uml.css")), "utf8");

  const family: Record<string, string> = {};
  for (const m of css.matchAll(/--fa-uml-([a-z]+):\s*(#[0-9a-fA-F]{3,8})/g)) family[m[1]!] = m[2]!;

  const byKind = new Map<string, string>();
  for (const rule of css.matchAll(/([^{}]+)\{\s*fill:\s*var\(--fa-uml-([a-z]+)\)/g)) {
    const hex = family[rule[2]!];
    if (!hex) continue;
    for (const k of rule[1]!.matchAll(/g\.fa_uml_kind_([a-z0-9_]+)/g)) byKind.set(k[1]!, hex);
  }
  const status: Record<string, string> = {};
  for (const m of css.matchAll(/--fa-uml-status-([a-z_]+):\s*(#[0-9a-fA-F]{3,8})/g)) status[m[1]!] = m[2]!;

  const other = family.other ?? "#F4F4F1";
  return {
    family,
    status,
    kind: (kind) => byKind.get(kind.replace(/[^A-Za-z0-9_]/g, "_")) ?? other,
  };
}
