A common build fetches the **latest** `publisher.jar` on every run:

```yaml
- name: Update the image to the latest publisher
  uses: docker://hl7fhir/ig-publisher-base:latest
  with:
    args: curl -L https://github.com/HL7/fhir-ig-publisher/releases/latest/download/publisher.jar …
```

Two builds of the same commit can differ, and the output does not say which
version made it, so "the build changed" cannot be told from "the content
changed". A cached AST must therefore record its toolchain (Publisher, core and
SUSHI versions) as a required field.
