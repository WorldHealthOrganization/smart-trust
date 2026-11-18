# src/tools/skill-update.ts (skill_update) writes a new version of a skill file
# only when every gate passes: resolve, layer, generated, permission, base-hash,
# front-matter and references. Each Scenario names the test that executes it.
Feature: The skill_update tool and its gates

  @test:src/tools/skill-update.test.ts::P1:_a_permitted,_valid_edit_is_written::the_file_holds_the_new_content_and_every_gate_is_reported_satisfied
  Scenario: A permitted, valid edit is written and every gate is reported satisfied
    Given a git repository holding skill "demo" in package "pkg" and an actor "editor" granted skill-update
    When "editor" updates "demo" to retitle its heading "# Demo, revised", with the hash of the current file
    Then the write is accepted and the file contains "# Demo, revised"
    And the gates reported are resolve, layer, generated, permission, base-hash, front-matter and references, in that order
    And every gate is satisfied
    And the diff is one line added and one removed
    And the result carries the hash of the new content

  @test:src/tools/skill-update.test.ts::P1:_a_permitted,_valid_edit_is_written::with_process,_task_and_role,_an_accepted_write_returns_a_valid_PROV-O_activity
  Scenario: With process, task and role, an accepted write returns a PROV-O activity
    # Gap: the activity is not validated against a PROV-O schema, only these two fields are read
    Given the permitted "demo" edit
    When it is made with process "skill-maintenance.bpmn", task "Task_Edit" and role "editor"
    Then the write is accepted
    And the activity's qualified association has plan "skill-maintenance#Task_Edit"
    And the activity is under policy "urn:test:policy"

  @test:src/tools/skill-update.test.ts::P1:_a_permitted,_valid_edit_is_written::without_them,_no_activity_is_invented,_and_the_result_says_so
  Scenario: Without process, task and role, no activity is invented and the result says so
    Given the permitted "demo" edit
    When it is made with no process, task or role
    Then the result has no activity
    And the findings say "none is invented"

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::front_matter_that_does_not_parse
  Scenario: Front matter that does not parse is refused
    Given the permitted "demo" edit
    When the new content's front matter has an unclosed "[" in its description
    Then nothing is written and the file is byte-identical
    And the front-matter gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::front_matter_that_never_closes
  Scenario: Front matter that never closes is refused
    Given the permitted "demo" edit
    When the new content opens front matter with "---" and never closes it
    Then nothing is written and the file is byte-identical
    And the front-matter gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::a_renamed_skill:_the_name_is_its_identity
  Scenario: Renaming the skill is refused, since the name is its identity
    Given the permitted "demo" edit
    When the new content changes "name: demo" to "name: demo2"
    Then nothing is written and the file is byte-identical
    And the front-matter gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::an_added_link_that_does_not_resolve
  Scenario: An added link that does not resolve is refused
    Given the permitted "demo" edit
    When the new content adds a link to "missing.md", which does not exist
    Then nothing is written and the file is byte-identical
    And the references gate is unsatisfied, with a reason naming "missing.md"

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::an_added_external_link_cannot_be_checked,_and_that_refuses_(owner_answer_3)
  Scenario: An added external link cannot be checked, and is refused
    Given the permitted "demo" edit
    When the new content adds a link to "https://example.org/x"
    Then nothing is written and the file is byte-identical
    And the references gate verdict is "could-not-determine"

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::an_added_link_that_resolves_is_fine
  Scenario: An added link that resolves is accepted
    Given the permitted "demo" edit
    When the new content adds a link to "./other.md#top", which exists
    Then the write is accepted and the file contains the added text

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::no_policy_grants_skill-update:_unknown_is_not_permit_(owner_answer_2)
  Scenario: An actor no policy grants skill-update is refused
    Given the policy grants skill-update only to "editor"
    When declared actor "writer" makes the edit
    Then nothing is written and the file is byte-identical
    And the permission gate is unsatisfied, with a reason saying "only Roles the owner grants"

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::a_sibling_grant_does_not_stand_in:_content-authoring_is_not_skill-update
  Scenario: A grant of content-authoring does not stand in for skill-update
    Given a policy granting "writer" only content-authoring
    When "writer" makes the edit
    Then nothing is written and the file is byte-identical
    And the permission gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::a_prohibition_refuses_even_with_a_grant
  Scenario: A prohibition refuses even with a grant
    Given a policy that both grants and prohibits skill-update for "editor"
    When "editor" makes the edit
    Then nothing is written and the file is byte-identical
    And the permission gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::no_actor,_or_an_undeclared_one
  Scenario: An edit with no actor, or an undeclared one, is refused
    Given the permitted "demo" edit
    When it is made with no actor
    Then nothing is written, the file is byte-identical and the permission gate is unsatisfied
    When it is made by undeclared actor "stranger"
    Then nothing is written, the file is byte-identical and the permission gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::the_file_changed_since_it_was_read
  Scenario: An edit against a stale hash is refused
    Given the permitted "demo" edit
    When its base hash is 64 zeros rather than the file's hash
    Then nothing is written and the file is byte-identical
    And the base-hash gate is unsatisfied
    And the result carries the file's current hash

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::a_generated_file_is_refused,_naming_its_generator
  Scenario: A generated skill file is refused
    # Gap: the reason is not checked to name the generator
    Given "demo.md" rewritten with front matter "generated: scripts/x.ts"
    When an edit appending a line is made against its current hash
    Then nothing is written and the file is unchanged
    And the generated gate is unsatisfied

  @test:src/tools/skill-update.test.ts::P1:_refusals_leave_the_file_byte-identical::every_gate_runs,_so_one_call_reports_every_problem
  Scenario: Every gate runs, so one call reports every problem
    Given the "demo" skill
    When "writer" makes an edit with a stale hash and new content renaming the skill to "x"
    Then nothing is written and the file is byte-identical
    And the permission, base-hash and front-matter gates are all unsatisfied

  @test:src/tools/skill-update.test.ts::edge_cases:_where_the_skill_lives::a_reference_package_is_never_edited
  Scenario: A skill in a reference package is never edited
    Given "external" is a reference package
    When the edit names package "external"
    Then nothing is written
    And the resolve gate is unsatisfied

  @test:src/tools/skill-update.test.ts::edge_cases:_where_the_skill_lives::a_skill_in_another_repository_is_refused_(owner_answer_4)
  Scenario: A skill in another repository is refused
    Given the "demo" skill in one git repository
    When the edit is made with the work root set to a second git repository
    Then nothing is written and the file is byte-identical
    And the layer gate is unsatisfied, with a reason saying "another repository"

  @test:src/tools/skill-update.test.ts::edge_cases:_where_the_skill_lives::an_untracked_copy,_as_a_mount_lays_one_down,_is_refused
  Scenario: An untracked copy of a skill, as a mount lays one down, is refused
    Given an untracked copy of "demo.md" under "mounted" in the repository
    When the edit is made with package "pkg" pointing at "mounted"
    Then nothing is written
    And the layer gate is unsatisfied, with a reason saying "not tracked"

  @test:src/tools/skill-update.test.ts::edge_cases:_where_the_skill_lives::an_unknown_skill_names_the_packages,_as_skill_fetch_does
  Scenario: An unknown skill is refused at the resolve gate
    # Gap: the reason is not checked to name the packages
    Given the "demo" skill
    When the edit names skill "nope"
    Then nothing is written
    And the resolve gate is unsatisfied
