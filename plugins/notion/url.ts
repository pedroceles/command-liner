// Notion page IDs are 32 hex characters. The API accepts them both as
// the raw 32-char form and as a dashed UUID (8-4-4-4-12). We canonicalise
// to dashed form for consistency.

const HEX32 = /^[0-9a-f]{32}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRAILING_HEX32 = /([0-9a-f]{32})$/i;
const TRAILING_UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function toDashed(hex32: string): string {
  const h = hex32.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function normalize(id: string): string {
  if (HEX32.test(id)) return toDashed(id);
  if (UUID.test(id)) return id.toLowerCase();
  return id;
}

export function parseNotionPageId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const isNotion =
    host === "notion.so" ||
    host === "www.notion.so" ||
    host.endsWith(".notion.so") ||
    host.endsWith(".notion.site");
  if (!isNotion) return null;

  // ?p=<id> refers to a block/sub-page that opened on top of the page.
  const p = url.searchParams.get("p");
  if (p) {
    if (HEX32.test(p)) return toDashed(p);
    if (UUID.test(p)) return p.toLowerCase();
  }

  // Last path segment of `/Some-Title-<32hex>` or `/<uuid>`.
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  const hexMatch = last.match(TRAILING_HEX32);
  if (hexMatch) return toDashed(hexMatch[1]!);
  const uuidMatch = last.match(TRAILING_UUID);
  if (uuidMatch) return uuidMatch[1]!.toLowerCase();
  return null;
}

export function resolveNotionPageId(input: string): string {
  const fromUrl = parseNotionPageId(input);
  if (fromUrl) return fromUrl;
  return normalize(input);
}
