# Measuring a staging build against main's published site (bean bnjs). Each
# Scenario names the test that executes it.
Feature: Measuring rendered impact against main's published site

  @test:scripts/tests/measure-rendered-impact.test.ts::measure::compares_main's_published_files_only,_never_another_preview,_the_render_log_or_the_job's_own_artefacts
  Scenario: Only main's published files are compared
    Given a publish root holding main's site, another pull request's preview and a render log, and a staging build with the job's own artefacts
    When the staging build is measured
    Then the measured changes are doc/index.html and other/index.html only

  @test:scripts/tests/measure-rendered-impact.test.ts::measure::a_measured_change_the_prediction_did_not_name_is_missed;_the_before_side_IS_the_base,_so_it_counts
  Scenario: A measured change the prediction did not name is missed
    Given a prediction naming only doc/index.html and main's site built at the base
    When the staging build is measured
    Then the status is known, other/index.html is missed and doc/index.html is confirmed

  @test:scripts/tests/measure-rendered-impact.test.ts::measure::a_before_side_built_from_another_commit_is_not-base:_main's_own_changes_are_not_the_cone's_misses
  Scenario: A before side built from another commit is not-base
    When the staging build is measured against base2 while main's site was built at base1
    Then the status is not-base and the before commit is base1

  @test:scripts/tests/measure-rendered-impact.test.ts::measure::no_manifest,_no_measurement_—_never_an_empty_one
  Scenario: No manifest means no measurement
    When a before side with no main-site manifest is measured
    Then there is no measurement

  @test:scripts/tests/measure-rendered-impact.test.ts::mergePredictions::one_prediction_from_several_renderers,_each_file_once
  Scenario: Predictions from several renderers merge with each file once
    Given renderer a predicting p.html and renderer b predicting p.html and q.html
    When the predictions are merged
    Then the renderer is "a+b" and the files are p.html and q.html
