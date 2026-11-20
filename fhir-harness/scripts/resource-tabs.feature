Feature: The Publisher's tab pages for a resource

  @test:scripts/resource-tabs.test.ts::tab_pages::historyHeadingAndSentence
  Scenario: history: heading names name ?? title ?? id, the sentence names id (measured on all 672)
    Then the history page of an Endpoint is headed by its name, its sentence names its id and it has no status
    And the history sentence of a logical model names it

  @test:scripts/resource-tabs.test.ts::tab_pages::testingTypeTitleExperimental
  Scenario: testing: type and title, (Experimental) when the resource says so, and NOTHING when the IG has tests
    Then the testing page of an experimental ValueSet is headed with its type, title and "(Experimental)", with its status and Test Plans and Test Scripts sections
    And there is no testing page when the IG has tests, or for a resource with no canonical
    And a logical model's testing page says no test plans are available for the Profile

  @test:scripts/resource-tabs.test.ts::tab_pages::examplesOnlyUnclaimedModel
  Scenario: examples: only for a logical model no resource claims
    Then a logical model no resource claims has an examples page
    And one that is claimed has none

  @test:scripts/resource-tabs.test.ts::tab_pages::statusLineAndEscaping
  Scenario: status line and escaping
    Then an Endpoint has no status line
    And Markdown underscores, asterisks and brackets are escaped

  @test:scripts/resource-tabs.test.ts::tab_pages::viewPagesOneRule
  Scenario: view pages are told apart from artefact pages by one rule
    Then every view page file name is recognised as a view page
    And an artefact page is not
