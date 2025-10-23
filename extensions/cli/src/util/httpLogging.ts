import chalk from "chalk";

import { safeStderr } from "../init.js";
import { logger } from "./logger.js";

const MAX_BODY_PREVIEW_LENGTH = 4000;
let isHttpLoggingEnabled = false;
let originalFetch: typeof globalThis.fetch | null = null;
let requestCounter = 0;

function nextRequestId(): string {
  requestCounter = (requestCounter + 1) % Number.MAX_SAFE_INTEGER;
  return requestCounter.toString().padStart(4, "0");
}

function emitLog(requestId: string, message: string): void {
  const prefix = `[HTTP ${requestId}]`;
  logger.debug(`${prefix} ${message}`);
  safeStderr(`${chalk.cyan(prefix)} ${message}\n`);
}

function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (result[key]) {
      result[key] = `${result[key]}, ${value}`;
    } else {
      result[key] = value;
    }
  });

  return result;
}

function isTextLikeContent(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }

  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.startsWith("text/") ||
    normalized.includes("json") ||
    normalized.includes("xml") ||
    normalized === "application/x-www-form-urlencoded" ||
    normalized === "application/graphql"
  );
}

function truncateBody(body: string): { value: string; truncated: boolean } {
  if (body.length <= MAX_BODY_PREVIEW_LENGTH) {
    return { value: body, truncated: false };
  }

  const truncatedLength = body.length - MAX_BODY_PREVIEW_LENGTH;
  return {
    value: `${body.slice(0, MAX_BODY_PREVIEW_LENGTH)}… [truncated ${truncatedLength} characters]`,
    truncated: true,
  };
}

async function readBody(
  source: Request | Response,
  type: "request" | "response",
): Promise<string | undefined> {
  try {
    const headers = source.headers;

    if (!isTextLikeContent(headers.get("content-type"))) {
      return undefined;
    }

    const clone = source.clone();
    const text = await clone.text();

    if (!text) {
      return "<empty>";
    }

    if (headers.get("content-type")?.includes("application/json")) {
      try {
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        return truncateBody(formatted).value;
      } catch {
        // Fall back to raw text
      }
    }

    const { value } = truncateBody(text);
    return value;
  } catch (error) {
    logger.debug(
      `Failed to read ${type} body for logging`,
      error instanceof Error ? error : new Error(String(error)),
    );
    return undefined;
  }
}

function logBody(
  requestId: string,
  body: string | undefined,
  direction: "Request" | "Response",
): void {
  if (!body) {
    return;
  }

  emitLog(requestId, `${direction} Body:\n${body}`);
}

export function enableHttpLogging(): void {
  if (isHttpLoggingEnabled) {
    return;
  }

  if (typeof globalThis.fetch !== "function") {
    logger.debug("HTTP logging requested, but global fetch is not available");
    return;
  }

  isHttpLoggingEnabled = true;
  originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const requestId = nextRequestId();
    const request = new Request(input as RequestInfo, init);

    emitLog(
      requestId,
      `${chalk.green("→")} ${request.method.toUpperCase()} ${request.url}`,
    );
    emitLog(
      requestId,
      `Request Headers: ${JSON.stringify(headersToObject(request.headers), null, 2)}`,
    );

    void readBody(request, "request").then((body) => {
      if (body === undefined) {
        emitLog(requestId, "Request Body: <not logged>");
      } else {
        logBody(requestId, body, "Request");
      }
    });

    if (!originalFetch) {
      throw new Error("Original fetch is not available for HTTP logging");
    }

    try {
      const response = await originalFetch(request);
      emitLog(
        requestId,
        `${chalk.yellow("←")} ${response.status} ${response.statusText || ""}`.trim(),
      );
      emitLog(
        requestId,
        `Response Headers: ${JSON.stringify(headersToObject(response.headers), null, 2)}`,
      );

      void readBody(response, "response").then((body) => {
        if (body === undefined) {
          emitLog(requestId, "Response Body: <not logged>");
        } else {
          logBody(requestId, body, "Response");
        }
      });

      return response;
    } catch (error) {
      emitLog(
        requestId,
        `${chalk.red("✖")} Request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  };
}
