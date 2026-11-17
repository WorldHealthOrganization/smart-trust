# scripts/page-layout.ts: the one shared stylesheet and script every standalone page beside
# the rail links, with the helpers that link, stamp and write them.
# Each Scenario names the test that executes it.
Feature: Shared page layout

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.css::is_full_width:_the_content_column_has_no_cap_and_no_centring_margin
  Scenario: The page column is full width
    Given the page-layout stylesheet
    Then the rule for the main column sets "max-width:none" and "margin:0"
    And it has no auto margin
    And no rule in the stylesheet caps a width in rem

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.css::makes_the_bar_sticky_at_the_top,_as_folio-assistant's_band_is,_only_where_the_screen_can_spare_it
  Scenario: The page bar is sticky only on wide screens
    Given the page-layout stylesheet
    Then inside the min-width 50rem media query the bar is sticky at the staging offset
    And the bar's rule outside the media query is not sticky
    And inside the media query the bare docs-ui glass band without band tools is hidden

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.css::lands_anchors_below_the_stuck_bar,_from_the_height_the_script_measures
  Scenario: Anchors land below the stuck bar using the measured bar height
    Given the page-layout stylesheet and script
    Then the root that has a page bar sets "scroll-padding-top:0!important"
    And the main column and its descendants get a scroll-margin-top of the staging offset plus the bar height plus .5rem
    And descendants of a just-the-docs main-content column get the same scroll-margin-top
    And the script sets the "--fa-page-bar-h" property

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.css::styles_nothing_a_page_did_not_opt_into_but_the_body's_margin
  Scenario: The stylesheet styles only opted-in elements and the body's margin
    Given the page-layout stylesheet with comments and media wrappers removed
    Then every selector begins with :root, body, .fa-page- or body:has(.fa-page-
    And the body rule is exactly "margin:0"

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.css::knows_nothing_of_FHIR,_an_IG_or_WHO
  Scenario: The layout knows nothing of FHIR, an IG or WHO
    Given the page-layout stylesheet and script
    Then neither mentions fhir, WHO, smart.who, implementation guide, .ig- or .iga

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.js::runs_once,_and_puts_back_what_a_page_drawn_after_load_loses:_the_hash,_and_the_scroll_on_back_or_reload
  Scenario: The layout script runs once and restores the hash and scroll for late-drawn pages
    # Gap: only the script source text is checked; the behaviour is not run
    Given the page-layout script source
    Then it checks the root for the page-layout mark
    And it uses a MutationObserver and defines "rejumpHash"
    And it handles "back_forward", "reload" and "pagehide"
    And it gives way when the reader is open

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.js::jumps_instantly,_never_with_the_theme's_smooth_scroll,_which_chased_a_page_still_drawing_(dth-hrh,_2026-10-31)
  Scenario: The layout script jumps instantly, never with smooth scroll
    # Gap: only the script source text is checked; the behaviour is not run
    Given the page-layout script source
    Then it sets scrollBehavior to "auto"
    And every scrollIntoView or scrollTo call goes through the instant-jump wrapper

  @test:scripts/tests/ui/page-layout.test.ts::page-layout.js::re-places_a_full-width_bar_when_the_rail_opens:_body's_border_box,_the_rail,_and_the_padding_transition_(owner,_2026-10-15)
  Scenario: The layout script re-places a full-width bar when the rail opens
    # Gap: only the script source text is checked; the behaviour is not run
    Given the page-layout script source
    Then it observes the body's border box
    And it observes the nav.fa-nav rail with a ResizeObserver
    And it listens for "transitionend"

  @test:scripts/tests/ui/page-layout.test.ts::tags,_stamping_and_writing::links_both_files_relative_to_the_site_root,_marked_so_they_are_written_once
  Scenario: Layout tags link both files relative to the site root and are stamped once
    Given a site-root prefix of "../"
    Then the layout tags are a marked stylesheet link and a marked deferred script under that prefix
    When the layout is added to a page with a head
    Then the stylesheet link appears before the closing head tag
    And adding it again leaves the page unchanged
    And a fragment with no head is returned unchanged

  @test:scripts/tests/ui/page-layout.test.ts::tags,_stamping_and_writing::thinPageHtml_links_the_layout_when_asked,_before_the_page's_own_stylesheet,_and_not_otherwise
  Scenario: A thin page links the layout only when asked, before its own stylesheet
    Given a thin page built without a layout prefix
    Then it carries no page-layout mark
    When it is built with layout "../" and its own stylesheet "../own.css"
    Then it links the layout stylesheet under ../
    And the layout stylesheet appears before own.css

  @test:scripts/tests/ui/page-layout.test.ts::tags,_stamping_and_writing::writes_the_two_files,_and_leaves_bytes_that_already_match_alone
  Scenario: Writing the layout files skips bytes that already match
    Given an empty temporary directory
    When the page layout is written
    Then both the stylesheet and the script are reported written, and the stylesheet matches its source
    When it is written again
    Then nothing is reported written
    When the script file is overwritten with "stale" and the layout is written again
    Then only the script is reported written
