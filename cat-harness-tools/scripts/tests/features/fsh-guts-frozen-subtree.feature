# A frozen subtree in fsh-guts (schemas/kg/fsh-guts.ts) is one item, recognised by the kind its sibling note declares;
# file lists drop its files, and the fsh-guts page (scripts/gen-fsh-guts-viz.ts) lists it as one row.
# Each Scenario names the test that executes it.
Feature: A frozen fsh-guts subtree is one item

  @test:scripts/tests/fsh-guts-frozen-subtree.test.ts::frozen_subtrees::recognised_by_the_note's_declared_kind,_not_by_where_it_sits
  Scenario: A frozen subtree is recognised by its note's declared kind
    Given "separated/demo/" beside a note "separated/demo.md" of the frozen-subtree kind
    And "retired/thing/" beside a note of kind "staged-copies"
    Then "separated/demo" is a frozen subtree
    And its note's title is "demo, separated"
    And "retired/thing" is not a frozen subtree
    And "separated" itself is not a frozen subtree

  @test:scripts/tests/fsh-guts-frozen-subtree.test.ts::frozen_subtrees::a_file_list_keeps_the_note_and_drops_the_subtree's_files,_naming_the_subtree_once
  Scenario: A file list keeps the frozen subtree's note and drops its files
    Given a file list holding the frozen subtree's note and files and the unfrozen "retired/thing" note and file
    When withoutFrozenSubtrees filters it
    Then the live files are "separated/demo.md", "retired/thing.md" and "retired/thing/loose.md"
    And the frozen list is just "separated/demo"

  @test:scripts/tests/fsh-guts-frozen-subtree.test.ts::frozen_subtrees::the_fsh-guts_page_lists_the_subtree_as_ONE_row,_via_its_note
  Scenario: The fsh-guts page lists a frozen subtree as one row
    When gutsFiles lists the fixture directory
    Then it has rows "separated/demo/" and "separated/demo.md"
    And no row lies inside "separated/demo/"
    And the "separated/demo/" row's state is "sidecar"
    And the unfrozen "retired/thing/loose.md" row's state is "undeclared"
    And the rendered page mentions "demo/"
