# scripts/staging-record.ts decides what a staging deploy writes to a preview's
# record (create, update, or refuse a retired one) and loads an existing record.
# Each Scenario names the test that executes it.
Feature: The staging deploy record

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_the_first_deploy::creates_a_record_carrying_what_only_the_deploy_knows
  Scenario: A first deploy creates a record with the deploy's facts
    Given no existing record and deploy facts with PR 459 and issue 223
    When the record is created or updated
    Then the action is "created"
    And the record holds PR 459 and issue 223

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_`synchronize`_fires_on_every_push::the_head_commit_is_updated,_because_that_legitimately_changes
  Scenario: A re-deploy updates the head commit
    Given an existing record for the first deploy
    When a deploy with a new commit and a later build time arrives
    Then the action is "updated"
    And the record's commit is the new commit

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_`synchronize`_fires_on_every_push::builtAt_does_NOT_walk_forward_—_it_answers_when_the_preview_first_appeared
  Scenario: A re-deploy keeps the first build time
    Given an existing record built at "2026-09-20T05:00:00Z"
    When a deploy with a new commit built at "2026-09-20T06:00:00Z" arrives
    Then the record's builtAt is still "2026-09-20T05:00:00Z"

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_`synchronize`_fires_on_every_push::running_it_many_times_is_stable_after_the_first_update
  Scenario: Repeated re-deploys are stable
    Given an existing record built at "2026-09-20T05:00:00Z"
    When the same new deploy is applied five times in a row
    Then the record's commit is the new commit
    And its builtAt is still "2026-09-20T05:00:00Z"

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_a_retired_record_is_not_resurrected::refuses,_rather_than_overwriting_it_as_live
  Scenario: A retired record is refused rather than overwritten as live
    Given a record retired with reason "PR #459 merged"
    When a deploy is applied to it
    Then the action is "refused-retired"

  @test:scripts/tests/sdlc/staging-record.test.ts::createOrUpdate_—_a_retired_record_is_not_resurrected::the_refusal_names_when_it_was_retired_and_why
  Scenario: The refusal names when and why the record was retired
    Given a record retired on "2026-09-20T07:00:00Z" with reason "PR #459 merged"
    When a deploy is applied to it
    Then the refusal's explanation contains that date and that reason

  @test:scripts/tests/sdlc/staging-record.test.ts::loadExisting::absent_is_undefined,_not_an_error_—_a_first_deploy_has_no_record
  Scenario: A missing record loads as undefined
    When a path that does not exist is loaded
    Then the result is undefined

  @test:scripts/tests/sdlc/staging-record.test.ts::loadExisting::a_well-formed_record_round-trips
  Scenario: A well-formed record loads back
    Given a serialized staging preview with PR 459 written to a file
    When it is loaded
    Then its PR is 459

  @test:scripts/tests/sdlc/staging-record.test.ts::loadExisting::a_corrupt_record_THROWS_rather_than_being_treated_as_absent
  Scenario: A corrupt record throws rather than loading as absent
    Given a file holding a staging-preview node with no staging block
    When it is loaded
    Then it throws "not a staging-preview record"

  @test:scripts/tests/sdlc/staging-record.test.ts::loadExisting::a_file_of_another_kind_also_throws,_naming_that_kind
  Scenario: A record of another kind throws, naming that kind
    Given a file holding a fsh-guts node of kind "proposal"
    When it is loaded
    Then it throws an error naming "proposal"
