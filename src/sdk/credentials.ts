import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Credentials } from "./index.ts";

export function makeCredentials(pluginName: string): Credentials {
  const dir = path.join(os.homedir(), ".config", "liner", pluginName);
  const file = path.join(dir, "credentials.json");

  const get = async <T = Record<string, string>>(): Promise<T | null> => {
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as T;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  };

  return {
    get,
    async set(value) {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 });
    },
    async require<T = Record<string, string>>(): Promise<T> {
      const value = await get<T>();
      if (!value) {
        throw new Error(
          `No credentials found for plugin '${pluginName}'. Run: liner ${pluginName} auth`,
        );
      }
      return value;
    },
  };
}
