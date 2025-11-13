import { PromptLog } from "core";
import { useMemo } from "react";
import { CopyIconButton } from "../gui/CopyIconButton";
import useCopy from "../../hooks/useCopy";
import { extractRawApiDataFromPromptLog } from "../../util/rawApiData";

interface RawApiDataDialogProps {
  promptLog?: PromptLog;
}

function formatJson(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function Section({
  title,
  description,
  value,
  emptyMessage,
  copyButtonLabel,
}: {
  title: string;
  description?: string;
  value?: unknown;
  emptyMessage?: string;
  copyButtonLabel?: string;
}) {
  const formatted = useMemo(
    () => (value === undefined ? undefined : formatJson(value)),
    [value],
  );
  if (formatted === undefined) {
    return emptyMessage ? (
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-[color:var(--vscode-foreground)]">
            {title}
          </h3>
          {description ? (
            <p className="text-xs text-[color:var(--vscode-descriptionForeground)]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="rounded border border-[color:var(--vscode-editorWidget-border)] bg-[color:var(--vscode-editorWidget-background)] px-3 py-2 text-xs text-[color:var(--vscode-descriptionForeground)]">
          {emptyMessage}
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--vscode-foreground)]">
            {title}
          </h3>
          {description ? (
            <p className="text-xs text-[color:var(--vscode-descriptionForeground)]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-row items-center gap-2">
          <CopyIconButton
            text={formatted}
            tooltipPlacement="top"
            checkIconClassName="h-4 w-4 text-[color:var(--vscode-testing-iconPassed)]"
            clipboardIconClassName="h-4 w-4 text-[color:var(--vscode-descriptionForeground)]"
          />
          {copyButtonLabel ? (
            <CopyTextButton label={copyButtonLabel} text={formatted} />
          ) : null}
        </div>
      </div>
      <pre className="no-scrollbar max-h-72 overflow-auto rounded border border-[color:var(--vscode-editorWidget-border)] bg-[color:var(--vscode-editorWidget-background)] p-3 text-xs leading-5 text-[color:var(--vscode-editor-foreground)]">
        {formatted}
      </pre>
    </div>
  );
}

function CopyTextButton({
  text,
  label,
}: {
  text: string;
  label: string;
}): JSX.Element {
  const { copyText, copied } = useCopy(text);

  return (
    <button
      type="button"
      onClick={copyText}
      className="rounded border border-[color:var(--vscode-textLink-foreground)] px-2 py-1 text-xs font-medium text-[color:var(--vscode-textLink-foreground)] transition-colors hover:bg-[color:var(--vscode-textLink-foreground)] hover:text-[color:var(--vscode-editor-background)]"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function RawApiDataDialog({
  promptLog,
}: RawApiDataDialogProps): JSX.Element {
  const { requestBody, responseBody, responseChunks } =
    extractRawApiDataFromPromptLog(promptLog);
  const response =
    responseBody ??
    (responseChunks && responseChunks.length > 0 ? responseChunks : undefined);
  const modelTitle = promptLog?.modelTitle ?? "unknown model";
  const providerName = promptLog?.modelProvider ?? "unknown provider";
  const hasAnyRawPayload =
    !!requestBody || !!responseBody || (responseChunks?.length ?? 0) > 0;

  return (
    <div className="flex max-h-[80vh] min-w-[min(720px,95vw)] flex-col gap-4 overflow-y-auto px-6 pb-6 pt-8 text-[color:var(--vscode-foreground)]">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Tool Call API Details</h2>
        <p className="mt-1 text-xs text-[color:var(--vscode-descriptionForeground)]">
          Captured payloads for model <strong>{modelTitle}</strong> (
          {providerName}). These values reflect the JSON sent to and received
          from the provider for this step.
        </p>
        {!hasAnyRawPayload && (
          <div className="rounded border border-[color:var(--vscode-editorWidget-border)] bg-[color:var(--vscode-editorWidget-background)] px-3 py-2 text-xs text-[color:var(--vscode-descriptionForeground)]">
            Raw API request/response bodies were not captured for this model.
            This is expected when using local models or providers that do not
            expose OpenAI-compatible telemetry.
          </div>
        )}
      </div>
      <Section
        title="Request Body"
        description="Complete JSON payload sent to the provider."
        value={requestBody}
        emptyMessage="No request payload was recorded for this interaction."
        copyButtonLabel={requestBody ? "Copy request JSON" : undefined}
      />
      <Section
        title="Response"
        description="Raw response data returned by the provider."
        value={response}
        emptyMessage="No response data was captured for this interaction."
        copyButtonLabel={response ? "Copy response JSON" : undefined}
      />
    </div>
  );
}
