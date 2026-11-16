import { lang } from './lang';

const NBSP = '\u00A0';

/**
 * French typography: a plain space before : ; ! ? » and after « becomes a non-breaking space.
 * Only a space already in the text is touched, so URLs, e-mail addresses and "https://" are safe.
 * Do not call this on terminal lines or code.
 */
export function frTypo(s: string): string {
  return s
    .replace(/ +([:;!?»])/g, `${NBSP}$1`)
    .replace(/(«) +/g, `$1${NBSP}`);
}

/** Apply French typography when the site is French, else return the text unchanged. */
export const typo = (s: string): string => (lang() === 'fr' ? frTypo(s) : s);

/** "de" + a name, with elision: Ethiopie -> "d'Ethiopie", Kenya -> "de Kenya". French only; English gets "of". */
export function deName(prefix: string, name: string): string {
  return /^[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜHaeiouyàâäéèêëîïôöùûüh]/.test(name.trim()) ? `${prefix === 'De' ? 'D' : 'd'}'${name}` : `${prefix} ${name}`;
}
