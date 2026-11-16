# scripts/harness-dirs.ts in a rooted checkout: notThisCheckouts excuses a harness's repository-scoped directory the root instance does not declare,
# and the scope-trap guard in materialiseDirectories refuses an empty repository-scoped twin of an undeclared instance directory with content.
# Each Scenario names the test that executes it.
Feature: Harness directories in a rooted checkout

  @test:scripts/tests/harness-dirs-rooted.test.ts::notThisCheckouts::a_harness's_checkout-level_directory_the_root_does_not_declare_is_excused,_with_a_reason
  Scenario: A repository-scoped directory the root does not declare is excused with a reason
    Given a root instance "top" needing a harness "h" that declares an instance "uploads" and a repository-scoped "checkout-uploads", both at "uploads/"
    And the root declares no directories
    When notThisCheckouts is asked about "checkout-uploads" for the harness
    Then the reason names "top"

  @test:scripts/tests/harness-dirs-rooted.test.ts::notThisCheckouts::declared_by_the_root,_it_is_the_checkout's_and_judged_as_before
  Scenario: A repository-scoped directory the root declares is not excused
    Given the same rooted checkout where the root also declares "checkout-uploads"
    When notThisCheckouts is asked about "checkout-uploads" for the harness
    Then no excuse is returned

  @test:scripts/tests/harness-dirs-rooted.test.ts::notThisCheckouts::an_instance-scoped_entry_is_never_excused
  Scenario: An instance-scoped entry is never excused
    Given the rooted checkout where the root declares no directories
    When notThisCheckouts is asked about the instance-scoped "uploads"
    Then no excuse is returned

  @test:scripts/tests/harness-dirs-rooted.test.ts::notThisCheckouts::with_the_harness_as_the_checkout's_root,_nothing_is_excused
  Scenario: With the harness as the checkout's root nothing is excused
    Given the rooted checkout with "top.json" removed and the harness given its own ".git/HEAD"
    When notThisCheckouts is asked about "checkout-uploads" for the harness
    Then no excuse is returned

  @test:scripts/tests/harness-dirs-rooted.test.ts::the_scope-trap_guard::a_declared_instance_twin_is_a_second_directory_on_purpose,_not_a_wrong_scope
  Scenario: A declared instance twin passes the scope-trap guard
    Given the harness declares instance "uploads" and repository-scoped "checkout-uploads" at the same path, with "uploads/item.md" present
    When materialiseDirectories runs as a dry run over the harness's resolved directories
    Then it does not throw

  @test:scripts/tests/harness-dirs-rooted.test.ts::the_scope-trap_guard::an_undeclared_twin_with_content_is_still_refused
  Scenario: An undeclared twin with content is refused by the scope-trap guard
    Given the harness declares only the repository-scoped "checkout-uploads", with "uploads/item.md" present
    When materialiseDirectories runs as a dry run over the harness's resolved directories
    Then it throws a message matching "wrong"
