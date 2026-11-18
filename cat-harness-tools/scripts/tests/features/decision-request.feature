# schemas/process/decision-request.ts refuses a decision request that omits any part of the
# comparison, and renders one with the table before the question. Each Scenario names the test that executes it.
Feature: A decision request carries its full comparison before the question

  @test:scripts/tests/decision-request.test.ts::a_complete_decision_parses::the_whole_shape
  Scenario: A complete decision request parses
    Given a decision request with every field and two fully described options
    When it is parsed
    Then the parse succeeds

  @test:scripts/tests/decision-request.test.ts::each_omission_is_REFUSED,_not_tolerated::no_`%s`_—_%s
  Scenario: A decision request missing a top-level field is refused
    Given the complete decision request with one field removed
    When it is parsed
    Then the parse fails
    And this holds for each of "decides", "glossary", "recommends", "because", "ifSilent", "question" and "othersPending"

  @test:scripts/tests/decision-request.test.ts::each_omission_is_REFUSED,_not_tolerated::an_option_with_no_`%s`_—_the_comparison_is_unomittable,_not_merely_required
  Scenario: An option missing a comparison column is refused
    Given the complete decision request whose option "A" lacks one column
    When it is parsed
    Then the parse fails
    And this holds for each of "does", "pro", "con", "downstream" and "reversibility"

  @test:scripts/tests/decision-request.test.ts::the_bounds_interaction-modality_§4.2_states::one_option_is_not_a_choice
  Scenario: A decision with one option is refused
    Given a decision request with only option "A", recommended
    When it is parsed
    Then the parse fails

  @test:scripts/tests/decision-request.test.ts::the_bounds_interaction-modality_§4.2_states::five_options_is_a_question_that_should_be_split
  Scenario: A decision with five options is refused
    Given a decision request with options "A" to "E"
    When it is parsed
    Then the parse fails

  @test:scripts/tests/decision-request.test.ts::the_bounds_interaction-modality_§4.2_states::a_recommendation_naming_no_option_is_refused
  Scenario: A recommendation naming no option is refused
    Given a decision request recommending "Neither"
    When it is parsed
    Then the parse fails

  @test:scripts/tests/decision-request.test.ts::the_bounds_interaction-modality_§4.2_states::two_options_sharing_a_label_are_refused_—_the_reader_cannot_tell_them_apart
  Scenario: Two options sharing a label are refused
    Given a decision request with two options both labelled "A"
    When it is parsed
    Then the parse fails

  @test:scripts/tests/decision-request.test.ts::the_bounds_interaction-modality_§4.2_states::an_unknown_field_is_refused_rather_than_dropped
  Scenario: An unknown field is refused
    Given the complete decision request with an extra "urgency" field
    When it is parsed
    Then the parse fails

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::the_recommended_option_comes_first_and_is_marked
  Scenario: The recommended option is the first column and is marked
    Given the rendered complete decision request
    When its table header row is read
    Then "Report them" comes before "Leave it"
    And the header contains "*(recommended)*"

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::all_five_comparison_rows_are_present
  Scenario: All five comparison rows are rendered
    Given the rendered complete decision request
    Then it contains the rows "What it does", "Pro", "Con", "Downstream" and "Reversibility"

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::the_question_is_LAST
  Scenario: The question is the last thing rendered
    Given the rendered complete decision request
    Then it ends with the question "Report quiet claims?"

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::the_table_precedes_the_question_—_the_whole_point
  Scenario: The comparison table precedes the question
    Given the rendered complete decision request
    Then the "Con" row appears before the question

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::the_silence_default_is_stated
  Scenario: The silence default is stated
    Given the rendered complete decision request
    Then it contains "**If you say nothing:**"

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::other_pending_decisions_are_a_COUNT,_never_a_list_of_names
  Scenario: Other pending decisions are rendered as a count
    # Gap: the absence of any list of decision names is not checked
    Given a decision request with 2 other decisions pending
    When it is rendered
    Then it contains "2 other decisions are waiting"

  @test:scripts/tests/decision-request.test.ts::the_render_puts_the_comparison_BEFORE_the_question::the_glossary_is_rendered_before_the_table
  Scenario: The glossary is rendered before the table
    Given the rendered complete decision request
    Then the glossary term "quiet" appears before the table header
