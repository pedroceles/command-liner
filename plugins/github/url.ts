export interface GitHubPr {
  owner: string;
  repo: string;
  number: number;
}

const SHORTHAND = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/;

export function parseGitHubPrUrl(input: string): GitHubPr | null {
  const shortMatch = input.match(SHORTHAND);
  if (shortMatch) {
    return { owner: shortMatch[1]!, repo: shortMatch[2]!, number: parseInt(shortMatch[3]!, 10) };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.hostname !== "github.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  // /<owner>/<repo>/pull/<number>
  if (parts.length >= 4 && parts[2] === "pull" && /^\d+$/.test(parts[3]!)) {
    return { owner: parts[0]!, repo: parts[1]!, number: parseInt(parts[3]!, 10) };
  }

  return null;
}

export function resolveGitHubPr(input: string, repoFlag?: string): GitHubPr {
  const fromUrl = parseGitHubPrUrl(input);
  if (fromUrl) return fromUrl;

  const num = parseInt(input, 10);
  if (!Number.isNaN(num) && String(num) === input && repoFlag) {
    const parts = repoFlag.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1], number: num };
    }
  }

  throw new Error(
    `Cannot parse "${input}" as a GitHub PR. Use a URL (https://github.com/owner/repo/pull/123), shorthand (owner/repo#123), or a number with --repo.`,
  );
}
