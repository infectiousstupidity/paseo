import { readFileSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export const LOCAL_DESKTOP_BUILD_FLAVOR = "local";

export function hasLocalDesktopBuildFlavor(metadata: unknown): boolean {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return false;
  }
  return (metadata as Record<string, unknown>).paseoBuildFlavor === LOCAL_DESKTOP_BUILD_FLAVOR;
}

let cachedLocalBuild: boolean | null = null;

export function isLocalDesktopBuild(): boolean {
  if (!app.isPackaged) return false;
  if (cachedLocalBuild !== null) return cachedLocalBuild;

  try {
    const packageJson = JSON.parse(
      readFileSync(path.join(app.getAppPath(), "package.json"), "utf8"),
    ) as unknown;
    cachedLocalBuild = hasLocalDesktopBuildFlavor(packageJson);
  } catch {
    cachedLocalBuild = false;
  }

  return cachedLocalBuild;
}
