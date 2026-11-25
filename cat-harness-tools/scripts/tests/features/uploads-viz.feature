# The uploads visualiser's wireframe findings (folio-assistant-s0ki), read from
# the viewer's HTML and from the generator's source text.
# Each Scenario names the test that executes it.
Feature: Uploads visualiser wireframe findings

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_1:_Default_sort_prioritizes_waiting_rows_first::default_sortKey_is_state_and_sortAsc_is_true
  Scenario: The default sort is by state, ascending
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source sets sortKey to "state" and sortAsc to true

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_1:_Default_sort_prioritizes_waiting_rows_first::sorting_by_state_prioritizes_waiting_before_ingested
  Scenario: Waiting rows rank before ingested ones
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source ranks state "waiting" as 0 and anything else as 1, for both rows compared

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_3:_Keyboard_and_accessible_sorting::table_headers_contain_button_elements_with_data-k_attributes
  Scenario: Table headers hold sort buttons
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source writes buttons with a data-k attribute and styles "th button"

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_3:_Keyboard_and_accessible_sorting::table_headers_include_aria-sort_attributes
  Scenario: Table headers carry aria-sort
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source writes aria-sort "ascending", "descending" and "none"

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_3:_Keyboard_and_accessible_sorting::CSS_provides_focus_indicator_for_sort_buttons
  Scenario: Sort buttons have a focus indicator
    When the viewer HTML is generated
    Then it styles "th button:focus-visible" and has an outline rule

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_4:_State_badge_emphasis_not_by_colour_alone::lead_badge_has_distinct_border_and_background_styling
  Scenario: The lead badge has a border and background
    When the viewer HTML is generated
    Then ".badge.lead" has a 2px solid border and the waiting background

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_4:_State_badge_emphasis_not_by_colour_alone::lead_badge_includes_semantic_icon_and_text_tag
  Scenario: The lead badge has an icon and a text tag
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source holds "lead-icon", "lead-tag", "action needed" and the hourglass entity

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_5:_Size_column_wrapping_prevention::CSS_ensures_size_column_does_not_wrap_mid-token
  Scenario: The size column does not wrap
    When the viewer HTML is generated
    Then ".size" has white-space nowrap and there is a 6rem minimum width

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_5:_Size_column_wrapping_prevention::size_formatting_uses_non-breaking_space
  Scenario: Sizes use a non-breaking space
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source writes a non-breaking space before "MB" and "KB"

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_6:_Grouping_and_distinguishing_unhelpful_filenames::raw_screenshot_and_UUID_captures_are_identified
  Scenario: Raw captures are identified
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source holds "isRawCapture", "ChatGPT", "capture-tag" and "raw capture"

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_6:_Grouping_and_distinguishing_unhelpful_filenames::raw_captures_receive_distinct_CSS_styling
  Scenario: Raw captures are styled distinctly
    When the viewer HTML is generated
    Then it styles ".capture-tag" and ".capture-name"

  @test:scripts/tests/uploads-viz.test.ts::uploads_visualiser_wireframe_findings_(folio-assistant-s0ki)::Finding_6:_Grouping_and_distinguishing_unhelpful_filenames::table_organizes_rows_into_grouped_tbody_elements_with_group_headers
  Scenario: Rows are grouped under group headers
    # Gap: asserts on the text of gen-uploads-viz.ts, not on the rendered page or its behaviour.
    Then the generator's source writes "group-row" rows with colgroup scope, headed "Waiting to be ingested" and "Ingested into library/"
