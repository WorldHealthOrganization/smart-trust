Feature: What an IG reader may read: the contentTypes.ig include list

  @test:scripts/ig-read-scope.test.ts::igReadScope::declaresOnlyIncludeList
  Scenario: declares only the include list, and reaches the directories leading to it
    Given an IG declaring sushi-config.yaml and input/fsh
    Then it is not legacy
    And sushi-config.yaml and FSH files are declared, CQL files and notes are not
    And "input" is reached on the way and "input/cql" is not
    And asking for an undeclared path throws "not declared in contentTypes.ig.include"

  @test:scripts/ig-read-scope.test.ts::igReadScope::refusesSectionDeclaringNothing
  Scenario: refuses a section that declares nothing rather than reading everything
    Then a section with an empty include throws "declares nothing usable"

  @test:scripts/ig-read-scope.test.ts::igReadScope::legacyWarnsOnce
  Scenario: reads a repository with no section as a legacy IG, and warns once naming the declaration
    Given an IG with no ig section
    When its read scope is taken twice
    Then it is legacy and declares any path
    And one warning is given, saying it declares no contentTypes.ig

  @test:scripts/ig-read-scope.test.ts::copyDeclared_and_onlyDeclared::copyDeclaredOnly
  Scenario: copies the declaration and the include entries, and nothing else
    Given an IG declaring some paths
    Then it is not only declared paths
    When the declared paths are copied
    Then the declaration and the included entries are copied and nothing else
    And the copy holds only declared paths

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::fshConeSkipsUndeclaredCql
  Scenario: fsh-cone reads FSH and leaves undeclared CQL alone
    Then the FSH graph of the declared IG has its FSH nodes and no CQL node

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::fshConeReadsLegacy
  Scenario: fsh-cone still reads everything in a legacy IG
    Then the FSH graph of a legacy IG includes its CQL library

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::indexesReadDeclaredOnly
  Scenario: build-ig-indexes reads no undeclared images, and the declared sushi-config
    Then contexts are not read from undeclared images
    And the FHIR version is read from the declared sushi-config and not from an undeclared one
    And contexts are read when input/images is declared

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::repoSiteCopiesDeclared
  Scenario: ig-repo-site copies only the declared source, and takes no title it may not read
    Then copying the IG source copies the declaration and the declared paths and no notes
    And the title is read from a declared sushi-config and not from an undeclared one

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::menuRefusesUndeclaredSushi
  Scenario: ingest-ig-menu refuses an undeclared sushi-config.yaml
    Then building the menu of an IG that does not declare sushi-config.yaml throws "not declared in contentTypes.ig.include"

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::apiHubDeclaredPagesOnly
  Scenario: the IG API hub looks only in declared pages
    Then the hub marker is found on a declared page
    And it is not found when the pages are not declared

  @test:scripts/ig-read-scope.test.ts::the_IG_readers,_gated::siteStagesDeclaredPages
  Scenario: build-ig-site stages only declared pages, and leaves the source as it was
    Given an IG declaring only its index page, with another page on disk
    When it is staged
    Then only the index page is staged and the other page is left in the source
    And a legacy IG stages both pages
