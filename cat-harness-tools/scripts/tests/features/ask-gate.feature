# scripts/ask-gate.ts and its hook scripts/ask-well.sh refuse a decision card whose options were not
# first written out as a question since the last prompt, and fail open otherwise. Each Scenario names the test that executes it.
Feature: Ask gate on decision cards

  @test:scripts/tests/ask-gate.test.ts::judge::a_card_with_no_written_question_since_the_last_prompt_is_refused
  Scenario: A card with no written question since the last prompt is refused
    Given options "A. Gate cards" and "B. Reminder only"
    And a transcript whose only posted question came before the latest prompt
    When the card is judged
    Then it is not allowed

  @test:scripts/tests/ask-gate.test.ts::judge::a_written_question_naming_every_option_lets_the_card_through
  Scenario: A written question naming every option lets the card through
    Given options "A. Gate cards" and "B. Reminder only"
    And a post after the latest prompt that names A and B
    When the card is judged
    Then it is allowed

  @test:scripts/tests/ask-gate.test.ts::judge::an_option_missing_from_the_prose_is_named_in_the_refusal
  Scenario: An option missing from the prose is named in the refusal
    Given options "A. Gate cards" and "B. Reminder only"
    And a post after the latest prompt that names only A
    When the card is judged
    Then it is not allowed
    And the reason names "B. Reminder only"

  @test:scripts/tests/ask-gate.test.ts::judge::a_letter_inside_a_word_does_not_count_as_naming_the_option
  Scenario: A letter inside a word does not count as naming the option
    Given the option marker for "A. x"
    Then it does not match "VIA. thing"
    And it matches "(A) thing"

  @test:scripts/tests/ask-gate.test.ts::judge::an_unlettered_label_must_appear_whole
  Scenario: An unlettered label is matched by its whole text
    Given the option "Close it"
    And a post "I would close it." after the latest prompt
    When the card is judged
    Then it is allowed

  @test:scripts/tests/ask-gate.test.ts::judge::it_fails_open_on_shapes_it_does_not_understand
  Scenario: The gate fails open on shapes it does not understand
    When the card is judged with no options and an empty transcript
    Then it is allowed
    And with an option that has no label it is allowed

  @test:scripts/tests/ask-gate.test.ts::the_hook,_end_to_end::blocks_with_exit_2_on_a_bare_card
  Scenario: The hook blocks a bare card with exit 2
    Given a transcript holding only a prompt
    When the ask-well.sh hook receives a request_decision call with options
    Then it exits 2
    And its stderr mentions "ask-gate"

  @test:scripts/tests/ask-gate.test.ts::the_hook,_end_to_end::fails_open:_unreadable_transcript,_garbage_input,_other_tools
  Scenario: The hook fails open on an unreadable transcript, garbage input and other tools
    When the hook receives a request_decision call whose transcript path does not exist
    Then it exits 0
    And it exits 0 on "not json", on empty input, and on an AskUserQuestion call
