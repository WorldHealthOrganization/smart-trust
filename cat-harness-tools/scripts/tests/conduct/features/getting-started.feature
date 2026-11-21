# scripts/scan-repo-content.ts sorts a repository's files into library, content or an
# unclassified third bucket; scripts/pages-bootstrap.ts derives a GitHub Pages address from
# the git remote. Each Scenario names the test that executes it.
Feature: Getting started: the repo scan and the Pages address

  @test:scripts/tests/conduct/getting-started.test.ts::scan-repo-content_—_the_third_bucket::a_directory_convention_beats_the_extension
  Scenario: A directory convention beats the extension
    When "references/smith-2019.md" and "docs/chapter-1.pdf" are classified
    Then the .md under references/ is "library"
    And the .pdf under docs/ is "content"

  @test:scripts/tests/conduct/getting-started.test.ts::scan-repo-content_—_the_third_bucket::source_material_and_prose_land_where_they_should_on_extension_alone
  Scenario: Source material and prose are placed on extension alone
    When "smith-2019.pdf" and "outline.md" are classified
    Then the .pdf is "library"
    And the .md is "content"

  @test:scripts/tests/conduct/getting-started.test.ts::scan-repo-content_—_the_third_bucket::what_it_cannot_place_is_reported,_not_filed_on_a_guess
  Scenario: What the scan cannot place is reported, not filed on a guess
    When "src/index.ts" is classified
    Then its bucket is "unclassified"
    And its reason mentions ".ts"

  @test:scripts/tests/conduct/getting-started.test.ts::scan-repo-content_—_the_third_bucket::every_classification_carries_a_reason_an_author_can_argue_with
  Scenario: Every classification carries a reason
    When "a.pdf", "notes/b.md", "c.xyz" and "Makefile" are classified
    Then each has a non-empty reason

  @test:scripts/tests/conduct/getting-started.test.ts::scan-repo-content_—_the_third_bucket::scanning_this_repo_writes_nothing_and_leaves_source_code_unclassified
  Scenario: Scanning this repository leaves source code unclassified
    # Gap: that the scan writes nothing is not checked
    Given this harness instance's root
    When it is scanned
    Then the scan's source is "git" and it lists at least one entry
    And at least one file is unclassified
    And every directory group shows at most 5 examples

  @test:scripts/tests/conduct/getting-started.test.ts::pages-bootstrap_—_deriving_the_address::parses_every_shape_a_GitHub_remote_comes_in
  Scenario: Every shape of GitHub remote parses
    When the remotes "git@github.com:litlfred/folio-assistant.git", "https://github.com/litlfred/folio-assistant.git", "https://github.com/litlfred/folio-assistant" and "ssh://git@github.com/litlfred/folio-assistant.git" are parsed
    Then each gives owner "litlfred" and repo "folio-assistant"

  @test:scripts/tests/conduct/getting-started.test.ts::pages-bootstrap_—_deriving_the_address::an_unparseable_remote_yields_no_URL_rather_than_a_guessed_one
  Scenario: An unparseable remote yields no URL rather than a guessed one
    When the remote "not a url" is parsed
    Then there is no result
    And deriving the Pages URL for a nonexistent directory gives no URL

  @test:scripts/tests/conduct/getting-started.test.ts::pages-bootstrap_—_deriving_the_address::a_repository's_address_is_derived_from_its_remote
  Scenario: A repository's Pages address is derived from its remote
    Given a throwaway git repository whose origin is "https://github.com/example/demo.git"
    When its Pages URL is derived
    Then the URL is "https://example.github.io/demo/"
    And its source is "git remote"
