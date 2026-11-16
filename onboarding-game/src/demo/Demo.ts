import type { PlaceId, World } from '../world/World';
import { setFeedbackContext } from '../ui/feedback';
import { lang, t } from '../i18n';
import { refsChips, refsText } from '../game/refs';
import REFS_JSON from '../game/process-refs.json';

const REFS = REFS_JSON as unknown as Record<string, string[]>;

const M = (k: string, v?: Record<string, string | number>) => t(`Demo.ts:${k}`, v);

// Playback speed (1 outside the demo). Every demo wait is expressed in 1x milliseconds and
// is consumed in short slices at the current speed, so a change mid-wait applies at once.
let speed = 1;
const wait = (ms: number) => new Promise<void>(r => {
  let left = ms, last = performance.now();
  const step = () => {
    const now = performance.now();
    left -= (now - last) * speed; last = now;
    if (left <= 0) r(); else setTimeout(step, Math.min(left / speed, 50));
  };
  setTimeout(step, Math.min(ms / speed, 50));
});

interface Beat {
  title: string;
  steps: string[];
  body: string;
  place: PlaceId | 'home';
  prodOpen?: boolean;
  /** Show the four role tiles, lit in time with the narration. */
  cast?: boolean;
  /** Plays the beat. Check dead() between awaits so a skip stops it cleanly. */
  run: (w: World, dead: () => boolean) => Promise<void>;
}

/**
 * The ideal path in nine beats. Every claim here mirrors a moment in scenario.ts;
 * the demo just plays the right answers with a caption, no choices and no errors.
 * It is deliberately generic ("The Country", role titles) so the recorded narration
 * (public/audio/demo/beat-NN.mp3, Higgsfield voice Naomi, speech rate 15) always matches.
 */
const BEATS: Beat[] = [
  {
    title: M('beat1.title'), steps: REFS['demo:beat1'], place: 'home',
    body: M('beat1.body'),
    run: async (w, dead) => {
      await w.travel([['paper', 1]], M('parcel.1a'), 'paper'); if (dead()) return;
      await w.travel([['paper', -1]], M('parcel.1b'), 'paper');
    },
  },
  {
    title: M('beat2.title'), steps: REFS['demo:beat2'], place: 'backend', cast: true,
    body: M('beat2.body'),
    run: async w => { await w.travel([['ministry-backend', 1]], M('parcel.2'), 'key'); },
  },
  {
    title: M('beat3.title'), steps: REFS['demo:beat3'], place: 'home',
    body: M('beat3.body'),
    run: async w => { await w.travel([['backend-github', 1]], M('parcel.3'), 'key'); },
  },
  {
    title: M('beat4.title'), steps: REFS['demo:beat4'], place: 'home',
    body: M('beat4.body'),
    run: async w => { await w.travel([['paper', 1]], M('parcel.4'), 'paper'); },
  },
  {
    title: M('beat5.title'), steps: REFS['demo:beat5'], place: 'secretariat',
    body: M('beat5.body'),
    run: async (w, dead) => {
      await wait(1800); if (dead()) return;
      await w.flyTo('home', { dur: 1.1, caption: true }); if (dead()) return;
      await w.travel([['paper', -1]], M('parcel.5'), 'paper');
    },
  },
  {
    title: M('beat6.title'), steps: REFS['demo:beat6'], place: 'github',
    body: M('beat6.body'),
    run: async (w, dead) => {
      await w.botTo('github'); if (dead()) return;
      w.bot.setMood('checking'); await wait(2000); if (dead()) return;
      w.bot.setMood('happy'); await wait(1200); if (dead()) return;
      await w.travel([['github-ops', 1]], M('parcel.6a'), 'key'); if (dead()) return;
      await w.botTo('ops'); w.bot.setMood('idle'); if (dead()) return;
      await w.flyTo('home', { dur: 1.1, caption: true }); if (dead()) return;
      await w.travel([['ops-uat', 1]], M('parcel.6b'), 'key');
    },
  },
  {
    title: M('beat7.title'), steps: REFS['demo:beat7'], place: 'ops',
    body: M('beat7.body'),
    run: async (w, dead) => {
      w.pulseAnchor(); await wait(2200); if (dead()) return;
      await w.flyTo('home', { dur: 1.1, caption: true }); if (dead()) return;
      await w.travel([['ops-prod', 1]], M('parcel.7'), 'key');
    },
  },
  {
    title: M('beat8.title'), steps: REFS['demo:beat8'], place: 'home',
    body: M('beat8.body'),
    run: async (w, dead) => {
      await w.travel([['backend-uat', 1]], M('parcel.8a'), 'data'); if (dead()) return;
      await w.travel([['backend-uat', 1]], M('parcel.8b'), 'data'); if (dead()) return;
      w.setProdOpen(true); w.pulseGateway('prod', '#4fe0a0');
    },
  },
  {
    title: M('beat9.title'), steps: REFS['demo:beat9'], place: 'home', prodOpen: true,
    body: M('beat9.body'),
    run: async (w, dead) => {
      await w.travel([['backend-prod', 1]], M('parcel.9a'), 'data'); if (dead()) return;
      await w.travel([['backend-prod', -1]], M('parcel.9b'), 'data'); if (dead()) return;
      await w.travel([['backend-prod', 1]], M('parcel.9c'), 'data'); if (dead()) return;
      await w.travel([['paper', 1]], M('parcel.9d'), 'paper'); if (dead()) return;
      w.pulseGateway('prod', '#4fe0a0');
      await w.travel([['paper', -1]], M('parcel.9e'), 'paper'); if (dead()) return;
      w.bot.setMood('happy');
    },
  },
];

