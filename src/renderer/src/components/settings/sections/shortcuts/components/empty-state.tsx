import { AlertCircleIcon, Loader2, SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import { t } from "@/lib/i18n";

interface EmptyStateProps {
  type: "loading" | "no-results" | "no-shortcuts";
  searchTerm?: string;
}

export function EmptyState({ type, searchTerm }: EmptyStateProps) {
  if (type === "loading") {
    return (
      <motion.div
        className="flex flex-col items-center justify-center text-center py-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-muted-foreground">{t("shortcuts.loading")}</p>
      </motion.div>
    );
  }

  if (type === "no-results") {
    return (
      <motion.div
        className="flex flex-col items-center justify-center text-center py-12"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <SearchIcon className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-medium text-card-foreground">{t("shortcuts.noMatches")}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {searchTerm ? t("shortcuts.noResultsFor", { term: searchTerm }) : t("shortcuts.tryDifferent")}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center text-center py-12"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <AlertCircleIcon className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="font-medium text-card-foreground">{t("shortcuts.none")}</p>
      <p className="text-sm text-muted-foreground mt-1">{t("shortcuts.noneDescription")}</p>
    </motion.div>
  );
}
