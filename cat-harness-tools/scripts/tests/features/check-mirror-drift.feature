# scripts/check-mirror-drift.ts parses Lean structure and class declarations (namespace, fields,
# extends, regime) so mirrored declarations can be compared for drift; the parser is tested here.
# Each Scenario names the test that executes it.
Feature: Lean declaration parsing for mirror drift

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::reads_fields_and_the_enclosing_namespace
  Scenario: Fields and the enclosing namespace are read
    Given a structure "MassIdentity" with three fields inside "namespace QOU.Torsion"
    When the declarations are parsed
    Then its fully qualified name is "QOU.Torsion.MassIdentity" and its kind is "structure"
    And its fields are "connectionGradient", "vortexCycle" and "cycle_nonempty" in order

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::instance-implicit_fields_count,_and_their_brackets_are_stripped
  Scenario: Instance-implicit fields count, without their brackets
    Given a structure with fields "M", "[topM : TopologicalSpace M]" and "n"
    When the declarations are parsed
    Then its fields are "M", "topM" and "n"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::a_named_section_does_not_corrupt_the_namespace_of_later_declarations
  Scenario: A named section does not corrupt later namespaces
    Given namespace QOU holding "section Helpers" with structure Inside, then structure After after "end Helpers"
    When the declarations are parsed
    Then their names are "QOU.Inside" and "QOU.After"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::an_anonymous_section_is_popped_too
  Scenario: An anonymous section is popped by a bare end
    Given namespace QOU holding an anonymous section with structure A, closed by "end", then structure B
    When the declarations are parsed
    Then their names are "QOU.A" and "QOU.B"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::docstring_and_comment_lines_are_not_read_as_fields
  Scenario: Docstring and comment lines are not fields
    Given a structure whose body has a docstring line and a "--" comment that both look like "name : type"
    When the declarations are parsed
    Then its fields are only "projection" and "volumeIso"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::extends_is_captured,_on_the_head_line_and_wrapped_onto_the_next
  Scenario: Extends is captured on the head line and when wrapped to the next line
    Given "structure A extends B, C where" and a structure D whose "extends E where" sits on the next line
    When the declarations are parsed
    Then A extends "B" and "C" with field "x"
    And D extends "E" with field "y"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::a_dedented_declaration_closes_the_previous_body
  Scenario: A dedented declaration closes the previous body
    Given structure A, then a top-level def, then structure B
    When the declarations are parsed
    Then A has only field "a" and B has only field "b"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::classes_are_parsed_like_structures,_and_nested_namespaces_concatenate
  Scenario: Classes parse like structures and nested namespaces concatenate
    Given a class MotivicGaloisCharacter inside namespace QOU and namespace LiftingDescent
    When the declarations are parsed
    Then its name is "QOU.LiftingDescent.MotivicGaloisCharacter" and its kind is "class"
    And its fields are "frobenius_at"

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::field_order_is_significant_—_a_reordering_is_drift,_not_a_match
  Scenario: Field order is significant
    Given two structures S with fields x, y and y, x
    When both are parsed
    Then their field lists are not equal

  @test:scripts/tests/check-mirror-drift.test.ts::parseLeanDecls::records_the_head_line_so_a_finding_can_be_clicked_to_source
  Scenario: The head line of a declaration is recorded
    Given a structure declared on the fourth line of the file
    When the declarations are parsed
    Then its line is 4

  @test:scripts/tests/check-mirror-drift.test.ts::extends_comparison::explicit_universe_levels_on_a_parent_are_not_a_difference
  Scenario: Explicit universe levels on a parent are not a difference
    Given one structure extending "B.{u, v} R" and another extending "B R"
    When their parent names are compared
    Then they are equal

  @test:scripts/tests/check-mirror-drift.test.ts::extends_comparison::a_different_parent,_or_a_different_arity,_still_shows
  Scenario: A different parent or a different number of parents still differs
    Given structures extending "B", "C", and "B, C"
    When their parent names are compared
    Then the one extending "B" differs from the one extending "C"
    And it differs from the one extending "B, C"

  @test:scripts/tests/check-mirror-drift.test.ts::§7c_regime_detection::a_real-typed_field_marks_the_declaration_archimedean
  Scenario: A real-typed field marks the declaration archimedean
    Given a structure with a field of type "M → ℝ"
    When the declarations are parsed
    Then it is archimedean

  @test:scripts/tests/check-mirror-drift.test.ts::§7c_regime_detection::the_same_field_over_a_generic_ring_does_not
  Scenario: The same field over a generic ring is not archimedean
    Given a structure with a field of type "M → R_q"
    When the declarations are parsed
    Then it is not archimedean

  @test:scripts/tests/check-mirror-drift.test.ts::§7c_regime_detection::the_field_NAME_is_not_evidence_—_only_the_type_after_the_colon
  Scenario: A field named for a real is not evidence
    Given a structure with fields "real_part : R" and "q_real : R"
    When the declarations are parsed
    Then it is not archimedean

  @test:scripts/tests/check-mirror-drift.test.ts::§7c_regime_detection::`Real`_and_`LinearOrderedField`_count,_matching_the_corpus_regex
  Scenario: Real and LinearOrderedField types count as archimedean
    Given one structure with a field of type "Real" and one of type "LinearOrderedField k"
    When the declarations are parsed
    Then both are archimedean

  @test:scripts/tests/check-mirror-drift.test.ts::§7c_regime_detection::an_archimedean_binder_on_the_head_line_marks_it_too
  Scenario: A real-typed binder on the head line marks it archimedean
    Given "structure S (f : M → ℝ) where" with only a natural-number field
    When the declarations are parsed
    Then it is archimedean
