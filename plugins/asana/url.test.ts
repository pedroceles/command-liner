import { describe, expect, test } from "bun:test";
import { parseAsanaUrl, resolveProjectId, resolveTaskId, resolveWorkspaceId } from "./url.ts";

describe("parseAsanaUrl", () => {
  test("new format with workspace, project, task", () => {
    const ids = parseAsanaUrl(
      "https://app.asana.com/1/752389237742425/project/1198207191493787/task/1214799263360178",
    );
    expect(ids).toEqual({
      workspaceId: "752389237742425",
      projectId: "1198207191493787",
      taskId: "1214799263360178",
    });
  });

  test("new format with workspace and project only", () => {
    const ids = parseAsanaUrl("https://app.asana.com/1/752389237742425/project/1198207191493787");
    expect(ids).toEqual({
      workspaceId: "752389237742425",
      projectId: "1198207191493787",
    });
  });

  test("old format with project and task", () => {
    const ids = parseAsanaUrl("https://app.asana.com/0/1198207191493787/1214799263360178");
    expect(ids).toEqual({
      projectId: "1198207191493787",
      taskId: "1214799263360178",
    });
  });

  test("old format with /f focus suffix", () => {
    const ids = parseAsanaUrl("https://app.asana.com/0/1198207191493787/1214799263360178/f");
    expect(ids).toEqual({
      projectId: "1198207191493787",
      taskId: "1214799263360178",
    });
  });

  test("old format project /list (no task)", () => {
    const ids = parseAsanaUrl("https://app.asana.com/0/1198207191493787/list");
    expect(ids).toEqual({ projectId: "1198207191493787" });
  });

  test("query string and fragment are ignored", () => {
    const ids = parseAsanaUrl(
      "https://app.asana.com/0/1198207191493787/1214799263360178?focus=1#comment-1",
    );
    expect(ids).toEqual({
      projectId: "1198207191493787",
      taskId: "1214799263360178",
    });
  });

  test("non-asana url returns null", () => {
    expect(parseAsanaUrl("https://github.com/anthropics/foo")).toBeNull();
  });

  test("not a url returns null", () => {
    expect(parseAsanaUrl("1214799263360178")).toBeNull();
    expect(parseAsanaUrl("just garbage")).toBeNull();
  });
});

describe("resolveTaskId", () => {
  test("extracts task id from new-format url", () => {
    expect(
      resolveTaskId(
        "https://app.asana.com/1/752389237742425/project/1198207191493787/task/1214799263360178",
      ),
    ).toBe("1214799263360178");
  });

  test("extracts task id from old-format url", () => {
    expect(resolveTaskId("https://app.asana.com/0/1198207191493787/1214799263360178")).toBe(
      "1214799263360178",
    );
  });

  test("passes through a raw gid", () => {
    expect(resolveTaskId("1214799263360178")).toBe("1214799263360178");
  });

  test("passes through unrecognized input as-is", () => {
    expect(resolveTaskId("some-other-thing")).toBe("some-other-thing");
  });

  test("url without a task falls back to the raw input", () => {
    expect(resolveTaskId("https://app.asana.com/1/752389237742425/project/1198207191493787")).toBe(
      "https://app.asana.com/1/752389237742425/project/1198207191493787",
    );
  });
});

describe("resolveProjectId / resolveWorkspaceId", () => {
  test("extracts project id from new-format url", () => {
    expect(
      resolveProjectId("https://app.asana.com/1/752389237742425/project/1198207191493787"),
    ).toBe("1198207191493787");
  });

  test("extracts workspace id from new-format url", () => {
    expect(
      resolveWorkspaceId(
        "https://app.asana.com/1/752389237742425/project/1198207191493787/task/1214799263360178",
      ),
    ).toBe("752389237742425");
  });

  test("returns undefined when input is undefined", () => {
    expect(resolveProjectId(undefined)).toBeUndefined();
    expect(resolveWorkspaceId(undefined)).toBeUndefined();
  });

  test("passes through a raw gid", () => {
    expect(resolveProjectId("1198207191493787")).toBe("1198207191493787");
  });
});
