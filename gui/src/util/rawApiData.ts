import { PromptLog } from "core";

export interface RawApiData {
  requestBody?: unknown;
  responseBody?: unknown;
  responseChunks?: unknown[];
}

export function extractRawApiDataFromPromptLog(
  promptLog: PromptLog | undefined,
): RawApiData {
  if (!promptLog) {
    return {};
  }

  const completionOptions = promptLog.completionOptions as
    | { requestBody?: unknown }
    | undefined;
  const requestBody = promptLog.requestBody ?? completionOptions?.requestBody;

  const responseChunks =
    promptLog.responseChunks && promptLog.responseChunks.length > 0
      ? promptLog.responseChunks
      : undefined;

  return {
    requestBody,
    responseBody: promptLog.responseBody,
    responseChunks,
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
