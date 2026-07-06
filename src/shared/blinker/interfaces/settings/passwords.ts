import type { PasswordEntry, PasswordEntryInput, PasswordImportResult } from "~/types/passwords";

export interface BlinkerPasswordsAPI {
  list: (profileId: string) => Promise<PasswordEntry[]>;
  save: (profileId: string, entry: PasswordEntryInput) => Promise<PasswordEntry>;
  delete: (profileId: string, id: number) => Promise<boolean>;
  importFromCsv: (profileId: string) => Promise<PasswordImportResult | null>;
  exportToCsv: (profileId: string) => Promise<boolean>;
}