const VOICE_KEY = 'gdhcn-demo-voice';
/** Languages with recorded narration (public/audio/demo/[<lang>/]beat-NN.mp3). The others run on captions. */
const NARRATED: string[] = ['en', 'fr'];
const SPEED_KEY = 'gdhcn-demo-speed';
const SPEEDS = [1, 1.25, 1.5, 2];

/** True when the URL really serves audio (a dev server answers unknown paths with index.html, so check the type). */
const audioProbe = new Map<string, Promise<boolean>>();
function audioExists(url: string): Promise<boolean> {
  if (!audioProbe.has(url)) {
    audioProbe.set(url, fetch(url, { method: 'HEAD' })
      .then(r => r.ok && (r.headers.get('content-type') ?? '').startsWith('audio'))
      .catch(() => false));
  }
  return audioProbe.get(url)!;
}

// Role tiles for beat 2. Cue times (seconds into beat-02.mp3) come from the pauses in Naomi's take,
// so each tile lights as its role is spoken. Regenerate the clip and these need re-timing.
const ICON = {
  business: '<path d="M4 8h16v11H4z"/><path d="M9 8V5h6v3"/><path d="M4 13h16"/>',
  legal: '<path d="M12 4v16"/><path d="M7 20h10"/><path d="M5 8h14"/><path d="M5 8l-3 6a3 3 0 0 0 6 0z"/><path d="M19 8l-3 6a3 3 0 0 0 6 0z"/>',
  technical: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/><path d="M10 9l-2 2 2 2"/><path d="M14 9l2 2-2 2"/>',
  keymaster: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v3"/><path d="M21 12v2"/>',
};
// Cue times per language: the French narration (public/audio/demo/fr/) will need its own once recorded.
// Until then the French set is a copy of the English one.
// A language with no narration keeps the English timing for its captions.
const CUE_TIMES: Record<string, { roles: number[]; certs: number; vault: number }> = {
  en: { roles: [3.1, 4.3, 6.8, 8.7], certs: 13.8, vault: 20.7 },
  fr: { roles: [2.5, 4.1, 5.8, 7.4], certs: 10.5, vault: 19.4 }, // from the pauses in Hélène's take of beat-02
};
const CUES = CUE_TIMES[lang()] ?? CUE_TIMES.en;
const CAST = (['business', 'legal', 'technical', 'keymaster'] as const).map((k, n) => (
  { k, role: M(`cast.${k}.role`), duty: M(`cast.${k}.duty`), at: CUES.roles[n] }));
