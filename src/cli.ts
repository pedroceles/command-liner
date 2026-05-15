import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs/promises";
import { loadPlugins, loadSkills } from "./loader.ts";
import { createContext } from "./sdk/context.ts";
import { HttpError } from "./sdk/http.ts";

async function main() {
  const plugins = await loadPlugins();

  const program = new Command();
  program
    .name("liner")
    .description("A CLI of CLIs.")
    .version("0.0.1")
    .option("--no-json", "human-readable output (default is JSON)")
    .enablePositionalOptions();

  program
    .command("list")
    .description("list installed plugins and their commands")
    .action(() => {
      if (plugins.length === 0) {
        console.log("No plugins found.");
        return;
      }
      for (const plugin of plugins) {
        const header = plugin.description
          ? `${pc.bold(plugin.name)} — ${plugin.description}`
          : pc.bold(plugin.name);
        console.log(header);
        for (const cmd of plugin.commands) {
          const argSig = (cmd.args ?? [])
            .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
            .join(" ");
          const line = `  liner ${plugin.name} ${cmd.name}${argSig ? " " + argSig : ""}`;
          console.log(cmd.description ? `${line}  — ${cmd.description}` : line);
        }
      }
    });

  const skillsCmd = program
    .command("skills")
    .description("list bundled skills, or print one with `liner skills <name>`")
    .argument("[name]", "skill name to print")
    .action(async (name?: string) => {
      const skills = await loadSkills(plugins);
      if (name) {
        const match = skills.find((s) => s.name === name);
        if (!match) {
          console.error(`Skill '${name}' not found.`);
          process.exit(1);
        }
        const content = await fs.readFile(match.path, "utf8");
        process.stdout.write(content);
        return;
      }
      if (skills.length === 0) {
        console.log("No skills found.");
        return;
      }
      for (const skill of skills) {
        console.log(`${pc.bold(skill.name)} ${pc.dim(`(${skill.origin})`)}`);
      }
    });
  void skillsCmd;

  for (const plugin of plugins) {
    const pluginCmd = program
      .command(plugin.name)
      .description(plugin.description ?? `${plugin.name} plugin`)
      .passThroughOptions();

    for (const cmd of plugin.commands) {
      const sub = pluginCmd.command(cmd.name).description(cmd.description ?? "");
      sub.option("--no-json", "human-readable output (default is JSON)");
      for (const arg of cmd.args ?? []) {
        sub.argument(arg.required ? `<${arg.name}>` : `[${arg.name}]`, arg.description);
      }
      for (const flag of cmd.flags ?? []) {
        const sig = flag.takesValue ? `--${flag.name} <value>` : `--${flag.name}`;
        sub.option(sig, flag.description);
      }
      sub.action(async (...actionArgs) => {
        const subCmd = actionArgs[actionArgs.length - 1];
        const positional = actionArgs.slice(0, -2);
        const args: Record<string, string | undefined> = {};
        (cmd.args ?? []).forEach((a, i) => {
          args[a.name] = positional[i];
        });
        const programOpts = program.opts();
        const subOpts = subCmd.opts();
        const flags = { ...programOpts, ...subOpts, json: programOpts.json !== false && subOpts.json !== false };
        const ctx = createContext({ pluginName: plugin.name, args, flags });
        await cmd.handler(ctx);
      });
    }
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof HttpError) {
      console.error(pc.red(`${err.message}`));
      if (err.body) console.error(JSON.stringify(err.body, null, 2));
      process.exit(1);
    }
    if (err instanceof Error) {
      console.error(pc.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

await main();
