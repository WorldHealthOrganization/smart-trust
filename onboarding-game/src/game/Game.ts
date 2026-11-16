import { MOMENTS } from './scenario';
import { fill, getDomains, liveMoment, resetDomains, setDomains, settings } from './settings';
import { stripTips } from './glossary';
import { setFeedbackContext } from '../ui/feedback';
import { PHASES } from './scenario';
import { t } from '../i18n';
import type { Consequence, Moment, Travel } from './types';
import type { World } from '../world/World';
import { splash, type ChecklistMarks, type Detour, type UI } from '../ui/ui';
import { refsText } from './refs';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const SHOULD_NOT = t('ui.ts:desk.extraWrong');

export class Game {
  private index = 0;
  private days = 0;
  private flags = new Set<string>();
  private detours: Detour[] = [];
  private flaggedAt = new Map<string, string>(); // flag -> title of the moment where the call was made

  constructor(private world: World, private ui: UI) {}

  async run(start = 0) {
    resetDomains();
    this.ui.showChrome();
    this.idealStateBefore(start);
    for (this.index = start; this.index < MOMENTS.length; this.index++) {
      await this.play(MOMENTS[this.index]);
    }
    await this.finish();
  }

  /** Dev / facilitator jump to the end: debrief on the ideal path, then the splash. */
  async end() {
    resetDomains();
    this.ui.showChrome();
    this.idealStateBefore(MOMENTS.length);
    this.index = MOMENTS.length;
    await this.finish();
  }

  /** Starting part-way: the world and the clock look as if every earlier step went right. */
  private idealStateBefore(start: number) {
    this.days = MOMENTS.slice(0, start).reduce((s, m) => s + m.days, 0);
    const opened = MOMENTS.findIndex(m => m.success.effect === 'prod-open');
    this.world.setProdOpen(opened >= 0 && start > opened);
  }

  private async finish() {
    this.world.mark(null);
    this.ui.hideDesk();
    await this.world.flyTo('home');
    this.ui.strip(MOMENTS.length, this.detours);
    const ideal = MOMENTS.reduce((s, m) => s + m.days, 0);
    setFeedbackContext({ mode: 'debrief', where: t('feedback.ts:ctx.debrief'), days: this.days, detours: this.detours.length });
    await this.ui.debrief({ days: this.days, ideal, detours: this.detours });
    setFeedbackContext({ mode: 'debrief', where: t('feedback.ts:ctx.splash'), days: this.days, detours: this.detours.length });
    const next = await splash(document.getElementById('app')!, this.detours.length, getDomains());
    location.hash = next === 'demo' ? 'demo' : '';
    location.reload();
  }

  private refresh(m: Moment) {
    setFeedbackContext({
      mode: 'game', where: t('feedback.ts:ctx.game', { phase: m.phase, title: m.title }), phase: `${m.phase} · ${PHASES[m.phase]}`,
      moment: `${m.id} · ${m.title}`, steps: refsText(m.steps), days: this.days, detours: this.detours.length,
    });
    this.ui.hud(m);
    this.ui.stats(this.days, this.detours.length);
    this.ui.strip(this.index, this.detours);
  }

  private async play(m: Moment) {
    m = liveMoment(m); // the brief and prompt may name the trust domains chosen earlier
    this.refresh(m);
    this.world.mark(m.place);
    await this.world.flyTo(m.place, { desk: true });

    const tried = new Set<string>();
    let marks: ChecklistMarks | undefined; // a retry keeps the ticks and flags what was wrong
    for (;;) {
      if (m.type === 'watch') { await this.ui.watch(m); break; }

      if (m.type === 'checklist') {
        const cl = m.checklist!;
        const picked = new Set(await this.ui.checklist(m, marks));
        const items = cl.items;
        const missingIdx = items.flatMap((it, i) => it.required && !picked.has(i) ? [i] : []);
        const wrongIdx = items.flatMap((it, i) => !it.required && !it.domain && picked.has(i) ? [i] : []);
        const chosen = items.flatMap((it, i) => it.domain && picked.has(i) ? [it.domain] : []);
        const noDomains = chosen.length < (cl.minDomains ?? 0);
        if (!missingIdx.length && !wrongIdx.length && !noDomains) {
          if (cl.minDomains !== undefined) setDomains(chosen);
          break;
        }
        const extra = [
          ...wrongIdx.map(i => `${SHOULD_NOT} ${items[i].text}. ${items[i].why ?? ''}`),
          ...missingIdx.map(i => `${t('ui.ts:desk.extraMissing')} ${items[i].text}`),
          ...(noDomains ? [t('ui.ts:desk.extraDomain')] : []),
        ];
        marks = { picked: [...picked], wrong: wrongIdx, missing: missingIdx, noDomains };
        await this.setBack(m, cl.consequence, { extra });
        continue;
      }

      const picked = await this.ui.ask(m, tried);
      const choice = m.choices!.find(c => c.id === picked)!;
      if (choice.correct) break;
      if (choice.flag) { this.flags.add(choice.flag); this.flaggedAt.set(choice.flag, m.title); break; } // looks fine today, fails later
      tried.add(choice.id);
      await this.setBack(m, choice.consequence!);
    }

    this.ui.hideDesk();
    await this.succeed(m);
    this.days += m.days;
    this.ui.stats(this.days, this.detours.length);
  }

