Feature: the QA tools and their pipeline helper

  @test:scripts/tests/qa-tools.test.ts::_pipeline_helper::pipelineScriptPathAppendsTs
  Scenario: pipelineScriptPath names a folio path and appends .ts
    When pipeline script paths are named
    Then they are under content/pipeline/ with .ts appended once

  @test:scripts/tests/qa-tools.test.ts::_pipeline_helper::deprecationContract
  Scenario: pipelineScriptPath vs resolvePipelineScript: the deprecation contract
    When a path is named, resolved and run for a script that does not exist
    Then the named path is still given
    And resolving gives undefined and running fails saying it was not found

  @test:scripts/tests/qa-tools.test.ts::_pipeline_helper::tryParseJsonAfterBanner
  Scenario: tryParseJson extracts JSON after a banner, else undefined
    When output is parsed as JSON
    Then JSON after a banner and an array are read, and text without JSON or empty gives undefined

  @test:scripts/tests/qa-tools.test.ts::_pipeline_helper::runPipelineStructuredError
  Scenario: runPipeline returns a structured error for a missing script (never throws)
    When a missing script is run with --json
    Then it is not ok, says not found and has no JSON

  @test:scripts/tests/qa-tools.test.ts::_pipeline_helper::asToolTextRenders
  Scenario: asToolText renders error and JSON results as MCP text content
    When an error result and a JSON result are rendered as tool text
    Then the error text and a JSON code block are text content

  @test:scripts/tests/qa-tools.test.ts::registerQaTools::registersMechanicalTools
  Scenario: registers the expected mechanical tools with handlers
    When the document and paper QA tools are registered
    Then each expected tool has a handler and a description longer than 10 characters

  @test:scripts/tests/qa-tools.test.ts::registerQaTools::paperOnlyNotInDocument
  Scenario: the paper-only QA tools are NOT in the document half
    When the document QA tools are registered
    Then proof_status and latex_preflight are not among them, and the shared tools are

  @test:scripts/tests/qa-tools.test.ts::registerQaTools::glossaryCheckGraceful
  Scenario: glossary_check returns a graceful message when no paper resolves
    When glossary_check runs with no paper
    Then it answers with text that mentions the paper
