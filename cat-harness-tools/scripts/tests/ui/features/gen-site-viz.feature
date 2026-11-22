# scripts/gen-site-viz.ts draws the published-site viewer: a branch's tree grouped by route, in one of three states, never showing a count it did not read.
# Each Scenario names the test that executes it.
Feature: The published-site viewer

  @test:scripts/tests/ui/gen-site-viz.test.ts::summariseTree::groups_by_top-level_route,_staging_previews_by_slug,_and_counts_root_files_apart
  Scenario: A tree is grouped by top-level route, with staging previews by slug and root files counted apart
    Given a tree with two root files, routes en and assets, and a STAGING directory holding a pr-1 preview and a README
    When it is summarised
    Then the routes are "assets", "en" and "STAGING"
    And the previews are "STAGING/pr-1" with 2 pages, 2 files and an index
    And the root files number 2

  @test:scripts/tests/ui/gen-site-viz.test.ts::summariseTree::only_.html_files_are_pages
  Scenario: Only .html files are counted as pages
    Given the same summarised tree
    Then the en route has 2 pages of 3 files and no index
    And the assets route has 0 pages of 1 file and no index

  @test:scripts/tests/ui/gen-site-viz.test.ts::three_states,_never_zeros_for_could-not-read::present:_a_row_per_route,_linked_back_to_the_site_root
  Scenario: A present branch draws a row per route, linked back to the site root
    Given a present section summarising the tree
    When the page is rendered at "en/h/site"
    Then the en route is named as code but not linked, having no index of its own
    And the pr-1 preview is linked at "../../../STAGING/pr-1/"
    And a "Staging previews" heading is shown

  @test:scripts/tests/ui/gen-site-viz.test.ts::three_states,_never_zeros_for_could-not-read::empty_says_so
  Scenario: An empty branch says so
    Given a section in the empty state
    When the page is rendered
    Then it says "Empty:"
    And it draws no table

  @test:scripts/tests/ui/gen-site-viz.test.ts::three_states,_never_zeros_for_could-not-read::could-not-read_says_so_and_draws_no_table
  Scenario: A branch that could not be read says so and draws no table
    Given a section in the could-not-read state
    When the page is rendered
    Then it says "Could not read the branch"
    And it draws no table

  @test:scripts/tests/ui/gen-site-viz.test.ts::readSiteBranch_against_a_local_remote::reads_present,_absent_and_unreachable_as_present,_empty_and_could-not-read
  Scenario: A local remote reads present, absent and unreachable as present, empty and could-not-read
    Given a bare remote holding a gh-pages branch with en/index.html
    When the gh-pages branch is read
    Then its state is present with the single route en of 1 page, 1 file and an index
    And reading a branch that does not exist gives the empty state
    And reading gh-pages from a missing remote gives the could-not-read state
