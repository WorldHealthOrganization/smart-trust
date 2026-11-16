import type { PlaceId, World } from '../world/World';
import { MOMENTS } from '../game/scenario';
import { fill } from '../game/settings';
import { renderTips } from '../game/glossary';
import { t } from '../i18n';
import { refsChips } from '../game/refs';

const X = (k: string) => t(`explore.ts:${k}`);

/** What lives at each place: keys, documents, people. Shown on the explore info card. */
const HOLDS_IDS: PlaceId[] = ['ministry', 'backend', 'github', 'uat', 'prod', 'secretariat', 'ops', 'dashboard'];
const HOLDS = Object.fromEntries(HOLDS_IDS.map(id => [id, t(`explore.ts:HOLDS.${id}`)])) as Record<PlaceId, string>;

const ORDER: PlaceId[] = ['ministry', 'backend', 'github', 'uat', 'prod', 'secretariat', 'ops', 'dashboard'];

/**
 * Explore the world before playing: free orbit, pan and zoom, clickable places with
 * info cards, place chips, reset view. Resolves with what the player chose next.
 */
export function explore(world: World, root: HTMLElement): Promise<'start' | 'back'> {
  const el = document.createElement('div');
  el.id = 'explore';
  el.innerHTML = `
    <div class="ex-hint glass">
      <b>${X('hint.title')}</b>
      <div class="ex-keys">
        <span class="k">${X('hint.rotate')}</span><span>${X('hint.rotateHow')}</span>
        <span class="k">${X('hint.move')}</span><span>${X('hint.moveHow')}</span>
        <span class="k">${X('hint.zoom')}</span><span>${X('hint.zoomHow')}</span>
      </div>
      <span>${X('hint.click')}</span>
      <button class="ex-hint-x" aria-label="${X('hint.closeAria')}">✕</button>
    </div>
    <div class="ex-card glass" hidden></div>
    <div class="ex-bar">
      <button class="nav-btn" data-a="back">${X('bar.back')}</button>
      <div class="ex-chips">${ORDER.map(id => `<button class="ex-chip" data-p="${id}">${world.places[id].name}</button>`).join('')}</div>
      <button class="nav-btn" data-a="reset" title="${X('bar.resetTitle')}">${X('bar.reset')}</button>
      <button class="primary" data-a="start">${X('bar.start')}</button>
    </div>`;
  root.appendChild(el);

  const card = el.querySelector<HTMLElement>('.ex-card')!;
  const hint = el.querySelector<HTMLElement>('.ex-hint')!;
  const hideHint = () => hint.classList.add('gone');
  const hintTimer = setTimeout(hideHint, 9000);

  const show = (id: PlaceId) => {
    clearTimeout(hintTimer); hideHint();
    const p = world.places[id];
    const here = MOMENTS.filter(m => m.place === id);
    card.innerHTML = `<button class="ex-x" aria-label="${X('card.closeAria')}">✕</button>
      <div class="eyebrow">${p.name}</div>
      <p>${fill(p.blurb)}</p>
      <h4>${X('card.holds')}</h4><p>${renderTips(HOLDS[id])}</p>
      ${here.length ? `<h4>${X('card.here')}</h4><ul>${here.map(m => `<li>${m.title} ${refsChips(m.steps)}</li>`).join('')}</ul>` : ''}`;
    card.hidden = false;
    el.querySelectorAll('.ex-chip').forEach(c => c.classList.toggle('on', (c as HTMLElement).dataset.p === id));
    world.mark(id);
    world.flyTo(id, { dur: 1.1 });
  };

  const prevPlaceClick = world.onPlaceClick;
  world.onPlaceClick = id => show(id);
  world.mark(null);
  world.flyTo('home', { dur: 1 });

  return new Promise(done => {
    const finish = (r: 'start' | 'back') => {
      clearTimeout(hintTimer);
      world.onPlaceClick = prevPlaceClick;
      world.mark(null);
      el.remove();
      done(r);
    };
    el.addEventListener('click', e => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!t) return;
      if (t.dataset.p) return show(t.dataset.p as PlaceId);
      if (t.classList.contains('ex-x')) { card.hidden = true; world.mark(null); el.querySelectorAll('.ex-chip.on').forEach(c => c.classList.remove('on')); return; }
      if (t.classList.contains('ex-hint-x')) return hideHint();
      switch (t.dataset.a) {
        case 'reset': card.hidden = true; world.mark(null); world.flyTo('home', { dur: 1 }); return;
        case 'start': return finish('start');
        case 'back': return finish('back');
      }
    });
  });
}
