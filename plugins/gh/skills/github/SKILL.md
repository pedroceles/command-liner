---
name: github
description: GitHub via liner. Custom commands (comments) plus gh CLI fallthrough. Use after `liner gh auth`.
---

# gh

GitHub plugin for `liner`. Provides custom commands with enhanced output, and falls through to the `gh` CLI for everything else.

Default output is JSON; pass `--no-json` for human-readable output on custom commands. Fallthrough commands use `gh` CLI output directly.

## Setup

1. Create a Personal Access Token at https://github.com/settings/tokens (classic or fine-grained).
2. The token needs at least the `repo` scope (classic) or read access to pull requests and issues (fine-grained).
3. Run `liner gh auth` and paste the token. It's stored at `~/.config/liner/gh/credentials.json` (mode `0600`).

## Commands

- `liner gh auth` — store a GitHub PAT.
- `liner gh comments <pr> [--repo owner/repo]` — fetch all PR comments (conversation, inline review, and review summaries), excluding resolved threads and top-level `cursor[bot]` noise. Sorted chronologically.

## PR reference formats

`comments` accepts any of:

- `https://github.com/owner/repo/pull/123` — full PR URL
- `'owner/repo#123'` — shorthand (quote it; `#` is a shell comment character)
- `123 --repo owner/repo` — plain number with explicit repo flag

## gh CLI fallthrough

Any subcommand not defined above is forwarded to the `gh` CLI:

```sh
liner gh pr view 42 --repo acme/widgets --json title,state
liner gh issue list --repo acme/widgets
liner gh repo view acme/widgets
```

## Examples

```sh
liner gh auth
liner gh comments https://github.com/acme/widgets/pull/42
liner gh comments 'acme/widgets#42' --no-json
liner gh comments 42 --repo acme/widgets
liner gh pr list --repo acme/widgets
```

## JSON shape

`comments` returns an array of unified comment objects sorted by `created_at`:

```json
[
  {
    "id": 123456,
    "kind": "conversation",
    "author": "octocat",
    "body": "Looks good!",
    "created_at": "2026-01-15T10:30:00Z",
    "html_url": "https://github.com/acme/widgets/pull/42#issuecomment-123456"
  },
  {
    "id": 789012,
    "kind": "review",
    "author": "reviewer",
    "body": "Nit: rename this variable",
    "created_at": "2026-01-15T11:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/42#discussion_r789012",
    "path": "src/widget.ts",
    "line": 42
  },
  {
    "id": 345678,
    "kind": "review_summary",
    "author": "reviewer",
    "body": "A few small nits, otherwise LGTM.",
    "created_at": "2026-01-15T11:00:00Z",
    "html_url": "https://github.com/acme/widgets/pull/42#pullrequestreview-345678",
    "review_state": "APPROVED"
  }
]
```

- `kind: "conversation"` — top-level comments on the PR conversation tab (excludes `cursor[bot]`).
- `kind: "review"` — inline review comments on the diff (excludes resolved threads). Includes `path` and `line` when available.
- `kind: "review_summary"` — the body submitted with a review action (approve, request changes, etc.). Includes `review_state`.

Errors exit non-zero and write to stderr. A `401` means the token is invalid; a `404` typically means the repo is private and the token lacks access.
