/**
 * Security gate for the review sheet's Apps Script. People paste Code.gs into
 * a sheet they own and authorise it, so what it may touch is pinned here:
 * only its own spreadsheet, its own triggers and its own menu.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dir;
const gs = readFileSync(join(here, "review-sheet.gs"), "utf8");
const code = gs.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const manifest = JSON.parse(readFileSync(join(here, "appsscript.json"), "utf8"));

describe("review-sheet.gs security", () => {
  test("onlyCurrentDoc", () => {
    expect(gs).toContain("@OnlyCurrentDoc");
  });

  test("onlyOwnSheetServices", () => {
    const used = new Set(code.match(/\b[A-Z][A-Za-z]*(?:App|Service)\b/g) ?? []);
    expect([...used].sort()).toEqual(["LockService", "PropertiesService", "ScriptApp", "SpreadsheetApp"]);
  });

  test("noFetchMailFilesEval", () => {
    for (const bad of [/\bUrlFetchApp\b/, /\bGmailApp\b/, /\bMailApp\b/, /\bDriveApp\b/, /\bDocumentApp\b/, /\bopenBy(Id|Url)\b/,
      /\beval\s*\(/, /\bnew\s+Function\b/, /\bHtmlService\b/, /\bsetTimeout\s*\(\s*['"]/]) {
      expect(bad.test(code)).toBe(false);
    }
  });

  test("recordedScopes", () => {
    expect(manifest.oauthScopes).toEqual([
      "https://www.googleapis.com/auth/spreadsheets.currentonly",
      "https://www.googleapis.com/auth/script.scriptapp",
      "https://www.googleapis.com/auth/script.container.ui",
    ]);
  });
});
