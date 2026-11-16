Feature: The rendered pages an IG change alters

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_FSH_through_the_cone_to_the_AST_pages::valueSetReachesPagesAndIndexes
  Scenario: a value set change reaches its own page and the plan that uses it, plus the two indexes
    When the value set's FSH file changes
    Then the value set's and the plan's data and pages change, plus the AST index and the search data

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_FSH_through_the_cone_to_the_AST_pages::leafAndRuleSetAliasReach
  Scenario: a leaf changes only itself; a RuleSet-only or Alias-only file reaches its users
    Then a change to a leaf's file changes only its page
    And a change to a RuleSet-only or an Alias-only file reaches the value set's page

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_FSH_through_the_cone_to_the_AST_pages::fileSaysHowReached
  Scenario: each file says how the change reached it
    When the value set's FSH file changes
    Then the plan's page says it was reached through the plan's file, its declaration and its resource

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_FSH_through_the_cone_to_the_AST_pages::prefixesPlacePages
  Scenario: the prefixes place the pages where the site serves them
    Then with the site prefix "ex", the leaf's page is under "ex"

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_FSH_through_the_cone_to_the_AST_pages::noSushiIndexUndetermined
  Scenario: no SUSHI index: the FSH input is undetermined, never no change
    Given a SUSHI index that is missing
    When the value set's FSH file changes
    Then no file is listed and the input is undetermined with scope "unknown"

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_pages_and_site-wide_inputs::pageChangeReachesIncluders
  Scenario: a page change renders the page and every page that includes it
    When a page changes
    Then the search data, the including index page and the page itself change

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_pages_and_site-wide_inputs::siteWideAndUnmappedListed
  Scenario: sushi-config is site-wide and an unmapped input is unknown; both are listed, not dropped
    When sushi-config.yaml and an image change
    Then no file is listed, sushi-config is undetermined with scope "all" and the image with scope "unknown"

  @test:scripts/ig-rendered-impact.test.ts::igRenderedImpact_—_pages_and_site-wide_inputs::reviewListWithoutIndexes
  Scenario: the review list is the content and data, without the indexes
    When a page changes
    Then the review list is the index and the page, without the search data
