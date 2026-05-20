---
name: notion
description: Read Notion pages as markdown from the command line. Use after `liner notion auth`.
---

# notion

Drive Notion from `liner`. Default output is JSON; pass `--no-json` for human-readable output (the raw markdown is printed to stdout).

## Setup

1. Create a Personal Access Token (or internal integration secret) at https://www.notion.so/profile/integrations
2. Share the pages you want to read with the integration (in Notion: ••• menu → Connections → add your integration).
3. Run `liner notion auth` and paste the token. It's stored at `~/.config/liner/notion/credentials.json` (mode `0600`).
4. Verify with `liner notion whoami`.

## Commands

- `liner notion auth` — store a Notion token.
- `liner notion whoami` — show the authenticated bot/user.
- `liner notion page:read <page> [--include-transcript]` — retrieve a page as markdown. `<page>` can be a 32-hex id, a dashed UUID, or any Notion page URL. Pass `--include-transcript` to include meeting note transcripts.

## URL handling

`page:read` accepts any of:

- `https://www.notion.so/My-Page-<32hex>`
- `https://www.notion.so/<workspace>/My-Page-<32hex>`
- `https://<workspace>.notion.site/My-Page-<32hex>`
- `https://www.notion.so/My-Page-<32hex>?p=<sub-id>` — the `?p=` sub-page wins
- A raw 32-hex id or dashed UUID

The id is canonicalised to dashed UUID form before calling the API.

## Examples

```sh
liner notion auth
liner notion whoami --no-json
liner notion page:read b55c9c91384d452b81dbd1ef79372b75
liner notion page:read https://www.notion.so/acme/Roadmap-b55c9c91384d452b81dbd1ef79372b75
liner notion page:read https://www.notion.so/acme/Roadmap-b55c9c91384d452b81dbd1ef79372b75 --no-json
liner notion page:read <id> --include-transcript
```

## JSON shape

`page:read` returns the API response directly:

```json
{
  "object": "page_markdown",
  "id": "b55c9c91-384d-452b-81db-d1ef79372b75",
  "markdown": "# Page title\n\n...",
  "truncated": false,
  "unknown_block_ids": []
}
```

If `truncated` is `true`, re-fetch each id in `unknown_block_ids` by passing it as `<page>` to `page:read`.

`whoami` returns Notion's `/v1/users/me` object: `{ object, id, name, type, person?: { email }, bot?: { workspace_name, owner } }`.

Errors exit non-zero and write to stderr. HTTP errors include the Notion response body for debugging — a `403` typically means the integration hasn't been shared with the page.
