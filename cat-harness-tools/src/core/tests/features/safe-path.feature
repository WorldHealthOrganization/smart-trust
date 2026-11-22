# src/core/safe-path.ts contains external values to a root: a single path segment, joined segments,
# a URL path resolved lexically, a real path, and a not-yet-written target. Each Scenario names the test that executes it.
Feature: Path containment refuses an escape and accepts the merely unusual

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::accepts_an_ordinary_identifier
  Scenario: A segment accepts an ordinary identifier
    Given the segment "arxiv-2501-01234"
    When it is checked as a single path segment
    Then it is returned unchanged

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::accepts_a_leading_dot_—_`.github`_and_`.beans.yml`_are_real_names_here
  Scenario: A segment may start with a dot, since ".github" and ".beans.yml" are real names
    Given the segments ".github" and ".beans.yml"
    When each is checked as a single path segment
    Then each is returned unchanged

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_the_empty_string,_because_join(base,_'')_is_base_itself
  Scenario: A segment refuses the empty string, because joining it gives the base itself
    Given the empty string
    When it is checked as a single path segment
    Then it is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_`.`_and_`..`
  Scenario: A segment refuses "." and ".."
    Given the segments "." and ".."
    When each is checked as a single path segment
    Then each is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_a_traversal_sequence
  Scenario: A segment refuses a traversal sequence
    Given the segment "../../../etc"
    When it is checked as a single path segment
    Then it is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_a_nested_path_even_though_it_is_CONTAINED
  Scenario: A segment refuses a nested path even though it is contained
    Given the value "a/b"
    When it is checked as a single path segment
    Then it is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_a_backslash_regardless_of_host,_since_Windows_treats_it_as_a_separator
  Scenario: A segment refuses a backslash on any host
    Given the value "a\b"
    When it is checked as a single path segment
    Then it is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_a_NUL_byte,_which_truncates_the_path_for_some_syscalls
  Scenario: A segment refuses a NUL byte
    Given a value with a NUL byte followed by "../../etc"
    When it is checked as a single path segment
    Then it is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::refuses_a_non-string,_so_an_absent_query_parameter_cannot_become_a_path
  Scenario: A segment refuses a non-string, so an absent query parameter cannot become a path
    Given the values null and undefined
    When each is checked as a single path segment
    Then each is refused

  @test:src/core/tests/safe-path.test.ts::safeSegment_refuses_what_a_path_segment_must_not_be::never_REPAIRS_a_value_—_a_refusal_is_not_a_sanitised_string
  Scenario: A refused segment is never repaired into a sanitised string
    # Gap: only the repairs "ab" and "a-b" are ruled out; other repairs are not checked
    Given the value "a/b"
    When it is checked as a single path segment
    Then the result is not "ab"
    And the result is not "a-b"

  @test:src/core/tests/safe-path.test.ts::joinSegments_checks_EVERY_segment,_not_the_first::joins_when_all_are_safe
  Scenario: Segments join when all are safe
    Given the root "/root" and the segments "a" and "b"
    When they are joined
    Then the result is the path "/root/a/b"

  @test:src/core/tests/safe-path.test.ts::joinSegments_checks_EVERY_segment,_not_the_first::refuses_when_a_LATER_segment_is_unsafe_—_the_`feedbackPath`_defect
  Scenario: Joining refuses when a later segment is unsafe
    Given the root "/root" and a first segment "ok"
    When it is joined with "../../etc" as the second segment
    Then the join is refused
    And joining with an empty second segment is refused too

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::resolves_a_normal_path_inside_the_root
  Scenario: A URL path resolves to a normal path inside the root
    Given the root "/root"
    When the URL path "/a/b.html" is resolved within it
    Then the result is "/root/a/b.html"

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::absorbs_traversal_against_the_root_rather_than_escaping
  Scenario: Traversal in a URL path is absorbed against the root rather than escaping
    Given the root "/root"
    When the URL path "/../../etc/passwd" is resolved within it
    Then the result is "/root/etc/passwd"

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::decodes_percent-escapes_BEFORE_normalising
  Scenario: Percent-escapes are decoded before the URL path is normalised
    Given the root "/root"
    When the URL path "/%2e%2e/%2e%2e/etc" is resolved within it
    Then the result is "/root/etc"

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::refuses_a_malformed_escape_and_a_NUL
  Scenario: A malformed escape and a NUL in a URL path are refused
    Given the root "/root"
    When the URL paths "/%ZZ" and one containing a NUL byte are resolved within it
    Then each is refused

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::accepts_the_root_itself
  Scenario: The URL path "/" resolves to the root itself
    Given the root "/root"
    When the URL path "/" is resolved within it
    Then the result is "/root"

  @test:src/core/tests/safe-path.test.ts::resolveWithin_—_lexical_containment_for_a_URL_path::does_NOT_accept_a_sibling_whose_name_merely_starts_with_the_root's
  Scenario: A sibling whose name merely starts with the root's is not reached
    Given the root "/root"
    When the URL path "/../rootevil/x" is resolved within it
    Then the result is "/root/rootevil/x", inside the root, not the sibling "/rootevil"

  @test:src/core/tests/safe-path.test.ts::realPathWithin_—_the_half_an_escape_actually_needs::a_symlink_pointing_OUT_of_the_root_is_refused,_though_the_string_looks_clean
  Scenario: A symlink pointing out of the root is refused, though the string looks clean
    Given a root holding "link.txt", a symlink to "secret.txt" in a sibling directory outside it
    When "/link.txt" is resolved lexically within the root
    Then the lexical result is defined
    And its real path within the root is refused

  @test:src/core/tests/safe-path.test.ts::realPathWithin_—_the_half_an_escape_actually_needs::a_real_file_inside_the_root_resolves
  Scenario: A real file inside the root resolves
    Given a directory holding the file "f.txt"
    When the real path of "f.txt" is resolved within it
    Then the result contains "f.txt"

  @test:src/core/tests/safe-path.test.ts::realPathWithin_—_the_half_an_escape_actually_needs::something_absent_is_undefined,_not_an_escape
  Scenario: Something absent has no real path, which is not an escape
    Given an empty directory
    When the real path of "nope" within it is resolved
    Then the result is undefined

  @test:src/core/tests/safe-path.test.ts::writableWithin_—_for_a_target_that_does_not_exist_yet::accepts_a_path_under_the_root_whose_parents_are_absent
  Scenario: A not-yet-written target under the root whose parents are absent is writable
    Given an empty root directory
    When "new/deep/file.json" under it is checked as writable within it
    Then it is writable

  @test:src/core/tests/safe-path.test.ts::writableWithin_—_for_a_target_that_does_not_exist_yet::refuses_a_path_whose_nearest_existing_ancestor_is_a_symlink_OUT_of_the_root
  Scenario: A target whose nearest existing ancestor is a symlink out of the root is not writable
    Given a root holding "escape", a symlink to a directory outside the root
    When "escape/written.json" under the root is checked as writable within it
    Then it is not writable

  @test:src/core/tests/safe-path.test.ts::writableWithin_—_for_a_target_that_does_not_exist_yet::refuses_a_lexically_outside_path_outright
  Scenario: A lexically outside target is not writable
    Given a root directory
    When the path "../elsewhere/x" from the root is checked as writable within it
    Then it is not writable

  @test:src/core/tests/safe-path.test.ts::writableWithin_—_for_a_target_that_does_not_exist_yet::does_not_accept_a_sibling_directory_sharing_the_root's_prefix
  Scenario: A sibling directory sharing the root's prefix is not writable
    Given a directory "root" and a sibling directory "rootevil"
    When "rootevil/x" is checked as writable within "root"
    Then it is not writable
