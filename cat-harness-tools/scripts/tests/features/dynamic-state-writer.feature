# scripts/state-visualizer.ts's writeDynamicState is the one writer of <site>/<harness>/state.jsonld,
# run by the generator whenever it draws a workflow page that links it, and by stage 3.
# Each Scenario names the test that executes it.
Feature: The one writer of the dynamic-state document

  @test:scripts/tests/dynamic-state-writer.test.ts::writeDynamicState:_the_one_writer_of_state.jsonld::writes_a_DynamicState_document,_creating_the_harness_directory_of_a_site_that_has_none
  Scenario: The dynamic-state document is written even into a site with no harness directory
    Given a scratch site with no "cat-harness" directory and a harness root with no declaration
    When the dynamic-state document is written to the site's cat-harness state path
    Then it reports writing that path, and the file exists
    And the file's schema is the DynamicState schema
    And its graph is empty, as is the returned document's

  @test:scripts/tests/dynamic-state-writer.test.ts::writeDynamicState:_the_one_writer_of_state.jsonld::a_workflow_page's_link_resolves_to_the_file_it_writes_by_default
  Scenario: A workflow page's link resolves to the file written by default
    Given the default dynamic-state target, which ends in the state file name
    And a workflow page directory "en/cat-harness/beans/cat-harness-tools/workflows/some-instance" of its site
    When the page's dynamic-state link is computed
    Then it is "../../../../../../cat-harness/state.jsonld"
    And resolved from the page directory it is the default target

  @test:scripts/tests/dynamic-state-writer.test.ts::the_generator_writes_the_document_whenever_a_workflow_page_links_it::every_workflow_page_takes_its_link_from_dynamicStateHref
  Scenario: Every workflow page takes its link from dynamicStateHref
    # Gap: a source-text check of scripts/state-visualizer.ts, not a run of the generator
    Given the source of scripts/state-visualizer.ts
    Then it contains "stateDocument: dynamicStateHref(pageDir)"
    And "stateDocument:" occurs exactly once

  @test:scripts/tests/dynamic-state-writer.test.ts::the_generator_writes_the_document_whenever_a_workflow_page_links_it::a_write_run_that_drew_a_workflow_page_calls_writeDynamicState
  Scenario: A write run that drew a workflow page calls writeDynamicState
    # Gap: a source-text check of scripts/state-visualizer.ts, not a run of the generator
    Given the source of scripts/state-visualizer.ts
    Then it counts drawn workflow pages
    And after that, a branch taken when any page was drawn calls writeDynamicState within 120 characters

  @test:scripts/tests/dynamic-state-writer.test.ts::the_generator_writes_the_document_whenever_a_workflow_page_links_it::stage_3_uses_the_same_writer
  Scenario: Stage 3 uses the same writer
    # Gap: a source-text check; only that the call appears in the source is checked
    Given the source of scripts/dynamic-state-export.ts
    Then it calls writeDynamicState
