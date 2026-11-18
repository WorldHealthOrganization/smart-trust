# The user authN/authZ Tool (issue #1207): GitHub says who the caller is and
# what role they hold on the whole repository; ODRL says what that allows.
# GitHub is faked. Each Scenario names the test that executes it.
Feature: User authentication through GitHub

  @test:scripts/tests/user-auth.test.ts::githubIdentity:_three_answers,_never_two::a_person's_token:_login_from_/user,_role_from_the_repository's_own_permissions_block
  Scenario: A person's token gives login and role
    Given a fake GitHub answering /user with "octo" and the repository with push but not admin or maintain
    When the identity is resolved from GH_TOKEN
    Then it is authenticated as "octo" with role "write" via "token"
    And no collaborators endpoint was called

  @test:scripts/tests/user-auth.test.ts::githubIdentity:_three_answers,_never_two::an_Actions_job_asks_about_the_ACTOR_by_name,_not_about_the_workflow's_token
  Scenario: An Actions job asks about the actor
    Given a fake GitHub answering the collaborator permission of "octo" with "maintain"
    When the identity is resolved inside GitHub Actions with GITHUB_ACTOR "octo"
    Then it is authenticated as "octo" with role "maintain" via "actions"
    And /user was not called

  @test:scripts/tests/user-auth.test.ts::githubIdentity:_three_answers,_never_two::no_credential_is_unauthenticated;_a_rejected_token_is_unauthenticated;_a_failure_is_unknown
  Scenario: Unauthenticated and unknown are told apart
    Then with no credential the status is "unauthenticated"
    And with a token /user rejects with 401 it is "unauthenticated"
    And with a fetch that throws it is "unknown"

  @test:scripts/tests/user-auth.test.ts::githubIdentity:_three_answers,_never_two::a_role_that_cannot_be_read_leaves_the_role_unknown_rather_than_guessing_one
  Scenario: An unreadable role stays unknown
    Given /user answers "octo" and the repository answers 403
    Then the identity is authenticated with no role
    And its principal has a null actor

  @test:scripts/tests/user-auth.test.ts::a_GitHub_role_maps_onto_the_gateway_actors_the_policies_already_grant::every_mapped_actor_is_declared_(vacuity_guard:_the_map_is_not_empty)
  Scenario: Every mapped actor is declared
    Then the GitHub role map has at least one actor and each is declared in the harness's access context

  @test:scripts/tests/user-auth.test.ts::a_GitHub_role_maps_onto_the_gateway_actors_the_policies_already_grant::write_may_author_content,_read_may_not,_none_is_nobody
  Scenario: Write may author content, read may not, none is nobody
    Then role "write" is the "collaborator" actor authenticated by "github" with the login as account
    And role "none" is a null actor
    And whoami for "content-authoring" says permit for write and unknown for read

  @test:scripts/tests/user-auth.test.ts::the_answer_always_says_what_GitHub_cannot_express::whole_repository,_never_a_sub-graph,_node_or_query_path
  Scenario: The answer says GitHub's grain is the whole repository
    When whoami answers an unauthenticated caller
    Then it has the heading "What GitHub cannot express" and the grain note
    And the grain note for a write role says "as a whole: every sub-graph, node and query path"

  @test:scripts/tests/user-auth.test.ts::the_answer_always_says_what_GitHub_cannot_express::a_claimed_actor_is_reported_as_claimed_—_GitHub_vouched_for_the_login,_not_the_actor
  Scenario: A claimed actor is reported as claimed
    When whoami answers a write caller claiming actor "author"
    Then it says "GitHub vouched for the login, not for this actor"

  @test:scripts/tests/user-auth.test.ts::repoSlug_reads_GITHUB_REPOSITORY_first,_then_a_GitHub_remote
  Scenario: The repository slug
    Then GITHUB_REPOSITORY "a/b" wins over a remote
    And an SSH GitHub remote gives "c/d"
    And a non-GitHub remote gives none

  @test:scripts/tests/user-auth.test.ts::personal-account_levels_are_the_mapping_(owner,_2026-09-24)::the_repository's_owner_type_is_read,_and_the_answer_names_the_personal-account_levels
  Scenario: A personal-account repository is named
    Given the repository is owned by a User, public, with push
    Then the identity has role "write", owner type "User", visibility "public"
    And whoami says "Personal-account repository (public)"

  @test:scripts/tests/user-auth.test.ts::personal-account_levels_are_the_mapping_(owner,_2026-09-24)::every_personal-account_level_maps_to_a_declared_actor_or_to_nobody
  Scenario: Every personal-account level maps to a declared actor or nobody
    Then there are 4 personal-account levels
    And each one's actor is the role map's, and a non-null actor is declared

  @test:scripts/tests/user-auth.test.ts::whoami_lists_the_other_identities,_and_never_authorizes_on_them_(bean_f1e1)::the_GitHub_login_is_not_repeated;_the_others_are_labelled_vouched_or_self-asserted
  Scenario: Other identities are listed and labelled
    When whoami answers with GitHub, Claude and git identities
    Then it lists "Also seen (for preferences only, never for permissions)"
    And the Claude identity is labelled vouched and the git one self-asserted
    And the GitHub login is not listed again

  @test:scripts/tests/user-auth.test.ts::whoami_lists_the_other_identities,_and_never_authorizes_on_them_(bean_f1e1)::an_unauthenticated_caller_with_a_self-asserted_identity_is_still_nobody_for_permissions
  Scenario: A self-asserted identity does not authorize
    When whoami answers an unauthenticated caller with a git identity
    Then it says "Nobody:" and still lists the git identity

  @test:scripts/tests/user-auth.test.ts::whoami_lists_the_other_identities,_and_never_authorizes_on_them_(bean_f1e1)::no_others,_no_line_—_the_old_answer_is_unchanged
  Scenario: No other identities, no line
    When whoami answers with no other identities
    Then it does not say "Also seen"
