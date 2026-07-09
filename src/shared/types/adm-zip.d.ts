declare module "adm-zip" {
  class AdmZip {
    constructor(zipFile?: string | Buffer);
    addFile(entryName: string, content: Buffer | string): void;
    addLocalFile(localPath: string, zipPath?: string, zipName?: string): void;
    addLocalFolder(localPath: string, zipPath?: string): void;
    extractAllTo(targetPath: string, overwrite?: boolean): void;
    getEntry(entryName: string): { getData(): Buffer } | null;
    getEntries(): Array<{ entryName: string; isDirectory: boolean }>;
    writeZip(targetFileName: string): void;
  }

  export = AdmZip;
}
