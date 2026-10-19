/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { ProviderSubagentDescriptorPayload } from "@getpaseo/protocol/messages";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubagentExpandedDetails } from "./expanded-details";
import { providerSubagentKey, useProviderSubagentStore } from "./provider-store";
import type { ProviderSubagentRow } from "./select";
import type { SubagentActivity } from "./subagent-activity";

const theme = vi.hoisted(() => ({
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24 },
  fontSize: { sm: 13 },
  fontWeight: { medium: "500" },
  borderRadius: { md: 6 },
  colors: {
    foreground: "#ffffff",
    foregroundMuted: "#aaaaaa",
    statusDotDanger: "#ff9999",
    surface1: "#171717",
    surface2: "#222222",
    border: "#555555",
    borderAccent: "#666666",
  },
}));

vi.mock("react-native-unistyles", () => ({
  StyleSheet: { create: (factory: (theme: unknown) => unknown) => factory(theme) },
  useUnistyles: () => ({ theme }),
  withUnistyles: (component: unknown) => component,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-native", () => ({
  View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement("div", { "data-testid": testID }, children),
  Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement("span", { "data-testid": testID }, children),
  Pressable: ({
    children,
    testID,
    onPress,
  }: {
    children?: React.ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        onClick: onPress,
      },
      children,
    ),
  TextInput: ({
    testID,
    value,
    onChangeText,
    placeholder,
  }: {
    testID?: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
  }) =>
    React.createElement("textarea", {
      "data-testid": testID,
      value,
      placeholder,
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChangeText(event.target.value),
    }),
}));

vi.mock("@/composer/tracks", () => ({
  ComposerTrackRow: ({
    children,
    testID,
    expanded,
    closeOnSelect,
    onPress,
  }: {
    children: React.ReactNode;
    testID?: string;
    expanded?: boolean;
    closeOnSelect?: boolean;
    onPress: () => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        "aria-expanded": expanded,
        "data-close-on-select": closeOnSelect,
        onClick: onPress,
      },
      children,
    ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    testID,
    disabled,
    onPress,
  }: {
    children: React.ReactNode;
    testID?: string;
    disabled?: boolean;
    onPress: () => void;
  }) =>
    React.createElement(
      "button",
      {
        type: "button",
        "data-testid": testID,
        disabled,
        onClick: onPress,
      },
      children,
    ),
}));

const row: ProviderSubagentRow = {
  kind: "provider",
  id: "worker-2",
  parentAgentId: "parent-1",
  provider: "pi",
  title: "Worker",
  description: "Inspect the second child",
  subtitle: null,
  activity: null,
  status: "running",
  controlEligible: true,
  requiresAttention: false,
  createdAt: new Date("2026-10-13T07:00:00Z"),
};

function addDescriptor(overrides: Partial<ProviderSubagentDescriptorPayload> = {}) {
  const descriptor: ProviderSubagentDescriptorPayload = {
    id: row.id,
    parentAgentId: row.parentAgentId,
    provider: "pi",
    title: "Worker",
    description: "Inspect the second child",
    status: "running",
    controlEligible: true,
    createdAt: "2026-10-13T07:00:00Z",
    updatedAt: "2026-10-13T07:01:00Z",
    toolCallId: null,
    ...overrides,
  };
  useProviderSubagentStore.setState({
    descriptors: new Map([[providerSubagentKey("server", row.parentAgentId, row.id), descriptor]]),
  });
}

const OBSERVED_ACTIVITY: SubagentActivity = { kind: "response", text: "Two findings observed." };

function clientFor(controlProviderSubagent: TestControlMethod): DaemonClient {
  return { controlProviderSubagent } as unknown as DaemonClient;
}

interface ControlReceipt {
  success: boolean;
  state?: string;
  runState?: string;
  deliveryStatus?: string;
  error?: string | null;
}

type TestControlMethod = (input: { action: string }) => Promise<ControlReceipt>;

function renderDetails(
  controlProviderSubagent: TestControlMethod = vi.fn(async () => ({
    success: true,
    state: "running",
    runState: "running",
  })),
  options: { stopping?: boolean; supportsControls?: boolean; row?: ProviderSubagentRow } = {},
) {
  const onStopAccepted = vi.fn();
  const onOpenSession = vi.fn();
  const view = render(
    <SubagentExpandedDetails
      row={options.row ?? row}
      serverId="server"
      client={clientFor(controlProviderSubagent)}
      supportsControls={options.supportsControls ?? true}
      activity={OBSERVED_ACTIVITY}
      age="5m"
      stopping={options.stopping ?? false}
      onStopAccepted={onStopAccepted}
      onOpenSession={onOpenSession}
    />,
  );
  return { ...view, controlProviderSubagent, onStopAccepted, onOpenSession };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useProviderSubagentStore.setState({ descriptors: new Map() });
});

