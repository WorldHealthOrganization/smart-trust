Feature: Choosing which IG sites to stage, and the routes they reserve

  @test:scripts/stage-ig-sites.test.ts::declaredGitSourceBuilt
  Scenario: an instance whose declaration records a git source is built from that declared source
    Given an instance whose declaration records a git source
    Then it is built from that repository at "def456"

  @test:scripts/stage-ig-sites.test.ts::menuSushiSourceBuilt
  Scenario: an instance whose menu records a sushi-config source is built, from that commit
    Given an instance whose menu records a sushi-config source
    Then it is built from that repository at "abc123"

  @test:scripts/stage-ig-sites.test.ts::noSourceSkippedReported
  Scenario: a menu with no source is skipped AND reported; no menu at all is simply not an IG
    Given an instance whose menu records no source, and a directory with no menu
    Then only the first is skipped, with the reason that neither its declaration nor its menu records a source

  @test:scripts/stage-ig-sites.test.ts::igSiteReservesServedPaths
  Scenario: an igSite instance reserves each served directory's path, so its IG's input/images copy does not take that route
    Given an instance with an igSite docs directory, a served directory not in the checkout and an unserved directory
    Then the served directory's route is reserved, naming the directory

  @test:scripts/stage-ig-sites.test.ts::servedFilesReservedEach
  Scenario: a served directory the checkout holds reserves each of its files, not the whole route
    Given an instance whose served directory holds two files
    Then each file's path is reserved, not the whole route

  @test:scripts/stage-ig-sites.test.ts::igAtSubdirReservesNothing
  Scenario: an IG site at /<instance>/ig/ reserves nothing: no served route can meet it
    Given an instance with a docs directory that is not an IG site, and a served directory
    Then its IG site is at "ig"
    And nothing is reserved

  @test:scripts/stage-ig-sites.test.ts::noPagesIgAtRoot
  Scenario: an instance with no pages of its own gets its IG at /<instance>/, and reserves its served routes
    Given an instance with only a served directory
    Then its IG site is at "."
    And the served route is reserved
