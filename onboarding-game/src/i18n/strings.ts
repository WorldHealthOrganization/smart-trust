import { lang } from './lang';

/**
 * The current language's translated strings, keyed as in src/i18n/en.json (the catalog):
 * `<file>:<id>`, `scenario:<path>`, `glossary:<term>.<field>`. Loaded once at start-up from
 * public/i18n/<locale>.json, which is built from smart-trust's translations/<locale>/apps/onboarding-game.po
 * (scripts/strings.mjs locally, the harness's web-apps:build at publish). A key with no translation
 * falls back to English, per string. English needs no file.
 */
let loaded: Record<string, string> = {};

export async function loadStrings(): Promise<void> {
  if (lang() === 'en') return;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}i18n/${lang()}.json`);
    if (r.ok) loaded = await r.json();
  } catch { /* offline or missing: English throughout */ }
}

/** The translation for a key, or undefined. */
export const translated = (key: string): string | undefined => loaded[key];

/** Every translated key with a prefix, without the prefix. */
export function translatedUnder(prefix: string): [string, string][] {
  return Object.entries(loaded).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]);
}
