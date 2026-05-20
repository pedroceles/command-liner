---
name: liner-datadog
description: Search and read Datadog logs from the command line. Use after `liner datadog auth`.
---

# liner-datadog

Read-only access to Datadog logs via the official `@datadog/datadog-api-client` v2 client. Default output is JSON; pass `--no-json` for human-readable output.

## Setup

1. Create an **API key**: https://app.datadoghq.com/organization-settings/api-keys
2. Create an **Application key**: https://app.datadoghq.com/organization-settings/application-keys
3. Run `liner datadog auth` and paste both. You'll also be asked for your **site** (`datadoghq.com`, `datadoghq.eu`, `us3.datadoghq.com`, etc.) — defaults to `datadoghq.com`.
4. Credentials live at `~/.config/liner/datadog/credentials.json` (mode `0600`).

## Commands

- `liner datadog log:search <input> [--from] [--to] [--limit]` — search logs.
  - `<input>` can be a raw Datadog log query (`service:web @http.status_code:500`) **or** any `https://app.datadoghq.com/logs?...` URL — the URL's `query`, `from_ts`, and `to_ts` are extracted automatically.
  - `--from` / `--to` accept ISO 8601 or relatives like `now-15m`, `now-1h`. They override URL-derived values.
  - `--limit` defaults to 25 (max 1000).
- `liner datadog log:read <input>` — fetch a single log by id or URL.
  - `<input>` can be a raw log id or a Datadog `/logs?event=...` URL. When given a URL with `query`, `from_ts`, `to_ts`, and `event`, the command searches the URL's window and matches by id (most reliable). Otherwise it falls back to `_id:<id>` search.

## Examples

```sh
liner datadog auth
liner datadog log:search "service:web @http.status_code:500"
liner datadog log:search "service:web" --from now-1h --limit 50 --no-json

# Paste a URL straight from the Datadog UI:
liner datadog log:search "https://app.datadoghq.com/logs?query=%40controller%3A%2AUserSession%2A&from_ts=1675700345098&to_ts=1675703945098"
liner datadog log:read "https://app.datadoghq.com/logs?query=...&from_ts=...&to_ts=...&event=AwAAAZ4sES..."
```

## JSON shape

- `log:search` returns the raw `data: Log[]` array from the v2 API. Each log: `{ id, type, attributes: { timestamp, host, service, status, message, tags, attributes } }`.
- `log:read` returns a single `Log` object with the same shape.

## URL parsing

Recognised URL params on `app.datadoghq.*/logs`:
- `query` — log search query (URL-decoded)
- `from_ts`, `to_ts` — epoch milliseconds, converted to ISO 8601
- `event` — the log id to highlight

EU, US3/US5, and AP1 hostnames (`app.datadoghq.eu`, etc.) are also accepted.
