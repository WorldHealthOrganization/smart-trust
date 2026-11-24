# scripts/context-leak.ts (`check:context-leak`) finds bean, work-plan and process-engine
# vocabulary in what a bean-blind agent is given, without mistaking a DAK's business
# processes for a leak. Each Scenario names the test that executes it.
Feature: Context-leak scan of a bean-blind agent's context

  @test:scripts/tests/sdlc/context-leak.test.ts::the_vocabulary::bean,_work_plan,_the_engine's_tools,_bean_processes_and_markup_are_leaks
  Scenario: Bean, work-plan, engine-tool, bean-process and markup terms are each a leak
    Given ten lines naming a bean, a provenance id, a beans path, the beans branch, the work plan, a work order, "workflow_complete", "work_plan_prime", "Process_BeanOpen" and bean markup
    When the text is scanned for leaks
    Then every line yields a finding with its line number and term
    And a line holding two terms yields both, such as line 3 giving "bean" and "beans-path"
    And the findings are exactly the fourteen expected line:term pairs in order

  @test:scripts/tests/sdlc/context-leak.test.ts::the_vocabulary::a_DAK's_business_processes,_BPMN_and_workflows_are_content,_not_leaks
  Scenario: A DAK's business processes, BPMN and workflows are not leaks
    Given text about an immunization business process in BPMN, a workflow per persona, processing a record and beansprouts
    When the text is scanned for leaks
    Then there are no findings

  @test:scripts/tests/sdlc/context-leak.test.ts::scanning::a_built_context_directory:_findings_by_file_and_line;_a_binary_file_is_named_as_not_read
  Scenario: Scanning a context directory reports findings by file and line and names unread binaries
    Given a directory with a clean AGENTS.md, a skills/x.md mentioning the bean on line 2, and a binary logo.png
    When the directory is scanned
    Then two files are read
    And the only finding is "bean" in skills/x.md at line 2
    And logo.png is listed as unreadable

  @test:scripts/tests/sdlc/context-leak.test.ts::scanning::the_memory_tools_a_bean-blind_agent_is_offered_are_clean
  Scenario: The memory tools offered to a bean-blind agent carry no leak
    Given the memory tools registered on a stub server
    When their tool list is scanned
    Then the tools are "memory_note", "memory_checkpoint" and "memory_recall"
    And the scan finds nothing

  @test:scripts/tests/sdlc/context-leak.test.ts::scanning::the_process_engine's_tools_are_a_leak_in_a_bean-blind_tool_list
  Scenario: A process-engine tool in a bean-blind tool list is a leak
    Given a tool list holding "workflow_complete"
    When the tool list is scanned
    Then the single finding is the term "workflow-tool"
