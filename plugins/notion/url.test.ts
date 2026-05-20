import { describe, expect, test } from "bun:test";
import { parseNotionPageId, resolveNotionPageId } from "./url.ts";

const HEX = "b55c9c91384d452b81dbd1ef79372b75";
const DASHED = "b55c9c91-384d-452b-81db-d1ef79372b75";

describe("parseNotionPageId", () => {
  test("extracts dashed id from title-suffixed url", () => {
    expect(parseNotionPageId(`https://www.notion.so/My-Page-${HEX}`)).toBe(DASHED);
  });

  test("extracts id when workspace is in the path", () => {
    expect(parseNotionPageId(`https://www.notion.so/myworkspace/My-Page-${HEX}`)).toBe(DASHED);
  });

  test("works on workspace.notion.site subdomain", () => {
    expect(parseNotionPageId(`https://acme.notion.site/Public-Page-${HEX}`)).toBe(DASHED);
  });

  test("accepts already-dashed UUID in path", () => {
    expect(parseNotionPageId(`https://www.notion.so/${DASHED}`)).toBe(DASHED);
  });

  test("query string and fragment are ignored", () => {
    expect(parseNotionPageId(`https://www.notion.so/My-Page-${HEX}?pvs=4#section`)).toBe(DASHED);
  });

  test("?p=<id> takes precedence (inline sub-page)", () => {
    const sub = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const subDashed = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    expect(parseNotionPageId(`https://www.notion.so/My-Page-${HEX}?p=${sub}`)).toBe(subDashed);
  });

  test("non-notion url returns null", () => {
    expect(parseNotionPageId("https://github.com/anthropics/foo")).toBeNull();
  });

  test("not a url returns null", () => {
    expect(parseNotionPageId(HEX)).toBeNull();
    expect(parseNotionPageId("just garbage")).toBeNull();
  });

  test("notion url with no id returns null", () => {
    expect(parseNotionPageId("https://www.notion.so/")).toBeNull();
  });
});

describe("resolveNotionPageId", () => {
  test("extracts id from a url", () => {
    expect(resolveNotionPageId(`https://www.notion.so/My-Page-${HEX}`)).toBe(DASHED);
  });

  test("dashes a raw 32-hex id", () => {
    expect(resolveNotionPageId(HEX)).toBe(DASHED);
  });

  test("uppercases-to-lowercases a dashed UUID", () => {
    expect(resolveNotionPageId(DASHED.toUpperCase())).toBe(DASHED);
  });

  test("passes through unrecognized input as-is", () => {
    expect(resolveNotionPageId("some-other-thing")).toBe("some-other-thing");
  });
});
