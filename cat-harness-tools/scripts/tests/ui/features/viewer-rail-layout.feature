# scripts/check-viewer-nav.ts grades the viewer rail's layout criteria (#1757) with layoutFlags and
# the docs site's strip with stripFlags, against the rails scripts/lib/harness-rail.ts and
# scripts/lib/navbar.ts draw. Each Scenario names the test that executes it.
Feature: Viewer rail layout flags

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::passes_a_rail_with_a_marked_header_and_one_open_section_of_its_own
  Scenario: A rail with a marked header and one open section of its own passes
    Given a page with two h2 sections, railed with the visualiser label "todos"
    When its layout is graded
    Then there are no flags

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::flags_a_page_with_no_section_of_its_own,_and_Graphs_open_instead
  Scenario: A page with no section of its own is flagged
    Given a page with only an h1, railed with no visualiser label
    When its layout is graded
    Then the flags are "visualiser-nav" and "single-open"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::flags_the_old_☰_header_and_its_[x]
  Scenario: The old hamburger header and its close label are flagged
    Given a bare rail with an "x" close label and a "☰" header glyph
    When its layout is graded
    Then the flags include "clickable-mark" and "no-redundant-toggle"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::flags_a_hamburger-SHAPED_group_glyph,_which_reads_as_the_toggle_that_was_removed
  Scenario: A hamburger-shaped group glyph is flagged as the removed toggle
    Given a real rail, whose open group glyph is not "≡"
    When that glyph is replaced with "≡"
    Then the only flag is "no-redundant-toggle"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::flags_a_rail_with_no_header_at_all
  Scenario: A rail with no header is flagged
    Given a page whose rail is an empty nav
    When its layout is graded
    Then the flags include "header"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::layoutFlags::grades_nothing_on_a_page_with_no_rail_—_that_is_`missing`,_not_five_flags
  Scenario: A page with no rail gets no layout flags
    Given a page with only a paragraph and no rail
    When its layout is graded
    Then there are no flags

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::passes_the_real_rail:_every_icon-only_control_is_tipped_and_▦_Harnesses_shows_at_rest
  Scenario: The real rail passes with every icon-only control tipped
    Given the real rail
    Then its layout has no flags
    And with a gear control whose tooltip equals its aria-label added, it still has none

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::flags_an_icon-only_control_with_no_tooltip
  Scenario: An icon-only control with no tooltip is flagged
    Given the real rail with a gear control that has an aria-label but no tooltip
    When its layout is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::flags_a_tooltip_that_says_something_other_than_the_control's_name
  Scenario: A tooltip that differs from the control's name is flagged
    Given the real rail with a gear control labelled "Configuration of X" and tipped "Settings"
    When its layout is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::does_NOT_ask_a_labelled_row_for_a_tooltip_—_opening_the_rail_shows_its_label_beside_the_mark
  Scenario: A labelled row is not asked for a tooltip
    Given the real rail's nav
    Then it holds a "fa-nav-label" element
    And it has no untipped controls

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::flags_a_tipped_control_on_a_page_whose_stylesheet_paints_no_tooltip_on_focus
  Scenario: A tooltip the stylesheet does not paint on focus is flagged
    Given the real rail with a tipped gear control
    And its stylesheet shows the tooltip on hover only
    When its layout is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::the_rail's_own_⚙_carries_the_tooltip,_equal_to_its_aria-label
  Scenario: The rail's own gear carries a tooltip equal to its aria-label
    Given a navbar whose Harnesses group holds "WHO IRIS" with a configuration action
    When the navbar is drawn
    Then the action carries aria-label and data-fa-tip both "Configuration of WHO IRIS"
    And it has no untipped controls

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::flags_▦_Harnesses_hidden_at_rest,_and_not_a_rule_conditioned_on_another_state
  Scenario: Harnesses hidden at rest is flagged, a rule for another state is not
    Given the real rail with an added style rule
    Then hiding the group summary with "opacity:0" is flagged "harnesses-at-rest"
    And collapsing it with "max-height:0" under another selector is flagged "harnesses-at-rest"
    And hiding it only under ".fa-nav:hover" is not flagged
    And hiding only its "::marker" is not flagged

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::ob3m_finding_1_—_tooltips_on_icon-only_controls,_▦_Harnesses_at_rest::flags_a_rail_with_no_▦_Harnesses_disclosure_at_all
  Scenario: A rail with no Harnesses disclosure is flagged
    Given the real rail with its Harnesses group replaced by an unlabelled details
    When its layout is graded
    Then the flags include "harnesses-at-rest"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::stripFlags_—_the_same_two_questions_of_the_docs_site's_strip::passes_the_shipped_docs-ui.js,_navbar-row.js_and_docs-ui.css
  Scenario: The shipped docs-ui.js, navbar-row.js and docs-ui.css pass the strip check
    Given the site's shipped docs-ui.js, navbar-row.js and docs-ui.css
    When the strip is graded
    Then there are no flags

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::stripFlags_—_the_same_two_questions_of_the_docs_site's_strip::flags_a_row_control_built_without_data-fa-tip
  Scenario: A row control built without data-fa-tip is flagged
    Given navbar-row.js with the launcher's "data-fa-tip" attribute removed
    When the strip is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::stripFlags_—_the_same_two_questions_of_the_docs_site's_strip::flags_the_light/dark_switch_when_its_painter_stops_writing_the_tooltip
  Scenario: The light/dark switch is flagged when its painter stops writing the tooltip
    Given docs-ui.js with the scheme switch's "data-fa-tip" write removed
    When the strip is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::stripFlags_—_the_same_two_questions_of_the_docs_site's_strip::flags_a_stylesheet_that_shows_the_tooltip_on_hover_only
  Scenario: A stylesheet showing the tooltip on hover only is flagged
    Given docs-ui.css with the side bar's focus-visible tooltip selector removed
    When the strip is graded
    Then the only flag is "rail-tips"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::stripFlags_—_the_same_two_questions_of_the_docs_site's_strip::flags_▦_Harnesses_left_to_the_at-rest_lists,_which_hide_it
  Scenario: Harnesses left to the at-rest lists is flagged
    Given docs-ui.css with the side bar's bottom group summary rule removed
    When the strip is graded
    Then the only flag is "harnesses-at-rest"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::withHeadingIds::mints_ids_for_bare_headings,_keeping_existing_ones_and_avoiding_collisions
  Scenario: Bare headings get minted ids that keep existing ones and avoid collisions
    Given an h2 with id "sec-a" and a bare h2 and h3 both titled "A"
    When heading ids are added
    Then the first h2 keeps "sec-a"
    And the bare h2 gets "sec-a-2" and the h3 gets "sec-a-3"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::withHeadingIds::never_edits_a_heading_inside_a_script
  Scenario: A heading inside a script is never edited
    Given a script whose string holds an h2 tag
    When heading ids are added
    Then the text is unchanged

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::sibling_rows_in_a_group_share_one_indent_(owner,_2026-10-01)::a_label-only_row_is_indented_like_a_linked_one;_a_kind_row_stays_flush
  Scenario: A label-only row is indented like a linked row in a group
    # Gap: that the kind row stays flush is not checked, only that its rule exists
    Given the navbar stylesheet
    Then a group sub-row's dead label has the same inline-start padding as its link
    And it has a rule for a dead kind row

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::a_declared_mark_is_drawn,_never_replaced_by_the_letter_—_bean_`2vpn`::a_glyph_mark_renders_as_an_<svg>_in_the_header
  Scenario: A declared glyph mark renders as an svg in the header
    Given a rail for "WHO IRIS" with a glyph mark
    Then its header holds an svg
    And its layout has no flags when "WHO IRIS" is known to have a mark

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::a_declared_mark_is_drawn,_never_replaced_by_the_letter_—_bean_`2vpn`::a_LETTER_for_a_harness_that_has_a_mark_is_the_`declared-mark`_finding
  Scenario: A letter for a harness that has a mark is a declared-mark finding
    Given a rail for "WHO IRIS" with no mark given
    When its layout is graded with "WHO IRIS" known to have a mark
    Then the flags include "declared-mark"

  @test:scripts/tests/ui/viewer-rail-layout.test.ts::a_declared_mark_is_drawn,_never_replaced_by_the_letter_—_bean_`2vpn`::a_letter_for_a_harness_with_NO_mark_is_still_the_floor,_not_a_finding
  Scenario: A letter for a harness with no mark is not a finding
    Given a rail for "WHO IRIS" with no mark given
    When its layout is graded with no harness known to have a mark
    Then the flags do not include "declared-mark"
