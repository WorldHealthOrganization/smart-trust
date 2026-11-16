# The `consulted: true` skill annotation as read by scripts/known-skills (consultedSkills,
# knownSkills): the axis that marks a skill as read rather than performed.
# Each Scenario names the test that executes it.
Feature: The consulted-skill annotation is real and spelled one way

  @test:scripts/tests/consulted-skills.test.ts::the_annotation_is_read,_and_by_more_than_nothing::the_set_is_non-empty,_or_the_exemption_is_invisible_either_way
  Scenario: The consulted set is non-empty and holds known consulted skills
    Given the harness root
    When the consulted skills are read
    Then there are more than 10 of them
    And they include "directory-conventions", "untrusted-input" and "turn-reporting"

  @test:scripts/tests/consulted-skills.test.ts::the_annotation_is_read,_and_by_more_than_nothing::a_PERFORMED_skill_is_not_annotated,_or_the_axis_says_nothing
  Scenario: Performed skills are not marked consulted
    Given the consulted skills of the harness root
    Then none of "build-pdf", "proof-triage", "lean-generation" or "todo-manager" is among them

  @test:scripts/tests/consulted-skills.test.ts::the_annotation_is_read,_and_by_more_than_nothing::it_annotates_a_minority_—_an_axis_that_swallows_the_corpus_is_not_an_axis
  Scenario: Only a minority of skills is marked consulted
    Given the known skills and the consulted skills of the harness root
    Then there are more than 100 known skills
    And the consulted skills are fewer than half of them

  @test:scripts/tests/consulted-skills.test.ts::the_annotation_is_read,_and_by_more_than_nothing::every_annotation_resolves_to_a_skill_this_instance_knows
  Scenario: Every consulted skill is a known skill
    Given the known skills and the consulted skills of the harness root
    Then every consulted skill is among the known skills

  @test:scripts/tests/consulted-skills.test.ts::the_spelling::`consulted:_true`_is_not_written_any_other_way
  Scenario: Every consulted line is spelled exactly "consulted: true"
    Given every Markdown file under skills/ and src/skills/
    When each file's "consulted:" line is read
    Then every such line has the value "true"
