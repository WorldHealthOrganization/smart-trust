import { MOMENTS, PHASES, ROLES } from '../game/scenario';
import type { ChecklistItem, Consequence, Doc, Moment, Phase } from '../game/types';
import { DEFAULTS, deriveCode, joinList, settings, type Person, type Settings } from '../game/settings';
import { devOn, devUnlocked, jumpTo, setDevOn } from './dev';
import { catLine, catMood, catShows, catsFound, catSvg, mrrp } from './cat';
import { USE_CASES } from '../usecases/data';
import { renderTips as T, stripTips } from '../game/glossary';
import { isLang, lang, LOCALES, NATIVE, num, SHORT, setLang, t } from '../i18n';
import { refsChips } from '../game/refs';

/** "⌂ Home" -> glyph, then the word in a span (the span is hidden on phones). */
const glyphLabel = (s: string) => { const [g, ...w] = s.split(' '); return w.length ? `${g} <span>${w.join(' ')}</span>` : `<span>${s}</span>`; };

const U = (k: string, v?: Record<string, string | number>) => t(`ui.ts:${k}`, v);

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

export interface Detour { index: number; title: string; steps: string[]; why: string; days: number; origin?: string }
/** What a failed checklist submit tells the retry: the ticks to keep and the items to flag. */
export interface ChecklistMarks { picked: number[]; wrong: number[]; missing: number[]; noDomains: boolean }

export interface DebriefData { days: number; ideal: number; detours: Detour[] }

const PHASE_ORDER: Phase[] = ['A', 'B', 'C', 'D', 'E'];

export class UI {
  private hudEl: HTMLElement;
  private statsEl: HTMLElement;
  private stripEl: HTMLElement;
  private routeEl: HTMLElement;
  private deskEl: HTMLElement;
  private toastEl: HTMLElement;
  private menuEl: HTMLElement;
  private detourCount = 0;

