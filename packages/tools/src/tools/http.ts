import { assertTarget } from "../scope.js";
import type { Tool } from "../types.js";

const MAX_BODY_CHARS = 16_000;

export const httpRequestTool: Tool = {
  name: "http_request",
  description:
    "Perform an HTTP request against an explicit target and return status, headers and " +
    "body (tail-capped). The hostname is checked against the configured lab scope " +
    "before connecting. Fuzzing, auth attempts and header games are fine - aim them at " +
    "lab targets.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "Full URL, e.g. http://192.168.1.50/dvwa/login.php",
      },
      method: {
        type: ["string", "null"],
        description: "HTTP method (default GET). Omit this field entirely rather than passing null.",
      },
      headers: {
        type: ["object", "null"],
        description: "Request headers as key/value strings, e.g. { Cookie: 'PHPSESSID=...' }. Omit this field entirely rather than passing null.",
      },
      body: {
        type: ["string", "null"],
        description: "Request body for POST/PUT/PATCH. Omit this field entirely rather than passing null.",
      },
      timeoutMs: {
        type: ["number", "null"],
        description: "Timeout in milliseconds (default 30000, max 600000). Omit this field entirely rather than passing null.",
      },
    },
    required: ["url"],
  },
  async execute(args, ctx) {
    const url = typeof args.url === "string" ? args.url.trim() : "";
    if (!url) return "error: url is required";

    let origin: string;
    try {
      origin = new URL(url).hostname;
    } catch {
      return `error: invalid url ${url}`;
    }

    const check = await assertTarget(ctx, origin);
    if (!check.ok) return check.reason;

    const method = typeof args.method === "string" ? args.method.toUpperCase() : "GET";
    const timeoutMs = Math.min(Math.max(typeof args.timeoutMs === "number" ? args.timeoutMs : 30_000, 1_000), 600_000);
    const headers = new Headers();
    if (args.headers && typeof args.headers === "object" && !Array.isArray(args.headers)) {
      for (const [key, value] of Object.entries(args.headers as Record<string, unknown>)) {
        if (typeof value === "string") headers.set(key, value);
      }
    }
    const body = typeof args.body === "string" && args.body && method !== "GET" && method !== "HEAD"
      ? args.body
      : undefined;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      const text = await response.text();
      const headerLines = [...response.headers.entries()]
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      const capped =
        text.length <= MAX_BODY_CHARS ? text : `${text.length} bytes; tail:\n${text.slice(-MAX_BODY_CHARS)}`;

      if (response.status >= 400) {
        // Failed status codes are data when fuzzing - return details, still prefixed error so
        // the agent notices.
        return `error: HTTP ${response.status} ${response.statusText}\n\n${headerLines}\n\n${capped}`;
      }
      return `HTTP ${response.status} ${response.statusText}\n\n${headerLines}\n\n${capped}`;
    } catch (error) {
      const err = error as Error;
      const cause = (err as { cause?: Error }).cause;
      return `error: ${err.message}${cause ? ` (${cause.message})` : ""}`;
    }
  },
};
