/**
 * Start-up: set the language, load its strings, then load the game.
 *
 * The strings come first because the scenario and the glossary are localised once, when their modules
 * load. The game (three.js and everything else) is a separate chunk behind the dynamic import, so the
 * page asks for it only after the strings are in.
 */
import { applyHtmlLang } from './i18n/lang';
import { loadStrings } from './i18n/strings';

applyHtmlLang();
void loadStrings().then(() => import('./app'));
