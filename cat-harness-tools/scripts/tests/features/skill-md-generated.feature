# A generated file is never a skill. Each Scenario names the test that
# executes it.
Feature: Generated Markdown is not a skill

  @test:scripts/tests/skill-md-generated.test.ts::isSkillMd:_what_a_generator_wrote_is_not_a_skill::an_authored_instruction_body_is_a_skill_(the_control)
  Scenario: An authored instruction body is a skill
    Then a plain Markdown body with a heading is a skill

  @test:scripts/tests/skill-md-generated.test.ts::isSkillMd:_what_a_generator_wrote_is_not_a_skill::a_first-line_GENERATED_mark,_as_bpmn-checklist.ts_writes_it,_is_not
  Scenario: A first-line GENERATED mark is not a skill
    Then a checklist whose first line is the bpmn-checklist GENERATED comment is not a skill

  @test:scripts/tests/skill-md-generated.test.ts::isSkillMd:_what_a_generator_wrote_is_not_a_skill::front_matter_declaring_`generated:`_is_not
  Scenario: Front matter declaring generated is not a skill
    Then a page whose front matter has "generated:" is not a skill

  @test:scripts/tests/skill-md-generated.test.ts::isSkillMd:_what_a_generator_wrote_is_not_a_skill::`$schema`_front_matter_still_marks_a_non-skill_node
  Scenario: $schema front matter marks a non-skill node
    Then a node whose front matter has "$schema" is not a skill

  @test:scripts/tests/skill-md-generated.test.ts::isSkillMd:_what_a_generator_wrote_is_not_a_skill::a_skill_that_QUOTES_the_mark_below_its_head_stays_a_skill
  Scenario: A skill quoting the mark below its heading stays a skill
    Then a skill whose body quotes the GENERATED comment after its heading is a skill

  @test:scripts/tests/skill-md-generated.test.ts::the_harness's_own_knowledge-graph_directories::no_committed_BPMN_checklist_is_read_as_a_skill
  Scenario: No committed BPMN checklist is a skill
    When every .checklist.md in the harness's knowledge-graph directories is judged
    Then at least one is examined and none is a skill
