# Specifies harnessesOwedABoard and boardsDir (scripts/gen-default-boards.ts)
# over the checkout, with the candidate names fixed to agent-skills,
# bootstrap, cat-harness, detangle and who-iris.
Feature: Instantiated harnesses that are not exempt are owed a valid board in the declared directory

  @test:test/coordinator/gen-default-boards-checkout.test.ts::who_owes_a_board::the_real_checkout:_the_instantiated_harnesses,_minus_the_floor
  Scenario: The checkout owes boards to cat-harness and who-iris
    Given the fixed candidate names
    When the harnesses owed a board are computed for the checkout
    Then they are exactly cat-harness and who-iris

  @test:test/coordinator/gen-default-boards-checkout.test.ts::who_owes_a_board::bootstrap_is_excluded_BY_ITS_DECLARATION,_not_by_its_name
  Scenario: bootstrap is excluded by its declaration although it is instantiated
    Given the bootstrap instance's declaration
    When it is asked whether it is exempt from "visualiser"
    Then it is exempt
    And bootstrap is not owed a board
    And bootstrap is among the harnesses the index instantiates

  @test:test/coordinator/gen-default-boards-checkout.test.ts::what_the_board_says::every_board_on_disk_parses,_and_shows_the_whole_folio
  Scenario: Every owed board on disk parses and has no filter
    Given each harness owed a board
    When its board file in the boards directory is read
    Then it parses with the board schema
    And it carries no filter

  @test:test/coordinator/gen-default-boards-checkout.test.ts::what_the_board_says::the_boards_directory_is_READ_from_the_todo_graph,_not_composed
  Scenario: The boards directory is inside the checkout and exists
    Given the checkout
    When the boards directory is looked up
    Then it lies under the checkout root
    And it exists
