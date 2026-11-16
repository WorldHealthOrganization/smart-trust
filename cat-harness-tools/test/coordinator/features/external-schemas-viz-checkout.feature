# Specifies loadSpecs and namespacesInUse (scripts/external-schemas.ts) and
# declaredUsers, page and pageRelPath (scripts/gen-external-schemas-viz.ts)
# over the real external-schema registry and the checkout's declarations.
Feature: The external-schemas page covers the real registry with working links and sound tables

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::the_registry_is_found_at_all_—_an_empty_one_is_not_a_clean_run
  Scenario: The registry is found
    Given the external-schema registry
    When its specifications are loaded
    Then there is at least one

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::every_specification_has_a_declared_user,_and_no_declaration_names_a_missing_record
  Scenario: Every specification has a declared user and no declaration names a missing record
    Given the loaded specifications and their declared users in the checkout
    When the specifications with no user are collected
    Then there are none
    And no declaration names an unknown specification

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::each_declaration_form_is_exercised_by_the_real_corpus
  Scenario: Every declaration form is exercised
    Given the declared users in the checkout
    When their declaration forms are collected
    Then they are exactly front-matter, kind, tag and xmlns

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::every_row's_link_resolves_to_an_anchor_ON_THIS_PAGE
  Scenario: Every row's link resolves to a heading id on the page
    Given the page as rendered now and the page as committed under the declared path
    When the links and the kramdown heading ids of each are collected
    Then each page has one link per specification
    And neither has a separate "<a id>" anchor
    And every link targets a heading id on the same page

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::no_cell_breaks_the_table_it_sits_in
  Scenario: Every table row has its header's number of columns
    Given the rendered page
    When every table row after a header and separator is split on unescaped pipes
    Then each row has as many columns as its header
    And more than 10 rows were checked

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::a_spec_with_NO_operative_terms_says_so,_rather_than_showing_an_empty_table
  Scenario: A specification with no operative terms says so
    Given the specifications with no operative terms
    When the page is rendered
    Then where there are any, it says "determined zero, not an unfilled field"
    And it names each of them

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::the_page_a_reader_gets_—_over_the_REAL_registry::the_page_is_DECLARED,_not_composed_—_and_under_the_docs_tree
  Scenario: The page path is declared and under the docs tree
    Given the checkout
    When the page's relative path is read
    Then it is defined
    And it does not start with ".."

  @test:test/coordinator/external-schemas-viz-checkout.test.ts::dependents_link_to_their_files_(qgjh)::links_every_dependent_the_resolver_places,_and_no_other
  Scenario: Only dependents the resolver places are linked
    Given a resolver that places every ".ts" dependent at "https://host/<path>" and no other
    When the page is rendered with that resolver
    Then at least one dependent was placed
    And every placed dependent is linked to its URL
    And the page rendered without a resolver links nothing to "https://host/"
