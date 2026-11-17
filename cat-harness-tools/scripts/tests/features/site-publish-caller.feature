# Every harnessed repository publishes on a push to main through the one
# shared workflow, with the canonical caller. Each Scenario names the test
# that executes it.
Feature: The site publish caller workflow

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::the_template,_pinned_to_a_commit,_is_canonical
  Scenario: The template pinned to a commit is canonical
    Given site-publish.yml is the template with the shared workflow pinned to a 40-character SHA
    When the workflows are judged
    Then there are no findings

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::comments_and_the_pinned_commit_do_not_matter
  Scenario: Comments and the pinned commit do not matter
    Given the pinned caller with another SHA and different comments
    When the workflows are judged
    Then there are no findings

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::no_caller_at_all_is_a_finding
  Scenario: No caller is a finding
    Given only an unrelated checks.yml
    When the workflows are judged
    Then there is one finding saying the caller "is missing"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_manual-only_caller_(the_old_IG_template's_trigger)_is_named_as_such
  Scenario: A manual-only caller is named so
    Given the pinned caller without its push trigger
    When the workflows are judged
    Then there is one finding saying "manual-only"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_path_filter_on_push_is_a_finding
  Scenario: A path filter on push is a finding
    Given the pinned caller with a paths filter on push
    When the workflows are judged
    Then the first finding says it is "filtered by path"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_hand-edited_body_is_a_finding_naming_where_it_differs
  Scenario: A hand-edited body is a finding naming where it differs
    Given the pinned caller with plan hard-coded and an extra qa input
    When the workflows are judged
    Then one finding names jobs.publish.with.plan and says jobs.publish.with.qa is not in the canonical caller

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::an_extra_job_is_a_finding
  Scenario: An extra job is a finding
    Given the pinned caller with an extra job
    When the workflows are judged
    Then a finding says jobs.extra is not in the canonical caller

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_branch_pin_is_a_finding
  Scenario: A branch pin is a finding
    Given the unpinned template
    When the workflows are judged
    Then a finding says the reference is "not a commit"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_hand-rolled_publish_(stage-local.ts_in_a_step)_is_a_finding,_beside_a_missing_caller
  Scenario: A hand-rolled publish is a finding beside a missing caller
    Given site-publish.yml running stage-local.ts in a step
    When the workflows are judged
    Then the findings are, in order, the caller "is missing" and the publish is "hand-rolled"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_step_that_only_NAMES_stage-local.ts_in_a_message_or_comment_is_not_hand-rolled
  Scenario: Naming stage-local.ts in a message or comment is not hand-rolled
    Given the canonical caller and a workflow whose step only mentions stage-local.ts in a comment and an echo
    When the workflows are judged
    Then no finding says "hand-rolled"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::invokesStageLocal_tells_a_call_from_a_mention
  Scenario: invokesStageLocal tells a call from a mention
    Then running stage-local.ts by path, through "cat stage:local", or after cd is a call
    And echoing it, printing it, a comment, or a notice followed by an echo is not

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::two_callers_race_for_gh-pages
  Scenario: Two callers race for gh-pages
    Given the canonical caller in two files
    When the workflows are judged
    Then the first finding says they "race"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::a_canonical_body_under_another_file_name_is_told_to_move
  Scenario: A canonical body under another name is told to move
    Given the canonical caller saved as pages.yml
    When the workflows are judged
    Then the first finding says "move it"

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::sharedRef_reads_only_the_shared_workflow's_calls
  Scenario: sharedRef reads only the shared publish workflow's reference
    Then the folio-site-publish.yml call yields its SHA
    And a layer-pr-checks.yml call yields nothing

  @test:scripts/tests/site-publish-caller.test.ts::site-publish-caller::differences_names_missing_and_extra_keys_by_path
  Scenario: differences names missing and extra keys by path
    Then comparing { a: { b } } with canonical { a: { c } } gives "a.b is missing" and "a.c is not in the canonical caller"
