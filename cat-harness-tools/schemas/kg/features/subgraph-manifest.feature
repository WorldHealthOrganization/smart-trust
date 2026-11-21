# Specifies schemas/kg/subgraph-manifest.ts (bean mo75 G2, G2b):
# publishedSubgraphDir, subgraphIndexPackage and the subgraph index manifest.
Feature: An instance publishes each subgraph at a computed place, and indexes them in a pinned package

  @test:schemas/kg/subgraph-manifest.test.ts::publishedSubgraphDir::is_<docs>/subgraph/<HARNESS>/<PATH>,_with_no_trailing_slash
  Scenario: A subgraph publishes under docs/subgraph/<harness>/<path>
    When the published directory of "tools/" in cat-harness under "docs/" is computed
    Then it is "docs/subgraph/cat-harness/tools"
    And for "skills/sdlc" in h under "./site/docs" it is "site/docs/subgraph/h/skills/sdlc"

  @test:schemas/kg/subgraph-manifest.test.ts::publishedSubgraphDir::refuses_the_root_(the_f233_monolith)_and_a_climbing_path
  Scenario: The root and a climbing path are refused
    When the published directory is computed for "" or "."
    Then it throws an error mentioning the root
    And for "a/../b" it throws an error saying the path climbs

  @test:schemas/kg/subgraph-manifest.test.ts::the_subgraph_index_package_(bean_`mo75`_G2b)::every_name_is_computed_from_repository,_pin_and_harness
  Scenario: The index package's names are computed from repository, pin and harness
    When the index package of litlfred/cat-harness at a 40-character pin for cat-harness is computed
    Then its name is "cat-harness-subgraph-index" and its version "0.0.0-pin.<pin>"
    And its tag is "subgraph-index-<pin>"
    And its tarball, release record and their GitHub release download URLs are derived from those

  @test:schemas/kg/subgraph-manifest.test.ts::the_subgraph_index_package_(bean_`mo75`_G2b)::a_branch_or_a_short_SHA_is_not_a_pin
  Scenario: A branch or a short SHA is not a pin
    When the index package is computed for "main" or a 12-character SHA
    Then each throws an error mentioning the pin

  @test:schemas/kg/subgraph-manifest.test.ts::the_subgraph_index_package_(bean_`mo75`_G2b)::the_manifest_holds_each_file_where_its_subgraph_publishes_it,_and_never_a_hydrated_root
  Scenario: The manifest lists each file at its subgraph's published place, never a hydrated root
    Given a manifest listing the root index.jsonld and tools' index.hydrated.jsonld at their published paths
    Then it parses
    And a manifest listing a hydrated root is refused
    And a manifest listing a file outside its subgraph's published directory is refused
    And a manifest listing no files is refused
