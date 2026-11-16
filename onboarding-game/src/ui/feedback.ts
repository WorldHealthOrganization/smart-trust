import { settings } from '../game/settings';
import { t, tEn } from '../i18n';

const F = (k: string, v?: Record<string, string | number>) => t(`feedback.ts:${k}`, v);

/**
 * Reviewer feedback: a 💬 button on every screen that sends a comment, plus where the
 * reviewer was, to the Google Sheet via an Apps Script web app (apps-script/feedback.gs).
 * The endpoint comes from VITE_FEEDBACK_URL at build time.
 */

export interface FeedbackContext {
  mode: 'title' | 'game' | 'demo' | 'debrief';
  where?: string;   // human label, e.g. "Game · B · Create GPG keys"
  phase?: string;
  moment?: string;  // moment id + title, or demo beat
  steps?: string;
  days?: number;
  detours?: number;
}

const URL_ = (import.meta.env.VITE_FEEDBACK_URL as string | undefined) ?? '';
const WHO_KEY = 'gdhcn-feedback-who';
let ctx: FeedbackContext = { mode: 'title', where: F('ctx.titleScreen') };

export function setFeedbackContext(c: FeedbackContext) { ctx = c; }

// the value sent to the review sheet stays English whatever the display language
const TYPES = [1, 2, 3, 4, 5].map(n => ({ value: tEn(`feedback.ts:TYPES.${n}`), label: F(`TYPES.${n}`) }));

export function mountFeedback(root: HTMLElement) {
  const btn = document.createElement('button');
  btn.id = 'fb-btn';
  btn.className = 'glass';
  btn.title = F('button.title');
  btn.innerHTML = `💬 <span>${F('button.label').replace(/^💬\s*/u, '')}</span>`;
  root.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'fb-panel';
  panel.className = 'glass';
  panel.innerHTML = `
    <div class="fb-head"><b>${F('panel.head')}</b><button class="fb-x" aria-label="${F('panel.closeAria')}">✕</button></div>
    <div class="fb-where"></div>
    <label>${F('kind.label')}<select name="type">${TYPES.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select></label>
    <label>${F('comment.label')}<textarea name="comment" rows="5" maxlength="4000" placeholder="${F('comment.placeholder')}"></textarea></label>
    <div class="fb-row">
      <label>${F('name.label')}<input name="name" maxlength="200" autocomplete="name"></label>
      <label>${F('org.label')}<input name="org" maxlength="200" autocomplete="organization"></label>
    </div>
    <label>${F('email.label')}<input name="email" type="email" maxlength="200" autocomplete="email"></label>
    <input name="website" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="fb-actions"><button class="primary fb-send">${F('send')}</button><span class="fb-status"></span></div>
    <p class="fb-fine">${F('fine')}</p>`;
  root.appendChild(panel);

  const $ = <T extends HTMLElement>(q: string) => panel.querySelector(q) as T;
  const field = (n: string) => panel.querySelector(`[name="${n}"]`) as HTMLInputElement;
  const status = $('.fb-status');

  // remember who the reviewer is between comments (this browser only)
  try {
    const who = JSON.parse(localStorage.getItem(WHO_KEY) ?? '{}') as Record<string, string>;
    for (const k of ['name', 'org', 'email']) if (who[k]) field(k).value = who[k];
  } catch { /* fine */ }

  const open = () => {
    $('.fb-where').textContent = `${F('panel.where', { where: ctx.where ?? ctx.mode })}${ctx.steps ? ` ${F('panel.whereSteps', { steps: ctx.steps })}` : ''}`;
    status.textContent = URL_ ? '' : F('status.notConnected');
    $<HTMLButtonElement>('.fb-send').disabled = !URL_;
    panel.classList.add('open');
    field('comment').focus();
  };
  const close = () => panel.classList.remove('open');
  btn.addEventListener('click', () => (panel.classList.contains('open') ? close() : open()));
  $('.fb-x').addEventListener('click', close);

  $('.fb-send').addEventListener('click', async () => {
    const comment = field('comment').value.trim();
    if (!comment) { status.textContent = F('status.empty'); field('comment').focus(); return; }
    const payload = {
      type: (panel.querySelector('select') as HTMLSelectElement).value,
      comment,
      name: field('name').value, org: field('org').value, email: field('email').value,
      website: field('website').value,
      where: ctx.where ?? '', phase: ctx.phase ?? '', moment: ctx.moment ?? '', steps: ctx.steps ?? '',
      mode: ctx.mode, country: `${settings().country} (${settings().code})`,
      days: ctx.days ?? '', detours: ctx.detours ?? '',
      page: location.href, browser: navigator.userAgent,
    };
    try { localStorage.setItem(WHO_KEY, JSON.stringify({ name: payload.name, org: payload.org, email: payload.email })); } catch { /* fine */ }
    const send = $<HTMLButtonElement>('.fb-send');
    send.disabled = true;
    status.textContent = F('status.sending');
    try {
      // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer
      const res = await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
      const out = await res.json().catch(() => ({ ok: res.ok }));
      if (!out.ok) throw new Error(out.error ?? 'not saved');
      field('comment').value = '';
      status.textContent = F('status.saved');
      setTimeout(close, 1600);
    } catch {
      status.textContent = F('status.failed');
    } finally {
      send.disabled = false;
    }
  });
}
