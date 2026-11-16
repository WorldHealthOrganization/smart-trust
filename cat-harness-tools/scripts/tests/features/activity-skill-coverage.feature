# Every activity in the harness's process diagrams (read through
# src/workflow/process-model.ts) names a skill or declares why it has none.
# Each Scenario names the test that executes it.
Feature: Every process activity names a skill or says why not

  @test:scripts/tests/activity-skill-coverage.test.ts::every_activity_names_a_skill_or_declares_why_it_has_none::the_corpus_is_non-empty_—_otherwise_this_proves_nothing
  Scenario: The process diagram corpus is non-empty
    Given the harness's declared process diagrams
    Then there are more than 10 of them

  @test:scripts/tests/activity-skill-coverage.test.ts::every_activity_names_a_skill_or_declares_why_it_has_none::no_activity_is_silently_skill-less
  Scenario: No activity in the corpus is silently skill-less
    Given the harness's role graph is declared
    And every process diagram in the corpus is loaded
    When each activity is checked
    Then an activity passes if it names a skill, calls another process, declares a no-skill reason, or sits in a lane whose role is judgement-only
    And the list of activities that do none of these is empty
