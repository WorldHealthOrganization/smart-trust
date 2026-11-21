# pipeline/qa-utils.ts (gitFileCommitSha) gives the commit that last touched a file for QA sidecars, and in a
# shallow clone it declines rather than reporting the graft boundary. Each Scenario names the test that executes it.
Feature: File provenance refuses to guess in a shallow clone

  @test:scripts/tests/git-provenance-shallow.test.ts::git_provenance::a_full_clone_answers_with_the_real_commit
  Scenario: A full clone answers with the real commit
    Given a full repository where the first commit adds "early.txt" and a second adds "later.txt"
    And the repository reports itself not shallow
    When gitFileCommitSha is asked about "early.txt"
    Then it returns the first commit's sha

  @test:scripts/tests/git-provenance-shallow.test.ts::git_provenance::a_shallow_clone_declines_rather_than_reporting_the_boundary
  Scenario: A shallow clone declines rather than reporting the boundary commit
    Given a depth-1 clone of that repository, which reports itself shallow
    And raw "git log -1" for "early.txt" there gives a root of the truncated history, not the first commit
    When gitFileCommitSha is asked about "early.txt" in the clone
    Then it returns the unknown sha marker

  @test:scripts/tests/git-provenance-shallow.test.ts::git_provenance::a_file_absent_from_the_repository_is_unknown,_not_invented
  Scenario: A file absent from the repository is unknown
    Given the full repository
    When gitFileCommitSha is asked about "no-such-file.txt"
    Then it returns the unknown sha marker
