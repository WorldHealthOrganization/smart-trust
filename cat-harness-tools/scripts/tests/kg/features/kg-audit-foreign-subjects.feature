# What scripts/tests/kg/kg-audit-foreign-subjects.test.ts covers: kg-audit (schemas/sdlc/kg-qa.ts) writes a verdict
# only about a subject its own layer holds, and cat-harness's results tree holds none about another layer.
# Each Scenario names the test that executes it.
Feature: kg-audit writes verdicts only about its own layer's subjects

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::subjectEscapes::inside,_and_the_instance_root_itself,_do_not_escape
  Scenario: A path inside the instance, or the instance root itself, does not escape
    Given the instance root "/repo/a"
    When "/repo/a/processes" and "/repo/a" are checked for escaping
    Then neither escapes

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::subjectEscapes::a_sibling_escapes,_including_one_that_merely_SHARES_a_name_prefix
  Scenario: A sibling escapes, including one that only shares a name prefix
    Given the instance root "/repo/cat-harness"
    When "/repo/smart-base/processes", "/repo/cat-harness-tools/processes" and "/repo" are checked
    Then each escapes

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::subjectEscapes::a_directory_whose_NAME_begins_with_two_dots_is_inside
  Scenario: A directory whose name begins with two dots is inside
    Given the instance root "/repo/a"
    When "/repo/a/..hidden" is checked
    Then it does not escape

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::owningInstanceOf::the_deepest_containing_instance_wins
  Scenario: The deepest containing instance owns a path
    Given instance roots "/repo", "/repo/cat-harness" and "/repo/smart-base"
    When the owner of "/repo/smart-base/processes/x.bpmn" and of "/repo/processes/x.bpmn" is asked
    Then they are "/repo/smart-base" and "/repo"

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::owningInstanceOf::nothing_contains_it:_undefined,_never_a_guess
  Scenario: A path no instance contains has no owner
    Given instance roots "/repo", "/repo/cat-harness" and "/repo/smart-base"
    When the owner of "/elsewhere/x.bpmn" is asked
    Then it is undefined

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::partitionBySubjectOwner::own_and_path-less_subjects_are_kept
  Scenario: Own and path-less subjects are kept
    Given instance roots "/repo", "/repo/cat-harness" and "/repo/smart-base"
    When results for "processes/a.bpmn" and a null path are partitioned for "/repo/cat-harness"
    Then both are kept, with none skipped or unowned

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::partitionBySubjectOwner::a_subject_another_instance_owns_is_SKIPPED,_naming_that_owner
  Scenario: A subject another instance owns is skipped, naming that owner
    Given instance roots "/repo", "/repo/cat-harness" and "/repo/smart-base"
    When a result for "../smart-base/processes/l2.bpmn" is partitioned for "/repo/cat-harness"
    Then nothing is kept
    And it is skipped with owner "/repo/smart-base"

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::partitionBySubjectOwner::a_subject_outside_with_NO_owner_is_reported,_not_dropped
  Scenario: A subject outside with no owner is reported as unowned
    Given instance roots "/repo", "/repo/cat-harness" and "/repo/smart-base"
    When a result for "../../elsewhere/x.bpmn" is partitioned for "/repo/cat-harness"
    Then nothing is kept or skipped
    And one result is unowned

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::partitionBySubjectOwner::falsifier:_with_no_instance_roots,_a_foreign_subject_is_unowned_rather_than_skipped
  Scenario: With no instance roots a foreign subject is unowned rather than skipped
    Given no instance roots
    When a result for "../smart-base/processes/l2.bpmn" is partitioned for "/repo/cat-harness"
    Then one result is unowned

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::kgQaSidecarPath_refuses_a_foreign_subject::it_throws_rather_than_composing_an_`_external/`_path
  Scenario: The sidecar path of a foreign subject throws
    Given the instance "/repo/cat-harness"
    When a sidecar path is asked for a subject in "/repo/smart-base/processes"
    Then it throws a ForeignSubjectError

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::kgQaSidecarPath_refuses_a_foreign_subject::an_inside_subject_still_mirrors_its_directory
  Scenario: An inside subject's sidecar mirrors its directory
    Given the instance "/repo/cat-harness" and the target "/t"
    When a sidecar path is asked for subject "x" in "/repo/cat-harness/processes"
    Then it is "/t/processes/x.kg-qa.json"

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::the_committed_cat-harness_tree_holds_no_verdict_about_another_instance's_subject::no_`_external/`_tree
  Scenario: The cat-harness results tree has no _external directory
    Given the cat-harness kg-qa results tree
    When it is looked in
    Then it has no "_external" directory

  @test:scripts/tests/kg/kg-audit-foreign-subjects.test.ts::the_committed_cat-harness_tree_holds_no_verdict_about_another_instance's_subject::every_tool_sidecar_is_about_a_Tool_cat-harness_itself_declares
  Scenario: Every tool sidecar is about a Tool cat-harness itself declares
    Given the Tools cat-harness declares, of which there is at least one
    When the kg-qa tools directory is read
    Then every ".kg-qa.json" file in it names one of those Tools
    And where the directory is absent, git tracks no file under the kg-qa tree
