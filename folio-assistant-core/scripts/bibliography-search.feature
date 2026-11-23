Feature: the bibliography's sharded search index

  @test:scripts/bibliography-search.test.ts::tokens::foldsCaseAndAccents
  Scenario: words are folded to lower case without accents
    When a text is read into words
    Then its words are lower case, without accents, and split on everything but letters and digits

  @test:scripts/bibliography-search.test.ts::tokens::readsHanAsPairs
  Scenario: a script written without spaces is read as pairs of characters
    When a Chinese text is read into words
    Then its words are its overlapping pairs of characters

  @test:scripts/bibliography-search.test.ts::index_and_search::filesAreCutAsTheManifestSays
  Scenario: the index's files are cut as its manifest says
    Given four references in two sub-graphs
    When the index is built
    Then the manifest names the count, the cuts and the sub-graphs
    And there is one terms file, one references file and the facets
    And words that begin alike sit in the same terms file

  @test:scripts/bibliography-search.test.ts::index_and_search::everyWordMatchesAsAPrefix
  Scenario: every word of a query must begin a word of the reference
    When the index is searched for the start of a word and a year, an accented word, and Chinese
    Then each finds the one reference that holds them
    And a word no reference holds finds nothing

  @test:scripts/bibliography-search.test.ts::index_and_search::countsBySubgraphAndDecade
  Scenario: a search counts what it found by sub-graph and by decade, and filters by either
    When the index is searched for a word two references hold
    Then it counts one in each sub-graph and one in each decade
    And limited to a sub-graph or a decade it finds the one there

  @test:scripts/bibliography-search.test.ts::index_and_search::theBrowserRunsTheSameCode
  Scenario: the page's search runs the same code as the index's builder
    When the search box is written
    Then it embeds the tokenizer, the shard hash and the query as written
    And rebuilt from that source the query finds the same references
