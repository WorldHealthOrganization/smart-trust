# scripts/ci-job-shape.ts (`ci:job-shape`) reports, per workflow and job, the median runner wait and run time
# of recent completed runs, and flags jobs that wait longer than they run and chains of short serial jobs.
# Each Scenario names the test that executes it.
Feature: CI job shape report

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::a_matrix's_shards_are_one_job,_and_skipped_or_never-started_jobs_are_left_out
  Scenario: Shards collapse into one job and jobs that took no runner are left out
    Given job names "checks / head — tests and gates, shard 3/4" and "bun test (head, 2/4)"
    Then their keys replace the shard number with "*"
    And the median of 5, 1 and 3 is 3, of 4, 1, 3 and 2 is 2.5, and of nothing is 0
    And a skipped job and a job that never started give no sample

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::run_43493373385's_shape:_every_job_waited_longer_than_it_ran;_its_short_jobs_never_ran_three_in_a_row
  Scenario: The shape of folio-assistant-core run 43493373385 flags every job for waiting longer than it ran
    Given three runs shaped like run 43493373385
    When the workflow's shape is computed
    Then all five jobs are flagged "queue-exceeds-run", the lock job first with "median queue 9m29s, run 9s"
    And no short serial chain is flagged, because prepare-head runs between the summary and the short jobs before it

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::a_chain_of_more_than_2_short_serial_jobs_is_flagged_when_it_is_in_half_the_runs_or_more
  Scenario: A chain of more than two short serial jobs is flagged when it is the workflow's usual shape
    Given runs in which jobs "a", "b" and "c" each run 10 seconds, each created when the one before completed
    When two of three runs have that chain
    Then "short-serial-chain: a → b → c (2 of 3 runs)" is flagged
    And when only one of three runs has it, it is reported but not flagged
    And a job that runs a minute or more breaks the chain

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::after_the_collapse_the_same_workflow_is_one_job,_and_nothing_is_flagged_when_it_runs_longer_than_it_waits
  Scenario: After the collapse the workflow is one job
    Given runs of a single job
    Then the shape has one job
    And a job that runs longer than it waits flags nothing

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::it_reads_runs_and_their_jobs_through_the_API,_groups_them_by_workflow,_and_prints_JSON
  Scenario: The report reads the Actions API, groups by workflow and prints JSON
    Given a stub API with two "PR checks" runs and one "Nightly" run
    When the report runs for "o/r" with event "pull_request"
    Then it asks for "repos/o/r/actions/runs?status=completed&per_page=20&event=pull_request" and each run's jobs
    And "PR checks" has 2 runs and flags, "Nightly" 1 run and none
    And the exit code is 1
    And "--json" prints the reports with each job's "medianQueueSeconds"

  @test:scripts/tests/sdlc/ci-job-shape.test.ts::ci:job-shape::what_cannot_be_read_is_exit_2,_never_a_pass;_a_bad_argument_is_refused
  Scenario: What cannot be read is exit 2 and bad arguments are refused
    Given an API that refuses the runs request
    Then the report lists it as unread and the exit code is 2
    And a jobs request that fails is listed as unread
    And "--repo not a repo" and a "--runs" without a value are refused
    And a report with nothing flagged and nothing unread exits 0
