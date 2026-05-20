import { definePlugin } from "../../src/sdk/index.ts";

export default definePlugin({
  name: "hello",
  description: "Smoke-test plugin for the liner plugin system",
  commands: [
    {
      name: "greet",
      description: "Print a greeting",
      args: [{ name: "name", required: false, description: "who to greet" }],
      readonly: true,
      handler: (ctx) => {
        const name = ctx.args.name ?? "world";
        if (ctx.json) ctx.output({ message: `Hello, ${name}!` });
        else ctx.output(`Hello, ${name}!`);
      },
    },
  ],
});
