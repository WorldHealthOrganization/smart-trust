# scripts/lib/host-schema.ts and scripts/harness-schema-export.ts: the host's schema documents
# are published under its own directory, <site>/<name>/, with a one-release tombstone at each
# old site-root address. Each Scenario names the test that executes it.
Feature: The host's schema documents sit under its own directory

  @test:scripts/tests/host-schema.test.ts::the_host's_schema_base::is_its_own_directory_under_the_site,_by_its_declared_name
  Scenario: The schema base is the host's own directory, named by its declaration
    Given the harness declaration's name
    When the host name, schema base and schema paths are computed for base "https://example.invalid/fa"
    Then the host name is the declared name
    And the schema base is the base URL followed by the host name
    And "tool.schema.json" is published at "<name>/tool.schema.json"
    And the legacy path of "<name>/tool-types/Url.schema.json" is "tool-types/Url.schema.json"
    And a path not under the host directory has no legacy path

  @test:scripts/tests/host-schema.test.ts::the_host's_schema_base::is_empty_with_no_base:_an_$id_is_absolute_or_absent
  Scenario: An empty base gives an empty schema base
    When the schema base is computed for an empty base URL
    Then it is the empty string

  @test:scripts/tests/host-schema.test.ts::the_host's_schema_base::every_document_the_export_writes_sits_under_it,_at_the_address_its_$id_names
  Scenario: Every exported document sits under the host directory at the address its $id names
    Given every schema file, tool type file and skill IO contract the export writes for the base URL
    Then there are more than 3 documents
    And every path starts with the host directory
    And every document's $id is the base URL followed by its path

  @test:scripts/tests/host-schema.test.ts::the_tombstones_at_the_old_site-root_addresses::one_per_moved_document,_at_its_old_path,_naming_its_old_$id
  Scenario: Each moved document has one tombstone at its old path forwarding to the new $id
    Given the exported documents and their tombstones
    Then there is exactly one tombstone per document
    And each tombstone sits at the document's legacy path with $id at the old address
    And it is marked deprecated with isReplacedBy naming the new $id
    And it validates by an allOf holding a single $ref to the new $id

  @test:scripts/tests/host-schema.test.ts::the_tombstones_at_the_old_site-root_addresses::the_type_vocabulary_forwards_every_`#/$defs/<Name>`_a_port_named_before_the_move
  Scenario: The type vocabulary tombstone forwards every $defs name to its moved tool type
    Given the tombstone at "tool-types.schema.json"
    Then its $defs names are exactly the tool type names the export writes
    And each $defs entry is a $ref to that tool type's new $id

  @test:scripts/tests/host-schema.test.ts::the_tombstones_at_the_old_site-root_addresses::a_preview's_tombstones_forward_to_the_preview's_documents
  Scenario: A preview's tombstones forward to the preview's documents
    Given the documents exported for the staging base "<base>/STAGING/slug"
    When their tombstones are built
    Then each tombstone's $id is under the staging base at its old path
    And each isReplacedBy is under the staging base's host directory

  @test:scripts/tests/host-schema.test.ts::the_tombstones_at_the_old_site-root_addresses::a_document_with_no_$id_gets_none:_there_is_no_address_to_forward_from
  Scenario: A document with no $id gets no tombstone
    Given a single document under the host directory with no $id
    When tombstones are built
    Then there are none

  @test:scripts/tests/host-schema.test.ts::the_tombstones_at_the_old_site-root_addresses::the_stamp_is_carried
  Scenario: A tombstone carries the staging stamp
    When a moved-schema tombstone is built with the stamp staging run 1
    Then the tombstone's staging field is run 1

  @test:scripts/tests/host-schema.test.ts::one_release_of_tolerance_for_the_old_addresses::a_contract_still_carrying_its_old_root_$id_is_accepted_by_the_check,_and_rewritten_by_--write-ids
  Scenario: Stored skill IO $ids differ from the expected ones only by the move, and are accepted
    # Gap: running --write-ids to rewrite the ids is not exercised
    Given the skill IO contracts checked without accepting legacy ids
    Then every stale id differs from the expected one only by the host directory segment before "/skills/"
    And with legacy ids accepted there are no stale ids
    And every built contract's $id is the skill IO IRI under the host schema base

  @test:scripts/tests/host-schema.test.ts::one_release_of_tolerance_for_the_old_addresses::a_Tool_declaring_a_host_schema_at_its_old_root_path_still_matches_the_moved_file
  Scenario: Declared Tool host schemas show no drift against the moved files
    # Gap: does not show that any Tool actually declares an old root path
    Given the schema files the export writes
    When the artefact declaration drift is computed
    Then nothing is undeclared
    And nothing is unproduced
