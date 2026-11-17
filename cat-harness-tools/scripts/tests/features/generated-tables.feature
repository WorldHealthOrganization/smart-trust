# The page generators (scripts/gen-processes-viz.ts, scripts/tool-page.ts) write a sentence instead of a header-only
# table wherever a join is empty, judged by the same source check the gate runs. Each Scenario names the test that executes it.
Feature: Generated pages write no header-only tables

  @test:scripts/tests/generated-tables.test.ts::tableOrNone::writes_the_table_when_there_are_rows
  Scenario: tableOrNone writes the table when there are rows
    Given headers "a" and "b" and the row "| 1 | 2 |"
    When tableOrNone is called
    Then it returns "| a | b |", "|---|---|" and "| 1 | 2 |"

  @test:scripts/tests/generated-tables.test.ts::tableOrNone::writes_the_sentence,_and_no_table,_when_there_are_none
  Scenario: tableOrNone writes only the sentence when there are no rows
    Given headers "a" and "b", no rows and the sentence "_None._"
    When tableOrNone is called
    Then it returns only "_None._"

  @test:scripts/tests/generated-tables.test.ts::the_processes_index,_over_a_diagram_with_no_rows_to_show::writes_no_header-only_table
  Scenario: The processes index over an empty diagram has no header-only table
    Given a diagram with no lanes, skills, bean ops or steps, and one call activity
    When the processes index is generated
    Then the source check finds no "no-body" table in it

  @test:scripts/tests/generated-tables.test.ts::the_processes_index,_over_a_diagram_with_no_rows_to_show::says_each_empty_join_in_a_sentence_instead
  Scenario: The processes index states each empty join in a sentence
    Given the processes index over the empty diagram
    Then it contains "_No activity names a skill._" and "_No step names a bean op._"
    And it contains none of the headers "| skill | run by |", "| op | diagrams |" and "| lane | steps |"

  @test:scripts/tests/generated-tables.test.ts::the_processes_index,_over_a_diagram_with_no_rows_to_show::a_process_page_with_no_steps_says_so_rather_than_drawing_an_empty_table
  Scenario: A process page with no steps says so instead of an empty table
    When the process page for the empty diagram is generated
    Then the source check finds no "no-body" table in it
    And it contains "_No steps._"

  @test:scripts/tests/generated-tables.test.ts::a_Tool_page_whose_definition_names_no_file_it_is_made_of::writes_no_header-only_table_under_'What_it_is_made_of'
  Scenario: A Tool page with no parts writes a sentence, not a header-only table
    Given the Tool "demo-tool" whose page data lists no parts
    When its Tool page is generated
    Then it does not contain "| role | file | |"
    And it contains "Its definition names no file it is made of."
    And the source check finds no "no-body" table in it

  @test:scripts/tests/generated-tables.test.ts::a_Tool_page_whose_definition_names_no_file_it_is_made_of::still_writes_the_table_when_there_is_a_part
  Scenario: A Tool page with a part still writes the table
    Given the same Tool with a "definition" part "tools/demo.ts"
    When its Tool page is generated
    Then it contains "| role | file | |"
    And the source check finds no "no-body" table in it
