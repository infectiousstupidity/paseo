import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/unused"),
    isPackaged: false,
  },
}));

import { hasLocalDesktopBuildFlavor, readLocalDesktopBuildInfo } from "./local-build";

describe("local desktop build", () => {
  it("recognizes only the explicit local build flavor", () => {
    expect(hasLocalDesktopBuildFlavor({ paseoBuildFlavor: "local" })).toBe(true);
    expect(hasLocalDesktopBuildFlavor({ paseoBuildFlavor: "official" })).toBe(false);
    expect(hasLocalDesktopBuildFlavor({})).toBe(false);
    expect(hasLocalDesktopBuildFlavor(null)).toBe(false);
  });

  it("reads the stamped commit only for local builds", () => {
    expect(
      readLocalDesktopBuildInfo({
        paseoBuildFlavor: "local",
        paseoBuildCommit: "507d966c71bf",
      }),
    ).toEqual({ isLocal: true, commit: "507d966c71bf" });
    expect(
      readLocalDesktopBuildInfo({
        paseoBuildFlavor: "official",
        paseoBuildCommit: "507d966c71bf",
      }),
    ).toEqual({ isLocal: false, commit: null });
  });
});
