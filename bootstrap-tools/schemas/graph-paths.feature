Feature: declared paths stay inside the declaring directory

  @test:schemas/graph-paths.test.ts::declared_paths_stay_inside_the_declaring_directory::refusesEscapingPath[${p}]
  Scenario Outline: refuses <path>
    Given the path <path>
    When it is used as a Subgraph's path and as an Asset's src
    Then both the SubgraphSchema and the AssetSchema reject it

    Examples:
      | path |
      | "/abs" |
      | "\\abs" |
      | "C:/x" |
      | "c:x" |
      | ".." |
      | "../x" |
      | "a/../b" |
      | "a/.." |
      | "a\\..\\b" |

  @test:schemas/graph-paths.test.ts::declared_paths_stay_inside_the_declaring_directory::acceptsContainedPath[${p}]
  Scenario Outline: accepts <path>
    Given the path <path>
    When it is used as a Subgraph's path and as an Asset's src
    Then both the SubgraphSchema and the AssetSchema accept it

    Examples:
      | path |
      | "x" |
      | "x/" |
      | "a/b/c/" |
      | "a..b" |
      | "..a/" |
      | "a/b..c" |
      | "a/.hidden" |

  @test:schemas/graph-paths.test.ts::declared_paths_stay_inside_the_declaring_directory::jsonSchemaCarriesPathPattern
  Scenario: the generated JSON Schema carries the pattern on both fields
    When the input JSON Schemas of SubgraphSchema and AssetSchema are generated
    Then the Subgraph's path property carries a pattern
    And the Asset's src property carries the same pattern
