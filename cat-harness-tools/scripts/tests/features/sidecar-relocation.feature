# A relocated subject's QA sidecar moves with it, and refuses to move on
# anything less than proof. Each Scenario names the test that executes it.
Feature: Relocating QA sidecars with their subject

  @test:scripts/tests/sidecar-relocation.test.ts::sweepOrphans_carries_the_identity_a_relocation_matches_on::`kind`_and_`id`_come_back,_not_just_the_path
  Scenario: The orphan sweep returns kind and id
    Given a sidecar for skill corpus-grep whose subject file is gone
    When orphans are swept
    Then the orphan has kind "skill", id "corpus-grep" and its subject does not exist

  @test:scripts/tests/sidecar-relocation.test.ts::sweepOrphans_carries_the_identity_a_relocation_matches_on::an_unreadable_sidecar_yields_NO_identity_—_the_third_state_survives
  Scenario: An unreadable sidecar yields no identity
    Given a sidecar that is not valid JSON
    When orphans are swept
    Then its kind, id and subject existence are all undefined

  @test:scripts/tests/sidecar-relocation.test.ts::sweepOrphans_carries_the_identity_a_relocation_matches_on::a_sidecar_whose_subject_still_EXISTS_is_not_a_relocation_candidate
  Scenario: A sidecar whose subject exists says so
    Given a sidecar whose subject file exists
    When orphans are swept
    Then its subject exists

  @test:scripts/tests/sidecar-relocation.test.ts::the_three_conditions::a_moved_subject's_sidecar_is_relocated,_and_the_verdict_is_the_OLD_one
  Scenario: A moved subject's sidecar is chosen for relocation
    # Gap: the relocation rule exercised is a copy written inside the test, not kg-audit's relocateSidecars, so a change to the real rule cannot fail it.
    # Gap: nothing is moved; "the verdict is the OLD one" is read from the untouched source file, so that assertion cannot fail.
    Given an orphaned corpus-grep sidecar and the skill now at a new path
    When the test's relocation rule runs with that destination
    Then one move to the destination is planned
    And the source sidecar still holds the old verdict

  @test:scripts/tests/sidecar-relocation.test.ts::the_three_conditions::REFUSED_when_the_subject's_absence_could_not_be_established
  Scenario: No relocation when the subject's absence is unknown
    # Gap: exercises the test's own copy of the relocation rule, not kg-audit's relocateSidecars.
    Given only an unreadable sidecar
    When the test's relocation rule runs
    Then nothing is moved

  @test:scripts/tests/sidecar-relocation.test.ts::the_three_conditions::REFUSED_on_a_basename_match_with_a_different_identity
  Scenario: No relocation on a basename match with another identity
    # Gap: exercises the test's own copy of the relocation rule, not kg-audit's relocateSidecars.
    Given an orphan for pkg-a-shared and a destination keyed skill:pkg-b-shared with the same file name
    When the test's relocation rule runs
    Then nothing is moved

  @test:scripts/tests/sidecar-relocation.test.ts::the_three_conditions::REFUSED_when_two_orphans_share_one_identity_—_ambiguity_is_left_alone
  Scenario: No relocation when two orphans share an identity
    # Gap: exercises the test's own copy of the relocation rule, not kg-audit's relocateSidecars.
    Given two orphans both for skill dup
    When the test's relocation rule runs
    Then nothing is moved

  @test:scripts/tests/sidecar-relocation.test.ts::the_three_conditions::REFUSED_when_a_sidecar_already_sits_at_the_destination
  Scenario: No relocation onto an existing sidecar
    # Gap: exercises the test's own copy of the relocation rule, not kg-audit's relocateSidecars.
    Given an orphan for skill x and a sidecar already at its destination
    When the test's relocation rule runs
    Then nothing is moved and the destination keeps its content
