Feature: The IG API in the AST cache commit

  @test:scripts/ig-api-cache.test.ts::the_IG_API_for_the_AST_cache_commit::copiesTheStepsIgApiOnly
  Scenario: only the step's sidecars, site files and descriptor are copied
    Given a work directory where the step left no sidecars, then one sidecar and a stray file
    Then nothing is copied for the first, and the sidecar but not the stray file for the second

  @test:scripts/ig-api-cache.test.ts::the_IG_API_for_the_AST_cache_commit::runsTheLayerProvidedStep
  Scenario: the step a layer above provides is run over the checkout's AST
    Given a checkout whose script table provides ig-site:sidecars
    When the IG API is generated for the cache
    Then its sidecars, site files and descriptor are written, and nothing else

  @test:scripts/ig-api-cache.test.ts::the_IG_API_for_the_AST_cache_commit::noStepOrAFailedStepWritesNothing
  Scenario: no step, or a failed one, writes nothing
    Then a checkout with no step says so, and a failed step is an error with nothing written

  @test:scripts/ig-api-cache.test.ts::the_IG_API_for_the_AST_cache_commit::seedCommitsTheIgApiAndRestoreLaysItDown
  Scenario: the seed commits the IG API beside the AST, and a restore lays it down
    Given an IG checkout with an AST, the step, and a bare remote
    When ig-cache.sh seed --push runs
    Then the cache commit holds ig-api/sidecars, ig-api/site and ig-api/ig-api.json beside the AST
    And a restore into a fresh checkout puts them under output-ast/ig-api
    And the cache commit holds fhir-artifact-index/index.json, binding the sidecar at ig-api/sidecars/
    And a restore lays the index down under output-ast/fhir-artifact-index
    And with IG_CACHE_IG_API=0 and IG_CACHE_INDEX=0 the seed holds the AST alone
