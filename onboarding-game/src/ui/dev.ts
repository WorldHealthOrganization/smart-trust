/**
 * Dev mode: a hidden reviewer's tool. It only appears in Settings once the game has been
 * opened with #dev in the URL (remembered in this browser). When on, the progress-strip
 * stops become jump points, a "jump to end" button appears, and wrong choices get a preview.
 */
const UNLOCK_KEY = 'gdhcn-dev-unlocked';
const ON_KEY = 'gdhcn-dev-on';

const get = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const set = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* not fatal */ } };

if (/(^|[#&])dev\b/.test(location.hash)) { set(UNLOCK_KEY, true); set(ON_KEY, true); }

export const devUnlocked = () => get(UNLOCK_KEY);
export const devOn = () => devUnlocked() && get(ON_KEY);
export const setDevOn = (v: boolean) => set(ON_KEY, v);

/** Reload straight into a moment (by index) or the end. */
export function jumpTo(target: number | 'end') {
  location.hash = target === 'end' ? 'end' : `m=${target}`;
  location.reload();
}
