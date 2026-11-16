Feature: building a paper folio's lazy site

  @test:scripts/build-folio-site.test.ts::build-folio-site::tinyShellsPerLevel
  Scenario: shells exist at <route>/<paper>/<chapter>/<section>/, and each is tiny
    Given a scaffolded paper folio
    When the folio site is built
    Then there are no errors
    And the outline is folio-site-outline/v2 without sections or labels, and each chapter has a folio-site-chapter/v1 outline
    And a shell exists at the route, paper, chapter and section levels, each under 2 KB
    And the site script is written

  @test:scripts/build-folio-site.test.ts::build-folio-site::blockPayloadAndLabelMap
  Scenario: a block payload is the block's KG node plus its rendered html, and every label maps to its section page
    When the folio site is built
    Then a block's payload holds its rendered HTML with its anchor
    And the label shard maps the block to its section and the block's page is b/prose-overview
    And that page's shell is small and loads the block and the site script

  @test:scripts/build-folio-site.test.ts::build-folio-site::crossRefCarriesTargetAndNumber
  Scenario: a cross-reference carries its target page and printed number, so no index is fetched to follow it
    When links to a known label and to an unknown anchor are resolved
    Then a link with the label as text gets its page and printed number
    And a link with other text keeps its text and gets its page
    And the unknown link is left alone

  @test:scripts/build-folio-site.test.ts::build-folio-site::blockSlugsKeepKindPrefix
  Scenario: block page slugs keep the kind prefix and never collide
    When block slugs are made for prop:foo, def:foo and a root prop-foo
    Then they are prop-foo, def-foo and prop-foo-2

  @test:scripts/build-folio-site.test.ts::build-folio-site::routeConfigurableRelativeLinks
  Scenario: the route is configurable, and a shell's links are relative to its own depth
    When the site is built under route docs/x and shells are made at depths 3 and 0
    Then the handbook shell is under docs/x
    And the deep shell's script link climbs three levels and the root shell's root is ./

  @test:scripts/build-folio-site.test.ts::build-folio-site::sectionSlugsDropPrefix
  Scenario: section slugs drop the label prefix and never collide
    When section slugs are made for sec:braid-group, "Braid group" and "$q$-Langlands"
    Then they are braid-group, braid-group-2 and q-langlands

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::texFenceSvgOnHashMatch
  Scenario: a ```tex fence becomes its pre-rendered SVG only when the HASH matches
    Given a tex fence and a pre-rendered SVG
    When the fence is rendered with the right hash and with a stale one
    Then with the right hash it becomes the SVG image
    And with a stale hash it is no image but a [Diagram] placeholder

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::equationFenceBecomesDisplayMath
  Scenario: an equation fence with no SVG becomes display math, unwrapped and unlabelled
    When an equation fence with no SVG is rendered
    Then it becomes display math without the environment or label

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::preambleMacrosToKatex
  Scenario: preamble \newcommand and \DeclareMathOperator become KaTeX macros
    Given a preamble with \newcommand and \DeclareMathOperator
    When its macros are read
    Then they become KaTeX macros, the operator as \operatorname

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::texRewrittenForKatex
  Scenario: TeX that Markdown misreads is rewritten to an equivalent KaTeX accepts
    When TeX that Markdown misreads is rewritten
    Then math inside \text, a pipe, adjacent dollars, \ref and psmallmatrix become KaTeX-safe equivalents

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::wrappedCitationIsOne
  Scenario: a citation wrapped across lines is one citation; fenced code is left alone
    When a citation wrapped across lines and fenced code are converted
    Then the wrapped citation is one label
    And the fenced \cite is left alone and blank lines are kept

  @test:scripts/build-folio-site.test.ts::rendered-content_handling_and_QA_(owner,_2026-10-05)::qaReadsReaderHtml
  Scenario: the QA reads the HTML a reader gets: raw TeX, stray dollars and KaTeX errors are findings
    When blocks with raw TeX and a broken fraction, and a clean block, are rendered and checked
    Then the first has raw-tex and katex findings
    And the clean block has none

  @test:scripts/build-folio-site.test.ts::leanSorryOutsideComments
  Scenario: Lean status reads a sorry outside comments only
    When Lean sources are checked for status
    Then a proof with rfl is proved
    And a proof with sorry is sorry
    And a sorry only in comments is still proved
