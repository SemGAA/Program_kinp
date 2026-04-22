# Release Flow

Cinema Notes publishes Android builds through GitHub Releases.

## Channels

- Stable releases use tags like `v1.6.0`.
- Beta builds use tags like `v1.6.0-beta.1`.
- Beta releases are marked as pre-release on GitHub.
- APK files are attached to releases by the `Publish Android Release` workflow.

## How to publish the next build

1. Build the APK locally or through CI.
2. Upload the APK to the `apk-downloads` branch.
3. Update `CHANGELOG.md`.
4. Add a file in `release-notes`, for example `release-notes/v1.6.0-beta.1.md`.
5. Create and push a tag:

```bash
git tag -a v1.6.0-beta.1 -m "Cinema Notes v1.6.0 beta 1"
git push origin v1.6.0-beta.1
```

The workflow downloads the APK from the `apk-downloads` branch and creates a GitHub Release.

## GitHub Page

The public product page is published from the `gh-pages` branch:

```text
https://semgaa.github.io/Program_kinp/
```

When the files in `docs` change, publish the same files to `gh-pages`.
