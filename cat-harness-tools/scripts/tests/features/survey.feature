# A published survey's window is checkable, and an uncheckable one is never
# reported as covered (bean 6ptx). Each Scenario names the test that executes it.
Feature: Session surveys

  Background:
    Given a scratch git repository with real commits on "main" and a declared surveys node

  @test:scripts/tests/survey.test.ts::no_survey_is_a_determined_empty,_not_an_error
  Scenario: No survey is a determined empty
    Given no survey is planted
    When what is owed on "main" is asked for
    Then the answer is "no-survey"

  @test:scripts/tests/survey.test.ts::a_survey_at_the_tip_is_COVERED
  Scenario: A survey at the tip covers the branch
    Given a survey whose upper edge is the tip of a 3-commit history
    Then what is owed is "covered"

  @test:scripts/tests/survey.test.ts::a_survey_behind_the_tip_yields_the_DELTA,_counted_by_git
  Scenario: A survey behind the tip yields the delta
    Given a 5-commit history and a survey whose upper edge is the second commit
    Then what is owed is a "delta" from that commit of 3 commits

  @test:scripts/tests/survey.test.ts::an_UNREACHABLE_upper_edge_is_unusable_—_never_covered
  Scenario: An unreachable upper edge is unusable
    Given a survey whose upper edge is a sha not in the history
    Then what is owed is "unusable"

  @test:scripts/tests/survey.test.ts::the_FURTHEST-ALONG_survey_wins,_not_the_most_recently_taken
  Scenario: The furthest-along survey wins
    Given a 5-commit history with surveys up to the second and the fourth commit
    Then what is owed is a "delta" from the fourth commit of 1 commit

  @test:scripts/tests/survey.test.ts::a_JSON_file_that_does_not_declare_itself_is_not_a_survey
  Scenario: A JSON file without the survey $schema is not a survey
    Given a JSON file in the surveys directory with no $schema
    Then no surveys are read
    When a real survey is planted
    Then one survey is read

  @test:scripts/tests/survey.test.ts::the_schema_refuses_a_ref_where_an_object_name_belongs
  Scenario: The survey schema refuses a ref as an edge
    Given a survey whose upper edge is "origin/main"
    Then the schema refuses it
    And the same survey with a 40-hex sha is accepted

  @test:scripts/tests/survey.test.ts::a_survey_with_no_axes_is_refused
  Scenario: A survey with no axes is refused
    Given an otherwise valid survey with an empty axes list
    Then the schema refuses it
