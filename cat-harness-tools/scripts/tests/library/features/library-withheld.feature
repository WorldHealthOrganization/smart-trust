# A withheld library entry publishes no verbatim text and no cover (bean
# cw35). Each Scenario names the test that executes it.
Feature: A withheld library entry publishes none of the source's words

  @test:scripts/tests/library/library-withheld.test.ts::withheldReason::names_the_reason_for_an_entry_its_parent_lists,_trailing_slash_or_not
  Scenario: The parent's withheld list names an entry's reason
    # Gap: the title says "trailing slash or not"; only the trailing-slash spelling "book/" is listed, so a path without the slash is not checked.
    Given a library whose withheld.json lists "book/" with reason "copyright refused"
    When the withheld reason of entry book is read
    Then it is "copyright refused"

  @test:scripts/tests/library/library-withheld.test.ts::withheldReason::an_entry_with_no_list_beside_it_is_not_withheld
  Scenario: An entry with no withheld list beside it is not withheld
    Given a library with no withheld.json
    When the withheld reason of entry book is read
    Then there is none

  @test:scripts/tests/library/library-withheld.test.ts::withheldReason::a_malformed_list_throws_rather_than_reading_as_'withhold_nothing'
  Scenario: A malformed withheld list throws
    Given a withheld.json whose paths is a string, not a list
    When the withheld reason of entry book is read
    Then it throws an error naming "refusing to publish"

  @test:scripts/tests/library/library-withheld.test.ts::readEntryBlocks({_verbatim:_false_})::drops_a_prose_block's_excerpt_—_the_source's_words
  Scenario: A prose block's excerpt is dropped when verbatim is off
    Given a withheld entry with a prose block on page 1
    When its blocks are read with verbatim false
    Then the prose block's content is null and it is not marked truncated
    And it still carries its page start, 1

  @test:scripts/tests/library/library-withheld.test.ts::readEntryBlocks({_verbatim:_false_})::keeps_a_figure's_narrative_—_our_words
  Scenario: A figure's narrative is kept when verbatim is off
    Given a withheld entry with a figure whose drafted narrative is our description
    When its blocks are read with verbatim false
    Then the figure's content is that narrative

  @test:scripts/tests/library/library-withheld.test.ts::readEntryBlocks({_verbatim:_false_})::the_default_still_carries_the_excerpt,_so_nothing_else_changed
  Scenario: By default the prose excerpt is still carried
    Given an entry that is not withheld, with a prose block
    When its blocks are read with the default options
    Then the prose block's content holds the source's words

  @test:scripts/tests/library/library-withheld.test.ts::orphanAvatars::lists_every_copy_no_entry_names,_and_none_it_does
  Scenario: Avatar copies no entry names are orphans
    Given an avatar directory holding kept.png and gone.png
    And a set of named avatars holding only kept.png
    When the orphan avatars are listed
    Then the list is exactly gone.png

  @test:scripts/tests/library/library-withheld.test.ts::orphanAvatars::an_absent_root_has_no_orphans_rather_than_throwing
  Scenario: An absent avatar root has no orphans
    Given an avatar root that does not exist
    When the orphan avatars are listed
    Then the list is empty and nothing is thrown
