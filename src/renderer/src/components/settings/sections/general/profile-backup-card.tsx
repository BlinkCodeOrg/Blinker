import { useState } from "react";
import { ArchiveRestore, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { t } from "@/lib/i18n";

export function ProfileBackupCard() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const exportBackup = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const result = await blinker.app.exportProfileBackup();
      setMessage(result.success ? t("backup.exported") : (result.error ?? t("backup.exportFailed")));
    } finally {
      setExporting(false);
    }
  };

  const importBackup = async () => {
    setImporting(true);
    setMessage(null);
    try {
      const result = await blinker.app.importProfileBackup();
      if (!result.success) setMessage(result.error ?? t("backup.importFailed"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="remove-app-drag rounded-lg border bg-card p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ArchiveRestore className="size-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-card-foreground">{t("backup.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("backup.description")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 px-4 py-3"
          onClick={() => void exportBackup()}
          disabled={exporting || importing}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          <span className="text-left">
            <span className="block font-medium">{t("backup.export")}</span>
            <span className="block text-xs text-muted-foreground">{t("backup.exportHint")}</span>
          </span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              disabled={exporting || importing}
            >
              <Upload className="size-4" />
              <span className="text-left">
                <span className="block font-medium">{t("backup.import")}</span>
                <span className="block text-xs text-muted-foreground">{t("backup.importHint")}</span>
              </span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("backup.importConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("backup.importConfirmDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("action.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void importBackup();
                }}
                disabled={importing}
              >
                {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("backup.import")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
