# schemas/kg/portable-path.ts finds path segments that cannot be checked out on every platform and
# encodes ids into portable filenames; the id-to-filename composers across the repository use it.
# Each Scenario names the test that executes it.
Feature: Portable paths and the id-to-filename composers

  @test:schemas/portable-path.test.ts::unportableSegment::accepts_the_ordinary_names_this_repository_is_full_of
  Scenario: Ordinary repository names are portable segments
    Given the names "agent-workflow.kg-qa.json", "README.md", "check-ci-health.ts" and "_external"
    When each is checked as a path segment
    Then none is reported unportable

  @test:schemas/portable-path.test.ts::unportableSegment::rejects_every_character_Windows_reserves_in_a_component
  Scenario: A segment holding a Windows-reserved character is refused
    Given a segment "req<c>x" for each of < > : " / \ | ? * and the control character U+0001
    When each is checked as a path segment
    Then each is reported as "reserved-character"

  @test:schemas/portable-path.test.ts::unportableSegment::rejects_a_device_name_even_with_an_extension
  Scenario: A device name is refused even with an extension
    Given the names "con", "CON.txt", "aux.kg-qa.json", "com1", "LPT9.md" and "nul"
    When each is checked as a path segment
    Then each is reported as "reserved-device-name"
    And "console.ts", "auxiliary.md", "com10" and "connection.json" are not reported

  @test:schemas/portable-path.test.ts::unportableSegment::rejects_a_trailing_dot_or_space,_which_Windows_would_silently_strip
  Scenario: A segment ending in a dot or a space is refused
    When "notes." and "notes " are checked as path segments
    Then each is reported as "trailing-dot-or-space"

  @test:schemas/portable-path.test.ts::unportablePath::reports_the_offending_SEGMENT,_not_the_whole_path
  Scenario: An unportable path reports the offending segment
    When the path "cat-harness/test/results/kg-qa/req:x.kg-qa.json" is checked
    Then the report names the segment "req:x.kg-qa.json" with reason "reserved-character"

  @test:schemas/portable-path.test.ts::unportablePath::finds_one_in_the_middle_of_a_path,_not_only_in_the_basename
  Scenario: An unportable segment in the middle of a path is found
    When the path "a/b:c/d.json" is checked
    Then the reported segment is "b:c"

  @test:schemas/portable-path.test.ts::unportablePath::passes_a_clean_path
  Scenario: A clean path passes
    When the path "cat-harness/schemas/kg/portable-path.ts" is checked
    Then nothing is reported

  @test:schemas/portable-path.test.ts::portableSegment::encodes_the_colon_that_made_this_repository_unclonable
  Scenario: The colon in an id is percent-encoded
    When "req:agent-workflow" is made a portable segment
    Then the result is "req%3Aagent-workflow"

  @test:schemas/portable-path.test.ts::portableSegment::leaves_an_already-portable_name_exactly_as_it_is
  Scenario: An already-portable name is left unchanged
    When "agent-workflow" is made a portable segment
    Then the result is "agent-workflow"

  @test:schemas/portable-path.test.ts::portableSegment::is_injective,_so_two_ids_cannot_compose_one_sidecar
  Scenario: Distinct ids encode to distinct segments
    Given the ids "req:agent-workflow", "req-agent-workflow", "req%3Aagent-workflow" and "req%agent-workflow"
    When each is made a portable segment
    Then the four results are all different

  @test:schemas/portable-path.test.ts::portableSegment::whatever_it_returns_is_portable
  Scenario: Every encoded segment is portable
    Given raw names with a colon, a quote, a pipe, an asterisk, a trailing dot, a trailing space, a percent sign and a control character
    When each is made a portable segment
    Then none of the results is reported unportable

  @test:schemas/portable-path.test.ts::portableSegment::does_not_pretend_to_rescue_a_device_name
  Scenario: Encoding does not rescue a device name
    When "aux" is made a portable segment
    Then the result is "aux"
    And it is still reported as "reserved-device-name"

  @test:schemas/portable-path.test.ts::the_id-to-filename_composers,_as_a_class::every_composer_encodes,_so_no_id_can_compose_an_uncheckable_name
  Scenario: Every id-to-filename composer encodes a hostile id
    Given the id "req:x"
    Then the script sidecar path is "test/results/script-sidecars/req%3Ax.script.json" under "/repo"
    And the sticky file is "req%3Ax.json"
    And the detail file name is "req%3Ax.md" and the detail relative path is "detail/req%3Ax.md"
    And the sidecar path, sticky file and detail file name are all portable paths

  @test:schemas/portable-path.test.ts::the_id-to-filename_composers,_as_a_class::and_every_one_is_identity_on_the_ids_actually_in_use,_so_nothing_moves
  Scenario: The composers leave ids already in use unchanged
    Then the script sidecar for "lean-mirror-drift" is "lean-mirror-drift.script.json" under the sidecars directory
    And the sticky file for "getting-started" is "getting-started.json"
    And the detail file name for "kg-audit-baseline" is "kg-audit-baseline.md"

  @test:schemas/portable-path.test.ts::the_id-to-filename_composers,_as_a_class::detailRelPath_and_detailFileName_cannot_drift,_because_one_calls_the_other
  Scenario: The detail relative path is the detail directory joined with the detail file name
    # Gap: checks the outputs agree for four ids, not that one function calls the other
    Given the ids "plain", "req:x", "a b" and "100%"
    Then for each the detail relative path equals "detail" joined with its detail file name

  @test:schemas/portable-path.test.ts::kgQaSidecarPath::composes_a_checkout-safe_path_from_an_id_that_is_not_a_legal_filename
  Scenario: A kg-qa sidecar path from an illegal-filename id is checkout-safe
    Given a subject "req:agent-workflow" in "skills/requirements" under "/repo"
    When its kg-qa sidecar path is composed
    Then it is "test/results/kg-qa/skills/requirements/req%3Aagent-workflow.kg-qa.json" under "/repo"
    And the path is portable

  @test:schemas/portable-path.test.ts::kgQaSidecarPath::still_mirrors_the_subject's_directory_untouched
  Scenario: A kg-qa sidecar path mirrors the subject's directory
    Given a subject "todo-manager" in "skills/folio-core" under "/repo"
    When its kg-qa sidecar path is composed
    Then it is "test/results/kg-qa/skills/folio-core/todo-manager.kg-qa.json" under "/repo"

  @test:schemas/portable-path.test.ts::kgQaSidecarPath::an_outside_subject_is_REFUSED_—_its_owner_audits_it_(Q-A_PR_4)
  Scenario: A subject outside the root is refused a kg-qa sidecar path
    Given a subject in "/bootstrap/processes", outside the root "/repo"
    When its kg-qa sidecar path is composed
    Then a ForeignSubjectError is thrown
