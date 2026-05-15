export interface AsanaIds {
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
}

const NUMERIC = /^\d+$/;

export function parseAsanaUrl(input: string): AsanaIds | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.hostname !== "app.asana.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // /1/<workspaceId>/project/<projectId>/task/<taskId>
  // /1/<workspaceId>/project/<projectId>
  if (parts[0] === "1" && parts[1] && NUMERIC.test(parts[1])) {
    const ids: AsanaIds = { workspaceId: parts[1] };
    for (let i = 2; i + 1 < parts.length; i += 2) {
      const key = parts[i];
      const val = parts[i + 1];
      if (!val || !NUMERIC.test(val)) continue;
      if (key === "project") ids.projectId = val;
      else if (key === "task") ids.taskId = val;
    }
    return ids;
  }

  // /0/<projectId>/<taskId>  (optionally trailed by /f, /list, etc.)
  if (parts[0] === "0") {
    const ids: AsanaIds = {};
    if (parts[1] && NUMERIC.test(parts[1])) ids.projectId = parts[1];
    if (parts[2] && NUMERIC.test(parts[2])) ids.taskId = parts[2];
    return ids;
  }

  return null;
}

function resolve(input: string | undefined, key: keyof AsanaIds): string | undefined {
  if (!input) return undefined;
  const parsed = parseAsanaUrl(input);
  if (parsed?.[key]) return parsed[key];
  // No URL match: treat the raw input as the id.
  return input;
}

export function resolveTaskId(input: string): string {
  return resolve(input, "taskId") ?? input;
}

export function resolveProjectId(input: string | undefined): string | undefined {
  return resolve(input, "projectId");
}

export function resolveWorkspaceId(input: string | undefined): string | undefined {
  return resolve(input, "workspaceId");
}
