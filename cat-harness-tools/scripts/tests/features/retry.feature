# A falling-off retry rate, and what must NOT be retried: a definitive answer.
# Each Scenario names the test that executes it.
Feature: Retry with fall-off

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::2xx_is_not_retried_—_there_is_nothing_wrong
  Scenario: A 2xx response is not retried
    When a 200 response is classified
    Then it is not retried

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::5xx_IS_retried_—_the_far_side_is_unwell,_the_question_stands
  Scenario: A 5xx response is retried
    When a 503 response is classified
    Then it is retried

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::404_is_NOT_retried_—_it_is_the_answer
  Scenario: A 404 response is final
    When a 404 response is classified
    Then it is not retried and the reason is "HTTP 404"

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::429_is_retried,_and_`Retry-After`_is_honoured_over_the_doubling
  Scenario: A 429 with Retry-After is retried after the named delay
    When a 429 response with "retry-after: 7" is classified
    Then it is retried with afterMs 7000

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::429_with_no_`Retry-After`_still_retries,_on_the_normal_schedule
  Scenario: A 429 without Retry-After is retried on the normal schedule
    When a 429 response with no headers is classified
    Then the classification is exactly { retry: true }

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::403_is_the_awkward_one_—_it_means_two_different_things::rate_limiting_is_NOT_hammered:_the_reset_outlives_any_backoff
  Scenario: A rate-limited 403 is not retried
    When a 403 response with x-ratelimit-remaining 0 is classified
    Then it is not retried and the reason is "rate limited — the reset is far past any backoff"

  @test:scripts/tests/retry.test.ts::what_is_transient,_and_what_is_an_answer::403_is_the_awkward_one_—_it_means_two_different_things::permission_is_final_—_more_tries_will_not_grant_it
  Scenario: A permission 403 is final
    When a 403 response with rate limit remaining is classified
    Then it is not retried and the reason is "forbidden"

  @test:scripts/tests/retry.test.ts::the_waits_fall_off,_and_are_jittered::each_ideal_wait_doubles_from_the_base
  Scenario: Each ideal wait doubles from the base
    Given a base of 1000 ms, a cap of 16000 ms and jitter at its midpoint
    When the waits for attempts 1 to 4 are computed
    Then they are 1000, 2000, 4000 and 8000 ms

  @test:scripts/tests/retry.test.ts::the_waits_fall_off,_and_are_jittered::the_cap_holds_—_a_long_run_does_not_wait_forever
  Scenario: The wait is capped
    When the wait for attempt 10 is computed with a 16000 ms cap
    Then it is 16000 ms

  @test:scripts/tests/retry.test.ts::the_waits_fall_off,_and_are_jittered::jitter_spreads_the_wait_either_side_of_the_ideal
  Scenario: Jitter spreads the wait either side of the ideal
    When the first wait is computed with the lowest and the highest jitter
    Then it is 500 ms and 1499 ms

  @test:scripts/tests/retry.test.ts::the_loop::a_transient_result_is_retried_up_to_`attempts`,_then_RETURNED_as-is
  Scenario: A transient result is retried up to the attempt limit then returned
    Given an operation that always returns a transient result
    When it runs with backoff over 4 attempts
    Then it is called 4 times and the last value "try-4" is returned, not thrown

  @test:scripts/tests/retry.test.ts::the_loop::a_FINAL_result_returns_on_the_first_attempt
  Scenario: A final result returns on the first attempt
    Given an operation that returns a non-retryable result
    When it runs with backoff
    Then it is called once and its value is returned

  @test:scripts/tests/retry.test.ts::the_loop::a_throw_is_retried,_and_the_LAST_error_escapes
  Scenario: A throw is retried and the last error escapes
    Given an operation that always throws "boom <n>"
    When it runs with backoff over 4 attempts
    Then it rejects with "boom 4" after 4 calls

  @test:scripts/tests/retry.test.ts::the_loop::a_throw_that_then_SUCCEEDS_returns_the_success
  Scenario: A throw followed by success returns the success
    Given an operation that throws twice and then returns "recovered"
    When it runs with backoff
    Then it is called 3 times and returns "recovered"

  @test:scripts/tests/retry.test.ts::the_loop::`onRetry`_is_told_the_attempt,_the_wait_and_why_—_so_a_caller_can_say_what_it_waits_on
  Scenario: onRetry is told the attempt, the wait and why
    Given an always-transient operation over 3 attempts with an onRetry callback
    When it runs with backoff
    Then onRetry is called for attempts 1 and 2 with a positive wait and "transient failure"

  @test:scripts/tests/retry.test.ts::the_loop::`Retry-After`_overrides_the_doubling_when_the_far_side_named_a_delay
  Scenario: A named delay overrides the doubling
    Given an always-transient operation that names afterMs 1234, over 2 attempts
    When it runs with backoff
    Then the only wait slept is 1234 ms
