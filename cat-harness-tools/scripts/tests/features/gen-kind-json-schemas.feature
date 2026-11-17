# scripts/gen-kind-json-schemas.ts (kind:json-schemas) renders one JSON Schema per harness
# kind, its $id its path, independent of the layers mounted above the harness.
# Each Scenario names the test that executes it.
Feature: Generated JSON Schemas for harness kinds

  @test:scripts/tests/gen-kind-json-schemas.test.ts::pointerToken::escapes_what_a_JSON_Pointer_and_a_URI_fragment_cannot_carry
  Scenario: A pointer token escapes what a JSON Pointer and a URI fragment cannot carry
    Given the names "folio-voice/v1", "a~b" and "x#y z%"
    When each is made a pointer token
    Then they become "folio-voice~1v1", "a~0b" and "x%23y%20z%25"

  @test:scripts/tests/gen-kind-json-schemas.test.ts::renderKind::the_harness_has_kinds_to_render
  Scenario: The harness has kinds to render
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the harness's kinds
    Then there is at least one

  @test:scripts/tests/gen-kind-json-schemas.test.ts::renderKind::a_kind_with_a_validator_gets_a_file_whose_$id_ends_in_its_path
  Scenario: A kind with a validator gets a file whose $id ends in its path
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the "tools" kind
    When its schema is rendered into the declared schemas directory
    Then a file is written at the kinds subdirectory as "tools.schema.json"
    And its $id ends in that path
    And the rendered document's $id equals the reported id

  @test:scripts/tests/gen-kind-json-schemas.test.ts::renderKind::a_kind_with_families_is_anyOf_over_them,_each_$ref_resolving_to_a_$defs_entry
  Scenario: A kind with families is anyOf over them, each local $ref resolving to a $defs entry
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the "skills" kind
    When its schema is rendered
    Then the anyOf list is not empty
    And every anyOf $ref into "#/$defs/" names an escaped $defs key

  @test:scripts/tests/gen-kind-json-schemas.test.ts::renderKind::a_kind_where_no_validator_applies_gets_no_file,_and_says_why
  Scenario: A kind where no validator applies gets no file
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    # Gap: the text of the reason is not checked, only that no file is rendered.
    Given a harness kind whose typology declares validatorNotApplicable
    When its schema is rendered
    Then the result is a "none" result rather than a file

  @test:scripts/tests/gen-kind-json-schemas.test.ts::the_output_does_not_depend_on_the_layers_mounted_above_the_harness::the_instances_read_are_the_harness_and_what_it_needs,_never_a_layer_above
  Scenario: The instances read are the harness and its needs, never a layer above
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given a synthetic "higher-layer" mounted above the harness with a validator for "uploads"
    When the harness instances are listed
    Then the first is the harness itself
    And every layer the harness needs is listed
    And neither "cat-harness-tools" nor "higher-layer" is listed

  @test:scripts/tests/gen-kind-json-schemas.test.ts::the_output_does_not_depend_on_the_layers_mounted_above_the_harness::the_fixture_bites:_a_registry_that_reads_every_instance_takes_its_validator
  Scenario: A registry reading every instance would take the higher layer's validator
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the synthetic higher layer and a registry that includes it alongside the harness instances
    When the validator node for "uploads" family "folio-extraction/v1" is looked up
    Then it is the higher layer's validators/extraction.json

  @test:scripts/tests/gen-kind-json-schemas.test.ts::the_output_does_not_depend_on_the_layers_mounted_above_the_harness::with_it_mounted,_every_harness_kind_renders_byte-for-byte_as_without_it
  Scenario: Every harness kind renders the same with or without the higher layer mounted
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the harness registry built with and without the higher layer's scope
    Then the registry beside it has no validator for "uploads" family "folio-extraction/v1"
    And both list the same kinds, including "uploads"
    And every kind renders identically in both

  @test:scripts/tests/gen-kind-json-schemas.test.ts::the_output_does_not_depend_on_the_layers_mounted_above_the_harness::a_discovered_enum_is_the_open_type,_whatever_its_members
  Scenario: A discovered enum renders as an open string type whatever its members
    Given an appliesTo field that unions a discovered block-kinds enum with a fixed enum of "docs"
    When its JSON Schema body is rendered with no members, with "theorem" and "proof", and with "table"
    Then all three renderings are identical
    And the rendering has no "not" and has a string type
    And the fixed enum member "docs" is kept

  @test:scripts/tests/gen-kind-json-schemas.test.ts::the_output_does_not_depend_on_the_layers_mounted_above_the_harness::a_voice's_`appliesTo`_accepts_a_block_kind_the_harness_does_not_declare
  Scenario: A voice's appliesTo accepts a block kind the harness does not declare
    # Skipped: when the harness's needs are not mounted beside it, standing alone
    Given the kinds "voices", "voice-vendors" and "skills"
    When each schema is rendered
    Then each contains "appliesTo"
    And none contains an empty "not" schema

  @test:scripts/tests/gen-kind-json-schemas.test.ts::judgeRendered:_the_generator's_own_output,_with_no_committed_copy::a_document_that_parses,_names_its_path,_resolves_its_refs_and_renders_the_same_twice_passes
  Scenario: A rendered document that is well formed and deterministic passes
    Given a rendered document whose $id is its path and whose $ref resolves through an escaped $defs key
    When it is judged against an identical second rendering
    Then there are no failures

  @test:scripts/tests/gen-kind-json-schemas.test.ts::judgeRendered:_the_generator's_own_output,_with_no_committed_copy::each_failure_is_named
  Scenario: Each failure of a rendered document is named
    Given rendered documents with faults
    Then a wrong $id is reported as "is not its path"
    And a $ref to a missing $defs entry is reported as "resolves to nothing"
    And a second rendering that differs is reported as "not deterministic"
    And unparsable text is reported as "does not parse"
