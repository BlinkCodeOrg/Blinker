import { ThemeProvider } from "@/components/main/theme";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { RouteConfigType } from "@/types/routes";
import { ReactNode } from "react";

export const RouteConfig: RouteConfigType = {
  Providers: ({ children }: { children: ReactNode }) => {
    return (
      <ThemeProvider persist>
        <SettingsProvider>{children}</SettingsProvider>
      </ThemeProvider>
    );
  }
};
