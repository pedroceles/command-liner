export interface DatadogLogsUrl {
  query?: string;
  fromIso?: string;
  toIso?: string;
  event?: string;
}

const HOST_PREFIX = "app.datadoghq.";

export function parseDatadogLogsUrl(input: string): DatadogLogsUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!url.hostname.startsWith(HOST_PREFIX)) return null;
  if (!url.pathname.startsWith("/logs")) return null;

  const params = url.searchParams;
  const result: DatadogLogsUrl = {};

  const query = params.get("query");
  if (query) result.query = query;

  const fromTs = params.get("from_ts");
  if (fromTs) {
    const n = Number(fromTs);
    if (Number.isFinite(n)) result.fromIso = new Date(n).toISOString();
  }

  const toTs = params.get("to_ts");
  if (toTs) {
    const n = Number(toTs);
    if (Number.isFinite(n)) result.toIso = new Date(n).toISOString();
  }

  const event = params.get("event");
  if (event) result.event = event;

  if (Object.keys(result).length === 0) return null;
  return result;
}
