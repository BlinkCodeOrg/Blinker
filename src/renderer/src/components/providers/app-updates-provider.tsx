import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from "react";
import { UpdateStatus } from "~/types/updates";

interface AppUpdatesContextType {
  updateStatus: UpdateStatus | null;
  isCheckingForUpdates: boolean;
  isDownloadingUpdate: boolean;
  isInstallingUpdate: boolean;
  isAutoUpdateSupported: boolean;
  hasUpdated: boolean;
  checkForUpdates: () => Promise<boolean>;
  downloadUpdate: () => Promise<boolean>;
  installUpdate: () => Promise<boolean>;
}

interface AppUpdatesProviderProps {
  children: ReactNode;
}

const AppUpdatesContext = createContext<AppUpdatesContextType | null>(null);

export function AppUpdatesProvider({ children }: AppUpdatesProviderProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [isAutoUpdateSupported, setIsAutoUpdateSupported] = useState(false);
  const [hasUpdated, setHasUpdated] = useState(false);

  // Initialize update status
  useEffect(() => {
    let cancelled = false;
    const fetchUpdateStatus = async () => {
      try {
        const status = await blinker.updates.getUpdateStatus();
        if (!cancelled) setUpdateStatus(status);
      } catch (error) {
        console.error("Failed to get update status:", error);
      }
    };

    const checkAutoUpdateSupport = async () => {
      try {
        const supported = await blinker.updates.isAutoUpdateSupported();
        if (!cancelled) setIsAutoUpdateSupported(supported);
      } catch (error) {
        console.error("Failed to check auto update support:", error);
        if (!cancelled) setIsAutoUpdateSupported(false);
      }
    };

    const checkHasUpdated = async () => {
      try {
        const updated = await blinker.updates.hasUpdated();
        if (!cancelled) setHasUpdated(updated);
      } catch (error) {
        console.error("Failed to check if app has updated:", error);
      }
    };

    const timeout = window.setTimeout(() => {
      void fetchUpdateStatus();
      void checkAutoUpdateSupport();
      void checkHasUpdated();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

  // Listen for update status changes
  useEffect(() => {
    const handleUpdateStatusChanged = (status: UpdateStatus) => {
      setUpdateStatus(status);
    };

    const unsubscribe = blinker.updates.onUpdateStatusChanged(handleUpdateStatusChanged);

    return () => {
      // Cleanup
      unsubscribe();
    };
  }, []);

  // setIsDownloadingUpdate
  const isDownloadingUpdate = useMemo(() => {
    return !!updateStatus?.downloadProgress;
  }, [updateStatus]);

  const checkForUpdates = useCallback(async () => {
    setIsCheckingForUpdates(true);
    try {
      const isUpdateAvailable = await blinker.updates.checkForUpdates();
      setIsCheckingForUpdates(false);
      return isUpdateAvailable;
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setIsCheckingForUpdates(false);
      return false;
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    try {
      const success = await blinker.updates.downloadUpdate();
      return success;
    } catch (error) {
      console.error("Failed to download update:", error);
      return false;
    }
  }, []);

  const installUpdate = useCallback(async () => {
    setIsInstallingUpdate(true);
    try {
      const success = await blinker.updates.installUpdate();
      setIsInstallingUpdate(false);
      return success;
    } catch (error) {
      console.error("Failed to install update:", error);
      setIsInstallingUpdate(false);
      return false;
    }
  }, []);

  const value = {
    updateStatus,
    isCheckingForUpdates,
    isDownloadingUpdate,
    isInstallingUpdate,
    isAutoUpdateSupported,
    hasUpdated,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  };

  return <AppUpdatesContext.Provider value={value}>{children}</AppUpdatesContext.Provider>;
}

export function useAppUpdates(): AppUpdatesContextType {
  const context = useContext(AppUpdatesContext);
  if (context === null) {
    throw new Error("useAppUpdates must be used within an AppUpdatesProvider");
  }
  return context;
}
