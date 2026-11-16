/**
 * Site language. Source order: ?lang=<code> in the URL (then remembered), else the /<locale>/ of the
 * site page that opened the game (then remembered; see fromReferrer), else the remembered choice in
 * localStorage, else the browser's first supported language, else English. Changing it stores the
 * choice and reloads the page, because the scenario text is filled in once at start-up.
 *
 * The six UN languages, as web-app.json `locales` lists them. English is the source; the others are
 * translated through smart-trust's translation process (translations/<locale>/apps/onboarding-game.po).
 */
export const LOCALES = ['en', 'ar', 'es', 'fr', 'ru', 'zh'] as const;
export type Lang = (typeof LOCALES)[number];

/** Each language's name in itself, for the switcher. */
export const NATIVE: Record<Lang, string> = { en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', ru: 'Русский', zh: '中文' };
/** Short label for the switcher button. */
export const SHORT: Record<Lang, string> = { en: 'EN', ar: 'ع', es: 'ES', fr: 'FR', ru: 'RU', zh: '中' };

const KEY = 'gdhcn-lang';

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LOCALES as readonly string[]).includes(v);

const REF_KEY = 'gdhcn-lang-referrer';

/**
 * The language of the site page that opened the game, once per arrival. smart-trust's translated
 * pages live under /<locale>/ and link to the one English route of the game with no ?lang, so a
 * reader coming from /fr/home.html should land in French whatever their browser says. Same-origin
 * only. A reload keeps document.referrer, so the referrer is applied once per tab (sessionStorage):
 * a switch made in the game after arriving is not undone by the next reload. Without
 * sessionStorage it is not applied at all, rather than applied on every reload.
 */
function fromReferrer(): Lang | null {
  try {
    const r = document.referrer;
    if (!r) return null;
    const u = new URL(r);
    if (u.origin !== location.origin || u.pathname === location.pathname) return null;
    if (sessionStorage.getItem(REF_KEY) === r) return null;
    sessionStorage.setItem(REF_KEY, r);
    const seg = u.pathname.split('/').find((s) => isLang(s));
    return isLang(seg) ? seg : null;
  } catch { return null; /* no document, bad URL or blocked storage */ }
}

function detect(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLang(q)) {
      try { localStorage.setItem(KEY, q); } catch { /* private window: the URL still wins for this load */ }
      return q;
    }
  } catch { /* no location (build tooling) */ }
  const page = fromReferrer();
  if (page) {
    try { localStorage.setItem(KEY, page); } catch { /* blocked storage: it still wins for this load */ }
    return page;
  }
  try {
    const s = localStorage.getItem(KEY);
    if (isLang(s)) return s;
  } catch { /* blocked storage */ }
  try {
    for (const l of navigator.languages ?? []) { const b = l.slice(0, 2).toLowerCase(); if (isLang(b)) return b; }
  } catch { /* no navigator */ }
  return 'en';
}

let current: Lang = detect();

export const lang = (): Lang => current;

/** Writing direction: Arabic is right to left. */
export const dir = (l: Lang = current): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');

/** Set <html lang> and <html dir> for the current language. Called once at start-up. */
export function applyHtmlLang() {
  document.documentElement.lang = current;
  document.documentElement.dir = dir();
}

/** Store the choice, drop ?lang from the URL so it cannot override it, and reload. */
export function setLang(next: Lang) {
  try { localStorage.setItem(KEY, next); } catch { /* private window: carry it in the URL instead */
    const url = new URL(location.href); url.searchParams.set('lang', next); location.replace(url.toString()); return;
  }
  try { sessionStorage.removeItem('uc-lang'); } catch { /* ignore */ }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) { url.searchParams.delete('lang'); history.replaceState(null, '', url.toString()); }
  location.reload();
}
