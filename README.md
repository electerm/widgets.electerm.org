# electerm-widgets

Community registry of [electerm](https://electerm.org) widgets: a pure static
site on Cloudflare Workers Static Assets. No Worker script, no database, no
login, no admin, and no write API.

This site **only indexes metadata**. Widget code is downloaded from each
author's repository at a pinned commit. Installing a widget means trusting its
author — a widget's `main.js` runs inside the electerm main process with full
Node.js privileges.

## Local development

```
npm install          # generates package-lock.json; commit it
npm test
npm run lint
npm run build        # fetches sources; writes public/
npm run wdev         # wrangler dev on localhost:26790
```

`public/` is generated and git-ignored; it is rebuilt by `npm run build` on
every deploy. No database or migration step is needed.

## Data contract

`GET /api/v1/index.json`, `GET /api/v1/widgets/<id>.json`,
`GET /api/v1/revocations.json` and `GET /health` are plain static files
generated from `data/widgets.json`. `generatedAt` is the build time, not the
request time. `public/_headers` adds `Access-Control-Allow-Origin: *` and
`Cache-Control: public, max-age=300` to `/api/v1/*`; unmatched paths return
`404.html` via `not_found_handling = "404-page"`.

Only `<id>.json` URLs exist — the registry `filesUrl` always uses that form.

## Adding a widget

Open a PR that appends an entry to `data/widgets.json`:

```json
{
  "host": "github.com",
  "owner": "electerm",
  "repo": "electerm-widget-ftp-server",
  "subdir": "",
  "ref": "<40-char lowercase hex commit sha>"
}
```

`ref` **must** be a full 40-character lowercase hex commit sha (not a tag or
branch); pinning a sha is what makes the digest reproducible. The widget's
`package.json` must contain an `electerm` object whose `id` matches
`^[a-z0-9-]+$`.

## CI / deploy

`.github/workflows/deploy.yml` runs on push to main, daily, and on dispatch.
It needs these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GITHUB_TOKEN` is provided automatically by Actions.

The workflow runs `npm run build` and then `wrangler deploy`. Commit the
`package-lock.json` produced by `npm install` so `npm ci` works in CI.

## Security note

The site only indexes metadata; code is downloaded from the author's repo.
Installing a widget is equivalent to trusting its author — `main.js` runs in
the electerm main process with full Node.js privileges.