  constructor(private root: HTMLElement) {
    this.hudEl = this.mount('<div id="hud" class="glass hidden"></div>');
    this.statsEl = this.mount(`<div id="stats" class="glass hidden">
      <div class="stat"><span class="stat-n" id="days">0</span><span class="stat-l">${U('stats.days')}</span></div>
      <div class="stat"><span class="stat-n bad" id="detours">0</span><span class="stat-l">${U('stats.detours')}</span></div>
      <button id="reset-view" title="${U('stats.resetView')}">⟲</button></div>`);
    this.statsEl.querySelector('#reset-view')!.addEventListener('click', () => dispatchEvent(new CustomEvent('reset-view')));
    // progress strip: Home on the left, the subway route, Restart on the right
    this.stripEl = this.mount(`<div id="strip" class="glass hidden">
      <button class="strip-btn" data-leave="home" title="${U('strip.homeTitle')}">${glyphLabel(U('strip.home'))}</button>
      <div class="strip-route"></div>
      <button class="strip-btn" data-leave="restart" title="${U('strip.restartTitle')}">${glyphLabel(U('strip.restart'))}</button></div>`);
    this.routeEl = this.stripEl.querySelector('.strip-route')!;
    this.stripEl.querySelectorAll<HTMLElement>('[data-leave]').forEach(b =>
      b.addEventListener('click', async () => {
        const where = b.dataset.leave as 'restart' | 'home';
        if (await this.confirmLeave(where)) go(where);
      }));
    this.deskEl = this.mount('<div id="desk" class="glass"></div>');
    this.toastEl = this.mount('<div id="toast" class="glass"></div>');
    // top bar: brand on the left, menu items on the right (more items can be added to .nav-items)
    this.mount(`<nav id="topnav" class="glass">
      <a class="nav-brand" href="${import.meta.env.BASE_URL}" data-go="home" title="${U('navBrandTitle')}">${U('navBrand')}</a>
      <span class="nav-title">${U('navTitle')}</span>
      <div class="nav-items">
        ${devOn() ? `<span class="dev-chip">${U('dev.chip')}</span><button class="nav-btn" data-go="end" title="${U('dev.endTitle')}">${U('dev.end')}</button>` : ''}
        <button class="nav-btn" data-go="usecases">${U('navUseCases')}</button>
        <button class="nav-btn" id="settings-btn" aria-haspopup="true">${U('navSettings')}</button>
        <div class="lang-switch" role="group" aria-label="${U('navLang')}">
          ${LOCALES.map(l => `<button type="button" data-lang="${l}" lang="${l}" title="${NATIVE[l]}" aria-label="${NATIVE[l]}" aria-pressed="${lang() === l}">${SHORT[l]}</button>`).join('')}
        </div>
      </div></nav>`);
    this.menuEl = this.mount(`<div id="menu" class="glass">
      <button data-go="restart">${U('menu.restart')}</button>
      <div class="menu-l">${U('menu.jumpLabel')}</div>
      ${PHASE_ORDER.map(p => `<button data-go="${p}">${U('menu.phaseButton', { p, name: PHASES[p] })}</button>`).join('')}
      <button data-go="about">${U('menu.about')}</button>
      ${devUnlocked() ? `<div class="menu-l">${U('dev.reviewerTools')}</div>
      <label class="menu-toggle"><input type="checkbox" id="dev-toggle" ${devOn() ? 'checked' : ''}> ${U('dev.toggle')} <span>${U('dev.toggleHint')}</span></label>` : ''}
      </div>`);
    document.getElementById('settings-btn')!.addEventListener('click', () => this.menuEl.classList.toggle('open'));
    document.getElementById('dev-toggle')?.addEventListener('change', e => { setDevOn((e.target as HTMLInputElement).checked); location.reload(); });
    const go = (target: string) => {
      this.menuEl.classList.remove('open');
      if (target === 'about') { this.about(); return; }
      if (target === 'end') { jumpTo('end'); return; }
      if (target === 'usecases') { dispatchEvent(new CustomEvent('open-usecases')); return; }
      if (target === 'home') { location.hash = ''; location.reload(); return; }
      location.hash = target === 'restart' ? 'restart' : `phase=${target}`; // #restart skips the title
      location.reload();
    };
    this.menuEl.addEventListener('click', e => { const t = (e.target as HTMLElement).dataset.go; if (t) go(t); });
    document.getElementById('topnav')!.addEventListener('click', e => {
      const l = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]')?.dataset.lang;
      if (l) { if (l !== lang() && isLang(l)) setLang(l); return; }
      const g = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
      if (g) { e.preventDefault(); go(g); }
    });
  }

  private mount(html: string) { const el = h(html); this.root.appendChild(el); return el; }

  // ---------- title ----------

  title(initial: Settings): Promise<{ mode: 'play' | 'demo' | 'explore'; settings: Settings }> {
    const n = initial.names;
    const el = this.mount(`<div id="title" class="overlay">
      <div class="title-wrap">
      <div class="title-card glass">
        <div class="eyebrow">${U('title.eyebrow')}</div>
        <h1>${U('title.h1')}</h1>
        <p class="lede">${U('title.lede')}</p>
        <div class="setup">
          <label class="f-country">${U('title.countryLabel')}<input id="s-country" maxlength="32" autocomplete="off"></label>
          <label class="f-code">${U('title.codeLabel')}<input id="s-code" maxlength="3" autocomplete="off"></label>
        </div>
        <p class="code-hint">${U('title.codeHint')}</p>
        <details class="adv"><summary>${U('title.advancedSummary')}</summary>
          <div class="team">
            ${([['business', 'Business', 'BO'], ['keymaster', 'Keymaster', 'KM'], ['legal', 'Legal', 'LG'], ['technical', 'Technical', 'TC']] as const).map(([r, K]) =>
              `<label><span class="avatar r-${r}">${U(`title.avatar${K}`)}</span>${U(`title.team${K}`)}<input data-p="${r}"><span class="job">${ROLES[r].job}</span></label>`).join('')}
          </div>
          <button class="link reset" type="button">${U('title.resetSample')}</button>
        </details>
        <div class="title-grid">
          <div><span class="dot c-country"></span><b class="t-cname"></b><br>${U('title.gridCountry')}</div>
          <div><span class="dot c-network"></span><b>${U('title.gridNetworkName')}</b><br>${U('title.gridNetwork')}</div>
          <div><span class="dot c-who"></span><b>${U('title.gridWhoName')}</b><br>${U('title.gridWho')}</div>
          <div><span class="dot c-github"></span><b>${U('title.gridGithubName')}</b><br>${U('title.gridGithub')}</div>
        </div>
        <p class="small">${U('title.smallLead')} <span class="paper">${U('title.smallPaper')}</span>, <span class="data">${U('title.smallData')}</span>.</p>
        <div class="title-actions"><button class="primary" id="start">${U('title.start')}</button><button class="ghost" id="watch-demo">${U('title.watchDemo')}</button><button class="ghost" id="explore-btn">${U('title.explore')}</button></div>
        <p class="fine">${U('title.fine')}</p>
      </div>
      <aside class="title-side glass">
        <div class="eyebrow">${U('title.sideEyebrow')}</div>
        <p class="side-lede">${U('title.sideLede')}</p>
        <button class="side-tile" id="side-demo">
          <span class="side-thumb" style="background-image:url('${import.meta.env.BASE_URL}video/demo-overview.jpg')"><span class="uc-play">▶</span><span class="uc-len">${U('title.sideDemoLength')}</span></span>
          <span class="side-text"><span class="uc-tag">${U('title.sideDemoTag')}</span><b>${U('title.sideDemoTitle')}</b><span class="uc-sub">${U('title.sideDemoSub')}</span></span>
        </button>
        ${lang() === 'en' ? `<a class="side-dl" href="${import.meta.env.BASE_URL}video/join-the-network-demo-en.mp4" download>${U('title.sideDownload')}</a>` : ''}
        ${USE_CASES.map(u => `<button class="side-tile" data-uc="${u.id}">
          <span class="side-thumb" style="background-image:url('${import.meta.env.BASE_URL}${lang() === 'fr' ? u.posterFr ?? u.poster : u.poster}')"><span class="uc-play">▶</span><span class="uc-len">${u.minutes}</span></span>
          <span class="side-text"><span class="uc-tag">${u.tag}</span><b>${u.title}</b><span class="uc-sub">${u.subtitle}</span></span>
        </button>`).join('')}
      </aside>
      </div></div>`);
    const $ = <T extends HTMLElement>(q: string) => el.querySelector(q) as T;
    const country = $<HTMLInputElement>('#s-country'), code = $<HTMLInputElement>('#s-code');
    const people = [...el.querySelectorAll<HTMLInputElement>('.team input')];
    let codeTouched = initial.code !== deriveCode(initial.country) && !(initial.country === DEFAULTS.country && initial.code === DEFAULTS.code);
    const fillForm = (s: Settings) => {
      country.value = s.country; code.value = s.code;
      people.forEach(i => { i.value = s.names[i.dataset.p as Person]; });
      $('.t-cname').textContent = s.country;
    };
    fillForm({ ...initial, names: n });
    country.addEventListener('input', () => {
      if (!codeTouched) code.value = deriveCode(country.value);
      $('.t-cname').textContent = country.value || U('title.countryFallback');
    });
    code.addEventListener('input', () => {
      code.value = code.value.toUpperCase().replace(/[^A-Z]/g, '');
      codeTouched = code.value !== ''; // clearing the field hands it back to the country name
    });
    $('.reset').addEventListener('click', () => { codeTouched = false; fillForm(structuredClone(DEFAULTS)); });
    const read = (): Settings => {
      const names = { ...DEFAULTS.names };
      people.forEach(i => { if (i.value.trim()) names[i.dataset.p as Person] = i.value.trim(); });
      const c = country.value.trim() || DEFAULTS.country;
      const typed = code.value.trim().toUpperCase();
      const derived = country.value.trim() ? deriveCode(c) : DEFAULTS.code;
      return { country: c, code: typed.length === 3 ? typed : derived, names };
    };
    return new Promise(done => {
      const go = (mode: 'play' | 'demo' | 'explore') => {
        el.classList.add('gone');
        setTimeout(() => el.remove(), 500);
        done({ mode, settings: read() });
      };
      $('#start').addEventListener('click', () => go('play'));
      $("#watch-demo").addEventListener('click', () => go('demo'));
      $('#explore-btn').addEventListener('click', () => go('explore'));
      $('#side-demo').addEventListener('click', () => go('demo'));
      el.querySelectorAll<HTMLElement>('.side-tile[data-uc]').forEach(t =>
        t.addEventListener('click', () => dispatchEvent(new CustomEvent('open-usecase', { detail: t.dataset.uc }))));
    });
  }

  about() {
    const el = this.mount(`<div class="overlay"><div class="title-card glass">
      <h2>${U('about.h2')}</h2>
      <p>${U('about.p1')}</p>
      <p>${U('about.p2')}</p>
      <button class="primary">${U('about.close')}</button>
      ${catsFound().length ? `<p class="built-by">${U('about.cats', { n: catsFound().length })}</p>` : ''}
      <p class="built-by">${U('about.builtBy')} <a href="https://osforge.co.za" target="_blank" rel="noopener">${U('about.osforge')}</a></p></div></div>`);
    el.querySelector('button')!.addEventListener('click', () => el.remove());
  }

  showChrome() { for (const e of [this.hudEl, this.statsEl, this.stripEl]) e.classList.remove('hidden'); }

  // ---------- HUD, stats, strip ----------

  hud(m: Moment) {
    const r = ROLES[m.role];
    this.hudEl.innerHTML = `
      <div class="hud-top"><span class="chip phase-${m.phase}">${m.phase} · ${PHASES[m.phase]}</span>${refsChips(m.steps)}</div>
      <div class="hud-title">${m.title}</div>
      <div class="hud-role"><span class="avatar r-${m.role}">${r.initials}</span>${m.role === 'who' ? r.title : U('hud.role', { name: r.name, title: r.title })}</div>`;
  }

  stats(days: number, detours: number) {
    this.detourCount = detours;
    this.statsEl.querySelector('#days')!.textContent = String(days);
    this.statsEl.querySelector('#detours')!.textContent = String(detours);
  }

  strip(index: number, detours: Detour[]) {
    this.routeEl.innerHTML = routeSvg(index, detours, false);
    if (!devOn()) return;
    this.stripEl.classList.add('dev');
    this.routeEl.querySelectorAll<SVGElement>('[data-i]').forEach(d =>
      d.addEventListener('click', () => jumpTo(Number(d.dataset.i))));
  }

  /** Ask before throwing away a run in progress. Resolves true to go ahead. */
  private confirmLeave(where: 'restart' | 'home'): Promise<boolean> {
    const days = this.statsEl.querySelector('#days')!.textContent;
    const lost = U('confirm.lost', { days: days ?? 0, n: this.detourCount });
    const copy = where === 'restart'
      ? { h: U('confirm.restartTitle'), p: `${lost} ${U('confirm.restartBody')}`, ok: U('confirm.restartOk') }
      : { h: U('confirm.homeTitle'), p: `${lost} ${U('confirm.homeBody')}`, ok: U('confirm.homeOk') };
    const el = this.mount(`<div class="overlay confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-h"><div class="title-card glass">
      <h2 id="confirm-h">${copy.h}</h2><p>${copy.p}</p>
      <div class="confirm-actions"><button class="primary" data-ok>${copy.ok}</button><button class="ghost" data-cancel>${U('confirm.cancel')}</button></div></div></div>`);
    return new Promise(done => {
      const close = (ok: boolean) => { removeEventListener('keydown', onKey); el.remove(); done(ok); };
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
      addEventListener('keydown', onKey);
      el.querySelector('[data-ok]')!.addEventListener('click', () => close(true));
      el.querySelector('[data-cancel]')!.addEventListener('click', () => close(false));
      el.addEventListener('click', e => { if (e.target === el) close(false); });
      el.querySelector<HTMLElement>('[data-cancel]')!.focus();
    });
  }

  // ---------- desk ----------

  private openDesk(html: string, cls = '') {
    this.deskEl.className = `glass open ${cls}`;
    this.deskEl.innerHTML = html;
    this.deskEl.scrollTop = 0;
  }

  hideDesk() { this.deskEl.className = 'glass'; }

  private header(m: Moment) {
    const r = ROLES[m.role];
    return `<div class="desk-head"><span class="avatar r-${m.role}">${r.initials}</span>
      <div><div class="desk-who">${m.role === 'who' ? U('desk.whoName') : r.name}</div><div class="desk-sub">${m.role === 'who' ? U('desk.whoSub') : r.title}</div></div>
      ${refsChips(m.steps)}</div>
      <h2>${m.title}</h2><p class="brief">${T(m.brief)}</p>
      ${m.docs ? `<div class="docs">${m.docs.map(docHtml).join('')}</div>` : ''}`;
  }

  ask(m: Moment, disabled: Set<string>): Promise<string> {
    const choices = m.choices!.map(c => `<button class="choice" data-id="${c.id}" ${disabled.has(c.id) ? 'disabled' : ''}>${c.text}${disabled.has(c.id) ? `<span class="tried">${U('desk.tried')}</span>` : ''}</button>`).join('');
    const previews = devOn() ? m.choices!.filter(c => !c.correct).map(c =>
      `<button class="dev-preview" data-p="${c.id}">${U('dev.preview', { kind: U(c.flag ? 'dev.previewDelayed' : 'dev.previewNow'), text: stripTips(c.text).slice(0, 48), more: c.text.length > 48 ? '…' : '' })}</button>`).join('') : '';
    this.openDesk(`${this.header(m)}<div class="prompt">${T(m.prompt)}</div><div class="choices">${shuffle(choices)}</div>${previews ? `<div class="dev-previews"><span class="dev-chip">${U('dev.chip')}</span>${previews}</div>` : ''}`);
    this.deskEl.querySelectorAll<HTMLButtonElement>('.dev-preview').forEach(b => b.addEventListener('click', () => {
      const c = m.choices!.find(x => x.id === b.dataset.p)!;
      if (c.consequence) this.preview(c.consequence);
      else if (c.flag) {
        const chk = MOMENTS.flatMap(x => x.checks ?? []).find(k => k.flag === c.flag);
        if (chk) this.preview(chk.consequence, { fix: chk.fix, origin: m.title });
      }
    }));
    return new Promise(done => {
      this.deskEl.querySelectorAll<HTMLButtonElement>('.choice').forEach(b => b.addEventListener('click', () => done(b.dataset.id!)));
    });
  }

  checklist(m: Moment, marks?: ChecklistMarks): Promise<number[]> {
    const cl = m.checklist!;
    const kept = new Set(marks?.picked ?? []);
    const items = cl.items.map((it: ChecklistItem, i: number) => {
      const wrong = marks?.wrong.includes(i), missing = marks?.missing.includes(i) || (marks?.noDomains && !!it.domain);
      const cls = `check${wrong ? ' bad' : ''}${missing ? ' warn' : ''}`;
      return `<label class="${cls}" data-i="${i}"><input type="checkbox" value="${i}"${kept.has(i) ? ' checked' : ''}><span>${it.text}${wrong && it.why ? `<small class="check-why">${it.why}</small>` : ''}</span></label>`;
    }).join('');
    this.openDesk(`${this.header(m)}<div class="prompt">${T(m.prompt)}</div><div class="checks">${items}</div>
      ${cl.note ? `<p class="check-note">${cl.note}</p>` : ''}
      ${marks ? '<div class="check-sum"></div>' : ''}
      <button class="primary send">${cl.button ?? U('desk.send')}</button>`);
    const boxes = [...this.deskEl.querySelectorAll<HTMLInputElement>('.check input')];
    const sum = this.deskEl.querySelector<HTMLElement>('.check-sum');
    const sync = () => {
      if (!marks) return;
      const on = (i: number) => boxes[i].checked;
      let toRemove = 0, missing = 0;
      boxes.forEach((b, i) => {
        const lab = b.closest('label')!;
        if (marks.wrong.includes(i)) { lab.classList.toggle('bad', b.checked); if (b.checked) toRemove++; }
        if (marks.missing.includes(i)) { lab.classList.toggle('warn', !b.checked); if (!b.checked) missing++; }
      });
      let noDom = false;
      if (marks.noDomains) {
        noDom = !cl.items.some((it, i) => it.domain && on(i));
        boxes.forEach((b, i) => { if (cl.items[i].domain) b.closest('label')!.classList.toggle('warn', noDom); });
      }
      const parts = [toRemove ? U('desk.sumRemove', { n: toRemove }) : '', missing ? U('desk.sumMissing', { n: missing }) : '', noDom ? U('desk.sumDomain') : ''].filter(Boolean);
      sum!.textContent = parts.join(', ');
      sum!.hidden = !parts.length;
    };
    boxes.forEach(b => b.addEventListener('change', sync));
    sync();
    return new Promise(done => {
      this.deskEl.querySelector('.send')!.addEventListener('click', () => {
        done(boxes.filter(i => i.checked).map(i => Number(i.value)));
      });
    });
  }

  watch(m: Moment): Promise<void> {
    this.openDesk(`${this.header(m)}<div class="prompt">${T(m.prompt)}</div><button class="primary go">${U('desk.watch')}</button>`);
    return new Promise(done => this.deskEl.querySelector('.go')!.addEventListener('click', () => done()));
  }

  /** The easter-egg cat: a soft mrrp and one line of advice when clicked. */
  private bindCat(scope: HTMLElement) {
    const cat = scope.querySelector<HTMLButtonElement>('.desk-cat');
    cat?.addEventListener('click', () => {
      mrrp();
      cat.classList.remove('mrrp'); void cat.offsetWidth; cat.classList.add('mrrp');
      this.toast(`🐾 ${catLine()}`, 'info', 3200);
    });
  }

  /** Dev mode: show a set-back panel without playing it (no days, no detour). */
  preview(c: Consequence, opts: { fix?: string; origin?: string } = {}) {
    const el = this.mount(`<div class="overlay"><div class="title-card glass preview-card">
      <div class="eyebrow">${U('dev.previewEyebrow')}</div>
      <div class="ret-head"><span class="ret-icon">!</span><div><div class="ret-by">${U('returned.by', { by: c.by })}</div><div class="desk-sub">${refsChips(c.steps)}</div></div><span class="chip bad">${U('returned.days', { days: c.days })}</span></div>
      <h2>${c.title}</h2>
      ${opts.origin ? `<p class="origin">${U('dev.previewOrigin', { origin: `<b>${opts.origin}</b>` })}</p>` : ''}
      <p><b>${U('returned.what')}</b> ${T(c.what)}</p>${c.why ? `<p><b>${U('returned.why')}</b> ${T(c.why)}</p>` : ''}${opts.fix ? `<p class="fix"><b>${U('returned.fix')}</b> ${T(opts.fix)}</p>` : ''}
      <button class="primary">${U('dev.previewClose')}</button>
      <button class="desk-cat">${catSvg(catMood(this.detourCount))}</button></div></div>`);
    el.querySelector('button')!.addEventListener('click', () => el.remove());
    this.bindCat(el);
  }

  returned(c: Consequence, opts: { fix?: string; extra?: string[]; origin?: string } = {}): Promise<'go' | 'back'> {
    this.openDesk(`<div class="ret-head"><span class="ret-icon">!</span><div><div class="ret-by">${U('returned.by', { by: c.by })}</div><div class="desk-sub">${refsChips(c.steps)}</div></div><span class="chip bad">${U('returned.days', { days: c.days })}</span></div>
      <h2>${c.title}</h2>
      ${opts.origin ? `<p class="origin">${U('returned.origin', { origin: `<b>${opts.origin}</b>` })}</p>` : ''}
      <p><b>${U('returned.what')}</b> ${T(c.what)}</p>
      ${opts.extra?.length ? `<ul class="extra">${opts.extra.map(x => `<li>${T(x)}</li>`).join('')}</ul>` : ''}
      ${c.why ? `<p><b>${U('returned.why')}</b> ${T(c.why)}</p>` : ''}
      ${opts.fix ? `<p class="fix"><b>${U('returned.fix')}</b> ${T(opts.fix)}</p>` : ''}
      <div class="ret-actions"><button class="primary go">${opts.fix ? U('desk.fix') : U('desk.tryAgain')}</button><button class="ghost back">${U('desk.back')}</button></div>
      ${catShows() ? `<button class="desk-cat" title="${U('desk.catTitle')}">${catSvg(catMood(this.detourCount))}</button>` : ''}`, 'returned');
    this.bindCat(this.deskEl);
    return new Promise(done => {
      for (const k of ['go', 'back'] as const)
        this.deskEl.querySelector(`.${k}`)!.addEventListener('click', () => { this.hideDesk(); done(k); });
    });
  }

  toast(html: string, tone: 'ok' | 'info' | 'bad' = 'ok', ms = 3200) {
    this.toastEl.className = `glass show t-${tone}`;
    this.toastEl.innerHTML = html;
    clearTimeout((this.toastEl as any)._t);
    (this.toastEl as any)._t = setTimeout(() => { this.toastEl.className = 'glass'; }, ms);
  }

  // ---------- debrief ----------

  debrief(d: DebriefData): Promise<void> {
    const lostDays = d.detours.reduce((s, x) => s + x.days, 0);
    const el = this.mount(`<div id="debrief" class="overlay"><div class="debrief-card glass">
      <div class="eyebrow">${U('debrief.eyebrow', { country: settings().country })}</div>
      <h1>${d.detours.length ? U('debrief.h1Detours', { n: d.detours.length }) : U('debrief.h1Clean')}</h1>
      <div class="kpis">
        <div><span>${d.days}</span>${U('debrief.kpiDays')}</div>
        <div><span>${d.ideal}</span>${U('debrief.kpiIdeal')}</div>
        <div><span class="bad">+${lostDays}</span>${U('debrief.kpiLost')}</div>
      </div>
      <h3>${U('debrief.yourRoute')}</h3>
      <div class="route">${routeSvg(MOMENTS.length, d.detours, true)}</div>
      ${d.detours.length ? `<h3>${U('debrief.sentBack')}</h3><ol class="detours">${d.detours.map(x =>
        `<li><b>${x.title}</b> ${refsChips(x.steps)} <span class="chip bad">+${x.days}</span><br>${T(x.why)}${x.origin ? `<br><span class="origin-l">${U('debrief.origin', { origin: stripTips(x.origin) })}</span>` : ''}</li>`).join('')}</ol>` : ''}
      <h3>${U('debrief.keysTitle')}</h3>
      <div class="keys">
        <div class="k-col c-country"><b>${U('debrief.countryKeeps', { country: settings().country })}</b><ul><li>${U('debrief.keep1')}</li><li>${U('debrief.keep2')}</li><li>${U('debrief.keep3')}</li></ul></div>
        <div class="k-col c-github"><b>${U('debrief.githubCarries')}</b><ul><li>${U('debrief.github1')}</li><li>${U('debrief.github2')}</li><li>${U('debrief.github3')}</li></ul></div>
        <div class="k-col c-who"><b>${U('debrief.whoHolds')}</b><ul><li>${U('debrief.who1')}</li><li>${U('debrief.who2')}</li></ul></div>
        <div class="k-col c-network"><b>${U('debrief.gatewayPublishes')}</b><ul><li>${U('debrief.gateway1')}</li><li>${U('debrief.gateway2')}</li></ul></div>
      </div>
      <h3>${U('debrief.learnTitle')}</h3>
      <ol class="learn">${MOMENTS.filter(m => m.learn).map(m => `<li>${T(m.learn)}</li>`).join('')}</ol>
      <div class="debrief-actions"><button class="primary again">${U('debrief.finish')}</button><button class="ghost print">${U('debrief.print')}</button></div>
    </div></div>`);
    el.querySelector('.print')!.addEventListener('click', () => window.print());
    return new Promise(done => el.querySelector('.again')!.addEventListener('click', () => { el.remove(); done(); }));
  }
}

