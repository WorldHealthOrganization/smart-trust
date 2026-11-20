# The upload URL is composed from the declaration, and every failure is named.
# Each Scenario names the test that executes it.
Feature: Upload URL

  @test:scripts/tests/upload-url.test.ts::the_queue_path_is_REPOSITORY-relative,_not_instance-relative::it_carries_the_instance_segment
  Scenario: The harness's queue path carries the layer segment
    When the harness's upload queue path is taken relative to its repository
    Then it is defined, contains "/", and ends with "uploads"

  @test:scripts/tests/upload-url.test.ts::the_queue_path_is_REPOSITORY-relative,_not_instance-relative::it_is_NOT_the_bare_declared_path
  Scenario: The queue path is not the bare declared path
    Then the harness's repository-relative queue path is not "uploads"

  @test:scripts/tests/upload-url.test.ts::the_queue_path_is_REPOSITORY-relative,_not_instance-relative::it_resolves_to_a_directory_that_exists
  Scenario: The queue path exists
    Then the queue path resolved against the repository root exists

  @test:scripts/tests/upload-url.test.ts::the_queue_path_is_REPOSITORY-relative,_not_instance-relative::it_uses_POSIX_separators,_because_it_becomes_a_URL
  Scenario: The queue path uses POSIX separators
    Then the queue path contains no backslash

  @test:scripts/tests/upload-url.test.ts::the_URL::is_the_/upload/<branch>/<repo-relative_path>_form
  Scenario: The URL is /upload/<branch>/<path>
    Given a throwaway repository with origin "https://github.com/example/demo.git" and a layer "inst" declaring "uploads/"
    When its upload URL for "main" is composed
    Then it contains "/upload/main/" and ends with the repository-relative path

  @test:scripts/tests/upload-url.test.ts::the_URL::honours_a_branch_other_than_main
  Scenario: The URL honours another branch
    When the fixture's upload URL for "some-branch" is composed
    Then it contains "/upload/some-branch/"

  @test:scripts/tests/upload-url.test.ts::the_URL::carries_no_`.git`_suffix_from_the_remote
  Scenario: The URL drops the remote's .git suffix
    When the fixture's upload URL for "main" is composed
    Then it does not contain ".git/upload/"

  @test:scripts/tests/upload-url.test.ts::a_failure_is_NAMED,_never_a_guessed_URL::no_declaration_reports_the_reason_and_a_remedy
  Scenario: No declaration gives a reason and a remedy
    When the upload URL of "/tmp" is composed
    Then it fails with a non-empty reason and remedy

  @test:scripts/tests/upload-url.test.ts::a_failure_is_NAMED,_never_a_guessed_URL::the_failure_path_returns_no_url_field_at_all
  Scenario: A failure has no url field
    When the upload URL of "/tmp" is composed
    Then the result has no "url" field
