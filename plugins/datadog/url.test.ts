import { describe, expect, test } from "bun:test";
import { parseDatadogLogsUrl } from "./url.ts";

const SEARCH_URL =
  "https://app.datadoghq.com/logs?query=%40controller%3A%2AUserSession%2A&agg_m=count&from_ts=1675700345098&to_ts=1675703945098&live=true";
const EVENT_URL = `${SEARCH_URL}&event=AwAAAZ4sES3qWJw48wAAABhBWjRzRVRFakFBRDBNWUV3NTZYQzVnQTQAAAAkZjE5ZTJjMTEtMzVmMS00M2JkLTgyN2UtZTJlMzdkMjliZTg3AAACaw`;

describe("parseDatadogLogsUrl", () => {
  test("extracts query and time range from a search url", () => {
    const ids = parseDatadogLogsUrl(SEARCH_URL);
    expect(ids).toEqual({
      query: "@controller:*UserSession*",
      fromIso: "2023-02-06T16:19:05.098Z",
      toIso: "2023-02-06T17:19:05.098Z",
    });
  });

  test("extracts event token alongside query and times", () => {
    const ids = parseDatadogLogsUrl(EVENT_URL);
    expect(ids).toEqual({
      query: "@controller:*UserSession*",
      fromIso: "2023-02-06T16:19:05.098Z",
      toIso: "2023-02-06T17:19:05.098Z",
      event:
        "AwAAAZ4sES3qWJw48wAAABhBWjRzRVRFakFBRDBNWUV3NTZYQzVnQTQAAAAkZjE5ZTJjMTEtMzVmMS00M2JkLTgyN2UtZTJlMzdkMjliZTg3AAACaw",
    });
  });

  test("accepts EU and other regional Datadog hosts", () => {
    const ids = parseDatadogLogsUrl("https://app.datadoghq.eu/logs?query=service%3Aweb");
    expect(ids).toEqual({ query: "service:web" });
  });

  test("returns null for non-datadog urls", () => {
    expect(parseDatadogLogsUrl("https://github.com/foo")).toBeNull();
    expect(parseDatadogLogsUrl("https://app.datadoghq.com/dashboard/abc")).toBeNull();
  });

  test("returns null for raw text input", () => {
    expect(parseDatadogLogsUrl("service:web")).toBeNull();
    expect(parseDatadogLogsUrl("not even a url at all")).toBeNull();
  });

  test("returns null when no recognized params are present", () => {
    expect(parseDatadogLogsUrl("https://app.datadoghq.com/logs")).toBeNull();
  });
});
