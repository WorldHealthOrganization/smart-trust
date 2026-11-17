Feature: The site build stamp and drift between sibling sites

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::rebuildWorkflowInstalled
  Scenario: rebuilds a dependency with the workflow the IG repository template installs
    Then the rebuild workflow is "site-publish.yml" and the IG repository template installs it

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::stampsPlatformAndSource
  Scenario: stamps the platform commit and the source it was built from
    Then the stamp names the platform commit and the source repository, branch and commit
    And it parses back to itself

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::refusesNonStamp
  Scenario: refuses anything that is not a stamp, as a reason rather than a build
    Then HTML is refused as not JSON
    And an empty object is refused as not a folio-site-build/v1

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::driftAndNotChecked
  Scenario: reports a different platform as drift, and an unreadable stamp as not checked — never as matching
    Given a sibling on the same platform, one on a different platform and one with no stamp
    Then their states are same, different and not checked
    And the report marks the different and the not-checked siblings and counts each
    And it does not say every sibling matches

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::noSiblingSaysSo
  Scenario: says when no sibling is configured, rather than reporting a clean comparison
    Then a report with no siblings says nothing was compared

  @test:scripts/site-build-stamp.test.ts::site-build-stamp::parsesRepoWithRef
  Scenario: parses a dependency as owner/repo with an optional ref
    Then "acme/base-ig@claude/seed" gives the repository and the ref
    And "o/r" defaults to main
    And "nonsense" is not a repository
