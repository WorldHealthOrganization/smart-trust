# scripts/check-fallback-roles.ts resolves each "fallback" degradation against the declared roles and capabilities: the fallback role is derived
# from the BPMN diagrams, and a capability's fallbackTo must not transitively require what it replaces. Each Scenario names the test that executes it.
Feature: Fallbacks resolve to something real

  @test:scripts/tests/fallback-roles.test.ts::the_registries_it_resolves_against::both_are_non-empty,_or_every_resolution_below_is_vacuous
  Scenario: The role and capability registries are not empty
    Given the harness checkout
    Then more than 10 roles are declared
    And more than 5 capabilities are declared

  @test:scripts/tests/fallback-roles.test.ts::the_registries_it_resolves_against::roles_are_read_through_the_declaration,_so_relocating_the_kg_graph_cannot_blind_it
  Scenario: Roles are read through the declaration
    Given the harness checkout
    When the declared roles are read
    Then they include "publication-manager"

  @test:scripts/tests/fallback-roles.test.ts::the_derivation_that_replaced_the_declaration::qa-report-signing_falls_back_to_publication-manager,_from_the_DIAGRAM
  Scenario: qa-report-signing falls back to publication-manager, derived from the diagram
    Given the fallback roles derived for every skill from the diagrams
    Then "qa-report-signing" has exactly the role "publication-manager"

  @test:scripts/tests/fallback-roles.test.ts::the_derivation_that_replaced_the_declaration::a_skill_with_no_human-only_lane_derives_nothing,_rather_than_guessing
  Scenario: A skill with no human-only lane derives no fallback role
    Given the fallback roles derived for every skill from the diagrams
    Then "formalizer" has no role

  @test:scripts/tests/fallback-roles.test.ts::the_derivation_that_replaced_the_declaration::the_retired_field_is_gone_from_both_declarations_and_from_the_corpus
  Scenario: The retired fallbackRole field is gone from the declarations and the corpus
    Given the modules schemas/conduct/assistant-types.ts and schemas/kg/skill-package.ts
    Then neither declares a "fallbackRole" field
    And the scan of the corpus finds at least one fallback use
    And no fallback use carries a "fallbackRole" property

  @test:scripts/tests/fallback-roles.test.ts::the_scan::finds_a_fallback_and_the_capability_it_is_for
  Scenario: The scan finds a fallback and the capability it is for
    Given skills/a.ts with capability "c1" degrading by "fallback" and skills/b.ts with capability "c3" degrading by "fail"
    When the skills directory is scanned
    Then the only use found is skill "a" for capability "c1"

  @test:scripts/tests/fallback-roles.test.ts::the_scan::does_NOT_read_its_own_documentation_as_corpus
  Scenario: The scan ignores fallbacks mentioned in comments
    Given skills/a.ts whose only "degradation: fallback" mentions are in a JSDoc block and a line comment
    When the skills directory is scanned
    Then no fallback use is found

  @test:scripts/tests/fallback-roles.test.ts::the_scan::a_.test.ts_file_is_not_corpus
  Scenario: A .test.ts file is not scanned as corpus
    Given skills/a.test.ts declaring a fallback for capability "c"
    When the skills directory is scanned
    Then no fallback use is found

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::`fallbackTo`_is_declared_ONCE,_on_the_capability_it_is_a_property_of
  Scenario: fallbackTo is declared once, on the capability
    # Skipped: when the checkout does not hold folio-assistant-sci's capabilities (lean-toolchain)
    Given the capability facts of the whole checkout
    Then "lean-toolchain" declares fallbackTo "lean-mcp"
    And no scanned fallback use carries a "fallbackCapabilityId" property

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::the_fallback_CAN_fire_—_inverted_2026-09-20,_and_that_is_the_point
  Scenario: The lean-mcp fallback does not require the toolchain it replaces
    Given the capability facts of the whole checkout
    Then "lean-mcp" does not require "lean-toolchain"
    And "lean-mcp" does not transitively require "lean-toolchain"

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::no_declared_fallback_anywhere_needs_the_thing_it_replaces
  Scenario: No declared fallback transitively requires the capability it replaces
    Given the capability facts of the whole checkout
    Then for every capability with a fallbackTo, the fallback does not transitively require that capability

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::the_predicate_is_not_vacuously_false_—_it_fires_on_a_real_chain
  Scenario: The transitive-requires check fires on a real chain
    Given a capability "substitute" that requires "missing"
    Then "substitute" transitively requires "missing"

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::transitivity_is_followed,_and_a_cycle_terminates
  Scenario: Transitive requirements are followed and a cycle terminates
    Given a requires "b", b requires "c", and x and y require each other
    Then "a" transitively requires "c"
    And "a" does not transitively require "z"
    And "x" does not transitively require "z", without looping

  @test:scripts/tests/fallback-roles.test.ts::the_capability-level_fallback,_and_the_contradiction_it_exposed::the_id-set_helper_still_agrees_with_the_facts_map
  Scenario: The capability id set matches the platform's capability facts
    Given the platform's own capability facts
    Then the declared capability ids equal the keys of those facts

  @test:scripts/tests/fallback-roles.test.ts::the_batch_pass_agrees_with_asking_per_skill_—_bounded_regression_check::the_same_roles_come_back_for_up_to_6_sampled_skills
  Scenario: The batch and the per-skill path agree on a bounded sample
    # Gap: a regression check over the first 6 skills by name, not a proof over every skill
    Given the fallback roles derived for every skill in one batch, and its first 6 skills by name
    Then the batch is not empty, the sample is not empty, and some sampled skill has a role
    And asking for each sampled skill alone gives the same roles as the batch
    And asking alone for "no-such-skill-anywhere" gives no roles

  @test:scripts/tests/fallback-roles.test.ts::the_batch_pass_agrees_with_asking_per_skill_—_bounded_regression_check::a_skill_in_NO_diagram_is_absent_from_the_batch_and_empty_from_the_single_path
  Scenario: A skill in no diagram is absent from the batch
    Given the fallback roles derived for every skill in one batch
    Then "no-such-skill-anywhere" is not in the batch
    And reading it yields no roles

  @test:scripts/tests/fallback-roles.test.ts::the_batch_pass_agrees_with_asking_per_skill_—_bounded_regression_check::roles_are_sorted_for_EVERY_skill,_so_two_callers_cannot_see_different_orders
  Scenario: Every skill's fallback roles are sorted
    Given the fallback roles derived for every skill in one batch
    Then each skill's roles are in sorted order
