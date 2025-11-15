import { PromptLog, ToolCallState } from "core";

export interface RawApiData {
  requestBody?: unknown;
  responseBody?: unknown;
  responseChunks?: unknown[];
  errorMessage?: string;
}

function normalizeErrorCandidate(candidate: unknown): string | undefined {
  if (!candidate) {
    return undefined;
  }

  if (typeof candidate === "string") {
    return candidate;
  }

  if (candidate instanceof Error) {
    return candidate.message;
  }

  if (typeof candidate === "object") {
    const possibleKeys = [
      "message",
      "error",
      "errorMessage",
      "detail",
      "description",
    ];

    for (const key of possibleKeys) {
      const value = (candidate as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    try {
      return JSON.stringify(candidate, null, 2);
    } catch (err) {
      return String(candidate);
    }
  }

  return String(candidate);
}

function extractErrorMessageFromPromptLog(
  promptLog: PromptLog | undefined,
): string | undefined {
  if (!promptLog) {
    return undefined;
  }

  const promptLogWithError = promptLog as PromptLog & {
    errorMessage?: unknown;
    error?: unknown;
  };

  const candidates: unknown[] = [
    promptLogWithError.errorMessage,
    promptLogWithError.error,
  ];

  const responseBody = promptLog.responseBody;
  if (responseBody && typeof responseBody === "object") {
    const responseObj = responseBody as Record<string, unknown>;
    candidates.push(responseObj.error);
    candidates.push(responseObj.message);
  }

  for (const candidate of candidates) {
    const message = normalizeErrorCandidate(candidate);
    if (message && message.trim().length > 0) {
      return message.trim();
    }
  }

  return undefined;
}

function extractErrorMessageFromToolCallState(
  toolCallState: ToolCallState | undefined,
): string | undefined {
  if (!toolCallState || toolCallState.status !== "errored") {
    return undefined;
  }

  const outputItems = toolCallState.output ?? [];
  for (const item of outputItems) {
    if (typeof item.content === "string" && item.content.trim().length > 0) {
      return item.content.trim();
    }

    if (
      typeof item.description === "string" &&
      item.description.trim().length > 0
    ) {
      return item.description.trim();
    }
  }

  return undefined;
}

export function extractRawApiDataFromPromptLog(
  promptLog: PromptLog | undefined,
  toolCallState?: ToolCallState,
): RawApiData {
  if (!promptLog) {
    return {
      errorMessage: extractErrorMessageFromToolCallState(toolCallState),
    };
  }

  const completionOptions = promptLog.completionOptions as
    | { requestBody?: unknown }
    | undefined;
  const requestBody = promptLog.requestBody ?? completionOptions?.requestBody;

  const responseChunks =
    promptLog.responseChunks && promptLog.responseChunks.length > 0
      ? promptLog.responseChunks
      : undefined;

  const promptLogErrorMessage = extractErrorMessageFromPromptLog(promptLog);
  const toolCallErrorMessage =
    extractErrorMessageFromToolCallState(toolCallState);

  return {
    requestBody,
    responseBody: promptLog.responseBody,
    responseChunks,
    errorMessage: toolCallErrorMessage ?? promptLogErrorMessage,
  };
}

export function promptLogHasRawApiData(
  promptLog: PromptLog | undefined,
): boolean {
  if (!promptLog) {
    return false;
  }
  if (promptLog.requestBody || promptLog.responseBody) {
    return true;
  }
  return (promptLog.responseChunks?.length ?? 0) > 0;
}
