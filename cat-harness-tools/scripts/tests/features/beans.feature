# scripts/beans.ts reads the bean store: it unescapes front matter, normalises
# `blocking:` and `blocked_by:` into one edge set, and computes block findings.
# Each Scenario names the test that executes it.
Feature: Bean reader, block edges and findings

  @test:scripts/tests/beans.test.ts::front_matter_is_unescaped,_not_merely_unquoted::a_YAML_single-quoted_scalar_undoubles_its_apostrophes
  Scenario: A single-quoted title has its doubled apostrophes undoubled
    Given a bean store holding a bean titled 'KG: the knowledge graph''s own structure' in single quotes
    When the beans are read
    Then the bean's title is "KG: the knowledge graph's own structure"

  @test:scripts/tests/beans.test.ts::front_matter_is_unescaped,_not_merely_unquoted::a_double-quoted_scalar_undoes_its_backslashes_instead
  Scenario: A double-quoted title has its backslash escapes undone
    Given a bean store holding a double-quoted title with backslash-escaped quotes around "quoted"
    When the beans are read
    Then the bean's title is: a "quoted" word

  @test:scripts/tests/beans.test.ts::front_matter_is_unescaped,_not_merely_unquoted::an_unquoted_scalar_is_left_exactly_as_written
  Scenario: An unquoted title is read exactly as written
    Given a bean store holding a bean with the unquoted title "plain title"
    When the beans are read
    Then the bean's title is "plain title"

  @test:scripts/tests/beans.test.ts::front_matter_is_unescaped,_not_merely_unquoted::a_lone_apostrophe_inside_an_unquoted_scalar_survives
  Scenario: A lone apostrophe in an unquoted title is kept
    Given a bean store holding a bean with the unquoted title "don't strip me"
    When the beans are read
    Then the bean's title is "don't strip me"

  @test:scripts/tests/beans.test.ts::`file`_is_relative_to_the_root_it_was_read_with::no_repository-name_prefix,_so_an_edit_link_resolves
  Scenario: A bean's file path is relative to the root it was read from
    Given a bean store with a bean file "a.md" under beans/defs
    When the beans are read from that root
    Then the bean's file is "beans/defs/a.md", with no repository-name prefix

  @test:scripts/tests/beans.test.ts::no_store_is_not_an_empty_store::a_repository_with_no_bean_graph_reads_as_null
  Scenario: A repository with no bean store reads as null
    Given an empty temporary directory with no bean graph
    When the beans are read
    Then the result is null

  @test:scripts/tests/beans.test.ts::no_store_is_not_an_empty_store::a_declared_store_with_no_beans_in_it_reads_as_an_empty_list
  Scenario: A declared bean store with no beans reads as an empty list
    Given a declared bean store with no bean files
    When the beans are read
    Then the result is an empty list

  @test:scripts/tests/beans.test.ts::`blocking:`_names_the_blocked,_and_sits_on_the_blocker::the_sequence_is_read_off_the_blocker
  Scenario: The blocking list is read off the blocker bean
    Given bean "t-a" declares "blocking: t-b" and bean "t-b" declares nothing
    When the beans are read
    Then "t-a" has blocking ["t-b"]
    And "t-b" has an empty blocking list

  @test:scripts/tests/beans.test.ts::`blocking:`_names_the_blocked,_and_sits_on_the_blocker::blockedBy_inverts_it,_so_the_blocked_bean_can_name_its_blocker
  Scenario: blockedBy maps the blocked bean to its blocker
    Given bean "t-a" declares "blocking: t-b"
    When blockedBy is computed over the beans
    Then "t-b" maps to ["t-a"]
    And "t-a" has no entry

  @test:scripts/tests/beans.test.ts::an_expiry_is_prose_in_the_body,_not_a_field::it_is_found_wherever_in_the_body_it_is_written
  Scenario: An expiry is found in the bean body prose
    Given bean "t-a" whose body says "Waiting. **expires**: 2026-10-19."
    And bean "t-b" whose body says "Waiting on the owner."
    When hasExpiry is asked of each
    Then it is true for "t-a" and false for "t-b"

  @test:scripts/tests/beans.test.ts::findings::a_live_block_with_no_expiry_is_reported_once_per_bean_it_blocks
  Scenario: A live block with no expiry is reported once
    Given an in-progress bean "t-a" blocking the todo bean "t-b", with no expiry
    When the bean findings are computed
    Then there is exactly one finding
    And it is "blocked-without-expiry" on bean "t-a", blocking "t-b"

  @test:scripts/tests/beans.test.ts::findings::a_live_block_that_STATES_an_expiry_is_not_reported
  Scenario: A live block that states an expiry is not reported
    Given an in-progress bean "t-a" blocking the todo bean "t-b", whose body states "**expires**: 2026-10-19."
    When the bean findings are computed
    Then there are no findings

  @test:scripts/tests/beans.test.ts::findings::a_live_block_on_a_bean_that_is_already_CLOSED_is_not_reported
  Scenario: A live block on an already completed bean is not reported
    Given an in-progress bean "t-a" with no expiry blocking the completed bean "t-b"
    When the bean findings are computed
    Then there are no findings

  @test:scripts/tests/beans.test.ts::findings::a_block_between_two_beans_under_ONE_parent_is_sequencing,_and_needs_no_expiry
  Scenario: A block between siblings under one parent needs no expiry
    Given bean "t-a" under epic "t-e" blocks "t-b" under "t-e" and "t-c" under another epic "t-f", with no expiry
    When the bean findings are computed
    Then the only finding is "blocked-without-expiry" on "t-a" blocking "t-c"

  @test:scripts/tests/beans.test.ts::findings::a_CLOSED_blocker_holding_an_OPEN_bean_is_the_sharper_finding,_and_only_that_one
  Scenario: A completed blocker holding an open bean is reported as blocker-closed only
    Given a completed bean "t-a" blocking the in-progress bean "t-b"
    When the bean findings are computed
    Then the finding kinds are exactly ["blocker-closed"]

  @test:scripts/tests/beans.test.ts::findings::a_CLOSED_blocker_holding_a_DRAFT_bean_is_reported_too
  Scenario: A completed blocker holding a draft bean is reported
    Given a completed bean "t-a" and a draft bean "t-b" declaring "blocked_by: t-a"
    When the bean findings are computed
    Then the only finding is "blocker-closed" on "t-a" blocking "t-b"
    And its detail contains "which is draft"

  @test:scripts/tests/beans.test.ts::findings::a_DRAFT_blocker_is_not_a_closed_one
  Scenario: A draft blocker is not treated as closed
    Given a draft bean "t-a" with an expiry blocking the todo bean "t-b"
    When the bean findings are computed
    Then there is no "blocker-closed" finding

  @test:scripts/tests/beans.test.ts::findings::a_closed_blocker_holding_a_CLOSED_bean_is_nobody's_problem
  Scenario: A completed blocker holding a completed bean is not reported
    Given a completed bean "t-a" blocking the completed bean "t-b"
    When the bean findings are computed
    Then there are no findings

  @test:scripts/tests/beans.test.ts::findings::blocking_a_bean_that_does_not_exist_is_its_own_finding
  Scenario: Blocking a bean that does not exist is reported
    Given bean "t-a" with an expiry declaring "blocking: t-gone", and no bean "t-gone"
    When the bean findings are computed
    Then the finding kinds are exactly ["blocking-unknown"]

  @test:scripts/tests/beans.test.ts::findings::nothing_time-relative_is_computed,_so_the_same_store_gives_the_same_findings
  Scenario: The same store gives the same findings each time
    Given an in-progress bean "t-a" blocking the todo bean "t-b"
    When the bean findings are computed twice over the same beans
    Then both results serialise to identical JSON
    # Gap: both computations run moments apart; a clock-dependent finding that does not change within that window would pass

  @test:scripts/tests/beans.test.ts::isOpen::todo_and_in-progress_are_work;_completed_and_scrapped_are_history
  Scenario: Only todo and in-progress beans are open
    Given beans with status todo, in-progress, completed and scrapped
    When the beans are filtered by isOpen
    Then only the todo and in-progress beans "t-a" and "t-b" remain

  @test:scripts/tests/beans.test.ts::ONE_edge_set_over_`blocking:`_and_`blocked_by:`_(bean_vhqq)::both_declarations_normalise_to_blocker_→_blocked,_deduplicated
  Scenario: Both block declarations normalise to one deduplicated edge set
    Given beans declaring blocks from the blocker end, the blocked end, and both ends
    When the block edges are computed
    Then the edges are "t-a>t-b", "t-c>t-b", "t-c>t-d" and "t-gone>t-d"
    And the "t-c>t-d" edge, declared from both ends, is declared on ["blocked_by", "blocking"]

  @test:scripts/tests/beans.test.ts::ONE_edge_set_over_`blocking:`_and_`blocked_by:`_(bean_vhqq)::blockedBy_and_blocksOf_read_the_union,_not_`blocking:`_alone
  Scenario: blockedBy and blocksOf read edges from both declarations
    Given the same beans declaring blocks from both ends
    When blockedBy and blocksOf are computed
    Then "t-b" is blocked by ["t-a", "t-c"]
    And "t-c" blocks ["t-b", "t-d"]

  @test:scripts/tests/beans.test.ts::ONE_edge_set_over_`blocking:`_and_`blocked_by:`_(bean_vhqq)::a_dangling_edge_is_reported,_never_dropped
  Scenario: A dangling block edge is reported
    Given bean "t-d" declares "blocked_by: t-gone" and no bean "t-gone" exists
    When the block edges and findings are computed
    Then the dangling edges are exactly t-gone to t-d, declared on blocked_by, missing the blocker
    And the "blocking-unknown" findings are exactly "t-gone>t-d"

  @test:scripts/tests/beans.test.ts::ONE_edge_set_over_`blocking:`_and_`blocked_by:`_(bean_vhqq)::a_blocked_by_edge's_expiry_is_looked_for_on_the_bean_that_declared_it
  Scenario: A blocked_by edge's expiry is read from the declaring bean
    Given a todo bean "t-b" declaring "blocked_by: t-c" with "**expires**: 2026-11-01." in its body
    And an in-progress bean "t-c" with no expiry
    When the bean findings are computed
    Then there are no findings

  @test:scripts/tests/beans.test.ts::the_REAL_corpus:_the_edge_set_is_exactly_the_union_of_both_declarations::the_corpus_declares_edges_from_both_ends_(else_this_test_proves_nothing)
  Scenario: The real bean corpus declares blocks from both ends
    # Skipped: when the bean store is not mounted (cat-harness standing alone)
    Given the composed checkout's bean defs and archive
    When their front matter is walked line by line
    Then at least one "blocking:" entry is declared
    And at least one "blocked_by:" entry is declared

  @test:scripts/tests/beans.test.ts::the_REAL_corpus:_the_edge_set_is_exactly_the_union_of_both_declarations::blockEdges(readBeans)_has_exactly_the_union's_edges
  Scenario: The real corpus's edge set equals the union of both declarations
    # Skipped: when the bean store is not mounted (cat-harness standing alone)
    Given the union of edges parsed independently from the bean defs front matter
    When blockEdges is computed over readBeans of the repository
    Then it has the same number of edges as the union
    And the same set of blocker>blocked pairs

  @test:scripts/tests/beans.test.ts::the_REAL_corpus:_the_edge_set_is_exactly_the_union_of_both_declarations::...and_so_does_blockEdges(readArchivedBeans)_over_the_archive_view
  Scenario: The archive view's edge set equals the union of both declarations
    # Skipped: when the bean store is not mounted (cat-harness standing alone)
    Given the union of edges parsed independently from the bean archive's front matter
    When blockEdges is computed over readArchivedBeans of the repository
    Then it has the same number of edges as the union
    And the same set of blocker>blocked pairs

  @test:scripts/tests/beans.test.ts::readBeans_skips_README.md_even_when_it_carries_generated_YAML_front_matter::beans/defs/README.md_with_a_`generated:`_fence_is_not_returned_as_a_bean
  Scenario: A README.md with generated front matter is not read as a bean
    Given a bean store holding bean "t-a" and a README.md whose front matter has a "generated:" key
    When the beans are read
    Then only "t-a" is returned
