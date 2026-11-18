# Specifies schemas/ui/render-output.ts: renderToolOutput, which renders a
# tool output by its render hint (text, url, markdown, json), the hint's own
# rules in tools/tool.ts, and the lazy window loader that fetches a card's
# detail only when its window opens (bean q2wm).
Feature: A tool output renders by its hint, and a window's detail is fetched on open

  Background:
    Given the hostile payload "<script>alert(1)</script><img src=x onerror=\"alert(2)\">"

  @test:schemas/ui/render-output.test.ts::renderToolOutput::text_—_the_default_—_escapes_everything,_so_no_markup_survives
  Scenario: Text, the default, escapes all markup
    When the payload is rendered with no hint, and with hint "text"
    Then neither output contains "<script" or "<img"
    And each contains "&lt;script&gt;"

  @test:schemas/ui/render-output.test.ts::renderToolOutput::url_—_links_a_safe_scheme,_and_SHOWS_a_refused_one_as_text
  Scenario: A url output links a safe scheme and shows a refused one as text
    When "https://example.org/a" is rendered as "url"
    Then the output links href "https://example.org/a"
    And "javascript:alert(1)", a TAB-split "java<TAB>script:alert(1)" and a data: URL each render with no "<a" and no "href="
    And each refused URL renders as exactly its own text, HTML-escaped

  @test:schemas/ui/render-output.test.ts::renderToolOutput::markdown_—_renders_markup,_but_raw_HTML_and_a_javascript:_link_do_not_survive
  Scenario: Markdown renders markup but not raw HTML or a javascript: link
    Given markdown with a heading, bold text, an https link, a javascript: link and the payload
    When it is rendered as "markdown"
    Then the output contains "<h1>Title</h1>", "<strong>bold</strong>" and href "https://example.org"
    And it contains no "javascript:", no "<script" and no "onerror"

  @test:schemas/ui/render-output.test.ts::renderToolOutput::json_—_shown_escaped_in_a_<pre>,_never_injected
  Scenario: JSON is shown escaped in a pre
    Given a JSON string whose value holds "</pre><script>x</script>"
    When it is rendered as "json"
    Then the output starts with "<pre>"
    And it contains no "<script"
    And it contains exactly one "</pre>"

  @test:schemas/ui/render-output.test.ts::the_hint's_own_rules::absent_is_allowed,_and_means_text
  Scenario: An output port with no render hint parses, and renders as text
    Given a tool output port of schema Markdown with no render hint
    When it is parsed with the tool output schema
    Then it parses, with no render hint
    And the payload rendered with no hint is the same as rendered with hint "text"
    And "**bold**" rendered with no hint is "**bold**", not markup

  @test:schemas/ui/render-output.test.ts::the_hint's_own_rules::anything_but_text_needs_a_stated_reason
  Scenario: A non-text hint needs a reason
    When the render hint as "markdown" with no reason is parsed
    Then it is refused
    And as "markdown" with a reason parses
    And as "text" with no reason parses

  @test:schemas/ui/render-output.test.ts::the_hint's_own_rules::url_and_markdown_only_on_an_output_whose_schema_IS_Url_/_Markdown
  Scenario: The url and markdown hints only fit outputs of that schema
    When a Url output with hint "url" is parsed
    Then it parses
    And a Markdown output with hint "markdown" parses
    And a Text output with hint "url" is refused
    And a Text output with hint "markdown" is refused
    And a Url output with hint "markdown" is refused
    And a Markdown output with hint "url" is refused

  @test:schemas/ui/render-output.test.ts::lazy_window_content_fetch_on_open_—_bean_q2wm::rendering_the_board_with_N_cards_makes_0_detail_fetches_up_front;_opening_1_window_fetches_only_that_card_and_caches_it
  Scenario: Board tiles fetch nothing; opening a window fetches that card once
    Given a lazy loader over four cards, each with a different detail href, and a recording fetcher
    When the board tiles are rendered
    Then there are four tiles, no fetch and an empty cache
    When the window for "card-2" is opened
    Then exactly its body URL was fetched, not from the cache
    And the window shows the fetched comment and links the url output "https://example.org/report"
    And only "card-2" is cached
    When the window for "card-2" is opened again
    Then it comes from the cache with the same HTML
    And there was still only one fetch

  @test:schemas/ui/render-output.test.ts::lazy_window_content_fetch_on_open_—_bean_q2wm::neutralises_hostile_<script>,_event_attributes,_and_javascript:_URLs_in_lazy-fetched_window_content
  Scenario: Lazily fetched window content is neutralised
    Given a lazy loader over one card whose fetched JSON holds a markdown comment with a javascript: link and the payload, and text, url, TAB-split url, good url and json outputs
    When the board tiles are rendered
    Then nothing is fetched
    When the card's window is opened
    Then its detail href was fetched once
    And the HTML contains "<h1>Heading</h1>" and links "https://example.org/safe" and "https://example.org/ok"
    And it contains no "<script", no "<img", no 'onerror="', no javascript: href and no TAB-split javascript: href
    And it still shows the text "javascript:alert(9)"

  @test:schemas/ui/render-output.test.ts::lazy_window_content_fetch_on_open_—_bean_q2wm::refuses_to_fetch_a_hostile_detailHref_scheme_and_shows_it_as_escaped_text
  Scenario: A hostile detail href is not fetched and is shown as text
    Given a lazy loader over a card with detail href "javascript:alert(1)" and one with a data: URL holding a script
    When both windows are opened
    Then nothing is fetched
    And the first window has no "<a" and shows "javascript:alert(1)"
    And the second has no "<script" and shows the script escaped

  @test:schemas/ui/render-output.test.ts::lazy_window_content_fetch_on_open_—_bean_q2wm::cardDetailHref_and_renderWindowDetail_preserve_inline_comments_when_jsonldHref_is_only_a_fallback
  Scenario: A card with an inline comment has no detail href to fetch, and its comment is rendered
    When the detail href is asked for a card with an inline comment and a jsonldHref
    Then there is none
    And for a card with only a jsonldHref it is that href
    And rendering a detail with the comment "Already inline" contains "<p>Already inline</p>" and not "No detail recorded."
    And rendering an empty detail says "No detail recorded."

  @test:schemas/ui/render-output.test.ts::lazy_window_content_fetch_on_open_—_bean_q2wm::docs-ui.js_wires_lazy_fetchCardDetail_on_openCard_(not_todoSlot)_and_renders_tool_outputs_via_renderToolOutput
  Scenario: docs-ui.js fetches card detail in openCard, not in todoSlot, and renders outputs via renderToolOutput
    Given the harness's site-chrome/assets/js/docs-ui.js
    When its source is read
    Then it defines "function renderToolOutput(value, hint)" and "function fetchCardDetail(todo, done)"
    And the todoSlot function, up to "syncStickyPins();", does not call fetchCardDetail
    And the openCard function, up to the "No semantic zoom" comment, calls fetchCardDetail(todo
    And the renderWindowOutputs function calls renderToolOutput(item.value, item.render)
