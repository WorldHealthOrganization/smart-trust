# pipeline/lsi-near-across.ts runs a latent-semantic "near" query over each graph a layer
# declares an LSI unit provider for, reporting each graph on its own.
# Each Scenario names the test that executes it.
Feature: LSI near-query across graphs

  @test:pipeline/lsi-near-across.test.ts::explicitRefs::names_the_units_the_text_spells_out,_in_order,_once_each
  Scenario: Explicit references name the spelled-out units in order, once each
    Given the keys "QOU.Mass.foo" for two units and "library/l/blocks/b1" for one
    And text naming library/l/blocks/b1 and then QOU.Mass.foo twice
    When the explicit references are read
    Then they are "library/l/blocks/b1", "QOU.Mass.foo@QOU.Mass.X" and "QOU.Mass.foo@QOU.Mass.Y"

  @test:pipeline/lsi-near-across.test.ts::explicitRefs::a_key_that_is_only_part_of_a_longer_token_does_not_match
  Scenario: A key inside a longer token does not match
    Given the key "QOU.Mass.foo"
    When the explicit references in "QOU.Mass.foobar" are read
    Then there are none

  @test:pipeline/lsi-near-across.test.ts::nearInGraph::a_provider's_notSearched_passes_through,_with_nothing_else_claimed
  Scenario: A provider's notSearched reason passes through with no hits
    Given a lean-decl provider result with no units and notSearched "no --root given"
    When "spectral gap" is searched in it
    Then notSearched is "no --root given"
    And there are no hits

  @test:pipeline/lsi-near-across.test.ts::nearInGraph::too_few_units_is_not_searched,_not_an_empty_result
  Scenario: Too few units is reported as not searched
    Given a blocks graph of only 2 units
    When "spectral gap" is searched in it
    Then notSearched contains "too few"

  @test:pipeline/lsi-near-across.test.ts::nearInGraph::a_query_sharing_no_vocabulary_says_so
  Scenario: A query sharing no vocabulary is reported as a vocabulary miss
    Given a blocks graph of 5 units
    When "zzzz qqqq" is searched in it
    Then it is a vocabulary miss with no hits
    And it is not marked as not searched

  @test:pipeline/lsi-near-across.test.ts::nearInGraph::explicit_units_are_listed_first_and_left_out_of_the_latent_hits
  Scenario: Explicit units are listed first and left out of the latent hits
    Given a blocks graph whose ref keys include "b"
    When "see b about the spectral gap" is searched for 5 hits
    Then the explicit units are ["b"]
    And b is not among the hits

  @test:pipeline/lsi-near-across.test.ts::nearInGraph::hits_are_labelled_lexical_or_latent_only
  Scenario: Each hit is labelled lexical or latent
    Given a blocks graph of 5 units
    When "spectral gap" is searched for 5 hits
    Then unit a is a lexical hit
    And every hit has a boolean lexical flag

  @test:pipeline/lsi-near-across.test.ts::formatNearAcross::one_block_per_graph,_never_one_merged_list
  Scenario: The report has one block per graph, never one merged list
    Given a blocks search in layer core and a lean-decl result not searched for "no --root given"
    When they are formatted together
    Then the first line starts "blocks (core): 5 units."
    And one line reads "lean-decl: not searched (no --root given)"

  @test:pipeline/lsi-near-across.test.ts::parseNearAcrossArgs::reads_--graphs_and_repeated_--root
  Scenario: The arguments read --graphs and repeated --root
    Given the arguments "--graphs beans, blocks" and two "--root lean-decl=" values
    When they are parsed
    Then graphs are beans and blocks and the lean-decl roots are "/a" and "/b"
    And no arguments parse to empty roots

  @test:pipeline/lsi-near-across.test.ts::discoverLsiUnitProviders::finds_declared_providers,_and_reports_malformed_ones_and_collisions
  Scenario: Declared providers are found, and malformed ones and collisions are reported
    Given a checkout where core and sci both declare blocks, sci also declares lean-decl, and bad declares a non-kebab kind with an escaping module
    When the LSI unit providers are discovered
    Then the only provider is "sci:lean-decl"
    And a problem starts "bad: `lsiUnitProviders` is malformed"
    And a problem says "blocks" is declared by "core" and "sci"

  @test:pipeline/lsi-near-across.test.ts::nearAcross::searches_each_declared_graph_on_its_own,_and_says_why_one_was_not_searched
  Scenario: Each declared graph is searched on its own, with a reason for any not searched
    Given core provides blocks from a working module, and sci declares lean-decl with a throwing export and odd with a non-function export
    When "c and the measles schedule" is searched across blocks, lean-decl, odd and missing
    Then blocks lists c as explicit and has hits
    And lean-decl is not searched because "its provider failed: boom"
    And odd is not searched because it "has no exported function `notAFunction`"
    And missing is not searched because "no instance in this checkout declares it"
