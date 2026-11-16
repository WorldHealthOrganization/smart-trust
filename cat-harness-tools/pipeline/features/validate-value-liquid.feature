# pipeline/validate-value.ts validates a Liquid value reference ({{ ... }}) by the same rules
# as a :val one, against a value scope built from a fixture repo with a witness and a dataset.
# Each Scenario names the test that executes it.
Feature: Liquid value references are validated like :val ones

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::occurrences_are_found_with_their_filters
  Scenario: Liquid occurrences are found with their filters
    Given the text "x {{ demo.computations.masses.data.m | precision: 3 }} y"
    When its Liquid occurrences are extracted
    Then there is one, with key "demo.computations.masses.data.m" and filters "| precision: 3 "

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::an_unresolved_reference_is_an_ERROR,_with_the_resolver's_reason
  Scenario: An unresolved Liquid reference is an error carrying the resolver's reason
    Given a block referencing "demo.computations.masses.data.nope"
    When its value directives are validated
    Then there is exactly one issue, at level "error"
    And its message contains "[val-resolves]" and 'no scalar at "data.nope"'

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::precision_beyond_the_source's_digits_is_an_error,_as_for_:val
  Scenario: Precision beyond the source's digits is an error, as for :val
    Given a block whose computation witness is demo/computations/masses.witness.json
    When it references the 11-digit value "m" with precision 12
    Then the only rule broken is "val-precision-bounded"
    And with precision 11 no rule is broken

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::an_unknown_filter_is_an_error
  Scenario: An unknown Liquid filter is an error
    Given a block whose computation witness is demo/computations/masses.witness.json
    When it references "m" through the filter "rounded"
    Then the only rule broken is "val-filter"

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::a_witness_it_reads_counts_toward_the_computation_auto-link
  Scenario: A witness read through Liquid asks for the block's computation link
    Given a block with no computation field
    When it references the witnessed value "m" with precision 6
    Then the only issue is "[val-block-computation]", naming the implicit witness dependency on demo/computations/masses.witness.json

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::a_dataset_value_is_not_a_computation,_so_it_asks_for_no_link
  Scenario: A dataset value is not a computation, so it asks for no link
    Given a block with no computation field
    When it references the library dataset value "demo.library.codata.c"
    Then there are no issues

  @test:pipeline/validate-value-liquid.test.ts::Liquid_references_are_validated_like_:val_ones::site.*_and_page.*_are_Jekyll's,_and_are_left_alone
  Scenario: site.* and page.* references are Jekyll's and are left alone
    Given a block referencing "site.data.fhir.ig.version" and "page.title"
    When its value directives are validated
    Then there are no issues
