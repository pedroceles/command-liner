import * as p from "@clack/prompts";
import { definePlugin } from "../../src/sdk/index.ts";
import { resolveTaskId, resolveWorkspaceId } from "./url.ts";

const BASE = "https://app.asana.com/api/1.0";

interface AsanaCreds {
  token: string;
}

interface AsanaUser {
  gid: string;
  name: string;
  email?: string;
  workspaces?: { gid: string; name: string }[];
}

interface AsanaTask {
  gid: string;
  name: string;
  completed?: boolean;
  notes?: string;
  permalink_url?: string;
  assignee?: { gid: string; name: string } | null;
  due_on?: string | null;
  projects?: { gid: string; name: string }[];
}

interface AsanaStory {
  gid: string;
  type?: string;
  resource_subtype?: string;
  text?: string;
  created_at?: string;
  created_by?: { gid: string; name: string } | null;
}

const TASK_FIELDS = [
  "name",
  "completed",
  "notes",
  "permalink_url",
  "assignee.name",
  "due_on",
  "projects.name",
].join(",");

async function pickWorkspace(
  ctx: { http: { get: <T>(url: string, opts: { token: string }) => Promise<T> } },
  token: string,
  override?: string,
): Promise<string> {
  const resolved = resolveWorkspaceId(override);
  if (resolved) return resolved;
  const me = await ctx.http.get<{ data: AsanaUser }>(
    `${BASE}/users/me?opt_fields=workspaces.name`,
    { token },
  );
  const workspaces = me.data.workspaces ?? [];
  if (workspaces.length === 1) return workspaces[0]!.gid;
  if (workspaces.length === 0) throw new Error("No workspaces on this token.");
  const lines = workspaces.map((w) => `  ${w.gid}  ${w.name}`).join("\n");
  throw new Error(`Multiple workspaces — pass --workspace <gid-or-url>:\n${lines}`);
}

export default definePlugin({
  name: "asana",
  description: "Asana CLI",
  commands: [
    {
      name: "auth",
      description: "Store an Asana Personal Access Token",
      handler: async (ctx) => {
        p.intro("Asana auth");
        const token = await p.password({
          message: "Paste an Asana PAT (https://app.asana.com/0/my-apps):",
          validate: (v) => (v && v.length >= 10 ? undefined : "Token looks too short."),
        });
        if (p.isCancel(token)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        const me = await ctx.http.get<{ data: AsanaUser }>(`${BASE}/users/me`, { token });
        await ctx.credentials.set({ token });
        p.outro(`Authenticated as ${me.data.name}${me.data.email ? ` <${me.data.email}>` : ""}`);
      },
    },
    {
      name: "whoami",
      description: "Show the authenticated user",
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<AsanaCreds>();
        const me = await ctx.http.get<{ data: AsanaUser }>(
          `${BASE}/users/me?opt_fields=name,email,workspaces.name`,
          { token },
        );
        if (ctx.json) {
          ctx.output(me.data);
          return;
        }
        const lines = [`${me.data.name}${me.data.email ? ` <${me.data.email}>` : ""}`, `gid: ${me.data.gid}`];
        if (me.data.workspaces?.length) {
          lines.push("workspaces:");
          for (const w of me.data.workspaces) lines.push(`  ${w.gid}  ${w.name}`);
        }
        ctx.output(lines.join("\n"));
      },
    },
    {
      name: "task:read",
      description: "Read an Asana task by gid or URL",
      args: [{ name: "task", required: true, description: "Task gid or any Asana task URL" }],
      flags: [{ name: "comments", description: "include task comments (stories of type=comment)" }],
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<AsanaCreds>();
        const taskId = resolveTaskId(ctx.args.task!);
        const taskRes = await ctx.http.get<{ data: AsanaTask }>(
          `${BASE}/tasks/${taskId}?opt_fields=${TASK_FIELDS}`,
          { token },
        );

        let comments: AsanaStory[] | undefined;
        if (ctx.flags.comments) {
          const fields = ["type", "resource_subtype", "text", "created_at", "created_by.name"].join(",");
          const storiesRes = await ctx.http.get<{ data: AsanaStory[] }>(
            `${BASE}/tasks/${taskId}/stories?limit=100&opt_fields=${fields}`,
            { token },
          );
          comments = storiesRes.data.filter((s) => s.type === "comment");
        }

        if (ctx.json) {
          ctx.output(comments ? { ...taskRes.data, comments } : taskRes.data);
          return;
        }

        const t = taskRes.data;
        const lines: string[] = [];
        lines.push(`${t.name}${t.completed ? "  (completed)" : ""}`);
        lines.push(`gid:       ${t.gid}`);
        if (t.assignee) lines.push(`assignee:  ${t.assignee.name}`);
        if (t.due_on) lines.push(`due:       ${t.due_on}`);
        if (t.projects?.length) lines.push(`projects:  ${t.projects.map((proj) => proj.name).join(", ")}`);
        if (t.permalink_url) lines.push(`url:       ${t.permalink_url}`);
        if (t.notes) {
          lines.push("");
          lines.push(t.notes);
        }
        if (comments) {
          lines.push("");
          if (comments.length === 0) {
            lines.push("(no comments)");
          } else {
            lines.push(`comments (${comments.length}):`);
            for (const c of comments) {
              const when = c.created_at ? c.created_at.slice(0, 10) : "?";
              const who = c.created_by?.name ?? "?";
              const text = (c.text ?? "").trim();
              lines.push(`  - [${when}] ${who}: ${text}`);
            }
          }
        }
        ctx.output(lines.join("\n"));
      },
    },
    {
      name: "task:list",
      description: "List tasks assigned to you (or another user) in a workspace",
      flags: [
        { name: "workspace", description: "Workspace gid (defaults to your only workspace)", takesValue: true },
        { name: "assignee", description: "Assignee gid or 'me' (default: me)", takesValue: true },
        { name: "since", description: "completed_since (ISO date or 'now', default: now)", takesValue: true },
        { name: "limit", description: "Page size, 1-100 (default: 50)", takesValue: true },
      ],
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<AsanaCreds>();
        const workspace = await pickWorkspace(ctx, token, ctx.flags.workspace as string | undefined);
        const assignee = (ctx.flags.assignee as string | undefined) ?? "me";
        const since = (ctx.flags.since as string | undefined) ?? "now";
        const limit = (ctx.flags.limit as string | undefined) ?? "50";

        const params = new URLSearchParams({
          workspace,
          assignee,
          completed_since: since,
          limit,
          opt_fields: ["name", "completed", "due_on", "permalink_url"].join(","),
        });
        const res = await ctx.http.get<{ data: AsanaTask[] }>(
          `${BASE}/tasks?${params.toString()}`,
          { token },
        );
        if (ctx.json) {
          ctx.output(res.data);
          return;
        }
        if (res.data.length === 0) {
          ctx.output("No tasks.");
          return;
        }
        const lines = res.data.map((t) => {
          const due = t.due_on ? ` [${t.due_on}]` : "";
          const mark = t.completed ? "[x]" : "[ ]";
          return `${mark} ${t.gid}${due}  ${t.name}`;
        });
        ctx.output(lines.join("\n"));
      },
    },
  ],
});
