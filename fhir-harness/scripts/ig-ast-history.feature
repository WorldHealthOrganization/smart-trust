Feature: The AST versions a resource's History view lists (fhir-harness#329)

  @test:scripts/ig-ast-history.test.ts::reading_the_seeds::seedSourceFromSubject
  Scenario: a seed's subject names the source commit it was compiled from
    Then "src <sha8>" at the end of an AST seed's subject is its source, and another subject has none

  @test:scripts/ig-ast-history.test.ts::reading_the_seeds::parseSeedLogSkipsOthers
  Scenario: only AST seeds are versions
    Given a log with a seed, another commit and a garbage line
    Then only the seed is a version, with its commit, date and source

  @test:scripts/ig-ast-history.test.ts::reading_the_seeds::tagsPeeledAndMatchedByPrefix
  Scenario: an annotated tag names the commit it points at, and a version takes the tags on its source
    Then the peeled commit carries both tags, the tag object's sha carries none
    And a version whose recorded source is a prefix of that commit takes them, and names the AST commit of each

  @test:scripts/ig-ast-history.test.ts::the_cache_branch's_history_and_the_IG's_tags_(#326_keeps_every_seed)::readsSeedsAndTags
  Scenario: the versions behind the built commit, newest first, with the release tags
    Given a remote with two seeds on the cache branch and a tag on the first one's source
    When the history is read from the second seed
    Then both seeds are listed newest first and the first carries the tag

  @test:scripts/ig-ast-history.test.ts::the_cache_branch's_history_and_the_IG's_tags_(#326_keeps_every_seed)::releasesNameTheirAstCommit
  Scenario: releases.json names the AST commit compiled from each release's tag, and drops one it cannot name
    Then the tagged release names the first seed and the other release keeps no ast

  @test:scripts/ig-ast-history.test.ts::the_cache_branch's_history_and_the_IG's_tags_(#326_keeps_every_seed)::unreadableGivesNone
  Scenario: a commit the remote does not have gives no history
    Then reading the history from an unknown commit gives none
