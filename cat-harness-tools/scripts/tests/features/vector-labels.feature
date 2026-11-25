# The vector arm's labels sidecar, and the three refusals that are easy to undo
# (bean a8wy). Each Scenario names the test that executes it.
Feature: Vector labels

  Background:
    Given a labels sidecar for one landscape page with a caption candidate and one label

  @test:scripts/tests/vector-labels.test.ts::the_third_state_is_a_reason,_not_an_absence::a_determined_empty_list_parses_—_it_is_the_finding_that_nothing_qualified
  Scenario: An empty pages list is valid
    Then a sidecar with no pages is accepted

  @test:scripts/tests/vector-labels.test.ts::the_third_state_is_a_reason,_not_an_absence::`pages:_null`_without_a_reason_is_refused
  Scenario: Null pages without a reason are refused
    Then a sidecar with pages null and no reason is refused, mentioning "undetermined_reason"

  @test:scripts/tests/vector-labels.test.ts::the_third_state_is_a_reason,_not_an_absence::`pages:_null`_WITH_a_reason_parses
  Scenario: Null pages with a reason are valid
    Then a sidecar with pages null and reason "pymupdf is not installed" is accepted

  @test:scripts/tests/vector-labels.test.ts::the_third_state_is_a_reason,_not_an_absence::a_determined_result_may_not_also_carry_a_reason
  Scenario: A determined result may not carry a reason
    Then a sidecar with pages and an undetermined reason is refused

  @test:scripts/tests/vector-labels.test.ts::a_page_is_recorded_once::two_entries_for_one_page_are_refused
  Scenario: A page recorded twice is refused
    Then a sidecar with the same page twice is refused, saying "recorded twice"

  @test:scripts/tests/vector-labels.test.ts::a_page_is_recorded_once::two_different_pages_are_fine
  Scenario: Two different pages are valid
    Then a sidecar with pages 25 and 34 is accepted

  @test:scripts/tests/vector-labels.test.ts::a_label_carries_the_four_facts_a_reader_needs_to_check_it::a_bbox_must_be_four_numbers
  Scenario: A bbox must have four numbers
    Then a label with a three-number bbox is refused

  @test:scripts/tests/vector-labels.test.ts::a_label_carries_the_four_facts_a_reader_needs_to_check_it::empty_text_is_refused_—_an_empty_line_is_not_a_label
  Scenario: An empty label text is refused
    Then a label with empty text is refused

  @test:scripts/tests/vector-labels.test.ts::a_label_carries_the_four_facts_a_reader_needs_to_check_it::a_page_with_a_caption_candidate_and_NO_labels_is_allowed
  Scenario: A captioned page with no labels is valid
    Then a page with a caption candidate and no labels is accepted

  @test:scripts/tests/vector-labels.test.ts::a_label_carries_the_four_facts_a_reader_needs_to_check_it::a_page_with_NO_caption_candidate_is_refused_—_that_is_what_makes_it_qualify
  Scenario: A page with no caption candidate is refused
    Then a page with no caption candidates is refused

  @test:scripts/tests/vector-labels.test.ts::a_label_carries_the_four_facts_a_reader_needs_to_check_it::an_unknown_key_is_refused,_so_a_field_cannot_be_added_without_a_schema_change
  Scenario: An unknown label key is refused
    Then a label with a "role" key is refused

  @test:scripts/tests/vector-labels.test.ts::corpus_—_the_three_reversed_decisions,_pinned::page_85_of_the_M&E_guide_is_recorded_—_its_labels_touch_no_drawing
  Scenario: Page 85 of the M&E guide is recorded
    # Gap: returns early with no assertion when the upload is absent or the extractor fails, so it passes silently instead of skipping visibly as the file header claims.
    When the extractor runs over "9789241511766-eng.pdf"
    Then page 85 is recorded with a label containing "Explanatory"
    And none of its labels intersects a drawing

  @test:scripts/tests/vector-labels.test.ts::corpus_—_the_three_reversed_decisions,_pinned::the_tab-separated_captions_of_9789240093362-eng_are_found
  Scenario: Tab-separated captions are found
    # Gap: returns early with no assertion when the upload is absent or the extractor fails, so it passes silently instead of skipping visibly as the file header claims.
    When the extractor runs over "9789240093362-eng.pdf"
    Then at least 15 pages are recorded

  @test:scripts/tests/vector-labels.test.ts::corpus_—_the_three_reversed_decisions,_pinned::page_25_of_the_DIIG_keeps_the_labels_the_intersection_rule_would_drop
  Scenario: Page 25 of the DIIG keeps its floating labels
    # Gap: returns early with no assertion when the upload is absent or the extractor fails, so it passes silently instead of skipping visibly as the file header claims.
    When the extractor runs over "9789240010567-eng.pdf"
    Then page 25 has labels SILOED, INTEGRATED, EXCHANGED and MUD, none intersecting a drawing
    And at least two "HEALTH USE CASE"/"HEALTH PROGRAMME" titles at different x positions
    And a label starting "Monolithic Un-architected"

  @test:scripts/tests/vector-labels.test.ts::corpus_—_the_three_reversed_decisions,_pinned::the_table_of_contents_is_not_recorded_as_a_figure_page
  Scenario: The table of contents is not a figure page
    # Gap: returns early with no assertion when the upload is absent or the extractor fails, so it passes silently instead of skipping visibly as the file header claims.
    When the extractor runs over "9789240010567-eng.pdf"
    Then neither page 7 nor page 8 is recorded

  @test:scripts/tests/vector-labels.test.ts::corpus_—_the_three_reversed_decisions,_pinned::a_scan_with_no_text_layer_is_undetermined,_never_a_determined_empty
  Scenario: The extractor's source guards a scan with no text layer
    # Gap: asserts two strings in the extractor's source text; nothing runs the extractor over a scan or checks the undetermined result.
    When the source of "pdf-vector-labels.py" is read
    Then it contains "carries no extractable text" and "characters == 0"

  @test:scripts/tests/vector-labels.test.ts::the_sidecar's_filename_is_one_constant::it_is_vector-labels.json
  Scenario: The sidecar filename
    Then the vector labels filename is "vector-labels.json"
