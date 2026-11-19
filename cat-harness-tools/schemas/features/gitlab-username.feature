# GitLabUsernameSchema in schemas/tools/tool-types.ts: a GitLab account name that is
# safe to pass on the command line. Each Scenario names the test that executes it.
Feature: GitLab username schema

  @test:schemas/gitlab-username.test.ts::GitLabUsername:_a_GitLab_account_name,_safe_on_the_command_line_(4dbr)::GitLab's_shapes_parse,_including_ones_Login_refuses
  Scenario: GitLab's username shapes parse, including ones Login refuses
    Given the usernames "litlfred", "jane.doe", "_bot", "ci_runner-2", "a" and one of 255 characters
    Then each parses as a GitLab username
    And "jane.doe" does not parse as a Login

  @test:schemas/gitlab-username.test.ts::GitLabUsername:_a_GitLab_account_name,_safe_on_the_command_line_(4dbr)::a_flag,_a_shell_payload,_whitespace_or_GitLab's_forbidden_endings_do_not_parse
  Scenario: Flags, shell payloads, whitespace and forbidden endings do not parse
    Given "-rf", "--reviewer", ".hidden", "trailing.", "repo.git", "feed.atom", "a b", "a;rm", "$(x)", "+jane", the empty string and a 256-character name
    Then none parses as a GitLab username

  @test:schemas/gitlab-username.test.ts::GitLabUsername:_a_GitLab_account_name,_safe_on_the_command_line_(4dbr)::it_is_admissible_as_a_command-line_argument
  Scenario: GitLabUsername is admissible as a command-line argument
    When the type "GitLabUsername" is checked for injection safety
    Then it is injection safe
