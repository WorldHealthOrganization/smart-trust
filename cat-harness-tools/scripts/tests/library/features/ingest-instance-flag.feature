# ingest-document.ts --instance <dir>: which instance's library an ingest
# writes into. Each Scenario names the test that executes it (skill
# test-engineer, "Every test has a Gherkin").
Feature: The instance an ingest writes into

  @test:scripts/tests/library/ingest-instance-flag.test.ts::resolveInstanceRoot::no_flag:_the_fallback_(the_harness)_is_the_instance
  Scenario: Without --instance the fallback root is the instance
    Given command-line arguments that carry no --instance flag
    When the instance root is resolved against the fallback "/somewhere/cat-harness"
    Then the resolved root is the fallback path

  @test:scripts/tests/library/ingest-instance-flag.test.ts::resolveInstanceRoot::--instance_<dir>_and_--instance=<dir>_both_name_a_declared_instance
  Scenario: Both spellings of --instance name a declared instance
    Given a directory holding an instance declaration with a library directory
    When the instance root is resolved from "--instance <dir>"
    And again from "--instance=<dir>"
    Then both resolve to that directory

  @test:scripts/tests/library/ingest-instance-flag.test.ts::resolveInstanceRoot::a_directory_that_declares_no_instance_is_refused,_never_guessed
  Scenario: A directory with no instance declaration is refused
    Given an empty directory with no instance declaration
    When the instance root is resolved from "--instance <dir>"
    Then resolution throws an error naming "no instance declaration"
