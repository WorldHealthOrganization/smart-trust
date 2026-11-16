import { MOMENTS, PHASES, ROLES } from './scenario';
import type { Moment } from './types';
import { lang, t } from '../i18n';
import { en } from '../i18n/en';
import { localiseMoments, localiseStatic } from '../i18n/overlay';
import { deName } from '../i18n/typography';

export type Person = 'business' | 'keymaster' | 'legal' | 'technical';

export interface Settings {
  country: string;
  code: string;
  names: Record<Person, string>;
}

export const DEFAULTS: Settings = {
  country: t('settings.ts:DEFAULTS.country'),
  code: 'XXC',
  names: { business: 'Dr Zawadi Nkosi', keymaster: 'Kwame Mensah', legal: 'Sara Diallo', technical: 'Tendai Banda' },
};

/**
 * Trust domains the player applies for this run: zero, one or more (owner, 2026-11-11). DDCC until
 * chosen (dev jumps, the demo). Zero is a real choice: the country joins the Gateway with the Letter
 * for no trust domain and joins trust domains later ("Join a further Trust Domain").
 */
const DEFAULT_DOMAINS = ['DDCC'];
let domains: string[] = [...DEFAULT_DOMAINS];
export const getDomains = () => domains;
export const setDomains = (d: string[]) => { domains = [...d]; };
export const resetDomains = () => { domains = [...DEFAULT_DOMAINS]; };
export const joinList = (d: string[]) => d.length < 2 ? d.join('') : `${d.slice(0, -1).join(', ')}${t('settings.ts:domains.and')}${d[d.length - 1]}`;
/** Tokens that change during a run: left alone when the scenario is built, filled as each moment plays. */
const LIVE = new Set(['domains', 'domainCount', 'domainLetters']);

const KEY = 'gdhcn-game-settings';
localiseStatic(PHASES, ROLES); // French phase names and role titles, in place
const TEMPLATE: Moment[] = localiseMoments(structuredClone(MOMENTS)); // French overlay on a clone; English stays the source
let current: Settings = structuredClone(DEFAULTS);

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Settings>;
      // a country saved while the other language was on is still the sample country: show this language's name
      if (s.country === en['settings.ts:DEFAULTS.country'] || s.country === 'Pays XC') s.country = DEFAULTS.country;
      const code = typeof s.code === 'string' && s.code.length === 2 ? alpha3(s.code) : s.code; // older versions stored 2 letters
      return { ...DEFAULTS, ...s, ...(code ? { code } : {}), names: { ...DEFAULTS.names, ...(s.names ?? {}) } };
    }
  } catch { /* private window or blocked storage: fall back to defaults */ }
  return structuredClone(DEFAULTS);
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not fatal */ }
}

export const settings = () => current;

// ISO 3166-1 alpha-2 -> alpha-3. Repository names must carry the 3-letter code (onboarding checklist).
const ALPHA3: Record<string, string> = Object.fromEntries(('AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW AX:ALA AZ:AZE ' +
  'BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ ' +
  'CA:CAN CC:CCK CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE ' +
  'DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA ' +
  'GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY ' +
  'HK:HKG HM:HMD HN:HND HR:HRV HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM JO:JOR JP:JPN ' +
  'KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO LB:LBN LC:LCA LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY ' +
  'MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ ' +
  'NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI PS:PSE PT:PRT PW:PLW PY:PRY ' +
  'QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA SA:SAU SB:SLB SC:SYC SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ ' +
  'TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB ' +
  'VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR VN:VNM VU:VUT WF:WLF WS:WSM YE:YEM YT:MYT ZA:ZAF ZM:ZMB ZW:ZWE').split(' ').map(p => p.split(':')));


const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');

const ALIASES: Record<string, string> = {
  'ivory coast': 'CIV', "cote d'ivoire": 'CIV', 'drc': 'COD', 'democratic republic of the congo': 'COD', 'dr congo': 'COD',
  'republic of the congo': 'COG', 'congo-brazzaville': 'COG', 'tanzania': 'TZA', 'turkey': 'TUR', 'turkiye': 'TUR',
  'uk': 'GBR', 'great britain': 'GBR', 'britain': 'GBR', 'usa': 'USA', 'america': 'USA', 'united states of america': 'USA',
  'russia': 'RUS', 'south korea': 'KOR', 'korea': 'KOR', 'north korea': 'PRK', 'eswatini': 'SWZ', 'swaziland': 'SWZ',
  'cape verde': 'CPV', 'cabo verde': 'CPV', 'laos': 'LAO', 'vietnam': 'VNM', 'viet nam': 'VNM', 'syria': 'SYR', 'iran': 'IRN',
  'bolivia': 'BOL', 'venezuela': 'VEN', 'czech republic': 'CZE', 'czechia': 'CZE', 'the gambia': 'GMB', 'gambia': 'GMB',
};

