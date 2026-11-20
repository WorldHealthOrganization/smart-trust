Feature: staging a folio's site locally

  @test:scripts/stage-folio-local.test.ts::stagingSlugProblem::acceptsBranchSlugs
  Scenario: accepts the slugs feature-staging derives from a branch
    When slugs a branch derives are checked
    Then each is accepted

  @test:scripts/stage-folio-local.test.ts::stagingSlugProblem::refusesUnsafeSlugs
  Scenario: refuses anything that is not one safe path segment
    When empty, dotted, climbing, slashed, hidden, spaced, too long and missing slugs are checked
    Then each is refused

  @test:scripts/stage-folio-local.test.ts::resolveSitePath::resolvesPageAndDirectory
  Scenario: resolves a page, and a directory to its index.html
    When "/" and "/a/?q=1" are resolved
    Then they give the root's and a's index.html

  @test:scripts/stage-folio-local.test.ts::resolveSitePath::neverOutsideSite
  Scenario: never resolves outside the site, by spelling or by link
    When climbing, encoded, linked, malformed and missing paths are resolved
    Then none resolves

  @test:scripts/stage-folio-local.test.ts::resolveSitePath::serverLoopback404
  Scenario: the server answers 404 for a refused path, and listens on loopback only
    When the site is served
    Then it listens on 127.0.0.1 and serves a page
    And refused paths answer 404