describe("scoped Pi subagent panel controls", () => {
  it("does not expose native controls without verified child eligibility and a capable host", () => {
    addDescriptor();
    const other = { ...row, provider: "claude" as const };
    const { rerender, onOpenSession } = renderDetails(undefined, { row: other });
    expect(screen.queryByTestId("subagents-track-stop-worker-2")).toBeNull();
    expect(screen.queryByTestId("subagents-track-steer-worker-2")).toBeNull();
    fireEvent.click(screen.getByTestId("subagents-track-open-worker-2"));
    expect(onOpenSession).toHaveBeenCalledTimes(1);
    rerender(
      <SubagentExpandedDetails
        row={row}
        serverId="server"
        client={null}
        supportsControls={false}
        activity={null}
        age={null}
        stopping={false}
        onStopAccepted={vi.fn()}
        onOpenSession={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("subagents-track-stop-worker-2")).toBeNull();
    expect(screen.queryByTestId("subagents-track-status-worker-2")).toBeNull();
  });

  it("discloses and hides the original task without selecting away from the list", () => {
    renderDetails();
    const toggle = screen.getByTestId("subagents-track-original-task-toggle-worker-2");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("data-close-on-select")).toBe("false");
    expect(screen.queryByTestId("subagents-track-original-task-worker-2")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("subagents-track-original-task-worker-2").textContent).toBe(
      "Inspect the second child",
    );
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("subagents-track-original-task-worker-2")).toBeNull();
  });

  it("requires explicit confirmation and accepts stopping without claiming terminal state", async () => {
    addDescriptor();
    const client = vi.fn(async () => ({ success: true, state: "stopping" }));
    const { onStopAccepted, rerender } = renderDetails(client);
    fireEvent.click(screen.getByTestId("subagents-track-stop-worker-2"));
    expect(client).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("subagents-track-cancel-stop-worker-2"));
    expect(client).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("subagents-track-stop-worker-2"));
    fireEvent.click(screen.getByTestId("subagents-track-confirm-stop-worker-2"));
    await waitFor(() => expect(onStopAccepted).toHaveBeenCalledTimes(1));
    expect(client).toHaveBeenCalledTimes(1);
    expect(client).toHaveBeenCalledWith({
      parentAgentId: "parent-1",
      subagentId: "worker-2",
      action: "stop",
    });
    // Parent owns pending stop across collapse/reopen until an observed terminal status.
    rerender(
      <SubagentExpandedDetails
        row={row}
        serverId="server"
        client={clientFor(client)}
        supportsControls
        activity={null}
        age={null}
        stopping
        onStopAccepted={onStopAccepted}
        onOpenSession={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("subagents-track-stop-worker-2")).toBeNull();
    expect(screen.getByTestId("subagents-track-stopping-worker-2")).toBeTruthy();
  });

  it("sends scoped status and steer RPCs and preserves queued delivery receipts", async () => {
    addDescriptor();
    const client = vi.fn(async (input: { action: string }) =>
      input.action === "steer"
        ? { success: true, deliveryStatus: "queued" }
        : { success: true, state: "running", runState: "running" },
    );
    renderDetails(client);
    fireEvent.click(screen.getByTestId("subagents-track-status-worker-2"));
    await waitFor(() => expect(client).toHaveBeenCalledTimes(1));
    const steerInput = await screen.findByTestId("subagents-track-steer-input-worker-2");
    fireEvent.change(steerInput, {
      target: { value: "Focus on tests" },
    });
    fireEvent.click(screen.getByTestId("subagents-track-steer-worker-2"));
    await waitFor(() => expect(client).toHaveBeenCalledTimes(2));
    expect(client).toHaveBeenLastCalledWith({
      parentAgentId: "parent-1",
      subagentId: "worker-2",
      action: "steer",
      message: "Focus on tests",
    });
    await waitFor(() =>
      expect(screen.getByTestId("subagents-track-feedback-worker-2").textContent).toBe(
        "subagents.panel.queued",
      ),
    );
  });

  it("fails closed on stale or wrong-session identity without sending an RPC", () => {
    addDescriptor({ controlEligible: false });
    const client = vi.fn();
    renderDetails(client);
    fireEvent.click(screen.getByTestId("subagents-track-stop-worker-2"));
    fireEvent.click(screen.getByTestId("subagents-track-confirm-stop-worker-2"));
    expect(client).not.toHaveBeenCalled();
    expect(screen.getByTestId("subagents-track-feedback-worker-2").textContent).toBe(
      "subagents.panel.unavailableControl",
    );
  });
});
