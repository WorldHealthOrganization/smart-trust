/**
 * Easter eggs: the cat. A small line-drawn cat that appears on some set-back panels
 * (sadder the more detours a run has taken), wears a crown on a perfect run, and
 * hides three times in the 3D world. Nothing here covers learning content.
 */
import { t } from '../i18n';

export type CatMood = 'meh' | 'sad' | 'gloomy' | 'crown';

export const catMood = (detours: number): CatMood => (detours >= 5 ? 'gloomy' : detours >= 2 ? 'sad' : 'meh');

/** The cat shows on every set-back. */
export const catShows = () => true;

const SETBACK_LINES = [1, 2, 3, 4, 5, 6].map(n => t(`cat.ts:SETBACK_LINES.${n}`));

export const catLine = () => SETBACK_LINES[Math.floor(Math.random() * SETBACK_LINES.length)];

/** Inline SVG cat, drawn in the game's ink colour. */
export function catSvg(mood: CatMood): string {
  const ink = '#2f3466';
  const ears = mood === 'meh' || mood === 'crown'
    ? 'M18 22 L22 8 L30 18 M42 18 L50 8 L54 22'
    : mood === 'sad'
      ? 'M17 24 L15 12 L28 19 M44 19 L57 12 L55 24'
      : 'M18 27 L5 29 L22 19 M50 19 L67 29 L54 27';
  const eyes = mood === 'crown'
    ? 'M27 31 q3 -4 6 0 M39 31 q3 -4 6 0'
    : mood === 'meh'
      ? 'M27 31 h6 M39 31 h6'
      : 'M27 30 q3 4 6 0 M39 30 q3 4 6 0';
  const mouth = mood === 'crown' ? 'M33 37 q3 3 6 0' : 'M33 39 q3 -3 6 0';
  const cloud = mood === 'gloomy'
    ? `<g class="cat-cloud"><path d="M22 2 a6 6 0 0 1 11 -2 a7 7 0 0 1 13 2 a5 5 0 0 1 0 10 h-24 a5 5 0 0 1 0 -10z" fill="#c9cde6"/>
       <path d="M27 14 l-1.5 3.5 M35 14 l-1.5 3.5 M43 14 l-1.5 3.5" stroke="#6f9cf0" stroke-width="2" stroke-linecap="round"/></g>`
    : '';
  const crown = mood === 'crown'
    ? '<path d="M25 9 l4 -8 l7 6 l7 -6 l4 8 z" fill="#f2b64a" stroke="#c98a12" stroke-width="1.5" stroke-linejoin="round"/>'
    : '';
  const tear = mood === 'gloomy' ? '<path d="M45 34 q2 4 0 6 q-2 -2 0 -6z" fill="#6f9cf0"/>' : '';
  const tail = mood === 'crown' ? 'M58 56 q14 -6 8 -20' : 'M58 58 q12 2 10 -8';
  return `<svg viewBox="0 0 72 64" width="72" height="64" aria-hidden="true" class="cat cat-${mood}">
    ${cloud}${crown}
    <path d="M14 64 q-2 -26 22 -26 q24 0 22 26" fill="#fff" stroke="${ink}" stroke-width="2.4"/>
    <path d="${tail}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M18 22 q-4 20 18 22 q22 -2 18 -22 q-4 -6 -18 -6 q-14 0 -18 6z" fill="#fff" stroke="${ink}" stroke-width="2.4"/>
    <path d="${ears}" fill="#fff" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="${eyes}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <path d="${mouth}" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M24 35 h-8 M24 38 l-7 2 M48 35 h8 M48 38 l7 2" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/>
    ${tear}
  </svg>`;
}

/** A soft "mrrp", synthesised so there is no audio file. Only ever on a click. */
export function mrrp() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctx();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    const t = ac.currentTime;
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + 0.28);
    setTimeout(() => ac.close(), 500);
  } catch { /* no audio, no problem */ }
}

// ---------- the three hidden cats in the world ----------

const FOUND_KEY = 'gdhcn-cats-found';
export const WORLD_CATS: Record<string, string> = {
  country: t('cat.ts:WORLD_CATS.country'),
  gateway: t('cat.ts:WORLD_CATS.gateway'),
  who: t('cat.ts:WORLD_CATS.who'),
};

export function catsFound(): string[] {
  try { return JSON.parse(localStorage.getItem(FOUND_KEY) ?? '[]') as string[]; } catch { return []; }
}

/** Record a found cat; returns how many of the three are now found. */
export function findCat(id: string): number {
  const found = new Set(catsFound());
  found.add(id);
  try { localStorage.setItem(FOUND_KEY, JSON.stringify([...found])); } catch { /* not fatal */ }
  return found.size;
}
