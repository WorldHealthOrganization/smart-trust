Feature: telling a pipeline that failed to run from one that found something

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::nonZeroNoStdoutFailed
  Scenario: non-zero exit with NO stdout is a failure to run
    When the pipeline exits 1 with no output
    Then it failed to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::nonZeroWithFindingsNormal
  Scenario: non-zero exit WITH findings on stdout is a normal outcome
    When the pipeline exits 1 with findings on stdout
    Then it did not fail to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::cleanRunNotFailure
  Scenario: a clean run is not a failure
    When the pipeline exits 0 with output
    Then it did not fail to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::spawnErrorFailed
  Scenario: spawn error (no `bun` on PATH) is a failure to run
    When the pipeline could not be spawned
    Then it failed to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::killedFailed
  Scenario: killed by signal / timeout is a failure to run, even with partial stdout
    When the pipeline is killed by a signal after partial output
    Then it failed to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::pipelineFailedToRun::silentCleanRunNotFailure
  Scenario: a clean run that printed nothing is NOT a failure
    When the pipeline exits 0 with no output
    Then it did not fail to run

  @test:scripts/tests/validate-pipeline-guard.test.ts::resolveValidateScript::findsValidatePipeline
  Scenario: finds a pipeline — here, the platform's own copy
    When the validate script is resolved
    Then it is an existing pipeline/validate.ts
