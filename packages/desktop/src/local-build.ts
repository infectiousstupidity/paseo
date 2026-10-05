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

export function hasLocalDesktopBuildFlavor(metadata: unknown): boolean {
  return readLocalDesktopBuildInfo(metadata).isLocal;
}

let cachedLocalBuildInfo: LocalDesktopBuildInfo | null = null;

export function getLocalDesktopBuildInfo(): LocalDesktopBuildInfo {
  if (!app.isPackaged) return { isLocal: false, commit: null };
  if (cachedLocalBuildInfo !== null) return cachedLocalBuildInfo;

  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(app.getAppPath(), "package.json"), "utf8"),
    ) as unknown;
    cachedLocalBuildInfo = readLocalDesktopBuildInfo(packageJson);
  } catch {
    cachedLocalBuildInfo = { isLocal: false, commit: null };
  }

  return cachedLocalBuildInfo;
}

export function isLocalDesktopBuild(): boolean {
  return getLocalDesktopBuildInfo().isLocal;
}
