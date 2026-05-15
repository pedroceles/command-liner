---
name: asana
description: Read Asana tasks from the command line. Use after `liner asana auth`.
---

# asana

Drive Asana from `liner`. Default output is JSON; pass `--no-json` for human-readable output.

## Setup

1. Create a Personal Access Token at https://app.asana.com/0/my-apps
2. Run `liner asana auth` and paste the token. It's stored at `~/.config/liner/asana/credentials.json` (mode `0600`).
3. Verify with `liner asana whoami`.

## Commands

- `liner asana auth` — store an Asana PAT.
- `liner asana whoami` — show the authenticated user and their workspaces.
- `liner asana task:read <task> [--comments]` — read one task. `<task>` can be a gid or any Asana task URL. Pass `--comments` to also fetch the task's comments (`type=comment` stories, up to 100).
- `liner asana task:list [--workspace <gid-or-url>] [--assignee me] [--since now] [--limit 50]` — list tasks assigned to someone in a workspace. If you only have one workspace, `--workspace` is inferred.

## URL handling

Any argument that takes an Asana id also accepts an Asana URL — the parser extracts the right id. Supported URL shapes:

- `https://app.asana.com/1/<workspaceId>/project/<projectId>/task/<taskId>`
- `https://app.asana.com/1/<workspaceId>/project/<projectId>`
- `https://app.asana.com/0/<projectId>/<taskId>` (legacy)

Anything that isn't a recognised Asana URL is treated as the raw id.

## Examples

```sh
liner asana auth
liner asana whoami --no-json
liner asana task:read 1209876543210
liner asana task:read https://app.asana.com/1/752389237742425/project/1198207191493787/task/1214799263360178
liner asana task:read 1209876543210 --comments
liner asana task:read 1209876543210 --comments --no-json
liner asana task:list --assignee me --since 2026-05-01
liner asana task:list --workspace https://app.asana.com/1/752389237742425/project/1198207191493787
```

## JSON shape

- `task:read` returns Asana's `data` object directly: `{ gid, name, completed, notes, assignee, due_on, projects, permalink_url }`.
- `task:list` returns the `data` array — task summaries with the same fields (minus notes).
- `whoami` returns `{ gid, name, email, workspaces: [{ gid, name }] }`.

Errors exit non-zero and write to stderr. HTTP errors include the Asana response body for debugging.
