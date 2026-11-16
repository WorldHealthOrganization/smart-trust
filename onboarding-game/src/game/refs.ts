import ST from '../generated/smart-trust.json';
import { lang } from '../i18n/lang';
import { t } from '../i18n';

/**
 * Where a moment sits in smart-trust's onboarding business processes. A ref is
 * `<process file stem>#<task id>` (for example `GDHCN.ONB.Apply#A.P.Interest`) or
 * `page:<IG page>` for guidance that is not a process. Names come from the BPMN and its
 * translations in smart-trust (src/generated/smart-trust.json, written at build time by
 * scripts/smart-trust-content.mjs), so the game says what the IG says, in the reader's language.
 */
type Localised = Record<string, string> & { en: string };
interface Process { title: Localised; anchor: string; tasks: Record<string, Localised> }

const PROCESSES = ST.processes as unknown as Record<string, Process>;
const pick = (l: Localised): string => l[lang()] ?? l.en;

export interface RefView { process: string; task: string; href: string }

/** One ref, resolved: its process and task names in the current language, and its IG link. */
export function resolveRef(ref: string): RefView {
  if (ref.startsWith('page:')) {
    const page = ref.slice(5);
    return { process: t(`refs:page.${page}`), task: '', href: `${ST.igBase}${page}.html` };
  }
  const [stem, task] = ref.split('#');
  const p = PROCESSES[stem];
  return { process: pick(p.title), task: pick(p.tasks[task]), href: `${ST.igBase}${ST.processPage}#${p.anchor}` };
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plain text for a list of refs: "Process › Task; Process › Task". For feedback rows and titles. */
export function refsText(refs: readonly string[]): string {
  return refs.map(resolveRef).map(r => (r.task ? `${r.process} › ${r.task}` : r.process)).join('; ');
}

/** The chips for a list of refs, each linking to its process on the IG page (opens in a new tab). */
export function refsChips(refs: readonly string[]): string {
  return refs
    .map(resolveRef)
    .map(r => `<a class="chip steps" href="${esc(r.href)}" target="_blank" rel="noopener" title="${esc(t('refs:openInIg'))}">${esc(r.task ? `${r.process} › ${r.task}` : r.process)}</a>`)
    .join(' ');
}

/** The trust domains defined in smart-trust (its TrustDomain instances). */
export const TRUST_DOMAINS = ST.trustDomains as { code: string; name: string; description: string; page: string }[];
export const IG_BASE = ST.igBase as string;