// ---------- completion splash ----------

const LINKS = [
  { href: 'https://www.who.int/initiatives/global-digital-health-certification-network', k: 1 },
  { href: 'https://smart.who.int/trust/', k: 2 },
  { href: 'https://smart.who.int/trust/concepts_onboarding.html', k: 3 },
  { href: 'https://smart.who.int/trust/concepts_onboarding_checklist.html', k: 4 },
  { href: 'https://github.com/WorldHealthOrganization/smart-trust', k: 5 },
  { href: 'https://github.com/WorldHealthOrganization/tng-participant-template', k: 6 },
  { href: 'mailto:gdhcn-support@who.int', k: 7 },
  { href: 'https://github.com/WorldHealthOrganization/GDHCNOnboardingWizard', k: 8 },
  { href: 'https://smart.who.int/trust/concepts_onboarding.html#letters-of-application', k: 9 },
  { href: 'mailto:gdhcn-secretariat@who.int', k: 10 },
];
/** Display order is the original one; the keys follow the French review transcript (link7 is the support address). */
const LINK_ORDER = [1, 2, 3, 4, 5, 6, 8, 9, 10, 7];

export function splash(root: HTMLElement, detours = 1, domains: string[] = ['DDCC']): Promise<'again' | 'demo'> {
  const el = document.createElement('div');
  el.id = 'splash';
  el.className = 'overlay';
  el.innerHTML = `<div class="splash-card glass">
    <div class="splash-badge-wrap"><div class="splash-badge" aria-hidden="true">✓</div>${detours === 0 ? `<span class="splash-cat" title="${U('splash.perfect')}">${catSvg('crown')}</span>` : ''}</div>
    <div class="eyebrow">${U('splash.eyebrow')}</div>
    <h1>${U('splash.h1', { country: settings().country })}</h1>
    <p class="lede">${domains.length ? U('splash.liveIn', { domains: joinList(domains) }) : U('splash.liveNone')}</p>
    <p class="lede">${U('splash.lede', { country: settings().country })}</p>
    <h3>${U('splash.takeFurther')}</h3>
    <div class="splash-links">${LINK_ORDER.map(k => LINKS.find(l => l.k === k)!).map(l => `<a href="${l.href}" target="_blank" rel="noopener"><b>${U(`splash.link${l.k}.title`)}</b><span>${U(`splash.link${l.k}.sub`)}</span></a>`).join('')}</div>
    <p class="fine">${U('splash.fine')}</p>
    <div class="title-actions"><button class="primary" data-n="again">${U('splash.again')}</button><button class="ghost" data-n="demo">${U('splash.demo')}</button></div>
  </div>`;
  root.appendChild(el);
  return new Promise(done => el.addEventListener('click', e => {
    const n = (e.target as HTMLElement).dataset.n as 'again' | 'demo' | undefined;
    if (n) { el.remove(); done(n); }
  }));
}

