# Specifies schemas/kg/mount-trust.ts (H8): mountTrust, the trust and
# recorded-basis schemas, withConsent (task #10, gap c), and standing consent
# with withStandingConsent and standingCovers (cat-harness-tools#401).
Feature: A mount needs a verified signature or consent for its exact pin; staging needs neither

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::staging_mounts_with_no_signature_and_no_consent
  Scenario: Staging mounts with no signature and no consent
    Given a mount at a 40-character pin with no trust record
    When its trust is judged for "staging"
    Then it is allowed on the basis "staging"

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::unsigned_and_unconsented_is_REFUSED
  Scenario: An unsigned, unconsented mount is refused
    Given a mount with no trust record
    When its trust is judged for "mount"
    Then it is refused

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::consent_for_this_exact_pin_mounts
  Scenario: Consent for the exact pin mounts
    Given a mount whose consent names its own pin
    When its trust is judged for "mount"
    Then it is allowed on the basis "consent"

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::consent_for_a_different_pin_is_refused:_a_moved_pin_asks_again
  Scenario: Consent for a different pin is refused
    Given a mount whose consent names another pin
    When its trust is judged for "mount"
    Then it is refused

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::a_signature_with_no_verifier_is_could-not-determine,_never_trusted
  Scenario: A signature with no verifier cannot be determined
    Given a mount carrying a gdhcn signature and no consent
    When its trust is judged for "mount"
    Then it is not allowed, in the state "could-not-determine"

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::the_record_is_strict:_an_unknown_trust_key_does_not_validate
  Scenario: The trust record refuses an unknown key
    Given a trust record { trusted: true }
    When it is parsed with the trust schema
    Then it is refused
    And a consent record parses

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::the_verdict_carries_the_record_the_lock_keeps:_who,_when,_and_whether_the_approver_was_checked
  Scenario: The verdict carries the record the lock keeps
    Given a mount consented by "litlfred" for its own pin, and "litlfred" a declared approver
    When its trust is judged for "mount"
    Then it is allowed with approver "declared"
    And its record holds basis "consent", by, on, the pin and approver "declared"
    And a staging verdict's record holds basis "staging"

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::no_declared_approvers:_consent_proceeds_but_is_UNVERIFIED,_never_plain_clean
  Scenario: With no declared approvers, consent proceeds unverified
    Given a mount consented for its own pin
    When its trust is judged for "mount" with no approver list
    Then it is allowed with approver "unverified"
    And its detail says "UNVERIFIED APPROVER"
    And with an empty approver list the approver is also "unverified"

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::declared_approvers:_consent_by_anyone_else_is_refused
  Scenario: Consent by someone who is not a declared approver is refused
    Given a mount consented by "litlfred" for its own pin
    When its trust is judged for "mount" with the approvers ["someone-else"]
    Then it is refused

  @test:schemas/kg/mount-trust.test.ts::mount_trust_(H8):_signed_provenance_or_explicit_consent;_staging_needs_neither::the_recorded_basis_is_strict:_a_consent_basis_needs_who,_when,_the_pin_and_the_approver_state
  Scenario: A recorded consent basis needs who, when, the pin and the approver state
    When recorded bases are parsed
    Then { basis: "staging" } parses
    And a consent basis with by, on, ref and approver parses
    And a consent basis without approver is refused
    And { basis: "signature" } is refused

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::an_unconsented_mount_gains_consent_bound_to_ITS_ref,_and_then_mounts
  Scenario: Seeding consent binds it to the mount's own pin
    Given an unconsented mount and a grant by "litlfred" on 2026-10-12
    When consent is written with the grant
    Then the consent records by, on, the mount's pin and the evidence
    And the mount is then allowed on the basis "consent"

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::a_consent_for_a_moved_pin_is_replaced_by_the_new_grant
  Scenario: Consent for a moved pin is replaced
    Given a mount whose consent names another pin
    When consent is written with the grant
    Then the consent names the mount's pin and carries the grant's evidence

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::a_consent_already_recorded_for_this_pin_is_kept,_not_rewritten
  Scenario: Consent already recorded for the pin is kept
    Given a mount already consented for its own pin
    When consent is written with the grant
    Then the very same mount object is returned

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::a_signature_is_kept_beside_the_new_consent
  Scenario: A signature is kept beside new consent
    Given a mount carrying a signature and no consent
    When consent is written with the grant
    Then the signature is unchanged

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::an_empty_grant_throws_rather_than_writing_consent_nobody_can_read
  Scenario: An empty grant throws
    Given grants with an empty by, and with an empty evidence
    When consent is written with each
    Then each throws

  @test:schemas/kg/mount-trust.test.ts::withConsent:_seeding_writes_consent_for_the_pin_it_writes_(task_#10,_gap_c)::`on`_defaults_to_today
  Scenario: The consent date defaults to today
    Given a grant with no on date
    When consent is written with it
    Then the consent's on is today's UTC date

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::the_repin_writes_a_per-pin_consent_BY_the_rule's_person,_marked_with_the_rule,_and_it_mounts
  Scenario: A standing-consent repin writes consent by the rule's person and mounts
    Given a mount consented at one pin with a standing rule following "main", by "litlfred", requiring green
    When it is re-pinned under the rule to a new pin on 2026-10-17
    Then its ref is the new pin
    And its consent is by "litlfred" on 2026-10-17 for the new pin, marked with the rule
    And its trust record parses
    And it is allowed on the basis "consent" with "litlfred" as approver, and its record parses as a recorded basis

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::a_hand-moved_pin_is_still_refused_even_with_a_standing_rule_declared
  Scenario: A hand-moved pin is refused even with a standing rule
    Given a mount at a new pin whose consent, with a standing rule, names the old pin
    When its trust is judged for "mount"
    Then it is refused and its detail says "a moved pin asks again"

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::withdrawing_or_editing_the_rule_re-asks_every_pin_recorded_under_it
  Scenario: Withdrawing or editing the rule refuses the pins recorded under it
    Given a mount re-pinned under the standing rule
    When the rule is removed from its trust
    Then it is refused
    And it is refused when the rule's consentBy, consentAt, follows or require is changed

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::declared_approvers_still_apply_to_the_rule's_person
  Scenario: Declared approvers apply to the rule's person
    Given a mount re-pinned under the rule by "litlfred"
    When its trust is judged with the approvers ["someone-else"]
    Then it is refused

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::no_rule,_no_repin:_withStandingConsent_throws
  Scenario: Re-pinning without a standing rule throws
    Given a mount consented for its pin with no standing rule
    When it is re-pinned under standing consent
    Then it throws

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::coverage:_the_followed_branch,_and_green_when_the_rule_requires_it
  Scenario: The rule covers a new commit on the followed branch, green when required
    Given a mount with the standing rule following "main" and requiring green
    Then a new 40-character sha on main with verdict green is covered
    And verdicts pending or red, branch "dev", the current pin, or a short sha are not covered
    And with no requirement a new sha on main with no verdict is covered
    And a mount with no standing rule is not covered

  @test:schemas/kg/mount-trust.test.ts::standing_consent_(cat-harness-tools#401):_a_declared_rule_re-pins,_by_name,_and_nothing_else_moves_a_pin::the_rule_is_strict:_an_unknown_key_or_a_refs/_branch_does_not_validate
  Scenario: The standing rule is strict
    Given a trust record holding the standing rule
    Then it parses
    And with an unknown key, follows "refs/heads/main", or require "red" it is refused
