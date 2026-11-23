# Every recorded process reference — a workflow instance's processId, a
# workflow policy's process, a voice's activeIn.processes — names a process
# id that a diagram in the repository declares.
Feature: Recorded process references resolve to declared BPMN process ids

  @test:scripts/tests/process/process-refs.test.ts::recorded_process_references_resolve::the_corpus_is_non-empty,_so_the_assertion_below_is_not_vacuous
  Scenario: There are declared process ids and recorded references to check
    # Gap: the count of references is asserted only when beans/workflows exists; without it the reference check below may run on none
    Given every <bpmn:process id> in the repository's diagrams, outside node_modules and docs
    When they are counted
    Then there are more than 10
    And when beans/workflows exists, at least one recorded reference was collected

  @test:scripts/tests/process/process-refs.test.ts::recorded_process_references_resolve::every_reference_is_a_declared_BPMN_process_element_id
  Scenario: Every recorded reference is a declared process id
    Given the processIds of beans/workflows instances, the "process" values of every workflow-policy.json, and the activeIn.processes of every folio-voice
    When each is looked up among the declared process ids
    Then no reference is dangling

  @test:scripts/tests/process/process-refs.test.ts::recorded_process_references_resolve::the_render_log's_writer_records_the_element_id,_not_the_file_stem
  Scenario: The render log's writer records a process element id
    Given the source of scripts/render-log.ts
    When its first `process: "…"` literal is read
    Then it is a declared process id
