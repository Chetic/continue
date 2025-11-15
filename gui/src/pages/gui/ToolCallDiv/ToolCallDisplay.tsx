import { Tool, ToolCallState } from "core";
import { useContext, useMemo } from "react";
import RawApiDataDialog from "../../../components/dialogs/RawApiDataDialog";
import { openContextItem } from "../../../components/mainInput/belowMainInput/ContextItemsPeek";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { setDialogMessage, setShowDialog } from "../../../redux/slices/uiSlice";
import { promptLogHasRawApiData } from "../../../util/rawApiData";
import { ToolCallStatusMessage } from "./ToolCallStatusMessage";
import { toolCallStateToContextItems } from "./utils";
import { ToolTruncateHistoryIcon } from "./ToolTruncateHistoryIcon";

interface ToolCallDisplayProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  tool: Tool | undefined;
  toolCallState: ToolCallState;
  historyIndex: number;
}

export function ToolCallDisplay({
  tool,
  toolCallState,
  children,
  icon,
  historyIndex,
}: ToolCallDisplayProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useAppDispatch();
  const promptLogs = useAppSelector(
    (state) => state.session.history[historyIndex]?.promptLogs,
  );
  const promptLog =
    promptLogs && promptLogs.length > 0
      ? promptLogs[promptLogs.length - 1]
      : undefined;

  const shownContextItems = useMemo(() => {
    const contextItems = toolCallStateToContextItems(toolCallState);
    return contextItems.filter((item) => !item.hidden);
  }, [toolCallState]);

  const isErrored = toolCallState.status === "errored";
  const canOpenContext = shownContextItems.length > 0;
  const rawDataAvailable = promptLogHasRawApiData(promptLog);
  const isClickable = isErrored || canOpenContext;

  function handleStatusClick() {
    if (isErrored) {
      handleOpenRawData();
      return;
    }
    if (canOpenContext) {
      openContextItem(shownContextItems[0], ideMessenger);
    }
  }

  function handleOpenRawData() {
    dispatch(
      setDialogMessage(
        <RawApiDataDialog
          promptLog={promptLog}
          toolCallState={toolCallState}
        />,
      ),
    );
    dispatch(setShowDialog(true));
  }

  return (
    <div className="flex flex-col justify-center px-4">
      <div className="mb-2 flex flex-col">
        <div className="flex flex-row items-start justify-between gap-1.5">
          <div
            className={`flex min-w-0 flex-row items-center gap-2 transition-colors duration-200 ease-in-out ${
              isClickable ? "cursor-pointer hover:brightness-125" : ""
            }`}
            onClick={isClickable ? handleStatusClick : undefined}
          >
            <div className="mt-[1px] h-4 w-4 flex-shrink-0 font-semibold">
              {icon}
            </div>
            {tool?.faviconUrl && (
              <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
            )}
            <ToolCallStatusMessage tool={tool} toolCallState={toolCallState} />
          </div>
          <div className="flex flex-row items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleOpenRawData();
              }}
              className="text-xs font-medium text-[color:var(--vscode-textLink-foreground)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--vscode-textLink-activeForeground)]"
            >
              {rawDataAvailable
                ? "View raw API data"
                : "View tool call details"}
            </button>
            {!!toolCallState.output?.length && (
              <ToolTruncateHistoryIcon historyIndex={historyIndex} />
            )}
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
