# The methodology front-matter schema and the evidence resolver. Each Scenario
# names the test that executes it.
Feature: Methodology evidence

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::accepts_a_node_with_no_`evidence`,_because_most_have_none
  Scenario: A node with no evidence is accepted
    Then a methodology with schema, name, title, origin and applies-when validates

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::requires_`origin`,_which_is_the_line_between_an_adoption_and_a_house_method
  Scenario: origin is required
    Then the methodology without origin does not validate

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::requires_`applies-when`,_so_the_selection_question_can_reach_the_node
  Scenario: applies-when is required
    Then the methodology without applies-when does not validate

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::REJECTS_a_misspelled_key_rather_than_ignoring_it
  Scenario: A misspelled key is rejected
    Then the methodology with an extra applies_when key does not validate

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::refuses_a_URL_as_`evidence`_—_the_point_is_that_it_resolves_HERE
  Scenario: A URL is refused as evidence
    Then evidence holding a DOI URL does not validate
    And evidence holding a library reference does

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::takes_SEVERAL_sources_—_a_methodology_may_rest_on_more_than_one
  Scenario: Several sources are accepted
    Then evidence holding two library references validates

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::refuses_`evidence:_[]`_—_an_empty_list_is_not_`no_evidence`
  Scenario: An empty evidence list is refused
    Then evidence: [] does not validate

  @test:scripts/tests/methodology-evidence.test.ts::the_schema_that_did_not_exist::refuses_a_BARE_STRING,_so_the_one-source_case_cannot_fork_the_shape
  Scenario: A bare string is refused as evidence
    Then evidence given as one string does not validate

  @test:scripts/tests/methodology-evidence.test.ts::the_helpers::returns_undefined_for_a_file_with_no_front_matter
  Scenario: A file with no front matter has none
    Then the front matter of a file holding only a heading is undefined

  @test:scripts/tests/methodology-evidence.test.ts::the_helpers::resolves_a_bib-slug_across_EVERY_declared_library,_not_just_one
  Scenario: A bib-slug resolves across every declared library
    Then library/gurel-tat-2017-swot-analysis resolves from the harness
    And library/not-a-real-slug does not
