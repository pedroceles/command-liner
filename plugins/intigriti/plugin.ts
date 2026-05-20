import { definePlugin } from "../../src/sdk/index.ts";

const API_BASE = "https://api.intigriti.com/external/company/v2.1";

interface Submission {
  code: string;
  title: string;
  state?: { status?: { value?: string } };
  severity?: { value?: string };
  submitter?: { userName?: string };
  webLinks?: { details?: string };
}

interface SubmissionDetails extends Submission {
  report?: {
    pocDescription?: string;
    impact?: string;
  };
}

function getAccessToken(): string {
  const token = process.env.INTIGRITI_ACCESS_TOKEN;
  if (!token) {
    throw new Error("INTIGRITI_ACCESS_TOKEN is not set.");
  }
  return token;
}

function renderSubmissionSummary(s: Submission): string {
  const state = s.state?.status?.value ?? "?";
  const severity = s.severity?.value ?? "-";
  const submitter = s.submitter?.userName ?? "-";
  return `[${s.code}] (${state}, ${severity}) ${s.title}  —  ${submitter}`;
}

function renderSubmissionDetail(s: SubmissionDetails): string {
  const lines: string[] = [];
  lines.push(`[${s.code}] ${s.title}`);
  lines.push(`Severity:  ${s.severity?.value ?? "N/A"}`);
  lines.push(`State:     ${s.state?.status?.value ?? "N/A"}`);
  lines.push(`Submitter: ${s.submitter?.userName ?? "N/A"}`);
  if (s.webLinks?.details) lines.push(`Link:      ${s.webLinks.details}`);
  lines.push("");
  lines.push("Description:");
  lines.push(s.report?.pocDescription ?? "No description");
  lines.push("");
  lines.push("Impact:");
  lines.push(s.report?.impact ?? "No impact statement");
  return lines.join("\n");
}

export default definePlugin({
  name: "intigriti",
  description: "Intigriti CLI (bug bounty submissions)",
  commands: [
    {
      name: "submission:list",
      description: "List Intigriti submissions (defaults to triage state)",
      flags: [
        {
          name: "state",
          description: "Filter by state value (e.g. triage, accepted, closed). Pass 'all' to disable filtering. Default: triage",
          takesValue: true,
        },
      ],
      handler: async (ctx) => {
        const accessToken = getAccessToken();
        const stateFilter = ((ctx.flags.state as string | undefined) ?? "triage").toLowerCase();

        const submissions = await ctx.http.get<Submission[]>(`${API_BASE}/submissions`, {
          token: accessToken,
        });

        const filtered =
          stateFilter === "all"
            ? submissions
            : submissions.filter(
                (s) => s.state?.status?.value?.toLowerCase() === stateFilter,
              );

        if (ctx.json) {
          ctx.output(filtered);
          return;
        }
        if (filtered.length === 0) {
          ctx.output(`No submissions${stateFilter === "all" ? "" : ` in ${stateFilter} state`}.`);
          return;
        }
        const header = `Found ${filtered.length} submission${filtered.length === 1 ? "" : "s"}${
          stateFilter === "all" ? "" : ` in ${stateFilter} state`
        }:`;
        ctx.output([header, "", ...filtered.map(renderSubmissionSummary)].join("\n"));
      },
    },
    {
      name: "submission:read",
      description: "Read one Intigriti submission by code",
      args: [{ name: "code", required: true, description: "Submission code, e.g. TREMENDOUS-FFIOSYTA" }],
      handler: async (ctx) => {
        const accessToken = getAccessToken();
        const details = await ctx.http.get<SubmissionDetails>(
          `${API_BASE}/submissions/${ctx.args.code}`,
          { token: accessToken },
        );
        if (ctx.json) {
          ctx.output(details);
          return;
        }
        ctx.output(renderSubmissionDetail(details));
      },
    },
  ],
});
