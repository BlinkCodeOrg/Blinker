import { IPCListener } from "~/blinker/types";

// API //
export interface BlinkerActionsAPI {
  /**
   * Listen for copy link action
   */
  onCopyLink: IPCListener<[]>;

  /**
   * Listen for generic incoming actions
   */
  onIncomingAction: IPCListener<[string]>;
}
