import { ThemeProvider } from "@/components/main/theme";
import { NuqsProvider } from "@/components/providers/nuqs-provider";
import { RouteConfigType } from "@/types/routes";
import { ReactNode } from "react";
import { SettingsProvider } from "@/components/providers/settings-provider";

export const RouteConfig: RouteConfigType = {
  Providers: ({ children }: { children: ReactNode }) => {
    return (
      <ThemeProvider forceTheme="dark">
        <NuqsProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </NuqsProvider>
      </ThemeProvider>
    );
  }
};
