# A source ratchet over adapters/mcp-server/server.ts and src/tools: every external value that reaches a
# path is passed through a containment helper from src/core/safe-path.ts next to the sink.
# Each Scenario names the test that executes it.
Feature: Path sinks in the MCP server are guarded

  @test:test/server-path-sinks.test.ts::the_file_under_test_was_actually_read::is_the_server,_and_is_substantial_—_otherwise_every_assertion_below_is_vacuous
  Scenario: The server source read is the real, substantial server file
    Given the source of "adapters/mcp-server/server.ts"
    Then it is longer than 50000 characters
    And it contains the route checks for "/api/import/upload", "/api/import/scan" and "/api/import/arxiv"

  @test:test/server-path-sinks.test.ts::the_file_under_test_was_actually_read::imports_the_containment_helpers_rather_than_hand-rolling_them
  Scenario: The server imports the containment helpers
    Given the source of "adapters/mcp-server/server.ts"
    Then it imports from "../../src/core/safe-path.js"
    And it mentions "safeSegment", "realPathWithin" and "writableWithin"

  @test:test/server-path-sinks.test.ts::the_exact_pre-fix_spellings_are_gone::does_not_contain:_%s
  Scenario: The server no longer contains a known pre-fix sink spelling
    Given the source of "adapters/mcp-server/server.ts"
    Then it does not contain the row's spelling, for each row:
    # - "join(UPLOADS_DIR(), body.paperId)" (scan read an unvalidated identifier)
    # - the upload filename taken from the uploaded file's own name
    # - the upload id taken verbatim from a supplied paperId

  @test:test/server-path-sinks.test.ts::each_identifier_sink_validates_before_the_path_is_built::every_UPLOADS_DIR()_join_uses_a_checked_identifier,_never_a_raw_request_field
  Scenario: Every UPLOADS_DIR() join takes a checked local rather than a request field
    Given the source of "adapters/mcp-server/server.ts"
    When every "join(UPLOADS_DIR(), X)" is found
    Then there is at least one
    And no X names "body", "formData", "req", "params" or "query"
    # Gap: a source-text check; it does not prove each local was validated.

  @test:test/server-path-sinks.test.ts::each_identifier_sink_validates_before_the_path_is_built::the_scan_route_refuses_an_unsafe_paperId_with_a_400_rather_than_reading
  Scenario: The scan handler checks paperId with safeSegment
    Given the server source of the "/api/import/scan" handler
    Then it contains "safeSegment(body.paperId)"
    And it contains the message "must be one safe path segment"
    # Gap: the 400 status and that no read happens are not checked at runtime.

  @test:test/server-path-sinks.test.ts::each_identifier_sink_validates_before_the_path_is_built::the_scan_route_contains_each_meta.files_member_instead_of_trusting_it
  Scenario: The scan handler contains each meta.files member within the upload directory
    Given the server source of the "/api/import/scan" handler
    Then it contains "realPathWithin(uploadDir"
    And it no longer builds texPath with a bare join of uploadDir and the file name

  @test:test/server-path-sinks.test.ts::each_identifier_sink_validates_before_the_path_is_built::the_upload_route_checks_both_the_identifier_and_the_file_name,_and_the_write_target
  Scenario: The upload handler checks the identifier, the file name and the write target
    Given the server source of the "/api/import/upload" handler
    Then it contains "safeSegment(rawId)"
    And it contains "safeSegment(basename(file.name))"
    And it contains "writableWithin(UPLOADS_DIR()"

  @test:test/server-path-sinks.test.ts::safeSegment(basename(x))_—_the_composition_the_upload_route_now_uses::basename_alone_CONTAINS_a_traversal_but_does_not_reject_it
  Scenario: basename reduces a traversal to its last component
    When basename is applied to "../../../../etc/passwd" and to "/etc/passwd"
    Then each gives "passwd"

  @test:test/server-path-sinks.test.ts::safeSegment(basename(x))_—_the_composition_the_upload_route_now_uses::basename_alone_is_NOT_enough_—_`..`_survives_it
  Scenario: A ".." survives basename and is refused by safeSegment
    When basename is applied to "../.."
    Then it gives ".."
    And safeSegment of that is undefined

  @test:test/server-path-sinks.test.ts::safeSegment(basename(x))_—_the_composition_the_upload_route_now_uses::an_ordinary_upload_name_passes_through_unchanged
  Scenario: An ordinary upload name passes safeSegment(basename(x)) unchanged
    Then safeSegment(basename(x)) of "main.tex" is "main.tex"
    And of "Paper 2026 (final).tex" is "Paper 2026 (final).tex"

  @test:test/server-path-sinks.test.ts::safeSegment(basename(x))_—_the_composition_the_upload_route_now_uses::a_NUL-bearing_name_is_refused_outright,_not_truncated
  Scenario: A name containing NUL is refused rather than truncated
    Given the name "main.tex" NUL ".png"
    Then basename returns it unchanged
    And safeSegment of it is undefined
    And safeSegment of "main" NUL ".tex" is undefined

  @test:test/server-path-sinks.test.ts::MCP_tools_(src/tools)_contain_the_paths_their_arguments_name::reads_the_tools_directory_—_otherwise_the_checks_below_are_vacuous
  Scenario: The tools directory is read
    Given the non-test TypeScript files in "src/tools"
    Then there are more than 10
    And they include "translation.ts"

  @test:test/server-path-sinks.test.ts::MCP_tools_(src/tools)_contain_the_paths_their_arguments_name::every_root-plus-variable_path_has_a_containment_check_on_the_same_or_the_next_three_lines
  Scenario: Every root-plus-variable path in the tools is next to a containment check
    Given the non-test TypeScript files in "src/tools"
    When each join or resolve of a root ("repoRoot", "root" or "process.cwd()") with a bare variable is found
    Then at least one such sink is seen
    And each one, other than "state.source", has a safe-path helper call on the same or the next three lines

  @test:test/server-path-sinks.test.ts::MCP_tools_(src/tools)_contain_the_paths_their_arguments_name::the_pre-fix_translation_spellings_are_gone
  Scenario: The translation tool no longer contains its pre-fix path spellings
    Given the source of "src/tools/translation.ts"
    Then it contains none of "join(repoRoot, source)", "join(repoRoot, po_file)", "join(repoRoot, pot_file)", "join(repoRoot, inputPath)" or "join(translationsRoot(repoRoot), locale)"
    And it imports from "../core/safe-path.js"
    And it mentions "LocaleSchema"
