# scripts/stage-local.ts publishes a build locally as the main site or a preview, and
# scripts/site-publisher.ts picks the publisher from the repository's own workflows.
# Each Scenario names the test that executes it.
Feature: stage-local publisher choice and main-site publishing

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::a_caller_of_folio-staging.yml_is_a_folio;_a_caller_of_a_declared_publisher's_workflow_is_that_publisher's_kind
  Scenario: A folio-staging caller is a folio; a declared publisher's caller is that publisher's kind
    Given the folio publisher and a stand-in "ig" publisher on offer
    When a repository whose staging.yml calls folio-staging.yml@main is read
    Then its publisher is "folio", caller "staging.yml", using "folio-staging.yml" at "main"
    When a repository whose fhirbuild.yml calls WorldHealthOrganization/smart-base fhirbuild.yml is read
    Then its publisher is "ig", using owner "WorldHealthOrganization", repo "smart-base", file "fhirbuild.yml"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::a_pinned_uses:_line_with_a_trailing_comment_is_still_read_(smart-trust's_`@<sha>_#_main`)
  Scenario: A pinned uses: line with a trailing comment is still read
    Given an IG caller pinned as "fhirbuild.yml@49178a48d460bb53acf6e90d8c0aee3f0146d8f7 # main"
    When its publisher is detected
    Then it is "ig", using "fhirbuild.yml" at ref "49178a48d460bb53acf6e90d8c0aee3f0146d8f7"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::a_repository_calling_two_of_one_publisher's_workflows_builds_with_the_one_it_prefers
  Scenario: A repository calling two of one publisher's workflows builds with the preferred one
    Given a repository calling both fhirbuild.yml and ghbuild.yml of the stand-in publisher
    When its publisher is detected
    Then it builds with "ghbuild.yml", the publisher's preferred workflow

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::a_repository_calling_both_kinds_publishes_the_folio_unless_told_otherwise,_and_says_so
  Scenario: A repository calling both kinds publishes the folio unless told otherwise, and says so
    Given a repository calling both folio-staging.yml and fhirbuild.yml
    When its publisher is detected
    Then it is "folio", noting it also calls "ig" via "fhirbuild.yml"
    When "ig" is asked for
    Then it is "ig", noting it also calls "folio"
    And asking for "ig" in a repository calling only the folio throws "no workflow here calls"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::the_repository_that_DEFINES_a_publisher's_reusable_workflow_builds_with_it_at_the_commit_being_built_(smart-base,_2026-11-13)
  Scenario: The repository defining a publisher's reusable workflow builds with it at the commit being built
    Given a repository litlfred/smart-base defining reusable fhirbuild.yml and ghbuild.yml, plus a site-publish caller
    When its publisher is detected knowing which repository and commit it is
    Then it is "ig", caller "ghbuild.yml", using its own .github/workflows/ghbuild.yml at that commit
    And without knowing the repository it throws "nothing to mirror"
    And a same-named ghbuild.yml that is not reusable also throws "nothing to mirror"
    And when it also calls folio-staging.yml it publishes the folio, noting it also calls "ig"
    And a workflow with "workflow_call:" and a trailing comment is reusable, and "on: [push]" is not

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::a_repository_calling_neither_is_refused,_naming_what_it_does_call
  Scenario: A repository calling neither publisher is refused, naming what it does call
    Given a repository whose only workflow calls o/r other.yml@v1
    When its publisher is detected
    Then it throws an error naming "other.yml"
    And a repository with no workflows throws "nothing to mirror"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::uses:_references_parse,_and_a_caller's_with:_is_read_for_the_inputs
  Scenario: uses: references parse, and a caller's with: is read for the inputs
    When "o/r/.github/workflows/a.yml@v2" is parsed
    Then it gives owner "o", repo "r", path ".github/workflows/a.yml", ref "v2", file "a.yml"
    And "actions/checkout@v4" does not parse as a workflow reference
    And an IG caller with "do_dak: false" under with: yields inputs do_dak false
    And an IG caller with no with: yields no inputs

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_which_publisher,_read_from_the_repository's_own_workflows::only_the_folio_is_built_in:_without_a_declared_publisher,_an_IG_caller_is_refused,_and_the_refusal_says_where_publishers_come_from
  Scenario: Without a declared publisher, an IG caller is refused, saying where publishers come from
    Given only the folio publisher on offer
    When a repository calling fhirbuild.yml is read
    Then it throws naming the "site-publisher-<kind> pipeline slot"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::site_publishers_are_declared_pipeline_slots,_never_named_here_(owner,_2026-10-14,_Q4)::a_`site-publisher-<kind>`_slot_is_a_publisher_of_that_kind;_other_slots_are_not_read
  Scenario: A site-publisher-<kind> slot is a publisher of that kind; other slots are not read
    Given a registry with a "site-publisher-ig" slot holding the stand-in and a "lean-lexer" slot
    When the declared site publishers are read
    Then exactly one publisher is found: "ig" with workflows fhirbuild.yml and ghbuild.yml

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::site_publishers_are_declared_pipeline_slots,_never_named_here_(owner,_2026-10-14,_Q4)::FAILS_loudly_for_a_slot_that_holds_no_publisher,_a_kind_that_disagrees_with_its_slot,_or_the_folio's_kind
  Scenario: A slot holding no publisher, a mismatched kind, or the folio's kind fails loudly
    When a "site-publisher-ig" slot holds only a kind
    Then reading it throws "not a site publisher"
    When a "site-publisher-ig" slot holds a publisher of kind "other"
    Then reading it throws "not 'ig'"
    When a "site-publisher-folio" slot holds a publisher
    Then reading it throws "built-in"
    And the stand-in with a stage function is a site publisher

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::site_publishers_are_declared_pipeline_slots,_never_named_here_(owner,_2026-10-14,_Q4)::no_slot_filled:_no_publisher_besides_the_folio's
  Scenario: No slot filled means no publisher besides the folio's
    Given an empty contribution registry
    When the declared site publishers are read
    Then none are found

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_main_site_or_preview::the_default_branch_publishes_the_main_site;_any_other_branch_a_preview
  Scenario: The default branch publishes the main site; any other branch a preview
    When the branch is "main" and the default branch is "main"
    Then the target is "main"
    When the branch is "claude/x"
    Then the target is "preview"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_main_site_or_preview::--main_is_refused_off_the_default_branch,_and_the_default_branch_must_be_known_without_it
  Scenario: --main is refused off the default branch, and the default branch must be known without it
    When --main is given on "claude/x" with default branch "main"
    Then it throws "not the default branch"
    And --main on "main" with no known default branch targets "main"
    And a detached HEAD throws "detached", with or without --main
    And "main" without a known default branch and without --main throws "default branch"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_main_site_or_preview::the_default_branch_is_read_from_ls-remote_--symref
  Scenario: The default branch is read from ls-remote --symref
    When ls-remote output with "ref: refs/heads/main" HEAD is parsed
    Then the default branch is "main"
    And output with no symref line gives no default branch

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_main_site_or_preview::the_commits:_publish-main's_for_the_root,_staging(<slug>)_for_a_preview
  Scenario: Main-site and preview commit messages
    When the main commit message is composed for "abc123" on "main"
    Then its lines are "main-site: from abc123", "render-log: rendered the root from main" and "built locally: <commit url>"
    And a preview commit for slug "feat-x" begins "staging(feat-x): from abc123"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_main_site_or_preview::a_platform_script_is_found_either_side_of_the_70lx_split
  Scenario: A platform script is found either side of the 70lx split
    Given render-log.ts under cat-harness/scripts and publish-main-site.ts under cat-harness-tools/scripts
    When each is looked up
    Then each resolves to the directory it is in
    And an absent script throws "in none of"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_the_folio's_main_site_keeps_what_publish-main_keeps::STAGING/,__render-log/_and_a_hand-placed_root_file_survive;_the_last_publish's_files_are_replaced;_a_main-site_entry_is_logged
  Scenario: Main-site publish keeps STAGING/, _render-log/ and hand-placed files, replaces the last publish, and logs it
    Given a pages tree with STAGING/feat/index.html, _render-log/README.md, CNAME, and gone.html listed in _main-site.json
    And a site build with index.html and doc/index.html
    When the main site is composed from "abc123" on "main"
    Then the commit begins "main-site: from abc123" and adds "."
    And STAGING/feat/index.html and CNAME are unchanged
    And gone.html is removed and index.html holds the new build
    And _main-site.json lists "doc/index.html" and "index.html"
    And a render-log .jsonl entry has kind "main-site" and path "/"

  @test:scripts/tests/sdlc/stage-local-publisher.test.ts::stage-local:_the_folio's_main_site_keeps_what_publish-main_keeps::an_empty_build_is_refused_before_the_root_is_touched_(bean_oisv)
  Scenario: An empty build is refused before the root is touched
    Given a pages tree whose index.html holds "last main"
    When the main site is composed from an empty build
    Then it throws
    And index.html still holds "last main"
