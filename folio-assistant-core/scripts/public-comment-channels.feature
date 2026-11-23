Feature: the channels a public-comment release goes out on

  @test:scripts/public-comment-channels.test.ts::release_references::releaseReferences
  Scenario: sections as a reader cites them, printed pages, captions
    When the release's references are read
    Then sections are as a reader cites them, with printed pages, captions and the PDF digest

  @test:scripts/public-comment-channels.test.ts::the_offline_sheet_comes_back_through_the_importer::offlineSheetImported
  Scenario: a filled sheet is a comment matrix, and check flags references outside the release
    Given the offline sheet filled with a name, a valid row and a row outside the release
    When it is read back by the importer and checked
    Then it has the Instructions, Comments and References sheets
    And two rows are read with the reviewer and the caption
    And the section and page outside the release are flagged

  @test:scripts/public-comment-channels.test.ts::GitHub_issues_come_back_as_a_form_export::issueFormFields
  Scenario: form fields, _No response_ as empty
    When an issue body's form fields are read
    Then a field is read and "_No response_" is empty

  @test:scripts/public-comment-channels.test.ts::GitHub_issues_come_back_as_a_form_export::onlyReleaseIssues
  Scenario: only this release's issues, read by the importer with consent
    When issues are exported as CSV and read by the importer
    Then only the release's issue is read, with its channel, reviewer and text

  @test:scripts/public-comment-channels.test.ts::the_form_and_issue_form_offer_only_the_release's_references::issueFormOptions
  Scenario: issue form options
    When the issue form is made
    Then it offers every section of the release and titles issues with the release

  @test:scripts/public-comment-channels.test.ts::the_form_and_issue_form_offer_only_the_release's_references::googleFormScript
  Scenario: google form script embeds the lists and parses
    When the Google Form script is made
    Then it embeds the sections and parses as JavaScript
