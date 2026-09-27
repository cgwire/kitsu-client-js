# Development

```bash
npm run check        # eslint, prettier, type declarations, tests
npm run test:coverage # tests with the coverage report
npm run sync-routes  # regenerate tests/fixtures/zou_routes.json from ../zou
npm run test:live    # read-only smoke test: KITSU_HOST and KITSU_TOKEN
```

Tests inject a fake `fetch`. It rejects any path that Zou does not serve
(`tests/fixtures/zou_routes.json`), so an invented route fails its test. Known
gap: a wrong path shaped like `/data/tasks/open` cannot be told apart from the
CRUD route `/data/tasks/<id>`.

## Kitsu web app coverage

[`docs/kitsu-store-api-mapping.json`](./kitsu-store-api-mapping.json) maps every API function of the Kitsu web
app to the client function covering it. `tests/mapping.spec.js` fails when a
mapped function does not exist.
