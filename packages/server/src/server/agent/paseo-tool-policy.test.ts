import { describe, expect, test } from "vitest";
import type { ProviderPaseoToolsPolicy } from "@getpaseo/protocol/provider-config";

import { isPaseoToolEnabled, resolvePaseoToolPolicy } from "./paseo-tool-policy.js";

describe("Paseo tool policy", () => {
  test("defaults to all Paseo tools and resolves only the exact provider ID", () => {
    const customPolicy = {
      enabled: true,
      disabledTools: ["list_agents"],
    } satisfies ProviderPaseoToolsPolicy;

    expect(
      resolvePaseoToolPolicy("custom-claude", {
        claude: { paseoTools: { enabled: false } },
        "custom-claude": { paseoTools: customPolicy },
      }),
    ).toBe(customPolicy);
    expect(resolvePaseoToolPolicy("other-custom", { claude: { paseoTools: customPolicy } })).toBe(
      undefined,
    );
    expect(isPaseoToolEnabled(undefined, "list_agents")).toBe(true);
  });

  test("omits the automation families under toolset core and keeps them under full or absent", () => {
    expect(isPaseoToolEnabled({ toolset: "core" }, "create_schedule")).toBe(false);
    expect(isPaseoToolEnabled({ toolset: "core" }, "create_terminal")).toBe(false);
    expect(isPaseoToolEnabled({ toolset: "core" }, "start_workspace_script")).toBe(false);
    expect(isPaseoToolEnabled({ toolset: "core" }, "create_agent")).toBe(true);
    expect(isPaseoToolEnabled({ toolset: "core" }, "create_workspace")).toBe(true);
    expect(isPaseoToolEnabled({ toolset: "core" }, "speak")).toBe(true);
    expect(isPaseoToolEnabled({ toolset: "full" }, "create_schedule")).toBe(true);
    expect(isPaseoToolEnabled(undefined, "create_schedule")).toBe(true);
    expect(
      isPaseoToolEnabled({ toolset: "core", disabledTools: ["create_agent"] }, "create_agent"),
    ).toBe(false);
  });

  test("applies the provider gate and sparse disabled tools without filtering speak", () => {
    expect(isPaseoToolEnabled({ enabled: false }, "list_agents")).toBe(false);
    expect(isPaseoToolEnabled({ enabled: false }, "speak")).toBe(true);
    expect(
      isPaseoToolEnabled({ enabled: true, disabledTools: ["list_agents"] }, "list_agents"),
    ).toBe(false);
    expect(
      isPaseoToolEnabled({ enabled: true, disabledTools: ["list_agents"] }, "create_agent"),
    ).toBe(true);
  });
});
