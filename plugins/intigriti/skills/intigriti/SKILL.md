---
name: intigriti
description: Fetch Intigriti bug bounty submissions (default: triage state) from the command line.
---

# intigriti

Read-only access to the Intigriti Company External API v2.1. Default output is JSON; pass `--no-json` for human-readable output.

## Setup

Export an Intigriti access token:

```sh
export INTIGRITI_ACCESS_TOKEN=...
```

That's the only credential the plugin reads. Get one through whatever auth flow your org already uses.

## Commands

- `liner intigriti submission:list [--state <value>]` — list submissions, filtered by state. Defaults to `triage`. Pass `--state all` to disable filtering.
- `liner intigriti submission:read <code>` — fetch full details for one submission (description + impact).

## Examples

```sh
liner intigriti submission:list --no-json
liner intigriti submission:list --state accepted
liner intigriti submission:read TREMENDOUS-FFIOSYTA --no-json
```

## JSON shape

- `submission:list` returns the raw `Submission[]` array filtered client-side by state value.
- `submission:read` returns the raw submission object including a nested `report` with `pocDescription` and `impact`.

Errors exit non-zero. HTTP errors include the Intigriti response body for debugging.
