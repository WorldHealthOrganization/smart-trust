# prune-transitive-deps.ts --paper takes the token after it; a flag or nothing
# there is a usage error raised before repo discovery. Run from an empty temp
# directory. Each Scenario names the test that executes it.
Feature: The --paper argument of prune-transitive-deps needs a value

  @test:scripts/tests/prune-transitive-deps-args.test.ts::--paper_argument_validation::a_following_flag_is_refused,_not_taken_as_the_paper_name
  Scenario: A flag after --paper is refused, not taken as the paper name
    Given an empty working directory above no content repo
    When the script is run with "--paper --apply"
    Then it exits non-zero
    And its output says "--paper needs a value" and "another flag"
    And its output does not contain "papers found"

  @test:scripts/tests/prune-transitive-deps-args.test.ts::--paper_argument_validation::a_trailing_--paper_with_nothing_after_it_is_refused
  Scenario: A trailing --paper with nothing after it is refused
    Given an empty working directory above no content repo
    When the script is run with "--paper" alone
    Then it exits non-zero
    And its output says "--paper needs a value" and "Nothing followed it"

  @test:scripts/tests/prune-transitive-deps-args.test.ts::--paper_argument_validation::a_well-formed_--paper_is_not_caught_by_the_guard
  Scenario: A well-formed --paper gets past the guard
    Given an empty working directory above no content repo
    When the script is run with "--paper quantum-observable-universe"
    Then it exits non-zero for another reason
    And its output does not contain "needs a value"
