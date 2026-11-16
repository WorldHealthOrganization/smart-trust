# schemas/library/code-list.ts defines code lists (codes with definitions and a source), loaded from
# declared directories; the process model checks an adjudication's codes against the list it names.
# Each Scenario names the test that executes it.
Feature: Code lists and the adjudications that name them

  @test:scripts/tests/code-list.test.ts::the_shape::a_well-formed_list_parses
  Scenario: A well-formed code list parses
    Given a code list "t" with a source note and the codes "yes" and "no", each with a definition
    When it is parsed against the code-list schema
    Then it parses

  @test:scripts/tests/code-list.test.ts::the_shape::refuses_a_code_listed_twice,_a_source_naming_nothing,_a_code_with_no_definition
  Scenario: A list with a duplicate code, an empty source or an undefined code is refused
    Given a list with the code "a" listed twice
    And a list whose source is empty
    And a list whose code "a" has no definition
    When each is parsed against the code-list schema
    Then none of them parses

  @test:scripts/tests/code-list.test.ts::the_shape::a_retired_code_stays_in_the_list_but_is_not_one_of_its_values
  Scenario: A retired code stays in the list but is not an active value
    Given a list with a retired code "old" and an active code "new"
    When its active codes are read
    Then they are exactly "new"
    And in its SKOS rendering the concept "old" is deprecated
    And the first SKOS node is a "skos:ConceptScheme"

  @test:scripts/tests/code-list.test.ts::loading::skips_files_that_are_not_code_lists;_a_later_directory_overrides_an_earlier_one
  Scenario: Loading skips non-code-list files and lets a later directory override
    Given a first directory with code list "t" and a JSON file of another schema
    And a second directory with code list "t" titled "Overridden"
    When the code lists are loaded from both directories in order
    Then the only list id is "t"
    And its title is "Overridden"

  @test:scripts/tests/code-list.test.ts::loading::this_instance_declares_its_code_lists,_and_every_one_parses
  Scenario: This instance's declared code lists load
    Given the code-list directories this instance declares
    When the code lists are loaded
    Then there is at least one, including "own-namespaces"
    And the built code-lists document's graph has more nodes than there are lists

  @test:scripts/tests/code-list.test.ts::the_engine_checks_an_adjudication's_codes_against_the_list_it_names::the_list's_own_codes_load
  Scenario: An adjudication with its list's own codes loads
    Given a diagram whose task adjudicates with codes "stands withdrawn" from list "adjudication-content-finding"
    When the process model is loaded
    Then the task's adjudication has codes "stands" and "withdrawn" and that list

  @test:scripts/tests/code-list.test.ts::the_engine_checks_an_adjudication's_codes_against_the_list_it_names::REFUSES_a_code_the_list_does_not_define,_and_one_it_defines_that_is_missing
  Scenario: Codes that disagree with the named list are refused
    Given a diagram adjudicating with codes "stands overruled" from list "adjudication-content-finding"
    When the process model is loaded
    Then loading fails, saying the list "defines (stands, withdrawn)"

  @test:scripts/tests/code-list.test.ts::the_engine_checks_an_adjudication's_codes_against_the_list_it_names::REFUSES_a_list_nothing_declares
  Scenario: An adjudication naming an undeclared list is refused
    Given a diagram adjudicating from list "no-such-list"
    When the process model is loaded
    Then loading fails, saying there is "no declared code-list"

  @test:scripts/tests/code-list.test.ts::the_engine_checks_an_adjudication's_codes_against_the_list_it_names::REFUSES_a_list_with_no_codes_beside_it
  Scenario: An adjudication naming a list without codes is refused
    Given a diagram adjudicating from list "adjudication-criterion" with no codes
    When the process model is loaded
    Then loading fails, saying it is "without `codes`"

  @test:scripts/tests/code-list.test.ts::the_engine_checks_an_adjudication's_codes_against_the_list_it_names::this_repository's_diagrams_all_name_their_list
  Scenario: An adjudication that names no list is found
    # Gap: only a fixture diagram is scanned, not this repository's diagrams
    Given a diagram with one adjudication naming no list and one naming list "l"
    When unlisted adjudications are collected
    Then exactly one is found

  @test:scripts/tests/code-list.test.ts::our_namespaces_are_the_code_list's_values::each_constant_equals_its_code's_value
  Scenario: The namespace constants equal the own-namespaces list's values
    Given the "own-namespaces" code list
    When the namespace constants are compared with it
    Then the workflows, folio-bpmn and cat-harness constants each equal their code's value
    And the own namespace values include the folio base

  @test:scripts/tests/code-list.test.ts::our_namespaces_are_the_code_list's_values::the_JSON-LD_scan_(bean_2j09)_sees_external_vocabularies_and_none_of_ours
  Scenario: The JSON-LD namespace scan finds external vocabularies and none of ours
    When the JSON-LD namespaces in use are scanned
    Then they include the PROV and SKOS core namespaces
    And none overlaps an own namespace value
