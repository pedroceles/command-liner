import type { Http, HttpOptions } from "./index.ts";

export class HttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, statusText: string) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  url: string,
  method: string,
  opts: HttpOptions & { body?: unknown } = {},
): Promise<T> {
  const fullUrl = opts.baseUrl ? new URL(url, opts.baseUrl).toString() : url;
  const headers = new Headers(opts.headers ?? {});
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);

  let body: string | undefined;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  }

  const res = await fetch(fullUrl, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // not JSON; keep raw text
    }
  }
  if (!res.ok) throw new HttpError(res.status, parsed, res.statusText);
  return parsed as T;
}

export function makeHttp(): Http {
  return {
    get: (url, opts) => request(url, "GET", opts),
    post: (url, body, opts) => request(url, "POST", { ...opts, body }),
    put: (url, body, opts) => request(url, "PUT", { ...opts, body }),
    delete: (url, opts) => request(url, "DELETE", opts),
  };
}