// ---------- helpers ----------

function shuffle(html: string) {
  const t = document.createElement('div'); t.innerHTML = html;
  const kids = [...t.children];
  for (let i = kids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [kids[i], kids[j]] = [kids[j], kids[i]]; }
  return kids.map(k => k.outerHTML).join('');
}

const GAUGE = '<svg class="dash-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2.5"/><path d="M6 13l3-3 3 2 5-5"/><path d="M8 21h8M12 17v4"/></svg>';

/** A small Grafana-style panel: one bar per certificate, coloured by time left. */
function dashboardHtml(d: Doc) {
  const left = (n: number) => (n >= 730 ? U('dashboard.years', { n: num(n / 365) }) : n >= 60 ? U('dashboard.months', { n: Math.round(n / 30) }) : U('dashboard.days', { n }));
  const rows = d.lines.map((l, i) => {
    const [label, raw] = l.split('|');
    const n = Number(raw);
    const tone = n <= 31 ? 'bad' : n <= 90 ? 'warn' : 'ok';
    const pct = Math.max(3, Math.min(100, (n / 1460) * 100));
    return `<div class="dash-row ${d.mark?.includes(i) ? 'mark' : ''}"><span class="dash-l">${T(label)}</span>
      <span class="dash-bar"><i class="g-${tone}" style="width:${pct}%"></i></span><span class="dash-n g-${tone}">${left(n)}</span></div>`;
  }).join('');
  return `<div class="doc d-dashboard"><div class="doc-title">${GAUGE}${T(d.title)}</div>
    <div class="dash-tabs"><span>DEV</span><span>UAT</span><span class="on">PROD</span></div>${rows}</div>`;
}

