A release is cut from a tag and published by a person. The full process is
the `ig-binary-artefacts` skill, §"Releasing".

1. **The owner tags the version.** The tag is `v<version>`, for the version
   in `sushi-config.yaml`, on the default branch. An agent never picks a
   version, pushes a tag or publishes a release.
2. **The tag starts `ig-release.yml`.** It can also be started by hand for a
   tag that already exists.
3. **The build is full.** The refresh runs with `force` and `release`; a
   release is never cut from an incremental AST.
4. **Every release carries the same files:** the packages, `ast-data.zip`
   (the IG's AST, with each `Library`'s ELM) and `SHA256SUMS`.
5. **It stops at a draft.** Whether it is a pre-release is read from
   `sushi-config.yaml`. The owner reviews the draft and publishes it on
   GitHub. A tag whose release is already published is refused.

The caller is short:

```yaml
on:
  push:
    tags: ["v*"]
jobs:
  release:
    uses: litlfred/fhir-harness/.github/workflows/ig-release.yml@main
    with:
      tag: ${{ inputs.tag || github.ref_name }}
```

Copy the full file from
[`templates/ig-repo-site/ig-release.yml`](https://github.com/litlfred/fhir-harness/blob/main/templates/ig-repo-site/ig-release.yml).
