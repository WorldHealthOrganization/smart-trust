# schemas/block-kind-nodes.test.ts checks schemas/content/block-kinds.ts, which discovers block
# kinds from "folio-block-kind/v1" nodes and content-adapter vocabularies from
# "folio-content-adapter/v1" nodes. Each Scenario names the test that executes it.
Feature: Block kinds and content adapters are discovered from nodes

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::every_typed_kind_is_discovered,_and_every_discovered_kind_is_typed
  Scenario: The discovered block kinds are exactly the typed block kinds
    Given the block kinds discovered from the checkout
    When they are compared with every block kind a schema or vocabulary module types
    Then the two sorted lists are equal

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::the_math_kinds_are_the_paper_adapter's,_declared_by_folio-assistant-sci;_the_rest_by_folio-assistant-core
  Scenario: The math kinds are the seven formal-claim kinds and the rest are document kinds
    # Gap: which layer declares each set (folio-assistant-sci, folio-assistant-core) is not checked
    Given the discovered math and document block kinds
    Then the math kinds are "conjecture", "corollary", "definition", "lemma", "proof", "proposition" and "theorem"
    And the math kinds and the document kinds together number as many as all block kinds

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::each_per-kind_table_is_read_off_the_nodes
  Scenario: Each per-kind table is read off the block-kind nodes
    Given the discovered block-kind nodes
    When each node's kind is looked up in the per-kind tables
    Then its folio type, label prefix, English heading and builder all match the node
    And a node whose prefix is enforced has that prefix in the label-prefix table
    And the known label prefixes are in sync with the JSON-LD kind prefixes, equal in number

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::non-English_headings_come_from_the_owners'_translation_catalogues
  Scenario: Non-English kind headings come from the owners' translation catalogues
    Given the kind heading lookup
    Then "theorem" in "fr" is "Théorème" and "table" in "zh-Hans" is "表"
    And "figure" in "es" is "Figura"
    And "prose" in "ru" is the empty heading
    And "lemma" in an unknown locale "xx" falls back to "Lemma"
    And "decision-table", which has no node, is sentence-cased to "Decision table"
    And "non-functional-requirement" keeps its hyphen as "Non-functional requirement"

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::a_kind_declared_by_two_files_is_refused,_naming_both
  Scenario: A block kind declared by two files is refused, naming both
    Given a temporary checkout with instances "a" and "b", each declaring a block-kinds directory
    And each holding a "note.json" node for the kind "note"
    When block kinds are discovered there
    Then discovery throws "declared twice", naming a/block-kinds/note.json and b/block-kinds/note.json

  @test:schemas/block-kind-nodes.test.ts::block_kinds_are_discovered,_not_listed::a_checkout_that_declares_no_block-kinds_graph_has_no_kinds_—_the_harness_alone_loads
  Scenario: A checkout declaring no block-kinds graph has no block kinds
    Given an empty temporary checkout and the standalone fixture switched off
    When block kinds are discovered there
    Then the result is empty
    And this checkout's own block kinds are not empty

  @test:schemas/block-kind-nodes.test.ts::content-adapter_vocabularies_are_nodes_(bean_riit,_step_5)::the_typed_vocabularies_are_the_nodes_that_say_typed,_each_owning_a_kind,_and_every_built-in_kind_names_one
  Scenario: The typed vocabularies are the typed adapter nodes, each owning a kind
    Given the discovered content-adapter nodes
    Then the content adapters are exactly the adapters of the nodes marked typed
    And each content adapter owns at least one block kind
    And every block kind's adapter is one of the content adapters

  @test:schemas/block-kind-nodes.test.ts::content-adapter_vocabularies_are_nodes_(bean_riit,_step_5)::each_typed_vocabulary's_companion_roles_come_from_its_node
  Scenario: Each typed vocabulary's companion roles come from its node
    Given the typed content-adapter nodes
    Then each adapter's companion roles equal its node's companion roles
    And the adapter of every block kind with profile "paper" offers the "lean" role

  @test:schemas/block-kind-nodes.test.ts::content-adapter_vocabularies_are_nodes_(bean_riit,_step_5)::every_block-kind_node_names_a_vocabulary_that_has_a_node
  Scenario: Every block-kind node names a vocabulary that has a node
    Given the content-adapter nodes' adapter names
    When block kinds are discovered from the checkout
    Then every block kind's adapter is among those names

  @test:schemas/block-kind-nodes.test.ts::content-adapter_vocabularies_are_nodes_(bean_riit,_step_5)::a_node_is_never_mistaken_for_an_instance_declaration
  Scenario: A content-adapter node carries no "name" field
    Given the discovered content-adapter nodes
    Then none of them has a "name" field, so none reads as an instance declaration

  @test:schemas/block-kind-nodes.test.ts::content-adapter_vocabularies_are_nodes_(bean_riit,_step_5)::a_vocabulary_declared_twice_throws;_finding_no_typed_one_does_not
  Scenario: A vocabulary declared twice throws but finding no typed one does not
    Given a temporary checkout whose instance "a" declares an untyped adapter "x"
    When content adapters are discovered with the standalone fixture switched off
    Then the only adapter found is "x"
    And this checkout's own content adapters are not empty
    When an instance "b" also declares a typed adapter "x"
    Then discovery throws "declared twice"
