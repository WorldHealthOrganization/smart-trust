# src/core/identity.js: every identity a session can see as a (provider, handle) pair, from
# GitHub, CI and host variables, git and a never-committed user-level store, plus multi-person profiles.
# Each Scenario names the test that executes it.
Feature: Provider-neutral identity resolution

  @test:scripts/tests/identity.test.ts::the_user-level_store::lives_under_XDG_CONFIG_HOME,_else_~/.config;_CAT_HARNESS_USER_CONFIG_overrides
  Scenario: The user store path follows XDG_CONFIG_HOME, else ~/.config, unless overridden
    When the user config path is computed for home "/h"
    Then with no variables it is "/h/.config/cat-harness/identity.json"
    And with XDG_CONFIG_HOME "/x" it is "/x/cat-harness/identity.json"
    And with CAT_HARNESS_USER_CONFIG "/p.json" it is "/p.json" even when XDG_CONFIG_HOME is set

  @test:scripts/tests/identity.test.ts::the_user-level_store::absent,_ok_and_unreadable_are_three_answers_—_unreadable_is_never_read_as_empty
  Scenario: The user store reads as absent, unreadable or ok, never unreadable as empty
    Given a temporary home directory
    Then with no identity file the store state is "absent"
    And with a file that is not JSON the state is "unreadable"
    And with an identity missing its handle the state is "unreadable"
    And with a gitlab identity "ann" and interaction profile "low-dexterity" the state is "ok" with that interaction config

  @test:scripts/tests/identity.test.ts::resolveIdentities::no_token,_no_forge:_the_git_author_and_a_declared_identity_still_answer_—_not_'could_not_determine'
  Scenario: Without a token or forge the declared identity and git author still answer
    Given a user store declaring gitlab handle "ann"
    And git reporting user.email "ann@example.org"
    And no environment variables
    When identities are resolved
    Then they are "gitlab:ann" then "git:ann@example.org"
    And none of them is vouched
    And there is a note starting "github:"

  @test:scripts/tests/identity.test.ts::resolveIdentities::GitHub_first_and_vouched,_through_the_auth_Tool's_own_resolver
  Scenario: A GitHub token yields a vouched GitHub identity first
    Given GH_TOKEN is set and GitHub's /user endpoint answers login "octo"
    When identities are resolved
    Then the first identity is provider "github", handle "octo", via "token", vouched
    And the GitHub result's login is "octo"

  @test:scripts/tests/identity.test.ts::resolveIdentities::GitLab_CI's_pipeline_user_and_the_agent_host's_account_are_providers_too
  Scenario: GitLab CI's pipeline user and Claude Code's account are identities
    Given GITLAB_CI "true", GITLAB_USER_LOGIN "ann" and CLAUDE_CODE_USER_EMAIL "ann@example.org"
    When identities are resolved
    Then they are "gitlab:ann" then "claude:ann@example.org"
    And with GITLAB_USER_LOGIN set outside GitLab CI there are no identities

  @test:scripts/tests/identity.test.ts::resolveIdentities::the_same_pair_from_two_sources_is_one_identity,_the_stronger_kept
  Scenario: The same pair from two sources is one identity, the vouched one kept
    Given a user store declaring github handle "octo"
    And GH_TOKEN with GitHub answering login "octo"
    When identities are resolved
    Then there is exactly one identity
    And it is vouched

  @test:scripts/tests/identity.test.ts::resolveIdentities::an_unreadable_user_store_is_a_note,_not_a_silent_nothing
  Scenario: An unreadable user store produces a note
    Given a user store whose content is a JSON array
    When identities are resolved
    Then the user config state is "unreadable"
    And a note says it is "not a JSON object"

  @test:scripts/tests/identity.test.ts::resolveIdentities::several_accounts_per_provider_for_one_person:_map_form_(string_|_string[])_and_array_form_with_active_flag
  Scenario: Several accounts per provider are kept, in map form and array form with an active flag
    Given a user store mapping github to two handles, claude to two emails and gitlab to one handle
    When identities are resolved
    Then they are the github, claude and gitlab accounts in declared order
    And the match keys include each handle bare and as provider:handle
    And normalizing an array where "primary-gh" and "team-gh" are active and "secondary-gh" is not puts the active handles first while keeping all three

  @test:scripts/tests/identity.test.ts::resolveIdentities::several_people_on_one_machine:_explicit_CAT_HARNESS_PROFILE_/_CAT_HARNESS_PERSON_selects_that_person's_profile,_while_ambiguous_multi-user_falls_back_to_strictest_profile
  Scenario: An explicit profile or person selects one person; with several people and no selector the strictest profile applies
    Given a user store with profiles "bob" with no interaction profiles and "alice" with "low-dexterity"
    When identities are resolved with no selector
    Then the multi-user status and interaction status are "ambiguous-multi-user"
    And the interaction profiles are "low-dexterity"
    And a note mentions "ambiguous-multi-user"
    And with CAT_HARNESS_PROFILE "bob" the status is "selected", the active profile is bob, the identities are bob's two and the interaction profiles are empty
    And with CAT_HARNESS_PERSON "github:alice-alt" the active profile is alice, all three of alice's accounts resolve with alice-alt first, and the profiles are "low-dexterity"

  @test:scripts/tests/identity.test.ts::resolveIdentities::several_people_in_one_session_matching_repo_interaction.json_users:_detects_ambiguity_and_falls_back_to_strictest_profile_unless_disambiguated
  Scenario: A session naming several repo interaction users is ambiguous unless a profile disambiguates it
    Given repo interaction users bob with no profiles and alice with "low-dexterity", each with an alias
    And CAT_HARNESS_PERSON naming both aliases
    When identities are resolved
    Then the status is "ambiguous-multi-user" with matched users bob and alice
    And the interaction profiles are "low-dexterity"
    And with CAT_HARNESS_PROFILE "bob" also set the status is "selected", the active profile is bob and the profiles are empty

  @test:scripts/tests/identity.test.ts::match_keys:_each_handle_bare_(interaction.json's_key_form)_and_as_provider:handle
  Scenario: Match keys give each handle bare and as provider:handle
    Given the identity gitlab handle "ann"
    When its match keys are computed
    Then they are "ann" and "gitlab:ann"

  @test:scripts/tests/identity.test.ts::several_people,_several_accounts,_several_hosts::CAT_HARNESS_PERSON_names_who_is_typing_this_session,_self-asserted,_before_the_store
  Scenario: CAT_HARNESS_PERSON names the person typing, self-asserted, before the store
    Given a user store declaring gitlab handle "ann"
    And CAT_HARNESS_PERSON "gitlab:bob, nope"
    When identities are resolved
    Then they are "gitlab:bob" then "gitlab:ann"
    And the first is via "CAT_HARNESS_PERSON" and not vouched
    And a note says "`nope` is not provider:handle"

  @test:scripts/tests/identity.test.ts::several_people,_several_accounts,_several_hosts::several_accounts_on_one_provider_are_each_a_match_key
  Scenario: Several accounts on one provider are each a match key
    Given a user store declaring gitlab handles "ann" and "ann-work"
    When identities are resolved and their match keys computed
    Then the keys include "gitlab:ann", "gitlab:ann-work", "ann" and "ann-work"

  @test:scripts/tests/identity.test.ts::several_people,_several_accounts,_several_hosts::a_host_that_passes_no_account_is_reported,_with_a_note_saying_where_the_person_comes_from_instead
  Scenario: A host that passes no account is reported with a note
    Given GEMINI_CLI is set
    When identities are resolved
    Then the hosts are the Gemini CLI host, marker "GEMINI_CLI", exposing no identity
    And a note starts "gemini-cli: the host passes no account"

  @test:scripts/tests/identity.test.ts::several_people,_several_accounts,_several_hosts::Claude_Code's_account_is_read_and_its_host_gets_no_'no_account'_note
  Scenario: Claude Code's account is read with no "no account" note
    Given CLAUDECODE is set and CLAUDE_CODE_USER_EMAIL is "ann@example.org"
    When identities are resolved
    Then the only host is "claude-code"
    And the identities include "claude:ann@example.org"
    And no note starts "claude-code:"
