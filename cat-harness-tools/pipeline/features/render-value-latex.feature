# pipeline/render-latex.ts renders a witnessed value `:val[name]` as the witness's number,
# in prose and inside math, including names that contain an underscore.
# Each Scenario names the test that executes it.
Feature: Witnessed values in the LaTeX render

  @test:pipeline/render-value-latex.test.ts:::val_in_the_LaTeX_render::inside_math,_a_name_with_an_underscore_resolves
  Scenario: A value name with an underscore resolves inside math
    Given a value registry with "inv_alpha" and "invalpha" both witnessed as 137.035999084 at default precision 6
    When the markdown "A $x = :val[inv_alpha]$ B." is rendered to LaTeX
    Then the output contains "137.036"

  @test:pipeline/render-value-latex.test.ts:::val_in_the_LaTeX_render::in_prose,_a_name_with_an_underscore_resolves_(was_printed_literally)
  Scenario: A value name with an underscore resolves in prose
    Given a value registry with "inv_alpha" and "invalpha" both witnessed as 137.035999084 at default precision 6
    When the markdown "A :val[inv_alpha] B." is rendered to LaTeX
    Then the output contains "137.036"
    And the output does not contain ":val["

  @test:pipeline/render-value-latex.test.ts:::val_in_the_LaTeX_render::in_prose,_a_name_without_an_underscore_resolves
  Scenario: A value name without an underscore resolves in prose
    Given a value registry with "inv_alpha" and "invalpha" both witnessed as 137.035999084 at default precision 6
    When the markdown "A :val[invalpha] B." is rendered to LaTeX
    Then the output contains "137.036"

  @test:pipeline/render-value-latex.test.ts:::val_in_the_LaTeX_render::attributes_still_apply_in_prose_(precision_=_significant_digits)
  Scenario: A precision attribute in prose sets the significant digits
    Given a value registry with "inv_alpha" and "invalpha" both witnessed as 137.035999084 at default precision 6
    When ":val[inv_alpha]{precision=4}" in prose is rendered to LaTeX
    Then the output contains "$137.0$"
    When ":val[inv_alpha]{precision=3}" in prose is rendered to LaTeX
    Then the output contains "$137$"
