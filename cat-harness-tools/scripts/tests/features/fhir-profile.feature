# FHIR profiles in the one class model (bean cat-tools-t6fz): scripts/fhir-logical-model.ts reads a
# constraint StructureDefinition as a class over its base; scripts/class-diagram.ts draws it.
# Each Scenario names the test that executes it.
Feature: FHIR profiles drawn as classes over their base

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::reads_a_constraint_StructureDefinition_as_one_class_generalising_its_base
  Scenario: A profile is one class generalising its base
    Given a constraint StructureDefinition over FHIR core's ActorDefinition
    When it is read
    Then it is one "fhir-profile" declaration extending "ActorDefinition", which is external, labelled "fhir:profile"

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::holds_only_what_the_differential_constrains,_cardinality_filled_from_the_snapshot
  Scenario: A profile holds only what it constrains
    Given a profile whose differential narrows name, marks status mustSupport, slices an extension, and whose snapshot carries the types
    When it is read
    Then its fields are "name", "status {MS}" and "extension:link", with cardinality and type from the snapshot where the differential is silent
    And the bare slicing declaration is not a field

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::says_what_a_profile_pins:_fixed_values,_prohibited_elements,_mustSupport
  Scenario: Fixed values, prohibited elements and mustSupport are stated
    Given an extension profile with max 0 on extension, a fixed url and a mustSupport value
    Then the constraints read "prohibited", "= <url>" and "MS"

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::joins_profiles_by_canonical:_an_extension_slice_is_a_field_edge,_a_Reference_target_an_id_edge
  Scenario: Profiles join by canonical URL
    Given a resource profile slicing in an extension profile whose value references the resource profile
    When both are read together
    Then the slice is a field edge to the extension and the Reference target an id edge back, and nothing is unresolved

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::draws_the_profile_labelled_«fhir:profile»,_with_its_constraints_after_the_cardinality
  Scenario: The profile is drawn with its constraints
    When an extension profile is drawn
    Then the box is labelled "«fhir:profile»" and "{prohibited}" follows the cardinality
    And a FHIR primitive in a profile links to the HL7 datatypes page

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::draws_parallel_edges_as_one_line_naming_every_field
  Scenario: Parallel edges are one line naming every field
    Given a profile with two extension slices of the same extension profile
    When it is drawn
    Then one edge carries the label "extension:back, extension:link [0..*]"

  @test:scripts/tests/fhir-profile.test.ts::FHIR_profiles::states_a_profile_with_no_differential_as_undetermined
  Scenario: A profile with no differential is undetermined
    Given a constraint StructureDefinition with no differential
    Then it is one undetermined declaration that says why
