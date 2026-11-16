# scripts/agent-memory.ts: memory entries hand themselves to the lanes whose roles they name,
# so every role a live entry names must exist. Each Scenario names the test that executes it.
Feature: Memory entries name roles that exist

  @test:scripts/tests/conduct/memory-refs.test.ts::memory_entries_name_roles_and_agents_that_exist::the_corpus_is_non-empty,_so_the_assertions_below_are_not_vacuous
  Scenario: The memory corpus is non-empty, so the checks are not vacuous
    Given the declared roles in cat-harness/scenarios/roles.json
    And the unarchived "folio-memory/v1" entries in every declared memory directory, README.md excluded
    Then at least one role is declared
    And at least one entry exists
    And at least one entry names roles

  @test:scripts/tests/conduct/memory-refs.test.ts::memory_entries_name_roles_and_agents_that_exist::every_`roles:`_value_is_a_declared_role
  Scenario: Every roles value is a declared role
    Given the unarchived memory entries and the declared roles
    When each entry's roles are checked
    Then no entry names a role that is not declared

  @test:scripts/tests/conduct/memory-refs.test.ts::memory_entries_name_roles_and_agents_that_exist::no_entry_carries_the_retired_`agents:`_shorthand
  Scenario: No entry carries the retired agents shorthand
    Given the unarchived memory entries
    Then no entry's front matter has an "agents" field
