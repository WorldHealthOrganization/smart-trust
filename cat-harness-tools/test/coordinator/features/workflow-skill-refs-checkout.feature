# Specifies CONTENT_TYPE_TRANSLATIONS and resolveTranslationPath
# (schemas/library/translation-tools.ts).
Feature: Every declared BPMN diagram path resolves

  @test:test/coordinator/workflow-skill-refs-checkout.test.ts::declared_diagram_paths_resolve::every_bpmnDiagrams_entry_names_a_file_that_exists
  Scenario: Every bpmnDiagrams entry resolves from its declaring instance
    Given every content-type translation declaration
    When each of its bpmnDiagrams entries is resolved
    Then every one resolves to a file
