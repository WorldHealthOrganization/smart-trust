# schemas/sdlc/git-corpus.ts (gitCorpus) and bootstrap-tools' gitFiles must answer a git listing larger than
# 1 MiB instead of reporting that git could not answer. Each Scenario names the test that executes it.
Feature: A git listing larger than 1 MiB is answered

  @test:scripts/tests/git-corpus-large-listing.test.ts::a_>1_MiB_git_listing_is_answered::gitCorpus_and_gitFiles_both_return_every_file
  Scenario: gitCorpus and gitFiles both return every file of a large listing
    Given a fresh repository holding 5000 untracked files with 215-character names, about 1.1 MB of listing
    When gitCorpus and gitFiles list it
    Then gitCorpus returns a list of 5000 files
    And gitFiles returns a list of 5000 files
