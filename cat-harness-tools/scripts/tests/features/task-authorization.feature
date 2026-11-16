# Every BPMN task execution checks authentication, role assignment, ODRL
# permission and content access first (issue #1207). Each Scenario names the
# test that executes it.
Feature: Task authorization

  Background:
    Given an access context with one test ODRL policy and actors "ed" (role editor) and "any" (no roles)
    And a request to perform task "Task_Y" of "Process_X" in role "editor"

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::a_scoped_perform-task_grant_to_an_eligible_actor_permits_cleanly_apart_from_the_authN_finding
  Scenario: A scoped grant to an eligible actor permits
    Given a policy granting "ed" perform-task constrained to role "editor"
    When "ed", asserted, is authorized
    Then it is allowed, eligible and permitted
    And the only finding is 'actor "ed" is asserted, not authenticated'

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::a_role_the_actor_may_not_take_refuses,_whatever_the_policy_says
  Scenario: A role the actor may not take refuses
    Given a policy granting "ed" perform-task
    When "ed" is authorized in role "publisher"
    Then it is refused as "not-eligible"

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::a_prohibition_refuses
  Scenario: A prohibition refuses
    Given a policy prohibiting "ed" perform-task
    When "ed" is authorized
    Then it is refused and authorized "deny"

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::advisory:_unknown_is_allowed_and_RECORDED_as_unknown,_never_as_permit
  Scenario: Advisory mode allows unknown and records it
    Given a policy with no rules
    When "ed" is authorized in advisory mode
    Then it is allowed with authorization "unknown"
    And a finding says "no policy grants perform-task"

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::strict:_unknown,_an_asserted_identity,_or_nobody_refuses
  Scenario: Strict mode refuses unknown, asserted and nobody
    Then in strict mode an unknown verdict, an asserted "ed" with a grant, and no actor are each refused
    And "ed" authenticated by GitHub Actions with a grant is allowed

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::content_access:_a_target-scoped_prohibition_refuses_that_content_only
  Scenario: A target-scoped prohibition refuses that target only
    Given a grant to "ed" and a prohibition on target "block-7"
    Then "ed" on "block-7" is refused with access "deny"
    And "ed" on "block-8" is allowed with access "permit"

  @test:scripts/tests/task-authorization.test.ts::authorizeTask:_the_four_checks::an_undeclared_actor_is_a_finding,_and_an_empty_roles_list_is_unconstrained
  Scenario: Undeclared and role-free actors
    # Gap: the title says an undeclared actor is a finding; the body checks only the assignment "unknown-actor", not the findings list.
    Then an undeclared actor "ghost" has assignment "unknown-actor"
    And actor "any" with no roles has assignment "unconstrained"

  @test:scripts/tests/task-authorization.test.ts::authentication_is_the_executor's,_and_GitHub_is_today's_authenticator::a_GitHub_Actions_run_is_authenticated_by_GitHub;_a_typed_actor_elsewhere_is_asserted
  Scenario: GitHub Actions authenticates; elsewhere a typed actor is asserted
    Then "author" under GITHUB_ACTIONS with GITHUB_ACTOR "octocat" is authenticated by "github" with account "octocat"
    And "author" with GITHUB_ACTOR alone is "asserted"
    And no actor is "none"

  @test:scripts/tests/task-authorization.test.ts::the_interpreter_runs_the_check_before_recording_anything::a_role_mismatch_refuses_and_leaves_the_instance_untouched
  Scenario: A role mismatch refuses and leaves the instance untouched
    Given an instance of "getting-started.bpmn" and its first enabled role-bound activity
    When a declared actor without that role completes it
    Then it throws "REFUSED" and the instance state is unchanged

  @test:scripts/tests/task-authorization.test.ts::the_interpreter_runs_the_check_before_recording_anything::an_allowed_step_carries_its_verdict_in_the_history
  Scenario: An allowed step records its verdict
    Given an instance of "getting-started.bpmn" and its first enabled role-bound activity
    When an actor holding that role completes it
    Then the last history entry is that step, with an allowed, eligible verdict naming the actor

  @test:scripts/tests/task-authorization.test.ts::rbac.ts_asks_ODRL,_and_reproduces_what_the_tier_ladder_allowed::the_gateway_policy_and_actors_are_loaded_(vacuity_guard)
  Scenario: The real gateway policy and actors are loaded
    Then the real access context has a policy ending "/http-gateway"
    And actors "viewer", "collaborator" and "owner"

  @test:scripts/tests/task-authorization.test.ts::rbac.ts_asks_ODRL,_and_reproduces_what_the_tier_ladder_allowed::collaborator_and_owner_may_do_every_gated_action;_viewer_and_nobody_may_do_none
  Scenario: Gated HTTP actions by role header
    Then for content-authoring, review-comments and adjudication, the "collaborator" and "owner" headers are allowed
    And the "viewer" header and no header are refused

  @test:scripts/tests/task-authorization.test.ts::rbac.ts_asks_ODRL,_and_reproduces_what_the_tier_ladder_allowed::nobody_may_still_visualize_and_render_—_the_owner's_floor
  Scenario: Nobody may still visualize and render
    Then a request with no headers is allowed "visualize" and "render"

  @test:scripts/tests/task-authorization.test.ts::rbac.ts_asks_ODRL,_and_reproduces_what_the_tier_ladder_allowed::a_principal_without_gateway_headers_is_unauthenticated
  Scenario: The gateway principal comes from its header
    Then a request with no headers is a null actor, authenticated by "none", tier "viewer"
    And one with "x-user-role: collaborator" is actor "collaborator" authenticated by "http-gateway"
