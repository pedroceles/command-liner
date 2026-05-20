import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs/promises";
import { loadPlugins, loadSkills } from "./loader.ts";
import { createContext } from "./sdk/context.ts";
import { HttpError } from "./sdk/http.ts";
import {
  syncSkills,
  unsyncSkills,
  listSynced,
  filterSkills,
  DEFAULT_PATHS,
  type PathResult,
} from "./sync.ts";

const statusGlyph = (status: string): string =>
  status === "created"
    ? pc.green("+")
    : status === "updated"
      ? pc.yellow("~")
      : status === "removed"
        ? pc.red("-")
        : status === "absent"
          ? pc.dim("·")
          : status === "skipped"
            ? pc.red("!")
            : pc.dim("=");

const printResults = (results: PathResult[]) => {
  for (const r of results) {
    console.log(pc.bold(r.path));
    if (r.skipped) {
      console.log(`  ${pc.dim(`skipped — ${r.skipped}`)}`);
      continue;
    }
    if (r.links.length === 0) {
      console.log(`  ${pc.dim("(none)")}`);
      continue;
    }
    for (const link of r.links) {
      const suffix = link.reason ? pc.dim(` (${link.reason})`) : "";
      console.log(`  ${statusGlyph(link.status)} ${link.name} → ${link.source}${suffix}`);
    }
  }
};

async function main() {
  const plugins = await loadPlugins();

  const program = new Command();
  program
    .name("liner")
    .description("A CLI of CLIs.")
    .version("0.0.1")
    .option("--no-json", "human-readable output (default is JSON)")
    .option("--readonly", "refuse to run commands not marked readonly (for safe allowlists)")
    .enablePositionalOptions();

  const refuseIfReadonly = (label: string) => {
    if (program.opts().readonly) {
      console.error(pc.red(`Refusing to run '${label}' under --readonly: command may mutate state.`));
      process.exit(2);
    }
  };

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

  program
    .command("skills")
    .description("list bundled skills, or print one with `liner skills <name>`")
    .argument("[name]", "skill name to print")
    .option("--synced", "list skills currently synced to default target dirs")
    .action(async (name: string | undefined, opts: { synced?: boolean }) => {
      const skills = await loadSkills(plugins);
      if (opts.synced) {
        const results = await listSynced(skills, DEFAULT_PATHS);
        printResults(results);
        return;
      }
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

  const parsePathsArg = (paths?: string): string[] =>
    paths
      ? paths.split(",").map((p) => p.trim()).filter(Boolean)
      : DEFAULT_PATHS;

  const parseOnly = (only?: string): string[] | undefined =>
    only ? only.split(",").map((p) => p.trim()).filter(Boolean) : undefined;

  program
    .command("skills:sync")
    .description("symlink skills into target dirs (default: claude, opencode, cursor, codex)")
    .argument("[paths]", "comma-separated target dirs")
    .option("--only <plugins>", "only sync skills from these plugin origins (comma-separated)")
    .action(async (paths: string | undefined, opts: { only?: string }) => {
      refuseIfReadonly("skills:sync");
      const skills = filterSkills(await loadSkills(plugins), parseOnly(opts.only));
      const results = await syncSkills(skills, parsePathsArg(paths));
      printResults(results);
    });

  program
    .command("skills:unsync")
    .description("remove symlinks previously created by skills:sync")
    .argument("[paths]", "comma-separated target dirs")
    .option("--only <plugins>", "only unsync skills from these plugin origins (comma-separated)")
    .action(async (paths: string | undefined, opts: { only?: string }) => {
      refuseIfReadonly("skills:unsync");
      const skills = filterSkills(await loadSkills(plugins), parseOnly(opts.only));
      const results = await unsyncSkills(skills, parsePathsArg(paths));
      printResults(results);
    });

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
        if (programOpts.readonly && !cmd.readonly) {
          refuseIfReadonly(`${plugin.name} ${cmd.name}`);
        }
        const subOpts = subCmd.opts();
        const flags = { ...programOpts, ...subOpts, json: programOpts.json !== false && subOpts.json !== false };
        const ctx = createContext({ pluginName: plugin.name, args, flags });
        await cmd.handler(ctx);
      });
    }

    if (plugin.fallthrough) {
      const bin = plugin.fallthrough;
      pluginCmd.allowUnknownOption(true);
      pluginCmd.allowExcessArguments(true);
      pluginCmd.action(async () => {
        const knownNames = new Set(plugin.commands.map((c) => c.name));
        const raw = process.argv.slice(process.argv.indexOf(plugin.name) + 1);
        if (raw.length === 0 || knownNames.has(raw[0]!)) return;
        if (program.opts().readonly) {
          const prefix = raw.slice(0, 2).join(" ");
          const allowed = plugin.fallthroughReadonly ?? [];
          if (!allowed.some((a) => prefix === a || raw[0] === a)) {
            refuseIfReadonly(`${plugin.name} ${raw.join(" ")} (fallthrough to ${bin})`);
          }
        }
        const proc = Bun.spawn([bin, ...raw], {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });
        const code = await proc.exited;
        process.exit(code);
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
