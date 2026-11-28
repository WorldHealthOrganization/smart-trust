Feature: each content node is served at its IRI, <iriBase>v<major>/<@id>, and every copy the site publishes names it

  @test:scripts/lib/node-iri-files.test.ts::nodeIri::a_relative_@id_resolves_against_the_context's_@base
  Scenario: nodeIri: a relative @id resolves against the context's @base
    Given the case named by the test
    When nodeIri runs over it
    Then a relative @id resolves against the context's @base

  @test:scripts/lib/node-iri-files.test.ts::nodeIri::an_absolute_@id_is_itself,_without_its_fragment
  Scenario: nodeIri: an absolute @id is itself, without its fragment
    Given the case named by the test
    When nodeIri runs over it
    Then an absolute @id is itself, without its fragment

  @test:scripts/lib/node-iri-files.test.ts::nodeIri::no_@id,_a_blank_node_or_text_that_is_not_JSON_has_none
  Scenario: nodeIri: no @id, a blank node or text that is not JSON has none
    Given the case named by the test
    When nodeIri runs over it
    Then no @id, a blank node or text that is not JSON has none

  @test:scripts/lib/node-iri-files.test.ts::nodeSitePath::an_IRI_under_the_site_is_its_path_there
  Scenario: nodeSitePath: an IRI under the site is its path there
    Given the case named by the test
    When nodeSitePath runs over it
    Then an IRI under the site is its path there

  @test:scripts/lib/node-iri-files.test.ts::nodeSitePath::another_site's_IRI,_a_directory_or_the_site_itself_is_not_a_node_path_here
  Scenario: nodeSitePath: another site's IRI, a directory or the site itself is not a node path here
    Given the case named by the test
    When nodeSitePath runs over it
    Then another site's IRI, a directory or the site itself is not a node path here

  @test:scripts/lib/node-iri-files.test.ts::nodeIriFiles::each_node_at_its_IRI:_a_page_at_<path>/index.html_linking_where_it_is_read,_and_the_node_beside_it
  Scenario: nodeIriFiles: each node at its IRI: a page at <path>/index.html linking where it is read, and the node beside it
    Given the case named by the test
    When nodeIriFiles runs over it
    Then each node at its IRI: a page at <path>/index.html linking where it is read, and the node beside it

  @test:scripts/lib/node-iri-files.test.ts::nodeIriFiles::a_node_and_a_node_under_its_IRI_are_served_side_by_side
  Scenario: nodeIriFiles: a node and a node under its IRI are served side by side
    Given the case named by the test
    When nodeIriFiles runs over it
    Then a node and a node under its IRI are served side by side

  @test:scripts/lib/node-iri-files.test.ts::nodeIriFiles::a_node_of_another_site_is_left_out
  Scenario: nodeIriFiles: a node of another site is left out
    Given the case named by the test
    When nodeIriFiles runs over it
    Then a node of another site is left out

  @test:scripts/lib/node-iri-files.test.ts::nodeIriFiles::two_different_nodes_at_one_IRI_are_a_collision;_the_same_node_twice_is_not
  Scenario: nodeIriFiles: two different nodes at one IRI are a collision; the same node twice is not
    Given the case named by the test
    When nodeIriFiles runs over it
    Then two different nodes at one IRI are a collision; the same node twice is not

  @test:scripts/lib/node-iri-files.test.ts::nodePage::escapes_the_IRI_and_keeps_</_out_of_the_embedded_script
  Scenario: nodePage: escapes the IRI and keeps </ out of the embedded script
    Given the case named by the test
    When nodePage runs over it
    Then escapes the IRI and keeps </ out of the embedded script

  @test:scripts/lib/node-iri-files.test.ts::nodePage::is_a_page_about_the_node:_its_label,_its_types_and_its_properties
  Scenario: nodePage: is a page about the node: its label, its types and its properties
    Given the case named by the test
    When nodePage runs over it
    Then is a page about the node: its label, its types and its properties

  @test:scripts/lib/node-iri-files.test.ts::nodeServedFiles::a_node_path_is_served_from_its_directory's_index.html,_with_the_node_as_index.jsonld
  Scenario: nodeServedFiles: a node path is served from its directory's index.html, with the node as index.jsonld
    Given the case named by the test
    When nodeServedFiles runs over it
    Then a node path is served from its directory's index.html, with the node as index.jsonld

  @test:scripts/lib/node-iri-files.test.ts::graphDocument::each_member's_@id_is_the_IRI_nodeIri_mints_for_it,_its_fragment_kept
  Scenario: graphDocument: each member's @id is the IRI nodeIri mints for it, its fragment kept
    Given the case named by the test
    When graphDocument runs over it
    Then each member's @id is the IRI nodeIri mints for it, its fragment kept

  @test:scripts/lib/node-iri-files.test.ts::graphDocument::a_member's_IRI_is_the_same_whether_its_@base_is_read_from_its_own_context_or_not
  Scenario: graphDocument: a member's IRI is the same whether its @base is read from its own context or not
    Given the case named by the test
    When graphDocument runs over it
    Then a member's IRI is the same whether its @base is read from its own context or not

  @test:scripts/lib/node-iri-files.test.ts::graphDocument::a_blank_node_keeps_its_@id
  Scenario: graphDocument: a blank node keeps its @id
    Given the case named by the test
    When graphDocument runs over it
    Then a blank node keeps its @id

  @test:scripts/lib/node-iri-files.test.ts::atCurrentBase::a_node_off_the_old_shared_base,_or_not_JSON,_is_returned_unchanged
  Scenario: atCurrentBase: a node off the old shared base, or not JSON, is returned unchanged
    Given the case named by the test
    When atCurrentBase runs over it
    Then a node off the old shared base, or not JSON, is returned unchanged

  @test:scripts/lib/node-iri-files.test.ts::atCurrentBase::a_node_on_the_old_shared_base,_in_no_layer,_keeps_it
  Scenario: atCurrentBase: a node on the old shared base, in no layer, keeps it
    Given the case named by the test
    When atCurrentBase runs over it
    Then a node on the old shared base, in no layer, keeps it

  @test:scripts/lib/node-iri-files.test.ts::writeNodeIris::writes_each_node_under_the_site_the_folio's_iriBase_names
  Scenario: writeNodeIris: writes each node under the site the folio's iriBase names
    Given the case named by the test
    When writeNodeIris runs over it
    Then writes each node under the site the folio's iriBase names

  @test:scripts/lib/node-iri-files.test.ts::writeNodeIris::a_folio_declaring_no_iriBase_serves_no_node_IRI,_and_writes_nothing
  Scenario: writeNodeIris: a folio declaring no iriBase serves no node IRI, and writes nothing
    Given the case named by the test
    When writeNodeIris runs over it
    Then a folio declaring no iriBase serves no node IRI, and writes nothing
