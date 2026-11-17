# The engine is strict (issue #1207, bean n2l9). Each Scenario names the test
# that executes it.
Feature: Strict task authorization

  @test:scripts/tests/task-authorization-strict.test.ts::strict:_who_may_perform_which_task::owner_and_collaborator_may_perform_every_task;_viewer_and_nobody_none
  Scenario: Owner and collaborator may perform every step; viewer and nobody none
    Given every activity and exclusive gateway of every harness process diagram, more than 100 of them
    When each is authorized in strict mode for a GitHub-authenticated actor
    Then none is refused for "owner" or "collaborator"
    And every one is refused for "viewer" and for no actor

  @test:scripts/tests/task-authorization-strict.test.ts::strict:_who_may_perform_which_task::a_typed_actor_is_refused_in_strict_mode,_even_one_policy_would_permit
  Scenario: A typed actor is refused in strict mode
    Given the principal typed as "collaborator" from the environment
    Then it is authenticated by "asserted"
    And the first step is refused for it in strict mode

  @test:scripts/tests/task-authorization-strict.test.ts::the_engine's_principal_is_the_one_GitHub_vouches_for::a_collaborator's_token_yields_the_collaborator_actor,_with_the_login_as_account
  Scenario: A collaborator's token yields the collaborator actor
    Given a fake GitHub saying the user is "octo" with push permission on a public user repository
    When the principal is resolved from a token
    Then it is actor "collaborator", authenticated by "github", account "octo"

  @test:scripts/tests/task-authorization-strict.test.ts::the_engine's_principal_is_the_one_GitHub_vouches_for::no_credential_yields_nobody,_which_strict_refuses
  Scenario: No credential yields nobody
    # Gap: the title says strict refuses it; the body checks only the principal, not an authorization.
    When the principal is resolved with no token
    Then it is a null actor authenticated by "none"
