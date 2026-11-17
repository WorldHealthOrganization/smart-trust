# Text checks over cat-harness/site-chrome/assets/css/docs-ui.css (comments stripped), the generated sidebar include and footer_custom.html: the sidebar rests as an icon-wide strip, opens three ways, and figures keep a white plate.
# Nothing here renders a page. Each Scenario names the test that executes it.
Feature: The sidebar rests as an icon strip

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::keeps_a_visible_width_—_the_regression_this_file_exists_for
  Scenario: At rest the sidebar keeps the collapsed width rather than hiding
    Given the sidebar-strip slice of docs-ui.css
    When its rules are read
    Then a rule sets width "var(--fa-nav-collapsed)"
    And the slice contains no "visibility: hidden" and no "translateX(-100%)"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::pads_`.main`_by_THE_SAME_property_it_sizes_the_strip_with
  Scenario: The strip and the main column's padding use the same property
    Given the sidebar-strip slice of docs-ui.css
    When its rules are read
    Then it contains "width: var(--fa-nav-collapsed)"
    And it contains "margin-left: var(--fa-nav-collapsed)"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::clips_from_the_LEFT,_or_the_strip_shows_the_end_of_every_label
  Scenario: The strip aligns its children to the left
    Given the sidebar-strip slice of docs-ui.css
    When the collapsed-width rule is read
    Then it carries "align-items: flex-start"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::does_NOT_scroll_as_one_box_—_the_MIDDLE_region_does
  Scenario: The sidebar does not scroll as one box
    Given the sidebar-strip slice of docs-ui.css
    When the collapsed-width rule is read
    Then it carries "overflow: hidden"
    And it does not carry "overflow-y: auto"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::gives_the_middle_the_scroll,_a_FLOOR,_and_room_to_shrink
  Scenario: The middle region scrolls, has a floor and can shrink
    Given the sidebar-strip slice of docs-ui.css
    When the rule carrying "min-height: 8rem" is read
    Then it carries "flex: 1 1 auto" and "overflow-y: auto"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::every_other_child_is_fixed,_so_neither_edge_region_can_scroll_away
  Scenario: Every other sidebar child is fixed in size
    Given the sidebar-strip slice of docs-ui.css
    When the rule carrying "flex: 0 0 auto" is read
    Then its selector is ".side-bar > *"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::the_capped_bottom_region_YIELDS_to_that_floor
  Scenario: The capped bottom region yields space to the middle
    Given the whole of docs-ui.css with comments stripped
    When the rule carrying "max-height: 50%" is read
    Then it carries "flex: 0 1 auto"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::the_browser-built_document_index_is_gone,_rules_and_script_alike_(owner,_2026-10-15)
  Scenario: The browser-built document index is gone from stylesheet and script
    Given the whole of docs-ui.css with comments stripped and docs-ui.js
    When both are read
    Then the stylesheet names no ".fa-doc-index"
    And docs-ui.js defines no function mountDocumentIndex

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::is_scoped_above_the_theme's_breakpoint,_never_applied_to_the_phone
  Scenario: The collapse applies only above the theme's breakpoint
    Given the sidebar-strip slice of docs-ui.css
    When the media query enclosing the collapsed-width rule is read
    Then it contains "min-width: 50rem"

  @test:scripts/tests/ui/sidebar-strip.test.ts::at_rest_it_is_a_strip,_not_an_absence::carries_no_script
  Scenario: The strip slice carries no script
    Given the sidebar-strip slice of docs-ui.css
    When it is read
    Then it contains no "<script"

  @test:scripts/tests/ui/sidebar-strip.test.ts::three_ways_in,_one_way_back::opens_on_hover,_on_keyboard_focus,_and_on_the_pinned_checkbox
  Scenario: The sidebar opens on hover, keyboard focus and the pinned checkbox
    Given the rule in the strip slice that widens the sidebar to "var(--fa-nav-open)"
    When its selectors are read
    Then they include ".side-bar:hover", ".side-bar:focus-within" and ".side-bar:has(.fa-nav-open:checked)"

  @test:scripts/tests/ui/sidebar-strip.test.ts::three_ways_in,_one_way_back::overlays_the_page_rather_than_reflowing_it
  Scenario: The opened sidebar sets a numeric z-index
    # Gap: only the presence of a numeric z-index is checked, not that the page does not reflow.
    Given the rule that widens the sidebar to "var(--fa-nav-open)"
    When it is read
    Then it carries a z-index with a number

  @test:scripts/tests/ui/sidebar-strip.test.ts::three_ways_in,_one_way_back::draws_no_☰_and_no_[x]_—_the_avatar_is_the_one_control_(ob3m_finding_8)
  Scenario: No rule styles a hamburger or close control
    Given docs-ui.css with comments stripped
    When it is read
    Then it names none of ".fa-nav-close", ".fa-nav-toggle" or ".fa-nav-head"

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::the_checkbox_is_in_the_sidebar's_own_include,_and_no_☰_or_[x]_(#1757)
  Scenario: The generated sidebar include holds the checkbox and no hamburger or close control
    # Skipped: when the generated include navbar-footer.html has not been built.
    Given the generated include cat-harness/docs/_includes/generated/navbar-footer.html
    When it is read
    Then it contains "fa-nav-open"
    And it contains neither "fa-nav-close" nor "fa-nav-head"

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::and_`footer_custom.html`_carries_none_of_them
  Scenario: footer_custom.html carries no sidebar control
    Given cat-harness/site-chrome/_includes/footer_custom.html
    When it is read
    Then it contains no "fa-nav"

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::no_label_drives_the_checkbox_from_the_include_—_the_avatar_does
  Scenario: No label in the include drives the checkbox
    # Skipped: when the generated include navbar-footer.html has not been built.
    Given the generated sidebar include
    When it is split on its Liquid else into its two rendered variants
    Then there are exactly 2 variants
    And neither has a label for "fa-nav-open"

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::the_checkbox_is_focusable,_not_`display:_none`
  Scenario: The checkbox is hidden by clipping, not display none
    # Gap: focusability itself is not exercised; only the absence of "display: none" on the rule is checked.
    Given the sidebar-strip slice of docs-ui.css
    When the rule carrying "clip-path: inset(50%)" is read
    Then it does not carry "display: none"

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::and_it_is_clipped_in_place,_never_parked_off_an_edge_(bean_`2r2n`)
  Scenario: Nothing in the strip is parked far off the left edge
    Given the sidebar-strip slice of docs-ui.css
    When it is read
    Then it has no "left" offset of -999px or more nines

  @test:scripts/tests/ui/sidebar-strip.test.ts::the_controls_live_inside_the_sidebar_now::the_control_that_remains_has_an_accessible_name_—_this_is_navigation
  Scenario: The avatar control is named and exposes its expanded state
    # Gap: a source-text check; the rendered accessible name is not observed.
    Given the harness's docs-ui.js
    When its source is read
    Then it sets the avatar title to "Go to the landing page" when the box is checked and "Open navigation, or go to the landing page once it is open" otherwise
    And it sets the avatar's "aria-expanded" attribute

  @test:scripts/tests/ui/sidebar-strip.test.ts::figures_keep_a_white_plate,_with_and_without_JavaScript::states_the_same_white_in_both_paths
  Scenario: Both figure paths state the same white
    Given the figures slice of docs-ui.css with comments stripped
    When it is read
    Then it contains "background: #fff !important" and "background: #fff;"

  @test:scripts/tests/ui/sidebar-strip.test.ts::figures_keep_a_white_plate,_with_and_without_JavaScript::the_fallback_reaches_the_class_this_theme_actually_emits
  Scenario: The declarative fallback targets the class the theme emits
    Given the figures slice of docs-ui.css
    When it is read
    Then it contains ".main-content .language-mermaid"

  @test:scripts/tests/ui/sidebar-strip.test.ts::figures_keep_a_white_plate,_with_and_without_JavaScript::does_NOT_blanket_every_inline_SVG_—_CSS_cannot_measure
  Scenario: No figure rule blankets every SVG
    Given the figures slice of docs-ui.css
    When it is read
    Then it has no rule on img[src$=...] selectors
    And no rule whose selector is a bare svg

  @test:scripts/tests/ui/sidebar-strip.test.ts::figures_keep_a_white_plate,_with_and_without_JavaScript::is_white_in_BOTH_schemes,_not_only_under_a_dark-mode_query
  Scenario: The figure plate does not depend on a colour-scheme query
    Given the figures slice of docs-ui.css
    When it is read
    Then it contains no "prefers-color-scheme"

  @test:scripts/tests/ui/sidebar-strip.test.ts::no_rule_may_stop_the_sidebar_rising_above_`.main`_(bean_`vfr8`)::every_`z-index`_on_the_sidebar_itself_is_a_number_at_or_above_the_open-nav_value
  Scenario: Every z-index on the sidebar itself is at least the open-nav value
    Given every rule in docs-ui.css whose subject is .side-bar and which sets a z-index
    When the hover rule's value is taken as the floor
    Then at least 2 such rules exist
    And the hover rule's value is a finite number
    And no rule's value is non-numeric or below that floor

  @test:scripts/tests/ui/sidebar-strip.test.ts::no_rule_may_stop_the_sidebar_rising_above_`.main`_(bean_`vfr8`)::`auto`_in_particular_is_refused_—_it_is_what_the_defect_actually_was
  Scenario: No sidebar z-index is "auto"
    Given every rule in docs-ui.css whose subject is .side-bar and which sets a z-index
    When their values are read
    Then none is "auto"
