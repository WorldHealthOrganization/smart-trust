# Every skill .md in a package is listed in that package's manifest, once,
# sorted, and every entry names a known skill. Each Scenario names the test
# that executes it.
Feature: Skill package manifest coverage

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::there_are_packages_to_check_—_otherwise_this_suite_proves_nothing
  Scenario: There are packages with manifests to check
    When the harness's skill packages with a package-manifest.json are read
    Then there are more than 3

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::every_skill_file_is_listed_in_its_package_manifest
  Scenario: Every skill file is listed in its manifest
    When each package's .md files are compared with its manifest's skills
    Then none is unlisted

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::no_manifest_lists_a_skill_TWICE_—_the_complement_of_coverage
  Scenario: No manifest lists a skill twice
    When each manifest's skills list is scanned
    Then no name appears twice

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::each_manifest's_`skills`_list_is_SORTED_—_the_convention_that_is_instructed
  Scenario: Each manifest's skills list is sorted
    When each manifest's skills list is compared with its sorted order
    Then every list is already sorted

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::no_NEW_manifest_entry_is_missing_its_skill_file
  Scenario: Every manifest entry names a known skill
    When each manifest entry is checked against the known skills
    Then the dangling entries equal the known-dangling list, which is empty

  @test:scripts/tests/skill-manifest-coverage.test.ts::skill_package_manifests_cover_the_package::the_known-dangling_list_has_no_entry_that_is_now_resolved
  Scenario: The known-dangling list holds no resolved entry
    # Gap: CAN NEVER FAIL while the known-dangling list is empty: the stale entries are filtered from that empty list, so the result is always empty.
    When the known-dangling list is compared with the entries that still dangle
    Then no listed entry has been resolved
