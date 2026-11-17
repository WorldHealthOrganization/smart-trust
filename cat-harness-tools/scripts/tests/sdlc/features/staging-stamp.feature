# scripts/staging-stamp.ts derives the staging stamp (branch, sha, pr, run) for a preview build;
# the stamp is absent outside a build and declared in the JSON-LD export's context.
# Each Scenario names the test that executes it.
Feature: The staging stamp on preview builds

  @test:scripts/tests/sdlc/staging-stamp.test.ts::stagingStamp::is_absent,_not_fabricated,_when_there_is_no_build
  Scenario: There is no stamp when there is no build
    Given an empty environment
    Then the staging stamp is undefined
    And with only KG_BRANCH and GITHUB_RUN_ID set and no commit, the stamp is still undefined
    And the staging fields are an empty object with no keys at all

  @test:scripts/tests/sdlc/staging-stamp.test.ts::stagingStamp::prefers_the_workflow's_branch_name_over_the_ref_it_ran_on
  Scenario: The workflow's branch name wins over the ref it ran on
    Given GITHUB_SHA "abc123", KG_BRANCH "feat/x", GITHUB_REF_NAME "338/merge" and GITHUB_RUN_ID "77"
    When the staging stamp is derived
    Then it is branch "feat/x", sha "abc123", pr "338/merge" and run "77"

  @test:scripts/tests/sdlc/staging-stamp.test.ts::stagingStamp::falls_back_to_the_ref_when_the_workflow_set_no_branch
  Scenario: The ref names the branch when the workflow set none
    Given GITHUB_SHA "abc123" and GITHUB_REF_NAME "feat/y" with no KG_BRANCH or run id
    When the staging stamp is derived
    Then it is branch "feat/y", sha "abc123", pr "feat/y" and an empty run

  @test:scripts/tests/sdlc/staging-stamp.test.ts::stagingStamp::stamps_nothing_on_a_build_of_main:_build.json_names_that_commit_once_(bean_g196)
  Scenario: A build of main or master is not stamped
    Given GITHUB_SHA "abc123" and GITHUB_REF_NAME "main", then "master"
    When the staging stamp and staging fields are derived
    Then the stamp is undefined
    And the staging fields have no keys

  @test:scripts/tests/sdlc/staging-stamp.test.ts::stagingStamp::still_stamps_a_preview_whose_branch_happens_to_be_called_main
  Scenario: A preview whose branch is called main is still stamped
    Given KG_BRANCH "main", GITHUB_SHA "abc123", GITHUB_REF_NAME "12/merge" and GITHUB_RUN_ID "5"
    When the staging stamp is derived
    Then it is branch "main", sha "abc123", pr "12/merge" and run "5"

  @test:scripts/tests/sdlc/staging-stamp.test.ts::the_JSON-LD_export_declares_the_stamp_it_carries::context-declares-staging:_`staging`_is_a_term,_with_its_four_fields_scoped_under_it
  Scenario: The export's context declares the staging term with scoped fields
    Given the knowledge-graph export built once
    Then its "@context" defines the staging key with a string "@id"
    And "branch", "sha", "pr" and "run" are string terms in the staging term's own context
    And none of those four is a term in the top-level context

  @test:scripts/tests/sdlc/staging-stamp.test.ts::the_schema_documents_are_stamped_at_write_time,_not_in_the_builders::a_builder's_output_is_the_same_in_a_build_and_outside_one
  Scenario: The schema builders never carry the staging stamp
    Given the declaration-schema, tool-schema and tool-types builders
    When each is built with base URL "https://example.test"
    Then none of the outputs has the staging key
    # Gap: the builders are only run in the test's own environment; no build environment is set to compare against.
