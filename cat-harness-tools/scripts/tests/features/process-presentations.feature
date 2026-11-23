# Subprocess links are derived from the pages that present each process, and
# every rendered link lands (bean xl55). Each Scenario names the test that executes it.
Feature: Where a subprocess box links

  @test:scripts/tests/process-presentations.test.ts::processTarget_—_where_a_subprocess_box_lands::exactly_one_section_presents_it_→_that_section
  Scenario: Exactly one presenting section is the target
    Then a process presented by one section links to that page's section

  @test:scripts/tests/process-presentations.test.ts::processTarget_—_where_a_subprocess_box_lands::the_link_is_the_PUBLISHED_address,_not_the_slug
  Scenario: The link is the published address, not the slug
    Then a section on a page published under docs/cat-harness/ links there

  @test:scripts/tests/process-presentations.test.ts::processTarget_—_where_a_subprocess_box_lands::a_slug_with_a_path_keeps_it
  Scenario: A slug with a path keeps it
    Then a section on guides/who-smart-ig links to guides/who-smart-ig.html with its anchor

  @test:scripts/tests/process-presentations.test.ts::processTarget_—_where_a_subprocess_box_lands::none_→_the_process's_own_generated_page,_at_the_DECLARED_route_under_the_page_locale_(2026-10-09)
  Scenario: With no presenting section the process's own page is the target
    Then a process with no presentations, or an empty list, links to its generated page under the page locale

  @test:scripts/tests/process-presentations.test.ts::processTarget_—_where_a_subprocess_box_lands::MORE_than_one_→_the_process_page,_which_lists_them_all_—_never_a_silent_pick
  Scenario: More than one presenting section links to the process page
    Then a process presented by two sections links to its generated page

  @test:scripts/tests/process-presentations.test.ts::this_repository,_right_now::the_index_is_not_empty_—_and_reading_.json_page_manifests_reaches_no_traced_input_site
  Scenario: The checkout's presentation index is not empty and reads no traced input
    When the checkout's process presentations are read under an input trace
    Then the index is not empty and no traced input site is reached

  @test:scripts/tests/process-presentations.test.ts::this_repository,_right_now::a_process_presented_by_an_instance_above_is_addressed_under_that_instance
  Scenario: A process presented by an instance above is addressed under that instance
    Given a checkout holding folio-assistant-core's docs
    Then ingest-theme is presented only by guides/document-ingestion#ingest-the-theme, whose address ends in guides/document-ingestion.html

  @test:scripts/tests/process-presentations.test.ts::this_repository,_right_now::every_subprocess_link_in_every_rendered_diagram_lands_on_a_page,_and_on_its_section
  Scenario: Every subprocess link in every rendered diagram lands on a page and its section
    When the subprocess links of the SVGs the diagrams render are read
    Then there is at least one
    And every absolute link is a declared process's subject page, and every relative one names a page that exists and holds its anchor

  @test:scripts/tests/process-presentations.test.ts::this_repository,_right_now::no_diagram_names_a_page_—_the_link_is_the_page's_to_declare
  Scenario: No diagram names a page
    Then no BPMN file in the checkout carries a link element with an href
