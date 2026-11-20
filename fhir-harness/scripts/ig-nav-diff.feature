Feature: Comparing the menu and table of contents derived from sushi-config with what the IG Publisher rendered

  @test:scripts/ig-nav-diff.test.ts::the_two_sides::readsPublisherTopBar
  Scenario: reads the Publisher's top bar: dropdowns, a top-level page, entities decoded
    Given the Publisher's top bar with two dropdowns, a top-level page and an HTML entity
    Then it reads as Home, Framework and Indices with their items, Framework as a page and the entity decoded

  @test:scripts/ig-nav-diff.test.ts::the_two_sides::refusesPageWithoutTopBar
  Scenario: refuses a page with no top bar rather than reporting it as empty
    Then reading a page with no top bar throws "navbar-nav"

  @test:scripts/ig-nav-diff.test.ts::the_diff,_entry_by_entry::relabelIsLabelDifference
  Scenario: matches by href, so a relabel is a label difference, not a removal plus an addition
    Given the derived and rendered menus
    Then the relabelled Change Log entry is a label difference matched by its href

  @test:scripts/ig-nav-diff.test.ts::the_diff,_entry_by_entry::namesOnlyRenderedEntry
  Scenario: names an entry only the Publisher rendered
    Then the "API Hub" entry is reported as only rendered

  @test:scripts/ig-nav-diff.test.ts::the_diff,_entry_by_entry::agreementSilentOrderOnce
  Scenario: reports nothing for what agrees, and an order change once per group
    Then the diff has 2 differences
    Given a rendered menu with Home's two items swapped
    Then one order difference is reported for Home with both orders

  @test:scripts/ig-nav-diff.test.ts::the_diff,_entry_by_entry::namesMissingGroup
  Scenario: names a whole group either side lacks
    Given a derived menu with a group "Only" and a rendered menu with a group "Other"
    Then each group is reported as only on its side

  @test:scripts/ig-nav-diff.test.ts::per_IG_and_combined::emptyDiffIsZeroRecord
  Scenario: an IG whose diff is empty is a record of zero, not an absent record
    Given an IG whose menus agree
    Then its record has a total of 0 and a nav-diff count of 0

  @test:scripts/ig-nav-diff.test.ts::per_IG_and_combined::combinedTagsByIg
  Scenario: combines with each difference tagged by IG, and each IG's count stated
    When two IGs' records are combined
    Then the total is 2 and each IG's count is stated
    And combining fewer than two IGs throws "at least two" and one IG twice throws "twice"

  @test:scripts/ig-nav-diff.test.ts::the_toc_half:_declared_pages_against_the_Publisher's_table_of_contents::derivesPagesAndReadsToc
  Scenario: derives nested pages as .html, and reads the toc's pages without anchors, artefacts or external links
    Then the declared nested pages are index, overview and changes as .html
    And the TOC's pages are index, overview and qa, without anchors or artefacts

  @test:scripts/ig-nav-diff.test.ts::the_toc_half:_declared_pages_against_the_Publisher's_table_of_contents::namesTocPagesEitherSide
  Scenario: names pages either side lacks
    Then "changes.html" is only declared and "qa.html" is only in the TOC

  @test:scripts/ig-nav-diff.test.ts::the_toc_half:_declared_pages_against_the_Publisher's_table_of_contents::refusesNonToc
  Scenario: refuses a page that is not a table of contents
    Then reading a page that is not a table of contents throws "Table of Contents"
