# The word diff the review page runs, and its renderer registry (bean d903).
# Each Scenario names the test that executes it.
Feature: Word diff

  @test:scripts/tests/word-diff.test.ts::wordDiff::a_one-word_edit_is_one_del_and_one_ins,_with_everything_else_same
  Scenario: A one-word edit
    When "Give 5 mg daily." is diffed against "Give 10 mg daily."
    Then the ops are same "Give ", del "5", ins "10", same " mg daily."

  @test:scripts/tests/word-diff.test.ts::wordDiff::either_side_is_reconstructed_exactly,_whitespace_and_punctuation_included
  Scenario: Either side is reconstructed exactly
    When two texts differing in words, whitespace and punctuation are diffed
    Then the same and del ops rebuild the first, and the same and ins ops rebuild the second

  @test:scripts/tests/word-diff.test.ts::wordDiff::identical_text_is_all_same;_empty_sides_are_pure_ins_or_del
  Scenario: Identical and empty sides
    Then identical texts give one same op
    And an empty old side gives one ins and an empty new side one del

  @test:scripts/tests/word-diff.test.ts::wordDiff::too_large_returns_null,_which_the_page_SAYS_rather_than_freezing
  Scenario: A diff over the limit is null
    # Gap: the title says the page says so; nothing checks the page.
    Then diffing two four-word texts with a limit of 10 returns null

  @test:scripts/tests/word-diff.test.ts::wordDiff::it_is_self-contained,_so_the_page_can_embed_exactly_this_function
  Scenario: The function is self-contained
    When the function is rebuilt from its own source text
    Then it diffs "a b" against "a c" exactly as the original does

  @test:scripts/tests/word-diff.test.ts::the_renderer_registry::exactly_one_fallback,_unique_ids,_and_a_default_for_every_kind
  Scenario: One fallback, unique ids, inline by default
    Then exactly one renderer is the "*" fallback and renderer ids are unique
    And table, prose and an unknown kind default to "inline", labelled "Inline"

  @test:scripts/tests/word-diff.test.ts::the_renderer_registry::a_structured_block_opens_inline_too,_not_on_the_field_table_(owner,_2026-11-02)
  Scenario: A structured block opens inline
    Then a structured functional-requirement and a structured prose block default to "inline"
    And with only the field-table renderer available, a structured block defaults to "fields"

  @test:scripts/tests/word-diff.test.ts::the_renderer_registry::every_kind_a_renderer_defaults_for_is_a_real_block_kind
  Scenario: Every default kind is a block kind
    Then every kind a renderer defaults for, other than "*" and "@structured", is a block kind
