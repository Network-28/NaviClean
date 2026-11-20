import fs from "node:fs/promises";
import path from "node:path";
import { createRecycleSession } from "./file-ops.js";
import type { PrivateSettings } from "./settings.js";

/**
 * NaviClean writes tags, conversions and downloads into temporary files beside the real one
 * (`<name>.naviclean-retag-…`, `.<name>.naviclean-<job>…`, `<name>.naviclean-tagging…`,
 * `<name>.naviclean-normalized.…`) and renames them into place. A container stop mid-write leaves
 * one behind. They are never music to catalog.
 */
export function isNaviCleanWorkingFile(fileName: string) {
  return fileName.toLowerCase().includes(".naviclean-");
}

/** Leftovers older than this can't belong to a write still in progress. */
export const staleWorkingFileAgeMs = 60 * 60 * 1000;

/** Moves leftover working files older than an hour to the recycle bin; newer ones are left alone. */
export async function recycleStaleWorkingFiles(settings: PrivateSettings, files: string[], now = Date.now()) {
  const libraryRoot = path.resolve(settings.naming.libraryPath);
  const session = createRecycleSession(settings, new Date(now));
  const recycled: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const relativePath = path.relative(libraryRoot, file).split(path.sep).join("/");
    try {
      const stat = await fs.stat(file);
      if (now - stat.mtimeMs < staleWorkingFileAgeMs) {
        continue;
      }
      await session.recycle(file, relativePath);
      recycled.push(relativePath);
    } catch (error) {
      errors.push(`${relativePath}: ${(error as Error).message}`);
    }
  }

  return { recycled, errors };
}
