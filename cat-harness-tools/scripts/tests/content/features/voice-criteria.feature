# pipeline/voice-criteria.ts derives the voice-overlay QA criteria from the shipped voices:
# each block-judging voice yields one criterion at its declared overlay severity.
# Each Scenario names the test that executes it.
Feature: Voice-overlay criteria derived from the voices

  @test:scripts/tests/content/voice-criteria.test.ts::overlaySeverityOf_is_declared,_never_derived_from_the_rules::it_reads_the_voice's_own_field
  Scenario: A voice's overlay severity is the one it declares
    # Gap: no assertion that any shipped voice declares an overlaySeverity, so the loop may check nothing
    Given the voices shipped in the harness instance
    When overlaySeverityOf is read for each voice that declares an "overlaySeverity"
    Then it equals that declared value

  @test:scripts/tests/content/voice-criteria.test.ts::overlaySeverityOf_is_declared,_never_derived_from_the_rules::a_voice_declaring_none_gets_the_documented_default,_not_the_worst_rule
  Scenario: A voice declaring no overlay severity gets "major", not its worst rule's severity
    Given a voice with no "overlaySeverity" and one rule of severity "critical"
    When overlaySeverityOf is read for it
    Then it is "major"

  @test:scripts/tests/content/voice-criteria.test.ts::overlaySeverityOf_is_declared,_never_derived_from_the_rules::two_of_the_four_disagree_with_the_worst-rule_rule_—_which_is_why_it_is_declared
  Scenario: At least one shipped voice's declared severity differs from its worst rule's severity
    # Gap: the title's "two of the four" is not checked; only that more than zero disagree
    Given the voices shipped in the harness instance
    When each voice's worst rule severity is compared with overlaySeverityOf
    Then at least one voice disagrees

  @test:scripts/tests/content/voice-criteria.test.ts::the_criterion_id_is_composed_in_one_place::`overlayCriterionId`_is_what_the_derivation_uses
  Scenario: Every derived block criterion uses the id overlayCriterionId composes
    # Gap: no assertion that any shipped voice judges blocks, so the loop may check nothing
    Given the shipped voices that judge blocks
    When the voice-overlay criteria are derived
    Then the criterion for each such voice has the id overlayCriterionId gives for that voice

  @test:scripts/tests/content/voice-criteria.test.ts::a_voice_that_judges_only_skills_makes_no_block_criterion::the_skill-authoring_voices_are_shipped,_and_none_is_a_block_overlay
  Scenario: A voice that judges only skills is shipped but makes no block criterion
    Given the shipped voices that do not judge blocks
    Then they include "agent-skill-authoring"
    And no derived voice-overlay criterion has the overlay id of any of them
