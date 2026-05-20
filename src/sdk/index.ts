export interface PluginArg {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PluginFlag {
  name: string;
  description?: string;
  takesValue?: boolean;
}

export interface PluginCommand {
  name: string;
  description?: string;
  args?: PluginArg[];
  flags?: PluginFlag[];
  readonly?: boolean;
  handler: (ctx: PluginContext) => Promise<void> | void;
}

export interface PluginContext {
  args: Record<string, string | undefined>;
  flags: Record<string, unknown>;
  credentials: Credentials;
  http: Http;
  output: (data: unknown) => void;
  json: boolean;
}

export interface Credentials {
  get<T = Record<string, string>>(): Promise<T | null>;
  set(value: Record<string, string>): Promise<void>;
  require<T = Record<string, string>>(): Promise<T>;
}

export interface HttpOptions {
  token?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface Http {
  get<T = unknown>(url: string, opts?: HttpOptions): Promise<T>;
  post<T = unknown>(url: string, body: unknown, opts?: HttpOptions): Promise<T>;
  put<T = unknown>(url: string, body: unknown, opts?: HttpOptions): Promise<T>;
  delete<T = unknown>(url: string, opts?: HttpOptions): Promise<T>;
}

export interface Plugin {
  name: string;
  description?: string;
  commands: PluginCommand[];
}

export function definePlugin(plugin: Plugin): Plugin {
  return plugin;
}
