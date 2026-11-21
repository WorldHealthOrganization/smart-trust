# The mutating routes /api/git/checkout (src/routes/branches.ts) and /api/chat (src/routes/chat.ts)
# refuse a non-JSON body, an unpermitted caller and bad input, and accept a permitted one. Each Scenario names the test that executes it.
Feature: Mutating routes refuse what they used to accept

  @test:src/core/tests/mutating-routes.test.ts::/api/git/checkout::refuses_a_text/plain_body_and_leaves_untracked_files_alone
  Scenario: Checkout refuses a text/plain body and leaves untracked files alone
    Given a git repository on "main" with a branch "other" and an untracked file "precious.txt"
    When a collaborator posts a discard checkout of "other" with content-type "text/plain"
    Then the response status is 415
    And "precious.txt" still exists

  @test:src/core/tests/mutating-routes.test.ts::/api/git/checkout::refuses_a_caller_with_no_permission
  Scenario: Checkout refuses a caller with no permission
    Given a git repository on "main" with a branch "other" and an untracked file "precious.txt"
    When an anonymous caller and a viewer each post a JSON discard checkout of "other"
    Then each response status is 403
    And "precious.txt" still exists

  @test:src/core/tests/mutating-routes.test.ts::/api/git/checkout::refuses_a_branch_that_git_would_read_as_an_option
  Scenario: Checkout refuses a branch that git would read as an option
    Given a git repository on "main"
    When a collaborator posts a checkout of the branch "--orphan=x"
    Then the response status is 400
    And the current branch is still "main"

  @test:src/core/tests/mutating-routes.test.ts::/api/git/checkout::switches_for_a_collaborator,_with_no_wildcard_CORS
  Scenario: Checkout switches branch for a collaborator, with no wildcard CORS
    Given a git repository on "main" with a branch "other"
    When a collaborator posts a stash checkout of "other"
    Then the response status is 200
    And the response has no access-control-allow-origin header
    And the current branch is "other"

  @test:src/core/tests/mutating-routes.test.ts::/api/chat::refuses_an_anonymous_caller_and_a_viewer
  Scenario: Chat refuses an anonymous caller and a viewer
    Given no Anthropic API key is set
    When an anonymous caller and a viewer each post a read-mode chat
    Then each response status is 403
    And no response has an access-control-allow-origin header

  @test:src/core/tests/mutating-routes.test.ts::/api/chat::refuses_a_text/plain_body
  Scenario: Chat refuses a text/plain body
    Given no Anthropic API key is set
    When a collaborator posts a read-mode chat with content-type "text/plain"
    Then the response status is 415

  @test:src/core/tests/mutating-routes.test.ts::/api/chat::gates_edit_mode_on_content-authoring_and_refuses_an_unknown_mode
  Scenario: Chat gates edit mode on content-authoring and refuses an unknown mode
    Given no Anthropic API key is set
    And the actor "reviewer", who holds review-comments but not content-authoring
    When the reviewer posts a read-mode chat
    Then it passes every check and reaches the missing-key 503
    And a reviewer's edit-mode chat is refused with 403
    And a collaborator's chat in the mode "nonsense" is refused with 400

  @test:src/core/tests/mutating-routes.test.ts::/api/chat::lets_a_collaborator_through_in_read_and_edit_mode
  Scenario: Chat lets a collaborator through in read and edit mode
    Given no Anthropic API key is set
    When a collaborator posts a chat in read mode and in edit mode
    Then each passes every check and reaches the missing-key 503
    And no response has an access-control-allow-origin header
