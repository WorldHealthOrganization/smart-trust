# scripts/arrow-direction.ts checks that the dependent holds the pointer: a general schema or a
# process must not point at something that depends on it. Each Scenario names the test that executes it.
Feature: Arrow direction between general and dependent nodes

  @test:scripts/tests/arrow-direction.test.ts::the_dependent_holds_the_pointer_(#1168,_B5)::a_general_node_pointing_at_a_dependent_is_a_finding;_general_to_general_is_not
  Scenario: A general node pointing at a dependent is a finding, general to general is not
    Given general schemas Role and Skill and a dependent schema Voice
    And id-refs Role.skills to Skill, Role.voice to Voice and Voice.roles to Role
    When the schema arrows are checked
    Then the only finding is at "m.ts#Role.voice"

  @test:scripts/tests/arrow-direction.test.ts::the_dependent_holds_the_pointer_(#1168,_B5)::only_declared_id-refs_are_arrows_—_composition_is_part-of,_not_a_pointer
  Scenario: Composition is not an arrow
    Given a general schema Role whose "part" field composes a dependent schema Part
    When the schema arrows are checked
    Then there are no findings

  @test:scripts/tests/arrow-direction.test.ts::the_dependent_holds_the_pointer_(#1168,_B5)::a_process_may_point_at_its_skills,_roles_and_decisions,_and_at_nothing_that_depends_on_it
  Scenario: A process may point at its skills, roles and decisions but not at its dependents
    Given a BPMN process with skill, role, decision, bean, implements and link extensions and a plain task
    When the process arrows are checked
    Then six extension elements are examined
    And the only findings are the "implements" workflow element and the "link" href element

  @test:scripts/tests/arrow-direction.test.ts::the_dependent_holds_the_pointer_(#1168,_B5)::the_extension_prefixes_are_read_from_the_file,_so_a_renamed_namespace_is_still_examined
  Scenario: Extension prefixes are read from the file's namespace declarations
    Given a process that declares its extension namespace under the prefix "folio" and holds a folio:link
    When the process arrows are checked
    Then one element is examined and one finding is reported
    And a file with only a bpmn:task examines nothing
