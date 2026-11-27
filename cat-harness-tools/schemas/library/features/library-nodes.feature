# Specifies the library's JSON-LD node families (schemas/library/library-nodes.ts): how a
# node is routed to the class it instantiates and parsed by its schema, and candidates.json
# (ingest-candidates.ts). Each Scenario names the test that executes it.
Feature: A library JSON-LD node is routed by the class it instantiates and parsed by its schema

  @test:schemas/library/library-nodes.test.ts::library_JSON-LD_node_families::each_class_resolves_to_a_runnable_schema
  Scenario: Each library node class resolves to a runnable schema
    Given the harness's "library" kind
    When its node schemas are resolved
    Then every library node family is "resolved"

  @test:schemas/library/library-nodes.test.ts::library_JSON-LD_node_families::a_node_is_routed_by_the_class_it_instantiates:_a_prose_block,_which_is_also_doco:Section,_is_a_block
  Scenario: A node is routed by the class it instantiates, and a prose block typed also doco:Section is a block
    Given a manifest, a section, a prose block typed "folio-assistant-core:Prose" and "doco:Section", and the same block with no "@type"
    When each node's family is found
    Then the manifest is a source document, the section a section, and both blocks are blocks
    And a plain object with only "kind" has no library class
    And a node with "$schema" "a/v1" is routed to "a/v1"

  @test:schemas/library/library-nodes.test.ts::library_JSON-LD_node_families::each_parses_what_the_generator_writes
  Scenario: Each schema parses the node the generator writes
    Given the manifest, the section and the typed block
    When each is parsed by its family's schema
    Then all three pass

  @test:schemas/library/library-nodes.test.ts::library_JSON-LD_node_families::a_block_with_no_@type,_or_a_key_nobody_declared,_is_invalid
  Scenario: A block with no @type, or an undeclared key, is invalid
    Given the block with no "@type"
    When it is parsed by the block schema
    Then it fails
    And a block with an extra key fails
    And a section typed also "x:Y" fails the section schema
    And a manifest typed "doco:Section" fails the source document schema

  @test:schemas/library/library-nodes.test.ts::a_Stage_B_requirement_block_(cat-harness-tools#1356)::a_kind_with_no_DoCO_co-type_has_one_@type,_and_its_meta_is_the_source's_facts
  Scenario: A requirement block with no DoCO co-type has one @type and string meta from its source
    Given an indicator block typed "layer:Indicator" with meta source_number "1-01" and source_kind "nhwa-indicator"
    When it is parsed by the block schema
    Then it passes
    And the same block typed only with the generic block class passes

  @test:schemas/library/library-nodes.test.ts::a_Stage_B_requirement_block_(cat-harness-tools#1356)::meta_holds_strings_only,_and_a_third_type_is_still_refused
  Scenario: Block meta holds only strings, and a third @type is refused
    Given the indicator block with meta "n" set to the number 1
    When it is parsed by the block schema
    Then it fails
    And a block typed "a:B", "doco:Section" and "c:D" fails

  @test:schemas/library/library-nodes.test.ts::candidates.json_(ingest-candidates/v1)::what_extract-candidates_writes,_and_a_hand-written_record_without_whole-document_fields,_both_parse
  Scenario: A candidates file with or without whole-document fields parses, and one missing doc_id is refused
    Given an indicator candidate "1-01" from "sections/sec-023-x.md"
    When a candidates file holding only doc_id "d" and that candidate is parsed
    Then it passes
    And a file also holding document_class, validated, aspects, disposition, a summary and per-candidate aspect fields passes
    And a file with no doc_id and a candidate from "x.md" fails

  @test:schemas/library/library-nodes.test.ts::candidates.json_(ingest-candidates/v1)::the_family_resolves_for_the_library_kind
  Scenario: The ingest-candidates family resolves for the library kind
    Given the harness's "library" kind
    When its node schemas are resolved
    Then "ingest-candidates/v1" is "resolved"
