import { translated } from '../i18n/strings';
import { typo } from '../i18n/typography';

/**
 * Glossary for hover/tap tooltips. Content strings may carry markup:
 *   [[key]]               shows GLOSSARY[key].term
 *   [[key|display text]]  shows the display text
 * Never put markup in choice text, checklist text or moment titles: a tap on a term
 * inside a button would select the answer.
 */
export const GLOSSARY_EN: Record<string, { term: string; def: string }> = {
  github: {
    term: 'GitHub',
    def: "GitHub is a website for storing code and files in repositories, with a full history of every change. In GDHCN onboarding, each country keeps its public keys and certificates in its own private GitHub repositories, and WHO's tng-bot collects them from there.",
  },
  repo: {
    term: 'Private repository',
    def: 'A folder on GitHub with version history. Private means only the people and bots you invite can see it.',
  },
  top: {
    term: 'Terms of Participation (TOP)',
    def: 'The five commitments, TOP0 to TOP4, that every GDHCN participant accepts: from following the technical specifications to meeting legal and policy standards.',
  },
  sca: {
    term: 'SCA · Signing Certificate Authority',
    def: "Your country's own trust anchor. Its private key signs your Document Signer Certificates and is kept offline.",
  },
  dsc: {
    term: 'DSC · Document Signer Certificate',
    def: 'Signs the health documents, such as vaccination certificates, that verifiers check.',
  },
  tls: {
    term: 'TLS client certificate',
    def: "Proves your backend's identity when it connects to the Gateway (mutual TLS).",
  },
  upload: {
    term: 'Upload certificate',
    def: 'Signs the packages of certificates your country uploads to the Gateway.',
  },
  dev: { term: 'DEV', def: 'Development environment. Optional, for early technical trials.' },
  uat: {
    term: 'UAT',
    def: 'User Acceptance Testing: the test gateway where you prove everything works before production. Test keys only.',
  },
  prod: { term: 'PROD', def: 'Production: the live Trust Network Gateway. Real keys, signed offline by WHO.' },
  tngbot: {
    term: 'tng-bot',
    def: "WHO's automated GitHub account. tng-bot-dev serves DEV and UAT; tng-bot serves PROD. It only reads repositories it is invited to.",
  },
  gpg: {
    term: 'GPG key',
    def: 'A personal key pair each named person uses to sign. WHO checks the email inside it against the Letter of Application.',
  },
  anchor: {
    term: 'Trust Anchor',
    def: "WHO's top-level key that signs every country's PROD keys. It is kept offline, never on the Gateway.",
  },
  gateway: {
    term: 'Trust Network Gateway',
    def: "WHO's server where participants exchange public keys and trust lists.",
  },
};

/** Each term in the current language: the loaded `glossary:<term>.term|def` strings over the English. */
export const GLOSSARY: Record<string, { term: string; def: string }> = Object.fromEntries(
  Object.entries(GLOSSARY_EN).map(([k, g]) => [k, {
    term: typo(translated(`glossary:${k}.term`) ?? g.term),
    def: typo(translated(`glossary:${k}.def`) ?? g.def),
  }]),
);

const MARK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Plain display text for a markup match: display text, else the glossary term, else the key. */
function display(key: string, shown?: string) {
  return shown ?? GLOSSARY[key]?.term ?? key;
}

/** Markup to HTML. Known keys become a tooltip trigger; unknown keys become plain text. */
export function renderTips(text: string): string {
  return text.replace(MARK, (_m, key: string, shown?: string) => {
    const k = key.trim();
    const label = display(k, shown);
    return GLOSSARY[k] ? `<span class="tip" tabindex="0" data-tip="${esc(k)}">${label}</span>` : label;
  });
}

/** Markup to plain text, for anywhere that is not HTML (title attributes, textContent, feedback). */
export function stripTips(text: string): string {
  return text.replace(MARK, (_m, key: string, shown?: string) => display(key.trim(), shown));
}
