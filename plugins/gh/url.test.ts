import { describe, expect, test } from "bun:test";
import { parseGitHubPrUrl, resolveGitHubPr } from "./url.ts";

describe("parseGitHubPrUrl", () => {
  test("standard PR URL", () => {
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/pull/42")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  test("PR URL with extra segments (files tab, etc.)", () => {
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/pull/99/files")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 99,
    });
  });

  test("PR URL with query string and fragment", () => {
    expect(
      parseGitHubPrUrl("https://github.com/acme/widgets/pull/7?diff=unified#discussion_r123"),
    ).toEqual({ owner: "acme", repo: "widgets", number: 7 });
  });

  test("shorthand owner/repo#number", () => {
    expect(parseGitHubPrUrl("acme/widgets#42")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  test("shorthand with dots and hyphens", () => {
    expect(parseGitHubPrUrl("my-org/my.repo#1")).toEqual({
      owner: "my-org",
      repo: "my.repo",
      number: 1,
    });
  });

  test("non-github URL returns null", () => {
    expect(parseGitHubPrUrl("https://gitlab.com/acme/widgets/merge_requests/1")).toBeNull();
  });

  test("github URL without /pull/ returns null", () => {
    expect(parseGitHubPrUrl("https://github.com/acme/widgets/issues/5")).toBeNull();
  });

  test("plain number returns null", () => {
    expect(parseGitHubPrUrl("42")).toBeNull();
  });

  test("garbage returns null", () => {
    expect(parseGitHubPrUrl("not a url at all")).toBeNull();
  });
});

describe("resolveGitHubPr", () => {
  test("resolves a full PR URL", () => {
    expect(resolveGitHubPr("https://github.com/acme/widgets/pull/42")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  test("resolves shorthand", () => {
    expect(resolveGitHubPr("acme/widgets#7")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 7,
    });
  });

  test("resolves plain number with --repo flag", () => {
    expect(resolveGitHubPr("42", "acme/widgets")).toEqual({
      owner: "acme",
      repo: "widgets",
      number: 42,
    });
  });

  test("throws on plain number without --repo flag", () => {
    expect(() => resolveGitHubPr("42")).toThrow(/Cannot parse/);
  });

  test("throws on unrecognized input", () => {
    expect(() => resolveGitHubPr("some-garbage")).toThrow(/Cannot parse/);
  });
});
