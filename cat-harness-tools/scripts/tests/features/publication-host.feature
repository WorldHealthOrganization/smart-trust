# publication.host: a declared axis with a third state ("none"), and the one
# cross-file conflict it makes possible with readme.linkStyle (issue #363).
# Each Scenario names the test that executes it.
Feature: The declared publication host and its link-style conflict

  @test:scripts/tests/publication-host.test.ts::reading_the_declared_host::%s_round-trips
  Scenario: Every publication host round-trips
    Given a layer whose declaration has publication.host set to each known host in turn
    When the publication host is read
    Then it is that host

  @test:scripts/tests/publication-host.test.ts::reading_the_declared_host::`none`_is_a_declared_answer,_not_an_absent_one
  Scenario: "none" is a declared answer, not an absent one
    Given a layer declaring publication.host "none" and a layer with no publication block
    When the publication host of each is read
    Then the first is "none" and the second is undefined

  @test:scripts/tests/publication-host.test.ts::reading_the_declared_host::%s_reads_as_undefined,_never_as_github-pages
  Scenario: An undeclared, unknown, non-string or unparseable host reads as undefined
    Given declarations with no publication block, host "carrier-pigeon", host 7, and malformed JSON
    When the publication host of each is read
    Then each is undefined

  @test:scripts/tests/publication-host.test.ts::reading_the_declared_host::a_missing_harness.json_is_undefined_rather_than_a_throw
  Scenario: A missing declaration reads as undefined rather than throwing
    Given an empty directory
    When its publication host is read
    Then it is undefined

  @test:scripts/tests/publication-host.test.ts::the_host_/_linkStyle_conflict::%s_with_linkStyle_pages_is_a_conflict,_and_the_message_says_how_to_fix_it
  Scenario: A non-Pages host with linkStyle pages is a conflict that says how to fix it
    Given each of the hosts "local-server", "jurisdiction-endpoint" and "none"
    When it is checked against linkStyle "pages"
    Then there is a message naming the host, "linkStyle" and "blob"

  @test:scripts/tests/publication-host.test.ts::the_host_/_linkStyle_conflict::github-pages_with_linkStyle_pages_is_exactly_right
  Scenario: github-pages with linkStyle pages is no conflict
    When host "github-pages" is checked against linkStyle "pages"
    Then there is no conflict

  @test:scripts/tests/publication-host.test.ts::the_host_/_linkStyle_conflict::linkStyle_%s_is_not_ruled_on_for_any_host
  Scenario: Other link styles are not ruled on for any host
    Given each linkStyle of "blob", "raw" and none
    When it is checked against every publication host
    Then there is never a conflict

  @test:scripts/tests/publication-host.test.ts::the_host_/_linkStyle_conflict::an_undeclared_host_never_conflicts
  Scenario: An undeclared host never conflicts
    When an undefined host is checked against linkStyle "pages"
    Then there is no conflict

  @test:scripts/tests/publication-host.test.ts::the_host_/_linkStyle_conflict::`raw`_is_unruled_because_visibility_is_not_declarable
  Scenario: linkStyle raw is unruled
    When host "local-server" is checked against linkStyle "raw"
    Then there is no conflict

  @test:scripts/tests/publication-host.test.ts::this_repository's_own_declaration::its_host_and_link_style_do_not_contradict_each_other
  Scenario: This repository's host and link style do not contradict each other
    # Gap: when the harness config cannot be resolved the link style is undefined, and an undefined style never conflicts, so the test then passes without checking anything.
    Given this repository's resolved harness config and its readme.linkStyle
    When its publication host is checked against that link style
    Then there is no conflict
