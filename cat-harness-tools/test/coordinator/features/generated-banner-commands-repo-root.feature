# Specifies that every command named in the "Do not hand-edit" banner of a
# generated cat-harness docs page (read at HEAD, or from disk for a mounted
# page) is a script in the checkout's package.json.
Feature: A command a generated page's banner names is a command that exists

  @test:test/coordinator/generated-banner-commands-repo-root.test.ts::a_command_a_generated_page_names_is_a_command_that_exists::the_corpus_really_has_banners_—_otherwise_every_assertion_here_is_vacuous
  Scenario: The corpus has banners naming commands
    Given the cat-harness docs pages, read at HEAD or from the mount
    When their banner lines and the commands named in backticks are collected
    Then there is at least one banner line
    And at least one named command

  @test:test/coordinator/generated-banner-commands-repo-root.test.ts::a_command_a_generated_page_names_is_a_command_that_exists::every_named_command_resolves_to_a_package.json_script
  Scenario: Every named command is a package.json script
    Given the commands named in the banners
    When each is looked up among the checkout's scripts
    Then none is missing

  @test:test/coordinator/generated-banner-commands-repo-root.test.ts::a_command_a_generated_page_names_is_a_command_that_exists::`docs:pages:check`_in_particular_—_the_one_this_bean_was_opened_for
  Scenario: docs:pages:check is named and chains to the generator's own check
    Given the commands named in the banners and the checkout's scripts
    When "docs:pages:check" is looked up
    Then some banner names it
    And its script contains "publish-check.ts docs:pages"
    And the "docs:pages" script contains "gen-docs-pages.ts"
    And scripts/publish-check.ts contains "--check"
