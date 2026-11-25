# scripts/github-resolve-thread.ts resolves a pull request review thread by calling gh with an argument
# array, refusing any value that is not a review thread id. Each Scenario names the test that executes it.
Feature: github:resolve-thread passes gh an argument array

  @test:scripts/tests/sdlc/github-resolve-thread.test.ts::github:resolve-thread_calls_gh_with_an_argument_array_(4dbr)::the_id_goes_in_as_a_raw_string_field,_the_query_unexpanded
  Scenario: The thread id is a raw string field and the query keeps its variable
    Given the review thread id "PRRT_kwDOAbCdEf4A1b2C3d"
    When the gh argv is built for it
    Then the argv is "api", "graphql", "-f", the resolve mutation as "query=", "-f" and "id=PRRT_kwDOAbCdEf4A1b2C3d"
    And the mutation text still contains the unexpanded "$id"

  @test:scripts/tests/sdlc/github-resolve-thread.test.ts::github:resolve-thread_calls_gh_with_an_argument_array_(4dbr)::a_value_that_is_not_a_review_thread_id_is_refused_before_gh_runs
  Scenario: A value that is not a review thread id is refused
    Given the values "-rf", "$(touch x)", "abc 12345" and "short"
    When the gh argv is built for each
    Then each one throws

  @test:scripts/tests/sdlc/github-resolve-thread.test.ts::github:resolve-thread_calls_gh_with_an_argument_array_(4dbr)::run_as_a_command:_gh_receives_exactly_that_argv;_a_bad_id_never_reaches_it
  Scenario: Run as a command, gh receives exactly the built argv and never a bad id
    Given a fake gh first on PATH that records the arguments it receives
    When the script runs with "PRRT_kwDOAbCdEf4A1b2C3d"
    Then it exits 0 and gh recorded exactly the argv built for that id
    When the script runs with "--hostname=evil"
    Then it exits 2 and gh recorded nothing
