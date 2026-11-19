# schemas/kg/cat-harness.js resolves which navbar icons a harness instance shows: its own list, an
# explicit empty list meaning show none, or (when absent) the nearest declaration up its `needs` chain or the floor.
# Each Scenario names the test that executes it.
Feature: Navbar icons resolve through three declaration states

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::a_list_is_the_instance's_own_answer_and_outranks_what_it_needs
  Scenario: An instance's own icon list outranks what it needs
    Given a leaf declaring "todos" and "beans" that needs a base declaring every icon
    When the leaf's navbar icons are resolved with base as the floor
    Then the result is "todos" and "beans"

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::ABSENT_inherits_—_the_nearest_declaration_up_the_`needs`_chain_wins
  Scenario: An absent declaration inherits the nearest declaration up the needs chain
    Given a leaf declaring nothing that needs mid, which declares "kg" and needs a base declaring every icon
    When the leaf's navbar icons are resolved with base as the floor
    Then the result is "kg"

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::`[]`_means_SHOW_NONE,_and_stops_the_walk_rather_than_inheriting_over_it
  Scenario: An empty list means show none and stops the walk
    Given a leaf declaring an empty list that needs a base declaring every icon
    When the leaf's navbar icons are resolved with base as the floor
    Then the result is an empty list

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::`undefined`_is_the_THIRD_state_—_nobody_decided,_and_that_is_not_`[]`
  Scenario: When nobody declared, the result is undefined rather than an empty list
    Given a lone instance with no icons and no needs
    When its navbar icons are resolved without a floor
    Then the result is undefined
    And the result does not equal an empty list

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::the_FLOOR_answers_only_when_the_walk_reached_nobody_who_had
  Scenario: The floor answers only when no layer in the walk declared
    Given an instance with no needs and no icons, and a floor declaring "launcher"
    When its navbar icons are resolved with that floor
    Then the result is "launcher"
    And when the instance declares an empty list the result is an empty list

  @test:schemas/navbar-icons.test.ts::three_states,_and_the_middle_one_is_the_point::a_floor_already_visited_is_not_consulted_twice
  Scenario: A floor already visited in the walk is not consulted again
    # Gap: the outcome would be the same if the floor were consulted twice, since it declares nothing; not consulting it twice is not observable here.
    Given a leaf that needs the floor, and the floor declares nothing
    When the leaf's navbar icons are resolved with that floor
    Then the result is undefined

  @test:schemas/navbar-icons.test.ts::the_walk_is_breadth-first,_and_it_terminates::a_nearer_layer_beats_a_deeper_one
  Scenario: A nearer layer's declaration beats a deeper one
    # Gap: near and far are at the same depth, so the test shows need order, not that a nearer layer beats a deeper one.
    Given a leaf that needs "near" declaring "todos" and "far" declaring "beans"
    When the leaf's navbar icons are resolved
    Then the result is "todos"

  @test:schemas/navbar-icons.test.ts::the_walk_is_breadth-first,_and_it_terminates::a_`needs`_cycle_does_not_hang_—_the_finding_belongs_elsewhere
  Scenario: A needs cycle returns instead of hanging
    Given layers a and b that need each other and declare nothing
    When a's navbar icons are resolved
    Then the result is undefined

  @test:schemas/navbar-icons.test.ts::the_walk_is_breadth-first,_and_it_terminates::an_instance_that_needs_something_undeclared_resolves_rather_than_throwing
  Scenario: Needing an undeclared instance resolves to undefined rather than throwing
    Given a leaf that needs "ghost", which is not in the declarations
    When the leaf's navbar icons are resolved
    Then the result is undefined

  @test:schemas/navbar-icons.test.ts::the_schema_holds_the_owner's_cap::eight_is_allowed;_a_ninth_is_REFUSED,_never_truncated
  Scenario: The schema allows eight icons and refuses a ninth
    Given the full icon vocabulary
    Then it holds 8 icons and parses
    And the vocabulary plus a repeated "todos" fails to parse

  @test:schemas/navbar-icons.test.ts::the_schema_holds_the_owner's_cap::an_icon_listed_twice_is_two_slots_doing_one_job
  Scenario: An icon listed twice is refused
    When the list "todos", "todos" is parsed
    Then parsing fails

  @test:schemas/navbar-icons.test.ts::the_schema_holds_the_owner's_cap::the_set_is_CLOSED_—_a_name_nothing_draws_is_refused_at_the_declaration
  Scenario: An icon name outside the closed set is refused
    When the list "kg" is parsed
    Then parsing succeeds
    And the list "kgviewer" fails to parse

  @test:schemas/navbar-icons.test.ts::the_schema_holds_the_owner's_cap::`[]`_PARSES_—_the_owner_asked_for_it_and_the_schema_must_not_forbid_it
  Scenario: An empty icon list parses
    When an empty list is parsed as navbar icons
    Then parsing succeeds

  @test:schemas/navbar-icons.test.ts::the_live_declarations::cat-harness_is_the_floor,_and_it_is_the_one_that_declares
  Scenario: The cat-harness declaration is a valid subset without processes or kg
    # Gap: does not check that cat-harness is used as the floor when resolving another instance
    Given the harness root
    When its navbar declaration is read
    Then the declaration's name is "cat-harness"
    And its navbar icons parse
    And they contain neither "processes" nor "kg"
