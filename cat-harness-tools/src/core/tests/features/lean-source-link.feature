# src/core/lean-source-link.ts finds the line a Lean declaration is made on and
# builds the GitHub blob link to it at a pinned commit. Each Scenario names the test that executes it.
Feature: A block's Lean link points at the declaration's source on GitHub

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::a_dotted_name_is_found_by_its_last_segment_inside_its_namespace,_past_attributes_and_modifiers
  Scenario: A dotted name is found by its last segment inside its namespace, past attributes and modifiers
    Given a Lean source with namespace "QOU.Torsion" and "@[simp] noncomputable def lifting_exists" on line 7
    When the declaration line of "QOU.Torsion.lifting_exists" is looked up
    Then it is line 7

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::a_name_does_not_match_a_longer_one_that_starts_with_it
  Scenario: A name does not match a longer declared name that starts with it
    Given a Lean source declaring both "lifting_exists_aux" on line 5 and "lifting_exists" on line 7
    When the declaration line of "lifting_exists_aux" is looked up
    Then it is line 5
    And "foo" has no line in a source that declares only "foo_bar"

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::the_name_as_written_wins_over_its_last_segment
  Scenario: The name as written wins over its last segment
    Given a Lean source declaring "Bar.foo" on line 9 and "foo" on line 10
    When the declaration lines of "Bar.foo" and "foo" are looked up
    Then "Bar.foo" is line 9
    And "foo" is line 10

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::a_name_only_mentioned,_not_declared,_has_no_line
  Scenario: A name only mentioned, not declared, has no line
    Given a source that mentions "lifting_exists" only in a comment
    When its declaration line is looked up
    Then there is no line
    And an empty name has no line in any source

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::the_link_is_a_GitHub_blob_URL_at_the_commit,_with_the_line
  Scenario: The link is a GitHub blob URL at the commit, with the line
    Given the repository "https://github.com/litlfred/qou" and commit "77e7f0e"
    When the link to "folio/qou/lean/QOU/A.lean" at line 7 is built
    Then it is "https://github.com/litlfred/qou/blob/77e7f0e/folio/qou/lean/QOU/A.lean#L7"
    And with a trailing slash on the repository and the path "./a b.lean" and no line, it is ".../blob/77e7f0e/a%20b.lean"

  @test:src/core/tests/lean-source-link.test.ts::lean-source-link:_a_block's_Lean_link_is_the_declaration's_source_on_GitHub_(og5t,_ruling_A)::no_link_for_another_host,_a_moving_ref,_or_missing_facts
  Scenario: No link for another host, a moving ref, or missing facts
    Given a Lean file path and a repository URL and commit
    When the link is built
    Then there is none for a gitlab.com repository
    And there is none for the branch "main" instead of a commit
    And there is none when the repository URL, the commit or the path is missing
