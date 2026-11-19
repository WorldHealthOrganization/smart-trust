# scripts/gen-upload-step-docs.ts derives the upload step's page from a BPMN diagram's first activity and
# the Tools that satisfy its skill, refusing when the step cannot be derived. Each Scenario names the test that executes it.
Feature: Upload step page derived from a diagram and its Tools

  @test:scripts/tests/gen-upload-step-docs.test.ts::deriving_the_step::the_first_activity_is_the_one_the_start_event_reaches,_with_its_skill_and_lane
  Scenario: The first activity is the one the start event reaches, with its skill and lane
    Given a synthetic diagram whose start event flows to task "A" governed by synthetic-skill in a lane with role user
    When the first activity is derived
    Then its id is "A" and its skills are "synthetic-skill"
    And its lane is "Somebody (human or agent)" with role ref "user"

  @test:scripts/tests/gen-upload-step-docs.test.ts::deriving_the_step::a_start_event_reaching_an_EVENT_rather_than_an_activity_refuses
  Scenario: A start event reaching an event rather than an activity refuses
    Given a synthetic diagram whose start event flows to an end event
    When the first activity is derived
    Then it throws CannotDerive

  @test:scripts/tests/gen-upload-step-docs.test.ts::deriving_the_step::a_start_event_with_two_outgoing_flows_refuses_rather_than_picking_one
  Scenario: A start event with two outgoing flows refuses rather than picking one
    Given a synthetic diagram whose start event flows to both task A and task B
    When the first activity is derived
    Then it throws an error mentioning "outgoing flow"

  @test:scripts/tests/gen-upload-step-docs.test.ts::deriving_the_step::the_refusal_names_the_diagram_it_read,_not_the_generator's_own_subject
  Scenario: The refusal names the diagram it read
    Given a synthetic diagram whose start event flows to an end event
    When the first activity is derived and refuses
    Then the message contains "synthetic.bpmn"
    And it does not contain "document-ingestion"

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::states_the_step,_lane,_skill_and_Tool_count_read_from_the_diagram
  Scenario: The page states the step, lane, skill and Tool count read from the diagram
    Given the synthetic diagram and one Tool satisfying its skill
    When the page is rendered
    Then it names the first step as "Do the thing" with id A
    And it names the lane "Somebody (human or agent)" with role user
    And it names the governing skill "synthetic-skill" and 1 Tool that satisfies it
    And it quotes the step's documentation "What the diagram says about the step."

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::carries_the_Tool's_documentation_whole_—_description,_ports_and_invocation
  Scenario: The page carries the Tool's description, ports and invocation
    Given the synthetic diagram and the synthetic Tool
    When the page is rendered
    Then it contains the Tool's description
    And it contains the invocation "bun run nothing.ts"
    And it has an input row for required positional "subject" and optional "--check" flag "check", with their descriptions
    And it has an output row for "result" with its description

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::prints_the_selection_triple_under_its_three_questions
  Scenario: The page prints the selection triple under its three questions
    Given a Tool whose selection is when "WHEN-TEXT", limits "LIMITS-TEXT" and cost "COST-TEXT"
    When the page is rendered
    Then it contains bold "When.", "Limits." and "Cost." each followed by its text

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::a_Tool_with_no_selection_is_reported_as_a_gap_in_the_Tool,_not_left_blank
  Scenario: A Tool with no selection is reported as a gap in the Tool
    Given a Tool that declares no selection
    When the page is rendered
    Then it says the Tool "declares no `selection`"
    And it says this is a "gap in the Tool node, not on this page"

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::a_cell_may_not_break_the_table_that_holds_it
  Scenario: A table cell's pipe and newline do not break its table
    Given a Tool input whose description is "a | pipe" then a newline and "and a newline"
    When the page is rendered
    Then the subject row holds the description with the pipe escaped and the newline turned into a space
    And the row ends with a pipe

  @test:scripts/tests/gen-upload-step-docs.test.ts::the_page::the_front_matter_marks_it_generated_and_names_the_generator
  Scenario: The front matter marks the page generated and names the generator
    When the page is rendered
    Then it starts with front matter
    And it names "cat-harness-tools/scripts/gen-upload-step-docs.ts" as the generator
    And it says "do not hand-edit"
