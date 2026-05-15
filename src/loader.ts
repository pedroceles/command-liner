import { Glob } from "bun";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "./sdk/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PLUGINS_DIR = path.resolve(here, "../plugins");
export const SKILLS_DIR = path.resolve(here, "../skills");

export interface LoadedPlugin extends Plugin {
  path: string;
}

export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const glob = new Glob("*/plugin.ts");
  const plugins: LoadedPlugin[] = [];
  for await (const file of glob.scan({ cwd: PLUGINS_DIR })) {
    const full = path.join(PLUGINS_DIR, file);
    const mod = await import(full);
    const plugin = mod.default as Plugin | undefined;
    if (!plugin?.name || !Array.isArray(plugin.commands)) {
      console.warn(`Skipping ${file}: no valid default export from definePlugin()`);
      continue;
    }
    plugins.push({ ...plugin, path: path.dirname(full) });
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  return plugins;
}

export interface SkillEntry {
  name: string;
  origin: string;
  path: string;
}

export async function loadSkills(plugins: LoadedPlugin[]): Promise<SkillEntry[]> {
  const entries: SkillEntry[] = [];

  const topGlob = new Glob("*/SKILL.md");
  for await (const file of topGlob.scan({ cwd: SKILLS_DIR })) {
    entries.push({
      name: file.split("/")[0]!,
      origin: "liner",
      path: path.join(SKILLS_DIR, file),
    });
  }

  for (const plugin of plugins) {
    const pluginSkills = new Glob("skills/*/SKILL.md");
    for await (const file of pluginSkills.scan({ cwd: plugin.path })) {
      entries.push({
        name: file.split("/")[1]!,
        origin: plugin.name,
        path: path.join(plugin.path, file),
      });
    }
  }

  return entries;
}
