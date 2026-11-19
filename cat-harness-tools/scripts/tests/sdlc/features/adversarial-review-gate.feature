# scripts/agent-provenance.ts detects whether a PR has agent provenance, and
# scripts/check-adversarial-review.ts evaluates and renders the adversarial
# review gate for it. Each Scenario names the test that executes it.
Feature: Adversarial review gate

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::negative_case:_human-only_PR_requires_no_adversarial_review
  Scenario: A human-only PR has no agent provenance
    Given the branch "feature/human-docs", a human PR body and two commits by human authors and committers
    When agent provenance is detected
    Then there is no agent provenance and the PR is human-only
    And there are no signals and no author sessions
    And the summary is "human-only PR: no adversarial review required"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::positive_case:_Co-Authored-By_Claude_trailer_triggers_provenance
  Scenario: A Co-Authored-By Claude trailer gives agent provenance
    Given a human-authored commit carrying "Co-Authored-By: Claude <noreply@anthropic.com>"
    When agent provenance is detected
    Then there is agent provenance and the PR is not human-only
    And a signal of kind "trailer" is reported

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::positive_case:_Claude-Session_trailer_triggers_provenance_and_extracts_session_ID
  Scenario: A Claude-Session trailer gives agent provenance and its session id
    Given a commit carrying "Claude-Session: session_claude_abc123"
    When agent provenance is detected
    Then there is agent provenance
    And the author sessions contain "session_claude_abc123"
    And a signal's detail names that session

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::positive_case:_agent_branch_prefix_triggers_provenance
  Scenario: An agent branch prefix gives agent provenance
    Given the branches "claude/w8jq-adversarial-review", "bot/dependency-update" and "agent/subagent-task"
    When agent provenance is detected for each
    Then each has agent provenance
    And the claude branch's first signal is of kind "branch"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::positive_case:_bot_committer_or_author_triggers_provenance
  Scenario: A bot author gives agent provenance
    # Gap: only a bot author is tested, not a bot committer
    Given a commit authored by "github-actions[bot]"
    When agent provenance is detected
    Then there is agent provenance
    And a signal of kind "bot" is reported

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::positive_case:_PR_description_markers_trigger_provenance
  Scenario: Markers in the PR description give agent provenance
    Given a PR body saying "Generated with Claude Code." and "Claude-Session: session_body_xyz"
    When agent provenance is detected
    Then there is agent provenance
    And the author sessions contain "session_body_xyz"
    And a signal of kind "pr_body" is reported

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Agent_Provenance_Detection_(detectAgentProvenance)::extractTrailersFromMessage_parses_multiple_trailers_correctly
  Scenario: Multiple trailers are parsed from a commit message
    Given a message with a Signed-off-by, a Claude-Session "sess_123" and two Co-Authored-By trailers
    When its trailers are extracted
    Then the session ids are exactly "sess_123"
    And there are two Co-Authored-By trailers
    And the Claude-Session trailers are exactly "sess_123"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::skips_human-only_PR_without_requiring_any_verdict
  Scenario: A human-only PR is skipped without a verdict
    Given human-only provenance and no verdict
    When the gate is evaluated
    Then the state is "skipped", the action "pass", and merge is not blocked
    And the result is human-only with the message "human-only PR: no adversarial review required"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::reports_'unknown'_when_agent_provenance_exists_but_verdict_is_missing
  Scenario: Agent provenance with no verdict is unknown and warns
    Given agent provenance from a "claude/" branch and no verdict, in warn mode
    When the gate is evaluated
    Then the state is "unknown", the action "warn", and merge is not blocked
    And the message says "No adversarial review verdict found"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::in_hard_mode,_missing_verdict_blocks_merge_with_state_'unknown'
  Scenario: In hard mode a missing verdict blocks merge
    Given agent provenance and no verdict, in hard mode
    When the gate is evaluated
    Then the state is "unknown", the action "block", and merge is blocked

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::checks_SHA_binding:_reports_'stale'_when_head_moved_after_review
  Scenario: A verdict for an older head is stale
    Given a verdict bound to one head sha, and a current head that has moved, in warn mode
    When the gate is evaluated
    Then the state is "stale" and the action "warn"
    And the message mentions "stale"
    And the result names both the reviewed and the current head sha

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::checks_reviewer_independence:_rejects_review_authored_by_same_session
  Scenario: A review by the authoring session is rejected
    Given a commit from a Claude session and a review whose reviewer is that same session
    When the gate is evaluated
    Then the state is "unknown"
    And the message says "Reviewer independence violation"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::rejects_incomplete_agent_reviewer_record_(missing_model)
  Scenario: An agent reviewer record without a model is rejected
    Given a review whose agent reviewer has no model
    When the gate is evaluated
    Then the state is "unknown"
    And the message says "Reviewer record incomplete"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::checks_whole-diff_coverage:_truncated_coverage_reports_'unknown'_(never_silent_pass)
  Scenario: Truncated review coverage is unknown, never a pass
    Given a passing review that covered 3 of 10 files and is marked truncated
    When the gate is evaluated
    Then the state is "unknown"
    And the message says "Review coverage was truncated"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::checks_unreviewed_changed_files_against_git_diff:_reports_'unknown'
  Scenario: Changed files beyond the review's coverage are unknown
    Given a passing review that covered 1 of 1 files, and a diff of 3 changed files
    When the gate is evaluated
    Then the state is "unknown"
    And the message says "Incomplete diff coverage"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::clean_review_passes_with_state_'clean'
  Scenario: A clean review passes
    Given a passing review whose only flag is an open suggestion
    When the gate is evaluated
    Then the state is "clean", the action "pass", and merge is not blocked

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::under_warn-only_ruling_(2026-10-03),_open_red_flags_report_'would-have-blocked'
  Scenario: In warn mode an open red flag would have blocked
    Given a failing review with one open, blocking security flag, in warn mode
    When the gate is evaluated
    Then the state is "would-have-blocked", the action "warn", and merge is not blocked
    And one finding is reported, of category "security", with a historical basis

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::under_hard_mode,_open_red_flags_report_'open'_and_block_merge
  Scenario: In hard mode an open red flag blocks merge
    Given a failing review with one open, blocking security flag, in hard mode
    When the gate is evaluated
    Then the state is "open", the action "block", and merge is blocked

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Review_Gate_Evaluation_(evaluateAdversarialGate)::overridden_red_flags_pass_cleanly_with_state_'clean'
  Scenario: An overridden red flag passes clean
    Given a passing review whose blocking security flag is overridden with a recorded resolution
    When the gate is evaluated
    Then the state is "clean", the action "pass", and merge is not blocked

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Gate_Report_Rendering_(renderAdversarialGateReport)::renders_human-only_skip_notice_cleanly
  Scenario: The report renders the human-only skip notice
    Given the gate result for a human-only PR on "main"
    When the report is rendered
    Then a line reads "✓ human-only PR: no adversarial review required"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Gate_Report_Rendering_(renderAdversarialGateReport)::renders_would-have-blocked_advisory_with_findings,_category,_and_historical_basis
  Scenario: The report renders a would-have-blocked advisory with its findings
    Given a warn-mode result with an open "false-green" flag "flag-1"
    When the report is rendered
    Then a line says "ADVISORY (would have blocked)"
    And a line names "[false-green] flag-1"
    And a line gives a "Basis:"

  @test:scripts/tests/sdlc/adversarial-review-gate.test.ts::Adversarial_Gate_Report_Rendering_(renderAdversarialGateReport)::never_renders_'unknown'_as_clean_pass_(✓)
  Scenario: The report never renders unknown as a clean pass
    Given the result for agent provenance with no verdict
    When the report is rendered
    Then no line carries "✓"
    And a line says "WARNING (unknown)"
