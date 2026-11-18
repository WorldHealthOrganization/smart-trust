# scripts/gen-navbar-assets.ts writes navbar.css and navbar.js, and scripts/lib/harness-rail.ts
# rails a page from shared rail data that navbar.js expands into the same drawing the build renders.
# Each Scenario names the test that executes it.
Feature: Navbar assets and the rail drawn from shared data

  @test:scripts/tests/ui/navbar-assets.test.ts::the_committed_navbar.css_and_navbar.js_are_what_the_generator_writes::navbar.css_—_run_`bun_run_cat_navbar:assets`_if_not
  Scenario: The committed navbar.css is what the generator writes
    Given the navbar asset paths
    When the committed navbar.css is read
    Then it exists
    And its text equals the generated stylesheet

  @test:scripts/tests/ui/navbar-assets.test.ts::the_committed_navbar.css_and_navbar.js_are_what_the_generator_writes::navbar.js_—_run_`bun_run_cat_navbar:assets`_if_not
  Scenario: The committed navbar.js is what the generator writes
    Given the navbar asset paths
    When the committed navbar.js is read
    Then it exists
    And its text equals the generated script

  @test:scripts/tests/ui/navbar-assets.test.ts::a_stale_navbar.js_names_a_Bun_that_is_not_the_pinned_one::silent_when_the_running_Bun_is_the_pin
  Scenario: No runtime note when the running Bun is the pinned one
    Given a pin file pinning Bun "1.3.14"
    When the runtime note is asked for Bun "1.3.14"
    Then there is none

  @test:scripts/tests/ui/navbar-assets.test.ts::a_stale_navbar.js_names_a_Bun_that_is_not_the_pinned_one::names_both_versions_when_they_differ
  Scenario: The runtime note names both versions when they differ
    Given a pin file pinning Bun "1.3.14"
    When the runtime note is asked for Bun "1.4.2"
    Then it contains "Bun 1.4.2"
    And it contains ".bun-version pins 1.3.14"

  @test:scripts/tests/ui/navbar-assets.test.ts::a_stale_navbar.js_names_a_Bun_that_is_not_the_pinned_one::silent_when_there_is_no_pin_to_compare_with
  Scenario: No runtime note when there is no pin
    Given a directory with no pin file
    When the runtime note is asked for Bun "1.4.2"
    Then there is none

  @test:scripts/tests/ui/navbar-assets.test.ts::a_page_railed_from_shared_data::draws_EXACTLY_the_rail_the_build_renders_—_one_drawing
  Scenario: A page railed from shared data expands to exactly the server-rendered rail
    Given a page shell and rail options at depths "..", "../.." and "../../.."
    When the rail is injected directly and, separately, from shared data that is then expanded
    Then at every depth the two navs are identical

  @test:scripts/tests/ui/navbar-assets.test.ts::a_page_railed_from_shared_data::pages_at_different_depths_share_ONE_data_file
  Scenario: Pages at different depths share one rail data file
    When the same rail is injected from shared data at depths ".." and "../../.."
    Then exactly one data file is emitted

  @test:scripts/tests/ui/navbar-assets.test.ts::a_page_railed_from_shared_data::carries_only_its_own_block,_a_Home_link,_and_three_links_—_not_the_rail's_markup
  Scenario: A shared-data page carries only its own block, not the rail markup
    When the rail is injected at "../.." both inline and from shared data
    Then the shared-data page is under a quarter of the inline page's length
    And it links the navbar stylesheet and defers navbar.js and a "rail-" data script under "assets/navbar/"
    And it has a Home link to "../../" labelled "folio-assistant"
    And its document index has 2 items

  @test:scripts/tests/ui/navbar-assets.test.ts::a_page_railed_from_shared_data::its_own_row_is_'you_are_here',_not_a_link_to_itself
  Scenario: A page's own rail row is not a link to itself
    Given a shared-data rail injected with "here" set to "/cat-harness/library/"
    When the rail is expanded
    Then the nav does not link "../cat-harness/library/"
    And it still links "../cat-harness/schemas/"

  @test:scripts/tests/ui/navbar-assets.test.ts::a_page_railed_from_shared_data::the_page_HTML_stays_byte-identical_when_the_rail's_links,_pages,_harnesses_or_row_change_(bean_g196)
  Scenario: Page HTML stays byte-identical when the rail's content changes
    Given a shared-data rail with pages, harnesses and a navbar row
    And a second injection with a mark, changed links, an added page, an added harness and a changed count
    When both pages are rendered
    Then the two pages' HTML is identical
    And the same set of data file names is emitted
    And the expanded second rail shows "no viewer by design", "New page" and "SMART Base"

  @test:scripts/tests/ui/navbar-assets.test.ts::the_committed_rail_data_and_the_pages_that_name_it_agree_(bean_lnoy)::the_scan_read_the_committed_site_—_an_empty_scan_is_not_a_clean_one
  Scenario: The rail data scan read the committed site
    Given the harness site directory
    When its HTML pages are scanned
    Then more than 20 pages are read

  @test:scripts/tests/ui/navbar-assets.test.ts::the_committed_rail_data_and_the_pages_that_name_it_agree_(bean_lnoy)::every_page's_shared_data_is_committed
  Scenario: Every rail data file a page names is committed
    Given the committed site pages and rail data files
    When each railed page's data name is looked up
    Then no page names a missing data file

  @test:scripts/tests/ui/navbar-assets.test.ts::the_committed_rail_data_and_the_pages_that_name_it_agree_(bean_lnoy)::every_committed_data_file_is_named_by_a_page_—_run_`bun_run_cat_navbar:assets`_to_remove_the_rest
  Scenario: Every committed rail data file is named by a page
    Given the committed site pages and rail data files
    When the data files are compared with the names the pages carry
    Then no data file is left unnamed
