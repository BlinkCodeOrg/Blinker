import { IPCListener, WindowState } from "~/blinker/types";

// API //
export interface BlinkerWindowsAPI {
  /**
   * Opens the settings page
   */
  openSettingsWindow: () => void;

  /**
   * Closes the legacy settings window
   */
  closeSettingsWindow: () => void;

  // Generic window controls — work for any internal window (browser, settings, etc.)

  /**
   * Minimizes the current window
   */
  minimizeCurrentWindow: () => void;

  /**
   * Toggles maximize/restore on the current window
   */
  maximizeCurrentWindow: () => void;

  /**
   * Closes the current window
   */
  closeCurrentWindow: () => void;

  /**
   * Gets the current window's state (maximized, fullscreen)
   */
  getCurrentWindowState: () => Promise<WindowState>;

  /**
   * Listens for window state changes on the current window
   */
  onCurrentWindowStateChanged: IPCListener<[WindowState]>;
}
