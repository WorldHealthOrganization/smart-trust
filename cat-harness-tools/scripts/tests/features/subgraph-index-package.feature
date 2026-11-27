# The subgraph index package: one pin's index files, packed and fetched back
# over file:// so the real download, verification and unpacking run offline.
# Each Scenario names the test that executes it.
Feature: Subgraph index package

  @test:scripts/tests/subgraph-index-package.test.ts::pack::P1._packs_only_<docs>/subgraph/<harness>/_index_files,_at_their_published_paths,_with_a_manifest_and_a_release_record
  Scenario: Packing takes only the harness's subgraph index files
    Given a layer h that has built its subgraph files, beside another subgraph's file and a readme
    When its index is packed for a pin
    Then the tarball is named for the package
    And the manifest lists h's three index files at their published paths, with subgraph and file name
    And the release record validates with the package tag, URL, asset name, bytes and sha256
    And the tarball unpacks to h's files only, with a manifest recording where it was built

  @test:scripts/tests/subgraph-index-package.test.ts::pack::P2._nothing_built_is_a_refusal,_never_an_empty_package;_a_branch_is_not_a_pin
  Scenario: Packing refuses nothing built, no docs, or a branch
    Then packing a layer with no built subgraph throws naming subgraph:jsonld
    And packing a layer with no docs directory throws naming docs
    And packing for the ref "main" throws naming pin

  @test:scripts/tests/subgraph-index-package.test.ts::fetch::F1._fetches,_verifies_and_unpacks_the_pin's_package;_maps_each_hydrated_file_by_subgraph
  Scenario: Fetching verifies and unpacks the pin's package
    Given h's package published for the pin
    When it is fetched
    Then the hydrated files are keyed by subgraph "tools", whose file has the tools @id
    And the reported sha256 matches the published tarball
    And closing removes the unpacked root

  @test:scripts/tests/subgraph-index-package.test.ts::fetch::F2._no_release_for_the_pin_is_`absent`_—_not_a_failure,_and_not_a_package
  Scenario: No release for the pin is absent
    When the package for another pin is fetched
    Then it is "absent"

  @test:scripts/tests/subgraph-index-package.test.ts::fetch::F3._a_tarball_that_does_not_match_its_record_is_refused
  Scenario: A tampered tarball is refused
    Given a published tarball with an extra byte appended
    When it is fetched
    Then it is "refused"

  @test:scripts/tests/subgraph-index-package.test.ts::fetch::F4._a_package_built_for_another_pin_is_refused,_even_served_under_this_pin's_name
  Scenario: Another pin's package under this pin's name is refused
    Given another pin's package and a matching record served under this pin's names
    When it is fetched
    Then it is "refused" saying "not this pin's"

  @test:scripts/tests/subgraph-index-package.test.ts::fetch::F5._the_replay's_fetch_refuses_bytes_that_are_not_the_lock's
  Scenario: The replay fetch checks the lock's digest
    Then fetching the tarball with its sha256 unpacks a subgraph-index.json
    And fetching it with another digest is refused
    And fetching a missing file is absent

  @test:scripts/tests/subgraph-index-package.test.ts::download_limits_(cat-harness-tools#1712)::D1._every_download_carries_a_connect_timeout,_a_stall_limit_and_a_hard_limit
  Scenario: Every download has time limits
    Then the download arguments carry --connect-timeout, --speed-time and --max-time at the declared limits

  @test:scripts/tests/subgraph-index-package.test.ts::download_limits_(cat-harness-tools#1712)::D2._a_server_that_accepts_and_never_answers_is_a_failed_fetch_within_the_limit_—_never_a_hang,_never_an_absence
  Scenario: A silent server is a failed fetch within the limit
    Given a local server that accepts connections and never answers
    When a download is made with one-second limits
    Then it fails, not as absent, saying "timed out"
    And it returns within 15 seconds
