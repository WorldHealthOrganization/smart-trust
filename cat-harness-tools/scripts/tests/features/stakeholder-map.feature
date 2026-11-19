# The stakeholder map reports what it can derive, and says what it cannot.
# Each Scenario names the test that executes it.
Feature: Stakeholder map of a change

  Background:
    Given the stakeholder map of a change to the todo-manager skill

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::a_changed_skill_resolves_to_its_name_and_path
  Scenario: A changed skill resolves to its name and path
    Then the skills are todo-manager, with a path ending in todo-manager.md
    And nothing is untraced

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::roles_come_from_the_LANES_reached,_and_every_one_resolves_in_the_registry
  Scenario: Roles come from the lanes and resolve in the registry
    Then at least one role is reached and the role registry is not empty
    And every role reached is declared in the registry
    And none is reader, collaborator or owner

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::a_lane_binding_no_declared_role_is_UNDETERMINED,_not_silently_roleless
  Scenario: A lane binding no declared role is reported undetermined
    # Gap: conditional on the corpus: when every lane binds a declared role, the assertion holds trivially and the reporting path is not exercised.
    When lanes with no role ref or an undeclared one are found
    Then if any exist, the not-determined notes say "binding no declared role"

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::a_changed_skill_reaches_the_process_lanes_accountable_for_using_it
  Scenario: A changed skill reaches its process lanes
    Then at least one lane is reached
    And every lane reached is via todo-manager with at least one activity

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::a_path_that_is_not_a_skill_is_untraced,_not_silently_dropped
  Scenario: A path that is not a skill is untraced
    When the map of a change to README.md is built
    Then README.md is untraced and no skill is mapped
    And the not-determined notes say "unknown impact"

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::the_undetermined_part_is_always_reported,_even_on_a_clean_mapping
  Scenario: The undetermined part is always reported
    Then there is at least one not-determined note, the first saying the tool "does not guess"

  @test:scripts/tests/stakeholder-map.test.ts::stakeholder_map::the_report_names_the_lanes_and_the_undetermined_section
  Scenario: The report names the lanes and the undetermined section
    When the map is formatted
    Then it says "Process lanes reached" and "NOT DETERMINED"
