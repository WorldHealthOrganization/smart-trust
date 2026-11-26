# railStandalonePages rails the pages that are neither a mount nor a generated
# viewer, and must not touch the pages whose wrong railing would render fine.
# Each Scenario names the test that executes it.
Feature: Railing standalone pages

  Background:
    Given a fixture site with a drawn-sidebar wireframe, a theme-navigated wireframe, a bootstrap README, a page already railed, a TypeDoc page, a who-iris mount page, a STAGING preview, a bodiless fragment and the pdf.js viewer

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::a_railed_page_carries_the_harness's_icon-row_data,_so_docs-ui_draws_the_row_(bean_wckf,_#2147)
  Scenario: A railed page carries the icon-row data
    Given the harness data has been built
    When the standalone pages are railed
    Then the bootstrap README carries a fa-navbar-row script whose icons are a list

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::never_the_pinned_pdf.js_viewer_—_it_is_framed_inside_a_railed_page_(bean_folio-assistant-5ea6)
  Scenario: The pdf.js viewer is never railed
    When the standalone pages are railed
    Then the pdf.js viewer has no rail

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::a_standalone_page_with_no_navigation_gets_one
  Scenario: A page with no navigation gets the rail
    When the standalone pages are railed
    Then the drawn-sidebar wireframe and the bootstrap README are railed

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::a_TypeDoc_page_gets_one_too,_beside_the_navigation_it_already_has
  Scenario: A TypeDoc page is railed
    When the standalone pages are railed
    Then the TypeDoc page is railed

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::a_page_that_DRAWS_a_sidebar_still_gets_a_real_one
  Scenario: A page that draws a sidebar still gets the rail
    When the standalone pages are railed
    Then the wireframe keeps its drawn sidebar and gains the rail

  @test:scripts/tests/standalone-rail.test.ts::what_it_rails::the_id-lookup_page_gets_the_rail_with_linked_style_and_visualiser_nav_(bean_7ji4)
  Scenario: The id-lookup page gets the linked rail
    Given the harness data has been built
    And an id-lookup page declaring a linked navbar, a visualiser label and visualiser nav
    When the standalone pages are railed
    Then it is railed and links navbar.css, navbar.js and navbar-row.js

  @test:scripts/tests/standalone-rail.test.ts::what_it_must_NOT_touch_—_each_failure_renders_fine_and_is_therefore_invisible::a_page_with_the_THEME's_sidebar_is_already_navigated
  Scenario: A page with the theme sidebar is not railed
    When the standalone pages are railed
    Then the theme-navigated wireframe has no rail
    And some pages are counted already navigated

  @test:scripts/tests/standalone-rail.test.ts::what_it_must_NOT_touch_—_each_failure_renders_fine_and_is_therefore_invisible::a_page_ALREADY_carrying_the_harness_rail_keeps_it,_and_gains_only_the_first-paint_snippet
  Scenario: A page already railed gains only the first-paint snippet
    When the standalone pages are railed
    Then the page is unchanged apart from the saved-scheme snippet, with exactly one rail
    And railing again leaves it unchanged

  @test:scripts/tests/standalone-rail.test.ts::what_it_must_NOT_touch_—_each_failure_renders_fine_and_is_therefore_invisible::a_page_that_DECLINES_the_rail_in_its_own_markup_keeps_that_decision_(#1881)
  Scenario: A page declining the rail keeps its decision
    Given a library entry shell with folio-navbar "none"
    When the standalone pages are railed
    Then the shell is unchanged and one page is counted declined

  @test:scripts/tests/standalone-rail.test.ts::what_it_must_NOT_touch_—_each_failure_renders_fine_and_is_therefore_invisible::a_mount_route_is_the_OTHER_pass's_subject
  Scenario: A mount route is not railed here
    When the standalone pages are railed with who-iris as a mount route
    Then the who-iris page has no rail

  @test:scripts/tests/standalone-rail.test.ts::what_it_must_NOT_touch_—_each_failure_renders_fine_and_is_therefore_invisible::STAGING_previews_are_not_this_site
  Scenario: STAGING previews are not railed
    When the standalone pages are railed
    Then the STAGING preview has no rail

  @test:scripts/tests/standalone-rail.test.ts::what_it_reports::a_file_with_no_<body>_is_NAMED,_never_counted
  Scenario: A file with no body is named as skipped
    When the standalone pages are railed
    Then the skipped files are exactly fragment.html
    And 3 pages are injected

  @test:scripts/tests/standalone-rail.test.ts::what_it_reports::running_twice_injects_nothing_the_second_time
  Scenario: A second run injects nothing
    When the standalone pages are railed twice
    Then the second run injects 0

  @test:scripts/tests/standalone-rail.test.ts::the_mount_routes_are_ASKED_for,_not_guessed::`bootstrap`_is_not_a_mount_route,_so_the_pass_must_not_skip_it
  Scenario: bootstrap is not a mount route
    Then the real repository's mount routes for cat-harness do not include bootstrap

  @test:scripts/tests/standalone-rail.test.ts::the_mount_routes_are_ASKED_for,_not_guessed::it_returns_the_routes_the_mount_pass_actually_owns
  Scenario: Mount routes are relative and exclude the root layer
    # Gap: passes on an empty list; it checks only that each route is non-empty and relative and that cat-harness is not one, not that each is a route the mount pass copies.
    Then every mount route for cat-harness is a non-empty relative path
    And cat-harness is not one

  @test:scripts/tests/standalone-rail.test.ts::a_FOLIO's_site_(folio-staging.yml):_platform_links_point_at_the_platform's_site::graphs_and_harnesses_are_absolute_on_the_platform_site;_home_is_the_folio's_own_root
  Scenario: On a folio's site platform links point at the platform site
    Given the folio chrome and harness data have been built
    And a folio site with one page
    When its pages are railed with the platform base and home label smart-ra
    Then one page is injected
    And the expanded rail's stylesheets are the site's pinned copy under ../assets/
    And every other platform link starts with the platform base
    And home links "../" and names smart-ra

  @test:scripts/tests/standalone-rail.test.ts::a_FOLIO's_site_(folio-staging.yml):_platform_links_point_at_the_platform's_site::the_icon_row_is_drawn:_docs-ui_loads_from_the_site's_pinned_copy,_and_the_row's_links_are_the_platform's
  Scenario: On a folio's site the icon row is drawn from the pinned copy
    When a folio page is railed
    Then it loads ./assets/js/docs-ui.js and ./assets/css/docs-ui.css and declares the platform base
    And its fa-navbar-row island names a row file whose links all start with the platform base
    And railing again adds no second docs-ui.js

  @test:scripts/tests/standalone-rail.test.ts::a_FOLIO's_site_(folio-staging.yml):_platform_links_point_at_the_platform's_site::the_icon_row_is_written_ONCE_for_the_site,_and_its_file_runs_before_every_reader_(2026-10-10)
  Scenario: The icon row is one file for the site, loaded before its readers
    Given a top page and a page two levels deep
    When they are railed
    Then both name the same row file, the deep page by its relative path
    And on each page the row file precedes navbar-row.js and docs-ui.js
    And running the row file fills the island with icons and removes its source attribute

  @test:scripts/tests/standalone-rail.test.ts::a_FOLIO's_site_(folio-staging.yml):_platform_links_point_at_the_platform's_site::PINNED_COPY:_no_page_links_the_platform's_live_assets,_and_every_file_it_links_is_shipped_beside_it_(owner,_2026-10-15)
  Scenario: The pinned copy ships every asset a page loads
    When a folio's pages are railed
    Then exactly the pinned chrome and data files are copied
    And no page loads a script or stylesheet from the platform's live site
    And every local script and stylesheet a page loads exists
    And the top page declares fa-pinned-data
    And the copied chrome is byte-identical to the harness's
    And a second pass copies nothing

  @test:scripts/tests/standalone-rail.test.ts::a_FOLIO's_site_(folio-staging.yml):_platform_links_point_at_the_platform's_site::a_file_the_site_already_built_with_other_bytes_is_left,_and_reported
  Scenario: A site's own differing chrome file is left and reported
    Given a site that built its own assets/js/docs-ui.js
    When the platform chrome is pinned
    Then that file is reported as differing and left unchanged

  @test:scripts/tests/standalone-rail.test.ts::pinned_chrome_a_mount_never_generated::a_generated_stylesheet_the_mount_never_wrote_is_rendered,_not_refused
  Scenario: Generated stylesheets are rendered when the mount lacks them
    Then the generated bytes of themes.css are the rendered themes stylesheet, with its GENERATED header and sticky-board rule
    And avatars.css is the rendered avatars stylesheet
    And docs-ui.js has no generated bytes