let nameIndex: Map<string, string> | undefined;
/** Normalised English country name -> alpha-3, built from the ALPHA3 keys so no country list is typed by hand. */
function names() {
  if (!nameIndex) {
    nameIndex = new Map();
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' });
      for (const [a2, a3] of Object.entries(ALPHA3)) {
        const n = dn.of(a2);
        if (n && n !== a2) nameIndex.set(norm(n), a3);
      }
    } catch { /* no Intl.DisplayNames: aliases and the fallback still work */ }
    for (const [k, v] of Object.entries(ALIASES)) nameIndex.set(norm(k), v);
  }
  return nameIndex;
}

const REAL_CODES = new Set(Object.values(ALPHA3));

/** A made-up country gets a made-up code that is not mistaken for a real one: Catopia -> CAT. */
function invented(name: string) {
  const L = name.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  const consonants = [...L.slice(1)].filter(c => !'AEIOU'.includes(c));
  const pad = (s: string) => (s + 'XXX').slice(0, 3);
  const candidates = [pad(L.slice(0, 3)), pad(L.slice(0, 1) + consonants.slice(0, 2).join('')), pad(L.slice(0, 2)), pad(L.slice(0, 1))];
  return candidates.find(c => !REAL_CODES.has(c)) ?? 'XXC';
}

/** "South Africa" -> ZAF, "Côte d'Ivoire" -> CIV, "Catopia" -> CAT. Empty name gives an empty code. */
export function deriveCode(name: string) {
  const n = norm(name);
  if (!n) return '';
  const idx = names();
  const exact = idx.get(n);
  if (exact) return exact;
  if (n.length >= 4) {
    const hits = new Set([...idx].filter(([k]) => k.startsWith(n)).map(([, v]) => v));
    if (hits.size === 1) return [...hits][0];
  }
  return invented(name);
}

/** "KE" -> KEN; a 3-letter code is kept; an unknown (sample) code is padded with X, so XC -> XXC. */
export function alpha3(code: string) {
  const c = code.toUpperCase();
  return c.length === 3 ? c : ALPHA3[c] ?? `X${c}`.slice(0, 3);
}

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const parts = (full: string) => full.replace(/^(?:(?:dr|prof|mr|mrs|ms|hon|pr|mme|mlle)\.?|m\.)\s+/i, '').trim().split(/\s+/);
const first = (full: string) => parts(full)[0] ?? full;
const initials = (full: string) => parts(full).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

export function tokens(s: Settings): Record<string, string> {
  const code = s.code.toUpperCase();
  const code3 = alpha3(code);
  const domain = 'health.gov'; // one neutral government domain; country codes in addresses confused players
  const km = parts(s.names.keymaster).map(ascii).filter(Boolean);
  const kmLocal = km.length > 1 ? `${km[0]}.${km[km.length - 1]}` : km[0] ?? 'keymaster';
  return {
    country: s.country, code: code3, codeLower: code3.toLowerCase(), code3, code3Lower: code3.toLowerCase(), domain,
    business: s.names.business, keymaster: s.names.keymaster, legal: s.names.legal, technical: s.names.technical,
    keymasterFirst: first(s.names.keymaster), legalFirst: first(s.names.legal), technicalFirst: first(s.names.technical),
    keymasterEmail: `${kmLocal}@${domain}`, keymasterPersonal: `${kmLocal}@gmail.com`,
    domains: domains.length ? joinList(domains) : t('settings.ts:domains.none'), domainCount: String(domains.length),
    domainLetters: t(domains.length === 0 ? 'settings.ts:letter.zero' : domains.length === 1 ? 'settings.ts:letter.one' : 'settings.ts:letter.other', { n: domains.length }),
  };
}

export function fill(text: string, s: Settings = current, keepLive = false) {
  const tk = tokens(s);
  // French: "de {country}" elides before a vowel (d'Ethiopie)
  if (lang() === 'fr') text = text.replace(/\b(de|De) \{country\}/g, (_m, d: string) => deName(d, tk.country));
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (keepLive && LIVE.has(k) ? undefined : tk[k]) ?? m);
}

/** The words of a moment that mention the run's trust domains, filled with the current choice. */
export function liveMoment(m: Moment): Moment {
  return { ...m, brief: fill(m.brief), prompt: fill(m.prompt) };
}

function deepFill<T>(v: T, s: Settings): T {
  if (typeof v === 'string') return fill(v, s, true) as T;
  if (Array.isArray(v)) return v.map(x => deepFill(x, s)) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepFill(x, s)])) as T;
  }
  return v;
}

/** Make the chosen country and people the ones the whole game talks about. */
export function applySettings(s: Settings) {
  current = s;
  MOMENTS.splice(0, MOMENTS.length, ...deepFill(TEMPLATE, s));
  for (const k of Object.keys(s.names) as Person[]) {
    ROLES[k].name = s.names[k];
    ROLES[k].initials = initials(s.names[k]) || ROLES[k].initials;
  }
}
