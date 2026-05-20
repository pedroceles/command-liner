import * as p from "@clack/prompts";
import { definePlugin } from "../../src/sdk/index.ts";
import { resolveNotionPageId } from "./url.ts";

const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";

interface NotionCreds {
  token: string;
}

interface NotionUser {
  object: "user";
  id: string;
  name?: string;
  type?: "person" | "bot";
  person?: { email?: string };
  bot?: { owner?: { type?: string }; workspace_name?: string };
}

interface PageMarkdown {
  object: "page_markdown";
  id: string;
  markdown: string;
  truncated: boolean;
  unknown_block_ids?: string[];
}

function notionHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    "notion-version": NOTION_VERSION,
  };
}

export default definePlugin({
  name: "notion",
  description: "Notion CLI",
  commands: [
    {
      name: "auth",
      description: "Store a Notion Personal Access Token (or internal integration secret)",
      handler: async (ctx) => {
        p.intro("Notion auth");
        const token = await p.password({
          message: "Paste a Notion token (https://www.notion.so/profile/integrations):",
          validate: (v) => (v && v.length >= 20 ? undefined : "Token looks too short."),
        });
        if (p.isCancel(token)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        const me = await ctx.http.get<NotionUser>(`${BASE}/users/me`, {
          headers: notionHeaders(token as string),
        });
        await ctx.credentials.set({ token: token as string });
        const label = me.name ?? me.bot?.workspace_name ?? me.id;
        p.outro(`Authenticated as ${label} (${me.type ?? "user"})`);
      },
    },
    {
      name: "whoami",
      description: "Show the authenticated bot/user",
      readonly: true,
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<NotionCreds>();
        const me = await ctx.http.get<NotionUser>(`${BASE}/users/me`, {
          headers: notionHeaders(token),
        });
        if (ctx.json) {
          ctx.output(me);
          return;
        }
        const lines = [
          `${me.name ?? "(unnamed)"}${me.person?.email ? ` <${me.person.email}>` : ""}`,
          `id:   ${me.id}`,
          `type: ${me.type ?? "?"}`,
        ];
        if (me.bot?.workspace_name) lines.push(`workspace: ${me.bot.workspace_name}`);
        ctx.output(lines.join("\n"));
      },
    },
    {
      name: "page:read",
      description: "Retrieve a Notion page as markdown",
      args: [{ name: "page", required: true, description: "Page id (32-hex or UUID) or any Notion page URL" }],
      flags: [
        {
          name: "include-transcript",
          description: "Include meeting note transcripts in the markdown",
        },
      ],
      readonly: true,
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<NotionCreds>();
        const pageId = resolveNotionPageId(ctx.args.page!);
        const params = new URLSearchParams();
        if (ctx.flags["include-transcript"]) params.set("include_transcript", "true");
        const qs = params.toString();
        const res = await ctx.http.get<PageMarkdown>(
          `${BASE}/pages/${pageId}/markdown${qs ? `?${qs}` : ""}`,
          { headers: notionHeaders(token) },
        );
        if (ctx.json) {
          ctx.output(res);
          return;
        }
        if (res.truncated) {
          console.error(
            `(truncated; ${res.unknown_block_ids?.length ?? 0} unknown block ids — re-fetch them as page ids)`,
          );
        }
        ctx.output(res.markdown);
      },
    },
  ],
});
