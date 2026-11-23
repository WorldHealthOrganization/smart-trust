# scripts/check-interaction-modality.ts audits session transcripts for owner questions asked in
# prose without a question card, and for child briefs that do not pass on interaction-modality.
# Each Scenario names the test that executes it.
Feature: Owner questions go through a card

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_card_tool_recognition::recognises_canonical_and_MCP-prefixed_card_tools
  Scenario: Canonical and MCP-prefixed card tools are recognised
    When tool names are classified
    Then "AskUserQuestion", "ask_question", "request_decision" and "post_widget" are card tools
    And "mcp__harness__request_decision" and "mcp__claude__AskUserQuestion" are card tools
    And "Read" and "create_session" are not

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_2026-11-05_incident_fixtures_(prose_questions_without_card)::fires_on_every_2026-11-05_prose-only_owner_question_from_bean_55ka
  Scenario: Every prose-only owner question of the 2026-11-05 incident is detected
    Given the eleven assistant turns from bean 55ka that asked or deferred to the owner in prose only
    When each turn's text is checked for a prose owner question
    Then every one of them yields a finding

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_2026-11-05_incident_fixtures_(prose_questions_without_card)::fires_on_an_assistant_turn_ending_in_a_direct_question_or_option_list_with_no_card_call
  Scenario: A turn ending in a direct question with no card call fails the audit
    Given a transcript whose assistant turn lists two options and ends "Which option would you like me to take?" with no tool call
    When the transcript is audited
    Then the audit is not ok
    And there is one prose question, of kind "trailing-question"
    # Gap: only the trailing-question case is asserted; an option list without a closing question is not

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_2026-11-05_incident_fixtures_(prose_questions_without_card)::passes_(anti-vacuity_pair)_when_the_same_question_turn_also_calls_AskUserQuestion_/_ask_question
  Scenario: The same question passes when the turn also calls a card tool
    Given an assistant turn with the framed question in text and an AskUserQuestion tool call
    When the transcript is audited
    Then the audit is ok with no prose questions
    # Gap: only AskUserQuestion is exercised, not ask_question

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_2026-11-05_incident_fixtures_(prose_questions_without_card)::passes_when_a_subagent_returns_a_structured_hand-back-to-discussion_JSON_block
  Scenario: A structured hand-back-to-discussion JSON block passes
    Given an assistant turn returning a JSON block with decision, question, options, recommended and default_on_silence
    When the transcript is audited
    Then the audit is ok with no prose questions

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_2026-11-05_incident_fixtures_(prose_questions_without_card)::does_not_false-positive_on_ordinary_progress_turns_or_historical_card_citations
  Scenario: A progress turn citing an earlier card answer is not a prose question
    Given an assistant turn reporting "Owner allowed push (card 'Tools push', option 1: merge on green)" and an opened PR
    When the transcript is audited
    Then the audit is ok with no prose questions

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_sibling_brief_and_subagent_prompt_check::flags_a_child_brief_that_omits_interaction-modality
  Scenario: A child brief that omits interaction-modality is flagged
    Given a brief that only names a bean, a branch and the work to do
    When the brief is checked
    Then it is not ok
    And the reason mentions "interaction-modality"

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_sibling_brief_and_subagent_prompt_check::accepts_a_brief_that_names_interaction-modality_or_hand-back-to-discussion,_or_spells_out_the_card_+_framing_rules
  Scenario: A brief naming interaction-modality or hand-back-to-discussion is accepted
    Given a brief that names "interaction-modality" and spells out the card and framing rules
    Then the brief is ok
    And a brief that asks for owner questions in "hand-back-to-discussion" format is ok
    # Gap: a brief that spells out the rules without naming either skill is not checked

  @test:scripts/tests/check-interaction-modality.test.ts::check-interaction-modality_—_sibling_brief_and_subagent_prompt_check::audits_create_session_and_invoke_subagent_calls_in_a_transcript
  Scenario: Child-session and subagent briefs in a transcript are audited
    Given a JSONL transcript with a create_session call whose prompt omits interaction-modality
    And an invoke_subagent call whose prompt names it
    When the transcript is parsed and audited
    Then the audit is not ok
    And exactly one brief is missing the modality, from "mcp__claude-code-remote__create_session"
