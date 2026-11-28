# Specifies triage, staleAnnotations and UNCOVERED_BY_DESIGN
# (scripts/tool-coverage.ts) over the skills of every instance in the
# checkout.
Feature: The uncovered-by-design annotations are current against the real triage

  @test:test/coordinator/tool-coverage-uncovered-by-design-checkout.test.ts::the_real_corpus::no_annotation_is_stale
  Scenario: No uncovered-by-design annotation is stale
    Given the triage of the checkout's skills
    When the stale annotations are found
    Then there are none

  @test:test/coordinator/tool-coverage-uncovered-by-design-checkout.test.ts::the_real_corpus::the_triage_found_skills_—_otherwise_the_check_above_proves_nothing
  Scenario: The triage finds skills, several of them in tier A
    Given the triage of the checkout's skills
    When its rows are counted
    Then there are more than 20
    And more than 5 are in tier A

  @test:test/coordinator/tool-coverage-uncovered-by-design-checkout.test.ts::the_real_corpus::every_annotated_skill_really_is_in_tier_A_right_now
  Scenario: Every annotated skill is in tier A
    Given the triage of the checkout's skills
    When each skill marked uncovered by design is looked up
    Then its tier is "A"
