# Specifies schemas/sdlc/qa-review.ts: the rules that make a review auditable.
# Each Scenario removes one thing from an otherwise clean review and asserts
# that checkReview notices.
Feature: A QA review is auditable

  Background:
    Given a clean review of block "thm:foo" with one critical finding "f-mech" from a script, citing a file
    And an audit note "n-1" by a human that cites a witness
    And an approve decision "d-1" that considered "f-mech" and overrules it with note "n-1"

  @test:schemas/sdlc/qa-review.test.ts::the_baseline::a_clean_review_has_no_problems
  Scenario: A clean review has no problems
    When the review is checked
    Then no problems are reported

  @test:schemas/sdlc/qa-review.test.ts::the_baseline::it_parses
  Scenario: A clean review parses
    When it is parsed with the QA review schema
    Then it parses

  @test:schemas/sdlc/qa-review.test.ts::a_finding_carries_the_axis_its_reviewer_can_speak_on::a_mechanical_finding_with_no_severity_is_reported
  Scenario: A mechanical finding without severity is reported
    When the script finding has no severity
    Then the check reports "no severity"

  @test:schemas/sdlc/qa-review.test.ts::a_finding_carries_the_axis_its_reviewer_can_speak_on::a_human_finding_with_no_weight_is_reported
  Scenario: A human finding without weight is reported
    When the finding's reviewer is a human and it has neither severity nor weight
    Then the check reports "no weight"

  @test:schemas/sdlc/qa-review.test.ts::a_finding_carries_the_axis_its_reviewer_can_speak_on::praise_cannot_carry_a_machine_severity_—_the_machine_axis_has_no_good_outcome
  Scenario: Praise may not carry a machine severity
    When a human praise finding "f-praise" also carries severity "minor"
    Then the check reports a problem at "f-praise"

  @test:schemas/sdlc/qa-review.test.ts::a_finding_carries_the_axis_its_reviewer_can_speak_on::praise_needs_no_evidence,_while_every_other_finding_does
  Scenario: Praise needs no evidence, every other finding does
    When a human praise finding with no evidence is added
    Then no problems are reported
    And a script finding with no evidence is reported as "cites nothing"

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::a_decision_with_no_audit_note_is_reported
  Scenario: A decision without an audit note is reported
    When the decision records no notes
    Then the check reports "records no audit note"

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::approving_over_an_open_critical_finding_is_reported
  Scenario: Approving over an open critical finding is reported
    When the decision overrules nothing
    Then the check reports "Approved over open finding"

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::approving_over_an_open_blocking_human_finding_is_reported
  Scenario: Approving over an open blocking human finding is reported
    Given the only finding is a human finding "f-human" of weight "blocking"
    When the decision considers it but overrules nothing
    Then the check reports "Approved over open finding"

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::overruling_clears_it,_and_the_overruled_finding_stays_on_the_record
  Scenario: Overruling clears a finding, which stays on the record
    When the clean review is checked
    Then no problems are reported
    And "f-mech" is still among the findings
    And no finding is open

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::an_overrule_naming_an_audit_note_that_does_not_exist_is_reported
  Scenario: An overrule naming a missing audit note is reported
    When the decision overrules "f-mech" with note "n-missing"
    Then the check reports "n-missing"

  @test:schemas/sdlc/qa-review.test.ts::a_decision_is_an_act_about_findings,_not_a_finding::overruling_a_finding_that_was_never_considered_is_reported
  Scenario: Overruling an unconsidered finding is reported
    When the decision considers nothing but still overrules "f-mech"
    Then the check reports "not listed as considered"

  @test:schemas/sdlc/qa-review.test.ts::an_audit_note_cites::a_note_with_no_citations_is_reported
  Scenario: An audit note without citations is reported
    When the audit note cites nothing
    Then the check reports "cites nothing"

  @test:schemas/sdlc/qa-review.test.ts::an_audit_note_cites::an_agent_may_propose_the_citations_without_becoming_the_author
  Scenario: An agent may propose a note's citations without authoring it
    When the audit note is proposed by "authoring-agent"
    Then its author is still a human
    And no problems are reported

  @test:schemas/sdlc/qa-review.test.ts::citation_resolution_has_three_states::with_no_resolver_nothing_is_resolved
  Scenario: Without a resolver a citation is not checked
    When a file citation is resolved with no resolver
    Then its state is "not-checked"

  @test:schemas/sdlc/qa-review.test.ts::citation_resolution_has_three_states::a_resolver_that_cannot_answer_yields_not-checked,_never_resolved
  Scenario: A resolver that cannot answer leaves a citation not checked
    When a file citation is resolved by a resolver returning undefined
    Then its state is "not-checked"

  @test:schemas/sdlc/qa-review.test.ts::citation_resolution_has_three_states::a_resolver_that_answers_yields_resolved_or_dangling
  Scenario: A resolver that answers yields resolved or dangling
    When a file citation is resolved by a resolver returning true
    Then its state is "resolved"
    And with a resolver returning false its state is "dangling"

  @test:schemas/sdlc/qa-review.test.ts::openFindings::praise_is_never_open
  Scenario: Praise is never open
    When a human praise finding is added beside the overruled finding
    Then openFindings is empty

  @test:schemas/sdlc/qa-review.test.ts::openFindings::a_finding_nobody_decided_about_stays_open
  Scenario: A finding nobody decided about stays open
    When the review has no decisions
    Then openFindings is exactly "f-mech"
