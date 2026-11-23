# scripts/publish-instance-context.ts builds one layer's JSON-LD context, judged on its own
# findings only, works out where its vocabulary is served, and puts files on gh-pages through
# the GitHub REST API (faked in these tests). Each Scenario names the test that executes it.
Feature: Building and publishing an instance's JSON-LD context

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build::an_instance_is_judged_on_its_own_findings,_not_another_instance's
  Scenario: An instance is judged on its own findings, not another instance's
    Given layers base, top, bare and quiet, where top uses a prefix nobody binds
    When base's context is built
    Then it is built, served at "https://example.github.io/base/ns/context/v1.jsonld"
    And it binds "skos" to the SKOS core namespace

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build::an_unresolved_prefix_fails_the_instance_that_uses_it,_naming_file_and_prefix
  Scenario: An unresolved prefix fails the instance that uses it, naming the prefix
    # Gap: only the prefix is checked in the problems, not the file name
    Given layer top whose node uses the unbound prefix "nope"
    When top's context is built
    Then the build fails with a problem naming "nope"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build::no_iriBase,_or_no_documents,_is_a_skip_with_a_reason,_not_a_failure
  Scenario: No iriBase, or no documents, is a skip with a reason rather than a failure
    Given layer bare with nodes but no iriBase, and layer quiet with an iriBase but no nodes
    When each context is built
    Then bare is skipped with a reason mentioning "no iriBase"
    And quiet is skipped with a reason mentioning "no .jsonld documents"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build::an_unknown_instance_fails
  Scenario: An unknown instance fails
    Given no layer named "absent"
    When its context is built
    Then the build fails

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build::contextUrl_puts_exactly_one_slash_after_the_base
  Scenario: The context URL has exactly one slash after the base
    Given an iriBase with and without a trailing slash
    When the context URL is formed
    Then both give "https://x.github.io/y/ns/context/v1.jsonld"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::vocabulary_paths::served_where_its_@id_points,_under_the_iriBase,_in_three_spellings
  Scenario: A vocabulary is served where its @id points, under the iriBase, in three spellings
    Given a vocabulary @id ".../y/v0/ns" under iriBase ".../y/"
    When its paths are worked out
    Then they are "v0/ns", "v0/ns.jsonld" and "v0/ns.json"
    And a trailing "#" on the @id or no trailing slash on the base gives the same paths

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::vocabulary_paths::a_slash_namespace_is_a_directory:_served_as_its_index,_so_each_term_can_be_a_page_below_it
  Scenario: A slash namespace is served as a directory index
    Given a vocabulary @id ending in "v0/ns/"
    When its paths are worked out
    Then they are "v0/ns/index.html", "v0/ns/index.jsonld" and "v0/ns/index.json"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::vocabulary_paths::an_@id_outside_the_iriBase_is_refused:_that_Pages_site_cannot_serve_it
  Scenario: An @id outside the iriBase is refused
    Given a vocabulary @id on a different Pages site from the iriBase
    When its paths are worked out
    Then the problem says it is "not under the iriBase"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::vocabulary_paths::`ns`_itself_is_refused:_it_is_the_directory_holding_ns/context/v1.jsonld
  Scenario: An @id at ns itself is refused as the context directory
    Given vocabulary @ids ".../y/ns" and ".../y/ns/vocab"
    When their paths are worked out
    Then each problem says it "collides with the context directory"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::an_instance_whose_`ns`_is_a_document_(D1)::its_context_is_built_for,_and_served_at,_the_path_beside_the_vocabulary
  Scenario: An instance whose ns is a document has its context served beside the vocabulary
    Given layer doc whose ns.jsonld is a concept scheme at ".../doc/v0/ns"
    When doc's context is built
    Then it is built at path "ns.context.v1.jsonld"
    And served at "https://example.github.io/doc/ns.context.v1.jsonld"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::an_instance_whose_`ns`_is_a_document_(D1)::contextUrl_takes_the_path
  Scenario: The context URL takes a given path
    Given an iriBase and the path "ns.context.v1.jsonld"
    When the context URL is formed
    Then it is "https://x.github.io/y/ns.context.v1.jsonld"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::an_instance_whose_`ns`_is_a_document_(D1)::with_the_context_beside_it,_a_vocabulary_at_`ns`_collides_with_nothing;_at_the_context's_own_path_it_does
  Scenario: With the context beside it, a vocabulary at ns collides with nothing but one at the context's path does
    Given the context is published at "ns.context.v1.jsonld"
    When paths are worked out for a vocabulary at ".../y/ns"
    Then they are "ns", "ns.jsonld" and "ns.json"
    And a vocabulary at ".../y/ns.context.v1" is refused as "where the context is published"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::identical_content_on_gh-pages_is_unchanged,_and_nothing_is_written
  Scenario: Identical content on gh-pages is unchanged and nothing is written
    Given gh-pages exists and already holds the same context file
    When the context is published
    Then the result is "unchanged"
    And only GET requests were made

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::different_content_is_PUT_with_the_file's_sha,_on_gh-pages,_and_only_that_path
  Scenario: Different content is PUT with the file's sha, on gh-pages, for only that path
    Given gh-pages holds an older version of the context with sha "s1"
    When the context is published for commit "abcdef0123456789"
    Then the result is "updated"
    And the PUT body names branch gh-pages, sha "s1" and the new content
    And its message carries "abcdef012345"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::an_absent_file_is_added_without_a_sha
  Scenario: An absent file is added without a sha
    Given gh-pages exists but has no context file
    When the context is published
    Then the result is "updated"
    And the PUT body carries no sha

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::a_409_re-reads_and_retries_once
  Scenario: A 409 conflict re-reads the file and retries once
    Given the first PUT is answered 409 and a re-read gives a new sha
    When the context is published
    Then the second PUT succeeds and the result is "updated"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::an_absent_gh-pages_becomes_an_orphan_branch_with_.nojekyll,_the_context_and_the_placeholder_index
  Scenario: An absent gh-pages becomes an orphan branch with .nojekyll, the context and the placeholder index
    Given no gh-pages branch
    When the context is published
    Then the result is "created-branch"
    And the new tree holds an empty .nojekyll, the placeholder index.html and the context
    And the commit has no parents
    And the ref "refs/heads/gh-pages" is created at the new commit

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::a_gh-pages_created_meanwhile_(422)_is_not_overwritten:_the_file_is_written_onto_it
  Scenario: A gh-pages created meanwhile is not overwritten and the file is written onto it
    Given no gh-pages branch at first, but creating the ref is answered 422
    When the context is published
    Then the file is read and PUT onto the existing branch
    And the result is "updated"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::a_hash-IRI_vocabulary_file_where_the_slash_namespace_needs_a_directory_is_removed,_then_the_page_written
  Scenario: A hash-IRI vocabulary file blocking a slash-namespace directory is removed, then the page written
    Given a PUT of "v0/ns/index.html" is refused because a file exists at "v0/ns"
    And the file at v0/ns is JSON with sha "old"
    When the page is published
    Then the result is "updated" with detail "removed the file v0/ns"
    And the DELETE names sha "old" on gh-pages

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::a_blocking_file_that_is_not_JSON_is_left_for_a_person,_and_the_write_fails
  Scenario: A blocking file that is not JSON is left for a person and the write fails
    Given a PUT of "v0/ns/index.html" is refused because a file exists at "v0/ns"
    And the file at v0/ns is HTML, not JSON
    When the page is published
    Then the result is "failed" with detail "left for a person"
    And no DELETE was made

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::publish::a_failed_read_of_the_branch_is_a_failure,_never_a_guess
  Scenario: A failed read of the branch is a failure, never a guess
    Given reading the gh-pages branch is answered 403
    When the context is published
    Then the result is "failed" with detail mentioning "HTTP 403"

  @test:scripts/tests/sdlc/publish-instance-context.test.ts::build_--site::writes_the_context_into_a_site_being_built,_at_the_path_it_is_served_at
  Scenario: Build with a site directory writes the context at the path it is served at
    Given layer base and a site directory being built
    When the script is run as "build" for base with "--site"
    Then it exits 0
    And the site holds ns/context/v1.jsonld binding "skos" to the SKOS core namespace
