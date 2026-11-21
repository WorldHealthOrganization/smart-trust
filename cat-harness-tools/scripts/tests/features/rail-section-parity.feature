# One vocabulary for the rail's sections on every page (bean 9rq1): the
# fa-nav rail draws On this page, Pages, Folders and Harnesses, and docs-ui.js
# no longer draws any of them. Each Scenario names the test that executes it.
Feature: The rail's sections are named alike everywhere

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::Path_A_is_retired:_docs-ui.js_builds_none_of_the_sections_in_the_browser_any_more_(2026-10-15)
  Scenario: docs-ui.js builds none of the sections any more
    Then docs-ui.js defines none of mountDocumentIndex, mountNavPagesHeading, mountInstanceGraphs and mountSidebarRail

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::Path_B_—_the_fa-nav_rail_—_draws_On_this_page,_Folders_and_Harnesses,_in_that_order
  Scenario: The fa-nav rail draws On this page, Folders and Harnesses in order
    When the rail is injected into a page with two headings, a folder link and a harness link
    Then its group labels are On this page, Folders, Harnesses

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::Path_B_from_shared_data_(navbar.js's_code)_draws_the_same_names_as_the_server
  Scenario: The rail from shared data draws the same names as the server
    When the rail model is built with a document index and rendered as navbar regions
    Then its group labels are On this page, Folders, Harnesses

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::no_section_on_either_path_keeps_a_retired_name
  Scenario: The rail keeps no retired section name
    # Gap: the title says neither path; the body checks only the injected fa-nav rail.
    When the rail is injected into the page
    Then no group label is "Graphs" or "Contents"

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::a_page_that_names_its_own_section_keeps_that_name_(an_IG,_a_visualiser)
  Scenario: A page that names its own section keeps that name
    Given the page carries a fa-visualiser-label meta "WHO SMART Trust"
    When the rail is injected
    Then the first group label is "WHO SMART Trust"

  @test:scripts/tests/rail-section-parity.test.ts::the_rail's_sections_are_named_alike_on_both_paths_(bean_9rq1)::Pages:_Path_B_draws_it_when_the_site_has_a_page_tree,_in_Path_A's_order
  Scenario: Pages is drawn when the site has a page tree
    When the rail is injected with a page tree
    Then its group labels are On this page, Pages, Folders, Harnesses
