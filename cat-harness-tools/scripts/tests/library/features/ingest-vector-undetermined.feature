# A vector arm's "undetermined" is an answer; a helper that cannot run is not
# (bean turh). Each Scenario names the test that executes it.
Feature: A vector step's recorded "undetermined" does not stop an ingest

  @test:scripts/tests/library/ingest-vector-undetermined.test.ts::recordedUndetermined::exit_2_with_a_sidecar_written_by_THIS_step_is_a_recorded_answer
  Scenario: Exit 2 with a sidecar written by this step is a recorded answer
    Given a vector-labels step whose output directory holds a vector-labels.json written after the step started
    When the step exits with code 2
    Then the recorded answer is the path of that sidecar

  @test:scripts/tests/library/ingest-vector-undetermined.test.ts::recordedUndetermined::exit_2_with_no_fresh_sidecar_—_a_helper_that_never_ran_—_still_stops
  Scenario: Exit 2 with only a stale sidecar still stops the ingest
    Given a vector-labels step whose vector-labels.json was last modified an hour before the step started
    When the step exits with code 2
    Then no recorded answer is returned

  @test:scripts/tests/library/ingest-vector-undetermined.test.ts::recordedUndetermined::another_exit_code,_or_another_step,_is_never_excused
  Scenario: Another exit code or another step is never excused
    Given a fresh vector-labels.json sidecar
    When the vector-labels step exits with code 1
    And, separately, a pdf-images step exits with code 2
    Then neither returns a recorded answer
