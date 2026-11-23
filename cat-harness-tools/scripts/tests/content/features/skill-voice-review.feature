# scripts/skill-voice-review.ts gates whether a skill has a current voice review: it resolves
# the active skill voices, checks review freshness by hash, and reads and records reviews in the attestation store.
# Each Scenario names the test that executes it.
Feature: Skill voice reviews

  @test:scripts/tests/content/skill-voice-review.test.ts::which_voices_judge_skills::nothing_active_is_an_empty_set,_and_an_unreadable_config_is_undefined
  Scenario: No active voice gives an empty set and an unreadable config gives undefined
    Given the repository's voices
    When skillVoices is called with an empty active list
    Then it returns an empty list
    When skillVoices is called with active undefined
    Then it returns undefined

  @test:scripts/tests/content/skill-voice-review.test.ts::which_voices_judge_skills::the_base_skill-authoring_voice_contributes_its_skill-scoped_rules
  Scenario: The base skill-authoring voice contributes its 12 skill-scoped rules
    Given the active voice "agent-skill-authoring"
    When skillVoices resolves it
    Then the first voice has the id "agent-skill-authoring"
    And it carries 12 rules

  @test:scripts/tests/content/skill-voice-review.test.ts::which_voices_judge_skills::a_vendor_voice_resolves_through_its_base
  Scenario: A vendor voice carries its own rules plus its base's
    Given the active voice "agent-skill-authoring-claude"
    When skillVoices resolves it
    Then the voice carries 20 rules
    And some rule id starts with "as-"

  @test:scripts/tests/content/skill-voice-review.test.ts::whether_a_skill's_review_is_current::n/a_with_no_voice_active;_unknown_when_undetermined
  Scenario: No active voice gives n/a and undetermined voices give unknown
    Given a skill file and no reviews
    When the reviews are evaluated against an empty voice list
    Then the result is "n/a"
    When the reviews are evaluated with the voices undefined
    Then the result is "unknown"

  @test:scripts/tests/content/skill-voice-review.test.ts::whether_a_skill's_review_is_current::never_reviewed_is_a_finding
  Scenario: A skill never reviewed by an active voice fails
    Given a skill file, no reviews and one active voice "v"
    When the reviews are evaluated
    Then the result is "fail"

  @test:scripts/tests/content/skill-voice-review.test.ts::whether_a_skill's_review_is_current::a_current_review_passes_EVEN_WITH_a_rule_judged_fail_—_no_gate_on_rule_content
  Scenario: A current review passes even when it judges a rule fail
    Given a review by voice "v" matching the skill hash and voice hash, judging "r1" pass and "r2" fail
    When the reviews are evaluated
    Then the result is "pass"
    And the returned review still records "r2" as "fail"

  @test:scripts/tests/content/skill-voice-review.test.ts::whether_a_skill's_review_is_current::a_changed_skill_or_a_changed_voice_makes_the_review_stale,_and_the_old_review_is_kept
  Scenario: A changed skill or voice makes the review stale and the old review is kept
    Given a review whose skill hash is "old"
    When the reviews are evaluated
    Then the result is "fail"
    And the one review is still returned
    Given a review whose voice hash is "old"
    When the reviews are evaluated
    Then the result is "fail"

  @test:scripts/tests/content/skill-voice-review.test.ts::whether_a_skill's_review_is_current::verdicts_must_cover_each_rule_once,_and_explain_every_non-pass
  Scenario: Verdicts must cover each rule once and explain every fail
    # Gap: the title says "each rule once"; no case gives a rule two verdicts
    Given voice "v" with rules "r1" and "r2"
    Then verdicts passing "r1" and failing "r2" with a note have no problems
    And verdicts for "r1" alone report "r2: no verdict"
    And a fail verdict on "r2" without a note reports "r2: a fail verdict needs a note saying why"
    And an extra verdict for "zz" reports "zz: not a skill rule of v"

  @test:scripts/tests/content/skill-voice-review.test.ts::reviews_in_the_attestation_store::an_absent_store_takes_the_prior_sidecar's_reviews_(ruling_2);_a_corrupt_file_is_refused,_not_overwritten
  Scenario: An absent store takes the prior sidecar's reviews, and a corrupt store is refused untouched
    Given a skill, no attestation store, and a prior sidecar holding a current review by voice "v"
    When the reviews are read
    Then the store state is "absent"
    And evaluating them passes with the sidecar's review
    When a new review by voice "w" is recorded with the sidecar
    Then the store reads back as "hit" with reviews by "v" and "w"
    Given the store holds a merge-conflict marker
    Then reading it gives the state "corrupt"
    And recording a review throws a "corrupt" error
    And the store file is left unchanged

  @test:scripts/tests/content/skill-voice-review.test.ts::reviews_in_the_attestation_store::recordReview_creates_the_subject's_file,_and_the_review_then_reads_back_current
  Scenario: recordReview creates the subject's store file and the review reads back current
    Given a skill and no store file in a nested directory
    When a current review is recorded
    Then the store reads back as "hit"
    And evaluating the skill against the voice passes
