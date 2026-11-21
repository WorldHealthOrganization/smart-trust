# The standalone fixture test/fixtures/standalone-checkout/ copies core's and sci's real nodes
# so the schema tests pass with this layer alone, and must stay byte-equal to its sources.
# Each Scenario names the test that executes it.
Feature: The standalone fixture stays a copy of the real nodes

  @test:schemas/standalone-fixture.test.ts::the_standalone_fixture_copies_the_real_nodes::it_carries_the_paper_vocabulary_and_core's_kinds
  Scenario: The fixture carries the paper vocabulary and core's kinds
    Given the files copied into the standalone fixture, apart from each layer's own declaration
    Then they include "folio-assistant-sci/content-adapters/mathpaper.json"
    And exactly 17 block-kinds JSON files
    And "folio-assistant-core/typologies/review-verdicts.json" and "fhir-harness/typologies/ig-metadata-index.json"

  @test:schemas/standalone-fixture.test.ts::the_standalone_fixture_copies_the_real_nodes::every_copy_is_byte-equal_to_the_file_it_copies
  Scenario: Every fixture copy is byte-equal to the file it copies
    # Skipped: when any copied layer is absent from the checkout
    Given the standalone fixture and the checkout's real layers
    When each copy is compared with the file at the same path in the checkout
    Then no copy is missing its source or differs from it

  @test:schemas/standalone-fixture.test.ts::the_standalone_fixture_copies_the_real_nodes::every_block-kinds,_content-adapters_and_kinds_node_the_copied_instances_declare_is_copied
  Scenario: Every block-kinds, content-adapters and typologies node the copied layers declare is copied
    # Skipped: when any copied layer is absent from the checkout
    Given each layer the fixture copies from
    When the JSON files in its real block-kinds, content-adapters and typologies directories are listed
    Then each has a copy in the fixture

  @test:schemas/standalone-fixture.test.ts::the_standalone_fixture_copies_the_real_nodes::the_monorepo_never_scans_the_fixture
  Scenario: The monorepo never scans the fixture
    # Gap: when the sources are absent the test asserts nothing
    Given the copied layers are present in the checkout
    Then FOLIO_FIXTURE_CHECKOUT is unset
