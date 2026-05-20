import * as p from "@clack/prompts";
import { definePlugin } from "../../src/sdk/index.ts";
import { resolveGitHubPr } from "./url.ts";

const BASE = "https://api.github.com";

interface GitHubCreds {
  token: string;
}

interface GitHubUser {
  login: string;
  id: number;
  name?: string | null;
  email?: string | null;
  html_url: string;
}

interface IssueComment {
  id: number;
  user: { login: string; type?: string } | null;
  body?: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface ReviewComment {
  id: number;
  user: { login: string } | null;
  body?: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  path: string;
  line?: number | null;
  original_line?: number | null;
  diff_hunk?: string;
}

interface Review {
  id: number;
  user: { login: string } | null;
  body?: string;
  state: string;
  submitted_at: string;
  html_url: string;
}

interface UnifiedComment {
  id: number;
  kind: "conversation" | "review" | "review_summary";
  author: string;
  body: string;
  created_at: string;
  html_url: string;
  path?: string;
  line?: number | null;
  review_state?: string;
}

function ghHeaders(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
}

async function fetchAllPages<T>(
  http: { get: <R>(url: string, opts?: { headers?: Record<string, string> }) => Promise<R> },
  url: string,
  headers: Record<string, string>,
): Promise<T[]> {
  const sep = url.includes("?") ? "&" : "?";
  const items: T[] = [];
  let page = 1;
  while (true) {
    const batch = await http.get<T[]>(`${url}${sep}per_page=100&page=${page}`, { headers });
    items.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return items;
}

const RESOLVED_THREADS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          comments(first: 100) {
            nodes { databaseId }
          }
        }
      }
    }
  }
}`;

interface GraphQLThreadsResponse {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: Array<{
            isResolved: boolean;
            comments: { nodes: Array<{ databaseId: number }> };
          }>;
        };
      };
    };
  };
}

async function fetchResolvedCommentIds(
  http: { post: <T>(url: string, body: unknown, opts?: { headers?: Record<string, string> }) => Promise<T> },
  headers: Record<string, string>,
  owner: string,
  repo: string,
  number: number,
): Promise<Set<number>> {
  const ids = new Set<number>();
  let cursor: string | null = null;
  while (true) {
    const res: GraphQLThreadsResponse = await http.post(
      "https://api.github.com/graphql",
      { query: RESOLVED_THREADS_QUERY, variables: { owner, repo, number, cursor } },
      { headers },
    );
    const threads: GraphQLThreadsResponse["data"]["repository"]["pullRequest"]["reviewThreads"] =
      res.data.repository.pullRequest.reviewThreads;
    for (const thread of threads.nodes) {
      if (!thread.isResolved) continue;
      for (const comment of thread.comments.nodes) {
        ids.add(comment.databaseId);
      }
    }
    if (!threads.pageInfo.hasNextPage) break;
    cursor = threads.pageInfo.endCursor;
  }
  return ids;
}

export default definePlugin({
  name: "github",
  description: "GitHub CLI",
  commands: [
    {
      name: "auth",
      description: "Store a GitHub Personal Access Token",
      handler: async (ctx) => {
        p.intro("GitHub auth");
        const token = await p.password({
          message: "Paste a GitHub PAT (https://github.com/settings/tokens):",
          validate: (v) => (v && v.length >= 4 ? undefined : "Token looks too short."),
        });
        if (p.isCancel(token)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        const me = await ctx.http.get<GitHubUser>(`${BASE}/user`, {
          headers: ghHeaders(token as string),
        });
        await ctx.credentials.set({ token: token as string });
        p.outro(`Authenticated as ${me.login}${me.name ? ` (${me.name})` : ""}`);
      },
    },
    {
      name: "pr:comments",
      description: "List all comments on a pull request",
      args: [
        {
          name: "pr",
          required: true,
          description: "PR URL (https://github.com/owner/repo/pull/N), shorthand (owner/repo#N), or number (with --repo)",
        },
      ],
      flags: [
        { name: "repo", description: "Repository as owner/repo (allows passing just a PR number)", takesValue: true },
      ],
      handler: async (ctx) => {
        const { token } = await ctx.credentials.require<GitHubCreds>();
        const headers = ghHeaders(token);
        const pr = resolveGitHubPr(ctx.args.pr!, ctx.flags.repo as string | undefined);

        const [issueComments, reviewComments, reviews, resolvedCommentIds] = await Promise.all([
          fetchAllPages<IssueComment>(
            ctx.http,
            `${BASE}/repos/${pr.owner}/${pr.repo}/issues/${pr.number}/comments`,
            headers,
          ),
          fetchAllPages<ReviewComment>(
            ctx.http,
            `${BASE}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/comments`,
            headers,
          ),
          fetchAllPages<Review>(
            ctx.http,
            `${BASE}/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`,
            headers,
          ),
          fetchResolvedCommentIds(ctx.http, headers, pr.owner, pr.repo, pr.number),
        ]);

        const unified: UnifiedComment[] = [
          ...issueComments
            .filter((c) => c.user?.login !== "cursor[bot]")
            .map((c) => ({
              id: c.id,
              kind: "conversation" as const,
              author: c.user?.login ?? "(unknown)",
              body: c.body ?? "",
              created_at: c.created_at,
              html_url: c.html_url,
            })),
          ...reviewComments
            .filter((c) => !resolvedCommentIds.has(c.id))
            .map((c) => ({
              id: c.id,
              kind: "review" as const,
              author: c.user?.login ?? "(unknown)",
              body: c.body ?? "",
              created_at: c.created_at,
              html_url: c.html_url,
              path: c.path,
              line: c.line ?? c.original_line,
            })),
          ...reviews
            .filter((r) => r.body?.trim() && r.user?.login !== "cursor[bot]")
            .map((r) => ({
              id: r.id,
              kind: "review_summary" as const,
              author: r.user?.login ?? "(unknown)",
              body: r.body!.trim(),
              created_at: r.submitted_at,
              html_url: r.html_url,
              review_state: r.state,
            })),
        ];
        unified.sort((a, b) => a.created_at.localeCompare(b.created_at));

        if (ctx.json) {
          ctx.output(unified);
          return;
        }

        if (unified.length === 0) {
          ctx.output("No comments.");
          return;
        }

        const lines: string[] = [];
        lines.push(`${unified.length} comment(s) on ${pr.owner}/${pr.repo}#${pr.number}`);
        lines.push("");
        for (const c of unified) {
          const date = c.created_at.slice(0, 10);
          const suffix =
            c.kind === "review" && c.path
              ? ` ${c.path}${c.line ? `:${c.line}` : ""}`
              : c.kind === "review_summary" && c.review_state
                ? ` (${c.review_state.toLowerCase().replace("_", " ")})`
                : "";
          lines.push(`[${date}] ${c.author}${suffix}`);
          const body = c.body.trim();
          if (body) {
            for (const bodyLine of body.split("\n")) {
              lines.push(`  ${bodyLine}`);
            }
          }
          lines.push("");
        }
        ctx.output(lines.join("\n").trimEnd());
      },
    },
  ],
});
