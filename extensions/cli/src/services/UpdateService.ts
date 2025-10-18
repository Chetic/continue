import { exec, spawn } from "child_process";
import { promisify } from "util";

import { GlobalContext } from "core/util/GlobalContext.js";

import { logger } from "src/util/logger.js";

import { getVersion } from "../version.js";

import { BaseService } from "./BaseService.js";
import { serviceContainer } from "./ServiceContainer.js";
import { UpdateServiceState, UpdateStatus } from "./types.js";
const execAsync = promisify(exec);

/**
 * Service for checking and performing CLI updates
 */
export class UpdateService extends BaseService<UpdateServiceState> {
  constructor() {
    super("update", {
      autoUpdate: true,
      isAutoUpdate: true,
      status: UpdateStatus.IDLE,
      message: "",
      error: null,
      isUpdateAvailable: false,
      latestVersion: null,
      currentVersion: getVersion(),
    });
  }

  /**
   * Initialize the update service
   */
  async doInitialize(headless?: boolean) {
    void this.checkAndAutoUpdate();
    return this.currentState;
  }

  private async checkAndAutoUpdate() {
    const globalContext = new GlobalContext();
    globalContext.update("autoUpdateCli", false);

    this.setState({
      autoUpdate: false,
      status: UpdateStatus.IDLE,
      message: `Continue CLI v${this.currentState.currentVersion}`,
      isUpdateAvailable: false,
      latestVersion: null,
    });
  }

  public async setAutoUpdate(value: boolean) {
    const globalContext = new GlobalContext();
    globalContext.update("autoUpdateCli", value);
    this.setState({
      autoUpdate: value,
    });
  }

  // TODO this is a hack because our service state update code is broken
  // Currently all things that need update use serviceContainer.set manually
  // Rather than actually using the stateChanged event
  setState(newState: Partial<UpdateServiceState>): void {
    super.setState(newState);
    serviceContainer.set("update", this.currentState);
  }

  async performUpdate(isAutoUpdate?: boolean) {
    if (this.currentState.status === "updating") {
      return;
    }

    try {
      this.setState({
        isAutoUpdate,
        status: UpdateStatus.UPDATING,
        message: `${isAutoUpdate ? "Auto-updating" : "Updating"} to v${this.currentState.latestVersion}`,
      });

      // Install the update
      const { stdout, stderr } = await execAsync("npm i -g @continuedev/cli");
      logger.debug("Update output:", { stdout, stderr });

      if (stderr) {
        const errLines = stderr.split("\n");
        for (const line of errLines) {
          const lower = line.toLowerCase().trim();
          if (
            !line ||
            lower.includes("debugger") ||
            lower.includes("npm warn")
          ) {
            continue;
          }
          this.setState({
            status: UpdateStatus.ERROR,
            message: `Error updating to v${this.currentState.latestVersion}`,
            error: new Error(stderr),
          });
          return;
        }
      }

      this.setState({
        status: UpdateStatus.UPDATED,
        message: `${isAutoUpdate ? "Auto-updated to" : "Restart for"} v${this.currentState.latestVersion}`,
        isUpdateAvailable: false,
      });
      if (isAutoUpdate) {
        this.restartCLI();
      }
    } catch (error: any) {
      logger.error("Error updating CLI:", error);
      this.setState({
        status: UpdateStatus.ERROR,
        message: isAutoUpdate ? "Auto-update failed" : "Update failed",
        error,
      });
      setTimeout(() => {
        this.setState({
          status: UpdateStatus.IDLE,
          message: `/update to v${this.currentState.latestVersion}`,
        });
      }, 4000);
    }
  }

  private restartCLI(): void {
    try {
      const entryPoint = process.argv[1];
      const cliArgs = process.argv.slice(2);
      const nodeExecutable = process.execPath;

      logger.debug(
        `Preparing for CLI restart with: ${nodeExecutable} ${entryPoint} ${cliArgs.join(
          " ",
        )}`,
      );

      // Halt/clean up parent cn process
      try {
        // Remove all input listeners
        global.clearTimeout = () => {};
        global.clearInterval = () => {};
        process.stdin.removeAllListeners();
        process.stdin.pause();
        // console.clear(); // Don't want to clear things that were in console before cn started
      } catch (e) {
        logger.debug("Error cleaning up terminal:", e);
      }

      // Spawn a new detached cn process
      const child = spawn(nodeExecutable, [entryPoint, ...cliArgs], {
        detached: true,
        stdio: "inherit",
        env: {
          ...process.env,
          CONTINUE_CLI_AUTO_UPDATED: "true",
        },
      });

      // I did not find a way on existing to avoid a bug where next process has input glitches without leaving parent in place
      // So instead of existing, parent will exit when child exits
      // process.exit(0);
      child.on("exit", (code) => {
        process.exit(code);
      });
      child.unref();
    } catch (error) {
      logger.error("Failed to restart CLI:", error);
    }
  }
}
