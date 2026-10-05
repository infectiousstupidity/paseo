import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
  },
}));

import { readLocalDesktopBuildInfo } from "./local-build";

describe("local desktop build", () => {
  it("recognizes and reads only the explicit local build flavor", () => {
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

    expect(readLocalDesktopBuildInfo({})).toEqual({ isLocal: false, commit: null });
    expect(readLocalDesktopBuildInfo(null)).toEqual({ isLocal: false, commit: null });
  });

  it("allows a local marker without a commit while keeping it identifiable as local", () => {
    expect(readLocalDesktopBuildInfo({ paseoBuildFlavor: "local" })).toEqual({
      isLocal: true,
      commit: null,
    });
  });
});
