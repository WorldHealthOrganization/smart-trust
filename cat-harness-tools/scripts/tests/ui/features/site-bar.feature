# scripts/lib/site-bar.ts strips the theme's side bar from a built page and gives every page one top bar; the rail pass in scripts/mount-instance-docs.ts then puts one folio rail and the first-paint scheme snippet on every page.
# Each Scenario names the test that executes it.
Feature: One rail and one top bar on every page

  @test:scripts/tests/ui/site-bar.test.ts::stripThemeSidebar::the_side_bar_and_the_footer's_mobile_copy_go;_the_content_and_the_header_stay
  Scenario: Stripping removes the theme side bar and its mobile copy but keeps the header and content
    Given a just-the-docs theme page titled "Guide"
    When its theme side bar is stripped
    Then the page no longer has a theme side bar
    And it contains no "site-nav" id and no "harnesses again" footer copy
    And the main header and the "Guide" heading remain

  @test:scripts/tests/ui/site-bar.test.ts::stripThemeSidebar::the_nav_activation_style_goes_too,_so_a_page_added_ahead_of_this_one_no_longer_changes_it
  Scenario: Stripping removes the nav activation style so pages no longer differ by row
    Given the same theme page built with its activation style naming row 108 and row 109
    When each has its side bar stripped
    Then neither contains "jtd-nav-activation"
    And the two results are identical
    And the theme stylesheet link now closes the head

  @test:scripts/tests/ui/site-bar.test.ts::stripThemeSidebar::a_page_that_keeps_its_side_bar_keeps_its_activation_style
  Scenario: A page with no side bar keeps its activation style
    Given a page with a "jtd-nav-activation" style and no side bar
    When its theme side bar is stripped
    Then the page is returned unchanged

  @test:scripts/tests/ui/site-bar.test.ts::stripThemeSidebar::elementEnd_counts_nested_elements
  Scenario: elementEnd skips past nested elements of the same name
    Given three nested div elements followed by "tail"
    When the end of the outer div is found
    Then what follows it is "tail"

  @test:scripts/tests/ui/site-bar.test.ts::withSiteBar::a_theme_page's_header_BECOMES_the_bar:_home_first,_its_own_search,_the_picker's_slot,_the_layout
  Scenario: A theme page's header becomes the site bar
    Given a stripped theme page
    When the site bar is added with root ".." and title "folio-assistant"
    Then the main header gains the site-bar classes and starts with a home link "folio-assistant" to "../" before the search
    And the header ends with the locale picker slot
    And the page has exactly one search input
    And it links the page-layout stylesheet under ".."
    And adding the bar again changes nothing

  @test:scripts/tests/ui/site-bar.test.ts::withSiteBar::a_page_the_theme_did_not_lay_out_gets_the_same_bar_after_the_rail,_with_the_theme's_search_when_the_site_has_it
  Scenario: A page the theme did not lay out gets the bar after the rail, with search when the site has it
    Given a non-theme page with a pending folio rail
    When the site bar is added with the theme's lunr and just-the-docs scripts as search
    Then the bar follows the rail with a home link "folio-assistant" and a search box
    And the just-the-docs script is loaded deferred
    And the page carries the search-exclude meta
    And when the bar is added with no search there is no search input and no search-exclude meta
    And a theme page given the bar carries no search-exclude meta

  @test:scripts/tests/ui/site-bar.test.ts::withSiteBar::an_IG_page_keeps_its_own_bar
  Scenario: An IG page keeps its own bar
    Given a page whose top bar is an "ig-topbar fa-page-bar"
    When it is checked for a page bar and given the site bar
    Then it has a page bar
    And it is returned unchanged

  @test:scripts/tests/ui/site-bar.test.ts::the_rail_pass_with_--theme-source:_one_rail_on_every_page_(option_A)::the_theme_pages_are_railed,_their_side_bar_replaced;_the_replica_is_railed_as_before
  Scenario: The rail pass rails the theme pages and the replica
    Given a theme source with Home, Guide and Install pages and a built site with those three theme pages and a replica page
    When the rail pass runs with the theme source
    Then 3 theme side bars are replaced and 4 pages get a rail
    And the home and install pages have no theme side bar and carry a folio rail

  @test:scripts/tests/ui/site-bar.test.ts::the_rail_pass_with_--theme-source:_one_rail_on_every_page_(option_A)::every_page's_rail_has_the_site's_Pages,_with_the_reader's_page_marked_and_its_fold_open
  Scenario: Each rail lists the site's pages with the reader's page marked and its group open
    Given the railed site from the theme source
    When the install page's rail is drawn
    Then its section labels include the Pages label, with "On this page" first
    And the Guide group is open, labelled "Hide Guide's 1 page"
    And the Install row is a link marked aria-current "page"
    And the replica's rail links "../guide/install.html"

  @test:scripts/tests/ui/site-bar.test.ts::the_rail_pass_with_--theme-source:_one_rail_on_every_page_(option_A)::every_page_has_the_same_top_bar,_and_the_layout_it_is_drawn_by_is_shipped
  Scenario: Every page gets the same top bar and the layout files are shipped
    Given the railed site from the theme source
    When the home, install and replica pages are read
    Then each has the site-bar header and exactly one search input
    And the page-layout CSS and JS files exist in the site

  @test:scripts/tests/ui/site-bar.test.ts::the_rail_pass_with_--theme-source:_one_rail_on_every_page_(option_A)::running_it_again_changes_nothing
  Scenario: A second rail pass changes nothing
    Given the railed site from the theme source
    When the rail pass runs again
    Then no page gets a rail
    And the install page is unchanged

  @test:scripts/tests/ui/site-bar.test.ts::every_railed_page_is_FINISHED:_one_rail,_the_current_first-paint_snippet_(2026-10-16)::a_page_that_only_MENTIONS_id="site-nav"_is_railed,_its_side_bar_replaced
  Scenario: A page that only mentions the side-bar id in prose is still railed
    Given a theme page whose prose quotes id="site-nav" in a code span
    When the rail pass runs
    Then the page has no theme side bar and no Main site-nav element
    And it carries exactly one folio rail

  @test:scripts/tests/ui/site-bar.test.ts::every_railed_page_is_FINISHED:_one_rail,_the_current_first-paint_snippet_(2026-10-16)::a_railed_page_under_a_mount_route_loses_the_theme_side_bar_and_gains_the_snippet
  Scenario: A railed theme page under a mount route loses its side bar and gains the snippet
    Given a theme page under the "who-iris" mount route that already carries a pending rail
    When the rail pass runs with "who-iris" as a mount route
    Then the page has no theme side bar
    And it carries exactly one folio rail
    And it carries the first-paint scheme snippet

  @test:scripts/tests/ui/site-bar.test.ts::every_railed_page_is_FINISHED:_one_rail,_the_current_first-paint_snippet_(2026-10-16)::a_replica_page_railed_by_its_generator_keeps_its_rail_and_gains_the_snippet
  Scenario: A replica page railed by its generator keeps its rail and gains the snippet
    Given a replica page under "who-iris" that already carries a rail and no snippet
    When the rail pass runs
    Then the page is its original markup with the snippet added at the top of the head
    And 2 pages are counted finished

  @test:scripts/tests/ui/site-bar.test.ts::every_railed_page_is_FINISHED:_one_rail,_the_current_first-paint_snippet_(2026-10-16)::a_railed_page_outside_the_mount_routes_loses_the_theme_side_bar
  Scenario: A railed page outside the mount routes loses the theme side bar
    Given a theme page outside the mount routes that carries both a rail and the theme side bar
    When the rail pass runs
    Then the page has no theme side bar
    And it carries exactly one folio rail and the snippet

  @test:scripts/tests/ui/site-bar.test.ts::every_railed_page_is_FINISHED:_one_rail,_the_current_first-paint_snippet_(2026-10-16)::running_it_again_changes_nothing
  Scenario: A second finishing pass changes nothing
    Given the four pages after the rail pass
    When the rail pass runs again
    Then no page is railed or finished
    And all four pages are unchanged

  @test:scripts/tests/ui/site-bar.test.ts::a_theme_page_whose_prose_QUOTES_the_theme's_nav_is_still_railed::its_side_bar_is_replaced_by_the_rail
  Scenario: A theme page quoting the rail and side-bar markup in prose is railed
    Given a theme page whose prose quotes "<nav class=\"fa-nav\"" and id="site-nav" in code spans
    When the rail pass runs
    Then no page is counted already navigated and 1 side bar is replaced
    And the page has no theme side bar and carries a folio rail
    And both code spans survive

  @test:scripts/tests/ui/site-bar.test.ts::the_real_<body>,_never_one_a_comment_or_a_script_names::bodyTag_skips_both
  Scenario: bodyTag ignores a body named in a comment or a script
    Given a page whose head mentions "<body>" in a comment and in a script string
    When the body tag is found
    Then it is the real '<body class="x">'

  @test:scripts/tests/ui/site-bar.test.ts::the_real_<body>,_never_one_a_comment_or_a_script_names::the_rail_lands_in_the_body
  Scenario: The rail is injected inside the real body
    Given a page whose head mentions "<body>" in a comment and in a script string
    When the rail is injected
    Then the folio rail appears after the real body tag
