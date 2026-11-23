# Specifies resolveQaLocation (scripts/qa-store.ts) and the .gitignore rules
# over the real declarations: QA directories are stored and ignored, while
# attestations are not ignored by cat-harness's own .gitignore.
Feature: QA working copies are stored and ignored; attestations stay committed

  @test:test/coordinator/directory-storage-checkout.test.ts::the_real_declarations_(bean_5hox)::every_declared_qa_directory_is_stored,_and_every_stored_working_copy_is_ignored
  Scenario: Every declared QA directory is stored and its working copy is ignored
    Given the checkout root
    When the QA location is resolved
    Then it is declared and has at least one directory
    And every directory declares storage
    And git, asked at the checkout root, ignores a probe file in every directory

  @test:test/coordinator/directory-storage-checkout.test.ts::the_real_declarations_(bean_5hox)::attestations_are_never_ignored:_they_stay_on_main_(ruling_D2_(a))
  Scenario: cat-harness's .gitignore does not ignore attestations
    Given a throwaway git repository holding only a copy of cat-harness's .gitignore
    When git is asked whether "test/attestations/kg-qa/probe.attestations.json" is ignored
    Then it answers not ignored (exit status 1)
