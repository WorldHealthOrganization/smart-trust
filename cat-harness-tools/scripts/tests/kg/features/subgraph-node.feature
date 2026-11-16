# scripts/subgraph-node.ts is the gate for the subgraph-node pattern: a generator publishing a
# declared subgraph uses the declared Subgraph node as its container, and each member says it is
# part of it. Each Scenario names the test that executes it.
Feature: Publishers of a declared subgraph use the declared Subgraph node

  @test:scripts/tests/kg/subgraph-node.test.ts::the_IRI_is_the_one_kg-export_mints_the_node_under::%p
  Scenario: The subgraph IRI is the one kg-export mints for the directory
    When the subgraph IRI is made for each id of "todos", "beans", "a b", "x#y" and "p/q" under "https://e.org/i.jsonld"
    Then it equals the IRI kg-export mints for that "directory" node

  @test:scripts/tests/kg/subgraph-node.test.ts::the_check_catches_each_way_of_getting_it_wrong::the_good_shape_is_clean
  Scenario: The good subgraph shape has no findings
    Given a document whose container is the declared Subgraph with members "m1" and "m2", each inSubgraph of it, and a context defining Subgraph, hasPart, inSubgraph and contentSource
    When it is checked
    Then there are no findings

  @test:scripts/tests/kg/subgraph-node.test.ts::the_check_catches_each_way_of_getting_it_wrong::a_parallel_collection_container
  Scenario: A parallel collection container is caught
    Given the good document re-identified as "https://e.org/todos.jsonld" typed "TodoGraph"
    When it is checked
    Then a finding says it is "not the declared Subgraph"
    And a finding names a "parallel collection"

  @test:scripts/tests/kg/subgraph-node.test.ts::the_check_catches_each_way_of_getting_it_wrong::a_member_without_inSubgraph
  Scenario: A member without inSubgraph is caught
    Given the good document with "m2"'s inSubgraph removed
    When it is checked
    Then the only finding is "member m2 has no inSubgraph → <the subgraph IRI>"

  @test:scripts/tests/kg/subgraph-node.test.ts::the_check_catches_each_way_of_getting_it_wrong::hasPart_that_misses_a_member
  Scenario: A hasPart that misses a member is caught
    Given the good document with hasPart listing only "m1"
    When it is checked
    Then a finding mentions hasPart

  @test:scripts/tests/kg/subgraph-node.test.ts::the_check_catches_each_way_of_getting_it_wrong::a_context_that_does_not_define_the_terms
  Scenario: A context that does not define the terms is caught
    Given the good document with an empty @context
    When it is checked
    Then there are 4 findings

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::container_publisher:_fsh-guts_satisfies_subgraphPublicationFindings
  Scenario: The fsh-guts export follows the container pattern
    Given the declared "fsh-guts" Subgraph node of this layer
    When the fsh-guts export is built
    Then checking it against that Subgraph IRI gives no findings

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::container_publisher:_todos_satisfies_subgraphPublicationFindings
  Scenario: The todos graph follows the container pattern
    Given the declared "todos" Subgraph node of this layer
    When a todo graph document is built from one sample open todo
    Then checking it against that Subgraph IRI gives no findings

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::scheme_publisher:_swimlane-glossary_links_to_declared_Subgraph_via_dcterms:isPartOf
  Scenario: The swimlane glossary links to its declared Subgraph via isPartOf
    Given the declared "swimlane-glossary" Subgraph node of this layer
    When the glossary is built
    Then it is a skos:ConceptScheme
    And its isPartOf is the Subgraph IRI

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::members_publisher:_library_manifest_carries_inSubgraph_pointing_to_declared_Subgraph
  Scenario: A library manifest carries inSubgraph to the declared Subgraph
    Given the declared "library" Subgraph node of this layer
    When the document nodes of "doc-sample" are built
    Then a "manifest.jsonld" is among them
    And its inSubgraph is the Subgraph IRI

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::members_publisher:_a_library_entry's_subgraph_is_looked_up_from_the_instance_that_holds_it
  Scenario: A library entry's subgraph is looked up from the layer holding it
    Then the library subgraph start for "library/doc-sample" is this layer's root
    And the manifest of "doc-sample" built with this layer as the root has inSubgraph equal to the layer's "library" Subgraph IRI

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::members_publisher:_a_corpus_declared_one_folder_deeper_is_looked_up_from_its_own_layer
  Scenario: A corpus declared one folder deeper is looked up from its own layer
    Given a temporary layer declaring its "library" directory at "library/corpus/"
    When the library subgraph start for "library/corpus/doc-x" is found
    Then it is that layer's root

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::members_publisher:_docs_site_pages_carry_inSubgraph_pointing_to_declared_Subgraph
  Scenario: A docs site page carries inSubgraph to the declared Subgraph
    Given the declared "docs" Subgraph node of this layer
    And the committed page "guides-beans-and-todos.jsonld" in the docs source
    Then the page's inSubgraph is the Subgraph IRI or its legacy fragment IRI

  @test:scripts/tests/kg/subgraph-node.test.ts::converted_publishers_follow_the_declared_subgraph_pattern::authoring_registries:_roles.json_is_an_authoring_registry_projected_into_KG_export,_not_a_standalone_published_subgraph_document
  Scenario: roles.json is an authoring registry that holds roles
    # Gap: that roles.json is projected into the KG export rather than published standalone is not checked
    Given this layer's "scenarios" directory
    Then "roles.json" exists in it
    And the role graph read from it has more than 0 roles
