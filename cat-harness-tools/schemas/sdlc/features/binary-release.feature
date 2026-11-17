# Specifies schemas/sdlc/binary-release.ts: a binary release records a
# published release's assets — name, size, digest, where to fetch them, and
# what became of each — never the bytes themselves.
Feature: A binary release records its assets, never their bytes

  Background:
    Given a baseline GitHub release v1.8.0 with one published asset "package.tgz" that has a sha256 digest and a fetchedFrom URL

  @test:schemas/sdlc/binary-release.test.ts::never_the_bytes::the_baseline_release_parses
  Scenario: The baseline release parses
    When it is parsed with the binary release schema
    Then it parses

  @test:schemas/sdlc/binary-release.test.ts::never_the_bytes::a_payload_key_is_REFUSED_—_the_shape_is_strict_throughout
  Scenario: An asset carrying content is refused
    When the asset carries a base64 content field
    Then the release is refused

  @test:schemas/sdlc/binary-release.test.ts::never_the_bytes::an_unknown_top-level_key_is_REFUSED_too
  Scenario: An unknown top-level key is refused
    When the release carries a top-level blob field
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::never_the_bytes::an_asset_with_no_`fetchedFrom`_is_REFUSED_—_a_size_and_a_hash_with_no_referent
  Scenario: An asset without fetchedFrom is refused
    When the only asset has a name, size and disposition but no fetchedFrom
    Then the release is refused

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::a_purged_asset_is_recorded,_with_where_to_get_it_back
  Scenario: A purged asset is recorded with where to fetch it
    Given an asset "output.zip" with disposition "deleted-before-deploy" and a reason
    When the release is parsed
    Then purgedAssets returns that one asset
    And its fetchedFrom names output.zip

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::a_purged_asset_must_still_say_where_it_is_fetched_from
  Scenario: A purged asset must still have fetchedFrom
    Given the purged asset without fetchedFrom
    When the release is parsed
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::a_DECIDED_disposition_with_no_reason_is_REFUSED_—_deleted_cannot_be_told_from_lost
  Scenario: A decided disposition without a reason is refused
    Given the purged asset without its dispositionReason
    When the release is parsed
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::every_decided_disposition_is_one_the_schema_knows
  Scenario: Every decided disposition is a known disposition
    Then each of the decided dispositions is among the asset dispositions

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::`expired`_is_NOT_a_decision,_so_a_reason_on_it_is_REFUSED
  Scenario: An expired asset may not carry a reason
    Given the purged asset with disposition "expired" and its reason kept
    When the release is parsed
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_deploy_purge_—_the_case_the_kind_exists_for::`published`_with_no_reason_is_fine
  Scenario: A published asset needs no reason
    Given the purged asset with disposition "published" and no reason
    When the release is parsed
    Then it parses

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::an_undigested_asset_makes_the_release_`unknown`,_not_`ok`
  Scenario: An undigested asset makes the verdict unknown
    Given a published asset with no digest
    When the release verdict is computed
    Then it is "unknown"

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::an_`unknown`_disposition_makes_the_release_`unknown`_too
  Scenario: An unknown disposition makes the verdict unknown
    Given a digested asset whose disposition is "unknown"
    When the release verdict is computed
    Then it is "unknown"

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::a_gone-but-established_asset_is_a_`finding`_—_a_result,_not_an_error
  Scenario: A superseded asset is a finding
    Given a digested asset with disposition "superseded" and a reason
    When the release verdict is computed
    Then it is "finding"

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::everything_digested_and_still_published_is_`ok`
  Scenario: Every asset digested and published is ok
    When the baseline release's verdict is computed
    Then it is "ok"

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::a_verification_time_cannot_exist_without_a_digest_—_it_is_nested_inside_one
  Scenario: A verification time without a digest is refused
    Given an asset with verifiedAt but no digest
    When the release is parsed
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::could-not-determine_is_never_clean::a_malformed_digest_is_REFUSED
  Scenario: A malformed digest is refused
    Given an asset whose sha256 digest is "NOTAHASH"
    When the release is parsed
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_file_declares_what_it_is::a_document_with_no_`$schema`_tag_is_REFUSED
  Scenario: A release without a $schema tag is refused
    When the baseline release has no $schema
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_file_declares_what_it_is::a_version_is_required_—_an_id_alone_collides_across_re-publications
  Scenario: A release must carry a version
    When the release identity has only an id
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_file_declares_what_it_is::two_assets_under_one_name_are_REFUSED
  Scenario: Two assets under one name are refused
    When the release lists the same asset twice
    Then it is refused

  @test:schemas/sdlc/binary-release.test.ts::the_file_declares_what_it_is::an_unknown_origin_is_REFUSED
  Scenario: An unknown origin kind is refused
    When the origin kind is "sneakernet"
    Then the release is refused

  @test:schemas/sdlc/binary-release.test.ts::the_file_declares_what_it_is::`releaseBytes`_totals_what_was_published
  Scenario: releaseBytes totals the published bytes
    When releaseBytes is computed for the baseline release
    Then it is 4194304

  @test:schemas/sdlc/binary-release.test.ts::the_graph_typology_it_is_held_under::registered,_not_renderable,_`state`,_and_not_work
  Scenario: The binary-release typology is registered state that records no work
    When the "binary-release" graph typology is looked up
    Then it is registered
    And it is not renderable
    And its layer is "state"
    And it does not record work

  @test:schemas/sdlc/binary-release.test.ts::the_graph_typology_it_is_held_under::a_process_MAY_write_it_—_the_release_pipeline_appends_a_node
  Scenario: A process may write a binary release
    Then a process may write "binary-release"

  @test:schemas/sdlc/binary-release.test.ts::the_graph_typology_it_is_held_under::it_is_NOT_`derived`,_and_its_sibling_`ig-metadata-index`_is
  Scenario: A binary release is not a derived graph, while ig-metadata-index is
    Then "binary-release" is not a derived graph
    And "ig-metadata-index" is a derived graph

  @test:schemas/sdlc/binary-release.test.ts::the_graph_typology_it_is_held_under::it_is_a_DIFFERENT_kind_from_`catalogue`,_which_is_where_materialization_lives
  Scenario: A binary release is a different kind from a catalogue
    When the graph typology IRIs of "binary-release" and "catalogue" are computed
    Then they are two distinct IRIs
