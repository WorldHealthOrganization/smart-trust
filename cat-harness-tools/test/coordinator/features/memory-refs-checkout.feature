# Specifies that the agent references of every live folio-memory/v1 entry
# in the declared memory directories name a subagent declared under the
# checkout's .claude/agents/.
Feature: Every agent a memory entry references is a declared subagent

  @test:test/coordinator/memory-refs-checkout.test.ts::memory_entries_name_roles_and_agents_that_exist::every_agent_reference_is_a_declared_subagent
  Scenario: Every agent reference resolves to a declared subagent
    Given the non-archived folio-memory/v1 entries of every declared memory directory
    When their "agent" references are collected
    Then there is at least one
    And each names a file .claude/agents/<id>.md that exists in the checkout
