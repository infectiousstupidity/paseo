import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/unused"),
    isPackaged: false,
  },
}));

import { hasLocalDesktopBuildFlavor } from "./local-build";

describe("local desktop build", () => {
  it("recognizes only the explicit local build flavor", () => {
    expect(hasLocalDesktopBuildFlavor({ paseoBuildFlavor: "local" })).toBe(true);
    expect(hasLocalDesktopBuildFlavor({ paseoBuildFlavor: "official" })).toBe(false);
    expect(hasLocalDesktopBuildFlavor({})).toBe(false);
    expect(hasLocalDesktopBuildFlavor(null)).toBe(false);
  });
});
