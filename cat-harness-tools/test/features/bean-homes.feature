# scripts/lib/bean-homes.ts gives each bean one home store and marks cat-harness's bean
# branch as retired; scripts/state-push.ts refuses bean writes to it (#459).
# Each Scenario names the test that executes it.
Feature: Bean homes

  @test:test/bean-homes.test.ts::bean_homes_(#459)::repoOfUrl_reads_https,_ssh_and_proxy_remotes
  Scenario: The repository is read from https, ssh and proxy remote URLs
    Given an https GitHub remote, an ssh "git@github.com:" remote and a local proxy "/git/" remote with a trailing newline
    When the repository of each URL is read
    Then each gives "litlfred/cat-harness"

  @test:test/bean-homes.test.ts::bean_homes_(#459)::only_cat-harness's_bean_branch_is_retired
  Scenario: Only cat-harness's bean branch is the retired store
    Given the repository "litlfred/cat-harness" and branch "cat/cat-harness/beans"
    When the retired bean store is looked up
    Then it is the "cat-harness" store
    And another repository, another branch "cat/cat-harness/todos", or no repository gives none

  @test:test/bean-homes.test.ts::bean_homes_(#459)::isBeanFile_matches_bean_files_under_defs_only
  Scenario: Bean files are recognised only under beans/defs
    Given paths under beans/defs, beans/defs/archive, a beans/defs README and beans/notes
    When each is tested as a bean file
    Then the defs and defs/archive bean files match
    And "beans/defs/README.md" and the beans/notes file do not

  @test:test/bean-homes.test.ts::bean_homes_(#459)::oneHomeProblems_flags_duplicates_and_retired-store_beans
  Scenario: A bean in two stores, or in the retired store, is flagged
    Given stores where every bean is in one live store
    Then no problem is reported
    Given bean "a" in folio-assistant and cat-harness-tools, and bean "c2" in cat-harness
    When the one-home problems are listed
    Then they are "a is in 2 stores: folio-assistant, cat-harness-tools" and "c2 is in cat-harness, which keeps no beans any more"

  @test:test/bean-homes.test.ts::bean_homes_(#459)::state:push_refuses_bean_writes_to_the_retired_store_but_allows_deletes
  Scenario: state:push refuses a bean write to the retired store but allows a delete
    Given the "beans" location on branch "cat/cat-harness/beans" of "litlfred/cat-harness"
    When a bean file under beans/defs is written there
    Then the write is refused with a message containing "keeps no bean files"
    And deleting that bean file is allowed
    And writing a beans/notes file is allowed
    And the same write to folio-assistant, or to a location with id "todos", is allowed
