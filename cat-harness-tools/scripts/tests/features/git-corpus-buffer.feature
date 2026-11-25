# schemas/sdlc/git-corpus.ts (gitCorpus) and bootstrap-tools' scripts/git-files.ts (gitFiles) list the
# git corpus; a listing larger than node's default 1 MiB spawn buffer must still be answered.
# Each Scenario names the test that executes it.
Feature: Corpus listings past node's default buffer

  @test:scripts/tests/git-corpus-buffer.test.ts::the_fixture_really_is_past_node's_default_buffer_—_otherwise_this_asserts_nothing
  Scenario: The fixture's listing really overflows node's default buffer
    Given a scratch git repository of long-named files whose listing exceeds 1 MiB plus 64 KiB
    When "git ls-files -z --cached --others --exclude-standard" is run with node's default buffer
    Then the counted listing bytes exceed 1 MiB
    And the spawn fails with an "ENOBUFS" error

  @test:scripts/tests/git-corpus-buffer.test.ts::gitCorpus_answers_over_a_listing_bigger_than_1_MiB
  Scenario: gitCorpus answers over a listing bigger than 1 MiB
    Given the scratch repository whose listing exceeds 1 MiB
    When gitCorpus lists it
    Then a list is returned with more than 5000 files

  @test:scripts/tests/git-corpus-buffer.test.ts::bootstrap's_gitFiles_answers_over_the_same_listing
  Scenario: bootstrap's gitFiles answers over the same listing
    Given the scratch repository whose listing exceeds 1 MiB
    When gitFiles lists it
    Then a list is returned with more than 5000 files

  @test:scripts/tests/git-corpus-buffer.test.ts::undefined_still_means_git_could_not_answer,_and_is_not_confused_with_a_big_corpus
  Scenario: A directory git cannot answer for still lists as undefined
    Given a path that does not exist
    When gitCorpus and gitFiles list it
    Then both return undefined
