---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s017-doc-strings
section_title: "Doc Strings"
file: "content/docs/gherkin/reference.md"
lines: 439-492
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Doc Strings

`Doc Strings` are handy for passing a larger piece of text to a step definition.

The text should be offset by delimiters consisting of three double-quote marks on lines of their own:
```gherkin
Given a blog post named "Random" with Markdown body
  """
  Some Title, Eh?
  ===============
  Here is the first paragraph of my blog post. Lorem ipsum dolor sit amet,
  consectetur adipiscing elit.
  """
```
In your step definition, there’s no need to find this text and match it in your pattern.
It will automatically be passed as the last argument in the step definition.

Indentation of the opening `"""` is unimportant, although common practice is two spaces in from the enclosing step.
The indentation inside the triple quotes, however, is significant. Each line of the Doc String will be dedented according to the opening `"""`. Indentation beyond the column of the opening `"""` will therefore be preserved.

Doc strings also support using three backticks as the delimiter:

~~~gherkin
Given a blog post named "Random" with Markdown body
  ```
  Some Title, Eh?
  ===============
  Here is the first paragraph of my blog post. Lorem ipsum dolor sit amet,
  consectetur adipiscing elit.
  ```
~~~

This might be familiar for those used to writing with Markdown.

{{% note "Tool support for backticks"%}}
Whilst all current versions of Cucumber support backticks as the delimiter, many tools like text editors don't (yet).
{{% /note %}}

It's possible to annotate the DocString with the type of content it contains. You specify the content type after the
triple quote, as follows:

```gherkin
Given a blog post named "Random" with Markdown body
  """markdown
  Some Title, Eh?
  ===============
  Here is the first paragraph of my blog post. Lorem ipsum dolor sit amet,
  consectetur adipiscing elit.
  """
```

{{% note "Tool support for content types"%}} Whilst all current versions of Cucumber support content types as the
delimiter, many tools like text editors don't (yet). {{% /note %}}
