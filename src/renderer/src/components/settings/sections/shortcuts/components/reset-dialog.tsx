import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface ResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ResetDialog({ isOpen, onOpenChange, onConfirm }: ResetDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.resetTitle")}</DialogTitle>
          <DialogDescription>{t("shortcuts.resetDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {t("shortcuts.resetButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
