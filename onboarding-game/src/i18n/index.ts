import { lang } from './lang';
import { en } from './en';
import { translated } from './strings';
import { deName, typo } from './typography';

export { lang, setLang, applyHtmlLang, dir, LOCALES, NATIVE, SHORT, isLang, type Lang } from './lang';
export { typo } from './typography';

/**
 * UI strings. Keys are `<file>:<identifier>`, for example `ui.ts:title.lede` or `Demo.ts:beat3.body`.
 * English lives in en.ts and is the source of truth; scripts/catalog.mjs gathers it into en.json, the
 * catalog smart-trust's translation process works from. Other languages come from strings.ts.
 * A key with no translation falls back to English.
 *
 * Placeholders: `{name}` is replaced from `vars`; `{n:one|other}` picks by whether vars.n is 1.
 */
const warned = new Set<string>();

function pick(key: string): string {
  if (lang() !== 'en') {
    const v = translated(key);
    if (v !== undefined) return v;
    if (import.meta.env?.DEV && !warned.has(key)) { warned.add(key); console.info(`[i18n] no ${lang()} for ${key}`); }
  }
  const e = en[key];
  if (e === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) { warned.add(key); console.warn(`[i18n] unknown key ${key}`); }
    return key;
  }
  return e;
}

export function fmt(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl;
  const withElision = lang() === 'fr'
    ? tpl.replace(/\b(de|De) \{(\w+)\}/g, (m, d: string, k: string) => (k in vars ? deName(d, String(vars[k])) : m))
    : tpl;
  return withElision.replace(/\{(\w+)(?::([^|}]*)\|([^}]*))?\}/g, (m, k: string, one?: string, other?: string) => {
    if (!(k in vars)) return m;
    if (one !== undefined) return Number(vars[k]) === 1 ? one : other ?? '';
    return String(vars[k]);
  });
}

/** Translate a UI string. French gets its typography (non-breaking spaces) applied. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return typo(fmt(pick(key), vars));
}

/** The English text for a key, for values sent to a spreadsheet or compared in code. */
export const tEn = (key: string): string => en[key] ?? key;

/** Number with the locale's decimal mark. Arabic keeps Latin digits, as WHO's Arabic documents do. */
export const num = (n: number, digits = 1): string =>
  n.toLocaleString(lang() === 'ar' ? 'ar-u-nu-latn' : lang(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
