# The rail of a site that only lands on a harness (owner, 2026-10-14) is the
# site's own, not the landing's. Each Scenario names the test that executes it.
Feature: The rail of a site that only lands on a harness

  @test:scripts/tests/landing-rail.test.ts::a_site_that_only_LANDS_on_a_harness:_the_rail_is_the_site's,_not_the_landing's::the_header_names_the_site,_not_the_harness_it_lands_on
  Scenario: The header names the site, not the harness it lands on
    Given a site whose rail is written with landing on smart-base and the home label "WHO SMART Guidelines - HIV"
    When the rail of its index page is read
    Then the rail's instance is "WHO SMART Guidelines - HIV" and it carries no mark

  @test:scripts/tests/landing-rail.test.ts::a_site_that_only_LANDS_on_a_harness:_the_rail_is_the_site's,_not_the_landing's::every_graph_row_links_within_the_site,_and_only_to_a_page_the_site_holds
  Scenario: Every graph row links within the site, to a page the site holds
    Given the landing site, holding the page of one graph the landing declares when there is one
    When the rails of index.html and deep/page.html are read
    Then every link has an href under the page's path to the site root, never under the platform base
    And every link's target page exists in the site
    And when a graph page is held, the index rail lists at least one link
    # Gap: when no landing graph is held (the standalone closure) the link list may be empty and the per-link checks pass vacuously.

  @test:scripts/tests/landing-rail.test.ts::a_site_that_only_LANDS_on_a_harness:_the_rail_is_the_site's,_not_the_landing's::the_Harnesses_list_starts_with_the_site,_at_its_root;_the_landing_links_to_its_own_page_on_the_platform
  Scenario: The Harnesses list starts with the site; the landing links to its platform page
    Given the landing site, in a checkout that holds smart-base
    When the rail of deep/page.html is read
    Then the first Harnesses row is the site's label linking to the site root
    And the "SMART Base" row links to the platform's smart-base page
    And no row after the first links anywhere but the platform base

  @test:scripts/tests/landing-rail.test.ts::a_site_that_only_LANDS_on_a_harness:_the_rail_is_the_site's,_not_the_landing's::without_`landing`_the_rail_stays_the_instance's,_as_before_(bean_mftp)
  Scenario: Without landing, the rail stays the instance's
    Given a site whose rail is written for the smart-base instance without landing
    When the rail of its index page is read
    Then the instance is "SMART Base" and the first Harnesses row is "SMART Base" linking to "./"