function docHtml(d: Doc) {
  if (d.kind === 'dashboard') return dashboardHtml(d);
  const lines = d.lines.map((l, i) => `<div class="${d.mark?.includes(i) ? 'mark' : ''}">${T(l)}</div>`).join('');
  return `<div class="doc d-${d.kind}"><div class="doc-title">${T(d.title)}</div>${lines}</div>`;
}

/** The progress line: phases as coloured segments, a dot per moment, red loops for detours. */
function routeSvg(index: number, detours: Detour[], final: boolean) {
  const W = 1000, x0 = 30, x1 = 970, y = final ? 70 : 24;
  const n = MOMENTS.length;
  const xs = MOMENTS.map((_, i) => x0 + ((x1 - x0) * i) / (n - 1));
  const segs: string[] = [], labels: string[] = [];
  for (const p of PHASE_ORDER) {
    const idx = MOMENTS.map((m, i) => (m.phase === p ? i : -1)).filter(i => i >= 0);
    if (!idx.length) continue;
    const a = xs[idx[0]], b = xs[idx[idx.length - 1]];
    labels.push(`<text x="${(a + b) / 2}" y="${y + 26}" class="s-label ${idx.includes(index) && !final ? 'on' : ''}">${p} · ${U(`strip.phase.${p}`)}</text>`);
    segs.push(`<line x1="${a - 8}" y1="${y}" x2="${b + 8}" y2="${y}" class="s-phase p-${p}"/>`);
  }
  const done = final ? x1 : xs[Math.min(index, n - 1)];
  const loops = new Map<number, number>();
  detours.forEach(d => loops.set(d.index, (loops.get(d.index) ?? 0) + d.days));
  const loopSvg = [...loops.entries()].map(([i, days]) => {
    const x = xs[i], hgt = final ? 18 + Math.min(days, 30) * 1.4 : 14;
    return `<path d="M${x - 14},${y} C${x - 14},${y - hgt} ${x + 14},${y - hgt} ${x + 14},${y}" class="s-loop"/>` +
      (final ? `<text x="${x}" y="${y - hgt - 4}" class="s-loop-t">+${days}</text>` : '');
  }).join('');
  const dots = xs.map((x, i) => {
    const cls = i < index || final ? 'done' : i === index ? 'now' : '';
    const hit = final ? '' : `<circle cx="${x}" cy="${y}" r="16" class="s-hit" data-i="${i}"><title>${i + 1}. ${stripTips(MOMENTS[i].title)}</title></circle>`;
    return `<circle cx="${x}" cy="${y}" r="${i === index && !final ? 9 : 5.5}" class="s-dot ${cls}"><title>${stripTips(MOMENTS[i].title)}</title></circle>${hit}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${final ? 110 : 56}" preserveAspectRatio="none">
    <line x1="${x0 - 8}" y1="${y}" x2="${x1 + 8}" y2="${y}" class="s-track"/>
    ${segs.join('')}
    <line x1="${x0 - 8}" y1="${y}" x2="${done}" y2="${y}" class="s-done"/>
    ${loopSvg}${dots}${labels.join('')}
  </svg>`;
}
