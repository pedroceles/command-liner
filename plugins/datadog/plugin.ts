import * as p from "@clack/prompts";
import { client, v2 } from "@datadog/datadog-api-client";
import { definePlugin } from "../../src/sdk/index.ts";
import { parseDatadogLogsUrl } from "./url.ts";

interface DatadogCreds {
  apiKey: string;
  appKey: string;
  site: string;
}

function makeLogsApi(creds: DatadogCreds): v2.LogsApi {
  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: creds.apiKey,
      appKeyAuth: creds.appKey,
    },
  });
  configuration.setServerVariables({ site: creds.site });
  return new v2.LogsApi(configuration);
}

function renderLogLine(log: v2.Log): string {
  const a = log.attributes ?? {};
  const ts = a.timestamp ? a.timestamp.toISOString() : "?";
  const svc = a.service ?? "-";
  const host = a.host ?? "-";
  const status = a.status ?? "-";
  const message = (a.message ?? "").split("\n")[0]?.slice(0, 200) ?? "";
  return `${ts}  ${status.padEnd(5)}  ${svc}  ${host}  ${message}`;
}

function renderLogDetail(log: v2.Log): string {
  const a = log.attributes ?? {};
  const lines: string[] = [];
  lines.push(`id:        ${log.id ?? "?"}`);
  if (a.timestamp) lines.push(`timestamp: ${a.timestamp.toISOString()}`);
  if (a.service) lines.push(`service:   ${a.service}`);
  if (a.host) lines.push(`host:      ${a.host}`);
  if (a.status) lines.push(`status:    ${a.status}`);
  if (a.tags?.length) lines.push(`tags:      ${a.tags.join(", ")}`);
  if (a.message) {
    lines.push("");
    lines.push(a.message);
  }
  if (a.attributes && Object.keys(a.attributes).length > 0) {
    lines.push("");
    lines.push("attributes:");
    lines.push(JSON.stringify(a.attributes, null, 2));
  }
  return lines.join("\n");
}

export default definePlugin({
  name: "datadog",
  description: "Datadog CLI (logs)",
  commands: [
    {
      name: "auth",
      description: "Store a Datadog API key + Application key",
      handler: async (ctx) => {
        p.intro("Datadog auth");
        const apiKey = await p.password({
          message: "API key (https://app.datadoghq.com/organization-settings/api-keys):",
          validate: (v) => (v && v.length >= 8 ? undefined : "Looks too short."),
        });
        if (p.isCancel(apiKey)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        const appKey = await p.password({
          message: "Application key (https://app.datadoghq.com/organization-settings/application-keys):",
          validate: (v) => (v && v.length >= 8 ? undefined : "Looks too short."),
        });
        if (p.isCancel(appKey)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        const site = await p.text({
          message: "Site (e.g. datadoghq.com, datadoghq.eu, us3.datadoghq.com):",
          placeholder: "datadoghq.com",
          defaultValue: "datadoghq.com",
        });
        if (p.isCancel(site)) {
          p.cancel("Cancelled.");
          process.exit(1);
        }
        await ctx.credentials.set({ apiKey, appKey, site: (site as string) || "datadoghq.com" });
        p.outro(`Saved. Using site: ${site || "datadoghq.com"}`);
      },
    },
    {
      name: "log:search",
      description: "Search logs by query string or Datadog UI URL",
      args: [{ name: "input", required: true, description: "Query string or Datadog /logs URL" }],
      flags: [
        { name: "from", description: "Start time (ISO 8601 or relative like 'now-15m')", takesValue: true },
        { name: "to", description: "End time (ISO 8601 or 'now')", takesValue: true },
        { name: "limit", description: "Max results (default 25, max 1000)", takesValue: true },
      ],
      handler: async (ctx) => {
        const creds = await ctx.credentials.require<DatadogCreds>();
        const parsed = parseDatadogLogsUrl(ctx.args.input!);
        const query = parsed?.query ?? ctx.args.input!;
        const from = (ctx.flags.from as string | undefined) ?? parsed?.fromIso ?? "now-15m";
        const to = (ctx.flags.to as string | undefined) ?? parsed?.toIso ?? "now";
        const limit = Number(ctx.flags.limit ?? 25);

        const api = makeLogsApi(creds);
        const res = await api.listLogs({
          body: {
            filter: { query, from, to },
            sort: "-timestamp" as v2.LogsSort,
            page: { limit },
          },
        });
        const logs = res.data ?? [];

        if (ctx.json) {
          ctx.output(logs);
          return;
        }
        if (logs.length === 0) {
          ctx.output(`No logs for query: ${query}`);
          return;
        }
        ctx.output(logs.map(renderLogLine).join("\n"));
      },
    },
    {
      name: "log:read",
      description: "Fetch a single log by id or Datadog UI URL (?event=...)",
      args: [{ name: "input", required: true, description: "Log id or Datadog logs URL with ?event=" }],
      handler: async (ctx) => {
        const creds = await ctx.credentials.require<DatadogCreds>();
        const parsed = parseDatadogLogsUrl(ctx.args.input!);
        const eventId = parsed?.event ?? ctx.args.input!;
        const api = makeLogsApi(creds);

        let match: v2.Log | undefined;
        let windowCount: number | undefined;

        // Datadog has no documented "fetch log by id" endpoint, so when a URL
        // gives us a time window we search that window (with the URL's query if
        // any, else "*") and find the matching id.
        if (parsed?.fromIso && parsed?.toIso && parsed?.event) {
          const res = await api.listLogs({
            body: {
              filter: {
                query: parsed.query || "*",
                from: parsed.fromIso,
                to: parsed.toIso,
              },
              page: { limit: 1000 },
            },
          });
          windowCount = res.data?.length ?? 0;
          match = (res.data ?? []).find((log) => log.id === parsed.event);
        }

        // No URL context — try searching with the id as the raw query.
        if (!match && !parsed?.event) {
          const res = await api.listLogs({
            body: {
              filter: {
                query: eventId,
                from: parsed?.fromIso ?? "now-7d",
                to: parsed?.toIso ?? "now",
              },
              page: { limit: 1 },
            },
          });
          match = res.data?.[0];
        }

        if (!match) {
          if (parsed?.fromIso && parsed?.toIso) {
            const ageMs = Date.now() - new Date(parsed.toIso).getTime();
            const ageDays = Math.floor(ageMs / 86_400_000);
            console.error(
              `No log ${eventId} found in window ${parsed.fromIso} → ${parsed.toIso} ` +
                `(${windowCount ?? 0} logs in window` +
                (ageDays > 14
                  ? `; window ends ${ageDays} days ago — likely past Datadog's default 15-day retention`
                  : "") +
                `).`,
            );
          } else {
            console.error(`No log found for ${eventId}`);
          }
          process.exit(1);
        }

        if (ctx.json) {
          ctx.output(match);
          return;
        }
        ctx.output(renderLogDetail(match));
      },
    },
  ],
});
