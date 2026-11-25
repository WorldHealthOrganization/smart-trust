# resolveTranslationPath in schemas/library/translation-tools.ts resolves a profile's bpmnDiagrams
# entry by file name through the chain's declared process graphs, opt-in groups included.
# Each Scenario names the test that executes it.
Feature: BPMN diagrams named by file name

  @test:test/translation-diagram-by-name.test.ts::bpmnDiagrams_by_file_name::a_diagram_in_another_layer's_switched-off_opt-in_group_is_found_by_name
  Scenario: A diagram in another layer's opt-in group is found by its file name
    Given layer "a" holding "x/processes/content/flow.bpmn" in opt-in group "x", and layer "b" needing "a" and declaring the profile
    When "flow.bpmn" is resolved for the profile
    Then it resolves to "a/x/processes/content/flow.bpmn"

  @test:test/translation-diagram-by-name.test.ts::bpmnDiagrams_by_file_name::a_name_no_layer_in_the_chain_declares_is_still_a_finding
  Scenario: A name no layer in the chain declares does not resolve
    # Gap: only that it resolves to nothing; the finding itself is not checked
    Given the same two layers
    When "renamed.bpmn" is resolved for the profile
    Then nothing is returned

  @test:test/translation-diagram-by-name.test.ts::bpmnDiagrams_by_file_name::a_name_two_diagrams_share_is_ambiguous,_not_picked
  Scenario: A name two diagrams share is not picked
    # Gap: ambiguity is not told apart from a missing name; only that nothing is returned
    Given layer "a" also holds "x/processes/other/flow.bpmn"
    When "flow.bpmn" is resolved for the profile
    Then nothing is returned

  @test:test/translation-diagram-by-name.test.ts::bpmnDiagrams_by_file_name::a_path_is_still_a_path:_it_is_not_matched_by_its_last_segment
  Scenario: A path is not matched by its last segment
    Given the same two layers
    When "processes/content/flow.bpmn" is resolved for the profile
    Then nothing is returned
