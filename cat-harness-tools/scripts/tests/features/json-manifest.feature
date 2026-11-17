# A content manifest written as JSON data (pipeline/json-manifest.ts) is read the same way as
# the .ts it replaces, by every block reader. Each Scenario names the test that executes it.
Feature: JSON content manifests

  @test:scripts/tests/json-manifest.test.ts::json-manifest::a_manifest_is_recognised_by_its_$schema;_other_JSON_is_not
  Scenario: A manifest is recognised by its $schema and other JSON is not
    Given a content directory with a JSON manifest, a JSON file with another $schema, a malformed JSON file and a .md file
    When each is checked for being a JSON manifest
    Then only the file carrying the manifest $schema is recognised
    And the other $schema, the malformed JSON and the .md file are not

  @test:scripts/tests/json-manifest.test.ts::json-manifest::evaluating_calls_the_builder:_kind_added,_data_kept
  Scenario: Evaluating a manifest calls its builder, adding the kind and keeping the data
    Given a "prose" manifest with label "sec:labelled" and a "prose" manifest with no data
    When each is evaluated
    Then the first gives kind "prose" with label "sec:labelled"
    And the second gives kind "prose" alone

  @test:scripts/tests/json-manifest.test.ts::json-manifest::an_unknown_builder_is_an_authoring_error,_not_a_skip
  Scenario: An unknown builder is an authoring error rather than a skip
    Given a manifest naming the builder "eval"
    When it is read
    Then reading throws "unknown manifest builder"

  @test:scripts/tests/json-manifest.test.ts::json-manifest::the_builder's_schema_still_validates_the_data
  Scenario: The builder's schema still validates the manifest data
    Given a "prose" manifest whose label is the number 7
    When it is evaluated
    Then evaluation throws

  @test:scripts/tests/json-manifest.test.ts::json-manifest::manifestPath_prefers_a_JSON_manifest_and_falls_back_to_.ts
  Scenario: manifestPath prefers a JSON manifest and falls back to .ts
    Given a directory holding page.json and no data.ts
    When the manifest path for "page" and for "data" is asked
    Then "page" resolves to page.json
    And "data" falls back to data.ts
    And the manifest root of page.json is the page directory
    And loading page.json gives the slug "guides/x"

  @test:scripts/tests/json-manifest.test.ts::block_readers_accept_JSON_manifests::loadBlockModule_and_its_sync_sibling
  Scenario: loadBlockModule and its sync sibling read a JSON manifest
    Given the labelled JSON manifest
    When it is loaded asynchronously and synchronously
    Then the async load gives label "sec:labelled"
    And the sync load gives kind "prose"

  @test:scripts/tests/json-manifest.test.ts::block_readers_accept_JSON_manifests::loadBlocksUnder_finds_the_labelled_block_and_nothing_else
  Scenario: loadBlocksUnder finds the labelled block and reports the broken manifests
    Given a tree holding one labelled manifest, an unlabelled one, other JSON, and two broken manifests under bad/
    When the blocks under it are loaded
    Then the only block found is "sec:labelled"
    And the failures are exactly invalid.json and unknown.json

  @test:scripts/tests/json-manifest.test.ts::block_readers_accept_JSON_manifests::readBlockManifest_/_readUnlabelledBlockManifest
  Scenario: readBlockManifest and readUnlabelledBlockManifest read JSON manifests
    Given the labelled, unlabelled and non-manifest JSON files
    When they are read as block manifests
    Then the labelled one gives kind "prose" and label "sec:labelled"
    And the unlabelled one gives nothing from readBlockManifest
    And readUnlabelledBlockManifest gives it the label "unlabelled" from its file name
    And the non-manifest JSON gives nothing

  @test:scripts/tests/json-manifest.test.ts::block_readers_accept_JSON_manifests::walkBlocks_yields_the_JSON_block_with_its_companions
  Scenario: walkBlocks yields the JSON block with its companions
    Given the ch1 directory with labelled.json and labelled.md
    When its blocks are walked including unlabelled ones
    Then the labelled block's manifest is labelled.json, its root is the labelled directory and its markdown is labelled.md
    And the labels walked are "sec:labelled" and "unlabelled"
