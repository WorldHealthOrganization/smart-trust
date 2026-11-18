Feature: The IG's artefact index in the AST cache commit

  @test:scripts/ig-index-cache.test.ts::the_artefact_index_for_the_AST_cache_commit::indexPathsAreTreePaths
  Scenario: the index's paths are paths in the cache commit's tree
    Given a cache tree holding an AST, its IG API, and an index restored from an older commit
    When the index is built for the cache
    Then the resource is at resources/..., the sidecar at ig-api/sidecars/..., and no sidecar base is written

  @test:scripts/ig-index-cache.test.ts::the_artefact_index_for_the_AST_cache_commit::argsFollowTheSiteBuild
  Scenario: the index is built with the site build's flags
    Then the instance id and the tree are passed, and an index the IG still commits gives the grouping

  @test:scripts/ig-index-cache.test.ts::the_artefact_index_for_the_AST_cache_commit::noAstWritesNothing
  Scenario: a tree with no AST writes no index
    Then the run is an error and no fhir-artifact-index directory is left
