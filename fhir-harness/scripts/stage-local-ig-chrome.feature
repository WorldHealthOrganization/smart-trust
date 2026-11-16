Feature: The harness chrome over an IG's Publisher output when staging locally

  @test:scripts/stage-local-ig-chrome.test.ts::the_plan_lists_the_chrome_step::planListsChromeStep
  Scenario: between the build and the deploy, scoped to the IG the checkout declares
    Given a checkout with the platform's rail script
    When the staging plan is made
    Then the chrome step comes after the build and before the deploy
    And it runs the rail script for the foreign site with the instance and home label
    And the formatted plan lists the chrome step and nothing is missing

  @test:scripts/stage-local-ig-chrome.test.ts::the_plan_lists_the_chrome_step::missingChromeScriptsNamed
  Scenario: on the root, a checkout without the platform's chrome scripts names them as missing
    Given a checkout without the platform's chrome scripts
    When the staging plan is made
    Then the chrome scripts are named as missing
    And the formatted plan marks the chrome step unavailable

  @test:scripts/stage-local-ig-chrome.test.ts::the_real_rail_leaves_the_folio_path's_markers_on_an_IG's_pages::railAddedContentKept
  Scenario: every page gains the rail and the icon row; the IG's own content stays
    Given an IG output of three pages
    Then before the rail, the shortfall says pages lack the rail
    When the rail is applied
    Then all 3 pages carry the rail and the navbar row, with an index, and there is no shortfall
    And a page holds the rail, the navbar row, the platform UI marker and its own content

  @test:scripts/stage-local-ig-chrome.test.ts::the_real_rail_leaves_the_folio_path's_markers_on_an_IG's_pages::chromeIsPinnedCopy
  Scenario: PINNED COPY: no IG page loads the platform's chrome live; the files it loads are in the site (owner, 2026-10-15)
    Given an IG output with the rail applied
    Then every page loads at least one script or stylesheet, none from another origin, and each file it loads is in the site

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::bareNeverReplacesChromed
  Scenario: bare output over a chromed root is refused, stamp or no stamp; railed output does not replace folio-site.yml's side bar and stamp, nor a folio's publish
    Given a published root that wears the harness chrome
    Then bare output over it is refused and the root is unchanged
    And with a build stamp present the refusal names folio-build.json
    And railed output without the side bar and the stamp is refused, naming both, and the root is unchanged
    And output carrying all of it replaces the root, stamp included
    And a root holding a folio's staging site is refused

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::emptyChromeRefusesRoot
  Scenario: a chrome step that chromes nothing refuses the root publish, and the publish branch is untouched
    Given a chrome step that chromes no page
    When the root is staged
    Then it is refused, saying the harness chrome was not applied
    And the publish branch keeps its last commit and its chromed index

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::previewPublishedBare
  Scenario: a preview whose chrome fails is published bare under branches/, as the workflow publishes it, and says so
    Given a chrome step that chromes no page, on a feature branch
    When it is staged
    Then it is published as a preview
    And the log says the chrome was not applied and it was published bare
    And the root's index is unchanged

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::railedOverSiteRootRefused
  Scenario: railed IG output over a root folio-site.yml built is refused, naming what it lacks, and the branch is untouched
    Given railed output over a root the folio site built
    When the root is staged
    Then it is refused, naming what it lacks, and the publish branch keeps its last commit

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::chromedReplacesRailedRoot
  Scenario: with the chrome applied, a railed root is replaced by the chromed IG
    Given a railed root and a chrome step that applies the chrome
    When the root is staged
    Then it is published to main
    And the root's index carries the navbar row and the IG's page keeps its content
    And the root holds only the IG's pages and the branches directory

  @test:scripts/stage-local-ig-chrome.test.ts::a_root_publish_never_replaces_a_chromed_root_with_bare_pages::refusingSyncNotFatal
  Scenario: a harness-data sync that refuses is said, not fatal: the chrome is judged on the pages
    Given a harness-data sync that exits 1
    When the root is staged with the chrome applied
    Then it is published to main
    And the log says the sync exited 1
    And the root's index carries the navbar row
