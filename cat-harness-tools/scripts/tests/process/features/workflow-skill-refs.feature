# A <folio:skill ref> names a skill that exists, and every declared
# translation extract/inject module resolves.
Feature: Declared paths and workflow skill refs resolve

  @test:scripts/tests/process/workflow-skill-refs.test.ts::declared_diagram_paths_resolve::every_declared_extractModule_/_injectModule_exists
  Scenario: Every declared translation extract and inject module resolves
    Given every format of every content-type translation declaration
    When each declared extractModule and injectModule is resolved
    Then none is missing

  @test:scripts/tests/process/workflow-skill-refs.test.ts::workflow_skill_refs_resolve::the_skill_index_is_not_empty_—_a_broken_index_would_pass_everything
  Scenario: The skill index is populated
    Given the canonical known-skills resolver over the harness root
    When it lists the skills
    Then there are more than 20

  @test:scripts/tests/process/workflow-skill-refs.test.ts::workflow_skill_refs_resolve::every_folio:skill_ref_names_a_skill_in_this_repository
  Scenario: Every skill ref in every process diagram names a known skill
    Given every process diagram among the harness's workflow files
    When each is loaded and each activity's skill refs are listed
    Then every ref is a known skill
