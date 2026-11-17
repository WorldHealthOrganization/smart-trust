# scripts/gen-content-graph-uml.ts draws a paper's block graph as PlantUML class diagrams
# following the graph-rendering rules. Each Scenario names the test that executes it.
Feature: Content graph UML drawing

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::chapters_are_the_groups_(rule_2)
  Scenario: Chapters are the groups of the block model
    Given a hand-built paper graph with blocks in chapters "ch01" and "ch02"
    When the block model is built
    Then the distinct node groups are "ch01" and "ch02"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::editorial_and_formal_edges_are_drawn_apart,_never_merged_(rule_4)
  Scenario: Editorial and formal edges between the same pair are drawn as separate lines
    Given a paper where "thm:main" both uses and formally types "def:space"
    When the PlantUML text is drawn
    Then it holds a plain "uses" arrow from "thm:main" to "def:space"
    And a separate dashed purple "type" arrow from "thm:main" to "def:space"
    And a plain "interprets" arrow from "rem:why" to "thm:main"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::no_block_is_drawn_as_an_empty_box_(rule_3)
  Scenario: No block is drawn as an empty box
    Given the paper graph, including a remark with no Lean reference
    When the PlantUML text is drawn
    Then no class body is an empty pair of braces
    And the text contains "//prose only: no lean.ref//"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::a_chapter_diagram_draws_other_chapters'_blocks_as_stubs,_not_in_full
  Scenario: A chapter diagram draws other chapters' blocks as stubs
    Given the paper graph's diagram files written under "/out"
    When the ch02 diagram is read
    Then it draws "cor:use" as a corollary class
    And it marks a block from another chapter with "<<in ch01>>"
    And it does not contain ch01's internal edge from "thm:main" to "def:space"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::status_fills_the_box;_a_human_review_outranks_the_Lean_status
  Scenario: Status fills the box and a human review outranks the Lean status
    Given a block "proved" with a human review
    Then its status is "reviewed_human"
    And a block "proved" without reviews has status "proved"
    And when "thm:main" is given status "proved", its class is filled "#eaf3de"
    And its box shows "status : proved"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::the_landscape_view_is_derived,_left_to_right_(rule_6)
  Scenario: The landscape view is derived left to right
    Given the PlantUML text of the paper graph
    When its landscape view is derived
    Then it contains "left to right direction"
    And it does not contain "!pragma layout elk"

  @test:scripts/tests/gen-content-graph-uml.test.ts::gen-content-graph-uml::the_legend_says_where_the_formal_edges_came_from,_in_three_states_(#1492)
  Scenario: The legend says where the formal edges came from
    Given the paper graph drawn with each formal source
    Then with no formal source the legend says "UNAVAILABLE here (no formal cache)"
    And "elaborated" and "atlas" sources are labelled "(elaborated)"
    And "scan" and "mixed" sources are labelled "APPROXIMATE"
    And the formal legend for "scan" does not say "(elaborated)"
