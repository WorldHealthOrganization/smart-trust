# RouteMemberSchema in schemas/kg/subgraph-source.ts refuses any route-family member key that is not one safe path segment, and the storage keying enum has one definition shared by DirectoryStorageSchema.
# Each Scenario names the test that executes it.
Feature: Route-family member keys and the keying enum

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::ordinary_branch-derived_slugs_pass
  Scenario: Ordinary branch-derived member keys are accepted
    Given the keys "claude-xp5j-ref-steward", "main", "pr-2063", "v1.2.3", "a" and "A_b-c.d"
    When each is parsed as a route member
    Then every one is accepted

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::ONE_segment:_a_slash_is_refused,_which_kills_traversal_in_a_single_rule
  Scenario: A member key containing a slash is refused
    Given the keys "a/b", "../etc", "..", "../../index.html", "/absolute", "a//b", "STAGING/x", "x/.." and "./x"
    When each is parsed as a route member
    Then every one is refused

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::no_dot-prefixed_segment_—_the_directory-conventions_guard
  Scenario: A dot-prefixed member key is refused
    Given the keys ".git", ".beans", ".hidden", ".." and "."
    When each is parsed as a route member
    Then every one is refused

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::a_dash-leading_key_is_refused,_so_a_member_cannot_be_read_as_a_flag
  Scenario: A dash-leading member key is refused
    Given the keys "-rf", "--force" and "-"
    When each is parsed as a route member
    Then every one is refused

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::empty_and_oversized_are_refused
  Scenario: An empty member key or one over 100 characters is refused
    Then the empty key is refused
    And a key of 100 characters is accepted
    And a key of 101 characters is refused

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::characters_that_mean_something_to_a_shell_or_a_URL_are_refused
  Scenario: A member key with shell or URL metacharacters is refused
    Given keys containing a space, ";", "&", "|", "$", backticks, a quote, a double quote, ">", a newline, a NUL, "%2e", "?", "#", ":" or a backslash
    When each is parsed as a route member
    Then every one is refused

  @test:schemas/route-member.test.ts::a_route-family_member_is_one_safe_path_segment::a_dot_INSIDE_is_fine,_but_never_two_in_a_row
  Scenario: A single dot inside a member key is accepted but two in a row are refused
    Then "v1.2.3" is accepted
    And "a..b" is refused

  @test:schemas/route-member.test.ts::storage_on_ONE_branch_is_keyed_in_exactly_four_ways::route-family_parses,_and_no_fifth_keying_does
  Scenario: Storage on one branch parses keyed one of four ways, and no other keying
    Given a directory storage on the branch "gh-pages"
    Then it parses keyed by "commit", "tip", "route" or "route-family"
    And it is refused keyed by "routes", "family", "route_family", "dynamic" or the empty string
    # "family" is a keying of the enum, valid only with a branchPrefix; on a single branch it is refused

  @test:schemas/route-member.test.ts::storage_on_ONE_branch_is_keyed_in_exactly_four_ways::the_branch_it_names_is_still_validated
  Scenario: A route-family storage still refuses a malformed branch name
    Given directory storages keyed by "route-family"
    When the branch is "refs/heads/gh-pages", "-x", "a..b", "a//b", "gh-pages/", "x.lock" or "/abs"
    Then each is refused

  @test:schemas/route-member.test.ts::the_keying_enum_has_exactly_one_definition::every_accepted_value_is_accepted_by_BOTH
  Scenario: Every keying value is accepted by both the keying enum and the storage schema
    Given the keyings "commit", "tip", "route" and "route-family"
    Then each parses as a keying
    And each parses as the keying of a "gh-pages" storage

  @test:schemas/route-member.test.ts::the_keying_enum_has_exactly_one_definition::`family`_is_in_the_one_enum,_and_the_declaration_takes_it_in_its_OWN_shape
  Scenario: The "family" keying parses only in its own branch-prefix shape
    Then "family" parses as a keying
    And a storage with branch prefix "cat/x/y/", keyed by "family" and with a key source parses
    And a storage on the branch "gh-pages" keyed by "family" is refused

  @test:schemas/route-member.test.ts::the_keying_enum_has_exactly_one_definition::every_rejected_value_is_rejected_by_BOTH_—_the_direction_`1j3q`_missed
  Scenario: Every junk keying value is refused by both the keying enum and the storage schema
    Given the values "", "routes", "famly", "route_family", "dynamic", "ROUTE" and "tip " with a trailing space
    Then each is refused as a keying
    And each is refused as the keying of a "gh-pages" storage

  @test:schemas/route-member.test.ts::the_keying_enum_has_exactly_one_definition::the_declaration_does_not_RESTATE_the_enum_—_it_is_the_same_schema_object
  Scenario: The storage schema's keying field is the keying enum itself
    When the storage schema's "keyedBy" field is read
    Then it is the same schema object as the keying enum