  /** Something comes back: animate it, count the days, explain it. */
  private async setBack(m: Moment, c: Consequence, opts: { fix?: string; extra?: string[]; origin?: string } = {}) {
    this.ui.hideDesk();
    if (c.travel) {
      await this.world.flyTo('home', { dur: 1.1 });
      await this.world.travel(c.travel.legs, c.travel.label, c.travel.kind, { bounce: c.title });
    }
    if (c.bot) this.world.bot.setMood('error');
    this.days += c.days;
    const why = c.why || opts.extra?.filter(x => x.startsWith(SHOULD_NOT)).join(' ') || c.what;
    const detour: Detour = { index: this.index, title: c.title, steps: c.steps, why, days: c.days, origin: opts.origin };
    this.detours.push(detour);
    this.refresh(m);
    if (c.travel) await this.world.flyTo(m.place, { desk: true, dur: 1.1 });
    if (await this.ui.returned(c, opts) === 'back') { // undo: the detour and its days never happened
      this.detours.splice(this.detours.indexOf(detour), 1);
      this.days -= c.days;
      this.refresh(m);
    }
    if (c.bot) this.world.bot.setMood('idle');
  }

  private async send(t: Travel) {
    await this.world.travel(t.legs, t.label, t.kind);
  }

  private async succeed(m: Moment) {
    const s = m.success;

    if (s.effect === 'bot-collect') await this.botCollect(m);

    // earlier mistakes caught at this point in the process
    for (const chk of m.checks ?? []) {
      if (chk.flag === 'webtag' || !this.flags.has(chk.flag)) continue;
      await this.setBack(m, chk.consequence, { fix: chk.fix, origin: this.flaggedAt.get(chk.flag) });
      this.flags.delete(chk.flag);
      this.ui.toast(t('Game.ts:fixed'), 'info', 2200);
    }

    if (s.travel?.length) {
      await this.world.flyTo('home', { dur: 1.2 });
      for (const t of s.travel) await this.send(t);
    }
    if (m.id === 'airgap') this.world.pulseAnchor();
    if (s.effect === 'prod-open') {
      this.world.setProdOpen(true);
      this.world.pulseGateway('prod', '#4fe0a0');
    }
    if (s.effect === 'live') {
      this.world.pulseGateway('prod', '#4fe0a0');
      this.world.bot.setMood('happy');
      this.ui.toast(t('Game.ts:live', { country: settings().country }), 'ok', 4200);
      await wait(2200);
      this.world.bot.setMood('idle');
      return;
    }
    this.ui.toast(stripTips(fill(s.note)), 'ok');
    await wait(900);
  }

  private async botCollect(m: Moment) {
    const bot = this.world.bot;
    await this.world.flyTo('github', { dur: 1.2, zoomOut: 1.15 });
    await this.world.botTo('github');
    bot.setMood('checking');
    await wait(2200);
    const chk = m.checks?.find(c => c.flag === 'webtag');
    if (chk && this.flags.has('webtag')) {
      bot.setMood('error');
      await wait(900);
      await this.setBack(m, chk.consequence, { fix: chk.fix, origin: this.flaggedAt.get('webtag') });
      this.flags.delete('webtag');
      await this.world.flyTo('github', { dur: 1, zoomOut: 1.15 });
      bot.setMood('checking');
      await wait(1800);
    }
    bot.setMood('happy');
    await wait(1400);
    await this.world.travel([['github-ops', 1]], t('Demo.ts:parcel.6a'), 'key');
    await this.world.botTo('ops');
    bot.setMood('idle');
  }
}
