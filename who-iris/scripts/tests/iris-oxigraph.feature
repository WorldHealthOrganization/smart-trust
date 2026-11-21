Feature: The WHO-IRIS Oxigraph multi-graph search engine
  Building the IRIS catalogue and metadata into partitioned N-Quads, and
  searching it with the Oxigraph engine: whole, lazily by graph, and in two
  tiers (a spine plus per-community partitions), including over exported
  DSpace records.

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::buildsDatasetAndQueryCatalog
  Scenario: builds multi-graph N-Quads dataset and prepared queries catalog
    Given the IRIS dataset built into dist/oxigraph
    Then who-iris-dataset.nq, who-iris-dataset.nq.gz and queries.json exist
    And the dataset contains both the catalogue graph and the metadata graph
    And queries.json has a discoverySearch and a facetCounts query

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::datasetHasNoBlankNodes
  Scenario: Solution A Skolemization: asserts zero blank nodes in compiled N-Quads dataset
    Given the IRIS dataset built into dist/oxigraph
    Then no line of who-iris-dataset.nq contains a blank node
    And more than 10 lines contain an "https://iris.who.int/entity/item/" URI

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::searchCombinesSubjectCommunityGate
  Scenario: complex search: multi-condition filter combining Subject, Community, and Copyright Gate
    Given an engine loaded with the whole dataset
    When it searches for subject "Guidelines", community "Western Pacific", with a PDF and copyright verdict "permitted"
    Then there is exactly one result, handle https://hdl.handle.net/10665/332098
    And its title is "Publication and information products style guide"
    And its creator is "World Health Organization. Regional Office for the Western Pacific"
    And its spatial is "Manila", its year 2020, its PDF "WPR-RDO-2020-003-eng.pdf" and its copyright gate "permitted"

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::searchFiltersDateRangeAndSpatial
  Scenario: complex search: Date range filter (1990 <= Year <= 2000) with Spatial="Geneva"
    Given an engine loaded with the whole dataset
    When it searches for spatial "Geneva" with year from 1990 to 2000
    Then there is exactly one result, handle https://hdl.handle.net/10665/36842
    And its title is "WHO editorial style manual" and its year 1993
    And its languages include "it" and "en"

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::facetCountsBySubjectAndCommunity
  Scenario: facet rollups: aggregate counts across subjects and communities
    Given an engine loaded with the whole dataset
    When subject and community facet counts are taken
    Then "Guidelines as Topic" is present with count 2 and "Publishing" has count 2
    And the community containing "Headquarters" has count 17 and the one containing "Western Pacific" count 1

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::lazyMountDoesNotClobberStore
  Scenario: dynamic / lazy loading: incrementally mount subgraphs without store clobbering
    Given an engine loaded with only the catalogue graph file, which exists
    When it searches for subject "Guidelines"
    Then there are no results
    When the metadata graph is mounted as a subgraph and the search is run again
    Then there is at least one result
    And the result handles are the same as an engine loaded with the whole dataset finds

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::preparedQueriesExecute
  Scenario: prepared queries manifest execution
    Given an engine loaded directly from the gzipped dataset
    When the prepared discoverySearch SPARQL from queries.json is run
    Then there is at least one row
    And the handles include https://hdl.handle.net/10665/332098

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::spineSearchWithoutPartitions
  Scenario: 2-Tier Architecture: Tier 1 spine fast discovery search without partitions
    Given an engine loaded with only the gzipped spine, which exists
    Then the spine is loaded and no community is loaded
    When the spine is searched for community "Western Pacific", with a PDF and copyright verdict "permitted"
    Then there is exactly one result, handle https://hdl.handle.net/10665/332098
    And its title, creator, PDF name and copyright gate are those of the WPRO style guide
    And it has no subjects

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::loadsCommunityPartitionOnDemand
  Scenario: 2-Tier Architecture: Dynamic on-demand loading of community partition
    Given an engine loaded with the spine
    And the subgraph manifest, which exists and declares a partition for the WPRO community
    When it searches for spatial "Manila"
    Then there are no results
    When the WPRO partition file, which exists, is loaded
    Then the WPRO community is reported loaded
    And searching for spatial "Manila" gives exactly one result, handle https://hdl.handle.net/10665/332098
    And its spatial is "Manila", its govdoc "WPR/RDO/2020/003" and its subjects include "Guidelines as Topic"

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::searchesAcrossMountedCommunities
  Scenario: 2-Tier Architecture: Multi-community dynamic mounting and active cross-community search
    Given an engine loaded with the spine
    And the subgraph manifest declares 3 community partitions
    When all of them are loaded from the output directory
    Then each is reported loaded
    When it searches for subject "Guidelines" in communities "Western Pacific" and "Headquarters"
    Then there are exactly two results
    And their handles include https://hdl.handle.net/10665/332098 and https://hdl.handle.net/10665/145714

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_Multi-Graph_MVP::subgraphManifestFilesExist
  Scenario: 2-Tier Architecture: Subgraph manifest integrity and partition files exist
    Given the subgraph manifest
    Then its version is "1.0.0"
    And its tier 1 spine file is who-iris-spine.nq, and both the spine's .nq and .gz files exist
    And every community partition has more than zero quads and items, and both its .nq and .gz files exist

  @test:scripts/tests/iris-oxigraph.test.ts::WHO-IRIS_Oxigraph_over_exported_DSpace_records_(#104)::exportBuildsStablePartitions
  Scenario: builds sorted, byte-identical partitions from exported records and keeps unchanged partitions identical when another community changes
    Given exported DSpace records for a WPRO and an HQ community, one collection and one item each
    When the dataset is built from them twice
    Then every emitted file is byte-identical between the two builds
    And the lines of the spine and of the dataset are sorted
    And the dataset contains no blank node
    And a spine search for community "Western Pacific" with a PDF returns only https://hdl.handle.net/10665/387974
    And after loading the WPRO partition, a search for spatial "Manila" and govdoc "WPR/2025/001" returns only that item
    When the HQ item's title is changed and the dataset is built a third time
    Then the WPRO partition is byte-identical to the first build's
    And the HQ partition differs from the first build's

  @test:scripts/tests/iris-oxigraph.test.ts::reference_lists_in_the_Oxigraph_graphs::handlesFromCatalogueOrSlug
  Scenario: a library document's Handle comes from its catalogue node, or from a slug that is a Handle
    Given a catalogue node naming a library slug and its Handle
    Then that slug's documents have that Handle
    And a slug written as a Handle reads as that Handle
    And any other slug has none

  @test:scripts/tests/iris-oxigraph.test.ts::reference_lists_in_the_Oxigraph_graphs::spineHoldsCitationEdgesAndMetadataTheReferences
  Scenario: the spine holds the citation edges, and the metadata graph and the community partition the references
    Given two extracted references, one from a document in a community and one cited work the library holds
    When their quads are loaded into Oxigraph
    Then the document cites its reference and the IRIS item the library holds of it, in the spine
    And the reference's citation as printed and its year are in the metadata graph and the community's partition
    And a reference from a document in no community is in the metadata graph only
