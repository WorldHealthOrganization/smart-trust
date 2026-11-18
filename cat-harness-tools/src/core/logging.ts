/**
 * Folio Assistant — Logging utilities.
 *
 * @module folio-assistant/core/logging
 */

const LOG_DEBUG = process.env.LOG_LEVEL !== "quiet";
const LOG_JSON = process.env.LOG_FORMAT === "json";

export function log(category: string, message: string, detail?: string): void {
  const ts = new Date().toISOString();
  if (LOG_JSON) {
    const entry: Record<string, unknown> = { ts, cat: category, msg: message };
    if (detail) entry.detail = detail;
    console.error(JSON.stringify(entry));
  } else {
    const d = detail ? ` ${detail}` : "";
    console.error(`[${ts.slice(11, 23)}] [${category}]  ${message}${d}`);
  }
}

export function logDebug(category: string, message: string, detail?: string): void {
  if (LOG_DEBUG) log(category, message, detail);
}
