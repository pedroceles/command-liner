---
name: using-liner
description: How an agent should discover and invoke liner plugins.
---

# using-liner

`liner` is a parent CLI that dispatches to plugins. Use it the same way a human would.

## Discovery

1. `liner list` — lists all installed plugins and their commands.
2. `liner skills` — lists bundled skills (one per plugin + top-level).
3. `liner skills <name>` — prints a specific skill.
4. `liner <plugin> <command> --help` — shows args/flags for a command.

## Output

- **Default output is JSON.** Agents should not pass any flag.
- Pass `--no-json` (anywhere on the command line) for human-readable output:
  ```sh
  liner asana task:read 12345 --no-json
  liner --no-json asana task:read 12345
  ```
- Errors are written to stderr with a non-zero exit code.

## Credentials

- Plugins that require auth provide an `auth` subcommand: `liner <plugin> auth`.
- Credentials live in `~/.config/liner/<plugin>/credentials.json` (mode `0600`).
- If a command needs credentials and none exist, it exits with a message telling you to run `auth`.
