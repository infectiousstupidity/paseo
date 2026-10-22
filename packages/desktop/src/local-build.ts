import { readFileSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export const LOCAL_DESKTOP_BUILD_FLAVOR = "local";

export interface LocalDesktopBuildInfo {
  isLocal: boolean;
  commit: string | null;
}

export function readLocalDesktopBuildInfo(metadata: unknown): LocalDesktopBuildInfo {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return { isLocal: false, commit: null };
  }
  const record = metadata as Record<string, unknown>;
  const isLocal = record.paseoBuildFlavor === LOCAL_DESKTOP_BUILD_FLAVOR;
  const commit =
    isLocal && typeof record.paseoBuildCommit === "string" && record.paseoBuildCommit.trim()
      ? record.paseoBuildCommit.trim()
      : null;
  return { isLocal, commit };
}

function readLocalBuildInfoFile(filePath: string): LocalDesktopBuildInfo {
  try {
    return readLocalDesktopBuildInfo(JSON.parse(readFileSync(filePath, "utf8")) as unknown);
  } catch {
    return { isLocal: false, commit: null };
  }
}

let cachedLocalBuildInfo: LocalDesktopBuildInfo | null = null;

export function getLocalDesktopBuildInfo(): LocalDesktopBuildInfo {
  if (!app.isPackaged) return { isLocal: false, commit: null };
  if (cachedLocalBuildInfo !== null) return cachedLocalBuildInfo;

  // The build script writes this beside dist/main.js before electron-builder
  // packages dist/**. This avoids relying on package.json metadata injection
  // surviving nested npm/electron-builder invocations.
  cachedLocalBuildInfo = readLocalBuildInfoFile(path.join(__dirname, "local-build-info.json"));
  return cachedLocalBuildInfo;
}

export function isLocalDesktopBuild(): boolean {
  return getLocalDesktopBuildInfo().isLocal;
}
