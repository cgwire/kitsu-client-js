# Development

```bash
npm run check          # eslint, prettier, type declarations, type and unit tests
npm run test:types     # compile tests/consumer against the built declarations
npm run test:coverage  # tests with the coverage report
npm run sync-routes    # regenerate tests/fixtures/zou_routes.json from ../zou
npm run test:live      # read-only smoke test: KITSU_HOST and KITSU_TOKEN
```

`sync-routes` runs the extractor of gazu with Python 3: it expects the `gazu`
and `zou` checkouts next to this repository. `scripts/extract-kitsu-routes.js`
reads the `kitsu` checkout the same way.

Tests inject a fake `fetch`. It rejects any path that Zou does not serve
(`tests/fixtures/zou_routes.json`), so an invented route fails its test. Known
gap: a wrong path shaped like `/data/tasks/open` cannot be told apart from the
CRUD route `/data/tasks/<id>`.

## Kitsu web app coverage

[`docs/kitsu-store-api-mapping.json`](./kitsu-store-api-mapping.json) maps every API function of the Kitsu web
app to the client function covering it. `tests/mapping.spec.js` fails when a
mapped function does not exist.

## Releases

Run the "Release Kitsu Client" workflow from the Actions tab, on `main`, and
pick the part of the version to increase: in 0.x, a minor release may break
the API. A major release also needs its new version typed in the confirm field
(for instance `1.0.0`): without it, the run stops before tagging anything. The
optional line goes above the generated release notes, for instance a new
minimum Zou version. The workflow runs the checks, commits and tags the
version, creates the GitHub release and starts "Publish Kitsu Client to npm"
on the tag. If that publish fails, fix the cause and re-run it: the version is
already tagged.
