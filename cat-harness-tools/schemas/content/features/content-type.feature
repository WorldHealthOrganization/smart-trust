# Specifies schemas/content/content-type.ts's two marker forms: a content type
# declared as a file, and one declared as a section of the root
# index.config.json (owner, 2026-10-24); and the index-config schema's
# contentTypes, which holds sections without knowing what they hold.
Feature: A content type is marked by a file or by a section of index.config.json

  Background:
    Given a registry with "widget", declared as the index section "widget", and "gadget", declared as the file "gadget.config.json", each reading a "name" fact

  @test:schemas/content/content-type.test.ts::a_content_type_declared_as_an_index_section::the_section's_presence_is_membership,_and_its_contents_are_the_facts
  Scenario: The section's presence is membership, and its contents are the facts
    Given a repository whose index.config.json has the section widget { name: "w" }
    When the repository is described
    Then its one type is "widget", marked by "index.config.json#contentTypes.widget", parsed, with the fact name "w"

  @test:schemas/content/content-type.test.ts::a_content_type_declared_as_an_index_section::an_index_without_the_section_is_not_a_member,_like_an_absent_file
  Scenario: Without the section, the type is not a member
    Given a repository whose index has only another section, one whose index has no contentTypes, and an empty one
    When each is described
    Then none has any type

  @test:schemas/content/content-type.test.ts::a_content_type_declared_as_an_index_section::an_unreadable_index_reports_the_type_unparsed_rather_than_dropping_it
  Scenario: An unreadable index reports the type unparsed
    Given a repository whose index.config.json is not JSON
    When it is described
    Then its first type is "widget", not parsed, with no facts

  @test:schemas/content/content-type.test.ts::a_content_type_declared_as_an_index_section::a_section_and_a_file_stating_one_fact_differently_are_reported,_not_resolved
  Scenario: A section and a file disagreeing on a fact are reported
    Given a repository whose widget section says name "a" and whose gadget file says name "b"
    When it is described
    Then the one disagreement is on "name", with the claims widget "a" and gadget "b"

  @test:schemas/content/content-type.test.ts::a_content_type_declared_as_an_index_section::registering_the_same_section_twice_is_a_diamond;_a_different_section_is_a_conflict
  Scenario: Registering the same section again is accepted; a different section conflicts
    When "widget" is registered again with the section "widget"
    Then it does not throw
    When "widget" is registered again with the section "other"
    Then it throws a content-type conflict error

  @test:schemas/content/content-type.test.ts::index.config.json_carries_the_sections_without_knowing_what_they_hold::any_object_under_a_well-formed_id_is_accepted,_and_kept
  Scenario: Any object under a well-formed id is kept
    Given an index whose section "widget" holds an array and a nested object
    When it is parsed with the index-config schema
    Then contentTypes holds that section exactly

  @test:schemas/content/content-type.test.ts::index.config.json_carries_the_sections_without_knowing_what_they_hold::a_section_that_is_not_an_object,_or_a_malformed_id,_is_refused
  Scenario: A non-object section, or a malformed id, is refused
    Given an index whose section "widget" is the number 5, and one with a section "Widget"
    When each is parsed with the index-config schema
    Then both are refused

  @test:schemas/content/content-type.test.ts::index.config.json_is_never_itself_a_harness_marker::a_repository_carrying_only_an_index_is_not_a_harness
  Scenario: A repository with only an index has no base content type, whatever the index holds
    Given a fresh registry with the base content types registered
    When a repository holding only an index.config.json is described, for an index with a "widget" section, with no sections, with a "harness" section, with a harness's name and stub fields, and that is not JSON
    Then each has no type
    When a repository holding the same index and an "acme.config.json" is described
    Then its one type is "harness", marked by "acme.config.json"
