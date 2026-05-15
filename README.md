# liner

A CLI of CLIs. Wraps service APIs as plugins that humans and agents can drive uniformly.

## Prerequisites

- [Bun](https://bun.sh) `>= 1.1`
- macOS or Linux

## Setup

```sh
bun install
./bin/liner list
```

To put it on your PATH:

```sh
bun link
liner list
```

## Usage

```sh
liner list                       # discover plugins and commands
liner skills                     # list bundled skills
liner skills using-liner         # print a skill

liner hello greet                # try the smoke-test plugin
liner --json hello greet Pedro
```

## Writing a plugin

Plugins live in `plugins/<name>/plugin.ts`. They are auto-loaded at startup — no install step.

```ts
import { definePlugin } from "../../src/sdk/index.ts";

export default definePlugin({
  name: "asana",
  description: "Asana CLI",
  commands: [
    {
      name: "task:read",
      args: [{ name: "task_id", required: true }],
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<{ token: string }>();
        const data = await ctx.http.get("https://app.asana.com/api/1.0/tasks/" + ctx.args.task_id, { token });
        ctx.output(data);
      },
    },
  ],
});
```

Bundle docs as a skill at `plugins/<name>/skills/<skill>/SKILL.md`. The convention is one skill folder per concept; long reference material goes in a sibling `resources/` directory the SKILL.md links to.

## Layout

```
liner/
├── bin/liner              # entry point
├── src/
│   ├── cli.ts             # parse argv, load plugins, dispatch
│   ├── loader.ts          # plugin + skill discovery
│   └── sdk/               # plugin API
├── plugins/
│   └── hello/             # example plugin
└── skills/
    └── using-liner/       # top-level skill
```
