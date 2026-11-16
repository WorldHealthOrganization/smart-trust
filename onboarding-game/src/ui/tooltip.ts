import { GLOSSARY } from '../game/glossary';

/**
 * One shared popover for every glossary term. Any element with data-tip="key" works:
 * hover or keyboard focus on desktop, tap on touch (tap elsewhere closes).
 */
export function mountTooltips() {
  const pop = document.createElement('div');
  pop.id = 'tip-pop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  document.body.appendChild(pop);

  let current: HTMLElement | null = null;
  const find = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.<HTMLElement>('[data-tip]') ?? null;

  const hide = () => {
    pop.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  };

  const show = (el: HTMLElement) => {
    const g = GLOSSARY[el.dataset.tip ?? ''];
    if (!g) return;
    current?.removeAttribute('aria-describedby');
    current = el;
    pop.id = 'tip-pop';
    pop.innerHTML = `<b></b><span></span>`;
    pop.querySelector('b')!.textContent = g.term;
    pop.querySelector('span')!.textContent = g.def;
    el.setAttribute('aria-describedby', 'tip-pop');
    pop.hidden = false;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, m = 10;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(m, Math.min(x, innerWidth - w - m));
    let y = r.bottom + 8;
    if (y + h > innerHeight - m) y = Math.max(m, r.top - h - 8);
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
  };

  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = find(e.target);
    if (el) show(el);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse') return;
    if (find(e.target) && !find(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', e => { const el = find(e.target); if (el) show(el); });
  document.addEventListener('focusout', e => { if (find(e.target)) hide(); });
  // touch: tap a term to open, tap anywhere else to close
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const el = find(e.target);
    if (el && el !== current) show(el);
    else hide();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  addEventListener('resize', hide);
  document.addEventListener('scroll', hide, true);
}
