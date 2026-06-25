import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Profile } from "~/flow/interfaces/sessions/profiles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

// Delete Confirmation Dialog Component
interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  spaceName: string;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmDialog({ isOpen, onClose, spaceName, isDeleting, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("profiles.deleteSpace")}</DialogTitle>
          <DialogDescription>{t("profiles.deleteSpaceDescription", { space: spaceName })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={isDeleting}>
            {t("action.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className="gap-2">
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("action.deleting")}
              </>
            ) : (
              t("action.delete")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Space Dialog Component
interface CreateSpaceDialogProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  spaceName: string;
  setSpaceName: (name: string) => void;
  isCreating: boolean;
  onCreate: () => Promise<void>;
  profiles: Profile[];
  selectedProfile: string | null;
  setSelectedProfile: (profile: string) => void;
}

export function CreateSpaceDialog({
  isOpen,
  onClose,
  spaceName,
  setSpaceName,
  isCreating,
  onCreate,
  profiles,
  selectedProfile,
  setSelectedProfile
}: CreateSpaceDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("profiles.createSpace")}</DialogTitle>
          <DialogDescription>{t("profiles.createSpacePlainDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="profile-select" className="text-right">
              {t("passwords.profile")}
            </Label>
            <Select value={selectedProfile ?? ""} onValueChange={setSelectedProfile}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={t("profiles.selectProfile")} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="space-name" className="text-right">
              {t("profiles.name")}
            </Label>
            <Input
              id="space-name"
              placeholder={t("profiles.spaceNamePlaceholder")}
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isCreating && spaceName.trim() && selectedProfile) {
                  onCreate();
                }
              }}
              className="col-span-3"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose(false)} disabled={isCreating}>
            {t("action.cancel")}
          </Button>
          <Button onClick={onCreate} disabled={isCreating || !spaceName.trim() || !selectedProfile} className="gap-2">
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("action.creating")}
              </>
            ) : (
              t("action.create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
