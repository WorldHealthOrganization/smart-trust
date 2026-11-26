# ReviewThreadIdSchema in schemas/tools/tool-types.ts, a forge's review-thread id that is safe to pass on the command line.
# Each Scenario names the test that executes it.
Feature: A review-thread id safe on the command line

  @test:schemas/review-thread-id.test.ts::ReviewThreadId:_a_forge's_review-thread_id,_safe_on_the_command_line_(4dbr)::both_forges'_shapes_parse
  Scenario: GitHub and GitLab review-thread ids parse
    Given a GitHub review-thread node id starting "PRRT_"
    And a 40-hex GitLab discussion id, an 8-character prefix of one, and a numeric GitLab note id
    When each is parsed as a review-thread id
    Then every one parses

  @test:schemas/review-thread-id.test.ts::ReviewThreadId:_a_forge's_review-thread_id,_safe_on_the_command_line_(4dbr)::a_flag,_a_shell_payload,_whitespace_or_a_too-short_prefix_does_not_parse
  Scenario: A flag, a shell payload, whitespace or a too-short id does not parse
    Given the values "-rf", "--help-me-now", "abc1234;rm", "$(touch x)", "abc 12345", a backtick payload, "abc123", the empty string and a 129-character string
    When each is parsed as a review-thread id
    Then none parses

  @test:schemas/review-thread-id.test.ts::ReviewThreadId:_a_forge's_review-thread_id,_safe_on_the_command_line_(4dbr)::it_is_admissible_as_a_command-line_argument
  Scenario: A review-thread id is admissible as a command-line argument
    When "ReviewThreadId" is checked for injection safety
    Then it is safe
