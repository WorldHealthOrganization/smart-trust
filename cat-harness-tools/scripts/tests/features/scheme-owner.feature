# schemeOwner (scripts/lib/scheme-owner.ts) across repositories: a source in a layer
# mounted from another repository that the declaring layer does not need is a citation,
# and the scheme stays the declaring layer's. Each Scenario names the test that executes it.
Feature: A scheme citing a non-needed mounted layer stays with the layer that declares it

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::repositoryRoots:_the_checkout_and_each_mount,_longest_first
  Scenario: The repository roots are the checkout and each mount, longest first
    Given a checkout whose index.lock.json mounts the layers "lib" and "base"
    When its repository roots are read
    Then they are "base", "lib" and the checkout root, in that order

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::a_scheme_whose_source_is_in_a_mounted_layer_the_declarer_does_not_need_is_the_declaring_layer's
  Scenario: A scheme citing a mounted layer the declarer does not need stays the declarer's
    Given the host layer "hb" needs only "base"
    And a scheme declared by "hb" whose source is in the mounted layer "lib"
    When its owner is computed
    Then the owner is "hb"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::terms_sourced_in_such_a_layer_are_the_declaring_layer's_too,_not_a_second_owner
  Scenario: Terms sourced in a non-needed mounted layer do not add a second owner
    Given a scheme declared by "hb" with one term sourced in "lib" and one in "hb"
    When its owner is computed
    Then the owner is "hb"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::a_mounted_layer_the_declarer_needs_keeps_what_it_holds
  Scenario: A mounted layer the declarer needs keeps its vocabulary
    Given a scheme declared by "hb" whose source is in the needed layer "base"
    When its owner is computed
    Then the owner is "base"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::within_one_repository_a_sub-layer_still_owns_what_it_holds_(owner,_2026-09-24)
  Scenario: A sub-layer in the same repository still owns what it holds
    Given a scheme declared by "hb" whose source, or a term's source, is in its sub-layer "sub"
    When its owner is computed
    Then the owner is "sub"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::a_mounted_layer's_own_scheme_stays_its_own
  Scenario: A mounted layer's own scheme stays its own
    Given a scheme declared by "lib" whose source is in "lib"
    When its owner is computed
    Then the owner is "lib"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::a_mounted_layer_declaring_a_scheme_about_the_host_repository_keeps_it
  Scenario: A mounted layer's scheme about the host repository stays the mounted layer's
    Given a scheme declared by "lib" whose source is in the host layer "hb", which "lib" does not need
    When its owner is computed
    Then the owner is "lib"

  @test:scripts/tests/scheme-owner.test.ts::schemeOwner_across_repositories::read_as_one_repository_(`[repo]`),_the_source's_layer,_as_before
  Scenario: Read as one repository, the source's layer owns the scheme as before
    Given a scheme declared by "hb" whose source is in "lib"
    When its owner is computed with the checkout as the only repository
    Then the owner is "lib"
