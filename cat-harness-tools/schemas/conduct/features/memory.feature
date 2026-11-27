# Specifies agent memory as a graph node (schemas/conduct/memory.ts): a baseline's
# provenance, no status field, overlay by id across layers, and scoping by role.
# Each Scenario names the test that executes it.
Feature: Agent memory nodes carry provenance, overlay by id and reach agents by role

  @test:schemas/conduct/memory.test.ts::a_BASELINE_must_carry_its_provenance::a_baseline_WITHOUT_`measured`_is_refused
  Scenario: A baseline without a measurement is refused
    Given a memory entry labelled "baseline" with no "measured"
    When it is checked against the memory schema
    Then it fails with an issue naming "provenance"

  @test:schemas/conduct/memory.test.ts::a_BASELINE_must_carry_its_provenance::a_baseline_WITH_command,_date_and_result_parses
  Scenario: A baseline with command, date and result parses
    Given a memory entry labelled "baseline" measured by "bun run cat kg:audit" on "2026-09-19" with result "fail 0"
    When it is parsed
    Then its measured command is "bun run cat kg:audit"

  @test:schemas/conduct/memory.test.ts::a_BASELINE_must_carry_its_provenance::STABLE_and_TRAP_need_no_provenance_—_they_are_not_numbers
  Scenario: Stable and trap entries need no measurement
    Given memory entries labelled "stable" and "trap" with no "measured"
    When they are parsed
    Then they keep the labels "stable" and "trap"

  @test:schemas/conduct/memory.test.ts::memory_carries_no_status,_deliberately::a_status_field_is_not_part_of_the_shape
  Scenario: A memory entry has no status field
    Given a parsed memory entry
    Then it has no "status" property

  @test:schemas/conduct/memory.test.ts::overlay_is_by_id,_in_dependency_order::a_nearer_layer_overrides_an_id_from_a_further_one
  Scenario: A nearer layer's entry overrides the same id from a further layer
    Given an entry "x" from a dependency and an entry "x" from this instance
    When the layers are overlaid, dependency first
    Then one entry remains, with the instance's summary

  @test:schemas/conduct/memory.test.ts::overlay_is_by_id,_in_dependency_order::different_ids_both_survive_—_same_subject_is_not_the_same_entry
  Scenario: Entries with different ids both survive, even with the same summary
    Given entries "a" and "b" in two layers, both with summary "s"
    When the layers are overlaid
    Then both "a" and "b" remain

  @test:schemas/conduct/memory.test.ts::overlay_is_by_id,_in_dependency_order::order_is_least-specific-first,_so_the_LAST_layer_wins
  Scenario: The last layer wins an id
    Given three layers each with an entry "x", summaries "1", "2" and "3"
    When they are overlaid in that order
    Then the entry's summary is "3"

  @test:schemas/conduct/memory.test.ts::role_scoping_—_the_thing_that_ends_the_duplication::an_untagged_entry_reaches_EVERY_agent
  Scenario: An entry with no role tag reaches every agent
    # Gap: only one role is tried
    Given an untagged entry "shared"
    When the memory for an agent taking role "reviewer" is selected
    Then it is "shared"

  @test:schemas/conduct/memory.test.ts::role_scoping_—_the_thing_that_ends_the_duplication::a_role-tagged_entry_reaches_only_agents_taking_that_role
  Scenario: A role-tagged entry reaches only agents taking that role
    Given an entry "a" tagged "author" and an entry "r" tagged "reviewer"
    When the memory for an agent taking role "reviewer" is selected
    Then it is only "r"

  @test:schemas/conduct/memory.test.ts::role_scoping_—_the_thing_that_ends_the_duplication::an_agent_taking_several_roles_gets_the_union
  Scenario: An agent taking several roles gets the entries of each
    Given entries "a" tagged "author", "r" tagged "reviewer" and "e" tagged "editor"
    When the memory for an agent taking "author" and "editor" is selected
    Then it is "a" and "e"
