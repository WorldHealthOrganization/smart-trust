# Specifies gitScan (schemas/sdlc/git-corpus.ts) over this checkout for the
# pattern "**/library/*/manifest.jsonld", against a bare glob walk.
Feature: gitScan reads git's corpus and loses nothing the old bare walk admitted

  @test:test/coordinator/git-scan-repo-root.test.ts::check-source-licence's_corpus,_over_this_repository::it_reads_git's_corpus,_and_the_pattern_it_reads_is_unchanged
  Scenario: gitScan's library manifests are all found by the bare walk too
    Given the checkout and the pattern "**/library/*/manifest.jsonld"
    When it is scanned with gitScan and with a bare glob that skips node_modules and ingest-staging
    Then gitScan's source is "git"
    And every file gitScan finds is also found by the bare glob
    And gitScan finds at least one file
