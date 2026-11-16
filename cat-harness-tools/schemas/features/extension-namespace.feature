# Our BPMN extension elements are recognised by namespace, never by the prefix a diagram
# binds: the process-model loader and the raw-XML helpers in schemas/kg/namespaces.ts.
# Each Scenario names the test that executes it.
Feature: BPMN extension elements follow the namespace, not the prefix

  @test:schemas/extension-namespace.test.ts::the_parser_follows_the_namespace,_not_the_prefix::bootstrap's_diagram,_written_bootstrap.processes:,_binds_bootstrap's_own_address_(stage_2)
  Scenario: Bootstrap's main diagram binds bootstrap's own processes address
    Given bootstrap's processes/initialize-harness.bpmn
    Then the only prefix bound to our namespaces is "bootstrap.processes"
    And it binds "bootstrap.processes" to the bootstrap processes namespace
    And no element is written with a "folio:" prefix

  @test:schemas/extension-namespace.test.ts::the_parser_follows_the_namespace,_not_the_prefix::the_same_address_under_any_other_prefix_loads_into_the_same_model
  Scenario: The same address under another prefix loads into the same model
    Given a copy of bootstrap's diagram unchanged and a copy with the "bootstrap.processes" prefix renamed to "x"
    When both are loaded as process models
    Then the renamed copy no longer contains "bootstrap.processes:skill"
    And the unchanged model names the skill "confirm-harness"
    And the two models are equal

  @test:schemas/extension-namespace.test.ts::the_parser_follows_the_namespace,_not_the_prefix::the_retired_single_address_is_no_longer_ours_(stage_4)
  Scenario: A diagram on the retired single folio address loses its extensions
    Given a copy of bootstrap's diagram rebound to the older folio namespace under the "folio" prefix
    When it is loaded as a process model
    Then the file contains "<folio:skill"
    And the model names no skills

  @test:schemas/extension-namespace.test.ts::the_parser_follows_the_namespace,_not_the_prefix::folio:_bound_to_someone_else's_namespace_is_not_ours,_whatever_it_spells
  Scenario: folio: bound to a foreign namespace is not ours
    Given a copy of bootstrap's diagram whose "folio" prefix is bound to "urn:somebody-else"
    And an unchanged control copy whose model names at least one skill
    When the foreign copy is loaded as a process model
    Then its model names no skills

  @test:schemas/extension-namespace.test.ts::raw-XML_readers_follow_the_namespace_too::the_prefixes_bound_to_our_namespace_are_found,_dotted_ones_included
  Scenario: Prefixes bound to our namespace are found, dotted ones included
    Given a document binding "bootstrap.processes" to our namespace and "folio" to "urn:other"
    When our extension prefixes are read
    Then they are exactly "bootstrap.processes"

  @test:schemas/extension-namespace.test.ts::raw-XML_readers_follow_the_namespace_too::a_pattern_matches_our_element_under_any_prefix,_and_never_a_foreign_folio:
  Scenario: Our element pattern matches under our prefix and never a foreign folio:
    Given a document with a bootstrap.processes:skill ref "a" and a foreign folio:skill ref "b"
    When the own-element pattern for "skill" is matched against it
    Then only ref "a" is found

  @test:schemas/extension-namespace.test.ts::raw-XML_readers_follow_the_namespace_too::a_document_that_binds_none_of_our_namespaces_has_none_of_our_elements
  Scenario: A document binding none of our namespaces has none of our elements
    Given a document with no namespace bindings and a folio:skill element
    When the own-element pattern for "skill" is matched against it
    Then nothing matches

  @test:schemas/extension-namespace.test.ts::nothing_matches_our_elements_by_the_text_folio:_again::no_regex_literal_matches_folio:<element>_in_raw_text
  Scenario: No TypeScript source matches folio:<element> with a regex literal
    Given every non-declaration .ts file under cat-harness and folio-assistant-core, comment lines excluded
    When lines holding a regex literal containing "folio:" followed by an extension element name are collected
    And lines that are error-message matchers are left out
    Then no line is collected

  @test:schemas/extension-namespace.test.ts::every_diagram_writes_each_element_under_the_Subgraph_that_defines_it_(stage_3)::no_diagram_binds_the_older_single_address_any_more
  Scenario: No diagram binds the older single folio address
    Given every .bpmn file in the git corpus
    Then there are more than 70 diagrams
    And none contains the older folio BPMN namespace in quotes

  @test:schemas/extension-namespace.test.ts::every_diagram_writes_each_element_under_the_Subgraph_that_defines_it_(stage_3)::each_element_used_is_defined_by_the_vocabulary_of_the_address_it_is_written_under
  Scenario: Each extension element is defined by the vocabulary of its bound address
    Given every diagram and the ns.jsonld vocabularies of bootstrap and cat-harness processes, each id being namespace plus label
    When every element whose prefix is bound to one of those namespaces is checked
    Then more than 500 elements are checked
    And every one is defined by its namespace's vocabulary
