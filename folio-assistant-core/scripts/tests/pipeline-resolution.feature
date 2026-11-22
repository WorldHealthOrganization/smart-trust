Feature: finding a pipeline script

  @test:scripts/tests/pipeline-resolution.test.ts::resolvePipelineScript::findsPlatformScript
  Scenario: finds a script the platform carries
    When qa-sweep is resolved
    Then it is an existing qa-sweep.ts

  @test:scripts/tests/pipeline-resolution.test.ts::resolvePipelineScript::nameWithOrWithoutTs
  Scenario: accepts a name with or without the .ts suffix
    When qa-sweep and qa-sweep.ts are resolved
    Then they give the same path

  @test:scripts/tests/pipeline-resolution.test.ts::resolvePipelineScript::findsContentLayerScript
  Scenario: finds a script the CONTENT LAYER carries, not the platform
    When build-glossary is resolved
    Then it is an existing build-glossary.ts in folio-assistant-core

  @test:scripts/tests/pipeline-resolution.test.ts::resolvePipelineScript::nobodyHasUndefined
  Scenario: returns undefined — not a bogus path — for a script nobody has
    When a script nobody has is resolved
    Then the result is undefined

  @test:scripts/tests/pipeline-resolution.test.ts::runPipeline_on_a_missing_script::missingReportsAbsence
  Scenario: reports absence explicitly, and never as a successful run
    When a script nobody has is run
    Then it is not ok, and its error names the folio, the platform and folio-assistant-core/scripts/

  @test:scripts/tests/pipeline-resolution.test.ts::content_validate_shares_the_resolver::validateSharesResolver
  Scenario: resolveValidateScript agrees with resolvePipelineScript('validate')
    When the validate script is resolved both ways
    Then they agree
