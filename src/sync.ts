import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { SkillEntry } from "./loader.ts";

export const DEFAULT_PATHS = [
  "~/.claude/skills",
  "~/.config/opencode/skills",
  "~/.cursor/skills",
  "~/.codex/skills",
];

export type LinkStatus =
  | "created"
  | "updated"
  | "exists"
  | "removed"
  | "absent"
  | "skipped";

export interface LinkResult {
  name: string;
  source: string;
  target: string;
  status: LinkStatus;
  reason?: string;
}

export interface PathResult {
  path: string;
  links: LinkResult[];
  skipped?: string;
}

export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function filterSkills(skills: SkillEntry[], only?: string[]): SkillEntry[] {
  if (!only || only.length === 0) return skills;
  const set = new Set(only);
  return skills.filter((s) => set.has(s.origin));
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
}

export async function syncSkills(
  skills: SkillEntry[],
  paths: string[],
): Promise<PathResult[]> {
  const results: PathResult[] = [];

  for (const raw of paths) {
    const targetDir = expandHome(raw);
    if (!(await exists(targetDir))) {
      results.push({
        path: targetDir,
        links: [],
        skipped: `${targetDir} does not exist — skipping`,
      });
      continue;
    }

    const links: LinkResult[] = [];
    for (const skill of skills) {
      const source = path.dirname(skill.path);
      const linkPath = path.join(targetDir, skill.name);

      let status: LinkStatus;
      let reason: string | undefined;
      try {
        const stat = await fs.lstat(linkPath);
        if (stat.isSymbolicLink()) {
          const current = await fs.readlink(linkPath);
          if (current === source) {
            status = "exists";
          } else {
            await fs.unlink(linkPath);
            await fs.symlink(source, linkPath);
            status = "updated";
          }
        } else {
          status = "skipped";
          reason = "path exists and is not a symlink";
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          await fs.symlink(source, linkPath);
          status = "created";
        } else {
          throw err;
        }
      }
      links.push({ name: skill.name, source, target: linkPath, status, reason });
    }
    results.push({ path: targetDir, links });
  }

  return results;
}

export async function listSynced(
  skills: SkillEntry[],
  paths: string[],
): Promise<PathResult[]> {
  const results: PathResult[] = [];

  for (const raw of paths) {
    const targetDir = expandHome(raw);
    if (!(await exists(targetDir))) {
      results.push({
        path: targetDir,
        links: [],
        skipped: `${targetDir} does not exist — skipping`,
      });
      continue;
    }

    const links: LinkResult[] = [];
    for (const skill of skills) {
      const source = path.dirname(skill.path);
      const linkPath = path.join(targetDir, skill.name);
      try {
        const stat = await fs.lstat(linkPath);
        if (stat.isSymbolicLink() && (await fs.readlink(linkPath)) === source) {
          links.push({ name: skill.name, source, target: linkPath, status: "exists" });
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }
    }
    results.push({ path: targetDir, links });
  }

  return results;
}

export async function unsyncSkills(
  skills: SkillEntry[],
  paths: string[],
): Promise<PathResult[]> {
  const results: PathResult[] = [];

  for (const raw of paths) {
    const targetDir = expandHome(raw);
    if (!(await exists(targetDir))) {
      results.push({
        path: targetDir,
        links: [],
        skipped: `${targetDir} does not exist — skipping`,
      });
      continue;
    }

    const links: LinkResult[] = [];
    for (const skill of skills) {
      const source = path.dirname(skill.path);
      const linkPath = path.join(targetDir, skill.name);

      let status: LinkStatus;
      let reason: string | undefined;
      try {
        const stat = await fs.lstat(linkPath);
        if (stat.isSymbolicLink()) {
          const current = await fs.readlink(linkPath);
          if (current === source) {
            await fs.unlink(linkPath);
            status = "removed";
          } else {
            status = "skipped";
            reason = "symlink points elsewhere";
          }
        } else {
          status = "skipped";
          reason = "not a symlink";
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          status = "absent";
        } else {
          throw err;
        }
      }
      links.push({ name: skill.name, source, target: linkPath, status, reason });
    }
    results.push({ path: targetDir, links });
  }

  return results;
}
