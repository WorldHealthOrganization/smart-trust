# pipeline/gen-library-jsonld.ts types a library block by the dependency closure of the layer that OWNS the
# entry, so the committed .jsonld is the same in the layer's own checkout and in any index that mounts it.
# Each Scenario names the test that executes it.
Feature: A library block's type does not depend on what else is mounted

  @test:scripts/tests/library-jsonld-owner-closure.test.ts::a_library_block_is_typed_by_its_owning_layer's_dependency_closure::the_owning_layer_is_the_nearest_declaration_above_the_entry
  Scenario: The owning layer is the nearest declaration above the entry
    Given a layer "below" that declares a library holding an entry
    When the entry's owning layer is resolved
    Then it is "below"

  @test:scripts/tests/library-jsonld-owner-closure.test.ts::a_library_block_is_typed_by_its_owning_layer's_dependency_closure::a_layer_that_does_not_depend_on_the_contributor_types_the_kind_as_a_plain_block
  Scenario: A layer below the contributor types the kind as a plain block
    Given a layer "dak" that contributes the block kind "indicator"
    And a layer "below" that does not depend on "dak"
    When an "indicator" block of "below" is typed
    Then its type is "cat-harness:Block", whatever else the checkout mounts

  @test:scripts/tests/library-jsonld-owner-closure.test.ts::a_library_block_is_typed_by_its_owning_layer's_dependency_closure::a_layer_that_depends_on_the_contributor_gets_the_contributed_type
  Scenario: A layer that depends on the contributor gets the contributed type
    Given a layer "above" that depends on "dak"
    When an "indicator" block of "above" is typed
    Then its type includes "dak:Indicator"
