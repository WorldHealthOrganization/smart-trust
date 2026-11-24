Feature: gen-l1-extraction-pages writes the l1-extraction viewer's pages
  Over a scratch checkout of two instances, one holding an L1 extraction in a
  library entry and one declaring an extraction not on disk, the generator
  writes a hub and one page per instance into a site.

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::toolDeclaresKindSiteFlagNoRequired
  Scenario: the Tool declares the kind it renders, the site flag, and no required input
    Given the Tool "l1-extraction-pages"
    Then it renders "l1-extraction"
    And its "site" input is passed as "--site"
    And it has no required input

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::writesHubAndInstancePagesOnly
  Scenario: writes the hub and one page per declaring instance at the declared route, and nothing else
    When the generator is run with --site
    Then it exits 0 with no "error" on stderr
    And the files written are exactly the hub, the lib page and the remote page
    And each says "rendered-by: l1-extraction-pages"

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::showsStatementsCandidatesGraphs
  Scenario: shows the statements, the candidates with counts and decisions, and the graphs
    Given the lib page
    Then it shows "L1 statements (2)", the identifier R1 and its evidence location sections/page-001.md
    And it counts 1 "exclude" decision and a capturedPct of 66.7
    And it shows "Every candidate (3)" and 2 user-scenario nodes
    And it says "1 decision(s): 1 exclude" and "Inside the library entry entry-1"

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::linksPublishedCopyOnlyWhereHeld
  Scenario: links a file to its published copy only where the site holds one
    Given the site holds a published copy of the extraction's l1.json only
    Then the lib page links l1.json to its published copy
    And it does not link recommendation-candidates.json as published

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::unparseableFileSaysNotRead
  Scenario: a file that does not parse says so and is not counted
    Then the lib page says "not read: does not parse" for the broken file

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::absentDirectoryIsUnknownNotZero
  Scenario: a declared directory not in the build is unknown, never zero
    Then the remote page says its extraction is "unknown, not none" and never "0 L1 statement"
    And the hub says "unknown — not in this build"
    And the hub says "2 L1 statement(s), 3 candidate sentence(s), 2 user-scenario candidate(s)"

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::authoredTextEscapedNoLiquid
  Scenario: authored text is escaped and never reaches Liquid
    Then the lib page shows "Use <b>bold</b> never." HTML-escaped
    And every page's front matter sets render_with_liquid: false

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::gen-l1-extraction-pages_--site::checkFailsOnChangedOrOrphanedPage
  Scenario: --check passes on what it wrote and fails on a changed or orphaned page
    Then --check exits 0 on what was written
    When the lib page is changed
    Then --check exits 1
    When the pages are rewritten and an orphaned page "gone" is added
    Then --check exits 1
    When the pages are rewritten again
    Then the files are again exactly the hub, the lib page and the remote page

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::readExtraction::readExtractionNullWhenAbsent
  Scenario: is null for a directory not on disk
    Then reading an extraction from a directory that does not exist gives null

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::readExtraction::readsCommittedHandbookExtraction
  Scenario: reads the committed handbook extraction: 22 statements and the candidate work list
    When the committed extraction l1-extractions/9789240116191-eng is read
    Then it has 22 statements and 1 candidate work list
    And no file has a read error

  @test:smart-base/scripts/gen-l1-extraction-pages.test.ts::smart-base_declares_the_viewer_it_draws::declaresViewerBuiltAtPublish
  Scenario: a visualiser rendered by l1-extraction-pages, per instance, whose pages are built at publish
    Given smart-base.json
    Then a visualiser "l1-extraction" is rendered by l1-extraction-pages, covers "l1-extraction" and has instance subgraphs
    And docs/ is built at publish by "smart-base:pages" then "smart-base:l1-extraction:pages"
    And package.json's "smart-base:l1-extraction:pages" runs gen-l1-extraction-pages.ts
    And the instance's .gitignore lists "/docs/"
