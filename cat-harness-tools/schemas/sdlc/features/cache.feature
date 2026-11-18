# Specifies schemas/sdlc/cache.ts: the cache/1.0.0 node schema, the state a
# cache's producer reads, the staleness computation, and this layer's caches/
# directory.
Feature: A cache node declares its key recipe, and its staleness is computed

  @test:schemas/sdlc/cache.test.ts::cache/1.0.0::the_baseline_parses
  Scenario: A well-formed cache node parses
    Given a cache node with a hashFiles key recipe, trust class "a" and state inputs that read none
    When it is parsed with the cache schema
    Then it parses

  @test:schemas/sdlc/cache.test.ts::cache/1.0.0::never_the_entries:_an_unknown_key_is_refused
  Scenario: A node may not record cache entries
    Given the well-formed cache node with an extra storedKey field
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/cache.test.ts::cache/1.0.0::a_recipe_must_name_what_it_derives_from
  Scenario: A key recipe must name what it derives from
    Given key recipes of source "hashFiles", "cache:key" and "script" that give nothing else
    When each node is parsed
    Then each is refused

  @test:schemas/sdlc/cache.test.ts::cache/1.0.0::a_hand-listed_or_run-scoped_key_is_a_finding_that_must_record_its_expression
  Scenario: A hand-listed key must record its expression
    Given a key recipe of source "hand-listed" without an expression
    When the node is parsed
    Then it is refused
    And the same recipe with the expression "k-$judge" parses

  @test:schemas/sdlc/cache.test.ts::cache/1.0.0::a_trust_class_outside_the_policy_is_refused
  Scenario: An unknown trust class is refused
    Given a cache node whose trust class is "trusted"
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/cache.test.ts::state_a_producer_reads_(#2966:_the_pages_read_the_work_plan,_the_key_did_not)::every_node_must_say_whether_its_producer_reads_state
  Scenario: A node must declare the state its producer reads
    Given a cache node without stateInputs
    When it is parsed
    Then it is refused

  @test:schemas/sdlc/cache.test.ts::state_a_producer_reads_(#2966:_the_pages_read_the_work_plan,_the_key_did_not)::keyed_state_names_its_refs
  Scenario: Keyed state names its refs
    Given state inputs that read "keyed" state but list no refs
    When the node is parsed
    Then it is refused
    And keyed state listing the ref "cat/cat-harness/beans" parses

  @test:schemas/sdlc/cache.test.ts::state_a_producer_reads_(#2966:_the_pages_read_the_work_plan,_the_key_did_not)::unkeyed_or_unmeasured_state_is_never_current,_whatever_the_keys_say
  Scenario: Unkeyed or unmeasured state is never current
    Given a stored key equal to the implied key
    When node staleness is computed for state inputs that read "unkeyed" or "unmeasured"
    Then the state is "undetermined"
    And for state inputs that read "none" the state is "current"

  @test:schemas/sdlc/cache.test.ts::staleness_is_computed,_never_claimed::an_implied_key_that_cannot_be_computed_is_undetermined,_never_current
  Scenario: An implied key that cannot be computed is undetermined
    Given an implied key reported as undetermined and any stored key
    When staleness is computed
    Then the state is "undetermined"

  @test:schemas/sdlc/cache.test.ts::staleness_is_computed,_never_claimed::no_stored_key_read_is_undetermined,_never_current
  Scenario: No stored key read is undetermined
    Given an implied key "abc" and no stored key
    When staleness is computed
    Then the state is "undetermined"

  @test:schemas/sdlc/cache.test.ts::staleness_is_computed,_never_claimed::equal_is_current,_different_is_stale
  Scenario: Equal keys are current, different keys are stale
    Given the implied key "abc" under the prefix "cs1-demo-"
    When staleness is computed against the stored key "cs1-demo-abc"
    Then the state is "current"
    And against the stored key "cs1-demo-old" the state is "stale"

  @test:schemas/sdlc/cache.test.ts::this_layer's_caches/::every_node_parses_under_its_family
  Scenario: Every node in this layer's caches/ parses
    Given the .json files in this layer's caches/ directory, of which there is at least one
    When each is parsed with the cache-inventory schema or the cache schema, per its $schema
    Then every file parses

  @test:schemas/sdlc/cache.test.ts::this_layer's_caches/::a_node's_file_stem_is_its_id
  Scenario: A cache node's file stem is its id
    Given each .cache.json file in caches/
    When its id is read
    Then the file is named <id>.cache.json