const CAST_CERTS_AT = CUES.certs;  // "The Key Master creates a Signing CA, a TLS and an Upload certificate..."
const CAST_VAULT_AT = CUES.vault;  // "The Signing CA's private key goes into an offline vault..."


export class Demo {
  private el: HTMLElement;
  private i = 0;
  private gen = 0;
  private paused = false;
  private sound = true;
  private speaking = false;
  private audio = new Audio();
  private finished!: (next: 'play' | 'again' | 'title') => void;

  constructor(private world: World, root: HTMLElement) {
    try { this.sound = localStorage.getItem(VOICE_KEY) !== '0'; } catch { /* default on */ }
    this.audio.preload = 'auto';
    this.audio.addEventListener('playing', () => { this.speaking = true; });
    for (const ev of ['ended', 'error'] as const) this.audio.addEventListener(ev, () => { this.speaking = false; });
    this.el = document.createElement('div');
    this.el.id = 'demo';
    this.el.innerHTML = `
      <div class="demo-badge glass">${M('badge')}</div>
      <div class="demo-caption glass"><div class="demo-meta"></div><h2></h2><p></p></div>
      <div class="demo-bar glass">
        <button data-a="back" title="${M('bar.back')}">⏮</button>
        <button data-a="play" title="${M('bar.pause')}" class="demo-play">⏸</button>
        <button data-a="next" title="${M('bar.next')}">⏭</button>
        <div class="demo-dots">${BEATS.map((_, i) => `<button data-i="${i}" title="${BEATS[i].title}"></button>`).join('')}</div>
        <select class="demo-speed" aria-label="${M('bar.speed')}" title="${M('bar.speed')}">${SPEEDS.map(v => `<option value="${v}">${v}×</option>`).join('')}</select>
        <button data-a="voice" title="${NARRATED.includes(lang()) ? M('bar.voice') : M('bar.captionsOnly')}" class="demo-voice"></button>
        <button data-a="exit" title="${M('bar.exit')}">✕</button>
      </div>
      <button class="demo-tap glass" hidden>${M('tapForSound')}</button>`;
    root.appendChild(this.el);
    this.el.querySelector('.demo-tap')!.addEventListener('click', () => this.unblock());
    this.el.querySelector('.demo-bar')!.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      if (b.dataset.i) return this.play(Number(b.dataset.i));
      switch (b.dataset.a) {
        case 'back': return this.play(Math.max(0, this.i - 1));
        case 'next': return this.i < BEATS.length - 1 ? this.play(this.i + 1) : this.end();
        case 'play': return this.togglePause();
        case 'voice': return this.toggleVoice();
        case 'exit': this.stop(); return this.finished('title');
      }
    });
    this.renderVoice();
    let saved = 1;
    try { saved = Number(sessionStorage.getItem(SPEED_KEY)); } catch { /* default 1x */ }
    const sel = this.el.querySelector<HTMLSelectElement>('.demo-speed')!;
    this.setSpeed(SPEEDS.includes(saved) ? saved : 1);
    sel.value = String(speed);
    sel.addEventListener('change', () => {
      this.setSpeed(Number(sel.value));
      try { sessionStorage.setItem(SPEED_KEY, String(speed)); } catch { /* not fatal */ }
      sel.blur();
    });
  }

  /** One time-scale for everything: waits, caption hold, world animation and the narration clip. */
  private setSpeed(v: number) {
    speed = v;
    this.world.timeScale = v;
    const a = this.audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    a.playbackRate = v;
    a.preservesPitch = true; a.mozPreservesPitch = true; a.webkitPreservesPitch = true;
  }

  private resetSpeed() { speed = 1; this.world.timeScale = 1; }

  /** Runs the demo; resolves with what the viewer chose at the end. */
  run(): Promise<'play' | 'again' | 'title'> {
    return new Promise(done => { this.finished = done; this.play(0); });
  }

  private async play(i: number) {
    const gen = ++this.gen;
    const dead = () => gen !== this.gen;
    this.i = i;
    this.paused = false;
    this.el.querySelector('.demo-play')!.textContent = '⏸';
    const b = BEATS[i];
    this.world.cancelAll();
    this.world.reset();
    this.world.setProdOpen(!!b.prodOpen);
    this.world.mark(b.place === 'home' ? null : b.place);
    const body = b.body;
    setFeedbackContext({ mode: 'demo', where: M('feedbackContext', { i: i + 1, title: b.title }), moment: `beat ${i + 1} · ${b.title}`, steps: refsText(b.steps) });
    this.caption(i, b, body);
    this.narrate(i);
    const started = performance.now();
    this.showCast(b.cast ? gen : 0, started);

    await this.world.flyTo(b.place, { dur: 1.3, caption: true }); if (dead()) return;
    await b.run(this.world, dead); if (dead()) return;

    // hold the caption long enough to read (or until Naomi finishes), and while paused
    const readMs = Math.min(11000, Math.max(4500, body.length * 55));
    while (!dead() && ((performance.now() - started) * speed < readMs || this.paused || (this.sound && this.speaking))) await wait(200);
    if (!dead()) await wait(600);
    if (dead()) return;
    if (i < BEATS.length - 1) this.play(i + 1); else this.end();
  }

  /** Role tiles that light up as Naomi names each role (beat 2 only). */
  private showCast(gen: number, started: number) {
    this.el.querySelector('.demo-cast')?.remove();
    if (!gen) return;
    const box = document.createElement('div');
    box.className = 'demo-cast';
    box.innerHTML = CAST.map(c => `<div class="cast-tile c-${c.k}" data-k="${c.k}">
        <div class="cast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[c.k]}</svg></div>
        <div class="cast-role">${c.role}</div><div class="cast-duty">${c.duty}</div>
        ${c.k === 'keymaster' ? `<div class="cast-chips"><span class="chip-certs">${M('cast.certsChip')}</span><span class="chip-vault">${M('cast.vaultChip')}</span></div>` : ''}
      </div>`).join('');
    this.el.appendChild(box);
    const tiles = [...box.querySelectorAll<HTMLElement>('.cast-tile')];
    const tick = () => {
      if (gen !== this.gen || !box.isConnected) { clearInterval(timer); return; }
      // follow the narration clip when it is running (muted still advances); otherwise the wall clock
      const a = this.audio;
      const t = a.currentTime > 0 || !a.paused ? a.currentTime : (performance.now() - started) * speed / 1000;
      tiles.forEach((el, n) => {
        const lit = t >= CAST[n].at;
        const isNow = lit && (n === CAST.length - 1 || t < CAST[n + 1].at);
        el.classList.toggle('lit', lit);
        el.classList.toggle('now', isNow);
      });
      box.classList.toggle('certs', t >= CAST_CERTS_AT);
      box.classList.toggle('vault', t >= CAST_VAULT_AT);
    };
    const timer = setInterval(tick, 100);
    tick();
  }

  private caption(i: number, b: Beat, body: string) {
    const c = this.el.querySelector('.demo-caption')!;
    c.classList.remove('in'); void (c as HTMLElement).offsetWidth; c.classList.add('in');
    c.querySelector('.demo-meta')!.innerHTML = `<span>${M('meta', { i: i + 1, total: BEATS.length })}</span>${refsChips(b.steps)}`;
    c.querySelector('h2')!.textContent = b.title;
    c.querySelector('p')!.textContent = body;
    this.el.querySelectorAll<HTMLElement>('.demo-dots button').forEach((d, k) => {
      d.className = k < i ? 'done' : k === i ? 'now' : '';
    });
  }

  private togglePause() {
    this.paused = !this.paused;
    this.el.querySelector('.demo-play')!.textContent = this.paused ? '▶' : '⏸';
    if (this.paused) this.audio.pause();
    else if (this.sound && this.speaking) this.audio.play().catch(e => this.blocked(e));
  }

  private toggleVoice() {
    this.sound = !this.sound;
    try { localStorage.setItem(VOICE_KEY, this.sound ? '1' : '0'); } catch { /* not fatal */ }
    this.renderVoice();
    this.audio.muted = !this.sound;
    if (this.sound && this.speaking && !this.paused) this.audio.play().catch(e => this.blocked(e));
  }

  private renderVoice() {
    const v = this.el.querySelector('.demo-voice')!;
    v.textContent = this.sound ? '🔊' : '🔈';
    v.classList.toggle('on', this.sound);
  }

  /** Play this beat's recorded narration (Higgsfield voice Naomi). */
  private narrate(i: number) {
    this.audio.pause();
    const file = `audio/demo/${lang() === 'en' ? '' : `${lang()}/`}beat-${String(i + 1).padStart(2, '0')}.mp3`;
    if (lang() !== 'en') {
      // play the locale's clip only if the file is there, otherwise the beat runs silent (captions only)
      this.audio.removeAttribute('src'); this.audio.load();
      this.speaking = false;
      const gen = this.gen;
      audioExists(`${import.meta.env.BASE_URL}${file}`).then(ok => {
        if (!ok || gen !== this.gen) return;
        this.audio.src = `${import.meta.env.BASE_URL}${file}`;
        this.audio.muted = !this.sound;
        this.audio.playbackRate = speed; // setting src can reset it
        this.speaking = true;
        this.audio.play().catch(e => this.blocked(e));
      });
      return;
    }
    this.audio.src = `${import.meta.env.BASE_URL}${file}`;
    this.audio.muted = !this.sound;
    this.audio.playbackRate = speed; // setting src can reset it
    this.speaking = true; // until the clip ends or fails to load
    this.audio.play().catch(e => this.blocked(e));
  }

  /** The browser refused autoplay (e.g. the page opened straight on #demo): carry on silently. */
  private blocked(e?: unknown) {
    // a play() cut short by skipping to another beat is not a blocked autoplay
    if ((e as DOMException | undefined)?.name === 'AbortError') return;
    this.speaking = false;
    if (this.sound) (this.el.querySelector('.demo-tap') as HTMLElement).hidden = false;
  }

  private unblock() {
    (this.el.querySelector('.demo-tap') as HTMLElement).hidden = true;
    this.sound = true; this.renderVoice();
    this.audio.muted = false;
    this.audio.currentTime = 0;
    this.speaking = true;
    this.audio.play().catch(e => this.blocked(e));
  }

  private stop() {
    this.gen++;
    this.resetSpeed();
    this.el.querySelector('.demo-cast')?.remove();
    this.audio.pause();
    this.world.cancelAll();
    this.el.remove();
  }

  private end() {
    this.gen++;
    this.resetSpeed();
    this.audio.pause();
    const card = document.createElement('div');
    card.className = 'overlay';
    card.innerHTML = `<div class="title-card glass">
      <div class="eyebrow">${M('end.eyebrow')}</div>
      <h1>${M('end.h1')}</h1>
      <p class="lede">${M('end.lede')}</p>
      <div class="title-actions"><button class="primary" data-n="play">${M('end.play')}</button><button class="ghost" data-n="again">${M('end.again')}</button><button class="ghost" data-n="title">${M('end.title')}</button></div>
    </div>`;
    this.el.appendChild(card);
    card.addEventListener('click', e => {
      const n = (e.target as HTMLElement).dataset.n as 'play' | 'again' | 'title' | undefined;
      if (!n) return;
      this.stop();
      this.finished(n);
    });
  }
}
