import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ActivePrompt } from "~/types/prompts";

interface ActivePromptsContextValue {
  activePrompts: ActivePrompt[];
}

const ActivePromptsContext = createContext<ActivePromptsContextValue | null>(null);

export function useActivePrompts() {
  const context = useContext(ActivePromptsContext);
  if (!context) {
    throw new Error("useActivePrompts must be used within a ActivePromptsProvider");
  }
  return context;
}

interface ActivePromptsProviderProps {
  children: React.ReactNode;
}

export function ActivePromptsProvider({ children }: ActivePromptsProviderProps) {
  const [activePrompts, setActivePrompts] = useState<ActivePrompt[]>([]);

  const fetchActivePrompts = useCallback(async () => {
    const prompts = await blinker.prompts.getActivePrompts();
    setActivePrompts(prompts);
  }, []);

  useEffect(() => {
    fetchActivePrompts();

    const unsub = blinker.prompts.onActivePromptsChanged((prompts) => {
      setActivePrompts(prompts);
    });

    return () => unsub();
  }, [fetchActivePrompts]);

  return <ActivePromptsContext.Provider value={{ activePrompts }}>{children}</ActivePromptsContext.Provider>;
}
