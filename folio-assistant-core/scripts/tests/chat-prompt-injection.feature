Feature: the chat system prompt keeps untrusted content fenced

  @test:scripts/tests/chat-prompt-injection.test.ts::a_block_cannot_close_its_own_fence::fixedDelimiterGone
  Scenario: the fixed `"""` delimiter is gone
    When a prompt is made with ordinary block content
    Then it uses an untrusted-content fence and not the old triple quotes

  @test:scripts/tests/chat-prompt-injection.test.ts::a_block_cannot_close_its_own_fence::hostileContentCannotBreakOut
  Scenario: hostile content is carried, but cannot break out
    When a prompt is made with hostile block content
    Then the content is carried
    And the nonce fence opens once and closes once

  @test:scripts/tests/chat-prompt-injection.test.ts::a_block_cannot_close_its_own_fence::noncePerCall
  Scenario: the nonce differs per call, so it cannot be learned and replayed
    When two prompts are made
    Then each has a nonce and they differ

  @test:scripts/tests/chat-prompt-injection.test.ts::a_block_cannot_close_its_own_fence::guessedNonceCannotClose
  Scenario: content that guesses the nonce still cannot close it
    When content holds a closing fence with an earlier nonce
    Then the new prompt's fence still closes once

  @test:scripts/tests/chat-prompt-injection.test.ts::single-line_slots_are_flattened::userNameFlattened
  Scenario: a newline in userName cannot open a section
    When a user name with newlines and a heading is given
    Then it is flattened onto one line

  @test:scripts/tests/chat-prompt-injection.test.ts::single-line_slots_are_flattened::labelAndKindFlattened
  Scenario: blockLabel and blockKind are flattened too
    When a block label and kind with newlines are given
    Then neither carries its newlines into the prompt

  @test:scripts/tests/chat-prompt-injection.test.ts::single-line_slots_are_flattened::paperIdFlattened
  Scenario: paperId is flattened
    When a paper id with newlines is given
    Then it does not carry its newlines into the prompt
