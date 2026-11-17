Feature: the review sheet script's security

  @test:tools/review-sheet-sync/review-sheet-security.test.ts::review-sheet.gs_security::onlyCurrentDoc
  Scenario: limits itself to the sheet it is bound to
    When the script is read
    Then it declares @OnlyCurrentDoc

  @test:tools/review-sheet-sync/review-sheet-security.test.ts::review-sheet.gs_security::onlyOwnSheetServices
  Scenario: uses only the services that need no access beyond its own sheet
    When the services the code uses are listed
    Then they are LockService, PropertiesService, ScriptApp and SpreadsheetApp

  @test:tools/review-sheet-sync/review-sheet-security.test.ts::review-sheet.gs_security::noFetchMailFilesEval
  Scenario: never fetches, mails, opens other files or runs strings as code
    When the code is searched for fetches, mail, other files and code from strings
    Then none is found

  @test:tools/review-sheet-sync/review-sheet-security.test.ts::review-sheet.gs_security::recordedScopes
  Scenario: the recorded scopes are this sheet, triggers and a menu, and nothing else
    When the manifest's scopes are read
    Then they are this sheet, triggers and the container UI
