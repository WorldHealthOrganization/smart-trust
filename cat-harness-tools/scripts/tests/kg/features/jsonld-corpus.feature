# What scripts/tests/kg/jsonld-corpus.test.ts covers: contentDocuments in scripts/lib/jsonld-corpus.ts lists
# the repository's .jsonld documents as git accounts for them. Each Scenario names the test that executes it.
Feature: The .jsonld corpus is what git accounts for

  @test:scripts/tests/kg/jsonld-corpus.test.ts::the_.jsonld_corpus::the_real_repository_HAS_a_corpus,_so_a_check_over_it_is_not_vacuous
  Scenario: The real repository has a non-trivial .jsonld corpus
    Given the real repository
    When its content documents are listed
    Then there are more than 100

  @test:scripts/tests/kg/jsonld-corpus.test.ts::the_.jsonld_corpus::the_corpus_is_what_GIT_accounts_for_—_ignored_out,_unstaged_in
  Scenario: Gitignored documents are left out and unstaged ones are kept
    Given a git repository ignoring "staging/" with staging/residue.jsonld, a tracked content/tracked.jsonld and an untracked content/unstaged.jsonld
    When its content documents are listed
    Then they are exactly "content/tracked.jsonld" and "content/unstaged.jsonld"
