# The edit target scripts/gen-docs-pages.ts gives a figure is repo-root-relative, so a generated
# GitHub edit link never carries a "main/../" segment. Each Scenario names the test that executes it.
Feature: Cross-instance figure edit URLs have no ".." segment

  @test:scripts/tests/cross-instance-figure-urls.test.ts::cross-instance_figure_edit_URLs_(bean_4z5o)::a_figure_whose_source_is_in_a_nested_instance_resolves_to_repo-root-relative_with_no_.._segment
  Scenario: A figure sourced from a nested instance gets a repo-root-relative edit target
    Given a figure node whose BPMN source is "../folio-assistant-core/processes/library/l1-document-ingestion.bpmn"
    When its edit target is computed
    Then the target is "folio-assistant-core/processes/library/l1-document-ingestion.bpmn"
    And the target contains no ".."

  @test:scripts/tests/cross-instance-figure-urls.test.ts::cross-instance_figure_edit_URLs_(bean_4z5o)::a_figure_whose_source_is_local_to_the_instance_remains_unchanged
  Scenario: A figure sourced inside the instance keeps its source as the edit target
    Given a figure node whose BPMN source is "sdlc/processes/bean-lifecycle.bpmn"
    When its edit target is computed
    Then the target equals the source
    And the target contains no ".."

  @test:scripts/tests/cross-instance-figure-urls.test.ts::cross-instance_figure_edit_URLs_(bean_4z5o)::the_generated_docs_corpus_carries_zero_edit/main/../_links_across_all_markdown_pages
  Scenario: No generated docs page carries an "edit/main/../" link
    Given every markdown file under the harness's docs directory
    Then there are more than 10 such files
    And no line in any of them contains "edit/main/../"
