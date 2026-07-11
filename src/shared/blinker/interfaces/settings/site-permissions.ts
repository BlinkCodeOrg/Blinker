import type { SitePermissionEntry, SitePermissionInput } from "~/types/site-permissions";

export interface BlinkerSitePermissionsAPI {
  list: (profileId?: string) => Promise<SitePermissionEntry[]>;
  set: (profileId: string, input: SitePermissionInput) => Promise<SitePermissionEntry>;
  remove: (profileId: string, id: number) => Promise<boolean>;
  clear: (profileId: string) => Promise<void>;
  onChanged: (callback: () => void) => () => void;
}
