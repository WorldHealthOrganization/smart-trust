Feature: The artefact index is read and written through the layer-output overlay

  @test:scripts/lib/ig-index-at.test.ts::indexReadPath::a_mounted_layer_with_nothing_computed_is_read_from_the_mount
  Scenario: a mounted layer with nothing computed is read from the mount
    Given a checkout whose index lock mounts some-ig, with an index.json in its fhir-artifact-index/
    When the read path of some-ig's index.json is asked for
    Then it is some-ig/fhir-artifact-index/index.json in the mount

  @test:scripts/lib/ig-index-at.test.ts::indexReadPath::a_mounted_layer's_computed_index_wins_over_the_pinned_bytes
  Scenario: a mounted layer's computed index wins over the pinned bytes
    Given the mounted some-ig, and an index.json written under build/layers/some-ig/fhir-artifact-index/
    When the read path of some-ig's index.json is asked for
    Then it is the one under build/layers/some-ig/

  @test:scripts/lib/ig-index-at.test.ts::indexReadPath::a_layer_the_checkout_does_not_mount_is_read_in_place
  Scenario: a layer the checkout does not mount is read in place
    Given a directory own-ig that the index lock does not mount
    When the read path of its menu.json is asked for
    Then it is own-ig/fhir-artifact-index/menu.json

  @test:scripts/lib/ig-index-at.test.ts::indexReadPath::with_no_path_parts_it_names_the_index_directory_itself
  Scenario: with no path parts the read path names the index directory itself
    When the read path of the mounted some-ig is asked for with no file
    Then it is some-ig/fhir-artifact-index

  @test:scripts/lib/ig-index-at.test.ts::indexWritePath::a_mounted_layer's_index_is_written_under_build/layers/<instance>/,_not_in_the_mount
  Scenario: a mounted layer's index is written under build/layers/<instance>/
    When the write path of the mounted some-ig's index.json is asked for
    Then it is build/layers/some-ig/fhir-artifact-index/index.json, not a path in the mount

  @test:scripts/lib/ig-index-at.test.ts::indexWritePath::a_layer_the_checkout_does_not_mount_is_written_in_place
  Scenario: a layer the checkout does not mount is written in place
    Given a directory own-ig that the index lock does not mount
    When the write path of its menu.json is asked for
    Then it is own-ig/fhir-artifact-index/menu.json

  @test:scripts/lib/ig-index-at.test.ts::layerFileReadPath::a_localPath_under_fhir-artifact-index/_(the_package_the_JSON_view_pages_read)_goes_through_the_overlay
  Scenario: a layer file under fhir-artifact-index/ is read through the overlay
    Given the mounted some-ig, and a package.tgz written under build/layers/some-ig/fhir-artifact-index/
    When the read path of the local path fhir-artifact-index/package.tgz is asked for
    Then it is the package.tgz under build/layers/some-ig/

  @test:scripts/lib/ig-index-at.test.ts::layerFileReadPath::any_other_localPath_is_the_layer's_own_file
  Scenario: any other layer file is the layer's own file
    When the read path of the local path output-ast/resources/x.json in the mounted some-ig is asked for
    Then it is some-ig/output-ast/resources/x.json

  @test:scripts/lib/ig-index-at.test.ts::a_reader_of_a_mounted_IG's_index_(p2-refusals,_bean_sm8r's_finding)::finds_an_index_that_exists_only_in_the_output_root,_not_in_the_mount
  Scenario: p2-refusals finds a mounted IG's index that exists only in the output root
    Given an index lock mounting a-ig and b-ig, whose index.json files exist only under build/layers/<instance>/fhir-artifact-index/
    When p2-refusals combines a-ig and b-ig into one file
    Then it exits 0, reports nothing as missing, and says it combined across 2 IGs

  @test:scripts/lib/ig-index-at.test.ts::a_writer_of_a_mounted_IG's_index_(ingest-ig-releases,_bean_sm8r_item_4)::writes_releases.json_under_build/layers/<instance>/_and_nothing_inside_the_mount
  Scenario: ingest-ig-releases writes releases.json under build/layers/<instance>/ and nothing inside the mount
    Given an index lock mounting some-ig, and a GitHub releases fixture
    When ingest-ig-releases runs for the mounted some-ig
    Then it exits 0, writes releases.json under build/layers/some-ig/fhir-artifact-index/, and writes nothing inside the mount
