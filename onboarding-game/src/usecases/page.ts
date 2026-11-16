import { USE_CASES, type UseCase } from './data';
import { lang, t } from '../i18n';

const P = (k: string, v?: Record<string, string | number>) => t(`page.ts:${k}`, v);

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/**
 * "Use cases" pages: a gallery of the use-case films and a page per film.
 * Opens over whatever is on screen (title, game or demo) and closes back to it,
 * so a game in progress is not lost. Deep links: #usecases and #usecase/<id>.
 */
export class UseCasesPage {
  private el: HTMLElement;
  private prevHash = '';

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'usecases';
    this.el.className = 'overlay';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.el.addEventListener('click', e => {
      const lang = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]');
      if (lang) { this.setLang(lang.dataset.lang === 'fr' ? 'fr' : 'en'); return; }
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-uc],[data-a]');
      if (!t) { if (e.target === this.el) this.close(); return; }
      if (t.dataset.uc) this.open(t.dataset.uc);
      else if (t.dataset.a === 'gallery') this.open();
      else if (t.dataset.a === 'close') this.close();
      else if (t.dataset.a === 'play') { this.close(); location.hash = ''; location.reload(); }
    });
    addEventListener('keydown', e => { if (e.key === 'Escape' && !this.el.hidden) this.close(); });
  }

  /** Read #usecases / #usecase/<id> on load. */
  openFromHash(): boolean {
    const m = /^#usecases?(?:\/([\w-]+))?$/.exec(location.hash);
    if (!m) return false;
    this.open(m[1]);
    return true;
  }

  open(id?: string) {
    if (this.el.hidden) this.prevHash = /^#usecase/.test(location.hash) ? '' : location.hash;
    this.stopVideo();
    const uc = id ? USE_CASES.find(u => u.id === id) : undefined;
    this.el.innerHTML = uc ? this.detail(uc) : this.gallery();
    this.el.hidden = false;
    this.el.scrollTop = 0;
    history.replaceState(null, '', uc ? `#usecase/${uc.id}` : '#usecases');
  }

  close() {
    this.stopVideo();
    this.el.hidden = true;
    history.replaceState(null, '', this.prevHash || location.pathname);
  }

  private stopVideo() { this.el.querySelector('video')?.pause(); }

  /** Film language: the viewer's per-film choice for this session, else the site language. */
  private getLang(): 'en' | 'fr' {
    try {
      const v = sessionStorage.getItem('uc-lang');
      if (v === 'fr' || v === 'en') return v;
    } catch { /* fall through to the site language */ }
    return lang() === 'fr' ? 'fr' : 'en'; // films exist in English and French only
  }

  /** Switch the film language: swap src and poster, pause, back to the start. */
  private setLang(lang: 'en' | 'fr') {
    try { sessionStorage.setItem('uc-lang', lang); } catch { /* ignore */ }
    const v = this.el.querySelector<HTMLVideoElement>('video.uc-video');
    const id = /^#usecase\/([\w-]+)/.exec(location.hash)?.[1];
    const uc = USE_CASES.find(u => u.id === id);
    if (!v || !uc?.videoFr) return;
    v.pause();
    v.poster = asset(lang === 'fr' ? uc.posterFr ?? uc.poster : uc.poster);
    v.src = asset(lang === 'fr' ? uc.videoFr : uc.video);
    v.load();
    v.currentTime = 0;
    this.el.querySelectorAll<HTMLElement>('[data-lang]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  private gallery() {
    return `<div class="uc-card glass">
      <div class="uc-top"><div class="eyebrow">${P('gallery.eyebrow')}</div><button class="uc-x" data-a="close" aria-label="${P('closeAria')}">✕</button></div>
      <h1>${P('gallery.h1')}</h1>
      <p class="lede">${P('gallery.lede')}</p>
      <div class="uc-grid">${USE_CASES.map(u => `
        <button class="uc-tile" data-uc="${u.id}">
          <span class="uc-thumb" style="background-image:url('${asset(lang() === 'fr' ? u.posterFr ?? u.poster : u.poster)}')"><span class="uc-play">▶</span><span class="uc-len">${u.minutes}</span></span>
          <span class="uc-tag">${u.tag}</span>
          <b>${u.title}</b>
          <span class="uc-sub">${u.subtitle}</span>
        </button>`).join('')}
      </div></div>`;
  }

  private detail(u: UseCase) {
    const others = USE_CASES.filter(o => o.id !== u.id);
    const film = u.videoFr ? this.getLang() : 'en';
    const src = film === 'fr' && u.videoFr ? u.videoFr : u.video;
    const langSwitch = u.videoFr ? `<div class="uc-lang" role="group" aria-label="${P('detail.filmLanguage')}">
        <button type="button" data-lang="en" aria-pressed="${film === 'en'}" lang="en">${P('detail.langEn')}</button>
        <button type="button" data-lang="fr" aria-pressed="${film === 'fr'}" lang="fr">${P('detail.langFr')}</button>
      </div>` : '';
    return `<div class="uc-card glass">
      <div class="uc-top"><button class="nav-btn" data-a="gallery">${P('detail.back')}</button><button class="uc-x" data-a="close" aria-label="${P('closeAria')}">✕</button></div>
      <div class="uc-tag">${u.tag}</div>
      <h1>${u.title}</h1>
      <p class="uc-sub big">${u.subtitle}</p>
      ${langSwitch}
      <video class="uc-video" controls playsinline preload="none" poster="${asset(film === 'fr' ? u.posterFr ?? u.poster : u.poster)}" src="${asset(src)}"></video>
      <blockquote class="uc-idea">${u.idea}</blockquote>
      <h3>${P('detail.whatFilm')}</h3>
      <p>${u.summary}</p>
      <h3>${P('detail.howHelps')}</h3>
      <ul class="uc-how">${u.how.map(h => `<li>${h}</li>`).join('')}</ul>
      <h3>${P('detail.why')}</h3>
      <p>${u.why}</p>
      <div class="title-actions">
        <button class="primary" data-a="play">${P('detail.play')}</button>
        ${others.map(o => `<button class="ghost" data-uc="${o.id}">${P('detail.next', { title: o.title })}</button>`).join('')}
      </div>
      <p class="fine">${P('detail.fine')}</p>
    </div>`;
  }
}
