import { makeCredentials } from "./credentials.ts";
import { makeHttp } from "./http.ts";
import { makeOutput } from "./output.ts";
import type { PluginContext } from "./index.ts";

export function createContext(params: {
  pluginName: string;
  args: Record<string, string | undefined>;
  flags: Record<string, unknown>;
}): PluginContext {
  const json = params.flags.json === true;
  return {
    args: params.args,
    flags: params.flags,
    credentials: makeCredentials(params.pluginName),
    http: makeHttp(),
    output: makeOutput(json),
    json,
  };
}
