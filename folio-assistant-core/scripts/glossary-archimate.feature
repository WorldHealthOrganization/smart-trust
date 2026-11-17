Feature: ArchiMate depictions for glossary terms

  @test:scripts/glossary-archimate.test.ts::glossary-archimate::newestFirstReleaseBeforeDrafts
  Scenario: models sort newest first, a release before its drafts
    When model versions are sorted
    Then the newest comes first and a release before its drafts

  @test:scripts/glossary-archimate.test.ts::glossary-archimate::pagePathUsesSingularKindSegments
  Scenario: a depiction's page path uses singular kind segments
    When the page path of an element and of a view is made
    Then each is <base>/<version>/<kind>/<id>/ with the kind singular: element, view

  @test:scripts/glossary-archimate.test.ts::glossary-archimate::noModelNoDepictions
  Scenario: a repository with no ArchiMate model depicts nothing
    When depictions are asked of a repository with no model
    Then there are none
