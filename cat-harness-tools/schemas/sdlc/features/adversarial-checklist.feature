# Specifies schemas/sdlc/adversarial-checklist.ts: the adversarial checklists'
# references are names (skill:<name>, schema:<module>, code:<path>), and every
# one resolves through the declaration.
Feature: Adversarial checklist references resolve by name

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::there_are_references_to_check_—_a_pass_over_none_is_not_one
  Scenario: There are references to check
    Given every adversarial checklist item
    When their references are gathered
    Then there is at least one reference

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::every_item_parses,_so_every_reference_is_a_name,_never_a_path
  Scenario: Every checklist item parses under the item schema
    Given every adversarial checklist item
    When each is parsed with the adversarial checklist item schema
    Then every item parses

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::every_skill:_reference_names_a_skill_in_a_declared_skills_directory
  Scenario: Every skill reference names an existing skill
    Given the basenames of every .md file under the harness's declared skills directories
    When the skill: references of all checklist items are collected
    Then none names a skill missing from those directories

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::every_schema:_reference_names_a_module_in_a_declared_schemas_directory
  Scenario: Every schema reference names an existing module
    Given the declared schemas directories of the harness and of this tools layer
    When the schema: references of all checklist items are collected
    Then each names a <module>.ts file present in one of those directories

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::every_code:_reference_names_a_module_in_its_layer,_when_that_layer_is_checked_out_beside_this_one
  Scenario: Every code reference names an existing file when its layer is checked out
    Given the code: references of all checklist items
    When a reference's first path segment is a layer checked out beside the harness
    Then the referenced path exists in that layer
    And references to layers not checked out are not judged

  @test:schemas/sdlc/adversarial-checklist.test.ts::adversarial_checklist_references::FALSIFICATION:_a_path_is_refused
  Scenario: A file path as a reference is refused
    Given the first checklist item with its references replaced by the path "skills/x/y.md"
    When it is parsed with the item schema
    Then parsing fails
