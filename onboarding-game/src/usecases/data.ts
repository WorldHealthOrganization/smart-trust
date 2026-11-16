import { t } from '../i18n';

/**
 * Use-case films shown under "Use cases" in the top bar.
 * To add one: put the video (and a poster frame) in public/video/ and add an entry here.
 * For a French version, also put it in public/video/ and set videoFr; the film page then shows an
 * English / Français switch. Page text comes from the i18n tables (keys data.ts:<id>.*); posters are per language.
 * Text is drawn from the story scripts for each film; keep it to what the film shows.
 */
export interface UseCase {
  id: string;            // used in the URL: #usecase/<id>
  title: string;
  subtitle: string;
  tag: string;           // short label on the card
  video: string;         // path under public/ (English)
  videoFr?: string;      // optional French version, path under public/
  poster: string;
  posterFr?: string;     // poster frame for the French version
  minutes: string;
  summary: string;       // one paragraph: what the film shows
  idea: string;          // the one line the viewer should leave with
  how: string[];         // how the GDHCN helps in this case
  why: string;           // why this use case matters
}

const D = (k: string) => t(`data.ts:${k}`);

export const USE_CASES: UseCase[] = [
  {
    id: 'icvp',
    title: D('icvp.title'),
    subtitle: D('icvp.subtitle'),
    tag: D('icvp.tag'),
    video: 'video/icvp-marys-yellow-card.mp4',
    videoFr: 'video/icvp-marys-yellow-card-fr.mp4',
    poster: 'video/icvp-marys-yellow-card.jpg',
    posterFr: 'video/icvp-marys-yellow-card-fr.jpg',
    minutes: D('icvp.minutes'),
    summary: D('icvp.summary'),
    idea: D('icvp.idea'),
    how: [1, 2, 3, 4].map(n => D(`icvp.how${n}`)),
    why: D('icvp.why'),
  },
  {
    id: 'maternal',
    title: D('maternal.title'),
    subtitle: D('maternal.subtitle'),
    tag: D('maternal.tag'),
    video: 'video/maternal-aminas-journey.mp4',
    videoFr: 'video/maternal-aminas-journey-fr.mp4',
    poster: 'video/maternal-aminas-journey.jpg',
    posterFr: 'video/maternal-aminas-journey-fr.jpg',
    minutes: D('maternal.minutes'),
    summary: D('maternal.summary'),
    idea: D('maternal.idea'),
    how: [1, 2, 3, 4].map(n => D(`maternal.how${n}`)),
    why: D('maternal.why'),
  },
];
